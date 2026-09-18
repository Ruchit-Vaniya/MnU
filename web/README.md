# MnU — Frontend (apps/web)

Next.js 15 (App Router) + React 19 + TypeScript + Tailwind v4.

This is the frontend half of the MnU monorepo, packaged standalone here for
convenience. In the actual project it lives at `apps/web/` alongside the
NestJS backend (`apps/api/`) under a pnpm + Turborepo workspace.

## Setup
```bash
npm install
cp .env.example .env.local   # set NEXT_PUBLIC_API_URL to your running backend
npm run dev                  # http://localhost:3000
```

## Pages
- `/` — landing page, links to everything below
- `/register` — real signup form, calls `POST /auth/register` on the backend
- `/login` — real login form, calls `POST /auth/login`
- `/dashboard` — proves the issued token works, via `GET /auth/me`; lists your restaurants + roles, with a "Manage menu" link per restaurant
- `/restaurants/[restaurantId]/menu` — **real** menu management screen: add/rename/delete categories, add/edit/delete items, toggle an item's availability. `RESTAURANT_ADMIN`/`SUPER_ADMIN` get full edit rights; `RESTAURANT_STAFF` gets read-only + availability toggling. Ported over from `mnu_v1`, unchanged (this page has no ORM dependency of its own — see `docs/PROGRESS.md`).
- `/menu/demo` — **dummy data only**, clearly labeled on the page. No public/customer-facing menu backend exists yet, so this just previews layout.

## Structure
- `lib/api.ts` — small fetch wrapper; stores the JWT in `localStorage`, attaches it as `Authorization: Bearer <token>`. Exports `authApi` and `menuApi`.
- `app/*/page.tsx` — one folder per route (Next.js App Router convention)
- `app/globals.css` — Tailwind v4 theme (brand color tokens)

## Requires
A running instance of the backend (`apps/api`) connected to MongoDB via
Mongoose — see `docs/DATABASE.md`. This project no longer uses Prisma.
