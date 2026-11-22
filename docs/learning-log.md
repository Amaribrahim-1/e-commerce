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

## 2026-11-23 - P1-T02 Linting and formatting

**Most important feedback**
- Formatting rules belong to Prettier and correctness rules to ESLint; `eslint-config-prettier` goes last in the flat config so it can switch off conflicting rules.
- Scope Prettier with `.prettierignore` before the first `format` run, otherwise it rewrites docs and tooling files too.
- The unused `next` argument in the health handler was flagged by `no-unused-vars` and removed; Express 5 does not need it there.
- Verified acceptance criteria: lint passes, an unused variable is reported, a mis-formatted file is fixed by `format`.

**Concepts learned**
- ESLint flat config (`eslint.config.js`), `globals.node`, `sourceType: "module"`, Prettier config and ignore files, format-on-save and ESLint fix-on-save in VS Code, `endOfLine: "auto"` on Windows.
