
## CareSync MVP — Frontend Shell & Core Views

Building the frontend-only UI shell with mock data, dark Apple-HIG styling, and Framer Motion interactions. No backend yet.

### Design system
- **Theme:** Strict dark mode via `src/styles.css`. Background `zinc-950`, cards `zinc-900`, borders `zinc-800`, text white/zinc-100, muted `zinc-400`.
- **Typography:** Inter via Google Fonts, system-ui fallback.
- **User color tokens:** Central `src/lib/users.ts` with mock users (Mom=blue-500, Dad=amber-500, Nurse Kim=emerald-500, Sister=violet-500). Used as left-border accents and avatar dots.
- **Touch targets:** Min 44×44 utility class for all interactive controls.
- **Icons:** Lucide React.
- **Animations:** Framer Motion for task removal + Undo toast.

### Routing (TanStack Start)
Separate route files (per Lovable conventions):
- `src/routes/index.tsx` → My Day dashboard (default landing)
- `src/routes/calendar.tsx` → Shared Care Calendar
- `src/routes/updates.tsx` → Status Update Board
- `src/routes/scan.tsx` → AI Staging UI

Each route gets its own `head()` metadata.

### Global layout (`__root.tsx`)
- Bottom tab bar on mobile (My Day, Calendar, Updates, Scan AVS), morphs to left sidebar ≥md breakpoint.
- Top app header with "CareSync" wordmark and current-user avatar dot.
- Persistent muted footer disclaimer: *"CareSync is an administrative organizational tool, not a substitute for professional medical advice."*
- Sonner `<Toaster />` mounted globally, positioned bottom-center, styled dark.

### View A — My Day Dashboard
- Vertical 24-hour timeline of mocked clinical tasks (medications, appointments, transport).
- Each task = elevated card with: time block, title, dosage/notes, large round checkbox (≥44px), assigned-user color left border + avatar dot.
- On check: Framer Motion `AnimatePresence` collapse/fade-out, then trigger Sonner toast "Task Completed" with **Undo** action button, 5-second duration. Undo restores the task to local state.
- Header shows today's date and remaining-task count.

### View B — Shared Care Calendar
- Toggle: Week / Month grid (default Week for MVP clarity).
- Sparse color-coded event chips: pill icon (emerald) for meds, car icon (blue) for transport, stethoscope (violet) for appointments.
- Click a day → side panel/sheet listing that day's events. Minimal, no clutter.

### View C — Status Update Board
- Read-only vertical feed of admin posts styled like soft chat bubbles / micro-blog cards.
- Each card: admin avatar dot + name, timestamp (relative, e.g., "2h ago"), body text.
- Subtle entrance animation on mount.

### View D — AI Staging (Human-In-The-Loop)
- **Top:** Large dashed-border dropzone, "Upload After Visit Summary (AVS)", upload icon. Click triggers mock parse (simulated 1.5s loading state with spinner).
- **Middle:** "Parsed Results" table rendered from mock JSON (Medication / Dosage / Frequency / Time). Each row is editable inline (mock — local state only) with subtle hover state.
- Yellow warning banner: *"Verify each entry against the physical AVS before approving."*
- **Bottom:** Sticky action bar with massive primary green "Approve & Add to Schedule" button + secondary outline "Reject / Edit" button.
- Approve → success toast + clears staging table.

### Mock data
- `src/lib/mock-data.ts`: users, tasks (with assignedUserId, time, title, dosage), calendar events, status updates, parsed AVS rows.
- All state is local React state (`useState`) per view. No persistence.

### Files to create/modify
- `src/styles.css` — dark theme tokens, Inter font, body bg.
- `src/routes/__root.tsx` — shell, nav (bottom tabs / sidebar), disclaimer, Sonner.
- `src/routes/index.tsx` — My Day.
- `src/routes/calendar.tsx`, `updates.tsx`, `scan.tsx` — other views.
- `src/lib/users.ts`, `src/lib/mock-data.ts`.
- `src/components/` — `AppNav.tsx`, `TaskCard.tsx`, `UserDot.tsx`, `EventChip.tsx`, `UpdateCard.tsx`, `Dropzone.tsx`, `ParsedResultsTable.tsx`.
- Add deps: `framer-motion`, `lucide-react` (if not present), `sonner`.

### Deliverable
A navigable, fully styled dark-mode CareSync prototype where you can: tick a task and see the Framer Motion removal + Undo, browse calendar events, read updates, and run through the mock AVS approve flow.
