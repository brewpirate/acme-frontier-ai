---
name: check-work
description: Validate completed work passes all quality gates (lint, format, tests, docs, journal). Use after finishing implementation tasks to ensure nothing is missed. Fixes failures automatically using subagents.
---

# Work Validation

## Overview

Run all quality gates after implementation is complete. Each gate is tracked as a task. If any gate fails, fix it — using subagents for parallel resolution when possible.

**Announce at start:** "I'm using the zenflow:check-work skill to verify this work."

## Command Discovery

Before running gates, detect the project's toolchain by reading `package.json`, `Makefile`, `pyproject.toml`, or equivalent. Look for:

- **Lint command** — `lint` script in package.json, `make lint`, `ruff check`, etc.
- **Lint fix command** — `lint:fix`, `make lint-fix`, `ruff check --fix`, etc.
- **Format command** — `format` script, `make format`, `black --check`, etc.
- **Format fix command** — `format:fix`, `make format-fix`, `black .`, etc.
- **Test command** — `test` script, `make test`, `pytest`, etc.

If CLAUDE.md documents the project's commands, use those. Otherwise discover from config files.

## The Process

Create all 5 tasks via `TaskCreate` upfront, then execute them in order.

### Gate 1: Pass Lint

- Mark `in_progress` via `TaskUpdate`
- Run the project's lint command
- If failures: run the lint fix command first. If errors remain, launch a subagent to fix them manually.
- Confirm zero errors before marking `completed`

### Gate 2: Pass Format

- Mark `in_progress` via `TaskUpdate`
- Run the project's format check command
- If failures: run the format fix command. If errors remain, launch a subagent to fix them.
- Confirm zero errors before marking `completed`

### Gate 3: Pass Tests

- Mark `in_progress` via `TaskUpdate`
- Run the project's full test suite with no filters or specific file paths. Running a subset is NOT acceptable — partial test runs hide regressions.
- If failures: launch subagent(s) to fix failing tests. Each failing test file can be a separate subagent.
- After fixes, re-run the full test suite (not just the fixed files)
- Confirm zero failures before marking `completed`
- Note the test count — report if it changed (new tests added or tests removed)

### Gate 4: Update Documentation

- Mark `in_progress` via `TaskUpdate`
- Review what changed in this session (use `git diff` against the starting state)
- Update relevant documentation:
  - **README.md** — if new features, commands, or setup steps were added
  - **CLAUDE.md** — if new conventions, patterns, or project structure changed
  - **ARCHITECTURE.md** — if architectural changes were made
  - Inline doc comments — if exported symbols were added or changed
- If no documentation updates needed, note why and mark `completed`
- If updates needed: make them, then mark `completed`

### Gate 5: Write Journal Entry

- Mark `in_progress` via `TaskUpdate`
- Invoke `field-notes:write` using the Skill tool
- The journal plugin handles the format and file location (`.claude/journal.jsonl`)
- If field-notes is not installed, append directly to `.claude/journal.jsonl` using the full schema:

```json
{
  "timestamp": "YYYY-MM-DDTHH:MM:SS.000Z",
  "workedOn": "plan: resources/plans/NNN-name.md | issue: #123 | description",
  "branch": "current git branch name",
  "type": "work",
  "origin": "primary",
  "skill": "zenflow:check-work",
  "outcome": "completed",
  "summary": "One sentence: what was accomplished",
  "details": {
    "filesModified": ["path/to/file1.ts", "path/to/file2.ts"],
    "filesCreated": ["path/to/new-file.ts"],
    "testsAdded": 0,
    "testsModified": 0
  },
  "issues": "Problems encountered (empty string if none)",
  "blockers": "What stopped progress (empty string if none)",
  "workarounds": "Temporary solutions used (empty string if none)",
  "insights": "What worked well, surprising discoveries, useful patterns",
  "wouldDoDifferently": "Hindsight improvements for next time",
  "feedback": "Observations about the workflow or process",
  "duration": "approximate time spent"
}
```

- Mark `completed`

## Failure Resolution

When a gate fails:

1. **Try auto-fix first** — lint fix, format fix for gates 1-2
2. **Launch subagent for manual fixes** — if auto-fix doesn't resolve it
3. **Re-run the gate** — confirm it passes after the fix
4. **If stuck after 2 attempts** — stop and report the failure to the user instead of looping

## Parallel Execution

Gates 1 and 2 (lint + format) can run in parallel since they're independent.
Gate 3 (tests) should run after 1 and 2 are clean.
Gates 4 and 5 (docs + journal) can run in parallel after tests pass.

## Remember

- Every gate must pass — no skipping
- Auto-fix before manual fix
- Use subagents for independent failures
- Report test count changes
- Stop after 2 failed attempts on the same gate
