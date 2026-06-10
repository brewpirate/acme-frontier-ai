---
name: list
description: Display all stored trigger phrases from .claude/triggers.json
allowed-tools: Read
---

# List — Show Trigger Phrases

## Process

1. Read `.claude/triggers.json`. If it doesn't exist, report "No triggers stored yet. Run `/total-recall:scan` to generate some."

2. If the user provided a **filter pattern** (e.g., `src/auth`), only show entries whose file path contains that pattern.

3. Display as a formatted table — one row per (file, model) pair so per-model phrases and confidences are both visible:

```
File                        | Model  | Trigger Phrase                 | Confidence | Scanned
--------------------------- | ------ | ------------------------------ | ---------- | ----------
src/auth/middleware.ts      | sonnet | jwt route authentication guard | 0.90       | 2026-03-31
src/auth/middleware.ts      | opus   | jwt bearer token route guard   | 0.98       | 2026-03-31
src/db/connection.ts        | sonnet | database connection pool mgmt  | 0.85       | 2026-03-31
```

For v1 (legacy) entries with a flat `phrase` field, render the row with `Model = (legacy)`.

4. After the table, show:
   - Total count: `N triggers stored across M files (K model-entries).`
   - Cross-model terms summary if any entries have `crossModelTerms`.
   - A note when any entry's confidence is `< 0.7` — these are candidates for resonance-lint review (see README).
