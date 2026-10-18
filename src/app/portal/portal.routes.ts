import { Routes } from '@angular/router';
import { portalGuard, portalGuestGuard } from './portal.guard';

/**
 * The client portal, under /portal. Rendered without the staff shell (see App), with its own
 * session (PortalSessionStore) and its own guard.
 */
export const PORTAL_ROUTES: Routes = [
  { path: 'login', canActivate: [portalGuestGuard], loadComponent: () => import('./portal-login.component').then(m => m.PortalLoginComponent) },
  { path: 'forgot', loadComponent: () => import('./portal-forgot.component').then(m => m.PortalForgotComponent) },
  // The emailed token is the credential: open even with a session, so a link always works.
  { path: 'accept', data: { mode: 'accept' }, loadComponent: () => import('./portal-password.component').then(m => m.PortalPasswordComponent) },
  { path: 'reset', data: { mode: 'reset' }, loadComponent: () => import('./portal-password.component').then(m => m.PortalPasswordComponent) },
  {
    path: '',
    canActivate: [portalGuard],
    loadComponent: () => import('./portal-shell.component').then(m => m.PortalShellComponent),
    children: [
      { path: '', loadComponent: () => import('./pages/portal-home.component').then(m => m.PortalHomeComponent) },
      { path: 'invoices', loadComponent: () => import('./pages/portal-invoices.component').then(m => m.PortalInvoicesComponent) },
      { path: 'checklists', loadComponent: () => import('./pages/portal-checklists.component').then(m => m.PortalChecklistsComponent) },
      { path: 'checklists/:id', loadComponent: () => import('./pages/portal-checklist-detail.component').then(m => m.PortalChecklistDetailComponent) },
      { path: 'missions', loadComponent: () => import('./pages/portal-missions.component').then(m => m.PortalMissionsComponent) },
      { path: 'tax', loadComponent: () => import('./pages/portal-tax.component').then(m => m.PortalTaxComponent) },
      { path: '**', redirectTo: '' },
    ],
  },
];
