Apply after access groups ship and first seeding has run on every install. Move into a migration on merge day.

Dropping the table is not only SQL. The same merge-day change also:

- removes the `UserPermission` model and its two relation fields on `User` from `schema.prisma`, then regenerates the client;
- removes `LEGACY_PROFIT_KEY` and its `userPermission` query from `packages/db/src/access-resolve.ts`;
- removes the `userPermission` rows and the "Office + profit" expectation from `packages/db/src/access-resolve.test.ts`.
