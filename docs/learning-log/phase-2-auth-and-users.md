# Learning log: Phase 2 (Auth and users)

One entry per task that reached "Ready" in `/review-task`: date, task ID, the most important feedback, concepts learned. Phase 1 is in `phase-1-foundation.md`.

<!-- entries are appended below -->

## 2026-11-25 - P2-T01 User model

**Most important feedback**
- **Hash in the service, not in a pre-save hook.** Save hooks do not run on `findOneAndUpdate` / `updateOne`, and the password will be changed by later tasks (P2-T06, P2-T08), so a hook could silently store a plain password. One module (`password.service.js`) is the only place that imports `bcrypt`; the field is named `passwordHash` so a plain value looks wrong in review.
- **`select: false` is not enough.** It only affects queries; the document returned by `create()` / `save()` still holds the hash. A `toJSON` transform removes `passwordHash` and `__v` from responses. `.lean()` skips `toJSON`, but lean results come from queries, where `select: false` applies.
- **Uniqueness belongs to an index, not a validator.** `unique` plus `lowercase` makes `A@x.com` and `a@x.com` collide, and the duplicate key (code `11000`) becomes `409` in the central error handler. The index only exists once it is built, and it cannot be built while duplicates exist.
- **bcrypt reads only 72 bytes.** Longer passwords are silently truncated, so Zod must reject them (bytes, not characters: an Arabic letter is 2 bytes). Cost factor lives in config (`BCRYPT_SALT_ROUNDS`, min 10, max 14); each +1 doubles the time.
- **One source of truth for shared constants:** `ROLES` and `EGYPT_PHONE_REGEX` are defined once and used by the schema, Zod and later the authorization middleware. The regex was fixed to accept only the local form `01[0125]` + 8 digits (no optional leading 0, no `+20`).
- **Fields come with the task that uses them (YAGNI):** reset-token fields in P2-T07, `addresses` in P2-T09. `__v` is kept in the database (protects array updates through `save()`).
- **Throwaway code must be removed:** the temporary test routes and the study file were deleted before the commit; the temporary route only proved the criteria in Postman (hash stored, hash hidden, `409` on duplicate email in another case, `400` on bad phone or role).
- **Still open for the learner:** delete the test users from Atlas.

**Concepts learned**
- bcrypt, salt and cost factor, the 72-byte limit, async hashing off the main thread, Mongoose `select: false`, `toJSON` transform, `.lean()`, `versionKey` (`__v`), schema `unique` vs validators, `lowercase` / `trim` setters, `autoIndex`, YAGNI, mass-assignment groundwork (role never comes from the client, enforced in P2-T02).

**Impact on other tasks**
- P2-T02: reuse `EGYPT_PHONE_REGEX` and `ROLES` in Zod; max 72 bytes password rule; role is never taken from the body.
- P2-T03: login asks for `+passwordHash`; compare with `verifyPassword`; token `iat` vs `passwordChangedAt` (seconds vs milliseconds).
- P2-T07 / P2-T09: add reset-token fields (also removed in `toJSON`) and `addresses`.
- Before deployment: turn `autoIndex` off and build indexes separately.
- The agreed folder structure (see `docs/02-decisions.md`) is applied in its own `refactor:` commit, next.

## 2026-11-26 - P2-T02 Register

The learner did not know how to start this task, so most of the code was written by the mentor at the learner's request. This entry therefore explains the whole flow, not only the feedback, so it can be studied and redone alone.

**The request, step by step (`POST /api/v1/auth/register`)**
1. `app.js`: `express.json()` parses the body (bad JSON -> `400`, too large -> `413`), then `/api/v1` goes to `routes.js`, which mounts `authRouter` at `/auth`. `routes.js` only decides prefixes; the module owns its paths.
2. `auth.routes.js`: `validation({ body: registerSchema })` runs first. If Zod fails, the request never reaches the controller: it becomes `AppError(400)` with `details` (one entry per field: `location`, `path`, `message`). The parsed, cleaned body is put on `req.validated.body`.
3. `auth.controller.js`: HTTP only. Reads `req.validated.body`, calls the service, sends `201` with `{ user, token }`. No rules here, no `try/catch` (Express 5 forwards a rejected promise to the error handler).
4. `auth.service.js` `register()`: hashes the password (`users/password.service.js`), creates the user with `role: ROLES.CUSTOMER` written explicitly, signs a token, returns both. No `req`/`res`, so a script could call it too.
5. Errors from any step land in `globalErrorHandler`: Mongo `11000` (duplicate email) -> `409`, Mongoose `ValidationError` -> `400`, anything unknown -> generic `500`.

**Most important points**
- **Mass assignment, defended twice.** The client sends `"role": "admin"`; `z.object` strips unknown keys, so it never reaches the service; and the service sets the role itself instead of relying on the schema default. The service also destructures only the fields it needs (an allow-list). Never pass `req.body` straight to `Model.create()`.
- **Do not check "does the email exist?" before creating.** Two requests at the same moment can both pass the check (a race, "check-then-act"). The unique index is the only real guard; its error is translated to `409` in one place. Cost accepted: register reveals that an email is registered (user enumeration), limited later by rate limiting (P2-T08).
- **Validation order inside the schema:** normalize first (`trim`, `toLowerCase`), then check (`.pipe(z.email())`), so `"  A@X.com "` is accepted and stored as `a@x.com`. Passwords are **not** trimmed (a space is a valid character, and trimming would break login).
- **Password policy:** 8 to 64 characters, no composition rules (NIST/OWASP), and at most 72 **bytes** because bcrypt ignores the rest (`Buffer.byteLength`, an Arabic letter is 2 bytes). `passwordConfirmation` is checked by an object-level `.refine` with `path: ['passwordConfirmation']`, so the error names the field.
- **Zod v4 detail (docs, `when`):** an object-level `.refine` runs only when no *non-continuable* issue happened. A failed regex or min length is continuable, so "bad phone + mismatched passwords" shows both errors; but a **missing** field (`invalid_type`) hides the mismatch error until the next try. Acceptable; the `when` option exists if it ever matters.
- **JWT basics:** a token is `header.payload.signature` (base64url). It is **signed, not encrypted**: anyone can read the payload, so it holds only `sub` (user id) plus `iat` and `exp`. No role inside: it can change while the token is alive, and P2-T03 reads the current user from the database on every request anyway.
- **JWT config is validated at startup:** `JWT_SECRET` at least 32 characters (HS256 key of 256 bits), `JWT_EXPIRES_IN` must have a unit (`15m`, `1d`) because jsonwebtoken reads `"120"` as 120 **milliseconds**. The algorithm is fixed in code (`config.jwt.algorithm = 'HS256'`), and P2-T03 must pass `algorithms: [config.jwt.algorithm]` to `verify()`.
- **Token transport: `Authorization: Bearer` header,** token returned in the body. Header = no CSRF (the browser never sends it alone), CORS `credentials` stays off; cost = a browser client can read it, so XSS on the client could steal it. httpOnly cookie rejected for now (needs CSRF protection, `SameSite`, `Secure`, CORS credentials).
- **Constants shared by Zod and Mongoose** (`NAME_MIN/MAX` in `users/user.constants.js`, like `EGYPT_PHONE_REGEX`): Zod gives good messages at the edge; the schema is the last line of defence for writes that skip Zod (seeds, scripts). One source, so they cannot drift.

**Verification**
- Mentor smoke test in-process (database write stubbed, no real DB): valid body -> `201`, `role: customer` even with `"role": "admin"`, no `passwordHash`/`__v`, token payload `{ sub, iat, exp }` with `exp - iat = 1 day`; duplicate key -> `409 "A record with this email already exists."`; weak password, mismatched confirmation, bad phone, bad email -> `400` naming the field; bad JSON -> `400`. ESLint and Prettier clean.
- **Still for the learner in Postman** (against the real database): `201` and the stored document has `role: customer` and a bcrypt hash; the same email in another case -> `409`. Then delete the test users.

**Concepts learned**
- JWT structure (header, payload, signature), `sub`/`iat`/`exp` claims, HS256 and secret length, signed vs encrypted; Bearer header vs httpOnly cookie (XSS, CSRF); mass assignment and allow-lists; race conditions and check-then-act; unique index as the guard; Zod v4 `trim`/`toLowerCase`/`pipe`, `refine` with `path`, continuable vs non-continuable issues, custom `error` messages; config validation at startup; controller/service split.

**Impact on other tasks**
- P2-T03: login reuses `signAccessToken`; the auth middleware reads `Authorization: Bearer`, calls `jwt.verify` with `algorithms: [config.jwt.algorithm]`, loads the user by `sub`, checks `isActive` and `passwordChangedAt` vs `iat` (seconds vs milliseconds).
- P2-T06: the email/password field schemas move to `users/user.validation.js` (so `users` never imports from `auth`); decide where `signAccessToken` lives if a password change returns a new token.
- P2-T08: rate-limit `/auth/register` together with login and the reset routes.

## 2026-11-28 - P2-T03 Login and authentication middleware

The learner wrote the first version of login and of the middleware. After two review rounds, the mentor wrote the remaining fixes and all comments at the learner's request. The points below are what to be able to explain alone.

**The two requests**
- `POST /api/v1/auth/login`: Zod (`loginSchema`) -> `loginController` -> `login()` in `auth.service.js`: find by email with `+passwordHash`, compare with bcrypt, check `isActive`, sign a token, `200` with `{ user, token }`.
- `GET /api/v1/users/me`: `authenticate` (header -> `jwt.verify` -> `findById(sub)` -> active? -> token newer than the last password change?) puts the user on `req.currentUser`, then `getMe` returns `{ user }`. Every failure in the middleware is `401`, sent by the global error handler.

**Most important points**
- **User enumeration, by message and by time.** Unknown email and wrong password give the same `401` and the same message (one constant). The response time must match too: the unknown-email path still runs one bcrypt compare against a dummy hash. A hand-written hash had cost `10` while the config uses `12` (about 4x faster), so the leak stayed; the dummy hash is now made by `hashPassword`, once, on first use.
- **Promise memoization.** `getDummyHash` stores the promise right away (no `await` before storing), so two first requests share one hashing job. `??=` assigns only when the variable is empty. The `.catch` clears the cache and re-throws: a catch that does not re-throw turns a failure into a wrong value (`undefined`) that breaks later, far away.
- **Inactive account at login: `403`, checked after the password.** Only someone with the right password learns the account is disabled, so this message reveals nothing. In the middleware the same case is `401`: the token is no longer a valid session.
- **Validate the shape at login, not the policy.** Reusing the register `passwordSchema` would lock out users if the policy got stricter and would answer a wrong password with a `400` describing the policy.
- **`jwt.verify` throws, it never returns a falsy value.** An `if (!payload)` after it is dead code. Express 5 sends the rejected promise of an async middleware to the error handler, so no try/catch is needed.
- **`algorithms` allow-list** in `verify`: the token header says which algorithm to use, and the client writes the header. The same constant is used by `sign` and `verify`.
- **Error class hierarchy:** `TokenExpiredError` and `NotBeforeError` extend `JsonWebTokenError`. Check the specific one first, then one `instanceof` for the base class covers the rest (a check by exact `err.name` missed `NotBeforeError` and gave `500`).
- **Why `passwordChangedAt` matters:** a JWT cannot be revoked one by one; the server keeps no list. Changing the password is how a user signs out every device, so tokens issued before it are refused. Units: `iat` is whole seconds, `getTime()` is milliseconds; `Math.floor(ms / 1000)` and `<` (not `<=`) so a token from the same second as the change still works. `parseInt` is for parsing strings, not for rounding numbers.
- **`promisify`** (`node:util`) wraps a callback-style function `(err, result)` into one that returns a promise. Not needed for `jwt.verify`: without a callback it is synchronous, and HS256 is CPU-only work.
- **Layers are used when there is a job.** `/users/me` has no service because there is no rule left after the middleware. `password.service.js` lives in `users` because `users` will hash passwords too (P2-T05 staff, P2-T06 password change) and dependencies go one way (`auth` -> `users`).
- **Paths:** `routes.js` sets the module prefix (`/users`); the module router writes only the rest (`/me`). Writing `/users` in both gave `/api/v1/users/users` and a 404. REST paths are nouns (`/me`), not verbs (`/getMe`).

**Verification**
- Mentor smoke test in-process (User queries stubbed, no real DB), 22 checks passed: login `200` + token without hash; wrong password and unknown email same `401` body and close timing (217 ms vs 215 ms); empty password `400`; inactive login `403`; `/users/me` without header, with `Basic`, with `Bearer ` only, tampered, HS512-signed, expired, and `nbf` in the future -> `401` (expired has its own message); valid -> `200` without hash; inactive, deleted, and token older than `passwordChangedAt` -> `401`; token from the same second as the change -> `200`. ESLint and Prettier clean.
- The learner confirmed the login timing difference in Postman. **Still for the learner in Postman** (real database): save the token with a test script; `/users/me` with and without the token; set `isActive: false` and then `passwordChangedAt` (as a Date) in the database and check the old token gets `401`.

**Concepts learned**
- User enumeration (messages and timing), bcrypt cost factor, promise memoization, `??=`, re-throwing in `.catch`; 401 vs 403; JWT verification errors and their class hierarchy, `nbf`, algorithm allow-lists; stateless tokens and revocation through `passwordChangedAt`; seconds vs milliseconds; `promisify` and callback vs sync APIs; Express 5 async error forwarding; router prefixes.

**Impact on other tasks**
- P2-T04: `authorize` runs after `authenticate` and reads the role from `req.currentUser`; the first admin is created by a seed that uses `hashPassword`.
- P2-T06: the password change must set `passwordChangedAt` and return a new token (it passes thanks to `<`); create `user.service.js` then; move the email/password Zod schemas to `users/user.validation.js`.
- Every later protected route: the user id comes from `req.currentUser`, never from body, params, or query.

## 2026-11-28 - P2-T04 Role authorization and first-admin seed

The learner wrote two versions of `authorize`; the mentor wrote the final version and the whole seed at the learner's request, because the learner had no background in standalone scripts. This entry explains the full reasoning so the task can be redone alone. Decisions: `docs/02-decisions.md`, "Authorization and first-admin seed (P2-T04)".

**Authentication vs authorization**
- `authenticate` answers "who are you?" (token -> user -> `req.currentUser`, failures `401`). `authorize` answers "may you do this?" (role check, failure `403`). Always in that order on the route: `authenticate, authorize(ROLES.ADMIN), handler`. This is **middleware composition**: small middlewares, each with one job, chained per route.

**`authorize`, and what the two earlier versions got wrong**
- **Middleware factory (higher-order function).** `authorize(...roles)` is not the middleware; it **returns** the middleware `(req, res, next)`. The outer function runs once when the route is defined; the inner one runs on every request. Rest parameters (`...roles`) make the call read like `authorize(ROLES.ADMIN, ROLES.CATALOG_MANAGER)`.
- **`ROLES` is an object, not an array.** Version 2 called `ROLES.includes` (not a function -> every request `500`). Version 3 used `Object.keys(ROLES)`, which gives the keys (`'ADMIN'`), not the stored values (`'admin'`), so every valid role was rejected. The values are `Object.values(ROLES)`. Lesson: run the code once before sending it; both bugs show on the first request.
- **Fail fast: check at the right moment.** Checks that depend only on the arguments (empty list, unknown role) belong in the outer function, so a typo crashes the app at startup instead of silently refusing everyone on that route. Checks that depend on the request (is there a user, is the role allowed) belong in the inner function.
- **Operational error vs programmer error.** `AppError` is `isOperational`, so `sendError` sends its message to the client. "Forgot `authenticate`" or "unknown role" is a bug, not a client mistake: it must not be `400` (the client did nothing wrong) and must not leak its message. A plain `Error` is logged and answered with a generic `500`. Only the `403` is an `AppError`.

**The seed script, step by step (`npm run seed:admin`)**
1. Why a script at all: register always creates a customer, so no API can create the first admin. Inserting it by hand in Compass/mongosh skips Mongoose (no `enum`, no `lowercase`, no timestamps), needs a bcrypt hash made by hand, is not repeatable on a new database, and production usually has no direct database access.
2. The npm script loads `.env` with `--env-file-if-exists` like `start`, because the script does not go through `server.js`.
3. Read the values through `getSeedAdminConfig()` (config is still the only place that reads `process.env`). They are not in the main config schema: the server does not need the admin password, so it can be left out of the server's env (**least privilege**).
4. Validate them with the register field schemas (one set of rules, no drift), **before** connecting to the database (fail fast). Messages name the key (`SEED_ADMIN_PASSWORD: ...`), never the value.
5. Connect, then `await User.init()` so the unique email index exists before writing (Mongoose builds indexes in the background).
6. If **any** admin exists -> "Nothing to do", exit `0`. This is **idempotency**: running it twice gives the same state as running it once, so it is safe by hand or in a deploy step.
7. If the email belongs to an existing user -> fail. Never promote: that user owns the password.
8. Hash with `hashPassword` (same cost as every other hash), create with `role: ROLES.ADMIN` written explicitly.
9. A duplicate key at insert means another run won the race (**check-then-act**): the `exists` checks are for clear messages only; the unique index is the real guard (same lesson as P2-T02).
10. Exit code `0` for success or already there, `1` for any failure, so a script or CI step can tell. `process.exitCode` instead of `process.exit()` so `finally` still disconnects. `new Error(msg, { cause: err })` keeps the original error inside the new one (ESLint `preserve-caught-error`).

**Verification**
- ESLint and Prettier clean (mentor). The learner confirmed in the terminal and Postman: first seed run creates the admin, second run says it already exists with no duplicate; on a temporary admin-only route, no token -> `401`, customer token -> `403`, admin token -> `200`; the temporary route was removed.

**Concepts learned**
- Authentication vs authorization; middleware composition and middleware factories (closures, rest parameters); fail fast; operational vs programmer errors; `Object.keys` vs `Object.values`; least privilege for secrets; idempotent scripts and exit codes; check-then-act races and the unique index as the guard; `Model.init()` and background index builds; `Error` `cause`.

**Impact on other tasks**
- P2-T05: every admin route uses `authenticate, authorize(ROLES.ADMIN)`; enforce "at least one active admin" when changing roles or deactivating (it also keeps the seed's "any admin exists" rule safe); `user.service.js` for staff creation can later be reused by the seed.
- P2-T06: when the field schemas move to `users/user.validation.js`, update the import in `scripts/seed-admin.js`.
- Later phases: catalog routes use `authorize(ROLES.ADMIN, ROLES.CATALOG_MANAGER)`, order operations `authorize(ROLES.ADMIN, ROLES.ORDER_OPERATOR)`; ownership checks (`404` for someone else's resource) are separate from role checks.
