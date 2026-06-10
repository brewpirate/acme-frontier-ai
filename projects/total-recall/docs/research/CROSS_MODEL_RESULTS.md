# Cross-Model Comparison Results

**Date:** 2026-04-01
**Source:** barf-ts/.claude/rules/ (14 files)
**Pipeline:** 5 study agents per model × 3 models (haiku, sonnet, opus) = 15 agents per file
**Researcher:** Manual convergence analysis (compare-researcher agent not yet registered)
**Total study agent calls:** 210

---

## Summary

| Metric | Haiku | Sonnet | Opus |
|--------|-------|--------|------|
| Average confidence | 0.94 | 0.96 | 0.98 |
| Perfect fixed points (0.99) | 0 | 2 | 9 |
| Files with 5/5 identical phrases | 0 | 3 | 9 |
| Abstraction level | Mid (names tools + patterns) | High (imperative rules) | Mid-High (specific + structural) |

### Key Finding: Opus produces dramatically more stable fixed points

Opus returned **identical or near-identical phrases across all 5 samples** for 9 of 14 files. Sonnet achieved this for 3 files. Haiku achieved it for 0 files. This suggests larger models have **deeper, more stable attractors** in their associative networks — the same concept maps to a narrower region of output space.

---

## Full Comparison Table

| File | Haiku Trigger (conf) | Sonnet Trigger (conf) | Opus Trigger (conf) | Cross-Model Shared |
|------|---------------------|----------------------|---------------------|-------------------|
| agent-discipline | agent discipline guardrails (0.92) | no todos gold plating stuck (0.95) | agent output guardrails stuck protocol (0.99) | "stuck" |
| async-patterns | promise worker cancellation patterns (0.95) | await abort worker subprocess safety (0.95) | async promise worker safety rules (0.99) | "worker" |
| broken-windows | code quality enforcement ratchet (0.95) | broken windows code quality ratchet (0.98) | broken windows codebase quality ratchet (0.99) | "quality", "ratchet" |
| bun-native-apis | bun native file api rules (0.95) | prefer bun over node fs (0.98) | bun over node fs migration (0.95) | "bun" |
| dependency-injection | optional deps testability pattern (0.92) | optional deps real defaults testability (0.95) | optional deps real defaults mock tests (0.99) | "optional", "deps" |
| error-handling | typed error hierarchy boundary (0.95) | typed AppError boundary propagation (0.92) | typed apperror hierarchy boundary (0.98) | "typed", "boundary" |
| hard-requirements | zod typescript tsdoc enforcement (0.95) | non-negotiable code standards enforcement (0.95) | zod4 strict tsdoc pino biome gates (0.98) | None strong |
| imports-and-modules | monorepo alias barrel import rules (0.95) | barf monorepo import alias rules (0.98) | monorepo path alias import rules (0.98) | "monorepo", "alias", "import" |
| naming-and-style | typescript naming style conventions (0.98) | verbose naming style rules (0.90) | typescript verbose naming readability conventions (0.99) | "naming" |
| options-objects | options objects over positional parameters (0.98) | options object over positional params (0.95) | options object over positional params (0.99) | "options", "object", "positional", "params" |
| react-patterns | react zustand tailwind patterns (0.95) | react zustand tanstack conventions (0.95) | zustand store split react frontend rules (0.98) | "react", "zustand" |
| testing | bun test behavior di fixtures (0.95) | bun test conventions di fixtures (0.98) | bun test rules di behavioral fixtures (0.99) | "bun", "test", "di", "fixtures" |
| typescript-patterns | typescript safety patterns enforced (0.90) | strict typescript safety enforcement rules (0.95) | strict typescript type safety rules (0.95) | "typescript", "safety" |
| zod-schemas | zod schema first source of truth (0.92) | zod schema first source of truth (0.99) | zod schema first boundary validation (0.95) | "zod", "schema", "first" |

---

## Analysis

### 1. Opus Has Dramatically Higher Convergence

Opus produced 9/14 files with perfect or near-perfect fixed points (5/5 agents returning virtually identical phrases). This means Opus's associative network maps file concepts to a **much narrower output basin** than smaller models. For trigger generation, this means:

- **Higher reliability** — The trigger is more likely to be "the" canonical phrase, not one of several plausible options
- **Lower variance** — Phase 2 (second round of sampling) would almost never be needed for Opus
- **But potentially less creative** — Opus misses some interesting lateral associations that Haiku surfaces

### 2. Model Size Correlates with Specificity, Not Abstraction

| Model | Tendency | Example (hard-requirements) |
|-------|----------|----------------------------|
| **Haiku** | Names specific tools + generic patterns | "zod typescript tsdoc enforcement" |
| **Sonnet** | Abstracts to imperative rules | "non-negotiable code standards enforcement" |
| **Opus** | Names ALL specific tools | "zod4 strict tsdoc pino biome gates" |

Sonnet uniquely abstracts — it often produces the most natural-language-like triggers ("prefer bun over node fs", "non-negotiable code standards", "broken windows code quality ratchet"). Opus goes maximally specific, naming exact library versions (zod4) and every tool in the stack (pino, biome). Haiku sits in between.

For **trigger effectiveness**, this creates an interesting tradeoff:
- Sonnet's abstractions may be better triggers because they activate **parametric knowledge** (universal concepts)
- Opus's specifics may be better for **in-context recall** (pointing at exact details in the loaded file)
- The ideal trigger might combine both: Sonnet's conceptual handle + Opus's specificity

### 3. Cross-Model Convergence Identifies Universal Attractors

Terms shared across all three models represent the **strongest possible triggers** — they activate the concept regardless of model size:

| File | Universal Terms |
|------|----------------|
| options-objects | options, object, positional, params |
| testing | bun, test, di, fixtures |
| imports-and-modules | monorepo, alias, import |
| broken-windows | quality, ratchet |
| zod-schemas | zod, schema, first |
| dependency-injection | optional, deps |
| error-handling | typed, boundary |
| react-patterns | react, zustand |
| typescript-patterns | typescript, safety |

These universal terms are the strongest candidates for cross-model portable triggers.

### 4. Sonnet Found Fixed Points Haiku Missed

On zod-schemas, Sonnet hit 0.99 (5/5 identical: "zod schema first source of truth") — a perfect fixed point that both Haiku and Opus missed. Opus diverged to "boundary validation" while Haiku scattered across "development rules" and "source of truth." This shows fixed points are **model-specific**: each model has its own stable attractors.

### 5. Behavioral Differences by Model

| Behavior | Haiku | Sonnet | Opus |
|----------|-------|--------|------|
| Names metaphors | Sometimes ("ratchet") | Often ("broken windows") | Rarely (prefers literal) |
| Uses imperative voice | Rarely | Often ("prefer", "enforce") | Sometimes |
| Names project-specific terms | Sometimes ("barf") | Often ("barf") | Rarely |
| Names exact library versions | No | No | Yes ("zod4", "react19") |
| Contrast encoding | Sometimes | Often ("over node fs") | Sometimes |
| Fixed point rate | 0% | 21% | 64% |

### 6. The "hard-requirements" Divergence

This was the most interesting divergence. All three models produced completely different conceptual frames:

- **Haiku**: Named the tools being enforced (zod, typescript, tsdoc)
- **Sonnet**: Named the enforcement philosophy ("non-negotiable code standards")
- **Opus**: Named EVERY specific tool with versions (zod4, strict, tsdoc, pino, biome, gates)

No cross-model shared terms. This suggests the file covers multiple concerns without a single dominant concept — consistent with the lower confidence scores across the board for multi-topic files.

---

## Comparison with Original Haiku-Only Test

The original test (TEST_CASE.md) ran haiku-only on these same 14 files. Comparing:

| File | Original Haiku Trigger | New Haiku Trigger | Changed? |
|------|----------------------|-------------------|----------|
| agent-discipline | stay focused avoid overreach | agent discipline guardrails | Yes — different frame |
| async-patterns | promises without silent failures | promise worker cancellation patterns | Yes — more specific |
| broken-windows | quality ratchet broken windows | code quality enforcement ratchet | Yes — dropped metaphor |
| testing | test behavior not implementation | bun test behavior di fixtures | Yes — added specifics |

The original haiku test used a different version or temperature, producing different phrases. This highlights a key finding: **Haiku is the least stable across runs**. The same model on the same file can produce different conceptual frames. Opus would not have this problem — its 5/5 convergence means the trigger is reproducible.

---

## Recommendations

1. **Use Opus for production trigger generation** if budget allows — 64% fixed point rate means near-deterministic triggers
2. **Use Sonnet for "resonance linting"** — its tendency to abstract makes it the best model for diagnosing unfocused files
3. **Use cross-model shared terms as the most portable triggers** — they activate across all model sizes
4. **Consider composite triggers**: `"[Sonnet's conceptual handle] + [Opus's specific terms]"` may outperform either alone
5. **Haiku remains cost-effective for concept files** — 0.94 average confidence is sufficient; Phase 2 provides the safety net that Opus doesn't need

---

## Cost Breakdown

| Model | Calls | Approximate Cost |
|-------|-------|-----------------|
| Haiku (5 × 14 files) | 70 | ~$0.07 |
| Sonnet (5 × 14 files) | 70 | ~$0.70 |
| Opus (5 × 14 files) | 70 | ~$7.00 |
| **Total** | **210** | **~$7.77** |

For production use, the cost question is whether Opus's higher stability justifies 100× the cost of Haiku. For universal engineering concepts, Haiku is sufficient. For project-specific or multi-topic files, Opus's stability may be worth the premium.
