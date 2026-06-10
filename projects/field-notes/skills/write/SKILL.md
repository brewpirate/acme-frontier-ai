---
name: write
description: Append a structured journal entry after completing work. Use at the end of any task, feature, bug fix, or session to record what was done, what went wrong, and what was learned.
allowed-tools: Read, Bash
---

# Journal: Write

## Overview

Append a structured entry to the project's agent journal. One JSONL file per project, one line per entry. Every entry captures what happened, not just what was built.

**Announce at start:** "Writing a journal entry."

## Journal Location

The journal lives at `.claude/journal.jsonl` in the project root. Create it if it doesn't exist.

**Why `.claude/`:** Keeps agent artifacts together. The file is gitignored or committed per team preference — both work. JSONL is append-only, so merge conflicts are rare even when committed.

## Entry Schema

Each entry is a single JSON line:

```json
{
  "timestamp": "2026-03-27T14:30:00.000Z",
  "workedOn": "plan: resources/plans/245-notifications.md | issue: #123 | description of work",
  "branch": "current git branch name",
  "type": "work | bug-fix | refactor | audit | exploration | review | reflection | context-refresh",
  "origin": "primary | delegated",
  "skill": "zenflow:dispatch",
  "outcome": "completed | partial | blocked | abandoned",
  "summary": "One sentence: what was accomplished",
  "details": {
    "filesModified": ["path/to/file1.ts", "path/to/file2.ts"],
    "filesCreated": ["path/to/new-file.ts"],
    "testsAdded": 3,
    "testsModified": 1
  },
  "issues": "Problems encountered (empty string if none)",
  "blockers": "What stopped progress (empty string if none)",
  "workarounds": "Temporary solutions used (empty string if none)",
  "insights": "What worked well, surprising discoveries, useful patterns",
  "wouldDoDifferently": "Hindsight improvements for next time",
  "feedback": "Observations about the workflow, tools, or process that could improve future sessions",
  "duration": "approximate time spent (e.g., '45 min', '2 hours')"
}
```

### Required fields

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | string | ISO 8601 timestamp |
| `workedOn` | string | What this entry is about — a plan file path, issue number, or freeform description |
| `type` | string | Entry type: `work`, `bug-fix`, `refactor`, `audit`, `exploration`, `review`, `reflection` |
| `summary` | string | One sentence describing what was accomplished |

### Key optional fields

| Field | Type | Description |
|-------|------|-------------|
| `branch` | string | Git branch name |
| `origin` | string | `primary` (user's session) or `delegated` (spawned by another agent) |
| `skill` | string | Which zen skill was active (e.g., `zenflow:dispatch`, `zenflow:collab`) |
| `outcome` | string | `completed`, `partial`, `blocked`, or `abandoned` |
| `feedback` | string | Observations about the workflow, tools, or process — meta-level improvements |

All other fields are optional. Include what's relevant — a quick exploration doesn't need `filesModified`, a bug fix doesn't need `duration`. The schema is flexible; the only hard rule is one JSON object per line.

### Custom fields

Projects can add custom fields. The schema is open — any valid JSON key-value pair is accepted. This lets teams track project-specific data (e.g., `issueId`, `prNumber`, `deployTarget`) without modifying the plugin.

## The Process

1. **Gather context** — review what changed in this session:
   - `git diff --stat` for files modified
   - `TaskList` for tasks completed
   - Session history for skills used and issues encountered

2. **Write the entry** — construct the JSON object with relevant fields

3. **Append to journal** — write a single line to `.claude/journal.jsonl`:
   ```bash
   echo '{...}' >> .claude/journal.jsonl
   ```

4. **Confirm** — announce: "Journal entry written for: {summary}"

## When to Write

- After completing a task or feature
- After fixing a bug
- After a refactor
- After an audit
- At the end of a collab session
- When stopping mid-work (capture where you left off)
- When hitting a blocker you can't resolve

**Don't write entries for trivial work** — if it took 2 minutes and changed 1 line, it doesn't need a journal entry.

## Integration with Zen Flow

`zenflow:check-work` Gate 5 should invoke this skill instead of writing its own journal entry:
- Call `field-notes:write` with type `work`
- Let this skill handle the format and file location

## Related Skills

- **field-notes:read** — View recent entries
- **field-notes:summary** — Aggregate patterns across entries
- **field-notes:reflect** — End-of-session retrospective
