# Feature: Tickets Module Rebuild

## Background

The CRM currently has a `/tickets` page ([tickets.component.ts](file:///Users/ouajidachraf/Projects/crm/src/app/pages/tickets.component.ts)) that renders a basic table with limited fields (title, partner, assignee, priority, status). It is reached through a nav item called **"Inbox"** — a dropdown that also hints at future messaging features.

This plan:
1. Renames the nav item from **"Inbox" → "Tickets"** (a direct, non-dropdown link).
2. Removes the "Inbox" dropdown since the internal messaging feature will be built separately later.
3. Extends the `Ticket` data model with **Type** and **Resolution** fields and an extensible **Ticket Types** list.
4. Rebuilds the tickets page with **full CRUD**: create, view detail, edit, assign, delete.

---

## Open Questions

> **Ticket Types extensibility** — The plan adds a `ticketTypes` signal in `CrmStateService` seeded with `['Software Issue', 'Broken Product', 'Billing Issue']`. Users can add new custom types from within the Create/Edit ticket modal. Custom types persist in-memory (Angular signal), consistent with the rest of the app.

> **Inbox removal** — The "Inbox" dropdown and its "My tickets" link in `app.ts` will be fully removed and replaced by a plain `routerLink="/tickets"` nav item labelled **"Tickets"**. This is non-breaking since `/tickets` is the same route.

---

## Proposed Changes

### 1 — Data Model

#### [MODIFY] crm-state.service.ts

**`Ticket` interface** — extend with two new fields:

| Field | Type | Description |
|---|---|---|
| `type` | `string` | Ticket category (free string, drawn from `ticketTypes` signal) |
| `resolution` | `string?` | Free-text resolution note, filled when ticket is resolved/closed |

After change:
```ts
export interface Ticket {
  id: string;
  title: string;
  partnerId: string;
  assignedTo: string;
  status: TicketStatus;
  priority: 'Low' | 'Medium' | 'High';
  type: string;           // NEW
  resolution?: string;    // NEW
}
```

**New signal — `ticketTypes`** — extensible list of ticket category labels:
```ts
ticketTypes = signal<string[]>([
  'Software Issue',
  'Broken Product',
  'Billing Issue'
]);
```

**New service methods:**

| Method | Signature | Description |
|---|---|---|
| `addTicket` | `(t: Omit<Ticket, 'id'>) => Ticket` | Creates and appends a new ticket |
| `updateTicket` | `(id: string, patch: Partial<Omit<Ticket, 'id'>>) => void` | Edits any field(s) on a ticket |
| `deleteTicket` | `(id: string) => void` | Removes ticket by id |
| `addTicketType` | `(label: string) => void` | Appends a new category to `ticketTypes` |

**Updated seed data** — existing ticket `tk1` gains `type: 'Software Issue'`. Two additional seed tickets:

| id | title | type | status | priority |
|---|---|---|---|---|
| tk1 | Problème accès console Cloud | Software Issue | In Progress | High |
| tk2 | Facture incorrecte - doublon | Billing Issue | Open | Medium |
| tk3 | Produit livré endommagé (serveur rack) | Broken Product | Resolved | High |

`tk3` will include a sample `resolution` note.

---

### 2 — Navigation

#### [MODIFY] app.ts

Replace the **"Inbox" dropdown block** (lines 83–105) with a single plain nav link:

```html
<!-- Tickets -->
<a routerLink="/tickets" routerLinkActive="bg-slate-100 text-slate-900 font-medium"
   class="text-slate-600 hover:text-slate-900 hover:bg-slate-100 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 inline-flex items-center gap-1">
  <mat-icon class="text-[16px] w-4 h-4">confirmation_number</mat-icon>
  Tickets
</a>
```

---

### 3 — Tickets Page Rebuild

#### [MODIFY] tickets.component.ts

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│  Tickets                            [+ New Ticket]       │
│  KPI strip: Total | Open | In Progress | Resolved        │
├─────────────────────────────────────────────────────────┤
│  Filter bar: Status ▾  |  Priority ▾  |  Type ▾         │
├─────────────────────────────────────────────────────────┤
│  Ticket table                                            │
│  Cols: # | Type | Title | Partner | Assignee | Priority  │
│           | Status | Actions (Edit ✏ | Delete 🗑)        │
└─────────────────────────────────────────────────────────┘
```

**Create / Edit Modal** — single modal reused for both create and edit:

| Field | Input | Notes |
|---|---|---|
| Subject / Title | Text input | Required |
| Type | `<select>` from `ticketTypes` signal + `[+ Add type]` inline button | Opens a mini input to append a new type |
| Related Partner | `<select>` from `state.partners()` | |
| Assigned Agent | `<select>` from `state.users()` | |
| Priority | `<select>` Low / Medium / High | |
| Status | `<select>` Open / In Progress / Resolved / Closed | |
| Resolution Note | `<textarea>` | Shown only when status is `Resolved` or `Closed` |

**Delete** — inline per-row confirmation (small "Are you sure? [Yes] [No]" shown inside the row). No separate modal.

**Signals for UI state:**
```ts
modalMode       = signal<'create' | 'edit' | null>(null);
editingId       = signal<string | null>(null);
filterStatus    = signal<string>('All');
filterPriority  = signal<string>('All');
filterType      = signal<string>('All');
confirmDeleteId = signal<string | null>(null);
addingNewType   = signal<boolean>(false);
newTypeLabel    = signal<string>('');
```

**Computed signal:**
```ts
filteredTickets = computed(() =>
  state.tickets()
    .filter(t => filterStatus() === 'All' || t.status === filterStatus())
    .filter(t => filterPriority() === 'All' || t.priority === filterPriority())
    .filter(t => filterType() === 'All' || t.type === filterType())
);
```

**KPI strip (4 cards):**
- Total tickets (slate)
- Open (amber)
- In Progress (indigo)
- Resolved / Closed (emerald)

---

## Verification Plan

### Manual Verification

1. Open `/tickets` — verify the KPI strip, filter bar, and table with 3 seed tickets render correctly.
2. Click **+ New Ticket** — fill all fields including Type — save — ticket appears in table and KPIs update.
3. Click **Edit (✏)** on a ticket — modal pre-fills — change status to `Resolved` — resolution textarea appears — save — row updates.
4. Click **Delete (🗑)** — inline confirm row appears — confirm — ticket removed, KPIs update reactively.
5. In the create modal, click **"+ Add type"** — enter a new label — confirm — it appears in the type dropdown for future tickets.
6. Use the **filter bar** — filter by Status "Open" — only Open tickets shown.
7. Verify the **"Tickets"** nav link is a direct single link (no dropdown), with correct `routerLinkActive` highlight.
8. Verify the **"Inbox" dropdown** is fully gone from the nav.

### Automated Tests
No new test files planned (matches existing pattern — no `.spec.ts` files for page components).

---

## Phasing

| # | Step | File(s) touched | Scope |
|---|---|---|---|
| 1 | Extend `Ticket` interface + add `ticketTypes` signal + service methods + update seed data | `crm-state.service.ts` | Small |
| 2 | Replace Inbox nav dropdown with plain Tickets link | `app.ts` | Trivial |
| 3 | Rebuild tickets page (KPI strip, filter bar, table, create/edit modal, delete confirm) | `tickets.component.ts` | Medium |

---

## Status

⬜ Pending approval
