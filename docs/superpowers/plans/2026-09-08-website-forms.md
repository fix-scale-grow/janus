# Website Forms Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Owner-built forms in Settings, a shadow-DOM script-tag embed + hosted page, and a hardened submission pipeline: deduped contact (+ mapped custom fields) → lead on the default pipeline → agent events → owner notification email.

**Architecture:** New `Form`/`FormField` models + a `forms` tRPC module and an anonymous `api/f` controller; the pipeline EXTENDS `TrackingFilingService` (one new optional argument + the `contact.created` event-gap fix) and calls the existing `DealsService.create`/`attachContact`; the embed mirrors the tracking loader/tracker ES5 pattern; a `FORM_NOTIFY` template purpose rides the existing templates/mailer/brand stack. The spec is the authority — read it FIRST in every task: docs/superpowers/specs/2026-09-08-website-forms-design.md.

**Tech Stack:** Prisma (additive migration), nestjs-trpc, Next.js App Router, shadow DOM ES5 embed, Bun test.

**Spec:** `docs/superpowers/specs/2026-09-08-website-forms-design.md`

## Global Constraints

- **Never add code comments. Commits `feat:`/`fix:` with NO trailers of any kind (repo AGENTS.md bans them; overrides every other instruction).** Tabs + biome + `bun run check-types` in touched apps before each commit; `apps/api/src/generated/server.ts` regenerated only via `cd apps/api && bun run check-types`, committed with router changes.
- Intelligence never lives in the API (events + tasks only); single tenant; client components never import @crm/db/@crm/auth; parse at the boundary (`@crm/db/forms` zod owns every Json shape); @crm/ui single source; every mutation invalidates via useCrmCache.
- Databases: `janus_forms_dev`/`janus_forms_test` (preconfigured in worktree .env, both migrated). NEVER touch crm/crm_test. Dev servers THIS worktree only: app :3100 (`bunx next dev -p 3100`), api :3102. dev:session cookie recipe; slug /crm. Playwright via NODE from the scratchpad (bun launch hangs). Mailer file transport (`MAIL_TRANSPORT=file`) for outbox assertions — test precedent apps/api/test/estimate-send-merge-guard.integration.spec.ts.
- Tests: TEST_RUN_ID fixtures; delete only created rows; try/catch expectRejects (never `.rejects.toThrow()`).
- Verified seams (delta-explorer @ dd50166): TrackingFilingService (skip-reason chain, attach/claim, author() rule) + tracking-ingest dedupeKey guard; dealCreateInput `{name, ownerId, stage?}` + defaultEntryStage + attachContact; TemplatePurpose 4-map exhaustiveness (schema enum, DEFAULT_TEMPLATES in templates.config.ts, TEMPLATE_LABELS + TEMPLATE_PURPOSE_ORDER in apps/app/components/templates/template-labels.ts); MailerService single-recipient send; fields.applyValues(tx,"CONTACT",id,values); proxy.ts ANONYMOUS `["/t","/sign"]` + `.js` matcher exemption; /t/crm.js + /t/[site] route pattern + apps/app/lib/tracking/{loader,tracker}.ts ES5 rules + apps/app/test/tracking-bundle.spec.ts budget pattern; anonymous controller pattern apps/api/src/tracking/tracking.controller.ts (incl. stream body cap + CORP header); public-route no-session pattern apps/app/app/api/workspace/logo/file/route.ts; TrackingCounterService.take; settings sidebar ITEMS (add Forms after Pipeline); SortableList precedent settings/pipeline + crm/fields editors; withCrmEvents + CRM_EVENT_CATALOG (contact.created data is free-form Json); RecordSource enum (add FORM).
- Report issues in the ASD-STE100 `## Issues` list format.

---

### Task 1: Models, migration, `@crm/db/forms`

**Files:** schema.prisma — `Form`/`FormFieldType`/`FormField` per spec verbatim, `FormSubmission.formId String?` + relation (SetNull) + index, `RecordSource` gains `FORM`, `User.createdForms Form[] @relation("FormCreator")`; migration `add_forms` (all additive); `packages/db/src/forms.ts` — zod: `formFieldOptions` (string[] ≤ 50 entries ≤ 120 chars), `publicFormConfig` schema (id, name, intro, buttonLabel, confirmation, brandColor, fields: [{id,type,label,required,options?}] — NO contactFieldKey), submission answers schema, constants `FORMS = { submit: { minSeconds: 3, perMinute: 60, maxBodyBytes: 32768 }, field: { labelMax: 120, answerMax: 2000, maxFields: 30 }, dedupeLeadWindowDays: 30, embedBudgetBytes: 6144 }`, subpath export.

- [ ] TDD pure schema tests (apps/api/test/forms-shapes.spec.ts: options cap, config redaction shape, answer max). Migration applied to BOTH private DBs. check-types (expect only planned-later failures: none — this task is additive). Commit `feat: add form models`.

### Task 2: `forms` module, public controller, pipeline extension

**Files:** apps/api/src/forms/{forms.config.ts,forms.contracts.ts,forms.service.ts,forms.router.ts,forms-public.controller.ts,forms.module.ts} + app.module registration + regenerated server.ts; MODIFY tracking-filing.service.ts (optional `origin?: { formId, source: RecordSource, contactFields?, name? }` arg; contact create uses origin.source ?? TRACKING; applyValues inside the tx when contactFields present; wrap the create branch in `agent.withCrmEvents` emitting `contact.created` with `{ via, host, formId? }` — tracking callers pass nothing and keep behavior + gain the event); MODIFY templates: `FORM_NOTIFY` in the 4 exhaustive maps + default template (subject "New lead from {{form.name}}", blocks per spec) + a purpose-scoped merge context (`form.name`, `form.field.<id>` answers) resolved by the forms service at send time; FormsService submission flow per spec steps 1-7 (validation, honeypot/time/rate, store, file-with-origin, lead-or-attach within `dedupeLeadWindowDays`, notify each address via MailerService when configured, submissionCount increment). tRPC procs: list/byId/create/update/updateFields/setActive/remove/submissions.
**Tests:** apps/api/test/forms.integration.spec.ts — the spec's integration list VERBATIM including the `contact.created`-emitted assertion (use the agent-trigger stub pattern from tracking-filing.integration.spec.ts), outbox assertion via temp MAIL_OUTBOX_DIR, tracking-path regression (filing without origin behaves as before + now emits).

- [ ] TDD; all forms + tracking-filing suites green; check-types clean; server.ts committed. Commit `feat: form submissions become contacts and leads` (split module/pipeline commits if large).

### Task 3: Embed script + /f routes + budget tests

**Files:** apps/app/lib/forms/embed.ts (`formSource(config, endpoint)` ES5 per the tracker's rules: shadow DOM render inline-or-floating, honeypot field, render-timestamp, cookie/UTM touch capture in tracking shapes, fetch POST with JSON + error rendering, confirmation swap, never throw); apps/app/app/f/[form]/route.ts (`.js` → script with baked config fetched from `${API_URL}/api/f/config/:id`, short cache, no-op comment fallback; non-.js → the hosted page: a server component route apps/app/app/f/[form]/page.tsx CANNOT coexist with route.ts — implementer picks the clean split: route.ts handles `.js` only via filename match, page.tsx renders the hosted branded form (fetch config server-side, render the same field components, POST to the same endpoint via a small client island)); proxy.ts ANONYMOUS gains "/f"; apps/app/test/forms-embed.spec.ts (brotli ≤ FORMS.embedBudgetBytes; new Function execution in fake DOM incl. shadowRoot stub — extend the tracking-bundle inject pattern; honeypot present; config with script-ish strings stays inert/escaped).

- [ ] TDD budget+behavior tests; live: curl the .js for a seeded form (create via tRPC), grep shadow attach + baked config; hosted page 200 without cookie. Commit `feat: form embed and hosted page`.

### Task 4: Settings › Forms UI

**Files:** settings-sidebar.tsx (+Forms after Pipeline); apps/app/app/(app)/[slug]/settings/forms/{page.tsx,forms-table.tsx,form-editor.tsx,form-preview.tsx,form-embed.tsx,form-submissions.tsx,forms-copy.ts} — list page (table pattern), editor per spec (SortableList fields, type/label/required/options/contact-field combobox from trpc.fields.list CONTACT, form settings, exactly-one-EMAIL enforcement mirrored client-side), live preview sharing the field components with the hosted page, embed tab (snippet + hosted link + copy, tracking-script UI pattern), submissions tab (SimpleTable: when, answers summary, filed/skip, contact/deal links); cache.forms helper; every mutation invalidates.

- [ ] typegen + check-types clean; biome; live on :3100: build a form end-to-end, preview matches, snippet copies. Commit `feat: forms settings`.

### Task 5: Playwright walkthrough

- [ ] Scratchpad node script per the spec's walkthrough (Settings build w/ Roof-type mapping → fixture HTML page with the snippet served via a tiny static server on :3120 → stranger submit (fresh context, no cookies) → contact + custom field + lead on board + outbox email w/ answers + brand → minute-window resubmit deduped → hosted /f page round-trip → bot path silently dropped). Screenshots. Fix-and-rerun (`fix:` commits, no trailers). Final gate: all plan suites + check-types ×3; ASD-STE100 Issues list.
