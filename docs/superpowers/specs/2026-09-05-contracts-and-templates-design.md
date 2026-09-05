# Contracts and Templates — Design

Date: 2026-09-05. Approved by Kyle against the interactive preview
(https://claude.ai/code/artifact/5d03f289-d2d3-42b8-889b-52d021603ac6).

## Goal

Two features, one phase:

1. **Contracts** — a first-class record linked to estimates and invoices, with
   e-signature. Created from an estimate, sent by email as a public signing
   link, signed by the client with a typed or drawn signature, tracked
   Draft → Sent → Signed → Void.
2. **Templates** — Settings › Templates. A drag-and-drop block editor for the
   emails that carry estimates, invoices and contracts, and for the contract
   document body. Dynamic merge fields with click-to-insert. Preview with real
   record data before anything sends.

Out of scope: editable estimate/invoice PDF layouts (they keep their current
`@react-pdf` layouts), payment collection, countersigning by the business,
multi-signer contracts.

## Data model

New models appended at the END of `packages/db/prisma/schema.prisma` (the
phase-d worktree holds uncommitted models after `InvoiceLineItem`; appending at
the end avoids the conflict).

```prisma
enum TemplateType { EMAIL CONTRACT }
enum TemplatePurpose { ESTIMATE_SEND INVOICE_SEND CONTRACT_SEND CONTRACT_BODY }

model Template {
  id        String   @id @default(cuid())
  name      String
  type      TemplateType
  purpose   TemplatePurpose @unique
  subject   String?          // EMAIL only
  blocks    Json             // owned by templateBlocksSchema (zod)
  updatedById String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@map("template")
}

enum ContractStatus { DRAFT SENT SIGNED VOID }

model Contract {
  id           String @id @default(cuid())
  number       Int    @unique @default(autoincrement())
  title        String
  status       ContractStatus @default(DRAFT)
  body         Json            // block tree snapshot from CONTRACT_BODY template at creation
  dealId       String?
  contactId    String?
  estimateId   String?
  invoiceId    String?
  createdById  String
  sentAt       DateTime?
  sentTo       String?
  signedAt     DateTime?
  signerName   String?
  signatureKind String?        // "typed" | "drawn"
  signatureData String?        // typed name or PNG data URI (drawn)
  signingToken  String? @unique
  tokenExpiresAt DateTime?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  @@map("contract")
}
```

Relations: optional FKs to Deal, Contact, Estimate, Invoice (onDelete:
SetNull), createdBy → User. One template per purpose (`@@unique`) keeps V1
simple: four seeded rows, editable, not deletable. Purpose seeds:
Estimate email, Invoice email, Contract email, Standard contract body.

`signatureData` for drawn signatures is a PNG data URI capped by zod
(500 KB). Signed contracts are immutable: body, signature and linked-record
snapshots never change after `signedAt` is set.

## Block schema (`packages/…` shared? No — lives in apps/api)

`apps/api/src/templates/template-blocks.ts` owns the zod schema and
`parseTemplateBlocks()`. Block union:

- `heading { text }`
- `text { html }` — inline HTML limited to `b/i/strong/em/a/br/span[data-field]`;
  sanitized on parse
- `button { label, href? }` — href defaults omitted in V1 (emails carry PDFs)
- `logo` — renders workspace initials badge; uses `workspace.logoUrl` if ever set
- `divider`
- `spacer { height }`

Merge fields appear as `{{token}}` inside heading/text/subject strings.

## Merge fields

`apps/api/src/templates/templates.config.ts` — the registry, `as const`:
`contact.full_name/first_name/email`, `business.name/phone`, `sender.name`,
`deal.title/address`, `estimate.title/total/tier`,
`invoice.number/total/due_date`, `contract.number/title`.

One resolver, `resolveMergeContext({ contactId?, dealId?, estimateId?,
invoiceId?, contractId? })`, loads the linked records and returns a flat
`Record<token, string>`. Missing values render as an empty string, never the
raw token. Money formats through the existing `formatCents`.

## Rendering

- **Email HTML**: `apps/api/src/templates/render-email.ts` — block tree +
  merge context → table-based, inline-styled, email-safe HTML (600 px, brand
  green button). Plain-text alternative generated from the same tree.
- **Contract PDF**: `apps/api/src/contracts/contract-pdf.ts` — same
  `@react-pdf` `createElement` pattern as `estimate-pdf.ts`. Renders the block
  tree + a signature section (typed name in a script style or the drawn PNG,
  signer name, date, contract number).

## API modules (pattern: clone of estimates)

**templates** (`AuthMiddleware`): `list`, `byPurpose`, `update({ purpose,
name, subject?, blocks })`, `preview({ purpose, contactId?, dealId?,
estimateId?, invoiceId? })` → rendered subject + HTML with sample data when no
record given, `sendTest({ purpose, to })`. Sample merge context is a constant
in `templates.config.ts`.

**contracts** (`AuthMiddleware`): `list(listInput + dealId/contactId filter)`,
`byId`, `createFromEstimate({ estimateId })` (copies title, links deal/contact,
snapshots CONTRACT_BODY template with merge fields UNRESOLVED — they resolve at
render time so edits to linked records flow until signing), `create` (blank),
`update` (title, body, links; blocked once SENT), `linkInvoice`, `send({ id,
to, subject?, message? })` — renders Contract email template, generates
`signingToken` (crypto random, 32 bytes, 30-day expiry), emails link
`${APP_URL}/sign/<token>`, sets SENT, `void`, `delete` (DRAFT only),
`document` (PDF base64), `mailerConfigured`.

**contracts-public** (NO AuthMiddleware — the documented public-procedure
pattern, like `sso.signInOptions`): `bySigningToken({ token })` → resolved
body HTML + business/contact display data, nothing else; `sign({ token,
signerName, signatureKind, signatureData })` — validates token + expiry +
status SENT, stamps signature, sets SIGNED, emails the signed PDF to the
client and the workspace owner. Token misses return 404 with no oracle
behavior. Rate limited by the existing global middleware only; tokens are
unguessable.

Both flows respect the mailer capability rule: unconfigured SMTP hides send
buttons and never throws.

New env: none required. `APP_URL` already exists for links.

## Web app

- **Settings › Templates** (`settings/templates/`): list page (4 rows: name,
  type, used-for, last edited) → editor page `settings/templates/[purpose]`.
  Editor = the approved preview: block palette (click-to-add), canvas with
  drag-reorder (dnd-kit, already a dep) + hover delete, contenteditable text
  with non-editable merge-field chips, dynamic-fields sidebar grouped by
  record with click-to-insert at cursor, subject input with tokens,
  Edit / Preview-with-sample-data segmented toggle, Send test email, Save.
  Contract-body template uses the same editor minus button/spacer blocks,
  previewed on a white page instead of an email shell.
- **Contracts area**: nav entry in `janus-nav.ts` (status live), list page
  `[slug]/contracts` with status pills + linked-record column,
  `contracts-table.tsx` takes `dealId`/`contactId` filter props; detail page
  `[slug]/contracts/[contractId]` per the approved preview (linked
  estimate/invoice/contact cards, status timeline line, Download PDF, Send
  for signature via the shared send dialog + template preview).
- **Record sheets**: Contracts tab added to `deal-sheet.tsx` and
  `contact-sheet.tsx` beside Estimates/Invoices.
- **Estimate builder**: "Create contract" action once an estimate has line
  items; opens the new contract.
- **Send dialogs**: `send-document-dialog.tsx` gains a rendered-template
  preview pane (fetched from `templates.preview` with the real record ids);
  the message textarea becomes an optional personal note injected into a
  `{{personal_note}}` slot.
- **Public signing page**: `app/sign/[token]/page.tsx` — outside the `[slug]`
  gate; add `/sign` to the ungated paths in `proxy.ts`. Type/Draw tabs (canvas,
  no new dependency), Agree & sign, signed confirmation state. Mobile-first.
- Cache: new `cache.contract(id)` + `cache.template()` helpers in
  `lib/trpc/cache.ts`.

## Error handling

Service errors through the existing `translate` pattern → Nest HttpException →
`DomainErrorMiddleware`. Signing conflicts (already signed, voided, expired)
return typed errors the signing page renders as friendly full-page states.

## Testing

- Unit: `template-blocks` parse/sanitize round-trip; merge resolver with
  missing records; email renderer snapshot; signing token expiry/status
  matrix in contracts service tests (pattern: existing estimates service
  tests).
- Manual walkthrough before done: seed → edit template → preview sample →
  send estimate with template (file transport outbox) → create contract from
  estimate → send → open `/sign/<token>` logged out → sign typed + drawn →
  signed PDF in outbox → status flips verified in UI.

## Sequencing with peers

Branch `janus/phase-e-contracts` in worktree
`.claude/worktrees/phase-e-contracts`. Prisma models appended at end of
schema; migration named after the peers' latest to sequence cleanly. Merge
coordination with `janus/phase-d-forms` (Projects board) before push.

The Companies removal (approved 2026-09-05) is a separate spec and branch,
built after this phase lands.
