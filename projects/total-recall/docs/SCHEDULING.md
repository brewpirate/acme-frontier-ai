# Scheduling

The scheduled-injection path is total-recall's primary product mechanism. It's the only path with anecdotal evidence of behavioral effect — the rule-based recall (`rules/recall-index.md`) is a softer hint that depends on the agent voluntarily consulting the index. Scheduling forces it.

This doc covers what scheduling does, how to set it up well, and where the sharp edges are.

## What scheduling does

`/total-recall:schedule` discovers files with `trigger_phrase` and/or `refresh` frontmatter, asks you which to activate, and creates `CronCreate` jobs that fire periodic prompt fragments while the session is idle. Each fragment looks like:

> "Re-internalize this core rule: 'quality ratchet broken windows'. Briefly acknowledge what this rule means and confirm you're following it. One sentence."

The agent's acknowledgment lands visibly in the conversation. Refreshes are not silent — that's intentional, so you can see them firing and judge whether they're helping.

## The frontmatter schema

A file opts into scheduling by carrying these fields in its YAML frontmatter:

```yaml
---
name: broken-windows
description: "Quality ratchet rule"
trigger_phrase:
  haiku:  "no broken windows"
  sonnet: "quality ratchet broken windows"
  opus:   "broken windows codebase quality ratchet"
refresh: 15m
---
```

| Field | Required? | What it does |
|-------|-----------|--------------|
| `trigger_phrase` | One of the two | Model-scoped phrases to inject. The schedule picks the one matching the current session's model. ~5 tokens; cheap. |
| `refresh` | One of the two | Suggested re-injection interval. Supported: `5m`, `10m`, `15m`, `20m`, `30m`, `1h`. The user can override during scheduling. |

A file needs at least one of these to be discovered. If only `refresh` is set, the schedule re-reads the whole file each tick (more expensive). If only `trigger_phrase` is set, the schedule prompts you for an interval at setup time.

`/total-recall:write` populates `trigger_phrase` from `.claude/triggers.json`. You add `refresh` by hand if you want a default interval baked into the file.

## Where files are discovered

`/total-recall:schedule` scans these locations for opted-in files:

- `.claude/rules/` — project rules
- `CLAUDE.md` — project root instructions
- `.claude/*.md` — any markdown in the .claude directory
- Loaded skills — skill definitions in active plugins

Files outside these locations won't be auto-discovered. If you have rules elsewhere, either move them into `.claude/`, or run `/total-recall:scan <path>` followed by `/total-recall:write` and the file's frontmatter will carry the trigger — but the schedule discovery still won't find it without one of the above prefixes. (This is a real limitation; widening discovery is a future improvement.)

## How the model is chosen at injection time

`trigger_phrase` is keyed by model (`haiku`, `sonnet`, `opus`) because each model has its own internal lookup keys (see CROSS_MODEL_RESULTS for why). At schedule-creation time, the skill checks which model the session is running and selects the matching phrase.

If your file has triggers for `sonnet` only and the session is running Opus, the schedule injects the Sonnet phrase. It's not optimal — Opus would converge on slightly different keys — but it's better than nothing. To get the optimal phrase per model, run `/total-recall:scan <path> --models opus,sonnet,haiku` once and `/total-recall:write` will carry all three.

## Interval guidance

| Content type | Suggested interval | Why |
|---|---|---|
| Core rules (broken-windows, error-handling, agent-discipline) | **10–15m** | High value, small injection cost, drift here causes visible quality regressions. |
| Skill philosophy (how a particular skill should be applied) | **20–30m** | Important but slower-moving; less likely to drift on short timescales. |
| `CLAUDE.md` (project-wide) | **10–20m** | Touches every interaction; high leverage. |
| Reference docs (architecture overviews, glossaries) | **30m–1h** | Informational; rarely the source of behavioral drift. |

The `refresh` field in each file carries the authoritative suggestion for that specific file. The user can override during scheduling. If no `refresh` is set, the skill suggests `20m` as a sane default.

**Don't go below 5m.** Injections every two minutes flood context faster than they help. Five minutes is the practical floor.

## What setup looks like

Typical session:

```
> /total-recall:schedule

Found 6 candidate files. Showing 5 at a time:

1. .claude/rules/broken-windows.md       — trigger: "quality ratchet broken windows" — interval: 15m
2. .claude/rules/error-handling.md       — trigger: "throw typed errors at boundaries" — interval: 20m
3. .claude/rules/testing.md              — trigger: "test behavior not implementation" — interval: 15m
4. .claude/rules/agent-discipline.md     — trigger: "stay focused avoid overreach" — interval: 10m
5. CLAUDE.md                              — no trigger, will re-read — interval: 10m

Select which to activate:
[user picks 1, 2, 4]

Confirm intervals (or override):
1. broken-windows.md → 15m? [yes/no/override]
...

Scheduled refreshes active:

  ID        File                              Interval  Type
  ────────  ────────────────────────────────  ────────  ──────────
  abc12345  .claude/rules/broken-windows.md   15m       trigger
  def67890  .claude/rules/error-handling.md   20m       trigger
  ghi24680  .claude/rules/agent-discipline.md 10m       trigger

3 refresh jobs active. They'll fire while the session is idle.
Use "cancel the broken-windows refresh" or CronDelete to stop any job.
Jobs expire after 7 days (CronCreate limitation).
```

## Managing schedules mid-session

Natural-language cancellation works because Claude Code understands `CronCreate`/`CronDelete`/`CronList` natively:

| What you say | What happens |
|--------------|--------------|
| "What scheduled tasks do I have?" | `CronList` runs |
| "Cancel the broken-windows refresh" | `CronDelete` on the matching job |
| "Change the CLAUDE.md refresh to every 30 minutes" | Delete + recreate |
| "Pause all refreshes for an hour" | Currently no-op; delete and re-add when ready |

You don't need to use the schedule skill for these — they're built into Claude Code. The skill's job is the initial setup.

## When to schedule (and when not to)

**Schedule aggressively when:**
- The session will run > 1 hour.
- You're doing focused work where a specific rule's discipline matters (testing, refactoring, code review).
- You've previously noticed the agent drifting on a specific rule.

**Schedule sparingly when:**
- The session is short (< 30 min).
- You're exploring or brainstorming — refreshes can become an interruption.
- You have many files; each refresh costs context. Five aggressive schedules is more useful than fifteen lukewarm ones.

**Don't schedule:**
- Files that aren't behavioral rules (changelogs, CHANGELOG.md, historical docs). These don't drift in any meaningful sense.
- Files with confidence < 0.7. The trigger is unlikely to fire reliably; rewrite the file before scheduling it.

## Limitations and known gaps

- **Session-scoped.** `CronCreate` jobs die when the session exits. You re-run `/total-recall:schedule` each new session. Cross-session persistence (a SessionStart hook that auto-restores schedules) is on the roadmap.
- **Idle-only firing.** Jobs only fire while Claude is idle, not mid-response. So a long-running response delays the next refresh until it completes — usually fine, occasionally noticeable.
- **7-day expiry.** `CronCreate` auto-expires jobs after seven days. You'd hit this only on truly long-running sessions, which are rare.
- **No drift detection.** If you re-scan a file (the trigger updates in `triggers.json`) but forget to re-run `/total-recall:write`, the frontmatter is stale and `schedule` injects the old phrase. A future `/total-recall:check` will surface this.
- **Discovery is narrow.** Files outside `.claude/`, `CLAUDE.md`, and loaded skills are invisible to the discovery scan. Manually edit a file's frontmatter to add `trigger_phrase` and put it where discovery looks if you want it scheduled.

## Patterns that work

After enough sessions, a few stable habits emerge:

1. **One rule, one trigger, 15m.** A single behavioral rule scheduled at 15m is the highest-leverage configuration. More rules at longer intervals tends to be better than many rules at short intervals.
2. **Schedule the rules you've seen drift on.** If the agent has previously regressed on testing discipline, schedule `testing.md`. Direct, evidence-driven, not hypothetical.
3. **Use the acknowledgment as a check.** When a refresh fires and the agent acknowledges in one sentence, that one sentence tells you whether the rule is alive in its head. If the acknowledgment is mechanical or vague, the rule probably needs rewriting.
4. **Re-schedule when starting a new phase of work.** Switching from feature work to refactoring? Cancel the feature-relevant refreshes; activate the refactoring-relevant ones. Keep the schedule aligned with the current task.

## Anti-patterns

- **Scheduling everything.** Five files at 10m is ~30 injections per hour. Quality of attention drops with quantity.
- **Scheduling unfocused files.** A file with 0.65 confidence won't reactivate cleanly. The trigger fires; nothing crisp happens. Fix the file first.
- **Treating refreshes as silent infrastructure.** They're visible by design. Read the agent's acknowledgments — they're a free signal of whether the rule is alive in attention.

## See also

- [README.md](../README.md) — full technical overview, test data, honesty section
- [docs/EXPLAINED.md](EXPLAINED.md) — plain-language framing
- [docs/QUICKSTART.md](QUICKSTART.md) — three-command setup
- [skills/schedule/SKILL.md](../skills/schedule/SKILL.md) — the skill's own implementation spec
- [skills/write/SKILL.md](../skills/write/SKILL.md) — how triggers get into frontmatter (prerequisite for scheduling)
