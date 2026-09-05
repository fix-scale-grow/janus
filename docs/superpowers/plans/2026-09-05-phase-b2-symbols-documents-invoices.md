# Phase B.2: Symbol System, Estimate Documents & Email, Invoices, Contact View — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close Kyle's user-test round: a first-class symbol system (named, user-editable, real-world sized, DB-backed) replacing Excalidraw's library panel; estimates that become sendable documents (PDF + email via the install's SMTP) assigned to contacts; invoices as the post-acceptance step (with aging); and a contact view surfacing that contact's drawings, estimates, and invoices.

**Architecture:** A `Symbol` model replaces the static `.excalidrawlib` + localStorage seeding — a Janus-owned palette panel (names visible, click-to-place, real-world scaling) supersedes Excalidraw's library UI. A `MailerService` (nodemailer over install-configured SMTP, optional capability) plus a `@react-pdf/renderer` document layer serve both estimates and invoices. `Invoice`/`InvoiceLineItem` snapshot a chosen estimate tier at conversion. Contact record sheet gains three tabs reusing the existing embedded tables.

**Tech Stack:** Prisma, nestjs-trpc, nodemailer, @react-pdf/renderer, Next.js App Router, Bun test.

**Spec:** `docs/superpowers/specs/2026-09-04-scope-drawings-and-forms-design.md` plus Kyle's 2026-09-05 user-test directives (recorded here as binding): symbols labelled + user-creatable/editable + carry measurements; estimates convert to a document, assigned to a contact (or one created inline), emailed via the CRM's own server (white-label later); invoices follow accepted estimates; contact click-through shows drawings/estimates/invoices.

## Global Constraints

- All Phase A/B constraints stand verbatim: no code comments; plain commit messages (no trailers); tabs + biome (`bun run format` then `git restore design/`); tRPC pattern (contracts/router/service/module, InjectDatabase, class-level AuthMiddleware, translate P2025→404 + P2003→BadRequest, paginate(), resolveOrderBy for sortable lists); regenerate + commit `apps/api/src/generated/server.ts` via `bun run check-types` from apps/api; single tenant (WORKSPACE_ID constant, user id from ctx); integer cents, per-line `Math.round(Number(quantity) * priceCents)` then sum, currency-aware rendering via `formatMoney`/`currencySymbol` from `@crm/ui/lib/format` — never a hardcoded `$`; parse-at-boundary with Zod; server page computes / client renders; packages/ui only; Suspense rule for URL-state readers; cache helpers in `apps/app/lib/trpc/cache.ts` (add `symbol()`, `invoice(id)`); constants in config objects; one root `.env`, new vars documented in `.env.example` and declared in `apps/api/src/config/env.validation.ts` when the API reads them; **optional capabilities never throw** — missing SMTP config hides Send buttons.
- **Sending is gated**: an email leaves the machine only on an explicit button press in a confirm dialog that shows recipient + subject. No auto-send anywhere.
- Live-verification recipe (final task): Postgres `C:\Users\Kyle\pg17\pgsql\bin\pg_ctl.exe -D C:\Users\Kyle\pg17\data -l C:\Users\Kyle\pg17\pg.log status`; dev server `bunx turbo run dev --filter=app --filter=api` (never plain `bun run dev`); cookie `bun run dev:session karlosantanas@gmail.com` from apps/api; Playwright via NODE from `.superpowers/sdd/satellite-verify`. Known pre-existing: apps/api bulk/fields/auth.e2e failures-or-hangs; library first-mount race (obsolete once the palette ships).
- Mail in dev: `MAIL_TRANSPORT=file` writes rendered emails (JSON: envelope + text + attachment metadata, and the PDF itself) to `data/mail-outbox/` instead of SMTP — this is how walkthroughs verify sends without a mail server. `MAIL_TRANSPORT=smtp` (default when SMTP_HOST set) uses real SMTP.
- Read before touching: docs/api.md, docs/design.md, docs/currency.md, .agents/skills/nestjs-trpc/, .agents/skills/shadcn/, .agents/skills/nuqs/ as in prior phases.

## Rulings carried from planning

- The Excalidraw library panel (and Phase A's install/persist wiring) is SUPERSEDED by the Janus palette; keep the `#addLibrary` handler code but hide/remove the Library toolbar affordance in favor of the palette (Task 3 decides the least-destructive form; deleting the localStorage seeding path is correct once DB symbols exist).
- Symbol real-world sizing applies at PLACEMENT on calibrated drawings (scale set): the symbol's elements are scaled so its bounding box = widthFt × pixelsPerFoot. Uncalibrated drawings place at the symbol's authored pixel size. Satellite surface does not place symbols (unchanged).
- Invoice numbers are sequential per install via `@default(autoincrement())`.
- Estimate SENT status is set by a successful send; ACCEPTED/DECLINED remain manual labels until e-sign exists (future phase).

---

### Task 1: Symbol, Invoice, InvoiceLineItem models

**Files:** Modify `packages/db/prisma/schema.prisma`; migration `add_symbols_and_invoices`.

**Interfaces:** Produces Prisma models `Symbol`, `Invoice`, `InvoiceLineItem`, enum `InvoiceStatus` — consumed by Tasks 2, 7, 8.

- [ ] **Step 1: Add models**

```prisma
model Symbol {
  id        String   @id @default(cuid())
  name      String
  trade     String   @default("roofing")
  elements  Json
  widthFt   Decimal? @db.Decimal(8, 2)
  heightFt  Decimal? @db.Decimal(8, 2)
  serviceId String?
  service   Service? @relation(fields: [serviceId], references: [id], onDelete: SetNull)
  active    Boolean  @default(true)
  sortOrder Int      @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([trade, sortOrder])
  @@map("symbol")
}

enum InvoiceStatus {
  DRAFT
  SENT
  PAID
  VOID
}

model Invoice {
  id          String            @id @default(cuid())
  number      Int               @unique @default(autoincrement())
  status      InvoiceStatus     @default(DRAFT)
  currency    String            @default("USD")
  issuedAt    DateTime?
  dueAt       DateTime?
  paidAt      DateTime?
  notes       String?
  estimateId  String?
  estimate    Estimate?         @relation(fields: [estimateId], references: [id], onDelete: SetNull)
  dealId      String?
  deal        Deal?             @relation(fields: [dealId], references: [id], onDelete: SetNull)
  contactId   String?
  contact     Contact?          @relation(fields: [contactId], references: [id], onDelete: SetNull)
  createdById String
  createdBy   User              @relation("InvoiceCreator", fields: [createdById], references: [id])
  lineItems   InvoiceLineItem[]
  createdAt   DateTime          @default(now())
  updatedAt   DateTime          @updatedAt

  @@index([dealId])
  @@index([contactId])
  @@index([status])
  @@index([dueAt])
  @@map("invoice")
}

model InvoiceLineItem {
  id         String      @id @default(cuid())
  invoiceId  String
  invoice    Invoice     @relation(fields: [invoiceId], references: [id], onDelete: Cascade)
  name       String
  unit       ServiceUnit
  quantity   Decimal     @db.Decimal(12, 2)
  priceCents Int
  areaLabel  String?
  sortOrder  Int         @default(0)
  createdAt  DateTime    @default(now())
  updatedAt  DateTime    @updatedAt

  @@index([invoiceId, sortOrder])
  @@map("invoice_line_item")
}
```

Back-relations: `symbols Symbol[]` on Service; `invoices Invoice[]` on Estimate, Deal, Contact; `invoices Invoice[] @relation("InvoiceCreator")` on User.

- [ ] **Step 2:** `bun run db:migrate` (name `add_symbols_and_invoices`); `bun run check-types` in packages/db.
- [ ] **Step 3:** Commit `feat: add Symbol and Invoice models`.

---

### Task 2: `symbols` API module + seed migration from the static library

**Files:** Create `apps/api/src/symbols/symbols.{contracts,service,router,module}.ts` + `symbols/roofing-symbol-seed.ts`; register module; regenerate server.ts; contract tests beside existing specs.

**Interfaces:**
- Produces alias `symbols`: `list({trade?, active?, ...listInput})` (rows: full record + serviceName via join, ordered trade then sortOrder); `byId`; `create({name, trade?, elements, widthFt?, heightFt?, serviceId?})`; `update({id, data})`; `delete({id})`; `seedRoofing()` → `{created}`.
- `elements` validated at the boundary with `excalidrawSceneData`'s element array schema from `@crm/drawings` (a `symbolElements = z.array(excalidrawElement).min(1).max(50)` in contracts).
- Seed: port the 12 items from `apps/app/public/libraries/janus-roofing.excalidrawlib` into `roofing-symbol-seed.ts` as `{name, elements, widthFt, heightFt, serviceSymbolId}` — real-world defaults: roof vent 1×1, ridge vent 4×0.5, skylight 2×4, chimney 2×2, pipe boot 0.5×0.5, gutter run 10×0.5, downspout 0.5×2, drip edge 10×0.25, window 3×4, door 3×7, ac unit 3×3, electrical mast 0.5×3 (ft). `seedRoofing` links each to the Service whose `symbolId` matches (`janus-roofing-<slug>`), idempotent by case-insensitive name. STRIP the `customData.symbol` stamps from seeded elements (placement stamps ids at drop time now — Task 3).

- [ ] Steps: contracts (failing tests: reject empty elements array, reject negative dimensions) → service/router mirroring services-catalog → seed → check-types/lint → commit `feat: add symbols tRPC module with roofing seed`.

---

### Task 3: Janus symbol palette (replaces the Excalidraw library panel)

**Files:** Create `apps/app/components/drawings/symbol-palette.tsx`; modify `drawing-editor.tsx` (palette toggle button in the toolbar labelled "Symbols"; remove/hide the localStorage library seeding effect and the reliance on Excalidraw's Library button — set `UIOptions` if needed to hide Excalidraw's library icon, check the installed version's prop for it); add `cache.symbol()` helper.

**Interfaces:** Consumes `symbols.list`; produces the placement path Task 4 extends.

- [ ] **Behavior:** A left-side collapsible panel (or Popover from the toolbar — pick the cleanest packages/ui fit given the scope panel already owns the right side): symbols grouped by trade, each row = small SVG/thumbnail preview + **visible name** + linked-service caption; search Input at top. Click a symbol → insert its elements at viewport center via `convertToExcalidrawElements` (per-handler dynamic import pattern), stamping `customData: { symbol: <symbol DB id> }` on the FIRST element only (the Phase B dedup rule). **Real-world sizing:** when the drawing has a scale and the symbol has widthFt, scale all inserted elements uniformly so the group's bounding-box width = widthFt × pixelsPerFoot (height follows aspect; if only heightFt set, key off height). No scale or no dims → authored size.
- [ ] **Thumbnail:** render each symbol's elements as a tiny static preview — simplest robust approach: `exportToSvg` from @excalidraw/excalidraw (dynamic import, memoized per symbol id) into a 40px box; if that fights the panel's render loop, an inline canvas via exportToCanvas is acceptable. No emoji placeholders.
- [ ] **Service auto-resolve migration:** placed symbols now stamp the Symbol DB id. Update the resolution chain: scope-panel/generate flows resolve service via the Symbol record's serviceId (fetch symbols once alongside services in the editor; build symbolId→serviceId map and pass through the existing plumbing — `measureScene` itself is agnostic, it just carries the `symbol` string). Server side: `generateFromDrawing` resolves `shape.symbol` first against `Symbol.id → serviceId`, falling back to the legacy `Service.symbolId` match so old drawings keep pricing. Update `buildLineItems`'s `ServiceLike`/inputs accordingly with tests (extend the generate spec: a shape whose symbol matches a Symbol row with serviceId resolves; legacy path still resolves).
- [ ] Verify live: palette lists 12 named symbols, click places at real-world size on a calibrated drawing (a 10ft gutter run spans 10 scaled feet — screenshot with a reference line), pin auto-prices in the panel, generate includes it.
- [ ] Commit `feat: add Janus symbol palette with real-world placement`.

---

### Task 4: Create and edit your own symbols

**Files:** Create `apps/app/components/drawings/save-symbol-dialog.tsx`, `apps/app/app/(app)/[slug]/settings/symbols/page.tsx` + `symbols-table.tsx`; modify `drawing-editor.tsx` (a "Save as symbol" action available when ≥1 element is selected — placement: the selection-aware toolbar area beside Mark area/line), settings sidebar entry.

- [ ] **Save-as-symbol:** selected elements are captured (deep-copied, positions normalized to origin, any customData.symbol/scope stamps STRIPPED), dialog asks: name (required), trade (default roofing), real-world width/height ft (optional, numeric ≥0), linked service (optional Select from services.list). Creates via `symbols.create`; palette refreshes.
- [ ] **Manage:** settings/symbols page — table (Name / Trade / Size / Service / Active) with edit dialog (rename, dims, service link, active toggle, delete with confirm; deleting a symbol leaves placed instances measuring via the legacy fallback path, note in the confirm copy "Placed copies keep working."). Mirror the price-book page's structure exactly.
- [ ] Verify live: draw a custom shape → Save as symbol ("Test Skylight", 2×4, linked to Skylight flashing kit) → appears in palette with name → place on calibrated drawing at true size → prices in panel. Edit rename works.
- [ ] Commit `feat: create and manage custom symbols`.

---

### Task 5: Mailer infrastructure (SMTP, optional capability)

**Files:** Create `apps/api/src/mailer/mailer.{service,module}.ts` + `mailer.config.ts`; modify `apps/api/src/config/env.validation.ts`, `.env.example`, `apps/api/package.json` (add `nodemailer` + types).

**Interfaces:** Produces `MailerService.isConfigured(): boolean` and `MailerService.send({to, subject, text, html?, attachments?: [{filename, content: Buffer, contentType}]}): Promise<{delivered: boolean}>` — consumed by Tasks 6, 9. Module exported for import by estimates/invoices modules.

- [ ] Env: `SMTP_HOST`, `SMTP_PORT` (default 587), `SMTP_SECURE` (bool), `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` (display+address, e.g. `Janus <estimates@example.com>`), `MAIL_TRANSPORT` (`smtp` | `file`; default smtp when SMTP_HOST set, else unconfigured). All optional in env.validation (never throw). `file` transport writes `{envelope, subject, text, attachments:[{filename, bytes}]}` JSON plus the raw attachment files to `data/mail-outbox/<timestamp>-<subject-slug>/` (reuse the DRAWINGS_DATA_DIR parent-dir pattern from drawing-thumbnails).
- [ ] `isConfigured()` = file transport OR complete SMTP config. Send with file transport must work with zero SMTP vars.
- [ ] Follow docs/api.md logging rules (never log recipients/bodies; log message: "Estimate email sent" + ids only).
- [ ] Unit-test the file transport (bun test beside api specs): send writes the outbox dir with attachment bytes intact.
- [ ] Commit `feat: add optional SMTP mailer with file transport for dev`.

---

### Task 6: Estimate document (PDF) + contact assignment + send

**Files:** Create `apps/api/src/estimates/estimate-pdf.ts` (pure: estimate data → PDF Buffer via `@react-pdf/renderer`; add dep to apps/api); extend estimates contracts/service/router: `assignContact({id, contactId | newContact:{name, email, phone?}})` (creates the contact via the same normalized path ContactsService uses — import/reuse its service or replicate its normalizeEmail + suppression-lift semantics per docs/api.md "Adding them back lifts the suppression"), `document({id})` → PDF as base64 (router returns {filename, base64}), `send({id, to?, subject, message})` → renders PDF, MailerService.send with attachment, sets status SENT, records nothing else (no Activity work this phase); 400 with clear message when `!isConfigured()`; `to` defaults to the assigned contact's email, requires one. Frontend: `apps/app/components/estimates/send-estimate-dialog.tsx` + builder header changes: "Assign contact" control (Combobox over contacts.list-equivalent — find the existing contact picker used by deals attach flows and reuse; plus "New contact" inline name+email fields), "Download PDF" (fetches document, triggers browser download), "Send" (primary; hidden when a `mailer.configured` query — add a tiny public-shape query on the estimates router returning MailerService.isConfigured() — says no; dialog shows To (prefilled, editable), Subject (prefilled "Estimate — <title>"), Message textarea (prefilled short professional plain-text body), explicit Send button).

- [ ] **PDF content:** letterhead = workspace name (fetch via existing workspace read path server-side); estimate title, date, contact block when assigned; line items grouped by area with quantity/unit/unit price/total for the SELECTED tier; the other two tiers summarized as total-only options at the bottom ("Good $X · Better $Y · Best $Z", selected emphasized); currency-aware formatting (share cents-format logic — small local helper in estimate-pdf.ts mirroring formatMoney's output; @crm/ui is client-only, do not import it in the API).
- [ ] TDD the pure pdf builder minimally: it returns a non-empty Buffer starting with `%PDF` for a fixture estimate; tier math in the summary strip matches per-line rounding.
- [ ] Verify live with MAIL_TRANSPORT=file: assign a contact, download the PDF (open/screenshot page 1), send → outbox dir contains the JSON + a valid PDF attachment; estimate flips to SENT.
- [ ] Commits: `feat: render estimate PDFs`, `feat: assign contacts and send estimates by email`.

---

### Task 7: `invoices` API module (convert from estimate, aging)

**Files:** Create `apps/api/src/invoices/invoices.{contracts,service,router,module}.ts`; register; regenerate server.ts; spec for the conversion + aging pure logic (extract `agingBucket(dueAt, status, now): "current" | "due_soon" | "overdue" | null` and `linesFromEstimate(estimate, tier)` into `apps/api/src/invoices/invoice-logic.ts`, pure + tested).

**Interfaces:** alias `invoices`: `list({dealId?, contactId?, estimateId?, status?, ...listInput})` → rows `{id, number, status, currency, contactId, contactName, dealId, dealName, totalCents, dueAt, aging, updatedAt}` (sortable number/status/dueAt/updatedAt via resolveOrderBy); `byId` (+lineItems + totalCents); `createFromEstimate({estimateId, tier?})` — tier defaults to the estimate's selectedTier; copies that tier's price per line into `priceCents`, copies name/unit/quantity/areaLabel/sortOrder, inherits currency/dealId/contactId/estimateId, status DRAFT, `dueAt` = now + 30 days (constant `INVOICES.defaultNetDays = 30` in an `invoices.config.ts`); `create({dealId?, contactId?})` (blank manual invoice); `setStatus`, `markPaid` (sets paidAt + status PAID), `update({id, data:{notes?, dueAt?, issuedAt?, contactId?}})`, line-item add/update/remove mirroring estimates (same quantity cap), `delete`. Sending an invoice sets issuedAt if null.
- Aging: `overdue` = dueAt past + status SENT; `due_soon` = within 7 days (constant); null for PAID/VOID/DRAFT.
- P2003/P2025 translated as in estimates.

- [ ] Steps: pure-logic failing tests (tier snapshot copies BETTER prices when tier BETTER; GOOD when GOOD; aging buckets across the boundary cases) → implement → module wiring → check-types/lint → commit `feat: add invoices tRPC module with estimate conversion`.

---

### Task 8: Invoices UI (list, detail, deal tab) + convert button

**Files:** Create `apps/app/app/(app)/[slug]/invoices/{page.tsx, invoices-search-params.ts, invoices-table.tsx}` and `[invoiceId]/page.tsx` + `apps/app/components/invoices/invoice-detail.tsx` (+ line-row/add-item, reuse-or-mirror the estimate builder components — extract shared pieces only where trivially clean, do not force it); modify deal-sheet (Invoices tab), janus-nav (Invoices entry), estimate builder (when status ACCEPTED — and also allow from any status via overflow menu — a "Convert to invoice" button → createFromEstimate(selected tier) → navigate to the invoice); `cache.invoice(id)` helper.

- [ ] List columns: Number (#42), Contact, Status badge, Aging badge (overdue destructive, due-soon secondary), Total (formatMoney), Due, Updated; status filter tabs. DESIGN REFERENCE (layout intent only): `design/v0-suite/app/(app)/invoices/page.tsx` + `[id]/page.tsx`.
- [ ] Detail: header (number, status Select, contact assign control reusing Task 6's, issued/due date pickers — check packages/ui for the existing date picker component, notes textarea), single-price line items (no tiers), total, Mark paid (primary when SENT), Download PDF + Send (Task 9 wires these; render disabled placeholders only if Task 9 isn't merged yet — coordinate via the plan order, Task 9 lands right after).
- [ ] Verify live: accept an estimate → convert (BETTER tier) → invoice #1 with copied lines/prices → appears on deal tab + invoices list with aging.
- [ ] Commit `feat: add invoices list, detail, and estimate conversion`.

---

### Task 9: Invoice document + send (reuse mailer/PDF layer)

**Files:** Create `apps/api/src/invoices/invoice-pdf.ts`; extend invoices router: `document({id})`, `send({id, to?, subject, message})` (sets SENT + issuedAt); wire Download PDF + Send dialog in invoice-detail (reuse/generalize send-estimate-dialog into a shared `send-document-dialog.tsx` — one component, props for entity).
- [ ] PDF: letterhead, INVOICE #<number>, issued/due dates, contact block, single-tier lines, total due, notes. `%PDF` buffer test.
- [ ] Verify live with file transport: send invoice → outbox artifact; status SENT.
- [ ] Commit `feat: render and send invoice documents`.

---

### Task 10: Contact record view — Drawings, Estimates, Invoices tabs

**Files:** Modify `apps/app/components/crm/record-sheet/contact-sheet.tsx` (three DetailSheetTab entries mirroring deal-sheet's Drawings/Estimates tabs); ensure list filters exist: drawings.list contactId (exists), estimates.list contactId (ADD — same pattern as dealId; regenerate server.ts), invoices.list contactId (exists from Task 7). Embedded tables get contactId props (mirror their dealId props). New-drawing/new-estimate buttons in these tabs pass contactId.
- [ ] Verify live: open a contact with an assigned estimate + invoice + an attached drawing → all three tabs populated; create-from-contact flows set contactId.
- [ ] Commit `feat: surface drawings, estimates, and invoices on contacts`.

---

### Task 11: Final integration pass (live E2E)

- [ ] Root check-types, lint, `bun test` packages/drawings + api specs (estimates-generate, invoice-logic, mailer file transport, symbols contracts), build (judge unrelated failures vs base).
- [ ] THE walkthrough (Playwright, screenshots to the sdd dir), with `MAIL_TRANSPORT=file` in .env for the run:
  a. Settings → Symbols: 12 seeded named symbols; palette in the editor lists them with names.
  b. Draw an irregular closed polygon (line tool) → Mark area → scale → tag shingles: area measures.
  c. Place a gutter-run symbol on the calibrated drawing → spans its real-world length; save a custom symbol from selected shapes, place it, verify name + pricing via linked service.
  d. Generate estimate (or Open existing per the quick-wave guard) → builder → assign a NEW contact created inline → Download PDF (verify %PDF + screenshot) → Send → outbox artifact exists, status SENT.
  e. Mark ACCEPTED → Convert to invoice (Better) → invoice #N, correct copied prices → Send invoice → outbox artifact; aging badge states correct after tweaking dueAt.
  f. Open the contact sheet → Drawings/Estimates/Invoices tabs all show the artifacts.
  g. Zero console errors from new code. Fix what fails, commit fixes.
- [ ] Append "Phase B.2 implemented <date>." to the spec Status line. Commit `feat: complete Phase B.2 symbols, documents, and invoices`.

---

## Self-review notes (applied)

- Kyle's directives covered: symbol labels (T3 palette), user-built symbols + measurements (T4 + real-world sizing T3), irregular shapes (quick wave, verified in T11b), duplicate-estimate guard (quick wave), document + contact assignment + email (T6), invoices post-acceptance (T7-9), contact click-through (T10).
- Type consistency: Symbol.id stamping vs legacy Service.symbolId fallback resolved in T3 both client and server with tests; InvoiceLineItem single `priceCents` (tier snapshot) vs estimate's three columns is intentional.
- Placeholder scan: clean; prose tasks carry exact interface contracts + named reference files per Phase A/B precedent.
- YAGNI cuts: no payment processing, no e-sign, no invoice partial payments, no per-symbol categories beyond trade, no white-labeling (all future).
