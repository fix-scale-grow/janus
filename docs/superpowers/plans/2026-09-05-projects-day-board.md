# Projects Day-Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Projects subsystem — a `Project` per deal holding `ProjectTask` rows scheduled onto days, rendered as a day-column board with drag-to-reschedule, status cycling, and a goal date, surfaced from the deal sheet and estimate/invoice pages.

**Architecture:** Two Prisma models (`Project`, `ProjectTask`) and one `projects` tRPC module in `apps/api/src/projects/`. All intelligence-free (no agent hooks in v1). The board is new app code in `apps/app/app/(app)/[slug]/projects/` reusing the board conventions from commit `2305147` (`usePanScroll`, contained PageShell, dnd-kit at 8px activation, `data-board-drag`).

**Tech Stack:** Prisma, nestjs-trpc, Next.js App Router, `@dnd-kit/core`, Bun test.

**Spec:** `docs/superpowers/specs/2026-09-05-projects-day-board-design.md`

## Global Constraints

- **Never add code comments. No `Co-Authored-By` trailer on any commit.** Commit style `feat:`/`fix:`/`docs:`.
- **Intelligence never lives in the API** — v1 has no agent features at all.
- Single tenant: no `organizationId` anywhere.
- tRPC pattern: `*.contracts.ts` (zod) / `*.router.ts` (thin, `@Router({ alias: "projects" })` + `@UseMiddlewares(AuthMiddleware)` ) / `*.service.ts` (Prisma, `HttpException` family). Lists take `listInput`, return `{ rows, total, facetCounts }`. Template: `apps/api/src/estimates/`.
- **`apps/api/src/generated/server.ts` is committed; regenerate only via `bun run check-types` (from `apps/api`) and commit it with the router task.**
- Client/server split: pages compute, client components render; never import `@crm/db`/`@crm/auth` from a `"use client"` file.
- UI from `packages/ui` shared shadcn components only; no className style overrides; radii from the scale.
- Every mutation invalidates via `useCrmCache()` — the `project` helper added in Task 4; no ad-hoc key lists.
- Constants in `apps/api/src/projects/projects.config.ts` (`MAX_TASKS_PER_PROJECT = 500`) and `apps/app/app/(app)/[slug]/projects/[id]/board-config.ts` (`MAX_DAY_COLUMNS = 90`).
- Tabs + biome. Run `bunx biome check --write <touched files>` and `bun run check-types` (in the touched app) before each commit. If root `bun run format` is ever run: `git restore design/` before committing.
- **Databases:** the shared local dev DB (`crm`) must NOT receive this migration yet (coordinated with the Phase B.2 session at merge time). Task 1 creates and uses a private database `janus_projects_dev`; the worktree `.env` `DATABASE_URL` is switched to it.
- Tests: `apps/api/test/*.spec.ts`, bun test via `cd apps/api && bun run test`; integration specs need `TEST_DATABASE_URL` (name must end `_test`); a test may not delete a row it did not create; fixtures namespaced with a `TEST_RUN_ID`-style suffix.
- Report issues in the ASD-STE100 `## Issues` list format.
- Dev servers for this worktree: app :3100, api :3101 (never :3000/:3001 — they belong to the other session).

---

### Task 1: Prisma models + private dev database

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (models after the Invoice block; enums beside the other enums; add `projects Project[]` to `model Deal`, `createdProjects Project[] @relation("ProjectCreator")` and `projectTasks ProjectTask[] @relation("ProjectTaskAssignee")` to `model User`)
- Migration: `packages/db/prisma/migrations/<stamp>_add_projects/`
- Modify: worktree `.env` (`DATABASE_URL` → `janus_projects_dev`)

**Interfaces:**
- Produces: Prisma models `Project`, `ProjectTask`, enums `ProjectStatus { ACTIVE ON_HOLD COMPLETE }`, `ProjectTaskStatus { TODO IN_PROGRESS DONE }` via `@crm/db` — consumed by Task 2's service.

- [ ] **Step 1: Add the schema exactly as written in the spec** (`docs/superpowers/specs/2026-09-05-projects-day-board-design.md` § Data model), plus the three back-relations listed above.

- [ ] **Step 2: Create the private database and generate the migration**

```bash
psql -U postgres -h localhost -c 'CREATE DATABASE janus_projects_dev;'
```

Edit worktree `.env`: `DATABASE_URL="postgresql://postgres:postgres@localhost:5432/janus_projects_dev?schema=public"`. Then from `packages/db`:

```bash
bunx prisma migrate dev --name add_projects
```

This applies ALL migrations (the existing chain plus the new one) to the empty private DB and regenerates the client. Verify a folder `<stamp>_add_projects` exists with SQL creating `project` and `project_task`.

- [ ] **Step 3: Typecheck** — `cd apps/api && bun run check-types` passes (regenerates `server.ts`; expect no diff yet).

- [ ] **Step 4: Commit** — `feat: add project and project task models` (schema + migration; NOT `.env`).

---

### Task 2: `projects` tRPC module + contract tests

**Files:**
- Create: `apps/api/src/projects/projects.config.ts`, `projects.contracts.ts`, `projects.service.ts`, `projects.router.ts`, `projects.module.ts`
- Modify: `apps/api/src/app.module.ts` (import + register `ProjectsModule` beside the CRM cluster)
- Modify (regenerated): `apps/api/src/generated/server.ts`
- Test: `apps/api/test/projects.contracts.spec.ts`

**Interfaces:**
- Consumes: Task 1 models via `@crm/db`.
- Produces procedures under alias `projects`: `list(projectListInput)`, `byId({id})`, `create(projectCreateInput)`, `update(projectUpdateInput)`, `remove({id})`, `taskCreate(taskCreateInput)`, `taskUpdate(taskUpdateInput)`, `taskMove(taskMoveInput)`, `taskRemove({id})`.

- [ ] **Step 1: Write `projects.config.ts` and `projects.contracts.ts`**

```ts
export const PROJECTS = {
	task: { max: 500, nameMax: 200, noteMax: 2000 },
	project: { nameMax: 200, goalMax: 500 },
} as const;
```

```ts
import { ProjectStatus, ProjectTaskStatus } from "@crm/db";
import { z } from "zod";
import { listInput } from "../trpc/list-input";
import { PROJECTS } from "./projects.config";

export function toDay(value: Date): Date {
	return new Date(
		Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
	);
}

const dayInput = z.coerce.date().transform(toDay);

const statusEnum = z.enum(
	Object.values(ProjectStatus) as [ProjectStatus, ...ProjectStatus[]],
);
const taskStatusEnum = z.enum(
	Object.values(ProjectTaskStatus) as [ProjectTaskStatus, ...ProjectTaskStatus[]],
);

export const projectListInput = listInput.extend({
	dealId: z.string().optional(),
	status: statusEnum.optional(),
});
export const projectIdInput = z.object({ id: z.string().min(1) });
export const projectCreateInput = z.object({
	dealId: z.string().min(1),
	name: z.string().trim().min(1).max(PROJECTS.project.nameMax),
	goal: z.string().trim().max(PROJECTS.project.goalMax).optional(),
	startDate: dayInput,
	goalDate: dayInput.optional(),
});
export const projectUpdateInput = z.object({
	id: z.string().min(1),
	name: z.string().trim().min(1).max(PROJECTS.project.nameMax).optional(),
	goal: z.string().trim().max(PROJECTS.project.goalMax).nullable().optional(),
	status: statusEnum.optional(),
	startDate: dayInput.optional(),
	goalDate: dayInput.nullable().optional(),
});
export const taskCreateInput = z.object({
	projectId: z.string().min(1),
	name: z.string().trim().min(1).max(PROJECTS.task.nameMax),
	day: dayInput.nullable().optional(),
	assigneeId: z.string().optional(),
	note: z.string().trim().max(PROJECTS.task.noteMax).optional(),
});
export const taskUpdateInput = z.object({
	id: z.string().min(1),
	name: z.string().trim().min(1).max(PROJECTS.task.nameMax).optional(),
	note: z.string().trim().max(PROJECTS.task.noteMax).nullable().optional(),
	status: taskStatusEnum.optional(),
	assigneeId: z.string().nullable().optional(),
});
export const taskMoveInput = z.object({
	id: z.string().min(1),
	day: dayInput.nullable(),
	sortOrder: z.number().int().min(0),
});
```

Export `z.infer` type aliases for each input, matching the estimates contracts style.

- [ ] **Step 2: Write the failing contract tests** (`apps/api/test/projects.contracts.spec.ts`): `toDay` maps `2026-09-05T14:30:00Z` to `2026-09-05T00:00:00.000Z`; `projectCreateInput` rejects `{}` and a 201-char name; `taskMoveInput` accepts `day: null` and rejects `sortOrder: -1`; `taskUpdateInput` accepts `note: null`. Run: `cd apps/api && bun test test/projects.contracts.spec.ts` — FAIL (module missing) before Step 1 lands, PASS after.

- [ ] **Step 3: Write `projects.service.ts`**

Constructor `(@InjectDatabase() private readonly db: Db)`. Follow `estimates.service.ts` for structure, `SORTABLE` map (`name`, `status`, `goalDate`, `updatedAt` → fallback `updatedAt desc`), `paginate`/`resolveOrderBy`, and the `translate` P2025 → `NotFoundException` helper.

- `list`: where from `{ dealId, status, q: { name: { contains: q, mode: "insensitive" } } }`; select `id, name, status, startDate, goalDate, updatedAt, deal { id, name, company { id, name } }, tasks { status }`; map rows to replace `tasks` with `taskCounts: { total, done }`; return `{ rows, total, facetCounts: {} }`.
- `byId`: project + `tasks` ordered `[{ day: "asc" }, { sortOrder: "asc" }]` each with `assignee { id, name, image }`, and `deal { id, name, company { id, name } }`; `NotFoundException` when missing.
- `create(input, userId)`: verify the deal exists (`NotFoundException` otherwise); create with `createdById: userId`.
- `update`, `remove`: straight Prisma with `translate`.
- `taskCreate`: transaction — count tasks (`BadRequestException` at `PROJECTS.task.max`), compute `sortOrder` = max sibling of that `day` + 1, create.
- `taskUpdate`, `taskRemove`: straight with `translate`.
- `taskMove`: transaction — load the task (`NotFoundException`); fetch target-day siblings ordered by `sortOrder` (excluding the moved id); splice the moved id at `input.sortOrder` (clamped to length); write `day` + new sequential `sortOrder` for the moved row and any sibling whose index changed.

- [ ] **Step 4: Write `projects.router.ts` + `projects.module.ts`, register in `app.module.ts`** — router copies the estimates decorator shape; `create` takes `@Ctx() ctx: AuthedTrpcContext` and passes `ctx.user.id`. Module: `@Module({ providers: [ProjectsService, ProjectsRouter], exports: [ProjectsService] })`.

- [ ] **Step 5: Regenerate + verify** — `cd apps/api && bun run check-types` (commits new `server.ts`), `bun test test/projects.contracts.spec.ts` PASS, `bunx biome check --write src/projects test/projects.contracts.spec.ts`.

- [ ] **Step 6: Commit** — `feat: add projects trpc module`.

---

### Task 3: Service integration tests

**Files:**
- Test: `apps/api/test/projects.integration.spec.ts`

**Interfaces:**
- Consumes: Task 2 `ProjectsService` (constructed directly with `db` from `@crm/db`, like `tracking-filing.integration.spec.ts`).

- [ ] **Step 1: Ensure the test database** — `bun run db:test` (creates/migrates `TEST_DATABASE_URL`; name ends `_test`; never `DATABASE_URL`).

- [ ] **Step 2: Write the spec** — `const suffix = process.env.TEST_RUN_ID ?? "projects-spec";` fixtures: one user, one company, one deal (all suffixed) created in `beforeAll`, deleted (children first) in `afterAll`; the deal-cascade assertion uses a second, separate deal. Cases:
  1. `create` → `byId` returns it with empty `tasks`.
  2. `taskCreate` ×3 on one day → `sortOrder` 0,1,2.
  3. `taskMove` task[2] to `sortOrder: 0` same day → order becomes [2,0,1]; move task[0] to `day: null` → unscheduled, remaining resequenced 0,1.
  4. `list({ dealId })` → `taskCounts` `{ total: 3, done: 0 }`, then one `taskUpdate` to `DONE` → `{ total: 3, done: 1 }`.
  5. Deleting the second deal via `db.deal.delete` cascades its project and tasks (counts go to zero).
  6. `taskCreate` beyond `PROJECTS.task.max` — covered by unit-testing the guard with a stubbed count if seeding 500 rows is slow; otherwise skip seeding and assert the guard via 500 real rows only if fast.

Run: `cd apps/api && bun test test/projects.integration.spec.ts` — PASS.

- [ ] **Step 3: Commit** — `feat: add projects service integration tests`.

---

### Task 4: Cache helper, nav, projects list page

**Files:**
- Modify: `apps/app/lib/trpc/cache.ts` (type line + `project` entry mirroring `drawing`: record key `trpc.projects.byId.queryKey({ id })`, rest `trpc.projects.list.queryKey()`)
- Modify: `apps/app/lib/janus-nav.ts` — `{ title: "Projects", href: "/projects", match: "prefix", status: "live", icon: EventSchedule, source: "app/(app)/projects" }` with `import EventSchedule from "@carbon/icons-react/es/EventSchedule";` (insert after the Production entry)
- Create: `apps/app/app/(app)/[slug]/projects/page.tsx`, `projects-search-params.ts`, `projects-table.tsx`

**Interfaces:**
- Consumes: `projects.list` from Task 2.
- Produces: `cache.project(id?)` used by Tasks 5–6; route `/projects`.

- [ ] **Step 1: cache + nav edits** as above.

- [ ] **Step 2: Search params** — copy the estimates shape:

```ts
import { createListSearchParams } from "@/components/data-table/list-search-params";
export type ProjectStatusFilter = "all" | "ACTIVE" | "ON_HOLD" | "COMPLETE";
export const projectsSearchParams = createListSearchParams({
	defaultSort: "updatedAt", defaultDir: "desc", tabId: "status",
});
```

- [ ] **Step 3: `page.tsx`** — mirror `estimates/page.tsx` verbatim structure (`PageShell className="min-h-0"`, `requireSession`, prefetch `trpc.projects.list.queryOptions({ ...input, status: status === "all" ? undefined : status })`, `HydrateClient`). Title "Projects", description "Every job site, organised by days, pointed at a goal.". No create button (creation lives on the deal, Task 6).

- [ ] **Step 4: `projects-table.tsx`** — mirror `estimates-table.tsx`: columns Name, Deal (`row.deal.name`), Company (`CompanyCell`-style plain text of `row.deal.company?.name`), Progress (`{done}/{total}` tabular-nums), Goal (`LocalDay` of `goalDate`, `—` when null), Updated. Status tabs `[ACTIVE "Active", ON_HOLD "On hold", COMPLETE "Complete"]`, `allLabel: "All projects"`. Row click → `router.push(workspaceUrl(\`/projects/${row.id}\`))`. Empty: "No projects yet. Start one from a deal.".

- [ ] **Step 5: Verify** — `cd apps/app && bun run check-types`; visit `http://localhost:3100/projects` (dev servers per Global Constraints) renders the empty list.

- [ ] **Step 6: Commit** — `feat: add projects list and navigation`.

---

### Task 5: The day board

**Files:**
- Create: `apps/app/app/(app)/[slug]/projects/[id]/page.tsx`, `board-config.ts`, `day-range.ts`, `project-board.tsx`, `project-header.tsx`, `task-card.tsx`, `add-task-input.tsx`
- Test: `apps/app/test/day-range.spec.ts`

**Interfaces:**
- Consumes: `projects.byId`, `taskCreate`, `taskUpdate`, `taskMove`, `update`, `remove`, `cache.project`.
- Produces: route `/projects/[id]`.

- [ ] **Step 1: `board-config.ts` + `day-range.ts` with unit tests first**

```ts
export const BOARD = { maxDayColumns: 90 } as const;
```

```ts
const DAY_MS = 86_400_000;

export function addDays(day: Date, count: number): Date {
	return new Date(day.getTime() + count * DAY_MS);
}

export function dayKey(day: Date | null): string {
	return day ? day.toISOString().slice(0, 10) : "unscheduled";
}

export function dayRange(options: {
	startDate: Date;
	goalDate: Date | null;
	taskDays: Date[];
	today: Date;
	max: number;
}): Date[]
```

`dayRange` returns UTC-midnight days from `startDate` through `end = max(goalDate ?? startDate, today, latest taskDay)`, truncated to `max` days from `startDate`; any task day outside the truncated window is appended (deduplicated, sorted) so no scheduled task is ever invisible. Tests (`apps/app/test/day-range.spec.ts`, bun test): plain start→goal span inclusive of both ends; today extends past goal; 200-day goal truncates to 90 but a task on day 150 still appears; `taskDays` empty and `goalDate` null yields start→today.

- [ ] **Step 2: `page.tsx`** — server component: `requireSession`, `queryClient.prefetchQuery(trpc.projects.byId.queryOptions({ id }))` (id from `params`), `prefetchQuery(trpc.users.list.queryOptions())` for the assignee picker, `PageShell className="min-h-0" contained`, header + `<ProjectBoard id={id} />` inside `HydrateClient`.

- [ ] **Step 3: `project-board.tsx`** — client. `useQuery(trpc.projects.byId.queryOptions({ id }))`. Columns: `[null, ...dayRange(...)]` where `null` renders "Unscheduled". Group tasks by `dayKey`. Board row copies the deal-board classes plus `usePanScroll`; columns `w-72 min-h-0 shrink-0 flex-col`, bodies `overflow-y-auto`; on mount scroll today's column into view (`ref.scrollIntoView({ inline: "center" })` guarded to run once). DndContext at 8px activation; droppable id = `dayKey`, draggable id = task id with `data: { fromKey }`; drop parses the key back to a `Date | null` and calls `taskMove` with `sortOrder` = target column length (append) — optimistic via `onMutate` writing the moved task into the `projects.byId` cache (single-record equivalent of the deal board's `moveRowStage`), rollback + toast on error, `cache.project(id)` on settled. Day header: `<LocalDay>` weekday+date, `done/total` badge, all-done days tint the header dot with the primary token, "Today" text marker, goal column gets an accent border and "Goal" flag row.
- [ ] **Step 4: `task-card.tsx`** — wrapper div with dnd listeners + `data-board-drag` + grab cursors (copy `DraggableDealCard`). Body: name; status `Badge` as a button cycling `TODO → IN_PROGRESS → DONE → TODO` via `taskUpdate` (optimistic, stops propagation); assignee initial-avatar when set; a `Popover` (open via a card click that is not the status chip) with rename `Input`, note `Textarea`, assignee `Select` from `trpc.users.list`, and a destructive-variant remove button calling `taskRemove`.
- [ ] **Step 5: `add-task-input.tsx`** — quiet footer `Input` per column, Enter → `taskCreate({ projectId, name, day })`, clears on success, `cache.project(id)`.
- [ ] **Step 6: `project-header.tsx`** — name (inline-editable via `update`), deal + company linking to `workspaceUrl(\`/deals\`)` record-open pattern used by the boards (`useOpenRecord({ kind: "deal", id })`), status `Select` (Active / On hold / Complete), goal text, countdown (`Math.ceil((goalDate - todayUtc) / DAY_MS)` → "12 days to goal" / "Goal passed"), progress `done/total`, and a delete `AlertDialog` routing back to `/projects`.
- [ ] **Step 7: Verify** — `bun test test/day-range.spec.ts` PASS; `bun run check-types`; manual pass on :3100 (create via API or Task 6 dialog if landed): add tasks, drag across days, cycle statuses.
- [ ] **Step 8: Commit** — `feat: add the project day board`.

---

### Task 6: Start project — deal sheet, estimate and invoice links

**Files:**
- Create: `apps/app/components/projects/start-project-dialog.tsx`, `apps/app/components/projects/deal-projects.tsx`
- Modify: the deal record sheet (`apps/app/components/crm/record-sheet/deal-sheet.tsx` — locate the tab strip where the Drawings/Estimates tabs were added in Phases A–B and add a "Projects" tab rendering `DealProjects`)
- Modify: the estimate detail page (`apps/app/app/(app)/[slug]/estimates/[id]/`) and invoice detail surface (locate via `rg -l "invoice" apps/app/app/(app)/[slug]` — whichever detail view Phase B.2 landed; if absent in this branch, skip the invoice link and record it in Issues) — add a "Project" line in their deal strip: link to the deal's newest `ACTIVE` project (`projects.list({ dealId, status: "ACTIVE", pageSize: 1, sort: "updatedAt", dir: "desc" })`) or the Start-project dialog trigger when none.

**Interfaces:**
- Consumes: `projects.create`, `projects.list`, `cache.project`, Task 5 route.
- Produces: `StartProjectDialog({ dealId, dealName, expectedCloseDate, trigger })`, `DealProjects({ dealId })`.

- [ ] **Step 1: `start-project-dialog.tsx`** — `Dialog` with name (default `dealName`), start `DatePicker` (default today), goal `DatePicker` (default `expectedCloseDate` when present), goal `Textarea` (optional). Submit → `projects.create`, `cache.project()`, close, `router.push(workspaceUrl(\`/projects/${created.id}\`))`.
- [ ] **Step 2: `deal-projects.tsx`** — `SimpleTable` of `projects.list({ dealId })`: name, progress, goal date, status; row click navigates to the board; header row hosts the dialog trigger (`Button size="sm"` "Start project").
- [ ] **Step 3: Wire the deal-sheet tab, estimate link, invoice link** (per Files above).
- [ ] **Step 4: Verify** — `bun run check-types`; on :3100 open a deal → Projects tab → Start project → lands on the board; estimate page shows the Project link.
- [ ] **Step 5: Commit** — `feat: start projects from deals, estimates and invoices`.

---

### Task 7: Playwright walkthrough

**Files:**
- Create: scratchpad script only (not committed) — the walkthrough is a verification gate, not a repo test.

- [ ] **Step 1:** With dev servers on :3100/:3101 against `janus_projects_dev` and a `dev:session` cookie: create a deal via the UI, Start project from its sheet, add three tasks, drag one to another day, cycle one to DONE, verify the day header count and progress strip, screenshot the board.
- [ ] **Step 2:** Fix anything the walkthrough surfaces; re-run until clean.
- [ ] **Step 3:** Final `bun run check-types` (both apps) + `cd apps/api && bun test test/projects.contracts.spec.ts test/projects.integration.spec.ts` + report the run in the session with the ASD-STE100 Issues list.
