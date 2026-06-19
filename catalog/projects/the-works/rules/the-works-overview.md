# The Works — Overview

This is the procedure. Read it before adopting any single phase posture. It defines what the phases are, how they relate to the unit of work, what artifacts move between them, and what gate guards each step. The individual phase rules (`the-works-phase-work.md`, `-right.md`, `-fast.md`, `-seal.md`) define each posture in detail; this file is the map they sit on.

The Works is **self-contained**. It does not invoke other skills and does not depend on other projects' rules. Where a quality standard is needed, the phase rules state it directly. Do not reach for an external rule file to fill a gap — if a standard is missing here, that is a defect in The Works, to be fixed here.

## Why the phases differ (the failure modes this targets)

A single rule set cannot govern all of building. The rules that let you *reach* a working result (explore, hack, get to green, do not polish) are the opposite of the rules that make code *right* (restructure, deduplicate, touch working code freely). Apply one set to both jobs and it is simultaneously too strict for the first and too loose for the second.

The Works fixes this by making the **phase a posture** — a lens with its own success criterion, permissions, and prohibitions — and loading exactly one posture at a time. Concretely, this is the answer to four recurring failure modes:

1. **Strict rules produce timid, narrow work.** The Works relaxes the gate during `work` so exploration is not strangled.
2. **Loose rules produce slop.** The Works tightens the gate during `right` so the slop is cleaned before it ships.
3. **Working code goes untouched** ("pre-existing", "out of scope"). The Works gives `right` *explicit authority* to revise working code — touching it is the job, not a transgression.
4. **Speed is preferred over solidity.** The Works makes `fast` the last, gated, usually-empty phase, so optimization is the reward earned after work and right — never the default move.

## Phase is decoupled from the unit of work

The unit of work (a sub-issue) and the phase (work / right / fast) are separate axes.

- Run **N** units through `work` first. Then run **one** `right` pass over the whole batch. Then **one** `fast` pass.
- Batching is deliberate: cross-cutting duplication is visible only once the batch exists in rough form. Reviewing five rough units together reveals the shared abstraction that reviewing them one at a time cannot. It also enforces the rule of three — do not abstract on the first occurrence; the batch manufactures the later occurrences before you commit to a shape.

## Branch topology

```
main
 └── feature/<name>              ← draft PR → main (the deliverable; flips to ready only at seal)
      ├── SPEC.md                 the contract (versioned, co-located)
      ├── <anchor tests>          the executable contract (work leaves >= 1 per unit)
      ├── .ledger/<unit>.md       corners-cut fragments (one file per unit; conflict-free)
      ├── work:  unit branch  → PR → feature/<name>   (operator implements each unit)
      ├── right: right/<name> → PR → feature/<name>   (the-works-right over the batch)
      └── fast:  fast/<name>  → PR → feature/<name>   (measured optimization; often a no-op)
```

The inner pull requests (unit → feature, right → feature, fast → feature) are internal churn. The outer draft PR (feature → main) is the deliverable; it flips from draft to ready only at `seal`.

## The gate gradient

Each merge is guarded by a *different* gate. The gate is relaxed early and strict late — on purpose.

| Merge | Gate |
|-------|------|
| unit → feature | **light** — does it run? Is there at least one re-runnable anchor check? Is a ledger fragment appended? |
| right → feature | **code-quality strict** — legible, deduplicated, no dead code; the ledger's disposition table is present; anchors still pass |
| fast → feature | **performance evidence** — a before/after measurement; anchors still pass |
| feature → main (flip draft to ready) | **full strict + behavior verification** — the one hard checkpoint; the operator runs The Works' own review checklist and exercises the affected paths |

The intentionally-rough feature branch is a feature, not a defect. Do not "helpfully" apply the strict gate to a `work`-phase merge — that re-strangles exploration (failure mode 1). The strictness arrives at `right`, on schedule.

**Optimizations carry their justification.** The `fast` phase may trade legibility for measured speed (caching, inlining, denormalizing). The final strict gate honors this: an optimization that carries its before/after measurement as an inline comment is not a quality defect. Flag an optimization only if it lacks that justifying measurement. (See `the-works-phase-fast.md`.)

## Artifacts

All three live on the feature branch, checked out together, so any phase agent has everything it needs in one place.

**SPEC.md** — the contract. What the feature must do and how to tell it is done. Written before `work` begins. Versioned, so intent drift is visible in git history. The tracking issue points at it; the issue body is a pointer and status board, never a second copy (two copies drift).

**Anchor tests** — the *executable* contract. The `work` phase must leave at least one re-runnable check per unit. Without it, "it works" is a claim, not evidence, and the later phases cannot prove "behavior unchanged." Anchors are deliberately cheap (see `the-works-phase-work.md` for the calibration) — a smoke check or single-path assertion, not a comprehensive suite.

**`.ledger/<unit>.md` fragments** — the debt handoff. One file per unit of work, named for the unit, so parallel work branches never conflict on a shared file. Each fragment records the corners that unit cut. Minimal format — a few bullets, no schema:

```markdown
# Ledger — <unit name / sub-issue ref>

- [ ] <corner cut>: <what was hacked / left rough / left unverified, and where>
- [ ] <duplication left>: <what repeats, and where the shared form should go>
- [ ] <optimization deferred>: <where, and the measurement that would justify acting>
```

## The ledger drains to land

The `.ledger/` directory is a live worklist. `right` and `fast` consume it and resolve every entry to one of two states:

- **fixed** — the corner was addressed.
- **accepted: \<reason\>** — the corner is knowingly shipped, with a stated reason. Allowed; debt is not forbidden, only *hidden* debt is.

`right`'s first required deliverable is a **disposition table**: every ledger entry mapped to `fixed` or `accepted: <reason>`. This is a required output, not an instruction to "read the ledger" — the output forces a read of every entry and makes the drain auditable.

**Empty (or fully-dispositioned) `.ledger/` is the landing gate.** The draft PR does not flip to ready while unresolved entries remain. Before an entry is cleared, `seal` harvests its learning into The Works' own docs and into the PR's Disposition field — so the record survives the cleanup.

This is the load-bearing mechanism. A human engineer leaves code rough safely because the same human remembers the corners cut. An automated engineer has no such memory across sessions; the ledger *is* that memory, and the guaranteed `right`/`fast` pass that drains it *is* the trusted downstream that makes leaving code rough safe.

## Transitions are operator-directed

Phase transitions are pulled by the operator, not detected automatically. The operator decides "all units are in — begin `right`," and "right has landed — begin `fast`." Automatic transition detection is out of scope; it is a graduation concern, not part of this experiment.

## Loading discipline

Read `the-works-overview.md` (this file) plus **exactly one** phase rule — the one for the disposition currently in effect. Do not load a second phase's rule; its permissions and prohibitions will contradict the active posture, which reintroduces the un-phased-rules failure mode this procedure exists to prevent. The mapping is in `rule-map.md`.
