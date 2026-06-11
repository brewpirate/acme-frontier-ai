# Total-Recall — Plan & Roadmap

This document carries the original v0.0.1 ship plan (now complete) and the future roadmap surfaced during the v0.0.1 audit. Items are intentionally pre-scoped — each future item is a mini-plan with problem / approach / files / risks, sufficient to act on later without re-deriving the analysis.

---

## Status

| Phase | State | Notes |
|-------|-------|-------|
| **v0.0.1 Ship Plan** | ✅ **Shipped** | All P0 + P1 items complete. See "Verification" at bottom of v0.0.1 section. |
| **Future Roadmap (F1–F13)** | 📋 Planned | Ordered by dependency in the section at the end. |

---

# v0.0.1 Ship Plan (shipped)

## Context

Total-recall was extracted into a standalone plugin at `/home/daniel/Projects/ai-projects/total-recall`. The production parent lives at `/home/daniel/Projects/zenflow/plugins/total-recall` and contained the pieces the destination was missing — both `study` agents, `compare-researcher`, all `commands/`, the `seed` skill, the `write` skill (correctly named), and a real README. The destination has one piece source doesn't: a standalone `schedule` skill (replacing zenflow's `zenflow:schedule` consumer).

The pipeline as initially extracted could not run end-to-end — `researcher` spawned a `study` agent that didn't exist, `compare` spawned a `compare-researcher` that didn't exist, and skill names were inconsistent. The shipping work was mostly **copy from source, reconcile naming, fix shared upstream bugs**, and write minimal docs.

The next-version context-priming feature was out of scope.

## Storage filename decision

Source uses `.claude/triggers.json` everywhere. Destination originally used `.claude/total-recall.json`. **Standardized on `.claude/triggers.json`** to match source and the broader ecosystem.

## Critical fixes (P0 — pipeline could not run as-extracted)

### 1. Copy missing agents from source ✅
- `agents/study.md` — Phase 1 sample agent. Haiku by default; researcher overrides at call time.
- `agents/compare-researcher.md` — used by `skills/compare/SKILL.md`.

### 2. Copy missing skills from source ✅
- `skills/seed/SKILL.md` — auto-discovers docs/CLAUDE.md/skills/agents and bootstraps triggers.
- `skills/write/SKILL.md` — replaced destination's `skills/add-trigger/`.

### 3. Copy `commands/` from source ✅
- `commands/scan.md`, `list.md`, `forget.md`, `compare.md`, `index.md`, `write.md`, `seed.md`, plus a new `commands/schedule.md` for the destination-only `schedule` skill.

### 4. Copy the rule ✅
- `rules/recall-index.md` — instructs agents to use `.claude/recall-index.json` before re-reading.

### 5. Path substitution `total-recall.json` → `triggers.json` ✅
Updated `skills/scan/SKILL.md`, `skills/index/SKILL.md`, `skills/schedule/SKILL.md`. Verification: `grep -r 'total-recall.json' .` returned zero.

## Important fixes (P1 — bugs present in BOTH source and destination)

### 6. Fix `list/SKILL.md` ✅
- Typo `/triggered:scan` → `/total-recall:scan`.
- Output table updated to one row per (file, model) pair.

### 7. Fix `forget/SKILL.md` ✅
Removal report now shows per-model phrases.

### 8. Fix `researcher.md` Phase 2 contradiction ✅
Resolved: Phase 2 is escalation at every rung except the top; opus uses repetition as fallback because there's no larger model. Documented explicitly with a "flag as multi-topic" recommendation when persistent weak convergence appears at opus.

### 9. Confidence threshold in `scan/SKILL.md` ✅
Bumped warning threshold from `<0.6` to `<0.7` to match the README's resonance-linting framing.

## Destination-specific fixes

### 10. Reconcile `schedule/SKILL.md` self-reference ✅
`/zenflow:schedule` → `/total-recall:schedule`.

### 11. `user-invocable` convention ✅
Removed from `schedule/SKILL.md` to match source's auto-discovery convention. No skill in the plugin now uses the flag.

## Documentation (P1)

### 12. README adopted from source — with honest opening ✅
Adapted from source. Doc links updated to `docs/research/` paths. `schedule` row added to Commands table.

### 12a. Resolve the headline contradiction ✅
README opening rewritten so the **mechanism** carries the value claim (proven) rather than the **behavioral compression ratio** (anecdotal). The 200:1 number stays but only inside a paragraph that names the baseline and caveat.

### 13. `docs/` ✅
`docs/research/{FEASIBILITY,TEST_CASE,CROSS_MODEL_RESULTS}.md` retained from existing destination layout.

## Files modified
- `skills/list/SKILL.md` — namespace + v2 format
- `skills/forget/SKILL.md` — v2 example
- `skills/scan/SKILL.md` — path + threshold
- `skills/index/SKILL.md` — path
- `skills/schedule/SKILL.md` — namespace + path + user-invocable
- `agents/researcher.md` — Phase 2 contradiction
- `README.md` — full rewrite from source

## Files created
- `agents/study.md`, `agents/compare-researcher.md`
- `skills/write/SKILL.md`, `skills/seed/SKILL.md`
- `commands/scan.md`, `list.md`, `forget.md`, `compare.md`, `index.md`, `write.md`, `seed.md`, `schedule.md`
- `rules/recall-index.md`
- `docs/EXPLAINED.md`, `docs/QUICKSTART.md`, `docs/SCHEDULING.md`, `docs/ARCHITECTURE.md`, `docs/EVIDENCE.md`

## Files deleted
- `skills/add-trigger/` (replaced by `skills/write/`)

## Verification

End-to-end smoke is a manual user step (requires invoking slash commands in a real Claude session). Static verification:

| Check | Result |
|-------|--------|
| `grep -r 'total-recall.json' .` | 0 hits |
| `grep -r '/triggered:scan' .` | 0 hits |
| `grep -r 'add-trigger' .` | 0 hits |
| `grep -r '/zenflow:schedule' .` | 0 hits |
| `grep -r 'zenflow' .` | 0 hits |

Manual smoke test (recommended on first use):

1. `/total-recall:scan agents/researcher.md --models sonnet` → confidence ≥0.85; v2 entry in `triggers.json`; `recall-index.json` rebuilt.
2. `/total-recall:seed --models sonnet` → discovers README/SKILLs/agents; tags `"source": "seed"`.
3. `/total-recall:compare agents/researcher.md` → three-model entry in `compare-results.json`.
4. `/total-recall:write` → `trigger_phrase` block in YAML of scanned files; user prompted before each write.
5. `/total-recall:list` and `/total-recall:list scan` → readable v2 output.
6. `/total-recall:forget skills/list/SKILL.md` → entry removed; v2-aware report.
7. `/total-recall:schedule` → discovers files written in step 4; CronCreate job lands; injection fires once visibly.

---

# Future Roadmap (post-v0.0.1)

Items below were surfaced during the v0.0.1 audit but deferred so the ship was not blocked. Order is rough priority.

## F1 — Make 20-file truncation loud

**Problem.** `scan` and `seed` cap input at 20 files per researcher invocation. A user running `seed` on a 500-file repo currently gets 480 files silently dropped. First-run UX hazard.

**Approach.** Auto-batch in the skill (not the agent):
1. After globbing, count matches.
2. If > 20: print "Found N files. Will scan in ⌈N/20⌉ batches." and proceed batch-by-batch, calling the researcher once per batch.
3. Each batch writes results before the next starts (so a mid-run failure preserves progress).
4. Skill output includes a per-batch summary line so the user can see progress.

**Files.** `skills/scan/SKILL.md`, `skills/seed/SKILL.md`. Researcher itself stays unchanged.

**Out of scope.** Parallel batches (sequential is fine; rate limits and cost are the real constraints).

## F2 — Trigger staleness on file change

**Problem.** A file edited heavily after scan keeps a trigger that may now be wrong. No detection.

**Approach.**
1. Add `contentHash` (sha256 of file content at scan time) and `mtime` to each trigger entry.
2. On `scan`, if a file already has an entry, compare hash; if changed, log "rescanning stale" and proceed.
3. On `list`, render a `STALE` flag for entries whose current file hash differs from stored.
4. New `/total-recall:check` (see F4) extends this to a full sweep.

**Files.** `skills/scan/SKILL.md` (write hash on store), `skills/list/SKILL.md` (compare and flag), `agents/researcher.md` (researcher reports the file path; the *skill* computes the hash, not the agent).

**Schema bump.** v3 (still backward-compatible — old entries without hash render as "unknown" rather than stale).

## F3 — Resolve the two-storage drift

**Problem.** `triggers.json` updates on `scan`; per-file frontmatter only updates on `write`. `schedule` reads frontmatter, so silent stale injection is possible.

**Approach.** Two complementary changes:
1. `scan` ends by listing files whose frontmatter is now stale and points to `/total-recall:write`.
2. `write` shows a per-file diff (old phrase → new phrase) before each Edit, refusing files whose frontmatter has been hand-edited (heuristic: trigger present in JSON but frontmatter differs in a way that doesn't match a prior JSON value).

**Files.** `skills/scan/SKILL.md`, `skills/write/SKILL.md`.

**Open design question.** Whether to drop frontmatter coupling entirely for the destination (see F8). If F8 is taken, F3 becomes moot.

## F4 — `/total-recall:check` skill

**Problem.** Even with F2 + F3, no single command tells the user "is my trigger DB consistent?"

**Approach.** New skill `skills/check/SKILL.md`:
1. Read `triggers.json`. For each entry:
   - File missing → flag.
   - Hash mismatch → flag (depends on F2).
   - Frontmatter stale (if file has any) → flag.
   - Confidence < 0.7 → flag.
2. Output a summary table: `path | issue | suggested-fix-command`.
3. Exit cleanly with no action; user runs the suggested commands.

**Files.** `skills/check/SKILL.md` (new), `commands/check.md` (new).

**Dependency.** F2 for hash-based detection.

## F5 — Hook-based recall

**Problem.** Currently the only way agents *use* the index is via a prompt rule (`rules/recall-index.md`) that tells the model to check the JSON. Source's own behavioral tests suggest models don't reliably do this. The schedule path works because it forces injection from outside.

**Approach.** Add a PreToolUse hook on `Read` that:
1. Intercepts when the model tries to re-read a file already in `triggers.json`.
2. Surfaces the model-matched trigger phrase in the hook output.
3. Lets the read proceed but inserts a system-reminder: "You have a trigger for this file: '<phrase>'. Re-read only if details are needed."

This is the path to the v0.1 product. It bypasses the prompt-instruction reliability problem by enforcing the behavior in tooling.

**Files.** `hooks/pre-read.json` + script in plugin's hook directory; settings.json hook registration; small TypeScript or shell script that does JSON lookup.

**Risk.** Hooks are invasive; design must be opt-in (per-project setting) and silent when no trigger matches.

**This is the largest future item and the most consequential.**

## F6 — Spec model detection and fallback

**Problem.** `schedule` and `recall-index.md` say "determine the current model" / "use the closest available" without specifying mechanism or distance metric.

**Approach.**
1. Detection: read `CLAUDE_MODEL_ID` env var if set; else parse system message for "claude-opus-4-7"-style identifiers; else default to `sonnet`.
2. Family fallback: exact ID → exact family (any opus → opus index) → cross-model section → no match.
3. Document this as a single utility section in the README.

**Files.** `skills/schedule/SKILL.md`, `rules/recall-index.md`. No new code — just spec text the skill follows.

**Out of scope.** Auto-detecting the running session's model from the agent's own metadata; that's a Claude Code surface, not a plugin one.

## F7 — Persistent schedule across sessions

**Problem.** CronCreate is session-scoped; users re-run `/total-recall:schedule` every session. Friction directly opposite the "long-session calibration" value prop.

**Approach.**
1. Save schedule decisions to `.claude/total-recall-schedule.json` (file paths + intervals + chosen models).
2. Add a SessionStart hook that reads this file and re-creates CronCreate jobs.
3. New `/total-recall:unschedule <file>` for removal (writes back to the JSON).

**Files.** `hooks/session-start.json` + script; `skills/schedule/SKILL.md` (save decisions); new `skills/unschedule/SKILL.md`.

**Risk.** SessionStart hooks add startup latency; keep the script trivially fast (read JSON, call CronCreate, exit).

## F8 — Drop frontmatter coupling in standalone

**Problem.** Frontmatter exists because zenflow's schedule consumed it. Destination has its own schedule that could read `triggers.json` directly. The duplication is a tax.

**Approach (decision, not implementation).** Decide whether the destination keeps the `write`/frontmatter path or drops it:
- **Keep:** files moving with the repo carry their triggers. Frontmatter is a portable annotation. Cost: drift complexity (F3, F4).
- **Drop:** simpler. `triggers.json` is the only source of truth. `schedule` reads it directly. Lose portability across file renames.

If dropping: delete `skills/write/SKILL.md`, `commands/write.md`, the frontmatter-reading parts of `schedule/SKILL.md`. Replace with `schedule` reading `triggers.json` keyed by relative path.

**Files affected on drop.** Same as just listed.

**Recommendation.** Defer the decision until F5 (hooks) is designed. If F5 makes hooks the primary recall path, frontmatter becomes purely cosmetic.

## F9 — Normalize confidence per model

**Problem.** 0.95-Haiku ≠ 0.95-Opus (different fixed-point baselines). Bare numbers across models mislead.

**Approach.** In all user-facing output (`list`, `scan` report, `compare`):
1. Always render `(model: 0.95)` rather than bare 0.95.
2. Optionally compute a normalized score using the cross-model baselines from CROSS_MODEL_RESULTS.md (haiku 0.94 mean / opus 0.98 mean) — but this is a research direction, not a fix.

**Files.** All output-rendering parts of skills. Pure presentation change.

## F10 — Make `compare-results.json` user-visible

**Problem.** Compare writes a JSON file nothing reads. The skill never tells the user what to do with it.

**Approach.**
1. `compare/SKILL.md` always renders the comparison table inline as primary output (it currently does — keep that).
2. Add a closing note: "Results saved to `.claude/compare-results.json` for further analysis. This file is not consumed by other skills; it exists for research." (Already partially done in v0.0.1.)
3. Optionally: `/total-recall:compare-history` skill that prints prior runs.

**Files.** `skills/compare/SKILL.md` (small text update); optional new skill.

## F11 — Bundle a universal-trigger seed library

**Problem.** FEASIBILITY §7 recommended shipping the validated 14 triggers as a portable seed set, but the plugin doesn't carry them. This is the natural bridge to the next-version context-priming product.

**Approach.**
1. Create `data/universal-triggers.json` with the 14 validated triggers (source: TEST_CASE.md), per-model where multi-model data exists.
2. New `/total-recall:prime` skill (precursor to the next-version priming product) injects a curated subset before the user prompt for system-prompt compression. v0.0.1-flavored: single command, no DB management UI.
3. README adds a "Universal triggers" section linking to `data/universal-triggers.json`.

**Files.** `data/universal-triggers.json`, optional new `skills/prime/SKILL.md`.

**Note.** This straddles "ship for v0.0.1" and "next-version priming." Treat as a bridge feature; defer until you've decided whether priming gets its own plugin or stays in this one.

## F12 — Verification harness

**Problem.** No automated checks. Markdown skills can't unit-test, but the smoke from this plan's Verification section can be scripted.

**Approach.**
1. `tests/smoke.sh` (or `.ts`) that runs each `/total-recall:*` invocation against a fixture project, asserts file existence + JSON shape after each step.
2. Run on a CI hook before each version bump.

**Files.** `tests/smoke.sh`, fixture project under `tests/fixture/`.

**Lowest priority.** Useful but not urgent given the project's current shape.

## F13 — Upstream P1 fixes to zenflow source

The bugs fixed in v0.0.1 P1 (list typo, list/forget v1 format, researcher Phase 2 contradiction, `scan` confidence threshold) all exist in the zenflow source plugin too. Open a PR to zenflow with the same patches. Same diffs, same justification — just applied upstream. Can be parallelized with any other roadmap work.

---

## Dependency-aware ordering

| Order | Item | Why this place |
|-------|------|----------------|
| 1 | **F11** | Bridges to next-version priming product; lowest risk; high signal value |
| 2 | **F1** | First-run UX is broken without this; small scope |
| 3 | **F2 → F4** | Trigger maintenance trustworthiness; F4 depends on F2's hash field |
| 4 | **F5** | Headline v0.1 feature — hook-based recall. Largest, most consequential. |
| 5 | **F8** | Decision point: does F5 make frontmatter cosmetic? Decide together with F5. |
| 6 | **F7** | Second-largest UX win after F5. Cross-session schedule persistence. |
| 7 | **F9, F10, F12** | Polish + research polish + test harness. Parallel-doable. |
| 8 | **F6** | Model detection spec. Small. Can land any time once F5 forces the decision. |
| ∥ | **F13** | Parallel to all above. Upstream the P1 fixes once you have time for a zenflow PR. |
