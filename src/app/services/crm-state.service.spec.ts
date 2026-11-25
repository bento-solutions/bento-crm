import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { CrmStateService, AutomationRule } from './crm-state.service';
import { API_CONFIG } from '../core/config/api-config';

describe('CrmStateService Workflow Automation Engine', () => {
  let service: CrmStateService;

  beforeEach(() => {
    // Its dependencies come from inject(), which only works inside an injector.
    service = TestBed.inject(CrmStateService);
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

describe('CrmStateService eager session bootstrap', () => {
  let backend: HttpTestingController;
  const ME_URL = `${API_CONFIG.baseUrl}/auth/me`;

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    backend?.verify();
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('loads account and permissions eagerly before triggering other API calls', async () => {
    localStorage.setItem('accessToken', 'valid-token');
    localStorage.setItem('bento_auth', 'true');

    const service = TestBed.inject(CrmStateService);
    backend = TestBed.inject(HttpTestingController);
    TestBed.tick();

    // Eager org/users/leads calls must NOT fire before /auth/me resolves.
    backend.expectNone(`${API_CONFIG.baseUrl}/users`);
    backend.expectNone(`${API_CONFIG.baseUrl}/partners`);

    const initPromise = service.initSession();
    const meReq = backend.expectOne(ME_URL);
    meReq.flush({
      id: 'usr-admin-1',
      organization_id: 'org-1',
      email: 'admin@bento.ma',
      display_name: 'Achraf Admin',
      initials: 'AA',
      avatar_color: '#112233',
      role: 'ADMIN',
      team_id: null,
      is_active: true,
      phone: null,
      job_title: 'Director',
      language: 'en',
      last_active_at: null,
    });
    await initPromise;

    expect(service.isAuthenticated()).toBe(true);
    expect(service.currentUserStatus()).toBe('loaded');
    expect(service.currentUserId()).toBe('usr-admin-1');
    expect(service.currentUser()?.displayName).toBe('Achraf Admin');
    expect(service.currentUser()?.roleId).toBe('admin');
    expect(service.currentUserPermissions().canManageUsers).toBe(true);
    expect(service.hasAuthority('LEDGER_READ')).toBe(true);
    expect(service.reconnectRequired()).toBe(false);

    // Flush the eager calls that now trigger after currentUserStatus becomes 'loaded'.
    TestBed.tick();
    for (const url of [
      `${API_CONFIG.baseUrl}/users`,
      `${API_CONFIG.baseUrl}/teams`,
      `${API_CONFIG.baseUrl}/groups`,
      `${API_CONFIG.baseUrl}/organizations/me`,
      `${API_CONFIG.baseUrl}/notifications`,
      `${API_CONFIG.baseUrl}/partners/type/LEAD?size=1000`,
      `${API_CONFIG.baseUrl}/brands?size=1000`,
      `${API_CONFIG.baseUrl}/business-types?size=1000`,
    ]) {
      backend.match(url).forEach(r => r.flush([]));
    }
  });

  it('disconnects and flags reconnect when bento_auth lingers without tokens', async () => {
    localStorage.setItem('bento_auth', 'true');
    localStorage.setItem('bento_current_user_id', 'usr-old');

    const service = TestBed.inject(CrmStateService);
    backend = TestBed.inject(HttpTestingController);

    await service.initSession();

    expect(service.isAuthenticated()).toBe(false);
    expect(service.reconnectRequired()).toBe(true);
    expect(localStorage.getItem('bento_auth')).toBeNull();
    expect(localStorage.getItem('bento_current_user_id')).toBeNull();
  });

  it('disconnects and flags reconnect when /auth/me rejects the token (401/403)', async () => {
    localStorage.setItem('accessToken', 'stale-token');
    localStorage.setItem('bento_auth', 'true');

    const service = TestBed.inject(CrmStateService);
    backend = TestBed.inject(HttpTestingController);

    const initPromise = service.initSession();
    backend.expectOne(ME_URL).flush(null, { status: 401, statusText: 'Unauthorized' });
    await initPromise;

    expect(service.isAuthenticated()).toBe(false);
    expect(service.reconnectRequired()).toBe(true);
    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(localStorage.getItem('bento_auth')).toBeNull();
    backend.expectNone(`${API_CONFIG.baseUrl}/users`);
  });
});
