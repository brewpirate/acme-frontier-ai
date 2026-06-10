---
trigger_phrase:
  haiku: "typescript agent discipline syntax"
  opus: "typescript agent discipline syntax suppressions"
  sonnet: "typescript todos suppressions const"
always_on: false
applies_to: [typescript, javascript]
---

# Agent Discipline — TypeScript / JavaScript

TypeScript and JavaScript syntax for the patterns in `agent-discipline-general.md`. Load alongside the general rule; this file supplies the language-specific surface forms.

If you're working in pure JavaScript, ignore the TypeScript-specific directives below and apply the rest.

## Output Anti-Patterns — TS/JS Surface Forms

### Abandonment Markers (No TODOs)

Do not leave these comment patterns in delivered code:

```ts
// TODO: ...
// FIXME: ...
// HACK: ...
// XXX: ...
```

Block-comment variants count too:

```ts
/* TODO: ... */
/** @todo ... */
```

If something genuinely cannot be done within scope, file an issue and reference it from the PR description — not from a code comment.

### No Type Suppression in Tests

Never use type-error suppression to make a test pass:

```ts
// @ts-expect-error  ← suppresses a type error
// @ts-ignore        ← suppresses any error on the next line
// @ts-nocheck       ← disables type checking for the whole file
```

If a test produces a type error, the test is exercising something the types don't allow. That's a finding to investigate, not a directive to silence. Same applies to `any` casts inserted solely to make a test compile — that's type suppression by another name.

Production code may legitimately need suppression in narrow cases (third-party library missing types, etc.), but those require an inline comment explaining why and ideally a tracking issue. In tests, the bar is higher: don't suppress at all.

### No Test Disabling

These patterns silently disable tests:

```ts
test.skip(...)
it.skip(...)
describe.skip(...)
test.only(...)        // disables every other test in the file
xit(...)              // Jasmine-style skip
xdescribe(...)
```

And these:

```ts
if (process.env.CI) {
  // test body, skipped when CI is set
}
```

Or `.filter()` calls on test arrays that exclude failing cases. None of these are acceptable as a way to make the suite pass.

The exception is intentional skip with a tracked-issue comment:

```ts
// Skipped: flaky on Windows CI runner — issue #1234
test.skip("handles file paths with backslashes", ...)
```

Even then, the comment must explain *why* and reference where the fix work lives. A bare `.skip()` is not acceptable.

### No Magic Values

Extract literal strings, numbers, and paths to named constants:

```ts
// Wrong
if (response.status === 429) { ... }
setTimeout(retry, 5000);
const apiUrl = "https://api.example.com/v2/users";

// Right
const STATUS_RATE_LIMITED = 429;
const RETRY_DELAY_MS = 5000;
const USERS_API_URL = "https://api.example.com/v2/users";

if (response.status === STATUS_RATE_LIMITED) { ... }
setTimeout(retry, RETRY_DELAY_MS);
```

Place constants at the top of the file (or in a dedicated `constants.ts` if shared across modules). Use `SCREAMING_SNAKE_CASE` for true constants; `camelCase` for module-level configuration that's still constant-ish (e.g., `defaultRetryConfig`).

Exception: tiny literal constants where naming would obscure meaning (e.g., `arr.slice(0, 1)`, `x * 2`) are fine inline. The bar is: would a reviewer have to guess what this value means?

---

## STUCK — TS/JS Notes

Standard STUCK criteria apply (see `agent-discipline-general.md`). One TS-specific note:

If you find yourself adding `// @ts-expect-error`, `as any`, or `as unknown as X` to make production code compile, that's a STUCK signal. The type system is telling you the change you're making isn't safe. Stop, surface the conflict, ask whether the type model needs updating or the change needs rethinking.

Don't fight the type system with suppressions — fight it with type updates, or stop fighting and surface.
