# Permits — design

Date: 2026-09-13
Status: approved by Kyle (chat brainstorm, 2026-09-13)
Branch: janus/phase-permits, created at implementation time in its own
worktree off janus/foundation (per session coordination rules)

## Goal

A toggleable Permits feature that does two jobs: tracks every permit a job
needs through one universal status pipeline, and teaches the owner the local
process for each city. Owners do not understand permitting and the rules
change city to city — the permit skeleton (apply → review → issued →
inspections → closed) is near-universal, but whether a permit is needed,
who may pull it, how to apply, fees, required documents, and inspection
sequences vary per jurisdiction. Janus researches those parameters per
jurisdiction with cited sources; the client verifies each fact before it is
trusted. Verification is logged — that audit trail deliberately shifts
responsibility for accuracy onto the client.

Trade-agnostic (all US blue-collar trades), US-only.

## Key decisions (from the brainstorm)

- The unit of knowledge is **jurisdiction × permit type**, not state. A city
  issues building, electrical, plumbing, and mechanical permits under
  different rules; one job can carry multiple permits.
- Knowledge source is **hybrid**: Janus drafts playbooks with cited source
  links; every fact stays "unverified" until a human confirms it. No fact is
  used in guidance while unverified without a visible unverified badge.
- Trigger is **prompt at the right moment**: a stage-transition hook (deal
  reaches a contract-signed / project-start stage) fires a Janus confirm
  card offering to open permits — not silent, not fully proactive.
- Documents are **checklist + attach**, with a workspace document locker for
  reusables (license, COI, city registrations) that auto-attach.
- Application filling is **guided fill**, never portal automation: Janus
  prepares an editable worksheet of answers; the human submits to the city.
  A one-time liability acceptance gates worksheet generation.

## Feature gate

Settings › Permits:

- On/off toggle on the `AppSetting` singleton (`permitsEnabled`, default
  off). Off hides the nav entry, the deal-sheet Permits tab, and disables
  the stage trigger and playbook research. Existing permit data is kept,
  just hidden.
- Service states (multi-select, US states). Used only to scope playbook
  research and jurisdiction matching; jurisdictions themselves are
  discovered per job from the deal address, never pre-listed.
- Liability acceptance state: who accepted, when, which disclaimer version.
- Document locker: workspace-level reusable documents (contractor license,
  certificate of insurance, per-city registrations), stored via the existing
  local-disk pattern (drawings thumbnails / job-cost receipts), id-validated
  routes, session-gated GET.

## Data model

All new tables; no changes to existing models beyond relations.

- `Jurisdiction` — name, kind (CITY | COUNTY | STATE), state, normalized
  match key. Created on first job in that area (agent resolves the deal
  address to the issuing authority; a city job can resolve to the county
  when the county issues permits).
- `PermitPlaybook` — jurisdictionId × permitType (BUILDING | ROOFING |
  ELECTRICAL | PLUMBING | MECHANICAL | OTHER+label). Facts, each carried as
  a provenance-wrapped value `{ value, sourceUrl, verifiedById?, verifiedAt? }`
  parsed by one Zod schema at the boundary:
  - neededWhen (threshold text: valuation floor, scope conditions,
    exemptions)
  - whoMayPull (contractor | licensed-trade-contractor | homeowner-allowed)
  - prerequisites (city registration, NOC, etc.)
  - howToApply (portal | email | in-person, URL, office contact)
  - feeSchedule (text + source)
  - typicalTurnaround
  - requiredDocuments (list; each maps to a checklist slot, flagged
    reusable when satisfiable from the document locker)
  - inspections (ordered list: name, when, critical-timing note —
    e.g. "mid-roof while decking exposed")
  - worksheetTemplate (ordered field list: key, label, type, prefill
    mapping key, required) — fully editable: add, remove, rename fields.
- `Permit` — dealId, playbookId, status (DRAFT → READY_TO_SUBMIT →
  SUBMITTED → ISSUED → INSPECTIONS → CLOSED, plus DENIED and EXPIRED),
  permitNumber, feeCents, submittedAt, issuedAt, expiresAt, closedAt,
  worksheet answers (Json, parsed by the template schema). Many per deal.
- `PermitDocument` — permitId, checklist slot key, attached file (local-disk
  pattern) or lockerDocumentId reference, status (MISSING | ATTACHED).
- `PermitInspection` — permitId, name, scheduledFor, result
  (PENDING | PASSED | FAILED), note. Scheduled inspections render on the
  projects calendar (existing bar/chip patterns) when the deal has a
  project.

Money follows the house rule: integer cents. Status transitions are guarded
server-side (no ISSUED without SUBMITTED, CLOSED requires all inspections
PASSED or none defined).

## Playbook lifecycle

1. First permit-relevant job in an unknown jurisdiction × type → the API
   writes an `AgentTask` (intelligence lives in `apps/agent`, never the
   API). The agent researches official sources (the city/county's own
   permit pages) and drafts the playbook with a sourceUrl on every fact.
   Facts without an official source stay empty — the agent must not fill
   gaps from general knowledge.
2. The draft lands as fully **unverified**. Janus surfaces it: "I drafted
   the Homosassa building-permit playbook from these sources — review and
   confirm."
3. Settings › Permits › Playbooks: browse per jurisdiction, per fact —
   value, source link, Confirm / Edit-then-confirm / Clear. Confirming
   stamps verifiedBy + verifiedAt. Editing a verified fact resets it to
   unverified until re-confirmed.
4. Verified facts drive guidance silently; unverified facts always render
   with an "unverified — check source" badge wherever they appear.
5. Re-research on demand ("refresh this playbook") diffs against current
   values and resets only changed facts to unverified.

Web research is a capability (`apps/agent/agent/lib/capabilities.ts`
pattern): without it, playbooks are manual-entry only and nothing throws —
the research offer simply does not appear.

## Stage trigger

A hook on the existing stage-transition path (stages-as-data): when a deal
enters a stage whose outcome/entry config marks it as work-start (install
setting: which stage(s) trigger, default = the first stage after a
contract-signed style stage; editable in Settings › Permits), Janus runs a
lightweight check — deal address → jurisdiction, workspace trade(s) →
permit type(s), playbook neededWhen vs deal value — and raises a confirm
card: "This looks like it needs a building permit in Citrus County. Open
one on this job?" Accept creates the Permit in DRAFT with the checklist
scaffolded. Decline is quiet and logged. Per-rule autonomy follows the
existing Auto-run / +evidence / Ask-first pattern; permits default to
Ask-first.

## Guided fill

- Opening a DRAFT permit shows the worksheet from the playbook template.
  Janus pre-fills every field it can from CRM data (deal address and
  contacts, contract/estimate valuation, workspace license and insurance
  from the locker, parcel lookups are out of scope) and marks each prefill
  with its origin. Owner edits anything; template edits (add/remove fields)
  are offered inline and write back to the playbook template as unverified.
- Blanks get a conversational assist: "Ask Janus" on the worksheet walks
  remaining fields.
- Generate is gated on the one-time workspace liability acceptance:
  "Janus assists with preparation. You are responsible for verifying all
  information and requirements with the issuing authority." Logged with
  user, timestamp, disclaimer version; every generated worksheet footer
  restates it.
- Output: branded worksheet PDF via the existing @react-pdf pipeline
  (documents/pdf-money.ts patterns), attached to the permit. Where the city
  accepts an emailed PDF the owner sends it; otherwise they transcribe into
  the portal or paper form.

## Surfaces

- Deal sheet: Permits tab (existing DetailSheetTab pattern) — permits with
  status, fee, checklist progress, inspections, worksheet entry point.
- Nav: top-level Permits list (feature-gated) — all permits, filter by
  status and jurisdiction; the "waiting on the city" view.
- Settings › Permits: toggle, states, trigger stage, disclaimer state,
  document locker, Playbooks browser.
- Projects calendar: scheduled inspections as chips on the job's project;
  critical-timing inspections get a warning treatment.
- Janus nags (existing agent-task/evidence surfaces): unverified playbook
  in use, missing checklist documents at READY_TO_SUBMIT, permit expiry
  countdown (expiresAt within 30 days and work not started), inspection
  scheduled/overdue.

## Error handling

- Address fails to resolve to a jurisdiction → permit can still be created
  against a manually chosen/created jurisdiction; research offer skipped.
- Research finds no official source → playbook stays empty with an explicit
  "no official source found — enter manually" state, never a guess.
- Missing web capability, missing SMTP, missing locker docs: capability
  removed, feature never throws (AGENTS.md rule).

## Testing

- Zod boundary schemas for playbook facts and worksheet templates/answers —
  unit tests including provenance reset on edit.
- tRPC integration tests: status-transition guards, checklist derivation,
  locker auto-attach, verified/unverified gating, feature-flag hiding.
- Agent layer: research task fixture with hostile/injection fixtures per
  the Phase C pattern (playbook facts are untrusted web text — fenced);
  write-lockdown table gains any new tools.
- Playwright walkthrough: enable feature → stage trigger card → accept →
  checklist + locker attach → guided fill → liability accept → PDF in
  outbox/attachments → inspection on calendar → verify a playbook fact.

## Out of scope (v1)

- Portal automation or driving city websites; overlay-filling official PDF
  forms (phase-2 candidate).
- Fee payment.
- Parcel/GIS lookups.
- Non-US jurisdictions.
- Pre-seeding any jurisdiction database — knowledge is discovered per
  workspace, on demand.
