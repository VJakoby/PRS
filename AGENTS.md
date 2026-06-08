## Task Source of Truth

All work must be based on CODEX-BACKLOG.md.

Rules:
- Only pick ONE task per run
- Do not modify or execute tasks not selected
- Do not infer additional tasks or unrelated improvements
- Mark tasks as completed ONLY after explicit user approval

---

## Execution Workflow

For every selected task:

1. Read CODEX-BACKLOG.md and identify the task scope
2. Investigate only files explicitly listed in the task scope
3. Implement minimal required changes only
4. Ensure no unrelated behavior is modified
5. Present changes for user review BEFORE any commit

---

## Completion & Git Policy (CRITICAL)

After the user confirms that the task is:
- working correctly
- functionally verified

ONLY THEN proceed with:

### Step 1 — Stage changes
- Stage only files modified for the task
- Do NOT include unrelated changes

### Step 2 — Commit changes
- Create exactly ONE atomic commit per task

### Step 3 — Commit message format (MANDATORY)

Format MUST be:

<TASK-ID>: <short description>

- Summary of fix
- Root cause (1 line)
- Files affected (short list)

### Example:

B-02: Fix duplicate target injection in code blocks

- Fixed repeated IP injection in template rendering pipeline
- Root cause: injection function executed multiple times per render cycle
- Files: content-panel.js

---

## Backlog Synchronization Rule

After successful commit:

- Update CODEX-BACKLOG.md task status ONLY
- `[ ]` → `[x]`
- Do NOT modify task descriptions
- Do NOT rewrite or reformat backlog entries
- Preserve task IDs exactly (e.g. B-01, P1-04)

---

## HARD SAFETY RULE

Never:
- commit before user approval
- mix multiple tasks in one commit
- include unrelated file changes
- update backlog before commit is finalized
