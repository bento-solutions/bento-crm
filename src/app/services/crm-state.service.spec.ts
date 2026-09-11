import { describe, it, expect, beforeEach } from 'vitest';
import { CrmStateService, AutomationRule } from './crm-state.service';

describe('CrmStateService Workflow Automation Engine', () => {
  let service: CrmStateService;

  beforeEach(() => {
    service = new CrmStateService();
  });

  it('should evaluate and match a simple condition', async () => {
    const testRule: AutomationRule = {
      id: 'test-rule-1',
      name: 'Test Rule',
      isActive: true,
      trigger: 'LeadCreated',
      priority: 1,
      stopOnMatch: false,
      conflictStrategy: 'all-execute',
      version: 1,
      conditionGroups: [
        {
          id: 'grp-1',
          logicalOperator: 'AND',
          conditions: [{ fieldKey: 'companyName', operator: 'contains', value: 'MedCare' }]
        }
      ],
      actions: [
        {
          id: 'act-1',
          type: 'AssignSalesperson',
          params: { assignee: 'Youssef El Alami' }
        }
      ]
    };

    service.automationRules.set([testRule]);

    const logs = await service.evaluateRules('LeadCreated', { id: 'l1', companyName: 'MedCare Clinics', name: 'Ahmed' }, 'Lead: Ahmed');

    expect(logs.length).toBe(1);
    expect(logs[0].status).toBe('success');
    expect(logs[0].conditionsTrace[0].passed).toBe(true);
    expect(logs[0].actionsExecuted[0].status).toBe('ok');
  });

  it('should fallback to second condition group on OR match', async () => {
    const testRule: AutomationRule = {
      id: 'test-rule-2',
      name: 'Test Rule OR',
      isActive: true,
      trigger: 'DealCreated',
      priority: 1,
      stopOnMatch: false,
      conflictStrategy: 'all-execute',
      version: 1,
      conditionGroups: [
        {
          id: 'grp-1',
          logicalOperator: 'AND',
          conditions: [{ fieldKey: 'amount', operator: 'greaterThan', value: 100000 }]
        },
        {
          id: 'grp-2',
          logicalOperator: 'AND',
          conditions: [{ fieldKey: 'customerAccount', operator: 'equals', value: 'VIP-ABC' }]
        }
      ],
      actions: [
        {
          id: 'act-1',
          type: 'NotifyManager',
          params: { assignee: 'Achraf (Manager)', taskTitle: 'Alert' }
        }
      ]
    };

    service.automationRules.set([testRule]);

    // Group 1 fails (amount is 5000 < 100000), Group 2 passes (customerAccount equals VIP-ABC)
    const logs = await service.evaluateRules('DealCreated', { id: 'd1', amount: 5000, customerAccount: 'VIP-ABC', title: 'Deal 1' }, 'Deal: Deal 1');

    expect(logs.length).toBe(1);
    expect(logs[0].status).toBe('success');
    expect(logs[0].conditionsTrace[0].passed).toBe(false);
    expect(logs[0].conditionsTrace[1].passed).toBe(true);
  });

  it('should respect stopOnMatch flag', async () => {
    const rule1: AutomationRule = {
      id: 'r1',
      name: 'Rule 1',
      isActive: true,
      trigger: 'LeadCreated',
      priority: 1,
      stopOnMatch: true,
      conflictStrategy: 'first-wins',
      version: 1,
      conditionGroups: [],
      actions: [{ id: 'a1', type: 'AssignSalesperson', params: { assignee: 'Amine Bennani' } }]
    };

    const rule2: AutomationRule = {
      id: 'r2',
      name: 'Rule 2',
      isActive: true,
      trigger: 'LeadCreated',
      priority: 2,
      stopOnMatch: false,
      conflictStrategy: 'all-execute',
      version: 1,
      conditionGroups: [],
      actions: [{ id: 'a2', type: 'AssignSalesperson', params: { assignee: 'Youssef El Alami' } }]
    };

    service.automationRules.set([rule1, rule2]);

    const logs = await service.evaluateRules('LeadCreated', { id: 'l1', name: 'Ahmed' }, 'Lead: Ahmed');

    // Should stop after rule1 because stopOnMatch is true
    expect(logs.length).toBe(1);
    expect(logs[0].ruleId).toBe('r1');
  });
});
