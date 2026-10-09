# Authentication module

This module will own authentication use cases and domain rules:

- Signup
- Login
- Logout
- Forgot-password workflow
- Reset-password workflow

It must not contain Next.js route-handler code or low-level cookie/storage implementation.

Those concerns belong to `src/app/api` and `src/server/auth` respectively.
