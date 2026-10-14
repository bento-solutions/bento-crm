import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { firstValueFrom } from 'rxjs';
import { TranslatePipe } from '../pipes/translate.pipe';
import { TranslationService } from '../services/translation.service';
import { ToastService } from '../services/toast.service';
import { CrmStateService } from '../services/crm-state.service';
import { InvoiceRemindersApi, ReminderRunResult } from '../services/domains/invoice-reminders.service';

/** The reminder days offered as one-click choices; any other day can be added by hand. */
const PRESETS = [-7, -3, 0, 1, 3, 7, 15, 30];

/**
 * Settings → Billing: when unpaid customer invoices are chased automatically by email. The
 * backend runs the reminders every morning and never sends the same one twice.
 */
@Component({
  selector: 'app-settings-billing',
  imports: [FormsModule, MatIconModule, TranslatePipe],
  styles: [`
    .bl-card { background: var(--color-surface); border: 1px solid var(--color-border); }
    .bl-muted { color: var(--color-text-secondary); }
    .bl-faint { color: var(--color-text-tertiary); }
    .bl-input { background: var(--color-bg); border: 1px solid var(--color-border); color: var(--color-text-primary); }
    .bl-btn { border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text-primary); }
    .bl-btn:disabled { opacity: .5; cursor: not-allowed; }
    .bl-btn-primary { background: var(--color-text-primary); color: var(--color-surface); }
    .bl-btn-primary:disabled { opacity: .5; cursor: not-allowed; }
    .bl-chip { border: 1px solid var(--color-border); }
    .bl-chip-on { border-color: var(--color-accent); background: var(--color-accent-light); font-weight: 600; }
    .bl-note { background: var(--color-bg); }
  `],
  template: `
    <div class="space-y-6 max-w-3xl">
      <section class="bl-card rounded-2xl p-6 space-y-5">
        <div>
          <h2 class="text-base font-bold">{{ 'billing.title' | translate }}</h2>
          <p class="text-sm bl-muted mt-1">{{ 'billing.subtitle' | translate }}</p>
        </div>

        <label class="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" class="mt-1" [disabled]="!canWrite()" [ngModel]="enabled()" (ngModelChange)="enabled.set($event)" />
          <span>
            <span class="text-sm font-semibold block">{{ 'billing.enable' | translate }}</span>
            <span class="text-xs bl-muted">{{ 'billing.enableHint' | translate }}</span>
          </span>
        </label>

        <div>
          <p class="text-xs font-semibold bl-muted mb-2">{{ 'billing.when' | translate }}</p>
          <div class="flex flex-wrap gap-2">
            @for (d of choices(); track d) {
              <button type="button" class="bl-chip text-xs px-3 py-1.5 rounded-full" [class.bl-chip-on]="offsets().has(d)"
                      [disabled]="!canWrite()" [attr.aria-pressed]="offsets().has(d)" (click)="toggle(d)">
                {{ label(d) }}
              </button>
            }
          </div>
          <div class="flex items-center gap-2 mt-3">
            <input type="number" min="-30" max="365" class="bl-input w-24 rounded-lg px-3 py-1.5 text-sm" [disabled]="!canWrite()"
                   [attr.aria-label]="'billing.customDay' | translate" [ngModel]="custom()" (ngModelChange)="custom.set($event)" />
            <button type="button" class="bl-btn text-xs font-semibold px-3 py-1.5 rounded-lg" [disabled]="!canWrite() || !validCustom()" (click)="addCustom()">
              {{ 'billing.addDay' | translate }}
            </button>
            <span class="text-xs bl-faint">{{ 'billing.customHint' | translate }}</span>
          </div>
        </div>

        <label class="block">
          <span class="text-xs font-semibold bl-muted">{{ 'billing.message' | translate }}</span>
          <textarea rows="3" maxlength="2000" class="bl-input w-full rounded-lg px-3 py-2 mt-1 text-sm" [disabled]="!canWrite()"
                    [placeholder]="'billing.messagePlaceholder' | translate" [ngModel]="message()" (ngModelChange)="message.set($event)"></textarea>
        </label>

        <p class="bl-note text-xs rounded-lg px-3 py-2">{{ 'billing.note' | translate }}</p>

        @if (canWrite()) {
          <div class="flex flex-wrap gap-2">
            <button type="button" class="bl-btn-primary text-sm font-semibold px-4 py-2 rounded-lg" [disabled]="busy() || offsets().size === 0" (click)="save()">
              {{ 'billing.save' | translate }}
            </button>
            <button type="button" class="bl-btn text-sm px-4 py-2 rounded-lg inline-flex items-center gap-1" [disabled]="busy()" (click)="runNow()">
              <mat-icon class="!text-[16px] !w-4 !h-4">send</mat-icon>{{ 'billing.runNow' | translate }}
            </button>
          </div>
        }
        @if (lastRun(); as r) {
          <p class="text-xs bl-muted">{{ 'billing.runResult' | translate: { sent: r.remindersSent, overdue: r.markedOverdue, skipped: r.skippedNoEmail } }}</p>
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
    return this.i18n.t(day < 0 ? 'billing.daysBefore' : 'billing.daysAfter', { n: Math.abs(day) });
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
    this.toast.show((e as { detail?: string })?.detail || this.i18n.t('recurring.error'), { type: 'error' });
  }
}
