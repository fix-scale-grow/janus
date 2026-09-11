# Photos subsystem — design

Date: 2026-09-11
Status: approved by Kyle (chat, 2026-09-11)
Branch: janus/phase-l-photos (worktree .claude/worktrees/phase-l-photos, off foundation@d9ef20c)

## Goal

Client-requested: photos on a contact/deal that tie to estimates, invoices, and
project stages. Uploaded by office staff (desktop drag-drop) and crew in the
field (mobile camera/camera-roll). Photos flagged per-link for inclusion in the
estimate/invoice PDF the client receives. This subsystem is also the substrate
for the later "pack builder" (document packet: estimate + contract + photos)
and the automations phase (`photo.uploaded` event).

Out of scope for this phase: pack builder, client-submitted photos via forms,
Janus agent photo tools, any automation actions.

## Data model (all additive migrations, models appended at schema end)

`Photo`
- `id`, `createdAt`, `updatedAt`
- `dealId` (nullable), `contactId` (nullable) — at least one required,
  enforced in service layer
- `uploadedById` (user)
- `filename` (original), `mimeType`, `sizeBytes`, `width`, `height`
- `takenAt` (nullable — EXIF date if present, else upload time)

Join tables, each carrying per-link metadata:

`EstimatePhoto` — `estimateId`, `photoId`, `includeInPdf` (default false),
`sortOrder`. Unique on (estimateId, photoId).

`InvoicePhoto` — `invoiceId`, `photoId`, `includeInPdf` (default false),
`sortOrder`. Unique on (invoiceId, photoId).

`ProjectPhoto` — `projectId`, `photoId`, `stageLabel` enum
`BEFORE | IN_PROGRESS | AFTER | FINAL`, `sortOrder`. Unique on
(projectId, photoId).

One photo, uploaded once, linkable everywhere; deleting a photo cascades its
links. Deleting an estimate/invoice/project cascades only the link rows.

## Storage

Local-disk pattern already proven by drawing thumbnails, logo upload, and cost
receipts. Amended 2026-09-11 after codebase exploration: the repo has NO
server-side image library (all resizing is client-side canvas — the
drawing-background pattern), so processing happens in the browser:

- Client decodes the file, downscales master to max 2560px long edge
  (JPEG q0.85) and a 400px thumbnail (JPEG q0.8) via canvas, reads
  width/height; `takenAt` = the file's lastModified. Canvas re-encode strips
  EXIF by construction.
- HEIC (iPhone): iOS converts to JPEG automatically in the file input; a
  file the canvas cannot decode gets a clear "That image format isn't
  supported — use JPEG" error. Never a silent failure.
- Pipeline is JPEG-only on disk: `data/photos/<photoId>/master.jpg` +
  `thumb.jpg`
- Upload route magic-byte sniffs both blobs as JPEG (reuses
  `matchesDeclaredType` from the logo path — never trust extension or client
  mime); atomic temp-file-then-rename saves (phase-i lesson)
- Caps: master 15MB, thumb 1MB; strict photo-id pattern validation on all
  file routes (the receipt-route pattern, not the older unvalidated
  thumbnail routes)
- Serving: session-gated GET routes for master + thumb
- Env: optional `PHOTOS_DATA_DIR` override, same shape as `DRAWINGS_DATA_DIR`

## API (amended 2026-09-11 to match house patterns)

File lifecycle lives in Next.js route handlers (the receipt-route precedent —
the route owns both the DB row and the disk files, with rollback):

- `POST /api/photos/upload` — multipart FormData (master + thumb blobs,
  dealId/contactId, filename, width, height, takenAt); creates the Photo row
  and saves both files, deleting the row if the save fails. No two-step
  create-then-upload, no ghost rows.
- `GET /api/photos/[photoId]/[variant]` (variant = master | thumb) —
  session-gated, id-pattern-validated, immutable private cache
- `DELETE /api/photos/[photoId]` — deletes row (links cascade) + files

Metadata and links are a tRPC `photos` module (NestJS, alias "photos"):

- `list` (by deal / contact)
- Per-surface link procs: `linkEstimate` / `unlinkEstimate` /
  `setEstimatePdfFlag` / `reorderEstimatePhotos`, the invoice equivalents,
  and `linkProject` / `unlinkProject` / `setProjectStage`
- `forEstimate` / `forInvoice` / `forProject` return link metadata joined
  with the photo
- `updateMeta` dropped (YAGNI — no rename surface in v1)
- `photo.uploaded` event DEFERRED to the automations phase: the CRM event
  catalog's record kinds (`contact | deal`) and the emission path
  (AgentTriggerService, Nest-side) don't fit a Next-route upload cleanly;
  the automations phase owns wiring it when something actually consumes it.

## UI

**Photos tab** on deal sheet and contact sheet:
- Desktop: drag-drop zone + file picker, multi-file
- Mobile: same route; native `<input type="file" accept="image/*" multiple>`
  — iOS/Android file inputs already offer take-photo AND camera-roll, so no
  `capture` attribute (it would force the camera and hide the roll). The
  deal/contact sheet is already a bottom drawer on phones (responsive-sheet),
  so the Photos tab is mobile-ready by construction.
- Gallery grid of thumbs, lightbox on click, stage-label chips shown where
  project-linked, filter by label/date, delete with confirm

**Attach flows:**
- Estimate builder + invoice screen: "Attach photos" opens a picker over the
  deal's photos (upload-in-place allowed); attached list shows per-photo
  "Include in PDF" toggle + drag sort
- Project page: has no tab structure (header + full-height board), so photos
  get a header-action button opening a photos dialog; each link gets a
  stage-label select (default BEFORE)

## PDFs

Estimate and invoice PDFs (@react-pdf, existing `pdf-money.ts` document
patterns) gain a photos section after the line items: captioned grid of
`includeInPdf` links in sortOrder, master images downscaled to keep PDF size
sane. No photos flagged → section absent, output byte-identical in intent to
today's PDFs.

## Testing

- Unit: link services, id-pattern validation, magic-byte sniffing,
  EXIF/`takenAt` extraction
- Integration (private DBs `janus_photos_dev` / `janus_photos_test`; shared
  `crm` never migrated pre-merge): upload → link → PDF-flag → list round trips;
  cascade behavior
- Playwright walkthrough: upload on deal (desktop), attach to estimate,
  toggle include-in-PDF, verify PDF contains the photo, project stage labels,
  mobile-viewport upload control renders
- All new file routes carry the id-pattern + session-gate + magic-byte
  guards; ride-along hardening: the existing
  `/api/drawings/thumbnail/[drawingId]` route (currently unvalidated) gets
  the same id-pattern guard

## Sequencing

Sub-project 1 of the client-request bundle. Followers, each with their own
design: pipeline stage click-through (bounded), customisable dashboard
(architectural, rides on UserView), pack builder (consumes this subsystem).
Merge via the kyle-cc train; migrations timestamped after every peer's latest.
