# Before You Adopt

Before you drop these files into your `.claude/` directory, read this. It's short. It's honest about what you're committing to.

The Craft asks something of you, not just the agent. If you're not in a place to operate the discipline yourself, the methodology will degrade fast and produce worse outcomes than the defaults you'd otherwise have. Better to know that going in.

---

## What you're committing to

### Time pressure goes down. Total cost goes down. Per-task time may go up.

The skill includes the line "tokens and time are not constrained." That's not aspirational. It's load-bearing. The methodology operates by trading per-task speed for thoroughness, because rework is more expensive than doing it right once.

If your work is calibrated to ship-fast-iterate-later patterns, this fights you. If your work is calibrated to bugs-are-expensive patterns, this saves you. Know which one applies before adopting.

### You have to operate the bridge.

When the agent produces a finding, you check it. When the agent claims something works, you make it prove it. When you're tired and want to accept the report at face value, the discipline asks you to demand receipts anyway.

The receipts pattern degrades fast if you stop demanding receipts. The methodology is bilateral - both sides have to hold the standard. There's no version of this that works one-sided.

### You'll get pushback. Sometimes the agent will be right.

The skill explicitly instructs the agent to challenge assumptions, lead with what's wrong, and not pad responses with agreement. That produces friction. Sometimes the friction means you're wrong and the agent caught it. Sometimes the friction means the agent's wrong and you need to push back harder.

If you want an agent that agrees with you, this isn't the one. If you want an agent that catches you before you ship something broken, this might be.

### You have to be honest about your own failure modes.

Different practitioners undermine the methodology in different ways:

- Some accept findings without verifying when they're in a hurry
- Some apologize for being demanding when they should keep pushing
- Some add scope mid-task and call it "while we're in here"
- Some skip verification because "we trust the agent now"

The discipline catches these when you operate it. Operating it requires noticing when you're doing them. That's harder than it sounds.

---

## What the methodology doesn't do

### It doesn't make agents smarter.

The agent's underlying capability is what it is. The methodology produces structural discipline - the agent stops at expectation mismatches, surfaces ambiguities, demands evidence before claiming completion. That's not smarter; it's more honest.

Agents still make mistakes. Confident ones. The methodology gives you the structural footing to catch them, not the guarantee that they won't happen.

### It doesn't replace your domain knowledge.

You still need to know your stack. The methodology calibrates how you work with agents; it doesn't replace what you bring. If the work requires expertise you don't have, no methodology will substitute for that.

### It doesn't scale infinitely.

The methodology is calibrated for substantial work where verification matters. For trivial tasks - quick scripts, throwaway prototypes, one-shot questions - it's overkill. The skill self-scopes to "substantial tasks," but you have to recognize which is which.

### It doesn't defend against sophisticated adversaries.

This is honest, not paranoid: the discipline produces drift resistance and casual-misuse fragility. A practitioner actively trying to misuse AI agents will route around any document. The audience here is practitioners who want to do the work well and need structural support to maintain that.

---

## When this fits

You'll get value from this if:

- You work on substantial code in production
- You've been burned by an agent's confident-but-wrong output at least once
- You can spare time for verification because you've felt the cost of skipping it
- You want pushback more than you want validation
- You're willing to operate the discipline yourself, not just install it

## When this doesn't fit

Skip this and use defaults if:

- Your work is mostly quick iterations on prototypes
- Speed matters more than precision for what you ship
- You don't have the time budget for thorough verification
- You want agents that produce confident answers fast
- You're testing AI tools casually rather than depending on them

There's no shame in either fit. The methodology is for one specific shape of work. It doesn't claim to cover the rest.

---

## A note on expectations

This is a working draft. Version 0.1.0. It produces real operational shifts in agent behavior - that's been validated across model tiers and across projects. It does not produce perfect agents. The "ballpark" framing in the README is honest, not modest.

If you adopt this expecting a methodology that fully solves AI-coding reliability, you'll be disappointed. If you adopt it expecting working patterns that reduce a specific category of failures and require your discipline to operate, you might find it useful.

Calibrate accordingly. Adopt or don't. Either is a defensible call.
