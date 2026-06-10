#!/bin/bash
# Re-injects memory and git state after context compaction.
# Runs on SessionStart with matcher "compact".
# stdout is injected directly into Claude's context.

INPUT=$(cat)
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')

[ -z "$CWD" ] && exit 0

SANITIZED_CWD=$(echo "$CWD" | tr '/' '-')
MEMORY_DIR="$HOME/.claude/projects/${SANITIZED_CWD}/memory"

echo "## Restored context after compaction"
echo ""

# --- Memory files (skip the index) ---
if [ -d "$MEMORY_DIR" ]; then
  echo "### Memory"
  for file in "$MEMORY_DIR"/*.md; do
    [ -f "$file" ] || continue
    [ "$(basename "$file")" = "MEMORY.md" ] && continue
    echo "#### $(basename "$file" .md)"
    cat "$file"
    echo ""
  done
fi

# --- Git state ---
if command -v git &>/dev/null && git -C "$CWD" rev-parse --git-dir &>/dev/null 2>&1; then
  echo "### Git state"
  echo "Branch: $(git -C "$CWD" branch --show-current)"
  echo ""
  git -C "$CWD" log --oneline -5
  echo ""
  git -C "$CWD" status --short
fi
