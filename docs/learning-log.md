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

## 2026-11-23 - P1-T05 Error handling and response shape

**Most important feedback**
- Express recognises an error handler by its **4 parameters** `(err, req, res, next)`. With 3 it is treated as a normal middleware and never receives errors. The earlier `no-unused-vars` fix removed `next` for the health handler, which is right there but wrong for an error handler: keep `next` (here it is used for the `res.headersSent` case, so no lint disable is needed).
- `express.json()` must be registered before the routes, otherwise a broken JSON body can never be reported. Its errors come from body-parser, not from your code: they carry `status`, `type` (`entity.parse.failed`) and no `isOperational`, so they must be translated or they become a generic 500.
- Translation of library errors (Mongoose cast/validation, duplicate key `11000` -> `409`, body-parser) belongs in every environment. The environment only decides how much detail is sent (`stack` in development, never in production).
- Do not hard-code a field name when reading `err.keyValue` (it was `name`); read the key from the object, and guard in case it is missing.
- Do not mutate the incoming error, and do not assume a thrown value is an `Error` (`throw "x"` would crash the handler). Normalise first, then translate.
- Keep out-of-scope code out of a task (JWT handlers belong to Phase 2). Name files after what they contain (`AppError.js`, not `handleOperationalError.js`).
- The response shape is a contract: it is recorded in `docs/02-decisions.md` with room reserved for `details` (P1-T06) and `meta` (P2-T05).

**Concepts learned**
- Operational vs programmer errors, error-handling middleware arity, `res.headersSent`, body-parser error `type`/`status`/`expose`, Mongoose `CastError` / `ValidationError` / duplicate key `11000`, HTTP 400 vs 409, JSend-style `fail` vs `error`, middleware order.

## 2026-11-24 - P1-T06 Request validation with Zod

**Most important feedback**
- The idea was right from the start: a middleware that runs `safeParse` and stores the result on a new property. What was missing was how the pieces connect. A middleware only receives `(req, res, next)`, so it cannot know which schema to use. The fix is a **factory**: `validation(schemas)` is called when the route is defined, remembers the schemas in a closure, and returns the real middleware that Express calls per request.
- `safeParse` must be called on the schema with the **data** (`schema.safeParse(req.body)`). The first version passed only the schema, so nothing was ever checked. The schema is the rule; the request part is the thing being checked.
- One middleware validates `body`, `params` and `query` separately. Issues of all parts are collected before failing, so the client sees every problem in one response instead of fixing them one by one.
- Express 5 detail: `req.query` is a read-only getter, so parsed values go to `req.validated.body|params|query` and handlers read from there. `req.body` is `undefined` when nothing was parsed (body-parser 2), so it is treated as `{}` and the client gets "field is required" instead of a confusing type error.
- The error shape is a contract: `details` is an array of `{ location, path, message }`. `path` is the Zod issue path joined with `.`, falling back to the part name when the issue is on the whole part. `AppError` takes an optional third argument and `sendError` writes it only when present, so no other error changes.
- Unknown keys are **stripped** (Zod's default for `z.object`); a schema that must reject them uses `z.strictObject` or `.strict()`.
- ObjectId check uses a 24-hex regex, not Mongoose `isValidObjectId`, which also accepts any 12-character string. A bad `:id` is a `400` from validation, never a `CastError` `500`.
- Review fix: `validation()` now throws when the route is defined if it gets no schemas or a wrong key (`{ bdy: ... }`). Without this, a typo silently skips validation and unchecked input reaches the handler. Same fail-fast idea as the config module.
- To remember for later tasks: `z.coerce.number()` turns `""` and `null` into `0`, so `?minPrice=` passes as `0`. Use `.positive()` / `.min()` where zero is not valid, and be careful with optional numeric query params (P3-T06, P2-T05). Zod's default messages (for example "Invalid input: expected string, received undefined") are readable but not form-friendly; custom messages can be added per schema or globally when the frontend needs them.
- Business rules (for example "email already registered") stay in services, not in schemas. Schemas check shape only.

**Concepts learned**
- Higher-order function / factory middleware and closures, Zod `safeParse`, `error.issues` and `path`, `z.coerce`, `.default()`, strip vs strict, Express 5 `req.query` getter and `req.body` undefined, fail-fast at startup, validation at the edge vs business rules in services.

## 2026-11-24 - P1-T07 Security and logging middleware

**How this task was done:** security was new to the learner, so the code was written by the mentor in three steps (helmet; CORS and body limit; morgan and trust proxy) and each step was explained and tried in Postman before the next one. The learner still has to be able to explain every part below; re-read it before Phase 2.

**Most important feedback**
- **Helmet** sets response headers that tell the browser to be careful: `X-Content-Type-Options: nosniff` (no guessing of file types), `X-Frame-Options` (no framing, so no clickjacking), `Strict-Transport-Security` (HTTPS only, ignored over plain HTTP), `Content-Security-Policy`, `Referrer-Policy`, and it removes `X-Powered-By` so the server does not advertise itself. It must come before the routes so errors and 404s get the headers too.
- **CORS** is a browser rule, not a server defence. The browser blocks a page from another origin from reading our responses unless the server lists that origin in `Access-Control-Allow-Origin`. Postman, curl and scripts ignore it completely, so it never replaces authentication. A request with a header like `Authorization` or the method `PUT`/`DELETE` triggers a **preflight** (`OPTIONS`) first; the `cors` package answers it with `204`. An origin not in the list gets no header and the server still answers `200`: the browser, not the server, blocks it. `credentials` stays off until the token transport (header or cookie) is chosen, and `*` cannot be combined with credentials.
- **Body limit**: `express.json()` buffers the whole body in memory, so without `limit` one huge request can exhaust memory (a cheap denial of service). Over the limit, body-parser raises `entity.too.large` with status 413. That error has no `isOperational`, so without a translation in `globalErrorHandler` it would become a generic `500` and be logged as a bug. The same pattern as `entity.parse.failed` in P1-T05.
- **morgan** logs one line per request (method, URL, status, time). It is first in the chain so it also sees requests rejected later. It runs only in development; in production a structured logger will replace it together with `console.error`.
- **trust proxy**: behind a reverse proxy every request arrives from the proxy's IP, so `req.ip` would be the same for everybody and the rate limiter (P2-T08) would treat all users as one. Express can read the real IP from `X-Forwarded-For`, but only for as many hops as we trust. `true` (trust everything) is dangerous because any client can send a fake `X-Forwarded-For`. It is a config number (`TRUST_PROXY_HOPS`, default 0), so deploying needs no code change.
- **Bug found in review:** the config accepted `CORS_ORIGINS=*` in development, but the `cors` package treats `"*"` inside an array as a normal string, so nothing was allowed and nothing warned. Lesson: an option the config accepts must be proven to do something; test the behaviour, not only that the app starts.
- Config validated at startup (fail fast): a trailing slash in an origin (`http://x.com/`) is the classic mistake because a browser's `Origin` never has a trailing slash, so the list would silently never match. `*` in production and a non-numeric `TRUST_PROXY_HOPS` also stop the app with a clear message.
- Middleware order is part of the design: `morgan` -> `helmet` -> `cors` -> `express.json` -> routes -> `notFoundHandler` -> `globalErrorHandler`. Recorded in `docs/02-decisions.md`.
- `npm audit` shows 2 moderate issues in `nodemon` -> `minimatch` (dev tool only). `npm audit fix --force` would downgrade nodemon, so it was not applied. Recorded as known and accepted.

**Concepts learned**
- Same-Origin Policy, CORS and preflight, what CORS does not protect, HTTP security headers (nosniff, clickjacking, HSTS, CSP), request body limits and 413, request logging formats, reverse proxies and `X-Forwarded-For`, `trust proxy` and why `true` is unsafe, `npm audit` and dev vs production dependencies.
- To study before P2-T08 (rate limiting) and the auth tasks: how `req.ip` is computed, and how cookies and CORS credentials interact if the token is sent in a cookie.

## 2026-11-24 - P1-T08 Data design: ERD

**How this task was done:** data modeling was new to the learner, so the model was built with the mentor entity by entity, and the review added the missing pieces. Result: `docs/design/erd.md` (Mermaid diagram) and `docs/design/data-model.md` (fields, indexes, snapshots, invariants). Every later model task (P2-T01, P3-T02, P4, P5-T01) starts from these two files, so re-read them before each one.

**Most important feedback**
- **Embed or reference: ask questions, not taste.** Embed when the child is bounded, always read with the parent, must change atomically with it, or is a snapshot (addresses, cart items, order items, statusHistory). Reference when it is unbounded, queried alone, or needs its own uniqueness (variants, orders, audit log). Every relationship in the ERD was decided with these questions.
- **Why variants are their own collection:** a unique index on an array field only blocks duplicates **between documents**, not inside one document. Embedded variants could not guarantee "unique SKU" or "unique size+color per product" in the database. As separate documents, both are unique indexes, and buying one SKU is one atomic conditional update on one document (`stock >= n`). That is brief scenario 01: the other variant's document is never touched. The cost: the product list needs an aggregation for price range and stock (P3-T06), and creating a product with variants writes two collections.
- **Snapshots vs references on the Order.** An order must explain itself years later, so price, title, SKU, address, shipping fee and coupon values are **copied** (snapshots, `immutable`). Only three things stay references on purpose: `userId` (owner), `variantId` (restock on cancel), `couponId` (release usage on cancel). The cart is the opposite: it stores no price because it is an intention, not a sale.
- **Where an invariant lives.** The database guards what an index or schema can express (unique email/SKU/code/orderNumber, one cart per user, enums, `min: 0`). Rules across documents or depending on state live in services as **conditional atomic updates** (`stock >= n`, `usedCount < usageLimit`, `status: 'pending'`) or transactions. Mongoose update validators are off by default, so `min: 0` does not protect a `$inc`; the filter does.
- **Gaps found in review and fixed:**
  - No home for stock history. Decision: the audit log is the stock ledger (reason enum + before/after + `meta.orderId`), no separate collection.
  - "Purchasable" was not defined. A variant can be active while its product or category is not. Rule: check all three, never copy the flag down.
  - `discount <= subtotal` was missing, so a fixed coupon larger than the subtotal could make `total` negative. Variant price is now `> 0`.
  - A sparse index still indexes `null`; clear optional indexed fields with `$unset`.
  - The diagram had no line for ShippingZone and none for staff references on the Order. Now dashed lines show links that have no stored foreign key (governorate match, polymorphic `entityType` + `entityId`).
- **Things left to test when their task comes** (written in decisions): unique multikey + partial index for shipping zones (P4-T01), duplicate `orderNumber` inside a transaction (P5-T01), the `initialStockSet` flag (P3-T05), the reset-token hash (P2-T07).

**Concepts learned**
- Embedded vs referenced documents, bounded vs unbounded arrays, unique indexes on arrays (multikey), compound unique indexes and `null`, sparse vs partial indexes, denormalization and snapshots, polymorphic references, single source of truth, schema-level vs service-level invariants, conditional atomic updates, `immutable` paths, Mermaid `erDiagram` (identifying vs non-identifying lines).
