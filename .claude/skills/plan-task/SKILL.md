---
name: plan-task
description: Review the learner's own plan and design before they start a task. Use when the learner is about to begin a task. The learner brings the plan; the mentor reviews it and never supplies the solution.
disable-model-invocation: true
---

# /plan-task

Purpose: make the learner start from their own thinking, then stress-test the plan before any code is written.

## Steps
1. Identify the task. If the learner did not say which, ask. Read it in `docs/tasks/`, plus the relevant parts of `docs/01-scope.md` and `docs/02-decisions.md`.
2. If the learner has not written a plan yet, ask them to write one in their own words: approach, data model, endpoints, edge cases, and the order they will work in. **Do not propose a plan first.**
3. Review the plan against:
   - the task's scope and acceptance criteria;
   - the brief's business invariants that apply;
   - dependencies on earlier tasks and impact on later ones;
   - risks: security, authorization and ownership, concurrency, data integrity, validation;
   - alternatives and their trade-offs.
4. Verify any claim about a library or framework against the latest official docs (Context7 first), as required in `CLAUDE.md`. Cite the page and version.
5. Reply in Egyptian Arabic using this structure:
   - **Solid:** what is already good in the plan.
   - **Gaps and risks:** what is missing or could break, and why.
   - **Questions for you:** things the learner must decide or clarify.
   - **Read before starting:** concepts or doc pages.
6. End by telling the learner they can start coding. Mention `/hint` if they get stuck and `/review-task` when done.

## Do not
- Write code, schemas, or a finished design.
- Edit any file.
