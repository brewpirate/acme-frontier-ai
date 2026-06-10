---
name: reflect
description: End-of-session retrospective — analyze the current session's journal entries and surface actionable insights for future sessions. Use before ending a long session or at natural stopping points.

---

# Journal: Reflect

## Overview

A structured retrospective for the current session. Reads the journal entries written during this session, analyzes what happened, and produces actionable takeaways that improve future work.

This is not a summary — it's a *thinking exercise*. The agent examines its own work with fresh eyes.

**Announce at start:** "Reflecting on this session."

## The Process

### 1. Gather Session Data

Read `.claude/journal.jsonl` and filter to entries from the current session (by timestamp range or session identifier). Also check:

- `git log` for commits made during the session
- `git diff --stat` for uncommitted changes
- `TaskList` for task completion status
- Active plan status (if any)

### 2. Reconstruct the Timeline

Build a chronological narrative of what happened:

```
Session Timeline:
  10:15 — Started with zenflow:collab, exploring SSE implementation
  10:30 — Found rate limiter bug, delegated to worktree agent
  10:45 — Designed notification schema together
  11:00 — Created plan (resources/plans/245-notifications.md)
  11:15 — Started zenflow:dispatch, tasks 1-3 in parallel
  12:00 — Tasks 1-2 complete, task 3 partial (missing reconnection)
  12:15 — Fixed task 3 with implementer re-dispatch
  12:30 — zenflow:check-work passed all gates
  12:35 — Rate limiter PR merged from worktree delegate
```

### 3. Analyze

Ask these questions about the session:

**What went well?**
- Which approaches worked on the first try?
- Where did the pipeline save time?
- What decisions turned out to be right?

**What was harder than expected?**
- Where did you spend the most time?
- What required multiple attempts?
- Where were the surprises?

**What was learned?**
- New patterns or techniques discovered
- Codebase knowledge that wasn't obvious before
- Tool or framework behaviors that were surprising

**What should change?**
- Process improvements for next time
- Rules or conventions that should be added/updated
- Documentation gaps discovered

### 4. Produce Takeaways

Format the reflection as actionable items:

```
## Session Reflection — 2026-03-27

### Timeline
[chronological narrative]

### What Went Well
- Two-stage dispatch review caught the missing reconnection handler
  before it reached check-work — saved a full test cycle
- Worktree delegation for the rate limiter was fire-and-forget,
  kept the main session clean

### What Was Harder Than Expected
- SSE reconnection logic needed 3 iterations to get the backoff
  timing right — the test was flaky with exact timing assertions
  → **Takeaway:** Use tolerance-based assertions for timing tests

### What Was Learned
- Bun's SSE implementation requires explicit keep-alive pings
  (not documented, found by reading source)
  → **Consider:** Add to project docs or CLAUDE.md

### Suggested Actions
- [ ] Add timing test conventions to .claude/rules/testing.md
- [ ] Document SSE keep-alive requirement in ARCHITECTURE.md
- [ ] Update zen.local.md audit sections to include new SSE module

### For Future Sessions
- When working on SSE, load the stream handler source first —
  the types don't tell the full story
- The notification schema is stable now — safe to build on
```

### 5. Write Reflection Entry

Append a journal entry of type `reflection`:

```json
{
  "timestamp": "2026-03-27T12:40:00.000Z",
  "type": "reflection",
  "summary": "Session reflection: SSE notifications + rate limiter fix",
  "insights": "Two-stage review caught reconnection gap; worktree delegation kept context clean",
  "suggestedActions": [
    "Add timing test conventions to testing.md",
    "Document SSE keep-alive in ARCHITECTURE.md"
  ],
  "sessionDuration": "2.5 hours",
  "entriesReviewed": 4
}
```

### 6. Offer Follow-ups

After presenting the reflection, ask:

**"Any of these suggested actions worth doing now?"**

Options:
- **Update docs** — invoke zenflow:docs for documentation gaps
- **Update rules** — add new conventions to `.claude/rules/`
- **Create issues** — log suggested actions as tasks for later
- **Save and close** — reflection is recorded, act on it next session

## When to Reflect

- End of a long session (2+ hours)
- After completing a significant feature
- After a difficult debugging session
- Before handing off to another agent or session
- When the user asks "what did we learn?"

## Related Skills

- **field-notes:write** — Reflection writes its own journal entry
- **field-notes:summary** — Broader pattern analysis across sessions
- **field-notes:read** — Review raw entries
- **zenflow:docs** — Act on documentation gaps found during reflection
