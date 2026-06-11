---
name: index
description: Build a reverse word-to-files index from all stored triggers. Model-aware — builds per-model lookup so agents find triggers matched to their own model.
allowed-tools: Read, Edit
---

# Index — Build Master Word Index

## Overview

Reads `.claude/triggers.json` and builds `.claude/recall-index.json` — a reverse lookup that maps individual words and terms to the files they came from, organized by model. When an agent encounters a concept, it checks the index to find which files are relevant and gets the trigger phrase optimized for its own model.

## Process

### 1. Read Triggers

Read `.claude/triggers.json`. If it doesn't exist or has no triggers, report "No triggers to index. Run `/total-recall:scan` first."

### 2. Build Reverse Index

For each trigger entry:

1. Detect format:
   - **v2 (model-scoped)**: Entry has a `models` object with per-model phrases
   - **v1 (legacy)**: Entry has a flat `phrase` field — treat as model `"haiku"` for backwards compatibility

2. For each model in the entry:
   - Take the **active phrase** and all **convergence terms**
   - Tokenize into individual words
   - Normalize: lowercase, strip plurals (simple `s` suffix), collapse obvious synonyms (e.g., "auth"/"authentication"/"authenticate" → "auth")
   - For each normalized word, add the file path to that word's entry under the appropriate model

3. Also build a **cross-model** section from `crossModelTerms` if present

### 3. Score Entries

For each word per model in the index, calculate a **weight** based on:
- How many triggers it appeared in (higher = more generic, lower weight)
- Whether it came from a convergence term (higher weight) vs just the phrase
- Inverse document frequency — words appearing in fewer files are more distinctive

### 4. Write Index

Write `.claude/recall-index.json`:

```json
{
  "version": 2,
  "builtAt": "2026-04-01T10:05:00.000Z",
  "triggerCount": 15,
  "models": {
    "sonnet": {
      "jwt": {
        "files": ["src/auth/middleware.ts"],
        "phrase": "jwt route authentication guard",
        "weight": 0.9
      },
      "broken windows": {
        "files": ["rules/broken-windows.md"],
        "phrase": "broken windows code quality ratchet",
        "weight": 0.95
      }
    },
    "opus": {
      "jwt": {
        "files": ["src/auth/middleware.ts"],
        "phrase": "jwt bearer token route guard",
        "weight": 0.92
      },
      "broken windows": {
        "files": ["rules/broken-windows.md"],
        "phrase": "broken windows codebase quality ratchet",
        "weight": 0.98
      }
    }
  },
  "crossModel": {
    "jwt": {
      "files": ["src/auth/middleware.ts"],
      "weight": 0.9
    },
    "quality": {
      "files": ["rules/broken-windows.md", "rules/hard-requirements.md"],
      "weight": 0.8
    }
  }
}
```

The key change: each index entry under a model includes the **phrase** field — so an agent can look up a term and immediately get the trigger phrase optimized for its own model, without reading triggers.json.

### 5. Prune Noise

Remove words with weight below 0.2 — these are too generic to be useful triggers (e.g., "data", "handle", "process").

Also remove common stop words: the, a, an, is, are, was, were, be, been, being, have, has, had, do, does, did, will, would, could, should, may, might, can, shall, for, and, but, or, nor, not, so, yet, both, either, neither, each, every, all, any, few, more, most, other, some, such, no, only, own, same, than, too, very, just, because, as, until, while, of, at, by, with, from, into, through, during, before, after, above, below, to, in, on, out, off, over, under, between, about, against, this, that, these, those, it, its.

### 6. Report

```
Built recall index: N words → M files across K models
Models indexed: sonnet, opus

Top 10 most distinctive terms (sonnet):
  jwt → src/auth/middleware.ts (0.95)
  ratchet → rules/broken-windows.md (0.92)
  ...

Cross-model universal terms: jwt, quality, typescript, ...
```
