# The Works — Phase: seal

**The posture for this phase: capture what was learned, then release the work. This is a light step, not a heavy phase — but the learning capture is not optional.**

Read `the-works-overview.md` for the procedure this sits in. Load only this phase rule while in `seal`.

## Success criterion

The feature is ready to land: the ledger is fully resolved and its learnings are recorded *before* it is cleared, the anchors pass, the final strict review is done, and the draft PR has flipped to ready.

## Harvest before you clear

The ledger is about to be emptied. Its entries are the record of what this batch taught — what had to be hacked, what duplication appeared, what was optimized or deliberately not. That record must survive the cleanup. So, before clearing:

1. **Harvest each resolved entry's learning** into a durable place:
   - The PR's **Disposition** field (per the repo PR template) — what happened to this work and why.
   - The Works' own docs or rules, when an entry reveals something that should change how the *next* feature is built. A recurring corner is a candidate for a new convention; record it here, in The Works, not in an external system.
2. **Then clear the ledger** — resolved entries are removed; `.ledger/` ends empty.

The Works captures its own learning. Do **not** route this through an external journal or notes skill — the procedure is self-contained, and its learnings live with it.

## The landing gate (the one hard checkpoint)

Before flipping the draft PR to ready, confirm all of:

- **`.ledger/` is empty** (every entry was `fixed` or `accepted: <reason>`, and the learnings were harvested). A non-empty ledger blocks landing — that is the gate.
- **Anchors pass.** Run them. Behavior is what `SPEC.md` says it should be.
- **Full strict review done.** Apply The Works' review standard — the same quality bar `the-works-phase-right.md` states (no duplication, plain over clever, honest names, comments carry why, no dead code, no abandonment markers, no weakened tests) — across the final diff, and exercise the affected paths with representative input. A passing build is not evidence of behavior; seeing it run is.
- **Optimizations are justified.** Any `fast`-phase optimization carries its before/after measurement inline. If one does not, it is a defect — send it back, do not land it.

## Release

- Flip the `feature → main` PR from draft to ready.
- The PR's "Seen it run?" receipts and "Disposition" field are filled from the verification you just performed — not from claims.

## What this phase is not

- It is not a place to add features, refactor further, or optimize. Those phases are done. If `seal` surfaces real new work, that is a finding — record it and surface it to the operator; do not quietly fold it in.
