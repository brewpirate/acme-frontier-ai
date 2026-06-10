/**
 * Shared report formatter for the `scripts/detect-*.ts` scanners. Every
 * scanner returns the same `{ ok, report }` shape the `scripts/scan.ts`
 * harness consumes, and renders it the same way: a colorized `[N hit(s)]`
 * header, one indented `file:line:column  <detail>` line per hit, a blank
 * line, then a footer telling the reader how to fix it. That rendering
 * convention is shared knowledge — change it and every scanner's output
 * should change together — so it lives here once instead of being re-inlined
 * in each scanner's `run()`.
 *
 * Only the parts that legitimately differ per scanner are injected: the
 * header label, the per-hit detail text, and the fix-it footer.
 */

/** The location fields every scanner hit carries, used to render the
 * `file:line:column` prefix shared by every report line. */
export interface ScannerHitLocation {
  file: string
  line: number
  column: number
}

/**
 * Render a scanner's hits into the harness `{ ok, report }` contract. Returns
 * `ok: true` with an empty report when there are no hits (the clean case the
 * harness treats as a pass); otherwise `ok: false` with the formatted report.
 *
 * @param opts.hits - The scanner's hits; an empty array is the clean pass.
 * @param opts.headerLabel - Short description of what was flagged, shown after
 *   the `[N hits]` count (e.g. "Top-level declaration missing its doc block").
 * @param opts.formatHitDetail - Renders the trailing detail for one hit, shown
 *   after the shared `file:line:column` prefix.
 * @param opts.footer - The fix-it line shown beneath the hits.
 */
export function formatScannerReport<HitType extends ScannerHitLocation>(opts: {
  hits: HitType[]
  headerLabel: string
  formatHitDetail: (hit: HitType) => string
  footer: string
}): { ok: boolean; report: string } {
  const { hits, headerLabel, formatHitDetail, footer } = opts
  if (hits.length === 0) return { ok: true, report: '' }
  const lines: string[] = []
  lines.push(
    `\x1b[33m[${hits.length} ${hits.length === 1 ? 'hit' : 'hits'}]\x1b[0m ${headerLabel}`,
  )
  for (const hit of hits) {
    lines.push(
      `  ${hit.file}:${hit.line}:${hit.column}  ${formatHitDetail(hit)}`,
    )
  }
  lines.push('')
  lines.push(footer)
  return { ok: false, report: lines.join('\n') }
}
