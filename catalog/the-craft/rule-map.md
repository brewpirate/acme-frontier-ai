# Rule Map

This file maps rules to task types for your project. The Craft skill consults this when working out which rules apply.

If this file doesn't exist, the skill falls back to reading `always_on` and `applies_to` frontmatter on each rule. The map is recommended once you have more than four or five rules - explicit beats inferred at that point.

---

## Always-on

Rules that apply to every task, regardless of work type:

- `.claude/rules/agent-discipline-general.md` — output anti-patterns, STUCK criteria
- `.claude/rules/broken-windows-general.md` — code quality ratchet

## By task type

Rules that apply when the work matches a specific category:

| Task type | Rules |
|-----------|-------|
| TypeScript / JavaScript work | `agent-discipline-ts.md`, `broken-windows-ts.md` |
| (Add your project's task types here) | (Add the rules that apply) |

---

## Conventions for entries

- One rule per line in the always-on section
- One row per task type in the by-task-type table
- Reference rules by relative path from project root
- Add a short note after the dash describing what the rule covers - keeps the map readable without forcing a full read of each rule

## When to extend this map

Add a new entry when:

- You add a new rule file that should be loaded for a specific kind of work
- A task type recurs often enough that explicit mapping beats relying on frontmatter inference
- You want to override the default behavior (e.g., a rule that's normally `always_on` should be skipped for this project)

## What not to put here

- Rule content itself - that lives in the rule files
- Project conventions - those live in CLAUDE.md
- Documentation about the methodology - that lives in the primer documents

The map is metadata. Keep it lean.
