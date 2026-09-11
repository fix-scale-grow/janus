# Custom Dashboard — Design

Date: 2026-09-11
Status: Kyle-approved (in chat, this date)
Origin: client feature request, relayed by Kyle 9/11 — "customise the dashboard,
drag-and-drop; resize, remove and add widgets."

## Summary

The overview dashboard becomes a canvas of widgets. Each user can drag widgets,
resize them freely, remove them, and add more from a catalogue. Layouts are
per-user, saved through the existing UserView system, with a Reset back to the
built-in default. Editing happens in an explicit edit mode; the normal view
stays clean and click-through.

## Decisions (Kyle rulings)

| Question | Ruling |
| --- | --- |
| Widget catalogue at launch | Everything: the 9 existing dashboard pieces, plus reports widgets (profit by month, costs by category), plus an upcoming-tasks/projects widget |
| Edit model | Edit-mode toggle ("Customise" → handles/resize/remove/add → Done saves, Cancel discards) |
| Resize granularity | Freeform pixels — implemented as a fine grid (48 cols × 8px rows) so resizing feels pixel-level |
| Overlap | Never. Widgets push each other out of the way; gaps compact upward |
| Defaults | Built-in default = today's dashboard arrangement. Per-user layouts on top. Reset button returns to default. No admin workspace default in v1 |
| Mobile | Below the `sm` breakpoint the dashboard renders as a plain stacked list in saved order; no drag on touch |

## Widget catalogue (12)

From the existing dashboard, extracted as-is:

1. `stat-won-month` — Closed won this month (stat card, delta vs last month)
2. `stat-open-pipeline` — Open pipeline (stat card)
3. `stat-win-rate` — Win rate, windowed (stat card)
4. `stat-avg-deal` — Average deal, windowed (stat card)
5. `trend` — Closed won vs. new pipeline area chart (6 months)
6. `pipeline-donut` — Open pipeline by stage, with pipeline picker
7. `deals-open` — Deals in progress table (largest open deals)
8. `tasks-overdue` — Overdue tasks table with complete-checkbox
9. `activity` — Recent activity table

New:

10. `profit-by-month` — profit per month (reports data; gated by `profit.view`)
11. `costs-by-category` — job costs by category (reports data; gated by `profit.view`)
12. `tasks-upcoming` — upcoming scheduled project tasks (projects data)

Widgets 10–12 are add-able from the catalogue but are NOT in the default
layout. The default layout is exactly today's dashboard.

Registry: `apps/app/lib/dashboard/widget-registry.ts`. Each entry:
`id`, `title`, `description`, `minW`/`minH`, `defaultW`/`defaultH`, optional
`permission` (currently only `profit.view`), and the widget component.
A user without the permission never sees the widget — not on the canvas, not
in the catalogue; a saved layout containing it renders without it.

## Architecture

### Grid engine

`react-grid-layout` (MIT), new dependency in `apps/app`. Configuration:
48 columns, 8px row height, vertical compaction, `preventCollision: false`
(push-away behaviour), no overlap. Drag only by the widget drag handle;
resize by the corner grip; both only in edit mode (`isDraggable`/`isResizable`
flip with mode).

The themed shell (widget chrome: drag handle, resize grip, remove button,
edit-mode affordances) is implemented in `packages/ui` as shared components
per the design rules. Widget content components live in `apps/app` (they use
tRPC). react-grid-layout's structural CSS is imported once; visual styling
comes from our tokens only.

### Page structure

`dashboard-summary.tsx` becomes the canvas host:

- Loads the saved layout (prefetched in the `[slug]` layout alongside the
  existing views.get prefetch — no flicker).
- Renders `<DashboardCanvas layout={...} editing={...}>` mapping layout
  entries → registry components.
- Page-level controls stay above the canvas: the existing scope toggle
  (me/workspace) feeds every widget; "Customise" enters edit mode.
- Edit mode header: Add widget (popover listing catalogue entries not on the
  canvas, permission-filtered), Reset layout, Cancel, Done.
- Below `sm`: saved order, single column, static.

Each widget owns its data via the existing lean queries
(`dashboard.summary` slices, `dashboard.pipelineStages`, reports queries,
projects/tasks query). `dashboard.summary` stays one query shared through a
context by the widgets that consume its slices — widgets do not each refetch
the whole summary.

### Persistence

UserView machinery (`packages/db/src/user-views.ts`):

- Add `"dashboard"` to `VIEW_TABLE_IDS`.
- Add to `viewStateSchema` (it `.strip()`s unknown keys — the field MUST be
  declared or saves silently drop):

```ts
dashboardLayout: z
  .array(
    z.object({
      id: z.string().max(40),
      x: z.number().int().min(0).max(47),
      y: z.number().int().min(0),
      w: z.number().int().min(1).max(48),
      h: z.number().int().min(1),
    }),
  )
  .max(20)
  .optional(),
```

- Saved via `views.save` ONLY on Done (no auto-save churn; Cancel discards
  local state). Reset uses the existing `views.reset` path.
- Absent field or empty array ⇒ built-in default layout.
- Unknown widget ids in a saved layout are dropped at parse time in a pure
  helper (`apps/app/lib/dashboard/layout.ts`): merge saved ↔ registry,
  clamp to min sizes, fall back to default when nothing valid remains.
  This helper is the unit-test surface.
- Size: full 12-widget layout ≈ 1KB, under `VIEW_STATE_MAX_BYTES` (4096).

### API

No new modules expected. Reuse `dashboard` and `reports` routers; if the
reports/projects routers lack a lean shape a widget needs (checked during
planning), add a narrow query to the existing module following
`dashboard.pipelineStages` as the pattern. No schema migrations. Shared `crm`
DB untouched; private DBs `janus_dashboard_dev`/`janus_dashboard_test`.

### Ride-along fix

Phase-h deferred finding: the pipeline donut's stage deep-links drop the
`pipeline` query param. The donut widget keeps the param (already partially
addressed in `sales-dashboard.tsx`; verify both the slice links and the
donut centre behave, fix what remains).

## Error handling

- A widget whose query errors renders an inline error state inside its chrome
  (retry button); it never takes down the canvas.
- A saved layout that fails schema parse ⇒ default layout (parse failure is
  logged, not swallowed silently into a half-layout).
- Permission revoked between save and load ⇒ gated widgets drop from the
  canvas; remaining widgets compact.

## Testing

- Unit: layout merge/clamp/fallback helper; registry permission filtering;
  viewStateSchema round-trip for `dashboardLayout` (strip regression guard).
- API: only if a new lean query is added.
- Playwright walkthrough: default render → Customise → drag → resize →
  remove → add → Done → reload persists → second user sees default
  (isolation via dev-login) → Reset returns default → profit widgets hidden
  for a user without `profit.view` → mobile viewport stacks.

## Coordination

Worktree `.claude/worktrees/phase-m-dashboard`, branch
`janus/phase-m-dashboard` off foundation@d9ef20c. Ports 3112/3114 for
walkthroughs. No commits in the main checkout; merge via kyle-cc's train.
Known trivial future seam with phase-l-photos: `apps/app/lib/trpc/cache.ts`.

## Out of scope (v1)

- Admin-set workspace default layouts.
- New widget types beyond the 12 (photos, forms, agent feeds — after their
  subsystems land).
- Per-widget settings (e.g. trend window length).
- Multiple named dashboards / tabs.
