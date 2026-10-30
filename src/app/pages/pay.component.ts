import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '../pipes/translate.pipe';
import { TranslationService } from '../services/translation.service';
import { PaymentsApi, PublicInvoice } from '../services/domains/payments.service';

/**
 * The customer's side of Pay-by-Link: the invoice summary, a "pay by card" button that hands off
 * to the organization's gateway, and the outcome when the customer comes back. Reached from an
 * emailed or WhatsApp'd link with no session, so it renders without the app shell.
 *
 * In test mode the gateway sends the customer back here with `?mock=<session>`, and the page
 * shows a test card form whose button settles the invoice the way Stripe's webhook would.
 */
@Component({
  selector: 'app-pay',
  standalone: true,
  imports: [MatIconModule, TranslatePipe],
  template: `
    <div class="min-h-screen bg-canvas flex items-start sm:items-center justify-center px-4 py-8">
      <div class="w-full max-w-[520px] space-y-4">

        @if (loading()) {
          <div class="card p-10 text-center">
            <div class="w-8 h-8 mx-auto border-2 border-line border-t-accent rounded-full animate-spin"></div>
          </div>
        } @else if (notFound()) {
          <div class="card p-8 text-center space-y-3">
            <mat-icon class="text-ink-3">link_off</mat-icon>
            <h1 class="t-title">{{ 'pay.notFound' | translate }}</h1>
            <p class="text-sm text-ink-3">{{ 'pay.notFoundHint' | translate }}</p>
          </div>
        } @else if (invoice(); as inv) {
          <div class="card overflow-hidden">
            <div class="pay-accent" [style.background-color]="inv.accentColor || null"></div>
            <div class="p-6 sm:p-8 space-y-6">
              <div class="flex items-center gap-3">
                @if (inv.logoFileId) {
                  <img [src]="api.logoUrl(inv.logoFileId)" alt="" class="h-10 w-auto max-w-[140px] object-contain" />
                }
                <div class="min-w-0">
                  <div class="text-sm font-semibold text-ink truncate">{{ inv.organizationName }}</div>
                  <div class="text-xs text-ink-3">{{ 'pay.invoice' | translate: { number: inv.invoiceNumber } }}</div>
                </div>
              </div>

              @if (inv.testMode) {
                <div class="alert alert-info text-sm">{{ 'pay.testMode' | translate }}</div>
              }

              @if (inv.status === 'PAID' || justPaid()) {
                <div class="text-center space-y-2 py-4">
                  <div class="w-12 h-12 mx-auto rounded-full bg-success-soft text-success-ink flex items-center justify-center">
                    <mat-icon>check</mat-icon>
                  </div>
                  <h1 class="t-title">{{ 'pay.paidTitle' | translate }}</h1>
                  <p class="text-sm text-ink-3">{{ 'pay.paidHint' | translate: { org: inv.organizationName } }}</p>
                </div>
              } @else if (confirming()) {
                <div class="text-center space-y-2 py-4">
                  <div class="w-8 h-8 mx-auto border-2 border-line border-t-accent rounded-full animate-spin"></div>
                  <h1 class="t-title">{{ 'pay.confirming' | translate }}</h1>
                  <p class="text-sm text-ink-3">{{ 'pay.confirmingHint' | translate }}</p>
                </div>
              } @else if (inv.status === 'CANCELLED') {
                <div class="text-center space-y-2 py-4">
                  <h1 class="t-title">{{ 'pay.cancelled' | translate }}</h1>
                  <p class="text-sm text-ink-3">{{ 'pay.cancelledHint' | translate: { org: inv.organizationName } }}</p>
                </div>
              } @else {
                <div>
                  <div class="eyebrow">{{ 'pay.amountDue' | translate }}</div>
                  <div class="pay-amount num text-ink">{{ money(inv.remaining, inv.currency) }}</div>
                  @if (inv.dueDate) {
                    <div class="text-sm text-ink-3 mt-1">{{ 'pay.dueOn' | translate: { date: date(inv.dueDate) } }}</div>
                  }
                  @if (inv.paid > 0) {
                    <div class="text-sm text-ink-3">{{ 'pay.alreadyPaid' | translate: { paid: money(inv.paid, inv.currency), total: money(inv.total, inv.currency) } }}</div>
                  }
                </div>

                @if (testSession()) {
                  <div class="space-y-3 border border-line rounded-lg p-4">
                    <div class="field-label">{{ 'pay.testCard' | translate }}</div>
                    <input class="input-field num" value="4242 4242 4242 4242" readonly aria-label="Test card number" />
                    <div class="grid grid-cols-2 gap-3">
                      <input class="input-field num" value="12 / 34" readonly aria-label="Expiry" />
                      <input class="input-field num" value="123" readonly aria-label="CVC" />
                    </div>
                    <button type="button" class="btn-primary w-full" [disabled]="busy()" (click)="payTest()">
                      {{ 'pay.payNow' | translate: { amount: money(inv.remaining, inv.currency) } }}
                    </button>
                  </div>
                } @else {
                  <button type="button" class="btn-primary w-full" [disabled]="busy()" (click)="pay()">
                    <mat-icon class="icon-sm">credit_card</mat-icon>
                    {{ 'pay.payByCard' | translate: { amount: money(inv.remaining, inv.currency) } }}
                  </button>
                }
                @if (error()) {
                  <p class="text-sm text-danger-ink">{{ error() }}</p>
                }
              }

              @if (inv.lines.length) {
                <div class="border-t border-line pt-4 space-y-2">
                  @for (line of inv.lines; track $index) {
                    <div class="flex items-baseline justify-between gap-3 text-sm">
                      <span class="text-ink-2 min-w-0">
                        {{ line.description }}
                        @if (line.quantity && line.quantity !== 1) { <span class="text-ink-4">× {{ line.quantity }}</span> }
                      </span>
                      @if (line.amount !== null && line.amount !== undefined) {
                        <span class="num text-ink shrink-0">{{ money(line.amount, inv.currency) }}</span>
                      }
                    </div>
                  }
                  <div class="flex items-baseline justify-between gap-3 text-sm pt-2 border-t border-line">
                    <span class="font-medium text-ink">{{ 'pay.totalTtc' | translate }}</span>
                    <span class="num font-medium text-ink">{{ money(inv.total, inv.currency) }}</span>
                  </div>
                </div>
              }

              <a class="btn-ghost btn-sm" [href]="api.pdfUrl(token)" target="_blank" rel="noopener">
                <mat-icon class="icon-sm">picture_as_pdf</mat-icon>{{ 'pay.downloadPdf' | translate }}
              </a>
            </div>
          </div>
          <p class="text-xs text-ink-4 text-center">{{ 'pay.securedBy' | translate }}</p>
        }
      </div>
    </div>
  `,
  styles: [`
    .pay-accent { height: 4px; background-color: var(--color-accent); }
    .pay-amount { font-size: 32px; line-height: 1.15; font-weight: 600; letter-spacing: -0.02em; }
  `],
})
export class PayComponent implements OnInit, OnDestroy {
  protected api = inject(PaymentsApi);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private i18n = inject(TranslationService);

  token = '';
  loading = signal(true);
  notFound = signal(false);
  invoice = signal<PublicInvoice | null>(null);
  busy = signal(false);
  error = signal<string | null>(null);
  testSession = signal<string | null>(null);
  justPaid = signal(false);
  /** Back from the gateway with ?status=success, waiting for its confirmation to land. */
  private returnedFromCheckout = signal(false);
  confirming = computed(() => this.returnedFromCheckout() && this.invoice()?.status === 'OPEN' && !this.justPaid());
  private poll?: ReturnType<typeof setTimeout>;
  private polls = 0;

  ngOnInit(): void {
    this.token = this.route.snapshot.paramMap.get('token') ?? '';
    const query = this.route.snapshot.queryParamMap;
    this.testSession.set(query.get('mock'));
    this.returnedFromCheckout.set(query.get('status') === 'success');
    this.load();
  }

  ngOnDestroy(): void {
    clearTimeout(this.poll);
  }

  private load(): void {
    this.api.publicInvoice(this.token).subscribe({
      next: inv => {
        this.invoice.set(inv);
        this.loading.set(false);
        // The webhook usually lands within seconds of the redirect; check a few times.
        if (this.confirming() && this.polls < 10) {
          this.polls++;
          this.poll = setTimeout(() => this.load(), 2000);
        }
      },
      error: () => {
        this.notFound.set(true);
        this.loading.set(false);
      },
    });
  }

  pay(): void {
    this.busy.set(true);
    this.error.set(null);
    this.api.checkout(this.token).subscribe({
      next: ({ url }) => {
        if (url.startsWith(window.location.origin)) {
          // Test gateway: it returns to this page; navigate in-app so the form appears at once.
          const target = new URL(url);
          this.router.navigateByUrl(target.pathname + target.search).then(() => {
            this.testSession.set(target.searchParams.get('mock'));
            this.busy.set(false);
          });
        } else {
          window.location.assign(url);
        }
      },
      error: e => this.fail(e),
    });
  }

  payTest(): void {
    const session = this.testSession();
    if (!session) return;
    this.busy.set(true);
    this.error.set(null);
    this.api.completeTestPayment(this.token, session).subscribe({
      next: () => {
        this.justPaid.set(true);
        this.busy.set(false);
        this.router.navigate([], { queryParams: {}, replaceUrl: true });
        this.load();
      },
      error: e => this.fail(e),
    });
  }

  private fail(e: unknown): void {
    this.busy.set(false);
    const err = e as { error?: { detail?: string } };
    this.error.set(err?.error?.detail || this.i18n.t('pay.error'));
  }

  money(amount: number | null | undefined, currency: string): string {
    return new Intl.NumberFormat('fr-MA', { style: 'currency', currency: currency || 'MAD' }).format(Number(amount) || 0);
  }

  date(iso: string): string {
    return new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR');
  }
}
