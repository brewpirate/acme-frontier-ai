---
name: compare
description: Run cross-model comparison — scan files with haiku, sonnet, and opus study agents to see how model size affects trigger phrase generation.
---

# Cross-Model Comparison Skill

Compare trigger phrase generation across model sizes. Same file, same prompt, three models.

## Tools

- Agent (to spawn compare-researcher)
- Read, Edit (to store results)
- Glob (to resolve directories)

## Process

### 1. Resolve Input

- **File path**: Use directly
- **Directory**: Glob for relevant files (`*.{ts,tsx,js,jsx,py,go,rs,md,json,yaml,sh,sql,css,scss,html,svelte,vue}`), exclude `node_modules/`, `dist/`, `build/`, `.git/`, `*.lock`, `*.min.*`
- **No argument**: Ask the user what to compare
- Cap at 10 files per run (15 agent calls per file)

### 2. Invoke Compare Researcher

Spawn the `compare-researcher` agent:

```
Use Agent tool with:
  subagent_type: total-recall:compare-researcher
  prompt: |
    Compare trigger phrase generation across models for these files:
    <list each absolute file path, one per line>
```

### 3. Store Results

Read `.claude/compare-results.json` if it exists, otherwise create it. Append a new run entry:

```json
{
  "version": 1,
  "runs": [
    {
      "runAt": "<ISO timestamp>",
      "files": {
        "relative/path.md": {
          "models": {
            "haiku":  { "phrase": "...", "samples": [...], "convergence": [...], "confidence": 0.0 },
            "sonnet": { "phrase": "...", "samples": [...], "convergence": [...], "confidence": 0.0 },
            "opus":   { "phrase": "...", "samples": [...], "convergence": [...], "confidence": 0.0 }
          },
          "crossModelConvergence": [...],
          "modelSpecificTerms": { "haiku": [...], "sonnet": [...], "opus": [...] }
        }
      }
    }
  ]
}
```

Use relative paths as keys (relative to project root).

### 4. Display Results

Show a comparison table:

```
## Cross-Model Comparison Results

| File | Haiku | Sonnet | Opus | Shared Terms |
|------|-------|--------|------|--------------|
| testing.md | test behavior not implementation (0.99) | ... (0.xx) | ... (0.xx) | behavior, implementation |

### Analysis
- Files where all models agree: [list] — these are stable attractors
- Files where models diverge: [list] — larger models may surface deeper associations
- Average confidence: haiku X.XX | sonnet X.XX | opus X.XX
```

### 5. Do NOT rebuild the recall index

This is experimental data. Production triggers in `triggers.json` are not affected. Results in `.claude/compare-results.json` are not consumed by other skills — they exist for research and manual inspection.
