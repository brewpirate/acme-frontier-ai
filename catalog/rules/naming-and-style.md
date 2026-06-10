---
trigger_phrase:
  haiku: "typescript naming style conventions"
  opus: "typescript verbose naming readability conventions"
  sonnet: "verbose naming style rules"
---

# Naming and Style

## Enforcement

- `biome:useNumericSeparators` — auto-fixed numeric literal grouping
- `biome:noUselessTernary` / `noNestedTernary` — readability
- `biome:noConsole` — direct calls flagged outside exempt paths
- `.biome-plugins/naming.grit` (binding tiers) — single-char bindings (`warn`) and the abbreviation dictionary (`error`) on `JsIdentifierBinding` (const/let/var/params).
- `.biome-plugins/naming.grit` (property-key tiers) — the same single-char and abbreviation-dictionary checks on `JsLiteralMemberName` (object-literal keys, type/interface members), so `z.object({ n: … })` / `{ cnt: … }` are caught where the binding tiers structurally can't reach. Landed `warn`-only with ~81 existing fires (43 of them `ts`); **swept clean and promoted to `error` in #322** — matching the binding tier's ratchet. The sweep renamed `ts`→`timestamp` (incl. the `tool_calls` DB column, via a guarded `migrateRenameColumn` migration), `prs`→`pullRequests`, `auth`→`authMode`, `dir`→`direction`/`directory`, `cmd`→`command`, `acc`→`accumulator`, `lo`/`hi`→`low`/`high`. Two categories were exempted rather than renamed because the key is an external contract we don't own: `dest` (pino's `pino.destination({ dest })` option, removed from the abbreviation dictionary) and the single-char `p`/`a` react-markdown `components` element keys (added to the single-char exemption alongside `x`/`y`). SQL aliases inside template strings (`SELECT COUNT(*) AS n`) stay out of grit's reach — review-only until a `scripts/detect-*.ts` scanner exists.
- review-only — verbose names (no abbreviations), descriptive index/counter names (not bare `i`/`j`/`k`), function naming (action + subject), boolean prefixes, "one operation per line", thin routes
- Future candidate for `biome:useNamingConvention` once intentional snake_case API/DB/OTLP boundaries are scoped (deferred follow-up #203).

## Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Files (.ts) | kebab-case | `issue-service.ts` |
| Files (.tsx) | PascalCase | `ConfigPanel.tsx` (React convention) |
| Classes | PascalCase | `IssueProvider` |
| Functions | camelCase | `fetchIssueById` |
| Constants | SCREAMING_SNAKE | `MAX_RETRY_COUNT` |
| Interfaces | PascalCase (no I prefix) | `Issue`, not `IIssue` |
| Types | PascalCase | `IterationResult` |
| Zod schemas | PascalCase + Schema | `IssueSchema` |

## Verbose Names — No Abbreviations

Always use full, descriptive names. Never abbreviate.

```typescript
// WRONG — abbreviations and shorthand
const cfg = loadConfig()
const ctx = getContext()
const req = context.req
const res = await fetch(url)
const msg = 'Operation failed'
const cb = (error) => {}
const idx = items.indexOf(target)
const el = document.querySelector('.modal')
const evt = new CustomEvent('change')
const btn = document.querySelector('button')
const auth = getAuthState()

// CORRECT — full descriptive names
const config = loadConfig()
const context = getContext()
const request = context.req
const response = await fetch(url)
const message = 'Operation failed'
const handleError = (error) => {}
const index = items.indexOf(target)
const element = document.querySelector('.modal')
const event = new CustomEvent('change')
const button = document.querySelector('button')
const authentication = getAuthState()
```

### Self-Documenting Variables

```typescript
// WRONG
const cnt = issues.filter(issue => issue.state === 'NEW').length
const d = new Date()

// CORRECT
const newIssueCount = issues.filter(issue => issue.state === 'NEW').length
const createdAt = new Date()
```

### Function Names: Action + Subject

```typescript
// WRONG — vague or generic
function getItem(id: string) { ... }
function handle(data: unknown) { ... }
function process(issue: Issue) { ... }

// CORRECT — specific action + subject
function fetchIssueById(issueId: string) { ... }
function parseTriageResponse(data: unknown) { ... }
function validateTransition(issue: Issue) { ... }
```

### Boolean Naming: `is/has/should/can` Prefix

```typescript
// WRONG
const locked = checkLock(issueId)
const children = issue.children.length > 0
const retry = attemptCount < maxRetries

// CORRECT
const isLocked = checkLock(issueId)
const hasChildren = issue.children.length > 0
const shouldRetry = attemptCount < maxRetries
```

### Loop and Callback Variables: Name the Element

Gated by `.biome-plugins/naming.grit` info tier — flags iteration
callbacks (`.map` / `.filter` / `.find` / `.forEach` / `.some` /
`.every` / `.flatMap` / `.reduce`-element) and `for (let|const X …)`
loops whose variable is generic (`index`, `count`, `value`, `result`,
`data`, `item`, `entry`, `text`, `name`, `id`, `obj`, `arr`).

```typescript
// WRONG — single-char or generic names
issues.filter(x => x.state === 'NEW')
for (const i of items) { ... }
entries.map(entry => entry.timestamp)
sessions.map(item => item.id)

// CORRECT — named for what the collection iterates
issues.filter(issue => issue.state === 'NEW')
for (const issue of issues) { ... }
entries.map(dirEntry => dirEntry.timestamp)
sessions.map(session => session.id)
```

**Secondary benefit — scope hygiene.** Generic iteration names
(`name`, `id`, `value`) collide more easily with outer-scope
identifiers than specific ones (`themeName`, `sessionId`,
`payloadEntry`); when both bindings share a name, both versions
type-check and the shadow is invisible at review. The mechanical
rename forces every reference inside the callback to be re-checked
against the renamed binding, which surfaces stale references the
type-checker can't. Treat each info-tier fire as a chance to verify
scope, not as a style nit.

### Out of scope for the iteration-context match (not active carve-outs)

The info tier is **scoped to iteration contexts** specifically because
the surrounding collection names the better variable. There is no
exemption logic for the shapes below — the iteration-scoped AST
match simply doesn't reach them. The earlier broad
`JsIdentifierBinding` match was tried in PR #302 and produced
~70% library-idiom floor noise at the time of that PR (re-measure
before citing that number as still authoritative):

| Shape | Why exempt |
|---|---|
| `const { data, isLoading } = useX()` | TanStack Query field name is `data`; aliasing every site is verbose for marginal benefit |
| `const { id } = context.req.valid('param')` | Hono validation destructure matches the route param schema name directly |
| `tickFormatter={(value: number) => …}` | Recharts callback API |
| `methodName: (id: string, name: string) => …` | Single-purpose API method param shorthand; domain-anchored |
| `const [text, setText] = useState('')` | `useState` convention — the surrounding `setX` setter disambiguates |
| `const result = …` standalone locals | Judgement call best left to review rather than a gate |

If a NEW shape surfaces high-signal fires that aren't covered above,
extend the gate (in `.biome-plugins/naming.grit`'s third tier) by
adding the specific AST pattern rather than reverting to a broader
`JsIdentifierBinding` match.

### Destructuring: Don't Rename to Abbreviations

```typescript
// WRONG
const { sessionId: sid, issueId: iid } = options

// CORRECT
const { sessionId, issueId } = options
```

### Index and Counter Variables: Name What They Walk

An index or counter is a name like any other — `i` tells the reader nothing about
what's being walked. Name it for the collection it indexes or the quantity it
counts: `rowIndex`, `dayOffset`, `attempt`. The old "single-char loop counter"
carve-out is gone — `for (let i …)` is not exempt.

```typescript
// WRONG
for (let i = 0; i < rows.length; i++) { render(rows[i]) }
rows.map((row, i) => <Row key={i} />)

// CORRECT
for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) { render(rows[rowIndex]) }
rows.map((row, rowIndex) => <Row key={rowIndex} />)
```

The naming gate (`.biome-plugins/naming.grit`) info tier now fires on
`for (let index = …)` / `for (const index of …)` directly (no longer
review-only after the sweep in #302). The single-char allowlist
(`i`/`j`/`k`) at the warn tier is unchanged — those are exempt loop
counters; the info-tier fires above are about the `index` / `count`
class of generic-but-verbose names. `n` is *not* exempt — it is never
a loop counter in this codebase, only a mis-named count.

**Remaining exception**: math/unit abbreviations in pure formatting functions
(`s`, `m`, `h`, `d` for seconds/minutes/hours/days).

## Readability Over Cleverness

```typescript
// WRONG — clever one-liner
const status = issues.filter(issue => issue.state === 'STUCK').length > 0 ? 'degraded' : 'healthy'

// CORRECT — clear and scannable
const stuckIssues = issues.filter(issue => issue.state === 'STUCK')
const status = stuckIssues.length > 0 ? 'degraded' : 'healthy'
```

## One Operation Per Line

```typescript
// WRONG — hidden side effects
users.push(currentUser = await fetchUser(id))

// CORRECT — separate operations
const currentUser = await fetchUser(id)
users.push(currentUser)
```

## Explicit Over Implicit

```typescript
// WRONG — falsy check catches 0 and ''
if (value) { ... }
if (array.length) { ... }

// CORRECT — explicit checks
if (value !== null && value !== undefined) { ... }
if (array.length > 0) { ... }
```

## No Magic Numbers

Extract numeric literals to named constants:

```typescript
// WRONG
if ((Date.now() - ts) / 1000 > 300) { ... }

// CORRECT
const OTEL_WARNING_THRESHOLD_SECONDS = 300
if ((Date.now() - ts) / 1000 > OTEL_WARNING_THRESHOLD_SECONDS) { ... }
```

**Acceptable**: universally understood values (`index + 1`, `percentage / 100`, `array.slice(0, 1)`), and math constants inside pure formatting functions (e.g., `seconds % 60`, `hours * 3600`).

## `process.env` Access

### Enforcement

- `biome:style/noProcessEnv` (error) — flags every `process.env.X` read; allowlist scoped via `biome.json` `overrides`. Zero fires at the current ratchet.

### Rule

Every server runtime read of `process.env` flows through `packages/server/config.ts`. Call sites import `config` and read `config.dbPath`, `config.port`, etc.; they never touch `process.env` directly.

```typescript
// WRONG — touches process.env in a route/lib file
const port = parseInt(process.env.PORT ?? '8765', 10)

// CORRECT — read the validated, typed surface from config.ts
import { config } from '../config'
const port = config.port
```

`config.ts` does two passes through env at module load:

1. Eager `EnvSchema.safeParse(process.env)` — fail-fast at startup on malformed values.
2. Lazy property getters per field — each access re-reads `process.env` so per-test `process.env.X = ...` mutations are picked up by production code on the next call.

### Allowlist (per `biome.json` `overrides`)

The seam — `process.env` reads pass `noProcessEnv` here only:

| Path | Why |
|---|---|
| `packages/server/config.ts` | The seam itself — the only runtime layer that reads `process.env` |
| `packages/server/scripts/**` | One-shot operator scripts; tooling, not runtime |
| `packages/dashboard/scripts/**` | Build scripts |
| `packages/dashboard/playwright.config.ts` | Test framework config |
| `packages/core/src/logger/**` | Bootstrapping read (`LOG_LEVEL`) that runs before `config.ts` is importable |

Tests are excluded from biome globally via `files.includes` (`!!**/tests`), so `process.env.X = ...` test setup doesn't fire the gate.

### How to apply

If a new runtime call site needs an env var:

1. Add the field to `EnvSchema` in `config.ts`.
2. Add a getter that returns the validated/defaulted value.
3. Read `config.<field>` at the call site.

Never add a new path to the allowlist for runtime code. The allowlist is documented above and any addition is a confession that `config.ts` is missing a field — fix that instead.

## DRY & Reuse

See `dry-and-reuse.md` — the canonical rule for duplication prevention and pattern reuse: grep-before-writing, where reuse lives (`@magpie/core` for cross-boundary vocabularies, `lib/` for intra-package), extract-at-3+ (and not before), and the `scanner:duplication` ratchet.

## Thin Routes

Routes handle HTTP concerns (parsing, status codes). Business logic lives in `lib/` functions.

```typescript
// CORRECT — thin route delegates to lib
app.post('/sessions/sync', (c) => {
  syncSessions(db).catch((_e) => {})
  return c.json({ started: true })
})

// WRONG — business logic inline in route
app.post('/sessions/sync', async (c) => {
  const files = readdirSync(claudeDir)
  for (const file of files) { /* 50 lines of parsing */ }
  return c.json({ synced: count })
})
```

Biome auto-enforces: `noConsole`, `noNestedTernary`, `noUselessTernary`, `noUselessTypeConstraint`. See `hard-requirements.md` for details.
