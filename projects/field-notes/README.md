# Field Notes

A structured work journal for Claude Code agents. Write entries, read history, surface patterns, and reflect on sessions — all stored in a single JSONL file per project.

## Why

Agents do work, then the session ends and the context is gone. The journal captures what happened, what went wrong, and what was learned — so the next session (or the next agent) doesn't start from zero.

It's also a record for humans. Open the HTML viewer, filter by branch or outcome, and see exactly what your agents have been doing.

> **Experimental** — This plugin is under active development and its APIs, commands, and behavior may change without notice. Use at your own risk.

## Installation

```bash
/plugin marketplace add brewpirate/zenflow
/plugin install field-notes@zen
/reload-plugins
```

## Quick Start

```
/field-notes:write                    # Record what you just did
/field-notes:read                     # See last 5 entries
/field-notes:read today               # Today's entries
/field-notes:read blocked             # What's stuck
/field-notes:summary                  # Patterns from the last week
/field-notes:reflect                  # End-of-session retrospective
```

## Skills

| Skill | Invocation | Purpose |
|-------|-----------|---------|
| Write | `/field-notes:write` | Append a structured entry after completing work |
| Read | `/field-notes:read [filter]` | View recent entries with filtering |
| Summary | `/field-notes:summary [range]` | Aggregate patterns across sessions |
| Reflect | `/field-notes:reflect` | End-of-session retrospective with actionable takeaways |
| View | `/field-notes:view` | Open the journal in a browser with the Tokyo Night HTML viewer |

## Storage

Single file: `.claude/journal.jsonl` — one JSON object per line, append-only.

```
.claude/
  journal.jsonl      # The journal (JSONL)
```

JSONL was chosen over SQLite, markdown, or separate files because:
- **Append-only** — no merge conflicts, even when committed to git
- **Greppable** — `grep "blocked" .claude/journal.jsonl` works
- **Portable** — no dependencies, no migrations, no schema versioning
- **Machine-readable** — every line is valid JSON, parseable by any language

## Entry Schema

```json
{
  "timestamp": "2026-03-27T14:30:00.000Z",
  "workedOn": "plan: resources/plans/245-notifications.md",
  "branch": "feature/notifications",
  "type": "work",
  "origin": "primary",
  "skill": "zenflow:dispatch",
  "outcome": "completed",
  "summary": "Added real-time SSE notifications for issue state changes",
  "details": {
    "filesModified": ["src/routes/sse.ts", "src/types/events.ts"],
    "filesCreated": ["src/lib/sse-client.ts"],
    "testsAdded": 8,
    "testsModified": 0
  },
  "issues": "",
  "blockers": "",
  "workarounds": "",
  "insights": "Two-stage review caught a missing reconnection handler",
  "wouldDoDifferently": "Check Bun OTel compatibility before starting",
  "feedback": "Worktree delegation kept context clean during side fix",
  "duration": "4 hours"
}
```

### Required Fields

| Field | Description |
|-------|-------------|
| `timestamp` | ISO 8601 |
| `workedOn` | What this is about — plan path, issue number, or freeform description |
| `type` | `work`, `bug-fix`, `refactor`, `audit`, `exploration`, `review`, `reflection` |
| `summary` | One sentence describing what was accomplished |

### Key Optional Fields

| Field | Description |
|-------|-------------|
| `branch` | Git branch name |
| `origin` | `primary` (user's session) or `delegated` (spawned agent) |
| `skill` | Which skill was active (e.g., `zenflow:dispatch`) |
| `outcome` | `completed`, `partial`, `blocked`, `abandoned` |
| `feedback` | Meta-level process observations |

All other fields are optional. The schema is open — add custom fields as needed.

## Reading Entries

### In Claude Code

`/field-notes:read` formats entries for the terminal:

```
◆ Mar 27 2:30 PM | work | completed | primary
  Branch: feature/notifications | Skill: zenflow:dispatch
  Worked on: plan: resources/plans/245-realtime-notifications.md
  Added real-time SSE notifications for issue state changes
  Files: 5 modified, 2 created | Tests: +8
  Insight: Two-stage review caught a missing reconnection handler
  ───
```

**Filters:**
- `/field-notes:read 10` — last 10 entries
- `/field-notes:read today` — today's entries
- `/field-notes:read bug-fix` — by type
- `/field-notes:read blocked` — by outcome
- `/field-notes:read delegated` — by origin
- `/field-notes:read branch feature/x` — by branch
- `/field-notes:read search "rate limiter"` — keyword search

### In a Browser

Open `scripts/journal.html` and pick your `journal.jsonl` file. Or use the hash trick for zero-server viewing:

```bash
xdg-open "file://$(realpath scripts/journal.html)#$(base64 -w0 .claude/journal.jsonl)"
```

The viewer provides:
- Search across all fields
- Filter chips for type, outcome, origin
- Stats bar (entries, completed, blocked, delegated)
- Color-coded entries by outcome (green/yellow/red)
- Tokyo Night theme

## Summary & Health

`/field-notes:summary` analyzes the last 7 days (or specify `week`, `month`, `all`):

```
Activity:       12 work, 4 bug-fix, 2 refactor, 3 exploration
Hot Files:      src/routes/api.ts (8 entries), src/core/context.ts (5)
Blockers:       "Mock pollution in tests" (3x), "Rate limiter unclear" (2x, resolved)
Top Insight:    Two-stage review catches different failure modes (3 mentions)
Skills:         zenflow:dispatch (8), zenflow:collab (5), zenflow:bug-fix (4)

Health:
  Bug-fix ratio:        17% (healthy < 25%)
  Workaround ratio:      9% (healthy < 15%)
  Blocker-free sessions: 78%
```

## Reflect

`/field-notes:reflect` is an end-of-session retrospective:

1. Reconstructs a timeline of what happened
2. Analyzes what went well, what was harder than expected, what was learned
3. Produces actionable takeaways (doc gaps, rule updates, process improvements)
4. Writes a `reflection` type journal entry
5. Offers to act on suggestions (update docs, create issues, update rules)

## Integration with Zen Flow

`zenflow:check-work` Gate 5 invokes `field-notes:write` automatically. If field-notes isn't installed, it falls back to appending directly to `.claude/journal.jsonl` with the full schema.

Other zenflow integrations:
- `zenflow:collab` triggers `field-notes:reflect` at end of session
- `zenflow:collab` delegates write entries with `origin: "delegated"`
- `zenflow:idea` writes `exploration` type entries on completion

## Workflows & Diagrams

See **[docs/plugins/field-notes/workflows.md](../../docs/plugins/field-notes/workflows.md)** for workflow diagrams and usage examples.

**Diagrams:** [Basic Write/Read Cycle](#) | [zenflow Integration](#) | [Session Retrospective](#) | [Filtering](#) | [Primary vs. Delegated](#) | [Weekly Health Cadence](#)

## Plugin Structure

```
field-notes/
├── .claude-plugin/
│   └── plugin.json
├── commands/
│   ├── write.md               # /field-notes:write
│   ├── read.md                # /field-notes:read
│   ├── summary.md             # /field-notes:summary
│   └── reflect.md             # /field-notes:reflect
├── scripts/
│   └── journal.html           # Browser-based viewer (Tokyo Night)
└── skills/
    ├── write/SKILL.md         # field-notes:write
    ├── read/SKILL.md          # field-notes:read
    ├── summary/SKILL.md       # field-notes:summary
    ├── reflect/SKILL.md       # field-notes:reflect
    └── view/SKILL.md          # field-notes:view — open in browser
```



### Session Reflection

```
You: /field-notes:reflect
  → Session Timeline:
    10:15 — Started zenflow:collab, exploring SSE
    10:30 — Delegated rate limiter bug to worktree
    10:45 — Designed notification schema
    11:00 — Created plan, started zenflow:dispatch
    12:30 — All tasks complete, check-work passed

  → What Went Well:
    Worktree delegation kept context clean
    Two-stage review caught reconnection gap

  → Suggested Actions:
    - [ ] Add SSE keep-alive docs to ARCHITECTURE.md
    - [ ] Add timing test conventions to testing rules

  → "Any of these worth doing now?"
```
