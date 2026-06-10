---
name: write
description: "Write trigger phrases from .claude/triggers.json into file frontmatter as model-scoped trigger_phrase fields. Bridges trigger generation (scan) with scheduled injection (total-recall:schedule)."
allowed-tools: Read, Edit, Glob, Grep, Bash, AskUserQuestion
---

# Write — Inject Triggers Into Frontmatter

## Overview

Read `.claude/triggers.json` and write each file's trigger phrases into its YAML frontmatter as model-scoped `trigger_phrase` fields. This makes triggers discoverable by tools that read frontmatter (like `total-recall:schedule`) without requiring a separate JSON lookup.

## Target Format

After writing, a file's frontmatter will include:

```yaml
---
name: some-skill
description: "..."
trigger_phrase:
  opus: "reverse word index builder"
  sonnet: "word lookup reverse mapping"
  haiku: "index word files"
---
```

Only models with triggers are included. Existing frontmatter fields are preserved.

## Process

### 1. Read Triggers

Read `.claude/triggers.json`. If it doesn't exist, report: "No triggers found. Run `/total-recall:scan` first to generate triggers."

Parse the version 2 format:
```json
{
  "version": 2,
  "triggers": {
    "path/to/file.md": {
      "models": {
        "opus": { "phrase": "...", ... },
        "sonnet": { "phrase": "...", ... }
      }
    }
  }
}
```

### 2. Check Each File

For each file in triggers.json:

1. **Check if the file exists.** If not, note it as skipped (file may have been deleted or moved since scanning).
2. **Read the file** and parse its YAML frontmatter (content between `---` delimiters).
3. **Compare** the existing `trigger_phrase` in frontmatter (if any) against triggers.json.
4. **Classify** the file as:
   - **Up to date** — frontmatter `trigger_phrase` matches triggers.json exactly
   - **Needs update** — frontmatter is missing `trigger_phrase` or has stale values
   - **No frontmatter** — file has no YAML frontmatter at all
   - **Missing file** — file no longer exists

### 3. Present to User

Present the results in batches of up to 5 files via `AskUserQuestion` (multi-select).

For each file, show:
- File path
- Status (needs update / no frontmatter / up to date)
- The trigger phrases that will be written, per model

Example question:

> "These files have triggers ready to write into frontmatter. Select which to update:"

Options per batch:
- Each file as a selectable option with description showing the phrases
- "Skip all" option

**Files that are already up to date are not shown** — only files that need changes.

If all files are up to date, report: "All triggers are already written to frontmatter. Nothing to update."

### 4. Write Frontmatter

For each selected file:

**If the file has existing frontmatter:**

1. Read the full file content
2. Parse the YAML frontmatter block (between the first `---` and second `---`)
3. If `trigger_phrase` already exists in frontmatter, replace it
4. If `trigger_phrase` doesn't exist, add it as the last field before the closing `---`
5. Use the `Edit` tool to make the change — replace the old frontmatter block with the updated one
6. Preserve all other frontmatter fields exactly as they are

**If the file has no frontmatter:**

Use `AskUserQuestion` to confirm: "This file has no frontmatter. Add frontmatter with just the trigger_phrase field?"

If confirmed, prepend:
```yaml
---
trigger_phrase:
  opus: "phrase here"
---
```

**Frontmatter format for trigger_phrase:**

```yaml
trigger_phrase:
  opus: "reverse word index builder"
  sonnet: "word lookup reverse mapping"
```

- One line per model, indented with 2 spaces
- Models in alphabetical order (haiku, opus, sonnet)
- Only include models that have triggers — don't add empty keys
- Phrases are quoted strings

### 5. Report Results

After all writes complete, summarize:

```
Trigger phrases written to frontmatter:

  Updated:
    ✓ skills/index/SKILL.md (opus)
    ✓ skills/scan/SKILL.md (opus, sonnet)

  Skipped (already current):
    - skills/list/SKILL.md

  Skipped (user declined):
    - skills/forget/SKILL.md

  Skipped (file missing):
    - some/old-path.md

  Total: N updated, N skipped
```

## Edge Cases

- **File deleted since scan:** Skip and note. Don't error.
- **File has no frontmatter:** Ask user before adding. Some files (like plain markdown docs) shouldn't get frontmatter.
- **Frontmatter has unusual formatting:** Preserve the original indentation style. If parsing fails, skip the file and report the error.
- **triggers.json is version 1 (no model scoping):** Report "triggers.json is version 1 (no model scoping). Run `/total-recall:scan --models` to generate model-scoped triggers first."
- **Empty triggers.json:** Report "No triggers stored. Run `/total-recall:scan` to generate some."

## What Not to Do

- **Don't modify file content below the frontmatter.** Only touch the YAML between `---` delimiters.
- **Don't reorder existing frontmatter fields.** Add `trigger_phrase` at the end, before the closing `---`.
- **Don't write without user confirmation.** Always present changes via `AskUserQuestion` first.
- **Don't silently skip errors.** If a file can't be parsed, tell the user which file and why.
- **Don't create backup files.** The user has git for that.
