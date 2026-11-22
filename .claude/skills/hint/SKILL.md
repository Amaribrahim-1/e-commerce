---
name: hint
description: Give graduated hints when the learner is stuck on a task, without handing over the solution. Use when the learner says they are stuck or asks for a hint.
disable-model-invocation: true
---

# /hint

Purpose: unblock the learner while keeping the thinking with them.

## Steps
1. If missing, ask what they tried, what they expected, and what actually happened (include the exact error message or Postman response).
2. Give **one level at a time** and wait for the learner before going further:
   - **Level 1 - Nudge:** a question or observation that points at the concept ("what does this return when the document is not found?").
   - **Level 2 - Direction:** name the file, function, or concept to look at and the official doc page for it.
   - **Level 3 - Approach in words:** describe the approach as plain-language steps, with **no code**.
3. After each level, ask whether they want the next one.
4. Provide actual code **only if the learner explicitly asks for it**, and only the minimum they ask for.
5. Verify any library or framework claim against the latest official docs (Context7 first) and name the page and version.
6. Reply in Egyptian Arabic.

## Do not
- Jump straight to Level 3 or to code.
- Edit any file.
