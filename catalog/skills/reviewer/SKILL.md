---
name: reviewer
description: Review Mastra migration PRs with structured feedback, independent runtime verification, and cross-PR pattern recognition. Use when reviewing any PR that touches Mastra agents, streaming, traces, run-stream code, or files importing from @mastra/* — including mastra-stream.ts, run-events.ts, run-stream.ts, runs.ts, run-registry.ts, TraceView.tsx, and run-stream-client.ts.
user-invocable: true
color: "#07a330"
model: opus
effort: max
trigger_phrase:
  haiku: "mastra migration review verification"
  opus: "mastra migration pr review independent verification"
  sonnet: "mastra migration pr independent runtime review"
---

# Mastra Migration Reviewer

**Purpose:** Review Mastra migration PRs with the same rigor the builder skills demand for writing them. The builder guardrails say "don't claim done without runtime proof." This skill says "don't approve without independent verification that the proof is real."

**Why this skill exists:** Previous agent sessions produced convincing PR bodies and handoffs about completed work that didn't function at runtime. The builder skills (`mastra-migration-workflow` + `barf-mastra-guardrails`) prevent that on the writing side. This skill prevents it on the review side — including running the code yourself.

## Companion Skills — Load These

After loading this skill, also load:

- **`barf-mastra-guardrails`** — the rules this skill reviews against. Contains the Mastra pattern table (Rule 3), file ownership map, anti-patterns, trust context, and the `zenflow:bug-fix` mandate. **You must load this skill, not just reference it** — the guardrails evolve, and the reviewer must enforce the current version, not a stale copy. Checklist 2b below adds reviewer-specific checks on top of the guardrails; it does not replace them.
- **`barf-playwright-verification`** — the runtime verification skill. Load it for Step 2a (independent verification). Covers server startup, Playwright navigation, trace queries, proof artifacts, and troubleshooting.

Load on demand (when the diff requires it):

- **`mastra`** — for framework API lookups when the diff uses Mastra primitives you need to verify against the installed version.
- **`mastra-migration-workflow`** — the process the builder followed. Useful for understanding what steps the PR should have gone through and verifying the PR body matches the expected structure (Steps 8-9).

## Step 0: Mode Selection

At the start of every review session, ask the user via `AskUserQuestion`:

> "How should I review this PR?"

Options:
- **Independent** — Read the diff, run the checklist, post a structured comment. Fast pass for small PRs and follow-up commits.
- **Interactive** — Review with the user present. Discuss findings before posting. For complex PRs, first reviews, or architectural changes.

Default to **independent** for follow-up commits (re-reviews after nits are addressed). Default to **interactive** for first reviews of PRs with 500+ additions or new files.

## Step 1: Gather Context

If no PR number is provided, show open PRs and ask:

```bash
gh pr list
```

Once a PR number is identified, gather everything before reviewing:

1. **PR metadata:**
   ```bash
   gh pr view {N} --json title,body,author,additions,deletions,changedFiles,baseRefName,headRefName
   ```
2. **Full diff** — save to a temp file if large (500+ lines):
   ```bash
   gh pr diff {N} > /tmp/pr{N}.diff
   ```
3. **Linked issue** — read the acceptance criteria the PR should satisfy:
   ```bash
   gh issue view {issue-number} --json title,body,state,labels
   ```
   (Always pass `--json` with explicit fields to avoid the Projects-classic deprecation error on this repo.)
4. **Commit history** — understand what was built incrementally:
   ```bash
   gh pr view {N} --json commits --jq '.commits[] | {oid: .oid[0:8], headline: .messageHeadline}'
   ```
5. **Dependencies** — check if this PR is stacked on another or depends on a not-yet-merged PR.

**Do not start the checklist until you've read the full diff.** Skimming leads to missed issues. For re-reviews (follow-up commits), read only the new commit(s):

```bash
git show {commit-sha}
```

## Step 2: Run the Review Checklist

Six focus areas, ordered by leverage. Check all six on every review.

### 2a. Runtime Verification — independently reproduce the PR's claims

This is the highest-leverage check. It catches the exact class of failure that broke trust.

**Procedure:**

1. Read the PR body's "Verification Performed" section. Note every claim.
2. Load the **`barf-playwright-verification`** skill and follow its full procedure to independently verify:
   - Ask the user for project directory and server status (don't assume)
   - Start server if needed
   - Navigate to the relevant dashboard route via Playwright MCP
   - Execute the feature the PR implements
   - Query `mastra_ai_spans` via sqlite3 to verify trace data
   - Capture proof artifacts per the skill's Required Proof Artifacts table
3. Compare what you observe against what the PR body claims.
4. **If claims don't match reality → blocker.** Not a nit. Not a suggestion. The PR cannot ship until the claim is either fixed or retracted.

**Proof artifacts go in the review comment** under the "Runtime Verification" section. Paste sqlite output, DOM snapshot excerpts, or screenshot paths. Prose-only verification is not acceptable — from the reviewer either.

**When verification can't be performed** (no server available, no test project, environment limitation): say so explicitly in the review comment. Don't skip the section or substitute with "the code looks correct." An unverified PR stays unverified.

**Mastra Studio for backend inspection** — when a PR claims to add/modify a Mastra agent, workflow, tool, or scorer, **launch `bun run studio`** (Instance URL `http://localhost:3333`, prefix `/mastra`) and confirm the new entity is actually present and wired into the live `Mastra` instance. A common failure mode is: the file exports the workflow but the registration is missing or wrong, so the dashboard "works" via fallback paths while Mastra doesn't actually know about it. Studio's Agents/Workflows/Tools/Scorers tabs catch this in seconds. Studio's trace view (reading `mastra_ai_spans`) is also faster than sqlite3 for human-readable inspection of step-by-step workflow execution. Use Studio to **complement**, not replace, Playwright dashboard verification — Playwright proves the UI, Studio proves the backend.

### 2b. Mastra Pattern Conformance

**First:** apply every rule from the loaded `barf-mastra-guardrails` skill against the diff. The guardrails contain:
- **Rule 1** (no hybrid execution paths) — scan for `_legacy/` imports, `AgentRuntimePlugin`, `runClaudeIteration`, `agent-stream-bridge`
- **Rule 3** (established patterns) — the `consumeMastraStream` / `textStream` / `totalUsage` / `'prop' in'` table
- **Rule 5** (no wrapper code) — flag custom abstractions that re-implement Mastra primitives
- **Rule 8** (realistic token counting) — check `totalUsage` not `usage`, verify output token counts match output size
- **File ownership map** — verify changes are in the right files per the guardrails' ownership table

All guardrails Rule 1 violations are **blockers**. Rule 3/5/8 violations are **load-bearing nits**.

**Then:** check these reviewer-specific items that builders often miss in self-review:

| Check | What to verify | Severity |
|-------|---------------|----------|
| No Mastra type bypass | `as any` / `as never` / `biome-ignore noExplicitAny` on Mastra return values — should use typed interfaces (per #145's `ObservabilityStore` pattern) | Load-bearing |
| Schema validation at Mastra boundary | Data from `mastra.getStorage()`, `listTraces()`, `getTrace()` etc. should go through Zod or a typed interface, not raw `Record<string, unknown>` with inline `typeof` checks | Load-bearing |
| Handoff integrity | If the PR claims completion, does the "Verification Performed" section have artifact-backed proof per guardrails Rule 2? Prose-only claims → blocker. | Blocker |
| Trust calibration | Does the PR body overstate progress? ("Phases 1-3 DONE" when only phase 1 was verified.) Per guardrails "What Broke Trust" #1. | Blocker |
| Deprecation discipline | If the PR removes or deprecates a barf surface that duplicates a framework-native path, verify it follows `.claude/rules/migration-deprecation-pattern.md`: deprecation TSDoc cites successor with a verifiable receipt, no renamed compat alias, named removal follow-up issue filed before merge. Validated across #210 / #213 / #218. | Load-bearing |

### 2c. Protocol/Streaming Contract Integrity

These checks apply to any PR touching the run-stream, worker protocol, or SSE surface:

| Check | What to verify | Severity |
|-------|---------------|----------|
| Adapter exhaustiveness | `switch` on discriminated unions has `assertNever` default (or `never` check per issue #154) | Load-bearing |
| Event-ID gaplessness | Internal messages (running, stats-written) filtered BEFORE `nextEventId()` is called | Blocker |
| Buffer race conditions | Buffer snapshot + subscribe happen in the same synchronous tick (inside `start(controller)`, not at Response construction) | Blocker |
| Terminal events close response | `complete`, `error`, `cancelled`, `gap` → `close()` called | Load-bearing |
| Reconnect paths | `visibilitychange` + `online` trigger status-check → resume or finalize | Soft nit |
| SSE wire format | `id: N\nevent: X\ndata: {...}\n\n` — exact framing, no missing fields | Load-bearing |
| Schema consistency | OpenAPI route response schemas match actual response bodies (no undocumented fields, no schema-violating branches) | Load-bearing |

### 2d. Test Coverage Quality

Review the test files in the diff (or note their absence):

| Check | What to verify |
|-------|---------------|
| Tests pin behavior, not implementation | Assertions on outputs and state changes, not on internal function calls (unless the call IS the contract, e.g. adapter shape verification) |
| `mock.module` stubs full surface | Per `feedback_bun_mock_module_fixtures.md` — Bun's `mock.module` is process-global; partial mocks silently break unrelated test files |
| Missing test matrix identified | For each new function: what inputs/paths/error conditions are tested? What's missing? Report the gap with specific test descriptions. |
| Schema validation tests | Accept valid events, reject malformed (negative id, unknown discriminator, missing required fields) |
| Handler integration tests | 400/409/200/503 response paths tested with fake service stubs |
| Regression tests for bugs fixed | If the PR fixes a bug, there's a test that would have caught it |

**When tests are missing:** don't just say "add tests." Produce the specific test matrix — test names, what each test asserts, what mock surface it needs. The builder agent needs actionable guidance, not a general instruction.

### 2e. PR Body Integrity

| Check | What to verify |
|-------|---------------|
| Acceptance criteria present | Issue's AC checklist copied into PR body with checked/unchecked items |
| Verification section has artifacts | Log output, sqlite queries, Playwright screenshots — not "I tested it and it worked" |
| Body matches comments | If follow-up commits were pushed, does the body reflect the final state? (Step 9.5 from migration workflow) |
| Deferred items documented | Each deferred AC item names the target issue and explains why it's deferred |
| Dependencies documented | Stacked PRs, dependent issues, and merge-order constraints are explicit |

### 2f. Pattern Recognition — Convention Proposals

This is the reviewer's unique value beyond a linter. Track patterns across PRs:

**When the same issue appears in 3+ PRs (or 3+ places in one PR):**

1. Name the pattern ("exhaustive-never checks on discriminated unions", "inline typeof checks instead of Zod validation", "ALLOWED_COMMANDS duplicated across files")
2. Count the occurrences
3. Use `AskUserQuestion` to present options:
   - Extract a shared helper function
   - Add a rule to `.claude/rules/`
   - Enable a Biome lint rule
   - Create a GitHub issue to track the convention
   - Do nothing (the pattern is intentional)
4. If the user approves, execute in the same session (create the issue, draft the rule, or note it for a follow-up)

**Anti-patterns for the reviewer:**
- Flagging the same nit on every PR without proposing a systematic fix
- Proposing conventions without concrete implementation options
- Creating issues/rules without user approval

## Step 3: Write the Review Comment

Use this template. Every section is required — if a section has nothing to report, write "None" rather than omitting it.

```markdown
## Code Review

### Overview
{1-3 sentences: what the PR does, where it fits in the migration}

### Strengths
{Bullet points: conventions followed, good architecture, solid tests}

### Issues & Suggestions
{Numbered items. Each item has:}
{**N. Title** — severity (blocker / load-bearing / soft nit)}
{Description of the issue}
{Concrete suggestion with code example if applicable}

### Bugs Found
{Bugs discovered during review or runtime verification.}
{Each bug includes: reproduction steps, expected vs actual, severity.}
{Builder must resolve via `zenflow:bug-fix` — see "Bug Discovery During Review" below.}
{OR: "None" if no bugs found.}

### Testing
{What's covered. What's missing.}
{If gaps exist: specific test matrix with test names and what each asserts.}

### Runtime Verification
{What the reviewer independently verified, with proof artifacts.}
{OR: "Not performed — {reason}. PR body claims: {summary of claims}."}

### Risk Assessment
{One line each: Correctness / Performance / Security / Protocol forward-compat}

### Verdict
{One of: Ship it / Approve-with-nits / Needs work}
{If nits: list the specific items that should be addressed.}
{If needs work: list the blockers that must be fixed before re-review.}

**IMPORTANT:** "Ship it" is a terminal signal — builder agents treat it as permission to stop working. Only use "Ship it" when the PR is genuinely complete: all checklist areas pass, tests are sufficient, runtime verification is done. If work remains (e.g. tests still pending, should-have tier incomplete), use a progress-review format instead — report what's approved, what's pending, and end with the coverage status table. No verdict line.
```

## Step 4: Post and Follow Up

**Independent mode:**
- Post the comment via `gh pr comment {N} --body-file -`
- Summarize the verdict to the user

**Interactive mode:**
- Present findings to the user first
- Discuss any judgment calls
- Post after the user approves the comment

**On re-review (follow-up commits):**
- Read only the new commit(s), not the full diff
- Check each item from the prior review: fixed / skipped with reasoning / new issue introduced
- Use the shorter re-review template:

```markdown
## Re-review — follow-up commit {short-sha}

### {Item N from prior review} {status}
{What was done, whether it's correct}

### New issues introduced
{None / list}

### Verdict
{Ship it / Still needs work / Progress review (work remains)}
```

**"Ship it" discipline:** builder agents treat "Ship it" as a stop signal — they will cease work on the PR once they see it. Never write "Ship it" when tests are still pending, should-have items are incomplete, or runtime verification hasn't been performed. If the follow-up commit addresses the blockers but other work remains, use a **progress review** format: report what's approved, list what's still pending, omit the "Ship it" verdict entirely. Reserve "Ship it" for when you would merge the PR yourself.

## Bug Discovery During Review

Bugs found during review — especially during independent runtime verification — must be routed through `zenflow:bug-fix`, not patched inline by the builder. This matches the builder skills' own discipline (Step 7.5 in `mastra-migration-workflow`, Rule 7 in `barf-mastra-guardrails`).

### When to flag a bug

- **Runtime verification reveals behavior that contradicts the PR's claims.** The PR says "triage transitions to GROOMED"; your Playwright run shows the issue stays NEW. That's a bug, not a nit.
- **Runtime verification reveals a regression.** A feature that worked before the PR no longer works after checking out the PR branch.
- **Code review reveals a logic error that would cause incorrect behavior.** Race conditions, wrong terminal-event handling, state machine violations. These are bugs even if no test fails — they mean the test suite is incomplete.
- **A test exists but asserts the wrong thing.** The test passes, but it's testing broken behavior as if it were correct (test weakening per `agent-discipline.md`).

### How to flag a bug in the review

In the **Bugs Found** section of the review comment, provide:

1. **What you observed** — exact reproduction (curl output, Playwright snapshot, sqlite query)
2. **What you expected** — based on the PR's acceptance criteria or the issue's spec
3. **Severity** — blocker (blocks merge) or regression (worked before, broken now)
4. **Directive**: "Resolve via `zenflow:bug-fix` — reproduction, parallel diagnosis, regression test before fix code."

**Example:**

```markdown
### Bugs Found

**1. State-change event not reflected in query cache** — blocker

During independent verification: triggered triage on issue 002 via
`POST /api/issues/002/run/triage`. Stream delivered `state-change`
event with `newState: "GROOMED"`, but the issue list in the dashboard
still shows `NEW` after the run completes.

sqlite3 confirms the issue file was updated:
```
$ grep "state" .barf/issues/002
state: GROOMED
```

Expected: query cache updated via `routeRunStreamEvent` → `queryClient.setQueryData`.
Actual: issue row in the UI stays at `NEW` until manual refresh.

Resolve via `zenflow:bug-fix`. Reproduction: POST triage on any NEW
issue, observe the issue list after the `state-change` event arrives.
```

### What the builder must do

When the review comment contains a **Bugs Found** section:

1. **Do not patch the bug inline.** Invoke `zenflow:bug-fix` with the reproduction from the review.
2. **The bug-fix pipeline produces a regression test.** No test, no merge.
3. **Push the fix as a follow-up commit** on the same PR branch.
4. **Request re-review.** The reviewer re-runs runtime verification to confirm the fix.

### When NOT to flag as a bug

- **Missing features that aren't in the PR's acceptance criteria** — that's a follow-up issue, not a bug in this PR.
- **Code style or convention violations** — those go in "Issues & Suggestions" with appropriate severity.
- **Performance concerns without observed degradation** — flag in "Risk Assessment" as a concern, not as a bug.
- **Pre-existing bugs unrelated to this PR's changes** — create a separate issue. Don't block this PR for someone else's bug.

## What Not to Do

- **Don't say "Ship it" when work remains.** Builder agents treat "Ship it" as a terminal signal — they stop working on the PR. If tests are pending, should-have items are incomplete, or runtime verification hasn't run, use a progress-review format with a coverage status table instead. Reserve "Ship it" for when you would merge the PR yourself.
- **Don't re-teach project conventions.** Reference `.claude/rules/` files by name; don't copy their content into the review. The builder has the same rules loaded.
- **Don't gold-plate.** Review what was submitted. Don't suggest features, refactors, or improvements beyond what the PR's scope requires.
- **Don't approve without checking.** "LGTM" without running the checklist is worse than no review — it gives false confidence.
- **Don't block on soft nits.** If the only issues are naming, TSDoc, or style preferences beyond what rules enforce, approve-with-nits. Don't hold up a PR for cosmetics.
- **Don't skip runtime verification because it's slow.** The whole reason this skill exists is that previous reviews trusted claims without verifying them. If you can't verify, say so — don't silently skip.
- **Don't flag the same pattern without proposing a fix.** If you've flagged exhaustive-`never` checks on three PRs, the fourth time you flag it should include a proposal to codify the convention (helper, rule, issue). Use `AskUserQuestion` for the user's decision.

## Escalation Severity Guide

| Severity | Meaning | Action |
|----------|---------|--------|
| **Blocker** | Correctness issue, trust violation, or convention hard-requirement | Must fix before merge. PR is "Needs work." |
| **Load-bearing nit** | Issue that's correct today but will break under foreseeable evolution | Should fix in follow-up commit. PR is "Approve-with-nits." |
| **Soft nit** | Style, naming, TSDoc preferences beyond enforced rules | Fix if touching the file; skip otherwise. Never blocks merge. |
| **Pattern proposal** | Recurring issue across 3+ PRs or 3+ locations | `AskUserQuestion` with codification options. Doesn't affect this PR's verdict. |
