# Implementation Plan - Workflow Automation System

This implementation plan outlines the introduction of a custom **Workflow Automation** module. The system will enable users to automate repetitive tasks based on simple conditional rules (IF/AND/OR conditions mapped to actions like lead assignment, sending email logs, task creation, deal notifications, etc.).

## User Review Required

> [!IMPORTANT]
> - **Execution Context**: This plan is created in the `PLANS` folder as requested and will **not** be executed immediately, matching your request to let another LLM audit it first.
> - **Simulated Actions**: Since there is no actual SMTP mail server or external Slack/SMS webhook integrated, actions like "Send welcome email" or "Notify manager" will append entries to the existing logs within the state service (e.g. `activityLog.emails` or `tasks`) so that they are visible in the CRM interface.

## Proposed Changes

We plan to modify the state service to support user-defined rules and run an evaluation engine whenever relevant entities (Leads, Deals, Tickets, etc.) are created or updated. We will also build an Automation Management UI page to view, create, toggle, and delete rules.

---

### 1. Data Model & State Updates

#### [MODIFY] [crm-state.service.ts](file:///Users/ouajidachraf/Projects/crm/src/app/services/crm-state.service.ts)

We will define new interfaces for the workflow rules:

```typescript
export type AutomationTrigger = 'LeadCreated' | 'LeadUpdated' | 'DealCreated' | 'DealUpdated' | 'TicketCreated' | 'TicketUpdated';

export interface AutomationCondition {
  field: string;          // e.g. "customerAccount", "stage", "estimatedDealValue", "status"
  operator: 'equals' | 'notEquals' | 'contains' | 'greaterThan' | 'lessThan';
  value: string | number;
}

export interface AutomationRuleGroup {
  logicalOperator: 'AND' | 'OR';
  conditions: AutomationCondition[];
}

export type AutomationActionType = 
  | 'AssignSalesperson' 
  | 'CreateFollowUpTask' 
  | 'SendEmailLog' 
  | 'NotifyManager'; // Appends to activity logs or task list

export interface AutomationAction {
  type: AutomationActionType;
  params: {
    assignee?: string;      // salesperson or manager name
    taskTitle?: string;     // task details
    emailSubject?: string;
    emailBody?: string;
    targetTeam?: 'Sales' | 'Operations' | 'Finance' | 'Support';
  };
}

export interface AutomationRule {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  trigger: AutomationTrigger;
  
  // Rule Logic: Group 1 OR Group 2 OR Group 3 ... (each group contains ANDed conditions)
  conditionGroups: AutomationRuleGroup[]; 
  
  actions: AutomationAction[];
}
```

##### State Modifications:
- Add an `automationRules` signal with preloaded example rules (e.g., the "DIGITAL ABC" & "Initiated" / "Deal Created" -> "Assign Sales Tasks to Sales Person ABC" rule requested).
- Implement an execution engine `evaluateRules(trigger: AutomationTrigger, entity: any)` that:
  - Iterates through active rules matching the trigger.
  - Resolves nested logical operators (AND/OR groups of conditions).
  - Executes the actions (modifying signals like `tasks`, `leads`, `deals`, or appending to `activityLogs`).
- Hook `evaluateRules` into existing mutation operations such as `addLead`, `updateLead`, `addDeal`, `updateDeal`.

---

### 2. UI Components & Pages

#### [NEW] [automation.component.ts](file:///Users/ouajidachraf/Projects/crm/src/app/pages/automation.component.ts)

We will build a responsive and rich dashboard for automation rules:
- **KPI Cards**: Active Rules, Executions Count (simulation metric), Trigger Distribution, Task Automation Rate.
- **Rules list**: Display rule details, triggers, condition summaries, and toggles to enable/disable rules.
- **Visual Rule Builder**:
  - A multi-step form to create/edit rules.
  - Dropdown selectors for triggers (`LeadCreated`, `DealUpdated`, etc.).
  - Dynamic query builder to build AND/OR groups:
    - Field names dynamically loaded based on the trigger.
    - Standard operators.
  - Action builder to choose the action type and specify variables (assignee, task details, email contents).
- **Test Sandbox**: An interactive console inside the page allowing users to simulate triggering a rule on mock data to verify if conditions evaluate correctly before activation.

#### [MODIFY] [app.routes.ts](file:///Users/ouajidachraf/Projects/crm/src/app/app.routes.ts)
- Add the route `/automation` pointing to the new `AutomationComponent`.

#### [MODIFY] [app.ts](file:///Users/ouajidachraf/Projects/crm/src/app/app.ts)
- Add a new "Automation" navigation item in the sidebar / navigation bar with a gear or robotic automation icon.

---

## Verification Plan

### Automated Tests
To test the evaluation engine, we will add unit test cases in `src/app/services/crm-state.service.spec.ts` (or custom scratch scripts):
- Test logic matches for simple conditions.
- Test OR combination between different condition groups.
- Verify actions are properly executed: e.g., task added to the task list, or salesperson correctly updated on the lead.

### Manual Verification
1. Open the `/automation` page in the browser.
2. Verify that preloaded rules are shown.
3. Switch a rule on and off using the toggle switch.
4. Use the Rule Creator to add the rule:
   - **IF**: Customer account equals `DIGITAL ABC` AND Deal status equals `Initiated`
   - **OR**: Deal status equals `Deal Created`
   - **THEN**: Action = Create Follow Up Task / Assign salesperson.
5. Create/update a Deal matching the criteria and verify the task or assignment is automatically created/updated in the system logs or dashboard.


Executive Summary
The original plan is a solid first draft with good instincts: signals-based state, a visual rule builder, and a test sandbox are all the right calls. However, it has several architectural gaps that would cause real pain at scale: the evaluation engine is synchronous and in-memory (a problem the moment rules grow), the data model conflates condition logic with execution, action types are too narrow for a real CRM, and the UI plan skips the most critical UX concern in automation tools — explainability (why did this rule fire, or not?). The plan also has no versioning, no conflict resolution between rules, and no audit trail.
Below is the upgraded plan, organized by severity of gaps, then expanded specifications.

🔴 Critical Issues (Must Fix Before Implementation)
1. No Audit Log for Automation Executions
The gap: The plan appends to general activityLog.emails and tasks, making it impossible to distinguish "automation-created" entries from user-created ones. This is a support nightmare — "why was this task created?" has no answer.
Fix: Introduce a dedicated AutomationExecutionLog model:
typescriptexport interface AutomationExecutionLog {
  id: string;
  ruleId: string;
  ruleName: string;             // snapshot at time of execution
  trigger: AutomationTrigger;
  entityType: string;           // 'Lead' | 'Deal' | 'Ticket'
  entityId: string;
  executedAt: Date;
  conditionsSnapshot: AutomationRuleGroup[]; // what was evaluated
  actionsExecuted: AutomationAction[];
  status: 'success' | 'partial' | 'failed';
  errorMessage?: string;
}
Every record created by automation should carry a createdByAutomationRuleId field. This enables a "Trace" feature in the UI and answers support tickets instantly.

2. Rule Conflict & Priority — No Ordering Model
The gap: If two active rules both match LeadCreated and both try to AssignSalesperson, the last one wins silently. In a real CRM, this causes data integrity issues and sales team confusion.
Fix: Add priority: number to AutomationRule (lower = higher priority), and define a conflictStrategy:
typescriptexport interface AutomationRule {
  // ... existing fields
  priority: number;                          // execution order
  conflictStrategy: 'first-wins' | 'last-wins' | 'all-execute'; 
  stopOnMatch: boolean;                      // if true, skip lower-priority rules after this one fires
}
The engine should sort rules by priority before evaluation and respect stopOnMatch. This gives users explicit control, like a firewall ruleset.

3. Synchronous Evaluation Engine Will Block the UI
The gap: evaluateRules(trigger, entity) called inline inside addLead, updateLead, etc. means complex rule sets with many conditions block the Angular change detection cycle. Even with 20 rules, this becomes perceptible lag.
Fix: Wrap execution in a microtask queue and make the engine async:
typescriptasync evaluateRules(trigger: AutomationTrigger, entity: any): Promise<void> {
  // Use queueMicrotask or schedule via rxjs asapScheduler
  // Never block the calling mutation
}
For the current in-memory architecture, Promise.resolve().then(() => this._runEngine(trigger, entity)) is sufficient. This also future-proofs the engine for real async actions (HTTP webhooks, actual email sends) without refactoring call sites.

4. Condition Field Names Are Magic Strings
The gap: field: string with values like "customerAccount" or "estimatedDealValue" are hardcoded strings with zero type safety. Mistyped field names silently never match — one of the hardest bugs to diagnose.
Fix: Introduce a FieldDescriptor registry keyed by trigger:
typescriptexport interface FieldDescriptor {
  key: string;
  label: string;                // for UI display
  type: 'string' | 'number' | 'enum' | 'date' | 'boolean';
  allowedValues?: string[];     // for enum fields, drives dropdown options
  path: string;                 // dot-notation accessor: 'deal.estimatedValue'
}

export const TRIGGER_FIELD_MAP: Record<AutomationTrigger, FieldDescriptor[]> = {
  LeadCreated: [
    { key: 'customerAccount', label: 'Customer Account', type: 'string', path: 'customerAccount' },
    { key: 'source', label: 'Lead Source', type: 'enum', allowedValues: ['Web', 'Referral', 'Cold'], path: 'source' },
    // ...
  ],
  DealCreated: [
    { key: 'estimatedDealValue', label: 'Deal Value', type: 'number', path: 'estimatedDealValue' },
    { key: 'stage', label: 'Stage', type: 'enum', allowedValues: ['Initiated', 'Deal Created', 'Negotiation', 'Closed'], path: 'stage' },
    // ...
  ],
  // ...
};
The condition evaluator accesses fields via path (resolved with a lodash-style get(entity, descriptor.path)), not raw string matching. The UI's rule builder dynamically loads fields from this registry — which was listed in the original plan but lacked this backing structure.

🟡 Significant Gaps (Address in Scope)
5. Action Types Are Too Narrow for a Real CRM
The original four action types (AssignSalesperson, CreateFollowUpTask, SendEmailLog, NotifyManager) cover the demo use case, but any CRM power user will immediately ask for more. Extend the action type set now while the model is still cheap to change:
typescriptexport type AutomationActionType = 
  | 'AssignSalesperson'         // existing
  | 'CreateFollowUpTask'        // existing
  | 'SendEmailLog'              // existing
  | 'NotifyManager'             // existing
  | 'UpdateEntityField'         // NEW: set field value on the triggering entity
  | 'ChangeStage'               // NEW: move deal/lead to a different stage
  | 'CreateNote'                // NEW: append a note to the entity
  | 'AddTag'                    // NEW: tag the entity for segmentation
  | 'SetDueDate'                // NEW: set due date on created task
  | 'WebhookCall';              // NEW: stub for future external integrations
UpdateEntityField is especially important — a huge percentage of real automation rules are "when X happens, set Y to Z" (e.g., auto-set lead status to Qualified when deal value exceeds threshold).

6. Rule Versioning — No History of Changes
When a rule is edited, there is currently no way to know what it looked like when it fired last Tuesday. This matters for debugging historical automation behavior.
Fix: Add immutable versioning as a lightweight append:
typescriptexport interface AutomationRule {
  // ... existing
  version: number;                    // increments on every save
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;                  // user ID/name
  lastModifiedBy: string;
  changeHistory: {                    // keep last N versions
    version: number;
    changedAt: Date;
    changedBy: string;
    snapshot: Omit<AutomationRule, 'changeHistory'>;
  }[];
}
Cap changeHistory at 10 entries for the in-memory store. The execution log already snapshots conditionsSnapshot, so you can always correlate "what rule version fired" from the log.

7. Test Sandbox Spec Is Underspecified
The original plan mentions a "Test Sandbox" but gives no design. This is one of the highest-value features in the whole module and deserves a proper spec.
Upgraded spec for the Test Sandbox:
The sandbox should be a side panel (not a modal — rule context needs to stay visible) with:

Entity Prefill: Dropdown to pick an existing Lead/Deal/Ticket as the test entity, or a JSON editor to define a custom mock entity.
Trigger Selector: Choose which trigger to simulate (LeadCreated, DealUpdated, etc.).
Dry Run Mode: Execute the engine against the mock data without writing any state changes. Return a structured evaluation trace:

  Rule: "Assign DIGITAL ABC Lead"
  ✅ Condition Group 1 (AND):
      ✅ customerAccount equals "DIGITAL ABC"  → actual value: "DIGITAL ABC"
      ✅ stage equals "Initiated"              → actual value: "Initiated"
  🟡 Condition Group 2 (OR):
      ❌ stage equals "Deal Created"           → actual value: "Initiated" (skipped — Group 1 passed)
  ⚡ Actions that WOULD execute:
      → CreateFollowUpTask: "Follow up with DIGITAL ABC"
      → AssignSalesperson: "Alice Chen"

Live Mode: A toggle to run with actual state writes, clearly labeled "This will modify your CRM data."

This trace format is what separates a toy automation tool from a production one. Users need to understand why a rule fired or didn't.

8. The OR/AND Model Is Ambiguous in the UI Plan
The original plan describes "Group 1 OR Group 2 OR Group 3, each group contains ANDed conditions" — this is the correct Conjunctive Normal Form (CNF) approach, but the UI plan doesn't explain how users will build this. Without an explicit UX model, developers will guess and build something confusing.
Recommended UX pattern (proven in tools like HubSpot, Salesforce Flow, Zapier):
[ Condition Group 1 ]  ← Label: "All of these must be true (AND)"
  ├─ Customer Account = "DIGITAL ABC"
  └─ Stage = "Initiated"

  ── OR ──

[ Condition Group 2 ]  ← Label: "All of these must be true (AND)"
  └─ Stage = "Deal Created"
Each group has an "+ Add condition" button. Groups are separated by a persistent "OR" divider badge. An "+ Add condition group" button appends a new OR branch. This maps exactly to the conditionGroups: AutomationRuleGroup[] model and makes the logic visually unambiguous.

🟢 Enhancements (Recommended, High ROI)
9. Pre-built Rule Templates
Don't make users build from scratch. The most common CRM automations are well-known. Ship 5–8 read-only templates that users can clone and customize:
TemplateTriggerConditionActionHigh-Value Deal AlertDealCreatedvalue > 50,000NotifyManager (Sales)New Lead Auto-AssignLeadCreatedsource = WebAssignSalesperson (round-robin pool)Stale Deal Follow-upDealUpdatedlastActivity > 7 daysCreateFollowUpTaskSupport EscalationTicketCreatedpriority = CriticalNotifyManager (Support)Stage Progression TaskDealUpdatedstage = NegotiationCreateFollowUpTask
Templates dramatically reduce time-to-value and teach users the system's vocabulary.

10. KPI Cards — Make Them Meaningful
The original plan lists "KPI Cards" but doesn't define what they measure. Suggested metrics tied to real CRM value:
CardMetricWhy It MattersActive RulesCount of isActive: true rulesQuick health checkExecutions (7d)Count from AutomationExecutionLogShows system activityTasks Auto-CreatedAutomation-sourced tasks / total tasks %ROI on automationTime Saved (est.)executions × 3 min (configurable constant)Sells the value to managersLast ExecutionMost recent log entry timestampAlerts if rules have gone quiet

11. Route Guard & Empty State
The /automation page needs an empty state design for new users with zero rules — this is often forgotten and creates a jarring first impression. The empty state should:

Show an illustration (gears/workflow icon)
Explain what automation does in one sentence
Show two CTAs: "Start from template" and "Create custom rule"

Also add a route guard that warns if a user navigates away from an unsaved rule builder form.

Revised Data Model (Complete)
typescript// crm-state.service.ts additions

export type AutomationTrigger = 
  | 'LeadCreated' | 'LeadUpdated' 
  | 'DealCreated' | 'DealUpdated' 
  | 'TicketCreated' | 'TicketUpdated';

export interface FieldDescriptor {
  key: string;
  label: string;
  type: 'string' | 'number' | 'enum' | 'date' | 'boolean';
  allowedValues?: string[];
  path: string;
}

export type ConditionOperator = 
  | 'equals' | 'notEquals' 
  | 'contains' | 'notContains'
  | 'greaterThan' | 'lessThan' | 'greaterThanOrEqual' | 'lessThanOrEqual'
  | 'isEmpty' | 'isNotEmpty';       // ← added: handles null/undefined gracefully

export interface AutomationCondition {
  fieldKey: string;                  // references FieldDescriptor.key
  operator: ConditionOperator;
  value?: string | number | boolean; // optional — isEmpty/isNotEmpty need no value
}

export interface AutomationRuleGroup {
  id: string;                        // for UI keying
  logicalOperator: 'AND';            // always AND within a group; OR is between groups
  conditions: AutomationCondition[];
}

export type AutomationActionType = 
  | 'AssignSalesperson' | 'CreateFollowUpTask' 
  | 'SendEmailLog' | 'NotifyManager'
  | 'UpdateEntityField' | 'ChangeStage' 
  | 'CreateNote' | 'AddTag' | 'SetDueDate' | 'WebhookCall';

export interface AutomationAction {
  id: string;
  type: AutomationActionType;
  params: {
    assignee?: string;
    taskTitle?: string;
    taskDueDateOffsetDays?: number;  // e.g., +3 days from trigger
    emailSubject?: string;
    emailBody?: string;
    targetTeam?: 'Sales' | 'Operations' | 'Finance' | 'Support';
    fieldKey?: string;               // for UpdateEntityField
    fieldValue?: string | number;    // for UpdateEntityField
    targetStage?: string;            // for ChangeStage
    noteContent?: string;            // for CreateNote
    tagName?: string;                // for AddTag
    webhookUrl?: string;             // for WebhookCall (stub)
  };
}

export interface AutomationRule {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  isTemplate: boolean;               // template rules are read-only clones
  trigger: AutomationTrigger;
  conditionGroups: AutomationRuleGroup[];  // groups are OR'd together
  actions: AutomationAction[];
  priority: number;
  stopOnMatch: boolean;
  conflictStrategy: 'first-wins' | 'all-execute';
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  lastModifiedBy: string;
  changeHistory: {
    version: number;
    changedAt: Date;
    changedBy: string;
    snapshot: object;
  }[];
}

export interface AutomationExecutionLog {
  id: string;
  ruleId: string;
  ruleName: string;
  ruleVersion: number;
  trigger: AutomationTrigger;
  entityType: string;
  entityId: string;
  executedAt: Date;
  dryRun: boolean;
  conditionsTrace: {
    groupId: string;
    passed: boolean;
    conditions: { fieldKey: string; expected: unknown; actual: unknown; passed: boolean }[];
  }[];
  actionsExecuted: { actionId: string; type: AutomationActionType; status: 'ok' | 'error'; error?: string }[];
  status: 'success' | 'partial' | 'failed';
}

Revised Verification Plan
The original verification plan only covers happy-path scenarios. A production feature needs adversarial cases too.
Engine unit tests (add to crm-state.service.spec.ts):
TestScenarioBasic AND matchAll conditions in one group pass → rule firesPartial AND failOne condition fails in a group → group doesn't fireOR fallbackGroup 1 fails, Group 2 passes → rule firesPriority orderingTwo matching rules: lower priority number fires firststopOnMatchAfter priority-1 rule fires with stopOnMatch: true, priority-2 rule is skippedField type coercionestimatedDealValue > "10000" (string vs number) handles gracefullyisEmpty operatorField is undefined/null → isEmpty condition passesDry run isolationDry run execution does not mutate any signalsExecution log entryAfter rule fires, executionLogs signal contains correct trace entryAutomation tag on taskTask created by automation has createdByAutomationRuleId set
Manual verification additions:

Navigate away from an unsaved rule — confirm the route guard prompts the user.
Create two conflicting AssignSalesperson rules targeting the same trigger with different priorities — verify the correct one wins per conflictStrategy.
Run a dry-run sandbox test and verify the condition trace output shows actual vs. expected values for all conditions.
Disable a rule mid-scenario — verify that subsequent entity updates do not trigger it.
Check that Time Saved KPI card updates after executions.


File Change Summary (Revised)
FileChange TypeReasoncrm-state.service.tsModifyFull revised data model, TRIGGER_FIELD_MAP, async evaluateRules engine, automationRules signal, executionLogs signalautomation.component.tsNewFull automation page with KPI cards, rule list, rule builder, sandbox panelautomation-rule-builder.component.tsNew (split out)Rule builder is complex enough to warrant its own component with its own form stateautomation-execution-log.component.tsNew (split out)Execution log table with trace drilldownautomation-templates.tsNewStatic config file with 5–8 clonable rule templatestrigger-field-map.tsNewTRIGGER_FIELD_MAP constant extracted to its own file — it will growapp.routes.tsModifyAdd /automation route with unsaved-changes guardapp.tsModifyAdd "Automation" nav itemcrm-state.service.spec.tsModifyFull engine test suite (table above)

This upgraded plan is implementable as written, defensible in a technical review, and will produce a feature that CRM users will actually trust — because they can see exactly what their rules are doing and why.
