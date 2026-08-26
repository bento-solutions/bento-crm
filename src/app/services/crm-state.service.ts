import { Injectable, signal, computed, inject, effect } from '@angular/core';
import { Router } from '@angular/router';
import { ToastService } from './toast.service';
import { ApiService } from './api.service';
import { TranslationService } from './translation.service';
import { TasksService } from './domains/tasks.service';
import { TicketsService } from './domains/tickets.service';
import { isSupportedLanguage } from '../core/i18n/language';

export interface Organization {
  id: string;
  name: string;
  logoInitials: string;
  logoColor: string;
  industry: string;
  timezone: string;
  fiscalYearStart: number;
  createdAt: Date;
}

export type RoleId = 'admin' | 'manager' | 'salesperson' | 'support' | 'viewer';

export interface CrmRole {
  id: RoleId;
  label: string;
  description: string;
  permissions: {
    canManageUsers: boolean;
    canManageTeams: boolean;
    canManageRoles: boolean;
    canViewAllDeals: boolean;
    canDeleteRecords: boolean;
    canCreateGroups: boolean;
    canScheduleMeetings: boolean;
  };
}

export interface CrmUser {
  id: string;
  displayName: string;
  name: string;              // For backward compatibility (same as displayName)
  email: string;
  initials: string;
  avatarColor: string;
  roleId: RoleId;
  role: string;              // For backward compatibility (derived from roleId)
  teamId: string | null;
  team: 'Sales' | 'Operations' | 'Finance' | 'Support' | null; // For backward compatibility
  isActive: boolean;
  phone?: string;
  jobTitle?: string;
  preferences: {
    language: 'en' | 'fr' | 'ar';
    theme: 'light' | 'dark' | 'system';
    notifyOnLeadAssign: boolean;
    notifyOnDealUpdate: boolean;
    notifyOnMention: boolean;
  };
  createdAt: Date;
  lastActiveAt: Date;
}

export interface CrmTeam {
  id: string;
  name: string;
  department: 'Sales' | 'Operations' | 'Finance' | 'Support' | 'Custom';
  description?: string;
  leadUserId: string;
  memberUserIds: string[];
  color: string;
  createdAt: Date;
}

export interface CrmGroup {
  id: string;
  name: string;
  description?: string;
  createdByUserId: string;
  memberUserIds: string[];
  createdAt: Date;
}

export interface GroupMessage {
  id: string;
  groupId: string;
  senderUserId: string;
  content: string;
  sentAt: Date;
  readByUserIds: string[];
}

export interface GroupMeeting {
  id: string;
  groupId: string;
  title: string;
  description?: string;
  scheduledAt: Date;
  durationMinutes: number;
  organizerUserId: string;
  attendeeUserIds: string[];
  status: 'scheduled' | 'cancelled' | 'completed';
}

export const CRM_ROLES: CrmRole[] = [
  {
    id: 'admin',
    label: 'Admin',
    description: 'Full access to all settings and records',
    permissions: {
      canManageUsers: true,
      canManageTeams: true,
      canManageRoles: true,
      canViewAllDeals: true,
      canDeleteRecords: true,
      canCreateGroups: true,
      canScheduleMeetings: true
    }
  },
  {
    id: 'manager',
    label: 'Manager',
    description: 'Manage team members and view all deals',
    permissions: {
      canManageUsers: true,
      canManageTeams: true,
      canManageRoles: false,
      canViewAllDeals: true,
      canDeleteRecords: false,
      canCreateGroups: true,
      canScheduleMeetings: true
    }
  },
  {
    id: 'salesperson',
    label: 'Sales',
    description: 'Create and update leads and deals',
    permissions: {
      canManageUsers: false,
      canManageTeams: false,
      canManageRoles: false,
      canViewAllDeals: false,
      canDeleteRecords: false,
      canCreateGroups: true,
      canScheduleMeetings: true
    }
  },
  {
    id: 'support',
    label: 'Support',
    description: 'Manage support tickets and communications',
    permissions: {
      canManageUsers: false,
      canManageTeams: false,
      canManageRoles: false,
      canViewAllDeals: false,
      canDeleteRecords: false,
      canCreateGroups: true,
      canScheduleMeetings: true
    }
  },
  {
    id: 'viewer',
    label: 'Viewer',
    description: 'Read-only access across all modules',
    permissions: {
      canManageUsers: false,
      canManageTeams: false,
      canManageRoles: false,
      canViewAllDeals: false,
      canDeleteRecords: false,
      canCreateGroups: false,
      canScheduleMeetings: false
    }
  }
];

// Mirrors the backend's Permission.forRole() (com.bento.crm.common.model.Permission) exactly,
// authority name for authority name, so the UI can proactively hide/disable actions the backend
// would 403 on instead of only finding out after the request round-trips. There is no endpoint
// that serves this matrix today, so it's duplicated here by hand -- if a role's authorities
// change on the backend, this map must be updated to match.
export const AUTHORITIES_BY_ROLE: Record<RoleId, ReadonlySet<string>> = {
  admin: new Set([
    'PARTNERS_READ', 'PARTNERS_CREATE', 'PARTNERS_WRITE', 'PARTNERS_DELETE',
    'DEALS_READ', 'DEALS_CREATE', 'DEALS_WRITE', 'DEALS_DELETE',
    'DEAL_ACTIVITIES_READ', 'DEAL_ACTIVITIES_CREATE', 'DEAL_ACTIVITIES_WRITE', 'DEAL_ACTIVITIES_DELETE',
    'PROPOSALS_READ', 'PROPOSALS_CREATE', 'PROPOSALS_WRITE', 'PROPOSALS_DELETE',
    'PURCHASE_ORDERS_READ', 'PURCHASE_ORDERS_CREATE', 'PURCHASE_ORDERS_WRITE', 'PURCHASE_ORDERS_DELETE',
    'INVOICES_READ', 'INVOICES_CREATE', 'INVOICES_WRITE', 'INVOICES_DELETE',
    'TICKETS_READ', 'TICKETS_CREATE', 'TICKETS_WRITE', 'TICKETS_DELETE',
    'TASKS_READ', 'TASKS_CREATE', 'TASKS_WRITE', 'TASKS_DELETE',
    'CAMPAIGNS_READ', 'CAMPAIGNS_CREATE', 'CAMPAIGNS_WRITE', 'CAMPAIGNS_DELETE',
    'AUTOMATION_RULES_READ', 'AUTOMATION_RULES_CREATE', 'AUTOMATION_RULES_WRITE', 'AUTOMATION_RULES_DELETE',
    'USERS_READ', 'USERS_WRITE',
    'TEAMS_READ', 'TEAMS_WRITE', 'TEAMS_CREATE', 'TEAMS_DELETE',
    'GROUPS_READ', 'GROUPS_CREATE', 'GROUPS_WRITE', 'GROUPS_DELETE',
    'ANALYTICS_READ', 'ADMIN_ACCESS'
  ]),
  manager: new Set([
    'PARTNERS_READ', 'PARTNERS_CREATE', 'PARTNERS_WRITE',
    'DEALS_READ', 'DEALS_CREATE', 'DEALS_WRITE',
    'DEAL_ACTIVITIES_READ', 'DEAL_ACTIVITIES_CREATE', 'DEAL_ACTIVITIES_WRITE',
    'PROPOSALS_READ', 'PROPOSALS_CREATE', 'PROPOSALS_WRITE',
    'PURCHASE_ORDERS_READ', 'PURCHASE_ORDERS_CREATE', 'PURCHASE_ORDERS_WRITE',
    'INVOICES_READ', 'INVOICES_CREATE', 'INVOICES_WRITE',
    'TICKETS_READ', 'TICKETS_WRITE',
    'TASKS_READ', 'TASKS_CREATE', 'TASKS_WRITE',
    'CAMPAIGNS_READ', 'CAMPAIGNS_CREATE', 'CAMPAIGNS_WRITE',
    'AUTOMATION_RULES_READ', 'AUTOMATION_RULES_CREATE', 'AUTOMATION_RULES_WRITE',
    'USERS_READ', 'TEAMS_READ', 'TEAMS_WRITE',
    'GROUPS_READ', 'GROUPS_CREATE', 'GROUPS_WRITE',
    'ANALYTICS_READ'
  ]),
  salesperson: new Set([
    'PARTNERS_READ', 'PARTNERS_CREATE', 'PARTNERS_WRITE',
    'DEALS_READ', 'DEALS_CREATE', 'DEALS_WRITE',
    'DEAL_ACTIVITIES_READ', 'DEAL_ACTIVITIES_CREATE', 'DEAL_ACTIVITIES_WRITE',
    'PROPOSALS_READ', 'PROPOSALS_CREATE', 'PROPOSALS_WRITE',
    'TASKS_READ', 'TASKS_CREATE', 'TASKS_WRITE',
    'GROUPS_READ', 'ANALYTICS_READ'
  ]),
  support: new Set([
    'PARTNERS_READ', 'PARTNERS_WRITE',
    'TICKETS_READ', 'TICKETS_CREATE', 'TICKETS_WRITE',
    'TASKS_READ', 'TASKS_CREATE', 'TASKS_WRITE',
    'GROUPS_READ', 'ANALYTICS_READ'
  ]),
  viewer: new Set([
    'PARTNERS_READ', 'DEALS_READ', 'DEAL_ACTIVITIES_READ', 'PROPOSALS_READ',
    'TICKETS_READ', 'TASKS_READ', 'GROUPS_READ', 'ANALYTICS_READ'
  ])
};

const AVATAR_COLORS = [
  '#7F77DD',  // purple
  '#1D9E75',  // teal
  '#D85A30',  // coral
  '#378ADD',  // blue
  '#BA7517',  // amber
  '#D4537E'   // pink
];

export type PartnerType = 'Customer' | 'Prospect' | 'Vendor' | 'Lead';

export interface Customer360Contact {
  name: string;
  jobTitle: string;
  email?: string;
  phone?: string;
}

export interface Customer360Order {
  id: string;
  title: string;
  stage: DealStage;
  amount: number;
  date?: string;
}

export interface Customer360Meeting {
  id: string;
  date: string;
  title: string;
  type: string;
}

export interface Customer360Ticket {
  id: string;
  title: string;
  status: TicketStatus;
  priority: string;
}

export interface Customer360Invoice {
  id: string;
  amount: number;
  status: InvoiceStatus;
  dueDate: string;
}

export interface Customer360View {
  partner: Partner;
  contacts: Customer360Contact[];
  orders: Customer360Order[];
  meetings: Customer360Meeting[];
  tickets: Customer360Ticket[];
  invoices: Customer360Invoice[];
}

export type TaskStatus = 'Pending' | 'In Progress' | 'Completed';
export type ProposalStage = 'New Lead' | 'Qualified' | 'Meeting Scheduled' | 'Proposal Sent' | 'Negotiation' | 'Won / Lost';
export type DealStage = 'New' | 'Proposal sent' | 'Confirmed' | 'Awaiting Invoicing' | 'Invoiced' | 'Closed Won' | 'Closed Lost' | ProposalStage;
export type InvoiceStatus = 'Pending' | 'Paid' | 'Overdue' | 'Draft';
export type CampaignType = 'WhatsApp' | 'SMS' | 'Email';
export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
export type TicketPriority = 'URGENT' | 'MEDIUM' | 'LOW';

// ──────────────────────────────────────────────────────────────────────────────
// Workflow Automation Types
// ──────────────────────────────────────────────────────────────────────────────
export type AutomationTrigger =
  | 'LeadCreated'
  | 'LeadUpdated'
  | 'DealCreated'
  | 'DealUpdated'
  | 'TicketCreated'
  | 'TicketUpdated';

export interface FieldDescriptor {
  key: string;
  label: string;
  type: 'string' | 'number' | 'enum' | 'date' | 'boolean';
  allowedValues?: string[];
  path: string;
}

export type ConditionOperator =
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'notContains'
  | 'greaterThan'
  | 'lessThan'
  | 'greaterThanOrEqual'
  | 'lessThanOrEqual'
  | 'isEmpty'
  | 'isNotEmpty';

export interface AutomationCondition {
  fieldKey: string;
  operator: ConditionOperator;
  value?: string | number | boolean;
}

export interface AutomationRuleGroup {
  id: string;
  logicalOperator: 'AND';
  conditions: AutomationCondition[];
}

export type AutomationActionType =
  | 'AssignSalesperson'
  | 'CreateFollowUpTask'
  | 'SendEmailLog'
  | 'NotifyManager'
  | 'UpdateEntityField'
  | 'ChangeStage'
  | 'CreateNote'
  | 'AddTag'
  | 'SetDueDate'
  | 'WebhookCall';

export interface AutomationAction {
  id: string;
  type: AutomationActionType;
  params: {
    assignee?: string;
    taskTitle?: string;
    taskDescription?: string;
    taskDueDateOffsetDays?: number;
    emailSubject?: string;
    emailBody?: string;
    emailFrom?: string;
    emailTo?: string;
    targetTeam?: 'Sales' | 'Operations' | 'Finance' | 'Support';
    taskTeam?: 'Sales' | 'Operations' | 'Finance' | 'Support';
    fieldKey?: string;
    fieldValue?: string | number;
    targetStage?: string;
    noteContent?: string;
    tagName?: string;
    webhookUrl?: string;
  };
}

export interface AutomationRule {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  isTemplate?: boolean;
  trigger: AutomationTrigger;
  conditionGroups: AutomationRuleGroup[];
  actions: AutomationAction[];
  priority: number;
  stopOnMatch: boolean;
  conflictStrategy: 'first-wins' | 'all-execute';
  version?: number;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  lastModifiedBy?: string;
  changeHistory?: {
    version: number;
    changedAt: string;
    changedBy: string;
    snapshot: object;
  }[];
  executionCount?: number;
}

export interface AutomationExecutionLog {
  id: string;
  ruleId: string;
  ruleName: string;
  ruleVersion: number;
  trigger: AutomationTrigger;
  entityType: 'Lead' | 'Deal' | 'Ticket';
  entityId: string;
  entityLabel: string;
  executedAt: string;
  dryRun: boolean;
  conditionsTrace: {
    groupId: string;
    passed: boolean;
    conditions: { fieldKey: string; expected: unknown; actual: unknown; passed: boolean }[];
  }[];
  actionsExecuted: { actionId: string; type: AutomationActionType; status: 'ok' | 'error'; error?: string }[];
  status: 'success' | 'partial' | 'failed';
}

export const TRIGGER_FIELD_MAP: Record<AutomationTrigger, FieldDescriptor[]> = {
  LeadCreated: [
    { key: 'name', label: 'Name', type: 'string', path: 'name' },
    { key: 'companyName', label: 'Company Name', type: 'string', path: 'companyName' },
    { key: 'status', label: 'Status', type: 'enum', allowedValues: ['New', 'Contacted', 'Attempted Contact', 'Meeting Scheduled', 'Qualified', 'Proposal Requested', 'Converted', 'Lost', 'Disqualified'], path: 'status' },
    { key: 'qualification', label: 'Qualification', type: 'enum', allowedValues: ['Qualified', 'Unqualified', 'Pending'], path: 'qualification' },
    { key: 'priority', label: 'Priority', type: 'enum', allowedValues: ['Low', 'Medium', 'High'], path: 'priority' },
    { key: 'score', label: 'Score', type: 'number', path: 'score' },
    { key: 'temperature', label: 'Temperature', type: 'enum', allowedValues: ['Cold', 'Warm', 'Hot'], path: 'temperature' },
    { key: 'stage', label: 'Stage', type: 'string', path: 'stage' },
    { key: 'assignedSalesperson', label: 'Assigned Salesperson', type: 'string', path: 'assignedSalesperson' },
    { key: 'estimatedDealValue', label: 'Estimated Deal Value', type: 'number', path: 'estimatedDealValue' },
    { key: 'probability', label: 'Probability', type: 'number', path: 'probability' }
  ],
  LeadUpdated: [
    { key: 'name', label: 'Name', type: 'string', path: 'name' },
    { key: 'companyName', label: 'Company Name', type: 'string', path: 'companyName' },
    { key: 'status', label: 'Status', type: 'enum', allowedValues: ['New', 'Contacted', 'Attempted Contact', 'Meeting Scheduled', 'Qualified', 'Proposal Requested', 'Converted', 'Lost', 'Disqualified'], path: 'status' },
    { key: 'qualification', label: 'Qualification', type: 'enum', allowedValues: ['Qualified', 'Unqualified', 'Pending'], path: 'qualification' },
    { key: 'priority', label: 'Priority', type: 'enum', allowedValues: ['Low', 'Medium', 'High'], path: 'priority' },
    { key: 'score', label: 'Score', type: 'number', path: 'score' },
    { key: 'temperature', label: 'Temperature', type: 'enum', allowedValues: ['Cold', 'Warm', 'Hot'], path: 'temperature' },
    { key: 'stage', label: 'Stage', type: 'string', path: 'stage' },
    { key: 'assignedSalesperson', label: 'Assigned Salesperson', type: 'string', path: 'assignedSalesperson' },
    { key: 'estimatedDealValue', label: 'Estimated Deal Value', type: 'number', path: 'estimatedDealValue' },
    { key: 'probability', label: 'Probability', type: 'number', path: 'probability' }
  ],
  DealCreated: [
    { key: 'title', label: 'Title', type: 'string', path: 'title' },
    { key: 'amount', label: 'Amount', type: 'number', path: 'amount' },
    { key: 'stage', label: 'Stage', type: 'enum', allowedValues: ['New', 'Proposal sent', 'Confirmed', 'Awaiting Invoicing', 'Invoiced', 'Closed Won', 'Closed Lost'], path: 'stage' },
    { key: 'customerAccount', label: 'Customer Account', type: 'string', path: 'customerAccount' },
    { key: 'contactPerson', label: 'Contact Person', type: 'string', path: 'contactPerson' },
    { key: 'salesPerson', label: 'Salesperson', type: 'string', path: 'salesPerson' },
    { key: 'orderStatus', label: 'Order Status', type: 'string', path: 'orderStatus' }
  ],
  DealUpdated: [
    { key: 'title', label: 'Title', type: 'string', path: 'title' },
    { key: 'amount', label: 'Amount', type: 'number', path: 'amount' },
    { key: 'stage', label: 'Stage', type: 'enum', allowedValues: ['New', 'Proposal sent', 'Confirmed', 'Awaiting Invoicing', 'Invoiced', 'Closed Won', 'Closed Lost'], path: 'stage' },
    { key: 'customerAccount', label: 'Customer Account', type: 'string', path: 'customerAccount' },
    { key: 'contactPerson', label: 'Contact Person', type: 'string', path: 'contactPerson' },
    { key: 'salesPerson', label: 'Salesperson', type: 'string', path: 'salesPerson' },
    { key: 'orderStatus', label: 'Order Status', type: 'string', path: 'orderStatus' }
  ],
  TicketCreated: [
    { key: 'title', label: 'Title', type: 'string', path: 'title' },
    { key: 'assignedTo', label: 'Assigned To', type: 'string', path: 'assignedTo' },
    { key: 'status', label: 'Status', type: 'enum', allowedValues: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'], path: 'status' },
    { key: 'priority', label: 'Priority', type: 'enum', allowedValues: ['URGENT', 'MEDIUM', 'LOW'], path: 'priority' }
  ],
  TicketUpdated: [
    { key: 'title', label: 'Title', type: 'string', path: 'title' },
    { key: 'assignedTo', label: 'Assigned To', type: 'string', path: 'assignedTo' },
    { key: 'status', label: 'Status', type: 'enum', allowedValues: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'], path: 'status' },
    { key: 'priority', label: 'Priority', type: 'enum', allowedValues: ['URGENT', 'MEDIUM', 'LOW'], path: 'priority' }
  ]
};

export interface LeadCompany {
  industry?: string;
  size?: string;
  annualRevenue?: string;
  country?: string;
  city?: string;
  address?: string;
  officesCount?: number;
}

export interface LeadContact {
  id: string;
  name: string;
  jobTitle?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  website?: string;
  linkedin?: string;
}

export interface LeadActivity {
  id: string;
  type: 'Call' | 'Email' | 'Meeting' | 'Note' | 'Task';
  date: string;
  summary: string;
  detail?: string;
  assignedTo?: string;
  nextFollowUp?: string;
}

export interface LeadAttachment {
  id: string;
  fileName: string;
  fileSize?: string;
  uploadedAt: string;
  fileId?: string;
}

export interface LeadStatusHistory {
  status: string;
  timestamp: string;
  user: string;
}

export interface LeadProductInterest {
  product: string;
  solution?: string;
  usersCount?: number;
}

export type LeadOrigin = 'Landing Page' | 'Marketing Campaign' | 'Email' | 'WhatsApp' | 'Facebook' | 'Other';

export interface LeadCampaign {
  source: string;
  campaign?: string;
  referralPartner?: string;
  tradeShow?: string;
  marketingCampaign?: string;
  socialMedia?: string;
  salesReferral?: string;
}

export interface Lead {
  id: string;
  name: string;
  companyName: string;
  origin?: LeadOrigin;
  status: 'New' | 'Contacted' | 'Attempted Contact' | 'Meeting Scheduled' | 'Qualified' | 'Proposal Requested' | 'Converted' | 'Lost' | 'Disqualified';
  qualification: 'Qualified' | 'Unqualified' | 'Pending';
  priority: 'Low' | 'Medium' | 'High';
  score: number; // 0-100
  temperature: 'Cold' | 'Warm' | 'Hot';
  stage: string;
  assignedSalesperson?: string;
  salesTeam?: string;
  territory?: string;
  businessUnit?: string;

  // Decision makers
  decisionMaker?: string;
  influencer?: string;
  financeContact?: string;
  technicalContact?: string;

  // Sales probability
  estimatedDealValue?: number;
  probability?: number; // percentage
  expectedCloseDate?: string;

  // Audit
  createdDate: string;
  createdBy?: string;
  modifiedDate: string;
  modifiedBy: string;

  company?: LeadCompany;
  contacts?: LeadContact[];
  activities?: LeadActivity[];
  attachments?: LeadAttachment[];
  statusHistory?: LeadStatusHistory[];
  productInterests?: LeadProductInterest[];
  campaigns?: LeadCampaign[];
  notes?: string;

  // Partner-compatible properties for union type support
  type?: 'Lead' | 'Customer' | 'Prospect' | 'Vendor';
  email?: string;
  phone?: string;
  comments?: string;
  city?: string;
  source?: 'Website form' | 'Trade show' | 'LinkedIn' | 'Marketing campaign' | 'Referral';
  assignedTo?: string;
  createdAt?: string;
}

export interface Partner {
  id: string;
  name: string;
  type: PartnerType;
  status?: 'prospect' | 'active' | 'inactive' | 'archived';
  email?: string;
  phone?: string;
  comments?: string;
  city?: string;
  score?: number;
  source?: 'Website form' | 'Trade show' | 'LinkedIn' | 'Marketing campaign' | 'Referral';
  assignedTo?: string;
  createdBy?: string;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  assignedTeam?: 'Sales' | 'Operations' | 'Finance' | 'Support';
  assignedTo?: string;
  status: TaskStatus;
  priority?: 'Urgent' | 'Medium' | 'Low';
  deadline?: string;
  relatedTo?: string; // display label of the related entity
  relatedModule?: 'Sales' | 'Finance' | 'Partners' | 'Support' | 'Marketing';
  relatedSubModule?: string; // entity type: Deal, Proposal, PurchaseOrder, Lead, Customer, Prospect, Vendor, Ticket, Campaign, Invoice, Recovery
  relatedEntityId?: string; // id of the related entity
  createdBy?: string;
  createdAt: string;
}

export interface ProposalLine {
  product: string;
  description: string;
  qty: number;
  unitPrice: number;
  total: number;
  vendor?: string;
}

export interface Proposal {
  id: string;
  title: string;
  partnerId: string;
  amount: number;
  status: 'Draft' | 'Sent' | 'Confirmed' | 'Rejected';
  templateId?: string;
  lines: ProposalLine[];
  createdBy?: string;
  createdAt: string;
  deliveryMethod?: 'Email' | 'WhatsApp' | 'SMS';
  opportunityValue?: number;
  closingProbability?: number;
  expectedClosingDate?: string;
  competitors?: string[];
  stage?: ProposalStage;
  confirmationMethod?: 'Email' | 'WhatsApp' | 'Call';
  confirmationAttachmentName?: string;
  confirmationAttachmentData?: string;
  confirmationNote?: string;
  confirmedAt?: string;
}

export interface CallLog {
  id: string;
  date: string;
  duration: number; // in minutes
  callerName: string;
  summary: string;
  outcome: string;
}

export interface EmailLog {
  id: string;
  date: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  direction: 'sent' | 'received';
}

export interface Meeting {
  id: string;
  date: string;
  time: string;
  title: string;
  attendees: string[];
  location: string;
  summary: string;
  type: 'in-person' | 'teams' | 'demo';
}

export interface TeamsRecording {
  id: string;
  date: string;
  title: string;
  meetingLink: string;
  recordingLink: string;
  duration: string;
}

export interface Note {
  id: string;
  date: string;
  author: string;
  content: string;
}

export interface FollowUp {
  id: string;
  dueDate: string;
  title: string;
  assignedTo: string;
  status: 'pending' | 'done';
}

export interface Deal {
  id: string;
  title: string;
  partnerId: string;
  amount: number;
  stage: DealStage;
  comments?: string;
  proposalId?: string;
  createdBy?: string;
  createdAt: string;
  orderLines?: ProposalLine[];
  discount?: number;
  emailExchange?: string;
  estimatedDeliveryDate?: string;

  // Identification & Dates
  orderNumber?: string;
  dealNumber?: string;
  orderDate?: string;
  requestedDeliveryDate?: string;
  orderStatus?: string;

  // Customer & Delivery
  customerAccount?: string;
  billingAddress?: string;
  deliveryAddress?: string;
  contactPerson?: string;
  contactEmail?: string;
  contactPhone?: string;

  // Sales & Ownership
  salesPerson?: string;
  salesRegion?: string;

  // Commercial Basics
  currency?: string;
  paymentTerms?: string;
  orderTotalAmount?: number;

  // Vendor / Partner
  vendorAccount?: string;
  purchaseOrderRef?: string;
  warehouseAddress?: string;
  transportationService?: string;
  expectedDeliveryDateVendor?: string;
  deliveryDate?: string;

  // Deal Activity Hub
  activityLog?: {
    calls: CallLog[];
    emails: EmailLog[];
    meetings: Meeting[];
    recordings: TeamsRecording[];
    notes: Note[];
    followUps: FollowUp[];
  };
}

export interface PurchaseOrder {
  id: string;
  dealId: string;
  vendorId: string;
  amount: number;
  status: 'Draft' | 'Sent' | 'Delivered' | 'Invoiced';
  deliveryDate?: string;
  lines: { product: string; description?: string; qty: number; cost: number; type?: 'software' | 'hardware' | 'service' }[];
  sentVia?: string;
  createdBy?: string;
  createdAt: string;
  orderNumber?: string;
}

export interface Invoice {
  id: string;
  type: 'Customer' | 'Vendor';
  partnerId: string;
  amount: number;
  status: InvoiceStatus;
  dueDate: string;
  dealId?: string;
  purchaseOrderId?: string;
  createdBy?: string;
  createdAt: string;
  invoiceNumber?: string;
  // Customer administrative information
  customerAccount?: string;   // Unique account code / ERP ID
  customerName?: string;      // Official corporate name
  deliveryAddress?: string;   // Full delivery location
  vatNumber?: string;         // VAT registration string
  // Line items (inherited from deal + custom additions)
  lines?: { item: string; description?: string; qty: number; unitPrice: number; type: 'software' | 'hardware' | 'service' }[];
}

export interface Campaign {
  id: string;
  title: string;
  type: CampaignType;
  status: 'Draft' | 'Active' | 'Completed';
  targetAudience: string;
  sentCount: number;
  createdBy?: string;
  createdAt: string;
}

export interface Ticket {
  id: string;
  title: string;
  description?: string;
  type: string;
  status: TicketStatus;
  priority: TicketPriority;
  assignedToUserId?: string;
  assignedByUserId: string;
  relatedPartnerId?: string;
  partnerId?: string;
  assignedTo?: string;
  deadline?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityLog {
  id: string;
  targetId: string;
  type: 'Call' | 'Email' | 'Meeting' | 'Note' | 'Task';
  description: string;
  timestamp: string;
  link?: string;
}


export type RecordType = 'Organization' | 'Individual';
export type OrgType = 'Headquarter' | 'Subsidiary' | 'Branch';
export type AddressType = 'Siège Social / Fiscal' | 'Delivery' | 'Warehouse' | 'Billing';
export type VatStatus = 'Standard' | 'No VAT' | 'Export Trade';

export interface CustomerAddress {
  id: string;
  addressType: AddressType;
  streetAddress: string;
  industrialZone: string;
  postalCode: string;
  city: string;
  isPrimary: boolean;
  country?: string;
}

export interface CustomerPersonnel {
  id: string;
  fullName: string;
  jobTitle: string;
  directMobile: string;
  directEmail: string;
  isPrimary: boolean;
}

export interface CustomerCard {
  id: string;
  partnerId: string;
  accountId: string;
  recordType: RecordType;
  name: string;
  searchName: string;
  erpAccount: string;
  ice: string;
  ifField: string;
  rc: string;
  rcCity: string;
  tp: string;
  vatStatus: VatStatus[];
  orgType: OrgType;
  parentAccountId: string | null;
  addresses: CustomerAddress[];
  mainPhone: string;
  corporateEmail: string;
  websiteUrl: string;
  personnel: CustomerPersonnel[];
  createdBy?: string;
  createdAt: string;
}

export interface ProposalTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  lines: ProposalLine[];
}

export interface Notification {
  id: string;
  type: 'deal' | 'task' | 'ticket' | 'system' | 'mention';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  relatedId?: string;
}

export interface InboxMessage {
  id: string;
  sender: string;
  senderEmail: string;
  subject: string;
  preview: string;
  timestamp: string;
  read: boolean;
  hasAttachments: boolean;
}

@Injectable({ providedIn: 'root' })
export class CrmStateService {
  private toast = inject(ToastService);
  private router = inject(Router);
  private api = inject(ApiService);
  private tasksService = inject(TasksService);
  private ticketsService = inject(TicketsService);
  private translation = inject(TranslationService);

  // Auth
  isAuthenticated = signal<boolean>(this.loadAuthState());
  currentUserId = signal<string>(this.loadCurrentUserId());

  // Config signals - initialize empty, will be replaced by API data
  organization = signal<Organization>({
    id: '',
    name: '',
    logoInitials: '',
    logoColor: '',
    industry: '',
    timezone: '',
    fiscalYearStart: 1,
    createdAt: new Date()
  });
  users = signal<CrmUser[]>([]);
  teams = signal<CrmTeam[]>([]);
  groups = signal<CrmGroup[]>([]);
  groupMessages = signal<GroupMessage[]>([]);
  groupMeetings = signal<GroupMeeting[]>([]);

  // Loading state
  isLoading = signal<boolean>(false);

  // Per-domain loading states for lazy loading
  dealsLoaded = signal<boolean>(false);
  partnersLoaded = signal<boolean>(false);
  proposalsLoaded = signal<boolean>(false);
  invoicesLoaded = signal<boolean>(false);
  purchaseOrdersLoaded = signal<boolean>(false);
  campaignsLoaded = signal<boolean>(false);
  automationRulesLoaded = signal<boolean>(false);
  proposalTemplatesLoaded = signal<boolean>(false);

  // Per-domain in-flight/error state, for page-level loading spinners and error banners
  dealsLoading = signal<boolean>(false);
  dealsError = signal<string | null>(null);
  partnersLoading = signal<boolean>(false);
  partnersError = signal<string | null>(null);
  proposalsLoading = signal<boolean>(false);
  proposalsError = signal<string | null>(null);
  invoicesLoading = signal<boolean>(false);
  invoicesError = signal<string | null>(null);
  purchaseOrdersLoading = signal<boolean>(false);
  purchaseOrdersError = signal<string | null>(null);
  campaignsLoading = signal<boolean>(false);
  campaignsError = signal<string | null>(null);
  automationRulesLoading = signal<boolean>(false);
  automationRulesError = signal<string | null>(null);
  proposalTemplatesLoading = signal<boolean>(false);
  proposalTemplatesError = signal<string | null>(null);

  // Shared tab state for section pages
  salesSubTab = signal<'deals' | 'proposals' | 'pos'>('deals');
  breadcrumbLabel = signal<string | null>(null);
  marketingSubTab = signal<'Email' | 'WhatsApp' | 'SMS'>('Email');
  partnersSubTab = signal<'Lead' | 'Customer' | 'Prospect' | 'Vendor'>('Lead');
  financeSubTab = signal<'Customer' | 'Vendor' | 'Recovery'>('Customer');

  // Global search navigation target — set before navigating to deep-link a sub-tab
  navigateTab = signal<string | null>(null);

  // Filter signals — set by dashboard widgets before navigating to filtered list pages
  taskFilter = signal<{ priority?: string } | null>(null);
  ticketFilter = signal<{ priority?: string } | null>(null);

  // Command palette quick action — set before navigating so the target page can react
  // (open a create modal, log a call, etc). Consumers read it once via an effect and clear it.
  pendingQuickAction = signal<{ id: string; payload?: unknown } | null>(null);

  // Global currency setting — readable by all components, togglable from settings
  globalCurrency = signal<string>('MAD');

  // Computeds
  activeUsers = computed(() => this.users().filter(u => u.isActive));

  currentUser = computed(() => this.users().find(u => u.id === this.currentUserId()) || this.users()[0]);

  currentUserPermissions = computed(() => {
    const user = this.users().find(u => u.id === this.currentUserId());
    return CRM_ROLES.find(r => r.id === user?.roleId)?.permissions ?? {
      canManageUsers: false,
      canManageTeams: false,
      canManageRoles: false,
      canViewAllDeals: false,
      canDeleteRecords: false,
      canCreateGroups: false,
      canScheduleMeetings: false
    };
  });

  currentUserAuthorities = computed(() => {
    const user = this.users().find(u => u.id === this.currentUserId());
    return AUTHORITIES_BY_ROLE[user?.roleId ?? 'viewer'] ?? AUTHORITIES_BY_ROLE['viewer'];
  });

  /** Mirrors the backend's @PreAuthorize("hasAuthority('X')") checks -- see AUTHORITIES_BY_ROLE. */
  hasAuthority(authority: string): boolean {
    return this.currentUserAuthorities().has(authority);
  }

  // Utility helpers
  usersByTeam(teamId: string): CrmUser[] {
    return this.users().filter(u => u.teamId === teamId);
  }

  groupsByUser(userId: string): CrmGroup[] {
    return this.groups().filter(g => g.memberUserIds.includes(userId));
  }

  deriveInitials(name: string): string {
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  getAvatarColor(userId: string): string {
    const hash = userId.charCodeAt(userId.length - 1);
    return AVATAR_COLORS[hash % AVATAR_COLORS.length];
  }

  private patchUserCompatibility(user: CrmUser): CrmUser {
    user.name = user.displayName;
    if (user.roleId === 'admin') user.role = 'Admin';
    else if (user.roleId === 'manager') user.role = 'Manager';
    else if (user.roleId === 'salesperson') user.role = 'Salesperson';
    else if (user.roleId === 'support') user.role = 'Support Specialist';
    else if (user.roleId === 'viewer') user.role = 'Viewer';

    const teamObj = this.teams().find(t => t.id === user.teamId);
    if (teamObj) {
      if (teamObj.department === 'Sales') user.team = 'Sales';
      else if (teamObj.department === 'Operations') user.team = 'Operations';
      else if (teamObj.department === 'Finance') user.team = 'Finance';
      else if (teamObj.department === 'Support') user.team = 'Support';
      else user.team = null;
    } else {
      user.team = null;
    }
    return user;
  }

  private static readonly ROLE_ID_TO_BACKEND: Record<RoleId, string> = {
    admin: 'ADMIN', manager: 'MANAGER', salesperson: 'SALESPERSON', support: 'SUPPORT', viewer: 'VIEWER'
  };
  private static readonly BACKEND_TO_ROLE_ID: Record<string, RoleId> = {
    ADMIN: 'admin', MANAGER: 'manager', SALESPERSON: 'salesperson', SUPPORT: 'support', VIEWER: 'viewer'
  };

  // Maps the backend's UserResponseDto (snake_case JSON) into a CrmUser
  private userFromDto(dto: unknown): CrmUser {
    const displayName = dto.display_name ?? '';
    const user: CrmUser = {
      id: dto.id,
      displayName,
      name: displayName,
      email: dto.email,
      initials: dto.initials || this.deriveInitials(displayName || 'U U'),
      avatarColor: dto.avatar_color ?? this.getAvatarColor(dto.id),
      roleId: CrmStateService.BACKEND_TO_ROLE_ID[dto.role] || 'viewer',
      role: '',
      teamId: dto.team_id ?? null,
      team: null,
      isActive: dto.is_active ?? true,
      phone: dto.phone,
      jobTitle: dto.job_title,
      preferences: {
        language: (dto.language as CrmUser['preferences']['language']) || 'en',
        theme: 'light',
        notifyOnLeadAssign: true,
        notifyOnDealUpdate: true,
        notifyOnMention: true
      },
      createdAt: dto.created_at ? new Date(dto.created_at) : new Date(),
      lastActiveAt: dto.last_active_at ? new Date(dto.last_active_at) : new Date()
    };
    return this.patchUserCompatibility(user);
  }

  private userToApiPayload(user: { displayName: string; roleId: RoleId; teamId: string | null; phone?: string; jobTitle?: string; preferences?: { language: string } }) {
    return {
      display_name: user.displayName,
      role: CrmStateService.ROLE_ID_TO_BACKEND[user.roleId],
      team_id: user.teamId || null,
      phone: user.phone,
      job_title: user.jobTitle,
      language: user.preferences?.language || 'en'
    };
  }

  private static readonly DEPARTMENT_TO_BACKEND: Record<CrmTeam['department'], string> = {
    Sales: 'SALES', Operations: 'OPERATIONS', Finance: 'FINANCE', Support: 'SUPPORT', Custom: 'CUSTOM'
  };
  private static readonly BACKEND_TO_DEPARTMENT: Record<string, CrmTeam['department']> = {
    SALES: 'Sales', OPERATIONS: 'Operations', FINANCE: 'Finance', SUPPORT: 'Support', CUSTOM: 'Custom'
  };

  // Team membership isn't stored on the backend Team entity -- it's derived from each AppUser.teamId
  private teamFromDto(dto: unknown): CrmTeam {
    return {
      id: dto.id,
      name: dto.name,
      department: CrmStateService.BACKEND_TO_DEPARTMENT[dto.department] || 'Custom',
      description: dto.description,
      leadUserId: dto.lead_user_id ?? '',
      memberUserIds: this.users().filter(u => u.teamId === dto.id).map(u => u.id),
      color: dto.color || '#7F77DD',
      createdAt: dto.created_at ? new Date(dto.created_at) : new Date()
    };
  }

  private teamToApiPayload(team: { name: string; department: CrmTeam['department']; description?: string; leadUserId: string; color: string }) {
    return {
      name: team.name,
      department: CrmStateService.DEPARTMENT_TO_BACKEND[team.department],
      description: team.description,
      lead_user_id: team.leadUserId || null,
      color: team.color
    };
  }

  private static readonly PARTNER_TYPE_TO_BACKEND: Record<PartnerType, string> = {
    Lead: 'LEAD', Prospect: 'PROSPECT', Customer: 'CUSTOMER', Vendor: 'VENDOR'
  };
  private static readonly BACKEND_TO_PARTNER_TYPE: Record<string, PartnerType> = {
    LEAD: 'Lead', PROSPECT: 'Prospect', CUSTOMER: 'Customer', VENDOR: 'Vendor'
  };

  // Maps the backend's PartnerResponse (snake_case JSON) into the thin UI-facing Partner shape
  // used for the customers/prospects/vendors lists. Lead-specific detail (leadsData signal) is
  // seeded/managed separately client-side and isn't hydrated from this endpoint.
  private partnerFromDto(dto: unknown): Partner {
    return {
      id: dto.id,
      name: dto.name,
      type: CrmStateService.BACKEND_TO_PARTNER_TYPE[dto.type] || 'Lead',
      email: dto.email,
      phone: dto.phone,
      comments: dto.comments,
      city: dto.city,
      score: dto.score,
      source: dto.source,
      assignedTo: dto.assigned_to_user_id,
      createdBy: dto.created_by,
      createdAt: dto.created_at ? new Date(dto.created_at).toISOString().split('T')[0] : ''
    };
  }

  // Builds a CreatePartnerRequest/UpdatePartnerRequest-shaped payload (snake_case, uppercase
  // enums) from the local Partner shape so writes round-trip through the same field names
  // partnerFromDto reads back.
  private partnerToApiPayload(partner: Partial<Partner> & { name: string }): unknown {
    return {
      type: partner.type ? CrmStateService.PARTNER_TYPE_TO_BACKEND[partner.type] : undefined,
      name: partner.name,
      email: partner.email,
      phone: partner.phone,
      comments: partner.comments,
      city: partner.city,
      score: partner.score,
      source: partner.source,
      assigned_to_user_id: partner.assignedTo || undefined
    };
  }

  // Recomputes every team's memberUserIds from the current users signal (source of truth is AppUser.teamId)
  private rehydrateTeamMembership(): void {
    this.teams.update(list => list.map(t => ({
      ...t,
      memberUserIds: this.users().filter(u => u.teamId === t.id).map(u => u.id)
    })));
  }

  // Initialize eager data from API (app-wide dependencies)
  private loadEagerDataFromApi(): void {
    this.api.getUsers().subscribe({
      next: (users) => {
        if (users && users.length > 0) {
          this.users.set(users.map(u => this.userFromDto(u)));
          this.rehydrateTeamMembership();
        }
      },
      error: (err) => {
        console.warn('Failed to load users from API, using seed data:', err);
      }
    });

    this.api.getTeams().subscribe({
      next: (teams) => {
        if (teams && teams.length > 0) {
          this.teams.set(teams.map(t => this.teamFromDto(t)));
        }
      },
      error: (err) => {
        console.warn('Failed to load teams from API, using seed data:', err);
      }
    });

    this.api.getGroups().subscribe({
      next: (groups) => {
        if (groups && groups.length > 0) {
          this.groups.set(groups);
        }
      },
      error: (err) => {
        console.warn('Failed to load groups from API, using seed data:', err);
      }
    });

    this.api.getOrganization().subscribe({
      next: (org) => {
        if (org) {
          this.organization.set(org);
        }
      },
      error: (err) => {
        console.warn('Failed to load organization from API, using seed data:', err);
      }
    });

    this.loadNotifications();
  }

  // Lazy-load: Deals
  loadDeals(): void {
    if (this.dealsLoaded()) return;
    this.dealsLoading.set(true);
    this.dealsError.set(null);
    this.api.getDeals().subscribe({
      next: (deals) => {
        if (deals && deals.length > 0) {
          this.deals.set(deals);
        }
        this.dealsLoaded.set(true);
        this.dealsLoading.set(false);
      },
      error: (err) => {
        console.warn('Failed to load deals from API, using seed data:', err);
        this.dealsLoaded.set(true);
        this.dealsLoading.set(false);
        this.dealsError.set('Failed to load deals from the server. Showing local data.');
      }
    });
  }

  // Lazy-load: Partners
  loadPartners(): void {
    if (this.partnersLoaded()) return;
    this.partnersLoading.set(true);
    this.partnersError.set(null);
    this.api.getPartners().subscribe({
      next: (partners) => {
        if (partners && partners.length > 0) {
          this.partners.set(partners.map(p => this.partnerFromDto(p)));
        }
        this.partnersLoaded.set(true);
        this.partnersLoading.set(false);
      },
      error: (err) => {
        console.warn('Failed to load partners from API, using seed data:', err);
        this.partnersLoaded.set(true);
        this.partnersLoading.set(false);
        this.partnersError.set('Failed to load partners from the server. Showing local data.');
      }
    });
  }

  // Lazy-load: Proposals
  loadProposals(): void {
    if (this.proposalsLoaded()) return;
    this.proposalsLoading.set(true);
    this.proposalsError.set(null);
    this.api.getProposals().subscribe({
      next: (proposals) => {
        if (proposals && proposals.length > 0) {
          this.proposals.set(proposals);
        }
        this.proposalsLoaded.set(true);
        this.proposalsLoading.set(false);
      },
      error: (err) => {
        console.warn('Failed to load proposals from API, using seed data:', err);
        this.proposalsLoaded.set(true);
        this.proposalsLoading.set(false);
        this.proposalsError.set('Failed to load proposals from the server. Showing local data.');
      }
    });
  }

  // Tasks and tickets are now owned by TasksService/TicketsService (shared with the
  // Tasks and Tickets modules) so the Dashboard reads the same live data instead of
  // its own separate copy.
  loadTasks(): void {
    this.tasksService.load();
  }

  loadTickets(): void {
    this.ticketsService.load();
  }

  // Lazy-load: Invoices
  loadInvoices(): void {
    if (this.invoicesLoaded()) return;
    this.invoicesLoading.set(true);
    this.invoicesError.set(null);
    this.api.getInvoices().subscribe({
      next: (invoices) => {
        if (invoices && invoices.length > 0) {
          this.invoices.set(invoices);
        }
        this.invoicesLoaded.set(true);
        this.invoicesLoading.set(false);
      },
      error: (err) => {
        console.warn('Failed to load invoices from API, using seed data:', err);
        this.invoicesLoaded.set(true);
        this.invoicesLoading.set(false);
        this.invoicesError.set('Failed to load invoices from the server. Showing local data.');
      }
    });
  }

  // Lazy-load: Purchase Orders
  loadPurchaseOrders(): void {
    if (this.purchaseOrdersLoaded()) return;
    this.purchaseOrdersLoading.set(true);
    this.purchaseOrdersError.set(null);
    this.api.getPurchaseOrders().subscribe({
      next: (pos) => {
        if (pos && pos.length > 0) {
          this.purchaseOrders.set(pos);
        }
        this.purchaseOrdersLoaded.set(true);
        this.purchaseOrdersLoading.set(false);
      },
      error: (err) => {
        console.warn('Failed to load purchase orders from API, using seed data:', err);
        this.purchaseOrdersLoaded.set(true);
        this.purchaseOrdersLoading.set(false);
        this.purchaseOrdersError.set('Failed to load purchase orders from the server. Showing local data.');
      }
    });
  }

  // Lazy-load: Campaigns
  loadCampaigns(): void {
    if (this.campaignsLoaded()) return;
    this.campaignsLoading.set(true);
    this.campaignsError.set(null);
    this.api.getCampaigns().subscribe({
      next: (campaigns) => {
        if (campaigns && campaigns.length > 0) {
          this.campaigns.set(campaigns);
        }
        this.campaignsLoaded.set(true);
        this.campaignsLoading.set(false);
      },
      error: (err) => {
        console.warn('Failed to load campaigns from API, using seed data:', err);
        this.campaignsLoaded.set(true);
        this.campaignsLoading.set(false);
        this.campaignsError.set('Failed to load campaigns from the server. Showing local data.');
      }
    });
  }

  // Lazy-load: Automation Rules
  loadAutomationRules(): void {
    if (this.automationRulesLoaded()) return;
    this.automationRulesLoading.set(true);
    this.automationRulesError.set(null);
    this.api.getAutomationRules().subscribe({
      next: (rules) => {
        if (rules && rules.length > 0) {
          this.automationRules.set(rules);
        }
        this.automationRulesLoaded.set(true);
        this.automationRulesLoading.set(false);
      },
      error: (err) => {
        console.warn('Failed to load automation rules from API, using seed data:', err);
        this.automationRulesLoaded.set(true);
        this.automationRulesLoading.set(false);
        this.automationRulesError.set('Failed to load automation rules from the server. Showing local data.');
      }
    });
  }

  // Lazy-load: Proposal Templates
  loadProposalTemplates(): void {
    if (this.proposalTemplatesLoaded()) return;
    this.proposalTemplatesLoading.set(true);
    this.proposalTemplatesError.set(null);
    this.api.getProposalTemplates().subscribe({
      next: (templates) => {
        if (templates && templates.length > 0) {
          this.proposalTemplates.set(templates);
        }
        this.proposalTemplatesLoaded.set(true);
        this.proposalTemplatesLoading.set(false);
      },
      error: (err) => {
        console.warn('Failed to load proposal templates from API, using seed data:', err);
        this.proposalTemplatesLoaded.set(true);
        this.proposalTemplatesLoading.set(false);
        this.proposalTemplatesError.set('Failed to load proposal templates from the server. Showing local data.');
      }
    });
  }

  addProposalTemplate(template: Omit<ProposalTemplate, 'id'>) {
    const tempId = 'tpl' + (this.proposalTemplates().length + 1) + '_' + Date.now();
    const newTemplate = { ...template, id: tempId };
    this.proposalTemplates.update(list => [...list, newTemplate]);
    this.api.createProposalTemplate(template).subscribe({
      next: (dto) => {
        this.proposalTemplates.update(list => list.map(t => t === newTemplate ? dto : t));
      },
      error: () => {
        this.proposalTemplates.update(list => list.filter(t => t !== newTemplate));
        this.toast.show('Failed to save proposal template to the server', { type: 'error' });
      }
    });
    return newTemplate;
  }

  updateProposalTemplate(id: string, patch: Partial<ProposalTemplate>) {
    const previous = this.proposalTemplates().find(t => t.id === id);
    this.proposalTemplates.update(list => list.map(t => t.id === id ? { ...t, ...patch } : t));
    this.api.updateProposalTemplate(id, patch).subscribe({
      next: (dto) => {
        this.proposalTemplates.update(list => list.map(t => t.id === id ? dto : t));
      },
      error: () => {
        if (previous) {
          this.proposalTemplates.update(list => list.map(t => t.id === id ? previous : t));
        }
        this.toast.show('Failed to update proposal template', { type: 'error' });
      }
    });
  }

  deleteProposalTemplate(id: string) {
    const deleted = this.proposalTemplates().find(t => t.id === id);
    this.api.deleteProposalTemplate(id).subscribe({
      next: () => {
        this.proposalTemplates.update(list => list.filter(t => t.id !== id));
        this.toast.show(`Template <strong>${deleted?.name || id}</strong> deleted`, {
          undo: () => {
            if (deleted) {
              this.proposalTemplates.update(list => [...list, deleted]);
            }
          }
        });
      },
      error: () => this.toast.show('Failed to delete proposal template', { type: 'error' })
    });
  }

  // State mutations
  updateOrganization(patch: Partial<Organization>): void {
    this.api.updateOrganization(patch).subscribe({
      next: (updated) => {
        if (updated) {
          this.organization.set(updated);
        }
        this.toast.show('Organization updated', { type: 'info' });
      },
      error: (err) => {
        console.warn('Failed to update organization:', err);
        this.toast.show('Failed to update organization', { type: 'error' });
      }
    });
  }

  addUser(draft: Omit<CrmUser, 'id' | 'initials' | 'createdAt' | 'lastActiveAt' | 'avatarColor' | 'name' | 'role' | 'team'>): void {
    const tempPassword = 'Temp-' + Math.random().toString(36).slice(2, 10) + 'A1!';
    const payload = { ...this.userToApiPayload(draft), email: draft.email, password: tempPassword };
    this.api.createUser(payload).subscribe({
      next: (dto) => {
        const created = this.userFromDto(dto);
        this.users.update(list => [...list, created]);
        if (draft.teamId) {
          this.addTeamMember(draft.teamId, created.id);
        }
        this.toast.show(`User <strong>${created.displayName}</strong> created`, { type: 'info' });
      },
      error: () => this.toast.show('Failed to create user', { type: 'error' })
    });
  }

  updateUser(id: string, patch: Partial<CrmUser>): void {
    const current = this.users().find(u => u.id === id);
    if (!current) return;
    const merged = { ...current, ...patch };
    this.api.updateUser(id, this.userToApiPayload(merged)).subscribe({
      next: (dto) => {
        const updated = this.userFromDto(dto);
        this.users.update(list => list.map(u => u.id === id ? updated : u));
        this.rehydrateTeamMembership();
        this.toast.show(`User <strong>${updated.displayName}</strong> updated`, { type: 'info' });
      },
      error: () => this.toast.show('Failed to update user', { type: 'error' })
    });
  }

  updateUserPreferences(preferences: Partial<CrmUser['preferences']>): void {
    const id = this.currentUserId();
    const current = this.users().find(u => u.id === id);
    if (!current) return;
    const merged = { ...current, preferences: { ...current.preferences, ...preferences } };
    this.users.update(list => list.map(u => u.id === id ? merged : u));
  }

  /** Self-service profile update -- doesn't require USERS_WRITE, and can't touch role or team. */
  updateOwnProfile(patch: { displayName?: string; phone?: string; jobTitle?: string; language?: string; theme?: string }): void {
    const id = this.currentUserId();
    const current = this.users().find(u => u.id === id);
    if (!current) return;
    const payload = {
      display_name: patch.displayName,
      phone: patch.phone,
      job_title: patch.jobTitle,
      language: patch.language,
      theme: patch.theme
    };
    this.api.updateOwnProfile(payload).subscribe({
      next: (dto) => {
        const updated = this.userFromDto(dto);
        this.users.update(list => list.map(u => u.id === id ? updated : u));
        this.toast.show(`Profile updated`, { type: 'info' });
      },
      error: () => this.toast.show('Failed to update profile', { type: 'error' })
    });
  }

  deactivateUser(id: string): void {
    this.assertNotLastAdmin(id);
    const user = this.users().find(u => u.id === id);
    this.api.deactivateUser(id).subscribe({
      next: () => {
        this.users.update(list => list.map(u => u.id === id ? { ...u, isActive: false } : u));
        // Remove from team lists
        this.teams.update(teamsList => teamsList.map(t => {
          if (t.memberUserIds.includes(id)) {
            return { ...t, memberUserIds: t.memberUserIds.filter(mid => mid !== id) };
          }
          return t;
        }));
        this.toast.show(`User <strong>${user?.displayName || id}</strong> deactivated`, { type: 'info' });
      },
      error: (err: unknown) => this.toast.show(err?.error?.detail || 'Failed to deactivate user', { type: 'error' })
    });
  }

  addTeam(draft: Omit<CrmTeam, 'id' | 'createdAt'>): void {
    this.api.createTeam(this.teamToApiPayload(draft)).subscribe({
      next: (dto) => {
        const created = this.teamFromDto(dto);
        this.teams.update(list => [...list, created]);
        this.updateUser(draft.leadUserId, { teamId: created.id, roleId: 'manager' });
        draft.memberUserIds.filter(mid => mid !== draft.leadUserId).forEach(mid => {
          this.updateUser(mid, { teamId: created.id });
        });
        this.toast.show(`Team <strong>${created.name}</strong> created`, { type: 'info' });
      },
      error: () => this.toast.show('Failed to create team', { type: 'error' })
    });
  }

  updateTeam(id: string, patch: Partial<CrmTeam>): void {
    const current = this.teams().find(t => t.id === id);
    if (!current) return;
    const merged = { ...current, ...patch };
    this.api.updateTeam(id, this.teamToApiPayload(merged)).subscribe({
      next: (dto) => {
        const updated = this.teamFromDto(dto);
        this.teams.update(list => list.map(t => t.id === id ? updated : t));
        if (patch.leadUserId) {
          this.addTeamMember(id, patch.leadUserId);
          this.updateUser(patch.leadUserId, { roleId: 'manager' });
        }
        this.toast.show(`Team <strong>${updated.name}</strong> updated`, { type: 'info' });
      },
      error: () => this.toast.show('Failed to update team', { type: 'error' })
    });
  }

  deleteTeam(id: string): void {
    const team = this.teams().find(t => t.id === id);
    this.api.deleteTeam(id).subscribe({
      next: () => {
        this.teams.update(list => list.filter(t => t.id !== id));
        this.toast.show(`Team <strong>${team?.name || id}</strong> deleted`, { type: 'info' });
      },
      error: () => this.toast.show('Failed to delete team', { type: 'error' })
    });
  }

  addTeamMember(teamId: string, userId: string): void {
    const team = this.teams().find(t => t.id === teamId);
    const user = this.users().find(u => u.id === userId);
    this.updateUser(userId, { teamId });
    this.toast.show(`<strong>${user?.displayName || userId}</strong> added to ${team?.name || teamId}`, { type: 'info' });
  }

  removeTeamMember(teamId: string, userId: string): void {
    this.assertNotTeamLead(teamId, userId);
    const team = this.teams().find(t => t.id === teamId);
    const user = this.users().find(u => u.id === userId);
    this.updateUser(userId, { teamId: null });
    this.toast.show(`<strong>${user?.displayName || userId}</strong> removed from ${team?.name || teamId}`, { type: 'info' });
  }

  updateUserRole(userId: string, roleId: RoleId): void {
    this.assertNotLastAdmin(userId);
    this.updateUser(userId, { roleId });
  }

  createGroup(draft: Omit<CrmGroup, 'id' | 'createdAt'>): CrmGroup {
    const tempId = 'grp_' + Math.random().toString(36).substring(2, 9);
    const newGroup: CrmGroup = {
      ...draft,
      id: tempId,
      createdAt: new Date()
    };
    this.groups.update(list => [...list, newGroup]);
    this.api.createGroup({ name: draft.name, description: draft.description }).subscribe({
      next: (dto) => {
        this.groups.update(list => list.map(g => g.id === tempId ? { ...g, id: dto.id } : g));
      },
      error: () => {
        this.groups.update(list => list.filter(g => g.id !== tempId));
        this.toast.show('Failed to save group to the server', { type: 'error' });
      }
    });
    return newGroup;
  }

  updateGroup(groupId: string, updates: Partial<Pick<CrmGroup, 'name' | 'description' | 'memberUserIds'>>): void {
    const prev = this.groups().find(g => g.id === groupId);
    if (!prev) return;
    this.groups.update(list => list.map(g => g.id === groupId ? { ...g, ...updates } : g));
    this.api.updateGroup(groupId, {
      name: updates.name ?? prev.name,
      description: updates.description ?? prev.description
    }).subscribe({
      error: () => {
        this.groups.update(list => list.map(g => g.id === groupId ? prev : g));
        this.toast.show('Failed to update group', { type: 'error' });
      }
    });
  }

  deleteGroup(groupId: string): void {
    const removed = this.groups().find(g => g.id === groupId);
    this.groups.update(list => list.filter(g => g.id !== groupId));
    this.api.deleteGroup(groupId).subscribe({
      error: () => {
        if (removed) {
          this.groups.update(list => [...list, removed]);
        }
        this.toast.show('Failed to delete group', { type: 'error' });
      }
    });
  }

  sendGroupMessage(groupId: string, senderUserId: string, content: string): void {
    const newMessage: GroupMessage = {
      id: 'msg_' + Math.random().toString(36).substring(2, 9),
      groupId,
      senderUserId,
      content,
      sentAt: new Date(),
      readByUserIds: [senderUserId]
    };
    this.groupMessages.update(list => [...list, newMessage]);
    this.api.createGroupMessage(groupId, { content }).subscribe({
      next: (dto) => {
        if (dto?.id) {
          this.groupMessages.update(list => list.map(m => m === newMessage ? { ...m, id: dto.id } : m));
        }
      },
      error: () => this.toast.show('Failed to save message to the server', { type: 'error' })
    });
  }

  scheduleMeeting(draft: Omit<GroupMeeting, 'id' | 'status'>): GroupMeeting {
    const newMeeting: GroupMeeting = {
      ...draft,
      id: 'meet_' + Math.random().toString(36).substring(2, 9),
      status: 'scheduled'
    };
    this.groupMeetings.update(list => [...list, newMeeting]);
    this.api.createGroupMeeting(draft.groupId, {
      title: draft.title,
      description: draft.description,
      scheduledAt: draft.scheduledAt,
      meetingLink: (draft as unknown).meetingLink,
      attendeeUserIds: draft.attendeeUserIds
    }).subscribe({
      next: (dto) => {
        if (dto?.id) {
          this.groupMeetings.update(list => list.map(m => m === newMeeting ? { ...m, id: dto.id } : m));
        }
      },
      error: () => this.toast.show('Failed to save meeting to the server', { type: 'error' })
    });
    return newMeeting;
  }

  private assertNotLastAdmin(userId: string): void {
    const activeAdmins = this.users().filter(u => u.isActive && u.roleId === 'admin');
    if (activeAdmins.length === 1 && activeAdmins[0].id === userId) {
      throw new Error("Can't remove the last admin. Assign another admin first.");
    }
  }

  private assertNotTeamLead(teamId: string, userId: string): void {
    const team = this.teams().find(t => t.id === teamId);
    if (team?.leadUserId === userId) {
      throw new Error("Transfer team lead before removing this member.");
    }
  }

  private loadAuthState(): boolean {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      return localStorage.getItem('bento_auth') === 'true';
    }
    return false;
  }

  private saveAuthState(authenticated: boolean): void {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      if (authenticated) {
        localStorage.setItem('bento_auth', 'true');
      } else {
        localStorage.removeItem('bento_auth');
      }
    }
  }

  private loadCurrentUserId(): string {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      return localStorage.getItem('bento_current_user_id') || 'usr_rachid';
    }
    return 'usr_rachid';
  }

  private saveCurrentUserId(userId: string): void {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      localStorage.setItem('bento_current_user_id', userId);
    }
  }

  /** Sets the authenticated user's id and persists it across page refreshes. */
  setCurrentUser(userId: string): void {
    this.currentUserId.set(userId);
    this.isAuthenticated.set(true);
    this.saveAuthState(true);
    this.saveCurrentUserId(userId);
  }

  login(email: string): boolean {
    const user = this.users().find(
      u => u.email.toLowerCase() === email.toLowerCase() && u.isActive
    );
    if (user) {
      this.setCurrentUser(user.id);
      return true;
    }
    return false;
  }

  syncCurrentUserFromApi(): void {
    // Fetch the current user data from the API and update the state
    if (this.isAuthenticated()) {
      this.api.getMe().subscribe({
        next: (user) => {
          // Map CurrentUser to CrmUser
          const crmUser: CrmUser = {
            id: user.id,
            displayName: user.display_name,
            name: user.display_name,
            email: user.email,
            initials: user.initials,
            avatarColor: user.avatar_color,
            roleId: user.role as RoleId,
            role: user.role,
            teamId: user.team_id,
            team: null,
            isActive: user.is_active,
            phone: user.phone || undefined,
            jobTitle: user.job_title || undefined,
            preferences: {
              language: isSupportedLanguage(user.language) ? user.language : 'en',
              theme: 'light',
              notifyOnLeadAssign: true,
              notifyOnDealUpdate: true,
              notifyOnMention: true,
            },
            createdAt: new Date(),
            lastActiveAt: new Date(),
          };

          // Update the current user in the users list
          this.users.update(users => {
            const index = users.findIndex(u => u.id === user.id);
            if (index >= 0) {
              users[index] = { ...users[index], ...crmUser };
            } else {
              users.push(crmUser);
            }
            return users;
          });
        },
        error: (err) => {
          console.error('Failed to sync current user from API:', err);
        }
      });
    }
  }

  logout(): void {
    this.isAuthenticated.set(false);
    this.currentUserId.set('usr_rachid');
    this.saveAuthState(false);
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('bento_current_user_id');
    }
  }

  // Proposal templates
  proposalTemplates = signal<ProposalTemplate[]>([]);

  // Partners
  partners = signal<Partner[]>([]);

  // Shared with the Tasks module (TasksService) so the Dashboard always reflects
  // the same live data instead of its own separately-seeded copy.
  tasks = this.tasksService.tasks;

  proposals = signal<Proposal[]>([]);
  deals = signal<Deal[]>([]);
  purchaseOrders = signal<PurchaseOrder[]>([]);
  invoices = signal<Invoice[]>([]);

  campaigns = signal<Campaign[]>([]);

  // Shared with the Tickets module (TicketsService) so the Dashboard always reflects
  // the same live data instead of its own separately-seeded copy.
  tickets = this.ticketsService.tickets;

  ticketTypes = signal<string[]>(['Software issue', 'Broken product', 'Billing issue']);

  customerCards = signal<CustomerCard[]>([
    {
      id: 'cc-p1', partnerId: 'p1', accountId: 'ACT-ATLAS-01',
      recordType: 'Organization', name: 'Atlas Digital S.A.R.L.',
      searchName: 'ATLAS DIGITAL', erpAccount: 'ERP-ATLAS-01',
      ice: '', ifField: '', rc: '', rcCity: '', tp: '',
      vatStatus: ['Standard'], orgType: 'Headquarter', parentAccountId: null,
      addresses: [], mainPhone: '+212-522-458922',
      corporateEmail: 'contact@atlasdigital.ma', websiteUrl: 'www.atlasdigital.ma',
      personnel: [
        { id: 'per-atlas-1', fullName: 'Karim Atlas', jobTitle: 'CEO', directMobile: '+212661100100', directEmail: 'k.atlas@atlasdigital.ma', isPrimary: true },
        { id: 'per-atlas-2', fullName: 'Nadia Berrada', jobTitle: 'IT Director', directMobile: '+212661100200', directEmail: 'n.berrada@atlasdigital.ma', isPrimary: false },
        { id: 'per-atlas-3', fullName: 'Omar Filali', jobTitle: 'Finance Director', directMobile: '+212661100300', directEmail: 'o.filali@atlasdigital.ma', isPrimary: false }
      ],
      createdBy: 'usr_rachid',
      createdAt: '2026-03-01'
    },
    {
      id: 'cc-p4', partnerId: 'p4', accountId: 'ACT-ALMAGHRIB-01',
      recordType: 'Organization', name: 'Al-Maghrib Consulting',
      searchName: 'AL MAGHRIB', erpAccount: 'ERP-ALMAGHRIB-01',
      ice: '', ifField: '', rc: '', rcCity: '', tp: '',
      vatStatus: ['Standard'], orgType: 'Headquarter', parentAccountId: null,
      addresses: [], mainPhone: '+212-661-345678',
      corporateEmail: 'hello@almaghribconsulting.ma', websiteUrl: '',
      personnel: [
        { id: 'per-alm-1', fullName: 'Yassine Rhazi', jobTitle: 'Managing Director', directMobile: '+212661345678', directEmail: 'y.rhazi@almaghribconsulting.ma', isPrimary: true },
        { id: 'per-alm-2', fullName: 'Houda Sefrioui', jobTitle: 'Operations Manager', directMobile: '+212661345679', directEmail: 'h.sefrioui@almaghribconsulting.ma', isPrimary: false }
      ],
      createdBy: 'usr_rachid',
      createdAt: '2026-04-10'
    },
    {
      id: 'cc-p5', partnerId: 'p5', accountId: 'ACT-ABC-01',
      recordType: 'Organization', name: 'ABC Technologies',
      searchName: 'ABC TECH', erpAccount: 'ERP-ABC-01',
      ice: '', ifField: '', rc: '', rcCity: '', tp: '',
      vatStatus: ['Standard'], orgType: 'Headquarter', parentAccountId: null,
      addresses: [], mainPhone: '+212-522-112233',
      corporateEmail: 'contact@abctech.ma', websiteUrl: '',
      personnel: [
        { id: 'per-abc-1', fullName: 'Mohammed Alaoui', jobTitle: 'CEO', directMobile: '+212661001001', directEmail: 'ceo@abctech.ma', isPrimary: true },
        { id: 'per-abc-2', fullName: 'Karim Benali', jobTitle: 'IT Manager', directMobile: '+212661002002', directEmail: 'it@abctech.ma', isPrimary: false },
        { id: 'per-abc-3', fullName: 'Samira El Fassi', jobTitle: 'Finance Manager', directMobile: '+212661003003', directEmail: 'finance@abctech.ma', isPrimary: false }
      ],
      createdBy: 'usr_rachid',
      createdAt: '2026-05-01'
    }
  ]);

  // ────────────────────────────────────────────────────────
  // Automation Rules Signal & Execution Log
  // ────────────────────────────────────────────────────────
  automationRules = signal<AutomationRule[]>([
    {
      id: 'rule-001',
      name: 'Auto-Assign Lead – DIGITAL ABC',
      description: 'When a new lead from DIGITAL ABC is created, automatically assign it to Youssef El Alami.',
      isActive: true,
      trigger: 'LeadCreated',
      priority: 1,
      stopOnMatch: true,
      conflictStrategy: 'first-wins',
      version: 1,
      conditionGroups: [
        {
          id: 'group-1',
          logicalOperator: 'AND',
          conditions: [{ fieldKey: 'companyName', operator: 'contains', value: 'DIGITAL ABC' }]
        }
      ],
      actions: [
        {
          id: 'action-1',
          type: 'AssignSalesperson',
          params: { assignee: 'Youssef El Alami' }
        },
        {
          id: 'action-2',
          type: 'CreateFollowUpTask',
          params: {
            taskTitle: 'Follow up with DIGITAL ABC lead',
            taskDescription: 'Auto-created: Contact new DIGITAL ABC lead and qualify opportunity.',
            taskTeam: 'Sales',
            assignee: 'Youssef El Alami'
          }
        }
      ],
      createdAt: '2026-06-01',
      updatedAt: '2026-06-01',
      executionCount: 3
    },
    {
      id: 'rule-002',
      name: 'Notify Manager – Deal > 100k',
      description: 'When a deal exceeding 100,000 MAD is created or updated, notify the sales manager.',
      isActive: true,
      trigger: 'DealCreated',
      priority: 2,
      stopOnMatch: false,
      conflictStrategy: 'all-execute',
      version: 1,
      conditionGroups: [
        {
          id: 'group-1',
          logicalOperator: 'AND',
          conditions: [{ fieldKey: 'amount', operator: 'greaterThan', value: 100000 }]
        }
      ],
      actions: [
        {
          id: 'action-1',
          type: 'NotifyManager',
          params: {
            assignee: 'Achraf (Manager)',
            taskTitle: 'High-Value Deal Alert: Review Required',
            taskDescription: 'Auto-created: A deal exceeding 100,000 MAD was created. Please review and approve next steps.',
            taskTeam: 'Sales'
          }
        }
      ],
      createdAt: '2026-06-01',
      updatedAt: '2026-06-10',
      executionCount: 1
    },
    {
      id: 'rule-003',
      name: 'Sales Task – DIGITAL ABC Deal (Initiated or Deal Created)',
      description: 'If Customer Account = DIGITAL ABC AND Deal Status = Initiated OR Deal Status = Deal Created → Assign Sales Task to Sales Person ABC.',
      isActive: true,
      trigger: 'DealCreated',
      priority: 3,
      stopOnMatch: false,
      conflictStrategy: 'all-execute',
      version: 1,
      conditionGroups: [
        {
          id: 'group-1',
          logicalOperator: 'AND',
          conditions: [
            { fieldKey: 'customerAccount', operator: 'contains', value: 'DIGITAL ABC' },
            { fieldKey: 'stage', operator: 'equals', value: 'New' }
          ]
        },
        {
          id: 'group-2',
          logicalOperator: 'AND',
          conditions: [
            { fieldKey: 'customerAccount', operator: 'contains', value: 'DIGITAL ABC' },
            { fieldKey: 'stage', operator: 'equals', value: 'Proposal sent' }
          ]
        }
      ],
      actions: [
        {
          id: 'action-1',
          type: 'AssignSalesperson',
          params: { assignee: 'Amine Bennani' }
        },
        {
          id: 'action-2',
          type: 'CreateFollowUpTask',
          params: {
            taskTitle: 'Sales Follow-Up: DIGITAL ABC Deal',
            taskDescription: 'Auto-created: Deal for DIGITAL ABC is initiated. Assign and begin sales process.',
            taskTeam: 'Sales',
            assignee: 'Amine Bennani'
          }
        }
      ],
      createdAt: '2026-06-05',
      updatedAt: '2026-06-05',
      executionCount: 0
    },
    {
      id: 'rule-004',
      name: 'Send Welcome Email – New Lead',
      description: 'When a new lead is created, send a welcome email log to the contact.',
      isActive: true,
      trigger: 'LeadCreated',
      priority: 4,
      stopOnMatch: false,
      conflictStrategy: 'all-execute',
      version: 1,
      conditionGroups: [
        {
          id: 'group-1',
          logicalOperator: 'AND',
          conditions: [{ fieldKey: 'status', operator: 'equals', value: 'New' }]
        }
      ],
      actions: [
        {
          id: 'action-1',
          type: 'SendEmailLog',
          params: {
            emailSubject: 'Welcome – We received your inquiry',
            emailBody: 'Dear contact, thank you for reaching out. A member of our sales team will be in touch within 24 hours.',
            emailFrom: 'crm@acme.ma',
            emailTo: 'contact@lead.com'
          }
        }
      ],
      createdAt: '2026-06-10',
      updatedAt: '2026-06-10',
      executionCount: 5
    },
    {
      id: 'rule-005',
      name: 'Escalate Overdue Support Cases',
      description: 'When a ticket status is updated to Overdue/In Progress for more than 2 days, create an escalation task.',
      isActive: false,
      trigger: 'TicketUpdated',
      priority: 5,
      stopOnMatch: false,
      conflictStrategy: 'all-execute',
      version: 1,
      conditionGroups: [
        {
          id: 'group-1',
          logicalOperator: 'AND',
          conditions: [{ fieldKey: 'status', operator: 'equals', value: 'In Progress' }]
        }
      ],
      actions: [
        {
          id: 'action-1',
          type: 'NotifyManager',
          params: {
            assignee: 'Achraf (Manager)',
            taskTitle: 'Escalation: Overdue Support Ticket',
            taskDescription: 'Auto-created: A support ticket is In Progress and may need escalation.',
            taskTeam: 'Support'
          }
        }
      ],
      createdAt: '2026-06-15',
      updatedAt: '2026-06-15',
      executionCount: 0
    }
  ]);

  automationExecutions = signal<AutomationExecutionLog[]>([]);

  leadsData = signal<Lead[]>([]);

  // ────────────────────────────────────────────────────────
  // Automation Rule Engine
  // ────────────────────────────────────────────────────────

  private getNestedValue(obj: unknown, path: string): unknown {
    if (!obj || !path) return undefined;
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
  }

  private evaluateCondition(condition: AutomationCondition, entity: Record<string, unknown>, trigger?: AutomationTrigger): { passed: boolean, actual: unknown } {
    let raw: unknown = undefined;
    if (trigger) {
      const fields = TRIGGER_FIELD_MAP[trigger];
      const desc = fields?.find(f => f.key === condition.fieldKey);
      if (desc) {
        raw = this.getNestedValue(entity, desc.path);
      }
    }
    if (raw === undefined) {
      raw = entity[condition.fieldKey];
    }

    if (condition.operator === 'isEmpty') {
      const passed = raw === undefined || raw === null || raw === '';
      return { passed, actual: raw };
    }
    if (condition.operator === 'isNotEmpty') {
      const passed = raw !== undefined && raw !== null && raw !== '';
      return { passed, actual: raw };
    }

    if (raw === undefined || raw === null) {
      return { passed: false, actual: raw };
    }

    const actualStr = String(raw).toLowerCase();
    const expectedStr = condition.value !== undefined && condition.value !== null ? String(condition.value).toLowerCase() : '';

    let passed = false;
    switch (condition.operator) {
      case 'equals':
        passed = actualStr === expectedStr;
        break;
      case 'notEquals':
        passed = actualStr !== expectedStr;
        break;
      case 'contains':
        passed = actualStr.includes(expectedStr);
        break;
      case 'notContains':
        passed = !actualStr.includes(expectedStr);
        break;
      case 'greaterThan':
        passed = parseFloat(String(raw)) > parseFloat(String(condition.value));
        break;
      case 'lessThan':
        passed = parseFloat(String(raw)) < parseFloat(String(condition.value));
        break;
      case 'greaterThanOrEqual':
        passed = parseFloat(String(raw)) >= parseFloat(String(condition.value));
        break;
      case 'lessThanOrEqual':
        passed = parseFloat(String(raw)) <= parseFloat(String(condition.value));
        break;
    }
    return { passed, actual: raw };
  }

  private evaluateRule(rule: AutomationRule, entity: Record<string, unknown>): { passed: boolean, trace: unknown[] } {
    const trace: unknown[] = [];
    let rulePassed = false;

    for (const group of rule.conditionGroups) {
      const conditionsTraceList: unknown[] = [];
      let groupPassed = true;

      for (const cond of group.conditions) {
        const { passed, actual } = this.evaluateCondition(cond, entity, rule.trigger);
        if (!passed) {
          groupPassed = false;
        }
        conditionsTraceList.push({
          fieldKey: cond.fieldKey,
          expected: cond.value,
          actual,
          passed
        });
      }

      if (group.conditions.length === 0) {
        groupPassed = true;
      }

      trace.push({
        groupId: group.id,
        passed: groupPassed,
        conditions: conditionsTraceList
      });

      if (groupPassed) {
        rulePassed = true;
      }
    }

    if (rule.conditionGroups.length === 0) {
      rulePassed = true;
    }

    return { passed: rulePassed, trace };
  }

  async evaluateRules(trigger: AutomationTrigger, entity: Record<string, unknown>, entityLabel: string, dryRunRuleId?: string): Promise<AutomationExecutionLog[]> {
    const logs: AutomationExecutionLog[] = [];
    
    await new Promise<void>(resolve => setTimeout(resolve, 0));

    const allRules = this.automationRules();
    let rulesToEvaluate = allRules.filter(r => r.isActive && r.trigger === trigger);

    if (dryRunRuleId) {
      const specificRule = allRules.find(r => r.id === dryRunRuleId);
      rulesToEvaluate = specificRule ? [specificRule] : [];
    } else {
      rulesToEvaluate.sort((a, b) => (a.priority || 99) - (b.priority || 99));
    }

    let entityType: 'Lead' | 'Deal' | 'Ticket' = 'Lead';
    if (trigger.startsWith('Deal')) entityType = 'Deal';
    else if (trigger.startsWith('Ticket')) entityType = 'Ticket';

    for (const rule of rulesToEvaluate) {
      const { passed, trace } = this.evaluateRule(rule, entity);
      if (!passed && !dryRunRuleId) {
        continue;
      }

      const actionsExecuted: { actionId: string; type: AutomationActionType; status: 'ok' | 'error'; error?: string }[] = [];
      let status: 'success' | 'partial' | 'failed' = passed ? 'success' : 'failed';

      if (passed && !dryRunRuleId) {
        let successCount = 0;
        let failCount = 0;

        for (const action of rule.actions) {
          try {
            switch (action.type) {
              case 'AssignSalesperson':
                if (action.params.assignee) {
                  if (trigger.startsWith('Lead')) {
                    this.leadsData.update(list => list.map(l =>
                      l.id === entity['id'] ? { ...l, assignedSalesperson: action.params.assignee } : l
                    ));
                  } else if (trigger.startsWith('Deal')) {
                    this.deals.update(list => list.map(d =>
                      d.id === entity['id'] ? { ...d, salesPerson: action.params.assignee } : d
                    ));
                  }
                }
                break;

              case 'CreateFollowUpTask':
                this.addTask({
                  id: 't-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
                  title: action.params.taskTitle || 'Automation Follow-Up Task',
                  description: action.params.taskDescription || 'Auto-created by workflow automation.',
                  assignedTeam: action.params.targetTeam || action.params.taskTeam || 'Sales',
                  assignedTo: action.params.assignee || '',
                  status: 'Pending',
                  relatedTo: entityLabel,
                  relatedModule: entityType === 'Lead' ? 'Partners' : entityType === 'Deal' ? 'Sales' : 'Support',
                  relatedSubModule: entityType === 'Lead' ? 'Lead' : entityType === 'Deal' ? 'Deal' : 'Ticket',
                  relatedEntityId: entity['id']
                } as unknown);
                break;

              case 'NotifyManager':
                this.addTask({
                  id: 't-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
                  title: action.params.taskTitle || 'Manager Notification',
                  description: action.params.taskDescription || 'Auto-created manager notification.',
                  assignedTeam: action.params.targetTeam || action.params.taskTeam || 'Sales',
                  assignedTo: action.params.assignee || 'Achraf (Manager)',
                  status: 'Pending',
                  relatedTo: entityLabel,
                  relatedModule: entityType === 'Lead' ? 'Partners' : entityType === 'Deal' ? 'Sales' : 'Support',
                  relatedSubModule: entityType === 'Lead' ? 'Lead' : entityType === 'Deal' ? 'Deal' : 'Ticket',
                  relatedEntityId: entity['id']
                } as unknown);
                break;

              case 'SendEmailLog':
                if (trigger.startsWith('Lead')) {
                  this.addLeadActivity(entity['id'], {
                    type: 'Email',
                    date: new Date().toISOString().split('T')[0],
                    summary: action.params.emailSubject || 'Automated Email',
                    detail: action.params.emailBody || '',
                    assignedTo: 'System'
                  });
                } else if (trigger.startsWith('Deal')) {
                  this.deals.update(list => list.map(d => {
                    if (d.id === entity['id']) {
                      const activityLog = d.activityLog || { calls: [], emails: [], meetings: [], recordings: [], notes: [], followUps: [] };
                      const newEmail = {
                        id: 'e-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
                        date: new Date().toISOString().split('T')[0],
                        from: action.params.emailFrom || 'crm@acme.ma',
                        to: action.params.emailTo || d.contactEmail || 'contact@client.com',
                        subject: action.params.emailSubject || 'Automated Email',
                        body: action.params.emailBody || '',
                        direction: 'sent' as const
                      };
                      return {
                        ...d,
                        activityLog: {
                          ...activityLog,
                          emails: [...activityLog.emails, newEmail]
                        }
                      };
                    }
                    return d;
                  }));
                }
                break;

              case 'UpdateEntityField':
                if (action.params.fieldKey && action.params.fieldValue !== undefined) {
                  const key = action.params.fieldKey;
                  const value = action.params.fieldValue;
                  if (trigger.startsWith('Lead')) {
                    this.leadsData.update(list => list.map(l =>
                      l.id === entity['id'] ? { ...l, [key]: value } : l
                    ));
                  } else if (trigger.startsWith('Deal')) {
                    this.deals.update(list => list.map(d =>
                      d.id === entity['id'] ? { ...d, [key]: value } : d
                    ));
                  } else if (trigger.startsWith('Ticket')) {
                    this.tickets.update(list => list.map(t =>
                      t.id === entity['id'] ? { ...t, [key]: value } : t
                    ));
                  }
                }
                break;

              case 'ChangeStage':
                if (action.params.targetStage) {
                  if (trigger.startsWith('Lead')) {
                    this.leadsData.update(list => list.map(l =>
                      l.id === entity['id'] ? { ...l, stage: action.params.targetStage! } : l
                    ));
                  } else if (trigger.startsWith('Deal')) {
                    this.deals.update(list => list.map(d =>
                      d.id === entity['id'] ? { ...d, stage: action.params.targetStage as unknown } : d
                    ));
                  }
                }
                break;

              case 'CreateNote':
                if (action.params.noteContent) {
                  if (trigger.startsWith('Lead')) {
                    this.addLeadActivity(entity['id'], {
                      type: 'Note',
                      date: new Date().toISOString().split('T')[0],
                      summary: 'Automated Note',
                      detail: action.params.noteContent,
                      assignedTo: 'System'
                    });
                  } else if (trigger.startsWith('Deal')) {
                    this.deals.update(list => list.map(d => {
                      if (d.id === entity['id']) {
                        const activityLog = d.activityLog || { calls: [], emails: [], meetings: [], recordings: [], notes: [], followUps: [] };
                        const newNote = {
                          id: 'n-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
                          date: new Date().toISOString().split('T')[0],
                          author: 'System',
                          content: action.params.noteContent!
                        };
                        return {
                          ...d,
                          activityLog: {
                            ...activityLog,
                            notes: [...activityLog.notes, newNote]
                          }
                        };
                      }
                      return d;
                    }));
                  }
                }
                break;

              case 'AddTag':
                if (action.params.tagName) {
                  if (trigger.startsWith('Lead')) {
                    this.leadsData.update(list => list.map(l => {
                      if (l.id === entity['id']) {
                        const existingNotes = l.notes || '';
                        const tagStr = `[Tag: ${action.params.tagName}]`;
                        return {
                          ...l,
                          notes: existingNotes.includes(tagStr) ? existingNotes : existingNotes ? `${existingNotes} ${tagStr}` : tagStr
                        };
                      }
                      return l;
                    }));
                  } else if (trigger.startsWith('Deal')) {
                    this.deals.update(list => list.map(d => {
                      if (d.id === entity['id']) {
                        const existingComments = d.comments || '';
                        const tagStr = `[Tag: ${action.params.tagName}]`;
                        return {
                          ...d,
                          comments: existingComments.includes(tagStr) ? existingComments : existingComments ? `${existingComments} ${tagStr}` : tagStr
                        };
                      }
                      return d;
                    }));
                  }
                }
                break;
            }
            actionsExecuted.push({
              actionId: action.id,
              type: action.type,
              status: 'ok'
            });
            successCount++;
          } catch (err: unknown) {
            actionsExecuted.push({
              actionId: action.id,
              type: action.type,
              status: 'error',
              error: err?.message || String(err)
            });
            failCount++;
          }
        }

        if (failCount > 0) {
          status = successCount > 0 ? 'partial' : 'failed';
        }
      }

      const logEntry: AutomationExecutionLog = {
        id: 'exec-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        ruleId: rule.id,
        ruleName: rule.name,
        ruleVersion: rule.version || 1,
        trigger,
        entityType,
        entityId: String(entity['id'] || ''),
        entityLabel,
        executedAt: new Date().toLocaleString(),
        dryRun: !!dryRunRuleId,
        conditionsTrace: trace,
        actionsExecuted,
        status
      };

      if (!dryRunRuleId) {
        this.automationExecutions.update(logs => [logEntry, ...logs]);
        this.automationRules.update(rules => rules.map(r =>
          r.id === rule.id ? { ...r, executionCount: (r.executionCount || 0) + 1 } : r
        ));
      }

      logs.push(logEntry);

      if (rule.stopOnMatch && passed && !dryRunRuleId) {
        break;
      }
    }

    return logs;
  }

  addAutomationRule(rule: Omit<AutomationRule, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'executionCount' | 'changeHistory'>) {
    this.api.createAutomationRule(rule).subscribe({
      next: (dto) => {
        this.automationRules.update(rules => [...rules, dto]);
        this.toast.show(`Rule <strong>${dto.name}</strong> created`, {
          undo: () => {
            this.automationRules.update(rules => rules.filter(r => r.id !== dto.id));
          }
        });
      },
      error: () => this.toast.show('Failed to create automation rule', { type: 'error' })
    });
  }

  updateAutomationRule(ruleId: string, updates: Partial<AutomationRule>) {
    const current = this.automationRules().find(r => r.id === ruleId);
    if (!current) return;
    const nextVersion = (current.version || 1) + 1;
    const snapshot = { ...current };
    delete (snapshot as unknown).changeHistory;

    const history = current.changeHistory || [];
    const newHistory = [
      {
        version: current.version || 1,
        changedAt: new Date().toISOString().split('T')[0],
        changedBy: updates.lastModifiedBy || 'Achraf (Manager)',
        snapshot
      },
      ...history
    ].slice(0, 10);

    const payload = {
      ...updates,
      version: nextVersion,
      updatedAt: new Date().toISOString().split('T')[0],
      changeHistory: newHistory
    };

    this.api.updateAutomationRule(ruleId, payload).subscribe({
      next: (dto) => {
        this.automationRules.update(rules => rules.map(r => r.id === ruleId ? { ...r, ...dto } : r));
      },
      error: () => this.toast.show('Failed to update automation rule', { type: 'error' })
    });
  }

  toggleAutomationRule(ruleId: string) {
    const rule = this.automationRules().find(r => r.id === ruleId);
    if (!rule) return;
    const wasActive = rule.isActive;
    const payload = { isActive: !wasActive, updatedAt: new Date().toISOString().split('T')[0] };
    this.api.updateAutomationRule(ruleId, payload).subscribe({
      next: (dto) => {
        this.automationRules.update(rules => rules.map(r => r.id === ruleId ? { ...r, ...dto } : r));
        this.toast.show(`Rule <strong>${rule.name}</strong> ${wasActive ? 'paused' : 'activated'}`, {
          undo: () => {
            this.automationRules.update(rules => rules.map(r =>
              r.id === ruleId ? { ...r, isActive: wasActive } : r
            ));
          }
        });
      },
      error: () => this.toast.show('Failed to update automation rule', { type: 'error' })
    });
  }

  deleteAutomationRule(ruleId: string) {
    const deleted = this.automationRules().find(r => r.id === ruleId);
    this.api.deleteAutomationRule(ruleId).subscribe({
      next: () => {
        this.automationRules.update(rules => rules.filter(r => r.id !== ruleId));
        this.toast.show(`Rule <strong>${deleted?.name || ruleId}</strong> deleted`, {
          undo: () => {
            if (deleted) {
              this.automationRules.update(rules => [...rules, deleted]);
            }
          }
        });
      },
      error: () => this.toast.show('Failed to delete automation rule', { type: 'error' })
    });
  }

  // ────────────────────────────────────────────────────────
  // Lead CRUD (automation-aware)
  // ────────────────────────────────────────────────────────
  private leadStatusToPartnerStage(status: Lead['status']): string {
    const map: Record<Lead['status'], string> = {
      'New': 'NEW',
      'Contacted': 'CONTACTED',
      'Attempted Contact': 'ATTEMPTED_CONTACT',
      'Meeting Scheduled': 'MEETING_SCHEDULED',
      'Qualified': 'QUALIFIED',
      'Proposal Requested': 'PROPOSAL_SENT',
      'Converted': 'CONFIRMED',
      'Lost': 'LOST',
      'Disqualified': 'DISQUALIFIED'
    };
    return map[status] || 'NEW';
  }

  private leadSourceToPartnerSource(source?: string): string | undefined {
    const map: Record<string, string> = {
      'Website form': 'WEBSITE',
      'Landing Page': 'WEBSITE',
      'Trade show': 'TRADE_SHOW',
      'LinkedIn': 'LINKEDIN',
      'Marketing campaign': 'CAMPAIGN',
      'Marketing Campaign': 'CAMPAIGN',
      'Referral': 'REFERRAL',
      'Email': 'INBOUND',
      'WhatsApp': 'INBOUND',
      'Facebook': 'OTHER',
      'Other': 'OTHER'
    };
    return source ? map[source] : undefined;
  }

  private leadToPartnerPayload(lead: Partial<Lead> & { name: string }): unknown {
    return {
      type: 'LEAD',
      name: lead.name,
      company_name: lead.companyName,
      email: lead.email || lead.contacts?.[0]?.email,
      phone: lead.phone || lead.contacts?.[0]?.phone,
      city: lead.company?.city,
      country: lead.company?.country,
      source: this.leadSourceToPartnerSource(lead.source || lead.campaigns?.[0]?.source),
      score: lead.score,
      temperature: lead.temperature?.toUpperCase(),
      priority: lead.priority?.toUpperCase(),
      qualification: lead.qualification?.toUpperCase(),
      stage: lead.status ? this.leadStatusToPartnerStage(lead.status) : undefined,
      estimated_deal_value: lead.estimatedDealValue,
      probability: lead.probability,
      expected_close_date: lead.expectedCloseDate,
      comments: lead.notes,
      company: lead.company,
      product_interests: lead.productInterests,
      campaigns: lead.campaigns,
      notes: lead.notes
    };
  }

  addLead(lead: Omit<Lead, 'id' | 'createdDate' | 'createdBy' | 'createdAt' | 'modifiedDate' | 'modifiedBy' | 'statusHistory'>) {
    const newId = 'LEAD-' + String(this.leadsData().length + 1).padStart(6, '0');
    const nowStr = new Date().toISOString().split('T')[0];
    const currentUser = this.users().find(u => u.id === this.currentUserId());
    const currentUserName = currentUser?.displayName || 'Achraf (Manager)';
    const newLead: Lead = {
      ...lead,
      id: newId,
      createdDate: nowStr,
      createdBy: this.currentUserId(),
      modifiedDate: nowStr,
      modifiedBy: this.currentUserId(),
      statusHistory: [
        {
          status: lead.status,
          timestamp: new Date().toLocaleString(),
          user: currentUserName
        }
      ],
      activities: lead.activities || [],
      attachments: lead.attachments || [],
      contacts: lead.contacts || [],
      productInterests: lead.productInterests || [],
      campaigns: lead.campaigns || []
    };
    this.leadsData.update(list => [...list, newLead]);
    // Fire automation rules after lead is persisted
    setTimeout(() => this.evaluateRules('LeadCreated', newLead as unknown as Record<string, unknown>, `Lead: ${newLead.name} (${newLead.companyName})`), 0);
    const leadName = newLead.name;
    this.api.createPartner(this.leadToPartnerPayload(newLead)).subscribe({
      next: (dto) => {
        this.leadsData.update(list => list.map(l => l.id === newLead.id ? { ...l, id: dto.id } : l));
      },
      error: () => this.toast.show('Failed to save lead to the server', { type: 'error' })
    });
    this.toast.show(`Lead <strong>${leadName}</strong> created`, {
      undo: () => {
        const current = this.leadsData().find(l => l === newLead || l.name === leadName);
        this.leadsData.update(list => list.filter(l => l !== current));
        if (current) {
          this.api.deletePartner(current.id).subscribe({ error: () => { /* ignore error */ } });
        }
      }
    });
    return newLead;
  }

  deleteLead(leadId: string): void {
    const removed = this.leadsData().find(l => l.id === leadId);
    if (!removed) return;
    this.leadsData.update(list => list.filter(l => l.id !== leadId));
    this.api.deletePartner(leadId).subscribe({
      error: () => {
        this.leadsData.update(list => [...list, removed]);
        this.toast.show('Failed to delete lead', { type: 'error' });
      }
    });
    this.toast.show(`Lead <strong>${removed.name}</strong> deleted`, {
      undo: () => {
        this.leadsData.update(list => [...list, removed]);
      }
    });
  }

  updateLeadStatus(leadId: string, status: Lead['status']) {
    let prevStatus: string | undefined;
    const currentUser = this.users().find(u => u.id === this.currentUserId());
    const currentUserName = currentUser?.displayName || 'Achraf';
    const lead = this.leadsData().find(l => l.id === leadId);
    this.leadsData.update(list => list.map(l => {
      if (l.id === leadId) {
        prevStatus = l.status;
        const history = l.statusHistory || [];
        return {
          ...l,
          status,
          modifiedDate: new Date().toISOString().split('T')[0],
          modifiedBy: this.currentUserId(),
          statusHistory: [
            ...history,
            {
              status,
              timestamp: new Date().toLocaleString(),
              user: currentUserName
            }
          ]
        };
      }
      return l;
    }));
    this.api.createLeadStatusHistory(leadId, { status }).subscribe({
      error: () => this.toast.show('Failed to record status change on the server', { type: 'error' })
    });
    this.api.updatePartner(leadId, this.leadToPartnerPayload({ ...(lead || { name: leadId }), status })).subscribe({
      error: () => { /* ignore error */ }
    });
    this.toast.show(`Lead <strong>${lead?.name || leadId}</strong> status changed to ${status}`, {
      undo: () => {
        if (prevStatus) {
          this.updateLeadStatus(leadId, prevStatus as Lead['status']);
        }
      }
    });
  }

  updateLead(leadId: string, updates: Partial<Lead>) {
    const currentUser = this.users().find(u => u.id === this.currentUserId());
    const currentUserName = currentUser?.displayName || 'Achraf';
    this.leadsData.update(list => list.map(l => {
      if (l.id === leadId) {
        const updated = {
          ...l,
          ...updates,
          modifiedDate: new Date().toISOString().split('T')[0],
          modifiedBy: this.currentUserId()
        };
        if (updates.status && updates.status !== l.status) {
          const history = l.statusHistory || [];
          updated.statusHistory = [
            ...history,
            {
              status: updates.status,
              timestamp: new Date().toLocaleString(),
              user: currentUserName
            }
          ];
        }
        return updated;
      }
      return l;
    }));
    const updatedLead = this.leadsData().find(l => l.id === leadId);
    if (updatedLead) {
      setTimeout(() => this.evaluateRules('LeadUpdated', updatedLead as unknown as Record<string, unknown>, `Lead: ${updatedLead.name} (${updatedLead.companyName})`), 0);
      this.api.updatePartner(leadId, this.leadToPartnerPayload(updatedLead)).subscribe({
        error: () => this.toast.show('Failed to sync lead update to the server', { type: 'error' })
      });
    }
    this.toast.show(`Lead <strong>${updatedLead?.name || leadId}</strong> updated`, { type: 'info' });
  }

  addLeadActivity(leadId: string, activity: Omit<LeadActivity, 'id'>) {
    const lead = this.leadsData().find(l => l.id === leadId);
    this.leadsData.update(list => list.map(l => {
      if (l.id === leadId) {
        const activities = l.activities || [];
        const newAct = {
          ...activity,
          id: 'la-' + (activities.length + 1) + '-' + Date.now()
        };
        return {
          ...l,
          activities: [...activities, newAct],
          modifiedDate: new Date().toISOString().split('T')[0],
          modifiedBy: this.currentUserId()
        };
      }
      return l;
    }));
    this.api.createLeadActivity(leadId, {
      type: activity.type.toUpperCase(),
      summary: activity.summary,
      detail: activity.detail,
      occurred_at: activity.date ? new Date(activity.date).toISOString() : undefined,
      next_follow_up_at: activity.nextFollowUp ? new Date(activity.nextFollowUp).toISOString() : undefined
    }).subscribe({
      error: () => this.toast.show('Failed to save activity to the server', { type: 'error' })
    });
    this.toast.show(`${activity.type} added to <strong>${lead?.name || leadId}</strong>`);
  }

  addLeadAttachment(leadId: string, attachment: Omit<LeadAttachment, 'id'>) {
    this.leadsData.update(list => list.map(l => {
      if (l.id === leadId) {
        const attachments = l.attachments || [];
        const newAtt = {
          ...attachment,
          id: 'lat-' + (attachments.length + 1) + '-' + Date.now()
        };
        return {
          ...l,
          attachments: [...attachments, newAtt],
          modifiedDate: new Date().toISOString().split('T')[0],
          modifiedBy: this.currentUserId()
        };
      }
      return l;
    }));
  }

  removeLeadAttachment(leadId: string, attachmentId: string) {
    this.leadsData.update(list => list.map(l => {
      if (l.id === leadId) {
        return {
          ...l,
          attachments: (l.attachments || []).filter(a => a.id !== attachmentId)
        };
      }
      return l;
    }));
  }

  activityLogs = signal<ActivityLog[]>([
    { id: 'act1', targetId: 'd1', type: 'Call', description: 'Initial discovery call with Atlas team.', timestamp: '2026-06-20' },
    { id: 'act2', targetId: 'd1', type: 'Email', description: 'Sent technical proposal and pricing breakdown.', timestamp: '2026-06-21' }
  ]);



  // Derived states
  customers = computed(() => this.partners().filter(p => p.type === 'Customer'));
  vendors = computed(() => this.partners().filter(p => p.type === 'Vendor'));
  prospects = computed(() => this.partners().filter(p => p.type === 'Prospect'));
  leads = computed(() => this.partners().filter(p => p.type === 'Lead'));

  allCustomers360 = computed(() =>
    this.partners()
      .filter(p => p.type === 'Customer')
      .map(p => this.getCustomer360(p.id)!)
      .filter(Boolean)
  );

  customerInvoices = computed(() => this.invoices().filter(i => i.type === 'Customer'));
  vendorInvoices = computed(() => this.invoices().filter(i => i.type === 'Vendor'));
  overdueInvoices = computed(() => this.invoices().filter(i => i.type === 'Customer' && i.status === 'Overdue'));

  salesThisMonth = computed(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-11
    
    return this.deals()
      .filter(d => {
        if (!d.orderDate) return false;
        const dDate = new Date(d.orderDate);
        const isCurrentMonth = dDate.getFullYear() === currentYear && dDate.getMonth() === currentMonth;
        const isWon = ['Confirmed', 'Awaiting Invoicing', 'Invoiced', 'Closed Won'].includes(d.stage);
        return isCurrentMonth && isWon;
      })
      .reduce((sum, d) => sum + d.amount, 0);
  });

  conversionRate = computed(() => {
    const total = this.deals().length;
    if (total === 0) return 0;
    const converted = this.deals().filter(d => 
      ['Confirmed', 'Awaiting Invoicing', 'Invoiced', 'Closed Won'].includes(d.stage)
    ).length;
    return Math.round((converted / total) * 100);
  });

  winRate = computed(() => {
    const won = this.deals().filter(d => 
      ['Confirmed', 'Awaiting Invoicing', 'Invoiced', 'Closed Won'].includes(d.stage)
    ).length;
    const lost = this.deals().filter(d => d.stage === 'Closed Lost').length;
    if (won + lost === 0) return 0;
    return Math.round((won / (won + lost)) * 100);
  });

  avgDealSize = computed(() => {
    const validDeals = this.deals().filter(d => d.stage !== 'Closed Lost');
    if (validDeals.length === 0) return 0;
    const sum = validDeals.reduce((acc, d) => acc + d.amount, 0);
    return Math.round(sum / validDeals.length);
  });

  dealsByRegion = computed(() => {
    const groups: Record<string, number> = {};
    this.deals().forEach(d => {
      const region = d.salesRegion || 'Unspecified';
      const isWon = ['Confirmed', 'Awaiting Invoicing', 'Invoiced', 'Closed Won'].includes(d.stage);
      if (isWon) {
        groups[region] = (groups[region] || 0) + d.amount;
      }
    });
    return Object.entries(groups).map(([region, total]) => ({ region, total }));
  });

  topCustomers = computed(() => {
    const groups: Record<string, { name: string; totalValue: number; dealCount: number }> = {};
    this.deals().forEach(d => {
      const partner = this.partners().find(p => p.id === d.partnerId);
      const name = partner ? partner.name : 'Unknown Client';
      const isWon = ['Confirmed', 'Awaiting Invoicing', 'Invoiced', 'Closed Won'].includes(d.stage);
      if (isWon) {
        if (!groups[d.partnerId]) {
          groups[d.partnerId] = { name, totalValue: 0, dealCount: 0 };
        }
        groups[d.partnerId].totalValue += d.amount;
        groups[d.partnerId].dealCount += 1;
      }
    });
    return Object.values(groups).sort((a, b) => b.totalValue - a.totalValue);
  });

  lostOpportunities = computed(() => {
    return this.deals().filter(d => d.stage === 'Closed Lost');
  });

  salesForecast = computed(() => {
    const groups: Record<string, number> = {};
    this.deals()
      .filter(d => d.stage !== 'Closed Lost')
      .forEach(d => {
        const rep = d.salesPerson || 'Unassigned';
        let monthStr = 'Future';
        if (d.orderDate) {
          const date = new Date(d.orderDate);
          monthStr = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
        }
        const key = `${monthStr}|${rep}`;
        groups[key] = (groups[key] || 0) + d.amount;
      });
    
    return Object.entries(groups).map(([key, total]) => {
      const [month, salesperson] = key.split('|');
      return { month, salesperson, total };
    });
  });

  // ────────────────────────────────────────────────────────
  // Notifications data
  // ────────────────────────────────────────────────────────
  notifications = signal<Notification[]>([
    { id: 'notif-1', type: 'deal', title: 'New Deal Created', message: 'Atlas Digital Cloud Migration Deal worth 13,500 MAD has been created.', timestamp: '2026-07-11T09:30:00', read: false, relatedId: 'd1' },
    { id: 'notif-2', type: 'task', title: 'Task Assigned', message: 'You have been assigned "Follow up with ABC Technologies" task.', timestamp: '2026-07-11T08:15:00', read: false, relatedId: 't3' },
    { id: 'notif-3', type: 'ticket', title: 'Ticket Updated', message: 'Ticket #TK-0891 "Problème accès console Cloud" status changed to In Progress.', timestamp: '2026-07-10T16:45:00', read: false, relatedId: 'tk1' },
    { id: 'notif-4', type: 'system', title: 'System Update', message: 'CRM system will undergo maintenance on Saturday, July 15th at 2:00 AM.', timestamp: '2026-07-10T14:00:00', read: false },
    { id: 'notif-5', type: 'mention', title: 'Mentioned in Comment', message: 'Youssef El Alami mentioned you in a comment on Deal #d-p5-1.', timestamp: '2026-07-10T11:20:00', read: false, relatedId: 'd-p5-1' },
    { id: 'notif-6', type: 'deal', title: 'Deal Stage Changed', message: 'ABC Technologies Cloud ERP Migration moved to Confirmed stage.', timestamp: '2026-07-09T15:00:00', read: true, relatedId: 'd-p5-1' },
    { id: 'notif-7', type: 'ticket', title: 'New Ticket Created', message: 'Ticket "ERP Login Issue" has been opened by ABC Technologies.', timestamp: '2026-07-09T10:30:00', read: true, relatedId: 'tk-p5-1' },
    { id: 'notif-8', type: 'task', title: 'Task Completed', message: 'Fatima Chraibi completed "Prepare monthly sales report" task.', timestamp: '2026-07-08T17:00:00', read: true, relatedId: 't5' },
    { id: 'notif-9', type: 'system', title: 'Integration Sync Complete', message: 'WhatsApp integration sync completed successfully. 15 new messages processed.', timestamp: '2026-07-08T09:00:00', read: true },
    { id: 'notif-10', type: 'mention', title: 'Mentioned in Meeting', message: 'Ahmed Bennani added you as attendee to "Q3 Pipeline Review" meeting.', timestamp: '2026-07-07T14:30:00', read: true },
  ]);

  unreadNotificationsCount = computed(() => this.notifications().filter(n => !n.read).length);

  notificationsLoaded = signal<boolean>(false);
  notificationsLoading = signal<boolean>(false);
  notificationsError = signal<string | null>(null);

  private mapNotificationDto(dto: unknown): Notification {
    return {
      id: dto.id,
      type: (dto.type || 'system').toLowerCase(),
      title: dto.title,
      message: dto.message,
      timestamp: dto.createdAt,
      read: !!dto.isRead,
      relatedId: dto.relatedEntityId || undefined
    };
  }

  loadNotifications(): void {
    if (this.notificationsLoaded()) return;
    this.notificationsLoading.set(true);
    this.notificationsError.set(null);
    this.api.getNotifications().subscribe({
      next: (notifications) => {
        if (notifications && notifications.length > 0) {
          this.notifications.set(notifications.map(n => this.mapNotificationDto(n)));
        }
        this.notificationsLoaded.set(true);
        this.notificationsLoading.set(false);
      },
      error: (err) => {
        console.warn('Failed to load notifications from API, using seed data:', err);
        this.notificationsLoaded.set(true);
        this.notificationsLoading.set(false);
        this.notificationsError.set('Failed to load notifications from the server. Showing local data.');
      }
    });
  }

  markNotificationRead(notifId: string) {
    this.notifications.update(list => list.map(n => n.id === notifId ? { ...n, read: true } : n));
    this.api.markNotificationRead(notifId).subscribe({
      error: () => console.warn('Failed to mark notification as read on the server')
    });
  }

  markAllNotificationsRead() {
    this.notifications.update(list => list.map(n => ({ ...n, read: true })));
    this.api.markAllNotificationsRead().subscribe({
      error: () => console.warn('Failed to mark all notifications as read on the server')
    });
  }

  // ────────────────────────────────────────────────────────
  // Inbox messages data
  // ────────────────────────────────────────────────────────
  inboxMessages = signal<InboxMessage[]>([
    { id: 'msg-1', sender: 'Karim Atlas', senderEmail: 'k.atlas@atlasdigital.ma', subject: 'Re: Cloud Migration Proposal', preview: 'Thank you for the detailed proposal. We have reviewed it and would like to schedule a follow-up meeting to discuss the next steps.', timestamp: '2026-07-11T10:15:00', read: false, hasAttachments: false },
    { id: 'msg-2', sender: 'Samira Benjelloun', senderEmail: 's.benjelloun@acg.ma', subject: 'Invoice #i1 - Payment Reminder', preview: 'This is a reminder that invoice #i1 for Atlas Digital Cloud Migration is now overdue. Please follow up with the client.', timestamp: '2026-07-11T09:00:00', read: false, hasAttachments: true },
    { id: 'msg-3', sender: 'Mohammed Alaoui', senderEmail: 'ceo@abctech.ma', subject: 'ERP Implementation Timeline', preview: 'We need to discuss the revised timeline for the ERP implementation. Our IT team has raised some concerns about the current schedule.', timestamp: '2026-07-10T16:30:00', read: false, hasAttachments: false },
    { id: 'msg-4', sender: 'System Notification', senderEmail: 'noreply@acg.ma', subject: 'Automation Rule Triggered: High-Value Deal Alert', preview: 'Rule "Notify Manager – Deal > 100k" was triggered for deal Maroc Telecom Systems Network Upgrade (120,000 MAD).', timestamp: '2026-07-10T14:00:00', read: true, hasAttachments: false },
    { id: 'msg-5', sender: 'Fatima Zahra El Idrissi', senderEmail: 'fz.elidrissi@acg.ma', subject: 'Q3 Pipeline Review Meeting', preview: 'Hi everyone, I\'ve scheduled the Q3 pipeline review for next Monday at 10:00 AM. Please confirm your availability.', timestamp: '2026-07-09T11:45:00', read: true, hasAttachments: true },
    { id: 'msg-6', sender: 'Youssef Alami', senderEmail: 'y.alami@acg.ma', subject: 'Delivery Status - Atlas Digital Servers', preview: 'The servers for Atlas Digital have been shipped and are expected to arrive by July 5th. Tracking number is attached.', timestamp: '2026-07-08T15:20:00', read: true, hasAttachments: true },
    { id: 'msg-7', sender: 'Zineb Tahiri', senderEmail: 'z.tahiri@acg.ma', subject: 'Ticket #TK-0891 Update', preview: 'We have identified the root cause of the Cloud console access issue. It is related to a recent SSO configuration change.', timestamp: '2026-07-08T10:00:00', read: true, hasAttachments: false },
  ]);

  unreadInboxCount = computed(() => this.inboxMessages().filter(m => !m.read).length);

  markInboxMessageRead(msgId: string) {
    this.inboxMessages.update(list => list.map(m => m.id === msgId ? { ...m, read: true } : m));
  }

  markAllInboxMessagesRead() {
    this.inboxMessages.update(list => list.map(m => ({ ...m, read: true })));
  }

  isCustomizing = signal(false);

  /**
   * Visible dashboard tiles, in display order. Panels and KPIs share one list because they
   * share one grid — the order is exactly what the bento grid renders.
   */
  readonly defaultDashboardLayout: readonly string[] = [
    // KPIs lead the board — five 2-column tiles filling one full 12-column row up top,
    // followed by Late Payers to close that row before the larger panels begin.
    'kpi:totalDeals',
    'kpi:newDeals',
    'kpi:totalProspects',
    'kpi:openTickets',
    'kpi:newTasksWeek',
    'late-payers',
    'today',
    'pipeline',
    'tasks-queue',
    'schedule',
    'tickets-queue',
    'partner-mix',
    'task-status'
  ];

  // Bumped to v2 when the default tile order changed to lead with KPIs — this
  // invalidates layouts saved under the old default so returning users pick up
  // the new order instead of being stuck on a stale arrangement.
  private static readonly LAYOUT_KEY = 'bento_dashboard_layout_v2';

  dashboardLayout = signal<string[]>(this.readStoredLayout());

  private readStoredLayout(): string[] {
    if (typeof localStorage === 'undefined') return [...this.defaultDashboardLayout];
    try {
      const raw = localStorage.getItem(CrmStateService.LAYOUT_KEY);
      if (!raw) return [...this.defaultDashboardLayout];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0 || parsed.some(id => typeof id !== 'string')) {
        return [...this.defaultDashboardLayout];
      }
      return parsed as string[];
    } catch {
      return [...this.defaultDashboardLayout];
    }
  }

  private persistLayout(layout: string[]) {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(CrmStateService.LAYOUT_KEY, JSON.stringify(layout));
    } catch {
      /* storage full or disabled — the layout just won't survive a reload */
    }
  }

  /** Commit a new tile order (drag-to-rearrange). */
  setDashboardLayout(layout: string[]) {
    this.dashboardLayout.set([...layout]);
    this.persistLayout(layout);
  }

  /** Show or hide a tile. Newly shown tiles land at the end of the board. */
  toggleDashboardTile(id: string) {
    this.dashboardLayout.update(layout => {
      const next = layout.includes(id) ? layout.filter(x => x !== id) : [...layout, id];
      this.persistLayout(next);
      return next;
    });
  }

  resetDashboardLayout() {
    this.setDashboardLayout([...this.defaultDashboardLayout]);
  }

  // State transitions & helpers
  private persistPartnerUpdate(partner: Partner): void {
    this.api.updatePartner(partner.id, this.partnerToApiPayload(partner)).subscribe({
      error: () => this.toast.show('Failed to sync partner change to the server', { type: 'error' })
    });
  }

  convertToCustomer(partnerId: string) {
    let prevType = '';
    this.partners.update(partners =>
      partners.map(p => {
        if (p.id === partnerId) {
          prevType = p.type;
          return { ...p, type: 'Customer' };
        }
        return p;
      })
    );
    const partner = this.partners().find(p => p.id === partnerId);
    if (partner) this.persistPartnerUpdate(partner);
    this.toast.show(`<strong>${partner?.name || 'Partner'}</strong> converted to Customer`, {
      undo: () => {
        this.partners.update(partners =>
          partners.map(p => p.id === partnerId ? { ...p, type: prevType as PartnerType } : p)
        );
        const reverted = this.partners().find(p => p.id === partnerId);
        if (reverted) this.persistPartnerUpdate(reverted);
      },
      action: {
        label: 'View in Customers',
        onClick: () => {
          this.navigateTab.set('Customer');
          this.router.navigate(['/partners']);
        }
      }
    });
  }

  convertLeadToProspect(partnerId: string) {
    this.partners.update(partners =>
      partners.map(p => p.id === partnerId ? { ...p, type: 'Prospect' } : p)
    );
    const partner = this.partners().find(p => p.id === partnerId);
    if (partner) this.persistPartnerUpdate(partner);
    this.toast.show(`<strong>${partner?.name || 'Partner'}</strong> converted to Prospect`, {
      undo: () => {
        this.partners.update(partners =>
          partners.map(p => p.id === partnerId ? { ...p, type: 'Lead' } : p)
        );
        const reverted = this.partners().find(p => p.id === partnerId);
        if (reverted) this.persistPartnerUpdate(reverted);
      },
      action: {
        label: 'View in Prospects',
        onClick: () => {
          this.navigateTab.set('Prospect');
          this.router.navigate(['/partners']);
        }
      }
    });
  }

  convertLeadDataToProspect(lead: Lead) {
    const newPartner = this.addPartner({
      name: lead.name,
      type: 'Prospect',
      email: lead.contacts?.[0]?.email || '',
      phone: lead.contacts?.[0]?.phone || '',
      city: lead.company?.city || 'Casablanca',
      comments: lead.notes || '',
      score: lead.score,
      source: lead.campaigns?.[0]?.source || 'Website form' as unknown,
      assignedTo: lead.assignedSalesperson || ''
    });
    const prevStatus = lead.status;
    this.updateLeadStatus(lead.id, 'Converted');
    this.toast.show(`<strong>${lead.name}</strong> converted to Prospect`, {
      undo: () => {
        this.partners.update(pList => pList.filter(p => p.id !== newPartner.id));
        this.updateLeadStatus(lead.id, prevStatus);
      },
      action: {
        label: 'View in Prospects',
        onClick: () => {
          this.navigateTab.set('Prospect');
          this.router.navigate(['/partners']);
        }
      }
    });
  }

  getCustomerCard(partnerId: string): CustomerCard | undefined {
    return this.customerCards().find(c => c.partnerId === partnerId);
  }

  private customerCardToApiPayload(card: Partial<CustomerCard> & { name: string }): unknown {
    return {
      account_id: card.accountId,
      record_type: card.recordType ? card.recordType.toUpperCase() : undefined,
      name: card.name,
      search_name: card.searchName,
      erp_account: card.erpAccount,
      ice: card.ice,
      if_field: card.ifField,
      rc: card.rc,
      rc_city: card.rcCity,
      tp: card.tp,
      vat_status: card.vatStatus,
      org_type: card.orgType ? card.orgType.toUpperCase() : undefined,
      parent_account_id: card.parentAccountId || undefined,
      addresses: card.addresses,
      main_phone: card.mainPhone,
      corporate_email: card.corporateEmail,
      website_url: card.websiteUrl,
      personnel: card.personnel
    };
  }

  private customerCardFromDto(dto: unknown, id: string): CustomerCard {
    return {
      id,
      partnerId: dto.partner_id,
      accountId: dto.account_id,
      recordType: dto.record_type === 'INDIVIDUAL' ? 'Individual' : 'Organization',
      name: dto.name,
      searchName: dto.search_name || '',
      erpAccount: dto.erp_account || '',
      ice: dto.ice || '',
      ifField: dto.if_field || '',
      rc: dto.rc || '',
      rcCity: dto.rc_city || '',
      tp: dto.tp || '',
      vatStatus: dto.vat_status || [],
      orgType: dto.org_type ? (dto.org_type.charAt(0) + dto.org_type.slice(1).toLowerCase()) as OrgType : 'Headquarter',
      parentAccountId: dto.parent_account_id || null,
      addresses: dto.addresses || [],
      mainPhone: dto.main_phone || '',
      corporateEmail: dto.corporate_email || '',
      websiteUrl: dto.website_url || '',
      personnel: dto.personnel || [],
      createdBy: dto.created_by,
      createdAt: dto.created_at ? String(dto.created_at).split('T')[0] : ''
    };
  }

  /** Lazy-loads a partner's customer card from the backend into the local cache. No-op (and leaves any local draft in place) if the partner has none saved yet. */
  loadCustomerCard(partnerId: string): void {
    this.api.getCustomerCard(partnerId).subscribe({
      next: (dto) => {
        if (!dto) return;
        const card = this.customerCardFromDto(dto, dto.id);
        this.customerCards.update(cards => {
          const existing = cards.findIndex(c => c.partnerId === partnerId);
          if (existing >= 0) {
            const updated = [...cards];
            updated[existing] = card;
            return updated;
          }
          return [...cards, card];
        });
      },
      error: () => { /* no saved card yet for this partner */ }
    });
  }

  getCustomer360(partnerId: string): Customer360View | null {
    const partner = this.partners().find(p => p.id === partnerId);
    if (!partner) return null;

    const card = this.customerCards().find(c => c.partnerId === partnerId);
    const contacts: Customer360Contact[] = card
      ? (card.personnel || []).map(p => ({
          name: p.fullName,
          jobTitle: p.jobTitle,
          email: p.directEmail,
          phone: p.directMobile
        }))
      : [];

    const orders: Customer360Order[] = this.deals()
      .filter(d => d.partnerId === partnerId)
      .map(d => ({
        id: d.id,
        title: d.title,
        stage: d.stage,
        amount: d.amount,
        date: d.orderDate
      }));

    const meetings: Customer360Meeting[] = this.deals()
      .filter(d => d.partnerId === partnerId)
      .flatMap(d => (d.activityLog?.meetings || []).map(m => ({
        id: m.id,
        date: m.date,
        title: m.title,
        type: m.type
      })));

    const tickets: Customer360Ticket[] = this.tickets()
      .filter(t => t.partnerId === partnerId)
      .map(t => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority
      }));

    const invoices: Customer360Invoice[] = this.invoices()
      .filter(i => i.partnerId === partnerId)
      .map(i => ({
        id: i.id,
        amount: i.amount,
        status: i.status,
        dueDate: i.dueDate
      }));

    return {
      partner,
      contacts,
      orders,
      meetings,
      tickets,
      invoices
    };
  }

  saveCustomerCard(card: Omit<CustomerCard, 'createdBy' | 'createdAt'> & { createdBy?: string; createdAt?: string }) {
    const now = new Date().toISOString().split('T')[0];
    const fullCard: CustomerCard = {
      ...card,
      createdBy: card.createdBy || this.currentUserId(),
      createdAt: card.createdAt || now,
    };
    this.customerCards.update(cards => {
      const existing = cards.findIndex(c => c.id === fullCard.id);
      if (existing >= 0) {
        const updated = [...cards];
        updated[existing] = fullCard;
        return updated;
      }
      return [...cards, fullCard];
    });
    this.api.saveCustomerCard(card.partnerId, this.customerCardToApiPayload(card)).subscribe({
      next: (dto) => {
        const saved = this.customerCardFromDto(dto, dto.id);
        this.customerCards.update(cards => cards.map(c => c.partnerId === saved.partnerId ? saved : c));
      },
      error: () => this.toast.show('Failed to save customer card to the server', { type: 'error' })
    });
  }

  generateAccountId(): string {
    const count = this.customerCards().length + 1;
    return 'ACC-' + String(count).padStart(5, '0');
  }

  // Creates a partner and invokes onCreated with the server-assigned id once persisted.
  // Use this (instead of the synchronous addPartner return value) whenever the id will be
  // referenced by a subsequent API call (e.g. as a foreign key on a deal/PO) — addPartner's
  // synchronous return is a client-side temp id that doesn't exist on the server yet.
  createPartnerAwaitingId(
    partner: Omit<Partner, 'id' | 'createdBy' | 'createdAt'> & { createdBy?: string; createdAt?: string },
    onCreated: (id: string) => void
  ): void {
    this.api.createPartner(this.partnerToApiPayload(partner)).subscribe({
      next: (dto) => {
        const created = this.partnerFromDto(dto);
        this.partners.update(pList => [...pList, created]);
        this.toast.show(`Partner <strong>${created.name}</strong> added`);
        onCreated(created.id);
      },
      error: () => this.toast.show('Failed to save partner to the server', { type: 'error' })
    });
  }

  addPartner(partner: Omit<Partner, 'id' | 'createdBy' | 'createdAt'> & { createdBy?: string; createdAt?: string }) {
    // Return value is used synchronously by some callers (e.g. inline vendor creation),
    // so we optimistically add a local placeholder immediately and reconcile it with the
    // persisted record once the API responds (matched by object identity, not id).
    const tempId = 'p' + (this.partners().length + 1) + '_' + Date.now();
    const now = new Date().toISOString().split('T')[0];
    const newPartner = { ...partner, id: tempId, createdBy: this.currentUserId(), createdAt: now };
    this.partners.update(pList => [...pList, newPartner]);
    this.toast.show(`Partner <strong>${newPartner.name}</strong> added`, {
      undo: () => {
        this.partners.update(pList => pList.filter(p => p.id !== newPartner.id));
      }
    });
    this.api.createPartner(this.partnerToApiPayload(partner)).subscribe({
      next: (dto) => {
        const created = this.partnerFromDto(dto);
        this.partners.update(pList => pList.map(p => p === newPartner ? created : p));
      },
      error: () => {
        this.partners.update(pList => pList.filter(p => p !== newPartner));
        this.toast.show('Failed to save partner to the server', { type: 'error' });
      }
    });
    return newPartner;
  }

  updatePartner(id: string, changes: Partial<Partner>) {
    const prev = this.partners().find(p => p.id === id);
    if (!prev) return;
    const updated = { ...prev, ...changes };
    this.partners.update(list => list.map(p => p.id === id ? updated : p));
    this.api.updatePartner(id, this.partnerToApiPayload(updated)).subscribe({
      error: () => {
        this.partners.update(list => list.map(p => p.id === id ? prev : p));
        this.toast.show('Failed to update partner', { type: 'error' });
      }
    });
  }

  addTask(task: Omit<Task, 'id' | 'createdBy' | 'createdAt'> & { createdBy?: string; createdAt?: string }) {
    this.api.createTask(task).subscribe({
      next: (dto) => {
        this.tasks.update(tList => [...tList, dto]);
        this.toast.show(`Task <strong>${dto.title}</strong> created`, {
          undo: () => {
            this.tasks.update(tList => tList.filter(t => t.id !== dto.id));
          }
        });
      },
      error: () => this.toast.show('Failed to create task', { type: 'error' })
    });
  }

  updateTaskStatus(taskId: string, status: TaskStatus, assignedTo?: string) {
    const current = this.tasks().find(t => t.id === taskId);
    if (!current) return;
    const prevStatus = current.status;
    const payload: unknown = { status };
    if (assignedTo !== undefined) payload.assignedTo = assignedTo;
    this.api.updateTask(taskId, payload).subscribe({
      next: (dto) => {
        this.tasks.update(tasks => tasks.map(t => t.id === taskId ? dto : t));
        this.toast.show(`Task status updated`, {
          undo: () => {
            this.tasks.update(tasks =>
              tasks.map(t => t.id === taskId ? { ...t, status: prevStatus } : t)
            );
          }
        });
      },
      error: () => this.toast.show('Failed to update task status', { type: 'error' })
    });
  }

  getRelatedEntities(module: string, subModule: string): { id: string; label: string }[] {
    switch (module) {
      case 'Sales':
        switch (subModule) {
          case 'Deal': return this.deals().map(d => ({ id: d.id, label: d.title }));
          case 'Proposal': return this.proposals().map(p => ({ id: p.id, label: p.title }));
          case 'PurchaseOrder': return this.purchaseOrders().map(po => ({ id: po.id, label: `PO #${po.id}` }));
        }
        break;
      case 'Finance':
        switch (subModule) {
          case 'CustomerInvoice': return this.invoices().filter(i => i.type === 'Customer').map(i => ({ id: i.id, label: `Invoice #${i.id} - ${i.customerName || i.id}` }));
          case 'VendorInvoice': return this.invoices().filter(i => i.type === 'Vendor').map(i => ({ id: i.id, label: `Invoice #${i.id}` }));
          case 'Recovery': return this.invoices().filter(i => i.status === 'Overdue' || i.status === 'Pending').map(i => ({ id: i.id, label: `Invoice #${i.id} - ${i.customerName || i.id} (${i.status})` }));
        }
        break;
      case 'Partners':
        switch (subModule) {
          case 'Lead': return this.partners().filter(p => p.type === 'Lead').map(p => ({ id: p.id, label: p.name }));
          case 'Customer': return this.partners().filter(p => p.type === 'Customer').map(p => ({ id: p.id, label: p.name }));
          case 'Prospect': return this.partners().filter(p => p.type === 'Prospect').map(p => ({ id: p.id, label: p.name }));
          case 'Vendor': return this.partners().filter(p => p.type === 'Vendor').map(p => ({ id: p.id, label: p.name }));
        }
        break;
      case 'Support':
        if (subModule === 'Ticket') return this.tickets().map(t => ({ id: t.id, label: t.title }));
        break;
      case 'Marketing':
        if (subModule === 'Campaign') return this.campaigns().map(c => ({ id: c.id, label: c.title }));
        break;
    }
    return [];
  }

  addProposal(proposal: Omit<Proposal, 'id' | 'createdBy' | 'createdAt'> & { createdBy?: string; createdAt?: string }) {
    // Return value is used synchronously by callers (e.g. "assign task" flow needs the new
    // proposal's id/title immediately), so optimistically add locally and reconcile with the
    // persisted record once the API responds (matched by object identity, not id).
    const tempId = 'pr' + (this.proposals().length + 1) + '_' + Date.now();
    const now = new Date().toISOString().split('T')[0];
    const newProp = { ...proposal, id: tempId, createdBy: this.currentUserId(), createdAt: now };
    this.proposals.update(props => [...props, newProp]);
    this.toast.show(`Proposal <strong>${newProp.title || tempId}</strong> created`, {
      undo: () => {
        this.proposals.update(props => props.filter(p => p.id !== newProp.id));
      }
    });
    this.api.createProposal(proposal).subscribe({
      next: (dto) => {
        this.proposals.update(props => props.map(p => p === newProp ? dto : p));
      },
      error: () => {
        this.proposals.update(props => props.filter(p => p !== newProp));
        this.toast.show('Failed to save proposal to the server', { type: 'error' });
      }
    });
    return newProp;
  }

  updateProposalStatus(propId: string, status: 'Draft' | 'Sent' | 'Confirmed' | 'Rejected') {
    const current = this.proposals().find(p => p.id === propId);
    if (!current) return;
    const prevStatus = current.status;
    this.api.updateProposal(propId, { status }).subscribe({
      next: (dto) => {
        this.proposals.update(props => props.map(p => p.id === propId ? dto : p));
        this.toast.show(`Proposal <strong>#${propId}</strong> status updated`, {
          undo: () => {
            this.proposals.update(props =>
              props.map(p => p.id === propId ? { ...p, status: prevStatus } : p)
            );
          }
        });
      },
      error: () => this.toast.show('Failed to update proposal status', { type: 'error' })
    });
  }

  updateProposal(id: string, data: Partial<Proposal>) {
    this.api.updateProposal(id, data).subscribe({
      next: (dto) => {
        this.proposals.update(proposals => proposals.map(p => p.id === id ? dto : p));
        this.toast.show(`Proposal <strong>#${id}</strong> updated`);
      },
      error: () => this.toast.show('Failed to update proposal', { type: 'error' })
    });
  }

  addDeal(deal: Omit<Deal, 'id' | 'createdBy' | 'createdAt'> & { createdBy?: string; createdAt?: string }) {
    // Return value is used synchronously by callers (e.g. "assign task" flow needs the new
    // deal's id/title immediately), so optimistically add locally and reconcile with the
    // persisted record once the API responds (matched by object identity, not id).
    const tempId = 'd' + (this.deals().length + 1) + '_' + Date.now();
    const now = new Date().toISOString().split('T')[0];
    const newDeal = { ...deal, id: tempId, createdBy: this.currentUserId(), createdAt: now };
    this.deals.update(dList => [...dList, newDeal]);
    // Fire automation rules against the local (optimistic) record
    setTimeout(() => this.evaluateRules('DealCreated', newDeal as unknown as Record<string, unknown>, `Deal: ${newDeal.title}`), 0);
    this.toast.show(`Deal <strong>${newDeal.title}</strong> created`, {
      undo: () => {
        this.deals.update(dList => dList.filter(d => d.id !== newDeal.id));
      }
    });
    this.api.createDeal(deal).subscribe({
      next: (dto) => {
        this.deals.update(dList => dList.map(d => d === newDeal ? dto : d));
      },
      error: () => {
        this.deals.update(dList => dList.filter(d => d !== newDeal));
        this.toast.show('Failed to save deal to the server', { type: 'error' });
      }
    });
    return newDeal;
  }

  updateDealStage(dealId: string, stage: DealStage) {
    const current = this.deals().find(d => d.id === dealId);
    if (!current) return;
    const prevStage = current.stage;
    this.api.updateDeal(dealId, { stage }).subscribe({
      next: (dto) => {
        this.deals.update(deals => deals.map(d => d.id === dealId ? dto : d));
        setTimeout(() => this.evaluateRules('DealUpdated', dto as unknown as Record<string, unknown>, `Deal: ${dto.title}`), 0);
        this.toast.show(`Deal stage updated to <strong>${stage}</strong>`, {
          undo: () => {
            this.deals.update(deals =>
              deals.map(d => d.id === dealId ? { ...d, stage: prevStage } : d)
            );
          }
        });
      },
      error: () => this.toast.show('Failed to update deal stage', { type: 'error' })
    });
  }

  private toIso(dateStr?: string, timeStr?: string): string | undefined {
    if (!dateStr) return undefined;
    const d = timeStr ? new Date(`${dateStr}T${timeStr}`) : new Date(dateStr);
    return isNaN(d.getTime()) ? undefined : d.toISOString();
  }

  private reconcileDealActivityId(dealId: string, kind: keyof NonNullable<Deal['activityLog']>, localId: string, remoteId: string) {
    this.deals.update(deals => deals.map(d => {
      if (d.id !== dealId || !d.activityLog) return d;
      const items = (d.activityLog[kind] as unknown[]).map(item => item.id === localId ? { ...item, id: remoteId } : item);
      return { ...d, activityLog: { ...d.activityLog, [kind]: items } };
    }));
  }

  addCallLog(dealId: string, call: Omit<CallLog, 'id'>) {
    const localId = 'c' + Date.now();
    this.deals.update(deals =>
      deals.map(d => {
        if (d.id === dealId) {
          const log = d.activityLog || { calls: [], emails: [], meetings: [], recordings: [], notes: [], followUps: [] };
          const newCall = { ...call, id: localId };
          return { ...d, activityLog: { ...log, calls: [...log.calls, newCall] } };
        }
        return d;
      })
    );
    this.api.createDealActivity(dealId, {
      type: 'CALL', occurred_at: this.toIso(call.date), duration_minutes: call.duration,
      caller_name: call.callerName, outcome: call.outcome, summary: call.summary
    }).subscribe({
      next: (dto) => this.reconcileDealActivityId(dealId, 'calls', localId, dto.id),
      error: () => this.toast.show('Failed to save call log to the server', { type: 'error' })
    });
    this.toast.show('Call logged');
  }

  addEmailLog(dealId: string, email: Omit<EmailLog, 'id'>) {
    const localId = 'e' + Date.now();
    this.deals.update(deals =>
      deals.map(d => {
        if (d.id === dealId) {
          const log = d.activityLog || { calls: [], emails: [], meetings: [], recordings: [], notes: [], followUps: [] };
          const newEmail = { ...email, id: localId };
          return { ...d, activityLog: { ...log, emails: [...log.emails, newEmail] } };
        }
        return d;
      })
    );
    this.api.createDealActivity(dealId, {
      type: 'EMAIL', occurred_at: this.toIso(email.date), email_from: email.from, email_to: email.to,
      subject: email.subject, body: email.body, direction: email.direction
    }).subscribe({
      next: (dto) => this.reconcileDealActivityId(dealId, 'emails', localId, dto.id),
      error: () => this.toast.show('Failed to save email log to the server', { type: 'error' })
    });
    this.toast.show('Email logged');
  }

  addMeeting(dealId: string, meeting: Omit<Meeting, 'id'>) {
    const localId = 'm' + Date.now();
    this.deals.update(deals =>
      deals.map(d => {
        if (d.id === dealId) {
          const log = d.activityLog || { calls: [], emails: [], meetings: [], recordings: [], notes: [], followUps: [] };
          const newMeeting = { ...meeting, id: localId };
          return { ...d, activityLog: { ...log, meetings: [...log.meetings, newMeeting] } };
        }
        return d;
      })
    );
    this.api.createDealActivity(dealId, {
      type: 'MEETING', occurred_at: this.toIso(meeting.date, meeting.time), title: meeting.title,
      attendees: meeting.attendees, location: meeting.location, summary: meeting.summary, meeting_type: meeting.type
    }).subscribe({
      next: (dto) => this.reconcileDealActivityId(dealId, 'meetings', localId, dto.id),
      error: () => this.toast.show('Failed to save meeting to the server', { type: 'error' })
    });
    this.toast.show('Meeting logged');
  }

  addRecording(dealId: string, recording: Omit<TeamsRecording, 'id'>) {
    const localId = 'r' + Date.now();
    this.deals.update(deals =>
      deals.map(d => {
        if (d.id === dealId) {
          const log = d.activityLog || { calls: [], emails: [], meetings: [], recordings: [], notes: [], followUps: [] };
          const newRecording = { ...recording, id: localId };
          return { ...d, activityLog: { ...log, recordings: [...log.recordings, newRecording] } };
        }
        return d;
      })
    );
    this.api.createDealActivity(dealId, {
      type: 'RECORDING', occurred_at: this.toIso(recording.date), title: recording.title,
      meeting_link: recording.meetingLink, recording_link: recording.recordingLink, duration_text: recording.duration
    }).subscribe({
      next: (dto) => this.reconcileDealActivityId(dealId, 'recordings', localId, dto.id),
      error: () => this.toast.show('Failed to save recording to the server', { type: 'error' })
    });
    this.toast.show('Recording logged');
  }

  addNote(dealId: string, note: Omit<Note, 'id'>) {
    const localId = 'n' + Date.now();
    this.deals.update(deals =>
      deals.map(d => {
        if (d.id === dealId) {
          const log = d.activityLog || { calls: [], emails: [], meetings: [], recordings: [], notes: [], followUps: [] };
          const newNote = { ...note, id: localId };
          return { ...d, activityLog: { ...log, notes: [...log.notes, newNote] } };
        }
        return d;
      })
    );
    this.api.createDealActivity(dealId, {
      type: 'NOTE', occurred_at: this.toIso(note.date), author: note.author, content: note.content
    }).subscribe({
      next: (dto) => this.reconcileDealActivityId(dealId, 'notes', localId, dto.id),
      error: () => this.toast.show('Failed to save note to the server', { type: 'error' })
    });
    this.toast.show('Note added');
  }

  addFollowUp(dealId: string, followUp: Omit<FollowUp, 'id'>) {
    const localId = 'f' + Date.now();
    this.deals.update(deals =>
      deals.map(d => {
        if (d.id === dealId) {
          const log = d.activityLog || { calls: [], emails: [], meetings: [], recordings: [], notes: [], followUps: [] };
          const newFollowUp = { ...followUp, id: localId };
          return { ...d, activityLog: { ...log, followUps: [...log.followUps, newFollowUp] } };
        }
        return d;
      })
    );
    this.api.createDealActivity(dealId, {
      type: 'FOLLOW_UP', due_date: this.toIso(followUp.dueDate), title: followUp.title,
      assigned_to: followUp.assignedTo, status: followUp.status
    }).subscribe({
      next: (dto) => this.reconcileDealActivityId(dealId, 'followUps', localId, dto.id),
      error: () => this.toast.show('Failed to save follow-up to the server', { type: 'error' })
    });
    this.toast.show('Follow-up added');
  }

  updateFollowUpStatus(dealId: string, followUpId: string, status: 'pending' | 'done') {
    this.deals.update(deals =>
      deals.map(d => {
        if (d.id === dealId) {
          const log = d.activityLog || { calls: [], emails: [], meetings: [], recordings: [], notes: [], followUps: [] };
          return {
            ...d,
            activityLog: {
              ...log,
              followUps: log.followUps.map(f => f.id === followUpId ? { ...f, status } : f)
            }
          };
        }
        return d;
      })
    );
    const followUp = this.deals().find(d => d.id === dealId)?.activityLog?.followUps.find(f => f.id === followUpId);
    if (followUp) {
      this.api.updateDealActivity(dealId, followUpId, {
        type: 'FOLLOW_UP', due_date: this.toIso(followUp.dueDate), title: followUp.title,
        assigned_to: followUp.assignedTo, status
      }).subscribe({
        error: () => this.toast.show('Failed to sync follow-up status to the server', { type: 'error' })
      });
    }
    this.toast.show(`Follow-up marked as ${status}`);
  }

  deleteDealActivityItem(dealId: string, kind: keyof NonNullable<Deal['activityLog']>, itemId: string) {
    this.deals.update(deals => deals.map(d => {
      if (d.id !== dealId || !d.activityLog) return d;
      const items = (d.activityLog[kind] as unknown[]).filter(item => item.id !== itemId);
      return { ...d, activityLog: { ...d.activityLog, [kind]: items } };
    }));
    this.api.deleteDealActivity(dealId, itemId).subscribe({
      error: () => this.toast.show('Failed to delete activity from the server', { type: 'error' })
    });
  }



  addPurchaseOrder(po: Omit<PurchaseOrder, 'id' | 'createdBy' | 'createdAt'> & { createdBy?: string; createdAt?: string }, vendorId?: string) {
    const payload = vendorId ? { ...po, vendorId } : po;
    this.api.createPurchaseOrder(payload).subscribe({
      next: (dto) => {
        this.purchaseOrders.update(pos => [...pos, dto]);
        this.toast.show(`Purchase Order <strong>#${dto.id}</strong> created`, {
          undo: () => {
            this.purchaseOrders.update(pos => pos.filter(p => p.id !== dto.id));
          }
        });
      },
      error: () => this.toast.show('Failed to create purchase order', { type: 'error' })
    });
  }

  updatePurchaseOrderStatus(poId: string, status: 'Draft' | 'Sent' | 'Delivered' | 'Invoiced', deliveryDate?: string) {
    const current = this.purchaseOrders().find(po => po.id === poId);
    if (!current) return;
    const prevStatus = current.status;
    const payload: unknown = { status };
    if (deliveryDate) payload.deliveryDate = deliveryDate;
    this.api.updatePurchaseOrder(poId, payload).subscribe({
      next: (dto) => {
        this.purchaseOrders.update(pos => pos.map(p => p.id === poId ? dto : p));
        this.toast.show(`Purchase Order <strong>#${poId}</strong> status updated`, {
          undo: () => {
            this.purchaseOrders.update(pos =>
              pos.map(p => p.id === poId ? { ...p, status: prevStatus } : p)
            );
          }
        });
      },
      error: () => this.toast.show('Failed to update purchase order status', { type: 'error' })
    });
  }

  addInvoice(invoice: Omit<Invoice, 'id' | 'createdBy' | 'createdAt'> & { createdBy?: string; createdAt?: string }) {
    this.api.createInvoice(invoice).subscribe({
      next: (dto) => {
        this.invoices.update(invs => [...invs, dto]);
        this.toast.show(`Invoice <strong>#${dto.id}</strong> created`, {
          undo: () => {
            this.invoices.update(invs => invs.filter(i => i.id !== dto.id));
          }
        });
      },
      error: () => this.toast.show('Failed to create invoice', { type: 'error' })
    });
  }

  updateInvoiceStatus(invoiceId: string, status: InvoiceStatus) {
    const current = this.invoices().find(i => i.id === invoiceId);
    if (!current) return;
    const prevStatus = current.status;
    this.api.updateInvoice(invoiceId, { status }).subscribe({
      next: (dto) => {
        this.invoices.update(invs => invs.map(i => i.id === invoiceId ? dto : i));
        this.toast.show(`Invoice <strong>#${invoiceId}</strong> status updated`, {
          undo: () => {
            this.invoices.update(invs =>
              invs.map(i => i.id === invoiceId ? { ...i, status: prevStatus } : i)
            );
          }
        });
      },
      error: () => this.toast.show('Failed to update invoice status', { type: 'error' })
    });
  }

  addTicket(ticket: Omit<Ticket, 'id' | 'createdBy' | 'createdAt'> & { createdBy?: string; createdAt?: string }) {
    this.api.createTicket(ticket).subscribe({
      next: (dto) => {
        this.tickets.update(tList => [...tList, dto]);
        this.toast.show(`Ticket <strong>#${dto.id}</strong> created`, {
          undo: () => {
            this.tickets.update(tList => tList.filter(t => t.id !== dto.id));
          }
        });
      },
      error: () => this.toast.show('Failed to create ticket', { type: 'error' })
    });
  }

  updateTicket(id: string, data: Partial<Ticket>) {
    const current = this.tickets().find(t => t.id === id);
    if (!current) return;
    const prevTicket: Partial<Ticket> = { status: current.status, assignedTo: current.assignedTo, priority: current.priority };
    this.api.updateTicket(id, data).subscribe({
      next: (dto) => {
        this.tickets.update(tickets => tickets.map(t => t.id === id ? dto : t));
        this.toast.show(`Ticket <strong>#${id}</strong> updated`, {
          undo: () => {
            this.tickets.update(tickets =>
              tickets.map(t => t.id === id ? { ...t, ...prevTicket } : t)
            );
          }
        });
      },
      error: () => this.toast.show('Failed to update ticket', { type: 'error' })
    });
  }

  deleteTicket(id: string) {
    const deleted = this.tickets().find(t => t.id === id);
    this.api.deleteTicket(id).subscribe({
      next: () => {
        this.tickets.update(tickets => tickets.filter(t => t.id !== id));
        this.toast.show(`Ticket <strong>#${id}</strong> deleted`, {
          undo: () => {
            if (deleted) {
              this.tickets.update(tickets => [...tickets, deleted]);
            }
          }
        });
      },
      error: () => this.toast.show('Failed to delete ticket', { type: 'error' })
    });
  }

  addCampaign(campaign: Omit<Campaign, 'id' | 'createdBy' | 'createdAt'> & { createdBy?: string; createdAt?: string }) {
    const tempId = 'camp' + (this.campaigns().length + 1) + '_' + Date.now();
    const now = new Date().toISOString().split('T')[0];
    const newCampaign = { ...campaign, id: tempId, createdBy: this.currentUserId(), createdAt: now };
    this.campaigns.update(list => [...list, newCampaign]);
    this.toast.show(`Campaign <strong>${newCampaign.title}</strong> created`, {
      undo: () => {
        this.campaigns.update(list => list.filter(c => c.id !== newCampaign.id));
      }
    });
    this.api.createCampaign(campaign).subscribe({
      next: (dto) => {
        this.campaigns.update(list => list.map(c => c === newCampaign ? dto : c));
      },
      error: () => {
        this.campaigns.update(list => list.filter(c => c !== newCampaign));
        this.toast.show('Failed to save campaign to the server', { type: 'error' });
      }
    });
    return newCampaign;
  }

  updateCampaign(id: string, patch: Partial<Campaign>) {
    const previous = this.campaigns().find(c => c.id === id);
    this.campaigns.update(list => list.map(c => c.id === id ? { ...c, ...patch } : c));
    this.api.updateCampaign(id, patch).subscribe({
      next: (dto) => {
        this.campaigns.update(list => list.map(c => c.id === id ? dto : c));
      },
      error: () => {
        if (previous) {
          this.campaigns.update(list => list.map(c => c.id === id ? previous : c));
        }
        this.toast.show('Failed to update campaign', { type: 'error' });
      }
    });
  }

  deleteCampaign(id: string) {
    const deleted = this.campaigns().find(c => c.id === id);
    this.api.deleteCampaign(id).subscribe({
      next: () => {
        this.campaigns.update(list => list.filter(c => c.id !== id));
        this.toast.show(`Campaign <strong>${deleted?.title || id}</strong> deleted`, {
          undo: () => {
            if (deleted) {
              this.campaigns.update(list => [...list, deleted]);
            }
          }
        });
      },
      error: () => this.toast.show('Failed to delete campaign', { type: 'error' })
    });
  }

  deleteDeal(id: string) {
    const deleted = this.deals().find(d => d.id === id);
    this.api.deleteDeal(id).subscribe({
      next: () => {
        this.deals.update(deals => deals.filter(d => d.id !== id));
        this.toast.show(`Deal <strong>${deleted?.title || id}</strong> deleted`, {
          undo: () => {
            if (deleted) {
              this.deals.update(deals => [...deals, deleted]);
            }
          }
        });
      },
      error: () => this.toast.show('Failed to delete deal', { type: 'error' })
    });
  }

  deletePartner(id: string) {
    const deleted = this.partners().find(p => p.id === id);
    this.api.deletePartner(id).subscribe({
      next: () => {
        this.partners.update(partners => partners.filter(p => p.id !== id));
        this.toast.show(`Partner <strong>${deleted?.name || id}</strong> deleted`, {
          undo: () => {
            if (deleted) {
              this.partners.update(partners => [...partners, deleted]);
            }
          }
        });
      },
      error: () => this.toast.show('Failed to delete partner', { type: 'error' })
    });
  }

  deleteTask(id: string) {
    const deleted = this.tasks().find(t => t.id === id);
    this.api.deleteTask(id).subscribe({
      next: () => {
        this.tasks.update(tasks => tasks.filter(t => t.id !== id));
        this.toast.show(`Task <strong>${deleted?.title || id}</strong> deleted`, {
          undo: () => {
            if (deleted) {
              this.tasks.update(tasks => [...tasks, deleted]);
            }
          }
        });
      },
      error: () => this.toast.show('Failed to delete task', { type: 'error' })
    });
  }

  deleteInvoice(id: string) {
    const deleted = this.invoices().find(i => i.id === id);
    this.api.deleteInvoice(id).subscribe({
      next: () => {
        this.invoices.update(invoices => invoices.filter(i => i.id !== id));
        this.toast.show(`Invoice <strong>${deleted?.id || id}</strong> deleted`, {
          undo: () => {
            if (deleted) {
              this.invoices.update(invoices => [...invoices, deleted]);
            }
          }
        });
      },
      error: () => this.toast.show('Failed to delete invoice', { type: 'error' })
    });
  }

  deletePurchaseOrder(id: string) {
    const deleted = this.purchaseOrders().find(p => p.id === id);
    this.api.deletePurchaseOrder(id).subscribe({
      next: () => {
        this.purchaseOrders.update(pos => pos.filter(p => p.id !== id));
        this.toast.show(`Purchase order <strong>${deleted?.id || id}</strong> deleted`, {
          undo: () => {
            if (deleted) {
              this.purchaseOrders.update(pos => [...pos, deleted]);
            }
          }
        });
      },
      error: () => this.toast.show('Failed to delete purchase order', { type: 'error' })
    });
  }

  addActivityLog(log: Omit<ActivityLog, 'id'>) {
    const newId = 'act' + (this.activityLogs().length + 1);
    const newLog = { ...log, id: newId };
    this.activityLogs.update(logs => [...logs, newLog]);
    return newLog;
  }

  private eagerDataLoadedFor: boolean | null = null;

  constructor() {
    // Eager data (organization, users, teams, groups, notifications) is
    // protected — fetching it while logged out just produces a wall of 401s.
    // Load it once whenever isAuthenticated() becomes true (on boot with a
    // persisted session, or right after an interactive login), and skip it
    // entirely while logged out.
    effect(() => {
      const authenticated = this.isAuthenticated();
      if (authenticated && this.eagerDataLoadedFor !== authenticated) {
        this.eagerDataLoadedFor = authenticated;
        this.loadEagerDataFromApi();
      } else if (!authenticated) {
        this.eagerDataLoadedFor = authenticated;
      }
    });

    // Whenever the current user's saved language preference changes (initial
    // load, sync from API, or a profile edit), reflect it in the interface.
    // Keeping this here -- rather than in TranslationService or the profile
    // component -- means neither of those needs to know about the other.
    effect(() => {
      const id = this.currentUserId();
      const user = this.users().find(u => u.id === id);
      const lang = user?.preferences.language;
      if (lang && lang !== this.translation.currentLang()) {
        this.translation.setLanguage(lang).subscribe();
      }
    });
  }

}
