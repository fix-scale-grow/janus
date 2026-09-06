# HOLD — do not apply until merge

This migration drops the `company` and `companyEnrichment` tables, every
`companyId` column, index and foreign key across contact, deal,
agentConversation, agentTask, fieldValue, activity, emailThread and
calendarEvent, the contact social columns (`linkedinUrl`, `twitterUrl`,
`githubUrl`), and the `COMPANY` member of `FieldEntity`. Peer branches still
read these tables through code that has not merged this phase's removal, so
running it now breaks their sessions against the shared dev database.

Apply only when every branch touching Company has merged and no surviving
code path reads a company table or column. At that point, from
`packages/db`:

```
bunx prisma db execute --file prisma/migrations/20260906020000_drop_companies/migration.sql
bunx prisma migrate resolve --applied 20260906020000_drop_companies
```

`prisma migrate status` shows this migration pending until then. That is
expected, not a bug.
