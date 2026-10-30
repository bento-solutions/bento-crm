import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { TranslationService } from '../../services/translation.service';
import { ToastService } from '../../services/toast.service';
import { CrmStateService } from '../../services/crm-state.service';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { ConfirmService } from '../../shared/ui/confirm.service';
import { BankApi, BankRule, RuleDirection } from '../../services/domains/bank.service';
import { categoryLabel, errorDetail } from './bank-labels';

/** Bank → Rules: "lines containing this text get this category", applied on every import. */
@Component({
  selector: 'app-bank-rules',
  imports: [FormsModule, MatIconModule, TranslatePipe, EmptyStateComponent],
  template: `
    <div class="space-y-4">
      <p class="text-sm text-ink-2">{{ 'bank.rules.intro' | translate }}</p>

      @if (canWrite()) {
        <div class="card card-body">
          <fieldset class="flex flex-wrap items-end gap-3" [disabled]="busy()">
            <label class="block flex-1 min-w-48"><span class="field-label">{{ 'bank.rules.contains' | translate }}</span>
              <input class="input-field" maxlength="120" [(ngModel)]="text" [placeholder]="'bank.rules.containsPlaceholder' | translate" /></label>
            <label class="block"><span class="field-label">{{ 'bank.tx.direction' | translate }}</span>
              <select class="input-field" [(ngModel)]="direction">
                @for (d of directions; track d) { <option [value]="d">{{ ('bank.dir.' + d) | translate }}</option> }
              </select></label>
            <label class="block"><span class="field-label">{{ 'bank.tx.category' | translate }}</span>
              <select class="input-field" [(ngModel)]="category">
                <option value="">{{ 'bank.rules.pickCategory' | translate }}</option>
                @for (c of categories(); track c) { <option [value]="c">{{ label(c) }}</option> }
              </select></label>
            <button class="btn-primary" [disabled]="busy() || text.trim().length < 2 || !category" (click)="add()"><mat-icon>add</mat-icon>{{ 'bank.rules.add' | translate }}</button>
          </fieldset>
        </div>
      }

      <div class="table-card">
        <div class="overflow-x-auto">
          <table class="data-table">
            <thead><tr>
              <th>{{ 'bank.rules.contains' | translate }}</th>
              <th>{{ 'bank.tx.direction' | translate }}</th>
              <th>{{ 'bank.tx.category' | translate }}</th>
              <th class="col-actions"></th>
            </tr></thead>
            <tbody>
              @for (r of rules(); track r.id) {
                <tr>
                  <td class="cell-title break-words">“{{ r.containsText }}”</td>
                  <td class="cell-muted whitespace-nowrap">{{ ('bank.dir.' + r.direction) | translate }}</td>
                  <td><span class="chip">{{ label(r.category) }}</span></td>
                  <td class="col-actions">
                    @if (canWrite()) {
                      <button class="btn-ghost btn-sm" [disabled]="busy()" (click)="remove(r)">{{ 'bank.delete' | translate }}</button>
                    }
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="4" class="row-empty">
                  <app-empty-state icon="rule" [title]="'bank.rules.emptyTitle' | translate" [text]="'bank.rules.emptyText' | translate" />
                </td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
})
export class BankRulesComponent implements OnInit {
  private api = inject(BankApi);
  private toast = inject(ToastService);
  private i18n = inject(TranslationService);
  private state = inject(CrmStateService);
  private confirm = inject(ConfirmService);

  readonly directions: RuleDirection[] = ['ANY', 'IN', 'OUT'];

  rules = signal<BankRule[]>([]);
  categories = signal<string[]>([]);
  busy = signal(false);

  text = '';
  direction: RuleDirection = 'ANY';
  category = '';

  canWrite(): boolean { return this.state.hasAuthority('PAYMENTS_WRITE'); }

  ngOnInit(): void {
    this.load();
    this.api.categories().subscribe({ next: c => this.categories.set(c ?? []), error: e => this.fail(e) });
  }

  load(): void {
    this.api.rules().subscribe({ next: r => this.rules.set(r ?? []), error: e => this.fail(e) });
  }

  add(): void {
    this.busy.set(true);
    this.api.createRule({ containsText: this.text.trim(), direction: this.direction, category: this.category }).subscribe({
      next: () => {
        this.busy.set(false);
        this.text = '';
        this.category = '';
        this.direction = 'ANY';
        this.toast.show(this.i18n.t('bank.rules.added'), { type: 'success' });
        this.load();
      },
      error: e => this.fail(e),
    });
  }

  async remove(r: BankRule): Promise<void> {
    if (!(await this.confirm.ask({ title: this.i18n.t('bank.rules.confirmDelete', { text: r.containsText }), danger: true }))) return;
    this.busy.set(true);
    this.api.deleteRule(r.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.toast.show(this.i18n.t('bank.rules.deleted'), { type: 'success' });
        this.load();
      },
      error: e => this.fail(e),
    });
  }

  label(c: string | null | undefined): string { return categoryLabel(this.i18n, c); }

  private fail(e: unknown): void {
    this.busy.set(false);
    this.toast.show(errorDetail(e) || this.i18n.t('bank.error'), { type: 'error' });
  }
}
