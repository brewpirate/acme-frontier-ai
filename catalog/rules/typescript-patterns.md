---
paths:
  - "packages/**/*.{ts,tsx}"
trigger_phrase:
  haiku: "typescript safety patterns enforced"
  opus: "strict typescript type safety rules"
  sonnet: "strict typescript safety enforcement rules"
---

# TypeScript Patterns

## Enforcement

- `tsc strict` — no implicit any, strict null checks, exhaustive return types in some configs
- `biome:useExhaustiveSwitchCases` — discriminated union switch coverage
- `scanner:discipline` — bans `@ts-ignore` (use `@ts-expect-error` with reason)
- `scanner:duplication` — bans `.all()/.get(...) as <Type>` casts that bypass `defineQuery` + a validated row schema (per #236)
- `biome:useExplicitType` (error) — explicit return types on functions and explicit types on variable declarations, repo-wide (#202)
- review-only — `??` over `||`, `readonly` params, `as const` / `satisfies` usage

## No `any` Type

Use `unknown` with Zod validation or type guards.

```typescript
// WRONG
function processData(data: any) { return data.value }

// WRONG — unsafe cast
function processData(data: unknown) { return (data as Session).session_id }

// CORRECT — Zod validation
function processData(data: unknown): Session {
  return SessionSchema.parse(data)
}

// CORRECT — type guard
function isSession(data: unknown): data is Session {
  return SessionSchema.safeParse(data).success
}
```

## No `@ts-ignore` — Use `@ts-expect-error` with Justification

```typescript
// WRONG
// @ts-ignore
const result = bunSpecificApi()

// CORRECT — with explanation
// @ts-expect-error — Bun embeds .css text imports; tsc lacks declaration
import styles from './styles.css' with { type: 'text' }
```

## Explicit Return Types on Exported Functions

```typescript
// WRONG
export function buildSyncQuery(db: Database) { ... }

// CORRECT
export function buildSyncQuery(db: Database): Statement { ... }
```

## `as const` for Constants

Preserves literal types and enables type derivation from values:

```typescript
const STOP_REASONS = ['end_turn', 'max_tokens', 'tool_use'] as const
type StopReason = typeof STOP_REASONS[number]

const SOURCE_TYPES = {
  IDE: 'ide',
  CLI: 'cli',
} as const
```

## `satisfies` for Type Checking Without Widening

```typescript
// Validates shape while preserving literal types
const SEVERITY_COLORS = {
  ok: 'status-green',
  warn: 'status-amber',
  alert: 'status-red',
} as const satisfies Record<string, string>

SEVERITY_COLORS.ok  // type: 'status-green' (not string)
```

## Nullish Coalescing `??` Over Falsy `||`

```typescript
// WRONG — catches 0 and ''
const port = process.env.PORT || 8765

// CORRECT — only catches null/undefined
const port = process.env.PORT ?? 8765
```

**Exception**: `|| 0` is correct when guarding against `NaN` (e.g., `parseInt(value) || 0`).

## Discriminated Unions via Zod

Prefer `z.discriminatedUnion()` over hand-written type unions. See `zod-schemas.md`.

## `readonly` for Function Parameters

Prevent accidental mutation of arrays passed to functions:

```typescript
function summarise(rows: readonly SessionRow[]): Summary {
  return rows.reduce(...)
}
```

## Type Predicates for Runtime Narrowing

```typescript
function isError(value: unknown): value is Error {
  return value instanceof Error
}
```

## Exhaustive Switch with `never`

Use when switching on a union type to get compile-time exhaustiveness checking:

```typescript
function severityLabel(s: 'ok' | 'warn' | 'alert'): string {
  switch (s) {
    case 'ok': return 'Healthy'
    case 'warn': return 'Warning'
    case 'alert': return 'Critical'
    default: {
      const _exhaustive: never = s
      throw new Error(`Unhandled severity: ${_exhaustive}`)
    }
  }
}
```

## `any` in Tests

`as any` is acceptable in test files for intentionally constructing invalid states:

```typescript
// @ts-expect-error — intentionally testing invalid input
await router.fetch(makeRequest('POST', '/', { prompt: 123 as any }))
```
