---
trigger_phrase:
  haiku: "agent discipline guardrails"
  opus: "agent output guardrails stuck protocol"
  sonnet: "no todos gold plating stuck"
always_on: true
---

# Agent Discipline

Universal version. For language-specific examples (TypeScript, Python, etc.), see the corresponding `agent-discipline-<lang>.md` rule and use both together. The principles below apply regardless of language; the language-specific rule supplies syntax.

## Output Anti-Patterns

These are red flags that indicate a task was not completed correctly. Avoid them.

### No Abandonment Markers in Delivered Code

Do not leave abandonment-marker comments (TODO, FIXME, HACK, XXX, or similar) in code you submit. These indicate you punted on the hard parts. If something genuinely cannot be done within scope, document it in your project's issue tracker or create a follow-up task — don't leave a breadcrumb in the code.

### No Gold Plating

Only implement what was asked for. Do not add features, configuration options, abstractions, or improvements that weren't in the acceptance criteria. Extra output looks helpful but creates review burden, introduces unintended behavior, and violates the focused-context principle: agents that stay on task produce better output than agents that range freely.

Specific forms of gold plating to avoid:
- Adding optional parameters or flags "for flexibility"
- Extracting abstractions for code you touched but weren't asked to refactor
- Adding logging, metrics, or observability beyond what the task required
- Writing tests for functionality adjacent to but outside the task scope

### No Test Weakening

Never delete, skip, or weaken a test to make the suite pass. This includes:
- Removing assertions that were failing
- Suppressing type errors, lint warnings, or other static-analysis findings in tests
- Changing expected values to match broken behavior
- Adding conditional skips, exclusions, or filters that disable test execution

If a test is failing and you don't know why, that is a signal to stop and investigate — not to neutralize the test. A passing suite with weakened tests is worse than a failing suite: it hides real problems.

### No Magic Values

Do not hardcode strings, numbers, or paths that belong in named constants. Extract to a constant at the top of the file or module using your language's idiomatic convention.

---

## STUCK Criteria

Declare an issue STUCK — do not keep retrying — when any of the following are true:

1. **The same failure occurs two or more times with different approaches.** If you've tried two genuinely different approaches to the same problem and both fail, you've hit something that needs human attention. A third attempt is unlikely to succeed and wastes resources.

2. **You've identified a blocker you cannot resolve.** External dependency unavailable, spec is contradictory, required context is missing from the task. Name the blocker explicitly in your notes, then stop.

3. **Context overflow on a task that should be focused.** If context is exhausted on a task that should have been tractable, the task is too large. Do not attempt to summarize and continue — overflow is a signal that the task needs splitting. Mark STUCK with a note suggesting how to split it.

When marking STUCK, always leave a clear note explaining:
- What you tried
- Where it failed
- What a human (or next agent) would need to unblock it
