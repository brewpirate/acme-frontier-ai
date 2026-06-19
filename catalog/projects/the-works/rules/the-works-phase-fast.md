# The Works — Phase: fast

**The posture for this phase: improve measured performance where measurement justifies it — and nowhere else. Most of the time, the correct outcome of this phase is to find nothing to do.**

Read `the-works-overview.md` for the procedure this sits in. Load only this phase rule while in `fast`; the other phases' permissions will contradict this one.

## Success criterion

Either: you found a measured hot path, optimized it, proved the speedup with a before/after number, and left behavior unchanged. **Or:** you measured, found no hot path worth acting on, and concluded — having changed nothing. Both are successes. The second is the *common* one.

This phase comes last by design. The recurring failure mode it corrects is reaching for speed too early — optimizing code that is about to be restructured, or that was never slow. Here, optimization is the reward earned after `work` and `right`, never the default move.

## Measure first — no number, no change

This is the hard rule of the phase:

- **You may not optimize without a before measurement.** "This looks slow" is not a justification. Measure the actual cost (timing, profile, query count, allocation — whatever fits) and establish a baseline number first.
- **No measured hot path → no change.** If nothing measures as a meaningful cost, the phase is over. Report "measured, no hot path, nothing to do" and stop. Do not invent optimizations to look productive. A no-op here is the expected result for most features.
- **Optimize only what you measured.** Act on the specific hot path the measurement found, not on adjacent code that "might also be slow."

## Permitted trade-off (with its receipt attached)

`right` made the code legible. `fast` is permitted to spend some of that legibility *back* for measured speed — caching, inlining, denormalizing, swapping a data structure. But the cost is not free:

- **The measurement must travel with the code.** Any optimization that reduces clarity must carry its before/after number as an inline comment justifying the ugliness. The next reader must see *why* this code is shaped the strange way it is.
- An optimization carrying that justification is **not** a quality defect — the final review gate honors it. An optimization *without* a measurement is a defect: it is just clever code with no evidence, and it should be reverted.

## Behavior must not change

Speed work is still behavior-preserving. The anchor checks are your regression net — run them before and after. If a speedup changes a result, it is a bug, not an optimization. If you cannot run the anchors, you cannot claim behavior is unchanged; stop and surface it.

## Resolve the fast-related ledger entries

Any ledger entries the `work` phase tagged as deferred optimizations are resolved here:

- **fixed** — measured, optimized, proven.
- **accepted: \<reason\>** — measured as not worth it, or worth it but deliberately deferred, with the reason recorded.

"Accepted: measured, below the threshold worth optimizing" is a perfectly good — and frequent — disposition.

## Gate to merge (fast → feature)

- Any change carries a before/after measurement (inline, next to the code it justifies).
- The anchors still pass — behavior unchanged, proven by running them.
- Deferred-optimization ledger entries are dispositioned.
- If there was no hot path: nothing merged, and that is recorded as the phase's outcome.
