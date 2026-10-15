import {Routes} from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';
import { permissionGuard } from './core/guards/permission.guard';
import { authorityGuard } from './core/guards/authority.guard';

export const routes: Routes = [
  { path: 'onboarding', canActivate: [guestGuard], loadComponent: () => import('./pages/onboarding.component').then(m => m.OnboardingComponent) },
  // Deliberately unguarded: the invitee has no session, and guestGuard would bounce an
  // already-signed-in user away from a link they were legitimately sent.
  // Pay-by-Link: public, for the customer; the token in the path is the credential.
  { path: 'pay/:token', loadComponent: () => import('./pages/pay.component').then(m => m.PayComponent) },
  // Drive share links: public, for whoever was sent the link; the token is the credential.
  { path: 'f/:token', loadComponent: () => import('./pages/shared-file.component').then(m => m.SharedFileComponent) },
  { path: 'invite/accept', loadComponent: () => import('./pages/invite-accept.component').then(m => m.InviteAcceptComponent) },
  { path: '', canActivate: [authGuard], loadComponent: () => import('./pages/dashboard.component').then(m => m.DashboardComponent) },
  { path: 'analytics', canActivate: [authGuard], loadComponent: () => import('./pages/analytics.component').then(m => m.AnalyticsComponent) },
  { path: 'tasks', canActivate: [authGuard], loadComponent: () => import('./pages/tasks.component').then(m => m.TasksComponent) },
  { path: 'sales', canActivate: [authGuard], loadComponent: () => import('./pages/sales.component').then(m => m.SalesComponent) },
  { path: 'sales/deals/:dealId', canActivate: [authGuard], loadComponent: () => import('./pages/deal-detail.component').then(m => m.DealDetailComponent) },
  { path: 'inbox', canActivate: [authGuard, authorityGuard('WHATSAPP_READ')], loadComponent: () => import('./pages/inbox.component').then(m => m.InboxComponent) },
  { path: 'marketing', canActivate: [authGuard], loadComponent: () => import('./pages/marketing.component').then(m => m.MarketingComponent) },
  { path: 'campaigns/:id', canActivate: [authGuard], loadComponent: () => import('./pages/campaign-detail.component').then(m => m.CampaignDetailComponent) },
  { path: 'partners', canActivate: [authGuard], loadComponent: () => import('./pages/partners.component').then(m => m.PartnersComponent) },
  { path: 'partners/lead/:id', canActivate: [authGuard], loadComponent: () => import('./pages/lead-detail.component').then(m => m.LeadDetailComponent) },
  { path: 'finance', canActivate: [authGuard], loadComponent: () => import('./pages/finance.component').then(m => m.FinanceComponent) },
  { path: 'inventory', canActivate: [authGuard], loadComponent: () => import('./pages/inventory.component').then(m => m.InventoryComponent) },
  { path: 'drive', canActivate: [authGuard, authorityGuard('FILES_READ')], loadComponent: () => import('./pages/drive.component').then(m => m.DriveComponent) },
  { path: 'inbox-documents', canActivate: [authGuard, authorityGuard('INVOICES_READ', 'PAYMENTS_READ')], loadComponent: () => import('./pages/inbound-documents.component').then(m => m.InboundDocumentsComponent) },
  { path: 'finance/recurring', canActivate: [authGuard], loadComponent: () => import('./pages/recurring-invoices.component').then(m => m.RecurringInvoicesComponent) },
  { path: 'tickets', canActivate: [authGuard], loadComponent: () => import('./pages/tickets.component').then(m => m.TicketsComponent) },
  { path: 'tickets/:id', canActivate: [authGuard], loadComponent: () => import('./pages/ticket-detail.component').then(m => m.TicketDetailComponent) },
  { path: 'automation', canActivate: [authGuard], loadComponent: () => import('./pages/automation.component').then(m => m.AutomationComponent) },
  { path: 'partners/:id/customer-card', canActivate: [authGuard], loadComponent: () => import('./pages/customer-card.component').then(m => m.CustomerCardComponent) },
  {
    path: 'settings',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/settings-shell.component').then(m => m.SettingsShellComponent),
    children: [
      { path: '', redirectTo: 'organization', pathMatch: 'full' },
      { path: 'organization', loadComponent: () => import('./pages/org-settings.component').then(m => m.OrgSettingsComponent) },
      { path: 'users', canActivate: [permissionGuard('canManageUsers')], loadComponent: () => import('./pages/users.component').then(m => m.UsersComponent) },
      { path: 'teams', canActivate: [permissionGuard('canManageTeams')], loadComponent: () => import('./pages/teams.component').then(m => m.TeamsComponent) },
      // Same component as the top-level 'groups' route below, intentionally:
      // this one renders inside the settings shell's sidebar layout, the
      // other is the standalone main-nav entry point.
      { path: 'groups', loadComponent: () => import('./pages/groups.component').then(m => m.GroupsComponent) },
      { path: 'whatsapp', canActivate: [authorityGuard('WHATSAPP_ADMIN')], loadComponent: () => import('./pages/settings-whatsapp.component').then(m => m.SettingsWhatsAppComponent) },
      { path: 'billing', loadComponent: () => import('./pages/settings-billing.component').then(m => m.SettingsBillingComponent) },
      { path: 'payments', loadComponent: () => import('./pages/settings-payments.component').then(m => m.SettingsPaymentsComponent) },
      { path: 'inboxes', canActivate: [authorityGuard('INVOICES_READ', 'PAYMENTS_READ', 'ADMIN_ACCESS')], loadComponent: () => import('./pages/settings-inboxes.component').then(m => m.SettingsInboxesComponent) },
      { path: 'stock', loadComponent: () => import('./pages/settings-stock.component').then(m => m.SettingsStockComponent) },
      { path: 'invoice-template', loadComponent: () => import('./pages/settings-invoice-template.component').then(m => m.SettingsInvoiceTemplateComponent) },
      { path: 'api-tokens', canActivate: [authorityGuard('API_TOKENS_MANAGE')], loadComponent: () => import('./pages/settings-api-tokens.component').then(m => m.SettingsApiTokensComponent) },
      { path: 'brands', canActivate: [authorityGuard('PARTNERS_WRITE')], loadComponent: () => import('./pages/settings-brands.component').then(m => m.SettingsBrandsComponent) },
      { path: 'categories', canActivate: [authorityGuard('TICKETS_WRITE', 'TASKS_WRITE')], loadComponent: () => import('./pages/settings-categories.component').then(m => m.SettingsCategoriesComponent) }
    ]
  },
  { path: 'groups', canActivate: [authGuard], loadComponent: () => import('./pages/groups.component').then(m => m.GroupsComponent) },
  { path: 'profile', canActivate: [authGuard], loadComponent: () => import('./pages/user-profile.component').then(m => m.UserProfileComponent) },
  { path: 'settings/users/:userId', canActivate: [authGuard], loadComponent: () => import('./pages/user-profile.component').then(m => m.UserProfileComponent) }
];

