# Report Center — design

Date: 2026-09-14
Status: approved by Kyle (chat brainstorm 2026-09-14: "Remove the currency term from the
reports... a more data driven report system... ok, go for phase 1")
Branch: janus/phase-report-center (worktree, off foundation@91cd3f4)

## Goal

Replace the three-tab table page at /reports with a Report Center: a library of canned,
chart-first reports built from data the schema already holds, with date ranges, drill-down
tables and CSV export on every report — and remove currency from the reporting surface by
enforcing USD-only at the source. Competitive grounding (researched 2026-09-14): every
contractor CRM converges on the same core reports; the universal review complaints are
shallow canned reports, paywalled customization, and no export. Phase 1 ships the canned
library done right; the custom builder + scheduled email (Phase 2, post-launch) then lands
on this scaffolding as the un-gated trio no competitor ships.

## Key decisions

- USD-only is enforced at the WRITE side: the deal currency pickers go away, everything
  defaults USD. The currency engine (docs/currency.md, fx tables, baseAmount) stays
  dormant and untouched — this is UI/report-surface removal, not an engine teardown.
- Reports never sum across currencies (currency.md holds). With writes USD-only, reports
  aggregate the USD rows and DISCLOSE any legacy non-USD rows as excluded ("N entries in
  other currencies are not included") instead of printing Currency columns or silently
  dropping them (the old chart's behavior).
- Two money truths, always shown together where money is reported: INVOICED (SENT+PAID
  invoices, the existing revenueStatuses) and COLLECTED (PAID, using Invoice.paidAt).
  The old single "profit" (invoiced minus costs) mislabeled unpaid work as profit.
- Client attribution is per-DEAL, credited once to the deal's primary contact (first
  attached DealContact by createdAt) — kills the multi-contact double-count.
- Money reports stay behind profit.view. Operational reports (counts, throughput,
  funnels) are visible to every member. Gating is per-report, not per-page.
- Dashboard's profit-by-month and costs-by-category widgets re-point to the shared report
  queries — one computation, two surfaces, no duplicated currency logic.
- CSV export is client-side v1 (build the file from the loaded drill-table rows); server
  CSV/PDF and scheduling are Phase 2.

## The report library (9 reports)

Every report = KPI tiles + one primary chart (recharts primitives already in
packages/ui: AreaTrend/BarTrend/DonutStat, extend only inside packages/ui) + a drill-down
table + shared date-range control + Export CSV. Registry-driven: one report registry
(id, title, description, permission, component) renders the library page and the per-
report route; the registry is the Phase 2 seam for saved/custom reports.

1. Job profitability (profit.view) — per deal: invoiced, collected, costs, profit
   (invoiced-costs) and collected profit, margin; KPIs: totals + avg margin; chart: top
   deals by profit; table drills to deal. Client rollup view (primary-contact rule).
2. Profit over time (profit.view) — the old by-month, corrected: invoiced vs collected vs
   costs by month, 12 trailing months; excluded-currency disclosure line.
3. Cost breakdown (profit.view) — the old by-category + by-deal and by-creator cuts,
   date-ranged; receipt-coverage KPI (% of cost entries with a receipt).
4. AR aging (profit.view) — outstanding SENT invoices bucketed current/1-30/31-60/61-90/
   90+ from dueAt (fallback issuedAt+30); KPIs: total outstanding, overdue, avg days-to-
   pay (paidAt-issuedAt on PAID); table drills to invoice.
5. Sales leaderboard — per owner: won value (profit.view masks the money columns; counts
   visible to all), win rate, deals moved, activities logged; chart: won by owner.
6. Pipeline win/loss + velocity — win rate by stage, loss reasons (closedReason), avg
   days-in-stage (stageChangedAt + STAGE_CHANGE activity history), conversion funnel
   between ordered stages per pipeline.
7. Lead sources — contacts/deals by RecordSource + tracked first-touch source/medium/
   campaign (TrackedVisitor/FormSubmission), form conversion; with profit.view: won value
   per source (lead-source ROI).
8. Production + crews — deals per production stage now, throughput per month
   (productionStageChangedAt), avg SCHEDULED→COMPLETE days; crew view: tasks and task-days
   per crew from ProjectTask (crewId, startDay/endDay), done vs open.
9. Permits — the differentiator: permits by status, avg days submitted→issued per
   jurisdiction, inspection pass rate, fees total (profit.view), expiring ≤30d list.
   No competitor ships this without a paid add-on.

Estimates funnel (sent→accepted rate, value by tier GOOD/BETTER/BEST, avg time-to-accept)
folds into report 6 as a second section rather than a tenth report.

## Surfaces

- /reports becomes the library: card grid (title, one-line description, KPI sparkline
  optional later); card → /reports/[reportId]. Permission-gated cards hidden per user.
- Per-report page: PageShell, date-range control (shared component, nuqs params from/to,
  presets: 30d/90d/12m/custom), KPI tile row, chart, drill table, Export CSV button.
- Nav: Reports entry stays; permission no longer page-wide — the page itself is visible
  to all members, money cards/columns respect profit.view server-side AND in UI.
- Dashboard: profit-by-month + costs-by-category widgets call the new shared queries.

## API shape

New procedures on the reports router, one per report (reports.jobProfitability,
reports.profitOverTime, reports.costBreakdown, reports.arAging, reports.leaderboard,
reports.pipelineVelocity, reports.leadSources, reports.production, reports.permits), each
taking the shared range input and returning { kpis, series, rows, excluded } with typed
shapes in reports.contracts.ts. Money procs assert profit.view; mixed procs (leaderboard,
leadSources) return money fields null unless the caller holds profit.view. All aggregates
filter to USD rows and count non-USD rows into `excluded`. byClient/byMonth/byCategory
are replaced (deleted) — the dashboard widgets and the new reports are the only callers;
migration note: no external consumers exist.

## USD-only enforcement (the "remove currency" half)

- create-deal-sheet and deal-sheet currency pickers removed; deals write currency "USD"
  always. Legacy non-USD deals keep displaying their stored currency on the record (the
  existing "no longer supported" label stays) — records are history, reports disclose.
- currency.settings remains for the engine; no settings UI returns (consistent with the
  9/7 removal). JobCost/estimate/invoice creation paths inherit the deal's currency as
  today (which is now always USD for new deals).
- The Currency column, per-currency row splits, and mostActiveCurrency chart filtering
  are deleted from all report surfaces and the two dashboard widgets.

## Out of scope (Phase 2, post-launch — already on the roadmap)

Custom report builder (fields/filters/group-by), scheduled email delivery, server-side
CSV/PDF export, saved reports as dashboard widgets, report sharing links.

## Error handling

- Empty ranges render honest empty states per report (no fake zeros in KPIs — "No data
  in this range").
- excluded > 0 renders the disclosure line; zero renders nothing.
- Permission: server 403s on money procs without profit.view; UI never shows a card or
  column the server would refuse.

## Testing

- Integration specs per report proc: seeded fixtures exercising the exact aggregation
  (double-count regression case for jobProfitability: two contacts on one deal count
  once; AR bucket boundaries; velocity math from STAGE_CHANGE history; USD filtering +
  excluded counting with a legacy EUR row; permission masking on leaderboard).
- Unit tests for shared range/bucket/CSV helpers (pure libs).
- Playwright walkthrough: library grid per role (member vs profit.view), one money and
  one operational report end-to-end (range change, drill link, CSV download), dashboard
  widgets still render, deal sheet no longer offers a currency picker.
