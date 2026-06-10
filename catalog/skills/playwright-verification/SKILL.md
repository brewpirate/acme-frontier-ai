---
name: playwright-verification
description: "Runtime verification using Playwright MCP + proof artifacts. Use when acceptance criteria mention UI behavior, when claiming runtime verification, or when independently verifying a PR's claims. Produces artifact-backed proof — screenshots, DOM snapshots — not prose claims."
---

# Playwright Verification

**Purpose:** Runtime verification of features through a browser. Drives the browser via Playwright MCP and produces artifact-backed proof that a feature works — not prose claims like "I tested it and it worked."

**Why this exists:** Agent sessions have produced convincing PR bodies claiming features were "verified at runtime" with prose descriptions that didn't match reality. Artifact-backed proof (screenshots, DOM snapshots, query output) is the only acceptable verification.

## When to Use

- Any acceptance criterion that mentions UI behavior ("dashboard shows...", "modal displays...", "form submits...")
- When independently verifying a PR's claims (reviewer workflow)
- When completing a builder task that has UI-observable behavior
- When debugging a feature that should be visible in the browser

**When NOT to use:**
- Pure backend changes with no UI surface (use API calls, DB queries, or log inspection directly)
- Type-check / lint / test verification (use the project's test runner)

## Step 1: Prerequisites — Ask Before Starting

**Ask the user via `AskUserQuestion` before touching anything:**

> "Before I start Playwright verification, I need to know:"

Options to gather:
1. **What URL should I navigate to?** (e.g., `http://localhost:3000`, `http://localhost:5173`)
2. **Is the server already running?** If yes, use it. If no, ask for the start command.

**Do NOT:**
- Hardcode a default URL or port
- Start a server without checking whether one is already running
- Assume anything from previous sessions

## Step 2: Server Management

**If no server is running and the user provides a start command:**

```bash
cd <project-dir> && <start-command>
```

Use `run_in_background: true` on the Bash tool so it doesn't block. Capture the task_id for cleanup.

**When verification is complete, stop the background server** using `TaskStop` with the task_id. Don't leave servers running between sessions.

## Step 3: Verification Sequence

For each verification instruction from the issue/PR:

1. **Navigate**: `browser_navigate(url: "<target-url>")`
2. **Snapshot**: `browser_snapshot()` — get the DOM tree. Use `ref` values from the snapshot for interactions. **Never guess selectors.**
3. **Locate the target**: find the relevant element in the snapshot. If not visible, interact with navigation/filters first.
4. **Trigger the action**: click, type, or interact using `ref` from snapshot.
5. **Wait for result**: use `browser_wait_for` if needed, or snapshot again after a reasonable delay.
6. **Capture proof**: screenshot or DOM snapshot of the relevant state.
7. **Record the result**: paste the proof artifact and note pass/fail against the verification instruction.

## Step 4: Required Proof Artifacts

"Verified at runtime" means one of the following pasted into the PR body or review comment — **not prose like "I tested it and it worked"**:

| Change affects | Required proof |
|----------------|----------------|
| UI state / visual changes | Playwright screenshot or DOM snapshot showing post-change state |
| Form submission / API calls | Network request log showing the request and response |
| Navigation / routing | Screenshot of the resulting page with URL visible |
| Error handling UI | Screenshot showing the error state rendered correctly |
| Dynamic content (lists, tables) | DOM snapshot showing the rendered data |

## Step 5: Reporting Results

For each verification instruction, report:

```markdown
### Verification: {instruction text}
**Result:** ✅ Pass / ❌ Fail
**Proof:** {screenshot path, DOM snapshot excerpt, or query output}
**Notes:** {any observations — timing, edge cases noticed}
```

If a verification step **cannot be performed** (no server, no test data, environment limitation), say so explicitly:

```markdown
### Verification: {instruction text}
**Result:** ⚠️ Not performed
**Reason:** {why it couldn't be done}
```

Never skip a verification step silently. Never substitute prose for proof.

## Troubleshooting

| Symptom | First check |
|---------|-------------|
| "Connection refused" / page won't load | Server isn't running — ask the user. Don't retry blindly. |
| Page loads but shows no data | Wrong URL, wrong environment, or missing test data. Ask the user. |
| Element not found in snapshot | Page may not have loaded fully. Wait and re-snapshot. |
| Click doesn't trigger expected change | Check for JavaScript errors via `browser_console_messages`. |
| Screenshot is blank or partial | Try `browser_take_screenshot(fullPage: true)`. |

## What Not to Do

- **Don't start a server without asking** for URL and whether one is already running.
- **Don't leave background servers running** after verification completes.
- **Don't guess selectors.** Always use `browser_snapshot` first and use `ref` values.
- **Don't claim "verified" without artifact proof.** See Required Proof Artifacts above.
- **Don't substitute log-grep for Playwright** when the criterion mentions UI behavior.
- **Don't retry clicks blindly.** If the first click didn't work, check console messages and server logs before trying again.
