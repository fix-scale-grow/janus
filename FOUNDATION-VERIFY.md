# Janus Foundation — live-DB verification plan (turnkey handoff)

**Why this file exists.** Stage 1 "Foundation" (rebrand + port shell/boards/jobs) is
code-complete and certified against the offline harness (`bun run check-types` = 13/13
packages green; `biome check` clean on every touched file; unit specs for the pure logic:
`brand-theme.spec.ts` 10/10, `dial.spec.ts` 9/9, telemetry-strip `client.integration.spec.ts`
4/4). What the ops VPS **cannot** exercise is anything needing a live Postgres or the live
agent runtime — Kyle's standing order is *do not build/run the product on the ops VPS*, and
the ops box's own Postgres is off-limits. So the runtime E2E is written up here as concrete,
turnkey test cases to run **once, on the dedicated product VPS** (per JANUS.md dev recipe:
Bun + portable pg17, `dev:session` cookie login, `AI_GATEWAY_API_KEY`).

Law 3 requires the written test case to exist *before* the verify run. This is that case list.
Run top-to-bottom on the dedicated VPS; every item has a pass condition.

## 0. Bring-up (once)
1. `bun install` with `DATABASE_URL` set (a real one; `@crm/db` postinstall/prisma needs it).
2. Start portable pg17; create the dev DB and set `DATABASE_URL` + `TEST_DATABASE_URL`.
3. `bun run db:migrate` — **pass:** all migrations apply clean, including hand-authored
   `20260813234356_add_production_stage` (adds `ProductionStage` enum + nullable
   `productionStage` / `productionStageChangedAt` on `Deal` + `@@index`). Confirm with
   `\d "Deal"` that both columns and the enum type exist.
4. `bun run dev` — **pass:** app boots, `dev:session` cookie login lands on the dashboard.

## 1. DB-integration suites (the pushes that used `--no-verify`/`CRM_SKIP_HOOKS`)
With `TEST_DATABASE_URL` set, run the pre-push hook suite for real:
- `@crm/auth`, `@crm/telemetry`, `@crm/db`, `apps/api` deal-service tests.
- **Pass:** the pre-push hook (`bun run test`) goes green end-to-end so future pushes need no
  skip flag. These were only ever skipped for the missing test DB, never for a code failure.

## 2. Migration + service: production stage (never yet run against real rows)
- Seed one `Deal` at `CLOSED_WON`.
- Call `deals.setProductionStage({id, stage:"SCHEDULED"})` — **pass:** row updates,
  `productionStageChangedAt` stamped, activity-log entry written.
- Call `deals.setProductionStage` on a **non-won** deal — **pass:** service **rejects**
  (guarded to `CLOSED_WON` only; production is strictly post-win).
- Call with `stage:null` — **pass:** clears the stage (drops the job to Unscheduled).

## 3. `deals.fieldToday()` read model
- Seed won deals across stages: `SCHEDULED`, `IN_PROGRESS`, `ON_HOLD`, `COMPLETE`, `PAID`,
  plus one won deal with `productionStage=null` and one open (non-won) deal.
- Call `deals.fieldToday()` — **pass:** returns exactly the `SCHEDULED`/`IN_PROGRESS`/`ON_HOLD`
  set (COMPLETE, PAID, null-stage, and non-won all excluded), ordered
  `productionStageChangedAt` desc, each row carrying its primary reachable contact
  (first attached contact with a phone; falls back to first contact).

## 4. Page-load E2E (Playwright or manual, mobile + desktop)
Every nav link resolves, page renders, no console error:
- `/` dashboard · `/deals` (Table **and** Board toggle) · `/production` · `/field` (mobile
  viewport) · `/companies` · `/contacts` · `/chat` (Janus AI) · `/settings`.
- **Sales board drag-drop:** drag a card between stage columns — **pass:** optimistic move,
  `deals.setStage` persists, refresh keeps the new column; drop into `CLOSED_LOST`/
  `UNQUALIFIED_TO_BUY` opens the `CloseReasonDialog` (reason captured, not silent).
- **Production board drag-drop:** drag a won job across production columns — **pass:**
  `setProductionStage` persists; drop into **Unscheduled** clears the stage.
- **Deal record sheet:** open a won deal — **pass:** the Production section shows (with the
  stage menu) only for `CLOSED_WON`; the "Reach the customer" Call/Text buttons use the
  shared `dialHref` (`tel:`/`sms:` with a single leading `+`, punctuation stripped).
- **Field Mode:** on mobile — **pass:** shows only active won jobs, one-tap Call dials the
  normalized number, tapping a card opens the real deal record.

## 5. Regression guard for the pure logic (already green offline, re-run in CI)
`bun test` for `dial.spec.ts`, `brand-theme.spec.ts`, telemetry strip spec — **pass:** all
green. These need no DB and gate every push.

---
When §0–§5 pass on the dedicated VPS, Stage 1 Foundation is *verified* (not just compiled),
and Stage 2 "Front door: chat+voice+confirm cards" can begin against the live agent runtime.
