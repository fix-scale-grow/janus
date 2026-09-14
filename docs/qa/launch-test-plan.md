# Janus launch test plan

Generated 2026-09-13 from foundation@c46104c (surface inventory swept from code, not memory).
Purpose: the full pre-launch pass Kyle ordered — every route, every document, every flow,
checked working before real customers touch it. Re-sweep the inventory after major merges;
this file is the checklist, git history is the record of when each pass ran.

How to use: one pass = work top to bottom, tick boxes, file every failure as an issue with
the route/proc name. Sections 1-2 are setup, 3 is the spine, 4-9 are exhaustive surfaces,
10 is security, 11 is the AI root test (Kyle-triggered), 12 is the roadmap (not tests).

## 1. Environment matrix (set up before testing)

Each capability is optional and must degrade, never throw. Test BOTH states where cheap.

- [ ] Database: DATABASE_URL + migrations current (`prisma migrate deploy` clean)
- [ ] Auth: BETTER_AUTH_SECRET, ALLOWED_SIGN_IN, APP_URL/API_URL pair correct
- [ ] SMTP: MAIL_TRANSPORT + SMTP_* set — real send verified ONCE against a real server
      (outbox transport is proven; production SMTP has NEVER been tested — standing gap)
- [ ] SMTP absent: every send button hidden, every mailerConfigured false, nothing throws
- [ ] Satellite: NEXT_PUBLIC_MAPTILER_API_KEY present (tab shows) and absent (tab hidden)
- [ ] Agent: AGENT_URL + AGENT_BRIDGE_SECRET + model key — panel live; absent: panel 503s
      gracefully, no dead buttons elsewhere
- [ ] Google: GOOGLE_CLIENT_ID/SECRET — sign-in + Gmail/Calendar sync; absent: buttons say so
- [ ] Microsoft: MICROSOFT_* — Outlook sync; absent path clean
- [ ] Slack: SLACK_CLIENT_ID/SECRET; absent path clean
- [ ] Blob: BLOB_READ_WRITE_TOKEN absent → photos/logos stay on local disk, nothing breaks
- [ ] Redis: REDIS_URL absent → in-memory cache warning only
- [ ] CRON_SECRET set (min 16 chars); unset → every /internal/* refuses
- [ ] IS_MARKETING both states at `/` (stranger sees landing vs redirect to /sign-in)
- [ ] JANUS_BRAND_COLOR + Organization.brandColor: accent applied app + emails + PDFs

## 2. Onboarding + auth spine

- [ ] /sign-in: email flow, Google, Microsoft, SSO options (sso.signInOptions) — whichever
      are configured render; ?method=google / ?method=microsoft direct links work
- [ ] ALLOWED_SIGN_IN rejects a non-listed address
- [ ] First account becomes owner; second becomes member
- [ ] /onboarding gate: name + website required, cannot skip; slug derived; rename moves URL
- [ ] /onboarding/research gate: key accepted / declared invalid correctly
- [ ] /grant-access: appears only when all sign-in providers are mailbox providers w/o grant
- [ ] /api/dev-login 404s in production build
- [ ] Session expiry / signed-out redirect on every gated page class (spot 3)

## 3. End-to-end flows (the spine — walk in order, per fresh seeded install)

FLOW A — money spine: draw → estimate → proposal → contract → sign → invoice → project → profit
- [ ] Create deal → drawing: scale calibration, grid, mark area/line, pins, symbols at true
      scale, linear symbols stretch, image background, satellite (if keyed), autosave (edit,
      navigate away fast, come back — no stale overwrite), version history + restore
- [ ] Price book: seedRoofing, edit rates, measurement adjustments (modifier options)
- [ ] Estimate: generateFromDrawing (gated: tagged AND measured), tier tabs GBB, line item
      CRUD, resync receipt after re-scope, drawingStale badge, photos linked + PDF flag
- [ ] Estimate PDF (document) renders: chrome header/footer blocks, accent, photos, text
      blocks (intro/scope/terms), money to the cent
- [ ] Estimate send: template merge fields resolve, block-on-unresolved works, personal note
- [ ] Proposal: createFromEstimate, editor, send → public /proposal/[token]: view recorded,
      photos served via /api/proposal-photos/[token]/[photoId], accept + decline paths,
      revise + void, proposal PDF
- [ ] Contract: createFromEstimate, CONTRACT_BODY template, send → public /sign/[token]:
      typed + drawn signature, token rotates on resend, expired/voided token refused,
      signed copy artifact + notification email, contract PDF
- [ ] Invoice: createFromEstimate at chosen tier (price snapshot), aging badges, markPaid,
      invoice PDF + send, line item CRUD
- [ ] Project: start from deal, tasks span days, drag + resize, unscheduled strip, crews
      colour bars, calendar month/week + timeline, all-projects calendar + drag confirm
- [ ] Production board auto-advance: SCHEDULED → IN_PROGRESS (task leaves TODO) → COMPLETE
      (all done) → PAID (invoices paid); ON_HOLD manual-only; manual drag overrides
- [ ] Costs: ledger entries, receipt upload/view/delete, profit strip, /reports by
      client/month/category — visible ONLY with profit.view (test both users)

FLOW B — permits (v1 + v1.1)
- [ ] Settings › Permits: enable (trigger stages default to WON stages on first enable),
      states multi-select, disclaimer status line
- [ ] Locker: upload license/COI w/ kind, rename, referencing count, delete (slot nulls out)
- [ ] Playbook: new jurisdiction, facts w/ source links, verify/edit-resets/clear per fact,
      documents + inspections editors w/ per-entry verify + lockerKind, worksheet template
      editor (add/rename/reorder/remove w/ confirm; typing never loses focus)
- [ ] Stage trigger: deal into trigger stage → banner (only when: enabled, no permit, not
      dismissed, state in list-or-list-empty); unverified neededWhen shows Unverified badge;
      dismiss persists; open-permit clears banner
- [ ] Create permit: checklist + inspections scaffold, sourceVerified badges on unverified
      entries, reusable+lockerKind slots auto-attach newest locker doc
- [ ] Worksheet: fill-mode dialog, guided fill (CRM prefills NEEDS_REVIEW, typed = approved),
      approve / edit-approves / approve-all / clear, orphaned answers (removed template
      field) neither block nor count, progress + blocking reasons transition live
- [ ] Generate: disclaimer dialog verbatim once, PDF downloads AND lands as worksheet
      document, disclaimer accepted at OLD version blocks again
- [ ] Status walk: DRAFT→READY→SUBMITTED→ISSUED→INSPECTIONS→CLOSED; illegal jumps absent
      from UI and 400 from API; DENIED needs reason; CLOSED blocked w/ pending inspection;
      EXPIRED→DRAFT reopen
- [ ] Nags: unverified-research warning on card, missing-docs at READY+, overdue inspection
      badge (row + calendar chip), expiry countdown ≤30d, /permits warning column
- [ ] /permits list: status filter (param permitStatus), deal click-through

FLOW C — intake: forms + tracking
- [ ] Build form in Settings › Forms, field editor, activate
- [ ] Hosted /f/[form] + embed /f/[form].js (shadow DOM on a scratch page)
- [ ] Submit → POST /api/f/s → contact dedupe → lead → FORM_NOTIFY email → submissions list
- [ ] Tracking: /settings/tracking, tag on scratch page → /t/crm.js → /t/[siteId] →
      POST /api/t/e → verify, sources, contactActivity; rotateSiteId kills old tag;
      retention cron trims
FLOW D — mailbox/connections (needs real accounts)
- [ ] Google connect: sync threads/events, thread filed to contact, machine addresses NOT
      contacts, suppressDomain, purgeSyncedData, revokeAccess
- [ ] Microsoft connect: same pass; cross-provider threading on one conversation
- [ ] Slack: connect, channels, people match, join channel
FLOW E — team + customisation
- [ ] Members/roles: member vs admin vs owner surfaces (Reports, Brand, Settings gating);
      last owner cannot be demoted; permissions.grant/revoke profit.view live-updates UI
- [ ] Pipelines: create pipeline/stage, reorder, outcomes, archive/restore, cross-pipeline
      deal move, closed-stage reason, dashboard chart picker
- [ ] Theming: accent/logo/name; nav RAIL vs TOP_BAR; per-user nav reorder/hide + reset;
      per-user table views + board density; deal numbering start
- [ ] Custom fields: create each type, contacts+deals, merge tokens in templates,
      block-send-on-unresolved, field archive/restore/backfill
- [ ] Search: pill + Cmd-K — exact deal number, address, contact email NEVER miss (top-5
      AccuLynx complaint — our bar); recents server-side across devices

## 4. Every page (load + auth + empty-state + one action each)

Public: / (both IS_MARKETING states) · /sign-in · /sign/[token] (+ bad token) ·
/proposal/[token] (+ bad token) · /f/[form] (+ inactive form) · /t/crm.js · /t/[site]
Gates: /grant-access · /onboarding · /onboarding/research
App: /[slug] dashboard (all widgets, customise, Ask Janus widget) · /contacts +
/contacts/[id] · /deals + /deals/[id] (every tab: Overview Contacts Activity Drawings
Photos Estimates Invoices Costs Projects Contracts Permits Agent) · /drawings +
/drawings/[id] · /estimates + /estimates/[id] + /estimates/[id]/proposal · /contracts +
/contracts/[id] · /invoices + /invoices/[id] · /projects + /projects/[id] · /production ·
/permits · /field (mobile-width!) · /reports (permission-gated both ways) · /chat +
/chat/[id] · /agents + /agents/[id]
Settings (13 sidebar + children): / · /team · /navigation · /tracking · /connections
(+google +microsoft +slack +slack/people +intake) · /price-book · /symbols +
/symbols/[id] · /templates + /templates/[purpose] (all 7) + /templates/chrome/[part] ·
/fields · /pipeline · /forms · /permits · /sso
Legacy redirects: /settings/members and /settings/crews → /settings/team
- [ ] All of the above load clean signed-in; gated ones bounce signed-out
- [ ] Permits nav + tab + page hidden when feature off; planned nav items (schedule, inbox,
      automations, phone-agent) render NO dead links anywhere

## 5. Every API route (auth first, then validation, then function)

For EACH: unauthenticated → 401/404 (never data); malformed id → 400; wrong-owner id → 404.
- [ ] POST+GET+DELETE /api/costs/receipt(+/[costId]) — upload caps, type allowlist, serve
      headers private+immutable, delete clears row
- [ ] POST+GET /api/drawings/thumbnail(+/[drawingId])
- [ ] POST+GET /api/permits/document(+/[documentId]) — permit+slot pairing enforced
- [ ] POST+GET+DELETE /api/permits/locker(+/[docId]) — kind allowlist, SetNull on delete
- [ ] POST /api/photos/upload (deal/contact/estimate/invoice targets) · DELETE
      /api/photos/[photoId] · GET /api/photos/[photoId]/[variant]
- [ ] GET /api/proposal-photos/[token]/[photoId] — valid token only, only linked photos
- [ ] POST+DELETE /api/workspace/logo · GET /api/workspace/logo/file
- [ ] /api/[...path] proxy: auth cookie handling, /api/auth/* reaches better-auth
- [ ] /eve/v1/[...path]: 503 unset secret, 401 mismatched, session cookie never forwarded
- [ ] Nest: /health · /auth/me · /auth/session · /api/conversations/attachments/:id
      (session-gated) · /api/f/config/:formId + POST /api/f/s (public: spam-shaped body,
      oversized body, inactive form) · /api/t/config + POST /api/t/e (anonymous 204, CORP
      header, garbage payload safe)
- [ ] /internal/sync/mailboxes · /internal/sync/rates · /internal/telemetry/rollup ·
      /internal/tracking/retention — all refuse without CRON_SECRET, run with it

## 6. tRPC routers (spot-depth: every router touched, every DESTRUCTIVE proc tested)

39 routers / ~300 procedures. Minimum bar per router: list+byId render real data; every
create/update round-trips; every delete/void/archive is confirmed-in-UI and recoverable
where designed (archive/restore pairs); bulk ops (contacts.bulk*, deals.bulk*,
symbols.bulk*) on 3+ rows; every *Options/facet endpoint feeds its picker.
- [ ] activities · agents (deploy/pause/resume/cancelRun lifecycle) · contacts (enrich +
      decideFact + suppression on delete/re-add) · contractSigning (public!) · contracts ·
      conversations (share create/revoke/shared view) · costs · crews · currency (manual
      rate, refresh) · dashboard · deals (setStage emits events, bulkSetStage) · drawings ·
      estimates · fields · forms · google · invoices · microsoft · permissions · permits
      (29 procs — Flow B covers) · photos (link/unlink/reorder/flags ×3 parents) ·
      pipelines · projects (calendarRange w/ inspections) · proposalView (public!) ·
      proposals · recents · reports · search · services · settings (all 13) · slack · sso ·
      symbols (save-selection, packs, usage) · templates (preview + sendTest) · tracking ·
      users · views (save/reset) · workspace (rename moves slug)

## 7. Documents, emails, e-sign

- [ ] 5 PDFs pixel-eyeballed with real data: estimate, invoice, contract, proposal, permit
      worksheet — chrome blocks, accent bar, doc number, page count, money format, photos,
      disclaimer footer (permit), long-content page breaks
- [ ] 7 template purposes edited + preview + sendTest: ESTIMATE_SEND, INVOICE_SEND,
      CONTRACT_SEND, CONTRACT_BODY, PROPOSAL_SEND, PROPOSAL_BODY, FORM_NOTIFY
- [ ] Document chrome editors (header/footer) drag-drop, render in ALL 5 PDFs
- [ ] Merge fields: every group renders, custom fields pull through, unresolved blocks send
      with the dialog naming them, personal_note exempt
- [ ] All 7 send paths land (outbox in dev, real SMTP once): estimate, invoice, contract
      ask-to-sign, contract signed-copy, proposal, form notify, sendTest
- [ ] E-sign: full walk + token rotation + double-sign guard (two tabs racing)
- [ ] Proposal public: view count (anonymous only), accept→status, decline→status

## 8. Agent surfaces (needs model key — overlaps §11)

- [ ] Panel on contact/deal/drawing/workspace: conversation persists, resumes, tab-switch
      mid-answer survives (keepMounted), ended thread offers new conversation, offline
      agent shows offline not working
- [ ] 22 free tools spot-called via chat asks (read_crm_history, search_crm no-fuzzy,
      read_drawing, read_estimate, read_price_book, read_permit, read_playbook, ...)
- [ ] 6 approval-carded tools: card copy, apply settles + invalidates the right record,
      decline is quiet — propose_drawing_tags, propose_estimate_lines, update_service
      (stale-read refusal), fill_worksheet (NEEDS_REVIEW only), archive_field,
      record_job_change
- [ ] 3 execute-check tools refuse unattended (attach_drawing, manage_fields,
      set_field_value)
- [ ] Task lanes: research button → task row → dispatch → settle (dev needs the poke or
      manual dispatch); drawing-check fires after estimate generate; permit-research fires
      on trigger stage; blank-fact sweep fills only blanks
- [ ] Custom agents: builder chat → draft → review screen → deploy → runNow + scheduled
      trigger → run history → cancelRun; runner scope/action refusals
- [ ] Usage metering rows appear (AgentUsage)

## 9. Data stores + backups

- [ ] Each data/ root writes and serves through its route (drawings thumbnails, photos,
      costs receipts, permits locker, permits documents, workspace logo, mail-outbox)
- [ ] Env overrides relocate correctly (spot one: PERMITS_DATA_DIR)
- [ ] A store file deleted on disk → route 404s gracefully, UI shows missing, no crash
- [ ] pg_dump/restore drill: dump the install DB, restore to a scratch DB, app boots on it
      (the data/ folder must ride along — document the pairing in the runbook)

## 10. Security pass

- [ ] Public endpoints fuzz: /api/f/s, /api/t/e, /sign/[token], /proposal/[token],
      /api/proposal-photos — garbage, oversized, replayed, expired, cross-record tokens
- [ ] File routes: traversal attempts in ids, content-type from request ignored, caps
      enforced, private cache headers
- [ ] Member-role user cannot reach: reports, brand, settings admin mutations (API not
      just UI — call the tRPC procs directly as member)
- [ ] Injection probes (with model live): hostile email body, hostile web page in permit
      research, hostile form submission → no gated write occurs, drafts stay unverified,
      fences hold (Phase C Task 11 checklist in .superpowers/sdd/2026-09-06-phase-c-*/)
- [ ] AGENT_BRIDGE_SECRET unset/wrong: refuses, never opens
- [ ] Two-tab conflict: same estimate open twice, both edit — last-write behavior known and
      sane (standing untested item from the 9/8 QA campaign)

## 11. AI root test (Kyle-triggered — the banked pre-launch gate)

Prereq: claude setup-token → CLAUDE_CODE_OAUTH_TOKEN (or ANTHROPIC_API_KEY) in .env.
- [ ] Live AI fill on a real permit worksheet: card → apply → sweep → generate
- [ ] Live permit-research on a real jurisdiction: playbook drafted with real official
      sources, everything unverified, verify flow in Settings
- [ ] Phase C Task 10 live walkthrough + Task 11 injection probes (checklists preserved in
      .superpowers/sdd/2026-09-06-phase-c-janus-agent-layer/)
- [ ] Oauth beta header verified live; approval invalidation timing vs eve send
- [ ] Model fallback behavior with key removed mid-session

## 12. Roadmap (not tests — the build list this pass feeds)

1. MOBILE APP — the big one. Current state: /field is a responsive page, not an app.
   Decision needed: PWA-first (install-to-homescreen, offline queue, camera/photo upload,
   push) per the original Crew-tier plan vs native wrapper later. Crew persona first:
   today's jobs, photos, task check-off, hold-to-talk Janus. Spec+brainstorm session.
2. Planned nav stubs to build or hide: /schedule, /inbox (unified), /automations
   (told-not-built), /phone-agent (Phase 4 A2P dependency — Twilio/ISV is a Kyle gate).
3. Permits v1.2: notification/waiting-on-you strip (nags graduate from card-only),
   official-PDF overlay fill, portal automation research, re-research diff flow,
   per-entry provenance on the deal tab beyond badges.
4. Estimate SEND e-sign parity + smart estimating (dossier in db-backups, unassigned).
5. Real-SMTP verification on first install (standing), workspace phone field
   (business.phone token resolves empty), contracts list amounts column.
6. Post-merge polish batch: AgentPanel ask param lifecycle, pagination on /permits,
   pre-existing em dashes in projects-table/EmptyCellValue, cost-receipts twin patterns.
7. Platform layer (Phase 7): control plane, provisioning, Stripe, mega admin,
   one-login-many-businesses.
