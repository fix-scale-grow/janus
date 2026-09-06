# Custom Fields Merge-Field Pull-Through Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface the existing custom-fields CRUD in Settings, make the template merge-field registry dynamic so custom fields insert as chips, resolve their values into every send, and block sends with unresolved merge fields.

**Architecture:** No schema changes, no migrations. Four seams get connected: (1) a Settings page hosting the existing `apps/app/components/crm/fields/` machinery; (2) a `templates.mergeFields` query replacing the hardcoded client registry; (3) `MergeContextService` joining `FieldValue`s and emitting `<entity>.field.<key>` tokens via one shared formatter; (4) a token-resolution gate in the send paths plus `missing[]` in preview and a dialog warning panel.

**Tech Stack:** nestjs-trpc, Prisma (read-only — existing models), Next.js App Router, Bun test.

**Spec:** `docs/superpowers/specs/2026-09-06-custom-fields-merge-design.md`

## Global Constraints

- **Never add code comments. No `Co-Authored-By` trailer.** Commit style `feat:`/`fix:`. Tabs + biome (`bunx biome check --write` on touched files before each commit).
- Intelligence never lives in the API; single tenant; client components never import `@crm/db`/`@crm/auth`; `packages/ui` shadcn components only, no style overrides.
- **`apps/api/src/generated/server.ts` regenerated only via `bun run check-types` (from apps/api), committed with the change.**
- Every mutation invalidates via `useCrmCache()`; this plan touches `cache.fields` (adds mergeFields invalidation), never ad-hoc key lists.
- Databases: `janus_fields_dev` / `janus_fields_test` (preconfigured in the worktree `.env`). NEVER touch `crm` or `crm_test`. Both are created by `prisma migrate dev` / `bun run db:test` on first use.
- Dev servers for this worktree: app :3100, api :3101 — never :3000/:3001. (Controller stops the previous phase's servers before Task 1's verification.)
- Token namespace: exactly `contact.field.<key>` and `deal.field.<key>`. `personal_note` is exempt from send-blocking. `signing_link` resolves as today.
- Tests: `apps/api/test/*.spec.ts` conventions (TEST_RUN_ID-suffixed fixtures; a test may not delete a row it did not create; direct-service construction like `tracking-filing.integration.spec.ts`).
- Report issues in the ASD-STE100 `## Issues` list format.
- Key existing identifiers (verbatim, do not re-derive): `MERGE_FIELDS`/`SAMPLE_MERGE_CONTEXT` in `apps/api/src/templates/templates.config.ts`; `MERGE_FIELD_GROUPS`/`mergeFieldLabel` in `apps/app/components/templates/merge-fields.ts`; `MergeContextService.resolve(refs: MergeContextRefs)` in `apps/api/src/templates/merge-context.service.ts`; `applyMergeFields`/`applyMergeFieldsHtml`/`renderEmailHtml`/`MERGE_TOKEN_PATTERN` in `apps/api/src/templates/render-email.ts`; `FieldsService` (`definitionsFor`, `valuesFor`, `tableValuesFor`) in `apps/api/src/fields/fields.service.ts`; `serializeField`, `readValue`, `fieldKeyFromLabel`, `FIELD_ENTITIES`, `columnFor`, `usesOptions` in `@crm/db/fields`; UI machinery in `apps/app/components/crm/fields/` (`FieldsSheetBody` in `fields-sheet.tsx`, `FieldsList`, `FieldEditor`, `fields-copy.ts`, `fields-entity.ts`); `FieldSidebar` in `apps/app/components/templates/field-sidebar.tsx`; chip layer in `apps/app/components/templates/block-serialize.ts` (`fieldChipHtml`, `toEditorHtml`, `insertFieldChip`); `SendDocumentDialog` in `apps/app/components/documents/send-document-dialog.tsx`; send flows in `apps/api/src/estimates/estimates.service.ts` (`send`, ~L456), `apps/api/src/invoices/invoices.service.ts`, `apps/api/src/contracts/contracts.service.ts` (~L272 send, ~L423 body render — body render keeps current non-blocking behavior); settings sidebar `apps/app/app/(app)/[slug]/settings/settings-sidebar.tsx`.

---

### Task 1: Settings › Fields page + merge-token affordance

**Files:**
- Create: `apps/app/app/(app)/[slug]/settings/fields/page.tsx`
- Modify: `apps/app/app/(app)/[slug]/settings/settings-sidebar.tsx` (add `{ title: "Fields", href: `${ROOT}/fields` }` after Templates, in BOTH `SettingsSidebar` and `SettingsSidebarFallback` if they map separate arrays — the file maps one `ITEMS` list, add once)
- Modify: `apps/app/components/crm/fields/fields-sheet.tsx` (export the tabbed body content as a reusable component if `FieldsSheetBody` is sheet-coupled; smallest possible seam)
- Modify: `apps/app/components/crm/fields/field-editor.tsx` (merge-token row)
- Modify: `apps/app/components/crm/fields/fields-copy.ts` (new copy strings)

**Interfaces:**
- Consumes: existing `FieldsSheetBody`/`FieldsList`/`FieldEditor`, `trpc.fields.*`.
- Produces: route `/settings/fields`; `FieldEditor` shows the token for saved fields.

- [ ] **Step 1: Read the fields UI first** — `apps/app/components/crm/fields/fields-sheet.tsx`, `fields-list.tsx`, `field-editor.tsx`, `fields-copy.ts`, `fields-entity.ts`, and one settings page for the layout convention (`settings/templates/page.tsx` or `settings/price-book/page.tsx`). Identify the smallest extraction that lets the tabs+list+editor render outside the sheet (likely: `FieldsSheetBody` already takes its state from `useFieldsSheet()` nuqs params — if so the page can mount the same body and the nuqs params drive it identically; verify `?fields=`/`?field=` params work on a settings route since the host is mounted globally by `record-sheet-host.tsx` — if the host is only inside the record-stack layout, mount what is needed on the page).
- [ ] **Step 2: Build `page.tsx`** — server component: `metadata = { title: "Fields" }`, `PageShell` + `PageShellHeader` (title "Fields", description "The details Janus keeps on every contact and job — yours to define.") + `PageShellContent` with `requireSession()` and prefetch of `trpc.fields.list.queryOptions({ entity: "CONTACT", includeArchived: true })` and the DEAL twin; render the extracted fields body (client) inside `HydrateClient`, `max-w-4xl` wrapper per settings convention.
- [ ] **Step 3: Sidebar entry** after Templates.
- [ ] **Step 4: Merge-token affordance in `FieldEditor`** — for a SAVED field (not `field=new`): a read-only row labeled "Merge tag" showing `{{contact.field.<key>}}` or `{{deal.field.<key>}}` (entity from the editor's context) in `text-code-foreground` mono style with a copy `Button variant="ghost" size="sm"` using `navigator.clipboard.writeText` + `toast.success("Copied")`. Copy strings go in `fields-copy.ts`.
- [ ] **Step 5: Verify** — `cd apps/app && bunx next typegen && bun run check-types` clean; biome clean; on :3100 `/crm/settings/fields` renders the tabs, creating a field works, the token row shows and copies; the record-sheet gear path still opens the sheet unchanged.
- [ ] **Step 6: Commit** — `feat: manage fields from settings`.

---

### Task 2: `templates.mergeFields` query + dynamic client registry

**Files:**
- Modify: `apps/api/src/templates/templates.config.ts` (export a `STATIC_MERGE_FIELD_GROUPS` structure with labels — the grouped, labeled shape the client needs; keep `MERGE_FIELDS`/`SAMPLE_MERGE_CONTEXT` for existing consumers)
- Modify: `apps/api/src/templates/templates.contracts.ts` + `templates.router.ts` + `templates.service.ts` (new query `mergeFields`)
- Modify: `apps/api/src/templates/templates.module.ts` (import whatever provides `FieldsService` — `FieldsModule` exports it; check and wire)
- Modify (regenerated): `apps/api/src/generated/server.ts`
- Modify: `apps/app/components/templates/merge-fields.ts` (delete `MERGE_FIELD_GROUPS`; `mergeFieldLabel` becomes lookup-driven)
- Modify: `apps/app/components/templates/field-sidebar.tsx`, `block-serialize.ts` callers, `template-editor.tsx`/`block-canvas.tsx` as needed to thread the fetched registry
- Modify: `apps/app/lib/trpc/cache.ts` (`fields` helper additionally invalidates `trpc.templates.mergeFields.queryKey()`)
- Test: `apps/api/test/templates-merge-fields.spec.ts`

**Interfaces:**
- Consumes: `FieldsService.definitionsFor(entity)` from Task-0 reality (exists), `serializeField`.
- Produces: query `templates.mergeFields` → `{ groups: { id: string; label: string; fields: { token: string; label: string }[] }[] }`; client hook `useMergeFields()` (in `merge-fields.ts`) returning `{ groups, labelFor(token): string }` with `labelFor` falling back to `` `{{${token}}}` ``.

- [ ] **Step 1: Failing contract/service test** — boot pattern per existing templates tests if any, else direct service construction: `mergeFields()` returns the static groups; after `db.fieldDefinition.create({ entity: "CONTACT", key: "roof_type_<suffix>", label: "Roof type <suffix>", type: "TEXT", position: 999 })` the result contains `{ token: "contact.field.roof_type_<suffix>", label: "Roof type <suffix>" }` in the "Contact fields" group; archiving it removes it. Run → FAIL.
- [ ] **Step 2: Implement server** — `TemplatesService.mergeFields()`: static groups + `definitionsFor("CONTACT")`/`definitionsFor("DEAL")` filtered non-archived, mapped to tokens. Group ids `contact_fields`/`deal_fields`, labels "Contact fields"/"Job fields". Router `@Query()` no input. `bun run check-types` regenerates server.ts.
- [ ] **Step 3: Client** — `useMergeFields()` wraps `useQuery(trpc.templates.mergeFields.queryOptions())` with `placeholderData`; `FieldSidebar` maps fetched groups; chip label rendering (`toEditorHtml`/`fieldChipHtml` call sites) uses `labelFor` — thread via props or a module-level label map set by the provider component that owns the editor (implementation picks the cleanest; no context leak into `block-serialize.ts`'s pure functions — pass a `labels: Record<string, string>` argument where needed).
- [ ] **Step 4: cache.ts** — `fields` helper's rest keys gain `trpc.templates.mergeFields.queryKey()`.
- [ ] **Step 5: Verify** — tests green (`cd apps/api && bun test test/templates-merge-fields.spec.ts --preload ./test/setup.ts`); both apps `check-types` clean; on :3100 the template editor sidebar lists a custom field and inserts a chip with the right label; the chip round-trips to `{{contact.field.<key>}}` in saved blocks.
- [ ] **Step 6: Commit** — `feat: make merge fields dynamic with custom fields`.

---

### Task 3: Merge-context pull-through + shared formatter

**Files:**
- Create: `apps/api/src/templates/field-merge.ts` (the one formatter: `fieldMergeEntries(entity, definitions, values) → { token, value }[]` — or the shape that fits the loaded include; exact signature implementation-chosen but SINGLE-sourced)
- Modify: `apps/api/src/templates/merge-context.service.ts` (contact + deal branches join field values and spread the entries)
- Modify: `apps/api/src/templates/templates.module.ts` / imports as needed
- Test: `apps/api/test/field-merge.integration.spec.ts`

**Interfaces:**
- Consumes: `readValue`/`serializeFieldFor` from `@crm/db/fields`; Prisma `fieldValues` include.
- Produces: context entries `contact.field.<key>` / `deal.field.<key>` for every definition with a value; absence for empties. Formatting: SELECT → option label; CHECKBOX → `"Yes"`/`"No"`; DATE → `en-US` `"Sep 6, 2026"` style (`Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })`); NUMBER → `String(Number(value))` trimming trailing zeros; USER → user name; string types verbatim.

- [ ] **Step 1: Failing integration test** — TEST_RUN_ID fixtures: one contact + one deal; field definitions covering TEXT, NUMBER, DATE, CHECKBOX, SELECT (two options), USER on CONTACT and one TEXT on DEAL; values written via `FieldsService.applyValues` (construct service directly with `db`). Assert `MergeContextService.resolve({ contactId, dealId })` contains each token with the exact display string; a definition without a value contributes no key; an archived definition contributes no key. Run → FAIL.
- [ ] **Step 2: Implement** `field-merge.ts` + the two `resolve` branches (include shaped to schema: `fieldValues: { include: { field: { include: { options: true } }, option: true, user: true } }` — verify relation names against `schema.prisma` before writing). Cleanup in `afterAll` (children first).
- [ ] **Step 3: Verify** — test green; `check-types` clean (server.ts unchanged expected); biome.
- [ ] **Step 4: Commit** — `feat: resolve custom field values into merge context`.

---

### Task 4: Send blocking, preview `missing[]`, dialog warning

**Files:**
- Create: `apps/api/src/templates/merge-guard.ts` — `collectTokens(subject, blocks): string[]` (MERGE_TOKEN_PATTERN scan of subject + every block's text/html/label) and `missingMerges(tokens, context, registry): MissingMerge[]` where `MissingMerge = { token, label, reason: "empty" | "unknown" }`; `personal_note` never reported; registry gives labels (static map + live definitions via the Task 2 service method).
- Modify: `apps/api/src/templates/templates.service.ts` — `preview` response gains `missing: MissingMerge[]`; `sendTest` blocks on missing (BadRequestException listing labels).
- Modify: `apps/api/src/estimates/estimates.service.ts`, `apps/api/src/invoices/invoices.service.ts`, `apps/api/src/contracts/contracts.service.ts` — each `send` runs the guard after context resolution, before render: `BadRequestException` message `` `Missing for this ${entity}: ${labels.join(", ")}` `` for `empty`, and `` `No longer exists — remove from the template: ${labels}` `` for `unknown`. Contract body render (~L423 view path) untouched.
- Modify: `apps/api/src/templates/templates.contracts.ts` (preview output type if declared) + regenerated `server.ts`
- Modify: `apps/app/components/documents/send-document-dialog.tsx` — when `preview.data.missing` is non-empty: an amber `Alert` panel listing each label with the line "Fill it on the contact or job, or remove it from the template.", and the Send button disabled for `unknown` reasons + enabled-but-server-guarded for `empty` (server is the gate; the dialog is the warning).
- Test: `apps/api/test/merge-guard.spec.ts` (pure: collectTokens + missingMerges incl. personal_note exemption) and extend `apps/api/test/field-merge.integration.spec.ts` or a new spec asserting `estimates.send` blocks with the label in the message and succeeds after the value is filled (file-transport mailer or stubbed MailerService per existing estimates-send tests — read how estimate send is currently tested first and follow that pattern).

**Interfaces:**
- Consumes: Task 3 context; Task 2 registry labels.
- Produces: `MissingMerge` shape shared api-side; preview `missing[]` on the wire.

- [ ] **Step 1: Failing pure tests** for `collectTokens`/`missingMerges` (subject + blocks scan, dedupe, personal_note exempt, unknown vs empty classification). Run → FAIL. Implement `merge-guard.ts`. Green.
- [ ] **Step 2: Wire the three sends + sendTest + preview**; regenerate server.ts via check-types.
- [ ] **Step 3: Failing-then-green send integration test** per the existing estimate-send test pattern.
- [ ] **Step 4: Dialog panel** — `Alert` from `@crm/ui`, listing `missing` labels; verify live on :3100 (template with a custom-field chip + contact without the value → warning shows, send blocked server-side with the label in the toast; fill value → sends via file transport, outbox HTML contains the value).
- [ ] **Step 5: Commit** — `feat: block sends on unresolved merge fields`.

---

### Task 5: Playwright walkthrough

**Files:** scratchpad script only (not committed).

- [ ] **Step 1:** Node-not-bun Playwright (scratchpad has `node_modules/playwright`; viewport 1600×900; cookie recipe `cd apps/api && bun run dev:session karlosantanas@gmail.com`, cookie name `crm.session_token`, domain localhost, slug `/crm`). Walk: Settings › Fields → create "Roof type" SELECT field with options → copy merge tag → Settings › Templates → estimate email → insert the new chip from the sidebar → create contact+deal+estimate via UI (or reuse seed) → open send dialog → warning panel lists "Roof type" → fill the field on the contact → send (file transport) → assert outbox HTML contains the option label. Screenshots of Settings › Fields, the editor with the chip, the warning panel, and the outbox assertion.
- [ ] **Step 2:** Fix anything found (commit as `fix:`), re-run until clean.
- [ ] **Step 3:** Final gate: `cd apps/api && bun test <all specs this plan added> --preload ./test/setup.ts` green; `bun run check-types` clean both apps; ASD-STE100 Issues list in the report.
