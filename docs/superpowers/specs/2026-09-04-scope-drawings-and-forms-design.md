# Janus: Scope Drawings, Quote-from-Drawing, and Website Forms — Design Spec

**Date:** 2026-09-04
**Status:** Approved in brainstorming with Kyle; ready for implementation planning. Phase A implemented 2026-09-05. Phase B implemented 2026-09-05. Phase B.2 implemented 2026-09-05. Phase C implemented 2026-09-06 (agent layer + injection hardening; live walkthrough pending Anthropic token in .env).
**Goal:** Differentiate Janus from GHL-clone CRMs by making the job-site sketch itself the source of the estimate, and by closing the loop from a customer's website form to a triaged lead — JobNimbus-class capability with an agent-first front door.

## Scope

Three subsystems sharing one core, built in this order:

1. **Drawing/scope editor** — Excalidraw-based canvas with whiteboard, image, and satellite backgrounds; doubles as the on-job notepad.
2. **Price book + quote engine** — measured shapes and pinned items on a drawing become estimate line items; Janus layers AI assistance on top.
3. **Form builder + website embed** — Janus-drafted forms, one script-tag embed for any website, submissions triaged into leads.

Out of scope for this spec (roadmap): material orders / work orders, document templates, first-party WordPress plugin wrapper (thin wrapper over the script embed, later), realtime multi-user drawing collaboration.

## Tech stack decision

- **Canvas:** `@excalidraw/excalidraw` (MIT, free for commercial use — the pricing that exists is Excalidraw+ SaaS, not the library). tldraw rejected due to watermark/license fee; Quickdraw rejected as too young (~440 stars, missing layers/frames).
- **Satellite surface:** MapLibre GL + Terra Draw + Turf.js (all MIT/BSD). Satellite imagery tiles from a provider (MapTiler or Esri free tier) — data cost only, no license cost.
- **Architecture principle: two canvases, one geometry contract.** Both surfaces emit the same "scoped shape" record (geometry + measured quantity + service tag) into one shared quote engine. The quote engine and Janus AI layer never know which canvas a shape came from.

---

## Section 1: Drawing/scope editor and measurement model

### Editor surface

- Routes: `/jobs/:id/drawings` (job-attached) and `/notepad` (standalone).
- Embedded Excalidraw component wrapped in Janus theme tokens; default toolbar trimmed to: pen, shapes, arrow, text, image, plus two custom tools — **Scope** and **Pin** (Section 2).
- Three background modes, presented as tabs of the same editor:
  - **Whiteboard** — white canvas, default.
  - **Image** — upload a job photo, plan, or map screenshot as the canvas background.
  - **Satellite** — the MapLibre + Terra Draw surface; type the job address (pre-filled from the job record), trace on aerial imagery.

### Scale and measurement

- **Whiteboard/image modes:** "Set scale" action — user draws one reference line over a known length and types it ("this eave = 40 ft"). Stored as `pixelsPerFoot` in drawing metadata. Until scale is set, scoped shapes render as "unmeasured"; quantities backfill live the moment scale lands.
- **Satellite mode:** no calibration — Turf.js gives geodesic area/length directly from map geometry.
- **Roof pitch:** satellite and plan-view measurements are plan area; a pitch selector per shape (or drawing-level default) applies the standard pitch multiplier. Prompted, never silently assumed.
- Measurement math is **our layer, not the canvas's**: a listener over the Excalidraw element JSON computes area (shoelace formula on vertices ÷ scale², × pitch factor) or length, and renders a live label on the shape (e.g. "Main roof · 24.3 sq").

### Scoped shapes

- The Scope tool draws ordinary Excalidraw rectangles/polygons/lines stamped with `customData: { scopeId, serviceId?, pitch? }`.
- Untagged scoped shapes appear in a side panel as "unassigned" until a service is picked manually or Janus proposes one (Section 2).

### Storage and safety

- Drawings are rows attached to a job, a contact, or nothing (personal scratch): Excalidraw JSON + scale metadata + rendered PNG thumbnail.
- Autosave; a version saved on each autosave checkpoint; one-click revert. (Gate doctrine: instant + revertable, no approval gate on drawing edits.)

---

## Section 2: Price book, items on the drawing, estimate generation

### Price book

- New entity: services/products with name, unit (`per_square`, `per_linear_ft`, `per_each`, `flat`), unit price, cost, optional Good/Better/Best price variants.
- Seeded per trade — roofing starter book ships (tear-off, shingles, underlayment, drip edge, ridge vent, skylight flashing, disposal, …) so day one isn't a blank table.
- Maintained conversationally ("bump tear-off to $475/sq") with a plain table editor as backup.

### Two gestures put items on a drawing

1. **Measured shapes** (Scope tool): tag a polygon/line with a price-book service; quantity derives from measurement. Area shapes map to per-square/sq-ft services; lines map to linear-ft services (eaves, ridge, gutter runs).
2. **Pin items** (Pin/stamp tool): tap the drawing to drop a pin for countable things (vent, skylight, pipe boot, outlet), pick the service, tap again for more. Quantity = pin count. Pins are Excalidraw elements (icon + `customData.serviceId`) so they move/delete/undo normally, and double as the crew's visual job map.

### Generate estimate

- One button: every tagged shape and pin becomes a line item — service, quantity from geometry/count, price-book rate — grouped by area name, opened as a **draft** in the existing Good/Better/Best estimate builder. Nothing sends without the owner.
- Estimate edits do not mutate the drawing. A "re-sync from drawing" action re-pulls quantities after the sketch is revised (line items flagged as changed, confirm before apply).

### Janus AI layer

All via confirm cards, never silent:

- Auto-suggests service tags for unassigned shapes ("that 180 ln-ft line along the eave — drip edge?").
- Flags likely-missing items (tear-off present, no disposal line).
- Converts handwritten/typed text notes on the canvas into proposed line items.

---

## Section 3: Notepad mode and where drawings live

- **Notepad = same editor, minus the money.** `/notepad` opens the identical surface with Scope/Pin tools collapsed — pen-first, big touch targets, one-handed phone use. Field mode (`/field`) gets a "Quick note" button: two taps to a blank canvas with pen active.
- **Attach later, conversationally.** Drawings attach to a job, contact, or nothing. Janus attaches on request ("that sketch from this morning — put it on the Henderson job"). When today's schedule places the user at a job, quick-note pre-suggests that job as attach target. Confirm card.
- **Notes graduate.** Any notepad drawing can be promoted: "Set scale" surfaces the Scope tools and it becomes an estimate source in place — no copy/export. The tailgate scribble is quotable.
- **Organization:** Drawings tab on job detail (thumbnails); global Drawings list searchable by job/contact/date; unattached notes older than a few days surface in the Janus "waiting on you" strip with a filing suggestion.

---

## Section 4: Form builder and website embed

### Authoring

- New Forms area. Owner describes the form in a sentence; Janus generates fields + live preview beside a plain field-list editor (add/remove/reorder; types: text, phone, email, address, dropdown, photo upload, message; required toggles). Edits work via either the list or conversation.
- Styling minimal by design: accent color, logo toggle, light/dark — inherited from the install's theme tokens.

### Embed

- One snippet per form: `<script src="https://{install-domain}/embed/f/{formId}.js"></script>`.
- Renders into a host div (inline mode) or as a floating-button popup. Shadow DOM isolation so host-site CSS can't break it. Works on WordPress, Wix, Vulcan-built sites, anything.
- Spam defense: honeypot field + server-side time-to-submit check. No CAPTCHA.

### Submission pipeline

On submit, the API:

1. Creates or matches a contact (phone/email dedupe).
2. Opens a lead on the sales board.
3. Janus enriches and triages — reads the message, drafts the reply text/email, suggests job type and next action — surfaced as a confirm card in the inbox.

- Per-form autonomy reuses told-not-built levels: **Ask first** / **Auto-send + evidence**.
- Owner phone notification on every submission regardless of autonomy (speed-to-lead).
- Embed captures UTM params + referrer onto the lead for attribution.

---

## Build order

1. **Phase A — Editor core:** Excalidraw embed, three backgrounds, scale calibration, measurement layer, drawing storage/versioning, notepad + field quick-note.
2. **Phase B — Money:** price book (+ roofing seed), Scope tagging, Pin tool, estimate generation into the existing builder, re-sync.
3. **Phase C — Janus layer:** auto-tag, missing-item flags, notes→line items, attach-later flows, waiting-on-you filing.
4. **Phase D — Forms:** authoring UI + Janus drafting, embed script + shadow DOM renderer, submission pipeline + triage, attribution.

Satellite (MapLibre surface) lands in Phase A behind the tab; if imagery-provider setup drags, Phases B–D do not depend on it (image mode covers the interim).

## Testing

- Measurement layer: unit tests on shoelace area, scale conversion, pitch multipliers, Turf parity checks for satellite shapes.
- Quote engine: golden tests — drawing JSON fixture in, expected line items out; re-sync diff behavior.
- Embed: rendered in fixture pages (WordPress theme, bare HTML) via Playwright; submission → contact/lead assertions; honeypot + timing rejection tests.
- Janus layer: confirm-card contract tests — no path writes an estimate or sends a reply without an approval event, except forms explicitly set to Auto-send.

## Open items (not blockers)

- Satellite imagery provider choice (MapTiler vs Esri free tier) — decide in Phase A on cost/ToS.
- Roofing seed price book contents — draft from FSG client estimates, Kyle reviews numbers.
- Embed domain strategy for multi-tenant installs (each install serves its own embed script from its own domain — consistent with single-tenant architecture).
