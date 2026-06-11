/**
 * react-doctor — a frontend-quality MEASUREMENT scanner for the dashboard.
 *
 * `broken-windows.md` and `react-patterns.md` both cite a "react-doctor
 * score >= 97/100" CI gate, but no implementation ever existed behind that
 * number. This file is that implementation, and it is now the live gate:
 * `scripts/scan.ts` imports and runs it in pre-commit + CI, failing the
 * build when the composite drops below {@link TARGET_SCORE}.
 *
 * It was built measurement-first (owner's call): land the scanner, read the
 * REAL baseline score, clean the dashboard up to >= 97, and only THEN wire
 * it into the blocking harness — all of which happened in the same PR that
 * introduced this file. The worst-offender lists it still prints are how a
 * regression below the floor gets scoped back down.
 *
 * It scores four "frontend smell" signals over `packages/dashboard/src`,
 * combines them into a single weighted composite (0-100), and prints the
 * sub-scores plus per-signal worst offenders. The signals and their exact
 * match rules / exemptions:
 *
 *   1. Arbitrary Tailwind values (regex/line-based, `*.tsx`) —
 *      `<prefix>-[<value>]` utility tokens inside `className` string
 *      literals (e.g. `text-[10px]`, `bg-[#12121a]`). EXCLUDES Tailwind v4
 *      variant selectors (`data-[…]`, `group-[…]`, `…]:bg-card`) which are
 *      legitimate, not arbitrary-value smells.
 *
 *   2. Static inline styles (AST, `*.tsx`) — a `style={{ … }}` JSX attribute
 *      whose every object-property value is a static literal. EXEMPT when any
 *      value references an identifier / member-expression / template
 *      expression (those are genuinely dynamic and legitimate).
 *
 *   3. Boolean-prop proliferation (AST, `*.tsx`) — a component props type
 *      (a `*Props` interface/type alias, or an inline props object type on a
 *      function component) carrying >= 4 boolean members. One violation per
 *      such component; the smell is "this component should be split / take a
 *      variant enum instead of N independent flags".
 *
 *   4. Oversized component (line-based, `*.{ts,tsx}`) — a `.tsx` file whose
 *      line count exceeds 450. One violation per file.
 *
 * The composite is a RATE-based weighted average of the four sub-scores, so
 * a large codebase isn't punished for absolute counts — each signal is
 * normalised against a denominator that scales with the dashboard's size
 * (see {@link SubScore} and the weight constants below).
 *
 * Why a TypeScript-compiler scanner for signals 2 and 3: both are
 * parse-sensitive (a `style={{…}}` attribute's property values, a props
 * type's member types) and cannot be reliably matched with regex without
 * false positives on multi-line objects, string-literal lookalikes, and
 * nested generics. Signals 1 and 4 are purely lexical (a token shape in a
 * string, a line count) so a line/regex pass is correct and cheaper there.
 * This mirrors `scripts/detect-tsdoc.ts`, which uses the same
 * `import * as ts from 'typescript'` + `ts.createSourceFile` approach.
 *
 * Exit codes (standalone `bun run react-doctor` only — the `scripts/scan.ts`
 * harness consumes the `{ ok }` return value, not this process exit code):
 *   0 — composite score >= TARGET_SCORE
 *   1 — composite score <  TARGET_SCORE
 */

import { Glob } from 'bun'
import * as ts from 'typescript'

// ---------------------------------------------------------------------------
// Tunable thresholds and scoring weights — all named so the policy is
// visible at the top of the file, not buried as magic numbers in the math.
// ---------------------------------------------------------------------------

/**
 * The composite-score floor the dashboard must hold. Drives the standalone
 * `bun run react-doctor` exit code, and the harness `{ ok }` return when run
 * via `scripts/scan.ts` — so a composite below this fails pre-commit + CI.
 * Matches the number cited in `broken-windows.md` / `react-patterns.md`.
 */
const TARGET_SCORE = 97

/**
 * A `.tsx` file longer than this many lines counts as one oversized-component
 * violation (signal 4). 450 is the agreed split-threshold: above it a single
 * component file is hard for a fresh agent to hold in working memory.
 */
const OVERSIZED_COMPONENT_LINE_LIMIT = 450

/**
 * A props type with at least this many boolean members counts as one
 * boolean-prop-proliferation violation (signal 3). Four independent flags is
 * the point where a variant enum / discriminated union almost always reads
 * better than N booleans whose 2^N combinations are mostly nonsensical.
 */
const BOOLEAN_PROP_PROLIFERATION_THRESHOLD = 4

/**
 * Composite weights — how much each sub-score contributes to the final
 * 0-100 number. They sum to 1.0. Tailwind dominates because arbitrary
 * values are the most common and most mechanical smell to clean; size is
 * lightest because a few large files are a judgement call, not a defect.
 */
const TAILWIND_WEIGHT = 0.4
const STATIC_STYLE_WEIGHT = 0.25
const BOOLEAN_PROP_WEIGHT = 0.2
const OVERSIZED_COMPONENT_WEIGHT = 0.15

/**
 * How many worst-offender entries to print per signal in the report. Enough
 * to scope cleanup, not so many the report becomes a wall of text.
 */
const WORST_OFFENDER_LIMIT = 10

// The set of bracket prefixes that are Tailwind v4 VARIANT selectors, not
// arbitrary-value utilities. `data-[state=open]`, `group-[…]`, `aria-[…]`,
// `min-[700px]:` etc. are legitimate and must NOT be counted as violations.
// (Receipt: ~55 of the raw bracket-hits in the dashboard are `data-[…]`.)
const TAILWIND_VARIANT_PREFIXES: ReadonlySet<string> = new Set([
  'data',
  'group',
  'peer',
  'aria',
  'has',
  'supports',
  'min',
  'max',
])

// ---------------------------------------------------------------------------
// Hit shapes — one per signal. All carry enough to render the worst-offender
// list (file:line for tailwind/style, file for size, file:component for bool).
// ---------------------------------------------------------------------------

/** One arbitrary-Tailwind-value token occurrence (signal 1). */
interface TailwindHit {
  file: string
  line: number
  /** The offending token, e.g. `text-[10px]`, for the report. */
  token: string
}

/** One static inline-style attribute occurrence (signal 2). */
interface StaticStyleHit {
  file: string
  line: number
}

/** One boolean-prop-proliferation component occurrence (signal 3). */
interface BooleanPropHit {
  file: string
  line: number
  /** The props type / component name, e.g. `SheetProps`. */
  component: string
  /** How many boolean members it carries (>= the threshold). */
  booleanMemberCount: number
}

/** One oversized-component file occurrence (signal 4). */
interface OversizedComponentHit {
  file: string
  /** The file's total line count, for the report. */
  lineCount: number
}

/**
 * The full set of raw violations and the denominators each sub-score
 * normalises against. Kept as one struct so `run()` can compute every
 * sub-score and the composite from a single scan pass over the files.
 */
interface ScanResult {
  tailwindHits: TailwindHit[]
  staticStyleHits: StaticStyleHit[]
  booleanPropHits: BooleanPropHit[]
  oversizedComponentHits: OversizedComponentHit[]
  /** Total `className` occurrences in scope — the tailwind denominator. */
  classNameOccurrenceCount: number
  /** Total `*Props`-typed components in scope — the bool-prop denominator. */
  componentWithPropsTypeCount: number
  /** Total `.tsx` files in scope — the oversized-component denominator. */
  tsxFileCount: number
}

// ---------------------------------------------------------------------------
// Signal 1: arbitrary Tailwind values (line/regex-based).
// ---------------------------------------------------------------------------

// Matches a Tailwind utility token of the form `<prefix>-[<value>]` where
// <prefix> is a run of letters/digits/dashes (utility names like `grid-cols`,
// `bg`, `text`, `w`, `min-h`) and <value> is anything up to the closing
// bracket. Capturing groups:
//   1: the full token text (for the report and prefix/suffix checks)
//   2: the prefix segment immediately before `[` (for variant exclusion)
// This token shape only occurs in className strings in this codebase — but
// className strings are authored several ways (a `className="…"` literal, a
// `className={`…`}` template, and string literals passed to a className
// helper like `mergeClassNames('…', '…')` or returned from a ternary). Rather
// than enumerate every authoring shape, we scan ALL token occurrences in the
// file (after stripping comments — see {@link stripComments}), which captures
// every className authoring form uniformly. The only non-className place this
// token shape appears is prose inside comments (e.g. a TSDoc `e.g.
// \`h-[180px]\``), which the comment strip removes.
const ARBITRARY_TAILWIND_TOKEN = /((?:[\w-]*-)?([\w]+)-\[[^\]]*\])/g

// Counts `className` occurrences for the tailwind denominator. A plain
// keyword count is the right styling-site proxy — it measures how many JSX
// elements carry a className without trying to parse JSX.
const CLASSNAME_KEYWORD = /className/g

/**
 * Decide whether a matched `<prefix>-[…]` token is a legitimate Tailwind v4
 * variant selector (which we must NOT count) rather than an arbitrary-value
 * utility (which we do count).
 *
 * Two variant shapes are excluded:
 *   1. The segment immediately before `[` is a known variant keyword
 *      (`data`, `group`, `peer`, `aria`, `has`, `supports`, `min`, `max`) —
 *      e.g. `data-[state=open]`, `min-[700px]`.
 *   2. The `]` is immediately followed by `:` in the surrounding className
 *      text — e.g. `data-[state=open]:bg-card` — which marks the whole
 *      bracket as a variant modifier on the following utility.
 *
 * @param opts.fullToken - The matched token, e.g. `data-[state=open]`.
 * @param opts.prefixSegment - The capture group 2 (segment before `[`).
 * @param opts.followedByColon - Whether the `]` is immediately followed by a
 *   `:` in the original className string (a variant-modifier marker).
 */
function isTailwindVariantSelector(opts: {
  fullToken: string
  prefixSegment: string
  followedByColon: boolean
}): boolean {
  const { prefixSegment, followedByColon } = opts
  if (followedByColon) return true
  if (TAILWIND_VARIANT_PREFIXES.has(prefixSegment)) return true
  return false
}

/**
 * Translate a 0-based character offset in the file text to a 1-based line
 * number, by counting newlines up to that offset. Used so a token found in a
 * (possibly multi-line) className literal reports the line it actually sits
 * on, not the line the `className=` started on.
 *
 * @param opts.fileText - The full file text.
 * @param opts.offset - 0-based character offset of the token.
 * @returns The 1-based line number.
 */
function offsetToLineNumber(opts: {
  fileText: string
  offset: number
}): number {
  const { fileText, offset } = opts
  let lineNumber = 1
  for (let index = 0; index < offset && index < fileText.length; index++) {
    if (fileText.charAt(index) === '\n') {
      lineNumber = lineNumber + 1
    }
  }
  return lineNumber
}

/**
 * Replace the bodies of `//` line comments and `/* … *​/` block comments with
 * spaces, preserving every newline and the overall character offsets so that
 * {@link offsetToLineNumber} still reports correct line numbers on the result.
 *
 * Why strip comments before the token scan: the arbitrary-value token shape
 * (`prefix-[value]`) appears in real classNames AND, occasionally, in prose
 * examples inside comments (e.g. a TSDoc `e.g. \`h-[180px]\``, or a `//`
 * comment mentioning `grid-cols-[max-content_1fr]`). Those prose mentions are
 * NOT styling violations — they're documentation. Blanking comment bodies
 * (while keeping offsets stable) removes them from the token scan without
 * disturbing line attribution for the real tokens that remain.
 *
 * This is a deliberately simple lexer: it does NOT try to honour comment-like
 * sequences inside string literals (e.g. a `//` inside a URL string). In this
 * dashboard's `.tsx` files that hasn't produced a miscount, and the cost of a
 * full tokenizer isn't warranted for a measurement tool. If a future file
 * breaks this assumption, the fix is to switch this strip to an AST-driven
 * comment-range blank using `ts.getLeadingCommentRanges`.
 *
 * @param fileText - The full file text.
 * @returns The text with comment bodies blanked, same length, same newlines.
 */
function stripComments(fileText: string): string {
  const characters = fileText.split('')
  let index = 0
  while (index < characters.length) {
    const current = characters[index]
    const next = characters[index + 1]
    // Line comment `// … <newline>`: blank through end of line.
    if (current === '/' && next === '/') {
      while (index < characters.length && characters[index] !== '\n') {
        characters[index] = ' '
        index = index + 1
      }
      continue
    }
    // Block comment `/* … *​/`: blank through the closing `*​/`, keeping
    // newlines intact so line numbers don't shift.
    if (current === '/' && next === '*') {
      characters[index] = ' '
      characters[index + 1] = ' '
      index = index + 2
      while (index < characters.length) {
        const blockChar = characters[index]
        const blockNext = characters[index + 1]
        if (blockChar === '*' && blockNext === '/') {
          characters[index] = ' '
          characters[index + 1] = ' '
          index = index + 2
          break
        }
        // Preserve newlines so offset→line mapping stays correct.
        if (blockChar !== '\n') {
          characters[index] = ' '
        }
        index = index + 1
      }
      continue
    }
    index = index + 1
  }
  return characters.join('')
}

/**
 * Scan a whole `.tsx` file for arbitrary-Tailwind-value tokens, appending one
 * {@link TailwindHit} per violating token. Comments are blanked first (see
 * {@link stripComments}) so prose examples don't count; the remaining tokens
 * are all real className arbitrary values, whatever authoring shape produced
 * them (`className="…"`, a `className={`…`}` template, or string literals
 * inside a `mergeClassNames(…)` / ternary). Variant selectors are filtered
 * via {@link isTailwindVariantSelector}.
 *
 * @param opts.filePath - Source file path, for the hit's `file` field.
 * @param opts.fileText - The full file text to scan.
 * @param opts.hits - Accumulator the violations are pushed into.
 */
function scanFileForArbitraryTailwind(opts: {
  filePath: string
  fileText: string
  hits: TailwindHit[]
}): void {
  const { filePath, fileText, hits } = opts
  // Blank comment bodies, keeping offsets/newlines stable for line attribution.
  const codeOnlyText = stripComments(fileText)
  // Re-create the token matcher per call so its lastIndex starts clean.
  const tokenMatcher = new RegExp(
    ARBITRARY_TAILWIND_TOKEN.source,
    ARBITRARY_TAILWIND_TOKEN.flags,
  )
  let tokenMatch: RegExpExecArray | null = tokenMatcher.exec(codeOnlyText)
  while (tokenMatch !== null) {
    const fullToken = tokenMatch[1] ?? ''
    const prefixSegment = tokenMatch[2] ?? ''
    // Look at the character right after this token's `]` to detect the `…]:`
    // variant-modifier shape (`data-[state=open]:bg-card`).
    const tokenEndIndex = tokenMatch.index + tokenMatch[0].length
    const charAfterToken = codeOnlyText.charAt(tokenEndIndex)
    const followedByColon = charAfterToken === ':'
    const isVariant = isTailwindVariantSelector({
      fullToken,
      prefixSegment,
      followedByColon,
    })
    if (!isVariant) {
      const lineNumber = offsetToLineNumber({
        fileText,
        offset: tokenMatch.index,
      })
      hits.push({ file: filePath, line: lineNumber, token: fullToken })
    }
    tokenMatch = tokenMatcher.exec(codeOnlyText)
  }
}

/**
 * Count `className` occurrences across a whole file's text — the tailwind
 * sub-score's denominator. A simple keyword count is the right proxy: it
 * measures "styling sites" without trying to parse JSX.
 *
 * @param fileText - The full file text.
 * @returns The number of `className` occurrences in the file.
 */
function countClassNameOccurrences(fileText: string): number {
  const matcher = new RegExp(CLASSNAME_KEYWORD.source, CLASSNAME_KEYWORD.flags)
  let count = 0
  while (matcher.exec(fileText) !== null) {
    count = count + 1
  }
  return count
}

// ---------------------------------------------------------------------------
// Signal 2: static inline styles (AST-based).
// ---------------------------------------------------------------------------

/**
 * Decide whether a single `style={{ … }}` object-property value is a STATIC
 * literal (string / number / unary-minus number). Anything referencing an
 * identifier, a member expression, a template expression, a call, etc. is
 * treated as dynamic and therefore legitimate.
 *
 * @param valueExpression - The property's value expression node.
 * @returns true if the value is a static literal, false if dynamic.
 */
function isStaticStyleValue(valueExpression: ts.Expression): boolean {
  // Plain string and numeric literals: `'8px'`, `12`.
  if (ts.isStringLiteral(valueExpression)) return true
  if (ts.isNumericLiteral(valueExpression)) return true
  // No-substitution template (`\`8px\``) with no `${}` is still static.
  if (ts.isNoSubstitutionTemplateLiteral(valueExpression)) return true
  // Unary minus / plus on a numeric literal: `-1`, `+2`.
  if (ts.isPrefixUnaryExpression(valueExpression)) {
    return ts.isNumericLiteral(valueExpression.operand)
  }
  return false
}

/**
 * Walk a `style={{ … }}` ObjectLiteralExpression and decide whether the whole
 * attribute is a static-style violation. It's a violation only if the object
 * has at least one property AND every property is a plain `key: <staticValue>`
 * shape. The presence of ANY dynamic value (identifier, member access,
 * template with `${}`), spread, shorthand, or computed property makes the
 * whole attribute legitimate (it's doing real dynamic styling).
 *
 * @param objectLiteral - The `{{ … }}` object literal node.
 * @returns true if the attribute is an all-static style violation.
 */
function isStaticStyleObject(
  objectLiteral: ts.ObjectLiteralExpression,
): boolean {
  if (objectLiteral.properties.length === 0) return false
  for (const property of objectLiteral.properties) {
    // Only the plain `key: value` shape can be "all static". A spread
    // (`...base`) or shorthand (`{ color }`) pulls in an outer binding, which
    // is dynamic by definition — so the attribute is legitimate, not static.
    if (!ts.isPropertyAssignment(property)) return false
    if (!isStaticStyleValue(property.initializer)) return false
  }
  return true
}

/**
 * Walk a parsed `.tsx` source file's AST for `style={{ … }}` JSX attributes
 * whose object is entirely static literals, appending one
 * {@link StaticStyleHit} per violation. Uses {@link isStaticStyleObject} for
 * the static/dynamic decision.
 *
 * @param opts.filePath - Source file path, for the hit's `file` field.
 * @param opts.sourceFile - The parsed source file.
 * @param opts.hits - Accumulator the violations are pushed into.
 */
function scanSourceForStaticStyles(opts: {
  filePath: string
  sourceFile: ts.SourceFile
  hits: StaticStyleHit[]
}): void {
  const { filePath, sourceFile, hits } = opts
  function visit(node: ts.Node): void {
    if (ts.isJsxAttribute(node) && node.name.getText(sourceFile) === 'style') {
      const initializer = node.initializer
      // `style={ … }` — the initializer is a JsxExpression wrapping the
      // object literal. `style="…"` (a plain string) is never a `{{}}`
      // inline-style object, so it's not in scope.
      if (initializer && ts.isJsxExpression(initializer)) {
        const inner = initializer.expression
        if (inner && ts.isObjectLiteralExpression(inner)) {
          if (isStaticStyleObject(inner)) {
            const { line } = sourceFile.getLineAndCharacterOfPosition(
              node.getStart(sourceFile),
            )
            hits.push({ file: filePath, line: line + 1 })
          }
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
}

// ---------------------------------------------------------------------------
// Signal 3: boolean-prop proliferation (AST-based).
// ---------------------------------------------------------------------------

/**
 * Decide whether a type node denotes `boolean` or `boolean | undefined`
 * (the optional form). We count both because an optional boolean flag
 * (`isOpen?: boolean`) is exactly the proliferation smell — the `?` doesn't
 * change that it's a boolean toggle.
 *
 * @param typeNode - The member's declared type node (may be undefined).
 * @returns true if the type is boolean or boolean | undefined.
 */
function isBooleanTypeNode(typeNode: ts.TypeNode | undefined): boolean {
  if (typeNode === undefined) return false
  if (typeNode.kind === ts.SyntaxKind.BooleanKeyword) return true
  // `boolean | undefined`: a union where every member is boolean/undefined
  // and at least one is boolean. This catches the explicit optional form.
  if (ts.isUnionTypeNode(typeNode)) {
    let hasBoolean = false
    for (const memberType of typeNode.types) {
      if (memberType.kind === ts.SyntaxKind.BooleanKeyword) {
        hasBoolean = true
        continue
      }
      if (memberType.kind === ts.SyntaxKind.UndefinedKeyword) {
        continue
      }
      // Any other union member means this isn't a plain boolean toggle.
      return false
    }
    return hasBoolean
  }
  return false
}

/**
 * Count the boolean-typed members in a type's member list (interface body or
 * type-literal body). Only `name: <type>` property signatures are counted;
 * method signatures, index signatures, and call signatures are not props.
 *
 * @param members - The type's member list.
 * @returns The number of boolean-typed property members.
 */
function countBooleanMembers(
  members: ts.NodeArray<ts.TypeElement>,
): number {
  let booleanCount = 0
  for (const member of members) {
    if (!ts.isPropertySignature(member)) continue
    if (isBooleanTypeNode(member.type)) {
      booleanCount = booleanCount + 1
    }
  }
  return booleanCount
}

/**
 * Walk a parsed `.tsx` source file for component props types carrying >=
 * {@link BOOLEAN_PROP_PROLIFERATION_THRESHOLD} boolean members. Two shapes
 * are recognised as "a component props type":
 *
 *   1. A named `interface XProps {…}` or `type XProps = {…}` declaration whose
 *      name ends in `Props`.
 *   2. An inline props object type on a function parameter, i.e.
 *      `function Foo(props: { … }: { booleanA: boolean; … })` — the anonymous
 *      type literal annotating a component's single props parameter.
 *
 * For shape 2 we don't have a `*Props` name to key on, so we additionally
 * require the type literal to be the type of a function/arrow parameter (a
 * props-position type literal) before counting it. Each qualifying component
 * yields at most one {@link BooleanPropHit}.
 *
 * @param opts.filePath - Source file path, for the hit's `file` field.
 * @param opts.sourceFile - The parsed source file.
 * @param opts.hits - Accumulator the violations are pushed into.
 * @param opts.propsTypeNames - Accumulator of every `*Props` type name seen,
 *   used to compute the bool-prop sub-score denominator.
 */
function scanSourceForBooleanProps(opts: {
  filePath: string
  sourceFile: ts.SourceFile
  hits: BooleanPropHit[]
  propsTypeNames: Set<string>
}): void {
  const { filePath, sourceFile, hits, propsTypeNames } = opts

  /** Record a violation for a component whose props type is over threshold. */
  function recordIfOverThreshold(opts2: {
    members: ts.NodeArray<ts.TypeElement>
    componentName: string
    node: ts.Node
  }): void {
    const booleanCount = countBooleanMembers(opts2.members)
    if (booleanCount >= BOOLEAN_PROP_PROLIFERATION_THRESHOLD) {
      const { line } = sourceFile.getLineAndCharacterOfPosition(
        opts2.node.getStart(sourceFile),
      )
      hits.push({
        file: filePath,
        line: line + 1,
        component: opts2.componentName,
        booleanMemberCount: booleanCount,
      })
    }
  }

  function visit(node: ts.Node): void {
    // Shape 1a: `interface XProps { … }`.
    if (ts.isInterfaceDeclaration(node)) {
      const typeName = node.name.text
      if (typeName.endsWith('Props')) {
        propsTypeNames.add(`${filePath}:${typeName}`)
        recordIfOverThreshold({
          members: node.members,
          componentName: typeName,
          node,
        })
      }
    }
    // Shape 1b: `type XProps = { … }`.
    if (ts.isTypeAliasDeclaration(node)) {
      const typeName = node.name.text
      if (typeName.endsWith('Props') && ts.isTypeLiteralNode(node.type)) {
        propsTypeNames.add(`${filePath}:${typeName}`)
        recordIfOverThreshold({
          members: node.type.members,
          componentName: typeName,
          node,
        })
      }
    }
    // Shape 2: inline props object type on a function/arrow parameter, e.g.
    // `function Banner(props: { isOpen: boolean; … })`. We only treat the
    // FIRST parameter's type literal as a props type (React components take a
    // single props object), and we don't count it toward the `*Props`
    // denominator (it has no `*Props` name) — but it can still be a violation.
    if (ts.isFunctionDeclaration(node) || ts.isArrowFunction(node)) {
      const firstParameter = node.parameters[0]
      if (
        firstParameter &&
        firstParameter.type &&
        ts.isTypeLiteralNode(firstParameter.type)
      ) {
        const componentName = ts.isFunctionDeclaration(node)
          ? node.name?.text ?? '<anonymous>'
          : '<inline-props>'
        recordIfOverThreshold({
          members: firstParameter.type.members,
          componentName,
          node,
        })
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
}

// ---------------------------------------------------------------------------
// Sub-score + composite math.
// ---------------------------------------------------------------------------

/** A single signal's normalised result, for the report. */
interface SubScore {
  /** 0-100, higher is cleaner. */
  score: number
  violationCount: number
  denominator: number
}

/**
 * Compute one signal's sub-score: `100 * (1 - violations / denominator)`,
 * clamped to [0, 100]. A zero denominator (no styling sites / no components /
 * no files) yields a perfect 100 — there's nothing to be wrong about.
 *
 * @param opts.violationCount - The signal's raw violation count.
 * @param opts.denominator - The signal's normalising denominator.
 * @returns The {@link SubScore}.
 */
function computeSubScore(opts: {
  violationCount: number
  denominator: number
}): SubScore {
  const { violationCount, denominator } = opts
  if (denominator <= 0) {
    return { score: 100, violationCount, denominator }
  }
  const rawScore = 100 * (1 - violationCount / denominator)
  const clampedScore = Math.max(0, Math.min(100, rawScore))
  return { score: clampedScore, violationCount, denominator }
}

// ---------------------------------------------------------------------------
// File walk + orchestration.
// ---------------------------------------------------------------------------

// The component/route scope for signals 1-3 (parse-sensitive + className).
const DASHBOARD_TSX_GLOB = 'packages/dashboard/src/**/*.tsx'
// The wider scope for signal 4 (size) — every `.ts`/`.tsx`, but only `.tsx`
// files actually count toward the oversized-component violation.
const DASHBOARD_ALL_GLOB = 'packages/dashboard/src/**/*.{ts,tsx}'

// Generated files are rewritten on every build; flagging them is noise the
// next generation overwrites. Same exemption the package-source scanners use.
function isGeneratedFile(filePath: string): boolean {
  return filePath.endsWith('.gen.ts') || filePath.endsWith('.gen.tsx')
}

/**
 * Walk the dashboard source and accumulate every signal's violations and
 * denominators in a single pass. `.tsx` files feed all four signals; the
 * extra non-`.tsx` files from the size glob contribute nothing (only `.tsx`
 * counts for oversized-component), so they're skipped early.
 *
 * @returns The full {@link ScanResult}.
 */
async function scanDashboard(): Promise<ScanResult> {
  const tailwindHits: TailwindHit[] = []
  const staticStyleHits: StaticStyleHit[] = []
  const booleanPropHits: BooleanPropHit[] = []
  const oversizedComponentHits: OversizedComponentHit[] = []
  const propsTypeNames = new Set<string>()
  let classNameOccurrenceCount = 0
  let tsxFileCount = 0

  // Collect the `.tsx` files once (signals 1-4) and the additional `.ts`
  // files (signal 4 scope only — though only `.tsx` ever violates size, the
  // task scopes signal 4 over `.{ts,tsx}` so we visit both globs and dedupe).
  const tsxFilePaths = new Set<string>()
  const tsxGlob = new Glob(DASHBOARD_TSX_GLOB)
  for await (const filePath of tsxGlob.scan('.')) {
    if (isGeneratedFile(filePath)) continue
    tsxFilePaths.add(filePath)
  }

  for (const filePath of tsxFilePaths) {
    const content = await Bun.file(filePath).text()
    const lines = content.split('\n')
    tsxFileCount = tsxFileCount + 1

    // Signal 4: oversized component (line count > limit).
    if (lines.length > OVERSIZED_COMPONENT_LINE_LIMIT) {
      oversizedComponentHits.push({ file: filePath, lineCount: lines.length })
    }

    // Signal 1 + className denominator (whole-file regex pass — multi-line
    // className template literals are common here and a per-line pass would
    // miss every token on a continuation line).
    classNameOccurrenceCount =
      classNameOccurrenceCount + countClassNameOccurrences(content)
    scanFileForArbitraryTailwind({
      filePath,
      fileText: content,
      hits: tailwindHits,
    })

    // Signals 2 + 3 (AST pass).
    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      /* setParentNodes */ true,
      ts.ScriptKind.TSX,
    )
    scanSourceForStaticStyles({ filePath, sourceFile, hits: staticStyleHits })
    scanSourceForBooleanProps({
      filePath,
      sourceFile,
      hits: booleanPropHits,
      propsTypeNames,
    })
  }

  return {
    tailwindHits,
    staticStyleHits,
    booleanPropHits,
    oversizedComponentHits,
    classNameOccurrenceCount,
    componentWithPropsTypeCount: propsTypeNames.size,
    tsxFileCount,
  }
}

// ---------------------------------------------------------------------------
// Report rendering.
// ---------------------------------------------------------------------------

/**
 * Render the top-N worst-offender lines for a signal. Generic over the hit
 * type; the caller supplies how to render one hit's location line.
 *
 * @param opts.hits - The signal's hits.
 * @param opts.renderHit - Renders one hit into a `file:line  detail` string.
 * @returns The indented worst-offender lines (may be empty).
 */
function renderWorstOffenders<HitType>(opts: {
  hits: HitType[]
  renderHit: (hit: HitType) => string
}): string[] {
  const { hits, renderHit } = opts
  const lines: string[] = []
  for (const hit of hits.slice(0, WORST_OFFENDER_LIMIT)) {
    lines.push(`    ${renderHit(hit)}`)
  }
  if (hits.length > WORST_OFFENDER_LIMIT) {
    lines.push(`    … and ${hits.length - WORST_OFFENDER_LIMIT} more`)
  }
  return lines
}

/**
 * Build the multi-line composite report: the composite score, each sub-score
 * with its `violations/denominator`, and the per-signal worst-offender lists.
 *
 * @param opts.compositeScore - The rounded composite (0-100).
 * @param opts.tailwindSub - Signal 1 sub-score.
 * @param opts.staticStyleSub - Signal 2 sub-score.
 * @param opts.booleanPropSub - Signal 3 sub-score.
 * @param opts.oversizedSub - Signal 4 sub-score.
 * @param opts.result - The raw scan result (for worst-offender lists).
 * @returns The full report string.
 */
function buildReport(opts: {
  compositeScore: number
  tailwindSub: SubScore
  staticStyleSub: SubScore
  booleanPropSub: SubScore
  oversizedSub: SubScore
  result: ScanResult
}): string {
  const {
    compositeScore,
    tailwindSub,
    staticStyleSub,
    booleanPropSub,
    oversizedSub,
    result,
  } = opts
  const lines: string[] = []

  lines.push(
    `\x1b[33mreact-doctor composite score: ${compositeScore} / 100 (target ${TARGET_SCORE})\x1b[0m`,
  )
  lines.push('')
  lines.push('  sub-scores (weight · score · violations / denominator):')
  lines.push(
    `    tailwind-arbitrary  ${TAILWIND_WEIGHT.toFixed(2)} · ${tailwindSub.score.toFixed(1)} · ${tailwindSub.violationCount} / ${tailwindSub.denominator}`,
  )
  lines.push(
    `    static-inline-style ${STATIC_STYLE_WEIGHT.toFixed(2)} · ${staticStyleSub.score.toFixed(1)} · ${staticStyleSub.violationCount} / ${staticStyleSub.denominator}`,
  )
  lines.push(
    `    boolean-prop-prolif ${BOOLEAN_PROP_WEIGHT.toFixed(2)} · ${booleanPropSub.score.toFixed(1)} · ${booleanPropSub.violationCount} / ${booleanPropSub.denominator}`,
  )
  lines.push(
    `    oversized-component ${OVERSIZED_COMPONENT_WEIGHT.toFixed(2)} · ${oversizedSub.score.toFixed(1)} · ${oversizedSub.violationCount} / ${oversizedSub.denominator}`,
  )
  lines.push('')

  lines.push(
    `  worst offenders — arbitrary Tailwind values (top ${WORST_OFFENDER_LIMIT}):`,
  )
  for (const offenderLine of renderWorstOffenders({
    hits: result.tailwindHits,
    renderHit: (hit) => `${hit.file}:${hit.line}  ${hit.token}`,
  })) {
    lines.push(offenderLine)
  }
  lines.push('')

  lines.push(
    `  worst offenders — static inline styles (top ${WORST_OFFENDER_LIMIT}):`,
  )
  for (const offenderLine of renderWorstOffenders({
    hits: result.staticStyleHits,
    renderHit: (hit) => `${hit.file}:${hit.line}`,
  })) {
    lines.push(offenderLine)
  }
  lines.push('')

  lines.push(
    `  worst offenders — boolean-prop proliferation (top ${WORST_OFFENDER_LIMIT}):`,
  )
  for (const offenderLine of renderWorstOffenders({
    hits: result.booleanPropHits,
    renderHit: (hit) =>
      `${hit.file}:${hit.component}  (${hit.booleanMemberCount} boolean props)`,
  })) {
    lines.push(offenderLine)
  }
  lines.push('')

  lines.push(
    `  worst offenders — oversized components (top ${WORST_OFFENDER_LIMIT}):`,
  )
  for (const offenderLine of renderWorstOffenders({
    hits: result.oversizedComponentHits,
    renderHit: (hit) => `${hit.file}  (${hit.lineCount} lines)`,
  })) {
    lines.push(offenderLine)
  }

  return lines.join('\n')
}

/**
 * Detector entry point — same `{ ok, report }` shape as the sibling
 * `scripts/detect-*.ts` modules, and registered in `scripts/scan.ts` so the
 * harness blocks pre-commit + CI on it. `ok` is `score >= TARGET_SCORE`,
 * which drives both the harness gate and the standalone exit code below.
 *
 * The report is always built (even when `ok`) so every run surfaces the
 * current score and offender lists — the worst-offender detail is how a
 * regression below the floor gets diagnosed and scoped back down.
 */
export async function run(): Promise<{ ok: boolean; report: string }> {
  const result = await scanDashboard()

  const tailwindSub = computeSubScore({
    violationCount: result.tailwindHits.length,
    denominator: result.classNameOccurrenceCount,
  })
  // Static-style denominator is a styling-site proxy: the static-style
  // violations themselves plus every className occurrence. This keeps the
  // sub-score on the same "fraction of styling sites that are smelly" basis
  // as tailwind, rather than dividing by an unrelated count.
  const staticStyleSub = computeSubScore({
    violationCount: result.staticStyleHits.length,
    denominator:
      result.staticStyleHits.length + result.classNameOccurrenceCount,
  })
  const booleanPropSub = computeSubScore({
    violationCount: result.booleanPropHits.length,
    denominator: result.componentWithPropsTypeCount,
  })
  const oversizedSub = computeSubScore({
    violationCount: result.oversizedComponentHits.length,
    denominator: result.tsxFileCount,
  })

  const weightedComposite =
    TAILWIND_WEIGHT * tailwindSub.score +
    STATIC_STYLE_WEIGHT * staticStyleSub.score +
    BOOLEAN_PROP_WEIGHT * booleanPropSub.score +
    OVERSIZED_COMPONENT_WEIGHT * oversizedSub.score
  // Round to one decimal place per the score formula.
  const compositeScore = Math.round(weightedComposite * 10) / 10

  const report = buildReport({
    compositeScore,
    tailwindSub,
    staticStyleSub,
    booleanPropSub,
    oversizedSub,
    result,
  })

  return { ok: compositeScore >= TARGET_SCORE, report }
}

if (import.meta.main) {
  const result = await run()
  process.stdout.write(result.report)
  if (!result.report.endsWith('\n')) process.stdout.write('\n')
  if (result.ok) {
    process.stdout.write('\x1b[32mreact-doctor: at or above target.\x1b[0m\n')
    process.exit(0)
  }
  process.exit(1)
}
