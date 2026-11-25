# Decisions

## Decided by the learner
- **Stack:** Node.js, Express 5, MongoDB + Mongoose, Zod, JavaScript (no TypeScript for now).
- **Versions:** latest stable of every package unless there is a known problem.
- **Email:** Resend (instead of Nodemailer).
- **API testing and docs:** Postman for now. Swagger/OpenAPI and automated tests come after the MVP.
- **Scope:** MVP is what the learner has studied plus what is easy to pick up. Webhooks, payments, file upload, testing, and Swagger are deferred.
- **AI tooling:** Claude Code on a Claude Pro plan (instead of Cursor).
- **AI role:** mentor, not code writer. Code is written only on explicit request.
- **Docs rule:** the mentor checks the latest official docs (Context7 MCP first) before writing or reviewing code, and may search the web for how people apply things when opinions differ.

- **Module system:** ESM.
- **MongoDB hosting:** MongoDB Atlas (replica set, so transactions are available).

## Confirmed in the Understand step (2026-11-22)
- Cash on Delivery only. The Order has `paymentMethod` and `paymentStatus` fields (default status for COD is pending) so a gateway can be added later without redesigning the Order.
- Product `images` is an array of URL strings until file upload is learned.
- Stock is deducted atomically when the order is created. No `StockReservation` with expiry and no scheduled job while there is no online payment.
- Guest carts are deferred (logged-in carts only). Tax is not implemented. Basic returns are a stretch item in the last phase. Docker is out.

### Order flow
- An order is created as `pending`. An order operator or admin moves it `pending -> accepted -> packing -> shipped -> delivered`. Any other transition is rejected.
- A customer may cancel their own order only while it is `pending` or `accepted`. Staff may cancel until before `shipped`. After `shipped` there is no cancellation (returns instead).
- Cancellation restores the stock and the coupon usage in the same transaction.
- COD `paymentStatus` becomes `paid` at `delivered`, set by an order operator or admin. Refined in P1-T09: it is a separate "mark paid" action, allowed only once the order is `delivered` (see "Order and payment state machines" below).

### Shipping
- Shipping zones by governorate: a `ShippingZone` holds a list of governorates and a fee. Admin has CRUD on zones.
- No separate Shipment entity. Shipment fields and a `statusHistory` live inside the Order.

### Staff and roles
- Register always creates a customer. Admin creates staff accounts and changes roles.
- The first admin is created by a seed script that reads its credentials from the environment (through the config module).

### Audit log
- Built as a small task at the end of Phase 2. Every later task that changes prices, stock, coupons, or orders writes to it.

### Inventory
- Catalog managers have an inventory-adjustment endpoint that requires a reason. Every adjustment is written to the audit log.

### Coupons
- Rules: expiry, global usage limit, minimum subtotal, maximum cap for percent coupons. The discount applies to the subtotal only (not shipping).
- Usage is counted at order creation and released when the order is cancelled.
- Per-user usage limit: deferred.

### Quote and order
- No stored quote. Order creation recomputes everything from scratch using the same pricing service as the quote endpoint.
- The client may send an `expectedTotal`. The server rejects the order if the recomputed total differs.

### Concurrency check
- A script in `scripts/` fires concurrent requests (for example with `Promise.all`) to verify the "last unit" race. This is a manual verification aid, not an automated test suite.

### Task size
- One focused session is 1 to 1.5 hours. A task that does not fit in one session is split.

### Optional extras
- Written as an optional final phase, one task each: Brands, Subcategories, Reviews and ratings, Wishlist.

## Confirmed after task generation (2026-11-22)

### API conventions
- Base path `/api/v1`; staff-only routes under `/api/v1/admin/...`.
- Role names: `admin`, `catalog_manager`, `order_operator`, `customer`. "Staff" means the first three.
- Status codes: `400` invalid input; **`401` no token** (or an invalid/expired one); **`403` wrong role**; **`404` someone else's resource** (and real not-found), so the existence of another user's resource is never revealed; `409` conflict (duplicate, wrong state, not enough stock). Every protected task lists these cases explicitly in its acceptance criteria.
- Pagination convention is set in P2-T05 and used by every list endpoint.
- Customer order routes live under `/api/v1/users/me/orders` (including cancel and return requests).

### Permissions
- Admin only: coupons, shipping zones, sales reports, audit log, staff management.
- Admin and catalog manager: categories, products, variants, inventory adjustments, low-stock report.
- The catalog manager sets and changes variant prices; every price change writes an audit entry.
- Admin and order operator: order queue, status transitions, COD payment confirmation, staff cancellation, return requests.
- Customer only: cart, checkout quote, placing orders, own orders, return requests, reviews, wishlist. Staff calling these get `403`.
- An admin cannot demote or deactivate themselves; at least one active admin always exists.

### Stock
- Stock changes only through inventory adjustments or orders (create and cancel). Variant endpoints reject `stock` in the body.
- New variants are created with stock `0`. The first stock comes from an inventory adjustment with reason `initial_stock`, which is a positive change allowed only when the variant has no previous adjustment. The seed script uses the same path.

### Design and task order
- Data design tasks come first: P1-T08 (ERD, closes variant modeling, address storage, role storage) and P1-T09 (order and payment state diagrams).
- P5-T01 places orders without stock deduction on purpose; P5-T02 adds the transaction. Overselling is possible only between those two tasks.
- Returns: a return window from config after `deliveredAt`; no automatic restock (staff use an inventory adjustment).
- Phase 8 (optional extras) starts only after Phase 6 is "Ready".
- Items marked "choose and document" in the task files are decided by the learner during `/plan-task` and recorded here.

### Configuration (P1-T03)
- Env loading: Node's built-in `--env-file-if-exists=.env` in the npm scripts, not `dotenv`. Reasons: no dependency, stable in Node 24, real env vars take precedence, a missing file is fine in production. Scripts outside npm scripts must pass the same flag.
- All config is read and validated in `src/config/index.js` (Zod) and exported as a frozen object. `process.env` is read nowhere else.

- `MONGODB_URI` is validated with `z.string().regex(...)` on the scheme (`mongodb://` or `mongodb+srv://`), not `z.url()`. Reason: `z.url()` uses the WHATWG URL parser, which rejects the multi-host "legacy" Atlas string. The driver validates the rest on connect.

### Database connection and process lifecycle (P1-T04)
- Startup order: `mongoose.connect()` first, then `app.listen()`. A failed connection logs only the error name and message (never the error object or the URI) and exits with code 1.
- Shutdown on `SIGINT`/`SIGTERM`: stop accepting requests (`server.close`), `mongoose.disconnect()`, exit 0. A 10 s timer forces exit 1 if something hangs. Repeated signals are ignored.
- `unhandledRejection` and `uncaughtException`: log, run the same graceful shutdown, exit 1 (process state is unknown, so do not continue). A process manager restarts it in production.
- `serverSelectionTimeoutMS` is left at the driver default (30 s): Atlas is a replica set, and the docs advise against lowering it for replica sets. A wrong password fails fast anyway (auth error).
- `/health` does not report the DB state for now (optional in the task).

### Response and error shape (P1-T05)
- **Success:** `{ "status": "success", "data": <payload or null> }`, sent only through `sendSuccess(res, statusCode, data)`. List endpoints will add a sibling `meta` key for pagination in P2-T05 (not implemented yet).
- **Error:** `{ "status": "fail" | "error", "message": "..." }`. `fail` = client-side problem (4xx), `error` = server-side (5xx). The naming follows the JSend convention (community convention, not an Express rule).
- **Reserved extension:** an optional `details` array on the error shape for field-level validation errors (P1-T06). It is absent for all other errors.
- **Development only:** a `stack` key is added when `NODE_ENV=development`. Never in production or test.
- **Operational vs unknown:** `AppError(message, statusCode)` marks an expected error (`isOperational = true`) and its message is client-safe. Any other error is a bug: logged with `console.error` (replaced by a real logger later) and answered with `500` and the generic message `Something went wrong`.
- **Translation** (in `globalErrorHandler`, in every environment): Mongoose `CastError` -> `400`; Mongoose `ValidationError` -> `400`; duplicate key (`code 11000`) -> `409`; malformed JSON from `express.json()` (`type: entity.parse.failed`) -> `400`. Unknown route -> `404` via `notFoundHandler`.
- **Middleware order in `app.js`:** `express.json()` -> routes -> `notFoundHandler` -> `globalErrorHandler` (last, 4 parameters, because Express recognises an error handler by its arity).
- **Deferred to their own tasks:** `413` body too large (P1-T07), Zod errors (P1-T06), JWT/auth errors (Phase 2).

### Request validation (P1-T06)
- **Tool:** `validation({ body, params, query })` in `src/common/validation.js` takes an object of Zod schemas (each part optional) and returns a middleware. It runs `safeParse` on every part that has a schema and collects the issues of all parts before failing (it does not stop at the first one).
- **Failure:** `400` with message `Invalid request data.` and `details`: an array of `{ location, path, message }`. `location` is `body`, `params` or `query`; `path` is the Zod issue path joined with `.` (for example `address.city`), or the part name when the issue is on the whole part. `details` is carried by `AppError(message, statusCode, details)` and written by `sendError`. Zod issue messages are client-safe, so they are sent as they are.
- **Success:** parsed values (coerced, defaults applied) are stored on `req.validated.body`, `req.validated.params` and `req.validated.query`. The originals are never overwritten, because `req.query` is a read-only getter in Express 5. Handlers read from `req.validated`.
- **Missing body:** `req.body` is `undefined` in Express 5 when nothing was parsed, so it is treated as `{}`. The client gets "required" errors for the fields instead of a confusing type error.
- **Unknown keys:** **strip** (Zod's default for `z.object`), so extra keys are silently dropped. A schema that needs to reject them can use `.strict()`. Reason: tolerant of harmless extra fields, and the handler only ever sees what the schema allows. Source: Zod v4 docs (`z.object` strips unrecognized keys by default).
- **ObjectId:** `objectIdSchema` and `idParamsSchema` in `src/common/objectIdSchema.js` check 24 hex characters with a regex. Mongoose `isValidObjectId` was not used because it also accepts any 12-character string. A bad `:id` is a `400` from validation, never a `CastError` `500`.
- **Not done here:** business rules (for example "email already registered") stay in services, not in schemas.

### Security and logging middleware (P1-T07)
- **Order in `app.js`:** `trust proxy` setting -> `morgan` (development only) -> `helmet()` -> `cors()` -> `express.json({ limit })` -> routes -> `notFoundHandler` -> `globalErrorHandler`. Reason: the logger sees every request, security headers are on every response (including errors and 404s), CORS answers preflight (`OPTIONS`) before any body parsing, and the body is parsed only after those checks.
- **Helmet:** `helmet()` with defaults (v8). It sets the security headers and removes `X-Powered-By`. Source: Helmet docs (Context7).
- **CORS:** allow-list in `CORS_ORIGINS` (comma-separated, validated: `http(s)://host[:port]`, no trailing slash). Empty means no cross-origin browser access. `*` is rejected when `NODE_ENV=production` (the app refuses to start); in development it is mapped in `app.js` to the real wildcard, because inside an array the `cors` package treats `"*"` as a plain string and would silently allow nothing. Methods `GET, POST, PUT, PATCH, DELETE`, headers `Content-Type, Authorization`, `maxAge` 600 s. `credentials` stays off until the auth token transport (header or cookie) is decided in Phase 2. CORS is enforced by browsers only; it is not an access control for the API.
- **Body limit:** `BODY_LIMIT` (default `100kb`) on `express.json()`. Over the limit -> `413` `Request body is too large.` in the standard error shape (`entity.too.large` is translated in `globalErrorHandler`). Reason: the whole body is buffered in memory, so an unbounded body is a cheap denial-of-service. Revisit only if a feature really needs bigger JSON.
- **Request logging:** `morgan('dev')` only when `NODE_ENV=development`. Off in production and test. Reason: `dev` is a colourful format for humans; a production format (`combined`) would only go to stdout without structure, so a real logger is better decided later together with the `console.error` replacement.
- **Trust proxy:** `TRUST_PROXY_HOPS` (default `0` = no proxy, the app is reached directly). Set it to the real number of proxies when deployed (for example `1` behind one platform proxy). Never `true`: any client could fake `X-Forwarded-For` and so fake its IP. Why it matters: with a proxy and the default, `req.ip` is the proxy's IP, so the rate limiter (P2-T08) would count all users as one; with a wrong high value, attackers can dodge the limiter.
- **Known and accepted:** `npm audit` reports 2 moderate issues, both in `nodemon` -> `minimatch` (a development tool, never in production). The suggested `npm audit fix --force` would install an older nodemon, so it is not applied. Re-check when nodemon releases a fixed version.

### Data design (P1-T08)
Full model: `docs/design/erd.md` (diagram) and `docs/design/data-model.md` (fields, indexes, snapshots, invariants). Sources: MongoDB Manual (Embedded Data, Reference Data, Unique and Partial Indexes, Atomicity and Transactions, Unbounded Arrays) and Mongoose docs (`unique`, `enum`, `immutable`, update validators), checked through Context7.

**Rules used for embed vs reference** (documented guidance plus our reading of it): embed when the child is bounded, always read with the parent, changes atomically with it, or is a snapshot; reference when the child is unbounded, queried alone, changes often, or needs database-level uniqueness of its own.

- **Variant modeling: separate `variants` collection** (one document per SKU, with `productId`).
  - Why: (1) a unique index on an array only prevents duplicates **between documents**, so embedded variants could not enforce "unique SKU" and "unique size+color inside one product" in the database; (2) stock deduction is one atomic conditional update on one document (`stock >= n`); (3) cart, order items, inventory adjustments and audit entries all point to one `variantId`; (4) the product document stays small.
  - Costs accepted: the product list needs price range and in-stock info, so it uses an aggregation (or denormalized fields, decided in P3-T06); creating a product with its variants writes to two collections, so it uses a transaction; the product page needs a second query.
  - Embedded was the valid alternative if read simplicity mattered more; then the code would have to guard both invariants.
- **Address storage: embedded array in User**, with a maximum count (about 10) and per-address `_id`.
  - Why: bounded, always read with the user, never queried alone, ownership is implied by the parent (MongoDB manual uses exactly this "patron with addresses" pattern). The order keeps a **snapshot** copy, not a reference.
  - Trade-off: searching addresses across users (reports) would be harder; not needed in the MVP.
- **Role storage: single `role` enum field** on User (`admin`, `catalog_manager`, `order_operator`, `customer`).
  - Why: four fixed roles, no one needs two roles, the permission table is per role, and the "at least one active admin" check is one query. Moving to an array later is a small migration if ever needed.
  - Trade-off: no multi-role users.
- **Password reset token:** two fields on User, `passwordResetTokenHash` and `passwordResetExpires` (both `select: false`, cleared after use). One pending reset per user (a new request replaces the old one); bounded and read with the user. A separate collection with a TTL index is the alternative if multiple tokens or history are ever needed.
- **Cart:** one document per user (unique `userId`), embedded `items` with `variantId` and `quantity`, **no price stored** (the cart is an intention; the price is read from the variant). One line per variant is guaranteed by a conditional update in the service, not by an index.
- **Order:** items, address, coupon, `statusHistory`, `shipment` and `cancellation` embedded; money and descriptive fields are snapshots (full list in `data-model.md`); `userId`, `variantId` and `couponId` stay as references on purpose. Snapshot fields are `immutable`.
- **AuditLog, ReturnRequest, ShippingZone, Coupon, Category, Product:** own collections (see `data-model.md` for why each one).
- **Stock ledger = the audit log.** No separate `InventoryAdjustment` collection. Every stock change (manual adjustment or order create/cancel) writes one AuditLog entry with `before.stock`, `after.stock`, a `reason` from a fixed list (`initial_stock`, `restock`, `damaged`, `lost`, `correction`, `order_placed`, `order_cancelled`) and `meta` (`change`, `orderId`). The Variant holds the current stock; the log holds the history. Affects P2-T10 (schema), P3-T05 and P5-T02/T05.
- **Purchasable rule:** a line can be added, quoted or ordered only if the variant, its product and the product's category are all active. Deactivating a product or category never rewrites its variants; the check reads all three. Affects P3-T06/T08, P4-T02/T03, P5-T01.
- **Money invariants added:** variant price `> 0`; order `discount <= subtotal` (so the total never goes negative, EC-08).
- **Clearing optional indexed fields:** use `$unset`, not `null` (a sparse index still indexes `null`, MongoDB Manual, Sparse Indexes). Applies to the reset-token fields (P2-T07/T08).
- **To verify when the task comes up (not yet confirmed):** unique multikey + partial index for shipping zones (test on Atlas in P4-T01); duplicate-key behavior inside a transaction for the random `orderNumber` (P5-T01); `initialStockSet` flag versus other options for `initial_stock` (P3-T05); hash choice for the reset token (P2-T07).

### Order and payment state machines (P1-T09)
Full diagrams and transition tables: `docs/design/order-state-machine.md`.

- **Whitelist:** only the listed transitions exist; anything else (skip, go back, leave a final state, same state) is `409`. The server owns the state; clients call actions, they never pick a free target status.
- **Two machines on one Order:** `status` (fulfilment) and `paymentStatus` (money), linked by guards, not merged. Reason: a gateway later changes only the payment machine.
- **Order transitions:** `pending -> accepted -> packing -> shipped -> delivered` by admin or order operator. Cancel: customer (own order) from `pending`/`accepted`; admin or order operator from `pending`/`accepted`/`packing`. `delivered` and `cancelled` are final. The catalog manager has no order rights.
- **Payment values:** `pending`, `paid`, `voided`. A cancelled COD order becomes `voided` (nothing is owed), so "cash to collect" and sales reports do not count it. No `refunded`: `paid` only happens after `delivered`, and there is no cancel after `shipped`; return refunds live in `ReturnRequest.refundStatus`.
- **COD confirmation is a separate action** (`POST /api/v1/admin/orders/:id/mark-paid`), allowed only when `status = delivered` and `paymentStatus = pending`; sets `paidAt` and `paymentConfirmedBy`. Rejected alternative: setting `paid` automatically on `delivered` (mixes a logistics fact with a money fact and hides "delivered but cash not yet received"). Affects P6-T03.
- **Cancellation** is one transaction whose first step is the conditional status update; if it matches nothing, the transaction aborts, so stock and coupon usage are never restored twice. Reason required for staff, optional for customers.
- **Concurrency:** every transition is one conditional update with the expected current state in the filter (single-document writes are atomic, MongoDB Manual). The loser gets `409`. Inside a transaction, a filter that matches nothing does not abort by itself: the service must check the result and throw, and the throw is what aborts (Mongoose docs, Transactions). For a customer, ownership (`userId`) is part of the same filter.
- **Order of checks:** `401` -> `403` -> `400` -> `404` (not found or not own) -> `409` (wrong state).
- **Labels:** stored value is the code; a single server-side map gives the label (`statusLabel`, `paymentStatusLabel`), ready for an Arabic set later.
- **Accepted gap:** a refused COD parcel has no path after `shipped`; a `delivery_failed` state is post-MVP.

### User model (P2-T01)
Sources: Mongoose 9 docs (v9.0.1: `guide.md`, `schematypes.md`, `faq.md`, `migrating_to_9.md`), node.bcrypt.js README, bcrypt.js README, OWASP Password Storage Cheat Sheet.

- **Fields are added with the task that uses them** (YAGNI). P2-T01 has `name`, `email`, `phone`, `passwordHash`, `role`, `isActive`, `passwordChangedAt` and timestamps. The reset-token fields come in P2-T07 and `addresses` in P2-T09.
- **`__v` is kept** in the database. Mongoose's default versioning protects array updates done through `save()` (a stale copy that edits a shifted array index gets a `VersionError`), and `addresses` will be an embedded array. It is hidden from responses only (see `toJSON` below). It is not updated by `findOneAndUpdate`/`updateOne` (Mongoose docs).
- **Email:** `unique` index, `lowercase`, `trim`. The format check is done by Zod at the edge only (no `match` in the schema): an email regex is hard to get right, and two copies would drift apart.
- **Phone rule:** local Egyptian mobile format only: `01`, then one of `0` / `1` / `2` / `5` (Vodafone, e&, Orange, WE), then 8 digits = 11 digits, for example `01012345678`. `+20` and `0020` are rejected, and the number is stored exactly in this one form (canonical form), so search, comparison and the order snapshot stay simple. The regex is defined once (`EGYPT_PHONE_REGEX`) and used by both Zod (from P2-T02) and the schema `match` (last line of defence for writes that skip Zod, such as scripts and seeds).
- **Roles:** one frozen constant `ROLES`, shared by the schema `enum` (and its default) and the authorization middleware (P2-T04). No role string is typed by hand anywhere else.
- **Password hashing library: `bcrypt`** (native). It runs the hashing off the main thread; `bcryptjs` is pure JavaScript, about 30% slower and works on the main thread (bcrypt.js README). `bcryptjs` is the fallback if the native install ever fails. Known: OWASP ranks Argon2id first and bcrypt for legacy systems; bcrypt is kept because it is in the agreed stack and safe with a proper cost.
- **Cost factor:** `BCRYPT_SALT_ROUNDS` in config (default `12`, minimum `10`, the OWASP minimum). Each +1 doubles the time (`2^rounds` iterations, node.bcrypt.js README).
- **Where hashing happens: in the service, not in a pre-save hook.** One module (`hashPassword`, `verifyPassword`) is the only place that imports `bcrypt`. Reasons: business rules live in services (code conventions); save hooks do not run on `findOneAndUpdate`/`updateOne`, and P2-T06/T08 change the password, so a hook could silently store a plain password; the field name `passwordHash` makes a plain value look wrong in review. Rejected: pre-save hook with `isModified('password')` (common in tutorials, never forgotten as long as `save()` is used).
- **Password length:** bcrypt uses only the first **72 bytes** and silently ignores the rest. Zod rejects longer passwords in P2-T02 (bytes, not characters: an Arabic letter is 2 bytes).
- **`passwordChangedAt`:** no default; empty until the first password change (P2-T06/T08). JWT `iat` is in seconds and `Date` in milliseconds, so the value is set so that it is older than the new token's `iat` (handled in P2-T03/T06).
- **Reading the hash:** `passwordHash` has `select: false`. Only the login query asks for it (`+passwordHash`, P2-T03).
- **Hiding sensitive fields in responses:** a `toJSON` transform on the schema removes `passwordHash` and `__v` (and the reset-token fields from P2-T07). Reason: `select: false` only affects queries, so the document returned by `create()`/`save()` still holds the hash; `toJSON` runs on `res.json()`. `.lean()` results skip `toJSON`, but they come from queries, where `select: false` applies.
- **Indexes:** `autoIndex` stays on (Mongoose default) for now. Mongoose recommends turning it off in production and building indexes separately; revisit before deployment. The unique index only works once it is built, and it cannot be built while duplicates exist.

### Folder structure (agreed during P2-T01)
Based on the nodebestpractices guidance "structure your solution by business components" and common modular-monolith examples. The `<entity>.<layer>.js` file naming is a community convention, not an official rule. The refactor from the current layout is done in its own `refactor:` commit (with `git mv`, to keep history).

```
src/
  app.js
  server.js
  routes.js                  mounts every module router under /api/v1
  config/
    index.js
  common/                    only what no single module owns
    errors/                  AppError.js, globalErrorHandler.js, notFoundHandler.js
    http/                    sendSuccess.js, sendError.js (the API response shape, in one place)
    middlewares/             validation.js
    validators/              objectIdSchema.js, phone.js
    constants/               roles.js (later: governorates)
  modules/
    users/                   user.model.js, password.service.js, then user.service.js,
                             user.controller.js, user.routes.js, user.validation.js
    auth/                    auth.routes.js, auth.controller.js, auth.service.js,
                             auth.validation.js, auth.middleware.js (authenticate / authorize)
    ...
scripts/                     seed and other scripts, outside src
```

- **`routes.js` is one file, not a folder.** Each module owns its endpoints (`<entity>.routes.js`); the root file only decides the prefix of each module. A `routes/` folder would organise by type and contradict "by business module". It can become `routes/index.js` if it ever grows.
- **`sendError` lives next to `sendSuccess`** (`common/http/`): both define the response shape, so a shape change touches one folder. `globalErrorHandler` imports `sendError` from there.
- **Auth middleware lives in the auth module**, not in `common`: it depends on User and JWT.
- **Naming:** file inside a module `<entity>.<layer>.js` (entity singular); module folder plural; file in `common` camelCase named after its export; file holding a class PascalCase (`AppError.js`); Model PascalCase singular; function camelCase starting with a verb; constant UPPER_SNAKE.
- **Boundaries (community convention):** a module imports another module's **service or model only**, never its controller or routes. Dependencies go one way (`auth` depends on `users`, not the reverse). No `index.js` per module for now (easy to create circular imports).
- **To decide in P2-T05:** admin endpoints (`/admin/users`) in a second routes file of the users module (for example `user.admin.routes.js`, recommended) or a separate module.

## Open (the learner decides during `/plan-task`)
- Auth token transport (header or cookie) and the exact reset-password flow.
- Transactions versus compensating steps for order creation.

## Libraries
**In scope (verify the latest version before using):** `express`, `mongoose`, `zod`, `jsonwebtoken`, `bcrypt` (or `bcryptjs`), `helmet`, `cors`, `express-rate-limit`, `dotenv` (or Node's `--env-file`), `morgan`, `slugify`, `resend`, `nodemon` (or `node --watch`), ESLint, Prettier.

**Deferred:** `multer`, `sharp`, a cloud storage SDK, `jest` or `vitest`, `supertest`, `mongodb-memory-server`, `swagger-ui-express`, `swagger-jsdoc`, `node-cron`, and the raw-body / HMAC handling needed for webhooks.

The authentication libraries are assumed to be familiar from the course. The learner will say if any library is new.
