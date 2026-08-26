import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { BaseApiService } from '../core/services/base-api.service';
import { CurrentUser } from '../core/services/auth-api.service';
import type {
  Organization, CrmUser, CrmTeam, CrmGroup, GroupMessage, GroupMeeting,
  Partner, LeadContact, LeadActivity, LeadStatusHistory, CustomerCard,
  Deal, Proposal, ProposalTemplate, Task, Ticket, Invoice, PurchaseOrder,
  Campaign, AutomationRule, Notification
} from './crm-state.service';
import type { WhatsAppAccount, CampaignRecipient, CampaignStats } from './domains/whatsapp-campaigns.service';
import type { PartnerLedger } from '../shared/partner-ledger.model';
import type { StoredFileDto } from '../shared/attachments.component';
import { invoiceFromApi, invoiceToApi, InvoiceResponse } from './domains/invoice.mapper';

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  total_elements: number;
  total_pages: number;
}

// Backend Proposal.status is a Java enum (DRAFT, SENT, CONFIRMED, REJECTED, EXPIRED) matched by
// exact name; the frontend uses capitalized display values, so requests/responses are translated
// at this boundary rather than changing the capitalized values used throughout the UI.
const PROPOSAL_STATUS_TO_BACKEND: Record<string, string> = {
  Draft: 'DRAFT', Sent: 'SENT', Confirmed: 'CONFIRMED', Rejected: 'REJECTED', Expired: 'EXPIRED'
};
const PROPOSAL_STATUS_FROM_BACKEND: Record<string, string> = {
  DRAFT: 'Draft', SENT: 'Sent', CONFIRMED: 'Confirmed', REJECTED: 'Rejected', EXPIRED: 'Expired'
};

function toBackendProposal(proposal: unknown): unknown {
  const payload = { ...(proposal as Record<string, unknown>) };
  if (typeof payload['status'] === 'string') {
    payload['status'] = PROPOSAL_STATUS_TO_BACKEND[payload['status'] as string] ?? payload['status'];
  }
  return payload;
}

function fromBackendProposal(proposal: Proposal): Proposal {
  const status = proposal.status as unknown as string;
  return { ...proposal, status: (PROPOSAL_STATUS_FROM_BACKEND[status] ?? status) as Proposal['status'] };
}

// Same exact-match problem as Proposal.status above: PurchaseOrder.Status is a Java enum
// (DRAFT/SENT/CONFIRMED/DELIVERED/INVOICED). The backend's CreatePurchaseOrderRequest field is
// also named `vendorPartnerId`, not `vendorId` as the frontend PurchaseOrder model calls it, so
// that's translated at the same boundary.
const PO_STATUS_TO_BACKEND: Record<string, string> = {
  Draft: 'DRAFT', Sent: 'SENT', Confirmed: 'CONFIRMED', Delivered: 'DELIVERED', Invoiced: 'INVOICED'
};
const PO_STATUS_FROM_BACKEND: Record<string, string> = {
  DRAFT: 'Draft', SENT: 'Sent', CONFIRMED: 'Confirmed', DELIVERED: 'Delivered', INVOICED: 'Invoiced'
};

function toBackendPurchaseOrder(po: unknown): unknown {
  const payload = { ...(po as Record<string, unknown>) };
  if (typeof payload['status'] === 'string') {
    payload['status'] = PO_STATUS_TO_BACKEND[payload['status'] as string] ?? payload['status'];
  }
  if ('vendorId' in payload) {
    payload['vendorPartnerId'] = payload['vendorId'];
    delete payload['vendorId'];
  }
  return payload;
}

function fromBackendPurchaseOrder(po: PurchaseOrder): PurchaseOrder {
  const dto = po as unknown as Record<string, unknown>;
  const status = dto['status'] as string;
  return {
    ...po,
    status: (PO_STATUS_FROM_BACKEND[status] ?? status) as PurchaseOrder['status'],
    vendorId: (dto['vendorPartnerId'] ?? dto['vendorId']) as string
  };
}

// AutomationRule.Trigger is a Java enum (PARTNER_CREATED/PARTNER_UPDATED/DEAL_CREATED/
// DEAL_UPDATED/TICKET_CREATED/TICKET_UPDATED); the frontend's rule builder uses its own
// "LeadCreated"-style names (it calls partners "leads" in this context).
const TRIGGER_TO_BACKEND: Record<string, string> = {
  LeadCreated: 'PARTNER_CREATED', LeadUpdated: 'PARTNER_UPDATED',
  DealCreated: 'DEAL_CREATED', DealUpdated: 'DEAL_UPDATED',
  TicketCreated: 'TICKET_CREATED', TicketUpdated: 'TICKET_UPDATED'
};
const TRIGGER_FROM_BACKEND: Record<string, string> = {
  PARTNER_CREATED: 'LeadCreated', PARTNER_UPDATED: 'LeadUpdated',
  DEAL_CREATED: 'DealCreated', DEAL_UPDATED: 'DealUpdated',
  TICKET_CREATED: 'TicketCreated', TICKET_UPDATED: 'TicketUpdated'
};

function toBackendAutomationRule(rule: unknown): unknown {
  const payload = { ...(rule as Record<string, unknown>) };
  if (typeof payload['trigger'] === 'string') {
    payload['trigger'] = TRIGGER_TO_BACKEND[payload['trigger'] as string] ?? payload['trigger'];
  }
  return payload;
}

function fromBackendAutomationRule(rule: AutomationRule): AutomationRule {
  const trigger = rule.trigger as unknown as string;
  return { ...rule, trigger: (TRIGGER_FROM_BACKEND[trigger] ?? trigger) as AutomationRule['trigger'] };
}

// Task.TaskStatus (TODO/IN_PROGRESS/DONE/BLOCKED) and Task.Priority (URGENT/MEDIUM/LOW) are
// Java enums; the frontend uses its own display-cased values for both.
const TASK_STATUS_TO_BACKEND: Record<string, string> = {
  Pending: 'TODO', 'In Progress': 'IN_PROGRESS', Completed: 'DONE', Blocked: 'BLOCKED'
};
const TASK_STATUS_FROM_BACKEND: Record<string, string> = {
  TODO: 'Pending', IN_PROGRESS: 'In Progress', DONE: 'Completed', BLOCKED: 'Blocked'
};
const TASK_PRIORITY_TO_BACKEND: Record<string, string> = {
  Urgent: 'URGENT', Medium: 'MEDIUM', Low: 'LOW'
};
const TASK_PRIORITY_FROM_BACKEND: Record<string, string> = {
  URGENT: 'Urgent', MEDIUM: 'Medium', LOW: 'Low'
};

function toBackendTask(task: unknown): unknown {
  const payload = { ...(task as Record<string, unknown>) };
  if (typeof payload['status'] === 'string') {
    payload['status'] = TASK_STATUS_TO_BACKEND[payload['status'] as string] ?? payload['status'];
  }
  if (typeof payload['priority'] === 'string') {
    payload['priority'] = TASK_PRIORITY_TO_BACKEND[payload['priority'] as string] ?? payload['priority'];
  }
  return payload;
}

function fromBackendTask(task: Task): Task {
  const dto = task as unknown as Record<string, unknown>;
  const status = dto['status'] as string;
  const priority = dto['priority'] as string | undefined;
  return {
    ...task,
    status: (TASK_STATUS_FROM_BACKEND[status] ?? status) as Task['status'],
    priority: priority ? (TASK_PRIORITY_FROM_BACKEND[priority] ?? priority) as Task['priority'] : task.priority
  };
}

// Campaign.Channel (WHATSAPP/SMS/EMAIL) and Campaign.Status (DRAFT/SCHEDULED/SENDING/ACTIVE/
// COMPLETED) are Java enums. The backend entity field is also named `channel`, but the frontend
// Campaign model calls it `type` — both the field name and its value are translated here.
const CAMPAIGN_CHANNEL_TO_BACKEND: Record<string, string> = {
  WhatsApp: 'WHATSAPP', SMS: 'SMS', Email: 'EMAIL'
};
const CAMPAIGN_CHANNEL_FROM_BACKEND: Record<string, string> = {
  WHATSAPP: 'WhatsApp', SMS: 'SMS', EMAIL: 'Email'
};
const CAMPAIGN_STATUS_TO_BACKEND: Record<string, string> = {
  Draft: 'DRAFT', Scheduled: 'SCHEDULED', Sending: 'SENDING', Active: 'ACTIVE', Completed: 'COMPLETED'
};
const CAMPAIGN_STATUS_FROM_BACKEND: Record<string, string> = {
  DRAFT: 'Draft', SCHEDULED: 'Scheduled', SENDING: 'Sending', ACTIVE: 'Active', COMPLETED: 'Completed'
};

function toBackendCampaign(campaign: unknown): unknown {
  const payload = { ...(campaign as Record<string, unknown>) };
  if (typeof payload['type'] === 'string') {
    payload['channel'] = CAMPAIGN_CHANNEL_TO_BACKEND[payload['type'] as string] ?? payload['type'];
    delete payload['type'];
  }
  if (typeof payload['status'] === 'string') {
    payload['status'] = CAMPAIGN_STATUS_TO_BACKEND[payload['status'] as string] ?? payload['status'];
  }
  return payload;
}

// Deal.DealStage is a Java enum: OPEN, PO_SENT, AWAITING_DELIVERY, AWAITING_INVOICING, INVOICED,
// PAID, OVERDUE, CLOSED_WON, CLOSED_LOST. The frontend pipeline board only exposes 6 of those 9
// stages; 'Confirmed' means the customer's purchase order has been sent/received (PO_SENT) —
// AWAITING_DELIVERY and PAID/OVERDUE aren't surfaced anywhere in this UI.
const DEAL_STAGE_TO_BACKEND: Record<string, string> = {
  New: 'OPEN',
  Confirmed: 'PO_SENT',
  'Awaiting Invoicing': 'AWAITING_INVOICING',
  Invoiced: 'INVOICED',
  'Closed Won': 'CLOSED_WON',
  'Closed Lost': 'CLOSED_LOST'
};
const DEAL_STAGE_FROM_BACKEND: Record<string, string> = {
  OPEN: 'New',
  PO_SENT: 'Confirmed',
  AWAITING_INVOICING: 'Awaiting Invoicing',
  INVOICED: 'Invoiced',
  CLOSED_WON: 'Closed Won',
  CLOSED_LOST: 'Closed Lost'
};

function toBackendDeal(deal: unknown): unknown {
  const payload = { ...(deal as Record<string, unknown>) };
  if (typeof payload['stage'] === 'string') {
    payload['stage'] = DEAL_STAGE_TO_BACKEND[payload['stage'] as string] ?? payload['stage'];
  }
  return payload;
}

function fromBackendDeal(deal: Deal): Deal {
  const stage = deal.stage as unknown as string;
  return { ...deal, stage: (DEAL_STAGE_FROM_BACKEND[stage] ?? stage) as Deal['stage'] };
}

function fromBackendCampaign(campaign: Campaign): Campaign {
  const dto = campaign as unknown as Record<string, unknown>;
  const channel = (dto['channel'] ?? dto['type']) as string;
  const status = dto['status'] as string;
  return {
    ...campaign,
    type: (CAMPAIGN_CHANNEL_FROM_BACKEND[channel] ?? channel) as Campaign['type'],
    status: (CAMPAIGN_STATUS_FROM_BACKEND[status] ?? status) as Campaign['status']
  };
}

@Injectable({
  providedIn: 'root'
})
export class ApiService extends BaseApiService {

  // Auth
  getMe(): Observable<CurrentUser> {
    return this.get<CurrentUser>(`/auth/me`);
  }

  // Organization
  getOrganization(): Observable<Organization> {
    return this.get(`/organizations/me`);
  }

  updateOrganization(patch: Partial<Organization>): Observable<Organization> {
    return this.patch(`/organizations/me`, patch);
  }

  // Users
  getUsers(): Observable<CrmUser[]> {
    return this.get<PageResponse<CrmUser>>(`/users`).pipe(
      map(response => response.content || [])
    );
  }

  getUser(id: string): Observable<CrmUser> {
    return this.get(`/users/${id}`);
  }

  createUser(user: unknown): Observable<CrmUser> {
    return this.post(`/users`, user);
  }

  updateUser(id: string, user: unknown): Observable<CrmUser> {
    return this.patch(`/users/${id}`, user);
  }

  updateOwnProfile(patch: unknown): Observable<CrmUser> {
    return this.patch(`/users/me`, patch);
  }

  deactivateUser(id: string): Observable<CrmUser> {
    return this.post(`/users/${id}/deactivate`, {});
  }

  // Teams
  getTeams(): Observable<CrmTeam[]> {
    return this.get<PageResponse<CrmTeam>>(`/teams`).pipe(
      map(response => response.content || [])
    );
  }

  getTeam(id: string): Observable<CrmTeam> {
    return this.get(`/teams/${id}`);
  }

  createTeam(team: unknown): Observable<CrmTeam> {
    return this.post(`/teams`, team);
  }

  updateTeam(id: string, team: unknown): Observable<CrmTeam> {
    return this.patch(`/teams/${id}`, team);
  }

  deleteTeam(id: string): Observable<unknown> {
    return this.delete(`/teams/${id}`);
  }

  // Groups
  getGroups(): Observable<CrmGroup[]> {
    return this.get<PageResponse<CrmGroup>>(`/groups`).pipe(
      map(response => response.content || [])
    );
  }

  getGroup(id: string): Observable<CrmGroup> {
    return this.get(`/groups/${id}`);
  }

  createGroup(group: unknown): Observable<CrmGroup> {
    return this.post(`/groups`, group);
  }

  updateGroup(id: string, group: unknown): Observable<CrmGroup> {
    return this.patch(`/groups/${id}`, group);
  }

  deleteGroup(id: string): Observable<unknown> {
    return this.delete(`/groups/${id}`);
  }

  // Messages
  getGroupMessages(groupId: string): Observable<GroupMessage[]> {
    return this.get<PageResponse<GroupMessage>>(`/groups/${groupId}/messages`).pipe(
      map(response => response.content || [])
    );
  }

  createGroupMessage(groupId: string, message: unknown): Observable<GroupMessage> {
    return this.post(`/groups/${groupId}/messages`, message);
  }

  // Meetings
  getGroupMeetings(groupId: string): Observable<GroupMeeting[]> {
    return this.get<PageResponse<GroupMeeting>>(`/groups/${groupId}/meetings`).pipe(
      map(response => response.content || [])
    );
  }

  createGroupMeeting(groupId: string, meeting: unknown): Observable<GroupMeeting> {
    return this.post(`/groups/${groupId}/meetings`, meeting);
  }

  // Partners/Leads
  // NOTE: the backend does not support filtering /partners by a `type` query
  // param — it only accepts Pageable params on that route. Type/stage
  // filtering is exposed via dedicated path-variable endpoints instead.
  getPartners(): Observable<Partner[]> {
    return this.get<PageResponse<Partner>>(`/partners`).pipe(
      map(response => response.content || [])
    );
  }

  getPartnersByType(type: string): Observable<Partner[]> {
    return this.get<PageResponse<Partner>>(`/partners/type/${type}`).pipe(
      map(response => response.content || [])
    );
  }

  getPartnersByStage(stage: string): Observable<Partner[]> {
    return this.get<PageResponse<Partner>>(`/partners/stage/${stage}`).pipe(
      map(response => response.content || [])
    );
  }

  getPartner(id: string): Observable<Partner> {
    return this.get(`/partners/${id}`);
  }

  createPartner(partner: unknown): Observable<Partner> {
    return this.post(`/partners`, partner);
  }

  updatePartner(id: string, partner: unknown): Observable<Partner> {
    return this.patch(`/partners/${id}`, partner);
  }

  deletePartner(id: string): Observable<unknown> {
    return this.delete(`/partners/${id}`);
  }

  // Lead (Partner) sub-resources
  getLeadContacts(partnerId: string): Observable<LeadContact[]> {
    return this.get<LeadContact[]>(`/partners/${partnerId}/contacts`);
  }

  createLeadContact(partnerId: string, contact: unknown): Observable<LeadContact> {
    return this.post(`/partners/${partnerId}/contacts`, contact);
  }

  updateLeadContact(partnerId: string, contactId: string, contact: unknown): Observable<LeadContact> {
    return this.patch(`/partners/${partnerId}/contacts/${contactId}`, contact);
  }

  deleteLeadContact(partnerId: string, contactId: string): Observable<unknown> {
    return this.delete(`/partners/${partnerId}/contacts/${contactId}`);
  }

  getLeadActivities(partnerId: string): Observable<LeadActivity[]> {
    return this.get<LeadActivity[]>(`/partners/${partnerId}/activities`);
  }

  createLeadActivity(partnerId: string, activity: unknown): Observable<LeadActivity> {
    return this.post(`/partners/${partnerId}/activities`, activity);
  }

  deleteLeadActivity(partnerId: string, activityId: string): Observable<unknown> {
    return this.delete(`/partners/${partnerId}/activities/${activityId}`);
  }

  getLeadStatusHistory(partnerId: string): Observable<LeadStatusHistory[]> {
    return this.get<LeadStatusHistory[]>(`/partners/${partnerId}/status-history`);
  }

  createLeadStatusHistory(partnerId: string, entry: unknown): Observable<LeadStatusHistory> {
    return this.post(`/partners/${partnerId}/status-history`, entry);
  }

  getCustomerCard(partnerId: string): Observable<CustomerCard> {
    return this.get(`/partners/${partnerId}/customer-card`);
  }

  saveCustomerCard(partnerId: string, card: unknown): Observable<CustomerCard> {
    return this.post(`/partners/${partnerId}/customer-card`, card);
  }

  getPartnerLedger(partnerId: string): Observable<PartnerLedger> {
    return this.get(`/partners/${partnerId}/ledger`);
  }

  // Deals
  getDeals(): Observable<Deal[]> {
    return this.get<PageResponse<Deal>>(`/deals`).pipe(
      map(response => (response.content || []).map(fromBackendDeal))
    );
  }

  getDeal(id: string): Observable<Deal> {
    return this.get<Deal>(`/deals/${id}`).pipe(map(fromBackendDeal));
  }

  createDeal(deal: unknown): Observable<Deal> {
    return this.post<Deal>(`/deals`, toBackendDeal(deal)).pipe(map(fromBackendDeal));
  }

  updateDeal(id: string, deal: unknown): Observable<Deal> {
    return this.patch<Deal>(`/deals/${id}`, toBackendDeal(deal)).pipe(map(fromBackendDeal));
  }

  deleteDeal(id: string): Observable<unknown> {
    return this.delete(`/deals/${id}`);
  }

  // Deal Activities
  getDealActivities(dealId: string): Observable<unknown[]> {
    return this.get<unknown[]>(`/deals/${dealId}/activities`);
  }

  createDealActivity(dealId: string, activity: unknown): Observable<{ id: string }> {
    return this.post(`/deals/${dealId}/activities`, activity);
  }

  updateDealActivity(dealId: string, activityId: string, activity: unknown): Observable<unknown> {
    return this.patch(`/deals/${dealId}/activities/${activityId}`, activity);
  }

  deleteDealActivity(dealId: string, activityId: string): Observable<unknown> {
    return this.delete(`/deals/${dealId}/activities/${activityId}`);
  }

  // Proposals
  getProposals(): Observable<Proposal[]> {
    return this.get<PageResponse<Proposal>>(`/proposals`).pipe(
      map(response => (response.content || []).map(fromBackendProposal))
    );
  }

  getProposal(id: string): Observable<Proposal> {
    return this.get<Proposal>(`/proposals/${id}`).pipe(map(fromBackendProposal));
  }

  createProposal(proposal: unknown): Observable<Proposal> {
    return this.post<Proposal>(`/proposals`, toBackendProposal(proposal)).pipe(map(fromBackendProposal));
  }

  updateProposal(id: string, proposal: unknown): Observable<Proposal> {
    return this.patch<Proposal>(`/proposals/${id}`, toBackendProposal(proposal)).pipe(map(fromBackendProposal));
  }

  deleteProposal(id: string): Observable<unknown> {
    return this.delete(`/proposals/${id}`);
  }

  // Proposal Templates
  getProposalTemplates(): Observable<ProposalTemplate[]> {
    return this.get<PageResponse<ProposalTemplate>>(`/proposal-templates`).pipe(
      map(response => response.content || [])
    );
  }

  createProposalTemplate(template: unknown): Observable<ProposalTemplate> {
    return this.post(`/proposal-templates`, template);
  }

  updateProposalTemplate(id: string, template: unknown): Observable<ProposalTemplate> {
    return this.patch(`/proposal-templates/${id}`, template);
  }

  deleteProposalTemplate(id: string): Observable<unknown> {
    return this.delete(`/proposal-templates/${id}`);
  }

  // Tasks
  getTasks(): Observable<Task[]> {
    return this.get<PageResponse<Task>>(`/tasks`).pipe(
      map(response => (response.content || []).map(fromBackendTask))
    );
  }

  getTask(id: string): Observable<Task> {
    return this.get<Task>(`/tasks/${id}`).pipe(map(fromBackendTask));
  }

  createTask(task: unknown): Observable<Task> {
    return this.post<Task>(`/tasks`, toBackendTask(task)).pipe(map(fromBackendTask));
  }

  updateTask(id: string, task: unknown): Observable<Task> {
    return this.patch<Task>(`/tasks/${id}`, toBackendTask(task)).pipe(map(fromBackendTask));
  }

  deleteTask(id: string): Observable<unknown> {
    return this.delete(`/tasks/${id}`);
  }

  // Tickets
  getTickets(): Observable<Ticket[]> {
    return this.get<PageResponse<Ticket>>(`/tickets`).pipe(
      map(response => response.content || [])
    );
  }

  getTicket(id: string): Observable<Ticket> {
    return this.get(`/tickets/${id}`);
  }

  createTicket(ticket: unknown): Observable<Ticket> {
    return this.post(`/tickets`, ticket);
  }

  updateTicket(id: string, ticket: unknown): Observable<Ticket> {
    return this.patch(`/tickets/${id}`, ticket);
  }

  deleteTicket(id: string): Observable<unknown> {
    return this.delete(`/tickets/${id}`);
  }

  // Invoices
  getInvoices(): Observable<Invoice[]> {
    return this.get<PageResponse<InvoiceResponse>>(`/invoices`).pipe(
      map(response => (response.content || []).map(invoiceFromApi))
    );
  }

  getInvoice(id: string): Observable<Invoice> {
    return this.get<InvoiceResponse>(`/invoices/${id}`).pipe(map(invoiceFromApi));
  }

  createInvoice(invoice: unknown): Observable<Invoice> {
    return this.post<InvoiceResponse>(`/invoices`, invoiceToApi(invoice as Partial<Invoice>)).pipe(map(invoiceFromApi));
  }

  updateInvoice(id: string, invoice: unknown): Observable<Invoice> {
    return this.patch<InvoiceResponse>(`/invoices/${id}`, invoiceToApi(invoice as Partial<Invoice>)).pipe(map(invoiceFromApi));
  }

  deleteInvoice(id: string): Observable<unknown> {
    return this.delete(`/invoices/${id}`);
  }

  // Purchase Orders
  getPurchaseOrders(): Observable<PurchaseOrder[]> {
    return this.get<PageResponse<PurchaseOrder>>(`/purchase-orders`).pipe(
      map(response => (response.content || []).map(fromBackendPurchaseOrder))
    );
  }

  getPurchaseOrder(id: string): Observable<PurchaseOrder> {
    return this.get<PurchaseOrder>(`/purchase-orders/${id}`).pipe(map(fromBackendPurchaseOrder));
  }

  createPurchaseOrder(po: unknown): Observable<PurchaseOrder> {
    return this.post<PurchaseOrder>(`/purchase-orders`, toBackendPurchaseOrder(po)).pipe(map(fromBackendPurchaseOrder));
  }

  updatePurchaseOrder(id: string, po: unknown): Observable<PurchaseOrder> {
    return this.patch<PurchaseOrder>(`/purchase-orders/${id}`, toBackendPurchaseOrder(po)).pipe(map(fromBackendPurchaseOrder));
  }

  deletePurchaseOrder(id: string): Observable<unknown> {
    return this.delete(`/purchase-orders/${id}`);
  }

  // Campaigns
  getCampaigns(): Observable<Campaign[]> {
    return this.get<PageResponse<Campaign>>(`/campaigns`).pipe(
      map(response => (response.content || []).map(fromBackendCampaign))
    );
  }

  getCampaign(id: string): Observable<Campaign> {
    return this.get<Campaign>(`/campaigns/${id}`).pipe(map(fromBackendCampaign));
  }

  createCampaign(campaign: unknown): Observable<Campaign> {
    return this.post<Campaign>(`/campaigns`, toBackendCampaign(campaign)).pipe(map(fromBackendCampaign));
  }

  updateCampaign(id: string, campaign: unknown): Observable<Campaign> {
    return this.patch<Campaign>(`/campaigns/${id}`, toBackendCampaign(campaign)).pipe(map(fromBackendCampaign));
  }

  deleteCampaign(id: string): Observable<unknown> {
    return this.delete(`/campaigns/${id}`);
  }

  // WhatsApp campaigns
  createWhatsAppCampaign(payload: unknown): Observable<Campaign> {
    return this.post(`/campaigns/whatsapp`, payload);
  }

  launchCampaign(id: string): Observable<Campaign> {
    return this.post(`/campaigns/${id}/launch`, {});
  }

  getCampaignRecipients(id: string): Observable<CampaignRecipient[]> {
    return this.get<CampaignRecipient[]>(`/campaigns/${id}/recipients`);
  }

  getCampaignStats(id: string): Observable<CampaignStats> {
    return this.get(`/campaigns/${id}/stats`);
  }

  addCampaignRecipients(id: string, partnerIds: string[]): Observable<CampaignRecipient[]> {
    return this.post<CampaignRecipient[]>(`/campaigns/${id}/recipients`, { partnerIds });
  }

  cancelCampaignFollowups(id: string): Observable<{ cancelled: number }> {
    return this.post(`/campaigns/${id}/cancel-followups`, {});
  }

  // WhatsApp account
  getWhatsAppAccount(): Observable<WhatsAppAccount | null> {
    return this.get(`/whatsapp/account`);
  }

  connectWhatsAppAccount(payload: unknown): Observable<WhatsAppAccount> {
    return this.post(`/whatsapp/account`, payload);
  }

  connectMockWhatsAppAccount(): Observable<WhatsAppAccount> {
    return this.post(`/whatsapp/account/mock`, {});
  }

  simulateWhatsAppReply(phone: string, text: string): Observable<unknown> {
    return this.post(`/whatsapp/simulate/reply`, { phone, text });
  }

  // Automation Rules
  getAutomationRules(): Observable<AutomationRule[]> {
    return this.get<PageResponse<AutomationRule>>(`/automation-rules`).pipe(
      map(response => (response.content || []).map(fromBackendAutomationRule))
    );
  }

  getAutomationRule(id: string): Observable<AutomationRule> {
    return this.get<AutomationRule>(`/automation-rules/${id}`).pipe(map(fromBackendAutomationRule));
  }

  createAutomationRule(rule: unknown): Observable<AutomationRule> {
    return this.post<AutomationRule>(`/automation-rules`, toBackendAutomationRule(rule)).pipe(map(fromBackendAutomationRule));
  }

  updateAutomationRule(id: string, rule: unknown): Observable<AutomationRule> {
    return this.patch<AutomationRule>(`/automation-rules/${id}`, toBackendAutomationRule(rule)).pipe(map(fromBackendAutomationRule));
  }

  deleteAutomationRule(id: string): Observable<unknown> {
    return this.delete(`/automation-rules/${id}`);
  }

  // Files
  uploadFile(file: File, ownerEntityType: string, ownerEntityId: string): Observable<StoredFileDto> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('ownerEntityType', ownerEntityType);
    formData.append('ownerEntityId', ownerEntityId);
    return this.post(`/files`, formData);
  }

  getFilesForOwner(ownerEntityType: string, ownerEntityId: string): Observable<StoredFileDto[]> {
    return this.get<StoredFileDto[]>(`/files`, { ownerEntityType, ownerEntityId });
  }

  getFileDownloadUrl(id: string): string {
    return this.buildUrl(`/files/${id}`);
  }

  deleteFile(id: string): Observable<unknown> {
    return this.delete(`/files/${id}`);
  }

  // Notifications
  getNotifications(): Observable<Notification[]> {
    return this.get<PageResponse<Notification>>(`/notifications`).pipe(
      map(response => response.content || [])
    );
  }

  markNotificationRead(id: string): Observable<unknown> {
    return this.post(`/notifications/${id}/read`, {});
  }

  markAllNotificationsRead(): Observable<unknown> {
    return this.post(`/notifications/read-all`, {});
  }
}
