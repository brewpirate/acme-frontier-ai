---
name: view
description: Open the journal in a browser with the Tokyo Night HTML viewer.
disable-model-invocation: true
allowed-tools: Read, Bash
---

Open the agent journal in a browser viewer.

1. Check `.claude/journal.jsonl` exists — if not, tell the user to create entries first with `/field-notes:write`
2. Base64-encode the journal file (no line wrapping)
3. Build the URL: `file://<absolute path to ${CLAUDE_PLUGIN_ROOT}/scripts/journal.html>#<base64 data>`
4. Open it with the platform's default browser command (`xdg-open`, `open`, or `start`)
