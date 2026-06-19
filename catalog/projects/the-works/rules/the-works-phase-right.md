# The Works — Phase: right

**The posture for this phase: make the batch legible and sound, without changing what it does. You have explicit authority to revise working code.**

Read `the-works-overview.md` for the procedure this sits in. Load only this phase rule while in `right`; the other phases' permissions will contradict this one.

## Success criterion

The whole batch — every unit carried through `work` — reads cleanly, carries no avoidable duplication, and behaves exactly as it did before you touched it. The ledger is fully dispositioned. Anchors are green.

"Behaves as before" is verified, not assumed: the anchor checks the `work` phase left are your regression net. Run them before and after. If you cannot run them, you cannot claim behavior is unchanged — stop and surface that, do not proceed on faith.

## Explicit authority (this is the job, not a transgression)

The most common failure this phase corrects is an agent refusing to touch working code. Here, touching it is the assignment:

- **Revise working code freely.** Rename, restructure, extract, inline. If it reads poorly, fix it.
- **Dissolve the unit boundaries.** The sub-issue splits were `work`-phase scaffolding, not architectural commitments. Merge two units' modules, extract a third shared one, move code across the boundaries the work phase improvised — whatever the batch's true shape wants.
- **Deduplicate across the batch.** This is the phase where the shared abstraction finally becomes visible, because the whole batch now exists in rough form. Remove repetition; extract the common form to one place.

## First required deliverable: the disposition table

Before reworking, read every fragment in `.ledger/` and produce a disposition table — every entry mapped to exactly one of:

- **fixed** — you will address it (and then do).
- **accepted: \<reason\>** — it ships as-is, with a stated reason. Permitted. Hidden debt is the defect; acknowledged debt with a reason is a decision.

This table is a required *output*, not a reminder to "read the ledger." Producing it forces a read of every entry and makes the drain auditable by the operator and the `seal` step.

## The quality bar (stated here in full — The Works is self-contained)

Apply all of these to the batch. Do not reach for an external rule file; the standard is here.

- **No duplication.** If an expression or pattern repeats across two or more places, extract a shared helper. Resolve every duplication entry in the ledger.
- **Plain over clever.** No clever ternary chains, no one-line pipeline gymnastics, no terseness that requires knowing an idiom. Code a reader with no prior context can follow on first read. If you have to reason about the code to read it, rewrite it plainer.
- **Verbose, honest names.** Names say *what*. No abbreviations, no single-character names. A clear name beats a saved keystroke at every future read.
- **Comments carry WHY.** Names carry *what*; comments carry intent, constraints, and the reason a non-obvious choice was correct. Add them where the why is not obvious from the code.
- **No dead code.** Delete commented-out blocks, unused variables, unreachable branches, orphaned files.
- **No abandonment markers.** No `TODO`, `FIXME`, `HACK`, `XXX` left in the code. If something genuinely cannot be done in scope, it becomes an `accepted: <reason>` ledger disposition or a follow-up issue — not a breadcrumb in the source.
- **No test weakening.** Do not delete, skip, or weaken an anchor to make things pass. A failing check is a finding to investigate, not to silence. Strengthening anchors during `right` is welcome; weakening them is never permitted.

## Prohibitions (anti-goals for this phase)

- **Do not optimize for speed.** Performance is the `fast` phase, and it comes after this one — optimizing now would entangle code you are still restructuring. If you spot a hot path, record it as a ledger entry for `fast`; do not act on it here.
- **Do not add features.** Reworking is not an invitation to expand scope. No new capability beyond what `work` already built and `SPEC.md` defines.

## Gate to merge (right → feature)

- The disposition table is present; every ledger entry is `fixed` or `accepted: <reason>`.
- The quality bar above is met across the batch.
- The anchors still pass — behavior is unchanged, and you have run them to prove it.
