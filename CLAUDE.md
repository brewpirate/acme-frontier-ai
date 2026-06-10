# CLAUDE.md

Orientation for any agent working in this repository. Read it fully; assume no prior context.

## What this is

ACME Frontier AI is a **public testbed for human–AI collaboration experiments.** It is a sandbox, not a product. Skills, rules, agents, workflows, tools, and working philosophy get tried here — fast and rough. Most experiments fail. The failures are documented and kept. The ones that earn it graduate to their own repositories, where production discipline begins.

This repo is where ideas are *born and tested*, not where they are *polished and shipped*. Treat it accordingly.

## How to work here

- **Ship experiments.** An idea running in the open beats a better idea left unwritten. Bias toward putting something testable in front of reality.
- **Rough is fine. Failing is expected.** This is a lab. Don't gold-plate. Don't wrap production scaffolding around an experiment that hasn't earned it. Over-engineering the sandbox is the failure mode here — not under-polishing it.
- **Failures are the product.** When something backfires, that's a result, not an embarrassment. Capture it: what it was for, how it broke, and *why*.
- **Document the why, not just the what.** The reason behind a change is the load-bearing record. If you genuinely don't know the why, *say so* — never reconstruct a plausible-sounding reason after the fact and present it as the real one. A blank reason is honest; a guessed one is a fabrication.
- **Done means it was seen to run.** Not "looks right." Run it, verify it. A claim is not evidence.
- **Don't fabricate.** No invented file paths, no imagined results, no incidents that didn't happen. If it isn't real, it doesn't go in the record.

## Graduation

When an experiment clearly works and clearly wants to live on its own, it moves to a dedicated repository. That's where gates, tests, and production discipline apply. Here, they mostly don't — on purpose. Don't import the heavy apparatus into the sandbox.

## Voice

Anything reader-facing — the README, PR descriptions, templates, release notes, docs — stays in the project's voice: deadpan, corporate, straight-faced. See `VOICE.md` for the rules and examples. Keep that voice *out* of code, config, commit-level detail, and anything that has to be parsed literally. Clarity wins wherever ambiguity would cost.

## The short version

Try things. Let them fail. Write down why. Promote what survives. Keep a straight face.
