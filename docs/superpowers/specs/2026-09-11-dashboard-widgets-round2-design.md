# Dashboard Widgets Round 2 — Design

Date: 2026-09-11
Status: Kyle-approved (in chat; interactive mock v2 approved:
https://claude.ai/code/artifact/8999dd4c-1a5b-4e32-a159-9d9f7765661c)
Builds on: `2026-09-11-custom-dashboard-design.md` (shipped, foundation@9a465ad)

## Summary

Three additions to the shipped dashboard: mini pipeline boards (one widget
instance per pipeline — the widget system learns instanced widgets), an
Ask Janus quick-ask widget backed by a new workspace-level conversation
kind, and exact grid guide lines while customising.

## Kyle rulings

| Question | Ruling |
| --- | --- |
| Abbreviated pipelines shape | Mini board per pipeline (tiny stage columns, top deals) — NOT one combined widget |
| Janus widget depth | Quick-ask launcher: one-line composer; submit opens the full agent surface seeded with the question |
| Grid affordance | Guide lines in edit mode ("grid bars"), aligned to the real grid math |

Controller ruling (recorded in chat): the launcher requires a record-less
conversation. Today `conversations` demands exactly one contact/deal/drawing.
This phase adds a `WORKSPACE` conversation kind as the substrate — additive
enum migration, api contract relaxation, agent-side scope. Without it the
widget cannot talk.

## 1. Instanced widgets + mini pipeline boards

### Widget system change

- A layout entry id may be an instance id: `pipeline-board:<pipelineId>`.
- `dashboardLayoutEntry.id` max length grows 40 → 64 (additive zod change,
  no migration; drift test updated).
- Registry: `widget-registry-meta.ts` gains widget TYPES with instances.
  The static 13 metas stay as-is (12 + ask-janus below). A new concept:

```ts
export type WidgetInstanceMeta = WidgetMeta & { instanceOf: "pipeline-board"; pipelineId: string };
export function pipelineBoardMeta(pipeline: { id: string; name: string }): WidgetInstanceMeta;
```

  `pipelineBoardMeta` builds `{ id: `pipeline-board:${pipeline.id}`,
  title: `${pipeline.name} — mini board`, description: "Top deals per stage",
  minW: 20, minH: 22, defaultW: 24, defaultH: 34 }`.
- `useVisibleWidgets()` becomes the single catalogue source: static metas
  (permission-filtered) PLUS one `pipelineBoardMeta` per active
  (non-archived) pipeline from the existing `pipelines.list` query. The
  canvas and popover both consume it, so resolveLayout drops boards whose
  pipeline is archived/deleted (id no longer in the metas).
- The Add-widget popover groups: regular widgets first, then a
  "Pipeline boards" group.

### Widget content

Per stage of that pipeline, in board order: a slim column — header (stage
label, 2px bottom border in the stage colour, count) — then up to 3 deal
chips (name, compact money) and "+N more" when count exceeds 3. Column
header links to `/deals?pipeline=<id>&stage=<stageId>`. Deal chip opens the
deal record sheet (RecordLink/openRecord pattern). Empty stage renders just
the header. Widget shows all the pipeline's non-archived stages with
outcome OPEN (closed stages excluded — this is an open-work glance).

### Data

New lean query `dashboard.pipelineBoard` (input `{ pipelineId }`):

```
{ stages: { id, label, color, count, topDeals: { id, name, amountCents, currency }[] }[] }
```

Top 3 by `amountCents` desc (nulls last), open deals in that stage only.
Follows `dashboard.pipelineStages` as the module pattern. Per-currency rule:
chips format each deal in its own currency; no summing.

## 2. Ask Janus widget + WORKSPACE conversations

### Substrate: workspace conversation kind

- Prisma: `AgentConversationKind` gains `WORKSPACE` (additive
  `ALTER TYPE ... ADD VALUE` migration, timestamped after
  `20260911153420_add_photos`). No new columns: a WORKSPACE conversation has
  all three record FKs null.
- `conversations` contracts: create/list accept kind WORKSPACE with NO
  record (the exactly-one-record refine applies only to RECORD kind).
- Agent side (`apps/agent`, read docs/agent.md + eve docs first): a
  workspace conversation sends no record header and mints no record claim;
  the existing Janus role charter preamble applies as-is. Tool scope for a
  workspace chat = the interactive-session default (same trust path as
  record chats; the Phase C write-lockdown table is untouched — dispatched
  sessions stay denied writes).
- `apps/app/lib/agent-record.ts`: `AgentRecordKind` gains `"workspace"`
  (id is the literal `"workspace"`), copy:
  title "Ask Janus", blurb "It can read your pipelines, deals, drawings and
  estimates — ask it anything about the business.",
  placeholder "Which deals stalled this week?",
  suggestions: "Which deals stalled this week?" / "What closed this month?" /
  "What needs my attention today?".
- `AgentPanel` renders `record={{ kind: "workspace", id: "workspace" }}`
  through the existing machinery (snapshot loading, composer gating,
  thread list filed under the workspace kind).

### The widget

- Static registry meta: id `ask-janus`, title "Ask Janus", description
  "Your CRM, one question away", minW 12, minH 11, default 24×13, no
  permission gate. NOT in the default layout (add from catalogue).
- Body: one-line input + primary "Ask" button. Submit opens a Sheet
  (size lg, same as the drawing editor's Ask Janus) containing
  `AgentPanel record={{kind:"workspace",id:"workspace"}}`, and sends the
  typed question as the first message of a new conversation (empty
  submit just opens the sheet). If the agent is unreachable, the panel's
  existing offline handling shows — the widget adds no bespoke states.

## 3. Edit-mode grid guides

- Inside the canvas container, edit mode only: a `pointer-events-none`
  absolutely-positioned overlay drawing vertical lines at every 4th column
  boundary and horizontal lines every 4 row units, computed from the SAME
  math react-grid-layout uses (containerWidth from `useContainerWidth`,
  cols/rowHeight/margin from DASHBOARD config) so the drag placeholder
  lands on the lines.
- Styling: 1px lines in `var(--border)` at ~50% opacity; no new tokens.
- Renders nothing outside edit mode and below `sm`.

## Error handling

- pipelineBoard query error → the existing WidgetError + retry pattern.
- A placed pipeline-board whose pipeline disappears drops from the canvas
  (resolver) — same as a permission-revoked widget.
- WORKSPACE conversations: unreachable agent → AgentPanel's existing
  offline/archive fallback; no token → whatever the panel shows today for
  a dead agent (no bespoke state in this phase).

## Testing

- Unit: instance-meta builder; resolver with instance ids (drop on missing
  pipeline meta); id-length drift test updated to 64.
- API: pipelineBoard integration spec (top-3 ordering, closed-stage
  exclusion, count vs chips); conversations WORKSPACE create/list spec
  (record refine bypassed for WORKSPACE, still enforced for RECORD).
- Playwright walkthrough: add a pipeline mini board → renders stages+chips
  → click-throughs; add Ask Janus → submit opens sheet with question sent
  (agent may be offline — sheet + panel render is the assertion); edit mode
  shows grid lines and placeholder aligns; reload persistence; remove both.

## Coordination

Worktree `.claude/worktrees/phase-n-dashboard-widgets`, branch
`janus/phase-n-dashboard-widgets` off foundation@3ee7ac6 (photos included).
Private DBs `janus_widgets_dev/_test`; ports app 3114 / api 3115. One
additive migration (enum value) — committed normally per staged-migration
doctrine (no destructive DDL). Merge via train on Kyle's word.

## Out of scope

- Full mini-chat inside the widget (launcher only, per ruling).
- Workspace-conversation-specific agent tools; token setup (Kyle's
  `claude setup-token` remains the gate for Janus actually replying).
- Grid-guide density settings.
