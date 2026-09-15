# Access Groups — Design

Status: approved by Kyle 2026-09-15. Shared access system with Field Mode (session kyle-c6).

## Goal

Owners decide, per group, what non-admin members can see and do. A "Sales clerk" sees
contacts, deals, drawings and estimates on their own deals, with prices, and nothing
else. The same system locks Field Mode techs to `/field`.

## Decisions (Kyle)

- Granularity: per-area access level + record scope + money switches. No per-field hiding.
- Membership: every non-admin member is in exactly one group. Owner and Admin bypass
  every check. No per-person overrides.
- "Their records" follows the deal. Estimates, invoices, drawings, contracts, projects,
  photos and permits inherit visibility from their deal.
- Existing members migrate into the Office group.
- Build before Field Mode reaches real techs.

## Ownership split with Field Mode (kyle-c6)

| Piece | Owner |
| --- | --- |
| `DealAssignment` (deal → user and/or crew), `CrewMember` (crew → user) | kyle-c6 |
| `Group`, `Member.groupId`, `AccessService`, scope predicate, route tags, Groups settings UI | this phase |
| `/field` surface, close-out UI | kyle-c6, built against `permissions.mine` |

Order: assignment schema → access engine + surface lock → Field UI. Field Mode does not
ship to real users before the surface lock is live.

If the assignment tables are not merged when this phase starts, the scope predicate
ships with owner-only matching and `ASSIGNED` scope matches nothing; the assignment
clause is added when the tables land. `ASSIGNED` groups are never assigned to members
until then.

## Model

### Areas

`contacts`, `deals`, `drawings`, `estimates`, `contracts`, `invoices`, `projects`
(projects + calendar + crews schedule), `photos`, `permits`, `forms`, `jobCosts`,
`reports`.

### Access levels

Cumulative: `HIDDEN` < `VIEW` < `EDIT` < `DELETE`. `reports` accepts `HIDDEN` or `VIEW`.

### Standalone actions

Actions that do not imply `VIEW` of their area. They still respect record scope.

| Action | Grants |
| --- | --- |
| `jobCosts.submit` | Add a cost + receipt on an in-scope deal. No ledger read. |
| `deals.markComplete` | Move an in-scope deal's production stage to its complete stage. |
| `contracts.signInPerson` | Open the signing view for a contract on an in-scope deal. No list. |

New standalone actions are registered in the same registry; Field Mode adds its own there.

### Record scope

Per group, one value for all areas:

- `ALL` — every record.
- `OWN` — deal.ownerId = me OR deal assigned to me OR deal assigned to a crew I belong to.
- `ASSIGNED` — deal assigned to me OR to a crew I belong to.

Contacts in scope: `ALL` unrestricted; `OWN` = `ownerId` = me OR linked (DealContact) to
an in-scope deal; `ASSIGNED` = linked to an in-scope deal.

Records with no deal (Drawing, Estimate, Invoice, Project, Contract where `dealId` is
null): `ALL` sees them; `OWN` sees them when `createdById` = me; `ASSIGNED` never does.

New members after first seeding have no group and no access. They see "Waiting for
access" until an admin picks their group. This replaces an earlier "defaults to the
most restricted group" idea: a new sign-up never lands in Field mode by accident.

### Money switches

- `money.prices` — unit prices and totals on estimates, invoices, contracts, proposals.
- `money.profit` — job costs ledger, profit, collected, money reports (replaces `profit.view`).
- `money.priceBook` — edit services and prices.

### Surface

`FULL` or `FIELD`. `FIELD` redirects every app route outside `/field` to `/field`,
refuses every tRPC procedure not tagged field-allowed, and denies Janus chat.

### Schema (append at end of schema.prisma)

```prisma
model AccessGroup {
  id        String   @id @default(cuid())
  name      String   @unique
  surface   String   @default("FULL")
  scope     String   @default("OWN")
  policy    Json
  isSeed    Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  members   Member[]
  @@map("access_group")
}
```

`Member.groupId String?` → `AccessGroup`, `onDelete: Restrict`. Null for owner/admin.
`policy` is parsed at the boundary by `accessPolicySchema` (zod) in `packages/db/src/access-policy.ts`:
`{ areas: Record<Area, Level>, actions: StandaloneAction[], money: MoneySwitch[] }`.
Types derive with `z.infer`. Area and action lists live in one `ACCESS` config object.

Migration: plain members without `profit.view` go into Office. If any plain member holds
`profit.view`, the migration also creates an "Office + profit" group (Office policy plus
`money.profit`) and places those members there. Nobody gains or loses access. The
`UserPermission` table stops being read and is dropped in a later held-DDL step.

### Seed groups (created once, editable)

| Group | Surface | Scope | Areas | Actions | Money |
| --- | --- | --- | --- | --- | --- |
| Sales clerk | FULL | OWN | contacts, deals, drawings, estimates: EDIT; photos: VIEW; rest HIDDEN | — | prices |
| Office | FULL | ALL | all EDIT; reports VIEW | — | prices |
| Crew lead | FIELD | ASSIGNED | projects, photos: EDIT; rest HIDDEN | jobCosts.submit, deals.markComplete, contracts.signInPerson | — |

## Enforcement

### AccessService (`apps/api/src/access`)

- `resolve(userId)` → `{ isAdmin, group, policy }`, cached per request.
- `can(ctx, area, levelOrAction)` → boolean.
- `assert(ctx, area, levelOrAction)` → throws `ForbiddenException` with
  "Your group (<name>) can't <action>. Ask an admin."
- `dealWhere(ctx)` → `Prisma.DealWhereInput` for the group scope.
- `scopedWhere(ctx, area)` → where-input for child models via their deal relation.
- `assertRecord(ctx, area, id)` → `NotFoundException` when out of scope.
- `maskMoney(ctx, dto)` → nulls money fields per switch; UI renders "Hidden".

### Route tags

`@Requires(area, levelOrAction)` decorator + middleware on every tRPC procedure.
`@Requires.admin()` for settings. `@Requires.fieldAllowed()` marks procedures reachable
from `FIELD`. A CI test enumerates every router procedure and fails on any untagged one.

### Leak paths (each gets a scoped integration test)

Global search, Ask-Janus search, dashboard widgets, reports, recents, activity feed,
mailbox/inbox, CSV export, bulk actions, PDFs, photo/receipt/thumbnail file routes,
calendar ranges, board views, contact sheet tabs.

### Janus

Chat and tools run as the requesting user. Agent tools that read `@crm/db` directly apply
the same scope predicate and money masking (shared from `packages/db/src/access-scope.ts`
so API and agent use one implementation). Dispatched sessions keep their existing write
lockdown. `FIELD` surface: chat entry hidden and chat procedures refused.

### App

`permissions.mine` returns `{ isAdmin, groupName, surface, scope, areas, actions, money }`.
Nav, tabs, buttons and columns render from it. `proxy.ts` enforces the `FIELD` redirect.
The UI hides; the server refuses.

### Freshness

Group edits and member moves invalidate `permissions.mine`; the server resolves per
request, so reassigning a deal removes access on the next request.

## Settings UI

Settings › Team gets a Groups tab next to Members and Crews.

- Group list: name, surface badge, member count.
- Group editor: name, surface, scope select, area × level grid (segmented control per
  row), standalone action checkboxes, money switches. Save confirms "Changes access for
  N people."
- Members table: role column shows Owner / Admin / group name; changing to a group is a
  select. New invites require a group unless inviting an admin.
- Guards: cannot delete a group with members; cannot move the last owner into a group.

Admin-only. Preview mock approved before implementation (Kyle's preview-first rule).

## Errors

- Out-of-scope record by id: not found.
- Missing level/action: forbidden with the group message above; surfaced as a toast.
- Policy JSON fails schema: hard error naming the group; never treated as empty access.

## Testing

- Unit: level ordering, standalone actions, scope predicate per mode, money masking.
- Integration (`crm_test`): per area, as Sales clerk / Office / Crew lead — list, get by
  id, mutate, delete; every leak path above.
- CI: untagged-procedure guard.
- Agent: hostile prompts from a scoped user cannot read out-of-scope deals or money.
- Playwright walkthrough with three logins (dev-login `?email=`).

## Out of scope

Per-field hiding, per-person overrides, multiple groups per person, `/field` UI and
close-out screens (kyle-c6), assignment schema (kyle-c6).
