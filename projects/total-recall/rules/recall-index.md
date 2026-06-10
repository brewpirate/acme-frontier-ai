---
description: Instructs agents to use the total-recall index for context recovery
globs: "**/*"
---

# Recall Index — Context Recovery

When you encounter a concept, term, or file reference that feels familiar but you lack specific details about, check `.claude/recall-index.json` before re-reading files.

## How to Use

1. Read `.claude/recall-index.json`
2. Identify your model (haiku, sonnet, or opus) — look up terms under your model's section in the `models` object. If your exact model isn't listed, use the closest available.
3. Search for keywords related to the concept you need
4. Each match gives you:
   - **files**: Which files contain the relevant content
   - **phrase**: A trigger phrase optimized for your model — reading this phrase should reactivate your associations with the file's content
5. If the trigger phrase is sufficient to recall what you need, proceed without re-reading the file
6. If you need specific details (exact code, precise rules), re-read the file — triggers maintain awareness, not detail

## When to Check

- Before re-reading a file you've already loaded earlier in this session
- When a user references a concept from a rule or skill you read earlier
- When you need to recall the gist of a file but don't need its exact contents
- When context is long and earlier content may have decayed in attention

## Cross-Model Terms

The `crossModel` section contains terms that all models agree on — these are the most reliable lookup keys regardless of which model you are.
