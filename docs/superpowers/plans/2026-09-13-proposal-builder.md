# Proposal Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A per-estimate proposal with cover, block sections, tier pricing and photos, sent as a public link where the client accepts a tier online, which locks the estimate and preps a draft contract.

**Architecture:** Mirror the contract subsystem: Proposal model with body blocks + tokenized public page + atomic status flip; new ProposalsModule in apps/api; public `proposalView` router without AuthMiddleware; owner editor at `/estimates/[estimateId]/proposal` reusing BlockCanvas; PDF reusing contract block rendering + estimate pricing.

**Tech Stack:** Prisma (hand-applied additive migration via psql -f + migrate resolve — `prisma migrate dev` is reset-blocked and `prisma db execute` fails silently on this box), NestJS + nestjs-trpc, @react-pdf, BlockCanvas, Playwright.

**Spec:** docs/superpowers/specs/2026-09-13-proposal-builder-design.md

## Global Constraints

- No code comments; no Co-Authored-By trailers; ASD-STE100 issue reporting.
- Additive migration only, applied to crm AND crm_test by hand.
- `bun run check-types` regenerates committed server.ts; pre-push runs repo lint.
- No em dashes in UI copy; shared components from /packages/ui only.
- Public router = no AuthMiddleware; public page path added to proxy ANONYMOUS.

---

### Task 1: Schema + migration + template purposes

**Files:** `packages/db/prisma/schema.prisma` (Proposal model, ProposalStatus enum, TemplatePurpose + PROPOSAL_BODY/PROPOSAL_SEND, Estimate.proposal relation), migration `20260913230000_add_proposals` applied crm + crm_test by hand, `bun run db:generate`.

- [ ] Model per spec; `estimateId @unique` with `onDelete: Cascade`; indexes on status.
- [ ] Enum values added to TemplatePurpose (additive ALTER TYPE ... ADD VALUE).
- [ ] Columns verified on both DBs; migrate resolve recorded.

### Task 2: Template seeding + proposal_link token

**Files:** `apps/api/src/templates/templates.config.ts` (PROPOSAL_BODY document blocks + PROPOSAL_SEND email with {{proposal_link}}), merge registry/known-token handling (`proposal_link` beside `signing_link` in preview-missing exclusions and merge-guard known set), client mirror `apps/app/components/templates/merge-fields.ts` if tokens are mirrored there.

- [ ] `templates.byPurpose` seeds both new purposes; templates settings page lists them.
- [ ] Preview of PROPOSAL_SEND does not warn on proposal_link.

### Task 3: ProposalsModule (owner side)

**Files:** `apps/api/src/proposals/{proposals.module,proposals.contracts,proposals.service,proposals.router}.ts`; wire into AppModule; imports ContractsModule (createFromEstimate), TemplatesModule, MailerModule, PhotosModule.

**Interfaces (produces):** `proposals.forEstimate({estimateId})` → detail or null; `createFromEstimate({estimateId})`; `update({id, data:{title?, coverTitle?, coverSubtitle?, body?}})` (DRAFT only); `send({id, to, subject?, personalNote?})`; `void({id})`; `document({id})` → {filename, base64}.

- [ ] Body snapshot from PROPOSAL_BODY on create; title = estimate title.
- [ ] send: token mint/rotate (32B, 30d), PROPOSAL_SEND render with proposal_link + merge-guard, DRAFT→SENT (resend keeps SENT), sentAt/sentTo.
- [ ] Integration spec `apps/api/test/proposals.integration.spec.ts` (create snapshot, update guard, void).

### Task 4: Public proposalView router + accept

**Files:** `apps/api/src/proposals/proposal-view.router.ts` (+ service methods `byToken`, `accept`), photo public route `apps/app/app/api/proposal-photos/[token]/[photoId]/route.ts`.

**Interfaces:** `proposalView.byToken({token})` → {businessName, brandColor, status, cover, blocksHtml-ready blocks + merge context resolved server-side, pricing: {tiers: [{tier, label, totalCents}], lineItems grouped, currency, defaultTier}, photos: [{id, filename}], acceptedTier/acceptedName/acceptedAt}; `proposalView.accept({token, tier, name})`.

- [ ] byToken excludes DRAFT (404) and expired (message state flag), never leaks internals.
- [ ] accept: atomic updateMany where SENT; then estimate ACCEPTED + selectedTier, draft contract via ContractsService.createFromEstimate(proposal.createdById), NOTE activity on deal; post-flip failures log, never revert.
- [ ] Photo route validates token → proposal → estimate link before serving thumb/master.
- [ ] Integration spec: accept happy path, double-accept conflict, expired token, draft hidden.

### Task 5: Proposal PDF

**Files:** `apps/api/src/proposals/proposal-pdf.ts` (+ export block-render helper from `contract-pdf.ts` if private), spec `apps/api/test/proposal-pdf.spec.ts`.

- [ ] Cover (workspace, coverTitle||title, subtitle, contact, date), body blocks, GBB pricing table with selected/accepted tier bolded, photos grid; %PDF- signature + growth assertions.

### Task 6: Owner editor UI

**Files:** `apps/app/app/(app)/[slug]/estimates/[estimateId]/proposal/page.tsx` + `proposal-editor.tsx`; estimate-builder Proposal button; `DocumentPreviewDialog` gains kind "proposal" (document proc mapping); cache.ts `proposal` helper or reuse estimate invalidation.

- [ ] Create-on-first-visit (page calls forEstimate, shows Build proposal button if null).
- [ ] Cover inputs blur-save; BlockCanvas in DRAFT, static after; pricing summary; status badge; Send dialog (reuse SendDocumentDialog with proposals.send mutation); Copy link; Void; accepted banner linking the draft contract.

### Task 7: Public page UI

**Files:** `apps/app/app/proposal/[token]/{page.tsx,proposal-view.tsx}`; proxy.ts ANONYMOUS += "/proposal".

- [ ] Server component fetches byToken via server trpc client (public), renders brand-accented shell like /sign; tier radio cards defaulting to defaultTier; name input; Accept button → proposalView.accept; success + already-accepted + expired + void states.

### Task 8: Gates + walkthrough + push

- [ ] check-types (root), repo lint, app suite, api targeted suites.
- [ ] Playwright: estimate w/ line items + photo → Build proposal → edit cover → send (file mailer) → extract link from outbox or DB token → open signed-out (fresh context) → pick BEST → accept with name → owner page shows banner, estimate ACCEPTED/BEST, draft contract exists → cleanup.
- [ ] biome --write touched; commit; push.
