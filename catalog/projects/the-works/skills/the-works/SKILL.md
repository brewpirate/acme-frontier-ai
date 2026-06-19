---
name: the-works
description: >
  Run a feature through The Works — the make-it-work / make-it-right / make-it-fast
  procedure, where each phase is a distinct agent posture decoupled from the unit of
  work. Use when building a feature in batched phases: carry several units through
  "work" first, then one "right" pass over the batch, then one "fast" pass, then
  "seal". Walks the operator through the phases, loads the correct posture per phase,
  and dispatches the right-phase rework agent. Self-contained — invokes no other skill.
user-invocable: true
---

# The Works

A procedure for building a feature in three ordered dispositions — **work**, **right**, **fast** — plus a light **seal** to land it. Each disposition is a posture with its own rules. The unit of work and the phase are decoupled: carry many units through `work`, then run a single `right` pass over the whole batch, then a single `fast` pass.

**Read `~/.claude/rules/the-works-overview.md` first** — it is the authoritative procedure (topology, gate gradient, artifacts, the ledger). This skill operates that procedure; it does not restate it.

The Works is **self-contained**: it invokes no other skill and depends on no other project's rules. Do not reach into zenflow, field-notes, or any external skill — every step below is performed with built-in tools and The Works' own rules.

## How to invoke

`/the-works [phase]` where phase is `work`, `right`, `fast`, or `seal`.

- With a phase: operate that phase per the steps below.
- Without a phase: report the feature's current state (which units exist, what `.ledger/` holds, what has merged) and ask the operator which phase to run. **Transitions are operator-directed — never advance phases on your own.**

## Loading discipline

For the active phase, read **exactly one** phase rule and adopt it: `~/.claude/rules/the-works-phase-<phase>.md`. Do not load another phase's rule in the same pass — its permissions will contradict the active posture. (Mapping: `rule-map.md`.)

## The phases

### Setup (once, before `work`)

Confirm the scaffolding exists on the feature branch: a tracking issue (experiment-authorization template) pointing at `SPEC.md`; the `feature/<name>` branch; a draft PR `feature → main`. If absent, create them with the operator before any `work` begins. `SPEC.md` is the contract every later phase verifies against.

### work

Adopt `the-works-phase-work.md`. For each unit of work (its own branch off `feature`):

1. Implement the unit to a running result — breadth over polish.
2. Leave at least one **cheap, re-runnable anchor** check proving the path runs.
3. Append a `.ledger/<unit>.md` fragment recording the corners cut.
4. Merge the unit into `feature` under the light gate (runs? anchor? ledger fragment?).

Run these units one at a time or in parallel, as the operator directs. Do not refactor, optimize, or deduplicate here — those are later phases.

### right

Adopt `the-works-phase-right.md`. When the operator confirms all units are merged, **dispatch the rework agent over the whole batch**:

> Use the Agent tool to spawn the rework agent over the whole batch. The agent file links flat to `~/.claude/agents/the-works-right.md`, so the identifier is most likely the bare name: `subagent_type: "the-works-right"`.
>
> **This exact string is unconfirmed until a post-link session restart — confirm it on the first run.** Symlinked agents register only after the session restarts. If `the-works-right` does not resolve, try the plugin-style form `the-works:the-works-right` (the `<project>:<name>` convention applies when a project is installed as a *marketplace plugin*, not symlinked — the less likely case here). Correct this line once you know which form your harness registered.

Give it the feature branch, `SPEC.md`, and the path to `.ledger/`. Its first deliverable is the **disposition table** (every ledger entry → fixed | accepted:reason). It reworks the batch, drains the ledger, and keeps anchors green. Merge `right → feature` under the code-quality-strict gate.

### fast

Adopt `the-works-phase-fast.md`. Measure first. If there is no measured hot path, the correct outcome is **no change** — report "measured, nothing to do" and stop; that is success, not a skip. If there is a hot path: optimize it, prove the speedup with a before/after number carried inline as justification, keep anchors green, and disposition any deferred-optimization ledger entries. This is a skill step — no separate agent is built for it yet.

### seal

Adopt `the-works-phase-seal.md`. Harvest each resolved ledger entry's learning into the PR's Disposition field and The Works' own docs **before** clearing `.ledger/`. Confirm the landing gate: `.ledger/` empty, anchors pass, full strict review done (The Works' own quality bar), optimizations carry their measurements. Then flip the draft PR to ready. Fill the PR's "Seen it run?" receipts from verification you actually performed — not from claims. This is a skill step.

## The non-negotiables (carry these across every phase)

- **Behavior is verified, not assumed.** The anchor checks are the regression net for `right` and `fast`. Run them; do not claim "unchanged" on faith.
- **The ledger is the memory.** It is what makes leaving code rough safe. Record honestly in `work`; resolve every entry by `seal`; harvest learnings before clearing.
- **Stay in posture.** One phase rule at a time. The phases disagree with each other on purpose.
