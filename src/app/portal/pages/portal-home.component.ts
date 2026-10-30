import { Component, OnInit, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { TranslationService } from '../../services/translation.service';
import { errorDetail } from '../../pages/bank/bank-labels';
import { formatMoney, shortDate } from '../../shared/bank.util';
import { PortalApi, PortalHome } from '../portal-api.service';
import { PortalSessionStore } from '../portal-session';

/** Portal home: what the firm is waiting for from the client, and what the client owes or has coming. */
@Component({
  selector: 'app-portal-home',
  imports: [MatIconModule, RouterLink, TranslatePipe],
  template: `
    <div class="space-y-5">
      <div>
        <h1 class="t-title">{{ 'portal.home.hello' | translate: { name: me()?.displayName || me()?.email || '' } }}</h1>
        <p class="text-sm text-ink-3">{{ 'portal.home.subtitle' | translate: { firm: me()?.firmName || '' } }}</p>
      </div>

      @if (error()) { <div class="alert alert-danger text-sm">{{ error() }}</div> }

      @if (home(); as h) {
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <a routerLink="/portal/checklists" class="card card-interactive p-4 flex items-start gap-3">
            <span class="icon-chip shrink-0"><mat-icon>checklist</mat-icon></span>
            <span class="min-w-0 flex-1">
              <span class="block text-sm text-ink-2">{{ 'portal.home.documents' | translate }}</span>
              <span class="block text-2xl text-ink num" [class.text-warning-ink]="h.documentsMissing > 0">{{ h.documentsMissing }}</span>
              <span class="block text-xs text-ink-3">{{ (h.documentsMissing > 0 ? 'portal.home.documentsMissing' : 'portal.home.documentsNone') | translate }}</span>
            </span>
            <mat-icon class="text-ink-4 rtl:rotate-180">chevron_right</mat-icon>
          </a>

          <a routerLink="/portal/invoices" class="card card-interactive p-4 flex items-start gap-3">
            <span class="icon-chip shrink-0"><mat-icon>receipt_long</mat-icon></span>
            <span class="min-w-0 flex-1">
              <span class="block text-sm text-ink-2">{{ 'portal.home.amountDue' | translate }}</span>
              <span class="block text-2xl text-ink num">{{ money(h.amountDue) }}</span>
              <span class="block text-xs text-ink-3">
                {{ 'portal.home.openInvoices' | translate: { n: h.openInvoices } }}
                @if (h.overdueInvoices > 0) { · <span class="text-danger-ink">{{ 'portal.home.overdueInvoices' | translate: { n: h.overdueInvoices } }}</span> }
              </span>
            </span>
            <mat-icon class="text-ink-4 rtl:rotate-180">chevron_right</mat-icon>
          </a>

          <a routerLink="/portal/tax" class="card card-interactive p-4 flex items-start gap-3">
            <span class="icon-chip shrink-0"><mat-icon>event_note</mat-icon></span>
            <span class="min-w-0 flex-1">
              <span class="block text-sm text-ink-2">{{ 'portal.home.nextTax' | translate }}</span>
              @if (h.nextTaxDeadline) {
                <span class="block text-2xl text-ink num">{{ date(h.nextTaxDeadline) }}</span>
                <span class="block text-xs text-ink-3 truncate">{{ ('tax.kind.' + h.nextTaxDeadlineKind) | translate }}</span>
              } @else {
                <span class="block text-2xl text-ink">—</span>
                <span class="block text-xs text-ink-3">{{ 'portal.home.noTax' | translate }}</span>
              }
            </span>
            <mat-icon class="text-ink-4 rtl:rotate-180">chevron_right</mat-icon>
          </a>

          <a routerLink="/portal/missions" class="card card-interactive p-4 flex items-start gap-3">
            <span class="icon-chip shrink-0"><mat-icon>work</mat-icon></span>
            <span class="min-w-0 flex-1">
              <span class="block text-sm text-ink-2">{{ 'portal.home.missions' | translate }}</span>
              <span class="block text-2xl text-ink num">{{ h.missionsInProgress }}</span>
              <span class="block text-xs text-ink-3">{{ 'portal.home.missionsHint' | translate }}</span>
            </span>
            <mat-icon class="text-ink-4 rtl:rotate-180">chevron_right</mat-icon>
          </a>
        </div>
      } @else if (!error()) {
        <div class="card p-10 flex justify-center"><div class="w-8 h-8 border-2 border-line border-t-accent rounded-full animate-spin"></div></div>
      }
    </div>
  `,
})
export class PortalHomeComponent implements OnInit {
  private api = inject(PortalApi);
  private store = inject(PortalSessionStore);
  private i18n = inject(TranslationService);

  readonly me = this.store.me;
  home = signal<PortalHome | null>(null);
  error = signal<string | null>(null);

  ngOnInit(): void {
    this.api.home().subscribe({
      next: h => {
        this.home.set(h);
        if (h.me) this.store.setMe(h.me);
      },
      error: e => this.error.set(errorDetail(e) || this.i18n.t('portal.error')),
    });
  }

  money(v: number | null | undefined): string { return formatMoney(v); }
  date(iso: string | null | undefined): string { return shortDate(iso); }
}
