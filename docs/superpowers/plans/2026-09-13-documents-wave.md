# Documents Wave Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Photos attach at every stage of a client interaction, a Preview window shows the PDF and email without sending, and each estimate/invoice carries its own intro/scope/terms text that prints in the PDF.

**Architecture:** Extend the existing photos upload route to accept a document target and create the photo + link transactionally; re-anchor document-linked photos when a deal/contact arrives. One shared `DocumentPreviewDialog` renders the existing `document` procedures (PDF) and `templates.preview` (email). Three nullable text columns on Estimate/Invoice thread through contracts → services → PDF renderers.

**Tech Stack:** Next 16 app router, NestJS + nestjs-trpc, Prisma, @react-pdf, bun test, Playwright walkthrough.

**Spec:** docs/superpowers/specs/2026-09-13-documents-wave-design.md

## Global Constraints

- No code comments; no Co-Authored-By trailers (repo AGENTS.md).
- Additive migration only; shared `crm` DB — never stage destructive DDL.
- `bun run check-types` regenerates committed `apps/api/src/generated/server.ts`.
- Pre-push hook runs `bun run lint` repo-wide — `biome check --write` touched files before committing.
- No em dashes in UI copy.
- All UI from `/packages/ui` shared components; no custom radii/colors.

---

### Task 1: Upload route accepts estimate/invoice targets

**Files:**
- Modify: `apps/app/app/api/photos/upload/route.ts`
- Modify: `apps/app/components/photos/use-photo-upload.ts`

**Interfaces:**
- Produces: `POST /api/photos/upload` accepts `estimateId` or `invoiceId` form fields as an alternative to `dealId`/`contactId`; creates `Photo` (both anchors null) + `EstimatePhoto`/`InvoicePhoto` link in one `db.$transaction`, `includeInPdf: true`, `sortOrder` = max+1.
- Produces: `usePhotoUpload({ dealId?, contactId?, estimateId?, invoiceId? })` forwards whichever target it was given.

- [ ] **Step 1:** Extend route validation: accept `estimateId`/`invoiceId` strings; the "needs a deal or a contact" 400 fires only when all four are absent. Validate the estimate/invoice exists (404 like the deal check). When the target is a document, wrap `photo.create` + link create in `db.$transaction`, deriving `sortOrder` from `estimatePhoto.count`/`invoicePhoto.count` for that document.
- [ ] **Step 2:** Extend `usePhotoUpload` input type and body fields (`estimateId`, `invoiceId`), keeping the current precedence (deal > contact > estimate > invoice).
- [ ] **Step 3:** `bun run check-types` (apps/app) passes; commit.

### Task 2: Re-anchor photos when a deal or contact arrives

**Files:**
- Modify: `apps/api/src/photos/photos.service.ts`
- Modify: `apps/api/src/estimates/estimates.service.ts` (`assignContact`, `update` when `dealId` set)
- Modify: `apps/api/src/invoices/invoices.service.ts` (`update` when `contactId` set; `assignContact` if present)
- Test: `apps/api/test/photos-reanchor.integration.spec.ts`

**Interfaces:**
- Produces: `PhotosService.reanchorForEstimate(estimateId, { dealId?, contactId? }): Promise<void>` and `reanchorForInvoice(...)` — for every linked photo with `dealId` and `contactId` both null, write `dealId` (preferred) else `contactId`. Never throws outward: try/catch + `Logger.error`.
- Consumes: existing modules — EstimatesService and InvoicesService already inject `PhotosService`.

- [ ] **Step 1:** Write failing integration spec: create standalone estimate + anchorless photo + link; call `estimates.assignContact`; expect photo `contactId` set. Same for invoice update with `contactId`, and estimate `update` with `dealId`.
- [ ] **Step 2:** Implement `reanchorForEstimate`/`reanchorForInvoice` with `photo.updateMany` via the link table join (two queries: find linked anchorless ids, then `updateMany`).
- [ ] **Step 3:** Call them at the end of `estimates.assignContact` (contactId), `estimates.update` when `data.dealId` is a string, `invoices.update` when `data.contactId` is a string, and any invoice assign-contact path.
- [ ] **Step 4:** Spec passes; `bun run check-types`; commit.

### Task 3: Attach-photos dialog loses its dead end

**Files:**
- Modify: `apps/app/components/photos/attach-photos-dialog.tsx`
- Modify: `apps/app/components/estimates/estimate-builder.tsx`, `apps/app/components/invoices/invoice-detail.tsx` (pass `estimateId`/`invoiceId` + an `onAttachAnchor` opener for the existing assign-contact flow)

**Interfaces:**
- Consumes: Task 1's upload targets; existing `photos.forEstimate`/`photos.forInvoice` queries; existing link mutations.
- Produces: `AttachPhotosDialog` new optional props `estimateId`, `invoiceId`, `onAttachAnchor?: () => void`.

- [ ] **Step 1:** In the anchorless state render: Upload button wired to `usePhotoUpload({ estimateId | invoiceId })`, a grid of the document's own photos (`photos.forEstimate`/`forInvoice`), and a ghost button "Attach a job or contact" calling `onAttachAnchor` (hidden when the prop is absent).
- [ ] **Step 2:** Wire `onAttachAnchor` in the estimate builder and invoice detail to open their existing assign-contact affordance.
- [ ] **Step 3:** App tests + check-types green; commit.

### Task 4: DocumentPreviewDialog

**Files:**
- Create: `apps/app/components/documents/document-preview-dialog.tsx`
- Modify: `apps/app/components/estimates/estimate-builder.tsx`, `apps/app/components/invoices/invoice-detail.tsx`, contract detail surface (Preview buttons)

**Interfaces:**
- Consumes: `estimates.document` / `invoices.document` / `contracts.document` (`{ filename, base64 }`), `templates.preview` with `SendDocumentRefs`-shaped refs (same as `SendDocumentDialog`).
- Produces: `DocumentPreviewDialog({ open, onOpenChange, kind: "estimate" | "invoice" | "contract", documentId, purpose, refs })`.

- [ ] **Step 1:** Build the dialog: Tabs (PDF | Email). PDF tab fetches the document proc on open, builds `URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }))`, renders `<object type="application/pdf">` at full dialog height, revokes the URL on close; error state with a Retry button. Email tab reuses the send dialog's preview query and iframe (subject shown above; missing-merge-fields alert read-only).
- [ ] **Step 2:** Add Preview buttons (outline, Eye icon) beside Download/Send on all three surfaces.
- [ ] **Step 3:** Check-types + app tests; commit.

### Task 5: Per-document text blocks

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (+ additive migration `add_document_text_blocks`: `introNote`, `scopeOfWork`, `terms` TEXT nullable on `estimate` and `invoice`)
- Modify: `apps/api/src/estimates/estimates.contracts.ts` + service update path; `apps/api/src/invoices/invoices.contracts.ts` (`invoiceUpdateInput.data` gains the three trimmed-nullable strings, max 5000) + service
- Modify: `apps/api/src/estimates/estimate-pdf.ts`, `apps/api/src/invoices/invoice-pdf.ts` (render intro under header, scope after line items, terms after photos in smaller type; sections only when non-empty), plus the two `loadForPdf`/document loaders selecting the new columns
- Modify: `apps/app/components/estimates/estimate-builder.tsx`, `apps/app/components/invoices/invoice-detail.tsx` ("Document text" card, three textareas, debounced blur-save via existing update mutations)
- Test: extend `apps/api/test/estimate-pdf.spec.ts` / `invoice-pdf.spec.ts` fixtures

**Interfaces:**
- Produces: `EstimatePdfEstimate`/invoice PDF input types gain `introNote: string | null`, `scopeOfWork: string | null`, `terms: string | null`.

- [ ] **Step 1:** Failing PDF spec: fixture with the three fields expects rendered PDF text stream to contain them (existing pdf specs show the assertion pattern).
- [ ] **Step 2:** Migration + `bun run db:generate`; contracts + services + loaders; PDF sections; UI card.
- [ ] **Step 3:** Specs pass; check-types (regenerates server.ts); commit.

### Task 6: Gates + live walkthrough + push

- [ ] **Step 1:** `bun run check-types` (root), app suite 312+, targeted api suites (photos, estimates, invoices, projects) green.
- [ ] **Step 2:** Playwright walkthrough: standalone estimate → upload photo from dead-end dialog → Preview shows PDF with photo + text blocks and Email tab → attach contact → photo re-anchored (appears in contact photo library) → invoice parity → contract Preview opens.
- [ ] **Step 3:** `biome check --write` touched files; commit; push to origin janus/foundation.
