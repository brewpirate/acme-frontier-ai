---
name: rule-map
description: >
  Quick reference for which rules govern the current work. Consult mid-task
  when starting a new task type, touching unfamiliar code, or unsure which
  constraints apply. Pairs with the-craft skill (full manual). Trigger on:
  "which rules apply", "what rules should I follow", "check constraints",
  or proactively when switching task type mid-session. Also use when any
  two rules appear to conflict — the always-on rules explain precedence.
---

# Rule Map — Quick Reference

## Always-On (Every Task)

| Rule | Key constraint |
|------|---------------|
| `the-posture.md` | Operating posture wins over everything. Agent-built codebase — defaults from typical projects are wrong here. Verbose+plain+boring code (Atwood: write for a junior, not to impress). Assume wrong, stop on surprise, one thing at a time, ask before continuing, nothing done until seen it run. |
| `agent-discipline.md` | No TODOs in delivered code. No gold plating. Never weaken tests. STUCK after 2 failed approaches. |

## By Task Type

| Task | Rule file | Key constraint |
|------|-----------|---------------|
| Any new code | `hard-requirements.md` | Zod ^4.x mandatory. TypeScript 6.x strict. TSDoc on all exports. |
| Naming anything | `naming-and-style.md` | No abbreviations. Full descriptive names. `is/has/should/can` for booleans. Action+Subject for functions. |
| Imports / modules | `imports-and-modules.md` | `packages/server/` uses relative imports. `packages/dashboard/` uses `@/` alias. No barrel files. |
| Async / concurrent | `async-patterns.md` | Always await promises. `Promise.all` for independent ops. SQLite writes must be serialized. |
| React / frontend | `react-patterns.md` | TanStack Router + Query + Tailwind v4. Server state via Query. URL params for navigation state. |
| Code quality / cleanup | `broken-windows.md` | Fix broken windows when encountered. react-doctor score must stay ≥ 97. |
| Duplication / reuse | `dry-and-reuse.md` | Grep before writing. Cross-boundary vocabularies live in `@magpie/core`. Extract at 3+ (not before). Feed `KNOWN_PATTERNS` on consolidation. |
| Functions ≥ 3 params | `options-objects.md` | Must use a single options object. Interface named `FunctionNameOpts`. Destructure in body, not signature. |
| Error handling | `error-handling.md` | Inline JSON errors in routes. Narrow try-catch around specific I/O. Unknown catches must be coerced before use. |
| Types / validation | `typescript-patterns.md` | No `any`. No `@ts-ignore`. Explicit return types on exports. `satisfies` for type checking. |
| Zod schemas | `zod-schemas.md` | Schema-first. `{ error: '...' }` not `{ message: '...' }` (Zod 4). Schemas in `schemas.ts` / route files. |
| File I/O | `bun-native-apis.md` | Prefer Bun APIs over `node:fs` in new and significantly rewritten files. |
| Database / DI | `dependency-injection.md` | Pass `db` as parameter — never import singleton in lib functions. Singleton only at entry point. |
| Tests | `testing.md` | `bun:test`. In-memory DB via `newMemoryDb()`. Test behavior not implementation. No snapshot tests. |
| Logging | `hard-requirements.md` | `console.*` is a Biome warning. Only acceptable in `index.ts`, scripts, and dev server. |

## Conflict Resolution

When two rules conflict, surface it immediately — do not silently pick a side. Precedence order:

1. `the-posture.md` (wins over everything)
2. `hard-requirements.md` (non-negotiable tech constraints)
3. All other rules (use judgment; name which rule you're prioritizing and why)

If precedence is still unclear, ask the user.
