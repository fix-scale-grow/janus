# Phase B: Price Book + Quote-from-Drawing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Phase A's measured drawings into money — a price book of services, service tagging on scoped shapes and symbol pins, an Estimate entity with a Good/Better/Best builder UI, and one-button estimate generation from a drawing with re-sync.

**Architecture:** Three new Prisma models (Service, Estimate, EstimateLineItem) with two new tRPC modules (`services`, `estimates`). Quantity math lives in `@crm/drawings` (shared, pure) so `estimates.generateFromDrawing` measures the scene server-side. The Janus symbol library's elements get stamped with a `symbol` customData key so placed symbols auto-resolve to services via the Service.symbolId column. The builder UI is new app code whose design contract is the v0 suite's estimate screens.

**Tech Stack:** Prisma, nestjs-trpc, Next.js App Router, `@crm/drawings`, Bun test.

**Spec:** `docs/superpowers/specs/2026-09-04-scope-drawings-and-forms-design.md` (Section 2). **Spec deviation, ruled during planning:** the spec says estimates open "in the existing Good/Better/Best estimate builder" — no such builder exists in the live app (it lives only in `design/v0-suite`). This plan therefore BUILDS the estimate entity and builder; the v0 suite files `design/v0-suite/app/(app)/estimates/page.tsx` and `design/v0-suite/app/(app)/estimates/[id]/page.tsx` are the DESIGN REFERENCE (layout, information hierarchy, GBB tier interaction), not code to copy — they use a different component dialect. Never import from or modify `design/`.

## Global Constraints

- **Never add code comments** (repo rule, AGENTS.md). **No `Co-Authored-By` trailer on any commit.** Tabs + biome; `bun run format` at root fixes style (then `git restore design/` — the formatter sweeps the v0 suite; never commit design/ churn).
- Commit style: `feat:`/`fix:` conventional messages.
- **Intelligence never lives in the API** — no AI suggestions in this phase (auto-tag/missing-item flags are Phase C, in `apps/agent`). `generateFromDrawing` is deterministic math, which is allowed.
- **Single tenant**: no organizationId; `WORKSPACE_ID` constant only; user id from `AuthedTrpcContext`, never input.
- **tRPC pattern**: one router per module — `*.contracts.ts` (zod), `*.router.ts` (thin, `@Router({ alias })` + class-level `@UseMiddlewares(AuthMiddleware)`), `*.service.ts` (Prisma via `InjectDatabase()`, Nest `HttpException` family, P2025→404 via a `translate` helper copied from `deals.service.ts`). Lists take `listInput` (page/pageSize + `paginate()` from `apps/api/src/trpc/list-input.ts`) and return `{ rows, total, facetCounts }`.
- **`apps/api/src/generated/server.ts` is committed; only `check-types` and `dev` regenerate it.** After adding a router, run `bun run check-types` from `apps/api` and commit the regenerated file.
- **Money:** read `docs/currency.md` before touching any amount. All Phase B money is **integer cents** (`Int` columns, `*Cents` names) in a single currency per estimate — never floats, never Decimal math in TS. Estimates inherit `currency` from their deal when attached, else `"USD"` default (mirroring `Deal.currency @default("USD")`). Summing cents within one estimate is fine; the deals `baseAmount` reporting rules are untouched by this phase.
- **Parse at the boundary**: Json reads through Zod schemas in `@crm/drawings`; no `Record<string, unknown>` passed around.
- **Client/server split**: pages compute (server), client components render; no `@crm/db`/`@crm/auth` in `"use client"` files (`@crm/drawings` and `@crm/db/images` are allowed — precedented).
- **UI**: shared shadcn components from `packages/ui` only; no color/radius/shadow overrides; `rounded-lg` for control-bearing surfaces. Any component reading URL state (nuqs/useParams/usePathname) rendered by a server page must be wrapped in `<Suspense>` (house pattern: dashboard page's `OverviewScopeToggle`).
- **Cache freshness**: new mutations invalidate via `useCrmCache()` helpers added in `apps/app/lib/trpc/cache.ts` — add `service()` and `estimate(id)` helpers beside `drawing(id)`; never key lists at call sites.
- Constants go in config objects: drawing-related in `DRAWINGS` (`packages/drawings/src/config.ts`); estimate-related in a new `ESTIMATES` object in `apps/api/src/estimates/estimates.config.ts` only if a tunable actually appears (YAGNI).
- Run `bun run check-types` and `bun run lint` at root before each commit. Live browser verification recipe (used by the final task): Postgres `C:\Users\Kyle\pg17\pgsql\bin\pg_ctl.exe -D C:\Users\Kyle\pg17\data -l C:\Users\Kyle\pg17\pg.log status`; dev server `bunx turbo run dev --filter=app --filter=api` (NOT `bun run dev` — the agent task needs a TUI and fails); session cookie `bun run dev:session karlosantanas@gmail.com` from `apps/api`; Playwright via NODE from `.superpowers/sdd/satellite-verify/` (has node_modules).
- Report issues in the ASD-STE100 `## Issues` list format (AGENTS.md).
- Before API tasks read `docs/api.md` + `.agents/skills/nestjs-trpc/`; before UI tasks read `docs/design.md` + `.agents/skills/shadcn/` + `.agents/skills/nuqs/`.

## Known parked findings this plan must resolve

- **Re-marking a scoped element wipes its label/pitch/serviceId** (`stampSelection` in `drawing-editor.tsx` always resets customData). Task 6 fixes this: preserve existing scope fields when re-stamping.

---

### Task 1: Service, Estimate, EstimateLineItem Prisma models

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (append after the Drawing models)
- Migration: generated under `packages/db/prisma/migrations/`

**Interfaces:**
- Produces: Prisma models `Service`, `Estimate`, `EstimateLineItem`, enums `ServiceUnit`, `EstimateStatus`, `EstimateTier` — consumed by Tasks 3 and 4 via `@crm/db`.

- [ ] **Step 1: Add models to schema.prisma**

```prisma
enum ServiceUnit {
  PER_SQUARE
  PER_LINEAR_FT
  PER_EACH
  FLAT
}

enum EstimateStatus {
  DRAFT
  SENT
  ACCEPTED
  DECLINED
}

enum EstimateTier {
  GOOD
  BETTER
  BEST
}

model Service {
  id              String      @id @default(cuid())
  name            String
  trade           String      @default("roofing")
  unit            ServiceUnit
  unitPriceCents  Int
  costCents       Int?
  priceGoodCents  Int?
  priceBestCents  Int?
  symbolId        String?     @unique
  active          Boolean     @default(true)
  lineItems       EstimateLineItem[]
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  @@index([trade])
  @@index([active])
  @@map("service")
}

model Estimate {
  id           String             @id @default(cuid())
  title        String             @default("Untitled estimate")
  status       EstimateStatus     @default(DRAFT)
  currency     String             @default("USD")
  selectedTier EstimateTier       @default(BETTER)
  dealId       String?
  deal         Deal?              @relation(fields: [dealId], references: [id], onDelete: SetNull)
  contactId    String?
  contact      Contact?           @relation(fields: [contactId], references: [id], onDelete: SetNull)
  drawingId    String?
  drawing      Drawing?           @relation(fields: [drawingId], references: [id], onDelete: SetNull)
  createdById  String
  createdBy    User               @relation("EstimateCreator", fields: [createdById], references: [id])
  lineItems    EstimateLineItem[]
  createdAt    DateTime           @default(now())
  updatedAt    DateTime           @updatedAt

  @@index([dealId])
  @@index([drawingId])
  @@index([status])
  @@index([updatedAt])
  @@map("estimate")
}

model EstimateLineItem {
  id               String      @id @default(cuid())
  estimateId       String
  estimate         Estimate    @relation(fields: [estimateId], references: [id], onDelete: Cascade)
  serviceId        String?
  service          Service?    @relation(fields: [serviceId], references: [id], onDelete: SetNull)
  name             String
  unit             ServiceUnit
  quantity         Decimal     @db.Decimal(12, 2)
  priceGoodCents   Int
  priceBetterCents Int
  priceBestCents   Int
  areaLabel        String?
  scopeId          String?
  sortOrder        Int         @default(0)
  createdAt        DateTime    @default(now())
  updatedAt        DateTime    @updatedAt

  @@index([estimateId, sortOrder])
  @@map("estimate_line_item")
}
```

Add back-relations: `estimates Estimate[]` on `Deal`, `Contact`, and `Drawing`; `estimates Estimate[] @relation("EstimateCreator")` on `User`.

Semantics locked here: `priceBetterCents` on a line item is the base price (from `Service.unitPriceCents`); good/best default to the service's variants when set, else equal better. `quantity` uses Decimal(12,2) because squares are fractional (149.7 sq) — but line **totals** are computed as `Math.round(Number(quantity) * priceCents)` in cents, never stored. `scopeId` links a generated line back to its drawing shape for re-sync.

- [ ] **Step 2: Migrate**

Postgres up first if needed. From repo root: `bun run db:migrate`, name `add_price_book_and_estimates`.
Expected: applies clean, client regenerates.

- [ ] **Step 3: Verify** — `bun run check-types` from `packages/db`: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/db/prisma
git commit -m "feat: add Service, Estimate, EstimateLineItem models"
```

---

### Task 2: Symbol pins + quantity math in `@crm/drawings`

**Files:**
- Modify: `packages/drawings/src/scene.ts` (scopeCustomData gains `symbol`)
- Modify: `packages/drawings/src/measure.ts` (symbol pin detection, `quantityForUnit`)
- Modify: `apps/app/public/libraries/janus-roofing.excalidrawlib` (stamp `customData.symbol` into every element of every item; regenerate via the generator pattern in git history — the file was authored by a script; if the scratch generator is gone, edit the JSON directly: every element of item `janus-roofing-<slug>` gets `"customData": { "symbol": "janus-roofing-<slug>" }`)
- Test: `packages/drawings/test/measure.spec.ts` (extend), `packages/drawings/test/quantity.spec.ts` (new)

**Interfaces:**
- Consumes: existing `MeasuredShape`, `MeasuredQuantity`, `scopeCustomData`.
- Produces:
  - `scopeCustomData` accepts optional `symbol: z.string().min(1).nullish()`
  - `measureScene` ALSO emits shapes for elements whose `customData` has a `symbol` key but no `scopeId`: treated as `kind: "pin"`, `scopeId` = the element's own id, `symbol` carried on the output. `MeasuredShape` gains `symbol: string | null`.
  - `measureSatellite` output shapes get `symbol: null`.
  - `quantityForUnit(unit: "PER_SQUARE" | "PER_LINEAR_FT" | "PER_EACH" | "FLAT", q: MeasuredQuantity | null): number | null` — maps a measured quantity onto a service unit: PER_SQUARE from `squares` (2dp), PER_LINEAR_FT from `lengthFt` (2dp), PER_EACH from `count`, FLAT always 1; returns null when the measurement kind cannot satisfy the unit (e.g. a line tagged with a PER_SQUARE service) or when q is null.

- [ ] **Step 1: Failing tests**

Append to `packages/drawings/test/measure.spec.ts`:

```ts
describe("symbol pins", () => {
	it("treats a placed library symbol as a pin keyed by element id", () => {
		const scene = {
			excalidraw: {
				elements: [
					{
						id: "el-1",
						type: "ellipse",
						x: 0,
						y: 0,
						width: 40,
						height: 40,
						isDeleted: false,
						customData: { symbol: "janus-roofing-roof-vent" },
					},
					{
						id: "el-2",
						type: "ellipse",
						x: 90,
						y: 0,
						width: 40,
						height: 40,
						isDeleted: false,
						customData: { symbol: "janus-roofing-roof-vent" },
					},
				],
				appState: {},
				files: {},
			},
			satellite: null,
		};
		const measured = measureScene(scene as never, null);
		expect(measured).toHaveLength(2);
		expect(measured[0]?.kind).toBe("pin");
		expect(measured[0]?.scopeId).toBe("el-1");
		expect(measured[0]?.symbol).toBe("janus-roofing-roof-vent");
		expect(measured[0]?.quantity).toEqual({ count: 1 });
	});
});
```

New `packages/drawings/test/quantity.spec.ts`:

```ts
import { describe, expect, it } from "bun:test";
import { quantityForUnit } from "../src/index";

describe("quantityForUnit", () => {
	it("maps area to squares for PER_SQUARE", () => {
		expect(
			quantityForUnit("PER_SQUARE", { areaSqFt: 14973.4, squares: 149.734 }),
		).toBe(149.73);
	});
	it("maps length to feet for PER_LINEAR_FT", () => {
		expect(quantityForUnit("PER_LINEAR_FT", { lengthFt: 163.456 })).toBe(
			163.46,
		);
	});
	it("maps count for PER_EACH", () => {
		expect(quantityForUnit("PER_EACH", { count: 5 })).toBe(5);
	});
	it("returns 1 for FLAT regardless of measurement", () => {
		expect(quantityForUnit("FLAT", null)).toBe(1);
	});
	it("returns null for unit/measurement mismatch", () => {
		expect(quantityForUnit("PER_SQUARE", { lengthFt: 10 })).toBeNull();
		expect(quantityForUnit("PER_LINEAR_FT", { count: 2 })).toBeNull();
		expect(quantityForUnit("PER_EACH", { areaSqFt: 5, squares: 0.05 })).toBeNull();
	});
	it("returns null for missing measurement on measured units", () => {
		expect(quantityForUnit("PER_SQUARE", null)).toBeNull();
	});
});
```

- [ ] **Step 2: Run** — `bun test` in `packages/drawings`: FAIL (symbol/quantityForUnit missing).

- [ ] **Step 3: Implement**

In `scene.ts`: add `symbol: z.string().min(1).nullish()` to `scopeCustomData`. In `measure.ts`: extend `MeasuredShape` with `symbol: string | null`; in `measureScene`'s loop, when `scopeOf(element)` is null, `safeParse` a symbol-only shape (`z.object({ symbol: z.string().min(1) }).loose()`) — on success emit `{ scopeId: element.id, kind: "pin", serviceId: scope-from-customData?.serviceId ?? null, label: null, pitch: null, symbol, quantity: { count: 1 } }`. Existing scoped shapes carry `symbol: customData.symbol ?? null`. `measureSatellite` sets `symbol: null`. Add and export `quantityForUnit` implementing the table above with 2dp rounding via `Math.round(v * 100) / 100`.

Stamp the `.excalidrawlib`: every element in every library item gains `customData: { symbol: "<item id>" }`. Verify by grepping the file for 12 distinct symbol values.

- [ ] **Step 4: Run** — `bun test` in `packages/drawings`: ALL PASS (old + new). `bun run check-types` there: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/drawings apps/app/public/libraries/janus-roofing.excalidrawlib
git commit -m "feat: add symbol pin measurement and unit quantity mapping"
```

---

### Task 3: `services` API module (price book)

**Files:**
- Create: `apps/api/src/services-catalog/services-catalog.contracts.ts`, `.service.ts`, `.router.ts`, `.module.ts` (directory `services-catalog` — NOT `services`, which reads as Nest plumbing; router alias is `services`)
- Create: `apps/api/src/services-catalog/roofing-seed.ts`
- Modify: `apps/api/src/app.module.ts`, `apps/api/src/generated/server.ts` (regenerated)
- Test: contract tests beside the existing api spec files (mirror where `drawings` contract tests live)

**Interfaces:**
- Consumes: Task 1 models.
- Produces tRPC procedures under alias `services`:
  - `services.list({ trade?, active?, ...listInput })` → `{ rows, total, facetCounts: {} }`; rows are full Service records ordered by name
  - `services.create({ name, trade?, unit, unitPriceCents, costCents?, priceGoodCents?, priceBestCents?, symbolId? })`
  - `services.update({ id, data: <same fields, all optional> })`, `services.delete({ id })` (hard delete; line items keep their denormalized name via SetNull), `services.byId({ id })`
  - `services.seedRoofing()` → `{ created: number }` — inserts the roofing starter book, skipping any name that already exists (case-insensitive), so it is idempotent and safe to re-run

- [ ] **Step 1: Contracts**

```ts
import { ServiceUnit } from "@crm/db";
import { z } from "zod";
import { listInput } from "../trpc/list-input";

const unitEnum = z.enum(
	Object.values(ServiceUnit) as [ServiceUnit, ...ServiceUnit[]],
);

const cents = z.number().int().min(0).max(99_999_999);

export const serviceFields = z.object({
	name: z.string().trim().min(1, "A service needs a name.").max(200),
	trade: z.string().trim().min(1).max(60).default("roofing"),
	unit: unitEnum,
	unitPriceCents: cents,
	costCents: cents.nullish(),
	priceGoodCents: cents.nullish(),
	priceBestCents: cents.nullish(),
	symbolId: z.string().trim().min(1).max(120).nullish(),
	active: z.boolean().default(true),
});

export const serviceListInput = listInput.extend({
	trade: z.string().optional(),
	active: z.boolean().optional(),
});

export const serviceIdInput = z.object({ id: z.string().min(1) });

export const serviceCreateInput = serviceFields;

export const serviceUpdateInput = z.object({
	id: z.string().min(1),
	data: serviceFields.partial(),
});
```

- [ ] **Step 2: Roofing seed data**

`roofing-seed.ts` exports `ROOFING_SEED` as a `const` array typed `Omit<z.infer<typeof serviceFields>, "active" | "trade">[]` (trade/active applied at insert). Prices are placeholder-realistic; Kyle tunes later in the UI:

```ts
export const ROOFING_SEED = [
	{ name: "Tear-off & disposal", unit: "PER_SQUARE", unitPriceCents: 8500, priceGoodCents: 7500, priceBestCents: 9500 },
	{ name: "Architectural shingles installed", unit: "PER_SQUARE", unitPriceCents: 42500, priceGoodCents: 37500, priceBestCents: 52500 },
	{ name: "Synthetic underlayment", unit: "PER_SQUARE", unitPriceCents: 4500 },
	{ name: "Ice & water shield", unit: "PER_LINEAR_FT", unitPriceCents: 450 },
	{ name: "Drip edge", unit: "PER_LINEAR_FT", unitPriceCents: 350, symbolId: "janus-roofing-drip-edge" },
	{ name: "Ridge vent", unit: "PER_LINEAR_FT", unitPriceCents: 1250, symbolId: "janus-roofing-ridge-vent" },
	{ name: "Gutter run", unit: "PER_LINEAR_FT", unitPriceCents: 950, symbolId: "janus-roofing-gutter-run" },
	{ name: "Downspout", unit: "PER_EACH", unitPriceCents: 8500, symbolId: "janus-roofing-downspout" },
	{ name: "Roof vent", unit: "PER_EACH", unitPriceCents: 7500, symbolId: "janus-roofing-roof-vent" },
	{ name: "Pipe boot flashing", unit: "PER_EACH", unitPriceCents: 6500, symbolId: "janus-roofing-pipe-boot" },
	{ name: "Skylight flashing kit", unit: "PER_EACH", unitPriceCents: 32500, symbolId: "janus-roofing-skylight" },
	{ name: "Chimney flashing", unit: "PER_EACH", unitPriceCents: 45000, symbolId: "janus-roofing-chimney" },
	{ name: "Permit & inspection", unit: "FLAT", unitPriceCents: 45000 },
	{ name: "Dump trailer", unit: "FLAT", unitPriceCents: 55000 },
] as const;
```

- [ ] **Step 3: Service, router, module** — follow `drawings.service.ts`/`drawings.router.ts` exactly (InjectDatabase, translate P2025→404, paginate). `seedRoofing` reads existing names once (`findMany select name`), lowercases into a Set, `createMany` the missing rows with `trade: "roofing"`, returns `{ created }`. Register `ServicesCatalogModule` in `app.module.ts` alphabetically.

- [ ] **Step 4: Regenerate + tests** — `bun run check-types` from `apps/api` (commits regenerated `server.ts`). Contract tests: `serviceCreateInput` rejects negative cents; `serviceUpdateInput` accepts partial data; `serviceListInput` defaults propagate. Run the api test command for just that spec file.

- [ ] **Step 5: Commit**

```bash
git add apps/api bun.lock
git commit -m "feat: add services price book tRPC module"
```

---

### Task 4: `estimates` API module with generate + re-sync

**Files:**
- Create: `apps/api/src/estimates/estimates.contracts.ts`, `.service.ts`, `.router.ts`, `.module.ts`
- Create: `apps/api/src/estimates/generate.ts` (pure mapping: measured shapes + services → line-item drafts)
- Modify: `apps/api/src/app.module.ts`, `apps/api/src/generated/server.ts`, `apps/api/package.json` (ensure `@crm/drawings` dep exists — it does since Phase A)
- Test: `apps/api/test/estimates-generate.spec.ts` (pure-function tests for `generate.ts` — bun test, no DB)

**Interfaces:**
- Consumes: Task 1 models; Task 2 `measureScene`, `measureSatellite`, `quantityForUnit`, `parseDrawingScene`, `parseDrawingScale`, `MeasuredShape`.
- Produces tRPC procedures under alias `estimates`:
  - `estimates.list({ dealId?, status?, ...listInput })` → rows `{ id, title, status, currency, dealId, dealName, totalBetterCents, lineCount, updatedAt }`
  - `estimates.byId({ id })` → estimate with ordered `lineItems` and computed `totals: { goodCents, betterCents, bestCents }`
  - `estimates.create({ title?, dealId?, contactId? })`, `estimates.rename`, `estimates.setStatus({ id, status })`, `estimates.setTier({ id, tier })`, `estimates.delete({ id })`
  - `estimates.addLineItem({ estimateId, serviceId? , name?, unit?, quantity?, areaLabel? })` — with serviceId, name/unit/prices come from the service; without, name+unit required and prices default to 0
  - `estimates.updateLineItem({ id, data: { name?, quantity?, priceGoodCents?, priceBetterCents?, priceBestCents?, areaLabel?, sortOrder? } })`, `estimates.removeLineItem({ id })`
  - `estimates.generateFromDrawing({ drawingId })` → `{ id }` of a NEW draft estimate
  - `estimates.resyncFromDrawing({ id })` → `{ changed: [{ lineItemId, name, oldQuantity, newQuantity }] }` — recomputes quantities for line items whose `scopeId` still exists on the drawing, applies them, and reports what changed; items whose scope vanished are left alone
- Produces from `generate.ts` (used by the service AND unit-tested directly):
  - `buildLineItems(shapes: MeasuredShape[], services: ServiceLike[]): LineItemDraft[]` where `ServiceLike = { id, name, unit, unitPriceCents, priceGoodCents, priceBestCents, symbolId }` and `LineItemDraft = { serviceId, name, unit, quantity, priceGoodCents, priceBetterCents, priceBestCents, areaLabel, scopeId, sortOrder }`

- [ ] **Step 1: Failing tests for the pure mapper**

```ts
import { describe, expect, it } from "bun:test";
import { buildLineItems } from "../src/estimates/generate";

const svc = (over: object) => ({
	id: "s1",
	name: "Tear-off",
	unit: "PER_SQUARE",
	unitPriceCents: 8500,
	priceGoodCents: null,
	priceBestCents: null,
	symbolId: null,
	...over,
});

describe("buildLineItems", () => {
	it("maps a tagged area shape onto a per-square service", () => {
		const items = buildLineItems(
			[
				{
					scopeId: "a1",
					kind: "area",
					serviceId: "s1",
					label: "Main roof",
					pitch: "6/12",
					symbol: null,
					quantity: { areaSqFt: 14973.4, squares: 149.734 },
				},
			],
			[svc({})],
		);
		expect(items).toHaveLength(1);
		expect(items[0]?.quantity).toBe(149.73);
		expect(items[0]?.priceBetterCents).toBe(8500);
		expect(items[0]?.priceGoodCents).toBe(8500);
		expect(items[0]?.areaLabel).toBe("Main roof");
		expect(items[0]?.scopeId).toBe("a1");
	});

	it("aggregates symbol pins of the same service into one counted line", () => {
		const pin = (id: string) => ({
			scopeId: id,
			kind: "pin" as const,
			serviceId: null,
			label: null,
			pitch: null,
			symbol: "janus-roofing-roof-vent",
			quantity: { count: 1 },
		});
		const items = buildLineItems(
			[pin("p1"), pin("p2"), pin("p3")],
			[
				svc({
					id: "s9",
					name: "Roof vent",
					unit: "PER_EACH",
					unitPriceCents: 7500,
					symbolId: "janus-roofing-roof-vent",
				}),
			],
		);
		expect(items).toHaveLength(1);
		expect(items[0]?.quantity).toBe(3);
		expect(items[0]?.scopeId).toBeNull();
	});

	it("uses good/best variants when the service has them", () => {
		const items = buildLineItems(
			[
				{
					scopeId: "a1",
					kind: "area",
					serviceId: "s1",
					label: null,
					pitch: null,
					symbol: null,
					quantity: { areaSqFt: 1000, squares: 10 },
				},
			],
			[svc({ priceGoodCents: 7500, priceBestCents: 9500 })],
		);
		expect(items[0]?.priceGoodCents).toBe(7500);
		expect(items[0]?.priceBestCents).toBe(9500);
	});

	it("skips untagged shapes and unit mismatches", () => {
		const items = buildLineItems(
			[
				{
					scopeId: "x",
					kind: "line",
					serviceId: null,
					label: null,
					pitch: null,
					symbol: null,
					quantity: { lengthFt: 50 },
				},
				{
					scopeId: "y",
					kind: "line",
					serviceId: "s1",
					label: null,
					pitch: null,
					symbol: null,
					quantity: { lengthFt: 50 },
				},
			],
			[svc({})],
		);
		expect(items).toHaveLength(0);
	});
});
```

- [ ] **Step 2: Run** — FAIL (module missing). Check where api bun tests run from (existing `apps/api` test script) and use it.

- [ ] **Step 3: Implement `generate.ts`**

Pure function, no Prisma: index services by id and by symbolId; for each measured shape resolve a service (explicit `serviceId` wins, else `symbol` lookup); compute `quantityForUnit(service.unit, shape.quantity)`; skip null quantities; PER_EACH symbol resolutions aggregate by service (sum counts, `scopeId: null`, since many pins feed one line); measured shapes keep their own line (scopeId set) so re-sync can track them; `priceBetterCents = unitPriceCents`, good/best fall back to better; `sortOrder` = emission index; `areaLabel` = shape label.

- [ ] **Step 4: Implement service + router**

`generateFromDrawing`: load drawing (404 via translate), parse scene/scale with `@crm/drawings` parsers, `[...measureScene(scene, scale), ...measureSatellite(scene.satellite?.features ?? [])]`, load active services, `buildLineItems`, then in one transaction create the Estimate (`title` = drawing title + " estimate"`, `dealId`/`contactId` copied from the drawing, `currency` = the deal's currency when attached else default, `drawingId`, `createdById` from ctx) and `createMany` the line items. Return `{ id }`.

`resyncFromDrawing`: load estimate with line items (404), require `drawingId` (400 `BadRequestException` when null), re-measure the drawing the same way, index measured shapes by scopeId; for each line item with a `scopeId` present in the index, recompute `quantityForUnit`; where it differs from stored (compare at 2dp) update inside a transaction and collect `{ lineItemId, name, oldQuantity, newQuantity }`. Totals: computed in the service (`byId`) as `sum(round(quantity * priceCents))` per tier over line items — never stored.

Everything else is thin CRUD following `drawings.service.ts` patterns. Register module; `bun run check-types` from `apps/api` regenerates server.ts.

- [ ] **Step 5: Run tests** — generate spec ALL PASS; root `check-types` + `lint` PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api
git commit -m "feat: add estimates tRPC module with drawing generation and resync"
```

---

### Task 5: Price book UI

**Files:**
- Create: `apps/app/app/(app)/[slug]/settings/price-book/page.tsx`
- Create: `apps/app/app/(app)/[slug]/settings/price-book/price-book-table.tsx` (client)
- Modify: the settings navigation (find how `settings/currencies` etc. register — read `settings-sidebar.tsx` and mirror)
- Modify: `apps/app/lib/trpc/cache.ts` (add `service()` helper invalidating `services.list`)

**Interfaces:**
- Consumes: `services.*` procedures (Task 3).
- Produces: the page Task 6's service Select links to.

- [ ] **Step 1: Build the page** — server page (session + prefetch `services.list` via the repo's HydrateClient pattern — copy `drawings/page.tsx`'s shape), client table: columns Name / Unit / Price / Good / Best / Symbol / Active; inline edit via the repo's inline-editor idiom if one exists on other tables (search for how deals tables do inline edits; if none is reusable, row click opens an edit dialog with the fields — `Dialog` + `Input`/`Select` from `@crm/ui`). Prices display as dollars (cents/100, 2dp), edited as dollar strings parsed with `Math.round(parseFloat * 100)` guarded `Number.isFinite`. "New service" button (Dialog, same form). When the table is empty: an empty-state card with a "Load roofing starter book" button calling `services.seedRoofing`, then invalidate.
- [ ] **Step 2: Wrap any URL-state-reading client component in Suspense** (house rule).
- [ ] **Step 3: Verify** — `check-types` + `lint`; browser-check the page loads, seed works, an edit persists (dev server recipe in Global Constraints).
- [ ] **Step 4: Commit** — `feat: add price book settings page`

---

### Task 6: Service tagging in the scope panel (+ preserve-on-restamp fix)

**Files:**
- Modify: `apps/app/components/drawings/scope-panel.tsx` (service Select per shape)
- Modify: `apps/app/components/drawings/drawing-editor.tsx` (`stampSelection` preserves existing scope customData; plumb services list + satellite scope writeback for serviceId)
- Modify: `apps/app/components/drawings/use-scoped-shapes.ts` if the service map is joined there (implementer's call; keep the join in ONE place)

**Interfaces:**
- Consumes: `services.list` (fetch once in the editor, active only), `MeasuredShape.symbol` (Task 2).
- Produces: every scoped shape and satellite feature can carry a `serviceId` in its customData/scope; symbol pins DISPLAY their auto-resolved service (by symbolId) as a non-editable tag with an override Select.

- [ ] **Step 1: Service Select** — in each scope-panel card, a `Select` listing active services filtered to units compatible with the shape kind (area → PER_SQUARE/FLAT; line → PER_LINEAR_FT/FLAT; pin → PER_EACH/FLAT), value = `serviceId ?? auto-resolved-via-symbol`, writing `serviceId` into customData via the existing `updateShape` path (works for both surfaces). Auto-resolved symbol pins show the service name with an "auto" `Badge`; explicit selection overrides.
- [ ] **Step 2: Preserve-on-restamp** — `stampSelection` merges: `{ ...existingScope, scopeId: existingScope?.scopeId ?? randomUUID(), kind }` so re-marking never wipes label/pitch/serviceId (this closes the parked Phase A finding).
- [ ] **Step 3: Unassigned states** — a shape with no service shows "no service" in the panel (muted); a shape whose service/unit mismatch would exclude it from estimates shows "won't price" hint.
- [ ] **Step 4: Verify** — `check-types` + `lint`; browser: tag an area with Tear-off, drop two roof-vent symbols, confirm the panel shows the auto service on pins.
- [ ] **Step 5: Commit** — `feat: tag scoped shapes and symbol pins with price book services`

---

### Task 7: Estimates list + deal tab

**Files:**
- Create: `apps/app/app/(app)/[slug]/estimates/page.tsx` + `estimates-search-params.ts` + `estimates-table.tsx` (client)
- Modify: `apps/app/components/crm/record-sheet/deal-sheet.tsx` (Estimates tab beside Drawings, same `DetailSheetTab` shape)
- Modify: `apps/app/lib/janus-nav.ts` (Estimates entry), `apps/app/lib/trpc/cache.ts` (`estimate(id)` helper)

**Interfaces:**
- Consumes: `estimates.list`, `estimates.create`, `estimates.delete`.
- Produces: `/[slug]/estimates` route and `EstimatesTable` reused by the deal tab with a `dealId` filter; rows navigate to `/[slug]/estimates/[estimateId]` (Task 8).

- [ ] **Step 1: Build list page** — copy the drawings list page structure exactly (server page + Suspense + HydrateClient + nuqs search params): columns Title / Status badge / Total (better tier, dollars) / Deal / Updated; "New estimate" button; row overflow menu with Delete (confirm dialog). Status filter tabs (All/Draft/Sent/Accepted/Declined). DESIGN REFERENCE for hierarchy: `design/v0-suite/app/(app)/estimates/page.tsx` (read for layout intent only).
- [ ] **Step 2: Deal tab** — mirror the Drawings tab insertion in `deal-sheet.tsx` (Task 6 of Phase A did this; copy its shape), filtered to the deal, with a New-estimate button passing `dealId`.
- [ ] **Step 3: Verify + commit** — `feat: add estimates list and deal tab`

---

### Task 8: Estimate builder UI (Good/Better/Best)

**Files:**
- Create: `apps/app/app/(app)/[slug]/estimates/[estimateId]/page.tsx` (server, Suspense-wrapped async child like the drawing page)
- Create: `apps/app/components/estimates/estimate-builder.tsx` (client) + `estimate-line-row.tsx` + `add-line-item.tsx`
- Modify: `apps/app/lib/trpc/cache.ts` if needed

**Interfaces:**
- Consumes: `estimates.byId`, `updateLineItem`, `addLineItem`, `removeLineItem`, `rename`, `setStatus`, `setTier`, `services.list`.
- Produces: the builder Task 9 navigates into.

- [ ] **Step 1: Read the design reference** — `design/v0-suite/app/(app)/estimates/[id]/page.tsx` (~220 lines): note the GBB tier tabs, grouped line items, per-tier totals footer, status flow. Reproduce the INFORMATION DESIGN with `@crm/ui` components — not the v0 code.
- [ ] **Step 2: Build** — header: editable title (inline Input on click, `rename` on blur), status `Select` (DRAFT/SENT/ACCEPTED/DECLINED as badges), tier `Tabs` (Good/Better/Best) controlling which price column displays and which total leads; `setTier` persists the selection. Body: line items grouped by `areaLabel` (null group last, titled "General"), each row: name (editable), quantity (editable, numeric, 2dp), unit label, unit price for the ACTIVE tier (editable — writes that tier's cents), line total (quantity × active tier price, computed client-side). Footer: three totals with the active tier emphasized. "Add item" opens a `Popover`/`Dialog` with a service picker (from `services.list`) plus a "custom line" option (name + unit + qty). Mutations settle per-record (`{ settle: "record" }` idiom from the cache doc) and invalidate `cache.estimate(id)`.
- [ ] **Step 3: Verify** — browser: create an empty estimate, add a service line and a custom line, edit qty and price, flip tiers, totals correct (hand-check one: 149.73 × $425.00 = $63,635.25).
- [ ] **Step 4: Commit** — `feat: add Good/Better/Best estimate builder`

---

### Task 9: Generate estimate from drawing + re-sync UI

**Files:**
- Modify: `apps/app/components/drawings/scope-panel.tsx` or `drawing-editor.tsx` toolbar (Generate estimate button placement: bottom of the scope panel, primary variant — it is THE action of the panel)
- Modify: `apps/app/components/estimates/estimate-builder.tsx` (re-sync control when `drawingId` set)

**Interfaces:**
- Consumes: `estimates.generateFromDrawing`, `estimates.resyncFromDrawing` (Task 4), builder route (Task 8).

- [ ] **Step 1: Generate button** — enabled when at least one shape has a resolvable service (client-side check over the measured shapes + services); on click call `generateFromDrawing`, then `router.push` to `/[slug]/estimates/<id>`. Disabled state carries a tooltip "Tag shapes with services first."
- [ ] **Step 2: Re-sync** — in the builder, when `drawingId` is set: "Re-sync from drawing" button (outline). On result: if `changed` empty, toast "Quantities already match."; else a `Dialog` listing "name: old → new" rows with a Done button (changes are already applied server-side; the dialog is the receipt — matches spec's "flagged as changed" intent without a staging state). Also a "View drawing" link to the source drawing.
- [ ] **Step 3: Verify + commit** — `feat: generate estimates from drawings with re-sync`

---

### Task 10: Final integration pass (live E2E)

**Files:** whatever the pass surfaces.

- [ ] **Step 1: Full repo checks** — root `bun run check-types`, `bun run lint`, `bun test` in `packages/drawings`, the api estimates spec, `bun run build` (judge unrelated failures against the branch base; the apps/api full-suite hang on bulk/fields specs is pre-existing — do not chase it).
- [ ] **Step 2: THE money walkthrough (Playwright, recipe in Global Constraints; screenshots to the sdd scratch dir):**
  a. Settings → Price book → seed roofing book → verify 14 services.
  b. New whiteboard drawing → draw rectangle → set scale (line = 40 ft) → Mark area → tag "Architectural shingles installed" → set pitch 6/12.
  c. Place 3 roof-vent symbols from the Library.
  d. Generate estimate → lands in the builder → verify: shingles line with the pitched square quantity, ONE "Roof vent" line with quantity 3, correct better-tier prices from the seed, totals = hand-computed sum.
  e. Flip to Good tier → totals change where variants exist.
  f. Back to the drawing → enlarge the rectangle → builder → Re-sync → receipt dialog shows the shingles quantity change; verify the new quantity matches the new measurement.
  g. Estimates list shows the estimate with its total; the deal tab shows it when attached.
  h. No console errors from estimates/drawings code.
  Fix what fails (commit fixes), re-verify.
- [ ] **Step 3: Update spec status** — append "Phase B implemented <date>." to the spec's Status line. Commit `feat: complete Phase B price book and estimates`.

---

## Self-review notes (already applied)

- Spec §2 coverage: price book (T1/T3/T5), two gestures incl. symbol pins (T2/T6), generate + draft + grouped-by-area (T4/T9), re-sync with change receipt (T4/T9), G/B/B variants (T1/T3/T8). Conversational price-book maintenance and all AI suggestions are Phase C by the spec's own structure. "Nothing sends without the owner" holds — estimates have no send mechanism this phase (status is a label; sending/e-sign is future work, noted for Kyle).
- Deviation ruled: no pre-existing estimate builder exists — this plan builds it; v0 suite is design reference only.
- Type consistency: `MeasuredShape.symbol`, `quantityForUnit` unit strings match `ServiceUnit` enum values; `LineItemDraft` fields match `EstimateLineItem` columns; `buildLineItems` signature consistent between Tasks 4's tests and implementation.
- Placeholder scan: clean — every code step carries real code or an exact repo-idiom directive with a named reference file.
