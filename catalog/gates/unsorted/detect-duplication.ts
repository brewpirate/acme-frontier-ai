/**
 * General-purpose inline duplication scanner.
 *
 * Usage:
 *   bun scripts/detect-duplication.ts 'err instanceof Error \? err\.message'
 *   bun scripts/detect-duplication.ts 'resolve\(\w+, config\.\w+\)'
 *   bun scripts/detect-duplication.ts                          # runs built-in known patterns
 *
 * Scans all `.ts`/`.tsx` files under `packages/` for a regex pattern and
 * reports occurrences grouped by file. Use this to confirm a suspected
 * duplication before extracting a helper.
 *
 * Patterns listed in {@link KNOWN_PATTERNS} are tracked for this repo;
 * each entry is a snapshot of a real consolidation opportunity. When you
 * remove an inline copy, *do not delete the entry* — leaving it in place
 * makes the scanner gate against the pattern's return.
 *
 * Exit codes:
 *   0 — no duplication above threshold
 *   1 — duplication found
 */

import { scanPackageSourceLines } from './lib/package-source-scan'

const THRESHOLD = 3

/**
 * Repo-specific repeated patterns worth extracting (or already extracted but
 * still proliferating inline). Each label is the helper name (current or
 * proposed); each pattern is the inline form to grep for.
 */
const KNOWN_PATTERNS: Array<{ label: string; pattern: string }> = [
  {
    label: 'inline error-message coercion — use errorMessage() from @magpie/core instead of inlining',
    pattern: 'instanceof\\s+Error\\s*\\?\\s*\\w+\\.message\\s*:\\s*String\\(\\w+\\)',
  },
  {
    label: "join(homedir(), '.claude', ...) — use config.* gateway instead",
    pattern: "join\\(homedir\\(\\)\\s*,\\s*['\"]\\.claude['\"]",
  },
  {
    label: 'resolve(cwd, config.*) — consider a path helper',
    pattern: 'resolve\\(\\w+,\\s*config\\.\\w+\\)',
  },
  {
    label:
      'raw SQL row cast — use zqlite defineQuery() with a result schema instead of `.all()/.get(...) as <Type>` (issue #236; also matches `Promise.all([...]) as T` — verify hits before consolidating)',
    pattern: '\\.(all|get)\\([^)]*\\)\\s*as\\s+[A-Z]',
  },
  {
    label:
      'timestamp Zod field — use z.iso.datetime() not z.string() or z.string().datetime() (issue #238)',
    pattern:
      '(_at|_ts|At|Ts|timestamp|started|ended|created|updated|fetched|modified|resets|seen):\\s*z\\.string\\(\\)(\\.datetime\\(\\))?',
  },
  {
    label:
      'inline range-preset literal union — use StandardRange / RangePreset / Exclude<RangePreset, …> from @magpie/core instead (see #316)',
    pattern: "'today'\\s*\\|\\s*'(24h|7d)'",
  },
]

interface Match {
  file: string
  line: number
  text: string
}

async function scanPattern(
  pattern: string,
  label?: string,
): Promise<{ label: string; matches: Match[]; fileCount: number }> {
  const regex = new RegExp(pattern, 'g')
  const displayLabel = label ?? pattern
  const matches: Match[] = []
  const files = new Set<string>()

  // The file walk and skip filter live in the shared helper (see
  // package-source-scan.ts); this scanner supplies only the per-line check:
  // test the one compiled pattern against each line. The regex carries the
  // `g` flag, so `lastIndex` must be reset after every `.test()` or the next
  // call would resume mid-string and miss leading matches.
  await scanPackageSourceLines((sourceLine) => {
    if (regex.test(sourceLine.text)) {
      matches.push({
        file: sourceLine.filePath,
        line: sourceLine.lineNumber,
        text: sourceLine.text.trim(),
      })
      files.add(sourceLine.filePath)
    }
    regex.lastIndex = 0
  })

  return { label: displayLabel, matches, fileCount: files.size }
}

/**
 * Detector entry point used by the {@link "./scan"} harness. Walks
 * every {@link KNOWN_PATTERNS} entry against the source tree and
 * reports any pattern appearing in {@link THRESHOLD} or more files.
 *
 * The harness invocation does NOT accept the `argv[2]` ad-hoc-pattern
 * override — that's a debug ergonomic available only when running the
 * file directly (`bun scripts/detect-duplication.ts <regex>`). Inside
 * a harness run the pattern set is exactly {@link KNOWN_PATTERNS}, so
 * the ratchet is deterministic across CI and pre-commit.
 */
export async function run(): Promise<{ ok: boolean; report: string }> {
  const lines: string[] = []
  let foundDuplication = false

  for (const { label, pattern } of KNOWN_PATTERNS) {
    const result = await scanPattern(pattern, label)
    if (result.fileCount < THRESHOLD) continue
    foundDuplication = true
    lines.push(
      `\x1b[33m[${result.matches.length} hits in ${result.fileCount} files]\x1b[0m ${result.label}`,
    )
    for (const match of result.matches.slice(0, 8)) {
      lines.push(`  ${match.file}:${match.line}  ${match.text}`)
    }
    if (result.matches.length > 8) {
      lines.push(`  ... and ${result.matches.length - 8} more`)
    }
    lines.push('')
  }
  if (!foundDuplication) return { ok: true, report: '' }
  lines.push(
    'Patterns appearing in 3+ files should be extracted to a shared helper.',
  )
  return { ok: false, report: lines.join('\n') }
}

if (import.meta.main) {
  const userPattern = process.argv[2]
  // Debug ergonomic: when invoked directly with a user pattern, run only
  // that one rather than the KNOWN_PATTERNS sweep. The harness path
  // never takes this branch — argv is empty there.
  if (userPattern !== undefined) {
    const result = await scanPattern(userPattern, userPattern)
    if (result.fileCount < THRESHOLD) {
      console.log('\x1b[32mNo duplication above threshold.\x1b[0m')
    } else {
      console.log(
        `\x1b[33m[${result.matches.length} hits in ${result.fileCount} files]\x1b[0m ${result.label}`,
      )
      for (const match of result.matches.slice(0, 8)) {
        console.log(`  ${match.file}:${match.line}  ${match.text}`)
      }
      if (result.matches.length > 8) {
        console.log(`  ... and ${result.matches.length - 8} more`)
      }
      process.exit(1)
    }
  } else {
    const result = await run()
    if (result.ok) {
      console.log('\x1b[32mNo duplication above threshold.\x1b[0m')
    } else {
      process.stdout.write(result.report)
      process.exit(1)
    }
  }
}
