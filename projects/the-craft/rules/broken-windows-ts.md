---
trigger_phrase:
  haiku: "typescript code quality ratchet"
  opus: "typescript broken windows quality ratchet"
  sonnet: "typescript broken windows ratchet"
always_on: false
applies_to: [typescript, javascript]
---

# Broken Windows — TypeScript / JavaScript

TypeScript and JavaScript tooling and conventions for the patterns in `broken-windows-general.md`. Load alongside the general rule; this file supplies the language-specific commands, tools, and idioms.

If you're working in pure JavaScript, ignore the TypeScript-specific tooling (tsc, type-related rules) and apply the rest.

## Verification Suite — TS/JS Specifics

Adapt the exact commands to your project's setup. Typical Node.js / TypeScript projects use some combination of:

```bash
# Type checking
tsc --noEmit                # or: npm run typecheck

# Test suite
npm run test                # Vitest, Jest, Mocha, Node test runner, etc.

# Linting / formatting
npm run lint                # Biome, ESLint
npm run format              # Biome, Prettier

# Build verification
npm run build               # Tsup, esbuild, Vite, Webpack, etc.

# Composite gate (common pattern)
npm run check:all           # often: typecheck + lint + format-check
```

Your project's exact commands live in `package.json` scripts and in `CLAUDE.md`. If a `check:all` (or equivalent) composite script exists, that's the single command to run before declaring work done.

## Broken Window Categories — TS/JS Forms

### Verification Suite Failures

Any test that was passing before your changes must still pass after. If you find a pre-existing failure (`npm run test` reports a failure unrelated to your work), fix it.

### Static Analysis Violations

- **Type errors** — `tsc --noEmit` must produce zero errors. Fix any you find. Do not silence with `// @ts-expect-error`, `// @ts-ignore`, `as any`, or `as unknown as X` (see `agent-discipline-ts.md`).
- **Lint violations** — Biome, ESLint, or whatever linter the project uses must report zero violations. Fix them. Do not disable rules inline (`// eslint-disable-next-line`) to make them pass — fix the underlying issue.
- **Format violations** — `npm run format` (Biome, Prettier) must produce no changes. If it does, the file wasn't formatted; run it and commit the result.

### Dead Code

- Commented-out code blocks (`// const oldImpl = ...` spanning multiple lines)
- Unused imports (most TS linters catch these — surface and remove)
- Unused variables, parameters, and exports
- Unreachable branches (often surfaced by TS with `error TS7027` or by linters)
- Orphan files: modules with no importers anywhere in the codebase. Run a quick check: `grep -r "from.*<module-name>" src/` — if there are zero references, the file is orphaned. Delete.

### Documentation Gaps

JSDoc/TSDoc on exported symbols (depending on project convention):

```ts
// Wrong (exported with no doc)
export function parseRequest(buf: Buffer): Request { ... }

// Right
/**
 * Parses a binary request payload into a Request object.
 * @throws DataError if the buffer is malformed or truncated.
 */
export function parseRequest(buf: Buffer): Request { ... }
```

Match the project's convention (some require `@param`/`@returns`, some don't; some use TSDoc strict mode). Look at neighboring exports.

### Magic Values

Extract literals to constants per `agent-discipline-ts.md` — same standard.

### Duplication

Before writing a new helper, search:

```bash
grep -rn "<pattern>" src/ --include="*.ts" --include="*.tsx"
```

If the pattern appears in two or more files, extract to a shared utility. Common modules for this:

- `src/utils/` — generic helpers
- `src/lib/` — project-specific shared logic
- `<package>/<scope>/utils.ts` — when working in a monorepo

Check the project's existing convention before creating a new utils directory.

## Build Output (for projects that bundle)

For TypeScript projects that bundle to a specific runtime (browser, edge worker, embedded JS runtime, etc.), the bundled output has its own broken-window category: runtime-incompatible code that compiled fine but won't execute in production.

After `npm run build`, inspect the output for:

- ES module syntax (`import`/`export`) when the runtime expects CommonJS or a different format
- Node.js globals (`Buffer`, `process`, `__dirname`) when targeting a runtime that lacks them
- Modern JS features beyond the runtime's supported version (e.g., `Array.prototype.at()` on a pre-ES2022 target)
- Dead code that the bundler didn't tree-shake (unused imports surviving the build)
- Source-map references when production builds shouldn't include them

The project's `CLAUDE.md` should specify runtime constraints. If a `check:build` or post-build verification script exists, run it.

## Order — TS/JS Workflow

1. Complete primary task
2. Run `npm run check:all` (or the project's composite gate)
3. Run `npm run test`
4. If a build step is part of the change path, run `npm run build` and verify the output
5. Fix any broken windows surfaced
6. Re-run the relevant checks to confirm a clean state

Skipping step 4 is the most common silent-bug path on projects that bundle for non-Node runtimes — type checks and tests pass against the source, but the bundled output is what runs in production.
