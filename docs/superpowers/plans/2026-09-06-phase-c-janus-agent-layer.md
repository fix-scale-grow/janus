# Phase C: The Janus Agent Layer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Janus the agent, not just the app: a working Anthropic-powered brain with usage metering, confirm cards as the universal approval surface, drawing-scoped chat ("Ask Janus" in the editor), tag proposals, missing-item review, notes→line-items, conversational price-book edits, and attach-by-conversation — every write behind a confirm card per the spec's "all via confirm cards, never silent."

**Architecture:** All intelligence lives in `apps/agent` (eve) per docs/api.md — the API only queues `AgentTask` rows via `AgentTriggerService`. New tools follow the `defineTool` pattern with eve's native `tool-approval` HITL; the app finally renders those approvals as confirm cards (the missing half of an existing protocol). A `"drawing"` record kind joins contact/deal. Model calls go direct to Anthropic (OAuth token or API key), with per-call token usage persisted for future billing.

**Tech Stack:** eve (installed framework — read its docs in apps/agent/node_modules/eve/docs before writing agent code, per AGENTS.md), @ai-sdk/anthropic, Prisma, nestjs-trpc, Next.js.

**Spec:** `docs/superpowers/specs/2026-09-04-scope-drawings-and-forms-design.md` — §2 "Janus AI layer" + §3 attach-later flows. Additional Kyle directives (2026-09-06, binding): agent auth reuses his Anthropic login for dev (token from `claude setup-token`), customer installs use API keys later; AI usage must be captured/measurable from day one; billing/meter productization explicitly deferred ("we'll need to think this through" — capture data, build no billing UI).

## Global Constraints

- All prior-phase constraints stand: no code comments; BARE commit subjects; tabs+biome (`bun run format` then `git restore design/`); packages/ui only; parse-at-boundary; server/client split; regenerate+commit generated/server.ts on contract changes; cache helpers; constants in config objects; optional capabilities never throw; docs/design.md + docs/api.md + docs/agent.md are binding.
- **Intelligence never in the API.** API changes in this plan are limited to `AgentTriggerService` methods + minimal contracts. No LLM calls, no heuristics in Nest.
- **docs/agent.md's "fourth record kind" rule is binding** for the drawing kind: sessionPreamble entry, a read tool, TOOL_VERBS line, COPY entry — all four, or the kind doesn't exist.
- **Every mutating agent tool is approval-gated** (`approval` from eve/tools/approval) EXCEPT reversible organizational moves (attach/detach drawing — gate doctrine: instant + revertable ships ungated). Price/line/tag writes: gated. Background (dispatched) sessions must never stall on approval — reuse/extend the `sensitiveWrite`-style policy so automated lanes get `"denied"`→propose-only behavior while live rep sessions get `"user-approval"`.
- **The confirm card renders from the tool's INPUT** (eve executes only after approval) — every gated tool's inputSchema must therefore carry the full human-readable proposal (ids AND display names/amounts), and each gets a `CARD_COPY`-style renderer entry; never show raw JSON to a rep.
- Agent tools access data via `@crm/db` Prisma directly (established pattern) and may import `@crm/drawings` (pure). Never import client React code into apps/agent.
- Live verification requires agent auth: `CLAUDE_CODE_OAUTH_TOKEN` (Kyle runs `claude setup-token`) or `ANTHROPIC_API_KEY` in root .env — a Kyle-gated setup step at Task 10; everything before it verifies with targeted tests + the agent process booting + capability reporting "off" gracefully.
- eve agent dev process: `eve dev` in apps/agent on :2000; the app proxies /eve/v1 with AGENT_BRIDGE_SECRET — generate a dev secret into .env if unset (document in .env.example; it's install-local, not a third-party key).
- Recipes: Postgres/dev servers/cookie/Playwright as in prior phases; do NOT run the full apps/api suite (known hang); known lint false positive create-app.ts.

## Rulings carried from planning

- Model default: `claude-sonnet-5` (AppSetting-overridable), direct Anthropic. Vercel AI Gateway path stays as dormant fallback code — never suggest Vercel accounts to Kyle.
- OAuth reuse is DEV-ONLY posture; the provider layer treats ANTHROPIC_API_KEY as the canonical production path. Both are optional capabilities.
- Usage capture = data layer only (AgentUsage rows). No billing UI, no quotas this phase.
- Spec §3's "waiting on you strip" nudge: DEFERRED (no such strip exists in this app yet; noted for the future Janus workspace screen). Unattached-note attach flows ship via chat instead.
- Missing-item background check triggers on estimate generation (and on demand in chat) — NOT on every autosave (2s cadence would spam the task queue).

---

### Task 1: Direct Anthropic provider + usage metering foundation

**Files:** Modify `apps/agent/agent/lib/model.ts`, `apps/agent/agent/lib/capabilities.ts`, `apps/agent/package.json` (+`@ai-sdk/anthropic`), `.env.example`; usage persistence in `apps/agent/agent/hooks/audit.ts` or a dedicated hook (investigate what eve's stream/hooks expose for token usage — read node_modules/eve/docs first); Prisma `AgentUsage` model + migration; tests for the provider selection logic (pure) and usage-row shape.

**Interfaces:**
- Produces: `selectedModel()` returns a direct-Anthropic model instance when `CLAUDE_CODE_OAUTH_TOKEN` or `ANTHROPIC_API_KEY` present (OAuth: bearer auth via the provider's headers/fetch override — mirror how Claude-CLI-credential reuse works elsewhere; API key: standard provider). Neither present → existing gateway fallback (which itself is unconfigured → capability off). Model id from `DEFAULT_AGENT_MODEL` AppSetting, default `claude-sonnet-5`.
- Capability entry `anthropic` (label/gives/enabled/from) so preambles state whether the brain is on.
- `AgentUsage` model: `{id, sessionId, conversationId?, taskKind?, model, inputTokens Int, outputTokens Int, createdAt}` + index on createdAt; one row per model call (or per session-turn if that's the granularity eve exposes — implementer documents which and why).
- [ ] Steps: read eve docs on hooks/usage events → schema+migration `add_agent_usage` → provider selection (pure function + tests: oauth-only, key-only, both→key wins? RULING: oauth wins in dev when both set? No — API key wins (canonical), oauth is the fallback; test it) → usage hook wiring → capability entry + .env.example (CLAUDE_CODE_OAUTH_TOKEN with a "run `claude setup-token`" note; ANTHROPIC_API_KEY) → agent boots (`eve dev`) with neither key: capabilities report off, no throw → commit `feat: add direct anthropic provider with usage metering`.

---

### Task 2: Confirm cards — render tool-approval requests in the agent panel

**Files:** Modify `apps/app/lib/agent-transcript.ts` (emit TranscriptItem for `input.requested` `kind: "tool-approval"`: tool name, parsed input, requestId; stop filtering them out at the `pendingQuestion` seam); create `apps/app/components/crm/agent-approval-card.tsx`; modify `apps/app/components/crm/agent-panel.tsx` (render the card when the pending request is an approval; Approve/Deny buttons → `agent.send({ inputResponses: [...] })` with the response shape eve's client SDK expects — read the SDK types); a per-tool card copy registry `apps/app/lib/agent-approval-copy.ts` mapping tool name → `{title, render(input): rows}` with a generic fallback (label/value rows from input, never raw JSON).

- [ ] Card design per docs/design.md + gate doctrine: bordered `rounded-lg` surface in the transcript, proposal rows, primary Approve, ghost/outline Deny (with optional short reason Input that feeds back as the denial message if the SDK supports a payload — check; else plain deny). While pending, composer shows "Janus is waiting for your approval." Deny resumes the turn (model sees denial and continues conversationally).
- [ ] Verify with a THROWAWAY gated echo tool in apps/agent (deleted before commit) IF a live model key exists; otherwise unit-test transcript parsing against a synthetic `input.requested` event fixture captured from eve's types, and wire-verify in Task 10.
- [ ] Commit `feat: render agent tool approvals as confirm cards`.

---

### Task 3: The drawing record kind + Ask Janus in the editor

**Files:** `apps/app/lib/agent-record.ts` (+`"drawing"`), `apps/app/app/eve/v1/[...path]/route.ts` + `apps/app/lib/agent-bridge.ts` (x-crm-drawing header → token claim), `apps/agent/agent/channels/eve.ts` + `instructions/task.ts` + `lib/preamble.ts` (drawing branch: what a drawing is, what the scope panel means, TOOL_VERBS + COPY entries per docs/agent.md's fourth-record-kind rule), Prisma `AgentConversation.drawingId` column + migration, `apps/agent/agent/tools/read_drawing.ts`; app side: an "Ask Janus" toolbar button in `drawing-editor.tsx` opening the agent panel scoped to the drawing (a right-side Sheet overlaying/replacing the scope panel area, or a widened panel region — implementer judgment within design rules; the panel component is reusable: `agent-panel.tsx` + `recordHeader`).

**Interfaces:**
- `read_drawing` tool: input `{drawingId}`; loads Drawing (+deal/contact names, scale, gridFt), computes measured shapes server-side via `@crm/drawings` `measureScene`/`measureSatellite` + the services/symbols maps (mirror the resolution chain: explicit serviceId → Symbol.id → legacy Service.symbolId), returns a compact structured summary: per-shape {scopeId, kind, label, quantity+unit, serviceName|unassigned, adj}, plus text elements (for notes→lines later), estimate links, totals if generated. This is the context foundation every other drawing tool reuses — extract the scene→summary logic into `apps/agent/agent/lib/drawing-summary.ts` (pure where possible, tested with a scene fixture).
- [ ] Verify: agent process typechecks; with a model key absent, the Ask Janus button still opens the panel and the panel shows the capability-off state gracefully.
- [ ] Commit `feat: add drawing-scoped agent chat with read_drawing`.

---

### Task 4: propose_drawing_tags (approval-gated scene write)

**Files:** `apps/agent/agent/tools/propose_drawing_tags.ts`; `apps/agent/agent/lib/drawing-writes.ts` (the ONLY writer of agent scene changes); card copy entry; extend the interactive-vs-dispatched approval policy helper.

- Input schema carries the full proposal: `{drawingId, tags: [{scopeId, shapeLabel, serviceId, serviceName, reason}]}` (names present so the card renders "Mark 'long eave line (182 ln ft)' as Drip edge — $3.50/ln ft" rows).
- On approve, execute: load CURRENT scene, merge `customData.serviceId` into elements whose scope/scopeId matches (touch nothing else), bump version via the same saveScene semantics (write a DrawingVersion checkpoint), save. Concurrent-edit caveat: last-write-wins with the open editor's next autosave — mitigate by having the app invalidate `cache.drawing(id)` when an approval resolves in a drawing conversation (panel onSuccess hook) and the editor showing its existing reload affordance; document the residual race honestly in the task report.
- Dispatched sessions: policy returns denied→the tool responds "propose in chat instead" (never stalls the research lane).
- [ ] Tests: drawing-writes merge logic (fixture scene: tags apply to matching scopeIds only, others byte-identical; version row written).
- [ ] Commit `feat: propose and apply drawing service tags with approval`.

---

### Task 5: Drawing review — missing items + unassigned/unmeasured audit

**Files:** `apps/agent/agent/tools/review_drawing.ts` (analysis-only, no writes, no approval); `apps/agent/agent/lib/takeoff-review.ts` (pure heuristics + tests); API: `AgentTriggerService.estimateGenerated(drawingId, estimateId, reason)` called from `estimates.service.ts` generateFromDrawing (fire-and-forget AFTER the transaction commits), new task kind `drawing-check` branch in `instructions/task.ts` (dispatched session reads the drawing, runs the review, and posts its findings as the session transcript in the DRAWING conversation — investigate how a dispatched session's output lands somewhere a rep sees it: the drawing's Agent tab reads AgentEvent history by conversation/record; ensure the drawing-check session is associated to the drawing conversation or creates one).

- Heuristics in `takeoff-review.ts` (data-driven, not hardcoded roofing): unassigned measured shapes; tagged-but-unmeasured shapes (no scale); service-pairing hints from the price book itself — e.g., if any area service tagged and the book CONTAINS services whose names match disposal/underlayment/permit patterns that are absent from the estimate, surface them as questions not assertions. Keep the heuristic layer thin — the MODEL does the reasoning in chat; the pure lib just computes the facts (what's tagged, what's not, what book items exist, what's on the estimate).
- [ ] Verify: pure tests for the fact computation; task-kind wiring typechecks; live behavior lands in Task 10.
- [ ] Commit `feat: add drawing review analysis and post-generation check`.

---

### Task 6: propose_estimate_lines — missing items + notes→line items (approval-gated)

**Files:** `apps/agent/agent/tools/propose_estimate_lines.ts` + lib writer in `apps/agent/agent/lib/estimate-writes.ts`; card copy entry.

- Input: `{estimateId, estimateTitle, lines: [{serviceId?, serviceName?, name, unit, quantity, reason, source: "missing"|"note"|"chat"}]}`. Card renders each proposed line with quantity/unit/price preview (serviceId lines pull current book prices at APPLY time — snapshot semantics identical to the estimates API's addLineItem: copy prices onto the line; custom lines get priceGood/Better/Best = 0 unless amounts provided in input).
- Execute merges via direct db writes mirroring `estimates.service.ts` addLineItem semantics (existence check, quantity cap, sortOrder append) — factor shared constants where already exported; do NOT duplicate money math: reuse the same rounding rules.
- Notes→lines path: the model reads text elements from `read_drawing` and proposes; nothing automatic.
- [ ] Tests: writer applies serviceId line with copied prices + custom line; caps respected.
- [ ] Commit `feat: propose estimate line items with approval`.

---

### Task 7: Conversational price book — read + gated update

**Files:** `apps/agent/agent/tools/read_price_book.ts` (list services w/ prices, modifiers, units — compact), `apps/agent/agent/tools/update_service.ts` (approval ALWAYS for any price/name/modifier change; card shows "Tear-off & disposal: $450.00 → $475.00 /sq" style old→new rows); lib writer with validation mirroring services-catalog contracts (cents caps, modifier schema from @crm/drawings).

- [ ] Tests: writer validation (negative rejected, caps); old→new diff payload shape.
- [ ] Commit `feat: conversational price book with gated updates`.

---

### Task 8: Organize by conversation — find + attach drawings, read estimates

**Files:** `apps/agent/agent/tools/list_drawings.ts` (search: title contains, attachment filter, recency — "the sketch from this morning" = order updatedAt desc + date words handled by the model), `apps/agent/agent/tools/attach_drawing.ts` (attach/detach dealId/contactId — approval: none; reversible, gate doctrine; but REFUSE cross-attach when the drawing already belongs to a DIFFERENT deal unless input carries `confirmReplace: true`, which the model must ask about conversationally), `apps/agent/agent/tools/read_estimate.ts` (lines/totals/status/contact — read-only context for all record chats).
- These tools are available in contact/deal chats too (tools are session-global; preamble TOOL_VERBS updated).
- [ ] Tests: attach guard (different-deal without confirmReplace → refused shape).
- [ ] Commit `feat: find and attach drawings conversationally`.

---

### Task 9: Panel polish — approval outcomes + drawing invalidation

**Files:** `agent-panel.tsx` / transcript: after an approval resolves, the card collapses into a done state ("Applied — 3 shapes tagged") from the tool's execute result; panel fires `cache.drawing(id)`/`cache.estimate(id)`/`cache.service()` invalidation matching the tool that ran (map in agent-approval-copy.ts); denial renders as a quiet "Declined" state. Composer copy while waiting.
- [ ] Verify statically + fixture tests where the transcript logic allows.
- [ ] Commit `feat: settle approval cards and refresh affected records`.

---

### Task 10: Live integration pass (Kyle-gated key, then full walkthrough)

- [ ] **Kyle setup (batched, the only asks):** run `claude setup-token` and put the result in .env as `CLAUDE_CODE_OAUTH_TOKEN` (or provide ANTHROPIC_API_KEY); confirm AGENT_BRIDGE_SECRET generated. Then `eve dev` joins the dev stack.
- [ ] Full checks: root check-types/lint; packages/drawings + agent-side pure tests (drawing-summary, takeoff-review, writers) green; agent process boots with capability ON.
- [ ] THE walkthrough (live, Playwright + human-shaped chat probes; screenshots):
  a. Drawing editor → Ask Janus → "what's on this drawing?" → coherent summary from read_drawing.
  b. Leave a measured shape untagged → "tag my drawing" → confirm card listing the proposal with service names → Approve → scope panel shows the tag after refresh; usage rows written.
  c. Generate estimate → the drawing-check task runs → findings visible in the drawing's Agent tab (questions, not assertions).
  d. "Add the disposal line you suggested" → propose_estimate_lines card → Approve → line lands on the estimate with correct copied prices.
  e. "Bump tear-off to $475 a square" → old→new card → Approve → price book updated (and existing estimates untouched — verify snapshot held).
  f. "Put this morning's sketch on the <deal name> job" from a DEAL chat → list_drawings finds it → attach (with the confirmReplace conversation if already attached elsewhere).
  g. Deny path: propose→Deny→model responds gracefully, nothing written.
  h. Zero console errors from new code; AgentUsage rows exist for every model call with plausible token counts.
- [ ] Fix what fails (commits `fix:`), append "Phase C implemented <date>." to the spec Status line, commit `feat: complete Phase C Janus agent layer`.

---

## Self-review notes (applied)

- Spec §2 Janus-layer coverage: auto-tag (T4), missing items (T5+T6), notes→lines (T6 via T3's text extraction); §3 attach-conversationally (T8); conversational price book (T7); confirm-cards-everywhere (T2 + per-tool gating); "never silent" honored — the only ungated write is reversible attach with a cross-attach conversational guard.
- Deferred with rulings: waiting-on-you strip (no host surface yet); schedule-aware attach pre-suggestion (needs the schedule feature); billing UI (data captured only); background auto-proposals beyond the post-generation check.
- Type consistency: read_drawing summary shape is the shared contract for T4/T5/T6 inputs; card copy registry keyed by tool file names; approval policy helper shared T4/T6/T7.
- Placeholder scan: clean; investigation-first steps (eve usage events, SDK response shapes) are explicitly scoped reads, not TBDs.
