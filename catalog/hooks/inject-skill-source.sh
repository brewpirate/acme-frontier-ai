#!/usr/bin/env bash
# Force-read SKILL.md when a skill is invoked.
#
# Slash-command and Skill-tool invocations both paste skill content into context,
# but the paste can be truncated, frontmatter-stripped, or out of sync with the
# file on disk. This hook injects a system reminder that names the canonical
# file path so the model has an auditable Read receipt before acting.
#
# Fired by two hook events:
#   - PostToolUse  (matcher: Skill)  — Skill tool invocation
#   - UserPromptSubmit               — slash-command invocation (parses prompt)

set -eo pipefail

input=$(cat)
event=$(echo "$input" | jq -r '.hook_event_name // empty')

# Collect skill names mentioned in this event.
skills=""
case "$event" in
  PostToolUse)
    skill=$(echo "$input" | jq -r '.tool_input.skill // empty')
    [ -n "$skill" ] && skills="$skill"
    ;;
  UserPromptSubmit)
    prompt=$(echo "$input" | jq -r '.prompt // empty')
    # Match <command-name>/skill-name</command-name> patterns (slash-command expansions).
    skills=$(echo "$prompt" | grep -oE '<command-name>/[a-zA-Z0-9_:-]+</command-name>' \
      | sed 's|<command-name>/||; s|</command-name>||' \
      | sort -u || true)
    ;;
  *)
    echo '{}'; exit 0
    ;;
esac

[ -z "$skills" ] && { echo '{}'; exit 0; }

# Resolve each skill name to a SKILL.md path.
# Search order: project-local, then user-global, then plugin paths if "plugin:skill".
resolved=""
while IFS= read -r skill; do
  [ -z "$skill" ] && continue

  plugin=""; bare="$skill"
  if [[ "$skill" == *:* ]]; then
    plugin="${skill%%:*}"
    bare="${skill##*:}"
  fi

  paths=(
    "$PWD/.claude/skills/$bare/SKILL.md"
    "$HOME/.claude/skills/$bare/SKILL.md"
  )
  if [ -n "$plugin" ]; then
    # Plugin skills live under marketplaces/<marketplace>/plugins/<plugin>/skills/<name>.
    # The marketplace name isn't carried in the namespaced reference, so glob across all.
    for candidate in "$HOME"/.claude/plugins/marketplaces/*/plugins/"$plugin"/skills/"$bare"/SKILL.md; do
      [ -f "$candidate" ] && paths+=("$candidate")
    done
    # Fallback: cache path with the `unknown` literal segment.
    for candidate in "$HOME"/.claude/plugins/cache/*/"$plugin"/unknown/skills/"$bare"/SKILL.md; do
      [ -f "$candidate" ] && paths+=("$candidate")
    done
  fi

  for p in "${paths[@]}"; do
    if [ -f "$p" ]; then
      resolved="${resolved}- /${skill} → ${p}"$'\n'
      break
    fi
  done
done <<< "$skills"

[ -z "$resolved" ] && { echo '{}'; exit 0; }

message=$(printf "Skill invocation detected. The slash-command paste may be truncated or out of sync with disk. Before acting on these skills, Read the canonical file(s) below:\n\n%s" "$resolved")

jq -n --arg event "$event" --arg msg "$message" '{
  hookSpecificOutput: {
    hookEventName: $event,
    additionalContext: $msg
  }
}'
