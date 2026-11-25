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
