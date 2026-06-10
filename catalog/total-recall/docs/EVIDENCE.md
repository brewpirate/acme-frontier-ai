# Evidence

Honest accounting of what total-recall has been tested on, what's proven, and what isn't.

## Generation pipeline test (proven)

26 files from a real project (barf-ts) — 14 engineering rules + 12 documentation files.

| Metric | Result |
|--------|--------|
| Files tested | 26 |
| Average confidence | 0.93 |
| Phase 1 convergence rate | 100% (no file needed escalation) |
| Highest confidence | 0.99 (testing.md) |
| Lowest confidence | 0.80 (04-claude-integration.md) |
| Total Haiku calls | 130 |

### Selected results

| File | Trigger | Confidence |
|------|---------|------------|
| testing | test behavior not implementation | 0.99 |
| error-handling | throw typed errors at boundaries | 0.98 |
| bun-native-apis | prefer bun native over node | 0.98 |
| options-objects | single options object for parameters | 0.98 |
| README.md | autonomous issue driven development | 0.98 |
| dependency-injection | injectable dependencies over globals | 0.95 |
| zod-schemas | zod schemas source of truth | 0.95 |
| broken-windows | quality ratchet broken windows | 0.90 |
| 04-claude-integration | dual path into claude | 0.80 |

Full data: [docs/research/TEST_CASE.md](research/TEST_CASE.md).

### Key findings

1. **Semantic salience, not statistical.** "Ratchet" appears once in its source file (a hapax legomenon TF-IDF would discard), yet 2/5 agents independently surfaced it as the defining metaphor. "Globals" encodes what the file argues *against*, not what it contains. "Assembly line" appeared in 3/5 samples for agent-roles despite never appearing in the source.

2. **Fixed points exist.** testing.md hit 0.99 confidence with near-identical phrases from all 5 agents — the pipeline reverse-engineered a lookup key that was already a stable attractor in the model's output distribution.

3. **Natural composability.** Triggers compose into imperative sentences. *"Throw typed errors at boundaries, test behavior not implementation, quality ratchet broken windows."* 17 tokens encoding 14 files of engineering discipline.

4. **Low confidence = diagnostic.** 04-claude-integration (0.80) covered two distinct topics (SDK mode AND CLI subprocess mode) — correctly flagged by weak convergence. Phase 2 frequency could serve as a code complexity metric.

## Cross-model comparison (proven)

14 files × 3 models = 210 study agent calls. Full data: [docs/research/CROSS_MODEL_RESULTS.md](research/CROSS_MODEL_RESULTS.md).

| Metric | Haiku | Sonnet | Opus |
|--------|-------|--------|------|
| Average confidence | 0.94 | 0.96 | 0.98 |
| Perfect fixed points (5/5 identical) | 0% | 21% | 64% |

### Key findings

- **Larger models have narrower attractor basins.** Opus produced 5/5 identical phrases on 9 of 14 files — the same concept maps to a much narrower output region than in smaller models.
- **Sonnet uniquely abstracts.** Where Haiku names tools and Opus names tools-with-versions, Sonnet often produces the most natural-language imperative ("prefer bun over node fs", "non-negotiable code standards").
- **Cross-model shared terms are the strongest portable triggers.** "Options, object, positional, params" survives across all three models; that's the highest possible robustness.
- **This is why triggers are model-scoped.** Each model's optimal lookup keys differ enough that one phrase doesn't cover all three.

## Behavioral efficacy (mixed)

The product hypothesis: re-injecting trigger phrases into a long, decayed context restores attention to already-loaded content. Evidence is mixed.

### Synthetic tests — null result

Three iterations attempting to measure trigger effect under controlled conditions:

| Test | Context Load | Method | Result |
|------|-------------|--------|--------|
| v1 — Passive flood | ~60K tokens | Read 10 source files | All conditions identical |
| v2 — Active engagement | ~80K tokens | 5 deep analysis tasks | All conditions identical |
| v3 — Heavy engagement | ~136K tokens | 12 deep analysis tasks across 30+ files | All conditions identical |

Sonnet retained perfect recall of a ~1K token rule file at every tested depth. All conditions (trigger injection, generic hint, no intervention) scored identically.

**Why:** Synthetic single-turn tests cannot reproduce attention decay. Decay is an organic phenomenon that builds over real working sessions — temporal distance, context switching, conversational noise, system-level compression. A 136K-token synthetic load is not the same regime as a 136K-token organic session.

This is a methodology failure, not a product failure — but it's also not confirmation. The lab numbers will keep being awkward until methodology improves.

### Real-session observations — anecdotal positive

In a live 276K-token session deep into substantive work, two trigger phrases (`collaborative session delegate partnership` and `no broken windows`) injected into the prompt produced an immediate behavioral correction. The agent paused execution mode, re-evaluated its prior turn against the partnership frame, and ran an unprompted quality sweep.

The plugin's author reports many similar observations across long working sessions. Author's evidence is n>>1 in real conditions; outside-observer evidence (this README) is n=1 from a screenshot. Statistical weight should follow that.

The honest position: anecdotal real-session evidence supports the product. Lab evidence does not refute it; it just can't reach the regime. Treat the mechanism as proven and the product as supported-pending-better-instrumentation.

## What's proven

- Pipeline reliably extracts high-quality semantic handles for engineering concept content
- Convergent sampling finds conceptual salience (metaphors, contrasts) that TF-IDF cannot
- Cost model is favorable: one-time investment, permanent portable results
- Phase 1 is sufficient for well-structured concept files (100% in testing)
- Low convergence scores correctly identify unfocused or multi-topic content
- Triggers are model-specific — different models converge on different lookup keys
- Larger models produce dramatically more stable triggers (64% perfect fixed point rate at Opus vs 0% at Haiku)

## What's unproven

- **Behavioral efficacy in synthetic conditions** — three tests up to 136K tokens showed no measurable effect; methodology issue, not refutation
- **Token selection specificity** — does a convergent trigger outperform a generic short cue of equal length? Not isolated yet (would require a priming-style A/B with no in-context residue)
- **Novel code boundary** — does the mechanism hold for project-specific code with thin parametric backing?
- **Whether attention decay is even a real problem** for current large-context models (200K+ token windows). Anecdotal real-session evidence says yes; we cannot synthesize it on demand to prove it.

## Implications

If you're considering adopting this:

- **The mechanism is solid.** You can use the scan pipeline confidently as a *resonance linter* — files with weak convergence are files that need rewriting. That value is independent of the recall claim.
- **The product is anecdotally supported.** Try it in real working sessions and judge by your own observations. The plugin author has many positive observations; controlled tests do not yet confirm them.
- **Don't expect lab-quality evidence soon.** The methodology problem (how to induce attention decay reliably for measurement) is a hard research question. Better instrumentation in real sessions is more likely to settle it than another synthetic test.
