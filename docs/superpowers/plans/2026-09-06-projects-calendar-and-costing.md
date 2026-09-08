# Projects Calendar + Job Costing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the projects day-board with a month/week calendar + timeline where tasks span days as crew-coloured blocks, and add a job-cost ledger with permission-gated profit reporting (per deal, per client, per month, per category).

**Architecture:** Extend the existing `projects` tRPC module for day-spans; add four small API modules (`crews`, `permissions`, `costs`, `reports`) following the standard NestJS/nestjs-trpc module shape; hand-roll the calendar in `apps/app` on a pure `span-layout` module + dnd-kit + the existing board conventions; store receipts on local disk exactly like drawing thumbnails.

**Tech Stack:** Next.js (apps/app), NestJS + nestjs-trpc + Prisma (apps/api), dnd-kit, react-day-picker DatePicker, recharts via `packages/ui` chart wrappers, bun for everything.

**Spec:** `docs/superpowers/specs/2026-09-06-projects-calendar-and-costing-design.md`

## Global Constraints

- Worktree: `C:\Users\Kyle\janus\.claude\worktrees\projects-calendar`, branch `janus/projects-calendar`. NEVER touch the main checkout or the shared `crm`/`crm_test` databases. Private DBs: `janus_calendar_dev` / `janus_calendar_test`.
- Repo AGENTS.md is law: **no code comments**, **no Co-Authored-By trailers**, constants in per-area config files, parse at the boundary with zod, server pages compute / client components render, `/packages/ui` is the single source of truth for UI, report issues in the BROKEN/RISK/NOT DONE list format in ASD-STE100.
- Read `docs/api.md` before touching `apps/api`; read `docs/design.md` before touching UI. Check `.agents/skills/` (prisma, nestjs-trpc, shadcn, nuqs skills exist).
- Money: integer cents. Invoice line total = `Math.round(Number(quantity) * priceCents)`. Never sum across currencies — group by currency. Client formatting via `formatMoney` from `@crm/ui/lib/format`; server formatting via `formatCents` in `apps/api/src/documents/pdf-money.ts`.
- Dates: UTC midnight everywhere via the `toDay()` idiom. Calendar cell keys use `dayKey` (UTC ISO slice) — never local dates.
- New migrations must be timestamped **after `20260906111122`**. Destructive DDL (dropping `project_task.day`) is HELD outside `prisma/migrations/` until merge day.
- New Prisma models are appended at the **end** of `packages/db/prisma/schema.prisma` (after `model Contract`, line ~1802).
- After any schema change: `bun run db:generate` then restart the API, or writes 500. After router/contract changes: root `bun run check-types` regenerates `apps/api/src/generated/server.ts` (commit it).
- Single api test file: `cd apps/api && CRM_TELEMETRY_DISABLED=1 TEST_DATABASE_URL=postgresql://.../janus_calendar_test bun test --preload ./test/setup.ts test/<file>.spec.ts`.
- Playwright driver scripts run under NODE, not bun (bun hangs chromium on this box). Login via the `bun run dev:session` cookie recipe.

---

### Task 0: Worktree environment

**Files:**
- Create: `.env` (worktree root, gitignored — copied from the main checkout)
- Create: none committed

**Interfaces:**
- Produces: a running dev environment against private DBs `janus_calendar_dev` / `janus_calendar_test`.

- [ ] **Step 1: Copy the main checkout's `.env` into the worktree root**, then edit ONLY the DB lines:

```
DATABASE_URL="postgresql://<same user/host as main .env>/janus_calendar_dev"
TEST_DATABASE_URL="postgresql://<same user/host>/janus_calendar_test"
```

(`packages/db/src/client.ts` requires the test database name to end in `_test`.)

- [ ] **Step 2: Create the databases** (same postgres server the main `.env` points at):

```bash
psql "<admin connection string from main .env, db postgres>" -c 'CREATE DATABASE janus_calendar_dev;'
psql "<admin connection string>" -c 'CREATE DATABASE janus_calendar_test;'
```

- [ ] **Step 3: Install and migrate**

```bash
bun install
cd packages/db && bunx prisma migrate deploy && cd ../..
bun run db:generate
```

Expected: all existing migrations apply cleanly to the empty `janus_calendar_dev`.

- [ ] **Step 4: Smoke-start** `bun run dev`, confirm the app loads and `/projects` renders, then stop it. Nothing to commit.

---

### Task 1: Schema — spans, Crew, JobCost, UserPermission

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (ProjectTask ~line 1190; User relations ~line 15; Deal relations ~line 874; append new models at end)
- Create: `packages/db/prisma/migrations/20260907000000_add_calendar_crews_costs_permissions/migration.sql`
- Create: `packages/db/prisma/held-ddl/2026-09-06-drop-project-task-day.sql`

**Interfaces:**
- Produces: Prisma models `Crew`, `JobCost`, `UserPermission`; `ProjectTask.startDay/endDay/crewId`; enums `JobCostCategory`. Later tasks import these via `@crm/db`.

- [ ] **Step 1: Edit `ProjectTask`** — add three fields and two indexes, keep `day` untouched:

```prisma
model ProjectTask {
  id         String            @id @default(cuid())
  projectId  String
  project    Project           @relation(fields: [projectId], references: [id], onDelete: Cascade)
  name       String
  note       String?
  day        DateTime?
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

  @@index([projectId, day])
  @@index([projectId, startDay])
  @@index([crewId, startDay])
  @@map("project_task")
}
```

- [ ] **Step 2: Append new models + enum at the END of the schema** (after `model Contract`):

```prisma
enum JobCostCategory {
  MATERIALS
  LABOR
  SUBCONTRACTOR
  EQUIPMENT
  PERMITS_FEES
  OTHER
}

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

- [ ] **Step 3: Add the back-relations** — on `User` (next to `createdProjects`): `jobCosts JobCost[] @relation("JobCostCreator")`, `permissions UserPermission[] @relation("PermissionHolder")`, `grantedPermissions UserPermission[] @relation("PermissionGrantor")`. On `Deal` (next to `projects`): `jobCosts JobCost[]`.

- [ ] **Step 4: Create the migration with backfill**

```bash
cd packages/db
bunx prisma migrate dev --name add_calendar_crews_costs_permissions --create-only
```

Rename the generated folder to `20260907000000_add_calendar_crews_costs_permissions` if its timestamp is not already above `20260906111122`. Append the backfill to the end of its `migration.sql`:

```sql
UPDATE "project_task" SET "startDay" = "day", "endDay" = "day" WHERE "day" IS NOT NULL;
```

Then apply: `bunx prisma migrate dev` — expected: applies cleanly, no drift on the private DB.

- [ ] **Step 5: Write the held destructive DDL** at `packages/db/prisma/held-ddl/2026-09-06-drop-project-task-day.sql` (new dir, OUTSIDE `migrations/`):

```sql
DROP INDEX "project_task_projectId_day_idx";
ALTER TABLE "project_task" DROP COLUMN "day";
```

With a `README.md` beside it: "Merge-day only. After this branch merges to janus/foundation and every session has rebased, wrap this file in a normal migration (timestamped last) and remove `day` from ProjectTask in schema.prisma. Until then no code on this branch reads or writes `day`."

- [ ] **Step 6: Regenerate + typecheck**

```bash
cd ../.. && bun run db:generate && bun run check-types
```

Expected: green (nothing consumes the new models yet).

- [ ] **Step 7: Commit**

```bash
git add packages/db && git commit -m "feat: add task spans, crews, job costs and user permissions to schema"
```

---

### Task 2: Projects module — day spans + crew

**Files:**
- Modify: `apps/api/src/projects/projects.config.ts`
- Modify: `apps/api/src/projects/projects.contracts.ts`
- Modify: `apps/api/src/projects/projects.service.ts`
- Modify: `apps/api/src/projects/projects.router.ts` (taskMove input shape only — procedures unchanged)
- Modify: `apps/api/test/projects.contracts.spec.ts`, `apps/api/test/projects.integration.spec.ts`
- Modify: `apps/api/src/generated/server.ts` (regenerated)

**Interfaces:**
- Consumes: Task 1 schema.
- Produces: `taskCreateInput { projectId, name, startDay?, endDay?, crewId?, assigneeId?, note? }` (transform fills `endDay ?? startDay`); `taskUpdateInput` gains `crewId: z.string().nullable().optional()` (still NO date fields — all date changes go through `taskMove`); `taskMoveInput { id, startDay: Date|null, endDay: Date|null, sortOrder: number }`; `spanDays(startDay, endDay): number` exported from contracts; `byId` tasks ordered `[{ startDay: "asc" }, { sortOrder: "asc" }]` and include `crew: { id, name, color } | null`.

- [ ] **Step 1: Write failing contract tests** (extend `projects.contracts.spec.ts`):

```ts
import { spanDays, taskCreateInput, taskMoveInput } from "../src/projects/projects.contracts";

describe("task spans", () => {
	it("fills endDay from startDay on create", () => {
		const result = taskCreateInput.safeParse({
			projectId: "p1",
			name: "Tear-off",
			startDay: "2026-09-08T10:00:00Z",
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.endDay?.toISOString()).toBe("2026-09-08T00:00:00.000Z");
		}
	});

	it("rejects an end day before the start day", () => {
		const result = taskMoveInput.safeParse({
			id: "t1",
			startDay: "2026-09-10",
			endDay: "2026-09-08",
			sortOrder: 0,
		});
		expect(result.success).toBe(false);
	});

	it("rejects a span over the cap", () => {
		const result = taskMoveInput.safeParse({
			id: "t1",
			startDay: "2026-01-01",
			endDay: "2026-03-01",
			sortOrder: 0,
		});
		expect(result.success).toBe(false);
	});

	it("rejects one-sided spans on move", () => {
		const result = taskMoveInput.safeParse({
			id: "t1",
			startDay: "2026-09-10",
			endDay: null,
			sortOrder: 0,
		});
		expect(result.success).toBe(false);
	});

	it("moves to unscheduled with both days null", () => {
		const result = taskMoveInput.safeParse({
			id: "t1",
			startDay: null,
			endDay: null,
			sortOrder: 0,
		});
		expect(result.success).toBe(true);
	});

	it("counts span days inclusively", () => {
		expect(
			spanDays(new Date("2026-09-06T00:00:00Z"), new Date("2026-09-08T00:00:00Z")),
		).toBe(3);
	});
});
```

- [ ] **Step 2: Run to verify failure** — `cd apps/api && CRM_TELEMETRY_DISABLED=1 bun test --preload ./test/setup.ts test/projects.contracts.spec.ts`. Expected: FAIL (`spanDays` not exported, schemas lack span fields).

- [ ] **Step 3: Implement contracts.** In `projects.config.ts` add `maxSpanDays: 30` inside `task`. In `projects.contracts.ts`:

```ts
export function spanDays(startDay: Date, endDay: Date): number {
	return Math.round((endDay.getTime() - startDay.getTime()) / 86_400_000) + 1;
}

function checkSpan(
	value: { startDay?: Date | null; endDay?: Date | null },
	ctx: z.RefinementCtx,
) {
	const startDay = value.startDay ?? null;
	const endDay = value.endDay ?? null;
	if ((startDay === null) !== (endDay === null)) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			message: "A task needs both a start day and an end day, or neither.",
		});
		return;
	}
	if (startDay && endDay) {
		if (endDay.getTime() < startDay.getTime()) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "The end day is before the start day.",
			});
		} else if (spanDays(startDay, endDay) > PROJECTS.task.maxSpanDays) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: `A task spans at most ${PROJECTS.task.maxSpanDays} days.`,
			});
		}
	}
}
```

`taskCreateInput` (replaces `day`):

```ts
export const taskCreateInput = z
	.object({
		projectId: z.string().min(1),
		name: z.string().trim().min(1).max(PROJECTS.task.nameMax),
		startDay: dayInput.nullable().optional(),
		endDay: dayInput.nullable().optional(),
		crewId: z.string().optional(),
		assigneeId: z.string().optional(),
		note: z.string().trim().max(PROJECTS.task.noteMax).optional(),
	})
	.superRefine((value, ctx) => {
		if (value.endDay && !value.startDay) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "An end day needs a start day.",
			});
			return;
		}
		checkSpan({ startDay: value.startDay, endDay: value.endDay ?? value.startDay }, ctx);
	})
	.transform((value) => ({ ...value, endDay: value.endDay ?? value.startDay ?? null }));
```

`taskUpdateInput` adds `crewId: z.string().nullable().optional()`. `taskMoveInput` becomes:

```ts
export const taskMoveInput = z
	.object({
		id: z.string().min(1),
		startDay: dayInput.nullable(),
		endDay: dayInput.nullable(),
		sortOrder: z.number().int().min(0),
	})
	.superRefine(checkSpan);
```

- [ ] **Step 4: Implement the service.** In `projects.service.ts`: `byId` task include gains `crew: { select: { id: true, name: true, color: true } }` and orderBy becomes `[{ startDay: "asc" }, { sortOrder: "asc" }]`. `taskCreate` writes `startDay/endDay/crewId` (drop the `day` write) and computes the cap + max sibling `sortOrder` against `startDay`. `taskUpdate` passes `crewId` through. `taskMove` swaps every `day` reference for `startDay` and also writes `endDay`:

```ts
	async taskMove(input: TaskMoveInput) {
		return this.db.$transaction(async (tx) => {
			const task = await tx.projectTask.findUnique({
				where: { id: input.id },
				select: { id: true, projectId: true, startDay: true },
			});
			if (!task) {
				throw new NotFoundException(`No task with id ${input.id}.`);
			}

			const siblings = await tx.projectTask.findMany({
				where: {
					projectId: task.projectId,
					startDay: input.startDay,
					id: { not: task.id },
				},
				orderBy: { sortOrder: "asc" },
				select: { id: true, sortOrder: true },
			});
```

…rest of the resequencing body unchanged except: the moved task's update writes `{ startDay: input.startDay, endDay: input.endDay, sortOrder }`, and the old-group compaction condition uses `sameDay(task.startDay, input.startDay)`. `LIST_SELECT` and `list` are untouched.

- [ ] **Step 5: Update integration tests.** In `projects.integration.spec.ts`, change task fixtures to `startDay`/`endDay` (e.g. create with `startDay: new Date("2026-09-08T00:00:00Z"), endDay: new Date("2026-09-10T00:00:00Z")`), assert `byId` returns them ordered by `startDay`, and assert `taskMove` to another `startDay` resequences both groups. Add one case: `taskMove` to `{ startDay: null, endDay: null }` lands the task in the unscheduled group.

- [ ] **Step 6: Run both spec files** (contracts, then integration with `TEST_DATABASE_URL`). Expected: PASS.

- [ ] **Step 7: Regenerate + typecheck** — root `bun run check-types` (regenerates `server.ts`). Fix the two client call sites that now break (`project-board.tsx` passes `day` to `taskMove`; `add-task-input.tsx` passes `day` to `taskCreate`) with the MINIMAL edit: pass `startDay: day, endDay: day`. These files are deleted in Task 8; they just need to compile until then.

- [ ] **Step 8: Commit**

```bash
git add apps/api apps/app && git commit -m "feat: project tasks span days and carry a crew"
```

---

### Task 3: Crews API module

**Files:**
- Create: `apps/api/src/crews/crews.config.ts`, `crews.contracts.ts`, `crews.service.ts`, `crews.router.ts`, `crews.module.ts`
- Modify: `apps/api/src/app.module.ts` (import + register `CrewsModule` after `ProjectsModule`)
- Create: `apps/api/test/crews.integration.spec.ts`
- Modify: `apps/api/src/generated/server.ts` (regenerated)

**Interfaces:**
- Consumes: `Crew` model from Task 1.
- Produces: tRPC `crews.list` → `{ id, name, color, archived, taskCount }[]` (all crews, `orderBy: [{ archived: "asc" }, { name: "asc" }]`); `crews.create { name, color }`; `crews.update { id, name?, color?, archived? }`; `crews.remove { id }` (throws `ConflictException` when tasks reference it). `CREW_COLORS` const — Task 8/10 UI mirrors these keys EXACTLY.

- [ ] **Step 1: Config + contracts.** `crews.config.ts`:

```ts
export const CREWS = {
	nameMax: 80,
	colors: [
		"red",
		"orange",
		"amber",
		"green",
		"teal",
		"sky",
		"indigo",
		"violet",
		"pink",
		"slate",
	],
} as const;
```

`crews.contracts.ts`:

```ts
import { z } from "zod";
import { CREWS } from "./crews.config";

export const crewColorEnum = z.enum(CREWS.colors);

export const crewCreateInput = z.object({
	name: z.string().trim().min(1).max(CREWS.nameMax),
	color: crewColorEnum,
});
export type CrewCreateInput = z.infer<typeof crewCreateInput>;

export const crewUpdateInput = z.object({
	id: z.string().min(1),
	name: z.string().trim().min(1).max(CREWS.nameMax).optional(),
	color: crewColorEnum.optional(),
	archived: z.boolean().optional(),
});
export type CrewUpdateInput = z.infer<typeof crewUpdateInput>;

export const crewIdInput = z.object({ id: z.string().min(1) });
```

- [ ] **Step 2: Write failing integration test** `test/crews.integration.spec.ts` (mirror the projects integration spec skeleton — `db` from `@crm/db`, `TEST_RUN_ID` suffix, FK-ordered `afterAll` cleanup): create a crew → `list` shows it with `taskCount: 0` → attach a `projectTask` referencing it (build user/deal/project fixtures like the projects spec) → `remove` throws `ConflictException` → detach the task, `remove` succeeds → `update { archived: true }` round-trips.

- [ ] **Step 3: Run to verify failure.** Expected: FAIL (module missing).

- [ ] **Step 4: Implement service + router + module.** Service (`@Injectable`, `@InjectDatabase()` ctor, `translate` P2025→NotFound pattern copied from projects):

```ts
	async list() {
		const rows = await this.db.crew.findMany({
			orderBy: [{ archived: "asc" }, { name: "asc" }],
			include: { _count: { select: { tasks: true } } },
		});
		return rows.map(({ _count, ...crew }) => ({ ...crew, taskCount: _count.tasks }));
	}

	async remove(id: string) {
		const count = await this.db.projectTask.count({ where: { crewId: id } });
		if (count > 0) {
			throw new ConflictException(
				"Tasks still use this crew. Archive it instead.",
			);
		}
		try {
			return await this.db.crew.delete({ where: { id } });
		} catch (error) {
			throw this.translate(error, id);
		}
	}
```

Router: `@Router({ alias: "crews" })`, `@UseMiddlewares(AuthMiddleware)`, `@Query list()`, `@Mutation create/update/remove`. Module: `providers: [CrewsService, CrewsRouter], exports: [CrewsService]`; register in `app.module.ts`.

- [ ] **Step 5: Run tests.** Expected: PASS. Then root `bun run check-types`.

- [ ] **Step 6: Commit** — `git add apps/api && git commit -m "feat: crews module"`

---

### Task 4: Permissions API module

**Files:**
- Create: `apps/api/src/permissions/permissions.config.ts`, `permissions.contracts.ts`, `permissions.service.ts`, `permissions.router.ts`, `permissions.module.ts`
- Modify: `packages/auth/src/organization.ts` (add `canManagePermissions`)
- Modify: `apps/api/src/app.module.ts`
- Create: `apps/api/test/permissions.integration.spec.ts`
- Modify: `apps/api/src/generated/server.ts` (regenerated)

**Interfaces:**
- Consumes: `UserPermission` model; `workspaceRoleOf`, `isWorkspaceAdmin`, `WORKSPACE_ID` from `@crm/auth`.
- Produces: `PERMISSION_KEYS = { profitView: "profit.view" }`; `PermissionsService.hasPermission(userId, key): Promise<boolean>`, `.assertPermission(userId, key): Promise<void>` (throws `ForbiddenException("You do not have access to profit data.")`), `.mine(userId): Promise<string[]>`; tRPC `permissions.mine` → `{ keys: string[], isAdmin: boolean }`; `permissions.listUsers` (admin-gated) → `{ userId, name, email, role, keys }[]`; `permissions.grant { userId, key }` / `permissions.revoke { userId, key }` (admin-gated). `PermissionsModule` exports `PermissionsService` — Tasks 5 and 6 inject it (their modules add `imports: [PermissionsModule]`).

- [ ] **Step 1: Add the predicate** to `packages/auth/src/organization.ts` next to the other `can*` helpers:

```ts
export function canManagePermissions(role: WorkspaceRole | null): boolean {
	return isWorkspaceAdmin(role);
}
```

- [ ] **Step 2: Config + contracts.** `permissions.config.ts`:

```ts
export const PERMISSION_KEYS = {
	profitView: "profit.view",
} as const;

export type PermissionKey =
	(typeof PERMISSION_KEYS)[keyof typeof PERMISSION_KEYS];

export const ALL_PERMISSION_KEYS = Object.values(
	PERMISSION_KEYS,
) as PermissionKey[];
```

`permissions.contracts.ts`:

```ts
import { z } from "zod";
import { ALL_PERMISSION_KEYS } from "./permissions.config";

export const permissionKeyEnum = z.enum(
	ALL_PERMISSION_KEYS as [string, ...string[]],
);

export const permissionGrantInput = z.object({
	userId: z.string().min(1),
	key: permissionKeyEnum,
});
export type PermissionGrantInput = z.infer<typeof permissionGrantInput>;
```

- [ ] **Step 3: Write failing integration test** `test/permissions.integration.spec.ts`. Fixtures: two users (`member-${suffix}`, `admin-${suffix}`) plus `db.member` rows in `WORKSPACE_ID` with roles `member` and `admin` (create the org row with `db.organization.upsert({ where: { id: WORKSPACE_ID }, update: {}, create: { id: WORKSPACE_ID, name: "Test", slug: `ws-${suffix}`, createdAt: new Date() } })` first; delete member rows and the permission rows in `afterAll`, leave the org row). Cases:
  - `hasPermission(member, "profit.view")` → false; after `grant(admin, { userId: member, key })` → true; after `revoke` → false.
  - `hasPermission(admin, ...)` → true with no grant row.
  - `grant` called with the member as actor → throws `ForbiddenException`.
  - `mine(admin)` returns all keys; `mine(member)` returns only granted keys.

- [ ] **Step 4: Run to verify failure.** Expected: FAIL.

- [ ] **Step 5: Implement the service:**

```ts
import { ForbiddenException, Injectable } from "@nestjs/common";
import { canManagePermissions, workspaceRoleOf, isWorkspaceAdmin } from "@crm/auth";
import type { Db } from "@crm/db";
import { InjectDatabase } from "../database/database.constants";
import { ALL_PERMISSION_KEYS, type PermissionKey } from "./permissions.config";

@Injectable()
export class PermissionsService {
	constructor(@InjectDatabase() private readonly db: Db) {}

	async hasPermission(userId: string, key: PermissionKey): Promise<boolean> {
		const role = await workspaceRoleOf(userId, this.db);
		if (isWorkspaceAdmin(role)) return true;
		const row = await this.db.userPermission.findUnique({
			where: { userId_key: { userId, key } },
			select: { id: true },
		});
		return row !== null;
	}

	async assertPermission(userId: string, key: PermissionKey): Promise<void> {
		if (!(await this.hasPermission(userId, key))) {
			throw new ForbiddenException("You do not have access to profit data.");
		}
	}

	async mine(userId: string) {
		const role = await workspaceRoleOf(userId, this.db);
		if (isWorkspaceAdmin(role)) {
			return { keys: [...ALL_PERMISSION_KEYS], isAdmin: true };
		}
		const rows = await this.db.userPermission.findMany({
			where: { userId },
			select: { key: true },
		});
		return { keys: rows.map((row) => row.key), isAdmin: false };
	}

	private async assertManager(actorId: string): Promise<void> {
		const role = await workspaceRoleOf(actorId, this.db);
		if (!canManagePermissions(role)) {
			throw new ForbiddenException("Only an admin can change permissions.");
		}
	}

	async grant(actorId: string, input: PermissionGrantInput) {
		await this.assertManager(actorId);
		return this.db.userPermission.upsert({
			where: { userId_key: { userId: input.userId, key: input.key } },
			update: {},
			create: { userId: input.userId, key: input.key, grantedById: actorId },
		});
	}

	async revoke(actorId: string, input: PermissionGrantInput) {
		await this.assertManager(actorId);
		await this.db.userPermission.deleteMany({
			where: { userId: input.userId, key: input.key },
		});
		return { ok: true };
	}

	async listUsers(actorId: string) {
		await this.assertManager(actorId);
		const members = await this.db.member.findMany({
			where: { organizationId: WORKSPACE_ID },
			select: {
				role: true,
				user: {
					select: {
						id: true,
						name: true,
						email: true,
						image: true,
						permissions: { select: { key: true } },
					},
				},
			},
			orderBy: { createdAt: "asc" },
		});
		return members.map((member) => ({
			userId: member.user.id,
			name: member.user.name,
			email: member.user.email,
			image: member.user.image,
			role: member.role,
			keys: member.user.permissions.map((permission) => permission.key),
		}));
	}
}
```

(Import `WORKSPACE_ID` from `@crm/auth`; check `workspaceRoleOf`'s second parameter type `WorkspaceMemberReader` accepts `this.db` — it does, `Pick<Db, "member">`.) Router: `permissions.mine` (Query, no input, uses `ctx.user.id`), `listUsers` (Query), `grant`/`revoke` (Mutations, `permissionGrantInput`). Module exports the service; register in `app.module.ts`.

- [ ] **Step 6: Run tests → PASS, root `bun run check-types`, commit** — `git add apps/api packages/auth && git commit -m "feat: user permissions module with profit.view key"`

---

### Task 5: Costs API module + revenue helpers

**Files:**
- Modify: `apps/api/src/invoices/invoice-logic.ts` (move + export `lineItemsTotalCents`)
- Modify: `apps/api/src/invoices/invoices.service.ts` (import it instead of the private copy)
- Modify: `apps/api/src/invoices/invoices.config.ts` (add `revenueStatuses`)
- Create: `apps/api/src/costs/costs.config.ts`, `costs.contracts.ts`, `costs.service.ts`, `costs.router.ts`, `costs.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Create: `apps/api/test/costs.integration.spec.ts`
- Modify: `apps/api/src/generated/server.ts` (regenerated)

**Interfaces:**
- Consumes: `JobCost` model, `PermissionsService` (module `imports: [PermissionsModule]`), `PERMISSION_KEYS.profitView`.
- Produces: exported `lineItemsTotalCents(lineItems: { quantity: Prisma.Decimal | number | string; priceCents: number }[]): number` in `invoice-logic.ts`; `INVOICES.revenueStatuses = ["SENT", "PAID"]`; tRPC `costs.list { dealId }` → `{ rows, totalsByCurrency: { currency, totalCents }[], totalsByCategory: { category, currency, totalCents }[] }`; `costs.create { dealId, date, amountCents, category, note? }` (currency copied from the deal); `costs.update { id, date?, amountCents?, category?, note? }`; `costs.remove { id }`; `costs.profitForDeal { dealId }` (permission-gated) → `{ byCurrency: { currency, invoicedCents, collectedCents, costsCents, profitCents, marginPct: number | null }[] }`.

- [ ] **Step 1: Move the money helper.** Cut `lineItemsTotalCents` out of `invoices.service.ts` (lines ~74-84), paste it into `invoice-logic.ts` with `export`, update `invoices.service.ts` to import it. Add to `invoices.config.ts`: `revenueStatuses: ["SENT", "PAID"]` inside the existing `INVOICES` object (`as const` already applies). Run the existing invoices tests to confirm nothing broke.

- [ ] **Step 2: Config + contracts.** `costs.config.ts`:

```ts
export const COSTS = {
	noteMax: 500,
	maxAmountCents: 100_000_000,
	receipt: { maxBytes: 10 * 1024 * 1024 },
} as const;
```

`costs.contracts.ts` (reuse `toDay` by importing from `../projects/projects.contracts`):

```ts
import { JobCostCategory } from "@crm/db";
import { z } from "zod";
import { toDay } from "../projects/projects.contracts";
import { COSTS } from "./costs.config";

const dayInput = z.coerce.date().transform(toDay);

export const costCategoryEnum = z.enum(
	Object.values(JobCostCategory) as [JobCostCategory, ...JobCostCategory[]],
);

export const costListInput = z.object({ dealId: z.string().min(1) });

export const costCreateInput = z.object({
	dealId: z.string().min(1),
	date: dayInput,
	amountCents: z.number().int().min(1).max(COSTS.maxAmountCents),
	category: costCategoryEnum,
	note: z.string().trim().max(COSTS.noteMax).optional(),
});
export type CostCreateInput = z.infer<typeof costCreateInput>;

export const costUpdateInput = z.object({
	id: z.string().min(1),
	date: dayInput.optional(),
	amountCents: z.number().int().min(1).max(COSTS.maxAmountCents).optional(),
	category: costCategoryEnum.optional(),
	note: z.string().trim().max(COSTS.noteMax).nullable().optional(),
});
export type CostUpdateInput = z.infer<typeof costUpdateInput>;

export const costIdInput = z.object({ id: z.string().min(1) });

export const profitForDealInput = z.object({ dealId: z.string().min(1) });
```

- [ ] **Step 3: Write failing integration tests** `test/costs.integration.spec.ts`. Fixtures like the projects spec plus org/member rows like the permissions spec (an admin actor and a plain member). Cases:
  - `create` copies the deal's currency; `list` returns the row plus `totalsByCurrency` and `totalsByCategory`.
  - `profitForDeal` maths: seed two invoices on the deal — one `SENT` with line items `(quantity 2, priceCents 1000)` = 2000, one `PAID` with `(quantity 1.5, priceCents 1000)` = 1500 — plus one `DRAFT` (excluded) and one `VOID` (excluded); seed costs totalling 1200. Called as the admin: `byCurrency[0]` is `{ invoicedCents: 3500, collectedCents: 1500, costsCents: 1200, profitCents: 2300 }` and `marginPct` ≈ 65.7.
  - `profitForDeal` as the plain member without a grant → throws `ForbiddenException`; after `db.userPermission.create` for `profit.view` → succeeds.
  - A cost in a second currency shows up as its own `byCurrency` entry, never merged.

- [ ] **Step 4: Run to verify failure.** Expected: FAIL.

- [ ] **Step 5: Implement the service.** Ctor: `constructor(@InjectDatabase() private readonly db: Db, @Inject(PermissionsService) private readonly permissions: PermissionsService) {}`. Core methods:

```ts
	async list(input: { dealId: string }) {
		const [rows, byCategory] = await Promise.all([
			this.db.jobCost.findMany({
				where: { dealId: input.dealId },
				orderBy: [{ date: "desc" }, { createdAt: "desc" }],
				include: { createdBy: { select: { id: true, name: true } } },
			}),
			this.db.jobCost.groupBy({
				by: ["category", "currency"],
				where: { dealId: input.dealId },
				_sum: { amountCents: true },
			}),
		]);
		const totalsByCurrency = new Map<string, number>();
		for (const row of byCategory) {
			totalsByCurrency.set(
				row.currency,
				(totalsByCurrency.get(row.currency) ?? 0) + (row._sum.amountCents ?? 0),
			);
		}
		return {
			rows,
			totalsByCurrency: [...totalsByCurrency].map(([currency, totalCents]) => ({
				currency,
				totalCents,
			})),
			totalsByCategory: byCategory.map((row) => ({
				category: row.category,
				currency: row.currency,
				totalCents: row._sum.amountCents ?? 0,
			})),
		};
	}

	async create(input: CostCreateInput, userId: string) {
		const deal = await this.db.deal.findUnique({
			where: { id: input.dealId },
			select: { currency: true },
		});
		if (!deal) {
			throw new NotFoundException(`No deal with id ${input.dealId}.`);
		}
		return this.db.jobCost.create({
			data: { ...input, currency: deal.currency, createdById: userId },
		});
	}

	async profitForDeal(userId: string, dealId: string) {
		await this.permissions.assertPermission(userId, PERMISSION_KEYS.profitView);
		const [invoices, costs] = await Promise.all([
			this.db.invoice.findMany({
				where: { dealId, status: { in: [...INVOICES.revenueStatuses] } },
				select: {
					status: true,
					currency: true,
					lineItems: { select: { quantity: true, priceCents: true } },
				},
			}),
			this.db.jobCost.groupBy({
				by: ["currency"],
				where: { dealId },
				_sum: { amountCents: true },
			}),
		]);
		const byCurrency = new Map<
			string,
			{ invoicedCents: number; collectedCents: number; costsCents: number }
		>();
		const entry = (currency: string) => {
			const existing = byCurrency.get(currency);
			if (existing) return existing;
			const created = { invoicedCents: 0, collectedCents: 0, costsCents: 0 };
			byCurrency.set(currency, created);
			return created;
		};
		for (const invoice of invoices) {
			const total = lineItemsTotalCents(invoice.lineItems);
			const bucket = entry(invoice.currency);
			bucket.invoicedCents += total;
			if (invoice.status === "PAID") bucket.collectedCents += total;
		}
		for (const cost of costs) {
			entry(cost.currency).costsCents += cost._sum.amountCents ?? 0;
		}
		return {
			byCurrency: [...byCurrency].map(([currency, sums]) => {
				const profitCents = sums.invoicedCents - sums.costsCents;
				return {
					currency,
					...sums,
					profitCents,
					marginPct:
						sums.invoicedCents > 0
							? (profitCents / sums.invoicedCents) * 100
							: null,
				};
			}),
		};
	}
```

`update`/`remove` are thin Prisma calls with the `translate` P2025 pattern (`receiptPath` is written only by the Task 12 receipt routes, never through tRPC). Router: alias `"costs"`, all procedures behind `AuthMiddleware`, `create` and `profitForDeal` take `@Ctx()` for `ctx.user.id`. Module: `imports: [PermissionsModule]`, register in `app.module.ts`.

- [ ] **Step 6: Run tests → PASS. Root `bun run check-types`. Commit** — `git add apps/api && git commit -m "feat: job costs module with permission-gated deal profit"`

---

### Task 6: Reports API module

**Files:**
- Create: `apps/api/src/reports/reports.contracts.ts`, `reports.service.ts`, `reports.router.ts`, `reports.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Create: `apps/api/test/reports.integration.spec.ts`
- Modify: `apps/api/src/generated/server.ts` (regenerated)

**Interfaces:**
- Consumes: `PermissionsService` (`imports: [PermissionsModule]`), `lineItemsTotalCents`, `INVOICES.revenueStatuses`, `JobCost`.
- Produces: tRPC `reports.byClient` → `{ rows: { contactId, name, currency, dealCount, invoicedCents, costsCents, profitCents, marginPct }[] }` sorted by `profitCents desc`; `reports.byMonth` → `{ rows: { month: "YYYY-MM", currency, invoicedCents, costsCents, profitCents }[] }` (trailing 12 months, zero-filled for the primary currency); `reports.byCategory { from?, to? }` → `{ rows: { category, currency, totalCents }[] }`. Every procedure calls `assertPermission(userId, PERMISSION_KEYS.profitView)` first.

- [ ] **Step 1: Contracts** — `reportRangeInput = z.object({ from: dayInput.optional(), to: dayInput.optional() })` (same `dayInput` construction as costs).

- [ ] **Step 2: Write failing integration tests.** Fixtures: one deal linked (via `db.dealContact.create`) to a contact `firstName: "Pat", lastName: \`Client-${suffix}\``, with one `SENT` invoice (line total 5000) and costs 2000 dated this month. Cases: `byClient` (as admin) returns the contact with `invoicedCents: 5000, costsCents: 2000, profitCents: 3000`; `byMonth` has a row for the current month with those sums; `byCategory` with a range covering the cost returns its category total, with a range excluding it returns nothing for that category; every procedure as an ungranted member throws `ForbiddenException`.

- [ ] **Step 3: Run to verify failure. Expected: FAIL.**

- [ ] **Step 4: Implement the service.** All three methods start with the permission assert. Shapes:

`byClient`: one query, JS aggregation (invoice totals cannot use `_sum`):

```ts
		const deals = await this.db.deal.findMany({
			select: {
				id: true,
				currency: true,
				contacts: {
					select: {
						contact: { select: { id: true, firstName: true, lastName: true } },
					},
				},
				invoices: {
					where: { status: { in: [...INVOICES.revenueStatuses] } },
					select: {
						currency: true,
						lineItems: { select: { quantity: true, priceCents: true } },
					},
				},
				jobCosts: { select: { currency: true, amountCents: true } },
			},
		});
```

Aggregate into a `Map` keyed `${contactId}\u0000${currency}` (invoice revenue keyed by the invoice's currency, costs by the cost's currency; a deal with neither invoices nor costs contributes only `dealCount`, attributed to the deal's own currency). Contact display name: `[firstName, lastName].filter(Boolean).join(" ")`. Sort rows `profitCents desc`. Skip deals with no linked contact.

`byMonth`: compute `start = toDay(first day of the month 11 months ago, UTC)`; fetch revenue invoices with `issuedAt`/`createdAt` and line items, plus `jobCost.findMany({ where: { date: { gte: start } }, select: { date, currency, amountCents } })`; bucket by `(issuedAt ?? createdAt)` → `YYYY-MM` (UTC slice) and currency; zero-fill the 12 months for each currency seen.

`byCategory`: `jobCost.groupBy({ by: ["category", "currency"], where: { date: { gte: from ?? defaultStart, lte: to ?? now } }, _sum: { amountCents: true } })`, default range = trailing 12 months.

Router alias `"reports"`, three Queries, all take `@Ctx()`. Module imports `PermissionsModule`; register in `app.module.ts`.

- [ ] **Step 5: Run tests → PASS. Root `bun run check-types`. Commit** — `git add apps/api && git commit -m "feat: profit reports module"`

---

### Task 7: span-layout — the calendar's pure core

**Files:**
- Create: `apps/app/lib/calendar/span-layout.ts`
- Create: `apps/app/lib/calendar/span-layout.test.ts`

**Interfaces:**
- Consumes: nothing (pure module — Dates in, plain data out).
- Produces (Tasks 8/9 consume EXACTLY these):

```ts
export type SpanTask = {
	id: string;
	startDay: Date;
	endDay: Date;
	sortOrder: number;
};
export type WeekBar<T extends SpanTask> = {
	task: T;
	startCol: number;
	endCol: number;
	lane: number;
	clippedStart: boolean;
	clippedEnd: boolean;
};
export function dayKey(day: Date): string;
export function fromDayKey(key: string): Date;
export function addDays(day: Date, count: number): Date;
export function monthWeeks(anchor: Date): Date[][];
export function weekOf(anchor: Date): Date[];
export function layoutWeek<T extends SpanTask>(
	tasks: T[],
	weekStart: Date,
	maxLanes: number,
): { bars: WeekBar<T>[]; overflow: number[] };
```

- [ ] **Step 1: Write the failing tests** (`bun:test`, run with `cd apps/app && bun test lib/calendar/span-layout.test.ts`):

```ts
import { describe, expect, it } from "bun:test";
import {
	addDays,
	dayKey,
	layoutWeek,
	monthWeeks,
	weekOf,
} from "./span-layout";

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const task = (id: string, start: string, end: string, sortOrder = 0) => ({
	id,
	startDay: day(start),
	endDay: day(end),
	sortOrder,
});

describe("monthWeeks", () => {
	it("covers September 2026 in five Sunday-start weeks", () => {
		const weeks = monthWeeks(day("2026-09-15"));
		expect(weeks.length).toBe(5);
		expect(dayKey(weeks[0][0])).toBe("2026-08-30");
		expect(dayKey(weeks[4][6])).toBe("2026-10-03");
		for (const week of weeks) expect(week.length).toBe(7);
	});
});

describe("layoutWeek", () => {
	const weekStart = day("2026-09-06");

	it("places a three-day task in one bar", () => {
		const { bars, overflow } = layoutWeek(
			[task("a", "2026-09-06", "2026-09-08")],
			weekStart,
			4,
		);
		expect(bars).toEqual([
			{
				task: task("a", "2026-09-06", "2026-09-08"),
				startCol: 0,
				endCol: 2,
				lane: 0,
				clippedStart: false,
				clippedEnd: false,
			},
		]);
		expect(overflow).toEqual([0, 0, 0, 0, 0, 0, 0]);
	});

	it("clips a task that runs past the week and stacks overlaps into lanes", () => {
		const { bars } = layoutWeek(
			[
				task("a", "2026-09-03", "2026-09-09"),
				task("b", "2026-09-07", "2026-09-07"),
			],
			weekStart,
			4,
		);
		const barA = bars.find((bar) => bar.task.id === "a");
		const barB = bars.find((bar) => bar.task.id === "b");
		expect(barA).toMatchObject({
			startCol: 0,
			endCol: 3,
			lane: 0,
			clippedStart: true,
			clippedEnd: false,
		});
		expect(barB).toMatchObject({ startCol: 1, endCol: 1, lane: 1 });
	});

	it("drops the excess into overflow counts", () => {
		const tasks = ["a", "b", "c", "d", "e"].map((id, index) =>
			task(id, "2026-09-07", "2026-09-07", index),
		);
		const { bars, overflow } = layoutWeek(tasks, weekStart, 4);
		expect(bars.length).toBe(4);
		expect(overflow[1]).toBe(1);
	});

	it("excludes tasks outside the week", () => {
		const { bars } = layoutWeek(
			[task("a", "2026-09-20", "2026-09-21")],
			weekStart,
			4,
		);
		expect(bars).toEqual([]);
	});
});

describe("day math", () => {
	it("addDays stays in UTC", () => {
		expect(dayKey(addDays(day("2026-08-31"), 1))).toBe("2026-09-01");
	});
	it("weekOf returns the Sunday-start week", () => {
		expect(dayKey(weekOf(day("2026-09-09"))[0])).toBe("2026-09-06");
	});
});
```

- [ ] **Step 2: Run to verify failure.** Expected: FAIL (module missing).

- [ ] **Step 3: Implement:**

```ts
const DAY_MS = 86_400_000;

export function dayKey(day: Date): string {
	return day.toISOString().slice(0, 10);
}

export function fromDayKey(key: string): Date {
	return new Date(`${key}T00:00:00.000Z`);
}

export function addDays(day: Date, count: number): Date {
	return new Date(day.getTime() + count * DAY_MS);
}

function startOfWeek(day: Date): Date {
	return addDays(day, -day.getUTCDay());
}

export function weekOf(anchor: Date): Date[] {
	const start = startOfWeek(anchor);
	return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

export function monthWeeks(anchor: Date): Date[][] {
	const first = new Date(
		Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1),
	);
	const last = new Date(
		Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0),
	);
	const weeks: Date[][] = [];
	for (
		let cursor = startOfWeek(first);
		cursor.getTime() <= last.getTime();
		cursor = addDays(cursor, 7)
	) {
		weeks.push(Array.from({ length: 7 }, (_, index) => addDays(cursor, index)));
	}
	return weeks;
}

export type SpanTask = {
	id: string;
	startDay: Date;
	endDay: Date;
	sortOrder: number;
};

export type WeekBar<T extends SpanTask> = {
	task: T;
	startCol: number;
	endCol: number;
	lane: number;
	clippedStart: boolean;
	clippedEnd: boolean;
};

export function layoutWeek<T extends SpanTask>(
	tasks: T[],
	weekStart: Date,
	maxLanes: number,
): { bars: WeekBar<T>[]; overflow: number[] } {
	const weekEnd = addDays(weekStart, 6);
	const inWeek = tasks
		.filter(
			(task) =>
				task.startDay.getTime() <= weekEnd.getTime() &&
				task.endDay.getTime() >= weekStart.getTime(),
		)
		.sort(
			(a, b) =>
				a.startDay.getTime() - b.startDay.getTime() ||
				b.endDay.getTime() - a.endDay.getTime() ||
				a.sortOrder - b.sortOrder,
		);

	const laneEnds: number[] = [];
	const bars: WeekBar<T>[] = [];
	const overflow = [0, 0, 0, 0, 0, 0, 0];

	for (const task of inWeek) {
		const startCol = Math.max(
			0,
			Math.round((task.startDay.getTime() - weekStart.getTime()) / DAY_MS),
		);
		const endCol = Math.min(
			6,
			Math.round((task.endDay.getTime() - weekStart.getTime()) / DAY_MS),
		);
		let lane = laneEnds.findIndex((end) => end < startCol);
		if (lane === -1) lane = laneEnds.length;
		if (lane >= maxLanes) {
			for (let col = startCol; col <= endCol; col += 1) overflow[col] += 1;
			continue;
		}
		laneEnds[lane] = endCol;
		bars.push({
			task,
			startCol,
			endCol,
			lane,
			clippedStart: task.startDay.getTime() < weekStart.getTime(),
			clippedEnd: task.endDay.getTime() > weekEnd.getTime(),
		});
	}
	return { bars, overflow };
}
```

- [ ] **Step 4: Run tests → PASS.** (If the lane test fails on `findIndex`: a lane is free when its last occupied column is `< startCol` — verify against the test's expected lanes, fix the comparison, not the test.)

- [ ] **Step 5: Commit** — `git add apps/app/lib/calendar && git commit -m "feat: calendar span layout engine"`

---

### Task 8: Calendar view — grid, bars, add-task panel, unscheduled strip

**Files:**
- Delete: `apps/app/app/(app)/[slug]/projects/[id]/project-board.tsx`, `add-task-input.tsx`, `board-config.ts`, `day-range.ts`
- Create: `apps/app/app/(app)/[slug]/projects/[id]/calendar-view.tsx` (tabs + range state + DndContext + data wiring)
- Create: `apps/app/app/(app)/[slug]/projects/[id]/calendar-grid.tsx` (month/week grid + day cells)
- Create: `apps/app/app/(app)/[slug]/projects/[id]/task-bar.tsx` (bar + resize handle + popover trigger)
- Create: `apps/app/app/(app)/[slug]/projects/[id]/add-task-panel.tsx` (right-side Sheet)
- Create: `apps/app/app/(app)/[slug]/projects/[id]/unscheduled-strip.tsx`
- Create: `apps/app/components/crews/crew-colors.ts` (mirror of `CREWS.colors` → Tailwind classes)
- Modify: `apps/app/app/(app)/[slug]/projects/[id]/task-card.tsx` (keep `TaskCardBody` popover editor; add crew select + date fields; drop the dnd wrapper `TaskCard`)
- Modify: `apps/app/app/(app)/[slug]/projects/[id]/page.tsx` (render `CalendarView`, prefetch `crews.list`)
- Modify: `apps/app/lib/trpc/cache.ts` (add `crews` entry; `project` unchanged)

**Interfaces:**
- Consumes: Task 2 API (`taskMove { id, startDay, endDay, sortOrder }`, `taskCreate` with spans + `crewId`, `byId` tasks with `crew`), Task 3 `crews.list`, Task 7 span-layout exports.
- Produces: `CalendarView({ id }: { id: string })` — the whole client surface below `ProjectHeader`; `CREW_COLOR_CLASSES: Record<string, { bar: string; dot: string }>` in `crew-colors.ts` (keys MUST equal `CREWS.colors` from `apps/api/src/crews/crews.config.ts`); `AddTaskPanel({ projectId, open, onOpenChange, defaultStartDay })`. Task 9 reuses `task-bar.tsx`'s `barClasses(task)` helper and the popover.

- [ ] **Step 1: Crew colour mirror.** `apps/app/components/crews/crew-colors.ts` — keys copied EXACTLY from `CREWS.colors`:

```ts
export const CREW_COLOR_CLASSES: Record<string, { bar: string; dot: string }> = {
	red: { bar: "bg-red-100 text-red-900 border-red-300", dot: "bg-red-500" },
	orange: { bar: "bg-orange-100 text-orange-900 border-orange-300", dot: "bg-orange-500" },
	amber: { bar: "bg-amber-100 text-amber-900 border-amber-300", dot: "bg-amber-500" },
	green: { bar: "bg-green-100 text-green-900 border-green-300", dot: "bg-green-500" },
	teal: { bar: "bg-teal-100 text-teal-900 border-teal-300", dot: "bg-teal-500" },
	sky: { bar: "bg-sky-100 text-sky-900 border-sky-300", dot: "bg-sky-500" },
	indigo: { bar: "bg-indigo-100 text-indigo-900 border-indigo-300", dot: "bg-indigo-500" },
	violet: { bar: "bg-violet-100 text-violet-900 border-violet-300", dot: "bg-violet-500" },
	pink: { bar: "bg-pink-100 text-pink-900 border-pink-300", dot: "bg-pink-500" },
	slate: { bar: "bg-slate-100 text-slate-900 border-slate-300", dot: "bg-slate-500" },
};

export const NO_CREW_CLASSES = {
	bar: "bg-muted text-foreground border-border",
	dot: "bg-muted-foreground",
};
```

(Design-doctrine note: these are semantic data colours like the chart palette, not new component styles; keep them in this one file so a future move into `packages/ui` is one cut-paste.)

- [ ] **Step 2: `calendar-view.tsx`.** Client component. State: `view: "month" | "week"` and `anchor: Date` (init `toDay(new Date())` — reuse `toDay` semantics via `fromDayKey(dayKey(new Date()))`), `tab: "calendar" | "timeline"`, `panelOpen`, `panelDefaultDay`. Data: `useQuery(trpc.projects.byId.queryOptions({ id }))`, `useQuery(trpc.crews.list.queryOptions())`. Derive `scheduled = tasks.filter((task) => task.startDay && task.endDay)` mapped to span-layout tasks (parse the serialized dates with `new Date(...)`), `unscheduled = tasks.filter((task) => !task.startDay)`.

Header row (below `ProjectHeader`, inside the same `PageShell contained` page):

```tsx
<div className="flex items-center gap-2">
	<Tabs value={tab} onValueChange={setTab}>
		<TabsList variant="line">
			<TabsTrigger value="calendar">Calendar</TabsTrigger>
			<TabsTrigger value="timeline">Timeline</TabsTrigger>
		</TabsList>
	</Tabs>
	{tab === "calendar" ? (
		<ToggleGroup type="single" value={view} onValueChange={(next) => next && setView(next)}>
			<ToggleGroupItem value="month">Month</ToggleGroupItem>
			<ToggleGroupItem value="week">Week</ToggleGroupItem>
		</ToggleGroup>
	) : null}
	<div className="ml-auto flex items-center gap-2">
		<Button variant="outline" size="sm" onClick={() => shift(-1)}>‹</Button>
		<Button variant="outline" size="sm" onClick={goToday}>Today</Button>
		<Button variant="outline" size="sm" onClick={() => shift(1)}>›</Button>
		<span className="text-sm font-medium">{rangeLabel}</span>
		<Button size="sm" onClick={() => openPanel(null)}>Add task</Button>
	</div>
</div>
```

`shift(direction)`: month view moves `anchor` by one UTC month (`Date.UTC(y, m + direction, 1)`); week view by `addDays(anchor, 7 * direction)`; timeline by 7 days. `rangeLabel`: month view `"September 2026"` via `Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" })`.

DndContext wraps the grid: sensors `useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))`, `collisionDetection={closestCorners}`, `<DragOverlay dropAnimation={null}>` rendering the bar body. `handleDragEnd`: target droppable id is a `dayKey`; read `event.active.data.current` for `{ startKey, spanDays }`; compute `delta = fromDayKey(targetKey).getTime() - fromDayKey(startKey).getTime()`; bail when 0; call `taskMove` with `startDay: addDays(task.startDay, deltaDays)`, `endDay: addDays(task.endDay, deltaDays)`, `sortOrder: 0` — using the optimistic `onMutate/onError/onSettled` mutation block copied VERBATIM from the old `project-board.tsx` (shown in the exploration; the optimistic setter updates the task's `startDay/endDay` in the cached `byId` payload). `onSettled: () => void cache.project(id)`.

- [ ] **Step 3: `calendar-grid.tsx`.** Props: `{ weeks: Date[][], tasksByLayout, view, today: string, goalKey: string | null, onDayClick, maxLanes }`. Month view `maxLanes = 4`, week view `maxLanes = 10`. Render per week row:

```tsx
<div className="grid grid-cols-7 border-b" style={{ minHeight: view === "week" ? "20rem" : "7.5rem" }}>
	{week.map((day) => (
		<DayCell key={dayKey(day)} day={day} ... />
	))}
	<div className="col-span-7 row-start-1 grid grid-cols-7 pt-7 pointer-events-none">
		{layoutWeek(scheduled, week[0], maxLanes).bars.map((bar) => (
			<TaskBar key={bar.task.id} bar={bar} weekStart={week[0]} />
		))}
	</div>
</div>
```

Implementation detail that MUST hold: each week row is ONE CSS grid with two layers — layer 1 the seven `DayCell` droppables (weekday number header, muted when outside the anchor month, "Today" ring on `dayKey === today`, goal flag row when `dayKey === goalKey`, `useDroppable({ id: dayKey(day) })`, `onClick` → `onDayClick(day)` opens the panel); layer 2 an absolutely-positioned (or `row-start-1` overlay, `pointer-events-none`) bar layer where each `TaskBar` sets `gridColumn: \`${bar.startCol + 1} / ${bar.endCol + 2}\`` and `marginTop: \`${bar.lane * 1.75}rem\`` with `pointer-events-auto` on the bar itself. Overflow: when `overflow[col] > 0` the cell footer renders a `Popover` trigger `+N more` listing every task covering that day (click-through to the edit popover).

A weekday header row (`Sun` … `Sat`) sits above the first week, `text-muted-foreground text-xs`.

- [ ] **Step 4: `task-bar.tsx`.** The draggable block:

```tsx
export function TaskBar({ bar, weekStart, projectId }: { bar: WeekBar<CalendarTask>; weekStart: Date; projectId: string }) {
	const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
		id: bar.task.id,
		data: { startKey: dayKey(bar.task.startDay) },
	});
	const colors = bar.task.crew
		? (CREW_COLOR_CLASSES[bar.task.crew.color] ?? NO_CREW_CLASSES)
		: NO_CREW_CLASSES;
	const done = bar.task.status === "DONE";
	return (
		<div
			ref={setNodeRef}
			data-board-drag=""
			style={{ gridColumn: `${bar.startCol + 1} / ${bar.endCol + 2}`, marginTop: `${bar.lane * 1.75}rem`, transform: CSS.Translate.toString(transform) }}
			className={cn(
				"pointer-events-auto flex h-6 items-center gap-1 truncate border px-1.5 text-xs rounded-sm touch-none select-none",
				colors.bar,
				done && "opacity-60",
				bar.clippedStart && "rounded-l-none border-l-0",
				bar.clippedEnd && "rounded-r-none border-r-0",
				isDragging && "opacity-40",
			)}
			{...attributes}
			{...listeners}
		>
			<TaskPopover projectId={projectId} task={bar.task}>
				<span className="truncate">{done ? "✓ " : ""}{bar.task.name}</span>
			</TaskPopover>
			{!bar.clippedEnd ? <ResizeHandle task={bar.task} projectId={projectId} /> : null}
		</div>
	);
}
```

`ResizeHandle`: a `w-1.5 cursor-ew-resize self-stretch` span on the bar's right edge. `onPointerDown` (stopPropagation so dnd-kit ignores it, `setPointerCapture`): record `startX` and the cell width (`event.currentTarget.closest("[data-week-row]")!.getBoundingClientRect().width / 7`); `onPointerMove` computes `deltaDays = Math.round((x - startX) / cellWidth)` and previews via local state; `onPointerUp` commits `taskMove({ id, startDay: task.startDay, endDay: clamp(addDays(task.endDay, deltaDays)), sortOrder: task.sortOrder })` where clamp keeps `endDay >= startDay` and span ≤ 30.

- [ ] **Step 5: Edit popover.** Rework `task-card.tsx` → keep only `TaskPopover` (rename of `TaskCardBody`, dnd wrapper deleted): existing name/note/assignee/status-cycle/delete controls stay verbatim; add a crew `Select` (options from `crews.list` where `!archived`, each item a `dot` span + name, "No crew" clears → `taskUpdate { crewId: null }`) and two `DatePicker`s (Start / End, values via `formatDay`; changing either calls `taskMove` with the adjusted pair — both `null` when clearing start; clearing only end sets `endDay = startDay`).

- [ ] **Step 6: `add-task-panel.tsx`.** `Sheet` + `SheetContent` (right side). Fields: name (`Input`, autofocus), Start/End `DatePicker`s (default from `defaultStartDay`, end mirrors start until touched), crew `Select`, assignee `Select` (options from the already-prefetched `users.list` — same source the old popover used), note (`Textarea`), status `Select` (default TODO). Footer: `Button` "Add task" (calls `taskCreate`, `onSuccess: cache.project(id)`; toast on error) + `Checkbox` "Create another" that keeps the sheet open and resets name/note only.

- [ ] **Step 7: `unscheduled-strip.tsx`.** Collapsible row (chevron button + `"Unscheduled · N"`, hidden entirely when N = 0) rendering task chips (`crew-colors` dot + name); a chip click opens its `TaskPopover` — setting a start date there schedules it.

- [ ] **Step 8: Wire the page.** `[id]/page.tsx`: replace `<ProjectBoard id={id} />` with `<CalendarView id={id} />`; add `queryClient.prefetchQuery(trpc.crews.list.queryOptions())`. Delete the four dead files. `cache.ts`: add

```ts
		crews: (options) =>
			run([trpc.crews.list.queryKey()], [trpc.projects.byId.queryKey()], options),
```

plus `crews(options?: Options): Promise<void>;` on the type.

- [ ] **Step 9: Verify** — root `bun run check-types` green; `bun run dev`; manually: create a 3-day task from the panel, see one bar across three cells, drag it forward a week (month view), resize by the handle, status-cycle in the popover, crew colour applies, "+N more" appears with 5 same-day tasks, unscheduled strip schedules a chip, ‹ › month nav + Today work, week view renders.

- [ ] **Step 10: Commit** — `git add -A apps/app && git commit -m "feat: replace project day board with month and week calendar"`

---

### Task 9: Timeline tab

**Files:**
- Create: `apps/app/app/(app)/[slug]/projects/[id]/timeline-view.tsx`
- Modify: `apps/app/app/(app)/[slug]/projects/[id]/calendar-view.tsx` (render it for `tab === "timeline"`)

**Interfaces:**
- Consumes: span-layout `dayKey/addDays/weekOf`, `CREW_COLOR_CLASSES`, `TaskPopover`, `usePanScroll` from `@/components/board/use-pan-scroll`.
- Produces: `TimelineView({ project, anchor })` — read-mostly Gantt strip.

- [ ] **Step 1: Implement.** Window: `start = weekOf(anchor)[0]`, 56 days (8 weeks), columns `w-10 shrink-0`. Structure: an outer `div` with `usePanScroll` (`ref` + spread `handlers`, `cursor-grab active:cursor-grabbing overflow-x-auto`), inside it a sticky header row of day columns (`LocalDay`-style weekday + date, weekend columns `bg-muted/40`, today column ringed) and one row per scheduled task sorted `startDay asc`: left rail `w-56 shrink-0 sticky left-0 bg-background` with crew dot + task name + status chip (chip cycles status exactly like the popover), then a relative track where the block is positioned `left: ${offsetDays * 2.5}rem; width: ${spanDays * 2.5}rem` with the bar classes from `crew-colors` and `data-board-drag=""` NOT set (no dragging here — clicking the block opens `TaskPopover`). Tasks entirely outside the window render in the rail with a muted "→ Sep 30" span instead of a block. Unscheduled tasks are excluded (the strip covers them).

- [ ] **Step 2: Verify** — typecheck; dev: switch tabs, pan the timeline by dragging the background, click a block → popover edits work, ‹ › pages the window by a week.

- [ ] **Step 3: Commit** — `git add apps/app && git commit -m "feat: project timeline tab"`

---

### Task 10: Settings › Crews page

**Files:**
- Create: `apps/app/app/(app)/[slug]/settings/crews/page.tsx`
- Create: `apps/app/app/(app)/[slug]/settings/crews/crews-table.tsx`
- Modify: `apps/app/app/(app)/[slug]/settings/settings-sidebar.tsx` (add `{ title: "Crews", href: `${ROOT}/crews` }` next to Price book)

**Interfaces:**
- Consumes: `crews.*` procedures, `CREW_COLOR_CLASSES`, `cache.crews`.
- Produces: the crew management surface Task 8's selects depend on for data entry.

- [ ] **Step 1: Page** — copy the settings-page pattern exactly (server `page.tsx` with `metadata`, `PageShell > PageShellHeader > PageShellHeading > PageShellTitle "Crews" / PageShellDescription "Name your crews and give each a colour. Tasks on the project calendar take their crew's colour."`, `Suspense` + `requireSession()` + prefetch `trpc.crews.list` + `HydrateClient` + `<div className="flex max-w-4xl flex-col gap-6"><CrewsTable /></div>`).

- [ ] **Step 2: `crews-table.tsx`** — client. `SimpleTable` rows: colour dot, name (inline `Input` edit on click, blur/Enter saves via `crews.update`), task count, archived `Badge`, row actions: recolour (a `Popover` of the 10 swatches as `button`s with the `dot` classes, click → `crews.update { color }`), Archive/Unarchive toggle, Delete (`AlertDialog`; on `ConflictException` message toast "Tasks still use this crew. Archive it instead."). Footer quick-add: name `Input` + swatch picker (default next unused colour) + "Add crew" → `crews.create`. Every mutation settles with `cache.crews()`.

- [ ] **Step 3: Verify** — typecheck; dev: add "Crew A" green + "Crew B" sky, rename, recolour, archive; calendar select hides archived. Commit — `git add apps/app && git commit -m "feat: settings crews page"`

---

### Task 11: Settings › Members — profit permission toggle

**Files:**
- Modify: `apps/app/app/(app)/[slug]/settings/members/members-table.tsx`
- Modify: `apps/app/app/(app)/[slug]/settings/members/page.tsx` (prefetch `trpc.permissions.listUsers` only when the viewer is an admin — mirror how the page already knows `isViewer`/role from `workspace.members`)

**Interfaces:**
- Consumes: `permissions.listUsers/grant/revoke/mine`, `PERMISSION_KEYS.profitView` literal `"profit.view"`.
- Produces: the admin toggle UI; nothing downstream.

- [ ] **Step 1: Implement.** In `members-table.tsx` add a "Can view profit" column. Data: `useQuery(trpc.permissions.listUsers.queryOptions(), { enabled: viewerIsAdmin })` (derive `viewerIsAdmin` from the existing `workspace.members` row for the session user — the table already renders role data). Cell: admins/owners render the muted text `Admin — always`; members render a `Switch` checked when `keys.includes("profit.view")`, flipping calls `permissions.grant`/`permissions.revoke { userId, key: "profit.view" }` optimistically, invalidating `trpc.permissions.listUsers.queryKey()` and `trpc.permissions.mine.queryKey()` on settle. Non-admin viewers see no column (`viewerIsAdmin` guards the header too). Under the table title add the one-line hint: "Per-user access controls will grow here."

- [ ] **Step 2: Verify** — typecheck; dev with two users (`bun run dev:session` recipe for the second): admin toggles a member on, member's session gains the profit strip (after Task 12 — for now assert `permissions.mine` returns the key via the network tab). Commit — `git add apps/app && git commit -m "feat: profit permission toggle on members page"`

---

### Task 12: Deal Costs tab, profit strip, receipt routes

**Files:**
- Create: `apps/app/lib/cost-receipts.ts` (disk helper, mirrors `drawing-thumbnails.ts`)
- Create: `apps/app/app/api/costs/receipt/route.ts` (POST upload)
- Create: `apps/app/app/api/costs/receipt/[costId]/route.ts` (GET serve, DELETE remove)
- Create: `apps/app/components/crm/record-sheet/deal-costs.tsx`
- Modify: `apps/app/components/crm/record-sheet/deal-sheet.tsx` (tab entry after `invoices`)
- Modify: `apps/app/lib/trpc/cache.ts` (add `costs` entry)
- Modify: `.env.example` (document `COSTS_DATA_DIR`, optional, defaults to `./data/costs/receipts`)
- Modify: `.gitignore` (add `data/costs`)

**Interfaces:**
- Consumes: `costs.*` + `permissions.mine` procedures.
- Produces: `DealCosts({ dealId, currency })` tab component; receipt URLs shaped `/api/costs/receipt/<costId>?v=<ts>`.

- [ ] **Step 1: Disk helper** `apps/app/lib/cost-receipts.ts` — copy `drawing-thumbnails.ts` structure with: `COST_RECEIPTS.defaultDirName = join("data", "costs", "receipts")`, env `COSTS_DATA_DIR`, `receiptFile(fileName: string)` path join, `saveReceipt(costId, ext, bytes): Promise<string | null>` returning the stored FILENAME `${costId}.${ext}`, `readReceipt(fileName): Promise<Buffer | null>`, `removeReceipt(fileName)` (`unlink`, swallow ENOENT). **Unlike the thumbnail routes, validate ids**: export `const COST_ID_PATTERN = /^[a-z0-9]{20,40}$/` and `const RECEIPT_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "application/pdf": "pdf" }` plus `contentTypeFor(fileName)` reversing it.

- [ ] **Step 2: Routes.** POST `apps/app/app/api/costs/receipt/route.ts`: session gate (401), formData `file` + `costId`; reject non-matching `COST_ID_PATTERN` (400), unknown `file.type` (400 "The receipt must be a PNG, JPEG, WebP or PDF."), `file.size > COSTS receipt max` (413 — hardcode `10 * 1024 * 1024` in a local const, same value as the api config); verify the cost row exists via `db` from `@crm/db` (`db.jobCost.findUnique({ where: { id: costId }, select: { receiptPath: true } })`, 404 when missing); when an old `receiptPath` exists with a different extension, `removeReceipt(old)`; `saveReceipt`, then `db.jobCost.update({ where: { id: costId }, data: { receiptPath: fileName } })` directly (the route owns the write — no second tRPC hop), return `{ url: \`/api/costs/receipt/${costId}?v=${Date.now()}\` }`. GET `[costId]/route.ts`: session gate → pattern check → look up `receiptPath` → `readReceipt` → 404 or bytes with `contentTypeFor` + `cache-control: private, max-age=31536000, immutable`. DELETE same file: session gate → pattern check → look up → `removeReceipt` + `db.jobCost.update({ data: { receiptPath: null } })` → `{ ok: true }`.

- [ ] **Step 3: `deal-costs.tsx`.** Client component. Queries: `costs.list { dealId }`, `permissions.mine`, and `costs.profitForDeal { dealId }` with `enabled: mine.data?.keys.includes("profit.view") ?? false` (NEVER fetched without the key). Layout top-down:
  - **Profit strip** (only when permitted): one row per `byCurrency` entry — `formatMoney` values labelled `Invoiced / Collected / Costs / Profit` + `marginPct` (via `formatPercent`), profit negative → `text-destructive`. Without permission: a single muted `Costs · <formatMoney(totalsByCurrency)>` line.
  - **Quick-add row**: `DatePicker` (default today), category `Select` (labels: Materials, Labor, Subcontractor, Equipment, Permits & fees, Other), amount `Input` (`inputMode="decimal"`, parsed `Math.round(Number(value) * 100)`, reject NaN/≤0 with a toast), note `Input`, "Log cost" `Button` → `costs.create`, then `cache.costs(dealId)`; a paperclip `label` with hidden `<input type="file" accept="image/png,image/jpeg,image/webp,application/pdf">` attaches AFTER create by POSTing to `/api/costs/receipt` with the new cost's id (create first, attach second — a failed upload leaves a valid cost).
  - **Ledger**: `SimpleTable` — date (`LocalDay`), category `Badge`, note, logged-by name, amount (`formatMoney(amountCents, currency)`), receipt: paperclip link (`href` GET route, `target="_blank"`) when `receiptPath`, else the attach `label` per row; row menu: edit (small `Popover` reusing the quick-add fields → `costs.update`), delete (`AlertDialog` → `costs.remove`; when the row had a receipt, fire `fetch(DELETE)` after success, ignore failures).
  `cache.ts` gains:

```ts
		costs: (dealId, options) =>
			run(
				[trpc.costs.list.queryKey({ dealId })],
				[trpc.costs.profitForDeal.queryKey({ dealId })],
				options,
			),
```

with type `costs(dealId: string, options?: Options): Promise<void>;`.

- [ ] **Step 4: Register the tab** in `deal-sheet.tsx` after `invoices`:

```tsx
				{
					value: "costs",
					label: "Costs",
					content: <DealCosts dealId={deal.id} />,
				},
```

- [ ] **Step 5: Calendar header link.** Modify `apps/app/app/(app)/[slug]/projects/[id]/project-header.tsx`: next to the existing deal link add a quiet "Job costs" link that opens the same deal record surface the deal link uses (reuse that exact navigation/handler; pass an initial tab of `"costs"` ONLY if `useRecordSheetView` accepts an initial value — check `apps/app/components/detail-sheet.tsx` first, otherwise land on the default tab and stop).

- [ ] **Step 6: Verify** — typecheck; dev: log a cost without a receipt (10-second path), attach a JPEG to another, open it, edit an amount, delete a row; profit strip correct against a SENT + PAID invoice pair; second (ungranted) user sees only the costs total; network tab shows no `profitForDeal` call for them. Commit — `git add -A && git commit -m "feat: deal cost ledger with receipts and profit strip"`

---

### Task 13: /reports page + nav

**Files:**
- Create: `apps/app/app/(app)/[slug]/reports/page.tsx`
- Create: `apps/app/app/(app)/[slug]/reports/reports-tabs.tsx`
- Modify: `apps/app/lib/janus-nav.ts`
- Modify: `apps/app/components/` nav renderer ONLY IF it cannot hide entries conditionally — check how `JANUS_NAV` is consumed first; hide the Reports entry when `permissions.mine` lacks the key (the nav is client-rendered; use the `mine` query where the nav maps entries, adding an optional `permission?: string` field to `JanusModule`).

**Interfaces:**
- Consumes: `reports.byClient/byMonth/byCategory`, `permissions.mine`, chart wrappers (`BarTrend` via the `ssr: false` dynamic wrapper `apps/app/components/dashboard-charts.tsx` — extend that wrapper to export `BarTrend` if it only exports `AreaTrend`/`DonutStat`), `formatMoney`/`formatMoneyCompact`.
- Produces: the reports surface. Nothing downstream.

- [ ] **Step 1: Nav.** Add to `JANUS_NAV` (after Projects):

```ts
	{
		title: "Reports",
		href: "/reports",
		match: "prefix",
		status: "live",
		icon: ChartColumn,
		source: "app/(app)/reports",
		permission: "profit.view",
	},
```

(`import ChartColumn from "@carbon/icons-react/es/ChartColumn";` — if that icon name does not exist in `@carbon/icons-react`, pick `Analytics`.) Add `permission?: string` to `JanusModule` and filter in the nav renderer against `permissions.mine` (entries without `permission` always render).

- [ ] **Step 2: Page.** Server `page.tsx`: `requireSession()`, then call `getServerTrpc().permissions.mine` — when the key is missing, `notFound()` (server-enforced, matching the API's own gate); otherwise prefetch the three report queries and render `<ReportsTabs />` under a `PageShell` header ("Reports", "Where the money went — by client, by month, by cost type.").

- [ ] **Step 3: `reports-tabs.tsx`.** `Tabs` with three `TabsContent`s:
  - **By client**: `SimpleTable` — client (links `/contacts?...` row-sheet pattern used elsewhere or plain text if no deep link exists — check how `projects-table` links deals and mirror it), jobs, invoiced, costs, profit (destructive when negative), margin. Currency column ONLY when >1 currency present in rows.
  - **By month**: `BarTrend` (or `BarStat` if `BarTrend` is unexported after all — whichever `dashboard-charts.tsx` exposes) with `invoiced`/`costs`/`profit` series over the 12 months for the primary (most frequent) currency, plus the full per-currency `SimpleTable` beneath.
  - **By category**: two `DatePicker`s (from/to, default empty = trailing 12 months) driving `reports.byCategory` input; `SimpleTable` of category totals with a percent-of-total column.
  All money through `formatMoney(cents, currency)`; empty states use the `Empty` component from `@crm/ui`.

- [ ] **Step 4: Verify** — typecheck; dev: admin sees Reports in nav + all three tabs with the seeded data; granted member sees it; ungranted member has no nav entry and `/reports` 404s. Commit — `git add apps/app && git commit -m "feat: profit reports page"`

---

### Task 14: Full gates + Playwright walkthrough

**Files:**
- Create: `<scratchpad>/walkthrough.mjs` (throwaway, NOT committed)

- [ ] **Step 1: Full gates** from repo root: `bun run check-types` (all packages), `cd apps/api && CRM_TELEMETRY_DISABLED=1 TEST_DATABASE_URL=<...janus_calendar_test> bun test --preload ./test/setup.ts` for the touched spec files (projects, crews, permissions, costs, reports — the full suite has pre-existing bulk/fields failures unrelated to this branch; run the five files explicitly), `cd apps/app && bun test lib/calendar/span-layout.test.ts`, and `bun run lint` if the repo defines it (check root package.json; biome).

- [ ] **Step 2: Playwright walkthrough** (script under NODE, dev servers freshly restarted first — stale Fast Refresh mimics regressions): login via the `dev:session` cookie recipe →
  1. Open a deal → Start project.
  2. Add task panel: "Tear-off", Sun–Tue span, Crew A → bar spans three cells.
  3. Drag the bar one week forward; reload; dates stuck.
  4. Resize handle +2 days; reload; endDay stuck.
  5. Week view renders; timeline tab shows the block; pan works.
  6. Log two costs (one with a JPEG receipt); ledger + totals correct.
  7. Profit strip matches invoiced − costs for the seeded invoices.
  8. Settings › Members: toggle profit OFF for a second user; their session: no strip, no Reports nav, `/reports` 404.
  9. Reports (admin): by-client row shows the deal's contact with the right profit; by-month current month populated; by-category matches the two costs.
  10. Settings › Crews: archive Crew A → hidden in the panel select, existing bar keeps its colour.

- [ ] **Step 3: Fix what the walkthrough catches, re-run, commit fixes individually.**

- [ ] **Step 4: Report merge-readiness** to Kyle with the branch head sha and the Issues list (ASD-STE100 format), and note for kyle-cc's merge train: migration `20260907000000_add_calendar_crews_costs_permissions` sequences after `20260906111122`; held DDL in `packages/db/prisma/held-ddl/` lands merge day; post-merge every session must `bun run db:generate` + restart.
