# project.md — Project Identity & Stack

## App
**HNPSystem** — Dealer Management System for Humphries & Parks.

## Stack
- Next.js (Pages Router)
- React
- Supabase (PostgreSQL)
- NextAuth.js (Credentials Provider → Supabase `users` table; Keycloak env vars exist but are not active yet)
- Tailwind CSS v4 + CSS custom properties
- Prisma schema at `prisma/schema.prisma` (Vehicle, Customer, JobCard, PartsRequest, TimeEntry, MotTest, Sale)

## Conventions
- Path alias: `@/` → `src/`
- `.js` only, no `.tsx`
- Every new file starts with `// file location: <path>`
- Features grouped under `src/components/<Feature>/` or `src/features/<feature>/`

## Branching
- `main` is the working branch.
- Commit only when the user asks. Use the existing commit message style.

## Root Source of Truth
The repo-root `CLAUDE.md` is the master rules file. `docs/ai/CLAUDE.md` is the slim router. If they conflict, the root file wins — flag the conflict.
