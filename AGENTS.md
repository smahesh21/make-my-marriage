# Make My Marriage — AI Development Guide

This repository implements Make My Marriage as a TypeScript Next.js full-stack modular monolith.

## Source of truth

Before implementing a feature, read the relevant documents in `docs/`:

- `PRODUCT_REQUIREMENT_DOCUMENT.md` — product scope and user behavior
- `SYSTEM_DESIGN.md` — architecture and infrastructure decisions
- `DATABASE_DESIGN.md` — MongoDB collections, relationships, indexes, and data rules
- `API_DESIGN.md` — REST endpoints, validation, authorization, and response contracts

Do not silently change an established product or architecture decision. If documents conflict, identify the conflict before coding.

## Application boundaries

- `src/app/` contains Next.js pages, layouts, and thin REST Route Handlers.
- `src/modules/` contains domain business logic and feature-owned persistence behavior.
- `src/server/` contains server-only infrastructure and external-provider adapters.
- `src/shared/` contains framework-independent types, schemas, constants, and utilities.

Route Handlers should parse requests, authenticate, authorize, validate with Zod, call a module use case, and return the documented HTTP response. They should not contain substantial business logic.

## Authentication boundary

Keep these concerns separate:

- `src/modules/auth/` owns authentication workflows and domain rules.
- `src/server/auth/` owns password hashing, session tokens, cookies, and request authentication context.

Never expose server secrets, session tokens, password data, R2 credentials, or provider credentials to browser code.

## Feature implementation rules

- Add routes and modules when a feature is actually implemented.
- Do not pre-create placeholder directories for every future API.
- Do not add repository, service, interface, or abstraction layers unless the feature genuinely needs them.
- Preserve wedding-level tenant isolation in every private query.
- Derive `weddingId` from the authenticated membership; never trust it from the client.
- Treat cross-wedding resources as inaccessible and avoid leaking their existence.
- Use direct signed R2 uploads for photo binaries; do not send photo bodies through normal API routes.
- Keep public/token-protected responses limited to the fields required by the public page.

## Engineering conventions

- Use strict TypeScript.
- Validate external input with Zod.
- Use Mongoose validation and indexes for database integrity.
- Store INR money as integer paise.
- Store security-sensitive tokens safely according to the documented stable-token exceptions.
- Use consistent API response and error formats from `API_DESIGN.md`.
- Never log passwords, tokens, signed URLs, or secrets.
- Prefer focused changes that preserve existing module boundaries.

## Verification

Before handing off changes, run the relevant checks:

```bash
npm run typecheck
npm run lint
npm run build
```

For feature work, also add focused tests for authorization, tenant isolation, validation, and critical workflows.
