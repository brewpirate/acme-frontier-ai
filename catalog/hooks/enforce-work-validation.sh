#!/usr/bin/env bash
# Stop hook: Blocks agents from finishing a zenflow:exec-plan or zenflow:dispatch session
# without invoking zenflow:check-work.
#
# Also supports legacy skill names for backwards compatibility.
set -euo pipefail

input=$(cat)

# Prevent infinite loops
stop_hook_active=$(echo "$input" | jq -r '.stop_hook_active')
if [[ "$stop_hook_active" == "true" ]]; then
  exit 0
fi

# Don't interfere with plan mode (separate hook handles that)
permission_mode=$(echo "$input" | jq -r '.permission_mode')
if [[ "$permission_mode" == "plan" ]]; then
  exit 0
fi

# Get transcript path
transcript_path=$(echo "$input" | jq -r '.transcript_path // empty')
if [[ -z "$transcript_path" || ! -f "$transcript_path" ]]; then
  exit 0
fi

# Check if an execution or collab skill was activated
if ! grep -qE '"(zenflow:exec-plan|zenflow:dispatch|zenflow:collab|executing-plans)"' "$transcript_path" 2>/dev/null; then
  exit 0
fi

# Check if zenflow:check-work was invoked
if grep -qE '"(zenflow:check-work|work-validation)"' "$transcript_path" 2>/dev/null; then
  exit 0
fi

# Block: execution/collab skill active but check-work never ran
printf '{"decision": "block", "reason": "You MUST run zenflow:check-work before finishing. Invoke it with the Skill tool now."}'
