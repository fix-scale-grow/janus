# Janus: Install Theming + Per-User Views — Design Spec

**Date:** 2026-09-07
**Status:** Approved in brainstorming with Kyle (free accent picker; brand reach = app + emails, PDFs deferred; views auto-remember). Spec review delegated per standing "roll it out".
**Goal:** Every install looks like the company that owns it — accent color, logo, name — and every user's tables open the way that user last arranged them.

## Part A: Install theming

### What exists (build on, don't rebuild)

`packages/ui/src/lib/brand-theme.ts` already ships `normalizeHex`, WCAG `relativeLuminance`/`readableForeground`, and `brandThemeCss(brandColor)` emitting `--primary`/`--primary-foreground`/`--ring`/`--sidebar-*` overrides; `apps/app/components/brand-theme.tsx` renders it into `<head>` (FOUC-free) from `JANUS_BRAND_COLOR` env, with a `brandColor` prop ready for the DB path its own comment anticipates (`organization.brandColor`). `Organization.logo String?` exists unused. Workspace name is already editable in Settings › General.

### Data + API

- Migration `add_brand_color`: `Organization` gains `brandColor String?` (hex, normalized `#rrggbb`). `logo` column reused as the served-logo URL/path marker.
- `workspace.get` additionally returns `{ brandColor, logoUrl }`; `workspace.update` accepts `brandColor?: string | null` (service normalizes via `normalizeHex`, rejects invalid with a plain message) — rename-gated like name.
- Logo upload: multipart route `apps/app/app/api/workspace/logo/route.ts` following the cost-receipt pattern (formData, MIME allowlist png/svg/jpeg/webp, 2 MB cap, session + `canRenameWorkspace` check), stored on local disk via a `workspace-logo.ts` lib mirroring `drawing-thumbnails.ts` (`WORKSPACE_DATA_DIR`-style override, default `<root>/data/workspace/logo.<ext>`), served by an auth-EXEMPT public GET route `/api/workspace/logo?v=<stamp>` (the login page and emails need it without a session; content is a company logo — public by nature). DELETE (or a null update) removes it. `Organization.logo` stores the cache-busted serving URL.

### Application surfaces

- **Root layout**: `RootLayout` becomes async, reads `{ brandColor }` (one cached DB read; a small `readBrandTheme()` helper in `@crm/db` or via the auth org helper) and passes it to `<BrandTheme>`; env `JANUS_BRAND_COLOR` stays as fallback when the column is null. `brandThemeCss` gains the doctrine's missing dark-ring treatment: emit a `.dark`-scoped `--ring`/`--sidebar-ring` lightened via `oklch(from <hex> calc(l + 0.18) c h)` (same visual intent as the stock `#40be96`), keeping `--primary` identical in both themes per doctrine.
- **Shell + login**: `Logo` component (`packages/ui`) gains an optional `src` render path — when the install has a logo, shell wordmark row and `auth-shell.tsx` render the uploaded image (constrained height, `alt` = workspace name) instead of the built-in SVG; the login "CRM" eyebrow and layout `title` metadata use the workspace name (`workspaceLabel`); static favicons unchanged (follow-up).
- **Emails**: the `logo` block in `render-email.ts` renders the uploaded logo image (absolute URL from `APP_URL` + serving route) when present, else today's initials circle; `EMAIL_RENDER.brandGreen` and the two button colors stop being hardcoded — the render pipeline takes a `brand: { color, foreground }` value resolved from the org row (fallback `#006b4f`/white), threaded by the three senders + preview/sendTest. `readableForeground` picks button/initials text color.
- **Explicitly NOT recolored** (doctrine: accent ≠ data colors): `--chart-*`, `--swatch-*`, stage colors, `--code-string` (keep current values; note `--code-string`'s light-theme `var(--primary)` reference is replaced by the literal green so code samples don't shift with brand), `--destructive`. PDFs stay text-only (fast follow).
- **docs/design.md** updated: the colour section describes the accent as an install token sourced from Settings (same value both themes, ring lightened in dark — now computed), with `#006B4F` as the default.

### Settings UI

Settings › General (workspace-form.tsx) grows a "Brand" section: accent color input (native `<input type="color">` + hex text field, live preview chip row showing a primary button/badge/ring sample), contrast warning when `relativeLuminance` > 0.85 ("Too pale to read white text — Janus will use dark text on it") — warn, never block; logo uploader (drop/browse, preview, remove) gated like rename. Saving invalidates `workspace` cache; the layout's brand read is `React.cache`-per-request, so a full reload applies it (the form triggers `router.refresh()` on save so the new accent appears immediately).

## Part B: Per-user views (auto-remember)

### Model

```prisma
model UserView {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  tableId   String
  state     Json
  updatedAt DateTime @updatedAt

  @@unique([userId, tableId])
  @@map("user_view")
}
```

`state` parsed at the boundary by a zod schema in `packages/db/src/user-views.ts`: `{ sort?, dir?, tab?, facets?: Record<string,string>, hiddenColumns?: string[], pageSize?, density?: "comfortable" | "compact" }` — every field optional, unknown keys stripped. `tableId` is a stable literal per surface (`deals`, `contacts`, `projects`, `estimates`, `invoices`, `contracts`, `deals-board`, `production-board`).

### API

`views` tRPC module (AuthMiddleware): `get({ tableId })` → parsed state or null; `save({ tableId, state })` upsert (validated, ~4KB cap); `reset({ tableId })` delete. All scoped to `ctx.user.id`. `cache.views(tableId?)` helper.

### Behavior (the auto-remember contract)

- **What sticks**: sort, dir, tab, facet selections, hidden columns, pageSize, board density. **What never sticks**: search text `q`, page number, expanded rows.
- **URL wins**: params present in the URL always override the saved state (deep links and shares are untouched). A visit with NO table params applies the saved state.
- **Server-side application, no flash**: `createListSearchParams` becomes usable per-request — pages `requireSession()`, fetch the user's saved state, build parsers whose DEFAULTS are the saved values, and prefetch with those; the same saved state is passed to the client table (via a small provider/prop) so `useTableQuery`'s client parsers use identical defaults — server and client agree, no desync, no redirect.
- **Auto-save**: the client table observes its own state; any change to a sticky field debounces (~1.5s) into `views.save` — silent, no toast. First-ever change creates the row.
- **Reset**: when saved state differs from the table's factory defaults, the toolbar shows a quiet "Reset view" button → `views.reset` + clears the URL params. This is the escape hatch that makes auto-remember safe.
- **Board density**: deals/production/project boards get a density toggle (comfortable = today; compact = tighter card padding, hidden secondary row via a `density` prop on the card body — packages/ui variants, no call-site style overrides), persisted under their board tableId.
- v1 applies to the eight tableIds listed; the machinery is generic so later tables opt in by passing their tableId.

## Out of scope (recorded follow-ups)

Logo in PDFs; dynamic favicons; per-user default landing page; named multi-views ("Insurance jobs" presets — the model's `tableId` keying leaves room via suffixes later); org phone setting; auto-remember for the dashboard pipeline picker.

## Testing

- brand-theme: extend the existing spec for the dark-ring emission + normalize/contrast edges.
- workspace service: brandColor normalize/reject; logo lib: save/replace/remove round-trip (temp dir).
- Email render: logo block with and without an uploaded logo; button colors from brand value; initials fallback.
- views module: get/save/reset round-trip, zod stripping, per-user isolation (two users, same tableId).
- Search-params factory: saved-state defaults vs URL-override precedence (pure tests on the parser builder).
- Playwright walkthrough: set accent + upload logo → shell/login/email preview reflect them; arrange the deals table (hide column, sort, facet) → reload → it stuck → new incognito-equivalent user sees factory defaults → Reset view restores; board density toggle sticks.

## Build order

1. Brand data + API + layout/theme application (accent end-to-end incl. dark ring).
2. Logo upload/serve + shell/login/email application.
3. Settings Brand UI.
4. UserView model + views module + parser-factory rework + auto-save/Reset in DataTable.
5. Board density + remaining tableIds.
6. Playwright walkthrough.
