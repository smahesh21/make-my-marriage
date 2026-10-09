# Server authentication infrastructure

This directory is intentionally distinct from `src/modules/auth`.

It owns implementation mechanisms such as:

- Password hashing adapter
- Session token generation and hashing
- Session lookup
- Secure cookie creation and clearing
- Current-user request context

It does not own signup, login, or password-reset business workflows.
