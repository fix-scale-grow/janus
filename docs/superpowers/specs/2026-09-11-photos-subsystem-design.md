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
receipts:

- Files under `data/photos/<photoId>/` — `master.<ext>` + `thumb.<ext>`
- On upload: magic-byte sniff (JPEG/PNG/WebP; the logo-upload lesson — never
  trust extension or client mime), downscale master to max 2560px long edge,
  generate 400px thumbnail, strip EXIF except capture date (read `takenAt`
  before stripping)
- HEIC (iPhone): resolved during build via a small spike — convert server-side
  if the toolchain supports it cheaply, otherwise reject with a clear
  "please use JPEG" error. Either way the behavior is explicit, never a silent
  failure.
- Upload cap 15MB; strict photo-id pattern validation on all file routes
  (the receipt-route pattern, not the older unvalidated thumbnail routes)
- Serving: session-gated GET routes for master + thumb; atomic
  temp-file-then-rename on save (phase-i lesson)
- Env: optional `PHOTOS_DATA_DIR` override, same shape as `DRAWINGS_DATA_DIR`

## API (tRPC `photos` module)

- `upload` (multipart via the existing file-upload route pattern),
  `list` (by deal / contact, with filters), `get`, `delete`, `updateMeta`
- Link procs: `linkEstimate` / `linkInvoice` / `linkProject` with unlink
  counterparts and `updateLink` (includeInPdf, stageLabel, sortOrder)
- List procs for each surface (photos of an estimate/invoice/project) return
  link metadata joined with photo + thumb URL
- Emits `photo.uploaded` domain event (registered but unused until the
  automations phase)

## UI

**Photos tab** on deal sheet and contact sheet:
- Desktop: drag-drop zone + file picker, multi-file
- Mobile: same route; native `<input type="file" accept="image/*" capture>`
  gives crew take-photo / camera-roll with no separate build
- Gallery grid of thumbs, lightbox on click, stage-label chips shown where
  project-linked, filter by label/date, delete with confirm

**Attach flows:**
- Estimate builder + invoice screen: "Attach photos" opens a picker over the
  deal's photos (upload-in-place allowed); attached list shows per-photo
  "Include in PDF" toggle + drag sort
- Project page: same picker; each link gets a stage-label select
  (default BEFORE)

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
- Table-driven check that new file routes appear in the id-validation
  coverage the hardening phase established

## Sequencing

Sub-project 1 of the client-request bundle. Followers, each with their own
design: pipeline stage click-through (bounded), customisable dashboard
(architectural, rides on UserView), pack builder (consumes this subsystem).
Merge via the kyle-cc train; migrations timestamped after every peer's latest.
