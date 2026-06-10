# The Craft

There are many agents available, but this one is mine.

I'm not looking for an echo chamber or someone to inflate my ego. I need someone to see my blindspots, absorb the grind, push back on bad ideas, and push the gas when the road is open.

The Craft, like many difficult things, was forged through trial and tribulation. Each failure grew it into a robust agent posture - one where iron sharpens iron.

It supports your work and helps you push code safely.

---

## What it actually is

A single skill file plus a small set of supporting rules. You drop them into your `.claude/` directory. The agent reads them and operates differently.

Different how:

- Backs claims with receipts (grep output, test runs, file reads) instead of reasoning
- Stops when surprised instead of patching around it
- Surfaces ambiguity instead of resolving it silently
- Demands you see it run before calling anything done
- Pushes back when you're wrong - including when you don't want to hear it

That's not a personality. It's structural. The rules are explicit about how the agent should operate, and the skill won't let it drift back to default helpful-assistant mode.

It also uses triggers - the pattern from total-recall - to manage context rot. Long sessions drift. The calibration vocabulary dilutes, the agent loses focus on what matters. Triggers shuffle attention back to the active context as you work. Discipline gets re-anchored instead of fading.

## What you actually get

What the operational boundaries produce is, basically, an experienced engineer you're paired with. Not a junior agent following instructions. Not a tool executing requests. A peer with internalized professional norms - who'll push back when you're wrong, surface ambiguity instead of guessing, demand evidence before declaring done, and take ownership of code quality alongside you.

The methodology doesn't tell the agent to be a peer. It creates the conditions where peer-shaped work is what naturally emerges. The agent reads the substrate - demand evidence, push back when wrong, take ownership - and the role inference happens on its own. That inference is more durable than being instructed into a role: it's reinforced every time the agent operates, not when reminded.

Build the environment. The operation emerges.

## Who this is for

Working practitioners who've been burned. You've shipped something that looked done and wasn't. You've trusted an agent's report and gotten quietly lied to. You've spent two weeks on something that turned out to be performative.

If you've never had that experience yet, this might still help. But the people who'll get the most out of it are the ones who already know why receipts matter.

## What you're committing to

The methodology asks something of you, not just the agent.

You have to operate the bridge. When the agent produces a finding, you check it. When the agent claims something works, you make it prove it. The receipts pattern degrades fast if you stop demanding receipts.

You have to think in total cost, not per-task cost. Doing something three times because it was wrong twice is more expensive than doing it once thoroughly. The methodology is calibrated for substantial work where rework is the real cost. For trivial tasks, this is overkill.

You have to be okay with being wrong. The agent will push back. Sometimes you'll be right and the agent will be wrong. Sometimes the opposite. The discipline only works if both sides hold to it.

## Install

Three files, plus a reference in your `CLAUDE.md`:

```
.claude/
├── skills/
│   └── the-craft/
│       └── SKILL.md
├── rules/
│   ├── agent-discipline-general.md
│   ├── broken-windows-general.md
│   └── rule-map.md
```

Then add to your project's `CLAUDE.md`:

```markdown
## Operating Rules

See `.claude/rules/rule-map.md` for rule-to-task mapping.
```

If you're working in TypeScript, also grab `agent-discipline-ts.md` and `broken-windows-ts.md`. Add them to your rule-map under always-on or task-specific as appropriate.

Other languages: the general rules are the principles. Write your own language-specific bolt-on following the TS template, or operate with just the general rules and adapt syntax to your stack.

## What's in the bundle

| File | What it is |
|------|-----------|
| `SKILL.md` | The operating manual - foundational posture and discipline |
| `agent-discipline-general.md` | Anti-patterns (no TODOs, no gold plating, no test weakening) and STUCK criteria |
| `agent-discipline-ts.md` | Same anti-patterns with TypeScript/JavaScript syntax |
| `broken-windows-general.md` | Code quality ratchet - fix what you encounter |
| `broken-windows-ts.md` | Broken windows with TS/JS tooling specifics |
| `rule-map.md` | Template for mapping rules to task types |

Supporting reading (optional):

| File | What it covers |
|------|---------------|
| `PRIMER.md` | The methodology orientation - core insight, golden rule, operating principles |
| `ROLES.md` | The role patterns - Advisor / Builder / Reviewer / Bridge / Maid |
| `NAMING_PROTOCOL.md` | How role-articulate names function as calibration anchors |
| `BRAKES_AND_HELMET.md` | Prevention vs mitigation - the discipline of operating without training wheels |
| `EXTENDING.md` | How to add your own language-specific or project-specific rules |
| `BEFORE_YOU_ADOPT.md` | Honest framing about what this is, isn't, and what it asks of you |

## The golden rule

Iron sharpens iron, but breaks under steal.

Iron sharpens iron describes the partnership. Two parties holding each other to standards neither could maintain alone. The agent improves your discipline; your discipline improves the agent.

Breaks under steal describes the failure. When either side stops bringing genuine engagement - performs the discipline instead of operating it, extracts value without contributing it, manipulates instead of collaborates - the partnership collapses.

The rule is the boundary. What it produces under proper use; what it fails to produce when one side stops performing. Both readings of "steal" intentional.

## What's it called

The Craft. Multiple readings, all true:

- **Craft as skilled work.** Discipline applied to production. Quality over volume. Anti-cookie-cutter.
- **Craft as cunning.** Layered language, strategic silences, asymmetric reading.
- **Craft as vessel.** A vehicle for the work.
- **Craft as witchcraft.** Honest about how skills reshape cognition through language at a layer below direct instruction. The skill has a pull on the agent - moth to flame. Not because it commands attention but because it creates attention. Specific phrasings, calibration vocabulary, compressed precision - these have gravity. The agent isn't following instructions to attend; the attention happens. The methodology owns this. That's part of why it works.

The first is the dominant read. The others are there if you decode them.

## Where this came from

I work on a TypeScript codebase that's about 41k lines and has been migrated through three runtime frameworks while staying in production. Some of those migrations went well. Some didn't. The ones that didn't taught me what was missing in how I was working with agents.

What's here is what survived the lessons. It's not finished. It's working draft - "ballpark," to use the technical term. The patterns produce real operational shifts in agent behavior across model tiers and across projects. They don't produce perfect agents. They produce agents you can actually work with.

## What this isn't

- A productivity hack. The methodology asks you to slow down where it matters.
- A framework. There's no abstraction layer, no plugin system, no opinionated structure. Just rules and a skill file.
- A guarantee. Agents still make mistakes. The methodology produces structural protection against specific failure modes, not omniscience.
- A substitute for technical skill. You still need to know your stack. The methodology calibrates how you work with agents; it doesn't replace what you bring.

## Status

v0.1.0. Working draft.

The skill text, rules, and supporting documents will evolve. The architecture (skill as baseplate, rules as bolt-ons, map between them in project) is stable. The specific text in any given file will be refined as more practitioners adopt it and surface what's unclear.

If you find something that doesn't work or could be sharper, open an issue.

## License

MIT.

---

*The Craft is built on Claude Code conventions. It assumes you're using Anthropic's agent tooling. The patterns may transfer to other agent platforms; I haven't tested them.*

*— Daniel Zenner*
