---
name: summary
description: Aggregate journal entries to surface patterns — recurring blockers, most-modified files, effective tools, and team velocity trends. Use for retrospectives, standups, or understanding project health.
---

# Journal: Summary

## Overview

Analyze the journal to surface patterns across multiple sessions. Produces aggregate insights rather than individual entries — what keeps going wrong, what keeps working, where the effort is concentrated.

**Announce at start:** "Analyzing journal for patterns."

## Journal Location

Reads from `.claude/journal.jsonl` in the project root.

## Time Ranges

```
/field-notes:summary            # last 7 days (default)
/field-notes:summary week       # last 7 days
/field-notes:summary month      # last 30 days
/field-notes:summary all        # everything
```

## Analysis Dimensions

### 1. Activity Breakdown

Count entries by type:

```
Activity (last 7 days):
  work:        12 entries
  bug-fix:      4 entries
  refactor:     2 entries
  exploration:  3 entries
  review:       1 entry
  audit:        1 entry
  ─────────────────────
  Total:       23 entries
```

### 2. Hot Files

Files that appear most frequently across entries:

```
Most Modified Files:
  1. packages/server/src/server/routes/api.ts (8 entries)
  2. packages/core/src/core/context.ts (5 entries)
  3. packages/frontend/src/components/ActivityLog.tsx (4 entries)
```

These are churn indicators — files touched repeatedly may need refactoring or better test coverage.

### 3. Recurring Blockers

Extract and deduplicate blockers from entries:

```
Recurring Blockers:
  - "Mock pollution in tests" (appeared 3 times)
  - "Rate limiter config unclear" (appeared 2 times)
  - "SSE connection timeout" (appeared 2 times, resolved 2026-03-27)
```

Resolved blockers (appear in later entries as fixes) are marked.

### 4. Insights & Patterns

Aggregate the `insights` and `wouldDoDifferently` fields:

```
Top Insights:
  - Two-stage review (spec + quality) catches different failure modes (3 mentions)
  - Check installed package version before reading docs (2 mentions)
  - Worktree delegation prevents context pollution (2 mentions)

Recurring "Would Do Differently":
  - "Run full test suite earlier" (3 mentions)
  - "Read existing tests before writing new ones" (2 mentions)
```

### 5. Skills Used

Which zen skills are used most:

```
Skills Usage:
  zenflow:dispatch    8 sessions
  zenflow:check-work  8 sessions
  zenflow:collab      5 sessions
  zenflow:bug-fix     4 sessions
  zenflow:plan        3 sessions
  zenflow:idea        1 session
```

## Output Format

```
## Journal Summary — last 7 days (23 entries)

### Activity
[breakdown by type]

### Hot Files
[top 5 most-modified files]

### Recurring Blockers
[deduplicated, with resolution status]

### Insights
[aggregated patterns from insights + wouldDoDifferently]

### Skills
[usage counts]

### Health Signals
- Bug-fix ratio: 17% (4/23) — [healthy < 25%]
- Workaround ratio: 9% (2/23) — [healthy < 15%]
- Blocker-free sessions: 78% (18/23)
```

### Health Signals

Quick indicators derived from the data:

| Signal | Healthy | Warning | Unhealthy |
|--------|---------|---------|-----------|
| Bug-fix ratio | < 25% | 25-40% | > 40% |
| Workaround ratio | < 15% | 15-30% | > 30% |
| Blocker-free sessions | > 70% | 50-70% | < 50% |
| Repeat blocker rate | < 10% | 10-25% | > 25% |

These are rough heuristics, not hard rules. A spike in bug fixes after a big feature is normal.

## Related Skills

- **field-notes:read** — View individual entries
- **field-notes:write** — Append new entries
- **field-notes:reflect** — Session retrospective with actionable takeaways
