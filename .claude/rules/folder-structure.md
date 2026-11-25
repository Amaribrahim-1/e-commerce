# Folder structure

The folder structure is the **first task** (P1-T01). The learner designs and creates it; the mentor reviews it.

## Requirements
- The brief asks for a **modular monolith**: one backend, separate business modules with clear boundaries (auth, catalog, cart and pricing, orders and stock, shipping, and so on).
- Organize **by business module**, each module holding its own routes, controller, service, model, and validation schemas. Shared code lives in a clearly named shared folder (config, middlewares, utils, errors).
- Separate the Express app setup (`app`) from the server start (`server`).
- Configuration and environment handling live in one place. Nothing reads `process.env` ad hoc across the codebase.
- Keep the tree shallow and predictable. A new file should have one obvious home.
- Seed scripts and any other scripts live outside `src`.

## Agreed structure
The learner approved the concrete layout, file naming and module boundaries during P2-T01. The full tree and the rules are in `docs/02-decisions.md`, section "Folder structure". Check new files against it. The example below is the older, general illustration.

## Illustrative example (not mandatory)
```
src/
  app.js
  server.js
  config/
  common/            errors, middlewares, utils
  modules/
    auth/
    users/
    catalog/
    cart/
    orders/
scripts/             seed
```

When asked to review the structure, check: is every module's responsibility clear, can a module be understood without reading all the others, and is there any business logic outside a service.
