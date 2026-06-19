# Rule Map — The Works

Maps The Works' rules to when they apply. The orchestrator skill (`/the-works`) and the phase agents consult this to load the right posture.

Unlike a task-type map, The Works' rules are scoped by **phase**, not by language or domain. A rule that is correct in one phase is wrong in another — that separation is the whole point.

> Note: linking a rule into `~/.claude/rules/` does **not** auto-load it (there is no native rules auto-loader). These rules are loaded by reference — the skill and the phase agents read the relevant file explicitly. The mapping below is the contract for which file to read when.

---

## Always-on (whenever operating The Works)

- `the-works-overview.md` — the procedure itself: phase-as-posture model, branch topology, gate gradient, artifact conventions (SPEC, ledger, anchors), transitions. Read this first.

## By phase

Read the phase rule for the disposition currently in effect. Read exactly one; do not load another phase's rule — its permissions and prohibitions will contradict the active posture.

| Phase | Rule |
|-------|------|
| work  | `the-works-phase-work.md` |
| right | `the-works-phase-right.md` |
| fast  | `the-works-phase-fast.md` |
| seal  | `the-works-phase-seal.md` |

---

## Conventions for entries

- One rule per line in always-on; one row per phase in the table.
- Reference rules by bare filename (they link flat into `~/.claude/rules/`).
- The phase rules are mutually exclusive by design. Loading two at once reintroduces the un-phased-rules failure mode The Works exists to prevent.

## What not to put here

- Rule content — that lives in the rule files.
- Project conventions — those live in the repo `CLAUDE.md`.
- The procedure's rationale — that lives in `README.md` and `the-works-overview.md`.
