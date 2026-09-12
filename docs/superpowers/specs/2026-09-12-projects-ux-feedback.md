# Projects UX feedback wave — 2026-09-12

Kyle's live-use findings on the Projects area, root causes and rulings.

## Findings → decisions

1. **Project bar range ≠ its jobs.** The all-projects calendar bar always started at
   `project.startDate`; the end fell back to the last task end only when `goalDate`
   was null. Ruling: the bar derives from content. Start = earliest scheduled task
   start (fallback `startDate`); end = latest of goal date and last task end
   (fallback derived start). `projects.calendarRange` returns the derived
   `startDate`/`endDate`; overlap `where` widened to task extents.
2. **Dragging a project bar** used to shift only `startDate`/`goalDate` ("tasks stay
   where they are"). With task-derived bars that is a visual no-op, so the drag now
   calls a new `projects.moveSchedule { id, deltaDays }` mutation: shifts start,
   goal (when set) and every scheduled task in one transaction. Confirm dialog says
   "Scheduled tasks move with it." Bound: `PROJECTS.calendar.moveMaxDays`.
3. **Task bars resized from the right edge only.** Left-edge handle added
   (mirrors the right one, moves `startDay`, same 30-day span clamp), and both
   handles now show a visible grip at rest (dashboard grab-point lesson).
4. **No back navigation on `/projects/[id]`.** House Back idiom (outline
   `Button asChild` + `ArrowLeft` → `/projects`) added to the header actions,
   same as estimates/invoices/contracts.
5. **Client invisible.** `projects.list`/`byId`/`calendarRange` now select the
   deal's contacts (flattened). Header shows client name buttons (open the contact
   record, capped at 2 + "+N more"), the table gets a Client column, the calendar
   bar tooltip appends the client.
6. **"Job costs" mislabel.** The header button now reads "Costs" and opens the
   deal sheet at its Costs tab — `useRecordStack().open` accepts an optional
   `{ tab }`. (The confusing "Roof Job …" text under the title was the DEAL's
   name — a leaked Playwright walkthrough record in the shared dev DB, not a UI
   entity. "Verify Project 1788673591102" is test data too.)

## Out of scope (ledgered)

- Timeline tab bars are static (no drag/resize) — separate phase if Kyle wants it.
- Deal-anchored week-clipped bars: a multi-week task still cannot resize from a
  week where its edge is clipped (pre-existing).
- Walkthrough test records in the shared dev DB (Verify/Roof Job deals+projects)
  left in place — Kyle's call to purge.
