# Proposal builder

Approved by Kyle 2026-09-13 (all three recommended options): a proposal has a
public link where the client views it and accepts online; acceptance locks the
tier and preps a contract; the document is cover + drag-drop sections + pricing
+ photos, with a reusable body template in Settings › Templates. Built on the
documents wave (preview dialog, text blocks, photos) and mirroring the contract
subsystem (block body, tokenized public page, atomic state flip).

## Data model

`Proposal`, 1:1 with an estimate (`estimateId @unique`, cascade delete):

- `number` autoincrement, `title` (defaults to the estimate title)
- `status ProposalStatus` — DRAFT / SENT / ACCEPTED / VOID
- `coverTitle String?`, `coverSubtitle String?` (cover page copy; title falls
  back to the proposal title)
- `body Json` — `TemplateBlock[]`, snapshotted from the PROPOSAL_BODY template
  at create, edited with the contract `BlockCanvas`
- `sentAt`, `sentTo`, `viewToken @unique`, `tokenExpiresAt` (32 bytes, 30
  days, rotates on resend — the contract recipe)
- `acceptedAt`, `acceptedTier EstimateTier?`, `acceptedName String?`
- `createdById`

One proposal per estimate. No separate nav section: the proposal lives at
`/estimates/[estimateId]/proposal`, reached from a Proposal button on the
estimate builder (creates on first use, opens thereafter).

## Templates

Two new `TemplatePurpose` values, lazily seeded like the others:

- `PROPOSAL_BODY` — document-mode blocks: a heading and an intro paragraph
  with merge fields. Snapshotted into each new proposal.
- `PROPOSAL_SEND` — email: subject "Your proposal from {{business.name}}",
  body with `{{proposal_link}}` button. `proposal_link` joins `signing_link`
  as a send-time token (excluded from preview missing-warnings).

## Public page

`/proposal/[token]` (added to the proxy `ANONYMOUS` list), server-rendered via
a public `proposalView` router (no AuthMiddleware), mirroring
`contractSigning`:

- `byToken` returns business name/brand, cover, merge-resolved body blocks,
  the Good/Better/Best pricing table (names, quantities, per-tier totals),
  photo URLs, status, and the estimate's `selectedTier` as the default pick.
- The client picks a tier (radio cards), types their name, and hits Accept.
- ACCEPTED and VOID and expired states render friendly message cards; DRAFT
  404s.
- Photos are served through a token-gated public route
  (`/api/proposal-photos/[token]/[photoId]`) so the page needs no session.

## Accepting

`proposalView.accept({ token, tier, name })`, atomic like contract signing
(`updateMany where status: "SENT"`; zero rows = conflict):

1. Proposal → ACCEPTED with `acceptedTier`, `acceptedName`, `acceptedAt`.
2. Estimate → status ACCEPTED, `selectedTier` = chosen tier.
3. A draft Contract is created from the estimate
   (`ContractsService.createFromEstimate`, acting user = proposal creator).
4. If the estimate has a deal, an Activity (type NOTE, subject "Proposal
   accepted", meta kind "proposal" with the tier) lands on it.

Steps 2-4 follow the accept flip; a failure there logs loudly but never
un-accepts (the client's acceptance is the fact of record).

## Owner UI

`/estimates/[estimateId]/proposal`:

- Header: status badge, Preview (DocumentPreviewDialog, kind "proposal",
  purpose PROPOSAL_SEND), Copy link (when SENT), Send / Resend, Void.
- Cover card: cover title + subtitle inputs (blur-save).
- Body: `BlockCanvas` when DRAFT, static render otherwise (contract pattern).
- Pricing: read-only Good/Better/Best summary from the estimate; a note that
  photos and pricing come from the estimate.
- Accepted banner: who, which tier, when, link to the draft contract.
- The estimate builder header gains a Proposal button.

## PDF

`proposals.document` renders: cover page (workspace name, cover title or
title, subtitle, contact, date), body blocks (reusing the contract PDF's
block rendering), the tier pricing table, then estimate photos (existing
grid style). Used by the preview dialog's PDF tab and Download.

## Send

`proposals.send` mints/rotates the token, renders PROPOSAL_SEND with
`proposal_link`, mails it (no PDF attachment — the link is the document),
flips DRAFT → SENT, stamps `sentAt`/`sentTo`. Merge-guard blocks unresolved
fields exactly like contract sends.

## Testing

- API integration: create-from-estimate snapshot, atomic accept (double-accept
  conflicts), accept flips estimate + creates draft contract + activity,
  token expiry, void.
- PDF spec: signature + text-content growth like the other renderers.
- Playwright walkthrough: estimate → build proposal → edit cover/body → send
  (file mailer) → open public link signed out → pick tier → accept → estimate
  ACCEPTED at tier, draft contract exists, banner shows.

## Out of scope

Decline flow, per-proposal photo selection (uses the estimate's PDF-flagged
photos), proposal list view, multi-proposal per estimate, payment collection.
