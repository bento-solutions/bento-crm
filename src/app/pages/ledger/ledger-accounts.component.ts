import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { TranslationService } from '../../services/translation.service';
import { ToastService } from '../../services/toast.service';
import { CrmStateService } from '../../services/crm-state.service';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { ConfirmService } from '../../shared/ui/confirm.service';
import { LedgerAccount, LedgerApi } from '../../services/domains/ledger.service';
import { isValidAccountCode, matchesAccount } from '../../shared/ledger.util';
import { ACCOUNT_CLASSES, balanceText, errorDetail } from './ledger-labels';

interface AccountForm {
  id?: string;
  code: string;
  name: string;
}

interface ClassGroup {
  cls: number;
  accounts: LedgerAccount[];
}

/** General Ledger → Chart of accounts: the PCGE accounts by class, with their all-time balance. */
@Component({
  selector: 'app-ledger-accounts',
  imports: [FormsModule, MatIconModule, TranslatePipe, EmptyStateComponent],
  template: `
    <div class="space-y-4">
      <div class="flex flex-wrap items-end gap-3">
        <label class="block"><span class="field-label">{{ 'ledger.search' | translate }}</span>
          <input class="input-field w-56 max-w-full" type="search" [placeholder]="'ledger.accounts.searchHint' | translate"
                 [ngModel]="q()" (ngModelChange)="q.set($event)" /></label>
        <label class="block"><span class="field-label">{{ 'ledger.class' | translate }}</span>
          <select class="input-field" [ngModel]="cls()" (ngModelChange)="cls.set($event)">
            <option [ngValue]="null">{{ 'ledger.allClasses' | translate }}</option>
            @for (c of classes; track c) { <option [ngValue]="c">{{ c }} · {{ ('ledger.className.' + c) | translate }}</option> }
          </select></label>
        <label class="choice-row pb-2">
          <input type="checkbox" [ngModel]="showInactive()" (ngModelChange)="showInactive.set($event)" />
          <span class="text-sm text-ink">{{ 'ledger.showInactive' | translate }}</span>
        </label>
        @if (canWrite()) {
          <button class="btn-primary ms-auto" (click)="openForm()"><mat-icon>add</mat-icon>{{ 'ledger.accounts.add' | translate }}</button>
        }
      </div>

      <div class="table-card">
        <div class="overflow-x-auto">
          <table class="data-table">
            <thead><tr>
              <th>{{ 'ledger.code' | translate }}</th>
              <th>{{ 'ledger.accounts.name' | translate }}</th>
              <th>{{ 'ledger.accounts.kind' | translate }}</th>
              <th class="col-num">{{ 'ledger.balance' | translate }}</th>
              <th>{{ 'ledger.status' | translate }}</th>
              <th class="col-actions"></th>
            </tr></thead>
            <tbody>
              @for (g of groups(); track g.cls) {
                <tr class="bg-subtle">
                  <td colspan="6" class="text-xs font-medium text-ink-2">{{ 'ledger.classN' | translate: { n: g.cls } }} · {{ ('ledger.className.' + g.cls) | translate }}</td>
                </tr>
                @for (a of g.accounts; track a.id) {
                  <tr>
                    <td class="num cell-title whitespace-nowrap">{{ a.code }}</td>
                    <td class="min-w-48">
                      <div class="text-ink">{{ a.name }}</div>
                      @if (a.system) { <div class="cell-sub">{{ 'ledger.accounts.system' | translate }}</div> }
                    </td>
                    <td class="cell-muted whitespace-nowrap">{{ ('ledger.kind.' + a.kind) | translate }}</td>
                    <td class="col-num num whitespace-nowrap">{{ balance(a.balance) }}</td>
                    <td>
                      @if (a.active) { <span class="badge badge-success">{{ 'ledger.active' | translate }}</span> }
                      @else { <span class="badge badge-neutral">{{ 'ledger.inactive' | translate }}</span> }
                    </td>
                    <td class="col-actions">
                      @if (canWrite()) {
                        <button class="btn-ghost btn-sm" [disabled]="busy()" (click)="openForm(a)">{{ 'ledger.rename' | translate }}</button>
                        <button class="btn-ghost btn-sm" [disabled]="busy()" (click)="toggleActive(a)">{{ (a.active ? 'ledger.deactivate' : 'ledger.reactivate') | translate }}</button>
                        @if (!a.system) {
                          <button class="btn-ghost btn-sm" [disabled]="busy()" (click)="remove(a)">{{ 'ledger.delete' | translate }}</button>
                        }
                      }
                    </td>
                  </tr>
                }
              } @empty {
                <tr><td colspan="6" class="row-empty">
                  <app-empty-state icon="account_tree" [title]="(loading() ? 'ledger.loading' : 'ledger.accounts.emptyTitle') | translate"
                                   [text]="loading() ? '' : ('ledger.accounts.emptyText' | translate)" />
                </td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>

    @if (form(); as f) {
      <div class="modal-backdrop">
        <div class="modal modal-md" role="dialog" aria-modal="true" aria-labelledby="ledger-account-title">
          <div class="modal-header">
            <h3 id="ledger-account-title" class="modal-title">{{ (f.id ? 'ledger.accounts.renameTitle' : 'ledger.accounts.add') | translate }}</h3>
            <button class="btn-icon btn-sm" (click)="form.set(null)" [attr.aria-label]="'ledger.cancel' | translate"><mat-icon class="icon-sm">close</mat-icon></button>
          </div>
          <fieldset class="space-y-3" [disabled]="busy()">
            <label class="block"><span class="field-label">{{ 'ledger.code' | translate }}</span>
              <input class="input-field num" inputmode="numeric" maxlength="10" [disabled]="!!f.id" [(ngModel)]="f.code" />
              <span class="field-hint">{{ 'ledger.accounts.codeHint' | translate }}</span></label>
            <label class="block"><span class="field-label">{{ 'ledger.accounts.name' | translate }}</span>
              <input class="input-field" maxlength="200" [(ngModel)]="f.name" /></label>
          </fieldset>
          <div class="modal-footer">
            <button class="btn-secondary" (click)="form.set(null)">{{ 'ledger.cancel' | translate }}</button>
            <button class="btn-primary" [disabled]="busy() || !f.name.trim() || (!f.id && !validCode(f.code))" (click)="save(f)">{{ 'ledger.save' | translate }}</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class LedgerAccountsComponent implements OnInit {
  private api = inject(LedgerApi);
  private toast = inject(ToastService);
  private i18n = inject(TranslationService);
  private state = inject(CrmStateService);
  private confirm = inject(ConfirmService);

  readonly classes = ACCOUNT_CLASSES;

  accounts = signal<LedgerAccount[]>([]);
  loading = signal(true);
  busy = signal(false);
  q = signal('');
  cls = signal<number | null>(null);
  showInactive = signal(false);
  form = signal<AccountForm | null>(null);

  /** The accounts that pass the filters, grouped by class in code order. */
  groups = computed<ClassGroup[]>(() => {
    const q = this.q();
    const cls = this.cls();
    const inactive = this.showInactive();
    const list = this.accounts()
      .filter(a => (inactive || a.active) && (cls === null || a.accountClass === cls) && matchesAccount(a, q))
      .sort((a, b) => a.code.localeCompare(b.code));
    const out: ClassGroup[] = [];
    for (const a of list) {
      const last = out[out.length - 1];
      if (last && last.cls === a.accountClass) last.accounts.push(a);
      else out.push({ cls: a.accountClass, accounts: [a] });
    }
    return out;
  });

  canWrite(): boolean { return this.state.hasAuthority('LEDGER_WRITE'); }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.api.accounts(true).subscribe({
      next: a => { this.accounts.set(a ?? []); this.loading.set(false); },
      error: e => { this.loading.set(false); this.fail(e); },
    });
  }

  openForm(a?: LedgerAccount): void {
    this.form.set(a ? { id: a.id, code: a.code, name: a.name } : { code: '', name: '' });
  }

  validCode(code: string): boolean { return isValidAccountCode(code); }

  save(f: AccountForm): void {
    this.busy.set(true);
    const call = f.id
      ? this.api.updateAccount(f.id, { name: f.name.trim() })
      : this.api.createAccount({ code: f.code.trim(), name: f.name.trim() });
    call.subscribe({
      next: saved => {
        this.busy.set(false);
        this.form.set(null);
        this.toast.show(this.i18n.t(f.id ? 'ledger.accounts.renamed' : 'ledger.accounts.created'), { type: 'success' });
        this.upsert(saved);
      },
      error: e => this.fail(e),
    });
  }

  toggleActive(a: LedgerAccount): void {
    this.busy.set(true);
    this.api.updateAccount(a.id, { active: !a.active }).subscribe({
      next: saved => {
        this.busy.set(false);
        this.toast.show(this.i18n.t(saved.active ? 'ledger.accounts.reactivated' : 'ledger.accounts.deactivated'), { type: 'success' });
        this.upsert(saved);
      },
      error: e => this.fail(e),
    });
  }

  async remove(a: LedgerAccount): Promise<void> {
    const ok = await this.confirm.ask({
      title: this.i18n.t('ledger.accounts.confirmDelete', { code: a.code, name: a.name }),
      confirmLabel: this.i18n.t('ledger.delete'),
      danger: true,
    });
    if (!ok) return;
    this.busy.set(true);
    this.api.deleteAccount(a.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.toast.show(this.i18n.t('ledger.accounts.deleted'), { type: 'success' });
        this.accounts.update(list => list.filter(x => x.id !== a.id));
      },
      error: e => this.fail(e),
    });
  }

  balance(v: number | null | undefined): string { return balanceText(this.i18n, v); }

  private upsert(saved: LedgerAccount): void {
    this.accounts.update(list => (list.some(x => x.id === saved.id) ? list.map(x => (x.id === saved.id ? saved : x)) : [...list, saved]));
  }

  private fail(e: unknown): void {
    this.busy.set(false);
    this.toast.show(errorDetail(e) || this.i18n.t('ledger.error'), { type: 'error' });
  }
}
