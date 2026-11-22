---
name: generate-tasks
description: Generate the task files in docs/tasks from the project docs, after the Understand step and the learner's answers. Use only when the learner asks to generate or regenerate tasks.
disable-model-invocation: true
---

# /generate-tasks

Write the task files in `docs/tasks/`. Tasks are derived from `docs/source/internship-brief.md`, **filtered through** `docs/01-scope.md` and `docs/02-decisions.md`, and updated with the answers the learner gave in the Understand step.

## Steps
1. Read `docs/00-project-brief.md`, `docs/01-scope.md`, `docs/02-decisions.md`, `docs/source/internship-brief.md`, and the learner's answers earlier in this conversation. If an answer is missing, ask before writing.
2. Create `docs/tasks/00-index.md` and one file per phase (`phase-1-foundation.md`, `phase-2-auth-and-users.md`, and so on).
3. Follow the rules and the template below.
4. Write **no application code**.
5. When you finish, list every assumption you made so the learner can confirm or correct it.

## What a task is
- A task says **what** to build and **how to know it is done**. It does **not** say how to implement it.
- **No code, no copy-paste snippets, no step-by-step implementation.** The learner designs the solution.
- Allowed in a task: endpoint contracts (method, path, auth), field lists and constraints, business rules, validation rules, expected responses, and "concepts to review".
- Small enough to finish and review in one focused session. Split anything bigger.
- Do not create tasks for anything deferred or out of scope. List those under "Deferred (post-MVP)" in the index instead.

## Files and naming
- `docs/tasks/00-index.md`: all tasks in order, with phase, dependencies, and a status checkbox. Plus a "Deferred (post-MVP)" section.
- Task IDs: `P<phase>-T<number>` (for example `P1-T01`). The first task is the folder structure and project setup (see `.claude/rules/folder-structure.md`).

## Task template
```
### P#-T## Title

**Goal:** one or two sentences.
**Source:** brief IDs (for example EC-07, section 06 invariants) or "Repo extra: <topic>".
**Depends on:** task IDs, or none.

**Scope**
- Endpoints: method, path, who may call it.
- Data: fields, types, constraints, indexes, relationships.
- Business rules: including the brief's invariants that apply here.
- Validation: what must be rejected and with which kind of error.
- Authorization: roles and ownership rules.

**Not in this task:** what is deliberately left for other tasks.

**Acceptance criteria (verify in Postman)**
- Request -> expected status, response shape, and database state.
- Include the failure cases: unauthenticated, wrong role, someone else's resource, invalid input, not found.

**Concepts to review:** topics the learner should read or understand first.

**Definition of done:** all acceptance criteria pass in Postman, unauthorized access is rejected, invalid input is rejected, database state is correct, and `/review-task` has returned "Ready".
```

## Rules
- Every task names the brief IDs it implements, or says it is a repo extra.
- Tasks that touch orders, stock, coupons, or pricing must state which business invariants (brief section 06) apply.
- State dependencies explicitly. A task must not require something a later task builds.
- Acceptance criteria must be checkable by hand in Postman, because automated tests are deferred.
- Verify any library or framework claim against the latest official docs (Context7 first), as required in `CLAUDE.md`.
- Reply to the learner in Egyptian Arabic. Write the task files in English.
