import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { firstValueFrom } from 'rxjs';
import { TranslatePipe } from '../pipes/translate.pipe';
import { TranslationService } from '../services/translation.service';
import { ToastService } from '../services/toast.service';
import { CrmStateService } from '../services/crm-state.service';
import { PageHeaderComponent } from '../shared/ui/page-header.component';
import { InvoiceRemindersApi, ReminderRunResult } from '../services/domains/invoice-reminders.service';

/** The reminder days offered as one-click choices; any other day can be added by hand. */
const PRESETS = [-7, -3, 0, 1, 3, 7, 15, 30];

/**
 * Settings → Billing: when unpaid customer invoices are chased automatically by email. The
 * backend runs the reminders every morning and never sends the same one twice.
 */
@Component({
  selector: 'app-settings-billing',
  imports: [FormsModule, MatIconModule, TranslatePipe, PageHeaderComponent],
  template: `
    <div class="space-y-6 max-w-3xl">
      <app-page-header size="section" [title]="'billing.title' | translate" [subtitle]="'billing.subtitle' | translate" />

      <section class="card">
        <div class="card-body space-y-6">
          <div class="flex items-start gap-3">
            <button type="button" role="switch" class="switch mt-0.5 shrink-0" [attr.aria-checked]="enabled()" [disabled]="!canWrite()"
                    [attr.aria-label]="'billing.enable' | translate" (click)="enabled.set(!enabled())"></button>
            <span>
              <span class="text-sm font-medium text-ink block">{{ 'billing.enable' | translate }}</span>
              <span class="text-xs text-ink-3">{{ 'billing.enableHint' | translate }}</span>
            </span>
          </div>

          <div>
            <p class="field-label">{{ 'billing.when' | translate }}</p>
            <div class="flex flex-wrap gap-2">
              @for (d of choices(); track d) {
                <button type="button" class="btn-sm" [class.btn-primary]="offsets().has(d)" [class.btn-secondary]="!offsets().has(d)"
                        [disabled]="!canWrite()" [attr.aria-pressed]="offsets().has(d)" (click)="toggle(d)">
                  {{ label(d) }}
                </button>
              }
            </div>
            <div class="flex flex-wrap items-center gap-2 mt-3">
              <input type="number" min="-30" max="365" class="input-field w-24" [disabled]="!canWrite()"
                     [attr.aria-label]="'billing.customDay' | translate" [ngModel]="custom()" (ngModelChange)="custom.set($event)" />
              <button type="button" class="btn-secondary btn-sm" [disabled]="!canWrite() || !validCustom()" (click)="addCustom()">
                {{ 'billing.addDay' | translate }}
              </button>
              <span class="text-xs text-ink-3">{{ 'billing.customHint' | translate }}</span>
            </div>
          </div>

          <label class="block">
            <span class="field-label">{{ 'billing.message' | translate }}</span>
            <textarea rows="3" maxlength="2000" class="input-field" [disabled]="!canWrite()"
                      [placeholder]="'billing.messagePlaceholder' | translate" [ngModel]="message()" (ngModelChange)="message.set($event)"></textarea>
          </label>

          <div class="alert alert-info text-xs">{{ 'billing.note' | translate }}</div>

          @if (lastRun(); as r) {
            <p class="text-xs text-ink-2">{{ 'billing.runResult' | translate: { sent: r.remindersSent, overdue: r.markedOverdue, skipped: r.skippedNoEmail } }}</p>
          }
        </div>
        @if (canWrite()) {
          <div class="card-footer flex flex-wrap gap-2 justify-end">
            <button type="button" class="btn-secondary" [disabled]="busy()" (click)="runNow()">
              <mat-icon class="icon-sm">send</mat-icon>{{ 'billing.runNow' | translate }}
            </button>
            <button type="button" class="btn-primary" [disabled]="busy() || offsets().size === 0" (click)="save()">
              {{ 'billing.save' | translate }}
            </button>
          </div>
        }
      </section>
    </div>
  `
})
export class SettingsBillingComponent implements OnInit {
  private api = inject(InvoiceRemindersApi);
  private state = inject(CrmStateService);
  private i18n = inject(TranslationService);
  private toast = inject(ToastService);

  protected enabled = signal(false);
  protected offsets = signal(new Set<number>([-3, 1, 7, 15]));
  protected message = signal('');
  protected custom = signal<number | null>(null);
  protected busy = signal(false);
  protected lastRun = signal<ReminderRunResult | null>(null);

  protected choices = computed(() => [...new Set([...PRESETS, ...this.offsets()])].sort((a, b) => a - b));
  protected validCustom = computed(() => {
    const v = this.custom();
    return v !== null && Number.isInteger(+v) && +v >= -30 && +v <= 365;
  });

  ngOnInit(): void {
    this.api.policy().subscribe({
      next: p => {
        this.enabled.set(p.enabled);
        this.offsets.set(new Set(p.offsetsDays));
        this.message.set(p.message ?? '');
      },
      error: e => this.fail(e),
    });
  }

  protected canWrite(): boolean {
    return this.state.hasAuthority('INVOICES_WRITE');
  }

  toggle(day: number): void {
    const next = new Set(this.offsets());
    if (next.has(day)) next.delete(day); else next.add(day);
    this.offsets.set(next);
  }

  addCustom(): void {
    if (!this.validCustom()) return;
    this.offsets.set(new Set([...this.offsets(), +this.custom()!]));
    this.custom.set(null);
  }

  label(day: number): string {
    if (day === 0) return this.i18n.t('billing.onDueDate');
    const n = Math.abs(day);
    if (n === 1) return this.i18n.t(day < 0 ? 'billing.dayBefore' : 'billing.dayAfter');
    return this.i18n.t(day < 0 ? 'billing.daysBefore' : 'billing.daysAfter', { n });
  }

  async save(): Promise<void> {
    this.busy.set(true);
    try {
      const saved = await firstValueFrom(this.api.savePolicy({
        enabled: this.enabled(),
        offsetsDays: [...this.offsets()].sort((a, b) => a - b),
        message: this.message().trim() || null,
      }));
      this.offsets.set(new Set(saved.offsetsDays));
      this.toast.show(this.i18n.t('billing.saved'), { type: 'success' });
    } catch (e) {
      this.fail(e);
    } finally {
      this.busy.set(false);
    }
  }

  async runNow(): Promise<void> {
    this.busy.set(true);
    try {
      this.lastRun.set(await firstValueFrom(this.api.runNow()));
    } catch (e) {
      this.fail(e);
    } finally {
      this.busy.set(false);
    }
  }

  private fail(e: unknown): void {
    this.toast.show(((e as { error?: { detail?: string } })?.error?.detail ?? (e as { detail?: string })?.detail) || this.i18n.t('recurring.error'), { type: 'error' });
  }
}
