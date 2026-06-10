---
name: read
description: Read recent journal entries. Use when resuming work, checking what was done recently, or reviewing a specific session's history.
---

# Journal: Read

## Overview

Read and display journal entries. Supports filtering by time range, type, branch, outcome, origin, or keyword.

**No confirmation needed** — runs immediately and displays results.

## Journal Location

Reads from `.claude/journal.jsonl` in the project root. If the file doesn't exist, report that no journal exists and suggest running `field-notes:write`.

## Modes

### Recent (default)

Show the last N entries (default: 5):

```
/field-notes:read
/field-notes:read 10
```

### By type

Filter to a specific entry type:

```
/field-notes:read bug-fix
/field-notes:read refactor
```

### By time

Filter to entries from a time range:

```
/field-notes:read today
/field-notes:read week
/field-notes:read 2026-03-27
```

### By branch

Filter to entries from a specific branch:

```
/field-notes:read branch feature/notifications
```

### By outcome

Filter to entries with a specific outcome:

```
/field-notes:read blocked
/field-notes:read partial
```

### By origin

Show only primary sessions or delegated work:

```
/field-notes:read delegated
/field-notes:read primary
```

### By keyword

Search across all text fields (summary, workedOn, issues, insights, feedback):

```
/field-notes:read search SSE
/field-notes:read search "rate limiter"
```

## Display Format

Present entries in reverse chronological order (newest first):

```
## Journal — last 5 entries

◆ 2026-03-27 14:30 | work | completed | primary
  Branch: feature/notifications | Skill: zenflow:dispatch
  Worked on: plan: resources/plans/245-realtime-notifications.md
  Added real-time SSE notifications for issue state changes
  Files: 5 modified, 2 created | Tests: +8
  Insight: Two-stage review caught a missing reconnection handler
  Feedback: Worktree delegation kept context clean during side fix

◆ 2026-03-27 10:15 | bug-fix | completed | delegated
  Branch: fix/rate-limiter | Skill: zenflow:bug-fix
  Worked on: issue: rate limiter counter not resetting
  Fixed rate limiter counter not resetting between windows
  Files: 1 modified | Tests: +1

◆ 2026-03-26 16:00 | exploration | partial | primary
  Branch: feature/mastra | Skill: zenflow:collab
  Worked on: Mastra workflow integration patterns
  Explored Mastra workflow integration patterns
  Insight: Mastra's step() API changed in 0.5 — docs are outdated
  Would do differently: Check installed version before reading remote docs
  Feedback: Remote docs should be version-pinned in bookmarks

◆ 2026-03-26 11:00 | work | blocked | delegated
  Branch: fix/sse-backoff | Skill: zenflow:plan
  Worked on: plan: resources/plans/244-sse-backoff.md
  Attempted SSE backoff implementation, blocked by unclear retry semantics
  Blocker: No spec for max retry count — needs product decision

(4 entries shown, 23 total)
```

### Display rules

- Show `origin` badge (`primary` or `delegated`) — makes it clear who did the work
- Show `outcome` — `completed` entries are normal, highlight `blocked` and `partial`
- Only show non-empty optional fields (skip "Blocker: None" noise)
- `workedOn` always shown — it's the anchor for what this entry is about
- `feedback` shown when present — it's the meta-level learning

## The Process

1. Read `.claude/journal.jsonl`
2. Parse each line as JSON
3. Apply filters (type, time, branch, outcome, origin, keyword) if specified
4. Format and display in reverse chronological order
5. Show entry count summary

## Related Skills

- **field-notes:write** — Append new entries
- **field-notes:summary** — Aggregate patterns
- **field-notes:reflect** — Session retrospective
