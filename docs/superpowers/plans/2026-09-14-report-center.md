# Report Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace /reports' three tabs with a registry-driven library of nine chart-first reports (KPIs + chart + drill table + range + CSV), enforce USD-only writes, fix the double-count and invoiced-vs-collected truths, and re-point the two duplicated dashboard widgets.

**Architecture:** One report registry drives the library grid and per-report routes. Nine typed procs on the existing reports router share a range input and a `{ kpis, series, rows, excluded }` envelope; money procs assert profit.view, mixed procs null money fields without it. All aggregates filter USD and count non-USD into `excluded`. Charts reuse packages/ui recharts primitives.

**Tech Stack:** Next 16 app router, nestjs-trpc, Prisma aggregates, recharts (packages/ui), nuqs, bun test, Playwright walkthrough.

**Spec:** docs/superpowers/specs/2026-09-14-report-center-design.md

## Global Constraints

- No code comments; no Co-Authored-By trailers. No em dashes in UI copy. @crm/ui components only; new chart variants go in packages/ui, never call-site styling.
- currency.md holds: never sum across currencies. USD filter + `excluded` count on every aggregate; `baseAmount` engine untouched.
- No schema changes, NO migrations in this phase (everything reads existing tables).
- Worktree .claude/worktrees/phase-report-center, branch janus/phase-report-center off foundation@91cd3f4. Private DBs janus_reports_dev/_test (migrated+seeded). Ports: app 3128, api 3130 (pass -p / PORT inline).
- bun run check-types regenerates apps/api/src/generated/server.ts — commit it. biome check --write touched files only. Test DB via TEST_DATABASE_URL inline when the runner misses .env. NEVER touch crm/crm_test.
- Cache rule: mutations invalidate via lib/trpc/cache.ts (reports are queries; the deal-sheet edit in Task 2 must not regress existing invalidation).
- Permission doctrine: server assertion AND UI hiding must agree (permissions.assertPermission w/ PERMISSION_KEYS.profitView is the precedent in reports.service.ts).
- TS2589 hygiene on big router types: typed onError callbacks, narrow local row types (see task-9-report.md notes from the permits phase, .superpowers/sdd/2026-09-13-permits — pattern description: cast query rows to small local interfaces).

---

### Task 1: Shared scaffolding — contracts, helpers, registry, routes

**Files:**
- Modify: `apps/api/src/reports/reports.contracts.ts`
- Create: `apps/app/lib/reports/report-registry.ts`, `apps/app/lib/reports/range.ts`, `apps/app/lib/reports/csv.ts`
- Create: `apps/app/app/(app)/[slug]/reports/page.tsx` (rewrite), `apps/app/app/(app)/[slug]/reports/[reportId]/page.tsx`, `report-page.tsx` (client shell), `report-cards.tsx`
- Create: `apps/app/components/reports/` — `kpi-row.tsx`, `range-control.tsx`, `drill-table.tsx`, `export-csv-button.tsx`
- Test: `apps/app/lib/reports/range.test.ts`, `csv.test.ts`

**Interfaces:**
- Produces: `reportRangeInput = z.object({ from: z.coerce.date().optional(), to: z.coerce.date().optional() })` (reuse/extend the existing one); shared envelope types `ReportKpi { key, label, value: string, tone?: "default"|"warning"|"destructive" }`, `ReportSeriesPoint`, `excluded: number`.
- Produces: `REPORT_REGISTRY: ReportMeta[]` — `{ id, title, description, money: boolean, component }` for ids: job-profitability, profit-over-time, cost-breakdown, ar-aging, leaderboard, pipeline, lead-sources, production, permits. Library page renders cards (money cards hidden without profit.view via permissions.mine); `[reportId]` resolves from the registry, notFound() on unknown.
- Produces: `range.ts` — nuqs param helpers (from/to, presets 30d/90d/12m/custom), `bucketMonths(from,to)`, `agingBucket(dueAt,now)` → "current"|"1-30"|"31-60"|"61-90"|"90+"; `csv.ts` — `buildCsv(columns, rows)` (RFC quoting, BOM for Excel) + browser download helper.
- [ ] **Step 1:** Helpers + unit tests (aging boundaries: due today = current, 30 exactly = 1-30 upper edge — pin the rule in the test; csv quoting: commas, quotes, newlines, BOM present).
- [ ] **Step 2:** Registry + library page (PageShell + card grid per settings-page shape; visible to all members — page-level notFound() gate REMOVED) + per-report route shell rendering kpi-row/chart-slot/drill-table/range/export from props.
- [ ] **Step 3:** check-types, commit `feat: report center scaffolding`.

### Task 2: USD-only writes

**Files:**
- Modify: `apps/app/app/(app)/[slug]/deals/create-deal-sheet.tsx` (remove picker; drop currency from the create payload or send "USD"), `apps/app/components/crm/record-sheet/deal-sheet.tsx` (remove the 11-currency picker; KEEP the legacy read-only display + "no longer supported" label for non-USD deals)
- Test: extend an existing deals spec (apps/api/test) with: create without currency → "USD".

**Interfaces:** Consumes deals.create/update contracts as they are (currency optional, default USD server-side — verify; if the contract requires currency, send the literal). No API changes.
- [ ] **Step 1:** Remove pickers; verify create path defaults USD end-to-end; legacy non-USD deal still renders its currency read-only.
- [ ] **Step 2:** Spec case; check-types; commit `feat: deals write usd only`.

### Task 3: Money procs — jobProfitability, profitOverTime, costBreakdown, arAging

**Files:**
- Modify: `apps/api/src/reports/reports.service.ts`, `reports.router.ts`, `reports.contracts.ts`, `reports.config.ts` (create if absent: `REPORTS = { trailingMonths: 12, topDeals: 10, csv: {...} } as const`)
- Test: `apps/api/test/reports-money.integration.spec.ts`

**Interfaces (all assert profit.view; all take reportRangeInput; all return `{ kpis, series, rows, excluded }`):**
- `reports.jobProfitability` — per-deal rows `{ dealId, dealName, dealNumber, primaryContactId, primaryContactName, invoicedCents, collectedCents, costsCents, profitCents, collectedProfitCents, marginPct }`; primary contact = first DealContact by createdAt; invoiced = SENT+PAID line totals (existing lineItemsTotalCents path), collected = PAID only; USD-filtered, non-USD invoice/cost rows counted into excluded. KPIs: totals + avg margin. Series: top N deals by profit.
- `reports.profitOverTime` — 12 trailing months (or range), per month `{ month, invoicedCents, collectedCents, costsCents }`; collected bucketed by paidAt month.
- `reports.costBreakdown` — rows by category + secondary cuts byDeal, byCreator; KPI receiptCoveragePct (costs with receiptPath / all).
- `reports.arAging` — outstanding SENT invoices bucketed via agingBucket(dueAt ?? issuedAt+30d); rows `{ invoiceId, number, dealId, dealName, dueAt, ageDays, bucket, totalCents }`; KPIs outstanding/overdue/avgDaysToPay (paidAt−issuedAt over PAID in range).
- [ ] **Step 1:** Service methods (Prisma aggregate/groupBy where possible; the deal→invoice/cost joins mirror the existing byClient query shape but keyed by dealId, not contactId×currency).
- [ ] **Step 2:** Integration spec: two-contact deal counts ONCE (double-count regression); SENT invoice appears in invoiced not collected; PAID in both; EUR legacy invoice lands in excluded and nowhere else; aging bucket edges; receipt coverage math; 403 without profit.view.
- [ ] **Step 3:** check-types (server.ts), commit `feat: money report procs`.

### Task 4: Ops procs — leaderboard, pipeline, leadSources, production, permits

**Files:** same API files; Test: `apps/api/test/reports-ops.integration.spec.ts`

**Interfaces (no page-level gate; money fields null without profit.view — resolve via the permissions service, do NOT throw):**
- `reports.leaderboard` — per owner `{ userId, name, wonCents|null, wonCount, openCount, winRatePct, activitiesLogged }` (won = deals entering a WON-outcome stage in range via stageChangedAt+outcome; activities by createdById+occurredAt).
- `reports.pipeline` — per pipeline: stage conversion funnel (ordered stages, deals passing through from STAGE_CHANGE activity meta from/to in range), loss reasons rollup (closedReason on LOST-outcome), avgDaysInStage; second section estimates funnel `{ sentCount, acceptedCount, declinedCount, acceptRatePct, byTier: {tier, count, valueCents|null}, avgDaysToAccept }`.
- `reports.leadSources` — rows keyed source (Contact.source ∪ TrackedVisitor.firstSource ∪ FormSubmission form name): contacts, deals, wonCount, wonCents|null.
- `reports.production` — deals per ProductionStage now; per-month throughput to COMPLETE (productionStageChangedAt); avg SCHEDULED→COMPLETE days; crews section from ProjectTask `{ crewId, name, color, taskCount, taskDays, doneCount, openCount }` in range.
- `reports.permits` — by status counts; avg submittedAt→issuedAt days per jurisdiction; inspection pass rate (PASSED/(PASSED+FAILED)); feesCents|null total; expiring rows (expiresAt ≤ 30d, status ISSUED/INSPECTIONS).
- [ ] **Step 1:** Service methods. STAGE_CHANGE meta is Json — parse at the boundary with a zod schema in reports.contracts (meta {from,to} strings), skip unparseable rows, never throw.
- [ ] **Step 2:** Integration spec: leaderboard won attribution by stageChangedAt in range; masked money for non-profit.view caller (fields null, no throw); funnel math on a seeded stage walk; lead source union dedupe; production throughput months; permits cycle/pass-rate math.
- [ ] **Step 3:** check-types, commit `feat: ops report procs`.

### Task 5: Money report UIs (4 pages)

**Files:**
- Create: `apps/app/components/reports/reports/job-profitability.tsx`, `profit-over-time.tsx`, `cost-breakdown.tsx`, `ar-aging.tsx` (registry components)
**Interfaces:** each consumes its proc + the Task 1 shell: KPI row, chart (BarTrend/AreaTrend/DonutStat per spec's shapes: top-deals bar, invoiced/collected/costs area or grouped bar, category donut+table, aging bucket bar), drill table with RecordLink to deal/invoice/contact, excluded-disclosure line when excluded>0, Export CSV from rows, honest empty states ("No data in this range").
- [ ] **Step 1:** Components + registry wiring; money formatting via existing formatMoney (USD).
- [ ] **Step 2:** check-types; commit `feat: money report pages`.

### Task 6: Ops report UIs (5 pages)

**Files:** `leaderboard.tsx`, `pipeline.tsx`, `lead-sources.tsx`, `production.tsx`, `permits-report.tsx` under the same dir.
**Interfaces:** as Task 5; money columns render only when the proc returned non-null (the proc is the authority); pipeline page: funnel visual = per-stage bar with conversion % labels (BarTrend variant — if a new variant is needed, implement in packages/ui); permits expiring rows link to the deal's Permits tab (useOpenRecord tab "permits" — the inspection-chip precedent).
- [ ] **Step 1:** Components + registry wiring.
- [ ] **Step 2:** check-types; commit `feat: ops report pages`.

### Task 7: Dashboard re-point + legacy removal

**Files:**
- Modify: `apps/app/components/dashboard/widgets/profit-widgets.tsx` (both widgets call reports.profitOverTime / reports.costBreakdown; delete the local mostActiveCurrency filtering), `apps/api/src/reports/reports.service.ts` + router (DELETE byClient/byMonth/byCategory), remove `apps/app/app/(app)/[slug]/reports/reports-tabs.tsx`
- Test: update any spec referencing the deleted procs.
**Interfaces:** Consumes Tasks 3 procs. Grep the repo for byClient/byMonth/byCategory callers first — the explore sweep says the widgets and the old tabs are the only ones; if another appears, migrate it in this task.
- [ ] **Step 1:** Re-point widgets (keep their compact formatting + 6-month window via range input), delete old procs + tabs file, regen server.ts.
- [ ] **Step 2:** Full api reports specs + app tests; commit `feat: dashboard widgets ride report procs`.

### Task 8: Gates + walkthrough

- [ ] **Step 1:** bun run check-types (14/14); api suite (reports specs minimum + full apps/api); @crm/db, agent (untouched — smoke), app lib tests; packages/telemetry test IF any proc names changed telemetry events (they should not); lint touched files.
- [ ] **Step 2:** Playwright on 3128/3130 (dev-login, NODE runner): library grid as owner (9 cards) vs member without profit.view (money cards hidden); job-profitability end-to-end (range preset change, drill link opens deal, CSV downloads and parses); production report renders; permits report expiring link lands on Permits tab; dashboard widgets render; deal sheet has NO currency picker; legacy EUR deal (seed one via db) shows disclosure line in profit-over-time.
- [ ] **Step 3:** Issues in AGENTS.md format; hand branch head to the floor-holder (kyle-79) for the train — never merge/push from here.
