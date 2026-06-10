# Quickstart

Five minutes from zero to a working trigger loop.

## What you need

- Claude Code (any recent version).
- Model access for at least one of `haiku`, `sonnet`, `opus`. The default `--models sonnet` works for almost everyone.
- A project with files you want the AI to remember through long sessions — typically `.claude/rules/`, `CLAUDE.md`, skill definitions, or documentation.

## Step 0 — Install

### Standard install (from GitHub)

In a Claude Code session:

```
/plugin install brewpirate/total-recall
```

That's it. The plugin's commands are now available in this session and any future session.

### Local development install (if you're hacking on the plugin)

Clone and reference the local path:

```bash
git clone git@github.com:brewpirate/total-recall.git ~/Projects/total-recall
```

Then point Claude Code at the local checkout. The exact mechanism depends on your Claude Code setup — typical options:

1. **Symlink into the plugins dir** (most reliable):
   ```bash
   ln -s ~/Projects/total-recall ~/.claude/plugins/total-recall
   ```
2. **Add the local path to your marketplace settings** (`~/.claude/settings.json`) — see Claude Code plugin docs for the exact key shape, varies by version.

After either, restart Claude Code or open a new session.

### Verify install

Run this in a fresh session:

```
/total-recall:list
```

**Expected output (success):**
```
No triggers stored yet. Run /total-recall:scan to generate some.
```

That message means the plugin is loaded and the `list` skill is wired up correctly. The "no triggers" part is fine — you haven't generated any yet.

**If the command isn't recognized:**
- The plugin didn't load. Check `/plugin list` (or equivalent) to see which plugins are active.
- For GitHub install: confirm `brewpirate/total-recall` is in your plugin list. If not, the install didn't complete — re-run `/plugin install`.
- For local install: confirm the symlink exists and the target directory contains `.claude-plugin/plugin.json`. Restart your Claude Code session.

### What gets created on first use

The plugin writes to a `.claude/` directory in your **project root** (not the global `~/.claude/`):

| File | Created by | Purpose |
|------|-----------|---------|
| `.claude/triggers.json` | `/total-recall:scan` | Master trigger database |
| `.claude/recall-index.json` | `/total-recall:index` (auto-invoked) | Reverse word lookup |
| `.claude/compare-results.json` | `/total-recall:compare` | Research data only — not consumed elsewhere |

You can `.gitignore` these or commit them, your call. Committing means triggers ship with the repo and any teammate's sessions inherit them; ignoring means each person regenerates locally.

---

## The three-command loop

```
/total-recall:scan .claude/rules --models sonnet
/total-recall:write
/total-recall:schedule
```

That's it. Below is what each step does and what you'll see.

---

## Step 1 — Scan

```
/total-recall:scan .claude/rules --models sonnet
```

For every file in `.claude/rules`, this spawns five independent AI agents, each asked to describe the file in six words or fewer. A research agent compares the five answers and picks the convergent keys.

Output:

```
Target models: sonnet

File                          | Model  | Trigger Phrase                      | Confidence
----------------------------- | ------ | ----------------------------------- | ----------
rules/broken-windows.md       | sonnet | quality ratchet broken windows      | 0.95
rules/error-handling.md       | sonnet | throw typed errors at boundaries    | 0.98
rules/testing.md              | sonnet | test behavior not implementation    | 0.99
rules/04-claude-integration.md| sonnet | dual path into claude               | 0.75  ← warning
```

Read confidence as: 0.9+ is solid, 0.7–0.89 is moderate, below 0.7 means the file is probably trying to do two things and the trigger may not fire reliably. Fix the file, not the trigger.

The triggers are saved in `.claude/triggers.json`. The reverse-lookup index is rebuilt automatically.

---

## Step 2 — Write

```
/total-recall:write
```

Reads `.claude/triggers.json` and writes each file's trigger phrases into that file's own YAML frontmatter. After this:

```yaml
---
name: broken-windows
description: "Quality ratchet rule"
trigger_phrase:
  sonnet: "quality ratchet broken windows"
---
```

You'll be asked file-by-file before any write. Files that already have correct triggers are skipped silently.

---

## Step 3 — Schedule

```
/total-recall:schedule
```

Discovers files with `trigger_phrase` in frontmatter and offers to schedule each one for periodic re-injection. You pick which files matter and how often (10m, 15m, 20m, 30m).

A typical setup:

```
ID        File                              Interval  Type
────────  ────────────────────────────────  ────────  ──────────
abc12345  .claude/rules/broken-windows.md   15m       trigger
def67890  .claude/rules/error-handling.md   20m       trigger
ghi24680  CLAUDE.md                         10m       re-read
```

While the session is idle, every interval the AI gets a prompt fragment like:

> "Re-internalize this core rule: 'quality ratchet broken windows'. Briefly acknowledge what this rule means and confirm you're following it. One sentence."

The AI's acknowledgment shows in the conversation, so refreshes are visible — not silent.

---

## When to do this

- **Once per project.** Run scan + write when you set up. Run schedule each session that you want refreshes active. (Cross-session persistence is on the roadmap.)
- **After editing a rule.** Re-scan the changed file: `/total-recall:scan rules/error-handling.md`. The trigger may shift if the content shifted significantly.
- **After adding a new rule.** Same — scan it, write it, optionally add it to the schedule.
- **When trying a new Claude model.** Triggers are model-specific. Re-scan with `--models opus` to add Opus-specific triggers next to your existing Sonnet ones.

---

## Other commands you'll want eventually

| Command | When to use |
|---------|-------------|
| `/total-recall:list [filter]` | "What triggers do I have? Filtered by path?" |
| `/total-recall:seed --models sonnet` | "Auto-discover and scan all CLAUDE.md / docs / skills in this project" — bootstrap shortcut |
| `/total-recall:forget <path>` | "Remove triggers for this file or pattern" |
| `/total-recall:compare <path>` | "Research: how do haiku, sonnet, opus differ on the same file?" |
| `/total-recall:index` | "Rebuild the lookup index" — usually automatic, but available manually |

---

## Common questions

**Q: Do I need to run schedule every session?**
A: Yes, currently. CronCreate jobs are session-scoped. Persistent schedules (auto-restored on session start) are planned.

**Q: My file got 0.6 confidence. What do I do?**
A: Look at the file. Five AI agents couldn't agree on what it's about — usually that means it's covering two unrelated topics. Split it, then re-scan. The mechanism is also a code-quality diagnostic.

**Q: Will this work without the schedule step?**
A: The trigger generation is useful on its own (resonance linting). Recall via the rule (`rules/recall-index.md`) is a softer hint that depends on the AI choosing to consult the index — less reliable than scheduled re-injection. The schedule path is the one with anecdotal evidence of behavioral effect.

**Q: What if I'm not sure whether this is helping?**
A: It's hard to A/B test honestly — the conditions where attention decay matters are hard to reproduce on demand. Try it in real sessions and judge by feel; turn schedules off and see if drift returns. The README's Behavioral Efficacy section is honest about the measurement difficulty.

---

Next: [docs/EXPLAINED.md](EXPLAINED.md) for the plain-language mechanism explanation, or [README.md](../README.md) for the full technical overview.
