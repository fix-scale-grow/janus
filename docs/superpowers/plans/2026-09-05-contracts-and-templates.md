# Contracts and Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Contracts linked to estimates/invoices with public e-signature, plus a Settings › Templates drag-and-drop editor for outgoing emails and the contract body, with dynamic merge fields and live preview.

**Architecture:** Two new Prisma models (`Template`, `Contract`) appended at the end of the schema. Two new authed tRPC modules (`templates`, `contracts`) cloned from the estimates pattern, one public router (`contractSigning`) with no AuthMiddleware. Block trees are `Json` columns owned by a zod schema; one renderer turns blocks + a merge context into email-safe HTML, another into a `@react-pdf` contract PDF. The web app adds a Settings tab, a Contracts module, record-sheet tabs, and a public `/sign/[token]` page.

**Tech Stack:** NestJS + nestjs-trpc, Prisma, zod, nodemailer (existing mailer), `@react-pdf/renderer` (existing pattern), Next.js App Router, `@dnd-kit` (already a dependency), shadcn components from `@crm/ui`.

**Spec:** `docs/superpowers/specs/2026-09-05-contracts-and-templates-design.md`

## Global Constraints

- Repo AGENTS.md: NO code comments, NO `Co-Authored-By` trailers, constants in a per-area `*.config.ts` (`as const`), parse every `Json` at the boundary with zod, optional capabilities never throw.
- `apps/app` runs a NEWER Next.js than your training data — read the relevant guide in `apps/app/node_modules/next/dist/docs/` before writing app-router code.
- `apps/api/src/generated/server.ts` is generated AND committed. Regenerate ONLY via `bun run check-types` in `apps/api` (never hand-edit, never during build).
- UI: shared components from `@crm/ui` only, no className style overrides, radii only `rounded-sm/md/lg`, brand green `#006B4F`, only `primary`/`destructive` are filled. Read `docs/design.md`.
- Server page computes / client component renders. A `"use client"` file never imports `@crm/auth` or `@crm/db`.
- Money renders through `formatCents` (`apps/api/src/documents/pdf-money.ts` server-side, `formatMoney` client-side where it exists).
- Cache invalidation through `useCrmCache()` (`apps/app/lib/trpc/cache.ts`) — add helpers there, never list keys at call sites.
- Run commands with Bun from `C:\Users\Kyle\.bun\bin` (prepend to PATH). Worktree root: `C:\Users\Kyle\janus\.claude\worktrees\phase-e-contracts`.
- Commit after every task. Message style: `feat:`/`fix:`/`docs:` like the existing log.

---

### Task 1: Prisma models and migration

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (append at END of file — a peer branch holds uncommitted models after `InvoiceLineItem`; do not touch that region)
- Modify: `packages/db/prisma/schema.prisma` relation back-fields on `User` (~line 26 area), `Deal` (~line 929), `Contact` (~line 367), `Estimate` (~line 1088), `Invoice` (~line 1161) — one added line each, placed at the END of each model's relation list
- Create: migration via `prisma migrate dev`

**Interfaces:**
- Produces: models `Template` (fields per spec: `id,name,type,purpose,subject,blocks,updatedById,createdAt,updatedAt`, `@@map("template")`, `purpose` unique), `Contract` (fields per spec incl. `number Int @unique @default(autoincrement())`, `signingToken String? @unique`, `@@map("contract")`), enums `TemplateType { EMAIL CONTRACT }`, `TemplatePurpose { ESTIMATE_SEND INVOICE_SEND CONTRACT_SEND CONTRACT_BODY }`, `ContractStatus { DRAFT SENT SIGNED VOID }`. Contract relations: `deal Deal? @relation(fields:[dealId]…, onDelete: SetNull)`, same for `contact`, `estimate`, `invoice`; `createdBy User @relation("ContractCreator"…)`. Indexes on `dealId`, `contactId`, `estimateId`, `status`.

- [ ] **Step 1: Append enums + models to schema.prisma exactly as the spec's Data model section defines**, plus back-relations: `User.contracts Contract[] @relation("ContractCreator")`, `Deal.contracts Contract[]`, `Contact.contracts Contract[]`, `Estimate.contracts Contract[]`, `Invoice.contracts Contract[]`.
- [ ] **Step 2: Generate + migrate.** Start Postgres if down (`C:\Users\Kyle\pg17\pgsql\bin\pg_ctl.exe -D C:\Users\Kyle\pg17\data -l C:\Users\Kyle\pg17\pg.log start`). Run in `packages/db`: `bunx prisma migrate dev --name add_contracts_and_templates`. Expected: migration folder created, client regenerates.
- [ ] **Step 3: Typecheck** — repo root `bun run check-types --filter @crm/db`. Expected: PASS.
- [ ] **Step 4: Commit** — `feat: add contract and template models`

### Task 2: Template block schema, merge-field registry, sample context

**Files:**
- Create: `apps/api/src/templates/templates.config.ts`
- Create: `apps/api/src/templates/template-blocks.ts`
- Test: `apps/api/src/templates/template-blocks.spec.ts` (mirror the naming of existing api spec files — check how estimates tests are named and co-located first, follow that)

**Interfaces:**
- Produces: `templateBlocksSchema` (zod), `type TemplateBlocks = z.infer<typeof templateBlocksSchema>`, `parseTemplateBlocks(value: unknown): TemplateBlocks` (throws BadRequest on invalid), `MERGE_FIELDS` registry, `SAMPLE_MERGE_CONTEXT: Record<MergeFieldToken, string>`, `DEFAULT_TEMPLATES` (the four seeded block trees + subjects + names, keyed by purpose).

- [ ] **Step 1: Write failing tests**: valid tree round-trips; unknown block type rejected; script tag in `text.html` is stripped; `spacer.height` clamped 4–96; drawn-signature-size guard N/A here; empty tree rejected (min 1 block).
- [ ] **Step 2: Implement.** Block union (discriminated on `kind`): `heading { text: string(max 300) }`, `text { html: string(max 8000) }`, `button { label: string(max 80) }`, `logo {}`, `divider {}`, `spacer { height: number int 4..96 }`. Sanitize `text.html` with a small allowlist regex pass (allowed tags: `b,i,strong,em,br,a,span`; strip all attributes except `href` on `a` and `data-field` on `span`; strip `javascript:` hrefs). `MERGE_FIELDS` grouped `as const`: contact (`contact.full_name`, `contact.first_name`, `contact.email`), business (`business.name`, `business.phone`, `sender.name`), deal (`deal.title`, `deal.address`), estimate (`estimate.title`, `estimate.total`, `estimate.tier`), invoice (`invoice.number`, `invoice.total`, `invoice.due_date`), contract (`contract.number`, `contract.title`). `DEFAULT_TEMPLATES`: Estimate email / Invoice email / Contract email (logo, heading, text with tokens, divider, footer text — copy tone from the approved preview; text mentions the attached PDF; contract email mentions the signing link `{{signing_link}}` token, registry includes `signing_link`) and Standard contract body (heading + agreement text blocks with `business.name`, `contact.full_name`, `deal.address`, `estimate.title`, `estimate.total` tokens; scope/schedule/warranty paragraphs as editable defaults).
- [ ] **Step 3: Run tests** — `bun test` scoped to the new spec file (match how existing api tests run; check `apps/api/package.json` scripts). Expected: PASS.
- [ ] **Step 4: Commit** — `feat: add template block schema and merge field registry`

### Task 3: Merge resolver and email renderer

**Files:**
- Create: `apps/api/src/templates/merge-context.service.ts` (`@Injectable`, injects the database service the way `estimates.service.ts` does)
- Create: `apps/api/src/templates/render-email.ts` (pure function, no DI)
- Test: `apps/api/src/templates/render-email.spec.ts`, `apps/api/src/templates/merge-context.service.spec.ts`

**Interfaces:**
- Consumes: `TemplateBlocks`, `MERGE_FIELDS`, `formatCents` from `../documents/pdf-money`.
- Produces: `MergeContextService.resolve(refs: { contactId?; dealId?; estimateId?; invoiceId?; contractId?; senderName?; signingLink?; personalNote? }): Promise<Record<string, string>>`; `renderEmailHtml(blocks: TemplateBlocks, context: Record<string,string>): { html: string; text: string }`; `applyMergeFields(input: string, context: Record<string,string>): string` (replaces `{{token}}`, unknown/missing → empty string).

- [ ] **Step 1: Write failing renderer tests**: heading/text/button/divider/spacer/logo each render; `{{contact.first_name}}` substitutes; missing token renders empty; output contains no `<script>`; `text` fallback strips tags; table-based 600px wrapper present; button uses `#006b4f`.
- [ ] **Step 2: Implement renderer.** Table-based HTML: outer 100% table on `#f4f4f4`, inner 600px white table, cell padding 24px 32px; heading = `<h2>` 20px; button = bulletproof link-in-td with `background:#006b4f;border-radius:5px;color:#ffffff;padding:12px 24px`; logo = 44px rounded td with workspace initials from `business.name` context (first letters of first two words); plain-text variant = blocks flattened to text lines. `applyMergeFields` regex `/{{\s*([\w.]+)\s*}}/g`.
- [ ] **Step 3: Implement resolver.** One query per provided ref with narrow `select`; business name/phone from the workspace read the way `estimates.service.ts` fetches the workspace name for PDFs (find and reuse that exact path); `estimate.total` = selected-tier sum of line items via the same math `estimate-pdf.ts` uses; `invoice.total` = line item sum; dates through `Intl.DateTimeFormat("en-US", { dateStyle: "medium" })`. Missing refs contribute nothing. Tests with the db service mocked (follow the existing service-spec mocking style in `apps/api`).
- [ ] **Step 4: Run tests.** Expected: PASS.
- [ ] **Step 5: Commit** — `feat: add merge resolver and email renderer`

### Task 4: Templates tRPC module

**Files:**
- Create: `apps/api/src/templates/templates.contracts.ts`, `templates.service.ts`, `templates.router.ts`, `templates.module.ts`
- Modify: `apps/api/src/app.module.ts` (register `TemplatesModule`)
- Test: `apps/api/src/templates/templates.service.spec.ts`
- Modify (generated): `apps/api/src/generated/server.ts` via `bun run check-types`

**Interfaces:**
- Consumes: Task 2 + 3 exports, `MailerService` (`../mailer/mailer.service`).
- Produces (alias `templates`, AuthMiddleware): `list()` → rows `{id,name,type,purpose,updatedAt}`; `byPurpose({purpose})` → full row (upserting the `DEFAULT_TEMPLATES` entry if the row is missing — this is the lazy seed, so a fresh install works with zero migration data); `update({purpose, name, subject?, blocks})` → parses blocks via `parseTemplateBlocks`, stamps `updatedById`; `preview({purpose, contactId?, dealId?, estimateId?, invoiceId?})` → `{subject, html}` rendered with real refs when given else `SAMPLE_MERGE_CONTEXT`; `sendTest({purpose, to})` → renders with sample context, sends via mailer, subject prefixed `[Test] `; `mailerConfigured()`.

- [ ] **Step 1: Write failing service tests**: `byPurpose` creates the default row once and returns the same row on second call; `update` rejects an invalid block tree; `preview` with no refs uses sample data; `sendTest` throws a `PreconditionFailedException`-family error when mailer unconfigured (mirror how `estimates.service.ts:send` handles it — read it first and copy the exact behavior).
- [ ] **Step 2: Implement** contracts (zod inputs incl. `templatePurposeEnum` built from the Prisma enum the way `estimates.contracts.ts` builds `statusEnum`), service, thin router, module (imports `MailerModule`; providers `[TemplatesService, MergeContextService, TemplatesRouter]`, exports `TemplatesService, MergeContextService`). Register in `app.module.ts`.
- [ ] **Step 3: Run tests, then `bun run check-types` in `apps/api`** to regenerate `server.ts`. Expected: tests PASS, `server.ts` diff shows a `templates` router.
- [ ] **Step 4: Commit** — `feat: add templates module with preview and test send`

### Task 5: Contracts module (authed) + contract PDF

**Files:**
- Create: `apps/api/src/contracts/contracts.config.ts` (token bytes 32, expiry days 30, drawn signature max 500_000 chars, `as const`)
- Create: `apps/api/src/contracts/contracts.contracts.ts`, `contracts.service.ts`, `contracts.router.ts`, `contracts.module.ts`, `contract-pdf.ts`
- Modify: `apps/api/src/app.module.ts`
- Test: `apps/api/src/contracts/contracts.service.spec.ts`

**Interfaces:**
- Consumes: `MergeContextService`, `renderEmailHtml`, `applyMergeFields`, `TemplatesService.byPurpose`, `MailerService`, `parseTemplateBlocks`.
- Produces (alias `contracts`, AuthMiddleware): `list(listInput + {dealId?, contactId?, status?})` → `{rows,total}` with linked `{estimate:{id,title}, invoice:{id,number}, contact:{id,name}}` selects; `byId({id})`; `createFromEstimate({estimateId})` → copies estimate title → `title`, links deal/contact/estimate, `body` = CONTRACT_BODY template blocks snapshot (tokens unresolved); `create({title?, dealId?, contactId?})`; `update({id, data:{title?, body?, invoiceId?, contactId?}})` → rejected with Conflict once status ≠ DRAFT (except `invoiceId` link allowed while SENT); `send({id, to?, subject?, personalNote?})` → requires a contact email or explicit `to`; generates token via `crypto.randomBytes(32).toString("base64url")`, sets `sentAt/sentTo/tokenExpiresAt`, renders CONTRACT_SEND email with `signing_link` = `${appUrl()}/sign/${token}` (find how the app URL is composed for links elsewhere in the api — reuse it), attaches NO pdf (the link is the document), sets SENT only after mailer resolves (delivered-check-before-status-flip, same as estimates); `void({id})`; `delete({id})` DRAFT only; `document({id})` → `{filename, base64}` PDF; `mailerConfigured()`.
- Produces: `renderContractPdf(input: { title; number; bodyHtmlBlocks: TemplateBlocks; context: Record<string,string>; signature?: { kind: "typed"|"drawn"; data: string; signerName: string; signedAt: Date } }, workspaceName: string): Promise<Buffer>` in `contract-pdf.ts`.

- [ ] **Step 1: Write failing service tests**: `createFromEstimate` snapshots body and links; `send` without contact email and without `to` → BadRequest; `send` flips DRAFT→SENT and stores a 43-char token; `update` on SENT → Conflict; `sign`-adjacent guards live in Task 6; `delete` on SENT → Conflict.
- [ ] **Step 2: Implement service + PDF.** PDF follows `estimate-pdf.ts`'s `createElement` style: header (workspace name, contract number `C-<number padded 4>`, date), body = blocks rendered as PDF Text/View elements with tokens resolved via `applyMergeFields`, signature section (typed → italic 22pt name; drawn → `Image` from the data URI; plus `signerName · signed <date>` line and an unsigned placeholder line when no signature). Router thin, module registered.
- [ ] **Step 3: Run tests + `bun run check-types`.** Expected: PASS, `contracts` router in `server.ts`.
- [ ] **Step 4: Commit** — `feat: add contracts module with pdf and send`

### Task 6: Public signing router

**Files:**
- Create: `apps/api/src/contracts/contract-signing.router.ts` (NO `@UseMiddlewares(AuthMiddleware)` — that absence is the public marker, per `docs/api.md`)
- Modify: `apps/api/src/contracts/contracts.contracts.ts` (signing inputs), `contracts.service.ts` (signing methods), `contracts.module.ts` (add router provider)
- Test: extend `apps/api/src/contracts/contracts.service.spec.ts`

**Interfaces:**
- Produces (alias `contractSigning`, public): `bySigningToken({token})` → `{title, number, businessName, contactName, bodyHtml, status, signedAt, signerName}` — body rendered to display HTML via `renderEmailHtml`'s block walk with tokens resolved; NotFound for unknown token, and a typed `status` lets the page render signed/voided/expired states; `sign({token, signerName(1..120), signatureKind("typed"|"drawn"), signatureData(max from config)})` → validates status SENT + `tokenExpiresAt` future, writes signature fields + `signedAt` + SIGNED, then emails the signed PDF to `sentTo` and to the workspace owner (owner lookup: reuse however `workspace.service.ts` finds members/owner), send failures logged not thrown (the signature must survive a mail outage — log via the ContextLogger pattern, never console).

- [ ] **Step 1: Write failing tests**: unknown token → NotFound; expired token → Conflict with a code the UI can branch on; sign on DRAFT/VOID → Conflict; sign twice → Conflict; successful sign persists `signatureKind/Data/signerName/signedAt` and flips SIGNED; mailer failure still signs.
- [ ] **Step 2: Implement.** Expiry check `tokenExpiresAt < new Date()`. Drawn `signatureData` must start with `data:image/png;base64,` (zod refine).
- [ ] **Step 3: Run tests + `bun run check-types`.** Expected: PASS, `contractSigning` router present, its procedures NOT wrapped in the auth middleware in `server.ts` (verify by reading the generated diff).
- [ ] **Step 4: Commit** — `feat: add public contract signing endpoints`

### Task 7: Settings › Templates — list page and editor shell

**Files:**
- Modify: `apps/app/app/(app)/[slug]/settings/settings-sidebar.tsx` (add `{ title: "Templates", href: \`${ROOT}/templates\` }` after Symbols)
- Create: `apps/app/app/(app)/[slug]/settings/templates/page.tsx` (server page: prefetch/fetch `templates.list` the way `settings/price-book/page.tsx` fetches — copy its data-loading approach exactly)
- Create: `apps/app/app/(app)/[slug]/settings/templates/templates-table.tsx` (client: rows Name / Type pill / Used for / Last edited / Edit link)
- Create: `apps/app/app/(app)/[slug]/settings/templates/[purpose]/page.tsx` (server page: loads `templates.byPurpose`, passes plain data to the editor)
- Create: `apps/app/components/templates/template-editor.tsx` (client shell: header with name, Save button, Edit/Preview segmented control, Send-test button + email prompt dialog; holds blocks state; renders `<BlockCanvas>` + `<BlockPalette>` + `<FieldSidebar>` from Task 8)
- Modify: `apps/app/lib/trpc/cache.ts` (add `template()` invalidation helper following the existing helper shape)

**Interfaces:**
- Consumes: `trpc.templates.list/byPurpose/update/sendTest/mailerConfigured`; `RouterOutputs["templates"]["byPurpose"]`.
- Produces: `TemplateEditor({ template })` client component; purpose→label map `TEMPLATE_LABELS` in `apps/app/components/templates/template-labels.ts` (`ESTIMATE_SEND: "Estimate email"` … `CONTRACT_BODY: "Standard contract"`, plus used-for copy).

- [ ] **Step 1: Build list page + sidebar entry.** Verify in dev (`bun run dev` at repo root; login via `bun run dev:session <email>` cookie recipe in `apps/api` if needed) that Settings shows Templates with four rows after first visit (lazy seed via `byPurpose` — the list page must call `byPurpose` for all four purposes server-side so defaults exist, or `list` returns seeded rows; simplest: server page awaits all four `byPurpose` calls then renders).
- [ ] **Step 2: Build editor shell** with Save (mutation + `cache.template()` + toast via the repo's existing toast pattern — grep for how estimate-builder toasts), dirty-state guard on Save disabled when clean.
- [ ] **Step 3: Typecheck app** — repo root `bun run check-types --filter app`. Expected: PASS.
- [ ] **Step 4: Commit** — `feat: add settings templates tab and editor shell`

### Task 8: Block editor — canvas, palette, merge-field sidebar, preview

**Files:**
- Create: `apps/app/components/templates/block-canvas.tsx` (dnd-kit `SortableContext` vertical list; each block a sortable row with drag handle + delete on hover; heading/text blocks contenteditable with merge-field chips as `contentEditable={false}` spans; button/logo/divider/spacer render statically with a selected state)
- Create: `apps/app/components/templates/block-palette.tsx` (click-to-append: Heading, Text, Button, Logo, Divider, Spacer; contract-body purpose hides Button + Spacer)
- Create: `apps/app/components/templates/field-sidebar.tsx` (groups from a `MERGE_FIELD_GROUPS` constant duplicated client-side in `apps/app/components/templates/merge-fields.ts` — client cannot import the api module; keep tokens string-identical to `templates.config.ts` and add a comment-free single source note in the plan review)
- Create: `apps/app/components/templates/block-serialize.ts` (DOM contenteditable HTML ⇄ block `html`/`text` values; insertFieldAtCursor(token) using `Selection`/`Range` like the approved preview mock)
- Create: `apps/app/components/templates/template-preview.tsx` (renders `templates.preview` output in a sandboxed `<iframe srcDoc>` sized to the email; subject line above)
- Test: `apps/app/components/templates/block-serialize.test.ts` if the app package has a test runner — check `apps/app/package.json`; if it has none, validation is the Task 12 walkthrough (do NOT add a test framework)

**Interfaces:**
- Consumes: `TemplateBlocks` shape (client-side mirror type in `merge-fields.ts` derived from `RouterOutputs["templates"]["byPurpose"]["blocks"]` — parse with a client zod copy only if already conventional; otherwise trust the server type)
- Produces: `BlockCanvas({blocks, onChange, purpose})`, `BlockPalette({purpose, onAdd})`, `FieldSidebar({onInsert})`, `TemplatePreview({purpose, subject})`.

- [ ] **Step 1: Canvas with add/reorder/delete** wired into editor state. dnd-kit: `DndContext` + `verticalListSortingStrategy`, `restrictToVerticalAxis` modifier.
- [ ] **Step 2: Contenteditable text/heading blocks + chip insertion.** Chips styled `bg-[#e7f2ee]`-equivalent — implement as a `Badge`/`Tag` variant in `packages/ui` if no existing variant fits (per design.md, the variant lives in `packages/ui`, not inline).
- [ ] **Step 3: Preview mode** — segmented toggle swaps canvas for `TemplatePreview` (server-rendered sample data); subject input shows resolved subject in preview.
- [ ] **Step 4: Send test email** — prompt for address (default: signed-in user's email if available from existing session context), calls `sendTest`, toast on success; hidden when `mailerConfigured` is false.
- [ ] **Step 5: Verify in dev**: edit Estimate email, insert a field, reorder, save, reload — persists; preview shows sample data; check file outbox (`MAIL_TRANSPORT=file` → `data/mail-outbox`) for the test send.
- [ ] **Step 6: Commit** — `feat: add drag and drop template block editor`

### Task 9: Contracts UI — nav, list, detail

**Files:**
- Modify: `apps/app/lib/janus-nav.ts` (add `{ title: "Contracts", href: "/contracts", match: "prefix", status: "live", icon: <a Carbon doc/signature icon, e.g. \`Document\` or \`Pen\`> }` after Invoices)
- Create: `apps/app/app/(app)/[slug]/contracts/page.tsx`, `contracts-table.tsx` (props `{ dealId?, contactId? }`; columns Contract / Contact / Linked to / Status pill / Value (linked estimate's selected-tier total from the list select) / Open; status pill colors: DRAFT muted, SENT info, SIGNED success, VOID muted-strikethrough — follow how `estimates-table.tsx`/`invoices-table.tsx` render status)
- Create: `apps/app/app/(app)/[slug]/contracts/[contractId]/page.tsx` + `contract-detail.tsx` (client: title, status + sent/signed timeline line, linked-record cards for estimate/invoice/contact each linking via existing record-sheet hrefs, body editor reusing `BlockCanvas` while DRAFT and read-only render after, Download PDF via `contracts.document` base64 like the estimate download, Send-for-signature via Task 10's dialog, Void with confirm, link-invoice picker listing the deal's invoices)
- Modify: `apps/app/lib/trpc/cache.ts` (add `contract(id)` helper)

**Interfaces:**
- Consumes: `trpc.contracts.*`, `RouterOutputs["contracts"]["byId"]`, Task 8 `BlockCanvas`.
- Produces: `ContractsTable({dealId?, contactId?})` export for Task 10's tabs.

- [ ] **Step 1: Nav + list page + table.** Verify list renders empty state then rows after creating a contract via a quick dev-console `createFromEstimate`.
- [ ] **Step 2: Detail page** with all actions wired + cache invalidation.
- [ ] **Step 3: Typecheck** `bun run check-types --filter app`. Expected: PASS.
- [ ] **Step 4: Commit** — `feat: add contracts list and detail pages`

### Task 10: Cross-links — record-sheet tabs, create-from-estimate, template-driven send dialogs

**Files:**
- Modify: `apps/app/components/crm/record-sheet/deal-sheet.tsx` (tabs array ~line 146: add `{ value: "contracts", label: "Contracts", content: <DealContracts …> }` after invoices; bottom component `DealContracts` wrapping `<ContractsTable dealId=…/>` exactly like `DealInvoices` ~line 544)
- Modify: `apps/app/components/crm/record-sheet/contact-sheet.tsx` (same pattern)
- Modify: `apps/app/components/estimates/estimate-builder.tsx` (add "Create contract" action beside the existing send/download actions, enabled when the estimate has line items; calls `contracts.createFromEstimate`, then navigates to the new contract detail)
- Modify: `apps/app/components/documents/send-document-dialog.tsx` (add a right-hand preview pane: fetches `templates.preview` with the record refs for the matching purpose; the message textarea becomes "Personal note (optional)" injected as `personalNote`; estimate/invoice send inputs gain `personalNote` plumbed through their `send` mutations)
- Modify: `apps/api/src/estimates/estimates.service.ts` + `estimates.contracts.ts`, `apps/api/src/invoices/invoices.service.ts` + `invoices.contracts.ts` (send() renders subject+html from the purpose template via `TemplatesService`/`MergeContextService` + `renderEmailHtml` with `personalNote` in context — the template's footer text block gains a `{{personal_note}}` token in `DEFAULT_TEMPLATES`; keep `text` fallback; modules import `TemplatesModule`)
- Test: extend estimates/invoices service specs for the templated send (subject from template, note substituted)

**Interfaces:**
- Consumes: `ContractsTable`, `contracts.createFromEstimate`, `templates.preview`.
- Produces: estimate/invoice emails now branded; contract send flows through the same dialog with purpose `CONTRACT_SEND`.

- [ ] **Step 1: API side** — templated estimate/invoice send + tests + `bun run check-types` regenerate.
- [ ] **Step 2: App side** — tabs, create-from-estimate, dialog preview pane.
- [ ] **Step 3: Verify in dev**: send an estimate with file transport; outbox envelope contains rendered HTML with real contact name and the personal note.
- [ ] **Step 4: Commit** — `feat: link contracts across sheets and template all sends`

### Task 11: Public signing page

**Files:**
- Modify: `apps/app/proxy.ts` (add `/sign` to the ungated paths beside `/sign-in`, `/grant-access`, `/eve` — read the file first; keep the gate logic untouched otherwise)
- Create: `apps/app/app/sign/[token]/page.tsx` (server page OUTSIDE `(app)/[slug]`: calls `contractSigning.bySigningToken` via the server tRPC caller — find how server pages call trpc today, `apps/app/lib/trpc/server.ts` — and renders states: not found, expired, voided, already signed, or the signing view)
- Create: `apps/app/app/sign/[token]/signing-view.tsx` (client: contract body HTML, sign card with Type/Draw segmented control per the approved preview — typed name renders in an italic serif preview, draw = plain `<canvas>` pointer events, no new dependency; Agree & sign calls `contractSigning.sign`; success swaps to the signed confirmation banner; mobile-first layout)

**Interfaces:**
- Consumes: `contractSigning.bySigningToken/sign`.
- Produces: the public route `${APP_URL}/sign/<token>`.

- [ ] **Step 1: Proxy ungating + server page states.**
- [ ] **Step 2: Signing view** with both signature modes; drawn canvas exports `toDataURL("image/png")`; empty-signature guard.
- [ ] **Step 3: Verify in dev logged OUT** (incognito): open a real signing link from the outbox envelope, sign typed; contract flips SIGNED in the app; signed PDF lands in outbox addressed to both parties. Repeat with drawn.
- [ ] **Step 4: Commit** — `feat: add public contract signing page`

### Task 12: End-to-end walkthrough and polish

**Files:**
- Modify: whatever the walkthrough surfaces.

- [ ] **Step 1: Full walkthrough** (Playwright or manual via dev-session cookie): Settings → edit all four templates → preview sample → estimate → send (check outbox HTML) → Create contract → edit body → send → sign at `/sign/<token>` → verify SIGNED + signed PDF + record-sheet tabs on deal and contact → invoice send branded → void a second contract → expired-token state (set `tokenExpiresAt` past via psql, reload).
- [ ] **Step 2: Full repo typecheck** `bun run check-types`. Expected: PASS (pre-existing `apps/api` bulk/auth e2e env failures are known and not ours).
- [ ] **Step 3: Fix what surfaced, commit** — `fix:` commits per issue.
- [ ] **Step 4: Final commit + report** with AGENTS.md `## Issues` list (BROKEN/RISK/NOT DONE/UNKNOWN), including: SMTP untested against a real server (file transport proven), and any parked items.
