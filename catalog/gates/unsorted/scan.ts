/**
 * Scanner harness — single entry point for every `scripts/detect-*.ts`
 * gate in the repo. Aggregates per-detector results, prints each
 * detector's own formatted report only when that detector finds
 * violations, and exits non-zero if any detector reports issues.
 *
 * **Why this exists.** Before this harness, each scanner was its own
 * `main()` with its own pre-commit invocation and its own CI step.
 * Adding a fourth scanner (TSDoc-presence, #282 Tier-1 #1) surfaced
 * the cost: every scanner adds a new pre-commit line, a new CI step,
 * a new diagnostic format, and a new place to remember to add the
 * next one. This harness collapses all of that to one entry point;
 * future detectors slot in by appending to {@link DETECTORS}.
 *
 * **Individual detectors remain runnable directly** via their own
 * `if (import.meta.main)` block — preserves the debug ergonomic of
 * `bun scripts/detect-discipline.ts` when iterating on one detector.
 *
 * **Diagnostic format is per-detector, not unified.** Each detector
 * picks the natural grouping for its rule (label / pattern / directory
 * pair / declaration kind). Forcing a single shape would lose
 * information. The harness only orchestrates run order + aggregates
 * the exit code. See each detector's `run()` for its specific
 * report format — do not enumerate the formats here, that
 * enumeration drifts the moment a new detector lands.
 *
 * **Exit codes:**
 *   0 — all detectors clean
 *   1 — at least one detector reported violations
 *   2 — a detector threw an exception (configuration / engine error)
 */

import { run as runDiscipline } from './detect-discipline'
import { run as runDuplication } from './detect-duplication'
import { run as runFallow } from './detect-fallow'
import { run as runReactDoctor } from './detect-react-doctor'
import { run as runTsdoc } from './detect-tsdoc'
import { run as runTsdocSyntax } from './detect-tsdoc-syntax'

/**
 * A detector reports either a clean signal (`ok: true`, no report) or
 * a dirty signal with a pre-formatted report block to print verbatim.
 * The harness doesn't parse the report — each detector owns its
 * grouping and guidance text, since different rules have different
 * natural shapes (label / pattern / directory pair).
 */
export interface DetectorResult {
  ok: boolean
  /** Pre-formatted multi-line report. Empty when `ok` is true. */
  report: string
}

/**
 * A detector module exposes a name (for the harness header line) and
 * an async `run()` that returns its result. Future detectors slot in
 * by exporting a `run` function matching this contract and adding an
 * entry to {@link DETECTORS}.
 */
interface DetectorEntry {
  name: string
  describe: string
  run: () => Promise<DetectorResult>
}

/**
 * Active detectors run by `bun scripts/scan.ts`. Order: cheapest +
 * highest-signal first so a fast bail surfaces the most-common breakage.
 *
 * **What's NOT here:** `detect-orphan-duplicates.ts` is excluded
 * deliberately — it was never wired into pre-commit or CI before,
 * only run manually for ad-hoc directory-drift audits. Wiring it here
 * would silently flip a previously opt-in tool into a blocking gate
 * without an explicit ratchet decision. Add it in a dedicated PR
 * (with the scope sweep that would accompany any new ratchet), not
 * as a drive-by include here.
 */
const DETECTORS: readonly DetectorEntry[] = [
  {
    name: 'duplication',
    describe: 'Known-pattern duplication ratchet',
    run: runDuplication,
  },
  {
    name: 'discipline',
    describe: 'TODO/FIXME/HACK/@ts-ignore breadcrumbs',
    run: runDiscipline,
  },
  {
    name: 'tsdoc',
    describe: 'Exported declarations missing /** */ block',
    run: runTsdoc,
  },
  {
    name: 'tsdoc-syntax',
    describe: 'Existing /** */ blocks with malformed TSDoc syntax',
    run: runTsdocSyntax,
  },
  {
    name: 'react-doctor',
    describe: 'Dashboard frontend-quality score (≥97 floor)',
    run: runReactDoctor,
  },
  // Last on purpose: fallow-dupes shells out to a Rust subprocess, the most
  // expensive detector here. The cheap in-process grep/AST gates above run
  // first so their output leads, honouring the "cheapest first" ordering note
  // at the top of this list.
  {
    name: 'fallow-dupes',
    describe: 'Structural clone detection (fallow), fingerprint baseline',
    run: runFallow,
  },
]

async function main(): Promise<void> {
  let anyDirty = false
  for (const detector of DETECTORS) {
    process.stdout.write(`==> ${detector.name}: ${detector.describe}\n`)
    let result: DetectorResult
    try {
      result = await detector.run()
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error)
      console.error(
        `\x1b[31m[engine error] ${detector.name}: ${message}\x1b[0m`,
      )
      process.exit(2)
    }
    if (result.ok) {
      process.stdout.write(`    \x1b[32mclean\x1b[0m\n`)
    } else {
      anyDirty = true
      process.stdout.write('\n')
      process.stdout.write(result.report)
      if (!result.report.endsWith('\n')) process.stdout.write('\n')
    }
  }
  if (anyDirty) process.exit(1)
}

if (import.meta.main) {
  await main()
}
