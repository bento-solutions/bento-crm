import {Routes} from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';
import { permissionGuard } from './core/guards/permission.guard';

export const routes: Routes = [
  { path: 'onboarding', canActivate: [guestGuard], loadComponent: () => import('./pages/onboarding.component').then(m => m.OnboardingComponent) },
  // Deliberately unguarded: the invitee has no session, and guestGuard would bounce an
  // already-signed-in user away from a link they were legitimately sent.
  { path: 'invite/accept', loadComponent: () => import('./pages/invite-accept.component').then(m => m.InviteAcceptComponent) },
  { path: '', canActivate: [authGuard], loadComponent: () => import('./pages/dashboard.component').then(m => m.DashboardComponent) },
  { path: 'analytics', canActivate: [authGuard], loadComponent: () => import('./pages/analytics.component').then(m => m.AnalyticsComponent) },
  { path: 'tasks', canActivate: [authGuard], loadComponent: () => import('./pages/tasks.component').then(m => m.TasksComponent) },
  { path: 'sales', canActivate: [authGuard], loadComponent: () => import('./pages/sales.component').then(m => m.SalesComponent) },
  { path: 'sales/deals/:dealId', canActivate: [authGuard], loadComponent: () => import('./pages/deal-detail.component').then(m => m.DealDetailComponent) },
  { path: 'marketing', canActivate: [authGuard], loadComponent: () => import('./pages/marketing.component').then(m => m.MarketingComponent) },
  { path: 'partners', canActivate: [authGuard], loadComponent: () => import('./pages/partners.component').then(m => m.PartnersComponent) },
  { path: 'partners/lead/:id', canActivate: [authGuard], loadComponent: () => import('./pages/lead-detail.component').then(m => m.LeadDetailComponent) },
  { path: 'finance', canActivate: [authGuard], loadComponent: () => import('./pages/finance.component').then(m => m.FinanceComponent) },
  { path: 'tickets', canActivate: [authGuard], loadComponent: () => import('./pages/tickets.component').then(m => m.TicketsComponent) },
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
      { path: 'groups', loadComponent: () => import('./pages/groups.component').then(m => m.GroupsComponent) }
    ]
  },
  { path: 'groups', canActivate: [authGuard], loadComponent: () => import('./pages/groups.component').then(m => m.GroupsComponent) },
  { path: 'profile', canActivate: [authGuard], loadComponent: () => import('./pages/user-profile.component').then(m => m.UserProfileComponent) },
  { path: 'settings/users/:userId', canActivate: [authGuard], loadComponent: () => import('./pages/user-profile.component').then(m => m.UserProfileComponent) }
];

