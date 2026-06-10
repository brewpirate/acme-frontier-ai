---
trigger_phrase:
  haiku: "code quality enforcement ratchet"
  opus: "broken windows codebase quality ratchet"
  sonnet: "broken windows code quality ratchet"
always_on: true
---

# Broken Windows

Universal version. For language-specific examples (TypeScript, Python, etc.), see the corresponding `broken-windows-<lang>.md` rule and load both together. The principles below apply regardless of language; the language-specific rule supplies tools, commands, and conventions.

## The Principle

Every agent owns codebase quality. If you encounter something broken — fix it. No "pre-existing issue" dismissals. No "out of scope" hand-waving. The ratchet only turns one direction: cleaner.

## What Counts as a Broken Window

Fix these when you encounter them, even if they are unrelated to your primary task:

- **Verification suite failures** — any test or check that was passing before your changes must still pass after. If you find a pre-existing failing test, fix it.
- **Static analysis violations** — type errors, lint findings, format issues, or any other automated-check output that should be zero. Whatever your project's static analysis tooling reports as a violation needs to be at zero.
- **Dead code** — commented-out blocks, unused variables, unreachable branches, orphan files. Delete them.
- **Documentation gaps** — missing or wrong-format doc comments on exported / public symbols according to your project's documentation conventions.
- **Magic values** — hardcoded strings, numbers, or paths that should be named constants per the project's idiom.
- **Duplication** — expressions or patterns repeated across files when a shared helper would serve.

## What Does NOT Count

Do not treat these as broken windows — they are architectural decisions or planned work:

- Functionality you disagree with but that works correctly and has tests
- Missing features that weren't in scope for the original task
- Subjective style choices not covered by an explicit rule
- Performance improvements that aren't causing observable problems
- Code in files you haven't read and aren't touching

## Response Protocol

When you find a broken window mid-task:

1. **Note it** — identify the issue before fixing it
2. **Fix it** — apply the smallest correct fix; don't refactor surrounding code opportunistically
3. **Verify it** — confirm the fix doesn't introduce new issues (run the relevant check from your verification suite)
4. **Continue** — return to your primary task

If fixing the broken window would require more than roughly 15 minutes of work or touch more than 3 unrelated files, create a follow-up task for it instead and continue your primary task. This prevents scope explosion while preserving the ratchet.

## Inline Duplication Check

Before writing an expression that computes a derived value (path resolution, string formatting, config lookups, error wrapping), **search the codebase for the pattern first**. If the same expression already exists in two or more files, there should be a helper — use it. If there isn't one and you're about to create the third occurrence, extract a helper *now* instead of adding another inline copy.

The cost of one search before writing is negligible. The cost of twenty inline copies when the pattern changes is not.

## Conflict with Primary Task

Broken window fixes come **after** the primary task is functionally complete, not before. Do not let cleanup block delivery. Order:

1. Complete primary task
2. Run your project's verification suite (tests, type-check, lint, build — whichever apply to the change)
3. Fix any broken windows surfaced by those checks
4. Re-run verification to confirm a clean state

The specific verification commands for your project live in `CLAUDE.md` or in your language-specific rule (e.g., `broken-windows-ts.md`).
