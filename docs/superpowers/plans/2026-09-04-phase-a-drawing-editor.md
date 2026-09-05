# Phase A: Drawing/Scope Editor Core — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Excalidraw-based drawing editor with whiteboard/image/satellite backgrounds, scale calibration, a measurement layer, drawing storage with versions, and drawings surfaced on jobs — the foundation Phases B–D build on.

**Architecture:** A new `packages/drawings` package owns the scene schema and measurement math (parse-at-the-boundary, shared by app and api). A new `apps/api/src/drawings` NestJS module is the tRPC data surface. The editor lives in `apps/app` as client components wrapping `@excalidraw/excalidraw`; the satellite tab is a separate MapLibre + Terra Draw surface persisted into the same Drawing row. Two canvases, one geometry contract.

**Tech Stack:** Excalidraw (MIT), MapLibre GL + Terra Draw + Turf.js (MIT/BSD), Prisma, nestjs-trpc, Next.js App Router, Bun test.

**Spec:** `docs/superpowers/specs/2026-09-04-scope-drawings-and-forms-design.md`

## Global Constraints

- **Never add code comments** (repo rule, AGENTS.md). The code blocks below contain none; keep it that way.
- **No `Co-Authored-By` trailer on any commit** (repo rule overrides any harness default).
- Commit messages: `feat: <what>` style. If a Median binding exists (`.median/config.json` present and `mdn` works), create/attach a task ID prefix; otherwise plain conventional commits.
- **Intelligence never lives in the API** — this phase has no AI features; do not anticipate Phase C by adding any to Nest.
- **Single tenant**: no `organizationId` anywhere; `WORKSPACE_ID` is a constant, never a parameter.
- **tRPC pattern**: one router per module — `*.contracts.ts` (zod), `*.router.ts` (thin, `@Router({ alias })` + `@UseMiddlewares(AuthMiddleware)` ), `*.service.ts` (Prisma + `HttpException` family). Lists take `listInput`, return `{ rows, total, facetCounts }`.
- **`apps/api/src/generated/server.ts` is committed; only `check-types` and `dev` regenerate it.** After adding a router, run `bun run check-types` from `apps/api` and commit the regenerated file.
- **Parse at the boundary**: every Prisma `Json` read goes through a Zod schema in `packages/drawings`. No `Record<string, unknown>` passed around.
- **Client/server split**: pages compute (server), client components render. `@crm/db`/`@crm/auth` never imported from a `"use client"` file.
- **UI**: shared shadcn components from `packages/ui` only; no className style overrides; radii from the scale (`rounded-sm/md/lg`).
- **Cache freshness**: every new mutation invalidates via `useCrmCache()` in `apps/app/lib/trpc/cache.ts` — add a `cache.drawing(id)` helper there, not key lists at call sites.
- **Optional capabilities never throw**: satellite mode requires `NEXT_PUBLIC_MAPTILER_API_KEY`; a missing key hides the Satellite tab, it never errors. Add the variable to `.env.example` with a note.
- **One `.env` at the repo root.**
- Constants go in one config module per area: `packages/drawings/src/config.ts`.
- Run repo checks before each commit: `bun run check-types` and `bun run lint` (biome) scoped to touched packages.
- Report issues in the ASD-STE100 `## Issues` list format (AGENTS.md).
- Before Task 3, read `.agents/skills/nestjs-trpc/` and `.agents/skills/prisma-database-setup/`. Before Task 4, read `.agents/skills/shadcn/` and `docs/design.md`.

---

### Task 1: Drawing + DrawingVersion Prisma models

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (append after the `Deal`-related models)
- Migration: generated under `packages/db/prisma/migrations/`

**Interfaces:**
- Produces: Prisma models `Drawing`, `DrawingVersion`, enum `DrawingBackground` — consumed by Task 3's service via `@crm/db`.

- [ ] **Step 1: Add models to schema.prisma**

```prisma
enum DrawingBackground {
  WHITEBOARD
  IMAGE
  SATELLITE
}

model Drawing {
  id           String            @id @default(cuid())
  title        String            @default("Untitled drawing")
  background   DrawingBackground @default(WHITEBOARD)
  scene        Json
  scale        Json?
  address      String?
  thumbnailUrl String?
  dealId       String?
  deal         Deal?             @relation(fields: [dealId], references: [id], onDelete: SetNull)
  contactId    String?
  contact      Contact?          @relation(fields: [contactId], references: [id], onDelete: SetNull)
  createdById  String
  createdBy    User              @relation("DrawingCreator", fields: [createdById], references: [id])
  versions     DrawingVersion[]
  createdAt    DateTime          @default(now())
  updatedAt    DateTime          @updatedAt

  @@index([dealId])
  @@index([contactId])
  @@index([updatedAt])
  @@map("drawing")
}

model DrawingVersion {
  id        String   @id @default(cuid())
  drawingId String
  drawing   Drawing  @relation(fields: [drawingId], references: [id], onDelete: Cascade)
  scene     Json
  scale     Json?
  createdAt DateTime @default(now())

  @@index([drawingId, createdAt])
  @@map("drawing_version")
}
```

Add the back-relations on the existing models: `drawings Drawing[]` on `Deal` and `Contact`; `drawings Drawing[] @relation("DrawingCreator")` on `User`.

- [ ] **Step 2: Run the migration**

Run from repo root (Postgres must be up — `C:\Users\Kyle\pg17\pgsql\bin\pg_ctl.exe -D C:\Users\Kyle\pg17\data start` if not):
`bun run db:migrate` (name it `add_drawings`)
Expected: migration applies, `prisma generate` regenerates the client.

- [ ] **Step 3: Verify types exist**

Run: `bun run check-types` from `packages/db`.
Expected: PASS, and `Drawing` is importable from the generated client.

- [ ] **Step 4: Commit**

```bash
git add packages/db/prisma
git commit -m "feat: add Drawing and DrawingVersion models"
```

---

### Task 2: `packages/drawings` — scene schema + measurement math

**Files:**
- Create: `packages/drawings/package.json`, `packages/drawings/tsconfig.json`, `packages/drawings/turbo.json`
- Create: `packages/drawings/src/config.ts`
- Create: `packages/drawings/src/scene.ts`
- Create: `packages/drawings/src/measure.ts`
- Create: `packages/drawings/src/index.ts`
- Test: `packages/drawings/test/measure.spec.ts`, `packages/drawings/test/scene.spec.ts`

**Interfaces:**
- Produces (all exported from `@crm/drawings`):
  - `drawingScene` zod schema + `parseDrawingScene(value: unknown): DrawingScene`
  - `drawingScale` zod schema + `parseDrawingScale(value: unknown): DrawingScale | null`
  - `type DrawingScene = { excalidraw: ExcalidrawSceneData; satellite: SatelliteScene | null }`
  - `type DrawingScale = { pixelsPerFoot: number; referenceElementId: string | null }`
  - `type ScopedShape = { scopeId: string; kind: "area" | "line" | "pin"; serviceId: string | null; label: string | null; pitch: PitchKey | null }`
  - `type MeasuredShape = ScopedShape & { quantity: { areaSqFt: number; squares: number } | { lengthFt: number } | { count: number } | null }`
  - `measureScene(scene: DrawingScene, scale: DrawingScale | null): MeasuredShape[]`
  - `polygonAreaSqFt(points: [number, number][], pixelsPerFoot: number): number`
  - `polylineLengthFt(points: [number, number][], pixelsPerFoot: number): number`
  - `PITCH_FACTORS`, `type PitchKey`, `SQFT_PER_SQUARE` from config
- Consumes: nothing from other tasks.

- [ ] **Step 1: Scaffold the package**

`packages/drawings/package.json` (mirror `packages/validation`'s shape):

```json
{
	"name": "@crm/drawings",
	"version": "0.0.0",
	"private": true,
	"type": "module",
	"exports": {
		".": "./src/index.ts"
	},
	"scripts": {
		"check-types": "tsc --noEmit",
		"lint": "biome check .",
		"test": "bun test"
	},
	"dependencies": {
		"zod": "^4.1.5"
	},
	"devDependencies": {
		"@crm/typescript-config": "workspace:*",
		"typescript": "5.9.2"
	}
}
```

Copy `packages/validation/tsconfig.json` and `turbo.json` as the base (match whatever they contain — read them first). Match the zod version to the one in `apps/api/package.json`.

- [ ] **Step 2: Write failing measurement tests**

`packages/drawings/test/measure.spec.ts`:

```ts
import { describe, expect, it } from "bun:test";
import {
	polygonAreaSqFt,
	polylineLengthFt,
	measureScene,
	PITCH_FACTORS,
} from "../src/index";

describe("polygonAreaSqFt", () => {
	it("measures a 100x50 px rectangle at 10 px/ft as 50 sqft", () => {
		const points: [number, number][] = [
			[0, 0],
			[100, 0],
			[100, 50],
			[0, 50],
		];
		expect(polygonAreaSqFt(points, 10)).toBeCloseTo(50);
	});

	it("is orientation independent", () => {
		const cw: [number, number][] = [
			[0, 0],
			[0, 50],
			[100, 50],
			[100, 0],
		];
		expect(polygonAreaSqFt(cw, 10)).toBeCloseTo(50);
	});
});

describe("polylineLengthFt", () => {
	it("measures a 3-4-5 triangle path", () => {
		const points: [number, number][] = [
			[0, 0],
			[30, 0],
			[30, 40],
		];
		expect(polylineLengthFt(points, 10)).toBeCloseTo(7);
	});
});

describe("measureScene", () => {
	it("returns null quantity when scale is missing", () => {
		const scene = {
			excalidraw: {
				elements: [
					{
						id: "r1",
						type: "rectangle",
						x: 0,
						y: 0,
						width: 100,
						height: 50,
						angle: 0,
						isDeleted: false,
						customData: { scopeId: "s1", kind: "area" },
					},
				],
				appState: {},
				files: {},
			},
			satellite: null,
		};
		const measured = measureScene(scene as never, null);
		expect(measured).toHaveLength(1);
		expect(measured[0]?.quantity).toBeNull();
	});

	it("applies pitch factor to area shapes", () => {
		const scene = {
			excalidraw: {
				elements: [
					{
						id: "r1",
						type: "rectangle",
						x: 0,
						y: 0,
						width: 1000,
						height: 1000,
						angle: 0,
						isDeleted: false,
						customData: { scopeId: "s1", kind: "area", pitch: "6/12" },
					},
				],
				appState: {},
				files: {},
			},
			satellite: null,
		};
		const measured = measureScene(scene as never, {
			pixelsPerFoot: 10,
			referenceElementId: null,
		});
		const q = measured[0]?.quantity;
		expect(q && "areaSqFt" in q ? q.areaSqFt : 0).toBeCloseTo(
			10000 * PITCH_FACTORS["6/12"],
		);
	});

	it("counts pins per service", () => {
		const pin = (id: string) => ({
			id,
			type: "ellipse",
			x: 0,
			y: 0,
			width: 24,
			height: 24,
			angle: 0,
			isDeleted: false,
			customData: { scopeId: id, kind: "pin", serviceId: "vent" },
		});
		const scene = {
			excalidraw: {
				elements: [pin("p1"), pin("p2")],
				appState: {},
				files: {},
			},
			satellite: null,
		};
		const measured = measureScene(scene as never, null);
		expect(measured).toHaveLength(2);
		expect(measured[0]?.quantity).toEqual({ count: 1 });
	});
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `bun test` from `packages/drawings`.
Expected: FAIL — module `../src/index` not found.

- [ ] **Step 4: Implement config, schema, and math**

`packages/drawings/src/config.ts`:

```ts
export const SQFT_PER_SQUARE = 100;

export const PITCH_FACTORS = {
	flat: 1.0,
	"3/12": 1.031,
	"4/12": 1.054,
	"5/12": 1.083,
	"6/12": 1.118,
	"7/12": 1.158,
	"8/12": 1.202,
	"9/12": 1.25,
	"10/12": 1.302,
	"12/12": 1.414,
} as const;

export type PitchKey = keyof typeof PITCH_FACTORS;

export const DRAWINGS = {
	autosave: { debounceMs: 2_000, versionEveryMs: 5 * 60_000 },
	thumbnail: { width: 640 },
	unattachedNudgeDays: 3,
} as const;
```

`packages/drawings/src/scene.ts`:

```ts
import { z } from "zod";
import { PITCH_FACTORS } from "./config";

const pitchKey = z.enum(
	Object.keys(PITCH_FACTORS) as [string, ...string[]],
);

export const scopeCustomData = z.object({
	scopeId: z.string().min(1),
	kind: z.enum(["area", "line", "pin"]),
	serviceId: z.string().min(1).nullish(),
	label: z.string().max(120).nullish(),
	pitch: pitchKey.nullish(),
});

export type ScopeCustomData = z.infer<typeof scopeCustomData>;

export const excalidrawElement = z
	.object({
		id: z.string(),
		type: z.string(),
		x: z.number(),
		y: z.number(),
		width: z.number().optional(),
		height: z.number().optional(),
		angle: z.number().optional(),
		isDeleted: z.boolean().optional(),
		points: z.array(z.tuple([z.number(), z.number()])).optional(),
		customData: z.record(z.string(), z.unknown()).optional(),
	})
	.loose();

export type ExcalidrawElement = z.infer<typeof excalidrawElement>;

export const excalidrawSceneData = z.object({
	elements: z.array(excalidrawElement),
	appState: z.record(z.string(), z.unknown()),
	files: z.record(z.string(), z.unknown()),
});

export type ExcalidrawSceneData = z.infer<typeof excalidrawSceneData>;

export const satelliteFeature = z.object({
	id: z.string(),
	kind: z.enum(["area", "line"]),
	coordinates: z.array(z.tuple([z.number(), z.number()])),
	scope: scopeCustomData.nullable(),
});

export type SatelliteFeature = z.infer<typeof satelliteFeature>;

export const satelliteScene = z.object({
	center: z.tuple([z.number(), z.number()]),
	zoom: z.number(),
	features: z.array(satelliteFeature),
});

export type SatelliteScene = z.infer<typeof satelliteScene>;

export const drawingScene = z.object({
	excalidraw: excalidrawSceneData,
	satellite: satelliteScene.nullable().default(null),
});

export type DrawingScene = z.infer<typeof drawingScene>;

export const drawingScale = z.object({
	pixelsPerFoot: z.number().positive(),
	referenceElementId: z.string().nullable().default(null),
});

export type DrawingScale = z.infer<typeof drawingScale>;

export function parseDrawingScene(value: unknown): DrawingScene {
	return drawingScene.parse(value);
}

export function parseDrawingScale(value: unknown): DrawingScale | null {
	if (value === null || value === undefined) return null;
	return drawingScale.parse(value);
}

export function emptyScene(): DrawingScene {
	return {
		excalidraw: { elements: [], appState: {}, files: {} },
		satellite: null,
	};
}
```

`packages/drawings/src/measure.ts`:

```ts
import { PITCH_FACTORS, type PitchKey, SQFT_PER_SQUARE } from "./config";
import {
	type DrawingScale,
	type DrawingScene,
	type ExcalidrawElement,
	type ScopeCustomData,
	scopeCustomData,
} from "./scene";

export type ScopedShape = {
	scopeId: string;
	kind: "area" | "line" | "pin";
	serviceId: string | null;
	label: string | null;
	pitch: PitchKey | null;
};

export type MeasuredQuantity =
	| { areaSqFt: number; squares: number }
	| { lengthFt: number }
	| { count: number };

export type MeasuredShape = ScopedShape & {
	quantity: MeasuredQuantity | null;
};

export function polygonAreaSqFt(
	points: [number, number][],
	pixelsPerFoot: number,
): number {
	let sum = 0;
	for (let i = 0; i < points.length; i++) {
		const [x1, y1] = points[i] as [number, number];
		const [x2, y2] = points[(i + 1) % points.length] as [number, number];
		sum += x1 * y2 - x2 * y1;
	}
	return Math.abs(sum / 2) / (pixelsPerFoot * pixelsPerFoot);
}

export function polylineLengthFt(
	points: [number, number][],
	pixelsPerFoot: number,
): number {
	let total = 0;
	for (let i = 1; i < points.length; i++) {
		const [x1, y1] = points[i - 1] as [number, number];
		const [x2, y2] = points[i] as [number, number];
		total += Math.hypot(x2 - x1, y2 - y1);
	}
	return total / pixelsPerFoot;
}

function shapePoints(element: ExcalidrawElement): [number, number][] {
	if (element.points && element.points.length > 1) {
		return element.points.map(([px, py]) => [
			element.x + px,
			element.y + py,
		]);
	}
	const w = element.width ?? 0;
	const h = element.height ?? 0;
	return [
		[element.x, element.y],
		[element.x + w, element.y],
		[element.x + w, element.y + h],
		[element.x, element.y + h],
	];
}

function scopeOf(element: ExcalidrawElement): ScopeCustomData | null {
	if (!element.customData) return null;
	const parsed = scopeCustomData.safeParse(element.customData);
	return parsed.success ? parsed.data : null;
}

function measureElement(
	element: ExcalidrawElement,
	scope: ScopeCustomData,
	scale: DrawingScale | null,
): MeasuredQuantity | null {
	if (scope.kind === "pin") return { count: 1 };
	if (!scale) return null;
	const points = shapePoints(element);
	if (scope.kind === "line") {
		return { lengthFt: polylineLengthFt(points, scale.pixelsPerFoot) };
	}
	const factor = scope.pitch
		? PITCH_FACTORS[scope.pitch as PitchKey]
		: 1;
	const areaSqFt =
		polygonAreaSqFt(points, scale.pixelsPerFoot) * factor;
	return { areaSqFt, squares: areaSqFt / SQFT_PER_SQUARE };
}

export function measureScene(
	scene: DrawingScene,
	scale: DrawingScale | null,
): MeasuredShape[] {
	const out: MeasuredShape[] = [];
	for (const element of scene.excalidraw.elements) {
		if (element.isDeleted) continue;
		const scope = scopeOf(element);
		if (!scope) continue;
		out.push({
			scopeId: scope.scopeId,
			kind: scope.kind,
			serviceId: scope.serviceId ?? null,
			label: scope.label ?? null,
			pitch: (scope.pitch as PitchKey | undefined) ?? null,
			quantity: measureElement(element, scope, scale),
		});
	}
	return out;
}
```

`packages/drawings/src/index.ts`:

```ts
export * from "./config";
export * from "./measure";
export * from "./scene";
```

- [ ] **Step 5: Write scene schema tests**

`packages/drawings/test/scene.spec.ts`:

```ts
import { describe, expect, it } from "bun:test";
import { emptyScene, parseDrawingScene, parseDrawingScale } from "../src/index";

describe("parseDrawingScene", () => {
	it("round-trips an empty scene", () => {
		const scene = parseDrawingScene(emptyScene());
		expect(scene.excalidraw.elements).toEqual([]);
		expect(scene.satellite).toBeNull();
	});

	it("rejects a scene with no excalidraw slot", () => {
		expect(() => parseDrawingScene({ satellite: null })).toThrow();
	});

	it("preserves unknown excalidraw element fields", () => {
		const scene = parseDrawingScene({
			excalidraw: {
				elements: [
					{
						id: "a",
						type: "freedraw",
						x: 1,
						y: 2,
						strokeColor: "#000",
						pressures: [0.5],
					},
				],
				appState: {},
				files: {},
			},
			satellite: null,
		});
		expect(
			(scene.excalidraw.elements[0] as Record<string, unknown>)
				.strokeColor,
		).toBe("#000");
	});
});

describe("parseDrawingScale", () => {
	it("returns null for null", () => {
		expect(parseDrawingScale(null)).toBeNull();
	});

	it("rejects a zero scale", () => {
		expect(() =>
			parseDrawingScale({ pixelsPerFoot: 0, referenceElementId: null }),
		).toThrow();
	});
});
```

- [ ] **Step 6: Install and run tests**

Run: `bun install` at repo root, then `bun test` from `packages/drawings`.
Expected: ALL PASS.

- [ ] **Step 7: Type-check and lint**

Run: `bun run check-types` and `bun run lint` from `packages/drawings`.
Expected: PASS (fix any biome formatting with `bun run format` at root).

- [ ] **Step 8: Commit**

```bash
git add packages/drawings package.json bun.lock
git commit -m "feat: add @crm/drawings scene schema and measurement math"
```

---

### Task 3: `drawings` API module

**Files:**
- Create: `apps/api/src/drawings/drawings.contracts.ts`
- Create: `apps/api/src/drawings/drawings.service.ts`
- Create: `apps/api/src/drawings/drawings.router.ts`
- Create: `apps/api/src/drawings/drawings.module.ts`
- Modify: `apps/api/src/app.module.ts` (import + register `DrawingsModule`)
- Modify: `apps/api/src/generated/server.ts` (regenerated by check-types, committed)
- Modify: `apps/api/package.json` (add `"@crm/drawings": "workspace:*"`)
- Test: `apps/api/test/drawings.contracts.spec.ts` (mirror wherever existing api tests live; if `apps/api` has no test dir, put contract tests in `packages/drawings/test/api-contracts.spec.ts` importing the schemas — check first)

**Interfaces:**
- Consumes: `@crm/db` Prisma client (Task 1 models), `parseDrawingScene`/`parseDrawingScale`/`emptyScene` from `@crm/drawings` (Task 2).
- Produces tRPC procedures under alias `drawings` (consumed by Tasks 4–8):
  - `drawings.list({ attachment: "all" | "deal" | "contact" | "unattached", dealId?, contactId?, ...listInput })` → `{ rows, total, facetCounts }`; rows are `{ id, title, background, thumbnailUrl, dealId, dealName, contactId, updatedAt }`
  - `drawings.byId({ id })` → full row with `scene`, `scale`, `address`
  - `drawings.create({ title?, background, dealId?, contactId?, address? })` → row (scene starts as `emptyScene()`)
  - `drawings.saveScene({ id, scene, scale? })` → `{ updatedAt }` (writes a `DrawingVersion` when the newest version is older than `DRAWINGS.autosave.versionEveryMs`)
  - `drawings.rename({ id, title })`, `drawings.attach({ id, dealId?, contactId? })`, `drawings.delete({ id })`
  - `drawings.versions({ id })` → `[{ id, createdAt }]`; `drawings.restoreVersion({ id, versionId })` → full row
  - `drawings.setThumbnail({ id, thumbnailUrl })`

- [ ] **Step 1: Read the required skill docs**

Read `.agents/skills/nestjs-trpc/` and one existing module end to end (`apps/api/src/deals/`) before writing anything.

- [ ] **Step 2: Write the contracts**

`apps/api/src/drawings/drawings.contracts.ts`:

```ts
import { DrawingBackground } from "@crm/db";
import { drawingScale, drawingScene } from "@crm/drawings";
import { z } from "zod";
import { listInput } from "../trpc/list-input";

const backgroundEnum = z.enum(
	Object.values(DrawingBackground) as [
		DrawingBackground,
		...DrawingBackground[],
	],
);

export const drawingListInput = listInput.extend({
	attachment: z
		.enum(["all", "deal", "contact", "unattached"])
		.default("all"),
	dealId: z.string().optional(),
	contactId: z.string().optional(),
});

export const drawingIdInput = z.object({ id: z.string().min(1) });

export const drawingCreateInput = z.object({
	title: z.string().trim().min(1).max(200).optional(),
	background: backgroundEnum.default("WHITEBOARD"),
	dealId: z.string().optional(),
	contactId: z.string().optional(),
	address: z.string().trim().max(500).optional(),
});

export const drawingSaveSceneInput = z.object({
	id: z.string().min(1),
	scene: drawingScene,
	scale: drawingScale.nullish(),
});

export const drawingRenameInput = z.object({
	id: z.string().min(1),
	title: z.string().trim().min(1, "A drawing needs a name.").max(200),
});

export const drawingAttachInput = z.object({
	id: z.string().min(1),
	dealId: z.string().nullable().optional(),
	contactId: z.string().nullable().optional(),
});

export const drawingRestoreVersionInput = z.object({
	id: z.string().min(1),
	versionId: z.string().min(1),
});

export const drawingSetThumbnailInput = z.object({
	id: z.string().min(1),
	thumbnailUrl: z.string().url(),
});
```

- [ ] **Step 3: Write the service**

`apps/api/src/drawings/drawings.service.ts` — follow `deals.service.ts` structure exactly (constructor-injected Prisma via the same pattern the repo uses; read it first). Behavior:

```ts
import { Injectable, NotFoundException } from "@nestjs/common";
import { DRAWINGS, emptyScene } from "@crm/drawings";
import type { z } from "zod";
import { PrismaService } from "../database/prisma.service";
import type {
	drawingAttachInput,
	drawingCreateInput,
	drawingListInput,
	drawingSaveSceneInput,
} from "./drawings.contracts";

@Injectable()
export class DrawingsService {
	constructor(private readonly prisma: PrismaService) {}

	async list(input: z.infer<typeof drawingListInput>) {
		const where = {
			...(input.attachment === "deal" ? { dealId: { not: null } } : {}),
			...(input.attachment === "contact"
				? { contactId: { not: null } }
				: {}),
			...(input.attachment === "unattached"
				? { dealId: null, contactId: null }
				: {}),
			...(input.dealId ? { dealId: input.dealId } : {}),
			...(input.contactId ? { contactId: input.contactId } : {}),
		};
		const [rows, total] = await Promise.all([
			this.prisma.drawing.findMany({
				where,
				orderBy: { updatedAt: "desc" },
				skip: input.offset,
				take: input.limit,
				select: {
					id: true,
					title: true,
					background: true,
					thumbnailUrl: true,
					dealId: true,
					contactId: true,
					updatedAt: true,
					deal: { select: { name: true } },
				},
			}),
			this.prisma.drawing.count({ where }),
		]);
		return {
			rows: rows.map((r) => ({ ...r, dealName: r.deal?.name ?? null })),
			total,
			facetCounts: {},
		};
	}

	async byId(id: string) {
		const row = await this.prisma.drawing.findUnique({ where: { id } });
		if (!row) throw new NotFoundException("Drawing not found");
		return row;
	}

	async create(
		input: z.infer<typeof drawingCreateInput>,
		userId: string,
	) {
		return this.prisma.drawing.create({
			data: {
				title: input.title ?? "Untitled drawing",
				background: input.background,
				scene: emptyScene(),
				dealId: input.dealId,
				contactId: input.contactId,
				address: input.address,
				createdById: userId,
			},
		});
	}

	async saveScene(input: z.infer<typeof drawingSaveSceneInput>) {
		const latest = await this.prisma.drawingVersion.findFirst({
			where: { drawingId: input.id },
			orderBy: { createdAt: "desc" },
			select: { createdAt: true },
		});
		const needsVersion =
			!latest ||
			Date.now() - latest.createdAt.getTime() >
				DRAWINGS.autosave.versionEveryMs;
		const [updated] = await this.prisma.$transaction([
			this.prisma.drawing.update({
				where: { id: input.id },
				data: { scene: input.scene, scale: input.scale ?? undefined },
				select: { updatedAt: true },
			}),
			...(needsVersion
				? [
						this.prisma.drawingVersion.create({
							data: {
								drawingId: input.id,
								scene: input.scene,
								scale: input.scale ?? undefined,
							},
						}),
					]
				: []),
		]);
		return updated;
	}
}
```

Add `rename`, `attach` (nulling one side when the other is set is allowed; both may be null), `delete` (hard delete; versions cascade), `versions`, `restoreVersion` (copies the version's scene/scale onto the drawing inside a transaction and writes a new version), `setThumbnail`. Translate `P2025` to 404 the way `deals.service.ts` does (find and reuse its `translate` helper or equivalent).

- [ ] **Step 4: Write the router and module**

`apps/api/src/drawings/drawings.router.ts` — mirror `deals.router.ts`: `@Router({ alias: "drawings" })`, `@UseMiddlewares(AuthMiddleware)`, one method per procedure, zod input from contracts, service call only. The `create` procedure reads the user id from `AuthedTrpcContext` via `@Ctx()` the same way existing routers do (find one that uses `ctx.user.id` and copy the pattern).

`apps/api/src/drawings/drawings.module.ts`:

```ts
import { Module } from "@nestjs/common";
import { DrawingsRouter } from "./drawings.router";
import { DrawingsService } from "./drawings.service";

@Module({
	providers: [DrawingsRouter, DrawingsService],
})
export class DrawingsModule {}
```

Register `DrawingsModule` in `apps/api/src/app.module.ts` imports, alphabetically beside `DealsModule`. If `deals.module.ts` imports `DatabaseModule` or providers, mirror it.

- [ ] **Step 5: Regenerate the tRPC server types**

Run: `bun run check-types` from `apps/api`.
Expected: PASS, and `apps/api/src/generated/server.ts` now contains the `drawings` router.

- [ ] **Step 6: Contract tests**

Check where existing api zod tests live (`Get-ChildItem apps/api -Filter *.spec.ts -Recurse`). Write tests asserting: `drawingSaveSceneInput` rejects a scene missing `excalidraw`; `drawingRenameInput` rejects an empty title; `drawingListInput` defaults `attachment` to `"all"`. Run them with the repo's api test command.
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/drawings apps/api/src/app.module.ts apps/api/src/generated/server.ts apps/api/package.json bun.lock
git commit -m "feat: add drawings tRPC module"
```

---

### Task 4: Editor shell — Excalidraw embed with autosave

**Files:**
- Modify: `apps/app/package.json` (add `@excalidraw/excalidraw`)
- Create: `apps/app/app/(app)/[slug]/drawings/page.tsx` (list — filled in Task 6, stub now)
- Create: `apps/app/app/(app)/[slug]/drawings/[drawingId]/page.tsx` (server page)
- Create: `apps/app/components/drawings/drawing-editor.tsx` (client)
- Create: `apps/app/components/drawings/use-drawing-autosave.ts`
- Modify: `apps/app/lib/trpc/cache.ts` (add `drawing(id)` invalidation helper)
- Modify: `apps/app/lib/janus-nav.ts` (add Drawings nav entry — read the file first and follow its shape)

**Interfaces:**
- Consumes: `drawings.byId`, `drawings.saveScene`, `drawings.create` (Task 3); `parseDrawingScene`, `DRAWINGS` config (Task 2).
- Produces: `<DrawingEditor drawing={...} slug={...} />` client component and the `/[slug]/drawings/[drawingId]` route; `onSceneChange` plumbing that Tasks 5, 7, 8 extend.

- [ ] **Step 1: Read `docs/design.md` and `.agents/skills/shadcn/`**

- [ ] **Step 2: Install Excalidraw**

Run from `apps/app`: `bun add @excalidraw/excalidraw`
(Defender EPERM on bun cache is a known machine issue — retry, then manual cache extract per `C:\Users\Kyle\.claude\projects\C--Users-Kyle\memory\project_crm_test_setup.md`.)

- [ ] **Step 3: Server page**

`apps/app/app/(app)/[slug]/drawings/[drawingId]/page.tsx` — follow the repo's existing detail-page pattern (read `deals/[dealId]/page.tsx` first): resolve session/access the same way, fetch via the server tRPC caller (`apps/app/lib/trpc/server.ts`), parse with `parseDrawingScene`/`parseDrawingScale`, and hand plain data to the client component:

```tsx
import { notFound } from "next/navigation";
import {
	parseDrawingScale,
	parseDrawingScene,
} from "@crm/drawings";
import { DrawingEditor } from "../../../../../components/drawings/drawing-editor";
import { serverTrpc } from "../../../../../lib/trpc/server";

export default async function DrawingPage({
	params,
}: {
	params: Promise<{ slug: string; drawingId: string }>;
}) {
	const { slug, drawingId } = await params;
	const row = await serverTrpc.drawings.byId({ id: drawingId }).catch(() => null);
	if (!row) notFound();
	return (
		<DrawingEditor
			slug={slug}
			drawingId={row.id}
			title={row.title}
			background={row.background}
			address={row.address}
			initialScene={parseDrawingScene(row.scene)}
			initialScale={parseDrawingScale(row.scale)}
		/>
	);
}
```

Adjust import names to the actual exports in `lib/trpc/server.ts` — read it, do not guess.

- [ ] **Step 4: Client editor**

`apps/app/components/drawings/drawing-editor.tsx` — `"use client"`; Excalidraw must load client-side only:

```tsx
"use client";

import dynamic from "next/dynamic";
import { useCallback, useRef, useState } from "react";
import type {
	DrawingScale,
	DrawingScene,
} from "@crm/drawings";
import { useDrawingAutosave } from "./use-drawing-autosave";

const Excalidraw = dynamic(
	async () => (await import("@excalidraw/excalidraw")).Excalidraw,
	{ ssr: false },
);

export type DrawingEditorProps = {
	slug: string;
	drawingId: string;
	title: string;
	background: "WHITEBOARD" | "IMAGE" | "SATELLITE";
	address: string | null;
	initialScene: DrawingScene;
	initialScale: DrawingScale | null;
};

export function DrawingEditor(props: DrawingEditorProps) {
	const [scale, setScale] = useState(props.initialScale);
	const sceneRef = useRef(props.initialScene);
	const { queueSave, saving } = useDrawingAutosave(
		props.drawingId,
		sceneRef,
		scale,
	);

	const onChange = useCallback(
		(elements: readonly unknown[], appState: unknown, files: unknown) => {
			sceneRef.current = {
				...sceneRef.current,
				excalidraw: {
					elements: elements as never,
					appState: appState as never,
					files: files as never,
				},
			};
			queueSave();
		},
		[queueSave],
	);

	return (
		<div className="flex h-full flex-col">
			<div className="h-full min-h-0 flex-1">
				<Excalidraw
					initialData={{
						elements: props.initialScene.excalidraw.elements as never,
						files: props.initialScene.excalidraw.files as never,
					}}
					onChange={onChange}
				/>
			</div>
		</div>
	);
}
```

`use-drawing-autosave.ts` debounces `DRAWINGS.autosave.debounceMs` then calls the `drawings.saveScene` mutation via the repo's tRPC client hooks (read `lib/trpc/client.tsx` for the exact `useMutation` idiom), stripping `appState` down to persistable keys (drop `collaborators`, transient selection state) before sending. On success invalidate via `useCrmCache().drawing(props.drawingId)`.

- [ ] **Step 5: Add the cache helper**

In `apps/app/lib/trpc/cache.ts`, add a `drawing(id)` method beside `deal(id)` following the same shape (invalidates `drawings.byId` for the id and `drawings.list`).

- [ ] **Step 6: Verify in the browser**

Run `bun run dev` at root. Create a drawing row directly (temporary: `drawings.create` from the app console or a quick list-page button), open `/[slug]/drawings/<id>`, draw shapes, wait 2s, reload — the drawing persists.
Expected: scene survives reload; no console errors; navigating away and back shows saved content.

- [ ] **Step 7: check-types, lint, commit**

```bash
bun run check-types && bun run lint
git add apps/app package.json bun.lock
git commit -m "feat: add drawing editor route with Excalidraw and autosave"
```

---

### Task 5: Scale calibration, Scope/Pin marking, measurement panel

**Files:**
- Create: `apps/app/components/drawings/scale-dialog.tsx`
- Create: `apps/app/components/drawings/scope-panel.tsx`
- Create: `apps/app/components/drawings/use-scoped-shapes.ts`
- Modify: `apps/app/components/drawings/drawing-editor.tsx`
- Test: `packages/drawings/test/measure.spec.ts` (extend if new math emerges — pin placement needs none)

**Interfaces:**
- Consumes: `measureScene`, `PITCH_FACTORS`, `scopeCustomData` (Task 2); the editor shell (Task 4).
- Produces: the scope-marking UX Phase B's service-tagging attaches to; `useScopedShapes(sceneRef, scale)` returning `MeasuredShape[]` recomputed on change.

- [ ] **Step 1: Scale calibration flow**

In `drawing-editor.tsx` add a "Set scale" button (shared `Button` from `@crm/ui`, `variant="outline"`). Flow: clicking arms calibration mode → user draws or selects a line element → `scale-dialog.tsx` (shared `Dialog` + `Input`) asks "How long is this line in feet?" → compute `pixelsPerFoot = pixelLength / enteredFeet` from the selected element's points via `polylineLengthFt(points, 1)` → `setScale({ pixelsPerFoot, referenceElementId })` → autosave picks it up (scale rides on `saveScene`).

- [ ] **Step 2: Mark-as-scope actions**

Add toolbar actions (rendered via Excalidraw's `renderTopRightUI` prop or a Janus toolbar above the canvas — whichever fits the design rules; keep all styling from `@crm/ui`):
- **Mark area / Mark line**: takes the current selection (`excalidrawAPI.getSceneElements()` + `getAppState().selectedElementIds`), stamps `customData` with `{ scopeId: crypto.randomUUID(), kind }` via `excalidrawAPI.updateScene`, preserving all other element fields.
- **Pin**: inserts a small ellipse element (24×24) at the viewport center with `customData: { scopeId, kind: "pin" }`; user drags it into place. Store the excalidrawAPI instance from the `excalidrawAPI` callback prop.

- [ ] **Step 3: Measurement panel**

`use-scoped-shapes.ts` recomputes `measureScene(sceneRef.current, scale)` on a 500ms interval while the editor is focused (cheap: pure math over the element array), returning `MeasuredShape[]`. `scope-panel.tsx` renders a right-side panel (shared `Sheet` or plain flex column per design rules) listing each scoped shape: kind icon, editable label, quantity ("24.3 sq" / "182 ln ft" / pin count grouped), pitch selector (`Select` fed from `Object.keys(PITCH_FACTORS)`) for area shapes, and an "unmeasured — set scale" hint when quantity is null. Label and pitch edits write back into the element's `customData` via `updateScene` so they persist in the scene JSON.

- [ ] **Step 4: Browser verification**

Draw a rectangle over a known reference, set scale with a line, mark the rectangle as area, pick a pitch.
Expected: panel shows area in sq ft and squares; changing pitch changes the number by the factor table; reload persists labels, pitch, and scale.

- [ ] **Step 5: check-types, lint, commit**

```bash
git add apps/app
git commit -m "feat: add scale calibration, scope marking, and measurement panel"
```

---

### Task 6: Drawings list, deal tab, attach flow, thumbnails

**Files:**
- Modify: `apps/app/app/(app)/[slug]/drawings/page.tsx` (real list)
- Create: `apps/app/components/drawings/drawing-grid.tsx`, `apps/app/components/drawings/new-drawing-menu.tsx`, `apps/app/components/drawings/attach-drawing-dialog.tsx`
- Modify: deal detail to add a Drawings tab — read `apps/app/app/(app)/[slug]/deals/[dealId]/` first and follow its tab pattern exactly
- Modify: `apps/app/components/drawings/drawing-editor.tsx` (thumbnail export on save)

**Interfaces:**
- Consumes: `drawings.list`, `drawings.create`, `drawings.attach`, `drawings.rename`, `drawings.delete`, `drawings.setThumbnail` (Task 3).
- Produces: `/[slug]/drawings` grid; `DrawingGrid` reused by the deal tab with a `dealId` filter.

- [ ] **Step 1: List page + grid**

`drawings/page.tsx` (server) fetches `drawings.list` and renders `DrawingGrid` (client): thumbnail cards (`img` of `thumbnailUrl`, placeholder tile when null), title, "on <dealName>" line, updated-at, attachment filter tabs (All / On a job / Unattached), and `NewDrawingMenu` — a `DropdownMenu` offering Whiteboard / From photo / Satellite / Quick note (Quick note = whiteboard created and opened immediately with pen active; pass `?tool=freedraw` and have the editor read it via nuqs — the repo has a nuqs skill, read it).

- [ ] **Step 2: Deal tab**

Add a Drawings tab to the deal detail following the existing tab structure, rendering `DrawingGrid` filtered to the deal plus a New-drawing button that passes `dealId` into `drawings.create`.

- [ ] **Step 3: Attach dialog**

`attach-drawing-dialog.tsx`: from a card's overflow menu, "Attach to job…" opens a dialog with a deal picker (find the existing deal-picker/combobox the app uses — search for how `deals.list` or `deals.contactOptions` feeds pickers — and reuse it), calling `drawings.attach`. Include "Detach" when attached. Invalidate `cache.drawing(id)` on success.

- [ ] **Step 4: Thumbnails**

On each successful autosave at most once per minute, export a PNG via Excalidraw's `exportToBlob({ elements, files, maxWidthOrHeight: DRAWINGS.thumbnail.width })`, upload it through the app's existing blob upload path (find how images are uploaded today — `packages/db/src/blob.ts` is the server side; locate the app-side upload route or add a small one modeled on it), then call `drawings.setThumbnail`.

- [ ] **Step 5: Browser verification**

Create drawings from all menu entries, attach one to a deal, see it under the deal tab, verify thumbnails appear on the grid after edits.
Expected: all flows work; unattached filter shows only unattached.

- [ ] **Step 6: check-types, lint, commit**

```bash
git add apps/app
git commit -m "feat: add drawings list, deal tab, attach flow, and thumbnails"
```

---

### Task 7: Image background mode

**Files:**
- Modify: `apps/app/components/drawings/drawing-editor.tsx`
- Create: `apps/app/components/drawings/use-background-image.ts`

**Interfaces:**
- Consumes: editor shell (Task 4), Excalidraw image element support.
- Produces: "Set background photo" action available in every drawing.

- [ ] **Step 1: Background image action**

"Set background photo" button → file input (accept `image/*`) → insert as a native Excalidraw image element (`excalidrawAPI.addFiles` with the dataURL, then insert an image element referencing the `fileId`), scaled to fit the viewport, `locked: true`, and moved to the back of the element order. Locked keeps pen strokes from selecting it; Excalidraw persists the file in `files`, which our scene schema already carries.

- [ ] **Step 2: Browser verification**

Insert a photo, sketch over it, set scale against a known feature in the photo, mark an area.
Expected: image sits behind ink, survives reload (files persist through `saveScene`), measurements work.

- [ ] **Step 3: check-types, lint, commit**

```bash
git add apps/app
git commit -m "feat: add image background mode to drawing editor"
```

---

### Task 8: Satellite tab — MapLibre + Terra Draw + Turf

**Files:**
- Modify: `apps/app/package.json` (add `maplibre-gl`, `terra-draw`, `terra-draw-maplibre-gl-adapter`, `@turf/area`, `@turf/length`)
- Create: `apps/app/components/drawings/satellite-canvas.tsx`
- Create: `apps/app/components/drawings/use-satellite-features.ts`
- Modify: `apps/app/components/drawings/drawing-editor.tsx` (Sketch / Satellite tab switch)
- Modify: `apps/app/components/drawings/scope-panel.tsx` (satellite shapes appear in the same panel)
- Modify: `.env.example` (add `NEXT_PUBLIC_MAPTILER_API_KEY` with a note: optional; missing key hides the Satellite tab)
- Test: `packages/drawings/test/satellite.spec.ts`

**Interfaces:**
- Consumes: `satelliteScene`/`satelliteFeature` schema (Task 2), scope panel (Task 5), autosave (Task 4).
- Produces: `measureSatellite(features: SatelliteFeature[]): MeasuredShape[]` added to `packages/drawings` (geodesic quantities computed app-side with Turf and stored on the feature at draw time as `{ areaSqFt }`/`{ lengthFt }` — the pure function only converts stored quantities + pitch into `MeasuredShape[]`, so it stays dependency-free and testable).

- [ ] **Step 1: Extend `packages/drawings` for satellite measurement**

Add to `satelliteFeature` schema a `measured` slot: `z.object({ areaSqFt: z.number() }).or(z.object({ lengthFt: z.number() })).nullable()`. Write `measureSatellite` in `src/measure.ts`: maps features → `MeasuredShape[]`, applying `PITCH_FACTORS` to areas exactly as `measureElement` does. Failing test first in `test/satellite.spec.ts`:

```ts
import { describe, expect, it } from "bun:test";
import { measureSatellite, PITCH_FACTORS } from "../src/index";

describe("measureSatellite", () => {
	it("applies pitch to a measured roof area", () => {
		const shapes = measureSatellite([
			{
				id: "f1",
				kind: "area",
				coordinates: [
					[-86.8, 33.5],
					[-86.79, 33.5],
					[-86.79, 33.51],
				],
				measured: { areaSqFt: 2000 },
				scope: {
					scopeId: "f1",
					kind: "area",
					serviceId: null,
					label: "Main roof",
					pitch: "8/12",
				},
			},
		]);
		const q = shapes[0]?.quantity;
		expect(q && "areaSqFt" in q ? q.areaSqFt : 0).toBeCloseTo(
			2000 * PITCH_FACTORS["8/12"],
		);
	});
});
```

Run `bun test` (fails), implement, run again (passes), then `bun run check-types`.

- [ ] **Step 2: Satellite canvas component**

`satellite-canvas.tsx` (`"use client"`): MapLibre map with MapTiler satellite style (`https://api.maptiler.com/maps/hybrid/style.json?key=${key}`), centered from `drawing.address` geocoded via MapTiler geocoding API (`https://api.maptiler.com/geocoding/${encodeURIComponent(address)}.json?key=${key}`) on first open, falling back to a US-center view when no address. Terra Draw with polygon + linestring modes via the maplibre adapter. On every draw/edit finish: compute `areaSqFt` (`@turf/area` × 10.7639) or `lengthFt` (`@turf/length` in feet) and store the feature into `sceneRef.current.satellite`, then `queueSave()`. Read `NEXT_PUBLIC_MAPTILER_API_KEY` via the repo's env pattern (`apps/app/lib/env.ts` — read it first); when absent, the tab does not render.

- [ ] **Step 3: Tab switch + shared panel**

Editor header gets a `Tabs` control (shared component): Sketch / Satellite. Satellite features flow into `useScopedShapes` output by concatenating `measureSatellite(scene.satellite?.features ?? [])`, so the scope panel lists both surfaces' shapes uniformly — one geometry contract, proven here.

- [ ] **Step 4: Browser verification**

Open a drawing with a real address, land on the satellite view, trace a roof outline and an eave line.
Expected: panel shows sq-ft area (with pitch selector) and linear-ft; reload persists features; removing the env key hides the tab without errors.

- [ ] **Step 5: check-types, lint, commit**

```bash
git add apps/app packages/drawings .env.example package.json bun.lock
git commit -m "feat: add satellite scoping surface with MapLibre and Terra Draw"
```

---

### Task 9: Final integration pass

**Files:**
- Modify: whatever the pass surfaces.

- [ ] **Step 1: Full repo checks**

Run at root: `bun run check-types`, `bun run lint`, `bun run test --concurrency=1`, `bun run build`.
Expected: ALL PASS. Fix anything that fails before proceeding.

- [ ] **Step 2: End-to-end walkthrough**

Whiteboard note → promote (set scale) → mark area + pins → attach to a deal → open from the deal tab → satellite trace on the same drawing → all shapes in one panel → thumbnail on the grid.
Expected: the full Phase A loop works with no console errors.

- [ ] **Step 3: Update the spec status and commit**

Append to the spec's Status line: "Phase A implemented <date>." Commit:

```bash
git add -A
git commit -m "feat: complete Phase A drawing editor core"
```

---

## Self-review notes (already applied)

- Spec coverage: Section 1 fully covered (Tasks 1–8); Section 3's notepad = Quick-note entry (Task 6) — field-mode (`/field`) wiring deferred because that route is an empty directory today; flagged as NOT DONE for the executor's issue list. Sections 2/4 are Phases B/D, out of scope by design.
- The "waiting on you" unattached-notes nudge (spec §3) requires the Janus agent layer — deferred to Phase C with the rest of agent behavior.
- Type consistency: `MeasuredShape`, `DrawingScene`, `DrawingScale`, procedure names checked across tasks.
