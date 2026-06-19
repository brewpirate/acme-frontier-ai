#!/usr/bin/env bun
/**
 * catalog → ~/.claude symlink manager.
 *
 * The repo's `catalog/` holds skills, rules, agents, commands, and project
 * bundles. To actually *use* one, it has to live under `~/.claude/`. This tool
 * links catalog items into their `~/.claude/` homes, shows what is linked, and
 * removes links — dynamically: adding a new catalog item needs no code change
 * here, because discovery scans the catalog at runtime. The registry below
 * changes only when a whole new *category* is added.
 *
 * ## Model — homes fed by two source kinds
 * Each `~/.claude/<home>/` is fed by:
 *   1. top-level `catalog/<home>/*`
 *   2. every project's slice: `catalog/projects/<proj>/<home>/*`
 * Projects are *bundles*, not leaf items — we descend into their recognized
 * subcategory dirs and link the contents by bare name (no prefix). Project-root
 * files (`README.md`, `docs/`, …) are ignored. A consequence of flattening many
 * sources into one home: two items can demand the same link name — see Clashes.
 *
 * ## Safety invariants
 *   - A link always points at an absolute path inside `catalog/`. "Ownership"
 *     means a symlink that resolves inside {@link CATALOG_ROOT}; the tool only
 *     ever creates/replaces/removes links it owns.
 *   - It never overwrites a real file and never touches a foreign symlink — not
 *     even with `--force`.
 *   - It never touches `~/.claude/projects/` (that is Claude Code's session
 *     transcript storage); `projects` is a source here, never a target home.
 *   - `--home` / `CLAUDE_SYMLINK_HOME` redirect the target root, so the whole
 *     tool can be exercised against a throwaway dir without risking the real
 *     `~/.claude`.
 *
 * ## Clashes
 * When ≥2 sources flatten to the same `~/.claude/<home>/<name>`, none are linked
 * and the clash is reported — surfacing dedupe work rather than guessing a
 * winner. (`unlink` is unaffected: it still removes any owned link there.)
 *
 * ## Orphans
 * A reverse scan of each home catches owned links whose catalog source was
 * deleted/renamed. Without it, refactoring the catalog would strand links the
 * tool then could not see or remove. Orphans show in `status` and are removable
 * by `unlink`.
 *
 * ## Modes
 *   - bare invocation on a TTY → interactive (Inquirer) menu.
 *   - a subcommand/flag present, or non-TTY → flag mode (scriptable; tests use
 *     this). The linking engine is identical; only the front end differs.
 *
 * ## Hooks (out of scope this round)
 * The `hooks` home is intentionally disabled — hooks need restructuring +
 * settings.json wiring first (brewpirate/acme-frontier-ai#12). Symlinking a
 * hook script alone does not make it fire.
 *
 * Exit codes: 0 ok · 1 some items skipped (conflict/clash) · 2 engine error.
 */

import { checkbox, confirm, select, Separator } from '@inquirer/prompts'
import type { Dirent, Stats } from 'node:fs'
import {
  lstat,
  mkdir,
  readdir,
  readlink,
  symlink,
  unlink,
} from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { parseArgs } from 'node:util'

/** Repo root — this file lives at `<repoRoot>/scripts/symlink.ts`. */
const REPO_ROOT = resolve(import.meta.dir, '..')
const CATALOG_ROOT = join(REPO_ROOT, 'catalog')
const PROJECTS_DIR = join(CATALOG_ROOT, 'projects')

/** Minimal ANSI helpers — matches the gate scripts' inline-code palette. */
const ansi = {
  green: (s: string): string => `\x1b[32m${s}\x1b[0m`,
  red: (s: string): string => `\x1b[31m${s}\x1b[0m`,
  yellow: (s: string): string => `\x1b[33m${s}\x1b[0m`,
  dim: (s: string): string => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string): string => `\x1b[1m${s}\x1b[0m`,
}

/**
 * ACME field sign-offs — printed when an interactive session ends. Deadpan and
 * sincere by design (per VOICE.md): the absurdity is in the literal content,
 * never the delivery. Interactive-only; flag-mode output stays clean for pipes.
 */
const TAGLINES: readonly string[] = [
  'The Road Runner remains uncaught. Research continues.',
  'Most experiments do not survive contact with reality.',
  'Findings logged. Ordnance secured.',
  'Applied gravity remains undefeated.',
  'Delivery systems nominal. Kinetic solutions pending review.',
  'No anvils were deployed in this session.',
  'Catalog secured. Mind the blast radius on reload.',
  'Field telemetry archived. Stand clear.',
]

/** Pick a pseudo-random element (call sites are non-empty constants). */
function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)] as T
}

/** Print a random ACME sign-off. Called when an interactive session ends. */
function printTagline(): void {
  process.stdout.write(`\n🧨 ${ansi.dim(pick(TAGLINES))}\n`)
}

/** Per-item granularity: link each file, or link each top-level subdir. */
type Granularity = 'file' | 'dir'

/** A `~/.claude/<name>/` category home and how its items are shaped. */
interface Home {
  /** Subdir name under `~/.claude` and under each source; also `--only` value. */
  name: string
  granularity: Granularity
  /** File granularity only: discover + name links by this extension. */
  ext?: '.md' | '.sh'
  /** A disabled home is skipped everywhere (discovery, status, actions). */
  enabled: boolean
  /** One-line caveat shown under the home in `status`. */
  note?: string
}

/**
 * The category homes. Adding a catalog *item* needs no change here; this list
 * changes only when a new *category* is introduced.
 */
const HOMES: readonly Home[] = [
  { name: 'agents', granularity: 'file', ext: '.md', enabled: true },
  {
    name: 'rules',
    granularity: 'file',
    ext: '.md',
    enabled: true,
    note: 'No native ~/.claude/rules auto-loader — linked, but not auto-consumed.',
  },
  { name: 'skills', granularity: 'dir', enabled: true },
  { name: 'commands', granularity: 'file', ext: '.md', enabled: true },
  {
    name: 'hooks',
    granularity: 'file',
    ext: '.sh',
    enabled: false,
    note: 'Deferred — needs restructure + settings.json wiring (#12).',
  },
]

/** A discovered catalog item and the link it maps to. */
interface Item {
  /** Owning home (category) name. */
  home: string
  /** Link basename in the target home, e.g. `test-quality` or `dry-and-reuse.md`. */
  name: string
  /** Absolute catalog path the link should point at (the symlink destination). */
  source: string
  /** Project name when sourced from a bundle, else `null` for top-level catalog. */
  project: string | null
  /** Absolute path where the symlink should live (`join(home, name)`). */
  target: string
}

/** Filesystem state of a link target, classified without following the link. */
type TargetState =
  | 'missing'
  | 'correct'
  | 'wrong-ours'
  | 'wrong-foreign'
  | 'occupied-real'

/** What an action did (or would do, under `--dry-run`). */
type ActionKind = 'link' | 'replace' | 'remove' | 'skip' | 'noop'
interface ActionResult {
  kind: ActionKind
  item: Item
  note?: string
}

/** CLI filters narrowing which items a command operates on. */
interface Filters {
  only?: string
  item?: string
  project?: string
}

/**
 * Resolve the `~/.claude` root. Precedence: `--home` flag > `CLAUDE_SYMLINK_HOME`
 * env > `~/.claude`. The override is what lets verification run against a temp
 * dir without touching the real config.
 */
function resolveClaudeHome(flagHome?: string): string {
  return flagHome ?? process.env.CLAUDE_SYMLINK_HOME ?? join(homedir(), '.claude')
}

/** Human-readable provenance for an item (project name, or `catalog/<home>`). */
function originLabel(item: Item): string {
  return item.project ?? `catalog/${item.home}`
}

/** True iff an absolute path is `CATALOG_ROOT` or lives beneath it. */
function isInsideCatalog(absPath: string): boolean {
  return absPath === CATALOG_ROOT || absPath.startsWith(CATALOG_ROOT + sep)
}

/**
 * True iff `linkPath` is a symlink whose literal target resolves inside the
 * catalog. Uses `readlink` (the pointer string), so a dangling owned link is
 * still recognised — that is what makes orphan cleanup possible.
 */
async function isOwnedLink(linkPath: string): Promise<boolean> {
  let raw: string
  try {
    raw = await readlink(linkPath)
  } catch {
    return false
  }
  return isInsideCatalog(resolve(dirname(linkPath), raw))
}

/**
 * Classify the target path against the catalog source it should point at.
 * `lstat` never follows the link, so a symlink is examined as a symlink.
 */
async function classify(target: string, expected: string): Promise<TargetState> {
  let st: Stats
  try {
    st = await lstat(target)
  } catch {
    return 'missing'
  }
  if (!st.isSymbolicLink()) return 'occupied-real'
  const abs = resolve(dirname(target), await readlink(target))
  if (abs === expected) return 'correct'
  return isInsideCatalog(abs) ? 'wrong-ours' : 'wrong-foreign'
}

/** List the items in one source dir for a home, honouring its granularity. */
async function readDirItems(dir: string, home: Home): Promise<string[]> {
  let entries: Dirent[]
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return [] // source dir absent — nothing to contribute
  }
  const names: string[] = []
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue // .gitkeep and dotfiles
    if (home.granularity === 'dir') {
      if (entry.isDirectory()) names.push(entry.name)
    } else if (entry.isFile() && (!home.ext || entry.name.endsWith(home.ext))) {
      names.push(entry.name)
    }
  }
  return names
}

/**
 * Forward discovery — the dynamic core. For each enabled home, gather items
 * from top-level `catalog/<home>/` and from every project's `<home>/` slice.
 */
async function discoverForward(claudeHome: string): Promise<Item[]> {
  let projectDirs: string[] = []
  try {
    const entries = await readdir(PROJECTS_DIR, { withFileTypes: true })
    projectDirs = entries
      .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
      .map((e) => e.name)
  } catch {
    projectDirs = []
  }

  const items: Item[] = []
  for (const home of HOMES) {
    if (!home.enabled) continue
    const targetDir = join(claudeHome, home.name)

    const topDir = join(CATALOG_ROOT, home.name)
    for (const name of await readDirItems(topDir, home)) {
      items.push({
        home: home.name,
        name,
        source: join(topDir, name),
        project: null,
        target: join(targetDir, name),
      })
    }

    for (const proj of projectDirs) {
      const subDir = join(PROJECTS_DIR, proj, home.name)
      for (const name of await readDirItems(subDir, home)) {
        items.push({
          home: home.name,
          name,
          source: join(subDir, name),
          project: proj,
          target: join(targetDir, name),
        })
      }
    }
  }
  return items
}

/**
 * Reverse discovery — owned links in each home that no forward item claims.
 * These are orphans (deleted/renamed catalog source). `forwardTargets` must be
 * the *unfiltered* forward target set, so a `--item` filter cannot mislabel a
 * still-valid link as orphaned.
 */
async function discoverOrphans(
  claudeHome: string,
  forwardTargets: Set<string>,
): Promise<Item[]> {
  const orphans: Item[] = []
  for (const home of HOMES) {
    if (!home.enabled) continue
    const dir = join(claudeHome, home.name)
    let entries: Dirent[]
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      const path = join(dir, entry.name)
      if (forwardTargets.has(path)) continue // a forward item owns this target
      if (!entry.isSymbolicLink()) continue
      if (!(await isOwnedLink(path))) continue // foreign link — not ours
      orphans.push({
        home: home.name,
        name: entry.name,
        source: resolve(dir, await readlink(path)), // the (likely dead) target
        project: null,
        target: path,
      })
    }
  }
  return orphans
}

/** Group items by their target path; a bucket > 1 is a name clash. */
function groupByTarget(items: Item[]): Map<string, Item[]> {
  const groups = new Map<string, Item[]>()
  for (const item of items) {
    const bucket = groups.get(item.target) ?? []
    bucket.push(item)
    groups.set(item.target, bucket)
  }
  return groups
}

function applyFilters(items: Item[], f: Filters): Item[] {
  return items.filter(
    (i) =>
      (!f.only || i.home === f.only) &&
      (!f.item || i.name === f.item) &&
      (!f.project || i.project === f.project),
  )
}

/** Orphans carry no project; filter only by home (`--only`) and name (`--item`). */
function filterOrphans(orphans: Item[], f: Filters): Item[] {
  return orphans.filter(
    (o) => (!f.only || o.home === f.only) && (!f.item || o.name === f.item),
  )
}

/**
 * Link one item. Idempotent (no-op when correct). Never overwrites a real file
 * or foreign symlink. Replaces a stale owned link only under `--force`.
 */
async function linkOne(
  item: Item,
  force: boolean,
  dryRun: boolean,
): Promise<ActionResult> {
  const state = await classify(item.target, item.source)
  switch (state) {
    case 'correct':
      return { kind: 'noop', item }
    case 'occupied-real':
      return { kind: 'skip', item, note: 'occupied by real file' }
    case 'wrong-foreign':
      return { kind: 'skip', item, note: 'foreign symlink' }
    case 'wrong-ours':
      if (!force) return { kind: 'skip', item, note: 'stale link (use --force)' }
      if (!dryRun) {
        await unlink(item.target)
        await symlink(item.source, item.target)
      }
      return { kind: 'replace', item }
    case 'missing':
      if (!dryRun) {
        await mkdir(dirname(item.target), { recursive: true })
        await symlink(item.source, item.target)
      }
      return { kind: 'link', item }
  }
}

/** Remove one item's link — only when we own it (correct or stale). */
async function unlinkOne(item: Item, dryRun: boolean): Promise<ActionResult> {
  const state = await classify(item.target, item.source)
  switch (state) {
    case 'missing':
      return { kind: 'noop', item }
    case 'occupied-real':
      return { kind: 'skip', item, note: 'real file — not ours' }
    case 'wrong-foreign':
      return { kind: 'skip', item, note: 'foreign symlink — not ours' }
    case 'correct':
    case 'wrong-ours':
      if (!dryRun) await unlink(item.target)
      return { kind: 'remove', item }
  }
}

/** Remove an orphan link — verified owned by the reverse scan. */
async function unlinkOrphan(item: Item, dryRun: boolean): Promise<ActionResult> {
  if (!dryRun) await unlink(item.target)
  return { kind: 'remove', item, note: 'orphan' }
}

/** Run `link` over filtered items: clashes skipped + reported, rest linked. */
async function runLink(
  items: Item[],
  force: boolean,
  dryRun: boolean,
): Promise<ActionResult[]> {
  const results: ActionResult[] = []
  for (const group of groupByTarget(items).values()) {
    const first = group[0]
    if (!first) continue
    if (group.length > 1) {
      results.push({
        kind: 'skip',
        item: first,
        note: `clash(${group.length}): ${group.map(originLabel).join(', ')}`,
      })
    } else {
      results.push(await linkOne(first, force, dryRun))
    }
  }
  return results
}

/** Run `unlink` over filtered forward items (deduped by target) + orphans. */
async function runUnlink(
  items: Item[],
  orphans: Item[],
  dryRun: boolean,
): Promise<ActionResult[]> {
  const results: ActionResult[] = []
  for (const group of groupByTarget(items).values()) {
    const first = group[0]
    if (!first) continue
    results.push(await unlinkOne(first, dryRun)) // owned correct/stale → removed
  }
  for (const orphan of orphans) {
    results.push(await unlinkOrphan(orphan, dryRun))
  }
  return results
}

/** Catalog-relative path for readable display. */
function relSource(item: Item): string {
  return relative(REPO_ROOT, item.source)
}

const PAD = 26

/**
 * Render the read-only status report: grouped per home, with clashes and
 * orphans surfaced. `items`/`orphans` are already filtered for display.
 */
async function renderStatus(
  claudeHome: string,
  items: Item[],
  orphans: Item[],
  f: Filters,
): Promise<string> {
  const lines: string[] = [
    ansi.bold(`🧨 ACME catalog  →  ${claudeHome}`),
  ]
  let linked = 0
  let missing = 0
  let attention = 0

  for (const home of HOMES) {
    if (!home.enabled) continue
    if (f.only && f.only !== home.name) continue

    const homeGroups = [...groupByTarget(items.filter((i) => i.home === home.name)).values()].sort(
      (a, b) => (a[0]?.name ?? '').localeCompare(b[0]?.name ?? ''),
    )
    const homeOrphans = orphans
      .filter((o) => o.home === home.name)
      .sort((a, b) => a.name.localeCompare(b.name))

    const clashes = homeGroups.filter((g) => g.length > 1).length
    lines.push(
      '',
      `${ansi.bold(home.name)}${clashes ? `  ${ansi.yellow(`(${clashes} clash${clashes > 1 ? 'es' : ''})`)}` : ''}`,
    )
    if (homeGroups.length === 0 && homeOrphans.length === 0) {
      lines.push(ansi.dim('  (none)'))
    }

    for (const group of homeGroups) {
      const first = group[0]
      if (!first) continue
      if (group.length > 1) {
        attention++
        lines.push(
          `  💥 ${first.name.padEnd(PAD)} ${ansi.yellow(`CLASH(${group.length})`)}: ${group.map(originLabel).join(', ')} ${ansi.dim('→ skipped')}`,
        )
        continue
      }
      const state = await classify(first.target, first.source)
      switch (state) {
        case 'correct':
          linked++
          lines.push(`  ⭐ ${first.name.padEnd(PAD)} ${ansi.dim(`→ ${relSource(first)}`)}`)
          break
        case 'missing':
          missing++
          lines.push(ansi.dim(`  💤 ${first.name.padEnd(PAD)} (not linked)`))
          break
        case 'wrong-ours':
          attention++
          lines.push(`  🧨 ${first.name.padEnd(PAD)} ${ansi.yellow('stale')} ${ansi.dim('(link --force to re-arm)')}`)
          break
        case 'wrong-foreign':
          attention++
          lines.push(`  👽 ${first.name.padEnd(PAD)} ${ansi.yellow('foreign symlink')} ${ansi.dim('(left as-is)')}`)
          break
        case 'occupied-real':
          attention++
          lines.push(`  🧱 ${first.name.padEnd(PAD)} ${ansi.yellow('real file')} ${ansi.dim('(left as-is)')}`)
          break
      }
    }

    for (const orphan of homeOrphans) {
      attention++
      lines.push(
        `  ☠️  ${orphan.name.padEnd(PAD)} ${ansi.yellow('orphan')} ${ansi.dim(`→ ${relSource(orphan)} (dead; unlink to remove)`)}`,
      )
    }

    if (home.note) lines.push(ansi.dim(`  · ${home.note}`))
  }

  const disabled = HOMES.filter((h) => !h.enabled).map((h) => h.name)
  lines.push(
    '',
    `⭐ ${ansi.green(`${linked} active`)} · 💤 ${missing} dormant · ${attention ? ansi.yellow(`💥 ${attention} need attention`) : '✅ 0 need attention'}`,
  )
  if (disabled.length) lines.push(ansi.dim(`🚧 disabled: ${disabled.join(', ')} (deferred — #12)`))
  return lines.join('\n')
}

/** Print an action summary; return counts + the process exit code (1 if any skipped). */
function renderActions(
  command: string,
  results: ActionResult[],
  dryRun: boolean,
): { code: number; changed: number; skipped: number } {
  const lines: string[] = []
  if (dryRun) lines.push(ansi.bold('🧪 DRY RUN — no charges detonated'))
  let changed = 0
  let skipped = 0
  for (const r of results) {
    const where = `${r.item.home}/${r.item.name}`
    switch (r.kind) {
      case 'noop':
        lines.push(ansi.dim(`  💤 [noop]    ${where}`))
        break
      case 'skip':
        skipped++
        lines.push(`  🚫 ${ansi.yellow('[skip]')}    ${where}  ${ansi.dim(r.note ?? '')}`)
        break
      case 'remove':
        changed++
        lines.push(`  🪦 ${ansi.yellow('[remove]')}  ${where}${r.note ? `  ${ansi.dim(r.note)}` : ''}`)
        break
      case 'replace':
        changed++
        lines.push(`  🧨 ${ansi.green('[re-arm]')} ${where}`)
        break
      case 'link':
        changed++
        lines.push(`  💣 ${ansi.green('[link]')}   ${where}`)
        break
    }
  }
  const verb = command === 'unlink' ? 'decommissioned' : 'armed'
  lines.push(
    '',
    `${command}: ${changed} ${verb} · ${skipped} skipped${dryRun ? ' (dry run)' : ''}`,
  )
  process.stdout.write(`${lines.join('\n')}\n`)
  return { code: skipped > 0 ? 1 : 0, changed, skipped }
}

/**
 * After a link that changed something: a compact per-home tally of what is now
 * active, plus a restart notice. Newly linked skills/agents/commands live under
 * ~/.claude, which Claude Code reads at session start — a restart loads them.
 */
async function linkEpilogue(claudeHome: string, changed: number): Promise<void> {
  if (changed <= 0) return
  const all = await discoverForward(claudeHome)
  const tally: string[] = []
  for (const home of HOMES) {
    if (!home.enabled) continue
    let active = 0
    for (const item of all.filter((i) => i.home === home.name)) {
      if ((await classify(item.target, item.source)) === 'correct') active++
    }
    if (active) tally.push(`${home.name} ${active}`)
  }
  // Detonation scales with the size of the charge — bigger fuse, louder blast.
  const blast =
    changed >= 25 ? '💥💥💥 MASSIVE DETONATION 💥💥💥'
    : changed >= 10 ? '💥💥 major detonation'
    : changed >= 3 ? '💥 detonation'
    : 'a modest charge'
  const fuse = ansi.yellow(`🧨${'━'.repeat(Math.min(50, changed + 2))}💥`)
  process.stdout.write(
    `${[
      '',
      fuse,
      `💣  ${ansi.bold(`${changed} charge${changed === 1 ? '' : 's'} placed`)} — ${blast}`,
      `⭐  active now: ${tally.join(' · ') || 'none'}`,
      `🔄  ${ansi.bold('Restart your Claude Code session')} to load the newly`,
      `    armed skills / agents / commands.  ☠️`,
      fuse,
      '',
    ].join('\n')}\n`,
  )
}

/**
 * After an unlink that removed something: a tombstone flourish. If no owned
 * links remain, the site is fully cleared (the headstone); otherwise a quiet
 * one-line tally. Honest either way — the count is real.
 */
async function unlinkEpilogue(claudeHome: string, removed: number): Promise<void> {
  if (removed <= 0) return
  const all = await discoverForward(claudeHome)
  const orphans = await discoverOrphans(claudeHome, new Set(all.map((i) => i.target)))
  let remaining = 0
  for (const home of HOMES) {
    if (!home.enabled) continue
    remaining += (await removableInHome(all, orphans, home.name)).length
  }
  if (remaining > 0) {
    process.stdout.write(`\n🪦  ${removed} decommissioned · ${remaining} still standing.\n\n`)
    return
  }
  process.stdout.write(
    `${[
      '',
      `🪦  ${ansi.bold('SITE CLEARED')} — ${removed} link${removed === 1 ? '' : 's'} decommissioned.`,
      ansi.dim('       ┌─────────────┐'),
      ansi.dim('       │  R.  I.  P. │'),
      ansi.dim('       │   catalog   │'),
      ansi.dim('       │    links    │'),
      ansi.dim('    ───┴─────────────┴───'),
      ansi.dim('    The catalog returns to dormancy.'),
      '',
    ].join('\n')}\n`,
  )
}

/** Flag-mode `status`. */
async function flagStatus(claudeHome: string, f: Filters): Promise<void> {
  const all = await discoverForward(claudeHome)
  const forwardTargets = new Set(all.map((i) => i.target))
  const items = applyFilters(all, f)
  const orphans = filterOrphans(await discoverOrphans(claudeHome, forwardTargets), f)
  process.stdout.write(`${await renderStatus(claudeHome, items, orphans, f)}\n`)
}

/** Flag-mode `link`. */
async function flagLink(
  claudeHome: string,
  f: Filters,
  force: boolean,
  dryRun: boolean,
): Promise<number> {
  const items = applyFilters(await discoverForward(claudeHome), f)
  const result = renderActions('link', await runLink(items, force, dryRun), dryRun)
  if (!dryRun) await linkEpilogue(claudeHome, result.changed)
  return result.code
}

/** Flag-mode `unlink`. */
async function flagUnlink(
  claudeHome: string,
  f: Filters,
  dryRun: boolean,
): Promise<number> {
  const all = await discoverForward(claudeHome)
  const forwardTargets = new Set(all.map((i) => i.target))
  const items = applyFilters(all, f)
  const orphans = filterOrphans(await discoverOrphans(claudeHome, forwardTargets), f)
  const result = renderActions('unlink', await runUnlink(items, orphans, dryRun), dryRun)
  if (!dryRun) await unlinkEpilogue(claudeHome, result.changed)
  return result.code
}

/** A checkbox choice or a group separator. */
type Choice = Separator | { name: string; value: string; checked?: boolean; disabled?: string }

/** Targets shared by ≥2 catalog items — the clash set. */
function clashTargetSet(items: Item[]): Set<string> {
  const set = new Set<string>()
  for (const [target, group] of groupByTarget(items)) {
    if (group.length > 1) set.add(target)
  }
  return set
}

/** Live tallies for a set of items (states read from disk). */
async function statsFor(
  items: Item[],
  clashTargets: Set<string>,
): Promise<{ total: number; linked: number; clash: number }> {
  let linked = 0
  let clash = 0
  for (const item of items) {
    if (clashTargets.has(item.target)) {
      clash++
      continue
    }
    if ((await classify(item.target, item.source)) === 'correct') linked++
  }
  return { total: items.length, linked, clash }
}

/** Compact dim `(N · L linked · C clash)` summary for a branch node. */
function summaryLabel(s: { total: number; linked: number; clash: number }): string {
  const parts = [`${s.total}`]
  if (s.linked) parts.push(`${s.linked} linked`)
  if (s.clash) parts.push(`${s.clash} clash`)
  return ansi.dim(`(${parts.join(' · ')})`)
}

/** The subset of `items` that `link` could act on (missing or stale, not clashed). */
async function linkableItems(items: Item[], clashTargets: Set<string>): Promise<Item[]> {
  const out: Item[] = []
  for (const item of items) {
    if (clashTargets.has(item.target)) continue
    const state = await classify(item.target, item.source)
    if (state === 'missing' || state === 'wrong-ours') out.push(item)
  }
  return out
}

/** Confirm, link a precomputed scope, report, then show the restart notice. */
async function commitLink(scope: Item[], claudeHome: string): Promise<void> {
  if (!scope.length) return
  if (!(await confirm({ message: `💣 Arm ${scope.length} link${scope.length === 1 ? '' : 's'}?`, default: true }))) return
  const results: ActionResult[] = []
  for (const item of scope) results.push(await linkOne(item, true, false))
  const { changed } = renderActions('link', results, false)
  await linkEpilogue(claudeHome, changed)
}

/**
 * Leaf checkbox: one source+home's items. Clashes/conflicts shown disabled.
 * `preselect` pre-checks the linkable items — true only for project bundles
 * (linking a whole bundle is the common intent); top-level categories start
 * unselected so loose catalog items aren't linked by a reflexive Enter.
 */
async function leafLink(
  items: Item[],
  clashTargets: Set<string>,
  preselect: boolean,
  claudeHome: string,
): Promise<void> {
  const byTarget = new Map<string, Item>()
  const choices: Choice[] = []
  for (const item of [...items].sort((a, b) => a.name.localeCompare(b.name))) {
    byTarget.set(item.target, item)
    if (clashTargets.has(item.target)) {
      choices.push({ name: `💥 ${item.name}  (clash)`, value: item.target, disabled: 'resolve in catalog' })
      continue
    }
    const state = await classify(item.target, item.source)
    if (state === 'correct') {
      choices.push({ name: `⭐ ${item.name}  (linked)`, value: item.target, disabled: 'already linked' })
    } else if (state === 'occupied-real') {
      choices.push({ name: `🧱 ${item.name}`, value: item.target, disabled: 'real file present' })
    } else if (state === 'wrong-foreign') {
      choices.push({ name: `👽 ${item.name}`, value: item.target, disabled: 'foreign symlink present' })
    } else {
      choices.push({ name: `${item.name}${state === 'wrong-ours' ? '  🧨 (re-arm)' : ''}`, value: item.target, checked: preselect })
    }
  }
  if (!choices.some((c) => !(c instanceof Separator) && !c.disabled)) {
    process.stdout.write(ansi.dim('  💤 Nothing to arm here.\n'))
    return
  }
  const picked = await checkbox<string>({ message: '💣 Toggle items to arm', choices, pageSize: 20 })
  if (!picked.length) return
  const scope = picked.map((t) => byTarget.get(t)).filter((i): i is Item => Boolean(i))
  await commitLink(scope, claudeHome)
}

/** One choice in the link navigator. */
type LinkNav =
  | { t: 'leafTop'; home: string }
  | { t: 'leafBundle'; project: string; home: string }
  | { t: 'drillProjects' }
  | { t: 'drillBundle'; project: string }
  | { t: 'linkAll'; scope: Item[] }
  | { t: 'back' }

/**
 * Interactive `link` — a drill-down over the catalog tree:
 *   root → top-level categories + `projects/`
 *   projects/ → bundles
 *   bundle → its categories
 *   leaf → item checkbox
 * State is re-read each step so counts stay live as you link. Each branch
 * offers `✓ Link all linkable here`.
 */
async function interactiveLink(claudeHome: string): Promise<void> {
  type Level = { kind: 'root' } | { kind: 'projects' } | { kind: 'bundle'; project: string }
  const stack: Level[] = [{ kind: 'root' }]
  const enabledHomes = HOMES.filter((h) => h.enabled)

  while (stack.length) {
    const level = stack[stack.length - 1]
    if (!level) break
    const all = await discoverForward(claudeHome)
    const clashTargets = clashTargetSet(all)
    const choices: { name: string; value: LinkNav }[] = []
    let crumb = '💣 Link'

    if (level.kind === 'root') {
      for (const home of enabledHomes) {
        const items = all.filter((i) => i.project === null && i.home === home.name)
        if (!items.length) continue
        choices.push({
          name: `📂 ${`${home.name}/`.padEnd(12)} ${summaryLabel(await statsFor(items, clashTargets))}`,
          value: { t: 'leafTop', home: home.name },
        })
      }
      const projects = [...new Set(all.filter((i) => i.project !== null).map((i) => i.project as string))]
      if (projects.length) {
        choices.push({
          name: `📦 ${'projects/ ▸'.padEnd(12)} ${ansi.dim(`(${projects.length} bundle${projects.length > 1 ? 's' : ''})`)}`,
          value: { t: 'drillProjects' },
        })
      }
      const scope = await linkableItems(all, clashTargets)
      if (scope.length) choices.push({ name: ansi.green(`💣 Arm all linkable (${scope.length})`), value: { t: 'linkAll', scope } })
      choices.push({ name: '⬅️  Back', value: { t: 'back' } })
    } else if (level.kind === 'projects') {
      crumb = '💣 Link / projects'
      const projects = [...new Set(all.filter((i) => i.project !== null).map((i) => i.project as string))].sort()
      for (const project of projects) {
        const cats = [...new Set(all.filter((i) => i.project === project).map((i) => i.home))]
        choices.push({ name: `📦 ${`${project} ▸`.padEnd(16)} ${ansi.dim(cats.join(', '))}`, value: { t: 'drillBundle', project } })
      }
      const scope = await linkableItems(all.filter((i) => i.project !== null), clashTargets)
      if (scope.length) choices.push({ name: ansi.green(`💣 Arm all linkable in projects (${scope.length})`), value: { t: 'linkAll', scope } })
      choices.push({ name: '⬅️  Back', value: { t: 'back' } })
    } else {
      const project = level.project
      crumb = `💣 Link / projects / ${project}`
      for (const home of enabledHomes) {
        const items = all.filter((i) => i.project === project && i.home === home.name)
        if (!items.length) continue
        choices.push({
          name: `📂 ${home.name.padEnd(12)} ${summaryLabel(await statsFor(items, clashTargets))}`,
          value: { t: 'leafBundle', project, home: home.name },
        })
      }
      const scope = await linkableItems(all.filter((i) => i.project === project), clashTargets)
      if (scope.length) choices.push({ name: ansi.green(`💣 Arm all linkable in ${project} (${scope.length})`), value: { t: 'linkAll', scope } })
      choices.push({ name: '⬅️  Back', value: { t: 'back' } })
    }

    const action = await select<LinkNav>({ message: crumb, choices, pageSize: 20 })
    switch (action.t) {
      case 'back':
        stack.pop()
        break
      case 'drillProjects':
        stack.push({ kind: 'projects' })
        break
      case 'drillBundle':
        stack.push({ kind: 'bundle', project: action.project })
        break
      case 'linkAll':
        await commitLink(action.scope, claudeHome)
        break
      case 'leafTop':
        // top-level category: start unselected (no reflexive bulk-link)
        await leafLink(all.filter((i) => i.project === null && i.home === action.home), clashTargets, false, claudeHome)
        break
      case 'leafBundle':
        // project bundle: pre-check all linkable (linking the whole bundle is the norm)
        await leafLink(all.filter((i) => i.project === action.project && i.home === action.home), clashTargets, true, claudeHome)
        break
    }
  }
}

/** A link we own and may remove: a forward item (correct/stale) or an orphan. */
interface Removable {
  item: Item
  isOrphan: boolean
}

/** Owned links living in one home: deduped forward correct/stale links + orphans. */
async function removableInHome(
  all: Item[],
  orphans: Item[],
  home: string,
): Promise<Removable[]> {
  const out: Removable[] = []
  for (const group of groupByTarget(all.filter((i) => i.home === home)).values()) {
    const first = group[0]
    if (!first) continue
    const state = await classify(first.target, first.source)
    if (state === 'correct' || state === 'wrong-ours') out.push({ item: first, isOrphan: false })
  }
  for (const orphan of orphans.filter((o) => o.home === home)) out.push({ item: orphan, isOrphan: true })
  return out
}

/** Checkbox label for a removable link, annotated with its origin. */
async function unlinkLabel(entry: Removable): Promise<string> {
  if (entry.isOrphan) {
    return `☠️  ${entry.item.name}  ${ansi.dim(`(orphan → ${relSource(entry.item)})`)}`
  }
  const stale = (await classify(entry.item.target, entry.item.source)) === 'wrong-ours'
  return `${stale ? '🧨 ' : ''}${entry.item.name}  ${ansi.dim(`· ${originLabel(entry.item)}${stale ? ' (stale)' : ''}`)}`
}

/** Confirm + remove a set of owned links, then the tombstone flourish. */
async function runRemoval(entries: Removable[], claudeHome: string): Promise<void> {
  if (!entries.length) return
  if (!(await confirm({ message: `🪦 Decommission ${entries.length} link${entries.length === 1 ? '' : 's'}?`, default: true }))) return
  const results: ActionResult[] = []
  for (const entry of entries) {
    results.push(entry.isOrphan ? await unlinkOrphan(entry.item, false) : await unlinkOne(entry.item, false))
  }
  const { changed } = renderActions('unlink', results, false)
  await unlinkEpilogue(claudeHome, changed)
}

/**
 * Interactive `unlink` — a 2-tier drill over the *target*: `home → links`.
 * Links land flat in `~/.claude/<home>/`, so there is no project tier here;
 * each link is annotated with its origin instead. State is re-read each step
 * so a just-removed orphan never reappears as a phantom choice.
 */
async function interactiveUnlink(claudeHome: string): Promise<void> {
  type Level = { kind: 'root' } | { kind: 'home'; home: string }
  const stack: Level[] = [{ kind: 'root' }]
  const enabledHomes = HOMES.filter((h) => h.enabled)

  while (stack.length) {
    const level = stack[stack.length - 1]
    if (!level) break
    const all = await discoverForward(claudeHome)
    const orphans = await discoverOrphans(claudeHome, new Set(all.map((i) => i.target)))

    if (level.kind === 'root') {
      type Nav = { t: 'home'; home: string } | { t: 'all' } | { t: 'back' }
      const choices: { name: string; value: Nav }[] = []
      const everything: Removable[] = []
      for (const home of enabledHomes) {
        const removable = await removableInHome(all, orphans, home.name)
        if (!removable.length) continue
        everything.push(...removable)
        choices.push({
          name: `🪦 ${`${home.name}/`.padEnd(12)} ${ansi.dim(`${removable.length} owned`)}`,
          value: { t: 'home', home: home.name },
        })
      }
      if (!everything.length) {
        process.stdout.write(ansi.dim('🧹 No charges to clear.\n'))
        return
      }
      choices.push({ name: ansi.yellow(`🧹 Remove all owned (${everything.length})`), value: { t: 'all' } })
      choices.push({ name: '⬅️  Back', value: { t: 'back' } })
      const action = await select<Nav>({ message: '🪦 Unlink', choices, pageSize: 20 })
      if (action.t === 'back') return
      if (action.t === 'home') stack.push({ kind: 'home', home: action.home })
      else await runRemoval(everything, claudeHome)
    } else {
      const entries = await removableInHome(all, orphans, level.home)
      if (!entries.length) {
        process.stdout.write(ansi.dim('  🧹 Nothing to clear here.\n'))
        stack.pop()
        continue
      }
      const byTarget = new Map(entries.map((e) => [e.item.target, e]))
      const choices: Choice[] = []
      for (const entry of entries) {
        choices.push({ name: await unlinkLabel(entry), value: entry.item.target, checked: true })
      }
      const picked = await checkbox<string>({ message: `🪦 Remove from ${level.home}/`, choices, pageSize: 20 })
      if (picked.length) {
        const chosen = picked
          .map((t) => byTarget.get(t))
          .filter((e): e is Removable => Boolean(e))
        await runRemoval(chosen, claudeHome)
      }
      stack.pop()
    }
  }
}

/** Interactive top menu. The Link/Unlink navigators re-read state themselves. */
async function runInteractive(claudeHome: string): Promise<void> {
  for (;;) {
    const action = await select<'link' | 'unlink' | 'status' | 'exit'>({
      message: `🧨 ACME catalog  →  ${claudeHome}`,
      choices: [
        { name: '💣 Link items', value: 'link' },
        { name: '🪦 Unlink items', value: 'unlink' },
        { name: '📊 View full status', value: 'status' },
        { name: '🚪 Exit', value: 'exit' },
      ],
    })
    if (action === 'exit') {
      printTagline()
      return
    }
    if (action === 'status') {
      const all = await discoverForward(claudeHome)
      const orphans = await discoverOrphans(claudeHome, new Set(all.map((i) => i.target)))
      process.stdout.write(`${await renderStatus(claudeHome, all, orphans, {})}\n`)
    } else if (action === 'link') {
      await interactiveLink(claudeHome)
    } else {
      await interactiveUnlink(claudeHome)
    }
  }
}

function printUsage(): void {
  const homes = HOMES.filter((h) => h.enabled).map((h) => h.name).join('|')
  process.stdout.write(
    `${ansi.bold('💣 symlink')} — arm catalog items into ~/.claude\n\n` +
      `Usage: bun scripts/symlink.ts [status|link|unlink] [filters] [flags]\n` +
      `       bun scripts/symlink.ts            (bare TTY → interactive menu)\n\n` +
      `Commands:\n` +
      `  status            show every item and its link state (default)\n` +
      `  link              create/repair symlinks\n` +
      `  unlink            remove symlinks we own (incl. orphans)\n\n` +
      `Filters:\n` +
      `  --only <${homes}>\n` +
      `  --item <name>     restrict to one link basename\n` +
      `  --project <name>  restrict to items from one project bundle\n\n` +
      `Flags:\n` +
      `  --dry-run         print planned actions; change nothing\n` +
      `  --force           link: replace a stale OWNED link (never real/foreign)\n` +
      `  --home <path>     override ~/.claude root (also CLAUDE_SYMLINK_HOME)\n` +
      `  -h, --help\n\n` +
      `Hooks are deferred this round (need settings.json wiring — #12).\n` +
      `Symlinking a hook script alone does not make it fire.\n`,
  )
}

async function main(): Promise<void> {
  const rawArgs = process.argv.slice(2)
  const { values, positionals } = parseArgs({
    args: rawArgs,
    allowPositionals: true,
    options: {
      only: { type: 'string' },
      item: { type: 'string' },
      project: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
      force: { type: 'boolean', default: false },
      home: { type: 'string' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  })

  if (values.help) {
    printUsage()
    return
  }

  const command = positionals[0]
  if (command && command !== 'status' && command !== 'link' && command !== 'unlink') {
    process.stderr.write(ansi.red(`[error] unknown command: ${command}\n`))
    process.exit(2)
  }
  if (values.only && !HOMES.some((h) => h.enabled && h.name === values.only)) {
    const valid = HOMES.filter((h) => h.enabled).map((h) => h.name).join(', ')
    process.stderr.write(ansi.red(`[error] unknown category: ${values.only} (try: ${valid})\n`))
    process.exit(2)
  }

  const claudeHome = resolveClaudeHome(values.home)
  const filters: Filters = { only: values.only, item: values.item, project: values.project }
  const dryRun = values['dry-run']
  const force = values.force

  const hasFlags = rawArgs.some((a) => a.startsWith('-'))
  const interactive =
    !command && !hasFlags && Boolean(process.stdout.isTTY) && Boolean(process.stdin.isTTY)

  if (interactive) {
    await runInteractive(claudeHome)
    return
  }

  const cmd = command ?? 'status'
  if (cmd === 'status') {
    await flagStatus(claudeHome, filters)
    return
  }
  const code =
    cmd === 'link'
      ? await flagLink(claudeHome, filters, force, dryRun)
      : await flagUnlink(claudeHome, filters, dryRun)
  if (code !== 0) process.exit(code)
}

if (import.meta.main) {
  try {
    await main()
  } catch (error) {
    // Inquirer raises ExitPromptError on Ctrl-C — treat as a clean exit.
    if (error instanceof Error && error.name === 'ExitPromptError') {
      printTagline()
      process.exit(0)
    }
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(ansi.red(`[error] ${message}\n`))
    process.exit(2)
  }
}
