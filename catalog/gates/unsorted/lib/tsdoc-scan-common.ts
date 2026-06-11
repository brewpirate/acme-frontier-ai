/**
 * Shared scan scaffold for the two TSDoc gates — {@link "../detect-tsdoc"}
 * (presence) and {@link "../detect-tsdoc-syntax"} (syntax). Both gates must
 * walk **exactly the same set of files** and agree on **what counts as a
 * documentable top-level declaration**, or they fall out of step: one would
 * require/validate docs on a file the other ignores. That shared knowledge
 * lived as a byte-identical copy in each scanner (flagged structural clones
 * `dup` between the two files); it now lives here once, so a change to the
 * scoped roots or the documentable-kind set lands in both gates at once.
 *
 * What stays in each scanner is the part that genuinely differs: the
 * per-file `scanFile` logic (presence checks the block *exists* and applies
 * required-doc carve-outs; syntax parses the block that exists and reports
 * malformed tag syntax). That difference is injected via the `scanFile`
 * callback passed to {@link scanTsdocScopedFiles}.
 */

import { Glob } from 'bun'
import * as ts from 'typescript'

// The scoped roots both TSDoc gates scan. Module-private on purpose: the only
// supported way to walk this set is {@link scanTsdocScopedFiles}, so neither
// gate can drift by reading a different glob/exclude list. Globs cover every
// package's `.ts`/`.tsx`; the excludes drop test files (docs there are not API
// surface), the generated TanStack route tree (framework-rewritten each
// build), and per-package `scripts/` (operator one-shots, not library API).
const INCLUDE_GLOBS = ['packages/**/*.ts', 'packages/**/*.tsx']
const EXCLUDE_SUBSTRINGS = [
  'node_modules',
  '/tests/',
  '.test.',
  'routeTree.gen.',
  '/scripts/',
]

/**
 * The set of top-level declaration kinds that carry a TSDoc block:
 * function, class, interface, type-alias, enum, namespace/module, and
 * variable-statement. Both gates check the same kinds — presence requires a
 * block on each, syntax validates the block each one has.
 */
export function isDocumentableDeclaration(node: ts.Node): boolean {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isClassDeclaration(node) ||
    ts.isInterfaceDeclaration(node) ||
    ts.isTypeAliasDeclaration(node) ||
    ts.isEnumDeclaration(node) ||
    ts.isModuleDeclaration(node) ||
    ts.isVariableStatement(node)
  )
}

/**
 * True when a raw leading-comment string is a TSDoc block — it opens with
 * `/**` but not `/***`. A regular `//` line comment or a single-asterisk
 * `/* … *​/` block is not a doc block, and `/***` (three or more asterisks) is
 * a banner comment the TSDoc convention does not treat as documentation. Both
 * gates use this exact predicate everywhere they sniff for a doc block, so the
 * "what counts as a doc block" decision is defined once.
 *
 * @param commentText - The raw comment text, including its delimiters, as
 *   sliced from the source by {@link ts.getLeadingCommentRanges}.
 */
export function isTsdocBlockComment(commentText: string): boolean {
  return commentText.startsWith('/**') && !commentText.startsWith('/***')
}

/**
 * Walk every file in the TSDoc-scoped roots (see the module header), reading
 * each one and folding the caller's per-file `scanFile` results into a single
 * flat list. This is the file-walk both gates share; the only thing that
 * differs between them — what to check inside each file — is the `scanFile`
 * callback, so the walk lives here and the check stays in each scanner.
 *
 * @typeParam HitType - The per-file result shape (each scanner's own `Hit`).
 * @param scanFile - Called once per in-scope file with its path and contents;
 *   returns that file's hits.
 * @returns Every file's hits, concatenated in scan order.
 */
export async function scanTsdocScopedFiles<HitType>(
  scanFile: (filePath: string, content: string) => HitType[],
): Promise<HitType[]> {
  const allHits: HitType[] = []
  for (const includeGlob of INCLUDE_GLOBS) {
    const glob = new Glob(includeGlob)
    for await (const filePath of glob.scan('.')) {
      let shouldSkip = false
      for (const exclude of EXCLUDE_SUBSTRINGS) {
        if (filePath.includes(exclude)) {
          shouldSkip = true
          break
        }
      }
      if (shouldSkip) continue
      const content = await Bun.file(filePath).text()
      allHits.push(...scanFile(filePath, content))
    }
  }
  return allHits
}
