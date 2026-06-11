---
name: seed
description: Scan prompt files, CLAUDE.md docs, skill definitions, and other documentation to seed trigger phrases — bootstrapping total-recall from existing project knowledge. Supports --models flag for model-scoped triggers.
---

# Seed — Bootstrap Triggers from Docs and Prompts

## Overview

Automatically discover and scan documentation, prompt files, skill definitions, and configuration docs in the project. This seeds the trigger index from existing project knowledge so total-recall is useful immediately without manually scanning every file.

## Process

### 1. Parse Arguments

- **`--models <list>`**: Comma-separated list of target models (e.g., `--models sonnet,opus`). Default: `sonnet`
- **`--force` or `--rescan`**: Re-scan files that already have triggers
- **Optional path**: Limit seeding to a specific directory

### 2. Discover Seedable Files

Glob for documentation and prompt files across the project:

- `**/CLAUDE.md` — project instructions
- `**/.claude/**/*.md` — claude config docs
- `**/skills/**/SKILL.md` — skill definitions
- `**/agents/*.md` — agent definitions
- `**/commands/*.md` — command definitions
- `**/docs/**/*.md` — documentation directories
- `**/README.md` — readmes
- `**/*.prompt.md`, `**/*-prompt.md` — prompt files
- `**/ARCHITECTURE.md`, `**/CONTRIBUTING.md`, `**/CHANGELOG.md`

Exclude: `node_modules/`, `dist/`, `build/`, `.git/`

If the user provided a specific path, scan only that path.

### 3. Filter Already-Scanned

Read `.claude/triggers.json`. Skip any files that already have trigger entries for ALL requested models, unless the user passed `--force` or `--rescan`. Files with triggers for some but not all requested models will be scanned for the missing models only.

### 4. Invoke Researcher

For each batch of unscanned files (up to 20 per batch), spawn the `researcher` agent (use the Agent tool with `subagent_type` set to `total-recall:researcher`):

```
Generate trigger phrases for these files.
Target models: <comma-separated model list>

Files:
<list absolute file paths, one per line>
```

### 5. Store Results

Merge results into `.claude/triggers.json` using the model-scoped format (version 2). Tag seeded entries with `"source": "seed"`:

```json
{
  "src/auth/middleware.ts": {
    "models": {
      "sonnet": {
        "phrase": "jwt route authentication guard",
        "samples": ["...", "..."],
        "convergence": ["jwt", "route", "auth"],
        "confidence": 0.85,
        "phases": 1
      }
    },
    "crossModelTerms": ["jwt", "route"],
    "source": "seed",
    "scannedAt": "2026-04-01T10:00:00.000Z"
  }
}
```

### 6. Rebuild Index

After storing all results, invoke the `total-recall:index` skill to rebuild the master word index.

### 7. Report

```
Seeded N new triggers from M files (models: sonnet, opus):

  File                              | Model  | Trigger Phrase                    | Confidence
  --------------------------------- | ------ | --------------------------------- | ----------
  CLAUDE.md                         | sonnet | project rules and conventions     | 0.88
  CLAUDE.md                         | opus   | project conventions enforcement   | 0.95

Skipped K files (already scanned for all target models). Use --rescan to regenerate.
Rebuilt recall index: X words → Y files across Z models.
```
