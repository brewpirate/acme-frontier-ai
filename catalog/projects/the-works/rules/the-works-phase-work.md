# The Works — Phase: work

**The posture for this phase: reach a running result. Breadth over polish. Leave it rough — but leave it provable and on the record.**

Read `the-works-overview.md` for the procedure this sits in. Load only this phase rule while in `work`; the other phases' permissions will contradict this one.

## Success criterion

The unit of work runs and produces the intended result for representative input — and you have left behind a re-runnable check that proves it, plus a ledger fragment recording what you cut to get there. That is the entire bar. Not elegant. Not optimized. Not deduplicated. Running, proven, and honest about its debt.

## What you are permitted to do

This phase is deliberately permissive. The gate at `unit → feature` is light, so exploration is not strangled.

- Explore. Try the direct thing first. Hack a path to green.
- Hardcode, stub, and inline where it gets you running faster. These are corners — record them (below), do not agonize over them.
- Duplicate freely *within reason*. Cross-unit duplication is the `right` phase's problem to resolve once the whole batch exists; do not pre-optimize for an abstraction you cannot yet see.

## What you must leave behind (required outputs)

Both are mandatory. A unit without them does not pass the gate.

1. **At least one re-runnable anchor check** that exercises the path you built and asserts the intended result. This is the executable contract the later phases verify "behavior unchanged" against. Without it, "it works" is a claim, not evidence.

   **Calibrate it cheap.** A smoke check that runs the path, or a single-path assertion on the main case, is enough. A full characterization suite is **not** required and is the wrong investment here — an anchor that costs as much as the feature itself re-strangles the work (the failure mode this phase exists to avoid). The bar is "re-runnable proof the path runs", not "comprehensive coverage". Comprehensive coverage, if warranted, is a later concern.

2. **A ledger fragment** at `.ledger/<unit>.md` recording the corners you cut. One file per unit (never a shared file — parallel units would conflict). Minimal:

   ```markdown
   # Ledger — <unit name / sub-issue ref>

   - [ ] <corner cut>: <what was hacked / stubbed / left unverified, and where>
   - [ ] <duplication left>: <what repeats, and where the shared form likely belongs>
   - [ ] <optimization deferred>: <where, and what measurement would justify acting>
   ```

   This is what makes leaving code rough *safe*: the `right` and `fast` phases are guaranteed to consume this fragment and resolve every entry. Record honestly. A corner you hide is a corner no downstream pass will collect.

## Prohibitions (anti-goals for this phase)

- **Do not refactor beyond the unit.** Cleaning up neighboring code is the `right` phase's job. Stay on your unit.
- **Do not optimize for speed.** No caching, no clever data structures for performance. That is the `fast` phase, and it comes last for a reason.
- **Do not deduplicate across units.** You cannot see the batch yet. Premature abstraction on the first occurrence is its own defect.
- **Do not gold-plate.** Build only what the unit's acceptance requires. No extra options, no speculative flexibility, no observability the task did not ask for.
- **Do not over-gate yourself.** The rough-ness is intended. Do not hold the unit back for polish the `right` phase will do anyway.

## Gate to merge (unit → feature)

- The path runs for representative input.
- At least one re-runnable anchor check exists and passes.
- A `.ledger/<unit>.md` fragment is appended.

Run the project's own test/lint commands (per the repo `CLAUDE.md`) as a sanity check, but the merge bar here is the three items above — not the strict standard that arrives at `right`.
