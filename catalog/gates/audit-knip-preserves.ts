#!/usr/bin/env bun
/**
 * Audits `@knip-preserve` TSDoc tags for stale blocker references.
 *
 * Reports tags that reference issue numbers (`#NNN`) which have since closed
 * on GitHub. Stale references don't fail the audit — the tag may still be
 * load-bearing for reasons the closed issue wasn't actually the cause of. The
 * audit's job is to surface staleness; whether the tag stays, retires, or gets
 * a corrected rationale is per-finding human judgment.
 *
 * Dormant until `@knip-preserve` tags exist in the tree — with none present it
 * prints "nothing to audit" and exits 0. Wire into a quarterly cleanup loop
 * rather than CI.
 *
 * Caveat: this calls `gh issue view`, which resolves against whatever account
 * `gh` is currently authenticated as. On this machine `gh auth switch` drift is
 * common — if every issue comes back NOT_FOUND, check `gh auth status` and run
 * with `GH_TOKEN="$(gh auth token --user brewpirate)"` so lookups hit the
 * account that can see this repo.
 *
 * Usage:
 *
 *   bun scripts/audit-knip-preserves.ts
 *
 * Exits 0 always — this is a report tool, not a gate. See
 * docs/knip-cleanup.md "Per-export preserves" for the tag protocol.
 *
 * @module Scripts
 */

interface CommandResult {
  code: number
  stdout: string
}

/**
 * Minimal no-throw command runner. Inlined here (rather than pulling in a core
 * util) so this dormant operational script adds no surface to `@magpie/core`.
 */
async function runCommand(
  command: string,
  args: string[],
): Promise<CommandResult> {
  const proc = Bun.spawn([command, ...args], {
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const stdout = await new Response(proc.stdout).text()
  const code = await proc.exited
  return { code, stdout }
}

interface PreserveTag {
  file: string
  line: number
  reason: string
  rawRationale: string
  /**
   * Issue numbers cited in the rationale (e.g. `#160`, `#175`).
   *
   * Convention: the FIRST issue ref is the **primary blocker** — the issue
   * whose closure should trigger re-validation of the tag. Subsequent refs are
   * historical context (older blockers, audit-trail tickets). Staleness is
   * checked against the primary only, so an audit-trail ref doesn't mask the
   * primary closing.
   */
  issueRefs: number[]
  /** File-path receipts cited in the rationale (e.g. `lib/foo.ts:34`). Counts as an anchor — the protocol requires "issue ref OR file:line of the consumer". */
  fileRefs: string[]
}

interface IssueState {
  number: number
  state: 'OPEN' | 'CLOSED' | 'NOT_FOUND'
  title: string
}

async function findTags(): Promise<PreserveTag[]> {
  const result = await runCommand('grep', [
    '-rn',
    '--include=*.ts',
    '--include=*.tsx',
    '@knip-preserve',
    'packages/',
  ])
  if (result.code !== 0 && result.stdout.length === 0) {
    return []
  }
  const tags: PreserveTag[] = []
  for (const grepLine of result.stdout.split('\n')) {
    if (grepLine.length === 0) continue
    const match = grepLine.match(/^([^:]+):(\d+):/)
    if (!match) continue
    const file = match[1]
    const line = Number(match[2])
    const fileContent = await Bun.file(file).text()
    const fileLines = fileContent.split('\n')
    // Collect lines from the tag until the next @ tag or the comment close.
    const startIdx = line - 1
    const collected: string[] = []
    for (let i = startIdx; i < fileLines.length; i++) {
      const stripped = fileLines[i].replace(/^\s*\*\s?/, '')
      if (i > startIdx && /^@/.test(stripped)) break
      if (i > startIdx && /^\//.test(fileLines[i])) break
      collected.push(stripped)
    }
    const block = collected.join(' ').trim()
    // Tag format: `@knip-preserve <reason> — <rationale>` (preferred,
    // structured) OR `@knip-preserve <free-form rationale>` (older shape).
    const structured = block.match(/^@knip-preserve\s+(.+?)\s+—\s+(.+)$/s)
    let reason: string
    let rawRationale: string
    if (structured) {
      reason = structured[1].replace(/\s+/g, ' ').trim()
      rawRationale = structured[2].replace(/\s+/g, ' ').trim()
    } else {
      const freeform = block.match(/^@knip-preserve\s+(.+)$/s)
      if (!freeform) continue
      reason = '(free-form)'
      rawRationale = freeform[1].replace(/\s+/g, ' ').trim()
    }
    // Preserve declaration order — the FIRST issue ref is the primary blocker.
    // Deduplicate while preserving order so the convention survives even when
    // historical refs appear after the primary in textual order.
    const issueRefsOrdered = [...rawRationale.matchAll(/#(\d{1,5})\b/g)].map(
      (matchResult) => Number(matchResult[1]),
    )
    const seen = new Set<number>()
    const issueRefs: number[] = []
    for (const ref of issueRefsOrdered) {
      if (!seen.has(ref)) {
        seen.add(ref)
        issueRefs.push(ref)
      }
    }
    // File-path receipts: matches `path/to/file.ts(x?)(:NN)?` — used when the
    // rationale anchors via a consumer file rather than an issue.
    const fileRefs = [
      ...rawRationale.matchAll(/\b[\w/.-]+\.tsx?(?::\d+)?\b/g),
    ].map((matchResult) => matchResult[0])
    tags.push({
      file,
      line,
      reason,
      rawRationale,
      issueRefs,
      fileRefs: [...new Set(fileRefs)],
    })
  }
  return tags
}

async function fetchIssueState(issueNumber: number): Promise<IssueState> {
  const result = await runCommand('gh', [
    'issue',
    'view',
    String(issueNumber),
    '--json',
    'state,title',
  ])
  if (result.code !== 0) {
    return { number: issueNumber, state: 'NOT_FOUND', title: '' }
  }
  try {
    const parsed = JSON.parse(result.stdout) as {
      state: string
      title: string
    }
    return {
      number: issueNumber,
      state: parsed.state === 'OPEN' ? 'OPEN' : 'CLOSED',
      title: parsed.title,
    }
  } catch {
    return { number: issueNumber, state: 'NOT_FOUND', title: '' }
  }
}

function formatTag(tag: PreserveTag): string {
  // Display anchor data the way the staleness check sees it: primary blocker
  // (first issue ref), historical refs (rest), and file receipts. A tag with
  // `primary=∅` but a non-empty `files=[...]` is NOT anchorless — it anchors on
  // a consumer file:line per the protocol's "issue ref OR file:line" rule.
  const primary = tag.issueRefs.length > 0 ? `#${tag.issueRefs[0]}` : '∅'
  const historical =
    tag.issueRefs.length > 1
      ? tag.issueRefs
          .slice(1)
          .map((issueNumber) => `#${issueNumber}`)
          .join(', ')
      : ''
  const files = tag.fileRefs.join(', ')
  return `${tag.file}:${tag.line}  reason="${tag.reason}"  primary=${primary}  historical=[${historical}]  files=[${files}]`
}

const RATIONALE_DISPLAY_WIDTH = 120

async function main(): Promise<void> {
  const tags = await findTags()
  if (tags.length === 0) {
    console.log('No @knip-preserve tags found. Nothing to audit.')
    return
  }
  console.log(`Found ${tags.length} @knip-preserve tag(s):\n`)
  for (const tag of tags) {
    console.log(`  ${formatTag(tag)}`)
  }
  console.log('')

  const allRefs = new Set<number>()
  for (const tag of tags) {
    for (const ref of tag.issueRefs) {
      allRefs.add(ref)
    }
  }
  const states = new Map<number, IssueState>()
  for (const ref of allRefs) {
    states.set(ref, await fetchIssueState(ref))
  }

  // Staleness: the FIRST issue ref is the primary blocker — staleness is
  // determined by primary state alone, not the conjunction of all refs. This
  // prevents an OPEN audit-trail ref from masking a CLOSED primary. A tag with
  // no issue refs falls back to its file:line receipt as anchor.
  const stale: PreserveTag[] = []
  const anchorless: PreserveTag[] = []
  for (const tag of tags) {
    if (tag.issueRefs.length === 0) {
      if (tag.fileRefs.length === 0) anchorless.push(tag)
      continue
    }
    const primaryRef = tag.issueRefs[0]
    const primaryState = states.get(primaryRef)?.state
    if (primaryState === 'CLOSED') stale.push(tag)
  }

  if (stale.length === 0 && anchorless.length === 0) {
    console.log(
      '✓ All tags anchor on at least one OPEN issue or file:line receipt. No staleness detected.',
    )
    return
  }

  if (stale.length > 0) {
    console.log(
      `⚠ ${stale.length} tag(s) have a CLOSED primary blocker — re-validate per-finding:\n`,
    )
    for (const tag of stale) {
      const primaryRef = tag.issueRefs[0]
      const primaryState = states.get(primaryRef)
      const historicalStates = tag.issueRefs.slice(1).map((ref) => {
        const issueState = states.get(ref)
        return `#${ref} (${issueState?.state ?? '?'})`
      })
      console.log(`  ${tag.file}:${tag.line}`)
      console.log(`    reason:     ${tag.reason}`)
      console.log(
        `    primary:    #${primaryRef} (${primaryState?.state ?? '?'}) — ${primaryState?.title ?? ''}`,
      )
      if (historicalStates.length > 0) {
        console.log(`    historical: ${historicalStates.join(', ')}`)
      }
      const rationale = tag.rawRationale.slice(0, RATIONALE_DISPLAY_WIDTH)
      const truncated = tag.rawRationale.length > RATIONALE_DISPLAY_WIDTH
      console.log(`    rationale:  ${rationale}${truncated ? '…' : ''}`)
      console.log('')
    }
  }
  if (anchorless.length > 0) {
    console.log(
      `ℹ ${anchorless.length} tag(s) with no anchor (no issue ref AND no file:line receipt) — confirm rationale stands or add an anchor:\n`,
    )
    for (const tag of anchorless) {
      console.log(`  ${tag.file}:${tag.line}  reason="${tag.reason}"`)
    }
  }
  console.log(
    '\nFor each flagged tag: read the file, verify the export still has reasons-to-exist that knip cannot see, and either remove the tag (if dead) or correct the rationale (if the blocker reference is wrong but the tag is still load-bearing). See docs/knip-cleanup.md "Per-export preserves" for the protocol.',
  )
}

await main()
