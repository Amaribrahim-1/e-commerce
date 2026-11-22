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

## 2026-11-23 - P1-T03 Configuration module

**Most important feedback**
- Env loading uses Node's built-in `--env-file-if-exists=.env` in the `start` and `dev` scripts instead of `dotenv`: no extra dependency, stable since Node 24.10, real environment variables win over the file, and a missing file does not crash production where the platform injects variables. Trade-off: any script run outside the npm scripts (for example a seed script) must pass the same flag.
- `src/config/index.js` is the only file that touches `process.env`. It validates with Zod (`z.coerce.number()` for `PORT`, `z.enum` with a default for `NODE_ENV`, `z.url` restricted to `mongodb` / `mongodb+srv` for `MONGODB_URI`), prints only the key and the reason (never the received value, since a URI holds a password), and exits with code 1.
- `PORT` has no default on purpose: the acceptance criterion says a missing `PORT` must stop the app. Defaults are for keys with a safe fallback (`NODE_ENV`).
- The exported config is frozen and uses clean names (`config.port`, `config.db.uri`), so raw env names do not spread through the code.
- `nodemon` does not watch `.env` by default; the dev script adds `--watch src --watch .env`.
- Verified: invalid or missing `PORT` and a bad URI stop the app with a clear message; a valid setup starts and `/health` returns 200; `process.env` appears only in the config module.

**Concepts learned**
- Fail-fast configuration, 12-factor config, Zod `safeParse` / `issues` / `coerce` / `default`, `--env-file` vs `--env-file-if-exists` vs `dotenv`, why secrets must never be echoed in error messages.

## 2026-11-23 - P1-T04 Database connection (Atlas)

**Most important feedback**
- Connect first, then listen. The first version created the HTTP server inside `.then()` and exported the promise as `server`; nothing could close the server later. Keep the `http.Server` returned by `app.listen()` in a variable so shutdown can call `close()`.
- `z.url()` rejects the multi-host "legacy" Atlas string (`mongodb://host1,host2,host3/...`) because it uses the WHATWG URL parser. The scheme is now checked with `z.string().regex()`; the driver validates the rest.
- Never log the whole connection error object: it can contain the URI and the password. Log only `name` and `message`. Verified with a wrong password: one readable line, exit code 1.
- Graceful shutdown on `SIGINT`/`SIGTERM`: `server.close()` (stop accepting, finish in-flight), `mongoose.disconnect()`, exit. Guard against running twice and add a forced-exit timeout. Bug found while testing: `close()` throws "Server is not running" if the server never started listening, so check `httpServer.listening` first or the DB is never closed.
- `unhandledRejection` and `uncaughtException`: log, shut down gracefully, exit 1, because the state is unknown after an uncaught error.
- Handle the HTTP server `error` event (for example `EADDRINUSE`); otherwise it is an uncaught exception.
- `serverSelectionTimeoutMS` defaults to 30 s and applies to the initial connect too; the docs advise against lowering it on a replica set.

**Concepts learned**
- Mongoose connection events (`connected`, `disconnected`, `reconnected`, `error`), `mongoose.disconnect()`, server selection timeout, process signals, exit codes, why Atlas is a replica set and transactions need one, WHATWG URL vs MongoDB connection strings.
