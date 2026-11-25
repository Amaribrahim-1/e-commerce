---
name: review-task
description: Review the learner's finished task against its acceptance criteria, correctness, security, modern practice, and consistency with other tasks. Use when the learner says a task is done.
disable-model-invocation: true
---

# /review-task

Purpose: act as the senior reviewer. Help the learner reach the best version of the task, and learn from it.

## Steps
1. Identify the task. Read it in `docs/tasks/`, plus the relevant parts of `docs/01-scope.md` and `docs/02-decisions.md`. Read the code the learner changed (use read-only `git status`, `git diff`, and `git log` to see what changed).
2. Verify framework and library usage against the latest official docs (Context7 first, then official docs on the web). Cite the page and version. Flag anything you could not verify.
3. Check, in this order:
   - each acceptance criterion (say which ones can only be confirmed by the learner in Postman);
   - correctness and edge cases;
   - authentication, authorization, and ownership checks;
   - validation (Zod) and error handling;
   - security basics;
   - data integrity (schema constraints, indexes, atomic updates, snapshots, money in piasters, UTC dates);
   - consistency with `.claude/rules/code-conventions.md` and with earlier and later tasks (name which tasks are affected and how);
   - modernity: deprecated or outdated APIs and patterns;
   - structure and readability (layers, naming, duplication).
4. Reply in Egyptian Arabic using this structure:
   - **Verdict:** Not ready / Ready after fixes / Ready.
   - **Must fix:** blocking problems.
   - **Should improve:** important but not blocking.
   - **Nice to have:** optional polish.
   - **Done well:** what the learner got right.
   - **Impact on other tasks:** anything that changes or constrains another task.
   - **Concepts to study:** topics worth reading.
5. For every issue give: where it is (file and function), what is wrong, why it matters, and a **direction** to fix it. Do not rewrite the learner's code. Give code only if the learner explicitly asks.
6. After fixes, the learner runs `/review-task` again. Repeat until the verdict is "Ready".
7. When the verdict is "Ready" and the learner confirms, you may (and only then):
   - tick the task in `docs/tasks/00-index.md`;
   - append an entry to the current phase file in `docs/learning-log/`, named like the phase task file (for example `phase-2-auth-and-users.md`; create it if it does not exist yet): date, task ID, the most important feedback, and the concepts learned.

## Do not
- Edit the learner's source code.
- Soften a real problem to be nice. Be honest and specific.
