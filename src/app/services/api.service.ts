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

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  total_elements: number;
  total_pages: number;
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
      map(response => response.content || [])
    );
  }

  getDeal(id: string): Observable<Deal> {
    return this.get(`/deals/${id}`);
  }

  createDeal(deal: unknown): Observable<Deal> {
    return this.post(`/deals`, deal);
  }

  updateDeal(id: string, deal: unknown): Observable<Deal> {
    return this.patch(`/deals/${id}`, deal);
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
      map(response => response.content || [])
    );
  }

  getProposal(id: string): Observable<Proposal> {
    return this.get(`/proposals/${id}`);
  }

  createProposal(proposal: unknown): Observable<Proposal> {
    return this.post(`/proposals`, proposal);
  }

  updateProposal(id: string, proposal: unknown): Observable<Proposal> {
    return this.patch(`/proposals/${id}`, proposal);
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
      map(response => response.content || [])
    );
  }

  getTask(id: string): Observable<Task> {
    return this.get(`/tasks/${id}`);
  }

  createTask(task: unknown): Observable<Task> {
    return this.post(`/tasks`, task);
  }

  updateTask(id: string, task: unknown): Observable<Task> {
    return this.patch(`/tasks/${id}`, task);
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
    return this.get<PageResponse<Invoice>>(`/invoices`).pipe(
      map(response => response.content || [])
    );
  }

  getInvoice(id: string): Observable<Invoice> {
    return this.get(`/invoices/${id}`);
  }

  createInvoice(invoice: unknown): Observable<Invoice> {
    return this.post(`/invoices`, invoice);
  }

  updateInvoice(id: string, invoice: unknown): Observable<Invoice> {
    return this.patch(`/invoices/${id}`, invoice);
  }

  deleteInvoice(id: string): Observable<unknown> {
    return this.delete(`/invoices/${id}`);
  }

  // Purchase Orders
  getPurchaseOrders(): Observable<PurchaseOrder[]> {
    return this.get<PageResponse<PurchaseOrder>>(`/purchase-orders`).pipe(
      map(response => response.content || [])
    );
  }

  getPurchaseOrder(id: string): Observable<PurchaseOrder> {
    return this.get(`/purchase-orders/${id}`);
  }

  createPurchaseOrder(po: unknown): Observable<PurchaseOrder> {
    return this.post(`/purchase-orders`, po);
  }

  updatePurchaseOrder(id: string, po: unknown): Observable<PurchaseOrder> {
    return this.patch(`/purchase-orders/${id}`, po);
  }

  deletePurchaseOrder(id: string): Observable<unknown> {
    return this.delete(`/purchase-orders/${id}`);
  }

  // Campaigns
  getCampaigns(): Observable<Campaign[]> {
    return this.get<PageResponse<Campaign>>(`/campaigns`).pipe(
      map(response => response.content || [])
    );
  }

  getCampaign(id: string): Observable<Campaign> {
    return this.get(`/campaigns/${id}`);
  }

  createCampaign(campaign: unknown): Observable<Campaign> {
    return this.post(`/campaigns`, campaign);
  }

  updateCampaign(id: string, campaign: unknown): Observable<Campaign> {
    return this.patch(`/campaigns/${id}`, campaign);
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
      map(response => response.content || [])
    );
  }

  getAutomationRule(id: string): Observable<AutomationRule> {
    return this.get(`/automation-rules/${id}`);
  }

  createAutomationRule(rule: unknown): Observable<AutomationRule> {
    return this.post(`/automation-rules`, rule);
  }

  updateAutomationRule(id: string, rule: unknown): Observable<AutomationRule> {
    return this.patch(`/automation-rules/${id}`, rule);
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
