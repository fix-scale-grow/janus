# Navigation, global search, and job numbers — design

Date: 2026-09-12
Status: approved by Kyle (chat brainstorm, 2026-09-11/12 — AccuLynx screenshots as reference)
Branch: janus/phase-p-nav-search (worktree .claude/worktrees/phase-p-nav-search, off foundation@67cccb6)

## Goal

AccuLynx-familiar navigation without abandoning the Janus identity: an
install-level choice of left rail or top bar, dropdown children per nav
module, bounded customization (reorder + hide), first-class New and Recent
affordances, an expandable Search-or-Ask-Janus input, and human-facing job
numbers with a client-chosen starting point. Copy their grouping shape; beat
their behavior (their search unreliability is a top-5 complaint — ours must
never miss an exact address or number).

Explicitly out of scope: arbitrary user-defined groups (layout-builder trap),
per-user position override, the AccuLynx notification-counter cluster
(pins/calendar/bell), mobile top bar (mobile keeps the existing drawer/rail
behavior).

## Nav registry grows children

One canonical registry stays the single nav brain; each module entry gains
optional children — destinations, not pages:

- Deals ("Jobs"): children AUTO-GENERATED from the install's pipelines and
  stages (stages-as-data) → each child links to the deals table pre-filtered
  to that stage. This absorbs the client-wave "pipeline stage click-through"
  feature. Multi-pipeline installs group children by pipeline.
- Contacts: New contact · All contacts.
- Photos: Add photos · Recent photos (deal-agnostic recent gallery view or
  the deals-photos surface — implementer picks the cheapest honest target).
- Projects, Estimates, Invoices, Contracts: All + New where a create surface
  exists.
- Tools: canonical utility children (calendar/settings-cluster routes that
  exist today: templates, price book, symbols, crews, forms, automations
  when built, reports).
- New (first-class button): quick-create menu — contact, deal, estimate,
  drawing, project.
- Recent (first-class button): per-user last-touched records, tracked
  SERVER-SIDE so it follows the user across devices. Small `RecentRecord`
  ring per user (cap ~15, upsert on record-sheet open), rendered newest
  first with kind icons.

## Two shells, one registry

- Existing left icon rail stays; children render as flyout menus on the rail.
- New top-bar shell: one row (not AccuLynx's two) — logo/brand, nav groups
  with dropdown children, then the search pill right-aligned. Brand accent
  via the existing brand-theme tokens.
- Position is an INSTALL setting: `Organization.navLayout` enum
  `RAIL | TOP_BAR` (default RAIL), edited in Settings › General beside the
  brand section, applied in the [slug] layout server-side (no flash).

## Bounded customization

Settings › General › Navigation section:

- Drag-reorder top-level modules (shares state with the rail's existing
  drag-order — same UserView "nav" tableId).
- Hide/show top-level modules and individual children (`navHidden: string[]`
  alongside `navOrder`; child ids namespaced `module.child`).
- Reset control (the parked views.reset follow-up lands here).
- Settings itself is never hideable. Stage children are not individually
  hideable (they mirror pipeline config; archive the stage instead).
- Per-user, like nav order today. The install-level piece is ONLY position.

## Search or Ask Janus

- Collapsed pill (both shells): "Search or ask Janus…" — top-right in the
  top bar; bottom of the rail as an icon in rail mode. Expands on click
  (and via keyboard shortcut) into a wide input with a results dropdown.
- Instant fuzzy search, single `search.everything` tRPC query, debounced,
  grouped hits: Jobs (deal name + #number + stage), Contacts (name),
  Addresses (contact + drawing address fields), Documents (estimate/invoice/
  contract by number). Digits-first input ranks number matches on top.
- Postgres trigram (`pg_trgm`) indexes on the searched columns so exact
  strings never miss; ILIKE prefix fallback if the extension is unavailable
  (self-hoster rule: missing capability degrades, never throws).
- Last row of the dropdown, always: "Ask Janus: '<query>' →" — opens a
  WORKSPACE-kind conversation (the dashboard Ask-Janus substrate) seeded
  with the query. Question-shaped input (ends with ?, starts with an
  interrogative) promotes the Ask row to the top.
- Keyboard-first: ↑↓ navigate, Enter opens, Esc collapses.

## Job numbers

- `Deal.number Int @unique @default(autoincrement())` (the Invoice.number
  pattern), displayed as #<number> on deal cards, sheets, and search hits.
- Settings › General: "Job numbers start at" — writes the underlying
  sequence's next value (guarded: only forward, never backward past an
  existing number; admin-gated).
- Backfill: existing deals get numbers in createdAt order at migration time
  (so old jobs are searchable by number too).
- Search treats all-digit queries as number lookups first (deals, invoices,
  contracts).

## Testing

- Unit: nav-order/hidden merge helpers, search ranking (digits-first,
  question-shape detection), sequence-start guard.
- Integration (private DBs): search.everything scoping + grouping + trigram
  and fallback paths; deal number backfill order; recents upsert/cap.
- Playwright walkthrough: switch install to top bar (team-wide effect,
  second user sees it), dropdown children incl. stage click-through lands
  filtered, hide/reorder/reset, quick-create, recents, search expand →
  exact address hit → digit hit → Ask Janus handoff, mobile viewport
  unaffected.

## Sequencing

Runs parallel to kyle-52's smart-estimating phase. Seams: packages/db
user-views zod (additive field — coordinate), Deal model (additive number —
estimating touches estimates not deals), conversations surface (read/create
only, no contract changes). Merge via train under the standing
merge-when-ready order.
