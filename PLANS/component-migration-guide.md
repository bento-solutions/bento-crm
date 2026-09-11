# Component Migration Guide: From CrmStateService to Domain Services

This guide shows how to migrate Angular components from the monolithic `CrmStateService` to the new per-domain services.

---

## Overview

### Old Pattern (Monolithic)
```typescript
export class SalesComponent {
  constructor(private crm: CrmStateService) {}
  
  deals = computed(() => this.crm.deals());
  dealsLoading = computed(() => this.crm.dealsLoading());
  
  ngOnInit() {
    this.crm.loadDeals(); // Indirect call through god-service
  }
  
  addDeal(deal: any) {
    this.crm.addDeal(deal); // All state management in one place
  }
}
```

### New Pattern (Domain-Focused)
```typescript
export class SalesComponent {
  constructor(private deals: DealsService) {}
  
  deals$ = this.deals.allDeals; // Computed signal
  isLoading$ = this.deals.isLoading$; // Loading state
  error$ = this.deals.error$; // Error state
  
  ngOnInit() {
    this.deals.load(); // Direct call to domain service
  }
  
  addDeal(deal: Partial<Deal>) {
    this.deals.addDeal(deal); // Clear domain responsibility
  }
}
```

---

## Step-by-Step Migration

### 1. Update Imports
**Before:**
```typescript
import { CrmStateService } from '../services/crm-state.service';
```

**After:**
```typescript
import { DealsService, PartnersService, TasksService } from '../services/domains';
```

### 2. Update Constructor
**Before:**
```typescript
constructor(private crm: CrmStateService) {}
```

**After:**
```typescript
constructor(
  private deals: DealsService,
  private partners: PartnersService,
  private tasks: TasksService
) {}
```

### 3. Update Data Signals
**Before:**
```typescript
deals = computed(() => this.crm.deals());
partners = computed(() => this.crm.partners());
```

**After:**
```typescript
deals = this.deals.allDeals; // Already a computed signal
partners = this.partners.allPartners;
```

### 4. Update Loading/Error States
**Before:**
```typescript
dealsLoading = computed(() => this.crm.dealsLoading());
dealsError = computed(() => this.crm.dealsError());
```

**After:**
```typescript
isLoading$ = this.deals.isLoading$;
error$ = this.deals.error$;
```

### 5. Update ngOnInit
**Before:**
```typescript
ngOnInit() {
  this.crm.loadDeals();
  this.crm.loadPartners();
}
```

**After:**
```typescript
ngOnInit() {
  this.deals.load();
  this.partners.load();
}
```

### 6. Update CRUD Methods
**Before:**
```typescript
addDeal(deal: any) {
  this.crm.addDeal(deal);
}
```

**After:**
```typescript
addDeal(deal: Omit<Deal, 'id' | 'createdAt' | 'updatedAt'>) {
  this.deals.addDeal(deal);
}
```

### 7. Update Templates
**Before:**
```html
<div *ngIf="dealsLoading()">Loading...</div>
<div *ngIf="dealsError()">{{ dealsError() }}</div>
<div *ngFor="let deal of deals()">{{ deal.title }}</div>
```

**After:**
```html
<div *ngIf="isLoading$() | async">Loading...</div>
<div *ngIf="error$() | async as err">{{ err }}</div>
<div *ngFor="let deal of (deals$ | async)">{{ deal.title }}</div>
```

---

## Component-by-Component Migration Checklist

### High Priority (Core Workflows)

#### ❌ sales.component.ts (CRITICAL - largest, touches many services)
- [ ] Replace CrmStateService with DealsService, PartnersService, ProposalsService, PurchaseOrdersService
- [ ] Update load calls in ngOnInit
- [ ] Update CRUD calls (addDeal, updateDeal, etc.)
- [ ] Update template bindings for deals, partners, proposals, POs
- [ ] Test deal creation/update/deletion flows
- [ ] Verify proposal workflow
- [ ] Test purchase order integration

#### ❌ partners.component.ts
- [ ] Replace with PartnersService
- [ ] Update load and CRUD calls
- [ ] Update template bindings

#### ❌ tasks.component.ts
- [ ] Replace with TasksService
- [ ] Update load and CRUD calls
- [ ] Update template bindings

#### ❌ tickets.component.ts
- [ ] Replace with TicketsService
- [ ] Update load and CRUD calls
- [ ] Update template bindings

#### ❌ finance.component.ts (invoices, purchase orders)
- [ ] Inject InvoicesService, PurchaseOrdersService
- [ ] Update load and CRUD calls
- [ ] Update template bindings

### Medium Priority (Secondary Workflows)

#### ❌ marketing.component.ts
- [ ] Replace with CampaignsService
- [ ] Update load and CRUD calls
- [ ] Update template bindings

#### ❌ automation.component.ts
- [ ] Replace with AutomationRulesService
- [ ] Update load and CRUD calls
- [ ] Update template bindings

#### ❌ dashboard.component.ts
- [ ] Keep minimal access, use domain services for any data
- [ ] Consider if it needs to show live data or aggregates

### Low Priority (Settings/Admin)

#### ❌ users.component.ts
- [ ] Keep using CrmStateService.users (don't change yet)
- [ ] Or create UsersService if needed

#### ❌ teams.component.ts
- [ ] Keep using CrmStateService.teams (don't change yet)

#### ❌ groups.component.ts
- [ ] Keep using CrmStateService.groups (don't change yet)

---

## Loading/Error UI Pattern

Add to each component that loads data:

```typescript
isLoading$ = computed(() => this.service.isLoading$());
error$ = computed(() => this.service.error$());

showLoadingSpinner = computed(() => {
  const loading = this.isLoading$();
  const data = this.data$();
  return loading && (!data || data.length === 0); // Only show on first load
});

showError = computed(() => {
  const error = this.error$();
  const loading = this.isLoading$();
  return error && !loading; // Show error only when not loading
});
```

In template:

```html
<!-- Loading State -->
<div *ngIf="showLoadingSpinner()" class="loading-spinner">
  <mat-spinner></mat-spinner>
  <p>Loading data...</p>
</div>

<!-- Error State -->
<mat-alert *ngIf="showError()" type="error">
  {{ error$() }}
</mat-alert>

<!-- Content (with cached data fallback) -->
<div *ngIf="!showLoadingSpinner()">
  <!-- show data -->
</div>
```

---

## Testing Checklist Per Component

1. **Load Data:**
   - [ ] Verify `load()` is called in ngOnInit
   - [ ] Verify data appears in table/list
   - [ ] Verify loading spinner shown during fetch
   - [ ] Verify no duplicate API calls (caching works)

2. **Create:**
   - [ ] Click create button
   - [ ] Fill form and submit
   - [ ] Verify new item appears in list
   - [ ] Verify success toast shown

3. **Update:**
   - [ ] Click edit button
   - [ ] Modify data and submit
   - [ ] Verify list updates
   - [ ] Verify success toast shown

4. **Delete:**
   - [ ] Click delete button
   - [ ] Confirm deletion
   - [ ] Verify item removed from list
   - [ ] Verify undo toast available
   - [ ] Test undo functionality

5. **Error Handling:**
   - [ ] Stop backend temporarily
   - [ ] Verify error message displays
   - [ ] Verify operation reverts
   - [ ] Verify error toast shown

6. **Concurrent Operations:**
   - [ ] Have two browser windows open
   - [ ] Create item in one window
   - [ ] Verify it appears in the other window's list (may need reload)
   - [ ] Update same item in both windows and verify behavior

---

## Gradual Migration Strategy

### Phase 1: Sales Module (1-2 days)
- Migrate sales.component.ts to use DealsService, PartnersService, ProposalsService, PurchaseOrdersService
- Test all deal/partner/proposal/PO workflows
- This is the most complex, sets pattern for others

### Phase 2: Support & Tasks (1 day)
- Migrate tickets.component.ts to TicketsService
- Migrate tasks.component.ts to TasksService
- Test workflows

### Phase 3: Finance (1 day)
- Migrate finance.component.ts to InvoicesService, PurchaseOrdersService
- Test invoice and PO workflows

### Phase 4: Marketing & Automation (½ day)
- Migrate marketing.component.ts to CampaignsService
- Migrate automation.component.ts to AutomationRulesService

### Phase 5: Deprecate CrmStateService (1 day)
- Once all components migrated, remove business domain logic from CrmStateService
- Keep only auth/org state if needed
- Or create separate AuthService, OrgService

---

## Common Pitfalls

❌ **Don't:** Access other domain's signals directly
```typescript
// BAD - Cross-domain dependency
deals = computed(() => this.deals.deals());
partners = computed(() => this.partners.partners()); // Reading another service's signal in a computed
```

✅ **Do:** Each component manages its own domain
```typescript
// GOOD - Each service manages its domain
deals = this.deals.allDeals;
partners = this.partners.allPartners;
```

---

❌ **Don't:** Call load() from computed or effect
```typescript
// BAD - Infinite loop risk
effect(() => {
  this.deals.load(); // Called on every render
});
```

✅ **Do:** Call load() once in ngOnInit
```typescript
// GOOD - Called once at component init
ngOnInit() {
  this.deals.load();
}
```

---

❌ **Don't:** Mix CrmStateService and domain services in same component
```typescript
// BAD - Confusing, maintains old pattern
constructor(private crm: CrmStateService, private deals: DealsService) {}
```

✅ **Do:** Use domain services exclusively
```typescript
// GOOD - Clear responsibility
constructor(private deals: DealsService, private partners: PartnersService) {}
```

---

## Files to Migrate (Approximate Order)

**High Priority:**
1. sales.component.ts
2. partners.component.ts
3. finance.component.ts

**Medium Priority:**
4. tickets.component.ts
5. tasks.component.ts
6. marketing.component.ts
7. automation.component.ts

**Low Priority:**
8. users.component.ts (keep CrmStateService or create UsersService)
9. teams.component.ts (keep CrmStateService)
10. groups.component.ts (keep CrmStateService)
11. dashboard.component.ts (mostly read-only display)
