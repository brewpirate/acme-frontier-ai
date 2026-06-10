---
paths:
  - "packages/**/*.{ts,tsx}"
trigger_phrase:
  haiku: "grep before writing reuse dont duplicate"
  opus: "DRY reuse existing patterns grep before writing"
  sonnet: "DRY reuse patterns grep before writing"
---

# DRY & Pattern Reuse

## Enforcement

- `scanner:duplication` — `bun scripts/detect-duplication.ts`, runs in pre-commit **and** CI. Occurrence #3 of any pattern in `KNOWN_PATTERNS` is a **CI failure**, not a warning. The scanner is a *ratchet*: it only catches patterns already added to `KNOWN_PATTERNS`. This is the **pattern** ratchet — it catches *inline expressions* someone wrote a regex for.
- `scanner:fallow-dupes` — `bun scripts/detect-fallow.ts` (run via the `scripts/scan.ts` harness), runs in pre-commit **and** CI. This is the **structural** complement to `scanner:duplication`: it runs [`fallow`](https://docs.fallow.tools)'s suffix-array clone detector over the whole tree and catches copy-pasted **blocks** (runs of ≥5 lines / ≥50 tokens appearing 2+ times) that no regex was ever written for. It is keyed by fallow's content **fingerprint** (`dup:<8hex>`) against a committed baseline (`scripts/fallow-dupes-baseline.json`); a clone group whose fingerprint is **absent** from the baseline is new duplication and **fails the gate**. Fingerprints (not file:line ranges) are the key because they survive unrelated line shifts — an edit above a grandfathered clone must not flag it as new. fallow is pinned to an exact version in `package.json` and its detection parameters are pinned in `.fallowrc.jsonc`, so fingerprints stay deterministic across machines and CI. See "Feeding the structural ratchet" below.
- review-only — **discovering new duplication** neither scanner yet tracks; **semantic duplication** where copies share a concept but not a syntax (e.g. two pricing tables with different field names — regex can't see it, and structural detection only catches it in `semantic` mode, which the gate does not enable by default); the judgment of whether similarity is real duplication or coincidence.

## Why this rule is about habits, not willpower

DRY is a **global** property of the codebase; the author of any one file has a **local** view. When you write `type Range = 'today' | '7d' | '30d'` in a panel, you usually cannot see the 39 other panels that wrote the same line — in other files, in other sessions. So "extract at 3+ repetitions" fails silently: the author of copy #3 doesn't know they're #3.

This rule therefore isn't "remember to be DRY." It's **mechanical habits that compensate for the local view**, plus knowing **where reuse lives** so importing is cheaper than re-inventing. The failure mode is never unwillingness — it's invisibility.

## Before you write — grep first

Before introducing any of these, search for an existing version *first*:

- A **derived expression** (path resolution, string/number formatting, date math, a config lookup) → grep the pattern. If it exists in 2+ files there should be a helper; if you'd be occurrence #3, extract the helper *now* instead of adding the copy.
- A **literal union or constant array** (`'today' | '7d' | '30d'`, status sets, a model list) → grep for it. These are *vocabularies* and belong in one place (see the table below).
- A **type or interface for data that crosses a module/API boundary** → check `@magpie/core` first; it may already be a Zod schema (see `zod-schemas.md`).
- A **helper, formatter, or utility** → check the package's `lib/` (or `@magpie/core` for cross-package) before writing a new one.

One grep before writing costs nothing. Forty inline copies cost a multi-day cleanup when the value changes (see #278 range presets, #192 F7 model pricing).

## Where reuse lives (reach here before re-inventing)

| Need | Home |
|---|---|
| Vocabulary/type crossing server↔dashboard (presets, enums, model lists, response shapes) | `@magpie/core` — `as const` + Zod enum / schema |
| Logic used by 2+ files within one package | that package's `lib/` |
| Dashboard UI primitive | `packages/dashboard/src/components/ui/` |
| Dashboard formatter / display helper | `packages/dashboard/src/lib/format.ts` |
| SQL reused across routes | `packages/server/lib/queries/` (via `defineQuery`) |

**Cross-boundary vocabularies are never hand-redeclared.** A constant set used by both server and dashboard (range presets, model lists, status enums) lives in `@magpie/core` as `as const` + a Zod enum — exactly once.

## Extract at 3+ — and not before

- **3+ occurrences → extract.** 1–2 → inline; do not abstract speculatively.
- **Three similar lines beat a premature abstraction.** An abstraction with one real caller and two hypothetical ones couples code that may need to evolve apart — worse than the duplication it "solves."
- **DRY applies to *knowledge*, not incidental similarity.** The test: *if requirement X changes, must all copies change together?* **Yes** → they're duplicates, DRY them. **No** → they were never duplicates; coupling them creates a false dependency. Two functions with the same shape but different domain rules stay separate.

## When you consolidate, feed the ratchet

After removing inline copies and extracting a helper, **add the inline pattern's regex to `KNOWN_PATTERNS` in `scripts/detect-duplication.ts`** so the gate catches the regression. Do not delete the entry later — a clean pattern with the entry in place is the gate doing its job. Land the entry **after** the sites are clean, or it blocks its own introduction (the scanner runs in pre-commit + CI). See `broken-windows.md` for the ratchet posture.

## Feeding the structural ratchet

The `scanner:fallow-dupes` gate maintains its own ratchet differently — you do **not** hand-curate it like `KNOWN_PATTERNS`:

- **New duplication you should fix.** When the gate fails with a new clone group, the default answer is to extract the duplicated block to a shared helper (see "Where reuse lives" above). The gate clears itself once the clone is gone — no baseline edit needed.
- **New duplication that is genuinely intentional** (framework boilerplate the detector can't tell apart, two blocks that look alike but encode different domain knowledge — apply the knowledge test above): regenerate the baseline with `bun run dupes:baseline` and commit `scripts/fallow-dupes-baseline.json`. The diff shows exactly which fingerprints you accepted — keep that diff small and reviewable.
- **Removing a grandfathered clone.** When you refactor away an existing clone, its fingerprint just becomes a harmless stale entry in the baseline — it fails nothing. Trim it (and keep the baseline honest) by regenerating with `bun run dupes:baseline` as part of the same change.
- **Do not hand-edit the baseline file.** It is generated machine state (like a lockfile). Always regenerate it through the script so the fingerprints match what the pinned fallow version actually emits.

## What is NOT a DRY violation

- Two occurrences (extract on the third, not the second).
- Code that looks similar but encodes different domain knowledge (apply the knowledge test above).
- `*Opts` parameter bags and Hono route-handler shapes (per `zod-schemas.md` exemptions).
- Framework-required boilerplate (route registration, React component scaffolding, migration files).
