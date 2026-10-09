# Make My Marriage

Make My Marriage is a Next.js full-stack wedding planning and management application for Indian weddings.

## Architecture

- `src/app/` contains Next.js pages, layouts, and thin REST Route Handlers.
- `src/modules/` contains wedding-domain business logic.
- `src/server/` contains server-only infrastructure and provider integrations.
- `src/shared/` contains framework-independent types, schemas, and utilities.

The application follows the documented modular-monolith architecture: Next.js, REST APIs through Route Handlers, MongoDB Atlas with Mongoose, Zod validation, server-side sessions, Cloudflare R2, Resend, Google Places, and Vercel.

Feature routes and modules should be added when the corresponding feature is implemented. Do not create placeholder API trees for future features.

## Development commands

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run typecheck
```

Dependencies are declared in `package.json` but have not been installed by this scaffold. External services are not configured yet.
