---
name: forget
description: Remove trigger phrases for a file or glob pattern from .claude/triggers.json
allowed-tools: Read, Edit
---

# Forget — Remove Trigger Phrases

## Process

1. Read `.claude/triggers.json`. If it doesn't exist or is empty, report "No triggers to forget."

2. Match the user's argument against stored file paths:
   - Exact path match
   - Glob/substring match (e.g., `src/auth/*` removes all auth triggers)

3. Remove matching entries from the triggers object.

4. Write the updated file back.

5. Report what was removed. For v2 entries, list each model's phrase so the user sees what was discarded:

   ```
   Removed 3 triggers:
   - src/auth/middleware.ts
       sonnet: jwt route authentication guard
       opus:   jwt bearer token route guard
   - src/auth/session.ts
       sonnet: session token management
   - src/auth/roles.ts
       sonnet: role based access control
   ```

   For v1 (legacy) entries, list the single flat phrase.

6. If nothing matched, report "No triggers matched that pattern."

7. Suggest rerunning `/total-recall:index` if the index should be rebuilt without the removed entries.
