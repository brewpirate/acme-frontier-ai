/**
 * Grep-gate for the un-lintable rules in `.claude/rules/`.
 *
 * Biome 2.4.14 doesn't ship `noTodoComments`, `useTsdoc`, or any rule that
 * recognises commented-out code, so the project rules around no-TODO,
 * no-`@ts-ignore`, and no-commented-out-code can't be lint-gated. This
 * scanner is the cheapest possible substitute: scan committed source for the
 * exact tokens we forbid, and fail the build if any are present.
 *
 * Tracked patterns:
 *
 * - `// TODO` / `// FIXME` / `// HACK` (and block-comment variants) — per
 *   `agent-discipline.md` "No TODOs in Delivered Code". If the work isn't
 *   done, file a follow-up issue, don't leave a breadcrumb.
 *
 * - `@ts-ignore` — per `typescript-patterns.md`. Use `@ts-expect-error` with
 *   a justification instead; that form fails the build when the underlying
 *   error is fixed, which is exactly the closure we want.
 *
 * Out of scope: commented-out code. The heuristic for "this comment is dead
 * code" (versus "this comment explains code") is too fuzzy to gate on. The
 * project rule remains review-only.
 *
 * Exit codes:
 *   0 — clean
 *   1 — at least one match (each match is printed with file:line)
 */

import { scanPackageSourceLines } from './lib/package-source-scan'

interface Pattern {
  label: string
  /** Regex compiled per-line. Match anywhere; report first match per line. */
  regex: RegExp
  /** Recommended replacement / action for the next contributor. */
  guidance: string
  /**
   * Optional file-path filter. If set, the pattern only fires on files
   * whose path matches this regex. Used for rules that only apply within
   * a single package's source (e.g. the `@/` alias rule in `dashboard/src/`).
   */
  appliesTo?: RegExp
}

const PATTERNS: Pattern[] = [
  {
    label: 'TODO/FIXME/HACK comment',
    // Three comment-marker forms:
    //   `// TODO`                  — single-line
    //   `/* TODO`                  — block-comment opener
    //   `^   * TODO`               — block-comment continuation (anchored to
    //                                start-of-line so `multiply * TODO` doesn't
    //                                false-positive)
    regex: /(?:^\s*\*|\/\/|\/\*)\s*(?:TODO|FIXME|HACK)\b/,
    guidance:
      'File a follow-up issue with the unfinished work. See agent-discipline.md.',
  },
  {
    label: '@ts-ignore directive',
    regex: /@ts-ignore\b/,
    guidance:
      'Use `@ts-expect-error <reason>` instead — it fails when the underlying error is fixed. See typescript-patterns.md.',
  },
  {
    label: 'cross-directory relative import in dashboard/src — use @/ alias',
    // Two forms covered:
    //   Single-line:  `import { X } from '../path'`  or  `import '../styles.css'`
    //   Multi-line continuation:  `} from '../path'`  (when the import statement
    //     spans multiple lines with each named symbol on its own line — Biome
    //     formats long named-import lists this way)
    // Same-directory `'./sibling'` is fine (only the `..` form is banned).
    regex: /^\s*(?:import\b[^'"]*|\}\s*from\s+)['"]\.\.\//,
    guidance:
      "Replace `../path/to/X` with `@/path/to/X`. The dashboard package configures the `@/` alias for `packages/dashboard/src/`. See imports-and-modules.md.",
    appliesTo: /^packages\/dashboard\/src\//,
  },
]

interface Match {
  file: string
  line: number
  text: string
  pattern: Pattern
}

async function scan(): Promise<Match[]> {
  const matches: Match[] = []
  // The file walk and skip filter live in the shared helper (see
  // package-source-scan.ts); this scanner supplies only the per-line check:
  // try each forbidden-token pattern, recording the first one that fires on
  // a line (`break` — one breadcrumb per line is enough to flag it).
  await scanPackageSourceLines((sourceLine) => {
    for (const pattern of PATTERNS) {
      if (pattern.appliesTo && !pattern.appliesTo.test(sourceLine.filePath))
        continue
      if (pattern.regex.test(sourceLine.text)) {
        matches.push({
          file: sourceLine.filePath,
          line: sourceLine.lineNumber,
          text: sourceLine.text.trim(),
          pattern,
        })
        break
      }
    }
  })
  return matches
}

/**
 * Detector entry point used by the {@link "./scan"} harness. Returns
 * a clean signal when no violations exist, or a formatted multi-line
 * report (pattern label → hit list → guidance, grouped) when they do.
 *
 * The report shape is intentionally per-detector (not unified across
 * scanners) — discipline groups by pattern label, which is the right
 * natural grouping for "show me all the TODO breadcrumbs."
 */
export async function run(): Promise<{ ok: boolean; report: string }> {
  const matches = await scan()
  if (matches.length === 0) return { ok: true, report: '' }

  const byLabel = new Map<string, Match[]>()
  for (const match of matches) {
    const bucket = byLabel.get(match.pattern.label) ?? []
    bucket.push(match)
    byLabel.set(match.pattern.label, bucket)
  }

  const lines: string[] = []
  for (const [label, hits] of byLabel) {
    const pattern = hits[0].pattern
    lines.push(
      `\x1b[33m[${hits.length} ${hits.length === 1 ? 'hit' : 'hits'}]\x1b[0m ${label}`,
    )
    for (const hit of hits.slice(0, 8)) {
      lines.push(`  ${hit.file}:${hit.line}  ${hit.text}`)
    }
    if (hits.length > 8) {
      lines.push(`  ... and ${hits.length - 8} more`)
    }
    lines.push(`  → ${pattern.guidance}`)
    lines.push('')
  }
  return { ok: false, report: lines.join('\n') }
}

if (import.meta.main) {
  const result = await run()
  if (result.ok) {
    console.log('\x1b[32mNo discipline violations.\x1b[0m')
  } else {
    process.stdout.write(result.report)
    process.exit(1)
  }
}
