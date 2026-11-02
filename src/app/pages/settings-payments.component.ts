import { Component, OnInit, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '../pipes/translate.pipe';
import { TranslationService } from '../services/translation.service';
import { ToastService } from '../services/toast.service';
import { CrmStateService } from '../services/crm-state.service';
import { PageHeaderComponent } from '../shared/ui/page-header.component';
import { PaymentProvider, PaymentsApi } from '../services/domains/payments.service';

/**
 * Settings → Payments: whether customers can pay invoices online by card, and through which
 * gateway. Stripe is offered once the server has its keys; test mode settles payments without a
 * real charge, for trying the flow end to end.
 */
@Component({
  selector: 'app-settings-payments',
  imports: [MatIconModule, TranslatePipe, PageHeaderComponent],
  template: `
    <div class="page max-w-3xl">
      <app-page-header size="section" [title]="'payments.title' | translate" [subtitle]="'payments.subtitle' | translate" />

      <section class="card">
        <div class="card-body space-y-5">
          <div role="radiogroup" [attr.aria-label]="'payments.provider' | translate" class="space-y-2">
            @for (p of providers; track p) {
              <label class="choice-row" [class.opacity-50]="!isAvailable(p)">
                <input type="radio" name="provider" class="mt-1" [value]="p" [checked]="provider() === p"
                       [disabled]="!canWrite() || !isAvailable(p)" (change)="provider.set(p)" />
                <span>
                  <span class="row-title">{{ 'payments.provider.' + p | translate }}</span>
                  <span class="row-hint">{{ (isAvailable(p) ? 'payments.providerHint.' + p : 'payments.unavailable.' + p) | translate }}</span>
                </span>
              </label>
            }
          </div>

          <label class="switch-row" for="payments-in-emails">
            <button type="button" id="payments-in-emails" role="switch" class="switch" [attr.aria-checked]="includeInEmails()"
                    [disabled]="!canWrite() || provider() === 'NONE'" [attr.aria-label]="'payments.inEmails' | translate"
                    (click)="includeInEmails.set(!includeInEmails())"></button>
            <span>
              <span class="row-title">{{ 'payments.inEmails' | translate }}</span>
              <span class="row-hint">{{ 'payments.inEmailsHint' | translate }}</span>
            </span>
          </label>

          <div class="alert alert-info">{{ 'payments.howItWorks' | translate }}</div>
        </div>
        @if (canWrite()) {
          <div class="card-footer">
            <button type="button" class="btn-primary" [disabled]="busy()" (click)="save()">{{ 'payments.save' | translate }}</button>
          </div>
        }
      </section>
    </div>
  `,
})
export class SettingsPaymentsComponent implements OnInit {
  private api = inject(PaymentsApi);
  private toast = inject(ToastService);
  private i18n = inject(TranslationService);
  private state = inject(CrmStateService);

  readonly providers: PaymentProvider[] = ['NONE', 'MOCK', 'STRIPE'];
  provider = signal<PaymentProvider>('NONE');
  includeInEmails = signal(true);
  available = signal<PaymentProvider[]>(['NONE']);
  busy = signal(false);

  canWrite(): boolean {
    return this.state.hasAuthority('ADMIN_ACCESS');
  }

  isAvailable(p: PaymentProvider): boolean {
    return this.available().includes(p);
  }

  ngOnInit(): void {
    this.api.settings().subscribe({
      next: s => {
        this.provider.set(s.provider);
        this.includeInEmails.set(s.includeInEmails);
        this.available.set(s.available);
      },
      error: () => this.toast.show(this.i18n.t('payments.error'), { type: 'error' }),
    });
  }

  save(): void {
    this.busy.set(true);
    this.api.saveSettings(this.provider(), this.includeInEmails()).subscribe({
      next: s => {
        this.busy.set(false);
        this.provider.set(s.provider);
        this.toast.show(this.i18n.t('payments.saved'), { type: 'success' });
      },
      error: e => {
        this.busy.set(false);
        const err = e as { error?: { detail?: string } };
        this.toast.show(err?.error?.detail || this.i18n.t('payments.error'), { type: 'error' });
      },
    });
  }
}
