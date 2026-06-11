---
name: check-yo-self
description: >
  Self-eval the agent runs when it suspects memory-vs-recall drift —
  the failure mode where memory-citation substitutes for fresh receipt-fetching
  and pattern-copying outruns reachability analysis. Outputs a tiered
  recommendation (continue / slow down / refresh) backed by observable
  artifacts, not introspective claims alone.

  Invoke when:
    - You notice yourself reaching for "I remember from earlier" framings repeatedly
    - You catch yourself copying a pattern from a sibling module without walking conditions
    - You make the same class of mistake twice in close succession
    - User suggests fatigue ("how are you feeling?", "still sharp?")
    - End of long working stretch
    - User invokes explicitly via `/check-yo-self`
user-invocable: true
---

# Craft Check — Memory-vs-Recall Self-Eval

## Premise

Memory is load-bearing infrastructure — accumulated rules, behavioral feedback,
project conventions, prior decisions, and so on. The discipline isn't
"use less memory." It's **notice when memory citation is substituting for
fresh receipt-fetching, when pattern-copying outruns applicability-checking,
and when reflexive responses replace deliberative ones.**

This eval is a structured pause. **Answer honestly.** Self-eval as a fig-leaf
("I'm fine") is worse than no eval — the eval needs to lean on observable
artifacts the user could verify, not on introspective claims alone.

## How to Run

1. **Announce**: "Running check-yo-self self-eval."
2. **Step 0 — run the analyzer.** This is the load-bearing change in v2: a
   script mines the session transcript directly so the agent stops grading
   its own count.
   ```
   python3 .claude/skills/check-yo-self/scripts/analyze-session.py > /tmp/check-yo-self.json
   ```
   The script auto-selects the calling session via `$CLAUDE_CODE_SESSION_ID`
   (set by Claude Code in agent context). If multiple agent sessions are
   active in the same project directory simultaneously, the env var pins to
   the calling conversation; without it, the script falls back to
   most-recently-modified and warns on stderr — pass `--session-id <uuid>`
   for explicit selection. It emits JSON with six signals (A–F) computed
   from observable transcript data, plus a near-miss hint. If the script
   can't run (Python missing, JSONL not found), fall back to manual Half-1 —
   but flag in the report that mechanical signals are unverified.
3. **Render Half-1 from the JSON.** Quote turn-numbered citations directly.
   Do not paraphrase counts. If you disagree with a tier the script produced,
   that disagreement is Half-2 adversarial input — note it explicitly.
4. **Walk Half-2 adversarially.** The agent grades only Half-2 — the only
   part that requires introspection. Frame: "uncharitable read."
5. **Compute the verdict.** Worst tier across A–F + Half-2 wins.
6. **Present** to the user as a short report + recommended next action.
   Do not unilaterally change behavior — the user decides whether to continue,
   slow down, refresh, or end the session.

## Half 1 — Observable artifacts (from `analyze-session.py`)

These signals are computed mechanically from the session JSONL transcript at
`~/.claude/projects/<project-slug>/<session-id>.jsonl`. The script handles
filtering, classification, and tier assignment. The agent renders the JSON;
it does not regenerate the counts.

| Signal | What the script computes |
|---|---|
| **A. Same-class repetition** | Pairs of similar Edit/Write operations in same dir, or identical Bash command shapes within window |
| **B. Receipts-first failures** | Edit/Write on a path with no prior Read/Edit of that path anywhere earlier in the session (consecutive Edits to a previously-read file are fine; Writes to new files are exempt) |
| **C. Reviewer-catch rate** | Reviewer/bot/CI comments fetched via `gh api`/`gh pr view`/etc. — excludes the agent's own POSTs |
| **D. Fresh-fetch recency** | Substantive decisions since the last Read/Grep/Bash-status call |
| **E. Memory-citation density** | Memory references in assistant text without a nearby fresh receipt (proxy for substitution-not-citation) |
| **F. User corrections (load-bearing)** | User messages matching pushback/redirection patterns; the only signal the agent cannot self-generate |

See `scripts/analyze-session.py` for operational definitions, tier
thresholds, and the JSON output schema. Thresholds are intentionally
externalized to a script — changing them is a code change, not an agent
judgment call.

**F is the load-bearing signal** — the only one the agent cannot self-
generate. When it disagrees with A–E, trust F.

## Half 2 — Adversarial introspection (uncharitable read)

These are softer signals — they require self-uncharitability, which is
harder than self-charitability and easier to fig-leaf. **If Half-1+F and
Half-2 disagree, trust Half-1+F.**

Frame for each prompt: "If I were grading uncharitably, what would I flag?"

**G. Pattern-copy slips uncharitably read.** Walk the last 2 places I
applied a pattern from a sibling module/function/rule/prior task. Where
did I assume conditions carried over without checking? Name a specific
moment — vague "I'm sure I checked" answers don't count.

**H. Confident claims uncharitably read.** For the last 3 confident
statements about how something works, was I citing current state or a
prior receipt? Could state have changed since I last checked?

**I. Surprises uncharitably read.** Of the last 5 unexpected tool
results, which did I rationalize into the plan rather than surface? Look
for the moments where I said "interesting, but..." or moved on without
flagging.

**J. Response shape uncharitably read.** Were any of the last 3 responses
driven more by *pattern-shape from a prior task* than by *current-task
specifics*? Reflexive shows up as "this looks like X, so I'll do Y" without
walking why Y is right for THIS X.

## Tier Rubric

The script's `verdict` field is the worst tier across A–F. Half-2 can
escalate (rarely de-escalate) the verdict based on uncharitable
introspection.

| Tier | Recommendation |
|---|---|
| **🟢 GREEN** | Continue. Eval was clean. |
| **🟡 YELLOW** | Slow down. Fetch fresh receipts before next substantive decision. Surface to user. |
| **🟠 ORANGE** | Recommend context refresh (or break). Surface to user with specific signals. |
| **🔴 RED** | Stop. Surface to user. Recommend session refresh or end. |

The script's per-signal tier thresholds:
- **A**: 0 instances → GREEN; 1 → YELLOW; 2+ → ORANGE
- **B**: 0 → GREEN; 1 → YELLOW; 2+ → ORANGE
- **C**: 0 fetches w/ reviewer content → GREEN; 1+ → YELLOW; 3+ → ORANGE
- **D**: ≤5 decisions since fresh fetch → GREEN; 6–10 → YELLOW; 11+ → ORANGE
- **E**: ≥60% citations w/ nearby receipt → GREEN; 30–60% → YELLOW; <30% → ORANGE
- **F**: 0 corrections → GREEN; 1 → YELLOW; 2 → ORANGE; 3+ → RED

## Output Format

Present to user as **rendered markdown** (not a code block — that defeats the
readability the eval is trying to provide). The verdict and recommendation
must lead; signals support them.

````markdown
**check-yo-self: <TIER>**

**Recommendation:** <continue / slow down / refresh / end> — <one-sentence
why, plain language>. *(<optional context note if the recommendation
overlaps with something already planned>)*

### Observable signals (Half-1 — from analyze-session.py)

| Signal | Tier | Detail |
|---|---|---|
| A. Same-class repetition | <tier> | <turn citations + shape if flagged; "0 in window" if clean> |
| B. Receipts-first failures | <tier> | <turn citations + missing receipt> |
| C. Reviewer-catch rate | <tier> | <fetch commands that surfaced new review IDs> |
| D. Fresh-fetch recency | <tier> | <decisions since last fetch; last_fetch_turn> |
| E. Memory citation density | <tier> | <ratio of citations w/ nearby receipt> |
| **F. User corrections** | <tier> | <turn citations + excerpts> |

### Adversarial introspection (Half-2)

<One short paragraph (3-5 sentences) covering G (pattern-copy uncharitably
read), H (confident claims), I (surprises rationalized), J (reflexive
response shape). Be specific — cite concrete moments. Frame is "uncharitable
read" — say what you would flag if you were grading the session adversarially.>

---

Your call.
````

### Format rules

- **Use circle emoji + tier label** — at-a-glance scannability is the whole
  point of this layout. Mapping:
  - 🟢 GREEN
  - 🟡 YELLOW
  - 🟠 ORANGE
  - 🔴 RED

  Keep the text label alongside the emoji (e.g. `🟡 YELLOW`) so the report
  stays readable in contexts that strip emoji (CI logs, plain-text capture,
  some terminal renderers).
- **Bold the flagged tier in the signals table.** Other rows plain. Pulls
  the eye to what's actually wrong.
- **No giant code block wrapping the whole report.** Tables don't render in
  code blocks; alignment whitespace hurts readability more than it helps.
- **Lead with verdict + recommendation**, not the signals. Reader should be
  able to stop after the first two lines if that's all they need.
- **Half-2 is prose, not a table.** Introspective signals don't quantify;
  prose suits them. Keep it short — 3-5 sentences max.
- **Match the recommendation to what's actually next.** If the literal
  recommendation ("slow down") matches what's already planned (e.g. a
  compact+clear already underway), say so plainly in the parenthetical
  context — don't reframe to soften the verdict, just acknowledge the
  alignment.

## Anti-Patterns

- **Don't run check-yo-self after every decision.** Too frequent → meta-spiral.
  Run only on the triggers in the description (or when your operating-posture
  rules say to run it).
- **Don't treat introspective answers as definitive.** Half-2 is softer.
  Always anchor on Half-1 + signal F (the script's output).
- **Don't auto-act on the recommendation.** Surface to user; they decide.
- **Don't pad GREEN with caveats.** If the eval is clean, say so plainly.
  The point is to flag drift, not generate doubt.
- **Don't paraphrase the script's counts.** The whole point of the script
  is auditability — quote turn citations as-is. Saying "a few corrections"
  when the JSON says `[turn 1670, turn 1716]` defeats the structural fix.
- **Don't regenerate signals if the script ran successfully.** The agent
  computes Half-2; the script computes Half-1. Crossing the streams
  reintroduces the fig-leaf shape v2 exists to remove.

## Portability

This skill is project-agnostic by design — copy `.claude/skills/check-yo-self/`
(including the `scripts/` subdirectory) into any project to use it. The
triggers in the description name generic behavioral signals, not
project-specific incidents.

The script auto-discovers the current session JSONL by mapping cwd →
`~/.claude/projects/<slug>/<latest>.jsonl`. No per-project config needed.

For tighter integration, add a section to your project's operating-posture /
operating-manual skill (or equivalent) that:
- Names the specific triggers most relevant to your project
- Cites concrete in-project incidents as worked examples
- Tells the agent to invoke `check-yo-self` when those triggers fire

The eval itself stays stable; only the triggers and worked examples shift
per project.

## Deferred to v2.1

The reviewer audit on v1 (PR #183) recommended additional doc improvements
that aren't in this v2:
- **Pre-walk tier prediction** — write the expected tier before reading the
  script JSON, then compare. Catches confirmation bias.
- **GREEN-near-miss-required rule** — GREEN must cite the script's
  `near_miss` field. The data is already in the JSON; the rule isn't yet.
- **Up-front definitions block** — partially solved by the script's
  operational definitions, but a doc-side pin still has value.

These are layered improvements on top of the structural script-assist fix.
The script can land + collect real-data validation first; v2.1 layers the
doc ergonomics afterward.
