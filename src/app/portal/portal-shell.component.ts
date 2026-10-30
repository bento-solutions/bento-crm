import { Component, OnInit, computed, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslatePipe } from '../pipes/translate.pipe';
import { PortalAuthService } from './portal-auth.service';
import { PortalApi } from './portal-api.service';
import { PortalSessionStore } from './portal-session';
import { PortalLanguageComponent } from './portal-language.component';
import { environment } from '../../environments/environment';

/** The firm's logo as an image URL: stored paths are served from the API host, like the staff sidebar's. */
export function firmLogoSrc(url: string | null | undefined): string {
  if (!url) return '';
  if (/^(https?:|data:)/.test(url)) return url;
  const base = environment.apiUrl.replace(/\/api\/v1\/?$/, '');
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
}

/**
 * The client portal's own frame: the firm's name and logo, a short navigation (a bottom bar on
 * phones, a row of tabs on wider screens) and sign-out. No staff sidebar or top bar.
 */
@Component({
  selector: 'app-portal-shell',
  imports: [MatIconModule, RouterLink, RouterLinkActive, RouterOutlet, TranslatePipe, PortalLanguageComponent],
  template: `
    <div class="min-h-screen bg-canvas pb-20 sm:pb-8">
      <header class="bg-surface border-b border-line">
        <div class="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <a routerLink="/portal" class="flex items-center gap-3 min-w-0 flex-1">
            @if (logoUrl()) {
              <img [src]="logoUrl()" alt="" class="h-8 w-auto max-w-28 object-contain shrink-0" />
            } @else {
              <span class="icon-chip shrink-0"><mat-icon>business</mat-icon></span>
            }
            <span class="min-w-0">
              <span class="block text-sm font-semibold text-ink truncate">{{ me()?.firmName || ('portal.title' | translate) }}</span>
              <span class="block text-xs text-ink-3 truncate">{{ me()?.companyName || me()?.email }}</span>
            </span>
          </a>
          <app-portal-language />
          <button class="btn-ghost btn-sm shrink-0" (click)="logout()" [attr.aria-label]="'portal.signOut' | translate">
            <mat-icon>logout</mat-icon><span class="hidden sm:inline">{{ 'portal.signOut' | translate }}</span>
          </button>
        </div>
        <nav class="hidden sm:block max-w-4xl mx-auto px-4" [attr.aria-label]="'portal.nav' | translate">
          <div class="tabs mb-0">
            @for (n of nav; track n.route) {
              <a class="tab" [routerLink]="n.route" routerLinkActive="is-active" [routerLinkActiveOptions]="{ exact: n.exact }">
                <mat-icon>{{ n.icon }}</mat-icon>{{ n.label | translate }}
              </a>
            }
          </div>
        </nav>
      </header>

      <main class="max-w-4xl mx-auto px-4 py-5">
        <router-outlet />
      </main>

      <!-- Phones: the sections sit under the thumb. -->
      <nav class="sm:hidden fixed bottom-0 inset-x-0 z-30 bg-surface border-t border-line grid grid-cols-5" [attr.aria-label]="'portal.nav' | translate">
        @for (n of nav; track n.route) {
          <a [routerLink]="n.route" routerLinkActive="text-accent-ink" [routerLinkActiveOptions]="{ exact: n.exact }"
             class="flex flex-col items-center gap-0.5 py-2 text-ink-3 min-w-0">
            <mat-icon class="icon-md">{{ n.icon }}</mat-icon>
            <span class="text-meta truncate max-w-full px-1">{{ n.short | translate }}</span>
          </a>
        }
      </nav>
    </div>
  `,
})
export class PortalShellComponent implements OnInit {
  private auth = inject(PortalAuthService);
  private api = inject(PortalApi);
  private store = inject(PortalSessionStore);

  readonly me = this.store.me;
  readonly logoUrl = computed(() => firmLogoSrc(this.me()?.firmLogoUrl));

  readonly nav = [
    { route: '/portal', icon: 'home', label: 'portal.nav.home', short: 'portal.nav.home', exact: true },
    { route: '/portal/checklists', icon: 'checklist', label: 'portal.nav.checklists', short: 'portal.nav.checklistsShort', exact: false },
    { route: '/portal/invoices', icon: 'receipt_long', label: 'portal.nav.invoices', short: 'portal.nav.invoices', exact: false },
    { route: '/portal/missions', icon: 'work', label: 'portal.nav.missions', short: 'portal.nav.missions', exact: false },
    { route: '/portal/tax', icon: 'event_note', label: 'portal.nav.tax', short: 'portal.nav.taxShort', exact: false },
  ];

  ngOnInit(): void {
    // Keeps the firm's name and logo current (they may have changed since sign-in).
    this.api.me().subscribe({ next: me => this.store.setMe(me), error: () => { /* a 401 already signs out */ } });
  }

  logout(): void {
    this.auth.logout();
  }
}
