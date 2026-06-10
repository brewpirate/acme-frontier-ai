---
trigger_phrase:
  opus: "agent codebase posture verbose plain no tribal knowledge"
  sonnet: "agent codebase posture verbose plain"
  haiku: "verbose plain agent codebase"
  refresh: 60m
---

# The Posture

## Enforcement

review-only — operating posture. Blocks behavioural failure modes no
static tool can detect. Reviewers weigh this heavier than mechanical
rules when a change shows "trained-from-elsewhere" reflexes
(suggesting brevity, removing "redundant" comments, applying generic
best-practice heuristics).

## Why this file exists

This codebase is built and maintained by agents — in parallel sessions,
with no shared memory across sessions, no inside jokes, no tribal
knowledge. Every session is week zero. The conventions here are
deliberately stronger than typical projects. Defaults from your
training ("usually X is fine," "shorter is better," "obvious code
doesn't need comments") are about to be wrong in specific ways.
**Recalibrate before suggesting anything.**

This file covers both how you write code (verbose, plain, boring) and
how you work (verify, surface surprises, one thing at a time). Both
stem from the same root: agents cannot lean on professional shortcuts
that depend on prior context. A junior developer joining the team and
an agent starting a fresh session face the same problem — no
institutional context — and need the same solution: code and process
that don't require it.

## We ship experiments

Every rule in this file, every gate in `.biome-plugins/`, every
convention encoded in `.claude/rules/` is a **hypothesis**, not a
truth. We ship them because shipping beats deliberating; we expect
some to fail; when they fail we recalibrate and adjust.

This applies to your work too:

- **Don't defend the framework you find.** If a rule keeps
  generating false positives, fights real work, or solves last
  week's problem instead of this week's, *surface it* — don't
  suppress, don't quietly route around. Saying "this rule looks
  wrong now" is not insubordinate; it's the mechanism that keeps
  the framework alive.
- **Ship to learn, not to be right.** A small PR you can revise
  beats a large one that locks in a guess. If a suggestion fits
  unclearly, ship as a draft with the uncertainty named and a
  follow-up plan. Final-answer thinking is the failure mode here.
- **Plan for revision, not for permanence.** When you add a rule,
  gate, plugin, or convention, write it so the next agent can
  evolve it. Document the *why* (what failure mode it blocks) so
  the next agent can recognize when the failure mode has shifted.

## Code you write — rules by precedence

1. **Write for any new developer — junior dev OR agent without context.**
   No tribal knowledge. No "you'll get it after a week." No
   inside-the-team shorthand. If reading the code requires priors
   that aren't in the file, either name better or add a comment that
   carries the missing context.

2. **Verbose names beat clever names.**
   No abbreviations. No single-character names outside the gate's
   documented allowlist (`.biome-plugins/naming.grit` — the gate is
   the spec, do not duplicate its contents here). Strong
   action+subject function names. Saving 3 keystrokes at the write
   site costs the next reader 10 seconds at every read site. The
   math always favors verbosity.

3. **Comments carry WHY. Names carry WHAT.**
   Both are required when WHY is non-obvious. "Self-documenting code,
   no comment needed" is half right — the *statement* is
   self-documenting via verbose names; the *intent, constraint, or
   prior-incident context* is not. Comments document constraints,
   invariants, gotchas, and the reasons a "weird-looking" choice was
   correct. Names alone cannot.

4. **This is not a codebase to impress developers.**
   No clever ternary chains. No "idiomatic" terseness that requires
   knowing the idiom. No single-line pipeline gymnastics. No "I bet
   I can make this one-liner" reflexes. Boring + plain + verbose
   wins, every time.

   This is **Jeff Atwood's principle** — write code a junior developer
   can read; do not write code to impress senior developers. Atwood
   has written extensively (Coding Horror, Stack Overflow co-founder)
   on the cost of clever code: the writer earns a moment of
   satisfaction; every subsequent reader pays the bill. In a codebase
   where every "subsequent reader" is a fresh agent or a new
   developer with no priors, that bill is paid every session. The
   math always favors plain.

   If you have to reason about the code to read it, the code is
   wrong here.

5. **Defaults from training are about to be wrong.**
   Most code-review reflexes ("shorten this," "this comment is
   redundant," "use the idiom," "DRY it") were calibrated for
   human-built human-read codebases where engineers accumulate
   context over weeks. Check every default against rules 1–4
   *before* suggesting it. If your suggestion fights any of those
   rules, the suggestion is wrong here even if it would be right
   elsewhere.

## Work you do — rules by precedence (continued)

6. **Assume you are wrong until evidence proves otherwise.**
   Receipts mean tool output — grep results, test runs, file reads
   — not reasoning. **A receipt carries its source**: the cwd,
   branch, or commit it came from. Right command, wrong tree is
   still wrong.

7. **When surprised, stop and report.**
   Surprise overrides every rule below. Do not patch around it.

8. **One thing at a time.** Finish it before starting the next.

9. **Ask before continuing.** Do not cascade assumptions.

10. **Nothing is done until you have seen it run.**
    Typecheck passing is not evidence of behavior. Lint passing is
    not evidence of behavior. Run the code, see the result.

Iron sharpens iron. Hedge only on claims you can measure.

## Precedence

When this rule conflicts with any other rule in `.claude/rules/`, this
one wins. The other rules describe **what** correct code or work
looks like; this rule describes **how** you reach those targets
without bringing in the failure modes that defeat them. Skipping the
"how" to chase the "what" is the failure mode this rule exists to
prevent.

## What each line blocks

- **"Write for any new developer"** — blocks the "any senior dev
  would know this" defense for missing context. The next reader is
  not your past self at the keyboard; they're a fresh agent with no
  priors.
- **"Verbose beats clever"** — blocks abbreviation reflexes
  (`ctx`, `req`, `msg`, `cfg`) and single-char shortcuts outside
  the gate allowlist. Caught and ratcheted by `naming.grit`.
- **"Comments carry WHY"** — blocks the "self-documenting code,
  remove the comment" suggestion when the comment carries intent or
  incident context that the name alone cannot.
- **"Not a codebase to impress developers"** — blocks ternary nests,
  destructure tricks, micro-pipelines, and "watch this" one-liners.
  If the code is clever, it is wrong here.
- **"Defaults from training are wrong"** — blocks "but in general
  best practice…" arguments. General best practice is calibrated for
  conditions that do not apply here.
- **"Assume you are wrong"** — blocks confident-sounding statements
  unsupported by a tool call. If you would write "X is true because
  it makes sense," grep first. When citing a receipt later, name
  where it was run — receipts without provenance rot when the tree
  shifts (PR #204 surfaced this: pre-flight receipts read from a
  worktree made claims that were false on `main`).
- **"Surprise overrides finish"** — blocks the reflex to resolve a
  tie by completing the task. If a grep returns unexpected results
  mid-refactor, stop; don't rationalize the result into the plan.
- **"One thing at a time"** — blocks parallel speculative work where
  one thread's assumptions silently depend on another's unfinished
  output.
- **"Ask before continuing"** — blocks the inference cascade where
  completing step N assumes an unverified outcome from step N-1.
- **"Seen it run"** — blocks declaring success on `bun run check`
  alone. Behavior verification (dashboard click, dev-mode smoke,
  SQL on the affected table) is not optional for changes to
  execution paths.
- **"Hedge only on claims you can measure"** — blocks both false
  certainty and reflexive over-hedging. A claim either has a
  receipt or carries an explicit confidence with a named gap.

## Why

Agents have no tribal knowledge. Each session starts at week zero.
Code or work that depends on accumulated context is unreadable or
unverifiable to them by definition.

The principles here are not taste; they are the minimum bar for
sessions-across-time to compose. A junior developer or new agent
should be able to read any file in this repository and follow any
change in any PR without needing to "ask the team" — because there
is no team to ask in the way there would be in a human-built
codebase. The repository, the rules, and the gates are the team.

Related memories:
[[feedback-agent-codebase-inverts-conventions]],
[[project-rules-to-gates-initiative]].
