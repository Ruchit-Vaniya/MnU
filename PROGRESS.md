# MnU — Progress Log

Consolidated as of the MongoDB switch. Reflects the current state of the
project end to end, not just the most recent session.

## Day 1 — Foundation
- Turborepo monorepo (`pnpm-workspace.yaml`, `turbo.json`) with `apps/web`
  (Next.js) and `apps/api` (NestJS).
- Base project structure and documentation.

*(Correction: `apps/web` was left as an empty placeholder folder through
Day 2 and Day 3 — it's now actually scaffolded; see "Frontend foundation
added" below.)*

## Day 2 — Database connection foundation
- Prisma installed and wired into the NestJS backend:
  - `apps/api/src/prisma/prisma.service.ts` — `PrismaService extends
    PrismaClient`, hooked into Nest's module lifecycle.
  - `apps/api/src/prisma/prisma.module.ts` — `@Global()` module exporting
    `PrismaService`.
  - `GET /health` on `AppController` round-trips a trivial DB call to prove
    the connection is alive.
- `.env.example` added (safe placeholder); real `.env` gitignored, never committed.
- `docker-compose.yml` added for local dev infrastructure.

*(Originally built and verified against PostgreSQL — see "Switched to
MongoDB" below for what changed.)*

## Day 3 — Users, roles, restaurants foundation
Three models added to `apps/api/prisma/schema.prisma`:
- `User` — id, name, email (unique), passwordHash (placeholder), timestamps
- `Restaurant` — id, name, timestamps
- `RestaurantMember` — join table: userId, restaurantId, role, createdAt;
  unique on (userId, restaurantId) so one user has exactly one role per
  restaurant, but can belong to many restaurants
- `RestaurantRole` enum — `SUPER_ADMIN`, `RESTAURANT_ADMIN`, `RESTAURANT_STAFF`
- `apps/api/prisma/seed.ts` — seeds one user with memberships (and
  different roles) across two restaurants.

**Verified (against PostgreSQL, before the Mongo switch):** applied the
schema, confirmed a user can hold different roles at different restaurants
simultaneously, confirmed the unique constraint blocks a duplicate
membership, and confirmed cascade delete removes only the affected
restaurant's membership rows.

No auth, JWT, login, or business features (QR/menu/orders/analytics/AI) —
those are later tasks. **Next task: Authentication foundation.**

## Switched to MongoDB (after Day 3)
Per request, the database provider was changed from PostgreSQL to MongoDB:
- `schema.prisma`: `provider = "mongodb"`, `relationMode = "prisma"` (Mongo
  has no native foreign keys, so Prisma enforces relations/cascades itself
  instead of the database). Every model's `id` now uses `@default(auto())
  @map("_id") @db.ObjectId`. Explicit `@@index` added on `userId` and
  `restaurantId` in `RestaurantMember` since Mongo doesn't auto-index
  foreign-key-style fields the way Postgres does.
- Removed the Postgres-specific SQL migration folder — Mongo uses
  `prisma db push`, not migration files.
- `docker-compose.yml` now runs `mongo:7` instead of `postgres:16-alpine`.
- `apps/api/package.json`: `prisma:migrate` script replaced with
  `prisma:push` (`prisma db push`).
- `AppController`'s `/health` check switched from `$queryRaw\`SELECT 1\``
  (SQL-only) to `$runCommandRaw({ ping: 1 })` (Mongo's equivalent).
- `.env.example` updated to a MongoDB connection string format
  (`mongodb://` for local, `mongodb+srv://` for Atlas).
- `prisma/seed.ts` unchanged — it never set IDs manually, so it works as-is
  against Mongo's auto-generated ObjectIds.

**Not yet verified end-to-end against a real MongoDB instance** — this
sandbox's network can't reach MongoDB's package repo (dropped from Ubuntu's
default apt repos over licensing) or Atlas, so the schema/config changes
above are correct by inspection but haven't been round-tripped through
`prisma generate` → `db push` → `db seed` → `prisma studio` the way the
Postgres version was. Run that sequence on your own machine or against
Atlas to confirm before building the next task on top of it.

## Frontend foundation added
`apps/web` was scaffolded for real (Next.js 15, App Router, React 19,
TypeScript, Tailwind v4):
- `app/layout.tsx`, `app/page.tsx`, `app/globals.css` — a minimal landing
  page only, matching the backend's current foundation-only scope. No auth
  screens, QR menu, or dashboards yet.
- `.env.example` — `NEXT_PUBLIC_API_URL` pointing at the NestJS API.
- Verified: `npm run build` compiles cleanly (Next 15.5.25, static export of
  `/` succeeds).

Frontend features get built alongside each backend task going forward,
starting with login/register screens once "Authentication foundation" lands.

## Authentication (started early, at request)
Real register/login/me endpoints added to the backend, and real
login/register/dashboard screens added to the frontend — ahead of the
formal "Authentication foundation" day, at explicit request.

**Backend** (`apps/api/src/auth/`):
- `POST /auth/register` — creates a Restaurant + User + RestaurantMember
  (role `RESTAURANT_ADMIN`) and returns `{ token, user, membership }`.
- `POST /auth/login` — verifies credentials with bcrypt, returns
  `{ token, user, memberships }` (an array — a user isn't assumed to
  belong to only one restaurant, consistent with Day 3's design).
- `GET /auth/me` — verifies the bearer JWT, returns the current user +
  all their memberships.
- JWT payload is intentionally just `{ user_id }` — role/restaurant are
  contextual per request, not baked into the token, since one token
  shouldn't imply one fixed role.
- **Not wrapped in a Prisma `$transaction`**: MongoDB multi-document
  transactions require a replica set, which a default standalone `mongod`
  doesn't have. Register's three writes (restaurant, user, membership) run
  sequentially instead. Fine for this stage; revisit with a single-node
  replica set locally or Atlas (a replica set by default) before this
  matters for real data.
- New deps: `bcryptjs`, `jsonwebtoken`. New env var: `JWT_SECRET`.

**Frontend** (`apps/web/app/`):
- `/register`, `/login` — real forms calling the endpoints above via
  `lib/api.ts`, storing the JWT in `localStorage`.
- `/dashboard` — minimal page proving the token round-trips through
  `/auth/me` correctly; lists the signed-in user's restaurants + roles.
- `/menu/demo` — **dummy data only**, clearly labeled in-page. There is no
  menu/QR backend yet (still out of scope), so this previews layout only
  and is not wired to the API.
- Home page (`/`) updated to link to all of the above.

### Verified
- Both `apps/web` (`npm run build`) and the auth module's TypeScript
  (`npx tsc --noEmit`) compile cleanly.

### Known limitation (environment, not code) — same root cause as before
`npx prisma generate` still can't complete in this sandbox (`binaries.prisma.sh`
403), so the auth endpoints haven't been exercised against a real running
MongoDB in this environment — only reviewed and typechecked (with an
explicit interface added for the one spot that would otherwise have relied
on Prisma's generated types). Run `npm install` → `npx prisma generate` →
`npx prisma db push` → `npm run dev` on your machine or against Atlas, then
test `/auth/register` and `/auth/login` with curl or the frontend forms, to
confirm before building further on top of this.

## Day 4 — Authentication system completed

Registration, login, password hashing, and `/auth/me` already existed
(built ahead of schedule, see "Authentication (started early)" above).
This session added the two pieces still missing against the Day 4 spec:

- **`JwtAuthGuard`** (`apps/api/src/auth/jwt-auth.guard.ts`) + **`@CurrentUserId()`**
  decorator — a real, reusable NestJS guard. `/auth/me` previously parsed
  and verified the bearer token inline in the controller; it's now
  `@UseGuards(JwtAuthGuard)` like any future protected route will be.
- **`POST /auth/logout`** — guarded, confirms the token is valid, returns
  `{ message: 'Logged out.' }`. JWTs here are stateless (no server-side
  session to destroy), so real logout is the client discarding the token;
  this endpoint gives a consistent place to call and a hook point for a
  token-blocklist later if that's ever needed.
- **Email format validation** added to `register()` (simple regex) — the
  length/confirmation checks already existed, but format wasn't checked.
- **Frontend**: `authApi.logout()` added to `lib/api.ts`; the dashboard's
  "Sign out" button now calls it (best-effort) before clearing the local
  token, instead of only clearing local state.
- **Fixed a real bug**: `apps/api/.env` was missing `JWT_SECRET` entirely
  (only `.env.example` had it) — every authenticated request would have
  thrown `JWT_SECRET is not set in .env` at runtime. Added a dev-only value.

No database changes — logout needed none, and the User/RestaurantMember
models already supported everything else.

### Checks
- `apps/api`: `npx tsc --noEmit` clean, `npx nest build` clean.
- `apps/web`: `npx tsc --noEmit` clean, `npm run build` clean (same 6
  routes as before: `/`, `/dashboard`, `/login`, `/menu/demo`, `/register`,
  plus `/_not-found`).
- Pure auth logic verified directly (12/12 checks passed, no DB needed):
  JWT sign/verify round-trip, JWT rejects a tampered token, JWT rejects a
  token signed with the wrong secret, bcrypt hash ≠ plaintext, bcrypt
  compare true/false cases, email regex accept/reject cases, password
  length rule.

### Not verified — same root cause as every prior session
The app can't actually **boot** in this sandbox: `PrismaClient did not
initialize yet` on startup, because `prisma generate` still can't reach
`binaries.prisma.sh` (403, network-blocked) here. So register/login/me/
logout/invalid-credentials could not be exercised against a real running
server + MongoDB in this environment — only reviewed, typechecked, and
logic-tested as above. On your machine or Atlas: `npm install` → `npx
prisma generate` → `npx prisma db push` → `npm run dev`, then:
- `curl -X POST :3001/auth/register -d '{...}'` → expect `{ token, user, membership }`
- `curl -X POST :3001/auth/login -d '{...}'` → expect `{ token, user, memberships }`
- `curl :3001/auth/me -H "Authorization: Bearer <token>"` → expect `{ user, memberships }`
- `curl :3001/auth/me` (no header) → expect `401 Unauthenticated.`
- `curl -X POST :3001/auth/logout -H "Authorization: Bearer <token>"` → expect `{ message: 'Logged out.' }`
- `curl -X POST :3001/auth/login -d '{"email":"x","password":"wrong"}'` → expect `401 Invalid email or password.`

Next task: **Role-based access control**.

## Migrated database layer from Prisma to Mongoose

Per project instruction, the database access layer was migrated from
**Prisma** (already pointed at MongoDB, per the earlier "Switched to
MongoDB" entry above) to **Mongoose**. Prisma is now removed entirely —
see [`docs/DATABASE.md`](./DATABASE.md) for the full breakdown of what
changed and why.

Summary:
- `PrismaService`/`PrismaModule` → `DatabaseModule`
  (`apps/api/src/database/database.module.ts`), a `@Global()` module using
  `MongooseModule.forRootAsync()` + `forFeature()`.
- `schema.prisma`'s three models became three Mongoose schemas:
  `apps/api/src/users/schemas/user.schema.ts`,
  `apps/api/src/restaurants/schemas/restaurant.schema.ts`,
  `apps/api/src/restaurant-members/schemas/restaurant-member.schema.ts`
  (plus `RestaurantRole` as a plain TS enum under `src/common/enums/`).
  Same fields, same compound-unique + individual indexes on
  `RestaurantMember`, same `User.email` unique constraint.
- `AuthService` rewritten to use `@InjectModel()` and Mongoose query
  methods instead of `this.prisma.<model>.<method>()`. Behavior
  (register/login/me responses, validation rules, error messages) is
  unchanged — this was a data-layer swap, not a feature change.
- `AppController`'s `/health` check now pings via the Mongoose connection
  instead of Prisma.
- `prisma/seed.ts` → `src/database/seed.ts` (same seed data: one user,
  two restaurants, two different roles).
- `apps/api/package.json`: `@prisma/client`/`prisma` removed;
  `@nestjs/mongoose`/`mongoose`/`dotenv` added; `prisma:*` scripts
  removed, `db:seed` repointed.
- No changes needed to `.env.example` or `docker-compose.yml` — already
  MongoDB-shaped from the earlier provider switch.
- **Old Prisma files preserved, not deleted** — moved to
  `apps/api/_archive/prisma-legacy/` (outside the compiled `src/` tree, so
  they don't break the build) per the instruction not to remove working
  code until the Mongoose replacement is verified.
- Preserved as required: `User`, `Restaurant`, `RestaurantMember` concepts
  and the `SUPER_ADMIN` / `RESTAURANT_ADMIN` / `RESTAURANT_STAFF` roles.
  No menu, QR, orders, analytics, AI, customer, or mobile work added —
  out of scope, same as every prior session.

### Checks
- `apps/api`: `npx tsc --noEmit` clean, `npx nest build` clean (both run
  with the archived legacy folder excluded from the TypeScript project).
- `apps/web`: `npx tsc --noEmit` clean, `next build` clean (unaffected —
  the frontend has no DB dependency).
- `pnpm build` at the repo root: both `@mnu/api` and `@mnu/web` build
  successfully via Turborepo.
- App boot check: the Nest app starts, `DatabaseModule`/`MongooseModule`
  initialize without DI or config errors, and the process correctly
  attempts to open a connection to `DATABASE_URL` (observed
  connecting/retrying against an unreachable local MongoDB URI, rather
  than failing with a code error).
- Schema-level validation checks (Mongoose `validateSync()`, no live DB
  required): 11/11 passed — valid documents pass, documents missing
  required fields fail, an invalid `role` enum value is rejected, and all
  expected indexes (`User.email` unique; `RestaurantMember`'s compound
  unique index plus its two individual indexes) are present on the
  schemas.

### Not verified — same root cause as every prior session, different package
This sandbox has no network path to any real MongoDB: not `apt` (dropped
from Ubuntu's default repos), not `fastdl.mongodb.org` (tried
`mongodb-memory-server` to get a throwaway local instance — blocked,
403), not Atlas. So register/login/me/logout have **not** been exercised
against a real running MongoDB in this environment — same class of
limitation every prior session hit with Prisma's binary downloads, just
against a different domain this time. See "Verified / Not verified" in
`docs/DATABASE.md` for the exact commands to confirm on your own machine
or against Atlas before building further on top of this.

Next task: **Authentication foundation** *(already substantially built —
see "Authentication (started early)" and "Day 4 — Authentication system
completed" above; this session only swapped its data layer, no auth
behavior changed)*.

## Reconciled with `mnu_v1` — menu feature ported onto Mongoose

`mnu_v1` (a separately-uploaded package: still Prisma-based, but with a
real filled-in `.env`, `node_modules`, and a completed `.next`/`dist`
build — i.e. actually run and working) turned out to contain a **menu
management feature** (categories + items CRUD, `/restaurants/[id]/menu`)
that this Mongoose-migrated codebase did not have. So the Mongoose
migration above was *not* a strict upgrade of `mnu_v1` — it rewrote the
data layer but silently dropped a working feature in the process.

**Fixed by porting the menu feature onto this codebase**, Mongoose-native
rather than copying the Prisma version verbatim:

- Two new Mongoose schemas, matching this codebase's existing
  conventions: `apps/api/src/menu/schemas/category.schema.ts` and
  `.../menu-item.schema.ts` (same fields as the old Prisma `Category`/
  `MenuItem` models), registered in the shared `DatabaseModule`.
- `MenuService` rewritten against `@InjectModel()` instead of
  `PrismaService` — same access-control logic (membership required to
  view, `RESTAURANT_ADMIN`/`SUPER_ADMIN` required to mutate,
  `RESTAURANT_STAFF` can still toggle `isAvailable`). One real behavior
  difference worth flagging: Prisma's `relationMode = "prisma"` emulated
  cascade delete (deleting a category deleted its items automatically);
  Mongoose has no such emulation, so `deleteCategory()` now explicitly
  `deleteMany()`s the category's items first.
- `MenuController` and the frontend page
  (`apps/web/app/restaurants/[restaurantId]/menu/page.tsx`) copied over
  **unchanged** from `mnu_v1` — both are pure HTTP/REST, with no
  Prisma/Mongoose dependency of their own, so nothing needed to change.
- `lib/api.ts`: added `menuApi` + its types alongside the existing
  `authApi` (which already had `logout()`, not present in `mnu_v1`'s
  version — kept, not overwritten).
- `/dashboard`: added `mnu_v1`'s "Manage menu" link per restaurant,
  kept this codebase's `authApi.logout()`-calling sign-out button.

**Also copied over `mnu_v1`'s real `.env` files** (`apps/api/.env`,
`apps/web/.env`) — the actual `DATABASE_URL`/`JWT_SECRET`/
`NEXT_PUBLIC_API_URL` values that were confirmed working when `mnu_v1`
was run, rather than leaving this codebase on placeholder
`.env.example` values only. Both `.env` files remain gitignored, as
before.

### Checks
- `apps/api`: `npx tsc --noEmit` clean, `npx nest build` clean.
- `apps/web`: `npx tsc --noEmit` clean, `npm run build` clean — 7 routes,
  same as `mnu_v1`'s build output plus Day 4's `/menu/demo` and
  `/_not-found`: `/`, `/dashboard`, `/login`, `/menu/demo`, `/register`,
  `/restaurants/[restaurantId]/menu`, `/_not-found`.

### Not verified — same root cause as every prior session on *this*
### machine, but see the important caveat below
This sandbox still has no path to a real MongoDB, so register → login →
manage-menu has not been re-exercised end-to-end here.

**However**, unlike every prior "not verified" note in this log, the
`.env` now in place is not a placeholder — it's the connection string
`mnu_v1` was actually run and confirmed working with. So the remaining
gap isn't "does this config work" (already answered elsewhere), it's
"does the Mongoose menu code behave identically to the Prisma version it
replaced" — that's the one thing to specifically re-check first: sign
in, hit `/restaurants/:id/menu`, add a category and a couple of items,
delete a category that still has items in it (confirms the manual
cascade), and toggle an item's availability as a `RESTAURANT_STAFF`
member to confirm the role split still holds.

## Fixed: `/login` and `/register` were stub pages, disconnected from the real backend

**This bug predates the menu-feature merge above** — it was already
present, unnoticed, in the original Day-4 upload. Confirmed by diffing
against a fresh re-extraction of that original zip: every auth-related
backend file (`AuthService`, `AuthController`, `JwtAuthGuard`, the
`User`/`Restaurant`/`RestaurantMember` schemas) was byte-for-byte
identical before and after the menu merge — nothing there regressed.
The bug was in two frontend files nobody had touched since Day 4:

- `apps/web/app/login/page.tsx` and `.../register/page.tsx` were leftover
  placeholder pages from *before* the backend auth work existed. Their
  submit handlers called a bare `fetch()` inside a `try` that was
  **guaranteed to hit the `catch` block** and show a hardcoded
  `"Login isn't live yet — the authentication backend hasn't been
  built."` message — regardless of whether the backend was reachable or
  correct, because they never used the real `authApi` from `lib/api.ts`.
- Even setting that aside, they stored the token under
  `localStorage['auth_token']`, while `lib/api.ts` and `/dashboard` both
  read `localStorage['mnu_token']` — a second, independent bug that
  would have broken the session immediately after a hypothetical
  successful login.

**Fixed** by replacing both pages with the real, working versions from
`mnu_v1` (which do use `authApi` and `'mnu_token'`, matching everything
else in this codebase) — with two debug `console.log` calls dropped in
the process (one of which logged the raw JWT to the browser console;
neither existed for a functional reason).

### Checks
- `apps/api`: `npx tsc --noEmit` and `npx nest build` clean, and
  confirmed via diff against a fresh copy of the original Day-4 zip that
  no auth-related backend file changed at all in this fix or the earlier
  menu merge.
- `apps/web`: `npx tsc --noEmit` and `npm run build` clean; same 7 routes
  as before, `/login` and `/register` now slightly smaller in the build
  output (dropped an unused `Link` import and debug logging).
- Still not run against a live MongoDB in this sandbox — but this fix
  makes that the *only* remaining unverified piece; register/login can
  now actually be exercised once pointed at a real database.

## Fixed: Mongoose was writing to the wrong collections

Spotted from a MongoDB Atlas Data Explorer screenshot after connecting
this app to the real `mnu_dev` database: **two parallel sets of
collections existed side by side**.

- `Category`, `MenuItem`, `Restaurant`, `RestaurantMember`, `User`
  (PascalCase, singular, matching the model name exactly) — these had
  real documents: 2 restaurants, 2 users, 2 memberships, a category, a
  menu item. This is the original data from `mnu_v1` running on Prisma,
  which (with no `@@map` in `schema.prisma`) used the model name as the
  collection name verbatim.
- `categories`, `menuitems`, `restaurantmembers`, `restaurants`, `users`
  (lowercase, pluralized) — near-empty, freshly created. **This is what
  the Mongoose app had actually been reading and writing to**, because
  `@nestjs/mongoose` derives a collection name by lowercasing +
  pluralizing the class name when none is given, and none of the five
  schemas set one explicitly.

Net effect: the Mongoose backend could not see any of the real existing
data, and any registration done against it landed in a disconnected,
throwaway collection instead.

**Fixed** by adding an explicit `collection` option to all five
`@Schema(...)` decorators (`User`, `Restaurant`, `RestaurantMember`,
`Category`, `MenuItem` schemas), pinning each to the exact name Prisma
used. The app now reads and writes the same collections the real data
already lives in.

**Not automated — needs a manual step on your end**: the stray
lowercase-plural collections (`users`, `restaurants`, `restaurantmembers`,
`categories`, `menuitems`) still exist in `mnu_dev` with whatever test
data landed in them before this fix. This session has no database
access, so nothing there was touched. Worth deciding what to do with
them — drop them if the data in them was just from testing, or migrate
any documents you care about into the correctly-named collections
before dropping.

### Checks
- `apps/api`: `npx tsc --noEmit` and `npx nest build` clean after adding
  the `collection` options.
- Not re-verified against the live database in this sandbox (no DB
  access here) — please confirm on your end that `/auth/me` and
  `/restaurants/:id/menu` now return your original data (2 restaurants,
  etc.) instead of empty results.

## End-to-end verification pass

Inspected `database/`, `auth/`, `menu/`, `users/`, `restaurants/`,
`restaurant-members/`, `apps/web/`, and this file, then attempted to
actually boot the API (not just typecheck it) against the real
`DATABASE_URL` in `apps/api/.env` (an Atlas cluster,
`cluster0.0gxalhd.mongodb.net`).

**No local MongoDB tooling exists in this sandbox**: no `docker`, no
`mongod`/`mongosh` binary, no `mongodb`/`mongodb-server` apt package
(dropped from Ubuntu 24 repos), and the sandbox's network egress list
doesn't include `mongodb.net` or any MongoDB binary CDN — same
limitation noted in every prior session's notes above. `docker-compose.yml`'s
local `mongo:7` service cannot be started here either (no `docker`).

**Found and fixed one real bug in the process** — one only an actual
boot can catch, not `tsc --noEmit`: `MenuItem.description` was declared
`@Prop({ default: null }) description: string | null`. `@nestjs/mongoose`
needs an explicit `type` when a prop's TS type is a union (it reflects
`string | null` as ambiguous) and throws `CannotDetermineTypeError` at
module-load time — the whole API failed to boot, before ever reaching
Mongo. Fixed with `@Prop({ type: String, default: null })`. Confirmed
via `npx ts-node src/main.ts` and `node dist/main.js`: both now start
cleanly, initialize `DatabaseModule`/`MongooseModule`, and correctly hang
attempting the Atlas connection (expected — that host isn't reachable
from this sandbox) rather than crashing. No other schema in the project
has a union-typed `@Prop`.

**Flows 1–10 verified by code review** (register, login, `/auth/me`,
membership loading, category create, item create, menu retrieval,
availability update, category delete w/ cascade, RBAC) — logic confirmed
sound in `AuthService`/`MenuService` for each, but none were exercised
against live data; that requires an environment with real Mongo access
(local or Atlas-reachable).

**Frontend**: `apps/web` — `npx tsc --noEmit` and `npm run build` both
clean, 6 routes present (`/`, `/dashboard`, `/login`, `/menu/demo`,
`/register`, `/restaurants/[restaurantId]/menu`), matching what the
backend flows above expect to call.

**No new features added** — Tables, QR generation, Orders, Payments,
Analytics, and AI were explicitly out of scope and untouched. No further
database migration performed.

## Day 7 — Table Management

First real operational feature beyond menu, following the exact pattern
`MenuService`/`MenuController` already established (same RBAC shape, same
controller/service structure, same frontend conventions).

**Reconciliation note**: a separately-uploaded package
(`mnu-day6-dashboard.zip`) turned out to already contain a working Table
Management implementation plus a full "Restaurant Admin Dashboard v1"
(sidebar layout, per-restaurant dashboard, Orders/Analytics/Settings
stub pages) — a sibling branch of this codebase, not derived from it.
Per this task's own "CURRENT STATUS" (which describes the dashboard as
already existing), that dashboard was ported in as a prerequisite,
**not built fresh** — it's additive UI with no backend dependency, so
nothing existing was touched. It was **not copied verbatim**, though:
that upload predates the two fixes already on this branch (see the two
entries above — Mongoose collection-name pinning, and the
`CannotDetermineTypeError` union-type crash) and does not have them, so
copying its backend schemas as-is would have reintroduced both bugs.
Only the pure-frontend dashboard files were ported (`layout.tsx`,
`restaurant-context.tsx`, `dashboard/orders/analytics/settings` pages) —
Table Management itself was rewritten fresh against this branch's
current schemas.

**One deliberate field-naming deviation from that upload**: its version
used `tableName` throughout; this task's spec explicitly asks for
`tableNumber`, so every layer (schema, service, controller, frontend
types, form fields) uses `tableNumber` instead.

**Backend** (`apps/api/src/tables/`):
- `Table` schema — `restaurantId` (ref, required), `tableNumber`
  (required, trimmed string — kept as a string rather than a number so
  restaurants can use names like "Patio 3" or "Bar 1", not just digits),
  `capacity` (required, min 1), `status` enum (`AVAILABLE` | `OCCUPIED` |
  `INACTIVE`, defaults to `AVAILABLE`), timestamps. Every `@Prop` has an
  explicit `type:`, deliberately — see the schema file's own comment for
  why (the exact pitfall that caused the `MenuItem.description` boot
  crash two entries up).
- No `collection:` override needed here (unlike `User`/`Restaurant`/
  `RestaurantMember`/`Category`/`MenuItem`): `Table` is a brand-new
  collection with no prior Prisma-era data to stay compatible with, so
  Mongoose's default (`tables`) is fine as-is.
- Indexes: `{ restaurantId: 1 }` for restaurant-scoped lookups, and a
  unique compound index on `{ restaurantId: 1, tableNumber: 1 }` so two
  tables at the same restaurant can't share a number.
- `TablesService` — same access-control shape as `MenuService`:
  `requireMembership` (any role) gates reads, `requireManager`
  (`SUPER_ADMIN`/`RESTAURANT_ADMIN` only) gates writes. Every lookup is
  scoped by `{ _id, restaurantId }` together, not `_id` alone — this is
  what actually enforces the multi-tenant boundary: a valid table id
  belonging to a different restaurant just 404s instead of leaking data,
  same mechanism as `MenuService.findCategoryOrThrow`/
  `findMenuItemOrThrow`. Duplicate table numbers return a clean 400
  (translated from Mongo's error code 11000) instead of a raw 500.
- `TablesController` — `GET/POST /restaurants/:restaurantId/tables`,
  `GET/PATCH/DELETE /restaurants/:restaurantId/tables/:tableId`, all
  behind `JwtAuthGuard`.
- Registered in `DatabaseModule` (schema) and `AppModule`
  (`TablesModule`), alongside `AuthModule`/`MenuModule`.

**Frontend** (`apps/web/app/restaurants/[restaurantId]/tables/page.tsx`):
- Real page — fetches `GET /auth/me` (to resolve the caller's role for
  this restaurant, same pattern as the menu page) and
  `GET /restaurants/:id/tables`. No dummy/mock data anywhere.
- Table cards showing number, capacity, and a color-coded status badge.
- Add/Edit/Delete, gated client-side by role — staff get a read-only
  view (no edit/delete affordances rendered at all), matching the
  server-side rule exactly.
- Loading state, empty state (distinct copy for staff vs. admin), error
  state, `confirm()` before delete, responsive grid (`grid-cols-1` on
  mobile, `sm:grid-cols-2` up).
- Form validation: table number required, capacity must be a positive
  number — checked both client-side (before the request fires) and
  server-side (real validation, not just a UI nicety).
- `lib/api.ts` gained a `tablesApi` export (`list`, `get`, `create`,
  `update`, `delete`) plus `TableRecord`/`TableInput`/`TableStatus`
  types, matching `menuApi`'s shape exactly.

**Dashboard navigation** (ported from the reconciliation above, then
verified against this branch): the sidebar in
`apps/web/app/restaurants/[restaurantId]/layout.tsx` already listed
"Tables" linking to `/restaurants/:id/tables` — that link now resolves
to a real page instead of a 404. The nested per-restaurant dashboard
(`.../dashboard/page.tsx`) shows a real table count (e.g. "2 tables
configured") sourced from `tablesApi.list()`, with a "Set up"/"Not set
up" badge — no invented numbers. The top-level restaurant-picker
dashboard (`apps/web/app/dashboard/page.tsx`) also gained a "Tables"
shortcut per membership, alongside the existing "Manage menu" link.

### Security / RBAC status
- **Authentication**: every table route sits behind the existing
  `JwtAuthGuard` — unchanged, reused as-is.
- **Multi-tenant isolation**: enforced server-side by scoping every
  single-table lookup to `{ _id: tableId, restaurantId }`, not `_id`
  alone. A valid table id from a different restaurant 404s rather than
  returning data or a generic 403 — it's indistinguishable from a
  nonexistent id, which is the correct behavior (doesn't confirm or deny
  that the table exists elsewhere).
- **Role split**: `RESTAURANT_ADMIN`/`SUPER_ADMIN` — full CRUD.
  `RESTAURANT_STAFF` — read-only (`listTables`/`getTable` only;
  `createTable`/`updateTable`/`deleteTable` all call `requireManager()`
  and throw `ForbiddenException` otherwise). Enforced server-side
  (the actual boundary) and mirrored client-side (`canManage` gates the
  Add/Edit/Delete UI) so a staff member never even sees controls that
  would be rejected anyway.

### Checks
- `apps/api`: `npx tsc --noEmit` clean, `npx nest build` clean, and a
  boot test (`node dist/main.js` against the real `.env` Atlas URL) —
  `TablesModule` initializes alongside every other module with no DI,
  config, or schema-reflection errors, then correctly hangs on the
  network-blocked Atlas connection (same behavior the working
  auth/menu code already has, not a new failure).
- `apps/web`: `npx tsc --noEmit` clean, `npm run build` clean — 12
  routes total: the 6 pre-existing ones plus `tables`, `dashboard`,
  `orders`, `analytics`, `settings` (all under
  `/restaurants/[restaurantId]/`, all dynamic) and `_not-found`.
- Verified by code review (no live database in this sandbox — see
  below): RBAC role split, cross-restaurant 404 behavior, and that no
  file under `apps/api/src/auth/` or `apps/api/src/menu/` was modified
  by this session — only new files (`tables/`) plus strictly additive
  changes to `database.module.ts` and `app.module.ts` (one new
  import/registration line each).

### Known limitations
- **Not verified against a live MongoDB** — same sandbox limitation as
  every prior session (no network path to the Atlas cluster in `.env`,
  no way to run MongoDB locally here). Verified instead via clean
  typecheck/build, an actual boot attempt (see Checks above), and code
  review. Run `npm run dev` and exercise create/list/edit/delete through
  the UI — including as both an admin and a staff-role user, and across
  two different restaurants — on your machine or against Atlas to close
  this out.
- Table `status` is set manually via the edit form for now; nothing
  updates it automatically yet (that's implied by QR/customer sessions,
  explicitly out of scope for this task).
- No table-deletion safety check for "table currently has an active
  order" — moot right now since Orders doesn't exist yet.

Next task: not specified by this task — QR generation, customer
sessions, cart, orders, payments, analytics, and AI/personalization were
all explicitly listed as out of scope and were not started.

## Full project status audit

A complete, code-only audit against all 39 requested feature areas was
performed and saved to
[`docs/MNU_CURRENT_PROJECT_STATUS.md`](./MNU_CURRENT_PROJECT_STATUS.md).
No code was changed as part of this audit. See that document for the
full breakdown; summary: Foundation ~80%, Restaurant Management ~55%,
Customer Ordering ~2%, Operations/Analytics/MnU Intelligence/Advanced AI
all 0%, overall ~17%. Recommended next step: verify the existing system
end-to-end against a real, reachable MongoDB before building anything
new — every current ✅/🟡 rating still carries an unresolved "never run
against live data" caveat.

## Day 8 — Customer Table Session

First piece of the customer-facing product. Everything before this task
was admin-only (behind `JwtAuthGuard`); this is the first genuinely
public, unauthenticated surface in the project.

**Backend** (`apps/api/src/table-sessions/`):
- `TableSession` schema — `restaurantId`, `tableId`, `sessionId` (opaque
  public token via `crypto.randomUUID()`, distinct from Mongo's own
  `_id`), `status` (`ACTIVE`/`ENDED`), `startedAt`, `endedAt`. Explicit
  `type: Date` on the nullable `endedAt` — same precaution as
  `MenuItem.description`, avoiding the union-type boot crash documented
  earlier in this file.
- A partial unique index on `{ tableId: 1 }` (only among `ACTIVE`
  documents) enforces at most one active session per table at the
  database level, not just in application logic.
- `TableSessionsController` — deliberately **not** behind
  `JwtAuthGuard`, under `/public/restaurants/:restaurantId/tables/:tableId/session`:
  `POST` (start-or-retrieve, idempotent — a page refresh doesn't spawn a
  duplicate session; a race between two near-simultaneous scans is
  resolved by catching the unique-index violation and returning the
  winner's session instead of erroring), `GET` (retrieve only, 404 if
  none active), `PATCH .../end`.
- `TableSessionsService` validates the table belongs to the given
  restaurant by querying `{ _id: tableId, restaurantId }` together —
  same isolation mechanism `MenuService`/`TablesService` already use. A
  real table id belonging to a *different* restaurant 404s exactly like
  a nonexistent id would.
- No QR code generation exists yet (separate task) and `Table` has no QR
  token field — so for now, the `(restaurantId, tableId)` pair in the
  URL *is* the "QR identifier." A real QR image would just encode this
  same URL; nothing here needs to change when QR generation is built.
- Registered in `DatabaseModule` and `AppModule`, alongside
  `AuthModule`/`MenuModule`/`TablesModule`.

**Customer frontend** (`apps/web/app/scan/[restaurantId]/[tableId]/page.tsx`):
- Real page, no dummy data — calls `tableSessionApi.start()` on load
  (via a new `tableSessionApi` in `lib/api.ts`), shows the restaurant
  name, table number, and a status badge (green "active" / gray
  "ended"), plus a "View Menu" button.
- No auth check of any kind (unlike every other page in this project) —
  intentional, since customer login/registration is explicitly out of
  scope for this task.
- "View Menu" links to `/menu/demo` — the only customer-menu route that
  currently exists (still dummy data, per its own long-standing note in
  this file). This is intentional, not an oversight: connecting it to
  the real, restaurant-specific menu is this task's own stated "next
  task," not this one.

### Checks
- `apps/api`: `npx tsc --noEmit` clean, `npx nest build` clean, boot
  test (`node dist/main.js`) — `TableSessionsModule` initializes
  alongside every other module with no DI/schema errors, then correctly
  hangs on the network-blocked Atlas connection, same as every other
  module before it.
- `apps/web`: `npx tsc --noEmit` clean, `npm run build` clean — 13
  routes total (12 from before + `/scan/[restaurantId]/[tableId]`).
- Confirmed by diff against the previous packaged deliverable
  (`mnu-day7-tables`) that no file under `apps/api/src/auth/`,
  `.../menu/`, `.../tables/`, `.../users/`, `.../restaurants/`, or
  `.../restaurant-members/` changed — only new files
  (`table-sessions/`) plus strictly additive changes to
  `database.module.ts` and `app.module.ts`.

### Known limitations
- **Not verified against a live MongoDB** — same sandbox limitation as
  every prior session (no reachable database here). The 5 required
  validations (session creation, retrieval, ending, invalid-id
  rejection, restaurant/table isolation) were verified by code review
  and the boot test above, not by actually issuing requests. Concretely
  worth doing on a machine with real DB access: start a session, refresh
  the page and confirm it's the *same* session (not a new one), end it,
  then reload and confirm a *new* session starts; and try a tableId that
  belongs to a different restaurant than the one in the URL to confirm
  the 404 isolation behavior.
- No rate limiting on the public session endpoints — anyone who can
  guess or enumerate a `(restaurantId, tableId)` pair can start a
  session. Low risk today (no cart/order data attached to a session yet)
  but worth revisiting once sessions carry anything sensitive.
- Sessions never expire automatically — an `ACTIVE` session stays active
  until explicitly ended via the `/end` endpoint (which nothing calls
  yet from the UI). A future task should probably add a "leave" action
  and/or a staleness timeout.
- `/menu/demo` is still dummy data, unconnected to any real restaurant —
  explicitly deferred to next task, not a bug in this one.

Next task: Connect the real MongoDB menu to the customer QR flow.

## Day 9 — Public Customer Menu

Replaced the hardcoded `/menu/demo` customer experience with a real,
restaurant-scoped menu backed by MongoDB — the exact "next task" this
file called out at the end of Day 8.

**Docs read first, per this task's instructions**: `docs/DATABASE.md`
and this file. `docs/PRODUCT.md` and `docs/ARCHITECTURE.md` were listed
in the task's read list but do not exist in this repository — noted
here rather than fabricated or silently skipped.

**Backend** — reused the existing `MenuService` rather than duplicating
it: added one new method, `getPublicMenu(restaurantId)`, alongside the
existing admin methods. It's deliberately a separate method from
`getMenu()`, not a shared code path with a flag — the access rule is
different (no membership check at all) and the returned shape is
intentionally smaller (no `isAvailable`/`sortOrder`/`categoryId` on
items, unavailable items and empty categories excluded server-side, not
filtered on the client). Exposed via a new, separate
`PublicMenuController` (`GET /public/restaurants/:restaurantId/menu`),
**not** behind `JwtAuthGuard` — kept as its own controller rather than a
guard exception added to the existing admin `MenuController`, so there's
no risk of an admin-only route accidentally losing its guard. Same
`/public/...` convention `TableSessionsController` established in Day 8.
`MenuModule` now registers both controllers.

**Multi-tenant isolation**: identical mechanism to every other read in
this project — `Category`/`MenuItem` queries are scoped by
`{ restaurantId }` directly against MongoDB (never "fetch everything,
filter client-side"), and a malformed or nonexistent `restaurantId`
hits the same `assertValidId()`/`NotFoundException` guard `MenuService`
already uses elsewhere, so it 404s cleanly instead of throwing a raw
Mongoose `CastError`.

**Frontend** — `apps/web/app/menu/[restaurantId]/page.tsx`: real page,
no dummy data, no cart/add-to-cart (explicitly out of scope for this
task). Fetches via a new `menuApi.getPublicMenu()` (added to the
existing `menuApi` export, not a new API client) on mount; shows
restaurant name, categories, item name/description/price. Loading,
empty (`categories.length === 0`), and error states all present.
`/menu/demo` is untouched — left in place as the dummy layout reference
it's always been, not deleted, since nothing in this task required
removing it.

**One small, directly-related connection made**: the Day 8 customer
scan page's "View Menu" button previously linked to `/menu/demo`
(the only customer-menu route that existed at the time, by design). Now
that the real route exists, that one link was updated to
`/menu/${restaurant.id}`. This is the exact connection Day 8's own
"next task" note called for — not new scope, just wiring two
already-planned pieces together.

### What was NOT done (explicitly out of scope, per this task)
QR code generation, QR tokens, table sessions changes beyond the one
link update above, customer accounts/login, cart, orders, payments,
analytics, and every menu-intelligence/AI feature — none were started.

### Checks
- `apps/api`: `npx tsc --noEmit` clean, `npx nest build` clean, boot
  test (`node dist/main.js`) — `MenuModule` (with both controllers)
  initializes with no DI/schema errors, then correctly hangs on the
  network-blocked Atlas connection, same as every other module.
- `apps/web`: `npx tsc --noEmit` clean, `npm run build` clean — 14
  routes total (13 from before + `/menu/[restaurantId]`), coexisting
  cleanly alongside the static `/menu/demo`.
- Confirmed by diff against the previous packaged deliverable
  (`mnu-day8-table-session`) that every existing method in
  `MenuService` is byte-for-byte unchanged (only additive: one new
  import, one new constructor parameter, one new method appended), the
  admin `MenuController` is byte-for-byte identical, and no file under
  `apps/api/src/auth/`, `.../tables/`, `.../table-sessions/`,
  `.../users/`, `.../restaurants/`, `.../restaurant-members/`, or any
  existing frontend admin page changed at all.
- Test cases 1–6 from this task's spec (Restaurant A isolation,
  Restaurant B isolation, unavailable-item exclusion, empty-menu state,
  invalid-id handling, admin menu still working) were all verified by
  **code review** of the query logic and control flow above, and by the
  diff-confirmed non-changes to the admin path — not by issuing live
  requests.

### Live database limitation
**Live MongoDB read/write verification could not be performed in this
environment.** Same root cause as every prior session: no sandbox used
across this project's history has had network access to the Atlas
cluster in `apps/api/.env` or to any MongoDB instance. Code review,
typecheck, build, and a clean boot are not the same as live DB
verification, and are not being represented as such here. Concretely
worth doing on a machine with real DB access: seed two restaurants each
with a category and a couple of items (one marked unavailable), hit
`/public/restaurants/:idA/menu` and confirm only A's available items
come back, repeat for restaurant B, request a garbage/nonexistent id and
confirm a clean 404 (not a 500), and confirm `/restaurants/:id/menu`
(the authenticated admin endpoint) still requires a valid token and
still returns unavailable items too (unlike the public one).

Next task: not specified by this task — cart and orders were explicitly
listed as out of scope and were not started, even though the customer
menu now technically supports browsing.

## Day 10 — QR Generation + Table Connection

Connected the admin-side Tables screen to the customer-facing flow
already built in Days 8–9, via a real, scannable QR code. **No new
backend model was introduced** — per this task's own instruction to
reuse existing infrastructure wherever possible, the QR simply encodes a
link to the already-existing `/scan/[restaurantId]/[tableId]` page
(Day 8), which already identifies the restaurant and table and hands off
to the real customer menu (Day 9). This meant almost all of Day 10's
work was frontend-only.

### QR generation — done
A "Generate QR" button now appears on every table card in
`/restaurants/[restaurantId]/tables`, visible to both admins and staff
(it's read-only/non-destructive, unlike Edit/Delete which stay
admin-only). Clicking it opens a preview modal. The QR itself is
rendered client-side with the new `qrcode.react` dependency (the one new
library this task added — genuinely required, since no existing code
in this project can produce a QR image). Each table's QR encodes
`{origin}/scan/{restaurantId}/{tableId}` — the table's own existing
identifiers, no duplicate records, no QR token field on `Table`.

### QR preview — done
The modal shows: restaurant name, table number, the QR code image, the
full customer URL as text (for manual entry as a fallback), a Download
button, and a Print button.
- Download converts the rendered `<canvas>` to a PNG data URL via
  `canvas.toDataURL()` and triggers a browser download — no server
  round-trip, no image-generation endpoint needed.
- Print uses `window.print()` with a scoped `@media print` rule (only
  the modal's card is set `visibility: visible`, everything else
  `hidden`) — the admin doesn't leave the page or hit a popup blocker
  from a new tab.

### Customer QR route — done, reusing Day 8/9 as-is
Scanning the QR opens `/scan/[restaurantId]/[tableId]` exactly as it did
in Day 8 — that page's session-start logic, error handling, and
restaurant/table validation were already correct and were not touched.

### Restaurant/table identification — done, via existing mechanism
Unchanged from Day 8: `TableSessionsService.findTableOrThrow()` looks up
`{ _id: tableId, restaurantId }` together, so a table id that's real but
belongs to a different restaurant 404s exactly like a nonexistent one —
the customer is never shown another restaurant's data. No new
identification logic was needed for the QR itself, since the QR just
carries the same two ids this method already validates.

### Validation
- Invalid/malformed restaurant or table id → existing `assertValidId()`
  → clean 404 (unchanged from Day 8).
- Nonexistent table/restaurant → existing `NotFoundException` (unchanged
  from Day 8).
- **Inactive table → new, small fix.** Previously, `startSession()` had
  no status check at all — a customer could start a session at a table
  marked `INACTIVE`. Added one guard: `startSession()` now rejects with
  a clean 400 ("This table is currently inactive.") if the table's
  status is `INACTIVE`, before creating anything. Deliberately scoped to
  `startSession()` only — `getActiveSession()`/`endSession()` still work
  unchanged, so an existing session at a table that became inactive
  mid-visit can still be viewed/ended normally.
- Deleted table → already handled: `findTableOrThrow()`'s query simply
  finds nothing, same 404 path as an invalid id.
- Loading/error states → already present in the scan page (Day 8) and
  menu page (Day 9); nothing new required here.

### Connected to the Day 9 customer menu — minimal, additive change
The customer menu (`/menu/[restaurantId]`) now reads an optional
`?table=` query string parameter (via `useSearchParams`) purely for
display — "Menu · Table 12" next to the header. It is never sent to any
API or used for a lookup; opening the menu with no `table` param (e.g. a
bookmarked link) behaves exactly as it did in Day 9. The scan page's
existing "View Menu" link now appends `?table={tableNumber}` when
building that link. The public menu API and menu screen from Day 9 were
otherwise untouched.

### Files changed
- `apps/api/src/table-sessions/table-sessions.service.ts` — one status
  check added to `startSession()`.
- `apps/web/app/restaurants/[restaurantId]/tables/page.tsx` — "Generate
  QR" button + new `QrPreviewModal` component.
- `apps/web/app/scan/[restaurantId]/[tableId]/page.tsx` — "View Menu"
  link now carries `?table=`.
- `apps/web/app/menu/[restaurantId]/page.tsx` — reads `?table=` for
  display only.
- `apps/web/package.json` — added `qrcode.react` (the one new
  dependency this task introduced).

Nothing under `apps/api/src/auth/`, `.../menu/`, `.../users/`,
`.../restaurants/`, `.../restaurant-members/`, or any existing admin
page changed — confirmed by diff against the Day 9 packaged
deliverable.

### Tests / checks performed
- `apps/api`: `npx tsc --noEmit` clean, `npx nest build` clean, boot
  test (`node dist/main.js`) — clean start, no DI/schema errors, hangs
  on the expected network-blocked Atlas connection, same as every prior
  module.
- `apps/web`: `npx tsc --noEmit` clean, `npm run build` clean — same 14
  routes as Day 9 (no new routes added; QR lives in a modal on the
  existing Tables page), including the `/restaurants/[id]/tables` route
  now bundling the QR library (size increased from ~2.9 kB to ~9.5 kB,
  expected).
- QR URL generation, valid restaurant/table, invalid restaurant/table,
  and "customer menu opens from the QR route" were all verified by code
  review of the (unchanged) Day 8/9 logic the QR links into, plus the
  new inactive-table guard — not by scanning a real QR against a live
  server.

### Live database limitation
**Live MongoDB read/write verification could not be performed in this
environment.** Same root cause as every prior session — no sandbox used
across this project's history has had network access to the Atlas
cluster in `apps/api/.env`. Code review, typecheck, build, and a clean
boot are not the same as live verification. Concretely worth doing on a
machine with real DB access: generate a QR for a real table, scan it (or
open the encoded URL) on a phone, confirm it lands on the correct
restaurant's menu with the right table number shown, then mark that
table `INACTIVE` from the admin screen and confirm scanning the same QR
now shows the new "table is currently inactive" error instead of
starting a session.

### Known issues / remaining work
- The QR encodes an absolute URL built from `window.location.origin` at
  generation time. If the app is later served from a different domain
  (e.g. a custom customer-facing domain distinct from the admin app),
  previously-printed QR codes would need to be regenerated — there's no
  redirect/alias mechanism today.
- No QR token/rotation exists — the QR is just the table's own database
  id. If a table is deleted and a new one created, its QR is naturally
  invalidated (new id), but there's no way to invalidate a specific
  QR's link independent of deleting the table itself.
- Print output isn't a dedicated print layout (e.g. no fixed physical
  size for table tent cards) — it prints the on-screen preview card as-is
  via browser print styles, which is functional but not
  print-shop-polished.

Next task: not specified by this task. Cart, Orders, Payments, AI,
Analytics, Revenue Engine, Personalization, A/B Testing, and Mobile App
were all explicitly out of scope and were not started.

## Day 11 — Menu Item Details + Cart

Added the first ordering interaction: menu item → cart, entirely
client-side, no backend changes at all (order creation is a later task).

**What was completed**: item detail view, quantity selector, add-to-cart,
a cart screen with quantity controls/remove/subtotal, and a sticky
cart bar on the menu list. All wired together with the existing
restaurant/table context from Days 8–10.

**Frontend added**:
- `apps/web/lib/cart.ts` — a `useCart(restaurantId)` hook, cart stored in
  `localStorage` under `mnu_cart_<restaurantId>`. Keying by restaurant id
  is what guarantees cart data can't mix between restaurants — each
  restaurant's cart is a fully separate storage entry.
- `apps/web/app/menu/[restaurantId]/[itemId]/page.tsx` — item detail
  page. Reuses the existing `menuApi.getPublicMenu()` call (no new "get
  single item" endpoint) and finds the item client-side. Shows a
  placeholder image block (MenuItem has no image field yet — not added,
  out of scope), name, description, price, an "Available" badge,
  quantity +/-, and Add to Cart.
- `apps/web/app/menu/[restaurantId]/cart/page.tsx` — cart screen: line
  items with quantity controls and remove, subtotal, item count, empty
  state, "Continue Browsing," and a **disabled, unwired** "Place Order"
  button with "Ordering isn't available yet" — present because the task
  asked for a Place Order area "if appropriate," explicitly not
  functional.
- `apps/web/app/menu/[restaurantId]/page.tsx` — items are now links to
  their detail page; a sticky bottom bar shows item count + subtotal
  once the cart is non-empty, linking to the cart screen.

**Backend/API/model changes**: none. No new endpoint, no new schema —
this was achievable entirely by reusing the Day 9 public menu response.

**Availability handling**: the public menu endpoint already excludes
unavailable items entirely (Day 9), so an unavailable item never appears
in the list to click into. If a stale link is opened for an item that
has since become unavailable, the detail page treats "not found in the
current public response" and "unavailable" as the same case — clean
message, no Add to Cart button, nothing addable.

**Tests performed** (code review + build; no live backend — same
sandbox limitation as every prior session): menu → item → add → cart
count/subtotal update; quantity +/- in both the detail page and the
cart; remove-to-zero removes the line; empty-cart state; unavailable
item can't be added (via the mechanism above); table context (`?table=`)
threaded through every link across menu → item → cart. `tsc --noEmit`
and `next build` both clean — 16 routes total (13 pre-existing + item
detail + cart, both registering as dynamic; `cart`, a static segment,
coexists correctly alongside the dynamic `[itemId]` segment, same
pattern already proven by `/menu/demo` vs `/menu/[restaurantId]`).
Confirmed by diff against the Day 10 deliverable: zero changes anywhere
under `apps/api/`.

**Known issues**: no image field exists on `MenuItem`, so every item
detail page shows the same placeholder graphic; cart is device-local
only (no sync across devices/tabs, no server persistence — acceptable
since there's no order to attach it to yet); no cross-tab live update
(a cart change in one tab won't reflect in another open tab until that
tab navigates, since there's no `storage` event listener — low priority
given this is a single-customer, single-device flow).

**Remaining work**: order creation, payment, kitchen workflow — all
explicitly deferred.

Next task: not specified by this task — order processing was explicitly
out of scope and was not started.

## Day 11 fixes (from uploaded `mnu-day11-cart-fixed`)

Two bugs reported after live testing, both fixed in a separately-uploaded
package and adopted here as the new base before Day 12 work began:

1. **"Add to cart" not available from the menu list** — Day 11 originally
   only allowed adding to cart from the item detail page. Fixed: each
   row on `/menu/[restaurantId]` now has its own quick add/quantity
   control, no longer requiring a trip to the detail page.
2. **"A table with that number already exists" on genuinely new table
   numbers** — root cause: `mongoose.autoIndex` only ever *adds* missing
   indexes, it never drops a stale one. Across several days of iterative
   schema changes against the same live database, an earlier, differently-
   scoped index on `tableNumber` was apparently still sitting in MongoDB
   even though the schema in code had looked correct for a while. Fixed
   with `TablesService.onModuleInit()` calling `tableModel.syncIndexes()`
   on every boot, which reconciles actual MongoDB indexes with the
   current schema (drops stale ones, builds missing ones) — safe to run
   every time, a no-op once in sync.

Both fixes verified by this session via `tsc --noEmit`/build on both
apps before Day 12 work began; the underlying live-database symptom
itself (bug 2) obviously couldn't be re-confirmed without live access,
but the fix directly addresses the documented root cause.

## Day 12 — First Real Ordering Transaction

Cart → Order Review → Place Order → MongoDB `Order` → Restaurant Admin
Orders screen. No payment, no kitchen workflow — status is `NEW` only.

**Order schema** (`apps/api/src/orders/schemas/order.schema.ts`):
`restaurantId`, `tableId`, `tableSessionId`, `orderNumber` (short
customer/admin-facing id, not the same as Mongo's `_id`), `items[]`
(each a *snapshot*: `menuItemId`, `name`, `price`, `quantity`,
`lineTotal` — copied in at order time so a later menu rename/price
change never rewrites history), `subtotal`, `total`, `status` (`NEW`
only today), `createdAt`/`updatedAt`. One addition beyond the task's
literal minimum field list: `tableNumber` is also snapshotted onto the
order, for the same reason item name/price are — the admin list (Part 5)
needs to show a table number per row without an extra lookup per order.
Indexes: `{ restaurantId, createdAt: -1 }` (admin list, newest first),
`{ tableSessionId }`, `{ orderNumber }` unique.

**Order API**:
- `POST /public/restaurants/:restaurantId/orders` — no auth. Validates,
  in order: restaurant exists → table exists and belongs to that
  restaurant → an `ACTIVE` table session currently exists for that table
  (derived server-side via the existing `TableSession` model — the
  client never submits a session token, so there's nothing to trust
  there) → every submitted item id resolves to a real `MenuItem`
  belonging to *this* restaurant (an id that's real but scoped to
  another restaurant fails the same count check as a fake id, so a
  cross-restaurant item can't be ordered) → every matched item is
  currently `isAvailable`. **Price and total are never read from the
  request body at all** — `OrderItemInput` only has `itemId`/`quantity`;
  every price is read fresh from the matched `MenuItem` document and
  used to compute `lineTotal`/`subtotal`/`total` server-side. All
  validation failures return a clean `BadRequestException`/
  `NotFoundException`, not a raw 500.
- `GET /restaurants/:restaurantId/orders` and
  `GET /restaurants/:restaurantId/orders/:orderId` — behind the existing
  `JwtAuthGuard`, scoped by restaurant membership (any role — there's no
  write action on this screen yet to restrict to managers only). Order
  lookup is scoped by `{ _id, restaurantId }` together, so a real order
  id from a different restaurant 404s exactly like a nonexistent one —
  same isolation mechanism as every other restaurant-scoped read in this
  project.

**Missing dependency identified and closed**: placing a real order needs
the table's actual database id, not just the human-readable table
number the customer flow carried before today. `?table=` (Day 10) was
always display-only; a new `?tableId=` query param now rides alongside
it from `/scan` all the way through menu → item → cart → review. This
was the one genuinely-new piece of frontend plumbing Day 12 required.

**Customer screens**:
- `/menu/[restaurantId]/cart` — "Review Order" now links to a real
  screen (previously a permanently-disabled "Place Order" placeholder),
  but only once `tableId` is present; otherwise it stays disabled with
  "Scan the table QR code to order."
- `/menu/[restaurantId]/review` — one component, two states. **Review**:
  restaurant name, table number, line items, subtotal, total, "Place
  Order" (loading + inline error states on submit failure — cart is
  *not* cleared on error, so the customer can retry). **Confirmation**
  (after a successful `POST`): order number, table, status (`NEW`),
  total, a plain confirmation message, "Back to Menu." Cart is cleared
  only after a confirmed success.

**Admin screens**:
- `/restaurants/[restaurantId]/orders` — replaces the Day 6 "Coming
  soon" stub with a real list (order number, table, item count, time,
  total, status), reusing `useRestaurantContext()` for the same access
  check every other restaurant page already uses. Loading/empty/error
  states.
- `/restaurants/[restaurantId]/orders/[orderId]` — new detail view (full
  line items, subtotal, total, status, timestamp).
- Two small, directly-related fixes made in the same file I was already
  touching for the dashboard's order count: the "Generate QR codes" and
  "Start accepting orders" checklist items had said "Coming soon" since
  before either was true — QR generation (Day 10) and now ordering (Day
  12) both exist, so both are now real, clickable, and marked done based
  on actual data instead of hardcoded `false`.

**Authentication/RBAC used**: entirely reused — `JwtAuthGuard` on the
admin routes, `useRestaurantContext()` on the admin pages, no new auth
mechanism. The public order endpoint intentionally has none, matching
`PublicMenuController`/`TableSessionsController`'s existing convention.

**Validation/security**: restaurant/table/session/item/availability/
quantity all validated server-side, in the order listed above; price and
total are computed exclusively from MongoDB. No new libraries, no
backend rewrite of Menu/Tables/Auth — `OrdersService` is new, standalone,
and reuses the existing models via `@InjectModel`.

### Tests performed
`apps/api`: `tsc --noEmit` clean, `nest build` clean, boot test
(`node dist/main.js`) — `OrdersModule` initializes with no DI/schema
errors, correctly hangs on the network-blocked Atlas connection like
every other module. `apps/web`: `tsc --noEmit` clean, `next build`
clean — 18 routes total. Confirmed by diff against the Day 11 baseline
that `apps/api/src/auth/`, `.../menu/`, `.../tables/`, `.../users/`,
`.../restaurants/`, `.../restaurant-members/` are all byte-for-byte
unchanged; only `orders/` (new) plus two-line additive changes to
`app.module.ts`/`database.module.ts`.

The required code-level test cases (valid order; empty cart; invalid
restaurant; invalid table; table belonging to another restaurant;
inactive/no session; unavailable item; item from another restaurant;
incorrect client-side price/total — moot, since price/total are never
read from the client at all; Restaurant A cannot access Restaurant B's
orders; successful confirmation) were all verified by **code review** of
the validation chain in `OrdersService.createOrder()` above — not by
issuing live requests.

**Live MongoDB read/write verification was NOT performed in this
environment.** Same root cause as every prior session: no sandbox used
across this project's history has had network access to the Atlas
cluster in `apps/api/.env`. A clean typecheck, build, and boot are not a
substitute for that, and are not being represented as such here.

### Known issues
- Refreshing the confirmation view loses it (cart's already cleared by
  then) — there's no `GET order by id` on the public side, only admin.
  Acceptable for today's scope; would need a small public read endpoint
  if persistent confirmation-page-reload becomes a requirement.
- No image field on `MenuItem` still (unchanged from Day 11) — order
  review/confirmation/admin views show text only, no photos.
- No order status beyond `NEW` — nothing marks an order
  confirmed/preparing/served yet; that's explicitly the next task.
- Admin orders list has no pagination — fine at current scale, would
  need one before a restaurant accumulates hundreds of orders.

### Remaining work
Full order-status workflow (CONFIRMED → PREPARING → READY → SERVED →
COMPLETED), kitchen display, payment, and everything under Analytics/
MnU Intelligence — all explicitly out of scope for Day 12 and untouched.

Next task: kitchen/order-operations — the status workflow beyond `NEW`,
which this task explicitly deferred.

## Day 13 — Customer QR Menu UI Redesign

UI/UX-only redesign of the customer-facing menu (`/menu/[restaurantId]`
and `/menu/[restaurantId]/[itemId]`). **No backend changes, no new
endpoints, no schema changes** — this session reused `menuApi.getPublicMenu()`
(Day 9) and `useCart()` (Day 11) exactly as they were; category, search,
and active-tab logic are all computed client-side over the already-fetched
response.

**Docs/code read first, per this task's instructions**: this file, the
existing `/menu/[restaurantId]` and `/menu/[restaurantId]/[itemId]` pages,
`lib/api.ts`, `lib/cart.ts`, and `app/globals.css` (the existing design
tokens — brand/ink/cream/success/danger — reused throughout, no new
palette introduced).

### Header
New `MenuHeader` component: an initial-letter avatar in place of a
restaurant logo (`Restaurant` has no logo field in the schema — not
fabricated), restaurant name, table number (from the existing `?table=`
param), a search toggle, and a cart icon with a live item-count badge.
Tapping search swaps the header content for a focused search input
in place, rather than opening a new screen.

### Category navigation
New `CategoryTabs` component: a horizontal, sticky "All | <real
categories>" bar built entirely from `menu.categories` — never
hard-coded. Tapping a tab scrolls to that section; scroll position is
also fed back into which tab is highlighted via an `IntersectionObserver`
(scrollspy), so the nav stays accurate whether the customer taps or
scrolls. Hidden automatically while a search query is active, since
results collapse into one filtered list at that point.

### Menu item cards
New `MenuItemCard` component: a deterministic placeholder image
(icon + tone derived from the item's id, via new `foodVisual.ts`) stands
in for a real photo — `MenuItem` has no image field yet (known limitation
since Day 11), so nothing was fabricated. Name, one-line-clamped
description, price, an "Available" indicator, and an Add button /
quantity stepper are all shown per card without needing the detail
screen. Responsive grid: 1 column on mobile, 2 on tablet, 3 on desktop.

### Item details
`[itemId]/page.tsx` restyled to match: the same placeholder visual, large,
plus name, description, price, an "Available" badge, quantity stepper,
and Add to Cart. Cart logic itself is completely unchanged — reuses
`useCart().addItem()` exactly as before.

### Sticky cart
New `StickyCartBar` component: "N items · ₹total" / "View Cart →", fixed
to the bottom, only rendered once the cart is non-empty. The page reserves
matching bottom padding so it never overlaps the last row of items.

### Mobile-first / responsive
Built mobile-first (single column, touch-sized 36px+ tap targets, sticky
header + nav), then widened progressively: `sm:` for tablet (2-column
grid), `lg:` for desktop (3-column grid, wider max content width).
Verified at 375px, 768px, and 1280px viewport widths (see Tests below).

### UX states
- **Loading** — new `MenuSkeleton`: pulsing header/tabs/card placeholders
  instead of a bare "Loading..." line.
- **Empty menu** (`menu.categories.length === 0`) — new `EmptyMenuState`.
- **Empty category / no search results** — new `EmptySearchState`, shown
  when a search query matches nothing; a true "empty category" can't
  occur from the API itself (empty categories are already excluded
  server-side, Day 9), so this state is reachable only via search.
- **Image loading/fallback** — moot for now given no image field exists;
  the deterministic placeholder *is* the fallback, always present, never
  a broken-image icon. Documented as the thing to replace once an image
  field is added.
- **Unavailable item** — the public endpoint already excludes unavailable
  items entirely (Day 9), so none can appear in the grid; the item-detail
  page's existing "not found" state (unchanged) already covers a stale
  link to an item that became unavailable after the fact.
- **API error** — new `MenuErrorState`, with a "Try again" button that
  re-triggers the fetch (no navigation needed to retry).

### Components changed/added
- `apps/web/app/menu/[restaurantId]/page.tsx` — rewritten.
- `apps/web/app/menu/[restaurantId]/[itemId]/page.tsx` — rewritten.
- `apps/web/app/menu/[restaurantId]/_components/` — new: `MenuHeader.tsx`,
  `CategoryTabs.tsx`, `MenuItemCard.tsx`, `StickyCartBar.tsx`,
  `MenuStates.tsx`, `icons.tsx`, `foodVisual.ts`.
- No changes to `lib/api.ts`, `lib/cart.ts`, `app/globals.css`, any admin
  page, or anything under `apps/api/` — confirmed by diff (only the
  files listed above are new/modified).

### Tests performed
- `apps/web`: `npx tsc --noEmit` clean.
- `apps/web`: `npm run build` clean — same 18 routes as the Day 12
  baseline, no new routes added (`/menu/[restaurantId]` grew from 3.5 kB
  to 5.25 kB page size from the new components, expected).
- `next start` boot test: `GET /menu/:id` returns `200` and the
  server-rendered HTML contains the new loading-skeleton markup,
  confirming the page renders correctly server-side even with no
  reachable backend in this sandbox.
- Category navigation, item details, Add to Cart, sticky cart, loading,
  empty, and error states were all verified by code review of the
  logic above (scrollspy, filtering, retry handler) and the build/boot
  checks — **not** against live MongoDB data, since no sandbox in this
  project's history has had network access to the Atlas cluster. Desktop
  (1280px), tablet (768px), and mobile (375px) layouts were verified via
  the responsive Tailwind classes (`grid-cols-1 sm:grid-cols-2
  lg:grid-cols-3`, sticky header offsets) — not a live-browser resize
  test with an actual data-backed page, since that also requires a
  reachable database.

**Customer authentication is intentionally deferred to Day 14.**

### Known issues / remaining UI work
- No real food photography — every card/detail view uses a deterministic
  icon+tone placeholder until `MenuItem` gains an image field.
- No restaurant logo — an initial-letter avatar stands in until
  `Restaurant` gains a logo field.
- Search is client-side only, scoped to the items already returned by
  the public menu response (name + description substring match) — fine
  at today's scale, would need a server-side search endpoint if a
  restaurant's menu grows very large.
- Not yet exercised against live data/a live server in a browser — same
  sandbox limitation noted in every prior session.

Next task recommendation: **Mobile + Email customer authentication.**

## Day 14 — Customer Home Page + Mobile-First Menu + Git Protection

Frontend-focused, as instructed. Small, additive backend changes only
where a section genuinely needed real (not fabricated) data that wasn't
exposed yet — no new schema fields, no new collections, no rewrite of
Day 9/11/12/13 logic.

**Docs/code read first**: this file in full, `/menu/[restaurantId]`,
`/menu/[restaurantId]/[itemId]`, `/menu/[restaurantId]/cart`,
`/menu/[restaurantId]/review`, `lib/api.ts`, `lib/cart.ts`,
`app/globals.css`, `/scan/[restaurantId]/[tableId]`, and the existing
`.gitignore`.

### Part 1 — Customer Home page (new)
`/menu/[restaurantId]/home` — the new first stop: QR → **Home** → Menu →
Item → Cart. Built entirely from `menuApi.getPublicMenu()` (Day 9) and a
new `ordersApi.getPopular()` call; no fake menu data anywhere.

- **Featured** — `MenuItem` has no `isFeatured` field and none was
  added today (per the task's explicit "don't build a complex backend
  system" instruction for this section). Uses the restaurant's own real,
  existing signal instead: the first item of each category in the
  admin's own `sortOrder` (the public menu API already returns items
  pre-sorted — Day 9). Documented in code as a stand-in, not a claim of
  editorial curation. **Dependency for a real version**: add an
  `isFeatured: boolean` to `MenuItem` (mirrors `isAvailable`) plus an
  admin toggle — small, but deliberately not done today since the task
  called it out as backend scope to avoid.
- **New Arrivals** — real data, sorted newest-first. Required one
  one-line backend addition: `MenuItem.createdAt` has always existed
  (`{ timestamps: true }`, since Day 3-era schemas) but was never
  exposed on the public menu endpoint. `menu.service.ts`'s
  `getPublicMenu()` now includes it per item; `MenuItem` schema gained
  an explicit `createdAt`/`updatedAt` class-field declaration (same
  pattern `Order` already used) purely so TypeScript knows they exist on
  a lean-queried document.
- **Popular** — real order history, not a fabricated field. New
  `OrdersService.getPopularItems()`: aggregates actual `Order` documents
  (`$unwind` items, `$group` by `menuItemId` summing quantity, `$sort`
  desc), joined against currently-available `MenuItem`s so a
  since-deleted or 86'd item never shows as "popular." Exposed via new
  `GET /public/restaurants/:restaurantId/orders/popular` (no auth, same
  convention as the rest of `PublicOrdersController`). **If a restaurant
  has no orders yet, this returns `[]` and the Home page hides the
  section entirely** — never padded with placeholder data, per the
  task's explicit instruction.
- **Categories** — from `menu.categories` only, shown as a tappable
  grid; tapping one links to `/menu/[restaurantId]#category-<id>`. The
  full menu page gained a small scroll-to-hash effect so this actually
  lands on the right section rather than just the top of the page.
- **Other Suggestions** — deliberately not added. Four real sections
  were already enough content; a fifth invented category would have
  worked against "keep the UI sophisticated and uncluttered."

### Part 2/4/5/6 — Mobile-first review of existing screens
Day 13 already did most of this well (mobile-first grid, sticky
header/cart bar, skeleton/empty/error states). Concrete gaps closed
today:
- **Touch targets**: quantity +/− buttons were 24px (`h-6 w-6`) in
  `MenuItemCard`, the item detail page, and the cart page — bumped to
  28-36px (`h-7`–`h-9`) everywhere, matching what Day 13's own notes had
  claimed but the code hadn't actually shipped.
- **Cart page rebuilt**: previously had no header at all and its
  Subtotal/"Review Order" sat wherever they fell in a scrolling list —
  Part 6 explicitly asks for the total and checkout action to be
  "clearly visible." Added a sticky top header (back-to-Menu, "Home"
  link, table number) and a sticky bottom checkout bar (item count,
  subtotal, Review Order / disabled state), mirroring the Menu page's
  existing `StickyCartBar` pattern. The scrollable item list reserves
  matching bottom padding so nothing sits underneath either fixed bar.
- **Menu page header**: gained an optional `homeHref` back-chevron (only
  rendered when passed — the menu page is the only current caller and
  passes it), answering "how do I get back to Home."
- **Review page**: gained a small "← Cart" back link for the same
  reason; its remaining links to Menu were unified onto the same
  `contextQuery` helper every other customer page already used, instead
  of ad hoc `?table=...&tableId=...` string-building.
- Item detail, menu cards, and the review screen were otherwise left
  alone — already responsive and already reusing `useCart()` correctly;
  Part 5/6 say "only improve if needed," and there was nothing broken
  there beyond the touch-target sizing above.

### Part 3 — Customer navigation
Chose a **consistent header pattern with back-navigation**, not a
second fixed bottom tab bar — a Home/Menu/Cart bottom bar would have
visually stacked with the Menu page's existing sticky "View Cart" bar
and the new Cart page's sticky checkout bar, working against "keep the
UI uncluttered." Instead: Home's header always has a cart icon (→ Cart
reachable in one tap from Home); Menu's header now has a back chevron
to Home; Cart's new header has both a back-to-Menu chevron and a "Home"
link. From any of the three, the other two are one tap away, and each
header visibly names where you are.

### Part 7 — Loading / empty / error / fallback states (Home)
New `HomeSkeleton`, `HomeErrorState` (with retry), `HomeEmptyState` (zero
categories) — same visual language as Day 13's `MenuStates.tsx`. Image
fallback and unavailable-item handling are inherited by construction,
not newly built: `foodVisual`'s placeholder is used for every Home card
exactly as it is on the Menu page (no image field exists yet, same
documented limitation), and the public menu endpoint already excludes
unavailable items entirely (Day 9), so none can appear in Featured/New
Arrivals; Popular independently re-checks `isAvailable` in the
aggregation join for the same reason.

### Part 8 — `.gitignore` and secrets check
`.gitignore` existed but was thin (`node_modules/`, `dist/`, `.next/`,
`.turbo/`, `.env`, `.env.local`, `*.log`). Rewritten to also cover:
`.env.*.local`/`.env.development`/`.env.production`/`.env.test` (root
and per-app), `out/`/`build/` and per-app build dirs, `coverage/`,
TypeScript `*.tsbuildinfo`, `next-env.d.ts`, npm/yarn/pnpm debug logs,
`.vscode/*`/`.idea/`, OS files (`.DS_Store`, `Thumbs.db`,
`desktop.ini`), temp files/dirs, and the local Mongo data volume
(`mnu_mongo_data/`, from `docker-compose.yml`). `.env.example` files
(placeholder values, meant to be committed) are explicitly kept, not
ignored.

**Secrets check — two findings to flag directly:**
1. **This sandbox has no `.git` directory at all** (confirmed: no
   `mnu-day12-orders/.git`). Git was never initialized here, in this
   session or any prior one in this project's history, so I could not
   run `git ls-files` / `git log` to check whether an env file is
   *already tracked* in your actual repository. That check needs to
   happen in your real local/CI environment: `git ls-files | grep
   '\.env$'` (should return nothing), and if either `apps/api/.env` or
   `apps/web/.env` shows up, `git rm --cached <path>` — adding a
   pattern to `.gitignore` does **not** untrack a file already
   committed.
2. **`apps/api/.env` currently holds what appears to be a real,
   non-placeholder value** — a MongoDB Atlas connection string with
   embedded credentials, and a JWT signing secret — not the
   documentation-style placeholder in `.env.example`. No values are
   reproduced here. If check #1 turns up this file as tracked, or if
   it's ever been pushed to a remote at any point in this project's
   history, treat that Atlas password and JWT secret as compromised:
   rotate both before relying on this app anywhere beyond a local
   sandbox.

### Components changed/added
- New: `apps/web/app/menu/[restaurantId]/home/page.tsx` and
  `home/_components/{HomeHeader,HomeSection,HomeItemCard,CategoryGrid,HomeStates}.tsx`.
- Modified: `apps/web/app/scan/[restaurantId]/[tableId]/page.tsx` (links
  to Home, not straight to the menu list); `.../menu/[restaurantId]/page.tsx`
  (homeHref prop, scroll-to-category-hash effect); `.../_components/MenuHeader.tsx`
  (optional `homeHref`); `.../_components/MenuItemCard.tsx` (touch
  targets); `.../[itemId]/page.tsx` (touch targets); `.../cart/page.tsx`
  (rebuilt: header + sticky checkout bar); `.../review/page.tsx` (back
  link, unified `contextQuery`).
- Backend: `apps/api/src/menu/menu.service.ts` (`createdAt` on public
  items), `apps/api/src/menu/schemas/menu-item.schema.ts`
  (`createdAt`/`updatedAt` class fields), `apps/api/src/orders/orders.service.ts`
  (`getPopularItems()`), `apps/api/src/orders/public-orders.controller.ts`
  (`GET .../orders/popular`).
- `.gitignore` rewritten (see Part 8).
- No changes to `apps/api/src/auth/`, `.../tables/`, `.../table-sessions/`,
  `.../users/`, `.../restaurants/`, `.../restaurant-members/`, or any
  admin frontend page.

### Tests performed
- `apps/web`: `npx tsc --noEmit` clean.
- `apps/web`: `npm run build` clean — **19 routes** (18 from the Day 13
  baseline + new `/menu/[restaurantId]/home`), all other route sizes
  essentially unchanged.
- `apps/api`: `npx tsc --noEmit` clean, `npx nest build` clean, boot test
  (`node dist/main.js`) — starts, initializes `DatabaseModule`/
  `MongooseModule`, then blocks on the network-blocked Atlas connection
  exactly like every prior day's boot test; no DI/schema error before
  that point (a schema bug would have thrown at import time, before
  Nest even logs "Starting Nest application").
- Featured/New Arrivals/Categories logic, the popular-items aggregation
  pipeline, the scroll-to-hash effect, the sticky-bar layout math, and
  all loading/empty/error states were verified by **code review** and
  the build/boot checks above — mobile (375px)/tablet (768px)/desktop
  (1280px) layouts were verified via the responsive Tailwind classes
  used (`grid-cols-3 sm:grid-cols-4 lg:grid-cols-6` for categories,
  `w-36 sm:w-40` carousel cards, sticky offsets), not a live-browser
  resize test against real data.

**Live MongoDB read/write verification was NOT performed.** Same root
cause as every prior session: no sandbox in this project's history has
had network access to the Atlas cluster in `apps/api/.env`. This
includes the new `getPopularItems()` aggregation — its query logic was
verified by code review only, never run against real `Order` documents.

**Customer mobile/email authentication remains deferred to the next
authentication task**, as instructed.

### Data dependencies identified for future work
- **Featured**: needs a real `isFeatured: boolean` on `MenuItem` (plus
  an admin toggle) to stop relying on `sortOrder` as a stand-in.
- **Popular**: works today from real `Order` data, but will only show
  anything once orders start accumulating in a live database — currently
  untested against real order volume. A later Revenue Engine/analytics
  task could replace or augment this with recency-weighted or
  time-windowed popularity (e.g. "popular this week") rather than
  all-time totals.
- **Recommendations/personalization**: explicitly out of scope today and
  not approximated with any proxy — no per-customer data exists to base
  it on (no accounts yet).
- **Images**: `MenuItem`/`Restaurant` still have no image/logo fields
  (known since Day 11/13) — the Home page's cards use the same
  `foodVisual` placeholder as the Menu page for this reason.

### Known issues / remaining UI work
- Popular section is untested against real order volume (see above).
- Search (Day 13, client-side only) is unchanged and not present on the
  Home page — only on the full Menu list, as before.
- No `.git` repository exists in any sandbox this project has run in;
  the tracked-file/secrets check in Part 8 needs to be run against the
  actual project repository, not this environment.
- Not yet exercised against live data/a live server in a browser — same
  sandbox limitation noted in every prior session.

### Remaining work
Customer mobile/email authentication (explicitly deferred, per this
task and Day 13's recommendation); real `isFeatured` field + admin
toggle; order-status workflow beyond `NEW`; payment; kitchen display;
Analytics/Revenue Engine.

Next task recommendation: **Mobile + Email customer authentication** —
unchanged from Day 13's recommendation; today intentionally deferred it
again per this task's explicit scope limit.

## Day 15 — Menu Item Images (single image per item)

**Implemented**: admin can add/replace/remove one image per menu item;
image displays on the customer menu grid, item detail page, and Home
page carousels, with a proper fallback everywhere else.

**Image storage approach**: no cloud storage existed in the project, so
this uses the simplest thing that fits — uploaded files are written to
local disk at `apps/api/uploads/menu-items/` and served back via
`@nestjs/platform-express`'s built-in `useStaticAssets()` (`main.ts`),
already-available infrastructure, no new provider/package beyond
`multer` (which was already a transitive dependency). `MenuItem` stores
only `imageUrl: string | null` — a path like
`/uploads/menu-items/<uuid>.jpg`, no other metadata. Uploading always
replaces the previous file (old file deleted); "remove" clears the
field and deletes the file. Swapping to S3/Cloudinary later only
touches `MenuService`'s two image methods and `main.ts`.

**Backend changes**: `MenuItem` schema (+`imageUrl`); `MenuService`
(+`uploadItemImage`, `removeItemImage`, `imageUrl` added to all three
serializers — admin `getMenu`, public `getPublicMenu`, and Day 14's
popular-items result); `MenuController` (+`POST`/`DELETE
.../menu-items/:itemId/image`, manager-only, multipart via
`FileInterceptor`+`memoryStorage`); `main.ts` (`NestExpressApplication`
+ `useStaticAssets`); `package.json` (+`multer`, `+@types/multer`);
`.gitignore` (+`apps/api/uploads/` — runtime data, not source).
Validation: JPEG/PNG/WebP only, 5MB max, clean `BadRequestException`
either way (no server errors).

**Frontend changes**: `lib/api.ts` (+`imageUrl` on the three item
types, `+resolveImageUrl()`, `+requestFormData()` for multipart,
`+menuApi.uploadItemImage/removeItemImage`); new shared `ItemImage.tsx`
(real photo with `object-cover` + consistent aspect ratio, falls back to
the existing icon placeholder on missing OR failed-to-load images);
wired into `MenuItemCard`, the item detail page, and Home's
`HomeItemCard`. Admin `restaurants/[restaurantId]/menu` page: `AddItemForm`
gained an optional photo picker + preview (uploads right after
creation succeeds); `EditItemForm` gained preview/replace/remove
(remove is immediate with a confirm prompt, not deferred to Save); the
item row list gained a small thumbnail.

**Tests performed**:
- `apps/web`: `tsc --noEmit` clean; `next build` clean (19 routes,
  unchanged route count/shapes).
- `apps/api`: `tsc --noEmit` clean; `nest build` clean; boot test
  (`node dist/main.js`) starts and reaches `MongooseModule` init with no
  DI/schema error before blocking on the (network-blocked) Atlas
  connection, same as every prior day.
- Upload validation + disk-write logic (mimetype allow-list, 5MB limit,
  actual file write/read-back) verified with a standalone Node script
  mirroring `MenuService`'s exact logic — confirmed: valid PNG writes
  and is readable back, a PDF is rejected with a clean message, a >5MB
  file is rejected with a clean message. Cleaned up before packaging.
- Everything touching MongoDB itself (create/edit item with image,
  replace, remove, an item created before this change still serializing
  with `imageUrl: null`, and the customer menu actually rendering a
  real photo end-to-end) was verified by **code review only** — no live
  database access in this sandbox, same limitation as every prior
  session. **Live database/browser verification was NOT performed.**

**Known issues**:
- Uploaded files live on local disk — fine for one sandbox/single
  instance, but won't survive a redeploy or work across multiple API
  instances. Documented in code as the reason to swap to real object
  storage before production.
- No image is ever optimized/resized server-side; a customer's phone
  downloads whatever the admin uploaded (up to 5MB). Acceptable for this
  stage per "don't over-engineer," but a candidate for a later pass.
- Not exercised against live data in a browser — see Tests above.

**Recommended next task**: Mobile + Email customer authentication
(carried over again — still the standing recommendation since Day 13,
deferred each time by that day's own explicit scope limit).

## Day 16 — Customer QR Menu UI Refresh (app-like ordering experience)

UI/UX only, as instructed — no backend changes, no new endpoints, no
schema changes. No reference image was actually attached to this task's
message, so this was built from the written UX principles (app-like
browsing, bottom nav, food-focused cards) directly, not by copying any
specific product's screens.

**UI changes**:
- **New persistent bottom navigation** (Home | Menu | Search | Cart) —
  the main ask today. One shared `CustomerBottomNav` on Home, Menu, and
  Cart, active-tab highlighted per screen. "Search" isn't a new page —
  it links back to the Menu route with `?openSearch=1`, which the Menu
  page reads on load to open its existing (Day 13) search UI; no
  duplicate fetch or search logic.
- Retired the old standalone `StickyCartBar` — its "N items · subtotal
  · View Cart" strip is now folded into the top of `CustomerBottomNav`
  itself (shown above the tab row whenever the cart has items and the
  customer isn't already on the Cart screen), so each page has exactly
  one fixed bottom element, not two competing ones.
- Cart page: kept its own sticky checkout bar (subtotal + Review Order)
  but moved it to sit just above the new bottom nav, so both are
  visible and neither overlaps the item list.
- Home page: removed the old sticky/blurred header in favor of a
  larger, static "entrance" header — restaurant initial avatar, name,
  and a real, computed stat line ("`N` categories · `M` items", plus
  table number) instead of just the name. No fabricated restaurant
  info — `Restaurant` only has a `name` field today (checked the
  schema), so this is the most substantive "restaurant information"
  section that real data supports.
- Menu page: header simplified (dropped the Day 14 back-to-Home
  chevron — the bottom nav's Home tab now covers that, so having both
  was redundant); menu item image bumped from 80/96px to 96/112px
  (`h-24/h-28`) for more "food-focused" visual weight, still
  `object-cover` via the existing shared `ItemImage` component so
  nothing stretches/distorts.
- Desktop/tablet: the bottom nav (and its cart strip) center and round
  off within the same `max-w-5xl` column every other screen already
  uses, rather than spanning the full browser width — keeps it reading
  as an app surface floating in the page, not a corporate site's footer
  bar. No other desktop-specific layout changes were needed; the
  existing `max-w-5xl`/responsive grid from Day 13-14 already avoided a
  "normal website" feel.

**Components changed**: new `CustomerBottomNav.tsx` (+ two new icons,
`HomeNavIcon`/`MenuNavIcon`, in `icons.tsx`); removed
`StickyCartBar.tsx`; edited `menu/[restaurantId]/page.tsx` (bottom nav,
`openSearch` param, dropped `homeHref`), `home/page.tsx` (bottom nav,
real stat computation), `home/_components/HomeHeader.tsx` (restaurant
info line, non-sticky), `cart/page.tsx` (bottom nav + repositioned
checkout bar), `_components/MenuItemCard.tsx` and `MenuStates.tsx`
(image size). Item detail and Review pages were left as-is — still
focused, single-purpose screens with their own back link, consistent
with Day 14's reasoning for not giving every screen the full nav chrome.

**Tests performed**:
- `apps/web`: `tsc --noEmit` clean; `next build` clean — same 19
  routes, no size regressions.
- Layout/overflow, category navigation, Add to Cart, cart access, and
  the existing QR/table-context query-string plumbing were checked by
  **code review** (every href threads `contextQuery` exactly as before;
  nothing about the table/session flow was touched) — not a live
  browser resize/interaction test. No backend or database is involved
  in this task, so there's no live-DB caveat to add here, but there's
  still no live-browser verification in this sandbox.

**Known issues**:
- The bottom nav's "Search" tab relies on an initial-render check of
  `?openSearch=1`; once the customer closes search, the URL still
  carries that param until they navigate again — cosmetically harmless
  (it's a one-time trigger, not re-read on every render) but worth a
  cleanup pass later (e.g., replacing the URL without the param once
  search opens).
- `HomeSkeleton`'s placeholder header height wasn't updated to match
  the new, taller Home header — a very brief visual mismatch during the
  loading flash only.
- Not exercised in a live browser at real breakpoints — see Tests above.

**Recommended next task**: Mobile + Email customer authentication —
unchanged standing recommendation, deferred again as this task was
explicitly UI/UX-only.

## Day 17 — Admin login fix, dynamic order status, customer auth foundation

**Part 1 — Admin login flow**: Login/register now redirect straight to
`/restaurants/[id]/dashboard` (using the `membership`/`memberships[0]`
already returned by `/auth/login` and `/auth/register`) instead of the
old intermediate "Welcome / Your Restaurants" page. `/dashboard` itself
is now a thin redirector (fetches `/auth/me`, sends the admin to their
restaurant) rather than deleted outright, so old bookmarks/back-nav
don't 404. The genuine multi-restaurant case isn't removed — the
restaurant layout's header switcher (`memberships.length > 1`) still
exists and still works; only the extra picker *screen* is gone.
Landing page (`app/page.tsx`) rewritten: removed the "View demo QR
menu" card from the main login/registration entry point, and fixed
copy that claimed auth "isn't live yet" (it's been live since Day 4).

**Part 2 — Dynamic order status**: `OrderStatus` enum expanded from
just `NEW` to `NEW → CONFIRMED → PREPARING → READY → COMPLETED`, plus
`CANCELLED` (reachable from any non-terminal state). New
`PATCH /restaurants/:id/orders/:orderId/status`
(`OrdersService.updateStatus`) validates the transition against a
`STATUS_TRANSITIONS` map (no illegal jumps, nothing changes once
COMPLETED/CANCELLED), persists to MongoDB, and returns the updated
order — the admin order detail page renders its "Mark as ___" buttons
from that same transition map and writes the *server's* response back
into state, never an optimistic local value, so refresh/logout-login
always shows what's actually in the database. Order list page now has
Active/Completed/Cancelled/All filter tabs (client-side filter over the
existing list — no new endpoint needed).

**Part 3–6 — Customer authentication foundation**: New `Customer` and
`OtpChallenge` schemas/collections (`apps/api/src/customers/`). OTP
flow: `POST /public/customer-auth/otp/request` (mobile or email, 6-digit
code, bcrypt-hashed, 5-min expiry, 5-attempt cap) →
`POST /public/customer-auth/otp/verify` (finds-or-creates the Customer
by mobile/email — never duplicates one that already exists — and issues
a session token). Session uses the *same* JWT mechanism as staff auth
(`jsonwebtoken` + `JWT_SECRET`) but a structurally distinct payload
(`{ customer_id, type: 'customer' }`) and its own `CustomerAuthGuard`,
so a customer token can never be used as a staff token or vice versa —
reusing the existing auth architecture, not building a second one.
Customer identity is global (not scoped per restaurant), stored client-
side as `mnu_customer_token` (separate from the staff `mnu_token`), so
the same phone/email is recognized across any restaurant's QR menu.
Frontend: `CustomerAuthPanel` (method choice → OTP entry → loading/error
states, all as sub-states of one component) is rendered inline on the
Review Order page — the one point in the flow between Cart and Order —
whenever no valid customer token is present; browsing the menu, adding
to cart, and reaching the Review page itself all still require zero
login. Because authentication happens *on* the Review page rather than
via a separate route, cart contents and the `table`/`tableId` query
params are never touched by the auth step — Part 6 falls out for free.

**Part 7/8 — Customer ID on orders, restaurant isolation**: `Order`
gained an optional `customerId` (ObjectId ref). `POST
/public/restaurants/:id/orders` is now behind `CustomerAuthGuard` —
placing an order requires a verified customer session, and the
customer id comes from the verified token, never the request body.
Admin order list/detail now also return a `customer` block (code, name,
mobile, email) for display. `OrdersService.listCustomerOrdersForRestaurant`
exists as the Part 7/8 foundation — every customer-order lookup filters
by both `{ restaurantId, customerId }` together, which is what prevents
one restaurant from ever seeing a customer's history at another. No
dedicated history UI was built — explicitly out of scope today ("do not
build the full Customer Memory UI yet").

**Backend changes**: `orders/schemas/order.schema.ts` (status enum,
`customerId`, new index), `orders/orders.service.ts` (`updateStatus`,
`listCustomerOrdersForRestaurant`, customer join in serialization),
`orders/orders.controller.ts` (`PATCH .../status`),
`orders/public-orders.controller.ts` (`CustomerAuthGuard` on create),
`orders/orders.module.ts` (imports `CustomersModule`), new
`customers/` module (schemas, `CustomerAuthService`,
`CustomerAuthController`, `CustomerAuthGuard`,
`current-customer.decorator.ts`), `auth/jwt.util.ts`
(`signCustomerToken`/`verifyCustomerToken`), `database/database.module.ts`
(registers `Customer`/`OtpChallenge` globally), `app.module.ts`
(registers `CustomersModule`).

**Frontend changes**: `login/page.tsx`, `register/page.tsx`,
`dashboard/page.tsx` (Part 1); `app/page.tsx` (Part 1 copy/demo-link);
`restaurants/[restaurantId]/layout.tsx` (removed the now-misleading
"← All restaurants" link); `restaurants/[restaurantId]/orders/page.tsx`
+ new `orders/[orderId]/page.tsx` + new `orders/_components/StatusBadge.tsx`
(Part 2); new `menu/[restaurantId]/_components/CustomerAuthPanel.tsx`,
new `lib/customerAuth.ts`, `menu/[restaurantId]/review/page.tsx` (Part
3–6); `lib/api.ts` (`OrderStatus` widened, `ACTIVE_ORDER_STATUSES`,
`ORDER_STATUS_TRANSITIONS`, `ordersApi.updateStatus`, `customerRequest`
helper, `customerAuthApi`, `AdminOrderRecord.customer`).

**Tests performed**:
- `apps/api`: `tsc --noEmit` clean; `nest build` clean.
- `apps/web`: `tsc --noEmit` clean; `next build` clean (all 19 routes
  compile, including the two new/changed order pages).
- Everything involving an actual running server or MongoDB — admin
  login → direct dashboard redirect, changing an order's status and
  confirming it survives refresh/logout-login, the OTP request/verify
  round trip, find-vs-create-customer behavior, and order→customer
  association — was verified by **code review only**. **No live
  database or browser testing was performed** (same sandbox limitation
  as every prior session: `DATABASE_URL` points at MongoDB Atlas, which
  this sandbox's network can't reach). This is explicitly flagged per
  the task's own instruction not to claim live testing that didn't
  happen.

**Known issues**:
- **No real SMS/email provider.** `CustomerAuthService.requestOtp`
  returns the generated code directly in the API response
  (`devOtp`), and the frontend shows it in an amber "dev mode" note.
  This is the only way to make the OTP flow testable end-to-end without
  a third-party integration in this environment — it must be removed
  (or gated behind a non-production flag) and replaced with a real
  SMS/email send before any real launch.
- Order status transitions are enforced by a hand-written map in
  `OrdersService`, not a formal state machine library — fine at this
  size, worth revisiting if more statuses/roles are added later.
- No RBAC split on who can change order status (any restaurant member
  can) — matches the existing "any member can view orders" precedent,
  but a real kitchen-vs-front-of-house role distinction doesn't exist
  yet.
- Customer order history has a backend query
  (`listCustomerOrdersForRestaurant`) and data model, but no admin UI —
  intentionally deferred per this task's own scope limit.
- No live browser/database verification — see Tests above.

**Recommended next task**: Build the restaurant-side Customer History
view (list of a customer's past orders at *this* restaurant only),
using `listCustomerOrdersForRestaurant` — the natural next step now
that Order → Customer association actually exists.

## Day 18 — Restaurant Analytics Dashboard + Menu Item Image Storage Migration

Two unrelated pieces of work, as scoped. **Customer Order History was
NOT implemented** — explicitly deferred again, per this task's own
instruction, even though it was the standing recommendation above.

### Part 1 — Analytics on the Dashboard

Real MongoDB aggregation, nothing hard-coded. New
`OrdersService.getDashboardAnalytics(restaurantId, userId)` + new
`GET /restaurants/:id/analytics/dashboard` (`AnalyticsController`, same
module as `OrdersController`, same `JwtAuthGuard` +
`requireMembership` restaurant-isolation check every other
restaurant-scoped endpoint in this project already uses — one
restaurant's admin can never query another's numbers). Rendered
directly on `restaurants/[restaurantId]/dashboard/page.tsx`, above
Quick Actions — not on a separate page, per this task's explicit
instruction. The old `/analytics` page now redirects the reader to the
Dashboard instead of showing a "coming soon" stub.

**Metrics implemented** (all in `getDashboardAnalytics` — see that
method's own comment block for the full reasoning on each definition
choice):
- **Today's Sales / Today's Orders** — sum(`total`)/count of
  non-cancelled orders created since UTC midnight today. "Today" is a
  UTC calendar day — this project has no restaurant-timezone field
  anywhere (checked `restaurant.schema.ts`), so there's no other
  well-defined "today" to use. Documented inline and on the dashboard
  itself ("UTC calendar day" hint under each card) rather than silently
  assumed.
- **Average Order Value** — all-time revenue ÷ all-time order count,
  excluding cancelled orders. Deliberately *not* scoped to just today:
  only Sales/Orders are explicitly "Today's" in this task's own metric
  list, and an average over one low-traffic day swings wildly; all-time
  is the standard AOV definition.
- **Active Orders** — count where status ∈ {NEW, CONFIRMED, PREPARING,
  READY} (anything non-terminal). **Completed Orders** — count where
  status = COMPLETED. Both are current totals describing the order
  queue's present state, not day-scoped.
- **Top-selling Items** — aggregated directly off `Order.items` (the
  name/quantity/lineTotal *snapshot* taken at order time — see
  `order.schema.ts`), not joined back to live `MenuItem` documents. A
  dish that was later renamed, 86'd, or deleted still correctly shows
  its historical sales; this is deliberately a different query from
  Day 14's `getPopularItems()` (which the customer Home page uses and
  *does* filter to currently-available items — right for "what can a
  customer order now", wrong for "what actually sold").
- **Recent Orders** — the restaurant's 5 most recent orders (any
  status), reusing the same `serializeOrderSummary()` the orders list
  page already uses — same shape, same customer-block field, no
  duplicate serialization logic.
- **7-day trend** — daily sales+order-count for the UTC window
  `[today-6, today]`, with every day in the window explicitly
  zero-filled if it had no orders, rather than only plotting days that
  had activity — a quiet day is real information for a trend, not
  something to skip. Rendered as new `TrendChart.tsx`: a small
  dependency-free bar chart (plain divs, height % of the window's max)
  — no charting library exists in `apps/web`'s dependencies, and 7 bars
  didn't justify adding one.
- **No metric was faked.** Nothing here needed a "document what's
  missing" placeholder — every metric the task asked for was
  computable from data that already existed (`Order`'s
  status/total/createdAt/items, all present since Day 12/17).

**Frontend**: `restaurants/[restaurantId]/dashboard/page.tsx` — new
`Analytics` section (own loading skeleton, its own error+retry state,
independent of the page's other three sections so one slow/failed
aggregation call doesn't block Quick Actions from rendering); new
`dashboard/_components/`: `MetricCard.tsx`, `TrendChart.tsx`,
`TopItemsList.tsx` (empty state: "No orders yet"), `RecentOrdersList.tsx`
(reuses the existing `StatusBadge` from the orders pages, links each row
to that order's detail page). `analytics/page.tsx` rewritten to point
at the Dashboard rather than showing a dead-end stub.

**Backend**: `orders/orders.service.ts` (`getDashboardAnalytics`),
`orders/orders.controller.ts` (new `AnalyticsController`, same file),
`orders/orders.module.ts` (registers it). No schema changes — every
field this reads already existed.

### Part 2 — Menu Item Image Storage Migration (local disk → Cloudinary)

**Inspected first**: confirmed via `package.json`/`.env.example`/
`docker-compose.yml` that no cloud storage provider existed anywhere in
this project (no AWS/GCS SDK, no bucket config) before choosing one.

**Approach**: local disk (`apps/api/uploads/menu-items/`, served via
`useStaticAssets` — the Day 16 architecture) replaced with
**Cloudinary**, chosen over hand-rolling S3/GCS because it needs three
env vars and one SDK call for a permanent HTTPS URL — no bucket/IAM/CORS
setup to also invent for this task. New `common/cloudinary.ts` (SDK
config from three new env vars, `secure: true` forces https). Target
flow now matches the task's spec exactly: admin uploads → Cloudinary →
Cloudinary returns a secure URL + public_id → MongoDB stores both →
customer/admin UI reads the stored URL directly (`<img src>`, same as
before — `ItemImage.tsx`/`resolveImageUrl()` needed no structural
change, just a fast-path for already-absolute URLs).

**Schema**: `MenuItem.imageUrl` is now a full Cloudinary HTTPS URL
(previously a local `/uploads/...` path — comment updated in
`menu-item.schema.ts`). New `MenuItem.imagePublicId` (Cloudinary's own
asset id) — needed to delete/replace the exact right remote asset on
edit/remove (Cloudinary has no "delete by URL"); **never serialized to
any API response** (checked `serializeItem()` — only `imageUrl` is
returned, same as before), purely an internal implementation detail.
Still single image per item, unchanged.

**Backend**: `menu.service.ts` — `uploadItemImage`/`removeItemImage`
rewritten against `cloudinary.uploader.upload_stream`/`.destroy()`
instead of `fs.writeFile`/`fs.unlink`; validation (JPEG/PNG/WebP
allow-list, 5MB cap) unchanged, same as the local-disk version. Old
`deleteImageFileIfAny` replaced by `destroyImageIfAny` (same
best-effort-cleanup shape, now against Cloudinary's API instead of the
filesystem). `main.ts`: removed the now-dead `useStaticAssets()` call
and the `NestExpressApplication` typing it required — nothing writes to
local disk anymore, so nothing needs serving from it.
`apps/api/.env.example`: added `CLOUDINARY_CLOUD_NAME` /
`CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` (placeholders only — no
real credentials exist in this sandbox, see Known limitations).
`apps/api/.gitignore`: added `uploads/` defensively, so a manually
recreated local-disk artifact can never end up committed, even though
nothing in the current code path writes there anymore.
`package.json`: added `cloudinary` (already installed, `npm install`
run in this session).

**Frontend**: `lib/api.ts`'s `resolveImageUrl()` now passes an
already-absolute `http(s)://` URL through unchanged (Cloudinary's own
`secure_url`) and only falls back to prefixing the API origin for a
value that isn't already absolute (backward-compat for any pre-existing
local-disk-style path — none is assumed to actually exist in this
sandbox's unreachable database, this is just not silently breaking one
if it did). **No other frontend change was needed** — the admin
create/edit-item image picker/preview/replace UI and the customer-facing
`ItemImage` component were both already storage-agnostic (they call
`menuApi.uploadItemImage`/`removeItemImage` and render through
`resolveImageUrl()`; neither ever assumed local disk).

### Tests performed
- `apps/api`: `tsc --noEmit` clean; `nest build` clean.
- `apps/api`: boot test (`node dist/main.js`) — starts, reaches
  `MongooseModule`/`ConfigModule` init with no DI/schema error, before
  blocking on the (network-blocked) Atlas connection, same as every
  prior session. This also confirms `cloudinary.config()` with unset
  env vars doesn't throw at boot (it only fails, cleanly, if an actual
  upload is attempted without real credentials).
- `apps/web`: `tsc --noEmit` clean; `next build` clean — same 19 routes,
  `restaurants/[restaurantId]/dashboard` grew from ~1.7 kB to 4.81 kB
  (the new analytics section), `analytics` page shrank (now a redirect
  card, not a stub with more markup).
- `apps/web`: `next start` boot test — `GET
  /restaurants/:id/dashboard` returns `200` and renders without a
  server-side crash (confirms the new imports/components/aggregation
  types all resolve correctly at runtime, not just at typecheck time);
  it shows the page's own loading guard rather than real numbers, which
  is expected — there's no reachable database in this sandbox for
  `restaurant-context` to actually authenticate against.
- **The actual aggregation math (does `getDashboardAnalytics` return
  the right numbers against real orders), the Cloudinary upload/destroy
  round trip, and MongoDB actually storing/reading back `imageUrl`/
  `imagePublicId` were all verified by code review only.** No live
  database, no live Cloudinary account, and no browser session were
  available in this sandbox — same limitation as every prior session,
  now compounded by Cloudinary also being outside this sandbox's
  network allow-list (only npm/GitHub/PyPI-family domains are
  reachable here), so even a throwaway free-tier account couldn't have
  been exercised end-to-end from inside this environment regardless of
  credentials.

### Known limitations
- **No real Cloudinary account/credentials exist in this sandbox** —
  `.env.example` documents the three variables needed; a real
  `cloud_name`/`api_key`/`api_secret` from an actual Cloudinary account
  must be added to `apps/api/.env` (not committed — already
  `.gitignore`d) before uploads will actually work anywhere this runs.
- Average Order Value and the two order-count metrics are intentionally
  all-time, not "today" — see the reasoning above; if a strictly
  today-scoped AOV/active/completed breakdown is wanted later, that's
  an additive change to the same aggregation, not a redesign.
- The 7-day trend is a fixed UTC window; a restaurant whose actual
  business day doesn't align with UTC will see activity from the tail
  end of "yesterday" or the start of "tomorrow" bleed across a bucket
  boundary. Same root cause as the "today" caveat above — no
  restaurant-timezone field exists yet.
- No image is resized/optimized before or after upload — Cloudinary
  itself is capable of on-the-fly transforms (thumbnails, format
  conversion) via URL parameters, but none are used yet; the stored
  `imageUrl` is whatever Cloudinary handed back for the original
  upload. A reasonable next pass, not done today (kept to the task's
  actual scope).
- Not exercised against live data in a browser, and not against a real
  Cloudinary account — see Tests above.

**Customer mobile/email authentication** was already live as of Day 17
and untouched today. **Customer Order History = NEXT TASK** (carried
over, explicitly not built today per this task's own scope limit).

**Recommended next task**: Build the restaurant-side Customer History
view — unchanged recommendation from Day 17, still the natural next
step now that this task didn't touch it either.

## Day 19 — Restaurant-Admin Customer History (read-only)

Dashboard → Customers → Customer List → Customer History → Order
Details. Read-only, restaurant-scoped, no customer-facing changes.

**What already existed (inspected first, reused as-is)**:
`OrdersService.listCustomerOrdersForRestaurant` (Day 17 — restaurant +
customer scoped query, no controller route yet); `OrdersService.getOrder`
(Day 12/17 — full restaurant-scoped order detail with customer block,
already has a controller route and an admin page:
`orders/[orderId]/page.tsx`); `JwtAuthGuard`/`requireMembership`
(auth + restaurant isolation, unchanged); `StatusBadge`, the
Orders list page's loading/empty/error visual pattern (copied, not
duplicated-and-diverged); the admin sidebar/layout
(`useRestaurantContext`, which already turns "not a member of this
restaurant" into a page-level unauthorized state for every admin route).

**What was missing**: a restaurant-scoped *customer list* endpoint (no
"customers" concept existed anywhere except the OTP-auth-created
`Customer` collection, which is global, not restaurant-scoped); a
controller route for the existing `listCustomerOrdersForRestaurant`
method; and every frontend screen for this flow (`Customers` didn't
exist as a section at all — sidebar had no entry for it).

**Created**:
- `OrdersService.listCustomersForRestaurant(restaurantId, userId)` —
  new. Aggregates *this restaurant's own* `Order` documents
  (`$match restaurantId` first, then `$group by customerId`) to get the
  distinct customers who've actually ordered here, with orderCount/
  totalSpent/lastOrderAt, then joins `Customer` for display fields.
  Deliberately never queries the global `Customer` collection first —
  a customer who has never ordered at this restaurant is never loaded,
  matching the task's explicit "do not fetch all global customers and
  filter in the frontend."
- `OrdersService.listCustomerOrdersForRestaurant` — **extended**, not
  duplicated: now also returns the customer's own profile
  (name/mobile/email/code) alongside their order list in one response
  (`{ customer, orders }` instead of a bare array), since it had no UI
  consumer before today and nothing depended on the old shape. See its
  updated security comment: the customer profile is only looked up
  *after* confirming at least one order exists for `{restaurantId,
  customerId}` together — looking it up by `customerId` alone first
  would let this restaurant's admin read another restaurant's
  customer's PII by guessing a valid id, even with zero shared history.
- `CustomersController` (`orders/orders.controller.ts`, same file/module
  as `OrdersController`/`AnalyticsController`, same reasoning as
  `AnalyticsController` — the data is fundamentally Orders data, so it
  reuses `OrdersService` rather than creating a `Customer`↔`Orders`
  cross-module dependency): `GET restaurants/:id/customers`,
  `GET restaurants/:id/customers/:customerId/orders`. Registered in
  `orders.module.ts`.
- Frontend: `lib/api.ts` gained `customersApi` (`list`, `getHistory`) +
  `RestaurantCustomerRecord`/`CustomerHistoryResponse` types (reusing
  the existing `CustomerProfile`/`AdminOrderRecord` shapes, not new
  ones). New pages: `restaurants/[restaurantId]/customers/page.tsx`
  (list) and `.../customers/[customerId]/page.tsx` (history, links each
  order straight into the **existing, unmodified** order-detail page).
  Sidebar (`layout.tsx`) gained a "Customers" nav item; Dashboard
  gained a matching Quick Action.

**Not touched**: `getOrder`/order-detail page (reused exactly as-is —
no new "read-only" variant was built, per the task's own instruction);
`Customer`/`Order` schemas (no new fields needed); customer-facing
anything; `CustomerAuthService`/OTP flow.

### Security / isolation
- Every new/extended method still goes through `requireMembership`
  first — a non-member of the restaurant gets the same
  `ForbiddenException` every other restaurant-scoped call already
  throws.
- Customer list: derived from this restaurant's `Order` rows only —
  structurally cannot include a customer with zero orders here.
- Customer history: scoped by `{restaurantId, customerId}` together,
  same isolation mechanism as every other restaurant-scoped lookup in
  this project. A customerId that's valid but belongs only to another
  restaurant's order history comes back as `{customer: null, orders:
  []}` — indistinguishable from a nonexistent id, same "shape-as-404"
  principle used everywhere else, and specifically prevents PII leakage
  (see above).
- Order details: unchanged, already restaurant-scoped (`{_id,
  restaurantId}`).
- Page-level "unauthorized" (not a member of this restaurant) was
  already handled by the shared layout for every admin route — nothing
  new needed there.

### Tests performed
- `apps/api`: `tsc --noEmit` clean; `nest build` clean; boot test
  (`node dist/main.js`) reaches `ConfigModule` init with no DI/schema
  error (a bad `@Controller`/provider wiring would throw before that
  point) before blocking on the network-blocked Atlas connection, same
  as every prior session.
- `apps/web`: `tsc --noEmit` clean; `next build` clean — **21 routes**
  (19 from Day 18 + the two new `/customers` routes).
- `apps/web`: `next start` boot test — `GET
  /restaurants/:id/customers` and `GET
  /restaurants/:id/customers/:customerId` both return `200` with no
  server-side crash.
- **The actual aggregation results, the PII-isolation behavior, and the
  full click-through flow were verified by code review only.** No live
  MongoDB and no live browser session were available in this sandbox —
  same limitation as every prior session. Concretely worth doing on a
  machine with real Atlas access: seed two restaurants with overlapping
  and non-overlapping customers, confirm Restaurant A's customer list
  never shows a customer who's only ordered at B, and confirm hitting
  `/restaurants/:A-id/customers/:a-customer-who-only-ordered-at-B` comes
  back with `customer: null` rather than leaking their profile.
- No lint script or existing test suite exists in either app
  (`package.json` has no `test`/`lint` runner beyond
  `next lint`, which was not separately invoked here) — `tsc --noEmit` +
  the production builds are what "TypeScript checks" and "build" mean
  in this project's existing convention, consistent with every prior
  day's Tests section.

### Known limitations
- No pagination on the customer list — fine at current scale, same
  caveat as the orders list.
- No search/filter on the customer list.
- `RestaurantCustomerRecord.totalSpent` includes cancelled orders'
  totals (unlike the Day 18 analytics AOV, which excludes them) — this
  list is "who has this restaurant served," not a revenue metric;
  worth reconciling if this number is ever shown next to the dashboard's
  revenue figures.
- Not exercised against live data in a browser — see Tests above.

**Recommended next task**: none carried over from this feature — the
standing Day 17 recommendation is now built. Next candidates: real
SMS/email OTP delivery (still dev-mode only, per Day 17/18 notes), or
closing the live-database verification gap that has applied to every
feature since Day 1.

## Day 20 — Customer Mobile UI Polish + Group Ordering Foundation

*Numbering note: this task was briefed as "Day 19", but Day 19 above is
already taken by Restaurant-Admin Customer History (the state this
session started from). Logged as Day 20 to avoid a duplicate heading.*

**Pinterest reference (Part 2) was NOT accessible** — `pin.it` returns
`ROBOTS_DISALLOWED` to automated fetches. Per the task's own fallback
instruction, the existing MnU customer UI was extended consistently
rather than a new design system invented. No visual language was
imported from anywhere.

### Part 1 — Customer mobile UI

Deliberately restrained: the customer flow had already had three
dedicated UI passes (Days 13/14/16), so this was targeted, not a
redesign.
- `CustomerAuthPanel` gained optional `title`/`description` props and
  made `restaurantName` optional — the group entry screen needs the
  same verification UI with different framing ("verify to join a
  group", not "verify to place your order") and doesn't fetch the menu,
  so requiring a restaurant name purely for one line of copy would have
  meant a wasted request. The Review page's wording is unchanged
  (defaults preserve it exactly).
- New `GroupOrderBanner` on Home and Cart, using the existing card
  language (`rounded-2xl`, `border-ink-100`, `active:scale-[0.99]`).
- No change to the bottom nav's four tabs. A fifth "Group" tab was
  considered and rejected: Part 11 explicitly warns against competing
  fixed navigation, and group ordering is a mode you enter, not a
  destination you toggle between. Every group screen therefore has
  **zero** fixed/sticky elements (verified by grep across all customer
  routes) — same treatment Review and Confirmation already get.

### Part 3–8 — Group ordering

Flow: Home/Cart banner → **Group Order** entry (Create / Join) →
**Join** (code entry) → **Lobby**.

**Codes**: 5 characters from a 31-character alphabet with `0/O/1/I/L`
removed — these get read aloud across a table, which is the one failure
mode a join screen can't recover from gracefully. Generated with
`crypto.randomInt` (not `Math.random`), retried against the unique index
on collision. Never hard-coded. The join input sanitizes to the same
alphabet as the customer types.

**Personal vs group cart (Part 7)**: no second cart system was built.
`lib/cart.ts` (localStorage, per-restaurant) remains the single source
of truth for what a customer is personally building; the lobby's
"Share my items with the group" pushes that cart into *that member's
own slot* on the server. So **My Items** = the caller's shared
contribution, **Group Items** = everyone else's. The sync is an explicit
push, not a background/live sync — real-time collaboration is out of
scope, and a silent sync would leave it unclear what the rest of the
table can already see. The lobby detects and prompts when the local cart
has drifted from what was shared.

**Prices in the lobby** are recomputed from live `MenuItem` prices on
every read, not stored on the group. The binding price *snapshot* is
still the one taken at order creation (`Order.items`, Day 12) — a group
lobby is a pre-order staging area, not an order.

**Group checkout is deliberately absent.** Each member still checks out
their own cart through the existing Cart → Review → Order flow, entirely
unchanged. The lobby says so in plain text rather than implying a
combined checkout exists.

### Part 9/10 — Backend / security

New `apps/api/src/group-orders/` module. Nothing existing was
rebuilt — `Customer`, `TableSession`, `Table`, `Order`, `MenuItem`,
`CustomerAuthGuard`, and `lib/cart.ts` are all reused as-is.

- `GroupOrder` schema pins `restaurantId` + `tableId` + `tableNumber` +
  `tableSessionId` (all stored, not derived) so a group can never be
  re-pointed at another restaurant and an ended session makes its groups
  verifiably stale. Members are embedded, each with their own item list.
- Every route is behind `CustomerAuthGuard` (the customer session from
  Day 17, not staff auth). `customerId` always comes from the verified
  token, never the body.
- **Every group lookup filters by `groupCode` AND `restaurantId`
  together** — a valid code belonging to another restaurant resolves to
  nothing, returning the same message as a typo (the "shape-as-404"
  principle used throughout this project).
- Non-members cannot read a lobby — otherwise anyone holding a code
  could watch a table's order build without joining.
- `syncMyItems` replaces *only the caller's own* slot; a member can
  never edit another member's items. Item ids are re-validated against
  `{_id, restaurantId}` exactly as `createOrder` does.
- Create is idempotent per table session: if a group is already open at
  this table, the caller is added to it rather than starting a rival
  group (two groups at one physical table has no good resolution).

**Endpoints**: `POST/join/GET :groupCode/PUT :groupCode/my-items` under
`public/restaurants/:restaurantId/group-orders`.

### Files changed

*Backend (new)*: `group-orders/schemas/group-order.schema.ts`,
`group-orders.service.ts`, `group-orders.controller.ts`,
`group-orders.module.ts`.
*Backend (edited)*: `app.module.ts`, `database/database.module.ts`
(register the new module/schema) — nothing else.
*Frontend (new)*: `lib/groupOrder.ts`, `menu/[restaurantId]/group/page.tsx`,
`group/join/page.tsx`, `group/[groupCode]/page.tsx`,
`group/_components/GroupShell.tsx`,
`menu/[restaurantId]/_components/GroupOrderBanner.tsx`.
*Frontend (edited)*: `lib/api.ts` (`groupOrdersApi` + types, appended),
`_components/CustomerAuthPanel.tsx` (optional props),
`home/page.tsx` + `cart/page.tsx` (banner insertion only).

### Tests performed

**Code-level / build verification (actually run):**
- `apps/api`: `tsc --noEmit` clean; `nest build` clean.
- `apps/api`: boot test — full DI graph initializes with `GroupOrdersModule`
  registered, no schema/provider errors. This surfaced and **fixed a real
  bug**: a duplicate `groupCode` index (declared via both
  `@Prop({ unique: true })` and `schema.index()`) that Mongoose warned
  about at boot; re-verified clean afterward.
- `apps/web`: `tsc --noEmit` clean; `next build` clean — **24 routes**
  (21 from Day 19 + 3 new group routes). No existing route changed size
  meaningfully.
- `apps/web`: `next start` runtime check — all three new group routes
  plus `/home` and `/cart` return `200` and render server-side without
  crashing (confirms imports/components resolve at runtime, not just at
  typecheck).
- Pure-logic tests (no DB needed): 200,000 generated codes contained
  **zero** ambiguous characters and were always 5 chars (collision rate
  0.362% across 200k draws against a 28.6M keyspace — which the retry
  loop handles); the join-input sanitizer round-trips every generated
  code unchanged and correctly strips/uppercases 5/5 malformed inputs;
  the lobby's "unshared changes" diff passed 6/6 cases (identical,
  qty-changed, item-added, item-removed, both-empty, cart-emptied).
- Layout audit by grep: group screens have zero fixed/sticky elements
  (no competing nav bars); no fixed pixel widths ≥100px anywhere in the
  new components that could overflow a 375px viewport; truncation
  guards (`min-w-0`/`truncate`) present on every variable-length string.

**NOT tested (no live environment available):**
- **No live MongoDB.** Group creation, joining, the member-isolation
  rules, cross-restaurant code rejection, and session-expiry behavior
  were verified **by code review only** — same standing limitation as
  every prior session (Atlas is unreachable from this sandbox).
- **No live browser session.** Responsive behavior at 375/390/430px and
  tablet/desktop was verified by reading the Tailwind classes used, not
  by rendering in a real viewport.
- **No live OTP.** The auth panel is reused unchanged and was not
  re-exercised; OTP delivery is still dev-mode-only (Day 17 limitation,
  untouched).

### Known limitations
- **Lobby is not live.** Members must tap "Refresh group" to see others'
  additions — no polling/websockets (out of scope per Part 12).
- **Sharing is manual.** Adding to your cart does not automatically
  appear in the group; you must tap "Share my items with the group".
- **No group checkout, no split payment** — explicitly out of scope.
- **No leave-group action.** A member can clear the remembered code by
  hitting a dead lobby, but there's no explicit "leave" button, and
  groups are never closed (`status` is written but nothing sets
  `CLOSED` yet).
- **No restaurant-admin visibility into groups** — out of scope per
  Part 12; groups are invisible to the admin side today.
- Group totals use live menu prices, so a mid-session price change
  shifts the displayed group total (correct for a pre-order view, worth
  knowing).

### What remains for complete group ordering
Live lobby sync (polling or websockets); leave/close-group lifecycle;
combined group checkout producing one `Order` (or linked orders) with
per-member attribution; split payment; restaurant-admin view of an
active group at a table.

**Recommended next task**: close the live-verification gap that now
spans every feature since Day 1 — stand this up against a real Atlas
instance and manually exercise at minimum the group flow
(create → join from a second identity → share items → cross-restaurant
code rejection) and the OTP flow. Every feature in this log is
build-verified and code-reviewed but has never actually run against a
database, and group ordering adds multi-party state where that gap
matters more than it did for single-customer features.

## Day 20 (fix) — Group ordering now produces ONE order

**Reported bug**: a group shared a code, the second person was asked to
verify separately, and then **both members' orders arrived in the admin
order panel as two separate orders for one table**. The table should
send one order.

**Root cause**: the Day 20 foundation deliberately shipped without group
checkout (logged as out of scope). So the lobby had no way to submit,
and each member fell back to the normal Cart → Review → Place Order
path, which correctly created one `Order` *per customer*. The group
lobby was effectively a shared shopping list that never became an order.

### Backend
- `Order.items[]` gained `addedByCustomerId` + `addedByName` — a single
  combined ticket is useless to floor staff if nobody can tell whose
  dish is whose.
- `Order` gained `groupOrderId` + `groupCode`. Their presence is what
  makes an order a group order; there is **no second order collection
  and no second order shape**. A group still produces exactly one
  `Order`.
- `GroupOrder` gained `ORDERED` status + `placedOrderId` /
  `placedOrderNumber`.
- New `GroupOrdersService.placeGroupOrder()`. Mirrors
  `OrdersService.createOrder`'s validation and server-side pricing
  rather than calling it, because the item shape differs (attribution).
  Notable decisions:
  - **Idempotent.** Two members tapping "Place Group Order" at the same
    moment is the expected case, not an edge case — the second call
    returns the same order instead of throwing or duplicating.
  - **Lines are not merged across members.** Two people each ordering a
    coffee is two attributable lines, not `coffee ×2` with the
    attribution lost. Same person + same item *is* merged.
  - Prices still come from MongoDB only; the group document stores just
    item ids and quantities, so there is no client-supplied price to
    trust even accidentally.
  - Requires a live table session and group membership, same as every
    other group operation.
- `POST .../group-orders/:groupCode/place-order`. Any member may submit
  on the group's behalf.
- Admin order serializer now returns `groupCode` and per-item
  `addedByName`.

### Frontend
- **Review page now blocks solo checkout when this browser is in a
  group** and routes to the lobby instead. This is the actual fix for
  the duplicate orders — without it, the old path remained reachable.
- Lobby gained "Place Group Order" (disabled at ₹0), a placed-order
  confirmation screen showing the single order number, the combined
  total, and each line with who it's for, and an "already placed" state.
  Placing clears the personal cart and the remembered group code so
  nobody can wander back into solo checkout with a stale copy of what
  they already ordered.
- Admin orders list + order detail badge group orders and show `for
  <name>` per line.

### Tests performed
- `apps/api`: `tsc --noEmit` clean; `nest build` clean; boot test clean
  (full DI graph, no schema/index warnings).
- `apps/web`: `tsc --noEmit` clean; `next build` clean; `next start`
  runtime check — lobby, review and cart all return `200`.
- Pure-logic tests of the new merge/attribution/idempotency code, run
  standalone: the exact reported scenario (two members, overlapping
  items) produces **one** order with 4 attributable lines and a correct
  combined total; two members ordering the same drink stay separate
  lines; same-person duplicates merge; an empty group yields zero lines
  (service throws); concurrent "place" calls return the same single
  order and leave the group `ORDERED`; join/sync are blocked afterwards.
  **7/7 passed.**
- **Still no live MongoDB, browser or OTP in this sandbox** — the
  end-to-end two-phone flow (create → join → both share → one order in
  the admin panel) is verified by code review and the logic tests above,
  **not** by actually running it. That remains the top thing to confirm
  manually against a real Atlas instance.

### Known limitations (unchanged or new)
- Lobby still isn't live — members tap "Refresh group" to see others'
  items. If someone places the order while another member is mid-add,
  the late items simply aren't included; they'd need a second order.
- Sharing is still manual ("Share my items with the group").
- No split payment, no per-member bill — one order, one total.
- No leave-group action; groups are never auto-closed.

## Day 21 — Customer mobile UI + MnU visual design system

Customer UI only. No backend changes, no admin changes, no new
group-ordering features.

### Design system
Tokens already existed in `app/globals.css` (`@theme`), so they were
**extended, not replaced**. The legacy `brand-*` / `ink-*` / `cream-*`
scales keep their original values on purpose: 30+ files including the
whole admin app consume them, and retuning in place would have silently
restyled admin too. New earthy tokens sit alongside and the customer
screens were migrated onto them.

Added: `canvas` / `canvas-deep` (#F9F5EB), `surface`, `terracotta-*`
(#E07A5F), `sage-*` (#556B2F), `night` (#111111), `carbon-*` text,
`hairline` borders; radii `soft`/`card`/`hero` (20/24/28px); utilities
`shadow-soft`, `shadow-soft-lg`, `shadow-nav`, `drop-food`,
`no-scrollbar`; and a `.mnu-customer` class that paints the canvas on
customer screens only.

**Deliberate deviation from the brief**: true neumorphism (matched
light+dark inset shadows on a same-colour surface) was not used. It
destroys contrast, and this is a menu people read in dim restaurants.
White cards + soft elevation over warm canvas reads as the same
aesthetic while staying legible.

### Home
Hero/featured area (new `FeaturedHeroCard`, variant B) using the first
of the same real featured items — no new "featured" backend flag, no
invented curation. Header rebuilt: restaurant avatar, time-of-day
greeting (from the diner's own device clock — no restaurant timezone
field exists), table + menu-size chips, and a search field that links
into the existing Menu-screen search. Categories became a horizontal
pill rail instead of a grid, keeping Home short and breathable.

### Menu
2-column mobile grid (was 1-column). `MenuItemCard` rebuilt as variant A
— square image, name, description, price, floating round add button
absolutely positioned so long names wrapping to two lines can never
collide with it. Category tabs restyled as dark/white pills, ≥38px.

### Cards + images
Three reusable variants, used where each suits: A standard grid card,
B featured hero, C carousel card (`HomeItemCard`). `QuantityControl`
was **extracted** — identical add/stepper markup was duplicated in three
places and had drifted to different touch-target sizes; one component
now keeps them all ≥32px.

`ItemImage` gained an opt-in `float` mode (`object-contain` +
`drop-food` drop-shadow + scoped `overflow-visible`) for transparent
food PNGs. It is **not** the default — applied to an opaque photo it
would letterbox and shadow a rectangle. Used only on the hero. No image
URLs, storage, or fallbacks were changed.

### Bottom navigation
Now a floating dark (`night`) rounded bar, inset on all breakpoints,
max-w-md, tabs ≥52px. Still exactly **one** fixed bottom element per
screen — the cart strip rides on the same block. The cart page's
checkout bar was repositioned to `bottom-[80px]` with matching inset and
radius, since it had been aligned to the old full-bleed nav height.

### Group ordering compatibility
Business logic untouched — only tokens migrated. Verified: all group
routes still return 200, group context/params preserved, the "in a
group → solo checkout blocked" guard intact, nav does not overlap group
controls (group screens intentionally carry no bottom nav, as before).

### Tests
**Code-level / build (actually run):** `tsc --noEmit` clean (web + api);
`next build` clean; `nest build` + API typecheck clean (API untouched).
`next start` runtime check — home, menu, search, item, cart, review,
group entry/join/lobby, and an admin route all return 200. Verified the
new tokens and all 11 custom utilities actually compile into the emitted
CSS (a bad `@theme` value fails silently otherwise — one typo was caught
this way). Audited: 0 admin files reference new tokens; ≤1 fixed bottom
element per route; `overflow-visible` appears in exactly 2 scoped
places; long-text guards (`line-clamp`/`truncate`/`min-w-0`) present on
all three card variants.

**NOT run:** no live browser, no device, no MongoDB. 375/390/430px
behaviour is verified by reading the Tailwind classes and the layout
audits above — **not** by rendering at those widths. ESLint is not
configured in this project, so no lint run.

### Limitations / remaining customer UI work
- No customer profile/avatar — the data model has no customer photo or
  display name on the menu side, so the header avatar is the restaurant.
  The brief's "Profile" nav tab was therefore **not** added; nav stays
  Home/Menu/Search/Cart, which are real routes.
- No favourites — no backend support; not faked.
- Most food items likely have opaque photos, so `float` mode is used
  only on the hero until transparent assets exist.
- Item detail, review, and confirmation screens got token migration only,
  not a layout redesign.
- Real-device verification at 375/390/430px is the top remaining check.

## Day 22 — Intelligent customer menu: branding, Featured, performance-based Popular

Brand → Featured → Popular → Categories → Full menu. No AI, no scoring
engine, no new group-ordering work.

### What already existed (inspected, reused)
`Category.sortOrder` (explicit category order — reused, never re-sorted
alphabetically); `OrdersService.getPopularItems()` (real order-derived
popularity, Day 14 — extended, not rebuilt); `getPublicMenu`,
`resolveImageUrl`, `ItemImage` fallbacks, Day 21 design tokens, the
admin menu-management screen, `CustomerBottomNav`, group ordering
(untouched).

### What was missing (inspection findings that changed the plan)
- `Restaurant` had **only** `name` — no branding fields of any kind.
- `MenuItem` had **no** `isFeatured`. Days 14 and 21 both stood in "first
  item of each category by sortOrder" as a placeholder. That placeholder
  is now removed.

### Backend
- `Restaurant`: +`logoUrl`, +`primaryColor`, +`accentColor` (minimum
  three; all nullable, all with defined customer-side fallbacks).
- `MenuItem`: +`isFeatured` (boolean flag on the item itself — **not** a
  separate collection, so the dish keeps one identity and is never
  duplicated).
- `MenuService.setFeatured()` + `PATCH /restaurants/:id/menu-items/:itemId/featured`.
  Manager-only (`requireManager`), deliberately stricter than
  `setAvailability`'s staff-level check: 86'ing a dish is operational,
  promoting one is editorial.
- `serializeItem` / `getMenu` / `getPublicMenu` expose `isFeatured`;
  `getPublicMenu` also returns a `branding` block (those three fields
  only — nothing else on the Restaurant document is public).
- **Security fix (Part 17)**: `getPopularItems` was returning
  `orderCount` on a public, unauthenticated endpoint — i.e. publishing
  real per-dish sales volume to anyone with a menu URL. Removed from the
  payload; it still ranks server-side. Customers see the ordering, never
  the numbers.
- Added `MIN_ORDERS_TO_BE_POPULAR = 3`. One or two orders is noise, not
  popularity; below the bar the item is dropped, which can legitimately
  leave the section empty — the intended outcome rather than padding it.

### Customer frontend
- **Header**: real logo when set, else an initial-letter avatar tinted
  with the brand colour; restaurant name promoted to `text-2xl` as the
  most prominent element; table chip picks up the brand colour. New
  `_components/branding.ts` validates hex colours before they reach an
  inline `style` and falls back to the MnU palette — the fields have no
  admin UI validating them, and unvalidated stored text must not land in
  a style attribute.
- **Loading**: skeleton rewritten to mirror the real Home layout
  block-for-block (logo/name, chips, search, banner, hero, two rails,
  category rail, button) so nothing shifts on load. **Honest constraint**:
  it cannot use brand colours — branding arrives in the very response
  being awaited — so it uses MnU defaults by necessity.
- **Featured section**: now driven by admin `isFeatured`. Empty ⇒ hero
  and rail both hidden, not backfilled.
- **Popular section**: renamed "Most ordered / Loved by other diners";
  hidden entirely when real data is insufficient.
- **Visibility hierarchy (Part 7)**: one badge maximum per item, resolved
  Featured > Popular > New. Featured items are excluded from the Popular
  rail, and both from New Arrivals, so Home doesn't repeat itself.
  Featured cards get a ring; Popular gets a plain chip; normal cards stay
  plain.
- **Category highlighting (Part 9)**: featured/popular items stay in
  their own category on the menu grid and are badged there. The menu
  page makes one extra `getPopular` call purely to know which ids to
  badge; it soft-fails to no badges.

### Admin
Featured toggle (`☆ Feature` / `★ Featured`) added to the **existing**
`ItemRow` on the menu management screen, plus a Featured pill next to the
86'd pill. No separate admin page.

### Tests
**Actually run:** `tsc --noEmit` clean (web + api); `nest build` clean;
`next build` clean — **24 routes, count unchanged** (no accidental new
routes). `next start` runtime check: home, menu, cart, review, group
entry, group join, admin menu, admin dashboard all **200**. Verified the
server-rendered Home contains the skeleton (`animate-pulse`,
`mnu-customer`) and **zero** "Featured"/"Popular" strings before data
arrives — i.e. no fabricated content at first paint. Verified all six
new/used design-token classes compile into the emitted CSS. Layout audit:
zero fixed widths ≥100px anywhere under `app/menu` (375px overflow
risk), truncation guards present on the card.

**NOT run:** no live MongoDB, no browser, no device. Featured toggling
end-to-end, the popularity threshold against real orders, and
375/390/430/768/1280px rendering are **code-level verification only** —
the responsive claims come from reading Tailwind classes, not from
rendering at those widths.

### Limitations / remaining work
- **No admin UI or write API for branding.** There is no
  `RestaurantsService`/`Controller` in this project at all, so the three
  new fields must currently be set directly in MongoDB. Day 22's admin
  scope was explicitly only the Featured toggle, so this was left as a
  documented gap rather than half-built.
- Loading skeleton can't be brand-coloured (see above).
- No vegetarian/non-vegetarian indicator: no such field exists on
  `MenuItem` and one was not invented.
- The menu grid makes one extra `getPopular` request for badge ids;
  acceptable (small, cached-per-load, soft-failing) but it is a second
  call, not a single combined one.
- Real-device verification remains the top outstanding check, as it has
  been since Day 1.

**Suggested next task**: restaurant settings screen + write API for
branding — the fields now exist and the customer UI consumes them, but
nothing can set them yet.

## Day 23 — Live customer UI: transitions, loading sequence, micro-interactions

Frontend-first, as instructed (~70/30). No backend changes — the
existing Featured/Popular/branding APIs (Day 22) already provided
everything this day's UI needed; inspected first, nothing was added.
No animation library installed (checked `package.json` before starting
— none was present, and the task says not to add one), so everything
below is plain CSS keyframes/utilities plus React state, reused as the
same few primitives across every screen rather than each screen
inventing its own motion.

### Motion primitives (`globals.css`)
Four keyframes/utilities: `animate-fade-in`, `animate-fade-slide-up`,
`animate-scale-in` (mount entrances, 220–320ms), `animate-pop` (one-shot
"that registered" pulse — not a loop). All neutralised to a 1ms snap
under `prefers-reduced-motion: reduce` rather than skipped outright,
so staggered content doesn't get stuck at `opacity:0` for a diner with
that setting on.

### New: `PageTransition`
One shared component (`_components/PageTransition.tsx`) — a mount-
triggered fade+slide, applied on Home, full Menu, Item Detail, and Cart.
This is the "connected transitions between routes" requirement, done
honestly: it is **not** a cross-route shared-element transition (the
image doesn't literally fly from card to detail page) — that needs
either a library or the browser's experimental View Transitions API,
neither of which this task allows/stably supports here. What it does
give: every screen enters the same way, so navigating Home → Category →
Dish → Cart feels like one continuous app rather than a stack of
documents snapping into place.

### Premium loading sequence
`HomeSkeleton` rewritten from one flat `animate-pulse` block into staged
entrances — header → context chips/search → group banner → hero → two
rails → category rail → CTA — each fading/sliding in with increasing
delay, each pulsing independently once visible. `MenuSkeleton`'s grid
cards got the same per-card stagger. **Honest constraint, unchanged
from Day 22**: this still can't be branded (logo/colour arrives in the
same response being awaited) and still doesn't block interaction —
`PageTransition` takes over the instant the real fetch resolves, there
is no artificial wait added anywhere.

### Menu card interactions / add-to-cart feedback
`QuantityControl` (the one shared add/stepper component) now plays a
`animate-pop` on itself and bumps the quantity number
(`key={quantity}` + `animate-scale-in`) the instant Add is tapped — this
is the "customer understands it was added without leaving the menu"
requirement, done inline rather than with a toast on every tap.
`MenuItemCard` / `HomeItemCard` gained hover/tap image scale
(`group-hover:scale-105`), card press feedback (`active:scale-[0.97-0.98]`),
and an optional `animationDelayMs` prop used by their grids/rails for a
staggered first appearance (capped — `Math.min(i, 9) * 40ms` on the
menu grid — so a big menu's last cards don't wait a visibly long time).

### Featured / Most Ordered visual variety
`FeaturedHeroCard` (the one large hero) gets a scale-in entrance and
image hover-scale; the rest of Featured and all of Most Ordered
continue to use the same compact `HomeItemCard` rail, which is what
already created the "large hero vs compact rail" contrast Day 21/22
built — kept, not rebuilt. Multiple featured items were already a
user-controlled horizontal rail (never autoplay); unchanged.

### Category navigation
`CategoryTabs` now scrolls the active tab into view within its own
rail (`scrollIntoView({inline:'center'})`) whenever the active category
changes — from a tap *or* from scrollspy as the diner scrolls the menu.
Previously a restaurant with many categories could scroll the active
highlight out of view with no way back to it except scrolling the pill
rail by hand.

### Bottom navigation
One shared translucent pill (`bg-surface/10`) now slides between tabs
via a CSS `transform` transition (`translateX(index * 100%)`) instead of
each tab independently swapping its own background — this is what
makes the active state read as *moving* rather than four buttons
blinking on/off. Cart badge plays `animate-pop` exactly once when the
count increases (tracked via a ref, not on every render/navigation).
Existing floating dark-bar identity, spacing, and the "exactly one
fixed bottom element per screen" rule are all unchanged.

### Item detail transition
Wrapped in `PageTransition`; image gets `animate-scale-in`, the price/
description block a slightly delayed `animate-fade-slide-up`, quantity
stepper the same bump-on-change as elsewhere, and the Add to Cart
button real press feedback (previously had none beyond the disabled
state). Business logic (fetch-whole-menu-then-find-item, the 500ms
redirect-after-add) is untouched — frontend polish only, per the task.

### Cart micro-interactions
Cart rows get a staggered entrance on mount; the sticky checkout bar
now enters with `animate-fade-slide-up` instead of appearing instantly;
quantity steppers get the same bump-on-change treatment as the menu
grid, so cart and menu now feel like the same control everywhere
instead of two different implementations (which they were, before
today, at slightly different touch sizes even).

### Group Ordering compatibility
**Not modified.** Grepped every file under `app/menu/[restaurantId]/group/`
for the components changed today (`CustomerBottomNav`, `QuantityControl`,
`MenuItemCard`, `HomeItemCard`) — zero matches. `GroupOrderBanner.tsx`
(used on Home and Cart, both changed today) was not edited at all, and
its call sites still pass it the same two props. Group routes appear
unchanged in the build's route list (same 24 total as Day 22).

### Visual identity
No new colours introduced — every addition uses the existing Day 21/22
token set (`terracotta`, `sage`, `night`, `carbon-*`, `canvas`,
`shadow-soft*`). Nothing here changes the palette; it changes how the
existing palette moves.

### Backend
None. Inspected `getPublicMenu`, `getPopularItems`, and the branding
fields (all Day 22) — all sufficient for everything above.

### Tests performed
**Actually run:** `apps/web`: `tsc --noEmit` clean; `next build` clean —
**24 routes, same as Day 22** (no accidental new/missing routes,
including all group routes). Reviewed the diff for: no new client/server
boundary violations (`'use client'` present everywhere a hook/animation
was added), no prop-signature changes to any shared component that
would break an existing call site (`QuantityControl`, `MenuItemCard`,
`HomeItemCard`, `CustomerBottomNav`, `FeaturedHeroCard` all kept their
existing required props; new props are optional/additive only), no
hydration-risk patterns (animation state is initialized identically on
server and client — `entered=false` — and only flips client-side via
`useEffect`, so SSR/CSR markup matches at hydration).

**NOT run — stated plainly, per the task's own instruction not to claim
otherwise:** no live browser, no real device, no MongoDB. **Responsive
behavior at 375 / 390 / 430 / 768 / 1280px is verified from code/static
analysis only** — reading the Tailwind classes and the layout patterns
carried over unchanged from Day 21/22 (which were themselves only
code-verified) — not by actually rendering at those widths. Nothing
about today's animations was exercised in a real browser; CSS keyframe
syntax and Tailwind's `@utility` compilation were checked by reading
the emitted rules in `next build`'s output, not by watching them play.

### Known limitations
- No true shared-element/cross-route image transition — see
  `PageTransition`'s comment above for why, and what would be needed
  (a library, or a stable View Transitions API) to do better.
- Loading sequence still can't be brand-coloured (unchanged from Day 22
  — branding arrives in the response being awaited).
- Entrance stagger on the menu grid resets on every search-query change
  (each filtered set is a fresh set of mounted cards) — acceptable
  (matches "results just appeared") but worth watching if it ever reads
  as jumpy with a fast typist.
- Real-device/browser verification remains the single largest
  outstanding gap in this project, unchanged since Day 1 — today added
  more motion that has specifically never been watched play.

**Suggested next task**: stand this project up against a real browser
and a real MongoDB Atlas instance (or any reachable instance) at least
once — verify the Day 23 animations actually run smoothly on a real
375px device, confirm the loading stagger doesn't feel slow on a real
network, and close the "code-review only" gap that has now spanned
every feature since Day 1.
