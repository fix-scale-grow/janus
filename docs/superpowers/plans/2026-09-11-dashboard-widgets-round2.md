# Dashboard Widgets Round 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add instanced mini pipeline-board widgets, an Ask Janus quick-ask widget on a new WORKSPACE conversation kind, and edit-mode grid guides to the shipped dashboard.

**Architecture:** The widget registry gains instance metas (`pipeline-board:<pipelineId>`) sourced from `pipelines.list`; a new lean `dashboard.pipelineBoard` query feeds the board widget. A `WORKSPACE` value on `AgentConversationKind` (additive enum migration) lets `AgentPanel` run record-less conversations; the Ask Janus widget opens it in a Sheet. An edit-mode overlay draws grid guides from the same math the canvas uses.

**Tech Stack:** existing stack; no new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-11-dashboard-widgets-round2-design.md`

## Global Constraints

- Repo rules (AGENTS.md): NO code comments; NO Co-Authored-By trailers; shared UI variants in `packages/ui`; parse at the boundary with zod; tunables in the area's config object.
- Read before touching: `docs/api.md` (apps/api), `docs/agent.md` + `apps/agent/node_modules/eve/docs` (apps/agent), `docs/agent-panel.md` (AgentPanel), `docs/design.md` (UI), `docs/currency.md` (money display).
- Work ONLY in this worktree. Dev ports: app 3114 (`bun run dev -- -p 3114`), api 3115 (PORT in .env). Kill dev servers by PID ONLY (netstat by port); NEVER by image name; ports 3000/3001 are a live demo — never touch.
- DBs `janus_widgets_dev/_test` (already migrated). The ONE new migration is additive (`ALTER TYPE "AgentConversationKind" ADD VALUE 'WORKSPACE'`), timestamped AFTER `20260911153420_add_photos`. No other DDL. Shared `crm` untouched from here.
- Gates: root `bun run check-types`; `bun test` in packages/db, apps/app (lib + components/dashboard), apps/api (touched specs); apps/app `bun run build` at the end; Playwright NODE-launched.
- Per-currency money is NEVER summed across currencies.
- Existing interfaces (do not break): `resolveLayout(saved, widgets)`, `DASHBOARD` config, `DashboardLayoutEntry`, `WidgetShell`/`WidgetError`, `DashboardCanvas({layout,widgets,editing,onLayoutChange})`, edit context in `apps/app/lib/dashboard/dashboard-edit-context.tsx`, `visibleWidgets(widgets, keys)`.

---

### Task 1: Entry id length + instance metas

**Files:**
- Modify: `packages/db/src/user-views.ts` (id max 40 → 64)
- Modify: `packages/db/test/user-views.spec.ts`
- Modify: `apps/app/lib/dashboard/widget-registry-meta.ts`
- Modify: `apps/app/lib/dashboard/layout.ts` (only if resolver needs it — it matches by meta id, so instance metas should flow through unchanged; verify, do not rewrite)
- Test: `apps/app/lib/dashboard/widget-registry.test.ts`

**Interfaces:**
- Consumes: `WidgetMeta` (existing), `DashboardLayoutEntry`.
- Produces: `PIPELINE_BOARD_PREFIX = "pipeline-board:"`; `pipelineBoardMeta(pipeline: { id: string; name: string }): WidgetMeta & { instanceOf: "pipeline-board"; pipelineId: string }` in `widget-registry-meta.ts` with the spec's exact title/description/sizes; `isPipelineBoardId(id: string): boolean`.

- [ ] **Step 1: Failing tests.** packages/db spec: change the id-length case to accept 64 chars and reject 65 (keep existing bounds cases). App registry test additions:

```ts
test("pipelineBoardMeta builds an instance meta", () => {
	const meta = pipelineBoardMeta({ id: "p1", name: "Sales" });
	expect(meta.id).toBe("pipeline-board:p1");
	expect(meta.title).toBe("Sales — mini board");
	expect(meta.minW).toBe(20);
	expect(meta.defaultH).toBe(34);
});

test("resolveLayout keeps a board whose meta exists and drops one whose meta is gone", () => {
	const metas = [pipelineBoardMeta({ id: "p1", name: "Sales" })];
	const saved = [
		{ id: "pipeline-board:p1", x: 0, y: 0, w: 24, h: 34 },
		{ id: "pipeline-board:gone", x: 24, y: 0, w: 24, h: 34 },
	];
	expect(resolveLayout(saved, metas).map((e) => e.id)).toEqual(["pipeline-board:p1"]);
});
```

- [ ] **Step 2: Run to fail** — `cd packages/db && bun test test/user-views.spec.ts`; `cd apps/app && bun test lib/dashboard`.
- [ ] **Step 3: Implement** — id `.max(64)`; prefix + builder + guard in `widget-registry-meta.ts` (pure module).
- [ ] **Step 4: Run to pass** (same commands).
- [ ] **Step 5: Commit** — `feat: teach the dashboard layout about pipeline board instances`

### Task 2: dashboard.pipelineBoard lean query

**Files:**
- Modify: `apps/api/src/dashboard/dashboard.contracts.ts`, `dashboard.router.ts`, `dashboard.service.ts`
- Test: `apps/api/test/dashboard-board.integration.spec.ts`

Read `docs/api.md` and `apps/api/test/dashboard-stages.integration.spec.ts` first (fixture pattern, seeded-stage lookup).

**Interfaces:**
- Produces: `dashboard.pipelineBoard` query, input `{ pipelineId: z.string().min(1) }`, returns `{ stages: { id: string; label: string; color: string; count: number; topDeals: { id: string; name: string; amountCents: number | null; currency: string }[] }[] }` — the pipeline's stages with outcome OPEN in board order; per stage: count of open deals, top 3 deals by amountCents desc (nulls last). Follow `dashboard.pipelineStages`'s service shape for stage select fields and deal filtering (copy its open-deal criteria exactly — do not invent a new definition of "open").

- [ ] **Step 1: Failing integration test** — seed one pipeline with 2 OPEN stages + 1 WON stage; 4 deals in stage A (assert count 4, chips 3, order by amount desc, null-amount deal last/excluded from top when 3 larger exist), 0 in stage B (empty topDeals, count 0); WON stage absent from response.
- [ ] **Step 2: Run to fail** — `cd apps/api && bun run test test/dashboard-board.integration.spec.ts`.
- [ ] **Step 3: Implement** contracts+service+router; `bun run check-types` regenerates the committed generated server file — commit it.
- [ ] **Step 4: Run to pass** + `test/dashboard-stages.integration.spec.ts` still green.
- [ ] **Step 5: Commit** — `feat: add the pipeline board query`

### Task 3: Mini pipeline-board widget + catalogue instances

**Files:**
- Create: `apps/app/components/dashboard/widgets/pipeline-board-widget.tsx`
- Modify: `apps/app/lib/dashboard/widget-registry.tsx` (`useVisibleWidgets` adds instance metas from `trpc.pipelines.list` (includeArchived false) mapped through `pipelineBoardMeta`, each with the board component; while pipelines load, instance metas are simply absent — same pattern as permission loading)
- Modify: `apps/app/components/dashboard/customise-controls.tsx` (popover groups: existing widgets, then a "Pipeline boards" group for `instanceOf` metas)

**Interfaces:**
- Consumes: Task 1 builder/guard; Task 2 query; `WidgetShell`/`WidgetError`; `useWorkspaceUrl`; `useOpenRecord` (deal chips open the record sheet — copy the deals-open widget's `openRecord({kind:"deal",id})` usage).
- Produces: `PipelineBoardWidget({ pipelineId })` — the component map for instance ids resolves by prefix: the canvas's widget lookup must map `pipeline-board:<id>` → `<PipelineBoardWidget pipelineId=<id>/>`. Check how `dashboard-canvas.tsx` maps id → component today and extend it minimally (a `componentFor(meta)` helper in `widget-registry.tsx` is acceptable if the current map is static).

Widget body per the spec: stage columns (label truncates, 2px bottom border `style={{borderColor: stage.color}}` — stage colours are data-driven like the donut slices, this is not a design-token violation), count, up to 3 deal chips (name + `formatMoneyCompact(amountCents, currency)`, `EmptyCellValue` when null), "+N more", stage header → `Link` to `${workspaceUrl("/deals")}?pipeline=${pipelineId}&stage=${stage.id}`. Loading spinner row; `WidgetError` on isError with refetch.

- [ ] **Step 1:** Implement widget + registry instances + popover group.
- [ ] **Step 2:** `bun run check-types` + `cd apps/app && bun test lib/dashboard`.
- [ ] **Step 3:** Live check (ports 3114/3115, dev-login): add both seed pipelines' boards from the popover, verify stages/chips/click-throughs, remove one, reload persistence.
- [ ] **Step 4:** Commit — `feat: add mini pipeline board widgets`

### Task 4: WORKSPACE conversation kind (db + api + agent)

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (enum value only)
- Create: `packages/db/prisma/migrations/20260911<HHMMSS>_add_workspace_conversation_kind/migration.sql` — generate with `bunx prisma migrate dev --name add_workspace_conversation_kind` against `janus_widgets_dev` (it must contain ONLY `ALTER TYPE "AgentConversationKind" ADD VALUE 'WORKSPACE';`); timestamp must sort after `20260911153420_add_photos`
- Modify: `apps/api/src/conversations/conversations.contracts.ts` (+ service/router where the record refine and list filters live)
- Modify: `apps/agent` conversation intake — read `docs/agent.md` first; find where record headers/claims are derived from a conversation's kind/record fields and make WORKSPACE mint no record claim and send no record header. DO NOT touch the Phase C write-lockdown table or dispatched-session denials.
- Test: extend the existing conversations spec (find it: `apps/api/test/conversations*.spec.ts`) — WORKSPACE create with no record succeeds; RECORD create with no record still fails; list scopes WORKSPACE threads to the creating user the same way record threads are scoped (copy the existing ownership expectation).

**Interfaces:**
- Produces: `conversations.create` accepting `{ kind: "WORKSPACE" }` with no contact/deal/drawing; list/filter support for the kind. Exact contract shapes follow the file's existing discriminated pattern — extend, don't restructure.

- [ ] **Step 1: Failing api spec additions** (WORKSPACE create ok; RECORD refine intact).
- [ ] **Step 2: Run to fail.**
- [ ] **Step 3: Implement** schema enum + migration (applied to BOTH private DBs: `migrate dev` on dev, `migrate deploy` with TEST_DATABASE_URL swapped in for test) + contracts + agent-side no-claim path; `bun run check-types` (regenerates server file — commit it).
- [ ] **Step 4: Run to pass** + the agent suite's conversation-adjacent specs (`cd apps/agent && bun test` scoped to files you touched; full agent suite once if fast).
- [ ] **Step 5: Commit** — `feat: add the workspace conversation kind`

### Task 5: Ask Janus widget + workspace AgentPanel

**Files:**
- Modify: `apps/app/lib/agent-record.ts` (kind `"workspace"`, spec copy verbatim: title "Ask Janus", blurb "It can read your pipelines, deals, drawings and estimates — ask it anything about the business.", placeholder "Which deals stalled this week?", suggestions per spec; `header`/`field`: read how the two maps at lines ~63/71 are consumed — workspace sends NO record header and files under NO record field, so the maps' types must allow that; extend the types honestly rather than inventing a fake field)
- Create: `apps/app/components/dashboard/widgets/ask-janus-widget.tsx`
- Modify: `apps/app/lib/dashboard/widget-registry-meta.ts` + `widget-registry.tsx` (static meta `ask-janus`, title "Ask Janus", description "Your CRM, one question away", minW 12, minH 11, default 24×13, no permission)
- Check: `apps/app/components/crm/agent-panel.tsx` — it must accept the workspace record; adjust its conversation create/list wiring for the kind if it hardcodes record fields (read `docs/agent-panel.md` FIRST; change the minimum).

**Interfaces:**
- Consumes: Task 4 api; Sheet components (`@crm/ui/components/sheet`) — copy the drawing editor's Ask Janus Sheet usage (`drawing-editor.tsx:560-567`).
- Produces: widget with one-line input + primary Ask button; submit → Sheet opens with `AgentPanel record={{kind:"workspace",id:"workspace"}}` and the typed question sent as the first message of a NEW conversation (find AgentPanel's existing new-conversation + send path; if it exposes no seed-message prop, add an optional `initialMessage` prop that the panel sends once after the new session opens — smallest honest change, no double-send on remount: guard with a ref). Empty input opens the sheet without sending.

- [ ] **Step 1:** Implement; `bun run check-types`; app lib tests.
- [ ] **Step 2:** Live check: add widget, submit a question → sheet opens, message appears in composer flow (the agent may be offline — panel's offline state rendering IS acceptance; no bespoke widget states), reopen sheet → thread listed.
- [ ] **Step 3:** Commit — `feat: add the ask janus widget`

### Task 6: Edit-mode grid guides

**Files:**
- Modify: `apps/app/components/dashboard/dashboard-canvas.tsx`

**Interfaces:**
- Consumes: `DASHBOARD.grid` config, `useContainerWidth`'s width, the same margin values the canvas passes to RGL.
- Produces: `GridGuides({ width, cols, rowHeightPx, marginX, marginY, heightPx })` — pointer-events-none absolute overlay rendered inside the grid container ONLY when `editing` and on the desktop branch; vertical 1px lines at every 4th column boundary and horizontal 1px lines every 4 row units, positions computed with RGL v2's coordinate math (colWidth = (width − marginX×(cols+1)) / cols; x(n) = marginX + n×(colWidth+marginX) — VERIFY against the installed RGL v2 source/types before hardcoding, the same way phase-m did); lines `background: var(--border)`, container `opacity-50`; height = current canvas height (RGL exposes the container height — measure the wrapper with the ref that exists).

- [ ] **Step 1:** Implement; verify visually in edit mode: placeholder corners land on guide intersections while dragging; nothing renders when not editing; nothing below `sm`.
- [ ] **Step 2:** `bun run check-types`.
- [ ] **Step 3:** Commit — `feat: show grid guides while customising the dashboard`

### Task 7: Gates + walkthrough

- [ ] **Step 1: Matrix** — root `bun run check-types`; `cd packages/db && bun test`; `cd apps/app && bun test lib components/dashboard`; `cd apps/api && bun run test test/dashboard-board.integration.spec.ts test/dashboard-stages.integration.spec.ts` + the conversations spec + full api suite once (pre-existing reds bucketed by the untouched-files rule; known list: bulk/fields hang, auth e2e flake, tracking-filing fixture race, telemetry update_service allowlist, agent owner-fixtures); `cd apps/app && bun run build` (prod gate).
- [ ] **Step 2: Walkthrough** (NODE Playwright, ports 3114/3115, screenshots to the SDD workspace):
1. dev-login owner → Customise → grid guides visible; drag → placeholder lands on guides.
2. Add widget popover shows "Pipeline boards" group with both seed pipelines.
3. Add Sales board → stages render in order, chips show top deals with money, "+N more" where applicable.
4. Stage header click → /deals with pipeline+stage params.
5. Add Ask Janus → type a question → Ask → Sheet opens, panel mounts, question sent (offline panel state acceptable).
6. Done → reload → boards + Ask Janus persist.
7. Second user (member) → default layout untouched; popover lists pipeline boards (no permission gate).
8. Archive a pipeline in Settings → its board drops from canvas and popover; restore it back.
9. Mobile 400px → stack renders new widgets statically.
10. Kill dev servers by PID.
- [ ] **Step 3:** Fix what the walkthrough proves broken; commit individually.
- [ ] **Step 4:** Stop — controller handles handoff.

## Self-review notes
- Coverage: instanced ids (T1/T3), board query (T2), WORKSPACE substrate (T4), launcher (T5), guides (T6), tests/gates (T7). Spec's error handling: T3 WidgetError; resolver drop verified T1/T8-step8.
- Types: `pipelineBoardMeta` defined T1, consumed T3; `PipelineBoardWidget({pipelineId})` T3; WORKSPACE kind spans T4 (db/api/agent) → T5 (client); GridGuides self-contained T6.
- Known risk named: AgentPanel may hardcode record assumptions — T5 explicitly reads docs/agent-panel.md first and changes the minimum; if the panel needs more than an `initialMessage` prop and minor kind-threading, the implementer reports BLOCKED rather than restructuring.
