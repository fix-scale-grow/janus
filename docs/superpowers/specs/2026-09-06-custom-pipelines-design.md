# Janus: Custom Pipelines and Stages — Design Spec

**Date:** 2026-09-06
**Status:** Approved in brainstorming with Kyle (trade-default seed, curated swatches, multiple pipelines from day one; spec review delegated — "Just roll it out").
**Goal:** Replace the hardcoded `DealStage` enum with owner-editable pipelines and stages — name, color, order, and outcome semantics managed from Settings — so a roofer's board says "Inspection scheduled", an insurance flow can live beside a retail flow, and every screen, chart, guard, and agent behavior keeps working from the data.

## Why now, and what exists

`DealStage` is a 7-value Prisma enum consumed at ~28 semantic branch points (won/lost/closed/entry) across three parallel copies of the semantics (`packages/db/src/deal-stage.ts`, `apps/app/lib/deal-stage.ts`, `apps/agent/agent/lib/accounts.ts:isOpen`). Labels/colors are client constants. The fields subsystem (`FieldDefinition`/`FieldOption` + `fields` router + `fields-list.tsx`) is the proven template for position + archivedAt + reorder + a drag-order settings editor. This spec turns the enum into data and collapses the three semantic copies into one.

## Data model

```prisma
enum StageOutcome {
  OPEN
  WON
  LOST
  DISQUALIFIED
}

model Pipeline {
  id         String    @id @default(cuid())
  name       String
  position   Int
  archivedAt DateTime?
  stages     Stage[]
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt

  @@index([position])
  @@map("pipeline")
}

model Stage {
  id         String       @id @default(cuid())
  pipelineId String
  pipeline   Pipeline     @relation(fields: [pipelineId], references: [id], onDelete: Cascade)
  key        String
  label      String
  color      String
  position   Int
  outcome    StageOutcome @default(OPEN)
  isEntry    Boolean      @default(false)
  archivedAt DateTime?
  deals      Deal[]
  createdAt  DateTime     @default(now())
  updatedAt  DateTime     @updatedAt

  @@unique([pipelineId, key])
  @@index([pipelineId, position])
  @@map("stage")
}
```

`Deal.stage DealStage` becomes `Deal.stageId String` + `stage Stage @relation(fields: [stageId], references: [id], onDelete: Restrict)` (`@@index([stageId])`). `stageChangedAt`, `closedAt`, `closedReason`, `productionStage*` are unchanged. The `DealStage` enum is dropped.

**Outcome semantics (exact parity with today):** `OPEN` = pipeline value, board rail. `WON` = closes the deal, unlocks production, counts as a win. `LOST` = closes, requires a reason, counts against win rate. `DISQUALIFIED` = closes, requires a reason, excluded from win-rate math (today's `UNQUALIFIED_TO_BUY`). "Closed" = `outcome !== OPEN`; there is no separate flag.

**Migration + seed (one migration, `add_pipelines`):** create tables; insert pipeline "Sales" (position 0); insert the seven existing stages under it with `key` equal to the old enum value (history strings stay resolvable forever) and trade-default labels: `DEMO_BOOKED`→"New lead" (isEntry), `QUALIFIED_TO_BUY`→"Inspection scheduled", `DECISION_MAKER_BOUGHT_IN`→"Estimate sent", `CONTRACT_SENT`→"Contract sent" (all OPEN, chart-token colors 1–4), `CLOSED_WON`→"Won" (WON, success color), `CLOSED_LOST`→"Lost" (LOST, error color), `UNQUALIFIED_TO_BUY`→"Unqualified" (DISQUALIFIED, neutral color); add `stageId`, backfill by joining old enum value to `Stage.key`, set NOT NULL, drop the old column and the enum type.

## Rules (server-enforced, mirrored in UI affordances)

- Per non-archived pipeline: exactly one `isEntry` stage (must be OPEN), at least one WON and at least one LOST stage. Setting `isEntry` moves the flag; archiving/retyping a stage that would break an invariant is refused with a plain-language message.
- A stage holding deals archives, never deletes (message mirrors the fields pattern: "This stage still holds deals — archive it instead."). Same for pipelines (a pipeline archives only when every stage is archivable or empty; its deals keep their stages and stay reachable via All-pipelines views).
- Exactly one non-archived pipeline is the default (lowest position); new deals with no explicit stage land on the default pipeline's entry stage.
- Colors come from a curated swatch set: `STAGE_SWATCHES` — 12 entries stored as CSS token strings (the five `--chart-*` tokens plus seven added `--swatch-*` tokens defined in `globals.css` for both themes). The stage editor offers only these; `Stage.color` stores the token string and renders through `StatusIndicator`'s existing `color` prop and the board dots.
- Archived stages stay label-resolvable everywhere history renders (timeline stage changes, agent stage history) — lookups include archived rows.

## API

New module `apps/api/src/pipelines/` (alias `pipelines`), mirroring the fields router surface, all stage/pipeline reads returning stages ordered by position:

- `list({ includeArchived })` → pipelines with nested stages (the one query the board, table, menus, dashboards, and settings share).
- `createPipeline({ name })` (seeds a minimal stage set: entry "New lead", "Won", "Lost"), `updatePipeline({ id, name?, position? })`, `reorderPipelines({ ids })`, `archivePipeline({ id })`, `restorePipeline({ id })`.
- `createStage({ pipelineId, label, color, outcome, position? })` (key = `fieldKeyFromLabel`-style slug, uniquified per pipeline), `updateStage({ id, label?, color?, outcome?, isEntry? })`, `reorderStages({ pipelineId, ids })`, `archiveStage({ id })`, `restoreStage({ id })`, `deleteStage({ id })` (only when no deals ever referenced it — history check on Activity meta is NOT required; the FK restrict plus a deals-count check suffices).

### Deals surface changes

- `deals.contracts`: `stageEnum` replaced by `z.string().min(1)` stage ids; validation moves to the service (unknown/archived stage → BadRequest). `dealListInput` gains `pipelineId?: string` and `wonOnly?: boolean` (the production board's new contract — replaces the client-literal `CLOSED_WON` filter).
- `deals.service`: all 28 semantic branch points switch to stage-row lookups via one new helper module `packages/db/src/stage-semantics.ts` (`isClosed(stage)`, `requiresReason(stage)`, `outcomeOf`, `entryStageOf(pipeline)`), which REPLACES `packages/db/src/deal-stage.ts` and `apps/app/lib/deal-stage.ts`'s semantic halves (presentation stays client-side but reads labels/colors from the query). `setStage`/`bulkSetStage` guard on `requiresReason`; `closedAt` on `isClosed`; `deal.closed`/`deal.opened` events unchanged in shape (payload `from`/`to` carry stage KEYS, as today's strings). Stage sort orders by the stage's `position` within its pipeline (join), not enum ordinal. `buildWhere` status tab maps `open`/`closed` to `outcome` filters; `facetCounts.stage` groups by `stageId` and the response carries `{ id, label, color, pipelineId }` per counted stage so clients render facets without a second query. `create()` resolves the default pipeline's entry stage when no stage given. `setProductionStage` guard becomes `outcome === WON` ("Only won jobs move through production — win the deal first." stays verbatim). `fieldToday` filters by won stages.
- Dashboard service: pipeline-by-stage chart takes `pipelineId` (defaults to the default pipeline); money stat cards, closing-this-month, win/lost trend, and win rate aggregate across all pipelines using outcomes (`WON` wins, `LOST` losses, `DISQUALIFIED` excluded — exact parity).
- Telemetry: `deals_by_stage` becomes `deals_by_outcome` (counts by `StageOutcome`) plus `custom_stage_count` and `pipeline_count` — owner-named labels never enter telemetry. `docs/telemetry.md` updated.

### Agent surface

- `apps/agent/agent/lib/accounts.ts` `isOpen` and `lookup.ts` status mapping read stage rows (`outcome`) instead of hardcoded strings; `list_deals`' `status: open|won|lost|all` vocabulary is unchanged (it was already semantic). `preamble.ts` and transcripts render stage LABELS, not keys.

## UI

- **Settings › Pipeline** (sidebar entry after Fields): pipelines as reorderable cards; each expands to its stage list — `SortableList` rows with color swatch, label (inline edit), outcome select (Open/Won/Lost/Disqualified), entry-stage radio, archive/restore; "New stage" and "New pipeline" affordances; archived section per the fields pattern. Guard violations surface as toasts with the server's message.
- **Deals board:** columns from `pipelines.list` for the selected pipeline; a pipeline `ToggleGroup`/`Select` in the header (nuqs param `pipeline`, default = default pipeline); drag into a LOST/DISQUALIFIED column routes through the existing CloseReasonDialog (copy driven by outcome, not stage identity). Column dots use `stage.color`.
- **Deals table:** pipeline filter facet + dynamic stage facet from `facetCounts.stage`; status tabs stay `Open/Closed` (semantic, unchanged). `DealStageMenu` groups options by pipeline (current pipeline first); picking a stage from another pipeline confirms "Move to {pipeline}?" inline in the menu flow (a nested confirm item, not a new dialog).
- **Stage stepper** (deal sheet): renders the deal's pipeline's OPEN stages + its WON stage; exited state = closed and not won, as today.
- **Create deal:** stage picker lists OPEN stages grouped by pipeline, default = default pipeline's entry stage.
- **Sales dashboard:** stage donut/labels/colors from stage rows; pipeline picker on the chart card.
- **Production board:** `WON_JOBS_INPUT` literal replaced by `{ ...listInput defaults, wonOnly: true }` shared constant (server resolves won stages) — page prefetch and board stay literally identical for the cache key.
- Cache: `cache.pipeline()` helper invalidating `pipelines.list` + deal record/list keys; every pipelines mutation uses it.

## Out of scope (explicit)

- Custom PRODUCTION stages (`ProductionStage` stays an enum; its two `CLOSED_WON` couplings become `outcome === WON`). Separate spec later.
- Per-pipeline dashboards beyond the chart picker; per-user default pipeline; stage-based automations (Phase 3 territory); a `deal.stage` merge token for templates (none exists today; add later with label resolution).
- Win-probability percentages per stage, forecasting weights.

## Testing

- `stage-semantics` unit tests (outcome math, entry resolution, reason requirement).
- `pipelines` module integration tests: invariants (last WON stage cannot archive; entry flag moves; slug uniquification), reorder, archive/restore, deleteStage refusal with deals.
- Deals integration: create lands on default entry; setStage reason guard for LOST and DISQUALIFIED; closedAt set/cleared; wonOnly filter; facetCounts carries stage meta; cross-pipeline stage set moves the deal's pipeline.
- Migration test: on a DB seeded with old-enum-shaped deals (fixture SQL), the backfill maps every deal to the right stage row and drops nothing.
- Dashboard parity test: same fixture, outcome-based numbers equal the pre-refactor formulas.
- Playwright walkthrough: rename a stage + recolor, add a stage mid-pipeline, create a second pipeline, move a deal across pipelines, close a deal as Lost with reason from the board, verify dashboard chart + production board + deal timeline history render correctly, verify an archived stage's history still shows its label.

## Build order

1. Schema + migration + seed/backfill + `stage-semantics` helpers.
2. `pipelines` tRPC module + invariants + tests.
3. Deals contracts/service refactor + tests.
4. Dashboard + telemetry refactor + parity tests.
5. Agent lib refactor.
6. Settings › Pipeline UI.
7. Board/table/menus/stepper/create-deal dynamic UI.
8. Sales dashboard + production wonOnly + cache.
9. Seed.ts rewrite + repo-wide test repair.
10. Playwright walkthrough.
