# Janus: Website Forms — Design Spec

**Date:** 2026-09-08
**Status:** Ready for implementation planning. Descends from the Kyle-approved 2026-09-04 spec §4 (script-tag embed, shadow DOM, honeypot + time-to-submit, no CAPTCHA, contact dedupe, lead on the sales board, owner notification, UTM attribution) updated for everything that has landed since; build delegated per standing "roll it out".
**Goal:** An owner builds a form in Settings, pastes one script tag on any website (or shares a hosted link), and every submission becomes a deduped contact, a lead on their pipeline, and a notification — closing the loop from a stranger's browser to the sales board.

## What the engine already provides (build on, never duplicate)

- `FormSubmission` model + `TrackingFilingService.file()` — the hardened submission→contact path (email normalize/dedupe, machine/suppression checks, hourly contact cap, activity note, visitor attribution). Forms REUSE this service.
- `dealCreateInput` needs only `{ name, ownerId }`; `DealsService.create` resolves the default pipeline's entry stage, currency, events (`deal.created`); `attachContact` links contact↔deal.
- Templates/mailer: `TemplatePurpose` slots a new `FORM_NOTIFY` cleanly (4 exhaustive maps: schema enum, `DEFAULT_TEMPLATES`, `TEMPLATE_LABELS` + `TEMPLATE_PURPOSE_ORDER`, optional merge tokens); `MailerService.send` + file-transport outbox for tests; brand/logo already render in emails.
- Custom fields: `FieldsService.applyValues(tx, "CONTACT", id, values)` writes mapped answers; `contact.field.<key>` merge tokens then work in the notify template for free.
- Embed machinery: the tracking loader/tracker ES5-in-template-literal pattern, `@crm/db/tracking`'s `MAX_BODY_BYTES`/`originAllowed`/`normalizeHost`/`dedupeKey`, proxy `ANONYMOUS` list + the `.js` matcher exemption, the anonymous-controller pattern (`@Controller("api/t")`), and the tracking bundle-budget test.
- Agent: `AgentTriggerService.withCrmEvents` + the `contact.created`/`deal.created` catalog events route to user-built Phase C agent triggers. **Known gap this spec fixes:** the existing filing path never emits `contact.created`, so tracker-filed contacts don't fire triggers — the shared path gains the emission (benefits tracking too).

## Data model

```prisma
model Form {
  id            String      @id @default(cuid())
  name          String
  intro         String?
  buttonLabel   String      @default("Send")
  confirmation  String      @default("Thanks — we'll be in touch shortly.")
  active        Boolean     @default(true)
  createLead    Boolean     @default(true)
  notifyEmails  String?
  fields        FormField[]
  submissionCount Int       @default(0)
  createdById   String
  createdBy     User        @relation("FormCreator", fields: [createdById], references: [id])
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt

  @@index([active])
  @@map("form")
}

enum FormFieldType {
  TEXT
  MESSAGE
  EMAIL
  PHONE
  ADDRESS
  SELECT
}

model FormField {
  id              String        @id @default(cuid())
  formId          String
  form            Form          @relation(fields: [formId], references: [id], onDelete: Cascade)
  type            FormFieldType
  label           String
  required        Boolean       @default(false)
  options         Json?
  contactFieldKey String?
  position        Int
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  @@index([formId, position])
  @@map("form_field")
}
```

- `FormSubmission` gains nullable `formId String?` + relation (`onDelete: SetNull`) — additive migration; tracker-originated submissions keep `formId: null`.
- `RecordSource` gains `FORM` (additive enum value) — form-filed contacts carry honest provenance.
- Exactly one `EMAIL` field is required per form (the dedupe key); the editor enforces it, the server validates it. `ADDRESS`/`PHONE`/`TEXT`/`MESSAGE`/`SELECT` are optional and repeatable. `options` (SELECT only) = `string[]` parsed at the boundary. `contactFieldKey` optionally maps an answer onto a CONTACT `FieldDefinition` by key (validated live at save; a mapping to a since-archived field degrades to unmapped at submit, never errors).
- `notifyEmails` = comma-separated override; null → notify the workspace's owner-role members' emails.

## The embed

- **Snippet:** `<script src="https://{install}/f/{formId}.js" async></script>` — served by `apps/app/app/f/[form]/route.ts` mirroring `/t/[site]`: strips `.js`, validates id shape, server-fetches the public form config from the API, and returns an ES5 IIFE with the config BAKED IN (`formSource(config, endpoint)` in `apps/app/lib/forms/embed.ts`, tracking-tracker rules: never throw, constants from `@crm/db/forms`, hand-minified, brotli budget test ≤ 6KB). Cache: `CONFIG_MAX_AGE_SECONDS`-style short TTL so edits propagate; an inactive/unknown form serves a no-op comment.
- **Rendering:** into `<div data-janus-form="{formId}">` when present (inline) else a floating button opening a panel; everything inside a **shadow DOM** root — self-contained styles, accent = the install's `brandColor` baked into the config, host-page CSS cannot leak in.
- **Spam defense:** a visually-hidden text-type honeypot field (`website_url` — CSS-hidden inside the shadow root, never `type=hidden`); render timestamp submitted with the payload — server rejects < 3s time-to-submit; both silent (the bot sees the confirmation).
- **Attribution:** the embed reads the tracking cookies (`_crm_v`, `_crm_fs`) when the install's tracker is on the same page, and parses its own UTM/referrer otherwise; submits `visitorId?`, `touch`, `firstTouch` in the tracking shapes.
- **Submit:** `POST {install}/api/f/s` (JSON, ≤ `MAX_BODY_BYTES`), CORS-answered (unlike the tracker's no-cors beacon, the form needs the response: field errors + confirmation), `cross-origin-resource-policy: cross-origin`. Response: `{ ok: true }` or `{ ok: false, errors: { [fieldId]: message } }`.
- **Hosted page:** `GET /f/{formId}` (no `.js`) renders the same form server-side on a minimal branded page — the shareable link for owners with no website. `/f` joins the proxy `ANONYMOUS` list.

## The submission pipeline (`apps/api/src/forms/`)

Anonymous controller `@Controller("api/f")`: `GET config/:formId` (public form definition: fields, labels, brand color, button/confirmation copy — never internal mappings) and `POST s`:

1. Body cap (stream-destroy like the tracker), form exists + active, honeypot empty, time-to-submit ≥ 3s, per-minute submission counter via `TrackingCounterService` (own key + limit in `forms.config.ts`).
2. Validate answers against the form's fields (required, type shapes — email/phone lightweight, SELECT membership); reject with per-field errors.
3. Store a `FormSubmission` (formId set, `fields` = cleaned answers keyed by field id + label, dedupe via the existing minute-window `dedupeKey`).
4. File through the EXTENDED `TrackingFilingService.file()`:
   - a new optional argument carries `{ formId, source: FORM, contactFields: Record<key, value>, name pieces }`;
   - contact create sets `source: FORM` and applies mapped custom-field values via `fields.applyValues` in the same transaction;
   - the filing path (both tracking- and form-originated) now runs inside `agent.withCrmEvents` and emits `contact.created` on the new-contact branch (data: `{ via: "form" | "tracking", host, formId? }`) — closing the existing trigger gap;
   - existing skip reasons/caps/suppressions all apply unchanged.
5. When filed AND the form's `createLead` is on: create the lead via `DealsService.create({ name: "<form name> — <contact name>", ownerId })` (ownerId = contact.ownerId else first user, mirroring filing's `author()` rule) + `attachContact(dealId, contactId)`; `deal.created` emits from the existing create path. A submission whose contact already has an OPEN-outcome deal attached from the same form within 30 days attaches an activity to that deal instead of opening a duplicate (config constant).
6. Notify: render the `FORM_NOTIFY` template (default seeded: subject "New lead from {{form.name}}", blocks showing the answers table + contact merge tokens) and `MailerService.send` to each notify address (skip silently when the mailer isn't configured — optional capability, never throws). Merge context gains `form.name` + `form.field.<id>` answer tokens for this purpose only.
7. `submissionCount` incremented; response `{ ok: true }`.

## Settings › Forms

Sidebar entry after Pipeline. List page (name, active switch, submissions count, updated) → editor:
- Field list via `SortableList` (the fields/pipeline pattern): add/remove/reorder; per-field: type, label, required toggle, SELECT options editor, optional "Save to contact field" combobox (live CONTACT FieldDefinitions).
- Form settings: name, intro, button label, confirmation text, create-lead toggle, notify-emails input.
- **Live preview** beside the editor rendering exactly what the embed renders (same component, install brand color).
- **Embed tab:** the snippet with copy button (tracking-script UI pattern), the hosted link, and an inline "test it" note.
- **Submissions tab:** recent `FormSubmission`s for this form (answers, filed/skip status, linked contact/deal) — the owner's proof-of-life view.
- tRPC module `forms` (AuthMiddleware): `list`, `byId`, `create`, `update`, `updateFields` (transactional replace/reorder), `archive`-style `setActive`, `remove` (only when no submissions), `submissions({formId, listInput})`. `cache.forms` helper.

## Deliberately out of v1 (recorded follow-ups)

Photo-upload field type (public unauthenticated file upload needs its own hardening pass — the logo work is the template); Janus conversational form drafting + per-form reply autonomy (agent-layer, natural Phase 3/agent-tool follow-up now that Phase C exists); WordPress plugin wrapper; multi-step forms; per-form notification templates (one global FORM_NOTIFY template in v1).

## Testing

- Contracts + pure: field validation shapes, honeypot/time gate, embed config redaction (no contactFieldKey leaks), `formSource` budget (brotli ≤ 6KB) + never-throw execution in a fake DOM (tracking-bundle test pattern).
- Integration: submit→contact+custom-fields+lead+events (assert `contact.created` emitted — the gap test), dedupe-to-existing attaches without new lead inside the window, skip reasons pass through, rate cap, inactive form 404s, notify email lands in the file outbox with answers + brand.
- Playwright walkthrough: build a form in Settings (map a field to "Roof type"), copy snippet into a fixture page, submit as a stranger (no cookies), see contact + custom field + lead on the board + outbox email; resubmit within a minute (deduped); hosted `/f/{id}` page round-trip; bot path (fast submit + honeypot) silently dropped.

## Build order

1. Models + migration (`add_forms`) + `@crm/db/forms` (schemas, constants, config parse).
2. `forms` tRPC module + public controller + pipeline extension (filing arg, events gap, lead creation, FORM_NOTIFY purpose + default template + mailer).
3. Embed script + `/f` routes (loader route, hosted page) + budget tests.
4. Settings › Forms UI (list/editor/preview/embed/submissions).
5. Playwright walkthrough.
