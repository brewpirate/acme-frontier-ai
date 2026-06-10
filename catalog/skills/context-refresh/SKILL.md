---
name: context-refresh
description: Shed accumulated context mid-session. Writes a knowledge handoff document capturing session state, decisions, observations, and behavioral calibration, then guides the user through /clear and resumption.
user-invocable: true
---

# Context Refresh

## Overview

Long sessions accumulate dead context — file reads, debug output, old diffs — that wastes attention weight and degrades quality. This skill writes a structured handoff document that lets you resume cleanly after `/clear`.

**Announce at start:** "Preparing a context refresh handoff."

## When to Suggest a Refresh

Suggest (never force) a context refresh when:

- You've read 15+ files and most are no longer relevant
- A long debug tangent consumed significant context
- You notice your responses becoming less sharp or missing earlier context
- The user mentions the session feels sluggish
- You've been working for a long stretch and the conversation is very long

**Never clear unilaterally.** Always frame as a suggestion: "We've accumulated a lot of context from debugging. Want to do a context refresh so we can continue with a clean slate?"

## Pre-Clear Protocol

Follow these steps in order:

### 1. Establish Session Identity

If the session doesn't already have a name, ask the user to pick one — a short label for this working thread (e.g., "auth-rewrite", "sse-debugging"). This becomes the handoff filename and helps both human and agent recall context later.

### 2. Capture Observations

Before writing anything, reflect on the session so far:

- What notable discoveries or "aha" moments happened?
- What shifted our direction unexpectedly?
- What patterns have you noticed about the user's focus, interests, or working style?
- What corrections or preferences did the user express?
- What felt significant but doesn't fit neatly into tasks or decisions?

These observations are the most perishable part of context — task lists survive /clear, but nuance doesn't.

### 3. Snapshot Task State

Read `TaskList` and capture all tasks with their current status.

### 4. Check for Open Issues and PRs

If any GitHub issues were created during this session:
- **Note their status**: "Issue #N is open / has a PR pending review."
- Record open issues in the handoff doc so the post-clear agent knows to check on them.

### 5. Write Journal Entry

Invoke `field-notes:write` with:
- **type:** `context-refresh`
- **summary:** Brief description of what was accomplished before the refresh
- **insights:** Any observations worth preserving long-term

### 6. Write the Handoff Document

Write to `.claude/handoffs/<session-name>-<timestamp>.md` using the template below. Fill every section — empty sections mean lost context.

### 7. Confirm with User

"Handoff document written to `.claude/handoffs/<filename>`. Ready to clear. After you run `/clear`, re-invoke `/zenflow:collab` and I'll pick up from the handoff."

## Handoff Document Template

```markdown
# Context Refresh Handoff
<!-- Generated: <timestamp> | Reason: <why the refresh was triggered> -->

## Session Identity
- **Name:** <session name — what the user chose and why>
- **Started:** <when the session began>
- **Refresh count:** <how many refreshes so far, including this one>

## Session Goals
- <What we set out to accomplish — as stated during opening protocol>

## Accomplished
- <Completed items — reference commit hashes, PR numbers, or specific outcomes>

## Active Decisions & Constraints
- <Architectural choices made during this session>
- <User-imposed constraints: e.g., "no changes to auth until after release">
- <Workflow agreements: e.g., "worktree delegation for anything > 20 lines">
- <Technical decisions: e.g., "chose X over Y because Z">

## Behavioral Calibration
<!-- This is critical — without it, the post-clear agent loses partnership dynamics -->
- <User working style: hands-on vs. high-level, terse vs. detailed>
- <Communication preferences: options vs. recommendations, depth of explanation>
- <Corrections received: "User told me not to X" — include why if stated>
- <What's working in the partnership: pacing, delegation style, decision flow>

## User & Session Observations
- <Key notes about the user's focus, energy, or interests this session>
- <Notable discoveries — "aha" moments, surprising findings>
- <Things that shifted our direction and why>
- <Patterns: what the user gravitates toward, what they avoid>
- <Anything significant that doesn't fit other sections>

## Open Tasks
| ID | Status | Subject | Notes |
|----|--------|---------|-------|
<snapshot from TaskList>

## Open Issues & PRs
- <Issue #N — status, what it covers>
- <PR #N — status, review state>
- <If none: "No open issues or PRs from this session">

## Key Files & Learnings
- `path/to/file` — <what we learned about it, why it matters>
- <Only files still relevant to ongoing work — drop dead-end investigations>

## Next Steps
- <The immediate next action and why it's next>
- <Enough context to pick this up without re-reading the entire history>
- <Any prerequisites or blockers>
```

## Post-Clear Resume Protocol

When the collab skill detects a recent handoff file (added to collab's opening protocol):

1. **Find the handoff**: Check `.claude/handoffs/` for files modified within the last 2 hours. If multiple exist, use the most recent.

2. **Read the handoff document** in full.

3. **Re-read the collab philosophy** — calibration fade applies to /clear just like it does to cross-day resumes. The handoff doc has the facts, but the philosophy re-establishes the behavioral frame.

4. **Acknowledge the refresh to the user:**
   > "Resuming session **<name>**. Here's where we are:
   > - [2-3 line summary from handoff]
   > - Next up: [immediate next step]
   > Does this match your understanding, or has anything changed?"

5. **Check issue/PR status**: If the handoff noted open issues or PRs, check on them now.

6. **Resume from "Next Steps"** — don't re-explore accomplished work.

## Stale Handoffs

If a handoff file is more than 2 hours old, treat it as **informational rather than authoritative**:

- Read it for background context
- But suggest starting fresh: "There's a handoff from earlier, but it's [X hours] old. Want to start fresh using journal entries and memory instead?"

## Handoff File Management

- **Location:** `.claude/handoffs/`
- **Naming:** `<session-name>-<ISO-timestamp>.md`
- **Lifecycle:** Ephemeral — handoff files are useful for the immediate resume and can be pruned after. They are not long-term records (that's what the journal is for).
- **Multiple refreshes:** Each refresh creates a new timestamped file. Only the most recent matters for resumption. Prior handoffs in the same session can be deleted after a successful resume.
