# Janus — agent-first CRM for blue-collar trades

Fork of [trycompai/crm](https://github.com/trycompai/crm) (MIT). Kyle's product:
a CRM whose front door is a conversation — the owner types or speaks what happened
and the agent does the CRM work. Automations are TOLD, not built.

## Architecture: engine + body panels

- **Engine (this fork, keep):** auth, multi-tenant structure, data layer, agent
  infra, apps/{app,api,agent} layout. Strip telemetry; DB-driven theme tokens.
- **Body panels (`design/v0-suite/`, port in):** the complete blue-collar UI,
  generated in v0 (Next.js + shadcn — same dialect) and treated as the UI
  contract. 12 screens + the agentic layer. Demo-ready with seeded data at
  `design/v0-suite/src/lib/data/seed.ts`; each screen ports by swapping its
  repository calls onto the engine's real data layer.

## The agentic layer is the product (Kyle's order: heavy focus here)

| Piece | v0 reference | Doctrine |
|---|---|---|
| Janus AI workspace | `app/(app)/janus/` | Evidence feed + one-click revert; ONLY high-blast-radius actions wait for approval — work never stops on a minor gate |
| Per-job copilot | `components/agent/job-copilot.tsx` | Draft-ready suggestions w/ Send/Edit/Dismiss + confidence |
| Ask Janus (Cmd+K) | command bar in app shell | Natural language → tool-call chips → inline results |
| Phone agent | `app/(app)/phone-agent/` | Script editor, escalation rules, call simulator; AI-answered calls land in Inbox w/ transcript + take-over |
| Told-not-built automations | `app/(app)/automations/` + `src/lib/automation-parser.ts` | Sentence → TRIGGER→ACTION chips; per-rule autonomy: Auto-run / Auto-run+evidence / Ask first |
| Field voice | `components/agent/field-voice.tsx` | Hold-to-talk → parsed actions to confirm |

## Phases (from the approved 8/5 plan)

1. **Foundation** — fork ✅, rebrand, strip telemetry, theme tokens, port shell + boards + job detail
2. **Front door** — chat + voice + confirm-before-save cards
3. **Told-not-built automations** — parser → real scheduled tasks
4. **Phone/SMS** — A2P 10DLC registered conversationally (see `a2p-registration` skill)
5. **Reviews/GBP** — Review Gremlin integration
6. **Agent-built landing pages** — reuse deploy-site pipeline
7. **Platform layer** — control plane, instance-per-business, Stripe, impersonation admin

## Rules of the build

- Instance-per-business stays (single-tenant purity); control plane comes later.
- Preview-first: any UI not in the v0 suite gets a mock before implementation.
- Bright, customer-themeable UI — explicitly NOT dark-SaaS.
- Local dev: Bun + portable Postgres 17 recipe proven in `C:\Users\Kyle\crm-test`
  (`dev:session` cookie login; agent needs AI_GATEWAY_API_KEY).
- Gates that remain Kyle-only: dedicated VPS, Twilio/Telnyx ISV, GBP API app.
