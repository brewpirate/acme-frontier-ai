# total-recall

**Find the smallest set of words that bring an AI's associations with a file back into focus — by asking the AI to describe each file five times and watching which words it keeps coming back to.**

5–6 token "trigger phrases" that reactivate the model's attention on already-loaded content, so long sessions don't drift away from rules and conventions you set early on.

---

## Install

In Claude Code:

```
/plugin install brewpirate/total-recall
```

This adds the plugin's commands (`/total-recall:scan`, `/total-recall:write`, `/total-recall:schedule`, etc.) to your session.

**Prerequisites**
- Claude Code (any recent version)
- Model access for at least one of `haiku`, `sonnet`, `opus` — the pipeline can use any one, but `--models sonnet` is the recommended default
- Write access to a `.claude/` directory in the project root (the plugin stores `triggers.json` and `recall-index.json` there)

**Verify install** — run `/total-recall:list` in a fresh session. If you see "No triggers stored yet. Run `/total-recall:scan` to generate some." the plugin is loaded correctly. If the command isn't recognized, the plugin didn't install — see [docs/QUICKSTART.md](docs/QUICKSTART.md#step-0--install) for troubleshooting and local-development install.

---

## Start here

| Doc | For |
|-----|-----|
| **[docs/EXPLAINED.md](docs/EXPLAINED.md)** | Plain-language: what this is and why it matters, no AI/ML jargon |
| **[docs/QUICKSTART.md](docs/QUICKSTART.md)** | Three-command setup in five minutes |
| **[docs/SCHEDULING.md](docs/SCHEDULING.md)** | Deep dive on the primary product mechanism (periodic re-injection) |
| **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** | Internals: agents, skills, storage formats |
| **[docs/EVIDENCE.md](docs/EVIDENCE.md)** | What's proven, what's anecdotal, what's unproven |
| **[docs/plans/ROADMAP.md](docs/plans/ROADMAP.md)** | v0.0.1 ship record + future roadmap (F1–F13) |

---

## The 30-second version

Long AI sessions drift. A rule you loaded early gets pushed out of attention, and the assistant starts violating it without disagreeing with it. Re-pasting the rule file is expensive and dilutive.

Total-recall finds 5-token phrases that the AI converges on independently across multiple samples — the model's own internal lookup keys for that file. Re-injecting those phrases later (cheaply, periodically, while the session is idle) keeps the rules alive in the model's working attention.

The phrases are model-specific because models have different internal associations. Haiku, Sonnet, and Opus converge on different keys for the same file; we generate one set per model.

---

## Commands

| Command | Description |
|---------|-------------|
| `/total-recall:scan <path> [--models m1,m2]` | Generate model-scoped trigger phrases for a file or directory |
| `/total-recall:seed [path] [--models m1,m2]` | Bootstrap triggers from docs, prompts, skills, and project docs |
| `/total-recall:list [filter]` | Show stored triggers, optionally filtered |
| `/total-recall:write` | Write triggers from `triggers.json` into file frontmatter |
| `/total-recall:schedule` | Set up periodic re-injection ([deep dive](docs/SCHEDULING.md)) |
| `/total-recall:forget <path>` | Remove triggers for a file or pattern |
| `/total-recall:index` | Rebuild the master word-to-files reverse lookup |
| `/total-recall:compare <path>` | Cross-model comparison (research tool) |

---

## Resonance linting

A useful side effect: **low convergence diagnoses unfocused rules**. If five AI samples can't agree on a few-word handle for a file, that file is probably trying to do two things. The convergence failure IS the diagnostic.

| Confidence | Meaning |
|------------|---------|
| **0.9+** | Rule is clear, focused, resonant. |
| **0.7–0.89** | Rule might be doing two things. Consider splitting. |
| **<0.7** | Rule is unfocused. Rewrite or decompose it. |

In testing, the lowest-confidence file (0.80) covered SDK mode AND CLI subprocess mode — correctly flagged by weak convergence.

---

## Evidence (short version)

- **Mechanism: validated.** Convergent sampling extracts semantic salience that TF-IDF can't (hapax-legomenon "ratchet", contrast-encoded "globals", absent-metaphor "assembly line"). 26 files tested, 0.93 average confidence, 100% Phase 1 convergence.
- **Cross-model: validated.** 210 agent calls show Opus produces 64% perfect fixed points vs Haiku's 0% — larger models have narrower attractor basins. Triggers are model-specific by necessity.
- **Behavioral efficacy: mixed.** Three synthetic tests up to 136K tokens showed no measurable trigger effect — but the tests couldn't reproduce real-session attention decay either. Anecdotal real-session evidence (including the plugin author's many positive observations) supports the product. Lab evidence neither confirms nor refutes.

Full accounting: [docs/EVIDENCE.md](docs/EVIDENCE.md). Treat the mechanism as proven, the product as supported-pending-better-instrumentation.

---

## How it fits together

```
/total-recall:scan rules/                   # generate triggers
/total-recall:write                         # write into file frontmatter
/total-recall:schedule                      # create CronCreate jobs that re-inject periodically
```

That's the loop. Run scan + write once per project (and again when files change significantly); run schedule each session you want refreshes active.

---

## Status

- v0.0.1 — generation pipeline validated, behavioral efficacy supported by anecdote.
- License: MIT
- Author: Daniel Zenner — daniel@zenner.dev
