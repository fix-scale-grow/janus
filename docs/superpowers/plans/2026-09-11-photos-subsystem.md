# Photos Subsystem Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Photos uploaded onto deals/contacts (desktop drag-drop + mobile camera), linkable to estimates, invoices, and projects, with a per-link include-in-PDF flag that renders a photos section in estimate/invoice PDFs.

**Architecture:** Client-side canvas produces a 2560px JPEG master + 400px thumb per upload (the drawing-background pattern — no server image lib exists). A single Next.js route handler owns row-creation + atomic disk save with rollback (the receipt-route pattern). A NestJS tRPC `photos` module owns listing and per-surface link procs. PDFs embed flagged photos as data URLs.

**Tech Stack:** Prisma (packages/db), NestJS + nestjs-trpc (apps/api), Next.js App Router routes + tRPC v11 options-proxy client (apps/app), @react-pdf/renderer, bun test, Playwright (driven under NODE, not bun).

**Spec:** `docs/superpowers/specs/2026-09-11-photos-subsystem-design.md` (read it first; it was amended 2026-09-11 after codebase exploration — the amended version is authoritative).

## Global Constraints

- Repo AGENTS.md: NO code comments anywhere; NO Co-Authored-By trailers in commits; read `docs/api.md` + `docs/design.md` before touching api/app code; `bun run check-types` regenerates the committed `apps/api/src/generated/server.ts`.
- `docs/design.md`: shared components from `packages/ui` only; never override component styles with `className`; radius scale `rounded-sm`/`rounded-md`/`rounded-lg` only; only `primary` and `destructive` are filled.
- `docs/api.md`: routers thin (zod in, service out; Prisma only in `*.service.ts`); `@Router({ alias })` + `@UseMiddlewares(AuthMiddleware)` (no middleware = PUBLIC); cache invalidation goes through `useCrmCache()` in `apps/app/lib/trpc/cache.ts` — a new mutation adds a call there, never key lists at call sites; no `console.log`, one object per log call.
- This worktree: `C:\Users\Kyle\janus\.claude\worktrees\phase-l-photos`, branch `janus/phase-l-photos`. Private DBs `janus_photos_dev` / `janus_photos_test` — the shared `crm` / `crm_test` DBs are NEVER migrated or written by this phase. Dev ports: app **3100**, api **3102** (`next dev` ignores .env PORT — pass `-p` inline).
- `bun test` gotchas: `.rejects.toThrow` / `.resolves` HANG when a second Prisma query runs — use the try/catch `expectRejects` helper (copied per spec file, verbatim below). Tests may not delete rows they did not create. `turbo run test --concurrency=1` stays 1.
- Scope `biome check --write` to files you touched, never a whole directory.
- Playwright driver scripts run under NODE, not bun (bun hangs chromium).
- Commit after every task (small commits during a task are fine). Message style: `feat:`/`fix:`/`docs:` lowercase imperative, no trailers.

---

### Task 0: Worktree environment

**Files:**
- Create: `.env` (worktree root, NOT committed — verify it is gitignored)

**Steps:**

- [ ] **Step 1: Copy env and point at private DBs**

Copy `C:\Users\Kyle\janus\.env` (main checkout) to the worktree root. Change ONLY these two lines:

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/janus_photos_dev?schema=public"
TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/janus_photos_test?schema=public"
```

- [ ] **Step 2: Create the databases** (Postgres runs locally; binaries at `C:\Users\Kyle\pg17\pgsql\bin`)

```bash
/c/Users/Kyle/pg17/pgsql/bin/psql.exe -U postgres -h localhost -c 'CREATE DATABASE janus_photos_dev;'
/c/Users/Kyle/pg17/pgsql/bin/psql.exe -U postgres -h localhost -c 'CREATE DATABASE janus_photos_test;'
```

- [ ] **Step 3: Install and migrate**

```bash
bun install --ignore-scripts
cd packages/db && bunx prisma migrate deploy && bun run db:generate && cd ../..
git config core.hooksPath .husky 2>/dev/null || true
```

(`bun install` prepare script is broken on Windows — `--ignore-scripts` then run the hooks-path config manually. After install, `bun install` in apps/app context normally vendors the maplibre worker via postinstall; if the satellite tab is needed during walkthrough run `bun install` without the flag in a retry — not required for this phase.)

- [ ] **Step 4: Verify baseline is green**

```bash
cd packages/db && bunx prisma migrate status
```
Expected: "Database schema is up to date"

No commit (nothing tracked changed).

---

### Task 1: Schema + migration

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (append models at END of file, after `UserPermission` which is currently last at ~L1961; back-relation fields added in place on `Deal`, `Contact`, `User`, `Estimate`, `Invoice`, `Project`)
- Create: `packages/db/prisma/migrations/<timestamp>_add_photos/` (generated)

**Interfaces:**
- Produces: Prisma models `Photo`, `EstimatePhoto`, `InvoicePhoto`, `ProjectPhoto`, enum `ProjectPhotoStage` with client types available via `@crm/db`.

- [ ] **Step 1: Append enum + models at the very end of schema.prisma**

```prisma
enum ProjectPhotoStage {
  BEFORE
  IN_PROGRESS
  AFTER
  FINAL
}

model Photo {
  id            String          @id @default(cuid())
  dealId        String?
  deal          Deal?           @relation(fields: [dealId], references: [id], onDelete: Cascade)
  contactId     String?
  contact       Contact?        @relation(fields: [contactId], references: [id], onDelete: Cascade)
  uploadedById  String
  uploadedBy    User            @relation("PhotoUploader", fields: [uploadedById], references: [id])
  filename      String
  mimeType      String
  sizeBytes     Int
  width         Int
  height        Int
  takenAt       DateTime?
  estimateLinks EstimatePhoto[]
  invoiceLinks  InvoicePhoto[]
  projectLinks  ProjectPhoto[]
  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt

  @@index([dealId, createdAt])
  @@index([contactId, createdAt])
  @@map("photo")
}

model EstimatePhoto {
  id           String   @id @default(cuid())
  estimateId   String
  estimate     Estimate @relation(fields: [estimateId], references: [id], onDelete: Cascade)
  photoId      String
  photo        Photo    @relation(fields: [photoId], references: [id], onDelete: Cascade)
  includeInPdf Boolean  @default(false)
  sortOrder    Int      @default(0)
  createdAt    DateTime @default(now())

  @@unique([estimateId, photoId])
  @@index([estimateId, sortOrder])
  @@map("estimate_photo")
}

model InvoicePhoto {
  id           String   @id @default(cuid())
  invoiceId    String
  invoice      Invoice  @relation(fields: [invoiceId], references: [id], onDelete: Cascade)
  photoId      String
  photo        Photo    @relation(fields: [photoId], references: [id], onDelete: Cascade)
  includeInPdf Boolean  @default(false)
  sortOrder    Int      @default(0)
  createdAt    DateTime @default(now())

  @@unique([invoiceId, photoId])
  @@index([invoiceId, sortOrder])
  @@map("invoice_photo")
}

model ProjectPhoto {
  id         String            @id @default(cuid())
  projectId  String
  project    Project           @relation(fields: [projectId], references: [id], onDelete: Cascade)
  photoId    String
  photo      Photo             @relation(fields: [photoId], references: [id], onDelete: Cascade)
  stageLabel ProjectPhotoStage @default(BEFORE)
  sortOrder  Int               @default(0)
  createdAt  DateTime          @default(now())

  @@unique([projectId, photoId])
  @@index([projectId, sortOrder])
  @@map("project_photo")
}
```

- [ ] **Step 2: Add back-relation fields in place** (Prisma requires both sides)

- `model Deal`: add `photos Photo[]`
- `model Contact`: add `photos Photo[]`
- `model User`: add `photos Photo[] @relation("PhotoUploader")` (User back-relations are always named — precedent `drawings Drawing[] @relation("DrawingCreator")` near schema L33)
- `model Estimate`: add `photoLinks EstimatePhoto[]`
- `model Invoice`: add `photoLinks InvoicePhoto[]`
- `model Project`: add `photoLinks ProjectPhoto[]`

- [ ] **Step 3: Generate the migration**

```bash
cd packages/db && bunx prisma migrate dev --name add_photos
```
Expected: migration folder created with only `CREATE TYPE` / `CREATE TABLE` / `CREATE INDEX` / `ADD CONSTRAINT` statements (fully additive — verify no DROP appears; the deploy guard would flag it and the shared-DB doctrine forbids it). Timestamp must sort after `20260908062546_add_form_submission_deal`; `migrate dev` timestamps with now(), which does.

- [ ] **Step 4: Regenerate client + typecheck**

```bash
cd packages/db && bun run db:generate && cd ../.. && bun run check-types --filter=@crm/db
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations
git commit -m "feat: photo model with estimate, invoice and project links"
```

---

### Task 2: Shared photo-files helper (`@crm/db/photo-files`)

Lives in `packages/db` (precedent: `src/images.ts`, `src/blob.ts`, `src/user-views.ts` — shared subpath exports) because BOTH apps touch the files: apps/app routes write/serve/delete, apps/api reads masters for PDFs.

**Files:**
- Create: `packages/db/src/photo-files.ts`
- Create: `packages/db/src/photo-files.test.ts`
- Modify: `packages/db/package.json` (exports map: add `"./photo-files": "./src/photo-files.ts"`; add dependency `"@crm/env": "workspace:*"` if not already present — check first, `findWorkspaceRoot` comes from there)
- Modify: `.env.example` (~L152-159, beside `DRAWINGS_DATA_DIR` / `COSTS_DATA_DIR`): add `# PHOTOS_DATA_DIR="/absolute/path"` with the same "optional, local disk, no third-party service required" wording as its neighbours

**Interfaces:**
- Produces (exact exports):
  - `PHOTO_ID_PATTERN: RegExp` = `/^[a-z0-9]{20,40}$/`
  - `PHOTO_VARIANTS = ["master", "thumb"] as const`, `type PhotoVariant = "master" | "thumb"`
  - `PHOTO_MAX_BYTES = 15 * 1024 * 1024`, `PHOTO_THUMB_MAX_BYTES = 1024 * 1024`
  - `savePhotoFiles(photoId: string, master: Buffer, thumb: Buffer): Promise<boolean>`
  - `readPhotoFile(photoId: string, variant: PhotoVariant): Promise<Buffer | null>`
  - `removePhotoFiles(photoId: string): Promise<void>`
  - `photoUrl(photoId: string, variant: PhotoVariant): string` → `` `/api/photos/${photoId}/${variant}` ``

- [ ] **Step 1: Write the failing test** (`packages/db/src/photo-files.test.ts`, mirror the mkdtemp pattern from `apps/app/lib/workspace-logo.test.ts:13-23`)

```ts
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	PHOTO_ID_PATTERN,
	photoUrl,
	readPhotoFile,
	removePhotoFiles,
	savePhotoFiles,
} from "./photo-files";

const PHOTO_ID = "clphotoaaaaaaaaaaaaaaa";

let dir: string;

beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), "photo-files-"));
	process.env.PHOTOS_DATA_DIR = dir;
});

afterEach(async () => {
	await rm(dir, { recursive: true, force: true });
	delete process.env.PHOTOS_DATA_DIR;
});

describe("savePhotoFiles", () => {
	it("writes master and thumb and leaves no temp files", async () => {
		const saved = await savePhotoFiles(
			PHOTO_ID,
			Buffer.from("master-bytes"),
			Buffer.from("thumb-bytes"),
		);
		expect(saved).toBe(true);
		const entries = await readdir(join(dir, PHOTO_ID));
		expect(entries.sort()).toEqual(["master.jpg", "thumb.jpg"]);
	});
});

describe("readPhotoFile", () => {
	it("round-trips bytes and returns null when missing", async () => {
		await savePhotoFiles(PHOTO_ID, Buffer.from("m"), Buffer.from("t"));
		const master = await readPhotoFile(PHOTO_ID, "master");
		expect(master?.toString()).toBe("m");
		expect(await readPhotoFile("clmissingaaaaaaaaaaaaa", "thumb")).toBeNull();
	});
});

describe("removePhotoFiles", () => {
	it("removes the photo directory and tolerates a missing one", async () => {
		await savePhotoFiles(PHOTO_ID, Buffer.from("m"), Buffer.from("t"));
		await removePhotoFiles(PHOTO_ID);
		expect(await readdir(dir)).toEqual([]);
		await removePhotoFiles(PHOTO_ID);
	});
});

describe("PHOTO_ID_PATTERN", () => {
	it("accepts cuids and rejects traversal", () => {
		expect(PHOTO_ID_PATTERN.test(PHOTO_ID)).toBe(true);
		expect(PHOTO_ID_PATTERN.test("../etc/passwd")).toBe(false);
		expect(PHOTO_ID_PATTERN.test("UPPER")).toBe(false);
		expect(PHOTO_ID_PATTERN.test("short")).toBe(false);
	});
});

describe("photoUrl", () => {
	it("builds the serving path", () => {
		expect(photoUrl(PHOTO_ID, "thumb")).toBe(`/api/photos/${PHOTO_ID}/thumb`);
	});
});
```

- [ ] **Step 2: Run to verify failure**

```bash
cd packages/db && bun test src/photo-files.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `packages/db/src/photo-files.ts`**

```ts
import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { findWorkspaceRoot } from "@crm/env";

export const PHOTO_ID_PATTERN = /^[a-z0-9]{20,40}$/;
export const PHOTO_VARIANTS = ["master", "thumb"] as const;
export type PhotoVariant = (typeof PHOTO_VARIANTS)[number];
export const PHOTO_MAX_BYTES = 15 * 1024 * 1024;
export const PHOTO_THUMB_MAX_BYTES = 1024 * 1024;

const DEFAULT_DIR_NAME = join("data", "photos");

function dataDir(): string {
	const override = process.env.PHOTOS_DATA_DIR?.trim();
	if (override) return override;
	const root = findWorkspaceRoot(process.cwd()) ?? process.cwd();
	return join(root, DEFAULT_DIR_NAME);
}

function photoDir(photoId: string): string {
	return join(dataDir(), photoId);
}

async function writeAtomic(dir: string, name: string, bytes: Buffer) {
	const temp = join(dir, `.${randomBytes(8).toString("hex")}.tmp`);
	await writeFile(temp, bytes);
	await rename(temp, join(dir, name));
}

export async function savePhotoFiles(
	photoId: string,
	master: Buffer,
	thumb: Buffer,
): Promise<boolean> {
	try {
		const dir = photoDir(photoId);
		await mkdir(dir, { recursive: true });
		await writeAtomic(dir, "master.jpg", master);
		await writeAtomic(dir, "thumb.jpg", thumb);
		return true;
	} catch {
		return false;
	}
}

export async function readPhotoFile(
	photoId: string,
	variant: PhotoVariant,
): Promise<Buffer | null> {
	try {
		return await readFile(join(photoDir(photoId), `${variant}.jpg`));
	} catch {
		return null;
	}
}

export async function removePhotoFiles(photoId: string): Promise<void> {
	try {
		await rm(photoDir(photoId), { recursive: true, force: true });
	} catch {}
}

export function photoUrl(photoId: string, variant: PhotoVariant): string {
	return `/api/photos/${photoId}/${variant}`;
}
```

Add to `packages/db/package.json` exports map (beside `"./images"` etc.): `"./photo-files": "./src/photo-files.ts"`. Verify `@crm/env` is in packages/db dependencies; add `"@crm/env": "workspace:*"` if missing and re-run `bun install --ignore-scripts`.

- [ ] **Step 4: Run tests + env example**

```bash
cd packages/db && bun test src/photo-files.test.ts
```
Expected: PASS (all 5). Then add the `.env.example` line.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/photo-files.ts packages/db/src/photo-files.test.ts packages/db/package.json .env.example bun.lock
git commit -m "feat: shared photo file storage helper"
```

---

### Task 3: tRPC photos module — list + estimate links

**Files:**
- Create: `apps/api/src/photos/photos.contracts.ts`
- Create: `apps/api/src/photos/photos.service.ts`
- Create: `apps/api/src/photos/photos.router.ts`
- Create: `apps/api/src/photos/photos.module.ts`
- Modify: `apps/api/src/app.module.ts` (import + register `PhotosModule`, alphabetical-ish beside `DrawingsModule` at ~L21 and in the imports array ~L77)
- Create: `apps/api/test/photos.integration.spec.ts`
- Modify (generated): `apps/api/src/generated/server.ts` via `bun run check-types` — commit it

**Interfaces:**
- Consumes: Task 1 models; `AuthMiddleware`, `AuthedTrpcContext` (`apps/api/src/trpc/context.types.ts`), `@InjectDatabase() db: Db`.
- Produces (procedures under alias `photos`):
  - `list(input: { dealId?: string; contactId?: string }): Promise<{ rows: PhotoRow[]; total: number }>` where `PhotoRow = { id, dealId, contactId, filename, width, height, sizeBytes, takenAt, createdAt, uploadedBy: { id, name } }`, ordered `createdAt desc`, capped 500
  - `forEstimate(input: { estimateId: string }): Promise<EstimateLinkRow[]>` where `EstimateLinkRow = { id, photoId, includeInPdf, sortOrder, photo: PhotoRow }`, ordered `sortOrder asc, createdAt asc`
  - `linkEstimate(input: { estimateId: string; photoId: string }): Promise<{ id: string }>` — idempotent upsert on `@@unique([estimateId, photoId])`; new links get `sortOrder` = current max + 1
  - `unlinkEstimate(input: { estimateId: string; photoId: string }): Promise<void>`
  - `setEstimatePdfFlag(input: { estimateId: string; photoId: string; includeInPdf: boolean }): Promise<void>`
  - `reorderEstimatePhotos(input: { estimateId: string; photoIds: string[] }): Promise<void>` — sets `sortOrder` by array index inside one `$transaction`; ids not currently linked are ignored; linked ids missing from the array keep their order after the listed ones (mirror the exact-set guard style from pipelines `reorder`: reject with `BadRequestException` when the array is not the exact linked set)

Contracts (`photos.contracts.ts`):

```ts
import { z } from "zod";

export const photoListInput = z.object({
	dealId: z.string().optional(),
	contactId: z.string().optional(),
});

export const estimatePhotosInput = z.object({ estimateId: z.string().min(1) });

export const estimateLinkInput = z.object({
	estimateId: z.string().min(1),
	photoId: z.string().min(1),
});

export const estimatePdfFlagInput = estimateLinkInput.extend({
	includeInPdf: z.boolean(),
});

export const estimateReorderInput = z.object({
	estimateId: z.string().min(1),
	photoIds: z.array(z.string().min(1)).max(500),
});
```

Router shape (verbatim skeleton — mirror `drawings.router.ts`):

```ts
@Router({ alias: "photos" })
@UseMiddlewares(AuthMiddleware)
export class PhotosRouter {
	constructor(@Inject(PhotosService) private readonly photos: PhotosService) {}

	@Query({ input: photoListInput })
	async list(@Input() input: z.infer<typeof photoListInput>) {
		return this.photos.list(input);
	}

	@Query({ input: estimatePhotosInput })
	async forEstimate(@Input("estimateId") estimateId: string) {
		return this.photos.forEstimate(estimateId);
	}

	@Mutation({ input: estimateLinkInput })
	async linkEstimate(@Input() input: z.infer<typeof estimateLinkInput>) {
		return this.photos.linkEstimate(input);
	}
	// unlinkEstimate, setEstimatePdfFlag, reorderEstimatePhotos same shape
}
```

Service rules:
- `@Injectable()`, `constructor(@InjectDatabase() private readonly db: Db) {}`
- `linkEstimate`: `findUnique` the estimate and the photo first, `NotFoundException("The estimate was not found.")` / `("The photo was not found.")` when missing; then `upsert` on the compound unique
- `reorderEstimatePhotos`: load linked photoIds; if `new Set(input.photoIds)` is not exactly the linked set → `BadRequestException("The photo list does not match the estimate's photos.")`; else `$transaction` of `update` calls setting `sortOrder: index`
- No Prisma outside the service; service throws Nest `HttpException`s only

- [ ] **Step 1: Write failing integration tests** (`apps/api/test/photos.integration.spec.ts` — setup block copied from `apps/api/test/costs.integration.spec.ts:1-29` style: org upsert with `WORKSPACE_ID`, one user, seeded-stage lookup `db.stage.findFirstOrThrow({ where: { key: "DEMO_BOOKED" }, select: { id: true } })`, one deal, one contact, one estimate; `const suffix = process.env.TEST_RUN_ID ?? "photos-spec";` namespacing; `afterAll` deletes only what it created, child-first: estimatePhoto → photo → estimate → deal → contact → member → user). Include the standard helper verbatim:

```ts
async function expectRejects(
	promise: Promise<unknown>,
	match?: RegExp,
): Promise<void> {
	let caught: unknown;

	try {
		await promise;
	} catch (error) {
		caught = error;
	}

	expect(caught).toBeInstanceOf(Error);
	if (match) expect((caught as Error).message).toMatch(match);
}
```

Service constructed by hand: `const service = new PhotosService(db);`

Test cases:
```ts
it("lists photos scoped to a deal, newest first", ...)          // create 2 photos on deal, 1 on contact; list({dealId}) returns 2, ordered createdAt desc
it("lists photos scoped to a contact", ...)                     // list({contactId}) returns 1
it("links a photo to an estimate idempotently", ...)            // linkEstimate twice -> forEstimate returns 1 row, sortOrder 0
it("appends new links after existing ones", ...)                // link second photo -> sortOrder 1
it("rejects linking a missing photo", ...)                      // expectRejects(service.linkEstimate({estimateId, photoId: "clnopeaaaaaaaaaaaaaaaa"}), /photo/i)
it("sets the pdf flag", ...)                                    // setEstimatePdfFlag true -> forEstimate row includeInPdf true
it("reorders with the exact set and rejects a partial set", ...) // reorder reversed -> sortOrders flip; expectRejects on subset
it("unlinks without deleting the photo", ...)                   // unlinkEstimate -> forEstimate empty, db.photo still present
```

Photos in tests are created directly via `db.photo.create` (no upload involved): `{ dealId, uploadedById: userId, filename: `a-${suffix}.jpg`, mimeType: "image/jpeg", sizeBytes: 10, width: 100, height: 100 }`.

- [ ] **Step 2: Run to verify failure**

```bash
cd apps/api && TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/janus_photos_test?schema=public" bun run db:test 2>/dev/null; bun test test/photos.integration.spec.ts
```
(Ensure `janus_photos_test` is migrated first: `cd packages/db && bun run db:test`.) Expected: FAIL — PhotosService not found.

- [ ] **Step 3: Implement contracts, service, router, module; register in app.module.ts**

Module file verbatim:

```ts
import { Module } from "@nestjs/common";
import { PhotosRouter } from "./photos.router";
import { PhotosService } from "./photos.service";

@Module({
	providers: [PhotosService, PhotosRouter],
	exports: [PhotosService],
})
export class PhotosModule {}
```

- [ ] **Step 4: Run tests**

```bash
cd apps/api && bun test test/photos.integration.spec.ts
```
Expected: PASS (8).

- [ ] **Step 5: Regenerate the committed server.ts + typecheck**

```bash
bun run check-types
```
Expected: PASS; `apps/api/src/generated/server.ts` now contains the `photos` router. This file is generated AND committed — never let `build` regenerate it.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/photos apps/api/src/app.module.ts apps/api/src/generated/server.ts apps/api/test/photos.integration.spec.ts
git commit -m "feat: photos trpc module with estimate links"
```

---

### Task 4: Invoice + project link procs

**Files:**
- Modify: `apps/api/src/photos/photos.contracts.ts`, `photos.service.ts`, `photos.router.ts`
- Modify: `apps/api/test/photos.integration.spec.ts` (extend setup with one invoice + one project on the same deal)
- Modify (generated): `apps/api/src/generated/server.ts`

**Interfaces:**
- Consumes: Task 3 module.
- Produces (procedures, exact mirrors of the estimate set):
  - `forInvoice({ invoiceId })` → `{ id, photoId, includeInPdf, sortOrder, photo: PhotoRow }[]`
  - `linkInvoice({ invoiceId, photoId })`, `unlinkInvoice({ invoiceId, photoId })`, `setInvoicePdfFlag({ invoiceId, photoId, includeInPdf })`, `reorderInvoicePhotos({ invoiceId, photoIds })`
  - `forProject({ projectId })` → `{ id, photoId, stageLabel, sortOrder, photo: PhotoRow }[]`
  - `linkProject({ projectId, photoId })`, `unlinkProject({ projectId, photoId })`, `setProjectStage({ projectId, photoId, stageLabel: "BEFORE" | "IN_PROGRESS" | "AFTER" | "FINAL" })`

Zod for the stage: `z.enum(["BEFORE", "IN_PROGRESS", "AFTER", "FINAL"])` — import nothing from Prisma into contracts (match how other contracts declare enums; check `drawings.contracts.ts` `backgroundEnum` precedent and copy its style).

- [ ] **Step 1: Write failing tests** — same shapes as Task 3's estimate cases, for invoice (link idempotent, pdf flag, reorder exact-set guard) and project (link, setProjectStage IN_PROGRESS, unlink keeps photo, default stage BEFORE). Invoice created via `db.invoice.create` with required fields copied from an existing invoice fixture in `apps/api/test` (search `invoice.create` there and reuse); project via `db.project.create({ name, startDate: new Date(), dealId, createdById: userId, status: "ACTIVE" })`.

- [ ] **Step 2: Run to verify failure**

```bash
cd apps/api && bun test test/photos.integration.spec.ts
```
Expected: new cases FAIL — procs missing.

- [ ] **Step 3: Implement** (service methods are structural copies; keep them separate methods, no clever generic — the tables and metadata differ)

- [ ] **Step 4: Run tests**

Expected: PASS (~16).

- [ ] **Step 5: Regenerate + typecheck + commit**

```bash
bun run check-types
git add apps/api/src/photos apps/api/src/generated/server.ts apps/api/test/photos.integration.spec.ts
git commit -m "feat: invoice and project photo links"
```

---

### Task 5: Upload, serve, delete routes (+ thumbnail-route hardening)

**Files:**
- Create: `apps/app/app/api/photos/upload/route.ts`
- Create: `apps/app/app/api/photos/[photoId]/[variant]/route.ts` (GET)
- Create: `apps/app/app/api/photos/[photoId]/route.ts` (DELETE)
- Modify: `apps/app/app/api/drawings/thumbnail/[drawingId]/route.ts` (ride-along fix: id-pattern guard)

**Interfaces:**
- Consumes: `getSession` from `@/lib/session`; `matchesDeclaredType` from `@/lib/workspace-logo`; `PHOTO_ID_PATTERN`, `PHOTO_MAX_BYTES`, `PHOTO_THUMB_MAX_BYTES`, `savePhotoFiles`, `readPhotoFile`, `removePhotoFiles`, `photoUrl` from `@crm/db/photo-files`; `db` from `@crm/db`.
- Produces: `POST /api/photos/upload` accepting FormData fields `master` (Blob), `thumb` (Blob), `dealId?`, `contactId?`, `filename`, `width`, `height`, `takenAt?` (ms epoch string) → `201 { id, thumbUrl }`; `GET /api/photos/:photoId/:variant` → jpeg bytes; `DELETE /api/photos/:photoId` → `{ ok: true }`.

Upload route (verbatim; model = `apps/app/app/api/costs/receipt/route.ts`, the strongest existing route):

```ts
import { db } from "@crm/db";
import {
	PHOTO_MAX_BYTES,
	PHOTO_THUMB_MAX_BYTES,
	photoUrl,
	removePhotoFiles,
	savePhotoFiles,
} from "@crm/db/photo-files";
import { type NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { matchesDeclaredType } from "@/lib/workspace-logo";

export async function POST(request: NextRequest) {
	const session = await getSession();
	if (!session) {
		return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
	}

	const formData = await request.formData();
	const master = formData.get("master");
	const thumb = formData.get("thumb");
	const dealId = formData.get("dealId");
	const contactId = formData.get("contactId");
	const filename = formData.get("filename");
	const width = Number(formData.get("width"));
	const height = Number(formData.get("height"));
	const takenAtRaw = formData.get("takenAt");

	if (!(master instanceof Blob) || !(thumb instanceof Blob)) {
		return NextResponse.json({ error: "Missing image data." }, { status: 400 });
	}
	if (typeof filename !== "string" || filename.trim().length === 0) {
		return NextResponse.json({ error: "Missing filename." }, { status: 400 });
	}
	if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
		return NextResponse.json({ error: "Missing image dimensions." }, { status: 400 });
	}
	if (master.size > PHOTO_MAX_BYTES || thumb.size > PHOTO_THUMB_MAX_BYTES) {
		return NextResponse.json({ error: "The photo is too large." }, { status: 413 });
	}
	if (typeof dealId !== "string" && typeof contactId !== "string") {
		return NextResponse.json({ error: "A photo needs a deal or a contact." }, { status: 400 });
	}

	if (typeof dealId === "string") {
		const deal = await db.deal.findUnique({ where: { id: dealId }, select: { id: true } });
		if (!deal) return NextResponse.json({ error: "The deal was not found." }, { status: 404 });
	}
	if (typeof contactId === "string") {
		const contact = await db.contact.findUnique({ where: { id: contactId }, select: { id: true } });
		if (!contact) return NextResponse.json({ error: "The contact was not found." }, { status: 404 });
	}

	const masterBytes = Buffer.from(await master.arrayBuffer());
	const thumbBytes = Buffer.from(await thumb.arrayBuffer());
	if (
		!matchesDeclaredType("image/jpeg", masterBytes) ||
		!matchesDeclaredType("image/jpeg", thumbBytes)
	) {
		return NextResponse.json({ error: "Photos must be JPEG images." }, { status: 415 });
	}

	const takenAt =
		typeof takenAtRaw === "string" && Number.isFinite(Number(takenAtRaw))
			? new Date(Number(takenAtRaw))
			: null;

	const photo = await db.photo.create({
		data: {
			dealId: typeof dealId === "string" ? dealId : null,
			contactId: typeof contactId === "string" ? contactId : null,
			uploadedById: session.user.id,
			filename: filename.trim().slice(0, 300),
			mimeType: "image/jpeg",
			sizeBytes: masterBytes.length,
			width,
			height,
			takenAt,
		},
	});

	const saved = await savePhotoFiles(photo.id, masterBytes, thumbBytes);
	if (!saved) {
		await db.photo.delete({ where: { id: photo.id } }).catch(() => null);
		return NextResponse.json({ error: "The photo could not be saved." }, { status: 500 });
	}

	return NextResponse.json(
		{ id: photo.id, thumbUrl: photoUrl(photo.id, "thumb") },
		{ status: 201 },
	);
}
```

(Verify `session.user.id` is the accessor used in existing routes — copy whatever `apps/app/app/api/costs/receipt/route.ts` uses.)

Serve route (`[photoId]/[variant]/route.ts`):

```ts
import { db } from "@crm/db";
import {
	PHOTO_ID_PATTERN,
	PHOTO_VARIANTS,
	type PhotoVariant,
	readPhotoFile,
} from "@crm/db/photo-files";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ photoId: string; variant: string }> },
) {
	const session = await getSession();
	if (!session) {
		return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
	}
	const { photoId, variant } = await params;
	if (!PHOTO_ID_PATTERN.test(photoId)) {
		return NextResponse.json({ error: "Invalid photoId." }, { status: 400 });
	}
	if (!PHOTO_VARIANTS.includes(variant as PhotoVariant)) {
		return NextResponse.json({ error: "Invalid variant." }, { status: 400 });
	}
	const photo = await db.photo.findUnique({
		where: { id: photoId },
		select: { id: true },
	});
	if (!photo) {
		return NextResponse.json({ error: "The photo was not found." }, { status: 404 });
	}
	const bytes = await readPhotoFile(photoId, variant as PhotoVariant);
	if (!bytes) {
		return NextResponse.json({ error: "The photo file is missing." }, { status: 404 });
	}
	return new NextResponse(new Uint8Array(bytes), {
		headers: {
			"content-type": "image/jpeg",
			"cache-control": "private, max-age=31536000, immutable",
		},
	});
}
```

(Match the params signature style of `apps/app/app/api/costs/receipt/[costId]/route.ts` — if that route's `params` is not a Promise in this Next version, copy its exact shape instead.)

Delete route (`[photoId]/route.ts`): session gate → pattern check → `db.photo.findUnique` 404 → `db.photo.delete` (links cascade) → `await removePhotoFiles(photoId)` → `NextResponse.json({ ok: true })`.

Thumbnail hardening in `apps/app/app/api/drawings/thumbnail/[drawingId]/route.ts`: after the session gate, add

```ts
if (!COST_ID_PATTERN.test(drawingId)) {
	return NextResponse.json({ error: "Invalid drawingId." }, { status: 400 });
}
```

importing `COST_ID_PATTERN` from `@/lib/cost-receipts` (same cuid shape; do NOT rename or move it in this phase).

- [ ] **Step 1: Implement all four routes** (no route-level unit tests — the repo tests helpers, not Next handlers; the walkthrough covers routes end-to-end)
- [ ] **Step 2: Typecheck**

```bash
bun run check-types
```
Expected: PASS.

- [ ] **Step 3: Manual probe** — start dev servers (api `bun run dev` on 3102 via `.env` PORT, app `bun run dev -- -p 3100`), sign in via `http://localhost:3100/api/dev-login?email=karlosantanas@gmail.com`, then from the browser console on any page:

```js
const canvas = document.createElement("canvas"); canvas.width = 8; canvas.height = 8;
canvas.getContext("2d").fillRect(0, 0, 8, 8);
canvas.toBlob(async (blob) => {
  const body = new FormData();
  body.set("master", blob); body.set("thumb", blob);
  body.set("contactId", "REPLACE_WITH_REAL_CONTACT_ID");
  body.set("filename", "probe.jpg"); body.set("width", "8"); body.set("height", "8");
  const r = await fetch("/api/photos/upload", { method: "POST", body });
  console.log(r.status, await r.json());
}, "image/jpeg");
```
Expected: `201 { id, thumbUrl }`; GET the thumbUrl → image renders; DELETE `/api/photos/<id>` → `{ ok: true }` and the GET now 404s. Also probe `GET /api/photos/../x/master` → 400.

- [ ] **Step 4: Commit**

```bash
git add apps/app/app/api/photos apps/app/app/api/drawings/thumbnail
git commit -m "feat: photo upload, serve and delete routes"
```

---

### Task 6: Client processing + upload hook + cache entry

**Files:**
- Create: `apps/app/lib/photo-client.ts` (pure canvas helpers)
- Create: `apps/app/components/photos/use-photo-upload.ts`
- Modify: `apps/app/lib/trpc/cache.ts` (type + entry)

**Interfaces:**
- Consumes: `photoUrl` semantics from Task 5's routes; `useCrmCache` conventions.
- Produces:
  - `processPhotoFile(file: File): Promise<{ master: Blob; thumb: Blob; width: number; height: number } | null>` — null when the browser cannot decode the file (the HEIC/unsupported case)
  - `usePhotoUpload({ dealId, contactId }: { dealId?: string; contactId?: string }): { upload: (files: File[]) => Promise<void>; uploading: boolean }` — processes + POSTs each file sequentially, toasts per-file errors (`"<name> isn't a supported image — use JPEG."` for decode failures, server `error` string otherwise), invalidates `cache.photos()` once at the end
  - `cache.photos(options?)` on `CrmCache`

`photo-client.ts` (model: the downscale in `apps/app/components/drawings/use-background-image.ts:37-58`):

```ts
export const PHOTO_MASTER_MAX_PX = 2560;
export const PHOTO_THUMB_MAX_PX = 400;
const MASTER_QUALITY = 0.85;
const THUMB_QUALITY = 0.8;

function scaled(image: HTMLImageElement, maxPx: number): { width: number; height: number } {
	const largest = Math.max(image.naturalWidth, image.naturalHeight);
	const ratio = largest > maxPx ? maxPx / largest : 1;
	return {
		width: Math.max(1, Math.round(image.naturalWidth * ratio)),
		height: Math.max(1, Math.round(image.naturalHeight * ratio)),
	};
}

function encode(image: HTMLImageElement, maxPx: number, quality: number): Promise<Blob | null> {
	const { width, height } = scaled(image, maxPx);
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	const context = canvas.getContext("2d");
	if (!context) return Promise.resolve(null);
	context.drawImage(image, 0, 0, width, height);
	return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

function loadImage(file: File): Promise<HTMLImageElement | null> {
	return new Promise((resolve) => {
		const url = URL.createObjectURL(file);
		const image = new Image();
		image.onload = () => {
			URL.revokeObjectURL(url);
			resolve(image);
		};
		image.onerror = () => {
			URL.revokeObjectURL(url);
			resolve(null);
		};
		image.src = url;
	});
}

export async function processPhotoFile(file: File) {
	const image = await loadImage(file);
	if (!image || image.naturalWidth === 0) return null;
	const master = await encode(image, PHOTO_MASTER_MAX_PX, MASTER_QUALITY);
	const thumb = await encode(image, PHOTO_THUMB_MAX_PX, THUMB_QUALITY);
	if (!master || !thumb) return null;
	const { width, height } = scaled(image, PHOTO_MASTER_MAX_PX);
	return { master, thumb, width, height };
}
```

`use-photo-upload.ts` POSTs FormData per file (`master`, `thumb`, `dealId`/`contactId`, `filename: file.name`, `width`, `height`, `takenAt: String(file.lastModified)`), following the logo `useMutation({ mutationFn })` + toast pattern from `workspace-form.tsx:220-239`; track `uploading` with a counter state.

`cache.ts` additions — type member `photos: (options?: Options) => Promise<void>;` and entry (beside `project`):

```ts
		photos: (options) =>
			run(
				[trpc.photos.list.queryKey()],
				[
					trpc.photos.forEstimate.queryKey(),
					trpc.photos.forInvoice.queryKey(),
					trpc.photos.forProject.queryKey(),
				],
				options,
			),
```

- [ ] **Step 1: Implement all three files**
- [ ] **Step 2: Typecheck** — `bun run check-types` → PASS
- [ ] **Step 3: Commit**

```bash
git add apps/app/lib/photo-client.ts apps/app/components/photos/use-photo-upload.ts apps/app/lib/trpc/cache.ts
git commit -m "feat: client photo processing and upload hook"
```

---

### Task 7: Lightbox (packages/ui) + PhotoGrid + Photos tabs

**Files:**
- Create: `packages/ui/src/components/image-lightbox.tsx`
- Create: `apps/app/components/photos/photo-grid.tsx`
- Modify: `apps/app/components/crm/record-sheet/deal-sheet.tsx` (tab entry + `DealPhotos` component)
- Modify: `apps/app/components/crm/record-sheet/contact-sheet.tsx` (tab entry + `ContactPhotos` component)

**Interfaces:**
- Consumes: `usePhotoUpload`, `cache.photos`, `trpc.photos.list`, `photoUrl` path shape (`/api/photos/<id>/<variant>`), `DetailSheetBody`/`DetailSheetSection`/`DetailSheetEmpty` from `apps/app/components/detail-sheet.tsx`, `AlertDialog`/`DropdownMenu`/`Empty`/`Skeleton` from `@crm/ui`.
- Produces:
  - `ImageLightbox({ open, onOpenChange, images, index, onIndexChange }: { open: boolean; onOpenChange: (open: boolean) => void; images: { src: string; title: string }[]; index: number; onIndexChange: (index: number) => void })` — Dialog-based viewer: near-fullscreen `DialogContent`, the image `object-contain`, title caption, prev/next buttons (ghost variant, Carbon `ChevronLeft`/`ChevronRight` — check the icon package other components import and use the same one), ArrowLeft/ArrowRight key handling
  - `PhotoGrid({ dealId, contactId }: { dealId?: string; contactId?: string })` — drop-zone + hidden `<input type="file" accept="image/*" multiple>`, thumb grid `grid grid-cols-2 gap-4 sm:grid-cols-3` (drawing-grid precedent), tile click opens lightbox on the master variant, per-tile DropdownMenu → Delete with AlertDialog confirm (`fetch DELETE /api/photos/<id>` then `cache.photos()`), `Empty` state "No photos yet — drop images here or tap Add photos."

Grid query (options-proxy convention, verbatim):

```tsx
	const trpc = useTRPC();
	const photos = useQuery({
		...trpc.photos.list.queryOptions({ dealId, contactId }),
		placeholderData: (previous) => previous,
	});
```

Drop-zone: a wrapping `div` with `onDragOver={(event) => { event.preventDefault(); setDragging(true); }}`, `onDragLeave={() => setDragging(false)}`, `onDrop={(event) => { event.preventDefault(); setDragging(false); void upload(Array.from(event.dataTransfer.files)); }}` — HTML5 file drop is new to this repo; keep it on this one component. Visual: render the section's upload affordance with the `attachment.tsx` primitive (`state="idle"` dashed border) or a bordered div using ONLY standard tokens (`border-dashed`, `rounded-lg`, `bg-muted/50` when dragging); no custom colors.

Tab entries — deal sheet after `drawings` in the `tabs` array (`deal-sheet.tsx:144-206`):

```tsx
	{ value: "photos", label: "Photos", content: <DealPhotos deal={deal} /> },
```

with

```tsx
function DealPhotos({ deal }: { deal: Deal }) {
	return (
		<DetailSheetBody>
			<DetailSheetSection title="Photos">
				<PhotoGrid dealId={deal.id} />
			</DetailSheetSection>
		</DetailSheetBody>
	);
}
```

Contact sheet mirror (`contact-sheet.tsx:103-148`, after `drawings`): `<PhotoGrid contactId={contact.id} />`. No `count` on either tab (deals.byId doesn't load photo counts; do not widen that query in this phase).

- [ ] **Step 1: Implement `image-lightbox.tsx` in packages/ui** (new shared component — variants belong in packages/ui per design.md)
- [ ] **Step 2: Implement `photo-grid.tsx` + both tab wirings**
- [ ] **Step 3: Typecheck + lint touched files**

```bash
bun run check-types
bunx biome check --write apps/app/components/photos packages/ui/src/components/image-lightbox.tsx apps/app/components/crm/record-sheet/deal-sheet.tsx apps/app/components/crm/record-sheet/contact-sheet.tsx
```
Expected: PASS, no drift outside touched files (`git status` shows only intended files).

- [ ] **Step 4: Live smoke** — dev servers up, open a deal → Photos tab: drop two JPEGs, thumbs appear; click → lightbox, arrow through; delete one; reload → one photo persists. Mobile check: devtools iPhone viewport → the sheet is a bottom drawer and the Add photos input opens the OS picker.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/components/image-lightbox.tsx apps/app/components/photos apps/app/components/crm/record-sheet/deal-sheet.tsx apps/app/components/crm/record-sheet/contact-sheet.tsx
git commit -m "feat: photos tab with gallery, drop zone and lightbox"
```

---

### Task 8: Attach flows — estimate builder + invoice detail

**Files:**
- Create: `apps/app/components/photos/attach-photos-dialog.tsx`
- Create: `apps/app/components/photos/linked-photos-section.tsx`
- Modify: `apps/app/components/estimates/estimate-builder.tsx` (new block after the `AddLineItem` div at ~L515-517, inside the `gap-6` column)
- Modify: `apps/app/components/invoices/invoice-detail.tsx` (new block between `AddInvoiceLineItem` ~L393 and the total row ~L395)

**Interfaces:**
- Consumes: `trpc.photos.forEstimate/forInvoice/linkEstimate/unlinkEstimate/setEstimatePdfFlag/reorderEstimatePhotos` (+ invoice mirrors), `usePhotoUpload`, `SortableList` from `@crm/ui` (`packages/ui/src/components/sortable-list.tsx` — `SortableList({ ids, onReorder, children })`), `Switch` or `Checkbox` from `@crm/ui` (use whichever estimate-builder already imports; default `Switch`), `ImageLightbox`, `cache.photos` + `cache.estimate(id)` / `cache.invoice(id)`.
- Produces:
  - `AttachPhotosDialog({ open, onOpenChange, dealId, linkedPhotoIds, onAttach }: { open: boolean; onOpenChange: (open: boolean) => void; dealId: string | null; linkedPhotoIds: string[]; onAttach: (photoId: string) => void })` — Dialog listing the deal's photos as a thumb grid; already-linked tiles show a check overlay and don't re-attach; an in-dialog upload button reuses `usePhotoUpload({ dealId })`
  - `LinkedPhotosSection({ surface, targetId, dealId }: { surface: "estimate" | "invoice"; targetId: string; dealId: string | null })` — heading `<h2 className="font-medium text-sm text-muted-foreground">Photos</h2>` (matches estimate-builder's `Options` heading at ~L496), "Attach photos" outline button, `SortableList` rows: 48px thumb, filename, "In PDF" `Switch`, remove button

Mutation wiring (verbatim shape):

```tsx
	const setFlag = useMutation(
		trpc.photos.setEstimatePdfFlag.mutationOptions({
			onSuccess: async () => {
				await Promise.all([cache.photos(), cache.estimate(targetId)]);
			},
			onError: (error) => toast.error(error.message),
		}),
	);
```

`onReorder(ids)` → `reorderEstimatePhotos.mutate({ estimateId: targetId, photoIds: ids })` (the list already holds the exact set, satisfying the server guard). For `surface === "invoice"` every proc swaps to the invoice mirror — branch once at the top of the component into a small `procs` object; do not duplicate the JSX.

Estimate builder gets `dealId` from the loaded estimate (check the `Estimate` type in `estimate-builder.tsx` — `RouterOutputs["estimates"]["byId"]`; it has `dealId` since estimates attach to deals; when null, the Attach dialog shows the photo-less "This estimate has no deal" `Empty` state).

- [ ] **Step 1: Implement dialog + section, wire into estimate builder**
- [ ] **Step 2: Wire into invoice detail** (same `LinkedPhotosSection`, `surface="invoice"`)
- [ ] **Step 3: Typecheck + lint touched files** — `bun run check-types` PASS
- [ ] **Step 4: Live smoke** — estimate: attach 2, flag 1 In-PDF, drag-reorder, remove 1, reload persists; invoice: same on a converted invoice
- [ ] **Step 5: Commit**

```bash
git add apps/app/components/photos apps/app/components/estimates/estimate-builder.tsx apps/app/components/invoices/invoice-detail.tsx
git commit -m "feat: attach photos to estimates and invoices with pdf flags"
```

---

### Task 9: Project photos — header action + stage labels

**Files:**
- Create: `apps/app/components/photos/project-photos-dialog.tsx`
- Modify: `apps/app/app/(app)/[slug]/projects/[id]/project-header.tsx` (actions cluster at ~L153: add a "Photos" outline button)

**Interfaces:**
- Consumes: `trpc.photos.forProject/linkProject/unlinkProject/setProjectStage`, `trpc.projects.byId` (for `dealId`), `AttachPhotosDialog`, `ImageLightbox`, `Select` from `@crm/ui`, `cache.photos` + `cache.project(id)`.
- Produces: `ProjectPhotosDialog({ open, onOpenChange, projectId, dealId }: { open: boolean; onOpenChange: (open: boolean) => void; projectId: string; dealId: string | null })` — Dialog (size large) with a thumb grid of `forProject` rows; each tile gets a stage `Select` (`Before / In progress / After / Final` labels mapping to the enum), a remove button, and click-to-lightbox; "Attach photos" opens `AttachPhotosDialog` over the project's deal photos. Stage chips use `Badge` variants that exist — no new colors.

Stage label copy map (single source in this file):

```ts
const STAGE_LABELS = {
	BEFORE: "Before",
	IN_PROGRESS: "In progress",
	AFTER: "After",
	FINAL: "Final",
} as const;
```

- [ ] **Step 1: Implement dialog + header button** (button mirrors the existing header action styling — copy the variant of the neighbouring actions in `project-header.tsx`)
- [ ] **Step 2: Typecheck** — PASS
- [ ] **Step 3: Live smoke** — project page → Photos → attach from deal, set one to After, reload persists; deal-sheet Photos tab shows the same photo once (links don't duplicate photos)
- [ ] **Step 4: Commit**

```bash
git add apps/app/components/photos/project-photos-dialog.tsx "apps/app/app/(app)/[slug]/projects/[id]/project-header.tsx"
git commit -m "feat: project photos with stage labels"
```

---

### Task 10: PDF photos sections

**Files:**
- Modify: `apps/api/src/estimates/estimate-pdf.ts` (extend `EstimatePdfEstimate` type + new `photosSection`)
- Modify: `apps/api/src/estimates/estimates.service.ts` (`loadForPdf` at ~L602)
- Modify: `apps/api/src/invoices/invoice-pdf.ts` + `apps/api/src/invoices/invoices.service.ts` (mirror)
- Modify: `apps/api/src/photos/photos.service.ts` (new method) + `apps/api/test/photos.integration.spec.ts`

**Interfaces:**
- Consumes: `readPhotoFile` from `@crm/db/photo-files`; `Image` from `@react-pdf/renderer` (precedent: `contract-pdf.ts:4,179` — data-URL string `src`).
- Produces:
  - `PhotosService.pdfPhotosForEstimate(estimateId: string): Promise<{ filename: string; dataUrl: string }[]>` — loads links `where: { includeInPdf: true }` ordered `sortOrder asc`, reads each master from disk, skips photos whose file is missing (log one warn object per skip), returns `data:image/jpeg;base64,...` strings
  - `PhotosService.pdfPhotosForInvoice(invoiceId: string)` — mirror
  - `EstimatePdfEstimate` gains `photos: { filename: string; dataUrl: string }[]`; `renderEstimatePdf` renders a `photosSection` after the line-item rows: section heading Text "Photos", then a wrapping `View` (`flexDirection: "row"`, `flexWrap: "wrap"`) of cells (`width: "48%"`, `marginBottom: 12`) each `createElement(Image, { style: styles.photo, src: photo.dataUrl })` + a caption Text (filename, muted style consistent with the stylesheet's existing muted color). Empty array → section is `null` (the `contactBlock` null-or-element precedent at `estimate-pdf.ts:296-313`). Everything stays `createElement` — the file is `.ts`, no JSX.

Service wiring: `EstimatesService` gains `@Inject(PhotosService)` (add `PhotosModule` to the estimates module's `imports` — `PhotosModule` already `exports: [PhotosService]`; check `estimates.module.ts` and `invoices.module.ts` import arrays; watch for circulars — photos.service must NOT import estimates/invoices services, it only touches the db). `loadForPdf` maps `photos: await this.photos.pdfPhotosForEstimate(id)`.

- [ ] **Step 1: Write failing tests** — in `photos.integration.spec.ts`: point `process.env.PHOTOS_DATA_DIR` at a mkdtemp dir in `beforeAll` (delete in `afterAll`), `savePhotoFiles` real JPEG-magic bytes (`Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...])` padded), then:

```ts
it("returns only pdf-flagged estimate photos in sort order", ...)  // 3 links: flagged idx2, flagged idx0, unflagged -> 2 rows, sorted, dataUrl startsWith "data:image/jpeg;base64,"
it("skips a flagged photo whose file is missing", ...)             // flagged link, no file on disk -> []
```

- [ ] **Step 2: Run to verify failure** — `cd apps/api && bun test test/photos.integration.spec.ts` → new cases FAIL
- [ ] **Step 3: Implement service methods + both PDF sections + loadForPdf wiring**
- [ ] **Step 4: Run tests** — PASS (~18); then `bun run check-types` → PASS (regenerates server.ts if router changed — it didn't, but commit it if it did)
- [ ] **Step 5: Live smoke** — estimate with 1 flagged photo → Download PDF → photo visible in the PDF; unflag → PDF has no Photos section; invoice mirror
- [ ] **Step 6: Commit**

```bash
git add apps/api/src/estimates apps/api/src/invoices apps/api/src/photos apps/api/test/photos.integration.spec.ts
git commit -m "feat: photos sections in estimate and invoice pdfs"
```

---

### Task 11: Full-suite gates + Playwright walkthrough

**Files:**
- Create: walkthrough driver scripts under the scratchpad (throwaway, not committed)

- [ ] **Step 1: Full gates**

```bash
bun run check-types
cd apps/api && bun test
cd ../../apps/app && bun test
cd ../packages/db && bun test
cd ../ui && bun test
```
Expected: green except the evidenced PRE-EXISTING failures (apps/api bulk/auth-e2e env failures; @crm/auth organization spec's 4 leaked member rows breaks only tree-wide runs against shared crm_test — this worktree's private `janus_photos_test` starts clean, so it should not reproduce; document anything red with evidence it predates this branch).

- [ ] **Step 2: Playwright walkthrough** (driver under NODE not bun; app on 3100, api on 3102; login via `/api/dev-login?email=karlosantanas@gmail.com` — mints OWNER; locator gotcha: prefer `title^=` / exact `getByRole` over `.first()`/`.last()` — the 9/8 QA campaign's false-positives came from fragile locators)

Checklist the driver must pass:
1. Deal sheet → Photos tab → upload 2 JPEGs via the hidden input (`setInputFiles`) → 2 thumbs render
2. Click thumb → lightbox opens on master → arrow-key to second → Escape closes
3. Estimate (create from a drawing or open seeded) → Photos → Attach → pick photo 1 → appears in list
4. Toggle In-PDF on → `estimates.document` PDF bytes contain > 1 JPEG SOI marker (`ffd8ff` count ≥ 2 — page render + embedded photo) or assert PDF byte-length grows vs before flagging
5. Drag-reorder the two attached photos (attach photo 2 first) → order persists on reload
6. Invoice: convert estimate → invoice → Photos section shows links carried? NO — links do NOT carry over (v1 rule: invoice starts unlinked; assert empty, then attach + flag on the invoice directly)
7. Project → header Photos button → attach → set stage "After" → reload → stage persists
8. Contact sheet → Photos tab → upload 1 → renders
9. Delete a photo from the deal gallery → it disappears from the estimate's linked list too (cascade)
10. Mobile viewport (390×844): deal sheet opens as bottom drawer, Photos tab reachable, file input present
11. Security probes: `GET /api/photos/zz../master` → 400; `GET /api/photos/<realid>/master` logged-out → 401; upload a PNG posing as `master` (magic bytes PNG) → 415

- [ ] **Step 3: Fix anything the walkthrough surfaces** (each fix its own commit)
- [ ] **Step 4: Kill the dev servers and any Playwright child processes when done** (orphaned listeners caused the 9/7 port collision)
- [ ] **Step 5: Final commit + hand off**

```bash
git log --oneline janus/foundation..HEAD
```
Report branch + head SHA to kyle-cc's merge train; migrations note: one additive migration `add_photos`, timestamped after `20260908062546`. Do NOT merge; do NOT touch the main checkout.

---

## Deferred / out of scope (ledger for the spec's followers)

- `photo.uploaded` event — automations phase (catalog record kinds + Nest-side emission don't fit the Next-route upload; decided 2026-09-11)
- Estimate→invoice conversion does NOT copy photo links (product call for Kyle if wanted)
- Deal/contact cascade deletion leaves orphan photo directories on disk (no file cleanup hook on Prisma cascade; acceptable single-tenant, note for a cleanup job)
- Photo counts on sheet tabs (would widen deals.byId/contacts.byId)
- Client-submitted photos via forms; pack builder consumption
- `/field` crew page quick-add entry point (natural fast-follow; the deal-sheet tab is reachable from field mode already)
