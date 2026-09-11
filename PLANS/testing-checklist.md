# Testing Checklist - Domain Services Refactoring

**Date:** August 9, 2026  
**Purpose:** Verify all refactored components work correctly with domain services

---

## Pre-Testing Setup

### Environment Checklist
- [ ] Start Angular dev server: `npm start` or `ng serve`
- [ ] Start backend: Spring Boot server on port 8080
- [ ] Open browser DevTools (F12)
- [ ] Open Network tab to monitor API calls
- [ ] Open Console tab to check for errors
- [ ] Clear browser cache and local storage

### Database/API Checklist
- [ ] Backend database is running (PostgreSQL)
- [ ] Redis cache is running
- [ ] All migrations have run (`ddl-auto: validate` should pass)
- [ ] Seed data has loaded
- [ ] API health check: `GET /api/v1/actuator/health` returns `{"status":"UP"}`

---

## Component Testing (Per Component)

### General Pattern for Each Component

#### 1. Initial Load
- [ ] Component loads without errors in browser
- [ ] No error messages in console
- [ ] No "undefined" values in template
- [ ] Loading spinner appears briefly
- [ ] Data appears in list/table after loading

**Verify in Network Tab:**
- [ ] API call made to fetch data (e.g., `GET /api/v1/deals`)
- [ ] Response status is 200
- [ ] Response contains array of objects with correct structure
- [ ] Only ONE API call (not duplicated)

#### 2. Loading State
- [ ] Refresh page while data is loading
- [ ] Loading spinner appears
- [ ] User cannot interact with list while loading
- [ ] Once loaded, spinner disappears
- [ ] Data displays correctly

#### 3. Error Handling
- [ ] Stop backend server
- [ ] Refresh component or navigate to it
- [ ] Error message appears (red banner)
- [ ] Error message is user-friendly
- [ ] Loading spinner disappears
- [ ] List remains empty or shows previous data
- [ ] Start backend again
- [ ] Error message disappears after retry (if auto-retry implemented)
- [ ] Data reloads successfully

#### 4. Data Display
- [ ] All columns/fields display correctly
- [ ] Data types are correct (numbers, dates, booleans)
- [ ] Currency formats correctly (if applicable)
- [ ] Dates format correctly
- [ ] Text truncation/wrapping looks right
- [ ] No "null" or "undefined" displayed

#### 5. Caching (No Duplicate API Calls)
- [ ] Navigate to component and let it load
- [ ] Count API calls in Network tab (should be 1)
- [ ] Navigate away from component
- [ ] Navigate back to component
- [ ] Verify NO new API call is made (data is cached)
- [ ] Close browser tab completely
- [ ] Reopen tab and navigate to component
- [ ] API call is made (new session)

#### 6. Create Operation
- [ ] Click "Create" or "New" button
- [ ] Modal/form opens without errors
- [ ] Form has all expected fields
- [ ] Form validation works (required fields marked)
- [ ] Fill form with valid test data
- [ ] Click Save/Submit button
- [ ] Form submits without errors

**Verify in Network Tab:**
- [ ] POST request made to correct endpoint
- [ ] Request body contains all form data
- [ ] Response status is 201 (CREATED) or 200 (OK)
- [ ] Response contains created object with new ID

**UI Verification:**
- [ ] Modal closes
- [ ] Success toast appears with confirmation message
- [ ] New item appears in list immediately
- [ ] New item is at top or bottom of list (depending on sort)
- [ ] Item shows all entered data correctly

#### 7. Update Operation
- [ ] Click Edit button on an existing item
- [ ] Form/modal opens with current data populated
- [ ] All fields pre-filled with existing values
- [ ] Modify at least 2 fields
- [ ] Click Save button

**Verify in Network Tab:**
- [ ] PATCH or PUT request made
- [ ] Request contains only modified fields (or all fields)
- [ ] Response status is 200 (OK)
- [ ] Response contains updated object

**UI Verification:**
- [ ] Modal closes
- [ ] Success toast appears
- [ ] List updates with new values
- [ ] Updated item reflects changes immediately

#### 8. Delete Operation
- [ ] Click Delete button on an item
- [ ] Confirmation dialog appears
- [ ] Dialog warns about permanent deletion
- [ ] Click Cancel → modal closes, no change
- [ ] Click Delete button again, confirm deletion

**Verify in Network Tab:**
- [ ] DELETE request made
- [ ] Response status is 204 (NO CONTENT) or 200

**UI Verification:**
- [ ] Item disappears from list
- [ ] Success toast appears with "deleted" message
- [ ] Undo button visible in toast
- [ ] Click Undo → item reappears in list (optimistic revert)
- [ ] Item stays after undo (not deleted from server)

#### 9. Sorting & Filtering
- [ ] Click column header to sort (if applicable)
- [ ] List re-sorts without API call
- [ ] Click sort again to reverse order
- [ ] Sorting state persists if navigating away and back
- [ ] Use filter controls (if applicable)
- [ ] List filters without API call
- [ ] Filter state clears when navigating away

#### 10. Pagination (if implemented)
- [ ] List shows correct number of items per page
- [ ] Click Next page button
- [ ] New items appear
- [ ] Page number updates
- [ ] Click Previous → back to previous page
- [ ] Jump to specific page (if input available)
- [ ] Navigate away and back → pagination resets

#### 11. Responsive Design
- [ ] Resize browser to mobile width (375px)
- [ ] Layout adapts correctly
- [ ] No horizontal scroll
- [ ] Buttons/controls still clickable
- [ ] Table converts to mobile view or scrolls appropriately
- [ ] Resize to tablet (768px)
- [ ] Resize back to desktop (1280px)

#### 12. Keyboard Navigation
- [ ] Tab through form fields
- [ ] Enter closes modal/saves form
- [ ] Escape closes modal without saving
- [ ] Arrow keys navigate list (if not supported, skip)

---

## Specific Component Tests

### 1. Sales Component

#### Deals Tab
- [ ] Load component → deals table appears
- [ ] Create deal:
  - [ ] Fill partner, amount, stage
  - [ ] Check deal appears in table
  - [ ] Verify partner name resolves correctly
  - [ ] Check created timestamp
- [ ] Update deal:
  - [ ] Edit stage from table
  - [ ] Change amount
  - [ ] Verify list updates
- [ ] Delete deal:
  - [ ] Delete deal from table
  - [ ] Verify undo works
  - [ ] Click undo → deal reappears

#### Proposals Tab
- [ ] Switch to Proposals tab
- [ ] Same CRUD tests as Deals
- [ ] Verify partner linking works

#### Purchase Orders Tab
- [ ] Switch to POs tab
- [ ] Same CRUD tests as Deals
- [ ] Verify vendor/partner correctly linked

#### Cross-Domain Test
- [ ] Create deal with partner X
- [ ] Switch to Partners tab
- [ ] Verify partner X appears in partners list
- [ ] Modify partner in Partners tab
- [ ] Switch back to Sales → deal still shows updated partner info

### 2. Partners Component

#### Leads/Customers/Prospects/Vendors Tabs
- [ ] Each tab shows correct filtered data
- [ ] Switching tabs doesn't reload data (cached)
- [ ] Create partner in each tab
- [ ] Update partner properties
- [ ] Delete partner and verify undo

#### Partner Details
- [ ] Click partner to view details
- [ ] Edit partner profile
- [ ] Save changes
- [ ] Verify changes persist

### 3. Tasks Component

#### List View
- [ ] Tasks display in table/kanban (depending on view)
- [ ] Status filter works (TODO, IN_PROGRESS, DONE, BLOCKED)
- [ ] Priority filter works (URGENT, MEDIUM, LOW)
- [ ] Assigned user filter works

#### Create Task
- [ ] Create task with all fields:
  - [ ] Title (required)
  - [ ] Description
  - [ ] Assigned to user
  - [ ] Due date
  - [ ] Priority
  - [ ] Related entity
- [ ] Verify task appears in list

#### Update Task
- [ ] Change status (if kanban view, drag between columns)
- [ ] Change priority
- [ ] Change assigned user
- [ ] Change due date
- [ ] Verify updates save

#### Delete Task
- [ ] Delete task
- [ ] Verify undo works

### 4. Tickets Component

#### List View
- [ ] Tickets display in table
- [ ] Status filter (OPEN, IN_PROGRESS, RESOLVED, CLOSED)
- [ ] Type filter (Software issue, Broken product, Billing issue)
- [ ] Priority filter (URGENT, MEDIUM, LOW)

#### Create Ticket
- [ ] Create with all fields
- [ ] Verify in list

#### Update Ticket
- [ ] Change status
- [ ] Change priority
- [ ] Assign to user
- [ ] Add notes/comments
- [ ] Verify updates save

#### Resolve Ticket
- [ ] Change status to RESOLVED
- [ ] Verify status updates in list

### 5. Finance Component

#### Invoices Tab
- [ ] Invoices display with amounts
- [ ] Currency formats correctly
- [ ] Payment status shows correctly (DRAFT, SENT, PAID, OVERDUE)
- [ ] Create invoice:
  - [ ] Select partner
  - [ ] Enter amount and due date
  - [ ] Verify in list
- [ ] Mark invoice as paid:
  - [ ] Change status to PAID
  - [ ] Verify update
- [ ] Delete invoice:
  - [ ] Verify undo works

#### Purchase Orders Tab
- [ ] POs display correctly
- [ ] Delivery status shows (DRAFT, SENT, RECEIVED, etc.)
- [ ] Create PO:
  - [ ] Select vendor/partner
  - [ ] Enter amount and delivery date
  - [ ] Verify in list
- [ ] Update delivery status
- [ ] Delete PO with undo

### 6. Marketing Component

#### Campaigns List
- [ ] Campaigns display
- [ ] Status shows (DRAFT, RUNNING, COMPLETED, CANCELLED)
- [ ] Channel shows (Email, SMS, Social, etc.)

#### Create Campaign
- [ ] Create campaign with all fields
- [ ] Verify in list

#### Launch Campaign
- [ ] Change status to RUNNING
- [ ] Verify status updates

#### Delete Campaign
- [ ] Delete campaign
- [ ] Verify undo works

### 7. Automation Component

#### Rules List
- [ ] Rules display
- [ ] Active/Inactive toggle shows correctly

#### Create Rule
- [ ] Create automation rule with:
  - [ ] Name
  - [ ] Trigger (event/condition)
  - [ ] Actions
- [ ] Verify in list

#### Toggle Rule
- [ ] Click toggle to enable/disable rule
- [ ] Verify status updates

#### Delete Rule
- [ ] Delete rule
- [ ] Verify undo works

---

## Integration Tests (Cross-Component)

### Sales to Partners Flow
- [ ] Create deal in Sales
- [ ] Linked partner appears in Partners component
- [ ] Edit partner name in Partners
- [ ] Return to Sales → deal shows updated partner name

### Deals to Tasks Flow
- [ ] Create deal in Sales
- [ ] Create task in Tasks with relation to deal
- [ ] Task shows correct deal reference
- [ ] Edit deal → task still references correct deal

### All CRUD Workflows
- [ ] Create item in one component
- [ ] Read item in same component
- [ ] Update item from component
- [ ] Delete item with undo verification

---

## Performance Tests

### API Call Verification
- [ ] Open Network tab
- [ ] Navigate to Sales component
- [ ] Verify ONLY 4 API calls made (deals, partners, proposals, pos)
- [ ] Not 5, 6, or more (no duplicates)
- [ ] Response times are < 500ms for each

### No Memory Leaks
- [ ] Open DevTools Memory tab
- [ ] Take initial snapshot
- [ ] Navigate to component
- [ ] Wait for data to load
- [ ] Navigate away from component
- [ ] Trigger garbage collection (trash icon)
- [ ] Take another snapshot
- [ ] Compare snapshots (should be similar, not growing)

### Caching Verification
- [ ] Load Sales component (observe 4 API calls)
- [ ] Close Sales panel
- [ ] Reopen Sales component (observe 0 new API calls)
- [ ] Refresh page (observe 4 new API calls - fresh session)

---

## Browser Compatibility

Test in multiple browsers (if time permits):
- [ ] Chrome/Chromium (primary)
- [ ] Firefox (if available)
- [ ] Safari (if on Mac)
- [ ] Edge (if available)

---

## Error Scenarios

### Network Failures
- [ ] Stop backend
- [ ] Try to create/update/delete
- [ ] Verify error message appears
- [ ] Verify operation doesn't complete
- [ ] Start backend
- [ ] Retry operation
- [ ] Verify success

### Invalid Data
- [ ] Try to create with missing required fields
- [ ] Form validation prevents submit
- [ ] Try to create with invalid email
- [ ] Validation message appears
- [ ] Try to enter negative number in amount field
- [ ] Validation prevents or shows warning

### Concurrent Operations
- [ ] Open same component in two browser windows
- [ ] Create item in window 1
- [ ] Refresh in window 2
- [ ] Verify new item appears
- [ ] Edit item in window 1
- [ ] Refresh in window 2
- [ ] Verify changes appear

---

## Final Sign-Off Checklist

- [ ] All 7 components tested and working
- [ ] No TypeScript errors in console
- [ ] No JavaScript errors in console
- [ ] No network errors (404, 500, etc.)
- [ ] All CRUD operations work correctly
- [ ] Loading states display properly
- [ ] Error states display properly
- [ ] Caching prevents duplicate API calls
- [ ] Undo functionality works
- [ ] UI is responsive
- [ ] Performance is acceptable
- [ ] No memory leaks detected
- [ ] Cross-component data integrity verified

---

## Regression Testing

### Existing Features That Should Still Work
- [ ] User login/logout still works
- [ ] Navigation between pages works
- [ ] Route guards prevent unauthorized access
- [ ] Role-based access control still enforced
- [ ] Organization settings accessible
- [ ] User profile editing works
- [ ] Dashboard displays (if tested)
- [ ] Analytics displays (if tested)

---

## Sign-Off

- [ ] All tests passed
- [ ] No blockers found
- [ ] Ready for staging deployment

**Tester Name:** _______________  
**Date:** _______________  
**Notes:** 

```
(Use this space for any issues, observations, or recommendations)
```

---

## Issues Found (if any)

### Issue Template
```
**Issue #1:**
- Component: [which component]
- Severity: [critical/high/medium/low]
- Description: [what's wrong]
- Steps to Reproduce: [how to see it]
- Expected Behavior: [what should happen]
- Actual Behavior: [what actually happens]
- Environment: [browser, OS, backend status]
- Screenshot: [if applicable]
```
