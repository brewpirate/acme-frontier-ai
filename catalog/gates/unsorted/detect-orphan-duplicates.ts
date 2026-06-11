#!/usr/bin/env bun
/**
 * Orphaned-duplicate-source scanner.
 *
 * Detects the class of bug where one workspace package's source tree
 * contains a file with the same basename as a canonical implementation
 * in another workspace package, drifts silently, and still type-checks.
 * (Ported from a sister repo where this pattern caught a 364-LOC orphan
 * left behind after a package extraction.)
 *
 * ## What counts as a duplicate
 *
 * For each configured `{ a, b }` directory-pair, every basename that
 * appears in both directories is a candidate pair. A pair is an orphan
 * (flagged) unless **at least one side is a re-export shim** — a file
 * whose entire meaningful content is `export ... from '...'` statements
 * plus comments and blank lines. Shims are the intentional bridge
 * pattern between workspace packages and carry no implementation that
 * can drift.
 *
 * ## Exit codes
 *
 * - `0` — no orphan pairs detected
 * - `1` — one or more orphan pairs detected; each is printed with both
 *   paths, line counts, and the reason neither side classified as a shim
 *
 * ## Usage
 *
 *   bun scripts/detect-orphan-duplicates.ts
 *
 * Wire into `bun run check-all` so CI fails when a new orphan lands.
 *
 * @module Scripts/DetectOrphanDuplicates
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

/** Directory pairs to scan. Each pair's overlapping basenames are candidate orphans. */
export interface DirectoryPair {
  /** Absolute or repo-relative path to directory A. */
  a: string
  /** Absolute or repo-relative path to directory B. */
  b: string
  /** Human-readable label printed in the report (e.g. `@magpie/server ↔ @magpie/core`). */
  label: string
}

/**
 * Default pair set. Extend when a package extraction lands and one
 * side is expected to be deleted or shimmed.
 *
 * **No active pairs in magpie as of writing.** The four workspace
 * packages (`core`, `dashboard`, `server`, `zqlite`) have no in-flight
 * extraction — the canonical bridge between them is the `@magpie/core`
 * re-export pattern, which is shim-based and would be classified
 * correctly if any pair were added.
 *
 * Rule of thumb: a directory pair belongs here only when one side is
 * expected to be deleted or shimmed as part of a package extraction.
 * Coincidental basename collisions across unrelated packages (same
 * filename, different purposes) do **not** belong here — the scanner
 * has no way to tell them apart from drift orphans.
 */
export const DEFAULT_PAIRS: DirectoryPair[] = []

/**
 * A candidate pair — same basename appears under both directories.
 * Orphan status depends on whether either side is classified as a shim.
 */
export interface CandidatePair {
  basename: string
  pathA: string
  pathB: string
  aIsShim: boolean
  bIsShim: boolean
  aLines: number
  bLines: number
  label: string
}

/**
 * Classifies a `.ts` source as a re-export shim — a file whose every
 * meaningful line forwards an export from another module.
 *
 * Accepts (all meaningful lines are `export ... from '...'`):
 *   `export { foo } from './bar'`
 *   `export type { Foo } from './bar'`
 *   `export * from './bar'`
 *   Multi-line `export { A, B, C } from '...'` blocks
 *
 * Rejects anything with `import` statements, function/class/const
 * declarations, or any statement that isn't an export-from.
 *
 * A 30-LOC cap guards against pathological "all re-exports but huge"
 * files that happen to pass the line filter — such a file probably
 * hides aggregated logic the heuristic wasn't built for.
 */
export function isReExportShim(source: string): boolean {
  const MAX_LINES = 30
  // Strip single-line and multi-line comments before analysis.
  const stripped = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
  const meaningful = stripped
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  if (meaningful.length === 0) return false
  if (meaningful.length > MAX_LINES) return false

  // Join meaningful lines (multi-line `export { ... } from '...'` blocks
  // collapse naturally) and consume one export-from statement at a time
  // from the front. Anything remaining that doesn't match means the file
  // contains non-shim content — imports, declarations, expressions.
  let remaining = meaningful.join(' ').trim()
  const statementRe =
    /^export\s+(type\s+)?(\*|\{[^}]*\})\s+from\s+['"][^'"]+['"]\s*;?\s*/

  while (remaining.length > 0) {
    const match = remaining.match(statementRe)
    if (!match) return false
    remaining = remaining.slice(match[0].length).trim()
  }
  return true
}

/**
 * Counts non-blank lines in source. Used for the orphan report —
 * comparing 1-LOC shims to 300-LOC implementations is more informative
 * than raw file size.
 */
export function countMeaningfulLines(source: string): number {
  return source
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('//'))
    .length
}

/**
 * Lists `.ts` files (non-recursive) under `dir`. Returns basenames only.
 *
 * **Non-recursive by design** — current scanned pairs are flat
 * directories. If a future extraction nests sources (e.g. `workers/sub/foo.ts`),
 * this scanner will not see them and the guard silently stops covering
 * that subtree. Extend to walk recursively before adding any pair
 * whose sources live in nested directories.
 */
function listTsBasenames(dir: string): string[] {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return []
  }
  return entries.filter((name) => {
    if (!name.endsWith('.ts')) return false
    if (name.endsWith('.test.ts')) return false
    if (name.endsWith('.d.ts')) return false
    try {
      return statSync(join(dir, name)).isFile()
    } catch {
      return false
    }
  })
}

/**
 * Scans a single directory pair, returning every basename that exists
 * under both sides. Per-file shim classification is attached so callers
 * can print a full report; orphan-only filtering is the caller's job.
 */
export function findCandidatePairs(pair: DirectoryPair): CandidatePair[] {
  const basenamesA = new Set(listTsBasenames(pair.a))
  const basenamesB = new Set(listTsBasenames(pair.b))
  const overlap = [...basenamesA].filter((name) => basenamesB.has(name))

  return overlap.map((basename) => {
    const pathA = join(pair.a, basename)
    const pathB = join(pair.b, basename)
    const sourceA = readFileSync(pathA, 'utf-8')
    const sourceB = readFileSync(pathB, 'utf-8')
    return {
      basename,
      pathA,
      pathB,
      aIsShim: isReExportShim(sourceA),
      bIsShim: isReExportShim(sourceB),
      aLines: countMeaningfulLines(sourceA),
      bLines: countMeaningfulLines(sourceB),
      label: pair.label,
    }
  })
}

/**
 * Returns pairs where both sides contain real implementation (neither
 * is a shim). These are the drift vectors — the #205-class bugs.
 */
export function filterOrphans(candidates: CandidatePair[]): CandidatePair[] {
  return candidates.filter((c) => !c.aIsShim && !c.bIsShim)
}

/**
 * Top-level scan — runs every configured pair and returns all orphans
 * found across the whole repo.
 */
export function scanAllPairs(pairs: DirectoryPair[] = DEFAULT_PAIRS): {
  candidates: CandidatePair[]
  orphans: CandidatePair[]
} {
  const candidates = pairs.flatMap(findCandidatePairs)
  const orphans = filterOrphans(candidates)
  return { candidates, orphans }
}

/** Formats the report text printed to stderr when orphans are found. */
export function formatOrphanReport(orphans: CandidatePair[]): string {
  const header = `Found ${orphans.length} orphaned duplicate source pair${orphans.length === 1 ? '' : 's'}:\n`
  const body = orphans
    .map(
      (o, i) =>
        `  ${i + 1}. [${o.label}] ${o.basename}\n` +
        `     A: ${o.pathA}  (${o.aLines} meaningful lines, NOT a shim)\n` +
        `     B: ${o.pathB}  (${o.bLines} meaningful lines, NOT a shim)\n` +
        `     Neither side is a pure re-export shim — one is drifting against the other.\n` +
        `     Fix: delete the dead copy (see #205 for the pattern) OR convert one side to a\n` +
        `     re-export shim forwarding to the canonical version.`,
    )
    .join('\n\n')
  return header + body + '\n'
}

/**
 * Detector entry point used by the {@link "./scan"} harness. Returns
 * a clean signal when every overlapping-basename pair has at least
 * one re-export shim side, or a formatted report listing each drift
 * vector (both-sides-real cases) when violations exist.
 *
 * cwd-rebasing — the standalone CLI does `process.chdir` to the repo
 * root before scanning so paths are repo-relative regardless of where
 * the user invokes from. Inside the harness `run()`, the same chdir
 * happens so each detector is invoked from the same cwd the
 * standalone invocation would use. Idempotent — chdir-to-existing-cwd
 * is a no-op.
 */
export async function run(): Promise<{ ok: boolean; report: string }> {
  const root = resolve(import.meta.dir, '..')
  process.chdir(root)
  const { orphans } = scanAllPairs()
  if (orphans.length === 0) return { ok: true, report: '' }
  return { ok: false, report: formatOrphanReport(orphans) }
}

if (import.meta.main) {
  const root = resolve(import.meta.dir, '..')
  process.chdir(root)
  const { candidates, orphans } = scanAllPairs()

  if (orphans.length === 0) {
    const shimCount = candidates.filter((c) => c.aIsShim || c.bIsShim).length
    console.log(
      `✓ No orphaned duplicates found (${candidates.length} overlapping basename(s) examined, ${shimCount} accepted as shim-forwarded).`,
    )
    process.exit(0)
  }

  process.stderr.write(formatOrphanReport(orphans))
  process.exit(1)
}
