# total-recall — Test Results

**Date:** 2026-03-31
**Source:** barf-ts/.claude/rules/ + docs/
**Pipeline:** 5 Haiku agents per file, convergence analysis by Sonnet researcher
**Total files scanned:** 26
**Total Haiku calls:** 130

---

## Summary

| Metric | Result |
|--------|--------|
| Files tested | 26 |
| Average confidence | 0.93 |
| Phase 1 convergence rate | 100% (0 files needed Phase 2) |
| Highest confidence | 0.99 (testing.md) |
| Lowest confidence | 0.80 (04-claude-integration.md) |

---

## Rules (14 files)

| File | Trigger | Confidence |
|------|---------|------------|
| broken-windows | quality ratchet broken windows | 0.90 |
| agent-discipline | stay focused avoid overreach | 0.95 |
| async-patterns | promises without silent failures | 0.95 |
| bun-native-apis | prefer bun native over node | 0.98 |
| dependency-injection | injectable dependencies over globals | 0.95 |
| error-handling | throw typed errors at boundaries | 0.98 |
| hard-requirements | non-negotiable code quality rules | 0.90 |
| imports-and-modules | module boundary import rules | 0.90 |
| naming-and-style | explicit naming conventions | 0.90 |
| options-objects | single options object for parameters | 0.98 |
| react-patterns | react state architecture blueprint | 0.90 |
| testing | test behavior not implementation | 0.99 |
| typescript-patterns | typescript type safety patterns | 0.95 |
| zod-schemas | zod schemas source of truth | 0.95 |

---

## Docs (12 files)

| File | Trigger | Confidence |
|------|---------|------------|
| CLAUDE.md | ai agent orchestration platform | 0.95 |
| README.md | autonomous issue driven development | 0.98 |
| ARCHITECTURE.md | autonomous issue orchestration engine | 0.90 |
| 01-issue-lifecycle | issues flow through states | 0.95 |
| 02-cli-commands | orchestrating issue workflow commands | 0.85 |
| 03-orchestration-engine | claude orchestration loop | 0.90 |
| 04-claude-integration | dual path into claude | 0.80 |
| 05-triage-and-interview | clarifying incomplete issues before work | 0.90 |
| 06-verification-and-audit | quality gates after build | 0.90 |
| PRD.md | autonomous ai development orchestrator | 0.95 |
| agent-roles | agent assembly line | 0.90 |
| batch-loop | state machine orchestrates automated work | 0.95 |

---

## Raw Samples

### broken-windows (0.90)
1. maintain code quality standards always
2. quality ratchet prevents decay
3. fix every broken window immediately
4. quality ratchet turns one direction
5. continuous codebase quality enforcement

**Convergence:** "quality" 5/5, "ratchet" 2/5 (low frequency, high salience)
**Note:** "ratchet" appears once in source file — hapax legomenon that TF-IDF would discard, yet agents surfaced it as the defining metaphor.

### agent-discipline (0.95)
1. stay focused avoid overreach
2. shipping code with discipline
3. stay focused avoid the siren song
4. stay focused avoid shortcuts
5. staying focused prevents wasted work

**Convergence:** "stay/focused" 4/5, "avoid" 3/5

### async-patterns (0.95)
1. fire and forget must fail loudly
2. promises without losing errors
3. no silent failures in async code
4. promises without silent failure
5. promises without silent failures

**Convergence:** "promises" 3/5, "silent failures" 3/5

### bun-native-apis (0.98)
1. prefer bun apis over node fs
2. prefer bun native over node
3. prefer bun over node
4. prefer bun native file apis
5. bun native api migration guide

**Convergence:** "bun" 5/5, "prefer" 4/5, "native" 3/5

### dependency-injection (0.95)
1. injectable behavior over global state
2. testing with injectable dependencies
3. injectable dependencies avoid global state
4. injectable defaults over globals
5. injectable dependencies with testable defaults

**Convergence:** "injectable" 5/5, "dependencies" 3/5
**Note:** "globals" demonstrates contrast encoding — the model captures what the file argues AGAINST, not just what it contains.

### error-handling (0.98)
1. throw typed errors catch at boundaries
2. discriminated errors bubble up
3. throw typed errors at boundaries
4. typed errors, global boundaries
5. throw typed errors catch at boundaries

**Convergence:** "typed errors" 5/5, "boundaries" 4/5, "throw" 3/5

### hard-requirements (0.90)
1. code quality rules immovable pillars
2. code quality rules enforce standards
3. non-negotiable code guardrails enforced
4. non-negotiable code quality standards
5. mandatory rules enforced by code

**Convergence:** "rules" 3/5, "non-negotiable/mandatory/immovable" 3/5, "enforced" 3/5

### imports-and-modules (0.90)
1. guiding the module import compass
2. standardized module boundary imports
3. monorepo alias convention rules
4. absolute imports shield module boundaries
5. standardized module boundaries and imports

**Convergence:** "module" 4/5, "imports" 4/5, "boundaries" 3/5

### naming-and-style (0.90)
1. explicit naming conventions for clarity
2. explicit over clever, names that speak
3. naming conventions and code clarity
4. explicit names beat abbreviations
5. code naming conventions and style rules

**Convergence:** "explicit" 3/5, "naming" 4/5, "conventions" 3/5

### options-objects (0.98)
1. function parameters as unified objects
2. single options object for function parameters
3. function parameters collapse into options objects
4. single options object beats positional parameters
5. functions need unified parameter objects

**Convergence:** "options/unified object" 5/5, "function parameters" 5/5

### react-patterns (0.90)
1. zustand state and component blueprint
2. react architecture and design conventions
3. react component state and architecture
4. react state organization blueprint
5. react architecture blueprint

**Convergence:** "react" 4/5, "architecture/blueprint" 4/5, "state" 3/5

### testing (0.99)
1. test behavior not implementation details
2. test behavior not implementation details
3. behavior over implementation details
4. behavior over implementation details
5. behavior over implementation details

**Convergence:** "behavior" 5/5, "implementation details" 5/5 — near-perfect fixed point
**Note:** Highest confidence in entire dataset. This phrase is effectively a lookup key already encoded in the model.

### typescript-patterns (0.95)
1. typescript patterns enforced with type safety
2. typescript safety by constraint
3. typescript type safety patterns
4. typescript safety patterns enforced
5. typescript type safety rules

**Convergence:** "typescript" 5/5, "safety" 4/5, "patterns" 3/5

### zod-schemas (0.95)
1. zod validation as single source of truth
2. schema first development discipline
3. validate data with zod schemas
4. zod schemas as single source of truth
5. zod schemas as source of truth

**Convergence:** "zod" 4/5, "schemas" 3/5, "source of truth" 3/5

### CLAUDE.md (0.95)
1. ai work orchestration for code
2. ai agent issue orchestration system
3. claude orchestrates agent work
4. ai orchestrator for development work
5. ai agent orchestration platform

**Convergence:** "ai" 5/5, "orchestration" 4/5, "agent" 3/5

### README.md (0.98)
1. autonomous issue-driven development framework
2. autonomous ai-driven issue development
3. autonomous development through claude
4. autonomous ai issue driven development
5. autonomous issue driven development

**Convergence:** "autonomous" 5/5, "issue driven" 4/5, "development" 5/5

### ARCHITECTURE.md (0.90)
1. agents orchestrating software through state machines
2. autonomous issue driven development orchestrator
3. claude orchestrates autonomous code development
4. claude orchestrates issue driven development
5. autonomous issue orchestration engine

**Convergence:** "autonomous" 3/5, "orchestrat-" 4/5, "issue" 3/5

### 01-issue-lifecycle (0.95)
1. bugs journey from creation to completion
2. issues track state through structured workflows
3. issues through state machine transitions
4. issues move through states
5. issues flow through states from creation to completion

**Convergence:** "issues" 4/5, "states" 4/5, "through" 4/5

### 02-cli-commands (0.85)
1. command orchestra sheet music
2. autonomous issue orchestration commands
3. orchestrating the autonomous issue engine
4. orchestrating autonomous issue resolution loops
5. orchestrating issue workflows through commands

**Convergence:** "orchestrat-" 4/5, "issue" 3/5, "commands" 2/5

### 03-orchestration-engine (0.90)
1. claude's decision making loop
2. autonomous task orchestration loop
3. beating heart of ai orchestration
4. loop that drives claude's iterative work
5. claude iteration orchestration loop

**Convergence:** "loop" 4/5, "orchestration" 3/5, "claude" 3/5

### 04-claude-integration (0.80)
1. bidirectional ai integration with overflow
2. talking to claude two ways
3. dual path into claude
4. claude integration two modes streaming
5. streaming tokens over context cliffs

**Convergence:** "claude" 3/5, "two/dual" 3/5, "streaming" 2/5
**Note:** Lowest confidence — file covers SDK mode AND CLI subprocess mode. Two distinct topics weakened convergence. Resonance linting in action.

### 05-triage-and-interview (0.90)
1. incomplete issues need clarifying answers
2. intake interview for unfinished requests
3. finding signal in incomplete issues
4. vetting incomplete issues before work
5. answering questions to clarify issues

**Convergence:** "incomplete/unfinished" 3/5, "issues" 4/5, "clarify/questions" 3/5

### 06-verification-and-audit (0.90)
1. automated safety gates after building
2. verify then audit quality gates
3. gates and guardrails for code
4. three gates catch build failures
5. quality assurance paired with peer review

**Convergence:** "gates" 3/5, "quality/verify/audit" 5/5

### PRD.md (0.95)
1. orchestrating ai agents from issue to verified code
2. orchestrating autonomous agents through development lifecycle
3. autonomous development orchestration with verification
4. autonomous ai orchestrates software development
5. autonomous ai development orchestrator

**Convergence:** "autonomous" 4/5, "orchestrat-" 4/5, "development" 4/5

### agent-roles (0.90)
1. specialized agents in a quality pipeline
2. assembly line for ai agents
3. assembly line of specialized agents
4. separation of concerns in agent design
5. single-responsibility agent assembly line

**Convergence:** "assembly line" 3/5, "agents" 4/5, "specialized/single-responsibility" 3/5
**Note:** "assembly line" metaphor doesn't appear in the source file — 3/5 agents independently reached for the same industrial metaphor.

### batch-loop (0.95)
1. automated work orchestration state machine
2. state machine drives automated issue resolution
3. state machine orchestrates automated issue work
4. state machine orchestrates automated work
5. orchestration loop drives automated issue work

**Convergence:** "state machine" 4/5, "orchestrat-" 4/5, "automated" 4/5

---

## Key Observations

1. **100% Phase 1 convergence** — zero files needed a second sample
2. **Semantic salience, not statistical** — "ratchet" (hapax), "globals" (contrast encoding), "assembly line" (absent metaphor) all demonstrate extraction of conceptual handles that TF-IDF cannot produce
3. **Fixed points exist** — testing.md at 0.99 shows the model has stable lookup keys for well-known concepts
4. **Lowest confidence = diagnostic** — 04-claude-integration (0.80) covers two distinct topics, correctly flagged by weak convergence
5. **Triggers compose naturally** — "throw typed errors at boundaries, test behavior not implementation, quality ratchet broken windows" reads as natural language, not metadata
