/**
 * Structural duplicate-code gate, powered by `fallow` (https://docs.fallow.tools).
 *
 * **What this adds over `detect-duplication.ts`.** That sibling scanner is a
 * *pattern* ratchet: it greps for a hand-curated list of known inline
 * expressions (error coercion, config-path joins, raw SQL casts) and fails
 * when one appears in 3+ files. It only ever catches duplication someone
 * already wrote a regex for. This scanner is the *structural* complement: it
 * runs fallow's suffix-array clone detector over the whole tree and catches
 * copy-pasted **blocks** — runs of duplicated code — that no regex was ever
 * written for. The two are deliberately kept separate: pattern ratchet vs.
 * block detector, different failure modes, different fix advice.
 *
 * **Why a fingerprint baseline instead of fallow's own `--baseline`.** fallow
 * can save/compare a baseline, but its baseline keys clone groups by
 * `file:start-end` line ranges. Those ranges shift the moment you insert a
 * line anywhere above a clone, so an unrelated edit makes a grandfathered
 * clone look "new" — a false positive that would make the gate fight ordinary
 * work. fallow's per-group content fingerprint (`dup:<8hex>`), by contrast, is
 * derived from the normalised token stream and is stable across line shifts
 * (verified: shifting lines in a file left the intra-file clone's fingerprint
 * unchanged while its line range moved). So the ratchet here keys on
 * fingerprints, stored in {@link BASELINE_PATH}. The committed baseline file
 * *is* the gate state, exactly like `KNOWN_PATTERNS` is for the sibling
 * scanner — a clean tree with the baseline in place is the gate doing its job.
 *
 * **The ratchet only turns one way.** A clone group whose fingerprint is NOT
 * in the baseline is new duplication and fails the gate. A baseline
 * fingerprint that no longer appears in the tree (because you refactored the
 * clone away) is harmless dead weight — it does not fail anything. When you
 * legitimately need to accept new duplication, or you have removed some and
 * want to trim the baseline, regenerate it with `bun run dupes:baseline`
 * (which calls this file with `--update-baseline`) and commit the result.
 *
 * **Determinism.** fallow is pinned to an exact version in `package.json` and
 * its detection parameters are pinned in `.fallowrc.jsonc`. Both are required:
 * a fingerprint computed under different parameters or a different engine
 * version would not match the baseline. Do not loosen either without
 * regenerating the baseline.
 *
 * Usage:
 *   bun scripts/detect-fallow.ts                 # gate: fail on new clone groups
 *   bun scripts/detect-fallow.ts --update-baseline  # regenerate the baseline
 *
 * Exit codes (standalone):
 *   0 — no new duplication beyond the baseline (or baseline written)
 *   1 — at least one new clone group not present in the baseline
 *   (engine/config errors throw, which the scan harness maps to exit 2)
 */

// fallow ships a platform-specific Rust binary; after `bun install` the
// launcher lives at this path relative to the repo root. The scan harness and
// pre-commit both run from the repo root, matching the cwd assumption every
// sibling detector already makes (they glob against '.').
const FALLOW_BIN = 'node_modules/.bin/fallow'

// The committed ratchet state: a sorted list of accepted clone-group
// fingerprints. See the module header for why this, and not fallow's
// line-range baseline, is the source of truth.
const BASELINE_PATH = 'scripts/fallow-dupes-baseline.json'

// Report caps — a failing run lists the worst offenders, not an exhaustive
// dump, so the pre-commit / CI output stays readable. The full set is always
// available via `bun run dupes` (plain `fallow dupes`).
const MAX_GROUPS_IN_REPORT = 12
const MAX_INSTANCES_PER_GROUP = 6

/**
 * One occurrence of a duplicated block — a file and the inclusive line range
 * the clone spans within it.
 */
interface CloneInstance {
  file: string
  startLine: number
  endLine: number
}

/**
 * A clone group: the same code block ({@link CloneInstance | instances}) found
 * in two or more places, keyed by fallow's content {@link CloneGroup.fingerprint | fingerprint}.
 */
interface CloneGroup {
  fingerprint: string
  lineCount: number
  instances: CloneInstance[]
}

/**
 * Narrow an arbitrary parsed-JSON value to a string-keyed record, throwing a
 * descriptive error otherwise. Used to walk fallow's output without `any` and
 * without silently coercing a malformed shape into a misleading result.
 *
 * @param value - The value to narrow (typically a `JSON.parse` result).
 * @param context - Human-readable description of what was expected, for the error message.
 */
function asRecord(
  value: unknown,
  context: string,
): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`fallow output malformed: expected ${context} to be an object`)
  }
  return value as Record<string, unknown>
}

/**
 * Parse fallow's `dupes --format json` stdout into our internal clone-group
 * shape. fallow emits snake_case keys (`clone_groups`, `line_count`,
 * `start_line`); this is the single place that mapping happens, so the rest of
 * the file works in the repo's camelCase convention.
 *
 * Throws on any structural surprise rather than guessing — a parse failure
 * here means fallow changed its contract or errored, which the caller surfaces
 * as an engine error (harness exit 2) instead of a misleading "clean" result.
 */
function parseFallowOutput(raw: string): CloneGroup[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`fallow output was not valid JSON: ${message}`)
  }

  const root = asRecord(parsed, 'the top-level result')
  const rawGroups = root.clone_groups
  if (!Array.isArray(rawGroups)) {
    throw new Error('fallow output malformed: expected `clone_groups` to be an array')
  }

  const groups: CloneGroup[] = []
  for (const rawGroup of rawGroups) {
    const group = asRecord(rawGroup, 'a clone group')

    const fingerprint = group.fingerprint
    if (typeof fingerprint !== 'string') {
      throw new Error('fallow output malformed: a clone group is missing its string `fingerprint`')
    }

    const lineCount = typeof group.line_count === 'number' ? group.line_count : 0

    const rawInstances = group.instances
    if (!Array.isArray(rawInstances)) {
      throw new Error('fallow output malformed: a clone group has no `instances` array')
    }

    const instances: CloneInstance[] = []
    for (const rawInstance of rawInstances) {
      const instance = asRecord(rawInstance, 'a clone instance')
      const file = instance.file
      if (typeof file !== 'string') {
        throw new Error('fallow output malformed: a clone instance is missing its string `file`')
      }
      const startLine = typeof instance.start_line === 'number' ? instance.start_line : 0
      const endLine = typeof instance.end_line === 'number' ? instance.end_line : 0
      instances.push({ file, startLine, endLine })
    }

    groups.push({ fingerprint, lineCount, instances })
  }

  return groups
}

/**
 * Run the pinned local fallow binary in duplication mode and return the parsed
 * clone groups. Detection parameters come from `.fallowrc.jsonc` (auto-loaded
 * by fallow from the repo root), so this command line is intentionally minimal
 * — keeping the knobs in the config file is what lets the baseline stay
 * deterministic regardless of how the detector is invoked.
 *
 * Throws (rather than returning empty) on a missing binary or a non-zero exit,
 * so a broken install surfaces as an engine error instead of a false "clean".
 */
async function runFallowDupes(): Promise<CloneGroup[]> {
  // Explicit pipe types so `.stdout` / `.stderr` narrow to ReadableStream
  // (the default `Bun.Subprocess` generic leaves them as
  // `number | ReadableStream | undefined`, which `new Response(...)` rejects).
  // Generic order is <stdin, stdout, stderr>; stdin defaults to 'ignore'.
  let subprocess: Bun.Subprocess<'ignore', 'pipe', 'pipe'>
  try {
    subprocess = Bun.spawn([FALLOW_BIN, 'dupes', '--format', 'json', '--quiet'], {
      stdout: 'pipe',
      stderr: 'pipe',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(
      `could not launch fallow at ${FALLOW_BIN} (${message}). Run \`bun install\` to fetch the pinned binary.`,
    )
  }

  const stdout = await new Response(subprocess.stdout).text()
  const stderr = await new Response(subprocess.stderr).text()
  const exitCode = await subprocess.exited

  if (exitCode !== 0) {
    throw new Error(
      `fallow dupes exited ${exitCode}. stderr:\n${stderr.trim() || '(empty)'}`,
    )
  }

  return parseFallowOutput(stdout)
}

/**
 * Load the committed set of accepted fingerprints. A missing baseline is
 * treated as an engine error (not an empty set) — silently treating it as
 * empty would flag every existing clone as new and wedge the gate, hiding the
 * real problem (the baseline was never generated / got deleted).
 */
async function loadBaseline(): Promise<Set<string>> {
  const file = Bun.file(BASELINE_PATH)
  if (!(await file.exists())) {
    throw new Error(
      `baseline not found at ${BASELINE_PATH}. Generate it with \`bun run dupes:baseline\`.`,
    )
  }

  // Guard the parse so a corrupt baseline produces an actionable message
  // ("baseline malformed: ... not valid JSON") instead of a raw SyntaxError,
  // matching how parseFallowOutput() handles fallow's stdout.
  let parsed: unknown
  try {
    parsed = JSON.parse(await file.text())
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`baseline malformed: ${BASELINE_PATH} is not valid JSON: ${message}`)
  }

  const root = asRecord(parsed, 'the baseline file')
  const fingerprints = root.fingerprints
  if (!Array.isArray(fingerprints)) {
    throw new Error(`baseline malformed: expected \`fingerprints\` array in ${BASELINE_PATH}`)
  }

  const accepted = new Set<string>()
  for (const fingerprint of fingerprints) {
    if (typeof fingerprint !== 'string') {
      throw new Error(`baseline malformed: a fingerprint entry is not a string in ${BASELINE_PATH}`)
    }
    accepted.add(fingerprint)
  }
  return accepted
}

/**
 * Detector entry point used by the {@link "./scan"} harness. Runs fallow,
 * subtracts the committed baseline, and reports any clone group whose
 * fingerprint is new. Clean when every current clone group is already
 * grandfathered into the baseline.
 *
 * The report groups by clone group (the natural unit here — "this exact block
 * is now duplicated"), sorted largest-first so the most expensive copy-paste
 * leads.
 */
export async function run(): Promise<{ ok: boolean; report: string }> {
  const groups = await runFallowDupes()
  const baseline = await loadBaseline()

  const newGroups = groups
    .filter((group) => !baseline.has(group.fingerprint))
    .sort((first, second) => second.lineCount - first.lineCount)

  if (newGroups.length === 0) return { ok: true, report: '' }

  const lines: string[] = []
  lines.push(
    `\x1b[33m[${newGroups.length} new clone ${newGroups.length === 1 ? 'group' : 'groups'} not in baseline]\x1b[0m structural duplication`,
  )
  for (const group of newGroups.slice(0, MAX_GROUPS_IN_REPORT)) {
    lines.push(
      `  ${group.lineCount} lines  ${group.instances.length} instances  ${group.fingerprint}`,
    )
    for (const instance of group.instances.slice(0, MAX_INSTANCES_PER_GROUP)) {
      lines.push(`    ${instance.file}:${instance.startLine}-${instance.endLine}`)
    }
    if (group.instances.length > MAX_INSTANCES_PER_GROUP) {
      lines.push(`    ... and ${group.instances.length - MAX_INSTANCES_PER_GROUP} more instances`)
    }
  }
  if (newGroups.length > MAX_GROUPS_IN_REPORT) {
    lines.push(`  ... and ${newGroups.length - MAX_GROUPS_IN_REPORT} more new clone groups`)
  }
  lines.push('')
  lines.push(
    'Extract the duplicated block to a shared helper (see dry-and-reuse.md for where reuse lives).',
  )
  lines.push(
    'If the duplication is intentional and accepted, regenerate the baseline: `bun run dupes:baseline`.',
  )
  return { ok: false, report: lines.join('\n') }
}

/**
 * Regenerate {@link BASELINE_PATH} from the current tree. Writes a sorted,
 * de-duplicated list of every clone-group fingerprint fallow currently
 * reports. Sorting keeps the committed diff readable when the set changes.
 *
 * @returns The number of fingerprints written.
 */
async function updateBaseline(): Promise<number> {
  const groups = await runFallowDupes()
  const fingerprints = [...new Set(groups.map((group) => group.fingerprint))].sort()

  const contents = {
    description:
      'Accepted structural-duplication fingerprints for the fallow dupes gate. ' +
      'Generated by `bun run dupes:baseline` (scripts/detect-fallow.ts --update-baseline). ' +
      'Each entry is a fallow content fingerprint (dup:<8hex>) that is grandfathered in; ' +
      'a clone group whose fingerprint is absent here fails the gate. Do not hand-edit.',
    fingerprints,
  }
  await Bun.write(BASELINE_PATH, `${JSON.stringify(contents, null, 2)}\n`)
  return fingerprints.length
}

if (import.meta.main) {
  if (process.argv.includes('--update-baseline')) {
    const count = await updateBaseline()
    console.log(
      `\x1b[32mWrote ${count} fingerprints to ${BASELINE_PATH}.\x1b[0m`,
    )
  } else {
    const result = await run()
    if (result.ok) {
      console.log('\x1b[32mNo new structural duplication beyond baseline.\x1b[0m')
    } else {
      process.stdout.write(result.report)
      if (!result.report.endsWith('\n')) process.stdout.write('\n')
      process.exit(1)
    }
  }
}
