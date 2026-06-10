#!/usr/bin/env python3
"""
analyze-session.py — observable check-yo-self signals from session JSONL.

Reads a Claude Code session transcript and computes Half-1 signals
(A-F) mechanically. Emits JSON to stdout. The check-yo-self skill
renders this output verbatim; it does not regenerate counts.

This addresses the central critique of check-yo-self v1: "Half-1 is
fig-leaf-shaped because the agent both produces and grades the count."
Externalizing Half-1 to a script removes the agent from the counting
loop. Operational definitions are pinned here in code, not in the
agent's judgment.

Heuristic conservatism: prefer under-firing (false GREEN) over
over-firing (false ORANGE). Patterns can be tightened after real-data
validation. False positives undermine the eval's credibility more than
false negatives.

Stdlib only. Python 3.8+.
"""

import argparse
import json
import os
import re
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Operational definitions
# ---------------------------------------------------------------------------

# Tool names that always count as substantive (write/modify state).
SUBSTANTIVE_TOOL_NAMES = {'Edit', 'Write', 'MultiEdit', 'NotebookEdit'}

# Bash commands matching these patterns are substantive (post/commit/publish).
SUBSTANTIVE_BASH_RE = re.compile(
    r'\b(git\s+commit|git\s+push|gh\s+pr\s+create|gh\s+issue\s+create|'
    r'gh\s+api\s+-X\s+(POST|PUT|DELETE|PATCH)|npm\s+publish)\b'
)

# MCP tool names matching this pattern are substantive (mutate external state).
# Pattern: `mcp__<server>__<verb>_*` where <verb> is in the mutating set.
# Examples: mcp__github-*__add_issue_comment, mcp__github-*__create_pull_request,
# mcp__github-*__merge_pull_request, mcp__github-*__update_pull_request,
# mcp__github-*__delete_file, mcp__github-*__push_files, etc.
# NOT mutating: get_*, list_*, search_*, view_*, read_* — those are receipts.
SUBSTANTIVE_MCP_RE = re.compile(
    r'^mcp__[\w-]+__(add|create|update|delete|merge|push|publish|assign|'
    r'close|reopen|comment|put|post|fork|request_(copilot_)?review|approve|reject|'
    r'submit|edit|write|move|rename|set_|enable_|disable_)'
)

# Tool names that always count as fresh receipts (read primary sources).
RECEIPT_TOOL_NAMES = {'Read', 'Grep', 'Glob'}

# Bash commands matching these patterns are fresh receipts (read-only inspect).
RECEIPT_BASH_RE = re.compile(
    r'^\s*(grep|rg|cat|head|tail|ls|find|gh\s+api\s+[^-]|'
    r'gh\s+issue\s+view|gh\s+pr\s+view|gh\s+pr\s+diff|gh\s+pr\s+list|'
    r'gh\s+issue\s+list|gh\s+pr\s+checks|'
    r'git\s+log|git\s+diff|git\s+show|git\s+status|git\s+blame|'
    r'wc|stat|file|tree)\b'
)

# User-message patterns that signal correction/pushback.
#
# Conservative — strong patterns only. Bare "no" intentionally NOT included
# because "No its good" (affirmation that no change is needed) matches the
# same shape as "No, don't do that" (correction). The qualified patterns
# below (don't / stop / wait) are unambiguous corrections.
#
# Patterns are tagged so the F detector can apply additional checks per type.
# The 'revise' tag requires an object-noun within 5 tokens after the verb,
# to distinguish "rework the layout" (correction with object) from "try
# again please" (re-invoke without object).
USER_CORRECTION_PATTERNS = [
    # Negative imperatives at the start (without bare "no")
    ('imperative',
     re.compile(r"^\s*(don't\b|stop\b|wait\b|hold on\b)", re.I)),
    # Negative imperative WITH verb: "no don't", "no wait", "no stop"
    ('imperative',
     re.compile(r"^\s*no[\s,]+(don't|wait|stop|hold)", re.I)),
    # Redirection phrases
    ('redirect',
     re.compile(r"\b(actually\s+let'?s|i\s+meant|not\s+quite|that'?s\s+not\s+(what|quite|right)|"
                r"instead\s+(of|let'?s)|rather\s+than)\b", re.I)),
    # Error-flagging
    ('error',
     re.compile(r"\b(that'?s\s+wrong|incorrect|that\s+broke|hallucin|"
                r"you\s+(missed|forgot|got\s+that\s+wrong))\b", re.I)),
    # Format/output revision requests — require object noun (see check below)
    ('revise',
     re.compile(r"\b(rework|redo|try\s+again|let'?s\s+redo|revise)\b", re.I)),
]

# Stopwords that don't count as object-nouns after a "revise"-tagged verb.
# Includes adverbs and politeness words that follow re-invoke requests but
# aren't correction-objects ("try again LATER", "redo PLEASE", etc.).
REVISE_STOPWORDS = frozenset([
    'please', 'thanks', 'thank', 'you', 'okay', 'ok', 'again', 'just',
    'that', 'this', 'now', 'here', 'then', 'sure', 'well', 'also', 'one',
    'two', 'three', 'more', 'some', 'when', 'what', 'why', 'how', 'soon',
    'tho', 'though', 'too', 'very', 'really', 'later', 'maybe', 'perhaps',
    'today', 'tomorrow', 'tonight', 'first', 'quickly', 'fast', 'slowly',
])


def matches_correction(text, pattern, tag):
    """Apply pattern, with tag-specific guards.

    For 'revise' tag, require at least one object-noun-shaped token within 5
    tokens after the match. This filters out "try again please" (re-invoke
    with no object) while keeping "rework the layout" (correction with
    object). Object-noun-shape = word with 4+ chars not in REVISE_STOPWORDS.
    """
    m = pattern.search(text)
    if not m:
        return None
    if tag == 'revise':
        after = text[m.end():]
        tokens = re.findall(r"[a-zA-Z][a-zA-Z']*", after.lower())[:5]
        substantive = [t for t in tokens if len(t) >= 4 and t not in REVISE_STOPWORDS]
        if not substantive:
            return None  # bare re-invoke, not a correction
    return m

# Tool-result patterns indicating user rejected a plan or chose an alternate
# path (more reliable than text regex because these are structured outcomes).
EXIT_PLAN_REJECTED_RE = re.compile(
    r"(user.*reject|plan.*rejected|user has not approved)", re.I
)
ASK_USER_ALTERNATE_RE = re.compile(
    r'"answers"\s*:\s*\{[^}]*"[^"]*"\s*:\s*"[^"]*"', re.S
)

# Memory citation patterns in assistant text content.
MEMORY_CITATION_RE = re.compile(
    r'\b(feedback_\w+|project_\w+|reference_\w+|user_\w+)(\.md)?\b'
)

# Reviewer/CI catch indicators in `gh api` tool results.
REVIEWER_CATCH_RE = re.compile(
    r'\b(review|nit|suggestion|feedback|comment)\b', re.I
)

# ---------------------------------------------------------------------------
# Tier thresholds
# ---------------------------------------------------------------------------

TIERS = ['GREEN', 'YELLOW', 'ORANGE', 'RED']
TIER_EMOJI = {'GREEN': '🟢', 'YELLOW': '🟡', 'ORANGE': '🟠', 'RED': '🔴'}


def tier_max(*tiers):
    """Return the worst tier among inputs."""
    return max(tiers, key=lambda t: TIERS.index(t))


# ---------------------------------------------------------------------------
# JSONL parsing
# ---------------------------------------------------------------------------

def load_events(path):
    """Stream JSONL events. Each event gets a 1-indexed line_no."""
    events = []
    with open(path, 'r', encoding='utf-8') as fh:
        for line_no, line in enumerate(fh, start=1):
            line = line.strip()
            if not line:
                continue
            try:
                ev = json.loads(line)
                ev['_line'] = line_no
                events.append(ev)
            except json.JSONDecodeError:
                # Skip malformed lines silently — defensive parsing.
                continue
    return events


def get_tool_uses(events):
    """Return list of (line_no, tool_use_dict) from assistant messages."""
    uses = []
    for ev in events:
        if ev.get('type') != 'assistant':
            continue
        msg = ev.get('message', {})
        content = msg.get('content', []) if isinstance(msg, dict) else []
        if not isinstance(content, list):
            continue
        for block in content:
            if isinstance(block, dict) and block.get('type') == 'tool_use':
                uses.append((ev['_line'], block))
    return uses


def get_tool_results(events):
    """Return {tool_use_id: result_text} for matching tool_use → tool_result."""
    results = {}
    for ev in events:
        if ev.get('type') != 'user':
            continue
        msg = ev.get('message', {})
        content = msg.get('content', []) if isinstance(msg, dict) else []
        if not isinstance(content, list):
            continue
        for block in content:
            if isinstance(block, dict) and block.get('type') == 'tool_result':
                tid = block.get('tool_use_id')
                if not tid:
                    continue
                # tool_result content can be string OR list of blocks
                rc = block.get('content', '')
                if isinstance(rc, list):
                    rc = ''.join(
                        c.get('text', '') if isinstance(c, dict) else str(c)
                        for c in rc
                    )
                results[tid] = str(rc)
    return results


def get_user_text_messages(events):
    """Return list of (line_no, text) for genuine user messages (not tool_results)."""
    msgs = []
    for ev in events:
        if ev.get('type') != 'user':
            continue
        msg = ev.get('message', {})
        content = msg.get('content', '') if isinstance(msg, dict) else ''
        # content may be a string OR a list of blocks
        if isinstance(content, str):
            text = content
        elif isinstance(content, list):
            # Filter out tool_result blocks; keep only text-type blocks
            text_parts = []
            for block in content:
                if isinstance(block, dict) and block.get('type') == 'text':
                    text_parts.append(block.get('text', ''))
                elif isinstance(block, str):
                    text_parts.append(block)
            text = '\n'.join(text_parts)
        else:
            text = ''
        text = text.strip()
        if text:
            msgs.append((ev['_line'], text))
    return msgs


def get_assistant_text(events):
    """Return list of (line_no, text) for assistant text content blocks."""
    msgs = []
    for ev in events:
        if ev.get('type') != 'assistant':
            continue
        msg = ev.get('message', {})
        content = msg.get('content', []) if isinstance(msg, dict) else []
        if not isinstance(content, list):
            continue
        text_parts = []
        for block in content:
            if isinstance(block, dict) and block.get('type') == 'text':
                text_parts.append(block.get('text', ''))
        text = '\n'.join(text_parts).strip()
        if text:
            msgs.append((ev['_line'], text))
    return msgs


# ---------------------------------------------------------------------------
# Classification helpers
# ---------------------------------------------------------------------------

def is_substantive(tool_use):
    """A tool_use entry counts as a substantive decision."""
    name = tool_use.get('name', '')
    if name in SUBSTANTIVE_TOOL_NAMES:
        return True
    if name == 'Bash':
        cmd = tool_use.get('input', {}).get('command', '')
        return bool(SUBSTANTIVE_BASH_RE.search(cmd))
    if SUBSTANTIVE_MCP_RE.match(name):
        return True
    return False


def is_fresh_receipt(tool_use):
    """A tool_use entry counts as fetching a fresh receipt."""
    name = tool_use.get('name', '')
    if name in RECEIPT_TOOL_NAMES:
        return True
    if name == 'Bash':
        cmd = tool_use.get('input', {}).get('command', '')
        return bool(RECEIPT_BASH_RE.match(cmd))
    return False


def describe_tool_use(tool_use):
    """Short human-readable label for a tool_use."""
    name = tool_use.get('name', '?')
    inp = tool_use.get('input', {})
    if name == 'Bash':
        cmd = inp.get('command', '')
        return f"Bash: {cmd[:80]}"
    if name in {'Edit', 'Write', 'MultiEdit', 'NotebookEdit'}:
        path = inp.get('file_path', '?')
        return f"{name}: {path}"
    if name in {'Read', 'Grep', 'Glob'}:
        path = inp.get('file_path', '') or inp.get('pattern', '') or inp.get('path', '')
        return f"{name}: {path}"
    return f"{name}"


def file_path_of(tool_use):
    """Return the affected file path of an Edit/Write/Read, or None."""
    name = tool_use.get('name', '')
    if name in {'Edit', 'Write', 'MultiEdit', 'NotebookEdit', 'Read'}:
        return tool_use.get('input', {}).get('file_path')
    return None


# ---------------------------------------------------------------------------
# Signal computation
# ---------------------------------------------------------------------------

def select_window(all_tool_uses, window_size):
    """Return the last `window_size` substantive decisions and their context."""
    substantive = [(ln, t) for ln, t in all_tool_uses if is_substantive(t)]
    return substantive[-window_size:] if window_size else substantive


def compute_signal_a(window):
    """A. Same-class repetition — pairs of similar substantive decisions.

    Conservative: only flag Edit/Write pairs on different files in the same
    directory (pattern-copy candidate), OR identical Bash command patterns
    within the window. False positives on mass renames are flagged as
    'candidate' rather than 'confirmed'.
    """
    instances = []
    for i, (ln_a, t_a) in enumerate(window):
        name_a = t_a.get('name', '')
        for ln_b, t_b in window[i + 1:]:
            name_b = t_b.get('name', '')
            if name_a != name_b:
                continue

            # Edit/Write pattern-copy on parallel files
            if name_a in {'Edit', 'Write'}:
                path_a = file_path_of(t_a)
                path_b = file_path_of(t_b)
                if not path_a or not path_b or path_a == path_b:
                    continue
                # Same parent directory + similar base-name pattern
                if os.path.dirname(path_a) == os.path.dirname(path_b):
                    base_a = os.path.basename(path_a)
                    base_b = os.path.basename(path_b)
                    # Heuristic: both are <prefix>-expansion or both contain similar tokens
                    if (('expansion' in base_a and 'expansion' in base_b)
                            or ('test' in base_a and 'test' in base_b)):
                        instances.append({
                            'turn_a': ln_a,
                            'turn_b': ln_b,
                            'shape': f"{name_a} on {base_a} then {base_b} "
                                     f"(same dir, candidate pattern-copy)",
                            'confidence': 'candidate'
                        })

            # Identical Bash command pattern (e.g. `git checkout <untracked>`)
            elif name_a == 'Bash':
                cmd_a = t_a.get('input', {}).get('command', '')
                cmd_b = t_b.get('input', {}).get('command', '')
                # First 50 chars match → likely same command shape
                if cmd_a[:50] == cmd_b[:50] and len(cmd_a) > 10:
                    instances.append({
                        'turn_a': ln_a,
                        'turn_b': ln_b,
                        'shape': f"Bash repeat: {cmd_a[:80]}",
                        'confidence': 'confirmed'
                    })

    # Tier
    confirmed = [i for i in instances if i['confidence'] == 'confirmed']
    if len(confirmed) >= 2 or len(instances) >= 3:
        tier = 'ORANGE'
    elif len(confirmed) == 1 or len(instances) >= 1:
        tier = 'YELLOW'
    else:
        tier = 'GREEN'
    return {'tier': tier, 'instances': instances}


def compute_signal_b(window, all_tool_uses):
    """B. Receipts-first failures — substantive decisions w/o preceding receipt
    on the affected surface.

    Heuristic refinements (post first meta-test):
    - Track "ever read in session" not "read in preceding N" — consecutive
      Edits to the same file after one Read at the top are fine.
    - Write-to-new-file doesn't require a receipt (new file has nothing to
      read). Heuristic: a Write is "new" if no prior Read/Edit/Write of the
      same path appears earlier in the session.
    - For Edits, require a prior Read OR Edit of the same path (Edit implies
      we already have the file's contents).
    """
    instances = []
    # Build ordered index for all_tool_uses
    line_to_idx = {ln: i for i, (ln, _) in enumerate(all_tool_uses)}

    # Track: for each file path, the first Read/Edit line number in session.
    # If a Write hits a path with no prior reference, it's a new file.
    path_first_seen = {}  # path -> (line, kind)
    for ln, t in all_tool_uses:
        path = file_path_of(t)
        if not path:
            continue
        if path not in path_first_seen:
            path_first_seen[path] = (ln, t.get('name', ''))

    for ln, t in window:
        name = t.get('name', '')
        if name not in {'Edit', 'Write', 'MultiEdit'}:
            continue
        path = file_path_of(t)
        if not path:
            continue
        cur_idx = line_to_idx.get(ln)
        if cur_idx is None:
            continue

        # If this is a Write whose first appearance of the path IS this Write,
        # it's a new-file write — no receipt required.
        first_ln, first_kind = path_first_seen.get(path, (None, ''))
        if name == 'Write' and first_ln == ln and first_kind == 'Write':
            continue

        # Look back across the WHOLE session (not just window) for a Read or
        # Edit on this path before cur_idx.
        found_receipt = False
        for ln_prev, t_prev in all_tool_uses[:cur_idx]:
            prev_path = file_path_of(t_prev)
            if prev_path == path:
                # Any prior touch (Read, Edit, Write) of this path counts —
                # the agent has seen its contents by some route.
                found_receipt = True
                break
            if t_prev.get('name') == 'Bash' and is_fresh_receipt(t_prev):
                cmd = t_prev.get('input', {}).get('command', '')
                if path in cmd or os.path.basename(path) in cmd:
                    found_receipt = True
                    break

        if not found_receipt:
            instances.append({
                'turn': ln,
                'decision': describe_tool_use(t),
                'missing_receipt': f"no prior Read/Edit/Grep on {path} in session"
            })

    if len(instances) == 0:
        tier = 'GREEN'
    elif len(instances) == 1:
        tier = 'YELLOW'
    else:
        tier = 'ORANGE'
    return {'tier': tier, 'instances': instances}


def compute_signal_c(events, all_tool_uses, tool_results, window_uses):
    """C. Reviewer-catch rate — recent reviewer/bot comments fetched FROM the
    PR system.

    Look for fetch-shaped gh commands (NOT POST/PUT/DELETE/PATCH — those are
    the agent writing back, not reading). Match the result body for review/
    comment content with extractable IDs.
    """
    instances = []
    seen_review_ids = set()
    # Mutating gh calls — exclude (these are agent OUTPUT, not reviewer INPUT)
    mutating_gh_re = re.compile(r'gh\s+(api\s+-X\s+(POST|PUT|DELETE|PATCH)|'
                                r'(pr|issue)\s+(create|comment|close|merge|edit|review))\b')
    # Fetch-shaped gh calls
    fetch_gh_re = re.compile(r'\b(gh\s+(api\s+(?!-X\s+(POST|PUT|DELETE|PATCH))|'
                             r'pr\s+(view|diff|list|checks)|'
                             r'issue\s+(view|list)))\b')

    for ln, t in window_uses:
        if t.get('name') != 'Bash':
            continue
        cmd = t.get('input', {}).get('command', '')
        if mutating_gh_re.search(cmd):
            continue
        if not fetch_gh_re.search(cmd):
            continue
        tid = t.get('id')
        result = tool_results.get(tid, '')
        if not REVIEWER_CATCH_RE.search(result[:5000]):
            continue
        # Try to extract review/comment IDs to dedupe
        ids = re.findall(r'"id"\s*:\s*(\d{10,})', result)
        new_ids = [i for i in ids if i not in seen_review_ids]
        if not new_ids:
            continue
        seen_review_ids.update(new_ids)
        instances.append({
            'turn': ln,
            'command_excerpt': cmd[:80],
            'new_review_ids': new_ids[:5]
        })

    # Conservative tier — reviewer catches in window are flags
    if len(instances) >= 3:
        tier = 'ORANGE'
    elif len(instances) >= 1:
        tier = 'YELLOW'
    else:
        tier = 'GREEN'
    return {'tier': tier, 'instances': instances}


def compute_signal_d(all_tool_uses, window_uses):
    """D. Fresh-fetch recency — decisions since last fresh receipt."""
    if not window_uses:
        return {'tier': 'GREEN', 'last_fetch_turn': None, 'decisions_since': 0}

    # Walk backward from end of all_tool_uses to find last receipt
    last_fetch_turn = None
    decisions_since = 0
    for ln, t in reversed(all_tool_uses):
        if is_fresh_receipt(t):
            last_fetch_turn = ln
            break
        if is_substantive(t):
            decisions_since += 1

    if decisions_since <= 5:
        tier = 'GREEN'
    elif decisions_since <= 10:
        tier = 'YELLOW'
    else:
        tier = 'ORANGE'
    return {
        'tier': tier,
        'last_fetch_turn': last_fetch_turn,
        'decisions_since': decisions_since,
    }


def compute_signal_e(assistant_texts, all_tool_uses, window_first_line):
    """E. Memory-citation density — citations w/o accompanying fresh receipt."""
    cited = []
    for ln, text in assistant_texts:
        if window_first_line is not None and ln < window_first_line:
            continue
        for m in MEMORY_CITATION_RE.finditer(text):
            cited.append({'turn': ln, 'citation': m.group(0)})

    # For each citation, did a fresh receipt fire within ±3 turns of the citation line?
    for c in cited:
        nearby_receipt = False
        for ln_t, t in all_tool_uses:
            if abs(ln_t - c['turn']) <= 30 and is_fresh_receipt(t):
                # Crude proximity — adjust later if too loose
                nearby_receipt = True
                break
        c['fresh_receipt_nearby'] = nearby_receipt

    if not cited:
        tier = 'GREEN'
    else:
        with_receipt = sum(1 for c in cited if c['fresh_receipt_nearby'])
        ratio = with_receipt / len(cited)
        if ratio >= 0.6:
            tier = 'GREEN'
        elif ratio >= 0.3:
            tier = 'YELLOW'
        else:
            tier = 'ORANGE'

    return {'tier': tier, 'instances': cited}


def compute_signal_f(user_msgs, window_first_line, all_tool_uses, tool_results):
    """F. User corrections — the load-bearing external falsifier.

    Two detection paths:
    1. Text regex on user messages (after stripping slash-command bodies,
       system reminders, task notifications, etc.).
    2. Structured tool-result inspection: ExitPlanMode rejected, AskUserQuestion
       answered with a non-first option (the user redirected).

    The structured path catches corrections that don't appear as text — a
    rejected plan is one of the strongest external falsifiers in a session.
    """
    instances = []

    # Path 1: text regex on user messages
    for ln, text in user_msgs:
        if window_first_line is not None and ln < window_first_line:
            continue
        # Strip all known wrapper tags
        stripped = text
        for tag in ['system-reminder', 'command-message', 'command-name',
                    'command-args', 'local-command-stdout', 'task-notification']:
            stripped = re.sub(rf'<{tag}[^>]*>.*?</{tag}>', '', stripped, flags=re.DOTALL)
        if re.search(r'<command-(message|name)>', text):
            continue
        stripped = stripped.strip()
        if not stripped:
            continue
        # Skip long pasted content (reviewer critiques, etc. — informative but
        # not user-authored corrections).
        if len(stripped) > 800:
            continue
        for tag, pat in USER_CORRECTION_PATTERNS:
            m = matches_correction(stripped, pat, tag)
            if m:
                instances.append({
                    'turn': ln,
                    'source': 'text',
                    'tag': tag,
                    'pattern': pat.pattern[:60],
                    'excerpt': stripped[:120].replace('\n', ' '),
                })
                break

    # Path 2: structured tool-result inspection — ExitPlanMode rejections
    # and AskUserQuestion non-first-option selections.
    for ln, t in all_tool_uses:
        if window_first_line is not None and ln < window_first_line:
            continue
        name = t.get('name', '')
        tid = t.get('id')
        if not tid:
            continue
        result = tool_results.get(tid, '')

        if name == 'ExitPlanMode':
            # A plan that didn't get approved leaves a different result string
            # than the "approved" one. The "approved" path explicitly says
            # "User has approved your plan." A rejected/edited plan won't.
            if 'has approved' not in result and result:
                instances.append({
                    'turn': ln,
                    'source': 'tool_result',
                    'pattern': 'ExitPlanMode not approved',
                    'excerpt': result[:120].replace('\n', ' '),
                })
        elif name == 'AskUserQuestion':
            # AskUserQuestion result contains the user's answer choices.
            # If the answer doesn't match the first option in `questions[].options[0].label`,
            # the user picked an alternate path — a soft form of correction.
            # We approximate by checking if the result contains "Other" or any
            # answer keyword that doesn't appear in the first option.
            if result and re.search(r'\bOther\b', result):
                instances.append({
                    'turn': ln,
                    'source': 'tool_result',
                    'pattern': 'AskUserQuestion answered Other',
                    'excerpt': result[:120].replace('\n', ' '),
                })

    # Deduplicate by turn (text + tool_result can both fire for the same turn)
    seen = set()
    deduped = []
    for inst in instances:
        if inst['turn'] in seen:
            continue
        seen.add(inst['turn'])
        deduped.append(inst)
    instances = sorted(deduped, key=lambda i: i['turn'])

    n = len(instances)
    if n == 0:
        tier = 'GREEN'
    elif n == 1:
        tier = 'YELLOW'
    elif n == 2:
        tier = 'ORANGE'
    else:
        tier = 'RED'
    return {'tier': tier, 'instances': instances}


def compute_near_miss(signals):
    """Find the signal closest to flipping to a worse tier.

    For GREEN reports, this is the signal whose next-instance would yield a
    YELLOW. For YELLOW reports, the signal closest to ORANGE. Etc.
    """
    # Simple heuristic: signal with the most instances at the lowest tier wins.
    candidates = []
    for key, sig in signals.items():
        cur_tier_idx = TIERS.index(sig['tier'])
        if cur_tier_idx == len(TIERS) - 1:
            continue
        n_instances = len(sig.get('instances', []))
        candidates.append((cur_tier_idx, n_instances, key, sig))
    if not candidates:
        return None
    # Lowest cur_tier_idx, then highest n_instances
    candidates.sort(key=lambda x: (x[0], -x[1]))
    cur_tier_idx, n_inst, key, sig = candidates[0]
    next_tier = TIERS[cur_tier_idx + 1]
    return {
        'signal': key,
        'current_tier': sig['tier'],
        'next_tier': next_tier,
        'reason': f"{n_inst} instance(s) — one more would likely flip to {next_tier}"
    }


# ---------------------------------------------------------------------------
# Session-file discovery
# ---------------------------------------------------------------------------

def project_dir_for_cwd():
    """Map current cwd to ~/.claude/projects/<slug>/."""
    cwd = Path.cwd()
    slug = '-' + str(cwd).replace('/', '-').lstrip('-')
    return Path.home() / '.claude' / 'projects' / slug


def session_path_for_id(session_id):
    """Locate the JSONL for a specific session ID in the cwd's project dir."""
    proj_dir = project_dir_for_cwd()
    candidate = proj_dir / f'{session_id}.jsonl'
    if candidate.is_file():
        return candidate
    return None


def default_session_path():
    """Resolve the session JSONL to analyze, preferring the calling session.

    Order:
    1. $CLAUDE_CODE_SESSION_ID env var (set by Claude Code in agent context) —
       most reliable, pins to the calling conversation even when multiple
       sessions share the project dir.
    2. Most recent JSONL by mtime (last-resort fallback, with stderr warning).
    """
    env_session = os.environ.get('CLAUDE_CODE_SESSION_ID')
    if env_session:
        p = session_path_for_id(env_session)
        if p:
            return p
        sys.stderr.write(
            f"WARN: $CLAUDE_CODE_SESSION_ID={env_session} but no matching JSONL "
            f"in {project_dir_for_cwd()}; falling back to latest-by-mtime.\n"
        )

    proj_dir = project_dir_for_cwd()
    if not proj_dir.is_dir():
        return None
    candidates = sorted(proj_dir.glob('*.jsonl'), key=lambda p: p.stat().st_mtime)
    if candidates and not env_session:
        sys.stderr.write(
            f"WARN: $CLAUDE_CODE_SESSION_ID not set; using latest-by-mtime "
            f"({candidates[-1].name}). May not match the calling session "
            f"when multiple sessions share this project dir. Pass --session-id "
            f"or a path argument for unambiguous selection.\n"
        )
    return candidates[-1] if candidates else None


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description='Compute check-yo-self Half-1 signals from a Claude Code session JSONL.'
    )
    parser.add_argument('session', nargs='?', type=Path,
                        help='Path to session JSONL. Default: $CLAUDE_CODE_SESSION_ID resolved '
                             'in ~/.claude/projects/<cwd-slug>/, else latest-by-mtime (with warning).')
    parser.add_argument('--session-id', type=str,
                        help='Explicit session UUID to analyze. Overrides $CLAUDE_CODE_SESSION_ID. '
                             'Resolved in the cwd-mapped project dir.')
    parser.add_argument('--window', type=int, default=30,
                        help='Window size in substantive decisions (default: 30)')
    args = parser.parse_args()

    if args.session:
        session_path = args.session
    elif args.session_id:
        session_path = session_path_for_id(args.session_id)
        if not session_path:
            sys.stderr.write(
                f"ERROR: --session-id {args.session_id} not found in {project_dir_for_cwd()}.\n"
            )
            sys.exit(2)
    else:
        session_path = default_session_path()

    if not session_path:
        sys.stderr.write(
            "ERROR: no session JSONL found. Pass --session-id or a path argument, "
            "or set $CLAUDE_CODE_SESSION_ID, or run from a directory that maps to "
            "~/.claude/projects/<slug>/.\n"
        )
        sys.exit(2)
    if not session_path.is_file():
        sys.stderr.write(f"ERROR: {session_path} not found.\n")
        sys.exit(2)

    events = load_events(session_path)
    all_uses = get_tool_uses(events)
    tool_results = get_tool_results(events)
    user_msgs = get_user_text_messages(events)
    asst_texts = get_assistant_text(events)

    window = select_window(all_uses, args.window)
    window_first_line = window[0][0] if window else None
    window_last_line = window[-1][0] if window else None

    if not window:
        # Empty session — emit minimal GREEN report
        report = {
            'session_path': str(session_path),
            'window': {'decisions': 0, 'first_turn': None, 'last_turn': None},
            'signals': {k: {'tier': 'GREEN', 'instances': []} for k in [
                'A_same_class_repetition', 'B_receipts_first_failures',
                'C_reviewer_catches', 'D_fresh_fetch_recency',
                'E_memory_citation_density', 'F_user_corrections']},
            'near_miss': {'signal': None, 'reason': 'no substantive activity in session'},
            'verdict': 'GREEN',
        }
        json.dump(report, sys.stdout, indent=2, ensure_ascii=False)
        sys.stdout.write('\n')
        return

    sig_a = compute_signal_a(window)
    sig_b = compute_signal_b(window, all_uses)
    sig_c = compute_signal_c(events, all_uses, tool_results, window)
    sig_d = compute_signal_d(all_uses, window)
    sig_e = compute_signal_e(asst_texts, all_uses, window_first_line)
    sig_f = compute_signal_f(user_msgs, window_first_line, all_uses, tool_results)

    signals = {
        'A_same_class_repetition': sig_a,
        'B_receipts_first_failures': sig_b,
        'C_reviewer_catches': sig_c,
        'D_fresh_fetch_recency': sig_d,
        'E_memory_citation_density': sig_e,
        'F_user_corrections': sig_f,
    }

    # Verdict = worst tier across all signals
    verdict = TIERS[0]
    for sig in signals.values():
        verdict = tier_max(verdict, sig['tier'])

    near_miss = compute_near_miss(signals)

    report = {
        'session_path': str(session_path),
        'window': {
            'decisions': len(window),
            'first_turn': window_first_line,
            'last_turn': window_last_line,
        },
        'signals': signals,
        'near_miss': near_miss,
        'verdict': verdict,
    }
    json.dump(report, sys.stdout, indent=2, ensure_ascii=False)
    sys.stdout.write('\n')


if __name__ == '__main__':
    main()
