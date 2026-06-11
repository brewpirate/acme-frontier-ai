/**
 * Full-gate runner — single command that runs every check the
 * codebase requires to consider a change ready. Used as the canonical
 * "am I ready to push?" entry point for developers.
 *
 * **Current callers.** `bun scripts/gates.ts` is run by developers
 * directly. Pre-commit and CI still call individual stages today
 * (CI in particular benefits from the quality + test parallel split,
 * so wiring gates.ts there would serialize the parallelism). A
 * future PR may converge pre-commit onto this entry point; CI is
 * unlikely to, by design.
 *
 * **Why this exists.** Adding a new gate (a new scanner, a new lint
 * stage) previously meant teaching every caller — every developer's
 * pre-push routine, every contributor's mental checklist. This
 * script collapses the list to one entry point that developers can
 * trust to be complete; future gates slot in via the {@link GATES}
 * array and pick up every developer-side caller for free.
 *
 * **Layering.** `gates.ts` is one level above {@link "./scan"} —
 * `scan.ts` aggregates the detect-*.ts modules; `gates.ts` runs
 * `scan.ts` alongside the non-detector gates (biome lint, biome
 * format, tsc, knip, tests). Two-level decomposition keeps the
 * scanner family addressable on its own (`bun scripts/scan.ts`)
 * while still giving callers a one-line "run everything" affordance.
 *
 * **Order.** Cheap-first so a fast failure surfaces quickly:
 *   1. biome format (sub-second)
 *   2. biome lint (~3s)
 *   3. tsc check (~5-10s)
 *   4. knip (dead code; seconds)
 *   5. scan harness (scanners)
 *   6. tests (bun test; longest)
 *
 * **Exit codes:**
 *   0 — every gate passed
 *   non-zero — first failing gate's exit code, printed with the
 *   gate's name so callers know which gate to drill into
 */

interface Gate {
  name: string
  describe: string
  command: readonly string[]
}

const GATES: readonly Gate[] = [
  {
    name: 'format',
    describe: 'biome format (style consistency)',
    command: ['bun', 'run', 'format'],
  },
  {
    name: 'lint',
    describe: 'biome lint (rules + GritQL plugins)',
    command: ['bun', 'run', 'lint'],
  },
  {
    name: 'check',
    describe: 'tsc strict (5 tsconfigs)',
    command: ['bun', 'run', 'check'],
  },
  {
    name: 'knip',
    describe: 'dead-code detection',
    command: ['bun', 'run', 'knip:ci'],
  },
  {
    // Canonical detector list lives in scripts/scan.ts's DETECTORS
    // array. Do not enumerate detectors here — the enumeration drifted
    // three times across PR #304's review cycles before the prose was
    // rewritten not to enumerate at all.
    name: 'scan',
    describe: 'scanner harness (see scripts/scan.ts DETECTORS)',
    command: ['bun', 'scripts/scan.ts'],
  },
  {
    name: 'test',
    describe: 'bun test (full suite)',
    command: ['bun', 'test'],
  },
]

/**
 * Spawn one gate via `Bun.spawn` and resolve with its exit code.
 * `stdio: ['inherit', 'inherit', 'inherit']` passes the child's
 * tty straight to the parent terminal — gates like biome and tsc
 * produce colored output and progress that look right under inherit
 * but get mangled under pipe.
 *
 * Why `Bun.spawn` not `node:child_process.spawn`: the project's
 * subprocess primitive is Bun-native (`bun-native-apis.md`). Root
 * `scripts/` doesn't have `@magpie/core/fs` resolvable today, but
 * `Bun.spawn` is the direct Bun primitive and follows the same
 * runtime-swap-isolation principle the facade exists to encode.
 */
async function runGate(gate: Gate): Promise<number> {
  process.stdout.write(`\n==> ${gate.name}: ${gate.describe}\n`)
  const proc = Bun.spawn(gate.command as string[], {
    stdio: ['inherit', 'inherit', 'inherit'],
  })
  await proc.exited
  return proc.exitCode ?? 1
}

async function main(): Promise<void> {
  for (const gate of GATES) {
    const code = await runGate(gate)
    if (code !== 0) {
      process.stderr.write(
        `\n\x1b[31m[FAILED] gate "${gate.name}" exited ${code}\x1b[0m\n`,
      )
      process.exit(code)
    }
  }
  process.stdout.write(`\n\x1b[32mAll gates passed.\x1b[0m\n`)
}

if (import.meta.main) {
  await main()
}
