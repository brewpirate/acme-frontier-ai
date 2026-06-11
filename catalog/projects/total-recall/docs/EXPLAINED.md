# What is total-recall? (plain-language)

## The 30-second version

When an AI assistant reads a file, it forms associations with that file in its head. Those associations fade as the conversation gets longer and more files get read. Eventually the AI either drifts away from the rules in that file, or it has to re-read the file — which is slow and expensive.

Total-recall finds **the smallest set of words that bring those associations back** — usually 3 to 6 words per file. Then later, when the AI is starting to drift, those words get whispered back at it and the file's content snaps back into focus. Like saying "remember the Alamo" instead of re-narrating the whole battle.

## A useful analogy

When you hear the first three notes of a song you know, the whole song lights up in your head. You didn't hear the song — you heard a *key* that unlocks the song. Three notes did the work of three minutes.

Total-recall finds those keys, but for the AI. We hand each of your files (rules, docs, instructions, anything important) to the AI five separate times and ask it to describe the file in six words or fewer. We watch which words it keeps gravitating toward on its own across the five tries. Those convergent words — the ones the AI returns to without being prompted — are the keys.

The crucial bit: **we cannot pick the keys ourselves**, because we don't know the AI's internal associations. The AI has to name them. Our job is to listen across multiple samples and notice the pattern.

## Why this matters

Long AI sessions drift. You give the AI a rule like "always test the behavior, not the implementation details." Two hours and eighty messages later, the AI starts writing tests that lock in implementation details. Not because it disagrees with the rule — because the rule has slipped out of its working attention.

The brute-force fix is to paste the whole rules file in again. That's expensive (it costs many tokens) and ironically makes the problem worse — more text in the conversation means more dilution of attention.

Total-recall's bet: **a few well-chosen words can bring the rule back into focus** without re-pasting the file. Cheaper, less invasive, and — when it works — enough.

## How the workflow looks

You run three commands, once, when you set up:

1. **Scan** the rule files. The AI samples each one, finds the convergent keys, saves them.
2. **Write** the keys into the rule files themselves (in their YAML frontmatter, so the keys travel with the files).
3. **Schedule** automatic re-injection. Every 15 or 30 minutes during your session, the AI gets reminded of the keys for the rules that matter most.

That's it. The rest happens in the background.

## The unexpected useful side effect

If five AI samples can't agree on a few short keys for a file, that's a strong signal: **the file is trying to do too many things at once**. The AI literally can't compress it into a clean handle.

Low convergence becomes a diagnostic: rules that won't compress are rules that probably need rewriting. We've seen this fire correctly — files that scored low convergence really did cover two unrelated topics.

So even if you never trust the recall mechanism, the scan output tells you which of your rules are well-focused and which aren't.

## What total-recall is NOT

- **Not a summary.** A summary tries to compress the *content*. Triggers don't carry content; they carry pointers to content the AI already saw.
- **Not search.** Search finds files matching a query. Triggers reactivate files the AI already loaded earlier in the session.
- **Not magic.** The AI still has to have read the file at some point. Triggers refresh attention on already-loaded content; they don't conjure it from nothing.
- **Not a memory across sessions.** When a new conversation starts, no triggers fire automatically — you re-set them up. (A future version will persist them across sessions.)

## The honest part

We have many anecdotal observations of triggers working in real working sessions, including ones where the AI visibly corrected its own behavior the moment a trigger phrase was injected.

We also have three controlled lab tests where we couldn't measure any effect at all — but we also couldn't reproduce the lab conditions where the problem actually appears (long, organic, multi-hour working sessions with real context decay). The lab tests don't refute the real-session observations; they just can't confirm them. The README has the full accounting under "Behavioral Efficacy: What We Tested."

The mechanism (the AI naming its own associative keys, model by model) is well-evidenced. The product (re-injecting those keys actually keeps long sessions on track) is supported by anecdotes pending better instrumentation. Fair to use, fair to be skeptical of, fair to test on your own work and decide.

## Who this is for

- People running long AI coding sessions where rules / conventions / instructions matter and tend to drift.
- Teams who maintain rule files (`.claude/rules/`, CLAUDE.md, skill definitions) and want them to stay active throughout a session.
- Anyone curious whether a model can reliably name its own internal lookup keys for content. The pipeline lets you find out.

## Next reads

- **README.md** — the technical overview, architecture, test data, full honesty section.
- **docs/QUICKSTART.md** — first five minutes, three commands, what you'll see.
- **docs/research/FEASIBILITY.md** — for the AI-research-curious, the mechanism analysis.
