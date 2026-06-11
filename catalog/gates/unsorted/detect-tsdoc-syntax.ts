/**
 * TSDoc-syntax scanner — the second pass that {@link "./detect-tsdoc"}
 * (presence) leaves open. The presence scanner checks that a top-level
 * declaration *has* a `/** … *​/` block; this scanner checks that the
 * blocks which exist are well-formed TSDoc, by feeding each one through
 * `@microsoft/tsdoc`'s `TSDocParser` and reporting the parser's
 * structural error messages. Closes issue #311.
 *
 * **Why a curated denylist, not "report every parser message".** An
 * empirical probe over all 2107 in-scope doc blocks produced 144 parser
 * messages across 9 `messageId` categories — and ~126 of those are
 * deliberate house-style, not defects:
 *
 *   - `@param opts.field` dotted names — which `hard-requirements.md`
 *     *mandates* for options-object params.
 *   - Prose braces (`{id}/read`, `{ ok: true }`), prose angle brackets
 *     (`<Bar dataKey>`, SQL `<=`), and `@magpie/core` package mentions —
 *     all read fine to a human/agent reading the source. They are only
 *     "errors" relative to a strict doc-renderer (api-extractor), which
 *     this repo's pipeline does not run.
 *
 * A naive "report everything" gate would therefore be ~99% noise and
 * would fight real work (forcing prose-escaping of every `>`, `<x>`,
 * `}`, and `@`). So the gate **suppresses** a small, documented set of
 * house-style message ids (see {@link SUPPRESSED_MESSAGE_IDS}) and
 * reports everything else. This is the denylist / "validate syntax,
 * carve out our conventions" model the issue asked for.
 *
 * **What the gate actually catches (and what it does NOT).**
 * `@microsoft/tsdoc` is a *parser*, not a type-checker — it has no
 * symbol table. So:
 *
 *   - It DOES catch malformed link/tag *syntax*: an empty `{@link}`
 *     (`tsdoc-link-tag-empty`), a missing close brace
 *     (`tsdoc-inline-tag-missing-right-brace`), a `{@link}` whose target
 *     is a backtick code span rather than a symbol
 *     (`tsdoc-missing-reference`), and the whole `tsdoc-reference-*`
 *     family.
 *   - It does NOT catch a `{@link RenamedOrTypoedSymbol}` whose target is
 *     a *well-formed but wrong* symbol — that parses clean (verified:
 *     `{@link DefinitelyNotARealSymbol}` produces zero messages). Broken
 *     cross-references are out of reach for a parser-only gate; that is
 *     api-extractor's job, and this repo does not run it.
 *
 * The reported defects are real malformed-syntax, and crucially the
 * suppressed prose-noise ids do NOT overlap the real-defect ids: a
 * genuinely broken `{@link}` fires a *distinct* (reported) id, never the
 * suppressed `tsdoc-malformed-inline-tag` that prose `{…}` fires. So the
 * carve-outs create no blind spot for real breakage.
 *
 * **Scope.** Same file glob + excludes as the presence scanner, and the
 * same "top-level documentable statement" walk. That shared scan scaffold —
 * the scoped roots, the documentable-kind set, and the file walk — lives in
 * {@link "./lib/tsdoc-scan-common"}, so both gates provably scan the same set
 * (they call the same {@link scanTsdocScopedFiles}); there is no longer a
 * "keep these two lists in sync by hand" hazard.
 *
 * Note the walk here differs from the presence scanner in one way: this
 * scanner validates blocks that *exist*, so it does NOT apply the
 * presence carve-outs (schema-literal / hookFor / Route skips). Those
 * govern whether a block is *required*; they say nothing about whether
 * an existing block is well-formed, which is all this pass checks.
 *
 * Exit codes (via {@link run} + the `scan.ts` harness):
 *   0 — clean (no reported syntax fires)
 *   1 — at least one reported fire (each printed file:line:col [id] text)
 */

import { TSDocConfiguration, TSDocParser, TextRange } from '@microsoft/tsdoc'
import * as ts from 'typescript'
import { formatScannerReport } from './lib/scanner-report'
import {
  isDocumentableDeclaration,
  isTsdocBlockComment,
  scanTsdocScopedFiles,
} from './lib/tsdoc-scan-common'

/**
 * Message ids the gate deliberately does NOT report — each is a
 * documented house-style convention, not a defect. Every entry here is a
 * carve-out decision with a stated WHY; this Set is the spec for "which
 * TSDoc parser complaints are tolerated in this codebase". Add to it only
 * with a comment explaining why the category is house-style and why
 * suppressing it does not hide real breakage.
 */
const SUPPRESSED_MESSAGE_IDS = new Set<string>([
  // `@param opts.field` — dotted nested-options-object param names.
  // `hard-requirements.md` *mandates* this exact shape for options
  // objects (`@param opts.db - …`). Suppressing is non-negotiable: the
  // codebase's own rule prescribes the form the parser objects to.
  'tsdoc-param-tag-with-invalid-name',
  // Prose braces — `POST /{id}/read`, `returns { ok: true }`, JSON
  // response shapes in route docs. TSDoc tries to read `{…}` as an inline
  // tag. Real broken inline tags fire DISTINCT, reported ids
  // (`tsdoc-inline-tag-missing-right-brace`, `tsdoc-link-tag-empty`,
  // `tsdoc-missing-reference`), so suppressing this prose-noise id leaves
  // no blind spot for genuine breakage. Co-occurs with the right-brace id
  // below.
  'tsdoc-malformed-inline-tag',
  'tsdoc-escape-right-brace',
  // Prose `>` — SQL comparisons (`switched_at <= started_at`), generic
  // "greater than" wording. TSDoc wants it escaped as `\>`; escaping
  // every comparison operator in prose hurts readability for a renderer
  // this repo does not run.
  'tsdoc-escape-greater-than',
  // Prose `<x>` — `<Bar dataKey>`, `<ChartContainer>`, `<button>`, and
  // `<=` read as a malformed HTML start tag. Same rationale: these are
  // readable prose, not HTML the codebase intends to render.
  'tsdoc-malformed-html-name',
  // `@magpie/core` package mentions — TSDoc reads `@magpie` as a block
  // tag and `/core` as stray trailing characters. The package name is the
  // single most-referenced symbol in the repo's docs; it is prose, not a
  // tag.
  'tsdoc-characters-after-block-tag',
])

interface Hit {
  file: string
  line: number
  column: number
  messageId: string
  text: string
}

// One parser, reused across every block. `ignoreUndefinedTags` keeps the
// gate from firing on a future custom `@block` tag the codebase might
// adopt — undefined tags are silently ignored rather than reported, so a
// new tag does not retroactively re-trip the gate before it is declared.
const tsdocConfiguration = new TSDocConfiguration()
tsdocConfiguration.validation.ignoreUndefinedTags = true
const tsdocParser = new TSDocParser(tsdocConfiguration)

/**
 * Extract the leading `/** … *​/` block immediately above a declaration,
 * returning both its text and its absolute start offset in the file. The
 * offset is needed to map a parser message (whose `textRange` is relative
 * to the comment string) back to a file line/column.
 *
 * Returns `undefined` when the declaration has no doc block — such
 * declarations are the presence scanner's concern, not this one.
 */
function leadingDocBlock(
  node: ts.Node,
  sourceFile: ts.SourceFile,
): { text: string; startPosition: number } | undefined {
  const sourceText = sourceFile.getFullText()
  const ranges =
    ts.getLeadingCommentRanges(sourceText, node.getFullStart()) ?? []
  for (const range of ranges) {
    const commentText = sourceText.slice(range.pos, range.end)
    if (isTsdocBlockComment(commentText)) {
      return { text: commentText, startPosition: range.pos }
    }
  }
  return undefined
}

function scanFile(filePath: string, content: string): Hit[] {
  const hits: Hit[] = []
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    ts.ScriptKind.TS,
  )

  for (const statement of sourceFile.statements) {
    if (!isDocumentableDeclaration(statement)) continue
    const block = leadingDocBlock(statement, sourceFile)
    if (!block) continue

    const parserContext = tsdocParser.parseRange(
      TextRange.fromString(block.text),
    )
    for (const message of parserContext.log.messages) {
      if (SUPPRESSED_MESSAGE_IDS.has(message.messageId)) continue

      // `message.textRange.pos` is an offset INTO the comment string (the
      // string we handed to TextRange.fromString). Add the comment's own
      // file offset to recover the absolute file position of the error
      // token. `tokenSequence` is NOT used — it is undefined for some
      // message kinds (it crashed the issue's reference sketch); textRange
      // is always present. Guard anyway and fall back to the comment start.
      const messageOffsetInComment = message.textRange
        ? message.textRange.pos
        : 0
      const fileOffset = block.startPosition + messageOffsetInComment
      const { line, character } =
        sourceFile.getLineAndCharacterOfPosition(fileOffset)
      hits.push({
        file: filePath,
        line: line + 1,
        column: character + 1,
        messageId: message.messageId,
        text: message.unformattedText,
      })
    }
  }
  return hits
}

/**
 * Detector entry point used by the {@link "./scan"} harness. Same
 * `{ ok, report }` shape as the other detect-*.ts modules — returns the
 * result rather than printing + exiting. Standalone-runnable via the
 * `if (import.meta.main)` block below for individual debugging.
 */
export async function run(): Promise<{ ok: boolean; report: string }> {
  const hits = await scanTsdocScopedFiles(scanFile)
  return formatScannerReport({
    hits,
    headerLabel: 'Existing /** */ block has malformed TSDoc syntax',
    formatHitDetail: (hit) => `\x1b[36m[${hit.messageId}]\x1b[0m ${hit.text}`,
    footer:
      '  → Fix the malformed tag/link syntax, or (if it is a tolerated house-style convention) add the messageId to SUPPRESSED_MESSAGE_IDS in scripts/detect-tsdoc-syntax.ts with a documented WHY. See hard-requirements.md.',
  })
}

if (import.meta.main) {
  const result = await run()
  if (result.ok) {
    console.log('\x1b[32mNo malformed TSDoc syntax in existing blocks.\x1b[0m')
  } else {
    process.stdout.write(result.report)
    if (!result.report.endsWith('\n')) process.stdout.write('\n')
    process.exit(1)
  }
}
