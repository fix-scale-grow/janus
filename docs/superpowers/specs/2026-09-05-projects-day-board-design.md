# Janus: Projects — Day-Board Job Management — Design Spec

**Date:** 2026-09-05
**Status:** Approved in brainstorming with Kyle; ready for implementation planning.
**Goal:** Give a job a schedule the crew can see and the owner can steer: a Monday-style board per project where the columns are days, tasks land on days, and the whole board points at a goal date. Organise a job site by days; mark work to-do, in progress, or done.

## Scope

One new subsystem: a `Project` attached to a deal, holding `ProjectTask` rows scheduled onto days, rendered as a horizontal day-column board that reuses the kanban board conventions shipped alongside this spec (viewport-filling layout, drag-to-pan via `usePanScroll`, dnd-kit card drag).

Out of scope for v1 (explicitly deferred by Kyle, 2026-09-05): seeding tasks from estimate line items, crew assignment beyond a single optional assignee picker, notifications, any agent involvement (auto-planning, task suggestions), recurring tasks, dependencies between tasks, and a cross-project calendar view. Each is a clean follow-up.

## Data model

Two tables; everything else is derived at render time.

```prisma
enum ProjectStatus {
  ACTIVE
  ON_HOLD
  COMPLETE
}

enum ProjectTaskStatus {
  TODO
  IN_PROGRESS
  DONE
}

model Project {
  id          String        @id @default(cuid())
  name        String
  goal        String?
  status      ProjectStatus @default(ACTIVE)
  startDate   DateTime
  goalDate    DateTime?
  dealId      String
  deal        Deal          @relation(fields: [dealId], references: [id], onDelete: Cascade)
  createdById String
  createdBy   User          @relation("ProjectCreator", fields: [createdById], references: [id])
  tasks       ProjectTask[]
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  @@index([dealId])
  @@index([status])
  @@index([updatedAt])
  @@map("project")
}

model ProjectTask {
  id         String            @id @default(cuid())
  projectId  String
  project    Project           @relation(fields: [projectId], references: [id], onDelete: Cascade)
  name       String
  note       String?
  day        DateTime?
  status     ProjectTaskStatus @default(TODO)
  sortOrder  Int               @default(0)
  assigneeId String?
  assignee   User?             @relation("ProjectTaskAssignee", fields: [assigneeId], references: [id], onDelete: SetNull)
  createdAt  DateTime          @default(now())
  updatedAt  DateTime          @updatedAt

  @@index([projectId, day])
  @@map("project_task")
}
```

Decisions carried by the model:

- **A day is a date on the task, not a table.** `day` is stored as a UTC date at midnight (`toDay()` normaliser in the contracts module). `day: null` means unscheduled. There is no Day entity to keep in sync.
- **Day state is derived.** A day column's header shows `done/total` for its tasks; a day with at least one task, all `DONE`, renders complete (green). Marking days complete falls out of marking tasks complete — no second source of truth.
- **The deal is the anchor.** `dealId` is required and cascades: through the deal, the project sheet reaches the client (company + contacts), estimates, and invoices without any extra foreign keys. Deleting a deal deletes its projects and tasks.
- **`goalDate` is nullable in the schema** but the create dialog always asks for it (pre-filled from the deal's `expectedCloseDate` when present). A project without a goal date renders no goal column and no countdown, nothing errors.
- Single tenant, no `organizationId`, consistent with every other CRM record.

## API — `projects` tRPC module

`apps/api/src/projects/{projects.contracts.ts,projects.router.ts,projects.service.ts,projects.module.ts}`, registered in `app.module.ts`; the standard module shape (`@Router({ alias: "projects" })`, `@UseMiddlewares(AuthMiddleware)`, thin router, Prisma in the service, `HttpException` family, P2025 translated to `NotFoundException`).

Procedures:

- `list` — `listInput + { dealId?, status? }` → `{ rows, total, facetCounts }`; rows carry `taskCounts { total, done }` (a `_count`-based aggregate) so the list can show progress without loading tasks. Sortable: `name`, `status`, `goalDate`, `updatedAt`.
- `byId` — project with all tasks (ordered `day asc, sortOrder asc`) and the deal's `{ id, name, companyId, company.name }` for the header.
- `create` — `{ dealId, name, goal?, startDate, goalDate? }` + `ctx.user.id` as creator.
- `update` — `{ id, name?, goal?, status?, startDate?, goalDate? }`.
- `remove` — `{ id }`; plain delete, cascade takes the tasks. No AgentTask/AgentEvent rows reference projects, so there is nothing extra to clear.
- `taskCreate` — `{ projectId, name, day?, assigneeId?, note? }`; appends `sortOrder` at the end of its day.
- `taskUpdate` — `{ id, name?, note?, status?, assigneeId? }`.
- `taskMove` — `{ id, day: Date | null, sortOrder }`; the drag-drop mutation, resequencing siblings in one transaction.
- `taskRemove` — `{ id }`.

All dates parse through a `toDay()` zod transform (UTC midnight) at the boundary. Task quantity caps: `MAX_TASKS_PER_PROJECT = 500` in `apps/api/src/projects/projects.config.ts`, enforced in `taskCreate`.

## UI

### Projects area

- Nav: `{ title: "Projects", href: "/projects", match: "prefix", status: "live", icon: EventSchedule (from `@carbon/icons-react/es/EventSchedule`), source: "app/(app)/projects" }` in `janus-nav.ts`.
- `/projects` — the standard list page (`page.tsx` + search params + `projects-table.tsx` DataTable): name, deal/company, progress (`done/total`), goal date, status tabs (All / Active / On hold / Complete).
- `/projects/[id]` — the day board.

### The day board

- **Layout is the kanban convention:** `contained` PageShell, board row `flex min-h-0 flex-1 cursor-grab gap-3 overflow-x-auto` with `usePanScroll` (`@/components/board/use-pan-scroll`), columns `w-72 min-h-0 shrink-0 flex-col` with `overflow-y-auto` bodies, dnd-kit `PointerSensor` at 8px activation, cards marked `data-board-drag`.
- **Columns:** "Unscheduled" first, then one column per day from `startDate` through `max(goalDate, latest task day, today)`, every day rendered including weekends, capped at 90 days (a longer range renders the capped window plus the columns holding tasks beyond it). The goal-date column is visually pinned as the terminus: accent border and a flag row ("Goal · Fri Sep 26"). On load the board auto-scrolls so today's column is in view.
- **Day header:** weekday + date, `done/total` count, fully-done days tint their header with the primary green; today's column carries a "Today" marker.
- **Cards:** task name, status chip, assignee avatar when set. Clicking the chip cycles `TODO → IN_PROGRESS → DONE → TODO` (optimistic, rollback on error, same pattern as the deal boards). Clicking the card body opens a small edit popover (rename, note, assignee, delete). Dragging a card to another day (or Unscheduled) runs `taskMove`.
- **Add:** a quiet "+ Add task" input at the foot of every column creates into that day.
- **Header strip:** project name, deal + company (links to the deal record), status control, goal text, goal countdown ("12 days to goal"), progress bar (`done/total`).

### Where projects surface

- **Deal record sheet:** a Projects tab (SimpleTable of the deal's projects) plus a **"Start project"** action — the create dialog with name pre-filled from the deal name, start = today, goal date pre-filled from `expectedCloseDate`.
- **Estimate and invoice pages:** already show their deal; each gets a "Project" link in its deal strip — to the deal's newest active project when one exists, otherwise the same "Start project" dialog for that deal. No new foreign keys; resolution is by `dealId` at render time.
- Cache: `cache.project(id?)` added to `lib/trpc/cache.ts` (`projects.byId` record key + `projects.list` rest key); every mutation invalidates through it.

## Error handling

- Board mutations are optimistic with rollback-on-error and a toast, exactly like `deals.setStage`.
- `taskMove` on a deleted task returns `NotFoundException`; the rollback restores the card and the toast says the task is gone.
- Deleting a project asks for confirmation (`AlertDialog`) and routes back to `/projects`.

## Testing

- `apps/api/test/projects.contracts.spec.ts` — zod: `toDay()` normalisation, rejects a create without `dealId`/`name`, status enums.
- `apps/api/test/projects.integration.spec.ts` — service against `TEST_DATABASE_URL` (TEST_RUN_ID-suffixed fixtures, deleting only rows it created): create → taskCreate ×3 → taskMove resequencing → list `taskCounts` → deal-cascade delete.
- Playwright walkthrough at the end (dev:session cookie recipe): create a project from a deal, add tasks, drag one across days, cycle statuses, verify the goal column and progress header.

## Build order

1. Prisma models + migration (application to the shared dev database is sequenced with the Phase B.2 session at merge time).
2. `projects` tRPC module + regenerated `server.ts` + contract/integration tests.
3. Projects list page + nav.
4. Day board.
5. Deal-sheet tab + Start project + estimate/invoice links.
6. Playwright walkthrough.
