# Companies Removal — Design

Date: 2026-09-05. Ordered by Kyle: remove the Companies section; company becomes
plain text on the contact; GitHub, LinkedIn and X fields go away. Janus serves
blue-collar trades; the B2B company graph inherited from the upstream fork is
dead weight.

## Goal

1. Delete the Companies module everywhere: UI section, API module, agent
   tools, mailbox auto-creation, seeds.
2. `Contact.companyName String?` — a plain, manually edited text field on the
   contact sheet. Backfilled from the linked Company's name.
3. `Deal` loses `companyId` with NO replacement field. People attach to deals
   through the existing `DealContact` join; deal creation no longer requires
   a company.
4. Remove `linkedinUrl` / `twitterUrl` / `githubUrl` from Contact (Company
   dies whole), the socials UI, the agent social tools, and the
   GitHub-avatar portrait source.

Out of scope: renaming files/routes shared with other features, the marketing
landing `product-shot` components (cosmetic, a later rebrand pass), the
`design/v0-suite` prototype, rewriting agent skill prose beyond deleting
company-specific instruction files.

## The two-migration strategy (shared dev DB safety)

Peer sessions run live against the same Postgres with code that still reads
company tables. Destructive drops applied now break them. Therefore:

- **Migration F1 — applied now, peer-safe:** `ALTER TABLE deal ALTER COLUMN
  "companyId" DROP NOT NULL;` + `ALTER TABLE contact ADD COLUMN "companyName"
  TEXT;` + backfill `UPDATE contact SET "companyName" = company.name FROM
  company WHERE contact."companyId" = company.id;` Nothing dropped. Peer code
  keeps working unchanged.
- **Migration F2 — staged, NOT applied:** all destructive DDL (drop
  `company`/`company_enrichment` tables, every `companyId` column + index +
  FK across contact/deal/agent_conversation/field_value/activity/
  email_thread/calendar_event, `agentTask.companyId` loose column, contact
  social columns, the `COMPANY` member of `FieldEntity`). Lives in the
  migrations dir with a `HOLD-APPLY-AT-MERGE.md` note beside it explaining:
  apply with `prisma db execute` + `migrate resolve --applied` when this
  branch merges and every peer branch has dropped its company reads.
  `prisma migrate status` on this branch shows it pending — expected.

The Prisma schema in this branch reflects the FINAL state (no Company model,
no social fields, no companyId anywhere, `Contact.companyName`). Leftover DB
tables/columns are invisible to the new client. The one runtime dependency on
F1 is `deal.companyId` nullability (new deals insert without it).

## Schema changes

Remove: `model Company`, `model CompanyEnrichment`, `enum` references, every
`companyId` field + relation + index on Contact, Deal, AgentConversation,
FieldValue (+ its `@@unique([fieldId, companyId])`), Activity, EmailThread,
CalendarEvent; `AgentTask.companyId` (loose column); `User.ownedCompanies`;
`Contact.primaryOf`; `Contact.linkedinUrl/twitterUrl/githubUrl`;
`FieldEntity.COMPANY`. Add: `Contact.companyName String?`.

## API (apps/api)

- Delete `src/companies/` — EXCEPT `domain.ts` (`domainFromEmail`,
  `normalizeDomain`, `isMachineDomain`), which moves to
  `src/mailbox/domain.ts`; update importers (mailbox/participants.ts,
  tracking-filing.service.ts, workspace.service.ts).
- Unregister `CompaniesModule` from app.module.ts.
- **contacts**: drop company relation/facet/sort/bulkSetCompany/auto-assign-
  by-domain (create no longer touches CompanyDirectoryService); add
  `companyName` to create/update inputs (trimmed, max 200, blankToNull) and
  selects. Socials dropped from contracts + service writes.
- **deals**: drop companyId from create/update/contracts, COMPANY_SELECT,
  includes, companyOf(), the "contact works at the deal's company"
  attach guard (any contact may attach), search joins, stage-move logic that
  touches company.
- **mailbox**: `MailboxMatchService` no longer auto-creates or matches
  companies; threads file to contacts only. `thread-writer.service.ts` drops
  company stamping.
- **tracking**: form submissions file to contact only; `companyActivity`
  procedure and contracts entries removed.
- **activities / search / dashboard / conversations / crm(activity-stamp,
  enrichment-log) / backfill / settings / workspace / telemetry rollup /
  fields**: strip company branches. `BackfillScope` loses "companies";
  brand/artwork backfill paths die. `FieldEntity.COMPANY` handling removed
  from fields module and `packages/db/src/fields-shape.ts`.
- Regenerate `src/generated/server.ts` (companies router disappears).
- Tests for deleted modules are deleted; tests of surviving modules updated.

## Agent (apps/agent)

- Delete tools: enrich_company, research_company, read_company_history,
  set_contact_socials, find_contact_socials.
- Strip company/social awareness from: search_crm, list_deals,
  read_deal_history, read_crm_history, record_job_change,
  resolve_linkedin_profile + get_linkedin_profile (DELETE — LinkedIn is
  gone), research_person (drop social/company outputs), set_field_value /
  manage_fields / list_fields / archive_field (COMPANY entity),
  write_workspace_profile untouched (its "company" is the workspace),
  subagent tools (query_crm, read_crm_record, create_crm_activity).
- lib: brand.ts, enrichment.ts company writes, brand-mapping.ts socials,
  portrait-sources.ts/portrait.ts GitHub+LinkedIn sources, accounts.ts
  readCompanyHistory, lookup.ts, preamble.ts company naming, run-runtime.ts
  company reads/writes, tasks/dispatch/focus/custom-agent-dispatch
  "company-profile" task-kind routing (kind removed from
  packages/db/src/agent-tasks.ts), agent-trigger paths in the API.
- Delete skill prose: skills/identity-matching.md company sections (delete
  file if it is only that), scripts/backfill-brand-images.ts.

## App (apps/app)

- Delete: companies routes (`[slug]/companies/**`), company-sheet.tsx,
  company-picker.tsx, company-cell.tsx, enrichment-actions.tsx (company
  enrich/research UI), social-links.ts + social-links.tsx.
- Nav: janus-nav.ts Companies entry removed; proxy.ts SECTIONS loses
  "/companies"; record-href.ts, record-stack.ts (RECORD_KINDS →
  contact/deal), record-sheet-host, record-actions, record-prefetch,
  section-prefetch, quick-switcher, cache.ts company invalidations,
  agent-record/agent-bridge/agent-panel/agent-conversations/agent-transcript
  company branches.
- Contact sheet: `InlineCompanyField`/`CompanyStat` replaced by a plain
  inline text field bound to `companyName`; LinkedIn/X/GitHub rows removed.
- Deal sheet + create sheets: company field/requirement removed; deals-table,
  deals-board, contacts-table (facet), bulk actions, quick-add,
  dashboard-summary stripped.
- standard-fields.ts: COMPANY block, contact LinkedIn/GitHub/Company entries,
  deal Company entry removed.

## Packages

`packages/db/src`: crm-events (`company.created`), agent-tasks
("company-profile"), fields-shape (COMPANY), images (COMPANY_IMAGE_FIELDS),
workspace RESERVED_SLUGS keeps "companies" (old URLs must not collide with a
future workspace slug — cheap to keep). `packages/telemetry/src/allowlist.ts`
and `packages/validation/src/agents.ts` company enums removed. seed.ts:
companies seeding removed; contacts seed standalone with `companyName` text;
deals seed without companyId.

## Docs

Update `docs/api.md` sections that become false: deleting a record (company
paragraphs), people on a deal (works-at guard), mailbox company auto-create
rules, activity-stamp company where-clauses. One honest pass, not a rewrite.

## Verification

Full `check-types` across the monorepo; api suites that survive; app
templates tests; dev-stack smoke: create contact with typed company name,
create deal WITHOUT company, attach contact, send estimate (regression:
phase-e flows untouched), mailbox module boots. `migrate status` shows only
F2 pending.
