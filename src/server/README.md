# Server infrastructure

This directory contains server-only infrastructure shared by domain modules and Route Handlers.

Examples include:

- MongoDB connection reuse
- Session and cookie mechanics
- Authorization context resolution
- Environment validation
- Error and response helpers
- Structured logging
- Rate limiting
- R2, Resend, and Google Places adapters

Do not place wedding-specific business rules here. Those belong in `src/modules`.
