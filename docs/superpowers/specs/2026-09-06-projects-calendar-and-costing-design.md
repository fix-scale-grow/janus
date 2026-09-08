# Janus: Projects Calendar + Job Costing — Design Spec

**Date:** 2026-09-06
**Status:** Approved in brainstorming with Kyle; ready for implementation planning.
**Supersedes:** the day-board view from `2026-09-05-projects-day-board-design.md` (data model and list page carry forward; the day-column board UI is removed).

**Goal:** Give each job a real calendar. Tasks span days as blocks (Monday-style), navigable across weeks and months, colour-coded by crew — so anyone can see which crew is where on which day. Add tasks through a panel from a top-right button, not inline column footers. Alongside it, a job-cost ledger per deal and profit reporting (per job, per client, per month, per category), gated by an admin-granted per-user permission.

## Scope

Four connected pieces:

1. **Calendar rebuild** of `/projects/[id]`: month grid (default) + week view + timeline tab, replacing the day-column board entirely.
2. **Crews**: a lightweight named-crew entity for task assignment and calendar colour.
3. **Job costs**: a `JobCost` ledger on the deal with optional receipt upload, plus a per-deal profit strip.
4. **Reports**: a `/reports` page (profit by client / by month / by category) and the `profit.view` permission seed.

Out of scope for v1 (explicitly deferred): drag-to-reschedule on the timeline tab (month/week grid only), recurring tasks, task dependencies, cross-project/company-wide calendar, labor-hours × rate costing, category budgets, report exports, tax features, notifications, agent involvement. Each is a clean follow-up.

## Data model

### ProjectTask spans days

`day` is replaced by `startDay` + `endDay`:

```prisma
model ProjectTask {
  id         String            @id @default(cuid())
  projectId  String
  project    Project           @relation(fields: [projectId], references: [id], onDelete: Cascade)
  name       String
  note       String?
  startDay   DateTime?
  endDay     DateTime?
  status     ProjectTaskStatus @default(TODO)
  sortOrder  Int               @default(0)
  assigneeId String?
  assignee   User?             @relation("ProjectTaskAssignee", fields: [assigneeId], references: [id], onDelete: SetNull)
  crewId     String?
  crew       Crew?             @relation(fields: [crewId], references: [id], onDelete: SetNull)
  createdAt  DateTime          @default(now())
  updatedAt  DateTime          @updatedAt

  @@index([projectId, startDay])
  @@index([crewId, startDay])
  @@map("project_task")
}
```

- Both null = unscheduled. Both set with `endDay >= startDay`; a single-day task has `startDay = endDay`. One null and not the other is rejected at the zod boundary (`daySpan` refinement).
- Dates remain UTC midnight through the existing `toDay()` normaliser. Max span: `MAX_TASK_SPAN_DAYS = 30` in `projects.config.ts`.
- **Migration is staged, not destructive on a dev-started branch** (per the staged-migration doctrine): the branch migration ADDs `startDay`/`endDay`/`crewId` and backfills `startDay = day, endDay = day`; the `DROP COLUMN day` DDL is HELD outside `prisma/migrations/` (HOLD note in the migration folder) and lands at merge day. Code never reads `day` after this branch.

### Crew

```prisma
model Crew {
  id        String        @id @default(cuid())
  name      String
  color     String
  archived  Boolean       @default(false)
  tasks     ProjectTask[]
  createdAt DateTime      @default(now())
  updatedAt DateTime      @updatedAt

  @@map("crew")
}
```

- `color` is a key into a fixed palette of ~10 swatches defined once in `packages/ui` (design doctrine: no free colour picker, no literal colours at call sites). Zod-enforced enum at the boundary.
- Archived crews keep their colour on existing tasks but leave the pickers. Delete is allowed only when no tasks reference the crew; otherwise archive.
- Managed at Settings › Crews.
- `assigneeId` (single user) stays as-is alongside `crewId`.

### JobCost

```prisma
enum JobCostCategory {
  MATERIALS
  LABOR
  SUBCONTRACTOR
  EQUIPMENT
  PERMITS_FEES
  OTHER
}

model JobCost {
  id          String          @id @default(cuid())
  dealId      String
  deal        Deal            @relation(fields: [dealId], references: [id], onDelete: Cascade)
  date        DateTime
  amountCents Int
  currency    String
  category    JobCostCategory
  note        String?
  receiptPath String?
  createdById String
  createdBy   User            @relation("JobCostCreator", fields: [createdById], references: [id])
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt

  @@index([dealId, date])
  @@index([category])
  @@index([date])
  @@map("job_cost")
}
```

- The **deal is the job**: costs anchor to the deal, same as invoices, so profit lands on one record. Cascade on deal delete.
- `amountCents` integer cents, consistent with estimates/invoices. `currency` defaults from the deal at create. `amountCents > 0`, capped at `MAX_COST_AMOUNT_CENTS` in a `costs.config.ts`.
- `receiptPath` points at local-disk storage `data/costs/receipts/` (`COSTS_DATA_DIR` env optional), exactly the drawing-thumbnail pattern: session-gated GET route, no external storage, missing file renders a broken-receipt placeholder not an error. Accepted types: JPEG/PNG/WebP/PDF, size-capped. Receipt is optional — the quick-add path never requires it. Replacing a receipt deletes the old file; deleting a cost deletes its file.

### UserPermission

```prisma
model UserPermission {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation("PermissionHolder", fields: [userId], references: [id], onDelete: Cascade)
  key         String
  grantedById String
  grantedBy   User     @relation("PermissionGrantor", fields: [grantedById], references: [id])
  createdAt   DateTime @default(now())

  @@unique([userId, key])
  @@map("user_permission")
}
```

- One key in v1: `profit.view` (`PERMISSION_KEYS` const in a shared contracts module — future features add keys, not tables; this is deliberately the seed of the later access-control system).
- **Admins hold every permission implicitly**: `hasPermission(userId, key)` in the API returns true when the user's `Member.role` in the workspace organization is `owner` or `admin`, else checks the table. This helper is the single enforcement point; every gated procedure calls it. UI hiding is convenience, not security.

## API

### `projects` module (extended)

- `taskCreate` — `{ projectId, name, startDay?, endDay?, crewId?, assigneeId?, note? }`; span refinement; `endDay` defaults to `startDay` when only one given.
- `taskUpdate` — adds `startDay`, `endDay`, `crewId`.
- `taskMove` — `{ id, startDay, endDay, sortOrder }` (both null = to unscheduled); resequences siblings in one transaction as today.
- `byId` orders tasks `startDay asc, sortOrder asc`.
- Crew procedures in a small `crews` module (`list`, `create`, `update`, `archive`, `remove` — remove refuses with `ConflictException` when tasks reference it). Standard module shape, `AuthMiddleware`, cache key `cache.crews`.

### `costs` module (new)

- `list` — `{ dealId }` → entries newest-first + `{ totalsByCurrency, totalsByCategory }`.
- `create` / `update` / `remove` — ledger CRUD; any authenticated user may log a cost.
- Receipt upload/serve: Next route handlers following the drawing-thumbnail routes (session-gated), path recorded via the tRPC mutation.
- Profit summary: `profitForDeal { dealId }` → `{ invoicedCents, collectedCents, costsCents, profitCents, marginPct, byCurrency }` — **gated by `profit.view`**. Invoiced = Σ line totals (`priceCents × quantity`) of non-DRAFT invoices on the deal; collected = same for invoices with `paidAt` set; profit = invoiced − costs. Mixed currencies: computed and returned per currency, never summed across currencies.

### `reports` module (new; every procedure gated by `profit.view`)

- `byClient` — contacts ranked by lifetime profit across their deals (via `DealContact`): `{ contactId, name, dealCount, invoicedCents, costsCents, profitCents, marginPct }`. A deal's figures attribute to each linked contact (documented; typical case is one client per deal).
- `byMonth` — trailing 12 months: invoiced / costs / profit per month.
- `byCategory` — cost totals by category over a date range (default: trailing 12 months).
- All server-side Prisma aggregation; no new tables, no snapshots.

### `permissions` module (new)

- `listUsers` — users with their permission keys (admin-gated).
- `grant` / `revoke` — `{ userId, key }`, admin-gated (`ForbiddenException` otherwise); no-op guard against revoking from an admin (they hold it implicitly regardless).
- `mine` — the caller's effective keys, for UI gating (nav, tabs, strips).

## UI

### `/projects/[id]` — the calendar page

Header strip unchanged (name, deal link, status control, goal text, countdown, progress bar) plus a costs link ("Job costs · $7,270" → the deal's Costs tab). Below it: `[Calendar | Timeline]` tabs, view toggle `[Month | Week]` within Calendar, `‹ ›` + "Today" navigation, and **[+ Add task]** top right. The old day-column board, its per-column add inputs, and the Unscheduled column are removed.

**Month grid (default):** hand-rolled 7-column CSS grid, one row per week of the visible month, leading/trailing days muted. Task bars span their days and wrap across week rows (Google-Calendar style): per week row, bars are laid into lanes (up to 4), overflow collapses into a "+N more" cell popover listing that day's tasks. Bar = crew colour (neutral grey when crewless), task name, status: DONE renders muted with a check, IN_PROGRESS carries a subtle indicator. Goal-date cell carries the flag marker ("Goal"); today's cell is ringed.

Interactions:
- Drag a bar → whole span shifts to the drop day (dnd-kit, same sensors/conventions as the boards; optimistic, rollback on error).
- Drag the bar's right-edge handle → stretch/shrink `endDay` (min = `startDay`, max = span cap).
- Click a bar → edit popover: rename, note, dates, crew, assignee, status cycle, delete.
- Click an empty day cell → opens the Add-task panel pre-filled with that date.

**Week view:** the same grid components rendering a single week row with taller cells and more visible lanes. A range switch, not a second implementation.

**Timeline tab:** task rows left (name + crew dot + status chip), day columns across the top over an 8-week window with `‹ ›` paging and `usePanScroll`; blocks positioned by the same span math (one shared layout module). Read-mostly: click opens the edit popover; no dragging here in v1.

**Unscheduled strip:** collapsible row under the header ("Unscheduled · 3") with task chips; clicking a chip opens the edit popover to give it dates. Dragging a calendar bar cannot target the strip in v1 — unscheduling happens by clearing dates in the popover.

**Add-task panel:** right-side sheet (existing record-sheet conventions): name (required), start date, end date (defaults to start), crew select (with colour dots), assignee, status, note. Submit creates and the block appears on the calendar; "Create another" keeps the panel open.

Shared calendar primitives that other views could reuse later (the deferred cross-project calendar) live under `apps/app` components with the layout math isolated in a pure module (`lib/calendar/span-layout.ts`) with unit tests.

### Settings › Crews

List (colour dot, name, task count), create/rename/recolour, archive/unarchive, delete when unreferenced. Palette picker shows the ~10 swatches only.

### Deal sheet — Costs tab

- Quick-add row pinned on top: date (defaults today), category select, amount, note, optional receipt attach. Logging takes seconds; receipt is a clearly optional affordance.
- Entries newest-first: date, category chip, note, amount, receipt icon (opens in new tab), inline edit/delete (delete confirms).
- **Profit strip** above the ledger for `profit.view` holders: `Invoiced · Collected · Costs · Profit · margin %`, per-currency lines when mixed. Without the permission: ledger + costs total only — no revenue, no profit, and the profit fetch is never made.
- The Projects tab and calendar page cross-link to Costs.

### `/reports`

Nav item visible only with `profit.view` (server-checked regardless). One page, three tabs:

- **By client:** table ranked by lifetime profit — client, jobs, invoiced, costs, profit, margin. Rows link to the contact.
- **By month:** trailing 12 months, invoiced vs costs vs profit — table plus a simple bar chart following the app's existing chart conventions.
- **By category:** cost split by category over a date-range picker.

Read-only. No exports, no custom builder.

### Settings › Team (permissions)

Admin-only section listing users with a "Can view profit" toggle per user (writes `grant`/`revoke`). Admins show as "Admin — always" and cannot be toggled. Copy notes this is where per-feature access will grow.

## Error handling

- Calendar mutations: optimistic with rollback + toast, the `deals.setStage` pattern. `taskMove` on a deleted task → `NotFoundException`, bar restored, "task is gone" toast.
- Span violations (end before start, over cap) rejected at zod with a clear message; the edge-drag UI clamps before ever sending.
- Receipt upload failures leave the cost entry intact without a receipt (cost row first, file second).
- Gated procedures throw `ForbiddenException`; the UI treats it as hidden, never as an error toast.
- Crew delete with references → `ConflictException` surfaced as "archive instead" guidance.

## Testing

- `span-layout` unit tests: lane assignment, week-row wrapping, overflow counts, single-day vs multi-day, month-boundary spans.
- Contract tests: span refinement (both-or-neither, end ≥ start, cap), cost amount bounds, crew colour enum, permission key enum.
- Integration (TEST_DATABASE_URL, TEST_RUN_ID-suffixed fixtures): task span backfill migration behaviour, `taskMove` resequencing with spans, cost CRUD + `profitForDeal` maths (draft invoices excluded, paid vs issued, mixed currency), `hasPermission` (member without grant blocked, with grant allowed, admin implicit), reports aggregation against seeded fixtures.
- Playwright walkthrough: create a 3-day task from the panel → bar spans Sun–Tue → drag it → stretch it → week view → timeline → log a cost (no receipt) → attach a receipt to another → profit strip on the deal → revoke `profit.view` → strip and `/reports` gone for that user → admin still sees reports by-client with the deal.

## Build order

1. Prisma models + additive migration (spans backfill, crew, job_cost, user_permission; `day`-drop DDL HELD outside migrations dir until merge day).
2. `crews` + `permissions` modules (+ `hasPermission` helper) + tests.
3. `projects` module span changes + regenerated `server.ts` + tests.
4. `span-layout` module + month/week grid + Add-task panel + unscheduled strip (board removed).
5. Timeline tab.
6. Settings › Crews + Settings › Team permission toggles.
7. `costs` module + Costs tab + profit strip + receipt routes.
8. `reports` module + `/reports` page + gated nav.
9. Playwright walkthrough.

## Coordination

Built on branch `janus/projects-calendar` in worktree `.claude/worktrees/projects-calendar` off foundation@fec0e7e, private dev/test DBs (never the shared `crm`), new migrations timestamped after every peer's latest, models appended at the END of `schema.prisma`. Merge into `janus/foundation` goes through kyle-cc's train and is Kyle-gated.
