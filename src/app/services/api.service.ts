import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { BaseApiService } from '../core/services/base-api.service';
import { CurrentUser } from '../core/services/auth-api.service';

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
  getOrganization(): Observable<unknown> {
    return this.get(`/organizations/me`);
  }

  updateOrganization(patch: unknown): Observable<unknown> {
    return this.patch(`/organizations/me`, patch);
  }

  // Users
  getUsers(): Observable<unknown[]> {
    return this.get<PageResponse<unknown>>(`/users`).pipe(
      map(response => (response as unknown).content || [])
    );
  }

  getUser(id: string): Observable<unknown> {
    return this.get(`/users/${id}`);
  }

  createUser(user: unknown): Observable<unknown> {
    return this.post(`/users`, user);
  }

  updateUser(id: string, user: unknown): Observable<unknown> {
    return this.patch(`/users/${id}`, user);
  }

  updateOwnProfile(patch: unknown): Observable<unknown> {
    return this.patch(`/users/me`, patch);
  }

  deactivateUser(id: string): Observable<unknown> {
    return this.post(`/users/${id}/deactivate`, {});
  }

  // Teams
  getTeams(): Observable<unknown[]> {
    return this.get<PageResponse<unknown>>(`/teams`).pipe(
      map(response => response.content || [])
    );
  }

  getTeam(id: string): Observable<unknown> {
    return this.get(`/teams/${id}`);
  }

  createTeam(team: unknown): Observable<unknown> {
    return this.post(`/teams`, team);
  }

  updateTeam(id: string, team: unknown): Observable<unknown> {
    return this.patch(`/teams/${id}`, team);
  }

  deleteTeam(id: string): Observable<unknown> {
    return this.delete(`/teams/${id}`);
  }

  // Groups
  getGroups(): Observable<unknown[]> {
    return this.get<PageResponse<unknown>>(`/groups`).pipe(
      map(response => response.content || [])
    );
  }

  getGroup(id: string): Observable<unknown> {
    return this.get(`/groups/${id}`);
  }

  createGroup(group: unknown): Observable<unknown> {
    return this.post(`/groups`, group);
  }

  updateGroup(id: string, group: unknown): Observable<unknown> {
    return this.patch(`/groups/${id}`, group);
  }

  deleteGroup(id: string): Observable<unknown> {
    return this.delete(`/groups/${id}`);
  }

  // Messages
  getGroupMessages(groupId: string): Observable<unknown[]> {
    return this.get<PageResponse<unknown>>(`/groups/${groupId}/messages`).pipe(
      map(response => response.content || [])
    );
  }

  createGroupMessage(groupId: string, message: unknown): Observable<unknown> {
    return this.post(`/groups/${groupId}/messages`, message);
  }

  // Meetings
  getGroupMeetings(groupId: string): Observable<unknown[]> {
    return this.get<PageResponse<unknown>>(`/groups/${groupId}/meetings`).pipe(
      map(response => response.content || [])
    );
  }

  createGroupMeeting(groupId: string, meeting: unknown): Observable<unknown> {
    return this.post(`/groups/${groupId}/meetings`, meeting);
  }

  // Partners/Leads
  // NOTE: the backend does not support filtering /partners by a `type` query
  // param — it only accepts Pageable params on that route. Type/stage
  // filtering is exposed via dedicated path-variable endpoints instead.
  getPartners(): Observable<unknown[]> {
    return this.get<PageResponse<unknown>>(`/partners`).pipe(
      map(response => response.content || [])
    );
  }

  getPartnersByType(type: string): Observable<unknown[]> {
    return this.get<PageResponse<unknown>>(`/partners/type/${type}`).pipe(
      map(response => response.content || [])
    );
  }

  getPartnersByStage(stage: string): Observable<unknown[]> {
    return this.get<PageResponse<unknown>>(`/partners/stage/${stage}`).pipe(
      map(response => response.content || [])
    );
  }

  getPartner(id: string): Observable<unknown> {
    return this.get(`/partners/${id}`);
  }

  createPartner(partner: unknown): Observable<unknown> {
    return this.post(`/partners`, partner);
  }

  updatePartner(id: string, partner: unknown): Observable<unknown> {
    return this.patch(`/partners/${id}`, partner);
  }

  deletePartner(id: string): Observable<unknown> {
    return this.delete(`/partners/${id}`);
  }

  // Lead (Partner) sub-resources
  getLeadContacts(partnerId: string): Observable<unknown[]> {
    return this.get<unknown[]>(`/partners/${partnerId}/contacts`);
  }

  createLeadContact(partnerId: string, contact: unknown): Observable<unknown> {
    return this.post(`/partners/${partnerId}/contacts`, contact);
  }

  updateLeadContact(partnerId: string, contactId: string, contact: unknown): Observable<unknown> {
    return this.patch(`/partners/${partnerId}/contacts/${contactId}`, contact);
  }

  deleteLeadContact(partnerId: string, contactId: string): Observable<unknown> {
    return this.delete(`/partners/${partnerId}/contacts/${contactId}`);
  }

  getLeadActivities(partnerId: string): Observable<unknown[]> {
    return this.get<unknown[]>(`/partners/${partnerId}/activities`);
  }

  createLeadActivity(partnerId: string, activity: unknown): Observable<unknown> {
    return this.post(`/partners/${partnerId}/activities`, activity);
  }

  deleteLeadActivity(partnerId: string, activityId: string): Observable<unknown> {
    return this.delete(`/partners/${partnerId}/activities/${activityId}`);
  }

  getLeadStatusHistory(partnerId: string): Observable<unknown[]> {
    return this.get<unknown[]>(`/partners/${partnerId}/status-history`);
  }

  createLeadStatusHistory(partnerId: string, entry: unknown): Observable<unknown> {
    return this.post(`/partners/${partnerId}/status-history`, entry);
  }

  getCustomerCard(partnerId: string): Observable<unknown> {
    return this.get(`/partners/${partnerId}/customer-card`);
  }

  saveCustomerCard(partnerId: string, card: unknown): Observable<unknown> {
    return this.post(`/partners/${partnerId}/customer-card`, card);
  }

  // Deals
  getDeals(): Observable<unknown[]> {
    return this.get<PageResponse<unknown>>(`/deals`).pipe(
      map(response => response.content || [])
    );
  }

  getDeal(id: string): Observable<unknown> {
    return this.get(`/deals/${id}`);
  }

  createDeal(deal: unknown): Observable<unknown> {
    return this.post(`/deals`, deal);
  }

  updateDeal(id: string, deal: unknown): Observable<unknown> {
    return this.patch(`/deals/${id}`, deal);
  }

  deleteDeal(id: string): Observable<unknown> {
    return this.delete(`/deals/${id}`);
  }

  // Deal Activities
  getDealActivities(dealId: string): Observable<unknown[]> {
    return this.get<unknown[]>(`/deals/${dealId}/activities`);
  }

  createDealActivity(dealId: string, activity: unknown): Observable<unknown> {
    return this.post(`/deals/${dealId}/activities`, activity);
  }

  updateDealActivity(dealId: string, activityId: string, activity: unknown): Observable<unknown> {
    return this.patch(`/deals/${dealId}/activities/${activityId}`, activity);
  }

  deleteDealActivity(dealId: string, activityId: string): Observable<unknown> {
    return this.delete(`/deals/${dealId}/activities/${activityId}`);
  }

  // Proposals
  getProposals(): Observable<unknown[]> {
    return this.get<PageResponse<unknown>>(`/proposals`).pipe(
      map(response => response.content || [])
    );
  }

  getProposal(id: string): Observable<unknown> {
    return this.get(`/proposals/${id}`);
  }

  createProposal(proposal: unknown): Observable<unknown> {
    return this.post(`/proposals`, proposal);
  }

  updateProposal(id: string, proposal: unknown): Observable<unknown> {
    return this.patch(`/proposals/${id}`, proposal);
  }

  deleteProposal(id: string): Observable<unknown> {
    return this.delete(`/proposals/${id}`);
  }

  // Proposal Templates
  getProposalTemplates(): Observable<unknown[]> {
    return this.get<PageResponse<unknown>>(`/proposal-templates`).pipe(
      map(response => response.content || [])
    );
  }

  createProposalTemplate(template: unknown): Observable<unknown> {
    return this.post(`/proposal-templates`, template);
  }

  updateProposalTemplate(id: string, template: unknown): Observable<unknown> {
    return this.patch(`/proposal-templates/${id}`, template);
  }

  deleteProposalTemplate(id: string): Observable<unknown> {
    return this.delete(`/proposal-templates/${id}`);
  }

  // Tasks
  getTasks(): Observable<unknown[]> {
    return this.get<PageResponse<unknown>>(`/tasks`).pipe(
      map(response => response.content || [])
    );
  }

  getTask(id: string): Observable<unknown> {
    return this.get(`/tasks/${id}`);
  }

  createTask(task: unknown): Observable<unknown> {
    return this.post(`/tasks`, task);
  }

  updateTask(id: string, task: unknown): Observable<unknown> {
    return this.patch(`/tasks/${id}`, task);
  }

  deleteTask(id: string): Observable<unknown> {
    return this.delete(`/tasks/${id}`);
  }

  // Tickets
  getTickets(): Observable<unknown[]> {
    return this.get<PageResponse<unknown>>(`/tickets`).pipe(
      map(response => response.content || [])
    );
  }

  getTicket(id: string): Observable<unknown> {
    return this.get(`/tickets/${id}`);
  }

  createTicket(ticket: unknown): Observable<unknown> {
    return this.post(`/tickets`, ticket);
  }

  updateTicket(id: string, ticket: unknown): Observable<unknown> {
    return this.patch(`/tickets/${id}`, ticket);
  }

  deleteTicket(id: string): Observable<unknown> {
    return this.delete(`/tickets/${id}`);
  }

  // Invoices
  getInvoices(): Observable<unknown[]> {
    return this.get<PageResponse<unknown>>(`/invoices`).pipe(
      map(response => response.content || [])
    );
  }

  getInvoice(id: string): Observable<unknown> {
    return this.get(`/invoices/${id}`);
  }

  createInvoice(invoice: unknown): Observable<unknown> {
    return this.post(`/invoices`, invoice);
  }

  updateInvoice(id: string, invoice: unknown): Observable<unknown> {
    return this.patch(`/invoices/${id}`, invoice);
  }

  deleteInvoice(id: string): Observable<unknown> {
    return this.delete(`/invoices/${id}`);
  }

  // Purchase Orders
  getPurchaseOrders(): Observable<unknown[]> {
    return this.get<PageResponse<unknown>>(`/purchase-orders`).pipe(
      map(response => response.content || [])
    );
  }

  getPurchaseOrder(id: string): Observable<unknown> {
    return this.get(`/purchase-orders/${id}`);
  }

  createPurchaseOrder(po: unknown): Observable<unknown> {
    return this.post(`/purchase-orders`, po);
  }

  updatePurchaseOrder(id: string, po: unknown): Observable<unknown> {
    return this.patch(`/purchase-orders/${id}`, po);
  }

  deletePurchaseOrder(id: string): Observable<unknown> {
    return this.delete(`/purchase-orders/${id}`);
  }

  // Campaigns
  getCampaigns(): Observable<unknown[]> {
    return this.get<PageResponse<unknown>>(`/campaigns`).pipe(
      map(response => response.content || [])
    );
  }

  getCampaign(id: string): Observable<unknown> {
    return this.get(`/campaigns/${id}`);
  }

  createCampaign(campaign: unknown): Observable<unknown> {
    return this.post(`/campaigns`, campaign);
  }

  updateCampaign(id: string, campaign: unknown): Observable<unknown> {
    return this.patch(`/campaigns/${id}`, campaign);
  }

  deleteCampaign(id: string): Observable<unknown> {
    return this.delete(`/campaigns/${id}`);
  }

  // WhatsApp campaigns
  createWhatsAppCampaign(payload: unknown): Observable<unknown> {
    return this.post(`/campaigns/whatsapp`, payload);
  }

  launchCampaign(id: string): Observable<unknown> {
    return this.post(`/campaigns/${id}/launch`, {});
  }

  getCampaignRecipients(id: string): Observable<unknown[]> {
    return this.get<unknown[]>(`/campaigns/${id}/recipients`);
  }

  getCampaignStats(id: string): Observable<unknown> {
    return this.get(`/campaigns/${id}/stats`);
  }

  addCampaignRecipients(id: string, partnerIds: string[]): Observable<unknown[]> {
    return this.post<unknown[]>(`/campaigns/${id}/recipients`, { partnerIds });
  }

  cancelCampaignFollowups(id: string): Observable<unknown> {
    return this.post(`/campaigns/${id}/cancel-followups`, {});
  }

  // WhatsApp account
  getWhatsAppAccount(): Observable<unknown> {
    return this.get(`/whatsapp/account`);
  }

  connectWhatsAppAccount(payload: unknown): Observable<unknown> {
    return this.post(`/whatsapp/account`, payload);
  }

  connectMockWhatsAppAccount(): Observable<unknown> {
    return this.post(`/whatsapp/account/mock`, {});
  }

  simulateWhatsAppReply(phone: string, text: string): Observable<unknown> {
    return this.post(`/whatsapp/simulate/reply`, { phone, text });
  }

  // Automation Rules
  getAutomationRules(): Observable<unknown[]> {
    return this.get<PageResponse<unknown>>(`/automation-rules`).pipe(
      map(response => response.content || [])
    );
  }

  getAutomationRule(id: string): Observable<unknown> {
    return this.get(`/automation-rules/${id}`);
  }

  createAutomationRule(rule: unknown): Observable<unknown> {
    return this.post(`/automation-rules`, rule);
  }

  updateAutomationRule(id: string, rule: unknown): Observable<unknown> {
    return this.patch(`/automation-rules/${id}`, rule);
  }

  deleteAutomationRule(id: string): Observable<unknown> {
    return this.delete(`/automation-rules/${id}`);
  }

  // Files
  uploadFile(file: File, ownerEntityType: string, ownerEntityId: string): Observable<unknown> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('ownerEntityType', ownerEntityType);
    formData.append('ownerEntityId', ownerEntityId);
    return this.post(`/files`, formData);
  }

  getFilesForOwner(ownerEntityType: string, ownerEntityId: string): Observable<unknown[]> {
    return this.get<unknown[]>(`/files`, { ownerEntityType, ownerEntityId });
  }

  getFileDownloadUrl(id: string): string {
    return this.buildUrl(`/files/${id}`);
  }

  deleteFile(id: string): Observable<unknown> {
    return this.delete(`/files/${id}`);
  }

  // Notifications
  getNotifications(): Observable<unknown[]> {
    return this.get<PageResponse<unknown>>(`/notifications`).pipe(
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
