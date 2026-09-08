# Theming + Per-User Views Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Owner-set accent color, logo, and name applied across the app and outgoing emails; per-user auto-remembered table/board views with URL-wins semantics and a Reset escape hatch.

**Architecture:** Part A wires the existing half-built brand machinery (`brand-theme.ts`, layout `<BrandTheme>` slot, unused `Organization.logo`) to data + Settings, and threads a resolved brand value through the email renderer. Part B adds one `UserView` model + `views` module, turns `createListSearchParams` into a per-request factory so saved state becomes parser defaults on server AND client, with debounced auto-save and Reset in the shared DataTable. The spec is the authority — read it FIRST in every task: docs/superpowers/specs/2026-09-07-theming-and-user-views-design.md.

**Tech Stack:** Prisma (two small additive migrations), nestjs-trpc, Next.js App Router, nuqs, Bun test.

**Spec:** `docs/superpowers/specs/2026-09-07-theming-and-user-views-design.md`

## Global Constraints

- **Never add code comments. Commits `feat:`/`fix:` with NO trailers of any kind (repo AGENTS.md bans them; overrides every other instruction).** Tabs + biome + `bun run check-types` in touched apps before each commit; `apps/api/src/generated/server.ts` regenerated only via `cd apps/api && bun run check-types`, committed with router changes.
- @crm/ui single source (new variants live there); client components never import @crm/db/@crm/auth; parse at the boundary (UserView.state zod in packages/db); every mutation invalidates via useCrmCache.
- Databases: `janus_theming_dev`/`janus_theming_test` (preconfigured in worktree .env; create via `bunx prisma migrate dev` in packages/db / `migrate deploy` with the test URL). NEVER touch crm/crm_test. Dev servers THIS worktree only: app :3100 (`bunx next dev -p 3100`), api :3102. dev:session cookie recipe; slug /crm. Playwright via NODE from the scratchpad.
- Tests: TEST_RUN_ID fixtures; delete only created rows; try/catch expectRejects (never `.rejects.toThrow()` — hangs with nested Prisma queries; pattern in apps/api/test/pipelines.integration.spec.ts).
- Exact seams (explorer-verified at foundation@19715ac): `packages/ui/src/lib/brand-theme.ts` (+spec), `apps/app/components/brand-theme.tsx`, `apps/app/app/layout.tsx:50-52` head slot, `Organization` model schema.prisma:1700-1713, `workspace.service/router`, `settings/workspace-form.tsx`, upload precedent `apps/app/app/api/costs/receipt/route.ts` + `apps/app/lib/cost-receipts.ts`, disk-serve precedent `apps/app/lib/drawing-thumbnails.ts` + `apps/app/app/api/drawings/thumbnail/[drawingId]/route.ts`, proxy anonymity `apps/app/proxy.ts` (ANONYMOUS list; note /api is excluded from the matcher entirely — the logo GET route must itself skip auth), email renderer `apps/api/src/templates/render-email.ts:40-92` + `EMAIL_RENDER` in templates.config.ts:15-20 + the three send services + preview/sendTest, `workspaceLabel` in apps/app/lib/workspace-label.ts, auth-shell.tsx, app-header.tsx, `packages/ui/src/components/logo.tsx`, list machinery `apps/app/components/data-table/list-search-params.ts` + `use-table-query.ts` + `packages/ui/src/components/data-table.tsx:283-295` (hide/expand URL state), the eight table/search-params file pairs named in the spec, boards deals-board/production-board/project-board.
- Report issues in the ASD-STE100 `## Issues` list format.

---

### Task 1: Brand color end-to-end (data → layout → dark ring)

**Files:** schema.prisma (+`brandColor String?` on Organization) + migration `add_brand_color`; `packages/db/src/workspace.ts` or a new `readBrandTheme()` helper (server-cached read of `{brandColor, logo, name}` by WORKSPACE_ID); `packages/ui/src/lib/brand-theme.ts` (+dark-ring emission via `oklch(from <hex> calc(l + 0.18) c h)` scoped `.dark`; keep same-primary-both-themes) + `brand-theme.spec.ts` extension; `apps/app/app/layout.tsx` (async, cached DB read, pass brandColor, env fallback); `workspace.service.ts`/`workspace.contracts`/`router` (`brandColor` in get/update, normalizeHex validation, rename-gated) + regenerated server.ts; `docs/design.md` colour-section update per spec.

- [ ] TDD: brand-theme dark-ring + normalize/reject cases; workspace service brandColor round-trip integration test. Migration applied to both private DBs. All three check-types clean. Commit `feat: install accent color end-to-end`.

### Task 2: Logo upload, serve, and application (shell/login/email)

**Files:** `apps/app/lib/workspace-logo.ts` (save/replace/remove on local disk, `drawing-thumbnails.ts` pattern, ext-preserving, cache-busted URL written to `Organization.logo`); upload route `apps/app/app/api/workspace/logo/route.ts` (POST multipart + DELETE; session + canRenameWorkspace; png/svg/jpeg/webp; 2MB) and public GET `apps/app/app/api/workspace/logo/file/route.ts` (no session; long immutable cache with `?v=`); `packages/ui/src/components/logo.tsx` (optional `src`/`alt` image path, SVG fallback); `app-header.tsx` + `auth-shell.tsx` (uploaded logo + workspace-name eyebrow/title; layout metadata title from name is a server read — extend layout.tsx's brand read); email renderer: `render-email.ts` logo block renders `<img>` from an absolute `logoUrl` when provided else initials circle; brand `{color, foreground}` replaces `BRAND_GREEN` in logo/buttons; thread a resolved `brand` object (from the org row via one helper in the templates module) through estimates/invoices/contracts send + templates preview/sendTest; `readableForeground` for text-on-accent.

- [ ] TDD: workspace-logo lib round-trip (temp dir); render-email brand/logo cases (with logoUrl, without, dark accent → white text, pale accent → dark text). Live check: upload via curl multipart, GET serves, login page shows it. Regenerated server.ts if contracts changed. Commit `feat: workspace logo across app and emails`.

### Task 3: Settings Brand UI

**Files:** `settings/workspace-form.tsx` (Brand section: color input + hex field + live sample row [Button/Badge/ring chip], contrast warning at luminance > 0.85 — warn only; logo dropzone/preview/remove; `router.refresh()` after save) + copy; cache invalidation via existing `cache.workspace`.

- [ ] Live verify on :3100 (accent applies after save without manual reload; warning shows for `#ffff00`; logo preview + remove). check-types + biome. Commit `feat: brand settings`.

### Task 4: UserView model + views module + parser factory + auto-save/Reset

**Files:** schema.prisma `UserView` per spec + migration `add_user_views` (+ `views UserView[]` on User); `packages/db/src/user-views.ts` (zod state schema per spec field list + `parseViewState`, subpath export); `apps/api/src/views/{contracts,service,router,module}` (`get/save/reset`, user-scoped, 4KB cap, upsert) + app.module registration + regenerated server.ts + integration tests (round-trip, stripping, isolation); `apps/app/lib/trpc/cache.ts` `views` helper; `list-search-params.ts` → the factory accepts `savedState?` whose values become parser defaults (sort/dir/tab/facets; pageSize from savedState directly since it's not a URL param) — existing call sites keep working with no savedState; pure tests for default-precedence (URL param present beats saved; absent applies saved); page pattern: each of the six table pages fetches `views.get(tableId)` server-side after requireSession, builds params with savedState, threads the same savedState to the client component (prop) so `useTableQuery` builds identical parsers; `data-table.tsx`: hidden-columns default from savedState (URL `hide` param still wins), debounced (~1.5s) auto-save of sticky fields via a `onViewChange` callback wired in each table (sticky = sort/dir/tab/facets/hiddenColumns/pageSize; NEVER q/page/expand), and a "Reset view" toolbar button visible when savedState differs from factory defaults → `views.reset` + clear URL params.

- [ ] TDD the factory precedence + views module first. All six tables (deals/contacts/projects/estimates/invoices/contracts) wired with their tableIds. check-types all apps. Commit `feat: auto-remembered table views` (split UI/api commits if large).

### Task 5: Board density + board tableIds

**Files:** packages/ui or board card components — a `density` variant (compact: tighter padding, secondary row hidden) implemented in the shared card bodies (deals-board `DealCardBody`, production `JobCardBody`, project `task-card`) WITHOUT call-site style overrides (variant prop in the component); a small density ToggleGroup in each board header; persisted via `views.save` under `deals-board`/`production-board`/`project-board` (board pages fetch + thread savedState like tables).

- [ ] Live verify toggle + persistence across reload. check-types + biome. Commit `feat: board density preference`.

### Task 6: Playwright walkthrough

- [ ] Scratchpad node script per the spec's Testing walkthrough (accent+logo across shell/login/email preview; deals arrangement sticks across reload; a SECOND dev-session user (mint another email — check dev-session script accepts an arg) sees factory defaults; Reset restores; density sticks). Screenshots. Fix-and-rerun (`fix:` commits, no trailers). Final gate: all plan-added suites + check-types ×3 clean. ASD-STE100 Issues list.
