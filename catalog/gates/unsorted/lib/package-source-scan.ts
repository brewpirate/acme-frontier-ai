/**
 * Shared per-line source walk for the package-source grep gates —
 * {@link "../detect-discipline"} (forbidden tokens: TODO/FIXME/HACK,
 * `@ts-ignore`, cross-dir relative imports) and
 * {@link "../detect-duplication"} (repeated inline patterns). Both gates
 * sweep **exactly the same file set** — every `.ts`/`.tsx` under `packages/`,
 * minus the same four exemption classes — and differ only in what they test
 * each line against.
 *
 * Before this helper existed, the glob, the skip filter, the file read, and
 * the line split were copy-pasted between the two scanners (flagged as a
 * structural clone between `detect-discipline.ts` and `detect-duplication.ts`),
 * and the coupling was carried by a hand-written
 * `// same exemption as detect-duplication.ts` comment in the discipline
 * scanner. That comment was load-bearing: if the two skip filters ever
 * drifted, one gate would scan a file the other exempts, and a forbidden
 * token (or a duplicated pattern) could slip through whichever gate happened
 * to ignore its file. Centralising the walk here makes the coupling
 * structural instead of comment-enforced — change the exemption set once and
 * both gates move together.
 */

import { Glob } from 'bun'

// Both gates scan the same root: every TypeScript source file under the
// workspace packages. The exemptions below are the shared decision, not
// either gate's alone:
//   - node_modules        — third-party code we don't own
//   - `.test.` files      — test code is not the production surface either
//                           gate guards
//   - per-package scripts/ — tooling with its own env-var / console
//                            conventions (mirrored by the noConsole /
//                            noProcessEnv biome.json overrides), so neither
//                            gate should fire inside them, including on this
//                            very file
//   - `.gen.ts` / `.gen.tsx` — generated files (e.g. TanStack Router's
//                              routeTree.gen.ts) are rewritten on every
//                              build; flagging them is noise the next
//                              generation overwrites
const PACKAGE_SOURCE_GLOB = 'packages/**/*.{ts,tsx}'

/**
 * One source line handed to a scanner's per-line callback. The
 * `lineNumber` is 1-based so callers can report `file:line` directly with
 * no off-by-one adjustment, and `text` is the raw, untrimmed line so the
 * caller's regex sees leading indentation (each scanner trims only when it
 * stores the matched text for display).
 */
export interface SourceLine {
  filePath: string
  lineNumber: number
  text: string
}

/**
 * Walk every in-scope package-source line through {@link onLine}.
 *
 * Encapsulates the glob, the shared skip filter, the file read, and the
 * line split so that {@link "../detect-discipline"} and
 * {@link "../detect-duplication"} cannot drift on *which* lines they scan.
 * The callback decides what to test each line against; this function only
 * decides which lines exist. Files are visited in glob order, lines in file
 * order.
 *
 * @param onLine - Invoked once per non-exempt source line. Receives the
 *   1-based {@link SourceLine}; its return value is ignored — the callback
 *   accumulates into the caller's own match list.
 */
export async function scanPackageSourceLines(
  onLine: (sourceLine: SourceLine) => void,
): Promise<void> {
  const glob = new Glob(PACKAGE_SOURCE_GLOB)
  for await (const filePath of glob.scan('.')) {
    if (
      filePath.includes('node_modules') ||
      filePath.includes('.test.') ||
      filePath.includes('/scripts/') ||
      filePath.endsWith('.gen.ts') ||
      filePath.endsWith('.gen.tsx')
    )
      continue

    const content = await Bun.file(filePath).text()
    const lines = content.split('\n')
    for (let index = 0; index < lines.length; index++) {
      const text = lines[index]
      // `index < lines.length` already guarantees this element exists; the
      // guard is here only to narrow `string | undefined` to `string` for the
      // scripts tsconfig, which sets `noUncheckedIndexedAccess` (the package
      // tsconfigs that gate CI do not). The branch is therefore unreachable in
      // practice — it exists to satisfy the type-checker, not to handle data.
      if (text === undefined) continue
      onLine({
        filePath,
        lineNumber: index + 1,
        text,
      })
    }
  }
}
