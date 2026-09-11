# Custom Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the overview dashboard a per-user customisable canvas of widgets — drag, freeform resize, remove, add — persisted through the UserView system.

**Architecture:** A widget registry maps widget ids to metadata and components. `react-grid-layout` (v2) renders the canvas on a 48-column × 8px-row grid with vertical compaction. Layout state is a `{id,x,y,w,h}[]` stored in `viewStateSchema.dashboardLayout` under UserView `tableId: "dashboard"`, saved only on Done. Widgets source data from existing lean tRPC queries; one new lean query (`projects.upcomingTasks`) is added.

**Tech Stack:** Next 16 / React 19, react-grid-layout ^2.2.4 (new dep, apps/app), nestjs-trpc, zod, bun test, Playwright (NODE-launched).

**Spec:** `docs/superpowers/specs/2026-09-11-custom-dashboard-design.md`

## Global Constraints

- Repo rules (AGENTS.md): NO code comments anywhere; NO Co-Authored-By trailers; shared UI variants live in `packages/ui`; parse untrusted shapes with zod at the boundary; tunable numbers live in one config object per area.
- Design rules (`docs/design.md`): shared shadcn components; radius from the scale only; only `primary`/`destructive` are filled.
- Coordination: work ONLY in this worktree (`.claude/worktrees/phase-m-dashboard`, branch `janus/phase-m-dashboard`). Never touch the main checkout. No Prisma migrations in this phase. Dev servers: API port 3113, app port 3112 (`PORT` inline for `next dev -p 3112`); kill them when done.
- Databases: `janus_dashboard_dev` / `janus_dashboard_test` (copy `.env` recipe from a prior worktree phase; `TEST_DATABASE_URL` for api tests). The shared `crm`/`crm_test` DBs are NEVER touched from this worktree.
- Run `bun install` in the worktree before first build (postinstall syncs the maplibre worker; if the `prepare` script fails on Windows, run `bun install --ignore-scripts` then `node apps/app/scripts/sync-maplibre-worker.mjs`).
- Gates before merge-ready: `bun run check-types` (all), `biome check` scoped to touched files, `bun test` in `packages/db`, `apps/app`, `apps/api` (dashboard/views/projects suites), Playwright walkthrough.
- Playwright: launch driver scripts with NODE, not bun. Login via `/api/dev-login?email=karlosantanas@gmail.com` (mints OWNER); a second user is `/api/dev-login?email=member@example.com`.

---

### Task 1: Layout schema field

**Files:**
- Modify: `packages/db/src/user-views.ts`
- Test: `packages/db/test/user-views.spec.ts`

**Interfaces:**
- Produces: `"dashboard"` in `VIEW_TABLE_IDS`; `dashboardLayout?: {id: string; x: number; y: number; w: number; h: number}[]` on `ViewState`; exported `dashboardLayoutEntry` zod object and `DashboardLayoutEntry` type.

- [ ] **Step 1: Write the failing tests** (append to the existing spec file, following its style)

```ts
test("dashboard is a valid table id", () => {
	expect(VIEW_TABLE_IDS).toContain("dashboard");
});

test("dashboardLayout round-trips through parseViewState", () => {
	const state = {
		dashboardLayout: [{ id: "trend", x: 0, y: 13, w: 28, h: 40 }],
	};
	expect(parseViewState(state)).toEqual(state);
});

test("dashboardLayout rejects out-of-range entries", () => {
	expect(() =>
		parseViewState({ dashboardLayout: [{ id: "trend", x: 48, y: 0, w: 1, h: 1 }] }),
	).toThrow();
	expect(() =>
		parseViewState({ dashboardLayout: [{ id: "trend", x: 0, y: 0, w: 49, h: 1 }] }),
	).toThrow();
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `cd packages/db && bun test test/user-views.spec.ts`
Expected: FAIL (`dashboard` not in enum; unknown key stripped so round-trip mismatch)

- [ ] **Step 3: Implement**

In `packages/db/src/user-views.ts`: add `"dashboard"` to `VIEW_TABLE_IDS`; above `viewStateSchema` add:

```ts
export const dashboardLayoutEntry = z.object({
	id: z.string().max(40),
	x: z.number().int().min(0).max(47),
	y: z.number().int().min(0).max(500),
	w: z.number().int().min(1).max(48),
	h: z.number().int().min(1).max(120),
});

export type DashboardLayoutEntry = z.infer<typeof dashboardLayoutEntry>;
```

and inside `viewStateSchema`'s object: `dashboardLayout: z.array(dashboardLayoutEntry).max(20).optional(),`

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/db && bun test test/user-views.spec.ts`
Expected: PASS (all, including pre-existing)

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/user-views.ts packages/db/test/user-views.spec.ts
git commit -m "feat: add the dashboard layout to the user view state"
```

### Task 2: Layout config, default layout, and merge helper

**Files:**
- Create: `apps/app/lib/dashboard/dashboard-config.ts`
- Create: `apps/app/lib/dashboard/layout.ts`
- Test: `apps/app/lib/dashboard/layout.test.ts`

**Interfaces:**
- Consumes: `DashboardLayoutEntry` from `@crm/db/user-views` (type-only import is fine in client code — it is a zod-derived type; do NOT import the schema value into a client component).
- Produces:
  - `DASHBOARD` config: `{ grid: { cols: 48, rowHeightPx: 8, maxWidgets: 20 }, upcoming: { days: 14, take: 8 } }`.
  - `WidgetMeta` type: `{ id: string; title: string; description?: string; minW: number; minH: number; defaultW: number; defaultH: number; permission?: "profit.view" }`.
  - `DEFAULT_LAYOUT: DashboardLayoutEntry[]` (today's arrangement, ids below).
  - `resolveLayout(saved: DashboardLayoutEntry[] | undefined, widgets: WidgetMeta[]): DashboardLayoutEntry[]` — drops entries whose id has no meta, clamps `w`/`h` up to the meta's `minW`/`minH` and down to grid bounds, clamps `x` so `x + w <= 48`; returns `DEFAULT_LAYOUT` filtered to known ids when `saved` is undefined or resolves empty.
  - `addEntry(layout, meta)` — appends `{id, x: 0, y: maxY, w: defaultW, h: defaultH}` where `maxY = max(y + h)` over the layout (0 when empty).

Widget ids (the canonical list, used by every later task):
`stat-won-month`, `stat-open-pipeline`, `stat-win-rate`, `stat-avg-deal`, `trend`, `pipeline-donut`, `deals-open`, `tasks-overdue`, `activity`, `profit-by-month`, `costs-by-category`, `tasks-upcoming`.

`DEFAULT_LAYOUT` (first nine only — profit/upcoming widgets are add-able, not default):

```ts
export const DEFAULT_LAYOUT: DashboardLayoutEntry[] = [
	{ id: "stat-won-month", x: 0, y: 0, w: 12, h: 13 },
	{ id: "stat-open-pipeline", x: 12, y: 0, w: 12, h: 13 },
	{ id: "stat-win-rate", x: 24, y: 0, w: 12, h: 13 },
	{ id: "stat-avg-deal", x: 36, y: 0, w: 12, h: 13 },
	{ id: "trend", x: 0, y: 13, w: 28, h: 40 },
	{ id: "pipeline-donut", x: 28, y: 13, w: 20, h: 40 },
	{ id: "deals-open", x: 0, y: 53, w: 24, h: 36 },
	{ id: "tasks-overdue", x: 24, y: 53, w: 24, h: 36 },
	{ id: "activity", x: 0, y: 89, w: 48, h: 32 },
];
```

- [ ] **Step 1: Write the failing tests** (`apps/app/lib/dashboard/layout.test.ts`, mirror `apps/app/lib/nav-order.test.ts` style, `bun test`)

```ts
import { expect, test } from "bun:test";
import { DASHBOARD } from "./dashboard-config";
import { addEntry, DEFAULT_LAYOUT, resolveLayout } from "./layout";

const META = [
	{ id: "trend", title: "T", minW: 16, minH: 24, defaultW: 28, defaultH: 40 },
	{ id: "activity", title: "A", minW: 16, minH: 20, defaultW: 48, defaultH: 32 },
];

test("undefined saved layout resolves to the default", () => {
	const metas = DEFAULT_LAYOUT.map((e) => ({
		id: e.id, title: e.id, minW: 1, minH: 1, defaultW: e.w, defaultH: e.h,
	}));
	expect(resolveLayout(undefined, metas)).toEqual(DEFAULT_LAYOUT);
});

test("unknown widget ids are dropped", () => {
	const saved = [
		{ id: "trend", x: 0, y: 0, w: 20, h: 30 },
		{ id: "gone-widget", x: 20, y: 0, w: 10, h: 10 },
	];
	expect(resolveLayout(saved, META).map((e) => e.id)).toEqual(["trend"]);
});

test("sizes clamp to min and grid bounds", () => {
	const saved = [{ id: "trend", x: 40, y: 0, w: 4, h: 4 }];
	const [e] = resolveLayout(saved, META);
	expect(e.w).toBe(16);
	expect(e.h).toBe(24);
	expect(e.x + e.w).toBeLessThanOrEqual(DASHBOARD.grid.cols);
});

test("a saved layout of only unknown ids falls back to the default", () => {
	const saved = [{ id: "gone", x: 0, y: 0, w: 10, h: 10 }];
	expect(resolveLayout(saved, META).length).toBeGreaterThan(0);
});

test("addEntry lands below everything", () => {
	const layout = [{ id: "trend", x: 0, y: 5, w: 20, h: 30 }];
	const next = addEntry(layout, META[1]);
	expect(next.at(-1)).toEqual({ id: "activity", x: 0, y: 35, w: 48, h: 32 });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/app && bun test lib/dashboard/layout.test.ts`
Expected: FAIL (modules do not exist)

- [ ] **Step 3: Implement `dashboard-config.ts` and `layout.ts`** — pure functions, no React imports. `resolveLayout` clamps in this order: drop unknown ids → `w = min(max(w, meta.minW), cols)` → `h = max(h, meta.minH)` → `x = min(x, cols - w)`. Fallback: when input is `undefined` OR the filtered result is empty, return `DEFAULT_LAYOUT` filtered to ids present in `widgets` (sizes taken from `DEFAULT_LAYOUT`, not re-clamped).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/app && bun test lib/dashboard/layout.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/app/lib/dashboard
git commit -m "feat: add the dashboard layout config and resolver"
```

### Task 3: Upcoming-tasks lean query

**Files:**
- Modify: `apps/api/src/projects/projects.contracts.ts`, `apps/api/src/projects/projects.router.ts`, `apps/api/src/projects/projects.service.ts`
- Test: `apps/api/test/projects-upcoming.integration.spec.ts`

Read `docs/api.md` and `apps/api/test/dashboard-stages.integration.spec.ts` (fixture/bootstrap pattern) first.

**Interfaces:**
- Produces: `projects.upcomingTasks` query, no input, returns `{ tasks: { id: string; name: string; startDay: Date; crewName: string | null; project: { id: string; name: string }; dealName: string | null }[] }` — tasks with `startDay` between today (UTC day floor) and today + 14 days, ordered by `startDay` asc then `sortOrder` asc, take 8, statuses `TODO`/`IN_PROGRESS` only. Constants live in the service file's existing config object if one exists, else `PROJECTS.upcoming = { days: 14, take: 8 }` beside the module's other constants.

- [ ] **Step 1: Write the failing integration test** — seed one project with a deal (use the branch's seeded-stage lookup pattern `db.stage.findFirstOrThrow({ where: { key: "DEMO_BOOKED" } })` for the deal fixture, copying the fixture helper style from `dashboard-stages.integration.spec.ts`), three tasks: one starting tomorrow (expected), one `DONE` starting tomorrow (excluded), one starting in 30 days (excluded). Assert order, shape, and exclusions.

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/api && bun test test/projects-upcoming.integration.spec.ts`
Expected: FAIL (`upcomingTasks` not a procedure)

- [ ] **Step 3: Implement** — contracts: no new input schema needed (`@Query()` with no input). Service method:

```ts
async upcomingTasks() {
	const from = new Date();
	from.setUTCHours(0, 0, 0, 0);
	const to = new Date(from);
	to.setUTCDate(to.getUTCDate() + PROJECTS.upcoming.days);
	const rows = await this.db.projectTask.findMany({
		where: {
			startDay: { gte: from, lte: to },
			status: { in: ["TODO", "IN_PROGRESS"] },
		},
		orderBy: [{ startDay: "asc" }, { sortOrder: "asc" }],
		take: PROJECTS.upcoming.take,
		select: {
			id: true, name: true, startDay: true,
			crew: { select: { name: true } },
			project: { select: { id: true, name: true, deal: { select: { name: true } } } },
		},
	});
	return {
		tasks: rows.map((row) => ({
			id: row.id, name: row.name, startDay: row.startDay,
			crewName: row.crew?.name ?? null,
			project: { id: row.project.id, name: row.project.name },
			dealName: row.project.deal?.name ?? null,
		})),
	};
}
```

Router: `@Query() async upcomingTasks() { return this.projects.upcomingTasks(); }` under the existing `AuthMiddleware`. Then `cd apps/api && bun run check-types` (regenerates the committed `server.ts`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/api && bun test test/projects-upcoming.integration.spec.ts test/dashboard-stages.integration.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit** (include the regenerated `server.ts`)

```bash
git add apps/api/src/projects apps/api/test/projects-upcoming.integration.spec.ts packages/api-types
git commit -m "feat: add the upcoming tasks query"
```

(If `bun run check-types` writes the generated router elsewhere, commit whatever path changed — check `git status`.)

### Task 4: Widget chrome in packages/ui

**Files:**
- Create: `packages/ui/src/components/widget-shell.tsx`
- Modify: `packages/ui/src/components/index barrel` only if the package exports through one (check how `dashboard.tsx` is exported and follow it)

**Interfaces:**
- Produces: `WidgetShell` client component:

```tsx
export function WidgetShell(props: {
	title: string;
	description?: ReactNode;
	action?: ReactNode;
	editing?: boolean;
	onRemove?: () => void;
	children: ReactNode;
});
```

Renders the existing `Card`/`CardHeader`/`CardTitle`/`CardDescription`/`CardAction` composition (same classes as `ChartPanel` in `sales-dashboard.tsx`: card `min-w-0 h-full flex flex-col`, body `flex flex-1 flex-col min-h-0 overflow-hidden`). When `editing`: a drag-handle element with class `janus-widget-drag` and a Carbon `Draggable` icon sits before the title with `cursor-grab`; an icon-button (ghost, `size="icon-sm"` if the button component has it, else the smallest existing icon variant) with an X calls `onRemove`. Also exports `WidgetError({ onRetry }: { onRetry: () => void })` — centred muted message "This widget could not load." with a small outline Retry button.

- [ ] **Step 1: Implement** `WidgetShell` + `WidgetError`. Reuse `Card` primitives; no new radii/colours; the drag-handle class name `janus-widget-drag` is the contract Task 5 passes to react-grid-layout's `draggableHandle`.
- [ ] **Step 2: Verify types**

Run: `cd packages/ui && bun run check-types` (if the package has the script; otherwise `bun run check-types` at repo root)
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/components/widget-shell.tsx
git commit -m "feat: add the widget shell"
```

### Task 5: Widget components and registry

**Files:**
- Create: `apps/app/components/dashboard/widgets/` — `stat-widgets.tsx`, `trend-widget.tsx`, `pipeline-donut-widget.tsx`, `deals-open-widget.tsx`, `tasks-overdue-widget.tsx`, `activity-widget.tsx`, `profit-widgets.tsx`, `tasks-upcoming-widget.tsx`
- Create: `apps/app/components/dashboard/summary-context.tsx`
- Create: `apps/app/lib/dashboard/widget-registry.tsx`
- Modify: `apps/app/app/(app)/[slug]/dashboard-summary.tsx`, delete `apps/app/app/(app)/[slug]/sales-dashboard.tsx` (its content moves into the widget files)

**Interfaces:**
- Consumes: `WidgetShell`/`WidgetError` (Task 4), `WidgetMeta` (Task 2), existing queries: `dashboard.summary`, `dashboard.pipelineStages`, `reports.byMonth`, `reports.byCategory`, `projects.upcomingTasks`, `permissions.mine`.
- Produces:
  - `SummaryProvider({ scope, children })` — runs the single `trpc.dashboard.summary` query (`placeholderData: (previous) => previous`) and provides `{ summary: Summary | undefined }` via context; `useSummary()` hook. Widgets that need summary slices read the context; they render a `Spinner` row while `summary` is undefined.
  - `DASHBOARD_WIDGETS: (WidgetMeta & { component: ComponentType })[]` in `widget-registry.tsx` — the 12 ids from Task 2, titles/descriptions matching today's copy, sizes: stats `minW 8 minH 11, default 12×13`; trend `16/24, 28×40`; donut `14/24, 20×40`; deals-open `16/22, 24×36`; tasks-overdue `14/20, 24×36`; activity `16/20, 48×32`; profit-by-month `16/22, 24×34`; costs-by-category `14/20, 24×34`; tasks-upcoming `14/20, 24×30`. `permission: "profit.view"` on both profit widgets.
  - `useVisibleWidgets(): (WidgetMeta & { component })[]` — filters `DASHBOARD_WIDGETS` by `trpc.permissions.mine` (`keys.includes("profit.view")`; while the query is loading, gated widgets are excluded).

Widget extraction rules:
- Move code, do not rewrite it: `SalesDashboard`'s four `StatCard`s become four components in `stat-widgets.tsx` reading `useSummary()`; the `changeDelta` helper and the unconverted-currencies footnote move with `stat-won-month` (footnote renders inside that widget's description slot only when `unconverted.count > 0`).
- `pipeline-donut-widget.tsx` keeps the pipeline `Select` (as the `action` prop) and the `dashboard.pipelineStages` secondary query exactly as `sales-dashboard.tsx` has it today, INCLUDING the fix: every stage `Link` href must carry `&pipeline=<chartPipeline.pipelineId>` — verify the current template only appends it conditionally and keep that conditional (null pipelineId appends nothing); ALSO apply the ride-along: check `dashboard.pipelineStages`'s links work when a non-default pipeline is selected by asserting the built href in a small unit test of a pure `stageHref(workspaceUrl, slice, pipelineId)` helper extracted into the widget file.
- `deals-open-widget.tsx`, `tasks-overdue-widget.tsx`, `activity-widget.tsx` take the three cards from `dashboard-summary.tsx` verbatim (including the `activities.complete` mutation with `cache.activity()` invalidation), each wrapped in `WidgetShell` instead of raw `Card`.
- `profit-widgets.tsx`: `profit-by-month` renders `reports.byMonth` rows for the workspace's reporting currency (pick the currency with the most non-zero rows; render a per-month bar list using existing chart components from `@/components/dashboard-charts` if a bar variant exists, else the `AreaTrend` with `profitCents`); `costs-by-category` renders `reports.byCategory({})` rows as the label + meter + amount rows pattern already used in `dashboard-summary.tsx`'s `ValueMeter`. Both use `formatMoneyCompact`. Per-currency is never summed (`docs/currency.md` rule — read it before this file).
- `tasks-upcoming-widget.tsx`: `projects.upcomingTasks` rows as a `SimpleTable` (Task, Crew, When) with `RecordLink` to the deal and a link to `/projects/[id]`; `LocalRelativeTime` is wrong here (future dates) — render the day with the existing local-date component in `@/components/local-date-time` (pick the plain date export).
- Every widget component's root is `WidgetShell` with an error boundary: wrap each widget's body in the module-level `WidgetBoundary` (a small class or `react-error-boundary`-style component implemented once in `summary-context.tsx` using React's `Component` with `componentDidCatch` — no new dependency) rendering `WidgetError` with a retry that calls the widget's query `refetch` (for context-fed widgets, retry re-runs the summary query via a `refetchSummary` exposed on the context).

`dashboard-summary.tsx` interim state for this task: render `SummaryProvider` + the DEFAULT_LAYOUT order as today's static arrangement (a plain grid of the widget components in existing rows — the canvas replaces this in Task 6). The page must compile and render identically to production at the end of this task.

- [ ] **Step 1: Write the failing tests** — `apps/app/lib/dashboard/widget-registry.test.ts`:

```ts
import { expect, test } from "bun:test";
import { DASHBOARD_WIDGETS, visibleWidgets } from "./widget-registry";
import { DEFAULT_LAYOUT } from "./layout";

test("every default layout id exists in the registry", () => {
	const ids = new Set(DASHBOARD_WIDGETS.map((w) => w.id));
	for (const entry of DEFAULT_LAYOUT) expect(ids.has(entry.id)).toBe(true);
});

test("profit widgets are hidden without the permission", () => {
	const ids = visibleWidgets(DASHBOARD_WIDGETS, []).map((w) => w.id);
	expect(ids).not.toContain("profit-by-month");
	expect(ids).not.toContain("costs-by-category");
	expect(ids).toContain("trend");
});

test("profit widgets show with the permission", () => {
	const ids = visibleWidgets(DASHBOARD_WIDGETS, ["profit.view"]).map((w) => w.id);
	expect(ids).toContain("profit-by-month");
});
```

`visibleWidgets(widgets, keys)` is the pure half; `useVisibleWidgets` wraps it with the query. Registry metadata must be importable without rendering (bun test has no DOM): keep `DASHBOARD_WIDGETS` in `widget-registry.tsx` importing components, and if bun test chokes on any transitive client import, split metadata into `widget-registry-meta.ts` (pure) + a components map in the `.tsx`, and test the meta module.

- [ ] **Step 2: Run tests to verify they fail**, then extract all widget files per the rules above.
- [ ] **Step 3: Run tests to verify they pass** — `cd apps/app && bun test lib/dashboard`
- [ ] **Step 4: Typecheck + visual check** — `bun run check-types`; start dev servers (api `PORT=3113`, app `-p 3112`), dev-login, confirm the overview renders identical to before.
- [ ] **Step 5: Commit**

```bash
git add apps/app/components/dashboard apps/app/lib/dashboard "apps/app/app/(app)/[slug]"
git commit -m "feat: extract the dashboard into registry widgets"
```

### Task 6: The canvas

**Files:**
- Modify: `apps/app/package.json` (add `react-grid-layout": "^2.2.4"`; run `bun add react-grid-layout@^2.2.4` FROM `apps/app` — verify cwd first, a peer session once bun-added into the wrong package)
- Create: `apps/app/components/dashboard/dashboard-canvas.tsx`
- Modify: `apps/app/app/(app)/[slug]/dashboard-summary.tsx`

**Interfaces:**
- Consumes: `resolveLayout`/`DASHBOARD`/`DashboardLayoutEntry` (Task 2), registry (Task 5), `WidgetShell` handle class `janus-widget-drag` (Task 4).
- Produces: `DashboardCanvas` client component:

```tsx
export function DashboardCanvas(props: {
	layout: DashboardLayoutEntry[];
	widgets: (WidgetMeta & { component: ComponentType })[];
	editing: boolean;
	onLayoutChange: (layout: DashboardLayoutEntry[]) => void;
});
```

Implementation notes:
- Import `GridLayout` (v2 exports; read `apps/app/node_modules/react-grid-layout/README.md` after install — v2 API changed from v1: check the exact export names and the `WidthProvider` equivalent before writing code; do not code from v1 memory).
- Props mapping: `cols={DASHBOARD.grid.cols}`, `rowHeight={DASHBOARD.grid.rowHeightPx}`, `margin={[10, 10]}`, `compactType="vertical"`, `preventCollision={false}`, `isDraggable={editing}`, `isResizable={editing}`, `draggableHandle=".janus-widget-drag"`, `resizeHandles={["se"]}`.
- Layout conversion: registry `minW`/`minH` go onto each RGL layout item; convert RGL's `{i, x, y, w, h}` back to `{id, x, y, w, h}` in `onLayoutChange`.
- RGL's structural CSS: import `react-grid-layout/css/styles.css` and `react-resizable/css/styles.css` (or the v2 equivalents named in its README) once in `dashboard-canvas.tsx`. Restyle the placeholder via a scoped selector in the same file's module or a `globals.css` addition in `packages/ui` styles (`.react-grid-placeholder` → `background: var(--secondary); border: 1px dashed var(--ring); border-radius: 8px; opacity: 1`).
- Mobile: the canvas renders only at `sm` and up (`hidden sm:block`); a sibling `sm:hidden flex flex-col gap-4` list renders the widgets in layout order (`sort by y then x`), static.
- SSR: RGL measures the container — render the canvas inside a client component and guard the first paint by measuring with the v2-recommended width mechanism; if hydration warnings appear, mount the grid after `useEffect` sets `ready` and render the static mobile-style list until then.

`dashboard-summary.tsx`: replace the interim static arrangement with `DashboardCanvas` fed by `resolveLayout(view.data?.dashboardLayout, visible)` where `view = useQuery(trpc.views.get.queryOptions({ tableId: "dashboard" }))`, `editing` still hardcoded `false` (Task 7 adds the mode). Add the prefetch in `apps/app/app/(app)/[slug]/layout.tsx` beside the existing `views.get {tableId: "nav"}` prefetch: `queryClient.prefetchQuery(trpc.views.get.queryOptions({ tableId: "dashboard" }))`.

- [ ] **Step 1: Install the dep** (`cd apps/app` — verify with `pwd` — then `bun add react-grid-layout@^2.2.4`). If TypeScript lacks bundled types, `bun add -d @types/react-grid-layout` only if v2 does not ship its own (check the package's `types` field first).
- [ ] **Step 2: Implement** `DashboardCanvas` + wire into `dashboard-summary.tsx` + layout prefetch.
- [ ] **Step 3: Verify live** — dev servers up, overview renders the default layout identical to Task 5's static version; no console errors; drag does nothing (editing false).
- [ ] **Step 4: Typecheck** — `bun run check-types`. Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add apps/app/package.json bun.lock apps/app/components/dashboard/dashboard-canvas.tsx "apps/app/app/(app)/[slug]" packages/ui/src/styles
git commit -m "feat: render the dashboard on a grid canvas"
```

### Task 7: Edit mode, add/remove/reset, save on Done

**Files:**
- Create: `apps/app/components/dashboard/customise-controls.tsx`
- Modify: `apps/app/app/(app)/[slug]/dashboard-summary.tsx`, `apps/app/app/(app)/[slug]/page.tsx` (only if the Customise button must sit beside the existing scope toggle rendered there — read `page.tsx` and `overview-scope.tsx` first and put the button in the same header row)

**Interfaces:**
- Consumes: `addEntry` (Task 2), `views.save` / `views.reset` mutations, `useVisibleWidgets` (Task 5).
- Produces: state machine inside `dashboard-summary.tsx`:
  - `draft: DashboardLayoutEntry[] | null` — null = viewing (render saved/resolved layout); non-null = editing (render draft).
  - Customise → `setDraft(resolved)`. Cancel → `setDraft(null)`. Done → `views.save({ tableId: "dashboard", state: { dashboardLayout: draft } })` with `onSuccess`: invalidate the `views.get {tableId:"dashboard"}` query via `queryClient.invalidateQueries(trpc.views.get.queryOptions({ tableId: "dashboard" }))` pattern already used for views (check how `app-icon-rail.tsx` handles pending state and copy its optimistic `pending ?? saved` approach), toast "Layout saved" via `sonner`'s `toast.success`, `setDraft(null)`; `onError`: `toast.error(error.message)`, stay in edit mode.
  - Reset (edit-mode button) → `setDraft(DEFAULT_LAYOUT filtered to visible ids)` — reset SAVES only when Done is clicked; it edits the draft.
  - Remove → filter the entry out of the draft. Add → `setDraft(addEntry(draft, meta))`.
  - `CustomiseControls` renders the edit bar: Add-widget `Popover` (existing popover component from `@crm/ui`) listing `visible` widgets not in the draft with title + description + Add button and the empty state "Every widget is on the dashboard."; Reset; spacer; Cancel (ghost); Done (primary, disabled while `views.save` is pending).
- The view state must not clobber other dashboard-tableId fields: build the save payload as `{ ...view.data, dashboardLayout: draft }` — `view.data` is already a parsed `ViewState`.

- [ ] **Step 1: Implement** the mode + controls. The scope toggle keeps working in both modes.
- [ ] **Step 2: Manual live pass** — customise, drag, resize, remove, add, cancel restores, done persists across reload, reset returns default, second user (`/api/dev-login?email=member@example.com`) still sees the default and lacks profit widgets (grant checks happen in Task 8's walkthrough too).
- [ ] **Step 3: Typecheck + app tests** — `bun run check-types && cd apps/app && bun test lib`
- [ ] **Step 4: Commit**

```bash
git add apps/app/components/dashboard "apps/app/app/(app)/[slug]"
git commit -m "feat: customise the dashboard in an edit mode"
```

### Task 8: Playwright walkthrough + gates

**Files:**
- Create: walkthrough driver under `.superpowers/` in this worktree (throwaway, NOT committed) following the repo's prior walkthrough scripts (find one under a peer phase's `.superpowers/` or write fresh: NODE-launched, `chromium.launch`, dev-login cookie via `/api/dev-login?email=...` navigation)

- [ ] **Step 1: Full test matrix**

Run, each from its package dir: `bun run check-types` (root, 14 projects), `cd packages/db && bun test`, `cd apps/app && bun test lib`, `cd apps/api && bun test test/projects-upcoming.integration.spec.ts test/views.spec.ts test/dashboard-stages.integration.spec.ts` (plus the full api suite once; pre-existing failures are only acceptable if they reproduce on foundation@d9ef20c — evidence them by stashing nothing and running `git stash` NEVER, instead run the same test on the main checkout ONLY IF a peer confirms it is idle, else cite the memory's known-red list).
Expected: green except evidenced pre-existing.

- [ ] **Step 2: Walkthrough** (ports 3112/3113, NODE Playwright):
1. dev-login owner → overview shows default layout.
2. Customise → drag `trend` below `activity` → widgets compact.
3. Resize `pipeline-donut` wider → no overlap.
4. Remove `stat-win-rate`; Add `profit-by-month` from the popover.
5. Done → toast; reload → layout persists.
6. Donut stage row link → `/deals?stage=...&pipeline=...` keeps the pipeline param when a non-default pipeline is selected.
7. Second user dev-login → default layout, no profit widgets in canvas or popover (revoke/grant via Settings › Members toggle if needed to set the fixture).
8. Reset → default; Done; reload confirms.
9. Viewport 400px → single-column stack, no horizontal scroll.
10. Kill both dev servers.

- [ ] **Step 3: Fix what the walkthrough finds**, re-run the affected step, commit fixes individually (`fix: <what>`).
- [ ] **Step 4: Final commit + hand off** — push nothing; report merge-ready with the branch head sha to kyle-cc's train (SendMessage), listing: migrations NONE, new dep react-grid-layout, files touched in packages/db + packages/ui (merge-seam watch: `apps/app/lib/trpc/cache.ts` untouched here but phase-l adds a `photos` entry — no conflict expected).

## Self-review notes

- Spec coverage: catalogue (T2/T5), grid+engine (T6), edit mode + add/remove/reset (T7), persistence + strip-guard (T1), prefetch (T6), permission gating (T5/T7/T8), mobile (T6/T8), error states (T4/T5), donut ride-along (T5/T8), upcoming query (T3), no migrations (global), tests (T1-T3, T5, T8).
- Types consistent: `DashboardLayoutEntry` defined once in `@crm/db/user-views`, consumed by Tasks 2/6/7; `WidgetMeta` defined in Task 2, extended with `component` in Task 5; handle class `janus-widget-drag` defined Task 4, consumed Task 6.
- Known open (carried to review, not blockers): RGL v2 exact API names must be read from the installed README (Task 6 step explicitly requires it); profit-by-month chart variant depends on what `dashboard-charts` exports (bar fallback specified).
