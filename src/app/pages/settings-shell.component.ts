import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { filter, map } from 'rxjs';
import { CrmStateService } from '../services/crm-state.service';
import { PageHeaderComponent } from '../shared/ui/page-header.component';

interface SettingsLink {
  path: string;
  label: string;
  icon: string;
  /** Hides the link from people the route's guard would turn away. */
  show?: () => boolean;
}

/**
 * The frame around every Settings page. Thirteen sections do not fit in a row of tabs, so they are
 * grouped: a list beside the content on large screens, one jump menu above it on smaller ones.
 */
@Component({
  selector: 'app-settings-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatIconModule, PageHeaderComponent],
  template: `
    <div class="page">
      <app-page-header title="Settings" subtitle="Organization, people and integrations" />

      <div class="settings-layout">
        <select class="input-field settings-jump" aria-label="Settings section" (change)="jumpTo($event)">
          @for (section of sections(); track section.label) {
            <optgroup [label]="section.label">
              @for (link of section.links; track link.path) {
                <option [value]="link.path" [selected]="link.path === activePath()">{{ link.label }}</option>
              }
            </optgroup>
          }
        </select>

        <nav class="settings-nav" aria-label="Settings sections">
          @for (section of sections(); track section.label) {
            <div class="settings-nav__group">
              <h2 class="section-label">{{ section.label }}</h2>
              @for (link of section.links; track link.path) {
                <a [routerLink]="['/settings', link.path]" routerLinkActive="is-active" ariaCurrentWhenActive="page" class="sub-nav-item">
                  <mat-icon>{{ link.icon }}</mat-icon>
                  {{ link.label }}
                </a>
              }
            </div>
          }
        </nav>

        <div class="settings-content">
          <router-outlet></router-outlet>
        </div>
      </div>
    </div>
  `
})
export class SettingsShellComponent {
  state = inject(CrmStateService);
  private router = inject(Router);

  private url = toSignal(
    this.router.events.pipe(filter(e => e instanceof NavigationEnd), map(() => this.router.url)),
    { initialValue: this.router.url }
  );

  protected activePath = computed(() => this.url().split(/[?#]/)[0].split('/')[2] ?? '');

  private readonly allSections: { label: string; links: SettingsLink[] }[] = [
    {
      label: 'Workspace',
      links: [
        { path: 'organization', label: 'Organization', icon: 'business' },
        { path: 'users', label: 'Users', icon: 'group', show: () => this.state.currentUserPermissions().canManageUsers },
        { path: 'teams', label: 'Teams', icon: 'groups', show: () => this.state.currentUserPermissions().canManageTeams },
        { path: 'groups', label: 'Groups', icon: 'forum' },
      ],
    },
    {
      label: 'Communication',
      links: [
        { path: 'whatsapp', label: 'WhatsApp', icon: 'chat', show: () => this.state.hasAuthority('WHATSAPP_ADMIN') },
        { path: 'inboxes', label: 'Inboxes', icon: 'alternate_email', show: () => this.can('INVOICES_READ', 'PAYMENTS_READ', 'ADMIN_ACCESS') },
      ],
    },
    {
      label: 'Finance',
      links: [
        { path: 'billing', label: 'Billing', icon: 'notifications_active' },
        { path: 'invoice-template', label: 'Invoices', icon: 'receipt_long' },
        { path: 'payments', label: 'Payments', icon: 'credit_card' },
        { path: 'stock', label: 'Stock', icon: 'inventory_2' },
      ],
    },
    {
      label: 'Data and access',
      links: [
        { path: 'brands', label: 'Brands', icon: 'sell', show: () => this.state.hasAuthority('PARTNERS_WRITE') },
        { path: 'categories', label: 'Categories', icon: 'label', show: () => this.can('TICKETS_WRITE', 'TASKS_WRITE') },
        { path: 'api-tokens', label: 'API tokens', icon: 'key', show: () => this.state.hasAuthority('API_TOKENS_MANAGE') },
      ],
    },
  ];

  protected sections = computed(() =>
    this.allSections
      .map(section => ({ label: section.label, links: section.links.filter(link => !link.show || link.show()) }))
      .filter(section => section.links.length > 0)
  );

  protected jumpTo(event: Event): void {
    this.router.navigate(['/settings', (event.target as HTMLSelectElement).value]);
  }

  private can(...authorities: string[]): boolean {
    return authorities.some(a => this.state.hasAuthority(a));
  }
}
