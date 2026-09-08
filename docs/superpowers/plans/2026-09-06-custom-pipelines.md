# Custom Pipelines Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `DealStage` enum with owner-editable Pipelines and Stages (Settings-managed name/color/order/outcome), migrating every consumer — deals service, board/table/menus, dashboards, telemetry, agent — to stage-row semantics, with multiple pipelines from day one.

**Architecture:** New `Pipeline`/`Stage` models + `StageOutcome` enum; one semantics helper module replaces the three parallel semantic copies; a `pipelines` tRPC module mirrors the fields router; deals/dashboard/agent refactors branch on `outcome` flags; UI reads one `pipelines.list` query everywhere. The spec is the authority: docs/superpowers/specs/2026-09-06-custom-pipelines-design.md — every task implements a named spec section; read it FIRST in every task.

**Tech Stack:** Prisma (migration with data backfill), nestjs-trpc, Next.js App Router, dnd-kit, Bun test.

**Spec:** `docs/superpowers/specs/2026-09-06-custom-pipelines-design.md`

## Global Constraints

- **Never add code comments. No `Co-Authored-By`/`Claude-Session`/any trailer on any commit — repo AGENTS.md bans them and overrides every other instruction.** Commit style `feat:`/`fix:`. Tabs + biome (`bunx biome check --write` on touched files) + `bun run check-types` in the touched app before each commit.
- Intelligence never lives in the API; single tenant; client components never import `@crm/db`/`@crm/auth`; `packages/ui` shadcn only, no style overrides; every mutation invalidates via `useCrmCache()`; `apps/api/src/generated/server.ts` regenerated ONLY by `cd apps/api && bun run check-types`, committed with router changes.
- Databases: `janus_pipelines_dev` / `janus_pipelines_test` (worktree `.env` preconfigured). NEVER touch `crm`/`crm_test`. `bunx prisma migrate dev` (packages/db) creates+migrates dev; `migrate deploy` with the test URL creates the test DB.
- Dev servers: app :3100 / api :3101 from THIS worktree only; never :3000/:3001. dev:session cookie recipe (`cd apps/api && bun run dev:session karlosantanas@gmail.com`), slug /crm. Playwright via NODE from the scratchpad (bun launch hangs).
- Exact seed content, outcome semantics, invariants, swatch policy, and message copy come from the spec — copy them verbatim, never re-derive.
- The explorer-verified consumer map is embedded in each task's Files list; when a listed line number has drifted, find the identifier — the identifiers are verified current at foundation@e459571.
- Tests: TEST_RUN_ID-suffixed fixtures; a test may not delete a row it did not create; direct-service construction pattern per `apps/api/test/tracking-filing.integration.spec.ts`.
- Report issues in the ASD-STE100 `## Issues` list format.

---

### Task 1: Schema, migration + backfill, stage-semantics helpers

**Files:**
- Modify: `packages/db/prisma/schema.prisma` — add `StageOutcome`, `Pipeline`, `Stage` per the spec's Data model verbatim; on `Deal`: replace `stage DealStage @default(DEMO_BOOKED)` with `stageId String` + `stage Stage @relation(fields: [stageId], references: [id], onDelete: Restrict)` + `@@index([stageId])`; drop `enum DealStage`.
- Migration: `packages/db/prisma/migrations/<stamp>_add_pipelines/migration.sql` — hand-written (prisma migrate dev --create-only, then edit): CREATE TYPE/TABLEs; INSERT pipeline "Sales"; INSERT the seven stages (keys = old enum values, trade labels, outcomes, colors, positions, isEntry per spec's Migration + seed section); ADD COLUMN stageId; UPDATE join on key = old stage::text; SET NOT NULL + FK + index; DROP COLUMN stage; DROP TYPE "DealStage".
- Create: `packages/db/src/stage-semantics.ts` — pure helpers over loaded rows: `type StageLike = { outcome: StageOutcome }`; `isClosedStage(stage: StageLike)`, `requiresReason(stage: StageLike)`, `isWonStage`, plus `entryStageOf(stages)` and `STAGE_SWATCHES` (12 token strings: `var(--chart-1..5)` + `var(--swatch-1..7)`). Export via package.json subpath `"./stage-semantics"`.
- Delete: `packages/db/src/deal-stage.ts` (+ its package.json subpath) — Task 3 fixes the importers; this task may leave compile broken ONLY in files Task 3 owns; run `check-types` and list the expected failures in the report instead of a green gate.
- Modify: `packages/ui/src/styles/globals.css` — define `--swatch-1..7` in `:root` AND the dark block (pick oklch values legible on both themes, in the spirit of the existing `--chart-*` tokens).
- Test: `packages db`-level pure tests go in `apps/api/test/stage-semantics.spec.ts` (bun test, no DB).

**Interfaces:**
- Produces: models `Pipeline`/`Stage`/`StageOutcome` via `@crm/db`; `@crm/db/stage-semantics` helpers + `STAGE_SWATCHES`; migration that seeds/backfills.

- [ ] Step 1: Schema edits; `bunx prisma migrate dev --create-only --name add_pipelines` (packages/db, private dev DB), edit the SQL for seed+backfill per spec, then `bunx prisma migrate dev` to apply; verify with a query that a pre-seeded deal row (create one first via SQL with the OLD enum before migrating — i.e. seed a fixture deal in the pre-migration DB state; if the dev DB is empty/fresh, instead verify the backfill SQL logic by applying to a scratch DB seeded via the previous migration chain) maps to the right stage row. Simpler acceptable path: fresh-apply the chain, then run an explicit INSERT/UPDATE round-trip proving key-join correctness.
- [ ] Step 2: TDD `stage-semantics.spec.ts` (outcome math, entry resolution, swatch list length/uniqueness), implement helpers + globals.css tokens.
- [ ] Step 3: Commit `feat: add pipelines and stages as data` (schema+migration+helpers+css; expected-broken importer list in report).

---

### Task 2: `pipelines` tRPC module + invariants

**Files:**
- Create: `apps/api/src/pipelines/{pipelines.config.ts,pipelines.contracts.ts,pipelines.service.ts,pipelines.router.ts,pipelines.module.ts}`; register in `app.module.ts`.
- Modify (regenerated): `apps/api/src/generated/server.ts`.
- Test: `apps/api/test/pipelines.integration.spec.ts`.

**Interfaces:**
- Consumes: Task 1 models/helpers.
- Produces (alias `pipelines`): `list({includeArchived})` → pipelines(+nested ordered stages); `createPipeline({name})` (seeds entry "New lead" OPEN + "Won" WON + "Lost" LOST per spec); `updatePipeline`, `reorderPipelines({ids})`, `archivePipeline`, `restorePipeline`; `createStage({pipelineId,label,color,outcome,position?})` (slugged unique key), `updateStage({id,label?,color?,outcome?,isEntry?})`, `reorderStages({pipelineId,ids})`, `archiveStage`, `restoreStage`, `deleteStage` (refused when any deal references it); `stageLabels()` → `Record<string, string>` of stage key → label INCLUDING archived stages (Task 7's timeline label resolver).
- Invariants enforced in the service exactly per spec Rules (entry uniqueness+OPEN, ≥1 WON, ≥1 LOST per live pipeline, color from `STAGE_SWATCHES`, default pipeline = lowest-position live pipeline).

- [ ] Step 1: Read `apps/api/src/fields/` end-to-end — it is the structural template (append-position, transactional reorder, archive/restore, guard copy style). TDD: failing integration tests for every invariant + happy paths.
- [ ] Step 2: Implement; `check-types` regen; biome; tests green.
- [ ] Step 3: Commit `feat: add pipelines module`.

---

### Task 3: Deals contracts/service refactor

**Files:**
- Modify: `apps/api/src/deals/deals.contracts.ts` (drop `stageEnum` → `z.string().min(1)` for `dealCreateInput.stage?`, `setStageInput.stage`, `dealBulkStageInput.stage`; `dealListInput` gains `pipelineId: z.string().optional()`, `wonOnly: z.boolean().optional()`).
- Modify: `apps/api/src/deals/deals.service.ts` — every consumer the map names: imports of the deleted `@crm/db/deal-stage` → `@crm/db/stage-semantics` + stage-row loads; `create()` default = default pipeline's entry stage; `setStage()`/`bulkSetStage()` validate stage id (unknown/archived → BadRequest), reason guard via `requiresReason`, `closedAt` via `isClosedStage`, events carry stage KEYS in `{from,to}`; `SORTABLE.stage` → `[{ stage: { position: dir } }, ...]`; `buildWhere` status open/closed → `stage: { outcome: OPEN }` / `{ outcome: { not: OPEN } }`, stage filter by id, `pipelineId` filter via `stage: { pipelineId }`, `wonOnly` via `stage: { outcome: "WON" }`; `facetCounts` groups by stageId and returns stage meta `{id,label,color,pipelineId}` rows alongside; `closingFilter` open = outcome OPEN; `fieldToday` won filter via outcome; `setProductionStage` guard `deal.stage.outcome === "WON"` (message verbatim). List/byId selects include `stage: { select: { id, key, label, color, outcome, pipelineId } }` so clients render without lookups.
- Modify: `apps/api/src/agent/…` only if it imports deal-stage (check); fix any other `@crm/db/deal-stage` importers in apps/api (grep).
- Modify (regenerated): `server.ts`.
- Test: `apps/api/test/deals-stages.integration.spec.ts` (create→default entry; reason guards LOST + DISQUALIFIED; closedAt set/clear + deal.closed/opened events; wonOnly; pipelineId filter; facet stage meta; cross-pipeline setStage moves the deal's pipeline; sort by position). Repair existing apps/api tests that referenced enum values (bulk.spec, agent-events.spec, currency-totals — fixtures now create/lookup stage rows; keep assertions' meaning identical).

**Interfaces:**
- Consumes: Tasks 1-2. Produces: deals rows now carrying `stage` objects; `wonOnly`/`pipelineId` list filters; `RouterOutputs["deals"]["list"]` shape change consumed by Tasks 6-8.

- [ ] Step 1: Read the explorer map's §2 API rows + docs/api.md; TDD failing integration tests.
- [ ] Step 2: Implement; ALL apps/api tests that exist for deals/agent-events/currency/bulk green; `check-types` clean apps/api (apps/app still broken until Tasks 6-8 — list expected failures).
- [ ] Step 3: Commit `feat: drive deals from stage data`.

---

### Task 4: Dashboard + telemetry refactor

**Files:**
- Modify: `apps/api/src/dashboard/dashboard.service.ts` — pipeline-by-stage restricted to OPEN outcomes of a `pipelineId` input (default = default pipeline), returning stage meta; won/lost trend + win rate via outcomes (WON win, LOST loss, DISQUALIFIED excluded); money aggregates across all pipelines (outcome filters replace stage-list filters). Dashboard contracts/router take the optional `pipelineId`.
- Modify: `apps/api/src/telemetry/rollup.service.ts` — `deals_by_stage` → `deals_by_outcome` (StageOutcome keys) + `pipeline_count` + `custom_stage_count`; update `docs/telemetry.md` §deals row.
- Test: `apps/api/test/dashboard-stages.integration.spec.ts` — fixture deals across two pipelines and all outcomes; assert win-rate math parity with the spec semantics; assert the stage chart returns only the requested pipeline's OPEN stages with meta.

- [ ] Step 1: TDD failing tests → implement → green; regen server.ts; telemetry spec updated if one asserts the old key (grep `deals_by_stage` in tests).
- [ ] Step 2: Commit `feat: outcome-based dashboards and telemetry`.

---

### Task 5: Agent lib refactor

**Files:**
- Modify: `apps/agent/agent/lib/accounts.ts` — `isOpen(stage: string)` hardcoded 3-string check → stage-row lookup (the deal loads already join enough; add `stage: { select: { key, label, outcome } }` where needed); stage history entries resolve labels via a stages-by-key map (include archived).
- Modify: `apps/agent/agent/lib/lookup.ts` — status open/won/lost → `stage: { outcome … }` filters; returned `stage` becomes the label (agents read labels).
- Modify: `apps/agent/agent/lib/preamble.ts` + `apps/app/lib/agent-transcript.ts` — render stage labels.
- Modify: `apps/agent/agent/lib/crm.ts`/`builder-runtime.ts` selects as needed.
- Test: repair `apps/agent/test/{accounts,lookup,preamble}.integration.spec.ts` fixtures (create stage rows; the stale `"NEGOTIATION"` strings in durable-agent-runtime/agent-events fixtures stay — they only prove arbitrary strings flow through events).

- [ ] Step 1: Read docs/agent.md + the three test files first; TDD-repair; implement; `cd apps/agent && bun run check-types` (or the package's equivalent) + suites green.
- [ ] Step 2: Commit `feat: agent reads stage outcomes and labels`.

---

### Task 6: Settings › Pipeline UI

**Files:**
- Create: `apps/app/app/(app)/[slug]/settings/pipeline/{page.tsx,pipeline-settings.tsx,stage-row.tsx,swatch-picker.tsx}` (+ copy module if the fields pattern's copy file is followed: `pipeline-copy.ts`).
- Modify: `settings-sidebar.tsx` (add `{ title: "Pipeline", href: `${ROOT}/pipeline` }` after Fields).
- Modify: `apps/app/lib/trpc/cache.ts` — `pipeline(options?)` helper: record keys `[trpc.pipelines.list.queryKey()]`, rest `[trpc.deals.list.queryKey(), trpc.deals.byId.queryKey(), trpc.dashboard…keys used by the sales dashboard]` (mirror how `fields` composes RECORD maps).

**Interfaces:** consumes `pipelines.*`; the editor mirrors `fields-list.tsx`/`field-editor.tsx` (SortableList, live/archived split, inline label edit, `swatch-picker` renders `STAGE_SWATCHES` — import the LIST from a client-safe constant: re-export the swatch array through the pipelines router's list response or duplicate as a UI constant with a test asserting parity against `@crm/db/stage-semantics` server-side; client must NOT import `@crm/db`).

- [ ] Step 1: Read docs/design.md + fields settings UI; build page per spec's Settings section; every mutation → `cache.pipeline()`.
- [ ] Step 2: `bunx next typegen && bun run check-types` clean (apps/app may still have board/table breakage owned by Task 7 — list expected failures if so; prefer landing 6 and 7 in dependency order such that check-types is clean after Task 7); biome; live check on :3100.
- [ ] Step 3: Commit `feat: manage pipelines from settings`.

---

### Task 7: Deals board/table/menus/stepper/create dynamic

**Files:**
- Delete: `apps/app/lib/deal-stage.ts`; create `apps/app/lib/stage-presentation.ts` — tiny client helpers over stage objects (`stageColor(stage)` → `stage.color`, `stageToneFallback`, option grouping by pipeline) with NO semantic lists.
- Modify: `apps/app/app/(app)/[slug]/deals/deals-board.tsx` (columns from `pipelines.list` for the nuqs `pipeline` param; drop targets = stage ids; losing-drag branch via `outcome`), `deals-table.tsx` (stage facet from `facetCounts.stage` meta; pipeline facet; status tabs unchanged), `deals-bulk-actions.tsx`, `create-deal-sheet.tsx` (grouped stage picker, default entry), `deals-search-params.ts` (add `pipeline` facet/param), `components/crm/stage-change.tsx` (menu grouped by pipeline + cross-pipeline confirm item; CloseReasonDialog copy by outcome), `components/crm/stage-stepper.tsx` (deal's pipeline OPEN stages + its WON stage), `components/crm/deal-stage.tsx` (`DealStageIndicator` takes the stage object; color via StatusIndicator `color` prop), `components/crm/timeline/timeline-entry.tsx` (labels via a stages-by-key map query incl. archived — add `pipelines.stageLabels` tiny query in Task 2's module if not already: `{ key → label }` incl. archived; ADD IT in Task 2), `components/crm/record-sheet/deal-sheet.tsx` (won check via `deal.stage.outcome`), `contact-sheet.tsx`, `components/agent-builder/deal-list-result.tsx`.
- Modify: `apps/app/lib/production-stage.ts` — `WON_JOBS_INPUT` becomes `{ …same defaults, wonOnly: true }` (no stage literal); production board/page untouched otherwise.

**Interfaces:** consumes Task 3's deals row shape + Task 2's list/stageLabels.

- [ ] Step 1: Read every listed file first; refactor in one pass; `bunx next typegen && bun run check-types` MUST be clean for the whole app after this task; biome.
- [ ] Step 2: Live verify on :3100: board renders seeded Sales pipeline with trade labels, drag to Lost prompts reason, pipeline switcher lists pipelines, table facets work, create-deal defaults to New lead.
- [ ] Step 3: Commit `feat: stage-driven deal screens`.

---

### Task 8: Sales dashboard + remaining UI polish

**Files:**
- Modify: `apps/app/app/(app)/[slug]/sales-dashboard.tsx` (+ its data plumbing) — chart from stage meta, pipeline picker (Select, default pipeline), stat cards unchanged semantics; `dashboard-summary.tsx` stage rendering via stage objects.
- Any straggler `dealStageLabel`/`dealStageColor` importer (grep repo; explorer map §2 App rows is the checklist).

- [ ] Step 1: Implement; typegen+check-types+biome clean; live check.
- [ ] Step 2: Commit `feat: pipeline-aware sales dashboard`.

---

### Task 9: Seed rewrite + repo-wide test repair

**Files:**
- Modify: `packages/db/prisma/seed.ts` — seed Pipeline/Stage rows first (trade defaults + one extra "Insurance" pipeline exercising multi-pipeline), deals reference stage rows; closed-reason gate via outcome.
- Run and repair the FULL test matrix: `cd apps/api && bun run test`, `cd apps/app && bun test`, `cd apps/agent && bun run test` (or package equivalents) — fix every failure this refactor caused (fixtures creating enum stages, assertions on labels, etc.). Pre-existing unrelated failures: report, don't chase.

- [ ] Step 1: Seed rewrite; `bun run db:reset`-equivalent against the PRIVATE dev DB proves it seeds.
- [ ] Step 2: Full suites; repair; commit `feat: seed pipelines and repair the test matrix` (split commits if repair is large).

---

### Task 10: Playwright walkthrough

- [ ] Scratchpad node script per the spec's Testing walkthrough: rename+recolor a stage, insert a stage mid-pipeline, second pipeline end-to-end, cross-pipeline deal move, board close-as-Lost with reason, dashboard chart + production board + timeline history + archived-stage label. Screenshots. Fix-and-rerun until clean (`fix:` commits). Final gate: all plan-added suites + both/all check-types clean. ASD-STE100 Issues list in the report.
