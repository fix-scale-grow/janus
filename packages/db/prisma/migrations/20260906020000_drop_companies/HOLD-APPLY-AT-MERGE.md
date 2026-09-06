This migration is APPLIED to the shared dev database as of 2026-09-06.

The hold failed: `packages/db/scripts/prepare-dev.ts` runs `prisma migrate
deploy` unconditionally on every `bun run dev`, so the first dev-stack start
on this branch applied the drops. Peer branches that still query company
tables break at runtime against this database until they rebase onto this
branch. A fresh install is unaffected: the migration chain is consistent.

Lesson for the next staged migration: a committed migration cannot be held
on a shared database while `prepare-dev.ts` auto-deploys. Stage held DDL
outside `prisma/migrations/` (or add a hold-list guard to prepare-dev)
instead.
