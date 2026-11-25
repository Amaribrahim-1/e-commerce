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
