# Implementation Plan – FEAT 4: Analytics › Customers 360°

## Goal

Add a new **"Customers 360°"** sub-tab inside the existing Analytics page (`/analytics`). This screen gives a unified, at-a-glance view of every key data point linked to a selected customer: their identity card, key contacts, active deals / orders, meetings, support tickets, and invoices — all consolidated on a single premium screen.

---

## Background & Context

The Analytics page currently shows KPI cards, forecast charts, and a Lost Opportunities table — all aggregate views.  
This feature adds a **customer-centric lens** by introducing a sub-tab switcher at the top of the page so the user can toggle between:

| Tab | Route equivalent |
|---|---|
| **Overview** *(existing)* | current analytics dashboard |
| **Customers 360°** *(new)* | customer detail panel |

All data already lives in `CrmStateService` signals: `partners`, `deals`, `tickets`, `invoices`, and `customerCards`. No new data fetching infrastructure is required — we read and join the signals.

---

## Proposed Changes

---

### 1. Data Model — `crm-state.service.ts`

#### [MODIFY] [crm-state.service.ts](file:///Users/ouajidachraf/Projects/crm/src/app/services/crm-state.service.ts)

Add a **`Customer360View` computed model** that aggregates all cross-entity data for a single partner/customer. This model will be consumed by the new UI tab.

```typescript
// New computed helper interface (added alongside existing interfaces)
export interface Customer360Contact {
  name: string;
  jobTitle: string;
  email?: string;
  phone?: string;
}

export interface Customer360Order {
  id: string;
  title: string;
  stage: DealStage;
  amount: number;
  date?: string;
}

export interface Customer360Meeting {
  id: string;
  date: string;
  title: string;
  type: string;
}

export interface Customer360Ticket {
  id: string;
  title: string;
  status: TicketStatus;
  priority: string;
}

export interface Customer360Invoice {
  id: string;
  amount: number;
  status: InvoiceStatus;
  dueDate: string;
}

export interface Customer360View {
  partner: Partner;
  contacts: Customer360Contact[];
  orders: Customer360Order[];
  meetings: Customer360Meeting[];
  tickets: Customer360Ticket[];
  invoices: Customer360Invoice[];
}
```

Add a new **`getCustomer360(partnerId: string): Customer360View | null`** method to `CrmStateService` that:
- Finds the partner by `partnerId`
- Collects contacts from matching `customerCards[].personnel` (mapped to `Customer360Contact`)
- Collects all `deals` where `partnerId` matches (mapped to `Customer360Order`)
- Flattens `activityLog.meetings` from all matching deals (mapped to `Customer360Meeting`)
- Collects all `tickets` where `partnerId` matches (mapped to `Customer360Ticket`)
- Collects all `invoices` where `partnerId` matches (mapped to `Customer360Invoice`)

Also add a convenience `computed` signal:

```typescript
allCustomers360 = computed(() =>
  this.partners()
    .filter(p => p.type === 'Customer')
    .map(p => this.getCustomer360(p.id)!)
    .filter(Boolean)
);
```

> [!NOTE]
> No new seed data is required. The feature works off the four existing Moroccan partners + deals + tickets + invoices already in the service.  
> For demo richness, **one additional mock partner** of type `Customer` should be added with a `customerCard` containing 3 personnel (CEO, IT Manager, Finance Manager) to precisely match the spec example: *"ABC Technologies"*.

Add a new mock customer partner to the seed data:

```typescript
{ id: 'p5', name: 'ABC Technologies', type: 'Customer', email: 'contact@abctech.ma',
  phone: '+212-522-112233', city: 'Casablanca' }
```

And a corresponding `CustomerCard` with personnel:

```typescript
{
  id: 'cc-p5', partnerId: 'p5', accountId: 'ACT-ABC-01',
  recordType: 'Organization', name: 'ABC Technologies',
  searchName: 'ABC TECH', erpAccount: 'ERP-ABC-01',
  ice: '', ifField: '', rc: '', rcCity: '', tp: '',
  vatStatus: ['Standard'], orgType: 'Headquarter', parentAccountId: null,
  addresses: [], mainPhone: '+212-522-112233',
  corporateEmail: 'contact@abctech.ma', websiteUrl: '',
  personnel: [
    { id: 'per-abc-1', fullName: 'Mohammed Alaoui', jobTitle: 'CEO', directMobile: '+212661001001', directEmail: 'ceo@abctech.ma', isPrimary: true },
    { id: 'per-abc-2', fullName: 'Karim Benali', jobTitle: 'IT Manager', directMobile: '+212661002002', directEmail: 'it@abctech.ma', isPrimary: false },
    { id: 'per-abc-3', fullName: 'Samira El Fassi', jobTitle: 'Finance Manager', directMobile: '+212661003003', directEmail: 'finance@abctech.ma', isPrimary: false }
  ]
}
```

Add two deals, two tickets, two invoices and three meetings linked to `p5` to populate the 360° view richly.

---

### 2. Analytics Component — Sub-tab Architecture

#### [MODIFY] [analytics.component.ts](file:///Users/ouajidachraf/Projects/crm/src/app/pages/analytics.component.ts)

**a) Add a tab switcher signal at the top of the component class:**

```typescript
activeTab = signal<'overview' | 'customers360'>('overview');
```

**b) Add a selected customer signal:**

```typescript
selectedCustomerId = signal<string | null>(null);
selectedCustomer360 = computed(() => {
  const id = this.selectedCustomerId();
  return id ? this.state.getCustomer360(id) : null;
});
```

**c) Wrap the existing template in an `@if (activeTab() === 'overview')` block.**

**d) Add a sub-tab navigation bar** at the very top of the analytics template (above KPI cards), consisting of two pill-style tabs:

```
[ Overview ]   [ Customers 360° ]
```

The active tab has an indigo underline or filled pill indicator (matching the existing design system).

**e) Add a `@if (activeTab() === 'customers360')` block** containing the new Customers 360° panel (detailed in section 3 below).

---

### 3. Customers 360° Panel — Layout & Sections

The panel renders inside `analytics.component.ts` (inline template) using the same Tailwind-like utility classes used across the project (matching the existing style: `bg-white rounded-2xl shadow-xs border border-slate-200 p-6`).

#### Layout overview

```
┌─────────────────────────────────────────────────────────────┐
│  Customer Selector Dropdown  [ABC Technologies ▼]           │
│  ─────────────────────────────────────────────────────────  │
│  Customer Identity Card                                     │
│  ┌─────────────────────────┐                               │
│  │ 🏢 ABC Technologies     │  Type | City | Email | Phone  │
│  └─────────────────────────┘                               │
├──────────────┬──────────────┬──────────────┬───────────────┤
│  Contacts    │  Orders      │  Meetings    │  Tickets      │
│  (personnel) │  (deals)     │  (meetings)  │  (tickets)    │
├──────────────┴──────────────┴──────────────┴───────────────┤
│  Invoices                                                   │
└─────────────────────────────────────────────────────────────┘
```

#### Section breakdown

| Section | Data source | Key fields displayed |
|---|---|---|
| **Customer identity** | `Partner` + `CustomerCard` | Name, type badge, city, email, phone, account ID |
| **Contacts** | `CustomerCard.personnel` | Full name, job title, mobile, email, primary badge |
| **Orders** | `Deal[]` filtered by `partnerId` | Title, stage badge (color-coded), amount (MAD), date |
| **Meetings** | `Deal[].activityLog.meetings` (all deals) | Date, title, type icon (in-person / teams / demo), attendee count |
| **Support Tickets** | `Ticket[]` filtered by `partnerId` | Title, status badge, priority badge |
| **Invoices** | `Invoice[]` filtered by `partnerId` | Amount (MAD), status badge (Paid=green, Pending=amber, Overdue=red, Draft=slate), due date |

#### Design details

- **Customer Selector**: a styled `<select>` or custom pill dropdown at the top of the panel. Lists only partners of type `Customer`. On change → `selectedCustomerId.set(...)`.
- **Identity Card**: a wide banner card with the company name initial avatar (2-letter, indigo background), company name, type pill badge, and contact grid.
- **Section cards**: each section is a white card with a header row (icon + label + count badge). Items rendered as a compact list. Empty state: subtle italic "None on record".
- **Status badges**: reuse the same pill badge pattern used in `sales.component.ts` and `tickets.component.ts` — rounded-full, color-coded text + background.
- **Micro-animations**: `hover:shadow-md transition-all` on each card (already used project-wide).
- **Empty state for whole panel**: if the selected customer has zero data on any section, show a grey italic "None on record" row.
- **No data at all**: if `allCustomers360` is empty (no Customer partners exist), show an empty state illustration text with an icon.

#### Stage / Status color map (to match existing project patterns)

| Status/Stage | Color |
|---|---|
| Paid / Closed Won / Confirmed | `emerald` |
| Pending / In Progress / Proposal sent | `amber` |
| Overdue / Closed Lost | `red` |
| Draft / New | `slate` |
| Open ticket | `indigo` |
| Resolved / Closed ticket | `green` |

---

### 4. No Route Changes Required

The Customers 360° view lives **within** the existing `/analytics` route as a client-side sub-tab. No new Angular route is needed.  
No navigation bar change is needed either.

---

## Verification Plan

### Manual Verification

1. Navigate to `/analytics` in the browser.
2. Confirm two sub-tabs appear at the top: **"Overview"** and **"Customers 360°"**.
3. Click **"Customers 360°"** — verify the existing KPI/charts disappear and the 360° panel appears.
4. Confirm the customer dropdown lists all `Customer`-type partners (at minimum: `Maroc Telecom Systems`, `ABC Technologies`).
5. Select **"ABC Technologies"** — verify:
   - Identity card shows name, city, email, phone.
   - Contacts section shows: CEO, IT Manager, Finance Manager.
   - Orders section shows the seeded deals for `p5`.
   - Meetings section shows the seeded meetings.
   - Support Tickets section shows the seeded tickets.
   - Invoices section shows Paid and Pending invoices.
6. Switch back to **"Overview"** tab — confirm the original analytics dashboard is fully intact with charts rendering correctly.
7. Select a different customer from the dropdown — verify all sections update reactively.
8. Verify empty sections show "None on record" gracefully (e.g., a customer with no tickets).

### Automated Tests

No new unit tests are required for this feature (no business logic engine introduced). The `getCustomer360()` method is a pure data-join helper that can be manually verified via step 5 above.

---

## Files Changed Summary

| File | Change Type | Reason |
|---|---|---|
| [crm-state.service.ts](file:///Users/ouajidachraf/Projects/crm/src/app/services/crm-state.service.ts) | **MODIFY** | Add `Customer360*` interfaces, `getCustomer360()` method, `allCustomers360` computed, seed data for `p5` / `cc-p5` + related deals/tickets/invoices/meetings |
| [analytics.component.ts](file:///Users/ouajidachraf/Projects/crm/src/app/pages/analytics.component.ts) | **MODIFY** | Add `activeTab` signal, `selectedCustomerId` signal, `selectedCustomer360` computed, sub-tab switcher UI, full Customers 360° template section |

> [!IMPORTANT]
> No new files, no new routes, no new Angular components. All changes are self-contained within the two existing files above.

---

## Open Questions

> [!NOTE]
> The following are design choices the implementor should confirm before or during execution:

1. **Customer selector style**: Should the customer selector be a native `<select>` element (simpler, consistent with existing forms) or a custom styled card-picker row (richer, more visual)? The plan defaults to a styled `<select>` for speed.
2. **Tab persistence**: Should the selected tab and customer ID survive a page refresh (e.g., via `localStorage` or URL query params like `?tab=customers360&cid=p5`)? The plan defaults to **in-memory only** (resets on navigation).
3. **Scope of "meetings"**: The spec lists meetings. Should this include *all* meetings from all deals linked to the customer, or only standalone/calendar meetings? The plan defaults to **all deal activity-log meetings** since that is the only meetings data model currently in the state service.
