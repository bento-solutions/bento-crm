# Feature: Deals & Proposals Enhancements + Analytics Rebuild

## Background

The CRM is an Angular 17+ application using signals and TailwindCSS. The existing [sales.component.ts](file:///Users/ouajidachraf/Projects/crm/src/app/pages/sales.component.ts) already renders a deal card with a basic `emailExchange` field. The [crm-state.service.ts](file:///Users/ouajidachraf/Projects/crm/src/app/services/crm-state.service.ts) already holds the `Deal` interface. The [analytics.component.ts](file:///Users/ouajidachraf/Projects/crm/src/app/pages/analytics.component.ts) has placeholder KPI cards only.

This plan adds two independently-shippable improvements:

1. **Deal Activity Hub** — A rich, tabbed activity panel embedded in every deal card (Calls, Emails, Meetings, Teams Recordings, Notes, Tasks, Follow-ups + optional Calendar tab).
2. **Analytics Rebuild** — A fully-populated Sales Analytics page with the 8 KPIs requested.

---

## Open Questions

> [!IMPORTANT]
> **Outlook Calendar Sync** — The calendar tab requirement includes "synchronize with Outlook (TBD)". Since this requires OAuth + Microsoft Graph API (a backend), **this plan defers the sync to a later phase**. The Calendar UI tab itself (read-only, client-side mock) will be built now as a placeholder.

> [!IMPORTANT]
> **Chart Library** — The analytics charts (sales forecast, country breakdown, etc.) require a chart library. The existing `package.json` has no charting dependency. Two options:
> - **Option A** – Use `Chart.js` via CDN script tag (no npm install needed, fast to add).
> - **Option B** – Install `ngx-charts` or `ng2-charts` as a proper Angular package.
>
> The plan defaults to **Chart.js via CDN** to avoid touching `package.json` and breaking the build. Confirm before execution if you'd prefer a proper npm package.

> [!NOTE]
> **Persistence** — All activity log entries (calls, emails, notes, etc.) will be stored in Angular signals (in-memory) as in the rest of the app. No backend/Firestore is required for this feature.

---

## Proposed Changes

### 1 — Data Model

#### [MODIFY] [crm-state.service.ts](file:///Users/ouajidachraf/Projects/crm/src/app/services/crm-state.service.ts)

Add new interfaces to the `Deal` data shape and to the service:

| New interface | Fields |
|---|---|
| `CallLog` | `id`, `date`, `duration`, `callerName`, `summary`, `outcome` |
| `EmailLog` | `id`, `date`, `from`, `to`, `subject`, `body`, `direction` (`sent`/`received`) |
| `Meeting` | `id`, `date`, `time`, `title`, `attendees[]`, `location`, `summary`, `type` (`in-person`/`teams`/`demo`) |
| `TeamsRecording` | `id`, `date`, `title`, `meetingLink`, `recordingLink`, `duration` |
| `Note` | `id`, `date`, `author`, `content` |
| `FollowUp` | `id`, `dueDate`, `title`, `assignedTo`, `status` (`pending`/`done`) |

The existing `Deal` interface gains an `activityLog` property:
```ts
activityLog?: {
  calls: CallLog[];
  emails: EmailLog[];
  meetings: Meeting[];
  recordings: TeamsRecording[];
  notes: Note[];
  tasks: Task[];       // references to Task ids
  followUps: FollowUp[];
}
```

New service methods:
- `addCallLog(dealId, entry)` / `addEmailLog(dealId, entry)` / `addMeeting(dealId, entry)` / `addRecording(dealId, entry)` / `addNote(dealId, entry)` / `addFollowUp(dealId, entry)`
- `updateFollowUpStatus(dealId, followUpId, status)`
- Analytics computed signals: `salesForecast()`, `conversionRate()`, `winRate()`, `avgDealSize()`, `dealsByCountry()`, `topCustomers()`, `lostOpportunities()`

Seed data for the walkthrough deal (`Atlas Digital`) will be updated with sample entries across all 7 activity types.

---

### 2 — Deal Activity Hub (Sales Component)

#### [MODIFY] [sales.component.ts](file:///Users/ouajidachraf/Projects/crm/src/app/pages/sales.component.ts)

**What changes:** The deal card currently shows `emailExchange` as a raw `<pre>` block. This is replaced by a proper **Activity Hub** panel that appears when a deal card is expanded.

**Layout within deal card:**

```
┌──────────────────────────────────────────────┐
│  Deal header (title, client, amount, stage)  │
│  [View Full Details ▾]                       │
├──────────────────────────────────────────────┤
│  ACTIVITY HUB                                │
│  [📞 Calls] [📧 Emails] [🗓 Meetings]        │
│  [🎬 Recordings] [📝 Notes] [✅ Tasks]       │
│  [🔔 Follow-ups] [📅 Calendar]               │
├──────────────────────────────────────────────┤
│  Active tab content (timeline / table)       │
│  [+ Add Entry button]                        │
└──────────────────────────────────────────────┘
```

**Tab-by-tab breakdown:**

| Tab | Display | Add entry form fields |
|---|---|---|
| 📞 Calls | Timeline cards (date, caller, duration, outcome badge, summary) | Date, duration (min), caller name, summary, outcome (dropdown: Interested/Follow-up/No answer/Closed) |
| 📧 Emails | Conversation-style thread (sent=right, received=left, with subject + snippet) | Direction, from, to, subject, body |
| 🗓 Meetings | Cards with type badge, date/time, attendees pills, summary | Title, date, time, type, attendees (comma-sep), location, summary |
| 🎬 Recordings | List with Teams icon, date, title, duration, clickable meeting link + recording link | Title, date, meeting link, recording link, duration |
| 📝 Notes | Sticky-note style cards with author and timestamp | Content (textarea), author |
| ✅ Tasks | Inline task list filtered to this deal's `relatedTo`, with checkbox toggle | Delegated to existing task creation modal with `relatedTo` pre-filled |
| 🔔 Follow-ups | Card list with due date, badge (pending/done), assignee | Title, due date, assigned to (user picker) |
| 📅 Calendar | Monthly mini-calendar. Days with events are highlighted. Clicking a day shows events for that day (meetings + demos from this deal). | No add form in this phase — events come from Meetings tab. Outlook sync is TBD. |

**Inline add-entry modals** — each tab has a "＋ Add" button that opens a compact modal pre-scoped to the current deal. No page navigation required.

**Signals used for UI state:**
- `activeDealTab = signal<Record<string, string>>({})` — tracks the active tab per deal id
- `addEntryModalOpen = signal<{ dealId: string; type: string } | null>(null)` — controls which add-entry modal is open

---

### 3 — Analytics Rebuild

#### [MODIFY] [analytics.component.ts](file:///Users/ouajidachraf/Projects/crm/src/app/pages/analytics.component.ts)

The existing 3-KPI placeholder is replaced with a full Analytics page with two sections:

**Section A — KPI Summary Strip (top row)**

| KPI Card | Source computation | Icon color |
|---|---|---|
| Sales This Month | Sum of deals won in current calendar month | Emerald |
| Conversion Rate | (Confirmed + Won deals) / total deals × 100 | Indigo |
| Win Rate | Won deals / (Won + Lost deals) × 100 | Violet |
| Average Deal Size | total deal value / number of deals | Sky |

**Section B — Charts Row**

| Chart | Type | Source |
|---|---|---|
| Sales Forecast | Line chart — expected revenue per month, per salesperson | `Deal.salesPerson` + `orderDate` grouped by month |
| Sales by Country / Region | Horizontal bar chart | `Deal.salesRegion` grouped by region |
| Top Customers | Ranked list (not a chart) with avatar, company, total deal value, number of deals | `Deal.partnerId` grouped |
| Lost Opportunities | Table with deal name, client, amount, stage when lost, date | Deals with `stage = 'Closed Lost'` |

**Chart rendering:** Chart.js loaded via `<script>` tag in `index.html` (no npm install). Canvas elements rendered in the template with `@ViewChild`. Chart instances initialized in `ngAfterViewInit`.

**Computed signals added to the service (used by analytics):**
```ts
salesThisMonth = computed(...)   // filter deals by current month, sum amounts
conversionRate = computed(...)   // (confirmed + won) / total
winRate = computed(...)          // won / (won + lost)
avgDealSize = computed(...)      // total / count
dealsByRegion = computed(...)    // { region: string; total: number }[]
topCustomers = computed(...)     // { name: string; totalValue: number; dealCount: number }[]
lostOpportunities = computed(...) // Deal[] with stage 'Closed Lost'
```

Sample data for all charts will be seeded into the walkthrough deal + 3–4 additional seed deals added to `state.deals` initial value to make charts non-trivial.

---

## Verification Plan

### Manual Verification

1. Open `/sales` → Deals tab → expand a deal → verify Activity Hub tabs render and are individually clickable.
2. Click "＋ Add" on each tab → verify modal opens with correct fields → save → verify entry appears in the timeline.
3. Open Calendar tab → verify current month renders with highlighted event days.
4. Open `/analytics` → verify all 4 KPI cards render with non-zero computed values.
5. Verify Sales Forecast line chart, Sales by Region bar chart, Top Customers list, and Lost Opportunities table are all populated.
6. Reset walkthrough → verify analytics values update reactively.

### Automated Tests
No new test files are planned for this iteration (matches the existing pattern — no `.spec.ts` files exist for the page components). Manual smoke-test as above.

---

## Phasing

| # | Step | File(s) touched | Est. scope |
|---|---|---|---|
| 1 | Add interfaces + service methods + computed signals + seed data | `crm-state.service.ts` | Medium |
| 2 | Build Deal Activity Hub tabs + add-entry modals | `sales.component.ts` | Large |
| 3 | Rebuild Analytics page with KPIs + charts | `analytics.component.ts`, `index.html` (Chart.js script) | Medium |

---

## Status

✅ **Implementation Complete** — All three phases have been implemented:
- Phase 1: Data model extended with activity log interfaces and analytics computed signals
- Phase 2: Deal Activity Hub with all 8 tabs built into the sales component
- Phase 3: Analytics page rebuilt with KPI cards, charts, and tables
