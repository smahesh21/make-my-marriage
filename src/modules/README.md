# Domain modules

Business behavior belongs here. Add a module when its feature is implemented; do not pre-create modules for every future product area.

Modules may own domain schemas, Mongoose models, wedding-scoped repositories, services, use cases, and response mappers when those pieces are actually needed.

## `modules/auth` versus `server/auth`

`modules/auth` owns authentication-domain behavior such as signup, login, password reset, and session use cases.

`server/auth` owns server-only mechanisms such as password hashing, cookie handling, session-token resolution, and request authentication context.

Route Handlers coordinate both through module use cases and server authentication helpers.
