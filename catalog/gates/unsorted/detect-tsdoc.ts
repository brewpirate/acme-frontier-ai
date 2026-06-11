/**
 * TSDoc-presence scanner — closes the `hard-requirements.md` TSDoc gap
 * that Biome 2.4.14 leaves open (no `useTsdoc` rule; biome's GritQL
 * surface has no comment-trivia primitive). Flags top-level declarations
 * (function, class, interface, type-alias, enum, namespace/module,
 * variable-statement) — **exported AND non-exported** — that lack a
 * preceding `/** … *​/` block comment. Per `hard-requirements.md`, the
 * "WHY is non-obvious" judgment is gated mechanically: every top-level
 * declaration carries a TSDoc block, so a fresh agent never has to
 * reverse-engineer intent from the body.
 *
 * Why a TypeScript-compiler scanner instead of a GritQL plugin
 * (empirically verified on biome v2.4, not just doc-surveyed):
 *
 *   - `$fn <: not after  '/** $_ *​/'` — fires on documented AND
 *     undocumented functions. `after`/`before` match sibling AST
 *     nodes, NOT leading-trivia comments. Comment is attached as
 *     trivia inside the declaration's range, so the predicate
 *     doesn't see it.
 *   - `$fn <: not preceded_by '/** $_ *​/'` — silently no-op.
 *     `preceded_by` isn't a registered predicate in biome's GritQL
 *     subset; biome fails open rather than erroring.
 *   - `'/** $doc *​/ export function ...'` (positive doc-capture
 *     pattern) — silently no-op. The comment isn't part of the
 *     declaration's text in the CST that GritQL matches against.
 *   - `not $fn <: contains '/** $_ *​/'` — fires on both. `contains`
 *     checks the function body, not its surroundings.
 *
 * Conclusion: biome v2.4 GritQL cannot inspect leading comments,
 * either via positive doc-capture or via negative-predicate.
 * Trivia is unreachable. The TS compiler API exposes attached JSDoc
 * directly via `ts.getJSDocCommentsAndTags(node)`. Per the roadmap
 * (`docs/plans/grit-plugin-roadmap.md` §"Cross-cutting design notes"),
 * scripts/detect-*.ts and GritQL coexist — the scanner covers what
 * GritQL can't reach.
 *
 * Scope (first turn): `packages/core/src/**`, excluding tests and
 * `*.test.ts`. Per #282 Tier-1 plan: smallest cleanest package first;
 * widen via this scanner's `INCLUDE_GLOBS` once the package is clean.
 *
 * Allowlist (first turn):
 *
 *  - Re-exports (`export { X } from './…'`, `export * from './…'`) —
 *    the documentation lives at the source, not the re-export site.
 *    These don't carry an inner `declaration` node anyway, so the
 *    documentable-types check naturally skips them; listed here so
 *    future readers don't wonder why they aren't flagged.
 *
 *  - `.test.ts` files — test exports are scoped to the test file
 *    and never read as API surface.
 *
 *  - **Template-shape file carve-out for `packages/core/src/db/tables/**`:**
 *    each DB-table file follows a uniform 5-export template (row type,
 *    insert schema, update schema, CREATE DDL, INDEX DDL). Per-export
 *    TSDoc on this shape is forced signature-restate, which
 *    `hard-requirements.md` itself warns against ("explaining WHY/
 *    context, not restating the signature"). Instead, require ONE
 *    file-level `/** … *​/` packageDocumentation block at the top
 *    that explains the table's role; with that present, skip
 *    per-export checks within the file. Without it, fire once on
 *    line 1 of the file.
 *
 *  - **Zod-literal carve-out (universal — applies wherever the shape
 *    appears, not path-scoped):** two declaration shapes are
 *    self-documenting via the schema body and skipped per-export:
 *      (1) `const XSchema = z.object(…)` / `z.discriminatedUnion(…)` /
 *          `z.enum(…)` / `z.union(…)` / `z.tuple(…)` / `z.record(…)` /
 *          `z.array(…)` — field names ARE the documentation.
 *      (2) `type X = z.infer<typeof XSchema>` — pure derivation; prose
 *          here would just say "type inferred from XSchema" which is
 *          circular signature-restate.
 *    Originally restricted to `packages/core/src/schemas/**`, then
 *    widened once the same self-documenting property surfaced in
 *    `dashboard/src/lib/schemas.ts` and `server/lib/otlp.ts`.
 *
 *  - **hookFor-factory carve-out (universal):** `const useFoo =
 *    hookFor({queryKey, queryFn, staleTime, refetchInterval})` is a
 *    uniform template shape on the dashboard's TanStack Query hook
 *    factory; the factory call's field names describe each hook.
 *
 *  - **TanStack Router carve-out (universal):** `const Route =
 *    createFileRoute('/path')({ … })` and `const Route =
 *    createRootRoute({…})` — file path IS the URL, component IS the
 *    entry point. Non-`Route` exports in route files are still flagged.
 *
 *  - **Function overload signatures:** declarations without a body
 *    (the parser-recognised overload form) are skipped; only the
 *    implementation signature carries the canonical doc.
 *
 *  The `db/tables/**` carve-out above is the only path-scoped one.
 *  Outside `db/tables/**`, every top-level declaration — exported or
 *  not — is checked unless it matches one of the universal shapes above.
 *
 * Exit codes:
 *   0 — clean (no missing TSDoc)
 *   1 — at least one missing TSDoc (each printed file:line  name)
 */

import * as ts from 'typescript'
import { formatScannerReport } from './lib/scanner-report'
import {
  isDocumentableDeclaration,
  isTsdocBlockComment,
  scanTsdocScopedFiles,
} from './lib/tsdoc-scan-common'

interface Hit {
  file: string
  line: number
  column: number
  kind: string
  name: string
}

function hasExportModifier(node: ts.Node): boolean {
  // Modifiers live on the node's modifier list (TS 5+). The `ExportKeyword`
  // is the marker for `export function X` / `export class X` / etc. We treat
  // `export default` the same way — both surface API and both need docs.
  const modifiers = ts.canHaveModifiers(node)
    ? ts.getModifiers(node)
    : undefined
  if (!modifiers) return false
  for (const modifier of modifiers) {
    if (modifier.kind === ts.SyntaxKind.ExportKeyword) return true
  }
  return false
}

function getDeclarationName(node: ts.Node): string {
  // Each documentable kind exposes its name in a slightly different shape;
  // walk them explicitly rather than reaching for any-typed `node.name`.
  if (
    ts.isFunctionDeclaration(node) ||
    ts.isClassDeclaration(node) ||
    ts.isInterfaceDeclaration(node) ||
    ts.isTypeAliasDeclaration(node) ||
    ts.isEnumDeclaration(node)
  ) {
    return node.name?.getText() ?? '<anonymous>'
  }
  if (ts.isModuleDeclaration(node)) {
    return node.name.getText()
  }
  if (ts.isVariableStatement(node)) {
    const firstDeclarator = node.declarationList.declarations[0]
    if (firstDeclarator && ts.isIdentifier(firstDeclarator.name)) {
      return firstDeclarator.name.text
    }
    return '<destructured>'
  }
  return '<unknown>'
}

function getDeclarationKind(node: ts.Node): string {
  if (ts.isFunctionDeclaration(node)) return 'function'
  if (ts.isClassDeclaration(node)) return 'class'
  if (ts.isInterfaceDeclaration(node)) return 'interface'
  if (ts.isTypeAliasDeclaration(node)) return 'type'
  if (ts.isEnumDeclaration(node)) return 'enum'
  if (ts.isModuleDeclaration(node)) return 'namespace'
  if (ts.isVariableStatement(node)) return 'const'
  return 'declaration'
}

/**
 * Returns true when any leading comment range at `position` within
 * `sourceText` is a `/** … *​/` TSDoc block. Shared by {@link hasLeadingJSDoc}
 * (probing a declaration's own leading comments as a fallback) and
 * {@link hasFileLevelPackageDoc} (probing the file's first non-import
 * statement). Both walked `ts.getLeadingCommentRanges` and tested each range
 * with {@link isTsdocBlockComment} identically; centralising it keeps the
 * "what counts as a leading TSDoc block" decision in one place so the two
 * probes can never drift apart.
 *
 * @param sourceText - The full source text of the file being scanned.
 * @param position - The `getFullStart()` offset whose leading trivia to scan.
 */
function hasLeadingTsdocBlock(sourceText: string, position: number): boolean {
  const ranges = ts.getLeadingCommentRanges(sourceText, position) ?? []
  for (const range of ranges) {
    const commentText = sourceText.slice(range.pos, range.end)
    if (isTsdocBlockComment(commentText)) {
      return true
    }
  }
  return false
}

function hasLeadingJSDoc(node: ts.Node, sourceFile: ts.SourceFile): boolean {
  // ts.getJSDocCommentsAndTags returns the JSDoc nodes the parser already
  // attached to this declaration. A `/** … *​/` block immediately above the
  // declaration shows up here; a regular `//` comment or `/* … *​/` (single
  // asterisk) does not. This is exactly the presence check we want — the
  // rule is specifically about `/** */`, not arbitrary comments.
  //
  // VariableStatement is a special case: parsers historically attach JSDoc
  // to the VariableDeclaration inside, not the statement. Check both.
  const directJsDoc = ts.getJSDocCommentsAndTags(node)
  if (directJsDoc.length > 0) return true

  if (ts.isVariableStatement(node)) {
    for (const declarator of node.declarationList.declarations) {
      const declaratorJsDoc = ts.getJSDocCommentsAndTags(declarator)
      if (declaratorJsDoc.length > 0) return true
    }
  }

  // Final fallback: scan raw leading-comment ranges for a `/** */` block.
  // Some Bun-specific AST quirks (e.g. file-leading directives, decorators
  // above a class) can mask the attached JSDoc. The text scan never misses.
  const fullStart = node.getFullStart()
  const sourceText = sourceFile.getFullText()
  return hasLeadingTsdocBlock(sourceText, fullStart)
}

function isTemplateShapeDir(filePath: string): boolean {
  // The template-shape carve-out applies to directories where the file
  // is one of a family of files sharing a uniform export skeleton.
  // Today that's `packages/core/src/db/tables/**` — each file is one
  // DB table with row type + insert/update schemas + DDL constants.
  // The whole file's purpose is captured by a single file-level
  // packageDocumentation block; per-export TSDoc would be 5 lines of
  // signature-restate per file.
  //
  // `packages/core/src/schemas/**` uses a *different* carve-out shape
  // (per-export Zod-literal skip — see isSchemaLiteralExport) because
  // those files often mix schemas + inferred types + helper functions,
  // and only the schema-literal exports are self-documenting.
  return filePath.includes('packages/core/src/db/tables/')
}

function hasFileLevelPackageDoc(sourceFile: ts.SourceFile): boolean {
  // "File-level packageDocumentation" here means any leading `/** */`
  // block on the first non-import statement of the file. The existing
  // codebase convention (every `packages/core/src/db/tables/*.ts` file)
  // is to put one detailed `/** */` between the imports and the first
  // export, explaining the table's role — that IS the file-level doc
  // in spirit, and requiring agents to relocate it above the imports
  // would be mechanical busywork.
  //
  // If the file has no statements (or all statements are imports),
  // fall back to checking comments before the absolute file start.
  const sourceText = sourceFile.getFullText()
  let firstNonImport: ts.Statement | undefined
  for (const statement of sourceFile.statements) {
    if (
      ts.isImportDeclaration(statement) ||
      ts.isImportEqualsDeclaration(statement)
    ) {
      continue
    }
    firstNonImport = statement
    break
  }
  const probePosition = firstNonImport
    ? firstNonImport.getFullStart()
    : sourceFile.statements[0]?.getFullStart() ?? 0
  return hasLeadingTsdocBlock(sourceText, probePosition)
}

// The named-binding + call-expression initializer that the three const-export
// carve-out predicates below all need to extract before they can inspect the
// callee. `node` matched when it is a single-declarator `const <name> =
// <call>(...)` statement.
interface SingleConstCallExport {
  // The binding name — each predicate filters on it differently
  // (`Route` exactly, `use…` prefix, `…Schema` suffix).
  name: string
  // The call-expression initializer — each predicate then inspects this
  // callee (a bare identifier, or a `z.<method>` property access).
  callExpression: ts.CallExpression
}

/**
 * Structural prologue shared by {@link isTanstackRouteExport},
 * {@link isHookFactoryExport}, and {@link isSchemaLiteralExport}. Each of
 * those carve-outs first has to confirm the node is a single-declarator
 * `const <Name> = <someCall>(...)` statement and pull out the binding name +
 * call initializer before it can check its own specific callee shape. That
 * five-step AST guard was copy-pasted into all three; collapsing it here means
 * a change to how we recognise that shape (e.g. handling a future `using`
 * declaration, or multi-declarator statements) lands in exactly one place.
 *
 * @returns the binding name and call-expression initializer when `node` is a
 * single-declarator `const <name> = <call>(...)`, or `undefined` otherwise.
 */
function matchSingleConstCallExport(
  node: ts.Node,
): SingleConstCallExport | undefined {
  if (!ts.isVariableStatement(node)) return undefined
  const declarators = node.declarationList.declarations
  if (declarators.length !== 1) return undefined
  const declarator = declarators[0]
  if (!declarator || !ts.isIdentifier(declarator.name)) return undefined
  const initializer = declarator.initializer
  if (!initializer || !ts.isCallExpression(initializer)) return undefined
  return { name: declarator.name.text, callExpression: initializer }
}

function isTanstackRouteExport(node: ts.Node): boolean {
  // TanStack Router file-based-routing: every route file exports a
  // `const Route = createFileRoute('/path')({ component: ... })` and
  // the root file exports `const Route = createRootRoute({...})`. The
  // file path IS the URL, the component IS the entry point — TSDoc on
  // these would restate the file path. Carve out both shapes; any
  // non-Route export in a route file is still flagged.
  const match = matchSingleConstCallExport(node)
  if (match === undefined) return false
  if (match.name !== 'Route') return false
  const initializer = match.callExpression
  // Shape 1: `createRootRoute({...})` — single call on identifier.
  if (ts.isIdentifier(initializer.expression)) {
    return initializer.expression.text === 'createRootRoute'
  }
  // Shape 2: `createFileRoute('/path')({...})` — call on a call.
  if (ts.isCallExpression(initializer.expression)) {
    const callee = initializer.expression.expression
    if (!ts.isIdentifier(callee)) return false
    return callee.text === 'createFileRoute'
  }
  return false
}

function isHookFactoryExport(node: ts.Node): boolean {
  // Dashboard's `hookFor({queryKey, queryFn, staleTime, refetchInterval})`
  // factory: every `export const useFoo = hookFor({...})` is uniform
  // template shape. The TSDoc would restate the factory's own field
  // names (queryKey, queryFn, cache policy) — pure signature-restate.
  // The factory call IS the documentation; field names describe the
  // behavior. Custom-implemented hooks (arrow function body, not
  // hookFor) are still flagged because they encode non-uniform logic.
  const match = matchSingleConstCallExport(node)
  if (match === undefined) return false
  if (!match.name.startsWith('use')) return false
  const callee = match.callExpression.expression
  if (!ts.isIdentifier(callee)) return false
  return callee.text === 'hookFor'
}

function isOverloadSignature(node: ts.Node): boolean {
  // TypeScript function overloads: an `export function foo(): X` with no
  // body is an overload signature; only the LAST signature (the
  // implementation, which has a `body`) carries the canonical TSDoc.
  // Flagging each overload separately would force redundant docs and is
  // a false positive — the implementation signature's doc covers the
  // whole overload set.
  if (!ts.isFunctionDeclaration(node)) return false
  return node.body === undefined
}

function isInferredFromSchemaType(node: ts.Node): boolean {
  // Type aliases of the form `type X = z.infer<typeof YSchema>` are pure
  // derivations — the schema body IS the documentation. Adding prose here
  // would be circular ("type inferred from YSchema"). Same logic as
  // isSchemaLiteralExport but for type aliases instead of consts.
  if (!ts.isTypeAliasDeclaration(node)) return false
  const aliased = node.type
  if (!ts.isTypeReferenceNode(aliased)) return false
  const referenceName = aliased.typeName
  // Match `z.infer` — property access on identifier `z`.
  if (!ts.isQualifiedName(referenceName)) return false
  if (!ts.isIdentifier(referenceName.left)) return false
  if (referenceName.left.text !== 'z') return false
  if (referenceName.right.text !== 'infer') return false
  return true
}

function isSchemaLiteralExport(node: ts.Node): boolean {
  // The Zod-schema-literal carve-out — covers exports whose name ends
  // in `Schema` and whose initializer is one of the schema-constructor
  // call shapes (`z.object`, `z.discriminatedUnion`, `z.enum`,
  // `z.union`, `z.tuple`, `z.record`, `z.array`). The body of the
  // schema IS the documentation; field names are the API surface.
  const match = matchSingleConstCallExport(node)
  if (match === undefined) return false
  if (!match.name.endsWith('Schema')) return false
  const callee = match.callExpression.expression
  // Match `z.X(…)` — property access on identifier `z`.
  if (!ts.isPropertyAccessExpression(callee)) return false
  if (!ts.isIdentifier(callee.expression)) return false
  if (callee.expression.text !== 'z') return false
  const methodName = callee.name.text
  return (
    methodName === 'object' ||
    methodName === 'discriminatedUnion' ||
    methodName === 'enum' ||
    methodName === 'union' ||
    methodName === 'tuple' ||
    methodName === 'record' ||
    methodName === 'array'
  )
}

function scanFile(filePath: string, content: string): Hit[] {
  const hits: Hit[] = []
  // Parse `.tsx` files as JSX. Parsing them as plain TS misreads every
  // `<Component …>` as a comparison / type-argument, garbling the AST via
  // error-recovery — which can hoist a nested JSX-bearing `const` to
  // apparent top level and fire a false positive (the real declaration is
  // a function-body local the rule doesn't gate). Pick the ScriptKind from
  // the extension so the top-level walk sees the true statement list.
  const scriptKind = filePath.endsWith('.tsx')
    ? ts.ScriptKind.TSX
    : ts.ScriptKind.TS
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    scriptKind,
  )

  const isInTemplateShapeDir = isTemplateShapeDir(filePath)

  // Template-shape directories: require a single file-level
  // packageDocumentation block instead of per-export TSDoc. With the
  // file-level doc present, skip the per-export walk entirely.
  if (isInTemplateShapeDir) {
    if (hasFileLevelPackageDoc(sourceFile)) return hits
    hits.push({
      file: filePath,
      line: 1,
      column: 1,
      kind: 'file',
      name: '<file-level packageDocumentation>',
    })
    return hits
  }

  // Only walk top-level statements — nested declarations (a function inside
  // a function, a class member, etc.) are out of scope for this rule. The
  // hard-requirements.md TSDoc rule applies to ALL module-level declarations,
  // exported or not (the "WHY is non-obvious" judgment is gated mechanically).
  //
  // Overload signatures (`function foo(): X` declarations without a body)
  // are filtered via {@link isOverloadSignature} below — only the
  // implementation signature (the last in the overload set, with a body)
  // needs the canonical TSDoc.
  for (const statement of sourceFile.statements) {
    if (!isDocumentableDeclaration(statement)) continue
    // No export-modifier filter: per hard-requirements.md, the rule applies
    // to ALL top-level declarations, including module-internal helpers. The
    // "WHY is non-obvious" judgment is gated mechanically — every top-level
    // function/const/type carries a /** */ block so a fresh agent never has
    // to reverse-engineer intent from the body. {@link hasExportModifier}
    // is retained for potential future "exported only" reports but no longer
    // gates fires.
    if (isOverloadSignature(statement)) continue
    if (hasLeadingJSDoc(statement, sourceFile)) continue
    // Zod-schema-literal carve-out — applies universally, not path-scoped.
    // The structural check (`const XSchema = z.object(...)` or
    // `type X = z.infer<typeof Y>`) is principled wherever it appears:
    // the schema body IS the documentation. Originally restricted to
    // `packages/core/src/schemas/**`, widened to all paths once the
    // pattern showed up in `dashboard/src/lib/schemas.ts` and
    // `server/lib/otlp.ts` with the same self-documenting property.
    if (isSchemaLiteralExport(statement)) continue
    if (isInferredFromSchemaType(statement)) continue
    // hookFor-factory carve-out — uniform template shape on the
    // dashboard's TanStack Query hook factory. The factory call's
    // own field names (queryKey, queryFn, staleTime) describe each
    // hook completely; a TSDoc would restate them.
    if (isHookFactoryExport(statement)) continue
    if (isTanstackRouteExport(statement)) continue
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(
      statement.getStart(sourceFile),
    )
    hits.push({
      file: filePath,
      line: line + 1,
      column: character + 1,
      kind: getDeclarationKind(statement),
      name: getDeclarationName(statement),
    })
  }
  return hits
}

/**
 * Detector entry point used by the {@link "./scan"} harness. Same
 * shape as the other detect-*.ts modules — returns `{ok, report}`
 * rather than printing + exiting. Standalone-runnable via the
 * `if (import.meta.main)` block below for individual debugging.
 */
export async function run(): Promise<{ ok: boolean; report: string }> {
  const hits = await scanTsdocScopedFiles(scanFile)
  return formatScannerReport({
    hits,
    headerLabel: 'Top-level declaration missing /** */ block',
    formatHitDetail: (hit) => `${hit.kind} ${hit.name}`,
    footer:
      '  → Add a `/** … *​/` block explaining WHY/context (not signature). See hard-requirements.md TSDoc section.',
  })
}

if (import.meta.main) {
  const result = await run()
  if (result.ok) {
    console.log('\x1b[32mNo missing TSDoc on exported symbols.\x1b[0m')
  } else {
    process.stdout.write(result.report)
    if (!result.report.endsWith('\n')) process.stdout.write('\n')
    process.exit(1)
  }
}
