# Navigation, Global Search, and Job Numbers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Install-level rail-vs-topbar navigation with dropdown children (stages auto-generate the Jobs dropdown), bounded per-user customization (reorder + hide + reset), first-class New/Recent, an expandable Search-or-Ask-Janus input over an upgraded search proc, and Deal job numbers with a configurable start.

**Architecture:** One nav registry (`janus-nav.ts`) grows children; two shells (existing rail + new packages/ui top bar) render it. Per-user nav state stays on UserView `"nav"`; install position + number start live on the `AppSetting` singleton with dedicated settings procs. Search extends the existing `search.quick`/QuickSwitcher pair; Ask-Janus handoff reuses the WORKSPACE AgentPanel with `initialMessage` (forces NEW_THREAD — desired). `Deal.number` follows the `Invoice.number` autoincrement pattern with a hand-authored backfill + `pg_trgm` acceleration.

**Tech Stack:** Prisma (packages/db), NestJS + nestjs-trpc (apps/api), Next.js App Router + tRPC options-proxy (apps/app), @crm/ui shadcn set, dnd-kit SortableList, bun test, Playwright under NODE.

**Spec:** `docs/superpowers/specs/2026-09-12-nav-search-numbering-design.md` (amended 2026-09-12 — authoritative).

## Global Constraints

- AGENTS.md: NO code comments; commit messages type-prefixed lowercase imperative, NO trailers, no MDN prefix; read docs/api.md before api work, docs/design.md before UI work; constants in per-area config modules; parse at the boundary (zod); client components never import server packages (@crm/db barrel — the `@crm/db/images`-style leaf subpaths with precedent are the only exception).
- docs/design.md: shared components from packages/ui only; NO className style overrides; radius scale rounded-sm/md/lg; only primary/destructive filled; new variants live in packages/ui.
- docs/api.md: routers thin (`@Router({ alias })` + `@UseMiddlewares(AuthMiddleware)`; no middleware = PUBLIC); Prisma only in `*.service.ts`; cache invalidation via `useCrmCache()` in `apps/app/lib/trpc/cache.ts` — new mutations add a call there; `bun run check-types` regenerates the COMMITTED `apps/api/src/generated/server.ts`.
- PUSH GATE (`.githooks/pre-push`) runs `bun run check-types` + `bun run lint` + `bun run test` repo-wide — keep ALL THREE green at every commit; run `bunx biome check --write` scoped to touched files (bracketed route dirs must be named explicitly — globs miss them); never `--no-verify`.
- Worktree `C:\Users\Kyle\janus\.claude\worktrees\phase-p-nav-search`, branch `janus/phase-p-nav-search` off foundation@67cccb6. Private DBs `janus_nav_dev` / `janus_nav_test`; shared `crm`/`crm_test` NEVER touched pre-merge. Dev ports app **3116** / api **3118** (`next dev` ignores .env PORT — pass `-p` inline).
- Do NOT edit `packages/ui/src/styles/globals.css` (kyle-52 merge seam). Do NOT touch estimates service/builder (kyle-52's estimating phase) beyond reading.
- bun:test: `.rejects`/`.resolves` HANG with Prisma — try/catch `expectRejects` helper only. Tests delete only rows they created, explicitly, child-first — NO cascade reliance (a review will check). `TEST_RUN_ID ?? "<name>-spec"` suffix namespacing.
- `viewStateSchema` is `.strip()` — every new client key MUST be added to `packages/db/src/user-views.ts` or saves silently drop it. `ViewsService.save` REPLACES the whole state JSON — every save call must spread the current view state (`{ ...view.data, changedKey }`).
- Nav identity keys are unprefixed `href` strings (rail sets `section = item.href` BEFORE `workspaceUrl()`); only `status: "live"` modules ever render (planned modules have no routes — 404s).

---

### Task 0: Worktree environment

- [ ] Copy main-checkout `C:\Users\Kyle\janus\.env` to the worktree root; change ONLY:
```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/janus_nav_dev?schema=public"
TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/janus_nav_test?schema=public"
PORT=3118
API_URL=http://localhost:3118
```
- [ ] `export PGPASSWORD=postgres; /c/Users/Kyle/pg17/pgsql/bin/psql.exe -U postgres -h localhost -c 'CREATE DATABASE janus_nav_dev;'` (and `janus_nav_test`)
- [ ] `bun install --ignore-scripts && git config core.hooksPath .githooks`
- [ ] `cd packages/db && bunx prisma migrate deploy && bun run db:generate` → "up to date"

No commit.

---

### Task 1: Schema + migrations (Deal.number, AppSetting fields, RecentRecord, pg_trgm)

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (`Deal` ~L929 gains number; `AppSetting` ~L1548 gains two fields; `User` gains recents back-relation; `RecentRecord` appended at END)
- Create: `packages/db/prisma/migrations/<timestamp>_add_nav_search_numbering/migration.sql` (generated, then hand-extended)

**Interfaces:**
- Produces: `Deal.number Int @unique @default(autoincrement())` (backfilled by createdAt); `AppSetting.navLayout String?` + `AppSetting.dealNumberStart Int?`; model `RecentRecord`.

- [ ] **Step 1: Schema edits**

`Deal` (beside `name`): `number Int @unique @default(autoincrement())`
`AppSetting`: `navLayout String?` and `dealNumberStart Int?` (nullable String not enum — matches `reportingCurrency` style on that model)
`User`: `recentRecords RecentRecord[]` back-relation
Appended at schema END:

```prisma
model RecentRecord {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  kind      String
  recordId  String
  touchedAt DateTime @default(now())

  @@unique([userId, kind, recordId])
  @@index([userId, touchedAt])
  @@map("recent_record")
}
```

- [ ] **Step 2: Generate then hand-extend the migration**

`cd packages/db && bunx prisma migrate dev --name add_nav_search_numbering --create-only`, then APPEND to the generated SQL (after the ADD COLUMN for number, replacing nothing):

```sql
UPDATE "deal" d
SET "number" = sub.rn
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY "createdAt", id) AS rn
  FROM "deal"
) sub
WHERE d.id = sub.id;

SELECT setval(pg_get_serial_sequence('"deal"', 'number'),
  GREATEST((SELECT COALESCE(MAX("number"), 0) FROM "deal"), 1));

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "deal_name_trgm_idx" ON "deal" USING GIN ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "contact_firstName_trgm_idx" ON "contact" USING GIN ("firstName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "contact_lastName_trgm_idx" ON "contact" USING GIN ("lastName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "contact_companyName_trgm_idx" ON "contact" USING GIN ("companyName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "drawing_address_trgm_idx" ON "drawing" USING GIN ("address" gin_trgm_ops);
```

NOTE: verify Prisma's generated ADD COLUMN handles the NOT NULL + default on a populated table (Prisma emits a serial/identity attach); if the generated SQL adds the column nullable-then-set, keep its order and place the backfill AFTER the column exists but BEFORE any `SET NOT NULL`. If `CREATE EXTENSION` fails on a host without pg_trgm the migration must not die: wrap extension + the five trgm indexes in a `DO $$ BEGIN ... EXCEPTION WHEN OTHERS THEN NULL; END $$;` block so plain installs still migrate (spec's degrade rule).

- [ ] **Step 3: Apply + verify** — `bunx prisma migrate dev` (applies to janus_nav_dev); psql-verify: every deal has a distinct number ordered by createdAt; `\di *trgm*` lists 5 indexes. Then `bun run db:generate`; repo-root `bun run check-types` PASS.
- [ ] **Step 4: Commit** — `feat: deal numbers, nav settings and recents schema`

---

### Task 2: Settings accessors + procs (navLayout, dealNumberStart)

**Files:**
- Modify: `packages/db/src/settings.ts` (accessor pairs beside readReportingCurrency)
- Modify: `apps/api/src/settings/settings.contracts.ts`, `settings.router.ts`, `settings.service.ts` (follow the agentModel proc shapes exactly)
- Create: `apps/api/test/settings-nav.integration.spec.ts`
- Modify (generated): `apps/api/src/generated/server.ts`

**Interfaces:**
- Produces: `readNavLayout(db): Promise<"RAIL" | "TOP_BAR">` (null → "RAIL") + `writeNavLayout(db, value)` in `@crm/db/settings`; tRPC `settings.navLayout` (Query, public-shape data but authed), `settings.setNavLayout({ layout: "RAIL" | "TOP_BAR" })` (admin-gated via `workspaceRoleOf`/`isWorkspaceAdmin` — copy the gate used by workspace.update), `settings.dealNumbering` (Query → `{ nextNumber: number }` read via `SELECT last_value...` or `MAX(number)+1`), `settings.setDealNumberStart({ start: z.number().int().min(1).max(99_999_999) })` (admin-gated).
- `setDealNumberStart` service logic: read `MAX(number)` from deal; if `start <= max` → `BadRequestException("Job numbers can only move forward. The highest number is <max>.")`; else `$executeRawUnsafe` is FORBIDDEN — use `$executeRaw` with the sequence name from `pg_get_serial_sequence`: ``await this.db.$executeRaw`SELECT setval(pg_get_serial_sequence('"deal"', 'number'), ${start - 1})` `` and persist `dealNumberStart` on AppSetting for display.

- [ ] TDD: failing integration tests first (namespaced; construct services by hand like costs spec): setNavLayout persists + navLayout read defaults RAIL; member (non-admin) rejected via expectRejects; setDealNumberStart forward guard rejects `start <= max existing`; accepted start makes the NEXT created deal get that number (create a deal via db.deal.create and assert its number — remember stageId via the seeded-stage lookup `db.stage.findFirstOrThrow({ where: { key: "DEMO_BOOKED" } })`; clean up your deals explicitly).
- [ ] Implement; `bun run check-types` (commits regenerated server.ts); commit — `feat: nav layout and deal numbering settings`

---

### Task 3: Nav registry children + user-view fields + helpers

**Files:**
- Modify: `apps/app/lib/janus-nav.ts` (children on `JanusModule`), `apps/app/lib/nav-order.ts` (+ helpers), `packages/db/src/user-views.ts` (navHidden)
- Modify: `apps/app/components/app-icon-rail.tsx` (ONLY the `saveOrder` spread fix — the flyout UI comes in Task 6)
- Create: `apps/app/lib/nav-children.ts` + tests
- Test: extend `apps/app/lib/nav-order.test.ts`; create `apps/app/lib/nav-children.test.ts`

**Interfaces:**
- `JanusModule` gains `children?: NavChild[]` where `export type NavChild = { id: string; title: string; href: string }` (id = `"<moduleHref>:<slug>"`, e.g. `"/contacts:new"`). Static children added in `JANUS_NAV`: Contacts (New contact `/contacts?new=1`, All contacts `/contacts` — check how the contacts page opens its create surface: grep for the create-dialog query param or button and use the real affordance; if none exists via URL, the child navigates to `/contacts` and the New button covers creation), Photos on Deals? NO — photos ride deal sheets; skip a Photos module (none exists in JANUS_NAV). Projects/Estimates/Invoices/Contracts/Drawings: single "All" child each is pointless — give children ONLY where they add destinations: Deals (dynamic stages — Task 6 resolves at render), Contacts (New/All), Settings→Tools cluster: children Price book `/settings/price-book`, Crews, Symbols, Templates, Fields, Pipeline, Forms, Tracking, Connections (from the settings sidebar ITEMS — real routes only).
- `packages/db/src/user-views.ts`: `navHidden: z.array(z.string().max(120)).max(80).optional()` added to `viewStateSchema` (byte budget: 80×120 max still < 4096 practical guard — keep max(60) if worried; pick 60).
- `apps/app/lib/nav-children.ts` pure helpers:
  - `applyNavHidden<T extends { href: string }>(items: T[], hidden: string[] | undefined): T[]`
  - `isChildHidden(childId: string, hidden: string[] | undefined): boolean`
  - `HIDE_PROOF = ["/settings"]` — Settings can never be hidden (filter guards it)
- Rail `saveOrder` fix (the explorer's Issue 1): `save.mutate({ tableId: "nav", state: { ...view.data, navOrder: next } }, ...)`.

- [ ] TDD on the pure helpers (hidden filtering, settings-unhideable, child id namespacing); implement; typecheck; commit — `feat: nav children registry and hidden state`

---

### Task 4: Search upgrade (search.quick → grouped everything + numbers + addresses)

**Files:**
- Modify: `apps/api/src/search/search.service.ts`, `search.router.ts` (+ a `search.config.ts` for tunables per the constants rule)
- Create: `apps/api/test/search.integration.spec.ts`
- Modify (generated): server.ts

**Interfaces:**
- `SearchHit` gains kinds: `"contact" | "deal" | "invoice" | "contract" | "drawing"` plus `detail` carrying stage name for deals, `#<number>` labels for numbered kinds; keep the existing shape/fields so QuickSwitcher renders unchanged until Task 8.
- `quick(q)` behavior (config in `search.config.ts`: `SEARCH = { perKind: 5, minLength: 2 } as const`):
  - all-digits `q` → number lookups FIRST: deal.number, invoice.number, contract.number (exact int match), then name-contains fallbacks
  - text → contacts (firstName/lastName/email/companyName contains), deals (name), drawings (address), custom-field TEXT values: `db.fieldValue.findMany` where value contains term joined to its DEAL/CONTACT record (check the FieldValue model shape in schema + fields service `tableValuesFor` to select correctly; hits surface AS their parent record with `detail: "<field label>: <value>"`) — cap perKind
  - deals select includes `number` + `stage: { select: { name: true } }`
- Question detection does NOT live server-side — the Ask-Janus row is client logic (Task 8).

- [ ] TDD: integration spec (namespaced rows: contact by company, deal by name + by exact number, invoice by number digits-first ordering — digit query returns the deal-number hit before any name-contains hit, drawing by address fragment, fieldValue text hit surfacing parent deal, minLength gate). expectRejects not needed (queries only). Explicit child-first cleanup.
- [ ] Implement; typecheck; commit — `feat: grouped global search with numbers and addresses`

---

### Task 5: Recents (server-side per-user ring)

**Files:**
- Create: `apps/api/src/recents/` (contracts/service/router/module — the four-file shape) registered in app.module.ts
- Modify: `apps/app/components/crm/record-sheet/record-stack.ts` (touch on open), `apps/app/lib/trpc/cache.ts` (recents entry)
- Create: `apps/api/test/recents.integration.spec.ts`

**Interfaces:**
- Procs: `recents.list()` → `{ rows: { kind, recordId, touchedAt, label }[] }` (join labels: contact name, deal name+number, drawing title, estimate/invoice/contract number/title, project name; drop rows whose record is gone), `recents.touch({ kind: z.enum(["contact","deal","drawing","estimate","invoice","contract","project"]), recordId: z.string().min(1) })` — upsert on the compound unique, bump touchedAt, then prune beyond cap 15 (config `RECENTS = { cap: 15 } as const` in `recents.config.ts`): delete rows for the user beyond the newest 15 in the same service call.
- Client: in `useOpenRecord` (record-stack.ts — find where a record sheet opens) fire `recents.touch` fire-and-forget (`.mutate` with onError swallowed to a debug no-op — opening a record must never toast about recents); `cache.recents()` entry invalidates `recents.list` on touch success.

- [ ] TDD: integration spec — touch/upsert bumps not duplicates; cap prunes oldest beyond 15; list labels join correctly incl. a deleted record dropped. Implement; typecheck; commit — `feat: per-user recent records`

---

### Task 6: packages/ui top-bar nav + rail flyouts

**Files:**
- Create: `packages/ui/src/components/nav-bar.tsx` (the shared top-bar shell primitives: `NavBar`, `NavBarItem` (dropdown trigger w/ icon+title), `NavBarChildItem`, active styling via data attributes — built on dropdown-menu/tooltip primitives; no globals.css edits)
- Modify: `apps/app/components/app-icon-rail.tsx` (children flyouts on rail icons: hover/click DropdownMenu to the side listing children; drag still works — children menus must not break the 300ms suppressClick or dnd sensors)

**Interfaces:**
- `NavBar` renders items from props (the app maps registry → props; packages/ui stays data-agnostic): `items: { href, title, icon, active, children: { id, title, href }[] }[]` + `onNavigate(href)` or plain anchors — MATCH how the rail renders links today (next/link vs router.push; copy its pattern including workspaceUrl prefixing done at the call site).
- Deals children resolve DYNAMICALLY at the shell layer (not in packages/ui): `pipelines`/stages query already exists for boards — find the proc the deals board uses for its stage columns and reuse; child href = `/deals?stage=<stageId or key>` (verify the deals table's stage facet param name via its nuqs usage — use the REAL param so landing filters).
- Hidden children/modules filtered before render via Task 3 helpers.

- [ ] Implement both; typecheck + scoped biome; visual smoke deferred to walkthrough; commit — `feat: top bar nav component and rail flyouts`

---

### Task 7: Shell integration (position setting, New + Recent)

**Files:**
- Modify: `apps/app/app/(app)/[slug]/layout.tsx` (read navLayout server-side via `@crm/db/settings` `readNavLayout(db)` in the server layout — same pattern as readInstallBrandTheme; render TopNav row + hide rail, or rail as today), `apps/app/components/app-header.tsx` (center slot hosts top-bar items when TOP_BAR; right side gains the search pill slot either mode)
- Create: `apps/app/components/nav/quick-create-menu.tsx` ("New" — dropdown: Contact, Deal, Estimate, Drawing, Project — wire each to the REAL create affordance the app has: find each surface's existing create entry (contacts table New button, deals board add, drawings NewDrawingMenu, projects Start-project) and reuse/navigate; where creation only exists inside a deal context, the menu item navigates to the list page), `apps/app/components/nav/recents-menu.tsx` ("Recent" — recents.list rows, kind icon + label, click → `openRecord({kind,id})` for sheet kinds / router push for page kinds)
- Both menus appear in BOTH shells (rail: two icons above the module list; top bar: leftmost after logo).

- [ ] Implement; `bun run check-types`; lint scoped; commit — `feat: install nav position with quick create and recents`

---

### Task 8: Search-or-Ask-Janus pill (evolve QuickSwitcher)

**Files:**
- Modify: `apps/app/components/crm/quick-switcher.tsx` → grouped rendering + Ask row + pill trigger (keep ⌘K + nuqs `k` param behavior)
- Create: `apps/app/components/nav/search-pill.tsx` (collapsed pill "Search or ask Janus…" with ⌘K kbd hint; renders in header right / rail bottom; onClick opens the QuickSwitcher dialog)

**Interfaces:**
- Results grouped by kind with headings (Command groups); hit rows show `#number` where present and stage/detail line; contact/deal hits open via `openRecord` (existing), invoice/contract/drawing/estimate hits router-push to their pages (workspaceUrl prefix — copy the deals-table row-click pattern).
- Ask-Janus row: ALWAYS last (first when query is question-shaped: ends with `?` OR starts with who/what/which/when/why/how/should/can/is/are — pure helper + unit test in `apps/app/lib/ask-detect.ts`); label `Ask Janus: "<query>"`; selecting opens a `Sheet` (size lg, gap-0 p-0 — the ask-janus-widget.tsx pattern verbatim) hosting `<AgentPanel record={{ kind: "workspace", id: "workspace" }} initialMessage={query} />`.
- Debounce via the repo's `useSearchInput` hook if QuickSwitcher lacks one.

- [ ] Unit test ask-detect; implement; typecheck; commit — `feat: search or ask janus pill`

---

### Task 9: Settings › Navigation section + deal number display

**Files:**
- Modify: `apps/app/app/(app)/[slug]/settings/settings-sidebar.tsx` (add { title: "Navigation", href: "/settings/navigation" } after General)
- Create: `apps/app/app/(app)/[slug]/settings/navigation/page.tsx` + `navigation-form.tsx`
- Modify: `apps/app/app/(app)/[slug]/deals/deals-table.tsx` (name cell gains muted `#{row.number}` prefix; number sortable column via SORTABLE map + service), `deals-board.tsx` (card number beside name), `apps/app/components/crm/record-sheet/deal-sheet.tsx` (title `#${number} · ${name}` or number in the stats row — match how invoice-detail titles), `apps/api/src/deals/deals.service.ts` (selects gain number; searchFilter gains the invoice-style digit branch; SORTABLE gains number)
- Modify: `apps/app/lib/trpc/cache.ts` if new settings queries need entries (settings.* rides existing settings invalidation if present — check and follow)

**Navigation form contents:**
- Position: two-option ToggleGroup (Left rail / Top bar), admin-only (disable + explain for members — `permissions.mine` isAdmin), saves via settings.setNavLayout, `router.refresh()` on success (server layout re-reads).
- Menu items: SortableList of visible modules (drag = same navOrder save WITH SPREAD; Switch per module to hide except Settings; expandable child list with per-child hide Switches; stage children shown but not hideable — muted note "Manage stages in Pipeline settings").
- Reset button → views.reset({ tableId: "nav" }) + cache.views("nav").
- Job numbers: current next number (settings.dealNumbering) + "Start at" input + Save (admin-gated; surface the forward-only server error via toast).

- [ ] Implement; typecheck; scoped biome (name bracketed dirs explicitly); commit — `feat: navigation settings and deal number display`

---

### Task 10: Full gates + Playwright walkthrough

- [ ] Repo-root `bun run check-types` + `bun run lint` + `bun run test` ALL green (the push gate trio) — triage anything red against foundation@67cccb6 evidence.
- [ ] Dev servers (app `-p 3116`, api PORT 3118 via env), dev-login OWNER, walkthrough driver under NODE from scratchpad (playwright already installed there; locators: getByRole/exact — no .first()):
1. Default rail renders; drag-reorder still persists (regression); rail icon flyout shows Contacts children; Deals flyout lists the seeded pipeline's stages; click a stage → deals table lands filtered (URL param + visible facet)
2. Settings › Navigation: switch to Top bar → after refresh the top bar renders, rail gone; SECOND USER (dev-login?email=second@example.test) also sees top bar (install-wide)
3. Hide a module (e.g. Reports) → gone from bar; hide a child; Reset restores
4. New menu → create Contact flow reachable; Recent: open two records, menu lists them newest-first, click reopens
5. Search pill: expand via click AND ⌘K; type exact contact name → hit; digits → deal #number hit ranked first; drawing address fragment → hit; custom-field text (seed one via UI or db) → parent record hit
6. Ask row: type "which jobs are stalled?" → Ask row promoted to top; select → Sheet opens AgentPanel workspace with the query as initialMessage (panel renders; agent reply NOT asserted — token may be absent)
7. Deal numbers: table shows #s; board card shows #; sheet shows #; Settings start-at 4470 → create deal via UI → it shows #4470; forward-only guard errors on 10
8. Mobile viewport: drawer nav unaffected in both position modes
- [ ] Fix waves as needed (each committed + re-verified); kill Playwright children; report branch head. Merge under the standing merge-when-ready order: fix any push-gate reds honestly, merge into foundation in the MAIN checkout (verify cwd + floor free), migrate crm + crm_test, db:generate, restart :3000/:3001, smoke, push, cleanup worktree + private DBs, report.

---

## Deferred / ledgered

- First-class Deal/Contact address column (Kyle decision; search covers drawing.address + custom-field text today)
- AccuLynx-style notification counters cluster (pins/calendar/bell) — real scope, not hollow icons
- Per-user position override (v1 is install-only by Kyle's call)
- Custom user-defined nav groups (doctrine: bounded customization only)
- `usePrefetchSection` cases for the new child destinations (nice perf follow-up)
