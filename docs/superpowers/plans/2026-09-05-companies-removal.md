# Companies Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the B2B Companies graph from Janus — company becomes plain text on Contact, deals need no company, GitHub/LinkedIn/X fields die — without breaking the shared dev DB that live peer sessions depend on.

**Architecture:** Schema flips to the final no-Company state in one commit, but the database changes ship as two migrations: F1 (applied now, additive/relaxing — nullable deal.companyId, new contact.companyName, backfill) and F2 (staged destructive drops, committed but NOT applied until merge day, with a HOLD note). Code removal then proceeds top-down: API core CRM, API periphery, agent, app UI, packages/seeds, docs + walkthrough.

**Tech Stack:** Prisma, NestJS + nestjs-trpc, Next.js App Router, existing repo tooling (Bun, biome).

**Spec:** `docs/superpowers/specs/2026-09-05-companies-removal-design.md`

## Global Constraints

- Repo AGENTS.md: NO code comments, NO Co-Authored-By trailers, parse-at-boundary, config constants in *.config.ts, ASD-STE100 issue lists in reports.
- NEVER apply destructive DDL to the shared dev DB. Migration F2 is committed but not executed; `prisma migrate status` showing F2 pending is the expected end state. NEVER run `prisma migrate reset` or `migrate dev` (drift-blocked by peer state — see the F1 hand-build recipe in Task 1).
- `apps/api/src/generated/server.ts` regenerates ONLY via `bun run check-types` in apps/api; commit it with the change that alters routers.
- apps/app runs a NEWER Next.js than training data — consult `apps/app/node_modules/next/dist/docs/`.
- Deleting code beats commenting it out. Tests of deleted modules are deleted; surviving tests updated, never weakened.
- Phase-e (contracts/templates) flows are regression surface: estimates/invoices/contracts/templates must keep passing their suites untouched.
- Bun at `C:\Users\Kyle\.bun\bin` (prepend PATH). Worktree root: `C:\Users\Kyle\janus\.claude\worktrees\phase-f-companies`.
- Commit per task, `feat:`/`fix:`/`chore:` style.

---

### Task 1: Schema, migration F1 (applied), migration F2 (staged)

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (remove Company/CompanyEnrichment models, every companyId field+relation+index listed in the spec's Schema changes section, Contact socials, FieldEntity.COMPANY, User.ownedCompanies, Contact.primaryOf; add `companyName String?` to Contact)
- Create: `packages/db/prisma/migrations/<now>_relax_company_for_removal/migration.sql` (F1)
- Create: `packages/db/prisma/migrations/<now+1>_drop_companies/migration.sql` (F2) + `HOLD-APPLY-AT-MERGE.md` beside it
- Modify: `packages/db/src/fields-shape.ts` (COMPANY entity), and fix any packages/db compile fallout from the schema change ONLY (deeper src cleanup is Task 6)

**Interfaces:**
- Produces: Prisma client with `Contact.companyName`, no Company model, nullable-nothing (companyId gone from the client entirely). F1 applied to dev DB; F2 pending.

- [ ] **Step 1: Edit schema.prisma to the final state per spec.**
- [ ] **Step 2: Write F1 by hand** (three statements: deal.companyId DROP NOT NULL; contact ADD companyName TEXT; backfill UPDATE from company). Apply it: `bunx prisma db execute --file ... --schema prisma/schema.prisma`, then `bunx prisma migrate resolve --applied <F1-name>`.
- [ ] **Step 3: Generate F2 SQL** with `bunx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url "postgresql://postgres:postgres@localhost:5432/crm_shadow_phase_f" --script` — BUT the from-migrations state includes peer history gaps; verify the output contains ONLY drops of company objects/columns/socials + the FieldEntity enum change, and manually remove anything touching peer objects (service modifier etc.). Do NOT execute it. Do NOT `migrate resolve` it. Write `HOLD-APPLY-AT-MERGE.md` beside it: one paragraph, the apply commands, the precondition (all branches merged, no code reads company).
- [ ] **Step 4:** `bunx prisma generate`; fix packages/db/src compile errors from the missing model (fields-shape COMPANY, images COMPANY_IMAGE_FIELDS export removal is Task 6 — here only enough for `bun run check-types --filter @crm/db` to PASS; if images.ts/crm-events.ts break compile, strip their company exports now and note it).
- [ ] **Step 5: Verify** `migrate status` shows exactly one pending (F2); `check-types --filter @crm/db` PASS.
- [ ] **Step 6: Commit** — `feat: remove company from the schema with staged drop migration`

### Task 2: API core CRM — companies module out, contacts/deals rewired

**Files:**
- Delete: `apps/api/src/companies/` (all) — after moving `domain.ts` → `apps/api/src/mailbox/domain.ts` (update importers: `mailbox/participants.ts`, `tracking/tracking-filing.service.ts`, `workspace/workspace.service.ts`, any others grep finds)
- Modify: `apps/api/src/app.module.ts` (unregister CompaniesModule)
- Modify: `apps/api/src/contacts/{contacts.contracts.ts, contacts.service.ts, contacts.module.ts}` — drop company relation/facet/sort/bulkSetCompany/auto-assign/CompanyDirectoryService import + socials; add `companyName` (trim, max 200, blankToNull like other optional text fields) to create/update/selects
- Modify: `apps/api/src/deals/{deals.contracts.ts, deals.service.ts}` — companyId out of create/update, COMPANY_SELECT/includes/companyOf()/attach-guard/search/stage-move company logic out
- Test: update `apps/api/test` contacts/deals specs (delete bulkSetCompany cases, add companyName create/update case, deal create without company case); delete companies specs

**Interfaces:**
- Consumes: Task 1 client. Produces: contacts router without bulkSetCompany, with companyName; deals router whose create needs no companyId. `domainFromEmail`/`isMachineDomain` now import from `../mailbox/domain`.

- [ ] **Step 1:** Move domain.ts + update importers; delete the module; unregister.
- [ ] **Step 2:** Contacts + deals rewiring per spec (TDD on the changed service behavior: failing spec for companyName round-trip and company-free deal create first).
- [ ] **Step 3:** Run contacts/deals/estimates/invoices/contracts suites; `bun run check-types` in apps/api (server.ts regenerates — companies router gone; commit it).
- [ ] **Step 4: Commit** — `feat: remove companies module and rewire contacts and deals`

### Task 3: API periphery — mailbox, tracking, everything else

**Files:**
- Modify: `apps/api/src/mailbox/{mailbox-match.service.ts, thread-writer.service.ts, participants.ts, mailbox.module.ts}` — no company matching/auto-create/stamping
- Modify: `apps/api/src/tracking/{tracking-filing.service.ts, tracking.router.ts, tracking.contracts.ts, tracking.service.ts, tracking.module.ts}` — contact-only filing, companyActivity procedure removed
- Modify: `apps/api/src/{activities, search, dashboard, conversations, crm (activity-stamp, enrichment-log), backfill, settings, workspace, telemetry, fields, agents (agent-trigger.service.ts, agent-queue.service.ts, agents.contracts.ts)}` — strip company branches per the spec's API section; BackfillScope loses "companies"; "company-profile" trigger paths removed
- Test: update/delete affected specs
- Modify (generated): server.ts via check-types

**Interfaces:**
- Consumes: Task 2 state. Produces: no API code path references the Prisma company model (grep proof: `rg -i "company" apps/api/src --type ts` returns only workspace-profile/self-business senses and moved domain.ts internals).

- [ ] **Step 1:** Work module by module in the order listed; run each module's spec as you go.
- [ ] **Step 2:** The grep proof above; paste the residual-hits list in the report with one-line justification each.
- [ ] **Step 3:** Full api relevant suites + check-types (commit server.ts).
- [ ] **Step 4: Commit** — `feat: strip company from api periphery`

### Task 4: Agent (apps/agent)

**Files:**
- Delete: `agent/tools/{enrich_company.ts, research_company.ts, read_company_history.ts, set_contact_socials.ts, find_contact_socials.ts, resolve_linkedin_profile.ts, get_linkedin_profile.ts}`; `scripts/backfill-brand-images.ts`
- Modify: the company/social-aware tools + lib files listed in the spec's Agent section; task-kind routing (tasks/dispatch/focus/custom-agent-dispatch) drops "company-profile" (kind removed from `packages/db/src/agent-tasks.ts` here); skills prose files with company-only content deleted, mixed files edited
- Test: agent suite if one exists for touched files (check `apps/agent/package.json`)

**Interfaces:**
- Consumes: Tasks 1-3. Produces: agent compiles with no company/social references (same grep proof, `apps/agent`); tool registry has no dead entries (find where tools register and prune).

- [ ] **Step 1:** Delete tools + prune registry; strip libs per spec (brand.ts et al — where a file is >80% company logic, delete the file and its callers rather than hollowing it; report which).
- [ ] **Step 2:** Typecheck agent (`bun run check-types` scoped) + any suite.
- [ ] **Step 3:** Grep proof with residual-hit justifications (write_workspace_profile's workspace-sense "company" stays).
- [ ] **Step 4: Commit** — `feat: remove company and social enrichment from the agent`

### Task 5: App UI

**Files:**
- Delete: `app/(app)/[slug]/companies/**`, `components/crm/record-sheet/company-sheet.tsx`, `components/crm/{company-picker.tsx, company-cell.tsx, enrichment-actions.tsx}`, `lib/social-links.ts`, `components/crm/social-links.tsx`
- Modify: `lib/janus-nav.ts`, `proxy.ts` SECTIONS, `lib/record-href.ts`, `components/crm/record-sheet/{record-stack.ts, record-sheet-host.tsx, record-actions.tsx, record-prefetch.ts, contact-sheet.tsx, deal-sheet.tsx, quick-add.tsx}`, `components/crm/{section-prefetch.ts, quick-switcher.tsx, agent-panel.tsx, agent-conversations.tsx}`, `lib/{trpc/cache.ts, agent-record.ts, agent-bridge.ts, agent-transcript.ts}`, `app/(app)/[slug]/{contacts/*, deals/*, dashboard-summary.tsx}`, `components/crm/fields/standard-fields.ts`
- Contact sheet gains the inline `companyName` text field (copy the existing inline-text-field pattern used for e.g. title/phone on that sheet)

**Interfaces:**
- Consumes: contacts router companyName, deals router company-free create. Produces: app compiles and renders with no company surface; contact sheet edits companyName inline; deal create sheet has no company field.

- [ ] **Step 1:** Deletions + nav/proxy/record plumbing.
- [ ] **Step 2:** Sheet/table/board/bulk/quick-add/dashboard rewiring; standard-fields pruning (COMPANY block, LinkedIn/GitHub/Company entries).
- [ ] **Step 3:** `bun run check-types --filter app` + biome + components/templates bun tests still pass (phase-e regression).
- [ ] **Step 4: Commit** — `feat: remove companies from the app`

### Task 6: Packages + seeds

**Files:**
- Modify: `packages/db/src/{crm-events.ts, agent-tasks.ts (if not done in T4), images.ts, workspace.ts (RESERVED_SLUGS: KEEP "companies"), fields-shape.ts (verify done in T1)}`, `packages/telemetry/src/allowlist.ts`, `packages/validation/src/agents.ts`, `packages/db/prisma/seed.ts` (contacts seeded standalone with companyName text; deals without companyId; company seeding/icons gone)
- Test: run the seed against a scratch check (`--help`/dry parse) or typecheck only — do NOT reseed the shared dev DB

**Interfaces:**
- Produces: monorepo-wide grep for the Prisma company model returns nothing; seeds runnable on a fresh install.

- [ ] **Step 1:** Prune per spec; keep RESERVED_SLUGS entry with nothing else (route may return someday; slug collision is the cheap insurance — spec ruling).
- [ ] **Step 2:** Full-repo `bun run check-types`.
- [ ] **Step 3: Commit** — `feat: remove company from packages and seeds`

### Task 7: Docs + walkthrough

**Files:**
- Modify: `docs/api.md` (deleting-a-record company paragraphs, people-on-a-deal works-at guard, mailbox company auto-create rules, activity-stamp where-clauses — one honest pass)
- Modify: whatever the walkthrough surfaces

- [ ] **Step 1:** Doc pass.
- [ ] **Step 2:** Live walkthrough (dev stack, dev-session cookie): create a contact typing a company name inline; create a deal with NO company and attach the contact; open the contact + deal sheets (no company UI, no socials); quick-switcher/search return no company kind; send an estimate end-to-end (phase-e regression); confirm `migrate status` = only F2 pending; app boots with zero console errors on the touched pages.
- [ ] **Step 3:** Full-repo check-types + surviving suites. Fix-as-you-go with `fix:` commits.
- [ ] **Step 4: Commit + report** with the AGENTS.md `## Issues` list (must include: F2 staged-not-applied and its merge-day recipe; peers still auto-create companies until they rebase).
