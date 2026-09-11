# Technical Reverse-Engineering & Logical Decryption Audit
**Project Name:** varyocrm
**Role:** Angular v21 Reverse-Engineering Specialist & Principal Code Auditor
**Date:** June 27, 2026

---

## 1. Complete Logical Tree Mapping
The static structure of the `varyocrm` core logic layer spans state administration, i18n localization, and standalone page modules. The dependency paths trace as follows:

```
src/app/
├── app.ts (Shell layout, consumes CrmStateService, manages activeDropdown signal, isWizardOpen signal)
├── app.config.ts (Provides routes definition)
├── app.routes.ts (Lazy-loads standalone components: DashboardComponent, AnalyticsComponent, SalesComponent, MarketingComponent, PartnersComponent, FinanceComponent, TicketsComponent, CustomerCardComponent)
├── app.routes.server.ts (Configures SSR RenderMode)
├── pipes/
│   └── translate.pipe.ts (Consumes TranslationService, transforms keys, standalone)
└── services/
    ├── crm-state.service.ts (Central state module, manages writable signals, computed logic, and mock seeds)
    └── translation.service.ts (Localization dictionaries and currentLang storage manager)
```

Within the standalone page components, the logical injections and routing are map-locked:
* `DashboardComponent` -> Injects `CrmStateService`. Declares local `isCustomizing = signal(false)` signal.
* `PartnersComponent` -> Injects `CrmStateService` and `Router`. Declares `activeTab = signal<'Customer' | 'Prospect' | 'Vendor'>('Customer')` and `showCreateModal = signal(false)` signals.
* `CustomerCardComponent` -> Injects `CrmStateService`, `ActivatedRoute`, and `Router`. Declares `isExisting = signal(false)`, `form = signal<CustomerCard>(...)`, and `iceError = signal<string | null>(null)` signals.
* `SalesComponent` -> Injects `CrmStateService`. Declares multiple local tracking signals: `activeTab = signal<'deals' | 'proposals' | 'tasks' | 'pos'>('deals')`, `assignModalOpen = signal(false)`, `proposalModalOpen = signal(false)`, `dealModalOpen = signal(false)`, `poModalOpen = signal(false)`, `setDeliveryDateModalOpen = signal(false)`, `selectedTask = signal<Task | null>(null)`, `selectedPOForDelivery = signal<PurchaseOrder | null>(null)`, and `expandedDeals = signal<Record<string, boolean>>({})`.
* `FinanceComponent` -> Injects `CrmStateService`. Declares `activeTab = signal<'Customer' | 'Vendor' | 'Recovery'>('Customer')`, `invoiceModalOpen = signal(false)`, `selectedInvoiceIds = signal<string[]>([])`, `reminderChannel = signal<'WhatsApp' | 'SMS' | 'Email'>('WhatsApp')`, and `successMessage = signal('')`.
* `TicketsComponent` -> Injects `CrmStateService`. Declares `modalOpen = signal(false)`.
* `MarketingComponent` -> Injects `CrmStateService`. Declares `activeTab = signal<'Email' | 'WhatsApp' | 'SMS'>('Email')`.
* `AnalyticsComponent` -> Injects `CrmStateService`. No local signals.

---

## 2. Signals & Computed Registry

This registry represents all writable and computed signals declared in `src/app/services/crm-state.service.ts`:

### A. Writable Signals
1. **`users`**
   * **TypeScript Type:** `signal<{ name: string; role: string; team: 'Sales' | 'Operations' | 'Finance' | 'Support' }[]>`
   * **Default Value / Initializer:**
     ```typescript
     [
       { name: 'Youssef El Alami', role: 'Salesperson', team: 'Sales' },
       { name: 'Amine Bennani', role: 'Salesperson', team: 'Sales' },
       { name: 'Achraf (Manager)', role: 'Sales Manager', team: 'Sales' },
       { name: 'Khadija (Ops Manager)', role: 'Operations Manager', team: 'Operations' },
       { name: 'Fatima Chraibi', role: 'Operations Personnel', team: 'Operations' },
       { name: 'Omar (Finance)', role: 'Finance Specialist', team: 'Finance' }
     ]
     ```
2. **`proposalTemplates`**
   * **TypeScript Type:** `signal<ProposalTemplate[]>`
   * **Default Value / Initializer:** Array of 2 predefined objects (`temp1`: "Standard Cloud Hosting Services", `temp2`: "CRM Customization & Training") containing properties: `id`, `name`, `subject`, `body`, and `lines`.
3. **`partners`**
   * **TypeScript Type:** `signal<Partner[]>`
   * **Default Value / Initializer:** Array of 4 predefined objects (`p1`: "Atlas Digital S.A.R.L.", `p2`: "Casablanca Tech Wholesale", `p3`: "Maroc Telecom Systems", `p4`: "Al-Maghrib Consulting") containing properties: `id`, `name`, `type`, `email`, `phone`, `comments`, and `city`.
4. **`tasks`**
   * **TypeScript Type:** `signal<Task[]>`
   * **Default Value / Initializer:** Array of 1 initial task object (`t1`: "Assign prospect and follow up") containing: `id`, `title`, `description`, `assignedTeam`, `assignedTo`, `status`, and `relatedTo`.
5. **`proposals`**
   * **TypeScript Type:** `signal<Proposal[]>`
   * **Default Value / Initializer:** `[]` (Empty array).
6. **`deals`**
   * **TypeScript Type:** `signal<Deal[]>`
   * **Default Value / Initializer:** `[]` (Empty array).
7. **`purchaseOrders`**
   * **TypeScript Type:** `signal<PurchaseOrder[]>`
   * **Default Value / Initializer:** `[]` (Empty array).
8. **`invoices`**
   * **TypeScript Type:** `signal<Invoice[]>`
   * **Default Value / Initializer:** `[]` (Empty array).
9. **`campaigns`**
   * **TypeScript Type:** `signal<Campaign[]>`
   * **Default Value / Initializer:** Array of 3 predefined objects (`c1`: "Aïd Al-Adha Promotion", `c2`: "WhatsApp Alert - Nouveautés Cloud", `c3`: "SMS Offres Spéciales PME") containing: `id`, `title`, `type`, `status`, `targetAudience`, and `sentCount`.
10. **`tickets`**
    * **TypeScript Type:** `signal<Ticket[]>`
    * **Default Value / Initializer:** Array of 1 initial ticket object (`tk1`: "Problème accès console Cloud") containing: `id`, `title`, `partnerId`, `assignedTo`, `status`, and `priority`.
11. **`customerCards`**
    * **TypeScript Type:** `signal<CustomerCard[]>`
    * **Default Value / Initializer:** `[]` (Empty array).
12. **`dashboardKpis`**
    * **TypeScript Type:** `signal<string[]>`
    * **Default Value / Initializer:** `['totalDeals', 'marketingSpend', 'latePayers']`
13. **`walkthroughStep`**
    * **TypeScript Type:** `signal<number>`
    * **Default Value / Initializer:** `0`

### B. Computed Signals
1. **`customers`**
   * **Source Dependency:** `partners`
   * **Logical Formula:**
     ```typescript
     computed(() => this.partners().filter(p => p.type === 'Customer'))
     ```
2. **`vendors`**
   * **Source Dependency:** `partners`
   * **Logical Formula:**
     ```typescript
     computed(() => this.partners().filter(p => p.type === 'Vendor'))
     ```
3. **`prospects`**
   * **Source Dependency:** `partners`
   * **Logical Formula:**
     ```typescript
     computed(() => this.partners().filter(p => p.type === 'Prospect'))
     ```
4. **`customerInvoices`**
   * **Source Dependency:** `invoices`
   * **Logical Formula:**
     ```typescript
     computed(() => this.invoices().filter(i => i.type === 'Customer'))
     ```
5. **`vendorInvoices`**
   * **Source Dependency:** `invoices`
   * **Logical Formula:**
     ```typescript
     computed(() => this.invoices().filter(i => i.type === 'Vendor'))
     ```
6. **`overdueInvoices`**
   * **Source Dependency:** `invoices`
   * **Logical Formula:**
     ```typescript
     computed(() => this.invoices().filter(i => i.type === 'Customer' && i.status === 'Overdue'))
     ```

---

## 3. State Mutation Methods & Signatures

The following methods reside in `CrmStateService` and mutate the central store:

### `toggleDashboardKpi(kpiId: string): void`
* **Logical Action:** Adds or removes a KPI identifier from the display settings.
* **Mechanism:**
  ```typescript
  this.dashboardKpis.update(kpis =>
    kpis.includes(kpiId) ? kpis.filter(id => id !== kpiId) : [...kpis, kpiId]
  );
  ```

### `convertToCustomer(partnerId: string): void`
* **Logical Action:** Converts the `type` of a partner with matching `id` from `'Prospect'` to `'Customer'`.
* **Mechanism:**
  ```typescript
  this.partners.update(partners =>
    partners.map(p => p.id === partnerId ? { ...p, type: 'Customer' } : p)
  );
  ```

### `saveCustomerCard(card: CustomerCard): void`
* **Logical Action:** Upserts a `CustomerCard` object in the central collection.
* **Mechanism:** Matches based on `.id`. If found, updates that array index; otherwise, appends the card using the array spread operator (`...`).
  ```typescript
  this.customerCards.update(cards => {
    const existing = cards.findIndex(c => c.id === card.id);
    if (existing >= 0) {
      const updated = [...cards];
      updated[existing] = card;
      return updated;
    }
    return [...cards, card];
  });
  ```

### `addPartner(partner: Omit<Partner, 'id'>): Partner`
* **Logical Action:** Inserts a new partner record with an auto-incremented string ID prefixed with `p`.
* **Mechanism:** Appends the record using the array spread operator (`...`). Returns the newly created object.
  ```typescript
  const newId = 'p' + (this.partners().length + 1);
  const newPartner = { ...partner, id: newId };
  this.partners.update(pList => [...pList, newPartner]);
  return newPartner;
  ```

### `addTask(task: Omit<Task, 'id'>): Task`
* **Logical Action:** Appends a new Task object with an auto-incremented string ID prefixed with `t`.
* **Mechanism:** Updates using the array spread operator (`...`). Returns the newly created task.
  ```typescript
  const newId = 't' + (this.tasks().length + 1);
  const newTask = { ...task, id: newId };
  this.tasks.update(tList => [...tList, newTask]);
  return newTask;
  ```

### `updateTaskStatus(taskId: string, status: TaskStatus, assignedTo?: string): void`
* **Logical Action:** Updates the `status` and optionally the `assignedTo` assignee values of a task.
* **Mechanism:** Iterates over the signal array using `map()`.
  ```typescript
  this.tasks.update(tasks =>
    tasks.map(t => {
      if (t.id === taskId) {
        const updated = { ...t, status };
        if (assignedTo !== undefined) updated.assignedTo = assignedTo;
        return updated;
      }
      return t;
    })
  );
  ```

### `addProposal(proposal: Omit<Proposal, 'id'>): Proposal`
* **Logical Action:** Adds a new proposal record with an ID prefixed with `pr`.
* **Mechanism:** Updates using the array spread operator (`...`). Returns the new proposal.
  ```typescript
  const newId = 'pr' + (this.proposals().length + 1);
  const newProp = { ...proposal, id: newId };
  this.proposals.update(props => [...props, newProp]);
  return newProp;
  ```

### `updateProposalStatus(propId: string, status: 'Draft' | 'Sent' | 'Confirmed' | 'Rejected'): void`
* **Logical Action:** Updates the status enum of a proposal.
* **Mechanism:** Maps over the signal array to match the ID.
  ```typescript
  this.proposals.update(props =>
    props.map(p => p.id === propId ? { ...p, status } : p)
  );
  ```

### `addDeal(deal: Omit<Deal, 'id'>): Deal`
* **Logical Action:** Appends a new CRM Deal with a string ID prefixed with `d`.
* **Mechanism:** Appends via array expansion. Returns the new deal.
  ```typescript
  const newId = 'd' + (this.deals().length + 1);
  const newDeal = { ...deal, id: newId };
  this.deals.update(dList => [...dList, newDeal]);
  return newDeal;
  ```

### `updateDealStage(dealId: string, stage: DealStage): void`
* **Logical Action:** Updates the stage enum of a deal.
* **Mechanism:** Maps over the deals signal.
  ```typescript
  this.deals.update(deals =>
    deals.map(d => d.id === dealId ? { ...d, stage } : d)
  );
  ```

### `addPurchaseOrder(po: Omit<PurchaseOrder, 'id'>): PurchaseOrder`
* **Logical Action:** Records a new vendor Purchase Order with an ID prefixed with `po`.
* **Mechanism:** Updates using array expansion. Returns the new object.
  ```typescript
  const newId = 'po' + (this.purchaseOrders().length + 1);
  const newPo = { ...po, id: newId };
  this.purchaseOrders.update(pos => [...pos, newPo]);
  return newPo;
  ```

### `updatePurchaseOrderStatus(poId: string, status: 'Draft' | 'Sent' | 'Delivered' | 'Invoiced', deliveryDate?: string): void`
* **Logical Action:** Updates the status and optional delivery date of a vendor Purchase Order.
* **Mechanism:** Map-updates matching records.
  ```typescript
  this.purchaseOrders.update(pos =>
    pos.map(po => {
      if (po.id === poId) {
        const updated = { ...po, status };
        if (deliveryDate) updated.deliveryDate = deliveryDate;
        return updated;
      }
      return po;
    })
  );
  ```

### `addInvoice(invoice: Omit<Invoice, 'id'>): Invoice`
* **Logical Action:** Generates a new Customer/Vendor Invoice with an ID prefixed with `i`.
* **Mechanism:** Updates using array expansion. Returns the new invoice.
  ```typescript
  const newId = 'i' + (this.invoices().length + 1);
  const newInv = { ...invoice, id: newId };
  this.invoices.update(invs => [...invs, newInv]);
  return newInv;
  ```

### `updateInvoiceStatus(invoiceId: string, status: InvoiceStatus): void`
* **Logical Action:** Alters the payment status of an invoice.
* **Mechanism:** Map-updates matching invoice records.
  ```typescript
  this.invoices.update(invs =>
    invs.map(i => i.id === invoiceId ? { ...i, status } : i)
  );
  ```

### `resetWalkthrough(): void`
* **Logical Action:** Resets the step index to `0` and restores the standard mock structures.
* **Mechanism:** Modifies the values of `walkthroughStep`, `partners`, `tasks`, `proposals`, `deals`, `purchaseOrders`, and `invoices` via direct `.set()` operations.

---

## 4. Component-to-Framework Binding Audit

The components link their TypeScript logic classes to HTML user interfaces via the following framework bindings:

### A. Service Injection and Signal Execution
* **Injection Pattern:** Standard standalone components inject the central state engine by calling Angular's functional injector at class construction:
  ```typescript
  state = inject(CrmStateService);
  ```
* **Signal Consumption:** Component templates read signal data by invoking the signal reference as a function. This automatically links the component's change-detection cycle to signal changes:
  * e.g., in `sales.component.ts`: `state.deals()`, `state.proposals()`, `state.tasks()`.
  * e.g., in `partners.component.ts`: `state.customers().length`, `state.prospects().length`.
  * e.g., in `finance.component.ts`: `state.customerInvoices()`, `state.overdueInvoices()`.

### B. Angular Control Flow
The components utilize Angular's control flow syntax for templating:

1. **Conditional Rendering (`@if`):**
   * **Wizard Panel Shell (`src/app/app.ts`):** `@if (isWizardOpen()) { ... }` handles the visibility of the scenario sidebar.
   * **Forms/Modals Toggle:** Used for modal overlays:
     * `PartnersComponent`: `@if (showCreateModal()) { ... }`
     * `SalesComponent`: `@if (assignModalOpen()) { ... }`, `@if (proposalModalOpen()) { ... }`, `@if (dealModalOpen()) { ... }`, etc.
     * `TicketsComponent`: `@if (modalOpen()) { ... }`
     * `FinanceComponent`: `@if (invoiceModalOpen()) { ... }`
   * **Empty State Messages:** Used with `@empty` inside loops or direct conditional checks (e.g. `@if (deal.emailExchange) { ... }`).
2. **List Iterations (`@for` with `track`):**
   * **KPIs Rendering (`DashboardComponent`):** `@for (kpi of availableKpis; track kpi.id) { ... }` maps layout buttons.
   * **Partner Listings (`PartnersComponent`):** `@for (partner of filteredPartners(); track partner.id) { ... } @empty { ... }` structures dynamic grids.
   * **Sub-tabs (`SalesComponent`):** Renders collections of deals, proposals, tasks, or purchase orders using specific keys:
     * `@for (deal of state.deals(); track deal.id)`
     * `@for (prop of state.proposals(); track prop.id)`
     * `@for (task of state.tasks(); track task.id)`
     * `@for (po of state.purchaseOrders(); track po.id)`
   * **Dynamic Forms (`CustomerCardComponent`):** Loops address collections and contact arrays:
     * `@for (addr of form().addresses; track addr.id; let i = $index)`
     * `@for (person of form().personnel; track person.id; let i = $index)`
3. **Template Variables (`@let`):**
   * Declares inline template variables to compute values:
     * `partners.component.ts`: `@let partnerInvoices = getPartnerInvoices(partner.id);`
     * `sales.component.ts`: `@let partnerInvoices = getPartnerInvoices(partner.id);`
     * `app.ts`: `@let currentStep = state.steps[state.walkthroughStep()];`

---

## 5. Mock Data Structure & Business Domain

The business domain logic relies on specific TypeScript types, enums, interfaces, and relations:

### A. Core Types and Enums
* `PartnerType = 'Customer' | 'Prospect' | 'Vendor'`
* `TaskStatus = 'Pending' | 'In Progress' | 'Completed'`
* `DealStage = 'New' | 'Proposal sent' | 'Confirmed' | 'Awaiting Invoicing' | 'Invoiced' | 'Closed Won' | 'Closed Lost'`
* `InvoiceStatus = 'Pending' | 'Paid' | 'Overdue' | 'Draft'`
* `CampaignType = 'WhatsApp' | 'SMS' | 'Email'`
* `TicketStatus = 'Open' | 'In Progress' | 'Resolved' | 'Closed'`
* `RecordType = 'Organization' | 'Individual'`
* `OrgType = 'Headquarter' | 'Subsidiary' | 'Branch'`
* `AddressType = 'Siège Social / Fiscal' | 'Delivery' | 'Warehouse' | 'Billing'`
* `VatStatus = 'Standard' | 'No VAT' | 'Export Trade'`

### B. Interface Schemas & Relations
All domain models are typed as TypeScript interfaces:

#### `Partner`
Defines standard entities (customers, prospects, vendors):
* `id: string` (Primary Key)
* `name: string`
* `type: PartnerType`
* `email?: string`
* `phone?: string`
* `comments?: string`
* `city?: string`

#### `CustomerCard`
Extends `Partner` data with legal/tax attributes for the Moroccan commercial environment (relates to a `Partner` via `partnerId`):
* `id: string` (Primary Key)
* `partnerId: string` (Foreign Key -> Partner.id)
* `accountId: string`
* `recordType: RecordType`
* `name: string`
* `searchName: string`
* `erpAccount: string`
* `ice: string` (validated as a 15-digit string representing *Identifiant Commun de l'Entreprise*)
* `ifField: string` (*Identifiant Fiscal*)
* `rc: string` (*Registre de Commerce*)
* `rcCity: string` (city representing where the commercial registry is recorded)
* `tp: string` (*Taxe Professionnelle*)
* `vatStatus: VatStatus[]`
* `orgType: OrgType`
* `parentAccountId: string | null` (self-referencing parent Account ID for corporate hierarchies)
* `addresses: CustomerAddress[]`
* `mainPhone: string`
* `corporateEmail: string`
* `websiteUrl: string`
* `personnel: CustomerPersonnel[]`

#### `CustomerAddress`
Encapsulates localized physical addresses:
* `id: string` (Primary key)
* `addressType: AddressType`
* `streetAddress: string`
* `industrialZone: string` (*Zone Industrielle* tracking)
* `postalCode: string`
* `city: string`
* `isPrimary: boolean`

#### `CustomerPersonnel`
Represents contacts inside corporate organizations:
* `id: string`
* `fullName: string`
* `jobTitle: string`
* `directMobile: string`
* `directEmail: string`
* `isPrimary: boolean`

#### `Task`
Describes standard operational tasks. Can relate to entities polymorphically:
* `id: string` (Primary Key)
* `title: string`
* `description?: string`
* `assignedTeam?: 'Sales' | 'Operations' | 'Finance' | 'Support'`
* `assignedTo?: string`
* `status: TaskStatus`
* `relatedTo?: string` (polymorphic relationship, e.g. Partner name, Proposal ID, or Deal title)

#### `Proposal`
Pre-sales proposals (relates to a `Partner` via `partnerId`):
* `id: string` (Primary Key)
* `title: string`
* `partnerId: string` (Foreign Key -> Partner.id, expected type `'Prospect'`)
* `amount: number`
* `status: 'Draft' | 'Sent' | 'Confirmed' | 'Rejected'`
* `templateId?: string` (Foreign Key -> ProposalTemplate.id)
* `lines: ProposalLine[]`

#### `ProposalLine`
Individual line items inside pre-sales proposals or sales order lines:
* `product: string`
* `description: string`
* `qty: number`
* `unitPrice: number`
* `total: number`
* `vendor?: string`

#### `ProposalTemplate`
Defines template layouts for proposals:
* `id: string` (Primary Key)
* `name: string`
* `subject: string`
* `body: string`
* `lines: ProposalLine[]`

#### `Deal`
Sales operations representing confirmed orders (relates to a `Partner` via `partnerId` and inherits from a `Proposal` via `proposalId`):
* `id: string` (Primary Key)
* `title: string`
* `partnerId: string` (Foreign key -> Partner.id, expected type `'Customer'`)
* `amount: number`
* `stage: DealStage`
* `comments?: string`
* `proposalId?: string` (Foreign Key -> Proposal.id)
* `orderLines?: ProposalLine[]`
* `discount?: number`
* `emailExchange?: string`
* `estimatedDeliveryDate?: string`
* `orderNumber?: string`
* `dealNumber?: string`
* `orderDate?: string`
* `requestedDeliveryDate?: string`
* `orderStatus?: string`
* `customerAccount?: string`
* `billingAddress?: string`
* `deliveryAddress?: string`
* `contactPerson?: string`
* `contactEmail?: string`
* `contactPhone?: string`
* `salesPerson?: string`
* `salesRegion?: string`
* `currency?: string`
* `paymentTerms?: string`
* `orderTotalAmount?: number`
* `vendorAccount?: string`
* `purchaseOrderRef?: string`
* `warehouseAddress?: string`
* `transportationService?: string`
* `expectedDeliveryDateVendor?: string`
* `deliveryDate?: string`

#### `PurchaseOrder`
Outbound request sent to vendors (relates to a `Deal` via `dealId` and a `Partner` via `vendorId`):
* `id: string` (Primary Key)
* `dealId: string` (Foreign Key -> Deal.id)
* `vendorId: string` (Foreign Key -> Partner.id, expected type `'Vendor'`)
* `amount: number`
* `status: 'Draft' | 'Sent' | 'Delivered' | 'Invoiced'`
* `deliveryDate?: string`
* `lines: { product: string; qty: number; cost: number }[]`
* `sentVia?: string`

#### `Invoice`
Documents billing operations for customers or from vendors:
* `id: string` (Primary Key)
* `type: 'Customer' | 'Vendor'`
* `partnerId: string` (Foreign Key -> Partner.id)
* `amount: number`
* `status: InvoiceStatus`
* `dueDate: string`
* `dealId?: string` (Foreign Key -> Deal.id, null for vendor invoices)
* `purchaseOrderId?: string` (Foreign Key -> PurchaseOrder.id, null for customer invoices)

#### `Campaign`
Outbound marketing campaigns:
* `id: string` (Primary Key)
* `title: string`
* `type: CampaignType`
* `status: 'Draft' | 'Active' | 'Completed'`
* `targetAudience: string`
* `sentCount: number`

#### `Ticket`
Support requests (relates to a `Partner` via `partnerId`):
* `id: string` (Primary Key)
* `title: string`
* `partnerId: string` (Foreign key -> Partner.id)
* `assignedTo: string` (Foreign Key -> User name)
* `status: TicketStatus`
* `priority: 'Low' | 'Medium' | 'High'`

### C. Gaps and Missing Structures
* **`CreditNote` Interface:** Referenced in `implementaion-plan.md` but is **absent from the code** (`crm-state.service.ts` does not define `CreditNote`, and no matching signal or UI tab exists).
* **`Campaign` Template Link:** The models do not define an explicit template relationship. `Campaign` contains no `templateId` property.
* **`Address` / `Personnel` references in `Partner`:** The `Partner` interface itself does not reference `CustomerAddress` or `CustomerPersonnel` arrays. These reside exclusively inside the `CustomerCard` entity.
