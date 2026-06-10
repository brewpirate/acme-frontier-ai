---
name: scan
description: Study files and generate semantic trigger phrases by spawning a researcher agent that samples model associations and finds convergent patterns. Supports model-specific triggers via --models flag.
---

# Scan — Generate Trigger Phrases

## Overview

Scan one or more files to generate training-data-resonant trigger phrases. Each file is studied by 5 independent agents per target model; a research agent identifies convergent patterns to produce the most reliable semantic handle for each model.

Triggers are **model-scoped** — different models have different internal lookup keys. Specify which models your agents use so triggers are generated for the right audience.

## Process

### 1. Parse Arguments

- **File or directory path**: What to scan
- **`--models <list>`**: Comma-separated list of target models (e.g., `--models sonnet,opus`). These are the models your agents run on. Default: `sonnet`
- **No path**: Ask the user what to scan

### 2. Resolve Input

- If the user provided a **file path**: use it directly
- If the user provided a **directory**: glob for relevant source files
  - Include: `**/*.{ts,tsx,js,jsx,py,go,rs,md,json,yaml,yml,sh,sql,css,scss,html,svelte,vue}`
  - Exclude: `node_modules/`, `dist/`, `build/`, `.git/`, `*.lock`, `*.min.*`
  - Cap at 20 files per run. If more, inform the user and process the first 20.
- If **no argument**: ask the user what to scan

### 3. Invoke Researcher Agent

Spawn the `researcher` agent (use the Agent tool with `subagent_type` set to `total-recall:researcher`). Provide it with the resolved file list and target models:

```
Generate trigger phrases for these files.
Target models: <comma-separated model list>

Files:
<list each absolute file path, one per line>
```

The researcher will spawn 5 study agents per model per file and perform per-model convergence analysis.

### 4. Store Results

Read `.claude/triggers.json` (create if it doesn't exist with `{"version": 2, "triggers": {}}`).

For each file result from the researcher, merge into the triggers object using the **model-scoped** format:

```json
{
  "version": 2,
  "triggers": {
    "src/auth/middleware.ts": {
      "models": {
        "sonnet": {
          "phrase": "jwt route authentication guard",
          "samples": ["all", "five", "raw", "phrases", "..."],
          "convergence": ["jwt", "route", "auth"],
          "confidence": 0.90,
          "phases": 1
        },
        "opus": {
          "phrase": "jwt bearer token route guard",
          "samples": ["all", "five", "raw", "phrases", "..."],
          "convergence": ["jwt", "bearer", "route", "guard"],
          "confidence": 0.98,
          "phases": 1
        }
      },
      "crossModelTerms": ["jwt", "route"],
      "scannedAt": "2026-04-01T10:00:00.000Z"
    }
  }
}
```

Use **relative paths** (from project root) as keys. When adding new model results to a file that already has triggers for other models, **merge** into the existing `models` object — do not overwrite other models' triggers.

### 5. Rebuild Index

After storing results, invoke the `total-recall:index` skill to rebuild the master word index from all triggers.

### 6. Report

Display results as a table:

```
Target models: sonnet, opus

File                        | Model  | Trigger Phrase                 | Confidence
--------------------------- | ------ | ------------------------------ | ----------
src/auth/middleware.ts      | sonnet | jwt route authentication guard | 0.90
src/auth/middleware.ts      | opus   | jwt bearer token route guard   | 0.98
src/db/connection.ts        | sonnet | database connection pool mgmt  | 0.85
src/db/connection.ts        | opus   | database pool lifecycle rules  | 0.95

Cross-model terms: jwt, route, database, pool
```

If any file had low confidence (< 0.7), note it and suggest rescanning, model escalation, or splitting the file (low convergence often means the file covers multiple unrelated topics — see "resonance linting" in the README).

### Migration Note

If `.claude/triggers.json` has `"version": 1` (old format with flat phrases), the scan will overwrite entries for scanned files with the new model-scoped format. Unscanned files retain the old format until re-scanned.
