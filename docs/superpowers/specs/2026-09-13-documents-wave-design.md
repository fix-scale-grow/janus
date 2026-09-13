# Documents wave: photos anywhere, preview window, per-document text blocks

Approved by Kyle 2026-09-13. Three complaints drove this: the Attach-photos dialog
dead-ends on an estimate with no job or contact; seeing what a client receives
requires clicking Send or downloading the PDF; the PDF layout cannot be adjusted
per document. The proposal builder is a separate follow-up spec and is out of
scope here, but every piece below becomes an ingredient for it.

## A. Photos at every stage

Today `POST /api/photos/upload` refuses a photo without a `dealId` or
`contactId`, and `AttachPhotosDialog` renders a dead-end empty state when the
estimate or invoice has neither. The PDF renderers already print linked photos
(`pdfPhotosForEstimate` / `pdfPhotosForInvoice`), so unblocking attachment is the
whole job.

### Data model

- `Photo.dealId` and `Photo.contactId` may both be null only when the photo is
  born linked to a document. The upload route accepts an `estimateId` or
  `invoiceId` instead of a deal/contact; it creates the `Photo` row and the
  `EstimatePhoto`/`InvoicePhoto` link in one transaction. A photo can never end
  up with no anchor and no link.
- No schema change: both columns are already nullable; the link tables already
  exist. The change is contract validation plus the transactional create.

### Re-anchoring

When a deal or contact is attached to an estimate or invoice
(`estimates.assignContact`, `estimates.update` gaining a `dealId`,
`invoices.update`, invoice `assign-contact`), every photo linked to that
document whose `dealId` and `contactId` are both null is re-anchored: `dealId`
(preferred) or `contactId` is written onto the photo, in the same service call.
The photo then appears in the job's library like any other.

### Dialog UX

The anchorless state of `AttachPhotosDialog` is replaced by two live paths:

- An Upload button that uploads straight onto the document (route above). The
  grid shows the document's already-linked photos.
- An "Attach a job or contact" hint that opens the existing assign-contact
  flow for that surface, then falls through to the normal picker.

When an anchor exists, behavior is unchanged (pick from the job or contact
library, plus upload).

## B. Preview window

A Preview button on the estimate builder, invoice detail, and contract detail
opens a large dialog with two tabs:

- **PDF** — fetches the existing `estimates.document` / `invoices.document` /
  contract document procedure (base64), converts to a blob URL, and renders it
  in an `<object type="application/pdf">` fill-height frame. Same bytes a
  client would download; no file saved.
- **Email** — the branded email exactly as it would send, reusing the
  `templates.preview` renderer the send dialog already uses (subject line shown
  above the iframe). Unresolved merge fields show the send dialog's existing
  missing-fields warning, read-only.

The dialog is view-only: no send button inside it (the Send action stays where
it is). Preview fetches on open, not on page load. One shared component,
`DocumentPreviewDialog`, parameterized the same way `SendDocumentDialog` is.

## C. Per-document text blocks

`Estimate` and `Invoice` each gain three nullable text columns: `introNote`,
`scopeOfWork`, `terms` (additive migration). Plain multiline text in v1 — no
block editor, no merge fields.

- **Editing**: a "Document text" card on the estimate builder and invoice
  detail with the three labeled textareas, saved with the existing update
  mutations (debounced blur-save like notes elsewhere).
- **PDF placement**: intro note under the header before line items; scope of
  work after line items; terms at the bottom in smaller type, after photos.
  Sections render only when non-empty.
- Defaults from Settings › Templates are proposal-builder territory; v1 starts
  blank per document.

## Error handling

- Upload with a document id validates the document exists (404 otherwise), same
  as the deal/contact checks today.
- Re-anchoring never throws into the attach call; a failure logs and leaves
  photos linked but unanchored, which remains a valid state.
- Preview PDF fetch failures show the dialog's error state with a retry, not a
  toast loop.

## Testing

- API: transactional upload-link create (estimate and invoice), both-null
  anchor rule, re-anchor on assignContact/update for all four paths, text
  columns persist and render into PDF section order.
- App: 312-suite stays green; Playwright walkthrough: standalone estimate →
  upload photo → preview shows photo and text blocks → attach contact →
  photo re-anchored → invoice parity.

## Out of scope

Proposal builder (cover pages, drag-drop sections, branded themes) — next
spec. Branding and layout settings for PDFs. Rich text. Photo captions.
