import { Component, signal, ElementRef, inject, OnDestroy, OnInit, computed, effect, HostListener, viewChild, ViewChild } from '@angular/core';
import { RouterOutlet, RouterLink, Router, NavigationEnd } from '@angular/router';
import { MatIconModule } from '@angular/material/icon'
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CrmStateService, CRM_ROLES } from './services/crm-state.service';
import { UserAvatarComponent } from './shared/user-avatar.component';
import { SupportModalComponent } from './shared/support-modal.component';
import { NotificationInboxDrawerComponent } from './shared/notification-inbox-drawer.component';
import { ToastContainerComponent } from './shared/toast.component';
import { LoginComponent } from './pages/login.component';
import { filter } from 'rxjs/operators';
import { Subscription, interval } from 'rxjs';
import { DealsService } from './services/domains/deals.service';
import { PartnersService } from './services/domains/partners.service';
import { InvoicesService } from './services/domains/invoices.service';
import { TicketsService } from './services/domains/tickets.service';
import { WhatsAppInboxStore } from './services/domains/whatsapp-inbox.service';

interface NavItem {
  label: string;
  icon: string;
  route: string;
  /** Backend authority required to see the item (see AUTHORITIES_BY_ROLE). */
  authority?: string;
  /** Live count shown next to the label. */
  badge?: 'whatsappUnread';
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Overview',
    items: [
      { label: 'Dashboard', icon: 'home', route: '/' },
    ]
  },
  {
    label: 'Sales',
    items: [
      { label: 'Sales Pipeline', icon: 'monetization_on', route: '/sales' },
      { label: 'Inbox', icon: 'forum', route: '/inbox', authority: 'WHATSAPP_READ', badge: 'whatsappUnread' },
      { label: 'Marketing', icon: 'campaign', route: '/marketing' },
    ]
  },
  {
    label: 'Operations',
    items: [
      { label: 'Tasks', icon: 'task_alt', route: '/tasks' },
      { label: 'Tickets', icon: 'support_agent', route: '/tickets' },
      { label: 'Automation', icon: 'smart_toy', route: '/automation' },
    ]
  },
  {
    label: 'Intelligence',
    items: [
      { label: 'Analytics', icon: 'bar_chart', route: '/analytics' },
    ]
  },
  {
    label: 'CRM',
    items: [
      { label: 'Partners', icon: 'handshake', route: '/partners' },
      { label: 'Groups', icon: 'group_work', route: '/groups' },
      { label: 'Finance', icon: 'account_balance', route: '/finance' },
    ]
  }
];

// Flat list for breadcrumb matching
const ALL_NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap(s => s.items);

interface SearchItem {
  mainMenu: string;
  mainIcon: string;
  mainRoute: string;
  submenu?: string;
  subIcon?: string;
  tab?: string;
  action: string;
  keywords: string;
}

/** Unified shape every command-palette row renders as, whatever it came from. */
interface SearchResult {
  kind: 'page' | 'deal' | 'partner' | 'lead' | 'ticket' | 'invoice' | 'action';
  groupLabel: string;
  icon: string;
  breadcrumb: string;
  title: string;
  description: string;
  route?: string;
  tab?: string;
  entityId?: string;
  actionId?: string;
}

interface QuickAction {
  actionId: string;
  label: string;
  icon: string;
  description: string;
  route: string;
  tab?: string;
  keywords: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  { actionId: 'new-deal', label: 'New deal', icon: 'add_circle', description: 'Create a new deal in the sales pipeline', route: '/sales', tab: 'deals', keywords: 'new deal create sale opportunity' },
  { actionId: 'log-call', label: 'Log call', icon: 'call', description: 'Log a call against your most recent deal', route: '/sales', tab: 'deals', keywords: 'log call phone activity' },
  { actionId: 'new-ticket', label: 'New ticket', icon: 'confirmation_number', description: 'Open a new support ticket', route: '/tickets', keywords: 'new ticket support request' },
  { actionId: 'new-partner', label: 'New partner', icon: 'person_add', description: 'Add a new customer, prospect, or vendor', route: '/partners', tab: 'Customer', keywords: 'new partner customer prospect vendor add' },
];

const SEARCH_ITEMS: SearchItem[] = [
  { mainMenu: 'Dashboard', mainIcon: 'home', mainRoute: '/', action: 'View your customizable daily summary and KPIs', keywords: 'dashboard home kpi summary' },
  { mainMenu: 'Sales', mainIcon: 'monetization_on', mainRoute: '/sales', submenu: 'Deals', subIcon: 'monetization_on', tab: 'deals', action: 'Manage deals and sales pipeline', keywords: 'sales deals pipeline opportunities' },
  { mainMenu: 'Sales', mainIcon: 'monetization_on', mainRoute: '/sales', submenu: 'Proposals', subIcon: 'description', tab: 'proposals', action: 'Create and manage proposals', keywords: 'sales proposals quotes estimates' },
  { mainMenu: 'Sales', mainIcon: 'monetization_on', mainRoute: '/sales', submenu: 'Purchase Orders', subIcon: 'shopping_cart', tab: 'pos', action: 'Generate and track purchase orders', keywords: 'sales purchase orders po procurement' },
  { mainMenu: 'Inbox', mainIcon: 'forum', mainRoute: '/inbox', action: 'Read and answer WhatsApp conversations', keywords: 'inbox whatsapp messages conversations chat reply' },
  { mainMenu: 'Marketing', mainIcon: 'campaign', mainRoute: '/marketing', submenu: 'Email Campaigns', subIcon: 'email', tab: 'Email', action: 'Launch and manage email campaigns', keywords: 'marketing email campaigns' },
  { mainMenu: 'Marketing', mainIcon: 'campaign', mainRoute: '/marketing', submenu: 'WhatsApp Campaigns', subIcon: 'chat', tab: 'WhatsApp', action: 'Send WhatsApp campaigns to prospects', keywords: 'marketing whatsapp campaigns' },
  { mainMenu: 'Marketing', mainIcon: 'campaign', mainRoute: '/marketing', submenu: 'SMS Campaigns', subIcon: 'sms', tab: 'SMS', action: 'Send SMS campaigns to contacts', keywords: 'marketing sms campaigns' },
  { mainMenu: 'Partners', mainIcon: 'filter_alt', mainRoute: '/partners', submenu: 'Leads', subIcon: 'filter_alt', tab: 'Lead', action: 'Qualify leads, track interactions, and manage pipeline', keywords: 'leads qualification pipeline opportunities tracking' },
  { mainMenu: 'Tasks', mainIcon: 'task_alt', mainRoute: '/tasks', action: 'View tasks in list view', keywords: 'tasks assignments list view' },
  { mainMenu: 'Tasks', mainIcon: 'view_column', mainRoute: '/tasks', submenu: 'Kanban Board', subIcon: 'view_column', tab: 'kanban', action: 'View tasks in Kanban board', keywords: 'tasks kanban board drag drop columns' },
  { mainMenu: 'Tickets', mainIcon: 'support_agent', mainRoute: '/tickets', action: 'Manage customer support tickets and service requests', keywords: 'tickets support customer service' },
  { mainMenu: 'Analytics', mainIcon: 'bar_chart', mainRoute: '/analytics', action: 'View performance indicators, forecasts, and sales insights', keywords: 'analytics reports insights forecasts charts' },

  { mainMenu: 'Partners', mainIcon: 'handshake', mainRoute: '/partners', submenu: 'Customers', subIcon: 'people', tab: 'Customer', action: 'View customer profiles and account details', keywords: 'partners customers clients' },
  { mainMenu: 'Partners', mainIcon: 'handshake', mainRoute: '/partners', submenu: 'Prospects', subIcon: 'person_search', tab: 'Prospect', action: 'Track and convert prospects to customers', keywords: 'partners prospects conversions' },
  { mainMenu: 'Partners', mainIcon: 'handshake', mainRoute: '/partners', submenu: 'Vendors', subIcon: 'store', tab: 'Vendor', action: 'Manage vendor and supplier directory', keywords: 'partners vendors suppliers' },
  { mainMenu: 'Finance', mainIcon: 'account_balance', mainRoute: '/finance', submenu: 'Customer Invoices', subIcon: 'receipt', tab: 'Customer', action: 'Manage customer invoices and billing', keywords: 'finance invoices customers billing' },
  { mainMenu: 'Finance', mainIcon: 'account_balance', mainRoute: '/finance', submenu: 'Vendor Invoices', subIcon: 'receipt_long', tab: 'Vendor', action: 'Manage vendor invoices and payables', keywords: 'finance invoices vendors billing' },
  { mainMenu: 'Finance', mainIcon: 'account_balance', mainRoute: '/finance', submenu: 'Recovery', subIcon: 'healing', tab: 'Recovery', action: 'Send payment reminders for overdue invoices', keywords: 'finance recovery reminders overdue invoices' },
  { mainMenu: 'Automation', mainIcon: 'smart_toy', mainRoute: '/automation', action: 'Create and manage workflow automation rules', keywords: 'automation workflows rules triggers conditions' },
  { mainMenu: 'Groups', mainIcon: 'group_work', mainRoute: '/groups', action: 'Collaborate with teams via chat, meetings, and file sharing', keywords: 'groups chat meetings collaboration teams' },
  { mainMenu: 'Settings', mainIcon: 'settings', mainRoute: '/settings/organization', submenu: 'Organization', subIcon: 'business', action: 'Configure organization profile and settings', keywords: 'settings organization company profile' },
  { mainMenu: 'Settings', mainIcon: 'settings', mainRoute: '/settings/users', submenu: 'Users', subIcon: 'people', action: 'Manage user accounts and permissions', keywords: 'settings users accounts permissions roles' },
  { mainMenu: 'Settings', mainIcon: 'settings', mainRoute: '/settings/teams', submenu: 'Teams', subIcon: 'groups', action: 'Configure teams, departments, and assignments', keywords: 'settings teams departments groups' },
  { mainMenu: 'Settings', mainIcon: 'settings', mainRoute: '/settings/groups', submenu: 'Groups', subIcon: 'forum', action: 'Manage collaboration group settings', keywords: 'settings groups collaboration' },
];

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, MatIconModule, CommonModule, FormsModule, UserAvatarComponent, SupportModalComponent, NotificationInboxDrawerComponent, ToastContainerComponent, LoginComponent],
  styles: [`
    :host {
      display: block;
      height: 100vh;
      overflow: hidden;
    }

    .app-layout {
      display: flex;
      height: 100vh;
      overflow: hidden;
    }

    /* ── Sidebar ── */
    .app-sidebar {
      width: 224px;
      min-width: 224px;
      height: 100vh;
      background: var(--color-surface);
      border-right: 1px solid var(--color-border);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      z-index: 40;
      flex-shrink: 0;
      transition: width 200ms ease, min-width 200ms ease;
    }

    .app-sidebar.collapsed {
      width: 60px;
      min-width: 60px;
    }

    .app-sidebar.collapsed .sidebar-section-title {
      max-height: 0;
      opacity: 0;
      padding-top: 0;
      padding-bottom: 0;
      overflow: hidden;
    }

    .app-sidebar.collapsed .nav-label {
      max-width: 0;
      opacity: 0;
      margin-left: 0;
    }

    .app-sidebar.collapsed .sidebar-logo span {
      max-width: 0;
      opacity: 0;
    }

    .app-sidebar.collapsed .sidebar-user-info {
      max-width: 0;
      opacity: 0;
    }

    .app-sidebar.collapsed .sidebar-user {
      gap: 0;
    }

    .sidebar-logo {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 20px 16px 16px;
      flex-shrink: 0;
    }

    .app-sidebar.collapsed .sidebar-logo {
      gap: 0;
    }

    .sidebar-logo img {
      width: 28px;
      height: 28px;
      object-fit: contain;
      border-radius: 6px;
    }

    .sidebar-collapse-btn {
      margin-left: auto;
      width: 28px;
      height: 28px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      border: none;
      color: var(--color-text-tertiary);
      cursor: pointer;
      transition: all 150ms ease;
      flex-shrink: 0;
      overflow: hidden;
    }

    .sidebar-collapse-btn:hover {
      background: var(--color-surface-hover);
      color: var(--color-text-heading);
    }

    .sidebar-collapse-btn mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .app-sidebar.collapsed .sidebar-collapse-btn {
      opacity: 0;
      pointer-events: none;
      width: 0;
      margin-left: 0;
      overflow: hidden;
    }

    .app-sidebar.collapsed .sidebar-link,
    .app-sidebar.collapsed .sidebar-bottom-link {
      justify-content: center;
      gap: 0;
      padding: 7px 0;
    }

    .sidebar-logo span {
      font-weight: 700;
      font-size: 16px;
      letter-spacing: -0.02em;
      color: var(--color-text-heading);
      max-width: 100px;
      opacity: 1;
      overflow: hidden;
      white-space: nowrap;
      transition: max-width 200ms ease, opacity 150ms ease;
    }

    .sidebar-nav {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 4px 10px;
    }

    .sidebar-section-title {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--color-text-tertiary);
      padding: 18px 12px 6px;
      max-height: 40px;
      opacity: 1;
      overflow: hidden;
      transition: max-height 200ms ease, opacity 150ms ease, padding 200ms ease;
    }

    .sidebar-section-title:first-child {
      padding-top: 6px;
    }

    .sidebar-link {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 7px 12px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      color: var(--color-text-secondary);
      cursor: pointer;
      transition: all 200ms ease;
      text-decoration: none;
      margin: 1px 0;
    }

    .sidebar-link:hover {
      background: var(--color-surface-hover);
      color: var(--color-text-heading);
    }

    .nav-badge {
      margin-inline-start: auto;
      min-width: 18px;
      height: 18px;
      padding: 0 5px;
      border-radius: 9px;
      background: var(--color-success);
      color: #fff;
      font-size: 11px;
      font-weight: 700;
      line-height: 18px;
      text-align: center;
    }

    .app-sidebar.collapsed .nav-badge {
      position: absolute;
      margin: 0;
      transform: translate(14px, -10px);
      min-width: 16px;
      height: 16px;
      line-height: 16px;
      font-size: 10px;
    }

    .sidebar-link.active {
      background: var(--color-accent-light);
      color: var(--color-accent);
      font-weight: 600;
    }

    .sidebar-link.active mat-icon {
      color: var(--color-accent);
    }

    .sidebar-link mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      flex-shrink: 0;
      line-height: 20px;
    }

    .nav-label {
      margin-left: 10px;
      overflow: hidden;
      white-space: nowrap;
      max-width: 200px;
      opacity: 1;
      transition: max-width 200ms ease, opacity 150ms ease, margin-left 200ms ease;
    }

    .sidebar-bottom {
      flex-shrink: 0;
      border-top: 1px solid var(--color-border);
      padding: 8px 10px;
    }

    .sidebar-bottom-link {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 7px 12px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      color: var(--color-text-secondary);
      cursor: pointer;
      transition: all 200ms ease;
      text-decoration: none;
      background: transparent;
      border: none;
      width: 100%;
      text-align: left;
    }

    .sidebar-bottom-link:hover {
      background: var(--color-surface-hover);
      color: var(--color-text-heading);
    }

    .sidebar-bottom-link.active {
      background: var(--color-accent-light);
      color: var(--color-accent);
      font-weight: 600;
    }

    .sidebar-bottom-link.active mat-icon {
      color: var(--color-accent);
    }

    .sidebar-user {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      border-top: 1px solid var(--color-surface-hover);
      margin-top: 4px;
      cursor: pointer;
      border-radius: 6px;
      transition: background 150ms ease;
      text-decoration: none;
    }

    .sidebar-user:hover {
      background: var(--color-surface-hover);
    }

    .sidebar-user-chevron {
      font-size: 16px;
      width: 16px;
      height: 16px;
      color: var(--color-text-tertiary);
      flex-shrink: 0;
      transition: transform 200ms ease;
    }

    .sidebar-profile-wrapper {
      position: relative;
      border-top: 1px solid var(--color-surface-hover);
      margin-top: 4px;
    }

    .sidebar-profile-wrapper .sidebar-user {
      border-top: none;
      margin-top: 0;
      background: none;
      border: none;
      width: 100%;
      text-align: left;
      font-family: inherit;
      font-size: inherit;
      line-height: inherit;
    }

    .profile-menu {
      position: absolute;
      bottom: calc(100% + 4px);
      left: 0;
      right: 0;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: 10px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 4px 6px -4px rgba(0, 0, 0, 0.04);
      padding: 4px;
      z-index: 60;
      overflow: hidden;
    }

    .app-sidebar.collapsed .profile-menu {
      left: 56px;
      bottom: 0;
      right: auto;
      min-width: 180px;
    }

    .profile-menu-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      color: var(--color-text-secondary);
      cursor: pointer;
      transition: all 150ms ease;
      text-decoration: none;
      background: none;
      border: none;
      width: 100%;
      text-align: left;
      font-family: inherit;
    }

    .profile-menu-item:hover {
      background: var(--color-surface-hover);
      color: var(--color-text-heading);
    }

    .profile-menu-item mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      flex-shrink: 0;
    }

    .sidebar-user-info {
      flex: 1;
      min-width: 0;
      max-width: 150px;
      opacity: 1;
      overflow: hidden;
      white-space: nowrap;
      transition: max-width 200ms ease, opacity 150ms ease;
    }

    .sidebar-user-name {
      font-size: 13px;
      font-weight: 600;
      color: var(--color-text-heading);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .sidebar-user-role {
      font-size: 11px;
      color: var(--color-text-tertiary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* ── Content Area ── */
    .app-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
      overflow: hidden;
    }

    .content-topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 12px 24px;
      background: var(--color-surface);
      border-bottom: 1px solid var(--color-border);
      flex-shrink: 0;
      z-index: 30;
    }

    .topbar-search {
      position: relative;
      max-width: 400px;
      flex: 1;
    }

    .topbar-search input {
      width: 100%;
      padding: 7px 12px 7px 36px;
      background: var(--color-bg);
      border: 1px solid var(--color-border);
      border-radius: 8px;
      font-size: 13px;
      color: var(--color-text-heading);
      outline: none;
      transition: all 150ms ease;
    }

    .topbar-search input::placeholder {
      color: var(--color-text-tertiary);
    }

    .topbar-search input:focus {
      background: var(--color-surface);
      border-color: var(--color-accent);
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
    }

    .topbar-search mat-icon {
      position: absolute;
      left: 10px;
      top: 50%;
      transform: translateY(-50%);
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: var(--color-text-tertiary);
      pointer-events: none;
    }

    .topbar-search .clear-btn {
      position: absolute;
      right: 8px;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: none;
      color: var(--color-text-tertiary);
      cursor: pointer;
      padding: 0;
      display: flex;
      align-items: center;
    }

    .topbar-search .clear-btn:hover {
      color: var(--color-text-secondary);
    }

    .topbar-actions {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;
    }

    .topbar-icon-btn {
      width: 36px;
      height: 36px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      border: 1px solid transparent;
      color: var(--color-text-secondary);
      cursor: pointer;
      transition: all 150ms ease;
      position: relative;
    }

    .topbar-icon-btn:hover {
      background: var(--color-surface-hover);
      color: var(--color-text-heading);
      border-color: var(--color-border);
    }

    .topbar-icon-btn mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .notification-dot {
      position: absolute;
      top: 4px;
      right: 4px;
      width: 16px;
      height: 16px;
      background: var(--color-accent);
      border: 2px solid var(--color-surface);
      border-radius: 9999px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 9px;
      font-weight: 700;
      color: white;
    }

    .topbar-avatar {
      flex-shrink: 0;
      border-radius: 9999px;
      overflow: hidden;
    }

    .search-dropdown {
      position: absolute;
      left: 0;
      right: 0;
      top: calc(100% + 6px);
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: 12px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 4px 6px -4px rgba(0, 0, 0, 0.04);
      max-height: 320px;
      overflow-y: auto;
      z-index: 50;
    }

    .search-group-label {
      padding: 8px 16px 4px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--color-text-tertiary);
      background: var(--color-bg);
    }

    .search-result-item {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 10px 16px;
      border-bottom: 1px solid var(--color-surface-hover);
      cursor: pointer;
      transition: background 150ms ease;
    }

    .search-result-item:last-child {
      border-bottom: none;
    }

    .search-result-item:hover,
    .search-result-item.selected {
      background: var(--color-bg);
    }

    .search-result-item mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: var(--color-text-tertiary);
      margin-top: 2px;
      flex-shrink: 0;
    }

    .search-result-info {
      flex: 1;
      min-width: 0;
    }

    .search-result-breadcrumb {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--color-text-tertiary);
    }

    .search-result-title {
      font-size: 13px;
      font-weight: 600;
      color: var(--color-text-heading);
      margin-left: 8px;
    }

    .search-result-desc {
      font-size: 11px;
      color: var(--color-text-secondary);
      margin-top: 2px;
      line-height: 1.3;
    }

    /* ── Breadcrumbs ── */
    .content-breadcrumbs {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 12px 24px 0;
      font-size: 13px;
    }

    .breadcrumb-link {
      color: var(--color-text-secondary);
      font-weight: 500;
      text-decoration: none;
      transition: color 150ms ease;
    }

    .breadcrumb-link:hover {
      color: var(--color-text-heading);
    }

    .breadcrumb-current {
      color: var(--color-text-heading);
      font-weight: 600;
    }

    .breadcrumb-sep {
      color: var(--color-border-strong);
    }

    /* ── Main content ── */
    .content-main {
      flex: 1;
      overflow-y: auto;
      padding: 20px 56px 24px 24px;
    }

    /* ── Mobile sidebar toggle ── */
    .mobile-sidebar-toggle {
      display: none;
    }

    @media (max-width: 768px) {
      .app-sidebar {
        position: fixed;
        left: -224px;
        top: 0;
        bottom: 0;
        transition: left 250ms ease;
        z-index: 50;
      }

      .app-sidebar.mobile-open {
        left: 0;
      }

      .mobile-sidebar-toggle {
        display: flex;
      }

      .mobile-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.3);
        z-index: 45;
      }
    }

    /* ── Quick Actions FAB ── */
    .quick-actions-fab {
      position: fixed;
      bottom: 32px;
      right: 24px;
      z-index: 50;
    }

    .fab-btn {
      width: 40px;
      height: 40px;
      border-radius: 12px;
      background: var(--color-surface);
      border: 1px solid var(--color-accent);
      color: var(--color-accent);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }

    .fab-btn:hover {
      background: var(--color-accent);
      color: var(--color-surface);
    }

    .fab-btn mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      line-height: 20px;
    }

    .fab-backdrop {
      position: fixed;
      inset: 0;
      z-index: 49;
    }

    .fab-dropdown {
      position: absolute;
      bottom: calc(100% + 12px);
      right: 0;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: 12px;
      box-shadow: 0 10px 25px -5px rgba(0,0,0,0.08), 0 4px 6px -4px rgba(0,0,0,0.04);
      padding: 6px;
      min-width: 200px;
      z-index: 50;
    }

    .fab-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 12px;
      border-radius: 8px;
      text-decoration: none;
      color: var(--color-text-primary);
      font-size: 13px;
      font-weight: 600;
      transition: background 150ms ease;
    }

    .fab-item:hover {
      background: var(--color-surface-hover);
    }

    .fab-item-icon {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--color-accent-light);
      flex-shrink: 0;
    }

    .fab-item-icon mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      line-height: 18px;
      color: var(--color-accent);
    }

    .fab-btn mat-icon,
    .fab-dropdown mat-icon {
      color: inherit;
    }

    @media (max-width: 768px) {
      .quick-actions-fab {
        right: 16px;
      }
    }
  `],
  template: `
    @if (state.isAuthenticated()) {
      <div class="app-layout font-sans search-container">

        <!-- Mobile overlay -->
        @if (mobileMenuOpen()) {
          <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events,@angular-eslint/template/interactive-supports-focus -->
          <div class="mobile-overlay" (click)="mobileMenuOpen.set(false)"></div>
        }

        <!-- Sidebar -->
        <aside class="app-sidebar" [class.mobile-open]="mobileMenuOpen()" [class.collapsed]="sidebarCollapsed()">

          <!-- Logo + collapse toggle -->
          <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events,@angular-eslint/template/interactive-supports-focus -->
          <div class="sidebar-logo" (click)="onLogoClick()">
            @if (orgLogoUrl()) {
              <img [src]="orgLogoUrl()" [alt]="state.organization().name || 'Logo'" />
            } @else {
              <img src="logo.webp" alt="Bento Logo" />
            }
            <span>{{ state.organization().name || 'Bento' }}</span>
            <button
              class="sidebar-collapse-btn"
              (click)="toggleCollapse($event)"
              [title]="sidebarCollapsed() ? 'Expand sidebar' : 'Collapse sidebar'"
            >
              <mat-icon>{{ sidebarCollapsed() ? 'menu' : 'menu_open' }}</mat-icon>
            </button>
          </div>

          <!-- Navigation -->
          <nav class="sidebar-nav">
            @for (section of navSections; track section.label) {
              <div class="sidebar-section-title">{{ section.label }}</div>
              @for (item of section.items; track item.route) {
                @if (!item.authority || state.hasAuthority(item.authority)) {
                  <a
                    [routerLink]="item.route"
                    class="sidebar-link"
                    [class.active]="isNavActive(item)"
                    [title]="item.label"
                    (click)="mobileMenuOpen.set(false)"
                  >
                    <mat-icon>{{ item.icon }}</mat-icon>
                    <span class="nav-label">{{ item.label }}</span>
                    @if (badgeCount(item); as count) {
                      <span class="nav-badge" [attr.aria-label]="count + ' unread'">{{ count > 99 ? '99+' : count }}</span>
                    }
                  </a>
                }
              }
            }
          </nav>

          <!-- Bottom Section -->
          <div class="sidebar-bottom">
            <a
              routerLink="/settings"
              class="sidebar-bottom-link"
              [class.active]="activeRoute().startsWith('/settings')"
              title="Settings"
              (click)="mobileMenuOpen.set(false)"
            >
              <mat-icon>settings</mat-icon>
              <span class="nav-label">Settings</span>
            </a>
            <button
              class="sidebar-bottom-link"
              title="Help & Support"
              (click)="openSupportModal()"
            >
              <mat-icon>help_outline</mat-icon>
              <span class="nav-label">Help & Support</span>
            </button>
            <div class="sidebar-profile-wrapper" #profileWrapper>
              <button
                class="sidebar-user"
                (click)="toggleProfileMenu()"
                title="Profile"
              >
                <app-user-avatar [userId]="state.currentUserId()" [size]="32" class="shrink-0 rounded-full block"></app-user-avatar>
                <div class="sidebar-user-info">
                  <div class="sidebar-user-name">{{ currentUserName() }}</div>
                  <div class="sidebar-user-role">{{ currentUserRole() }}</div>
                </div>
                <mat-icon class="sidebar-user-chevron">keyboard_arrow_up</mat-icon>
              </button>

              @if (profileMenuOpen()) {
                <div class="profile-menu">
                  <a
                    routerLink="/profile"
                    class="profile-menu-item"
                    (click)="closeProfileMenu()"
                  >
                    <mat-icon>person</mat-icon>
                    <span>Settings</span>
                  </a>
                  <button
                    class="profile-menu-item"
                    (click)="onLogout()"
                  >
                    <mat-icon>logout</mat-icon>
                    <span>Logout</span>
                  </button>
                </div>
              }
            </div>
          </div>
        </aside>

        <!-- Content Area -->
        <div class="app-content">

          <!-- Top Bar -->
          <header class="content-topbar">
            <!-- Mobile menu button -->
            <button
              class="topbar-icon-btn mobile-sidebar-toggle"
              (click)="mobileMenuOpen.set(!mobileMenuOpen())"
              title="Toggle menu"
            >
              <mat-icon>menu</mat-icon>
            </button>

            <!-- Search -->
            <div class="topbar-search">
              <mat-icon>search</mat-icon>
              <input
                #searchInput
                [ngModel]="searchQuery()"
                (ngModelChange)="onSearchInput($event)"
                (focus)="onSearchFocus()"
                (keydown)="onSearchKeydown($event)"
                type="text"
                placeholder="Search menus and pages...  (Ctrl+K)"
              />
              @if (searchQuery()) {
                <button class="clear-btn" (click)="clearSearch()" title="Clear search">
                  <mat-icon class="text-[14px] w-3.5 h-3.5">close</mat-icon>
                </button>
              }

              <!-- Search Results Dropdown -->
              @if (showSearchResults() && searchQuery().length >= 1 && filteredSearchItems().length > 0) {
                <div class="search-dropdown">
                  @for (item of filteredSearchItems(); track $index) {
                    @if ($first || filteredSearchItems()[$index - 1].groupLabel !== item.groupLabel) {
                      <div class="search-group-label">{{ item.groupLabel }}</div>
                    }
                    <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events,@angular-eslint/template/interactive-supports-focus -->
                    <div
                      class="search-result-item"
                      [class.selected]="selectedSearchIndex() === $index"
                      (click)="navigateToSearchItem(item)"
                      (mouseenter)="selectedSearchIndex.set($index)"
                    >
                      <mat-icon>{{ item.icon }}</mat-icon>
                      <div class="search-result-info">
                        <div class="flex items-baseline gap-2">
                          <span class="search-result-breadcrumb">{{ item.breadcrumb }}</span>
                          <span class="search-result-title">{{ item.title }}</span>
                        </div>
                        <p class="search-result-desc">{{ item.description }}</p>
                      </div>
                    </div>
                  }
                </div>
              }
              @if (showSearchResults() && searchQuery().length >= 1 && filteredSearchItems().length === 0) {
                <div class="search-dropdown" style="padding: 20px; text-align: center;">
                  <p class="text-body text-zinc-500">No results found for "{{ searchQuery() }}"</p>
                </div>
              }
            </div>

            <!-- Right Actions -->
            <div class="topbar-actions">
              @if (activeRoute() === '/') {
                <button
                  class="topbar-icon-btn"
                  (click)="state.isCustomizing.set(!state.isCustomizing())"
                  [title]="state.isCustomizing() ? 'Done customising' : 'Customise dashboard'"
                >
                  <mat-icon>{{ state.isCustomizing() ? 'check' : 'edit_square' }}</mat-icon>
                </button>
              }
              <button
                class="topbar-icon-btn"
                (click)="openInbox()"
                title="Mail"
              >
                <mat-icon>mail</mat-icon>
              </button>
              <button
                class="topbar-icon-btn"
                (click)="openNotifications()"
                title="Notifications"
              >
                <mat-icon>notifications_none</mat-icon>
                @if (unreadCount() > 0) {
                  <span class="notification-dot">{{ unreadCount() }}</span>
                }
              </button>
              <a
                routerLink="/profile"
                class="topbar-avatar"
                title="View Profile"
              >
                <app-user-avatar [userId]="state.currentUserId()" [size]="32" class="shrink-0 rounded-full block"></app-user-avatar>
              </a>
            </div>
          </header>

          <!-- Breadcrumbs -->
          <div class="content-breadcrumbs">
            @for (crumb of breadcrumbs(); track crumb.label; let last = $last) {
              @if (!last && crumb.route) {
                <a [routerLink]="crumb.route" class="breadcrumb-link">{{ crumb.label }}</a>
                <mat-icon class="breadcrumb-sep text-[14px] w-3.5 h-3.5">chevron_right</mat-icon>
              } @else {
                <span class="breadcrumb-current">{{ crumb.label }}</span>
              }
            }
          </div>

          <!-- Main Content -->
          <main class="content-main">
            <router-outlet></router-outlet>
          </main>
        </div>

      </div>

      <!-- Quick Actions FAB -->
      @if (quickActionsOpen()) {
        <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events,@angular-eslint/template/interactive-supports-focus -->
        <div class="fab-backdrop" (click)="quickActionsOpen.set(false)"></div>
      }
      <div class="quick-actions-fab">
        <button class="fab-btn" (click)="quickActionsOpen.set(!quickActionsOpen())">
          <mat-icon>{{ quickActionsOpen() ? 'close' : 'add' }}</mat-icon>
        </button>

        @if (quickActionsOpen()) {
          <div class="fab-dropdown">
            <a routerLink="/sales" class="fab-item hover:underline" (click)="closeQuickActions()">
              <div class="fab-item-icon fab-item-icon--blue">
                <mat-icon>add_business</mat-icon>
              </div>
              <span>New Proposal</span>
            </a>
            <a routerLink="/partners" class="fab-item hover:underline" (click)="closeQuickActions()">
              <div class="fab-item-icon fab-item-icon--emerald">
                <mat-icon>person_add</mat-icon>
              </div>
              <span>Add Partner</span>
            </a>
            <a routerLink="/marketing" class="fab-item hover:underline" (click)="closeQuickActions()">
              <div class="fab-item-icon fab-item-icon--amber">
                <mat-icon>campaign</mat-icon>
              </div>
              <span>New Campaign</span>
            </a>
            <a routerLink="/tickets" class="fab-item hover:underline" (click)="closeQuickActions()">
              <div class="fab-item-icon fab-item-icon--rose">
                <mat-icon>support_agent</mat-icon>
              </div>
              <span>Create Ticket</span>
            </a>
          </div>
        }
      </div>

      <app-support-modal></app-support-modal>

      <app-notification-inbox-drawer
        [drawerType]="drawerType()"
        [open]="drawerOpen()"
        (closed)="closeDrawer()"
        (switchType)="drawerType.set($event)"
        (notificationOpened)="onNotificationOpened()"
      ></app-notification-inbox-drawer>

      <app-toast-container></app-toast-container>
    } @else {
      <!-- The only two routes a signed-out visitor is meant to reach: creating an
           organization, and joining one from an emailed invitation. Everything else
           collapses to the login screen. -->
      @if (activeRoute().startsWith('/onboarding') || activeRoute().startsWith('/invite')) {
        <router-outlet></router-outlet>
      } @else {
        <app-login></app-login>
      }
    }
  `
})
export class App implements OnInit, OnDestroy {
  state = inject(CrmStateService);
  private router = inject(Router);
  private inbox = inject(WhatsAppInboxStore);

  /** The inbox stream feeds the nav badge, so it runs whenever the user may read WhatsApp. */
  private inboxLifecycle = effect(() => {
    if (this.state.isAuthenticated() && this.state.currentUserAuthorities().has('WHATSAPP_READ')) {
      this.inbox.start();
    } else {
      this.inbox.stop();
    }
  });
  private dealsService = inject(DealsService);
  private partnersService = inject(PartnersService);
  private invoicesService = inject(InvoicesService);
  private ticketsService = inject(TicketsService);

  @ViewChild(SupportModalComponent) supportModal!: SupportModalComponent;

  // Navigation sections
  navSections = NAV_SECTIONS;

  // Mobile menu
  mobileMenuOpen = signal(false);

  // Sidebar collapse
  sidebarCollapsed = signal(false);

  orgLogoUrl = computed(() => {
    return this.state.resolveLogoUrl(this.state.organization().logoUrl);
  });

  onLogoClick() {
    if (this.sidebarCollapsed()) {
      this.sidebarCollapsed.set(false);
    } else {
      this.router.navigate(['/']);
    }
  }

  toggleCollapse(event: Event) {
    event.stopPropagation();
    this.sidebarCollapsed.update(v => !v);
  }

  // Current user display name
  currentUserName = computed(() => {
    const users = this.state.users();
    const userId = this.state.currentUserId();
    const user = users.find(u => u.id === userId);
    return user?.displayName || 'User';
  });

  currentUserRole = computed(() => {
    const users = this.state.users();
    const userId = this.state.currentUserId();
    const user = users.find(u => u.id === userId);
    if (!user) return '';
    const role = CRM_ROLES.find(r => r.id === user.roleId);
    return role?.label || '';
  });

  // Profile menu
  profileMenuOpen = signal(false);

  toggleProfileMenu() {
    this.profileMenuOpen.update(v => !v);
  }

  closeProfileMenu() {
    this.profileMenuOpen.set(false);
  }

  onLogout() {
    this.profileMenuOpen.set(false);
    this.mobileMenuOpen.set(false);
    this.state.logout();
    this.router.navigate(['/']);
  }

  // Global search
  readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');
  searchQuery = signal('');
  showSearchResults = signal(false);
  selectedSearchIndex = signal(0);

  /** Demo unread notification count */
  unreadCount = computed(() => this.state.unreadNotificationsCount());

  drawerOpen = signal(false);
  drawerType = signal<'notifications' | 'inbox'>('notifications');
  quickActionsOpen = signal(false);

  closeQuickActions() {
    this.quickActionsOpen.set(false);
  }

  openNotifications() {
    this.drawerType.set('notifications');
    this.drawerOpen.set(true);
    // Fresh assignments must appear the moment the bell is opened.
    this.state.refreshNotifications();
  }

  openInbox() {
    this.drawerType.set('inbox');
    this.drawerOpen.set(true);
  }

  closeDrawer() {
    this.drawerOpen.set(false);
  }

  filteredSearchItems = computed<SearchResult[]>(() => {
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return [];

    const pages: SearchResult[] = SEARCH_ITEMS.filter(item =>
      item.mainMenu.toLowerCase().includes(q) ||
      item.action.toLowerCase().includes(q) ||
      item.keywords.toLowerCase().includes(q) ||
      (item.submenu && item.submenu.toLowerCase().includes(q))
    ).slice(0, 6).map(item => ({
      kind: 'page' as const,
      groupLabel: 'Pages',
      icon: item.subIcon || item.mainIcon,
      breadcrumb: item.mainMenu,
      title: item.submenu || item.mainMenu,
      description: item.action,
      route: item.mainRoute,
      tab: item.tab,
    }));

    const actions: SearchResult[] = QUICK_ACTIONS.filter(a =>
      a.label.toLowerCase().includes(q) || a.keywords.toLowerCase().includes(q)
    ).slice(0, 4).map(a => ({
      kind: 'action' as const,
      groupLabel: 'Actions',
      icon: a.icon,
      breadcrumb: '>',
      title: a.label,
      description: a.description,
      route: a.route,
      tab: a.tab,
      actionId: a.actionId,
    }));

    const deals: SearchResult[] = this.dealsService.allDeals()
      .filter(d => d.title?.toLowerCase().includes(q) || d.dealNumber?.toLowerCase().includes(q))
      .slice(0, 5)
      .map(d => ({
        kind: 'deal' as const,
        groupLabel: 'Deals',
        icon: 'monetization_on',
        breadcrumb: 'Sales',
        title: d.title,
        description: `${this.formatSearchCurrency(d.amount)} · ${d.stage}`,
        entityId: d.id,
      }));

    const partners: SearchResult[] = this.partnersService.allPartners()
      .filter(p => p.name?.toLowerCase().includes(q))
      .slice(0, 5)
      .map(p => ({
        kind: 'partner' as const,
        groupLabel: 'Partners',
        icon: p.type === 'Vendor' ? 'store' : p.type === 'Prospect' ? 'person_search' : 'people',
        breadcrumb: p.type || 'Partner',
        title: p.name,
        description: p.email || p.phone || 'No contact info',
        tab: p.type,
        entityId: p.id,
      }));

    const leads: SearchResult[] = this.state.leadsData()
      .filter(l => l.name?.toLowerCase().includes(q) || l.companyName?.toLowerCase().includes(q))
      .slice(0, 5)
      .map(l => ({
        kind: 'lead' as const,
        groupLabel: 'Leads',
        icon: 'filter_alt',
        breadcrumb: l.companyName || 'Lead',
        title: l.name,
        description: `${l.status} · Score ${l.score}`,
        entityId: l.id,
      }));

    const tickets: SearchResult[] = this.ticketsService.allTickets()
      .filter(t => t.title?.toLowerCase().includes(q))
      .slice(0, 5)
      .map(t => ({
        kind: 'ticket' as const,
        groupLabel: 'Tickets',
        icon: 'support_agent',
        breadcrumb: t.priority,
        title: t.title,
        description: t.status,
        entityId: t.id,
      }));

    const invoices: SearchResult[] = this.invoicesService.allInvoices()
      .filter(i => i.invoiceNumber?.toLowerCase().includes(q) || i.customerName?.toLowerCase().includes(q))
      .slice(0, 5)
      .map(i => ({
        kind: 'invoice' as const,
        groupLabel: 'Invoices',
        icon: 'receipt',
        breadcrumb: i.type,
        title: i.invoiceNumber || i.customerName || 'Invoice',
        description: `${this.formatSearchCurrency(i.amount)} · ${i.status}`,
        tab: i.type,
        entityId: i.id,
      }));

    return [...pages, ...actions, ...deals, ...partners, ...leads, ...tickets, ...invoices].slice(0, 24);
  });

  private formatSearchCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(amount || 0) + ' MAD';
  }

  @HostListener('document:keydown.control.k', ['$event'])
  @HostListener('document:keydown.meta.k', ['$event'])
  handleKeyboardShortcut(event: Event) {
    event.preventDefault();
    this.openSearch();
  }

  @HostListener('document:click', ['$event'])
  handleDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (this.showSearchResults() && !target.closest('.search-container')) {
      this.showSearchResults.set(false);
    }
    if (this.profileMenuOpen() && !target.closest('.sidebar-profile-wrapper')) {
      this.profileMenuOpen.set(false);
    }
  }

  openSearch() {
    this.showSearchResults.set(true);
    this.dealsService.load();
    this.partnersService.load();
    this.ticketsService.load();
    this.invoicesService.load();
    setTimeout(() => this.searchInput()?.nativeElement.focus(), 50);
  }

  onSearchFocus() {
    this.showSearchResults.set(true);
    this.dealsService.load();
    this.partnersService.load();
    this.ticketsService.load();
    this.invoicesService.load();
  }

  onSearchInput(value: string) {
    this.searchQuery.set(value);
    this.selectedSearchIndex.set(0);
    if (value.length >= 1) {
      this.showSearchResults.set(true);
    } else {
      this.showSearchResults.set(false);
    }
  }

  onSearchKeydown(event: KeyboardEvent) {
    const items = this.filteredSearchItems();
    if (items.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.selectedSearchIndex.update(i => (i + 1) % items.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.selectedSearchIndex.update(i => (i - 1 + items.length) % items.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const idx = this.selectedSearchIndex();
      if (idx >= 0 && idx < items.length) {
        this.navigateToSearchItem(items[idx]);
      }
    } else if (event.key === 'Escape') {
      this.showSearchResults.set(false);
      this.searchInput()?.nativeElement.blur();
    }
  }

  navigateToSearchItem(item: SearchResult) {
    this.showSearchResults.set(false);
    this.searchQuery.set('');

    switch (item.kind) {
      case 'page': {
        if (item.tab) this.state.navigateTab.set(item.tab);
        this.router.navigate([item.route]);
        return;
      }
      case 'action': {
        if (item.tab) this.state.navigateTab.set(item.tab);
        this.state.pendingQuickAction.set({ id: item.actionId! });
        this.router.navigate([item.route]);
        return;
      }
      case 'deal': {
        this.router.navigate(['/sales/deals', item.entityId]);
        return;
      }
      case 'lead': {
        this.router.navigate(['/partners/lead', item.entityId]);
        return;
      }
      case 'partner': {
        if (item.tab) this.state.partnersSubTab.set(item.tab as 'Customer' | 'Prospect' | 'Vendor' | 'Lead');
        this.router.navigate(['/partners']);
        return;
      }
      case 'ticket': {
        this.router.navigate(['/tickets', item.entityId]);
        return;
      }
      case 'invoice': {
        if (item.tab) this.state.financeSubTab.set(item.tab as 'Customer' | 'Vendor' | 'Recovery');
        this.router.navigate(['/finance']);
        return;
      }
    }
  }

  clearSearch() {
    this.searchQuery.set('');
    this.showSearchResults.set(false);
    this.searchInput()?.nativeElement.focus();
  }

  openSupportModal() {
    this.supportModal?.openModal();
  }

  /** Tracks which primary route is currently active */
  activeRoute = signal<string>('/');

  private routerSub: Subscription | null = null;
  private notifPollSub: Subscription | null = null;

  ngOnInit() {
    this.activeRoute.set(this.router.url.split('?')[0]);

    this.routerSub = this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe((e: NavigationEnd) => {
        const newRoute = e.urlAfterRedirects.split('?')[0];
        this.activeRoute.set(newRoute);
        this.state.breadcrumbLabel.set(null);
      });

    // Sync current user data from API on app initialization
    this.state.syncCurrentUserFromApi();

    // Poll the inbox so task / lead / ticket assignments surface in the
    // notification bar without a manual refresh. Skipped while logged out
    // (the guard inside refresh would just 401) and while the drawer is open
    // (opening already triggers a refresh).
    this.notifPollSub = interval(30000).subscribe(() => {
      if (this.state.isAuthenticated() && !this.drawerOpen()) {
        this.state.refreshNotifications();
      }
    });
  }

  breadcrumbs = computed(() => {
    const route = this.activeRoute();
    const crumbs: { label: string; route?: string }[] = [];

    if (route === '/') {
      crumbs.push({ label: 'Dashboard' });
      return crumbs;
    }

    // Find the matching parent nav item
    const navItem = ALL_NAV_ITEMS.find(item => route.startsWith(item.route) && item.route !== '/');
    if (navItem) {
      crumbs.push({ label: navItem.label, route: navItem.route });

      // Check for sub-label from service (set by section pages with sub-tabs)
      const subLabel = this.state.breadcrumbLabel();
      if (subLabel) {
        crumbs.push({ label: subLabel });
      } else {
        // Derive sub-label from URL path segments beyond the nav route
        const subPath = route.replace(navItem.route, '').replace(/^\//, '');
        if (subPath) {
          const segments = subPath.split('/');
          segments.forEach(seg => {
            const label = seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' ');
            crumbs.push({ label });
          });
        }
      }
    }

    return crumbs;
  });

  badgeCount(item: NavItem): number {
    return item.badge === 'whatsappUnread' ? this.inbox.unread().conversations : 0;
  }

  isNavActive(item: NavItem): boolean {
    const route = this.activeRoute();
    if (item.route === '/') return route === '/';
    return route.startsWith(item.route);
  }

  onNotificationOpened() {
    this.closeDrawer();
  }

  ngOnDestroy() {
    if (this.routerSub) this.routerSub.unsubscribe();
    if (this.notifPollSub) this.notifPollSub.unsubscribe();
  }

  // eslint-disable-next-line @angular-eslint/prefer-inject
  constructor(private elementRef: ElementRef) {}
}