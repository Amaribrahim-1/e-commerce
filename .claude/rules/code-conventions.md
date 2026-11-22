# Code conventions (baseline)

These are the baseline the mentor checks against. If the learner proposes a different approach, discuss the trade-offs instead of forcing this one, and record the outcome in `docs/02-decisions.md`.

## Structure
- Layers: **routes** (wiring only) -> **controllers** (HTTP in/out) -> **services** (business rules) -> **models** (Mongoose). Business rules never live in routes or controllers.
- Folder layout follows `.claude/rules/folder-structure.md`.
- Module system (ESM vs CommonJS) is decided in task P1-T01; once decided, use it consistently.

## Validation and trust
- Validate body, params, and query with **Zod** at the edge, before any business logic.
- Never trust client-supplied prices, totals, roles, or user IDs. Recompute on the server and read the user from the verified token.
- Check **ownership** on every resource that belongs to a user, in addition to role checks.

## Errors
- One error class for expected (operational) errors and **one centralized error-handling middleware**.
- Express 5 forwards rejected promises from async handlers to the error middleware, so no wrapper library is needed.
- The error response shape is consistent across the whole API (the exact shape is decided in the Foundation phase, then documented).
- Never leak stack traces, internal messages, or password hashes to clients.

## Data
- **Money** is stored as integers in piasters (EGP x 100). Never floats.
- **Dates** are stored in UTC and returned as ISO 8601. Africa/Cairo is for display only.
- Enforce invariants in the schema and indexes where possible (for example a unique SKU), not only in code.
- Stock changes use atomic conditional updates. Multi-document operations (such as order creation) use transactions, which need a replica set.
- Snapshot price, title, and SKU on order items at checkout.

## Security basics
- Hash passwords, use `helmet`, configure `cors`, rate-limit authentication routes.
- Secrets only in environment variables. Never commit them. Keep `.env.example` up to date.

## API and workflow
- REST naming: plural nouns, correct HTTP status codes, pagination on every list endpoint.
- Lint and format with ESLint and Prettier.
- English commit messages, small commits, roughly one per task step.
