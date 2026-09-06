# Janus: Custom Fields in Settings + Merge-Field Pull-Through — Design Spec

**Date:** 2026-09-06
**Status:** Approved in brainstorming with Kyle; ready for implementation planning.
**Goal:** Make custom fields a first-class owner capability: managed from Settings, and usable as merge fields in every email and template — add "Roof type" in Settings, insert `{{Roof type}}` in the estimate email template, and the sent email carries that contact's value.

## What already exists (the two halves)

- **Fields subsystem (complete):** `FieldDefinition`/`FieldOption`/`FieldValue` models, `fields` tRPC router (list/byKey/coverage/create/update/reorder/archive/restore/delete/backfill), all ten `FieldType`s, entities `CONTACT` and `DEAL`, shared logic in `@crm/db/fields` (`coerceValue`, `writeValues`, `serializeField`, `fieldKeyFromLabel`), agent auto-fill via the `field-backfill` task, and a full CRUD UI (`apps/app/components/crm/fields/`: `FieldsSheetBody`, `FieldsList`, `FieldEditor`, `RecordFields`) reachable today only through the `FieldsCog` gear on record sheets.
- **Template/merge subsystem (complete):** `Template` model (`TemplateType` EMAIL/CONTRACT, one row per `TemplatePurpose`), `{{token}}` interpolation (`applyMergeFields`, `MERGE_TOKEN_PATTERN = /{{\s*([\w.]+)\s*}}/g`), `MergeContextService.resolve(refs)` building a flat `Record<string, string>`, block editor with field chips (`<span data-field>` round-trip in `block-serialize.ts`), the `FieldSidebar` insert picker, `templates.preview`, and the send pipeline (estimates/invoices/contracts through `MailerService`).

They are unconnected: the merge registry is **hardcoded twice** (`MERGE_FIELDS` in `apps/api/src/templates/templates.config.ts`, `MERGE_FIELD_GROUPS` in `apps/app/components/templates/merge-fields.ts`), the contact branch of `MergeContextService` selects only `firstName, lastName, email`, and an unknown or empty token renders as `""` silently. This spec is the connection.

## Section 1: Settings › Fields

- New settings page at `/settings/fields`, sidebar entry `{ title: "Fields", href: "/settings/fields" }` placed after "Templates".
- The page renders the existing fields machinery — Contacts/Jobs tabs, `FieldsList`, `FieldEditor` — in the settings page layout (max-w-4xl convention). Implementation extracts whatever small seam is needed so `FieldsSheetBody`'s content renders both in the sheet and on the page without duplicating logic; the components remain in `apps/app/components/crm/fields/` as the single source.
- The `FieldsCog` gear on record sheets stays: two doors, one machinery. No behavior change to the sheet path.
- The field editor gains one read-only affordance: the field's merge token (`{{contact.field.<key>}}` / `{{deal.field.<key>}}`) shown with a copy button, so an owner can see what to type/insert.

## Section 2: Dynamic merge-field registry

- New query `templates.mergeFields` (AuthMiddleware, no input) returning `{ groups: { id, label, fields: { token, label }[] }[] }`:
  - The existing static groups (contact/business/deal/estimate/invoice/contract/send) verbatim from `MERGE_FIELDS` — server stays the single source; the hardcoded client copy `MERGE_FIELD_GROUPS` is deleted and the client fetches instead.
  - Plus two dynamic groups: "Contact fields" and "Job fields" — one entry per non-archived `FieldDefinition`, token `contact.field.<key>` / `deal.field.<key>`, label = the definition's label.
- Token namespace: `<entity>.field.<key>`. `fieldKeyFromLabel` keys are `[a-z0-9_]{1,60}` and can never contain a dot, and no existing static token uses the `.field.` segment — collision-free, and matched by the existing `MERGE_TOKEN_PATTERN` unchanged.
- Client: `FieldSidebar` and `mergeFieldLabel` consume the query (via a small context/provider or prop threading — implementation's choice, but `mergeFieldLabel` must resolve custom tokens to their field labels for chip rendering, with the existing `{{token}}` fallback for unknowns). Cache invalidation: `cache.fields` additionally invalidates `templates.mergeFields` so a newly created field appears in open editors.
- USER-type fields render the assigned user's name; SELECT renders the option label.

## Section 3: Values flow into merge context

- `MergeContextService.resolve` — the contact and deal branches additionally select `fieldValues: { include: { field: { include: { options } }, option: true, user: true } }` (exact include shaped to the schema) and emit one context entry per non-archived definition: key `contact.field.<key>` / `deal.field.<key>`, value = display string.
- Display formatting is the same the tables use (`FieldsService.tableValuesFor` semantics): SELECT → option label; CHECKBOX → "Yes"/"No"; DATE → localized day (match `LocalDay`'s en-US format, e.g. "Sep 6, 2026"); NUMBER → plain decimal string with no trailing zeros; USER → user name; TEXT/LONG_TEXT/URL/EMAIL/PHONE → the stored string. A definition with no value for the record emits **no entry** (absence is what Section 4 detects).
- One shared helper (in `apps/api/src/templates/` or `@crm/db/fields`) produces `{ token, value }` pairs from a loaded record's field values, used by both the merge context and any future consumer — no second formatting path.

## Section 4: Block send + warn on empty merge fields

Today `applyMergeFields` substitutes `""` for any token it cannot resolve — a missing custom field, an empty standard field, an archived field, or a typo all silently produce gap-toothed emails. New behavior, applied to every real send (`estimates.send`, `invoices.send`, `contracts.send`) and to `templates.sendTest`:

- Before rendering, collect every token in the subject + blocks (`MERGE_TOKEN_PATTERN` scan), resolve the context, and partition unresolved/empty tokens.
- Any unresolved token **blocks the send** with a structured `BadRequestException` whose message lists the human labels ("Missing for this contact: Roof type, Claim number"). Tokens pointing at archived or deleted fields report as "no longer exists — remove it from the template".
- `SendDocumentDialog` surfaces the list as a warning panel: each missing field named, with the guidance "fill it on the contact/job, or remove the chip from the template". The existing `templates.preview` response gains a `missing: { token, label, reason }[]` array so the dialog warns **before** the user hits Send, not only on failure.
- `send`-purpose tokens the user supplies in the dialog (`personal_note`) and system tokens (`signing_link`) resolve as today; an intentionally empty personal note is allowed — `personal_note` is exempt from blocking (it is optional by design).
- Contract **body** rendering at view/sign time keeps current behavior (no blocking — a signed document must always render); the blocking applies at the send gate only.

## Out of scope (explicit)

- A standalone compose-email-to-contact screen. Custom fields flow through every existing send; free composition is a future feature.
- Snapshotting merge values into `Contract.body` at send time (today a signed contract re-resolves live values on view — a real issue, phase-e's domain, recorded as a known follow-up, not touched here).
- New field types, per-field fallback text, bulk sends.
- The other customisation items (pipeline stages as data, install theming, per-user views) — next specs in the queue, after this ships.

## Testing

- Registry: `templates.mergeFields` contract test — static groups present, a created CONTACT field appears with token `contact.field.<key>`, archived fields absent.
- Context: integration test — contact with values across the type spectrum (TEXT, NUMBER, DATE, CHECKBOX, SELECT, USER) resolves to the exact display strings; empty field emits no key.
- Blocking: integration test — a template containing an unresolvable token makes `estimates.send` throw with the field's label in the message; the same template sends cleanly once the value is filled; archived-field token reports the "no longer exists" reason; `personal_note` empty does not block.
- UI: preview response carries `missing[]`; Playwright walkthrough — create a field in Settings › Fields, insert its chip into the estimate email template, attempt a send against a contact without the value (blocked, warned), fill the value on the contact, send succeeds (file-transport outbox asserts the rendered value).

## Build order

1. Settings › Fields page + sidebar entry + merge-token affordance in the editor.
2. `templates.mergeFields` query + dynamic client registry (delete the hardcoded copy).
3. Merge-context pull-through + shared formatting helper.
4. Send blocking + preview `missing[]` + dialog warning panel.
5. Playwright walkthrough.
