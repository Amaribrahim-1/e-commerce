# Learning log

One entry per task that reached "Ready" in `/review-task`: date, task ID, the most important feedback, concepts learned.

<!-- entries are appended below -->

## 2026-11-22 - P1-T01 Project setup and folder structure

**Most important feedback**
- Folders must be organized by business module (`src/modules/*`) plus a shared `src/common`, not by type (top-level `controllers/`, `routes/`).
- Routes belong to app setup (`app.js`); `server.js` only starts listening, otherwise the app/server split has no value.
- `.gitignore` pattern `*.env` does not cover `.env.local`; the correct pattern is `.env*` with `!.env.example`. Verify with `git check-ignore`.
- Scripts must match real file paths (`src/server.js`), and `engines` / `start` were required by the task.
- Empty folders are not tracked by git; use `.gitkeep`.
- nodemon only watches some extensions by default and ignores nothing extra without config; revisit the nodemon vs `node --watch` choice later (deferred).

**Concepts learned**
- ESM (`"type": "module"`), modular monolith vs layered-by-type, app/server split, gitignore pattern matching, `engines`, nodemon `ext` / `ignore`.
