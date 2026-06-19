# The Works

A standard operating procedure for converting rough intention into shipped code, in three sequential dispositions: **work**, then **right**, then **fast**. Each disposition is a distinct working posture with its own success criterion, its own permissions, and its own prohibitions. Applied in order, they yield code that runs, then code that reads, then code that performs — in that order, because the reverse order does not survive contact with reality.

## Premise

A working solution is not a finished one, and a fast solution built atop an unfinished one is a liability. The Works enforces the ordering Kent Beck described — make it work, make it right, make it fast — by treating each stage as a separate assignment rather than a single muddied pass.

The unit of work and the stage are deliberately decoupled. Several units may be carried through `work` before any are carried through `right`; duplication across a batch becomes visible only once the batch exists.

## The dispositions

- **work** — Reach a running result. Breadth over polish. Leave it rough; leave a re-runnable check that proves it runs; record every corner cut in the ledger. Refactoring and optimization are out of scope here, by design.
- **right** — Make it legible. Explicit authority to revise working code and to dissolve the boundaries the work phase improvised. Remove duplication across the batch. Resolve the ledger.
- **fast** — Now, and only now, make it perform — where measurement justifies it. Most features carry no measured hot path, in which case this disposition concludes immediately, having found nothing to do. That is a successful outcome, not a skipped one.
- **seal** — Record what was learned, return the procedure to readiness, and release the work.

## The ledger

Each unit of work leaves a record of the corners it cut: what was hacked, what duplication was left, what remains unverified. The `right` and `fast` dispositions consume that record and resolve every entry — fixed, or knowingly accepted with a stated reason. The procedure does not release work while the ledger holds unresolved entries.

The ledger exists because the discipline that governs human engineers — rework is expensive, so build it well the first time — does not govern automated ones. The ledger reintroduces the cost, on the record, where a later pass is obliged to meet it.

## Operation

The full procedure — branch topology, the graduated gate at each merge, and the artifacts each disposition produces — is specified in `rules/the-works-overview.md`. In brief: a tracking issue holds the specification; a feature branch carries a draft pull request; units of work are completed under `work` and merged into the feature branch; a single `right` pass reworks the batch; a single `fast` pass performs measured optimization; `seal` records the findings and releases the draft. Stage transitions are operator-directed.

## Self-contained

The Works depends on no other skill and on no other project's rules. It carries its own quality standard. This is deliberate: the procedure is intended to be installed, operated, and removed as a single unit.

## Status

Experiment. Most experiments at this facility do not survive contact with reality; their failures are retained and documented. The Works is an early-stage procedure under active revision. Findings logged.
