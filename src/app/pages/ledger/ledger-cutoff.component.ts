import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { TranslationService } from '../../services/translation.service';
import { ToastService } from '../../services/toast.service';
import { CrmStateService } from '../../services/crm-state.service';
import { ConfirmService } from '../../shared/ui/confirm.service';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { LedgerApi } from '../../services/domains/ledger.service';
import { LedgerGroupsStore } from '../../services/domains/ledger-groups.store';
import { round2, vatCodeForRate, vatFraction } from '../../services/domains/vat';
import {
  ClosingApi, CutoffItem, CutoffLineRequest, CutoffType, PostedCutoff, lastMonthEnd, nextDay,
} from '../../services/domains/closing.service';
import { formatMoney, shortDate } from '../../shared/bank.util';
import { LedgerPickerComponent, PickerOption } from './ledger-picker.component';
import { errorDetail } from './ledger-labels';

interface Row {
  uid: number;
  type: CutoffType;
  accountId: string | null;
  partnerId?: string | null;
  partnerName?: string | null;
  label: string;
  base: number;
  vatCode: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
}

const TYPES: CutoffType[] = ['FNP', 'FAE', 'CCA', 'PCA'];
/** FNP and FAE carry VAT (3458 / 4458); CCA and PCA do not. */
const WITH_VAT = new Set<CutoffType>(['FNP', 'FAE']);
let nextUid = 0;

/**
 * General Ledger → Cut-off: the cut-off assistant. For a date it proposes FNP (goods received, bill
 * not yet received) and FAE (revenue earned, not yet invoiced); the user edits amounts and accounts,
 * removes lines, adds prepaid expenses (CCA) and revenue billed in advance (PCA), then posts one OD
 * entry and its reversal on the next day.
 */
@Component({
  selector: 'app-ledger-cutoff',
  imports: [FormsModule, MatIconModule, RouterLink, TranslatePipe, EmptyStateComponent, LedgerPickerComponent],
  template: `
    <div class="space-y-4">
      <div class="flex flex-wrap items-end gap-3">
        <label class="block"><span class="field-label">{{ 'ledger.cutoff.date' | translate }}</span>
          <input type="date" class="input-field" [ngModel]="date()" (ngModelChange)="setDate($event)" /></label>
        <p class="text-xs text-ink-3 pb-2 max-w-xl">{{ 'ledger.cutoff.hint' | translate }}</p>
      </div>

      @if (posted()?.entryId; as entryId) {
        <div class="alert alert-success text-sm flex flex-wrap items-center gap-2">
          <mat-icon>task_alt</mat-icon>
          <span class="me-auto">{{ 'ledger.cutoff.postedText' | translate: { date: fmt(date()), reversal: fmt(posted()?.reversalDate || next()) } }}</span>
          <a class="btn-ghost btn-sm" routerLink="/ledger" [queryParams]="{ tab: 'entries', entry: entryId }">{{ 'ledger.cutoff.entry' | translate }}</a>
          @if (posted()?.reversalEntryId; as rid) {
            <a class="btn-ghost btn-sm" routerLink="/ledger" [queryParams]="{ tab: 'entries', entry: rid }">{{ 'ledger.cutoff.reversal' | translate }}</a>
          }
          @if (canClose()) {
            <button class="btn-secondary btn-sm" [disabled]="busy()" (click)="cancelPosted()"><mat-icon>undo</mat-icon>{{ 'ledger.cutoff.cancel' | translate }}</button>
          }
        </div>
      }

      @for (t of types; track t) {
        <section class="table-card">
          <div class="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-line">
            <div class="min-w-0 me-auto">
              <h3 class="card-title">{{ t }} · {{ ('ledger.cutoff.type.' + t) | translate }}</h3>
              <p class="text-xs text-ink-3">{{ ('ledger.cutoff.typeHint.' + t) | translate }}</p>
            </div>
            <span class="text-sm num text-ink">{{ money(groupTotal(t)) }}</span>
            @if ((t === 'CCA' || t === 'PCA') && editable()) {
              <button class="btn-ghost btn-sm" (click)="addLine(t)"><mat-icon>add</mat-icon>{{ 'ledger.cutoff.addLine' | translate }}</button>
            }
          </div>
          <div class="overflow-x-auto">
            <table class="data-table is-dense">
              <thead><tr>
                <th>{{ 'ledger.cutoff.label' | translate }}</th>
                <th>{{ 'ledger.account' | translate }}</th>
                <th class="col-num">{{ 'ledger.cutoff.base' | translate }}</th>
                @if (withVat(t)) {
                  <th>{{ 'ledger.vat.code' | translate }}</th>
                  <th class="col-num">{{ 'ledger.vat.vat' | translate }}</th>
                }
                <th class="col-actions"></th>
              </tr></thead>
              <tbody>
                @for (r of rowsOf(t); track r.uid) {
                  <tr>
                    <td class="min-w-56">
                      <input class="input-field w-full" maxlength="255" [disabled]="!editable()" [ngModel]="r.label" (ngModelChange)="patch(r, { label: $event })"
                             [attr.aria-label]="'ledger.cutoff.label' | translate" />
                      @if (r.partnerName) { <div class="cell-sub">{{ r.partnerName }}</div> }
                    </td>
                    <td class="min-w-56">
                      <app-ledger-picker [items]="accountOptions()" [value]="r.accountId" (valueChange)="patch(r, { accountId: $event })"
                                         [disabled]="!editable()" [placeholder]="'ledger.cutoff.pickAccount' | translate" [ariaLabel]="'ledger.account' | translate" />
                    </td>
                    <td class="col-num min-w-32">
                      <input type="number" step="0.01" min="0" class="input-field w-full text-end" [disabled]="!editable()"
                             [ngModel]="r.base" (ngModelChange)="patch(r, { base: +$event || 0 })" [attr.aria-label]="'ledger.cutoff.base' | translate" />
                    </td>
                    @if (withVat(t)) {
                      <td class="min-w-32">
                        <select class="input-field" [disabled]="!editable()" [ngModel]="r.vatCode ?? ''" (ngModelChange)="patch(r, { vatCode: $event || null })"
                                [attr.aria-label]="'ledger.vat.code' | translate">
                          <option value="">—</option>
                          @for (c of groups.vatCodes(); track c.code) { <option [value]="c.code">{{ groups.vatLabel(c.code) }}</option> }
                        </select>
                      </td>
                      <td class="col-num num whitespace-nowrap">{{ money(vatOf(r)) }}</td>
                    }
                    <td class="col-actions">
                      @if (editable()) {
                        <button class="btn-icon btn-sm" (click)="remove(r)" [attr.aria-label]="'ledger.cutoff.remove' | translate"><mat-icon class="icon-sm">delete</mat-icon></button>
                      }
                    </td>
                  </tr>
                } @empty {
                  <tr><td [attr.colspan]="withVat(t) ? 6 : 4" class="row-empty text-sm text-ink-3">{{ 'ledger.cutoff.noLine' | translate }}</td></tr>
                }
              </tbody>
            </table>
          </div>
        </section>
      }

      @if (!rows().length && !loading()) {
        <app-empty-state icon="content_cut" [title]="'ledger.cutoff.emptyTitle' | translate" [text]="'ledger.cutoff.emptyText' | translate" />
      }

      @if (editable() && canClose()) {
        <div class="card">
          <div class="card-body flex flex-wrap items-center gap-3">
            <div class="text-sm text-ink-2 me-auto">
              {{ 'ledger.cutoff.summary' | translate: { n: validRows().length, date: fmt(date()) } }}
              <div class="text-xs text-ink-3">{{ 'ledger.cutoff.reversalNote' | translate: { date: fmt(next()) } }}</div>
              @if (invalidCount()) { <div class="text-xs text-danger-ink">{{ 'ledger.cutoff.missingAccount' | translate: { n: invalidCount() } }}</div> }
            </div>
            <button class="btn-primary" [disabled]="busy() || !validRows().length || invalidCount() > 0" (click)="post()">
              <mat-icon>task_alt</mat-icon>{{ 'ledger.cutoff.post' | translate }}</button>
          </div>
        </div>
      }
    </div>
  `,
})
export class LedgerCutoffComponent implements OnInit {
  private api = inject(ClosingApi);
  private ledger = inject(LedgerApi);
  private toast = inject(ToastService);
  private i18n = inject(TranslationService);
  private state = inject(CrmStateService);
  private confirm = inject(ConfirmService);
  private route = inject(ActivatedRoute);
  groups = inject(LedgerGroupsStore);

  readonly types = TYPES;

  date = signal(lastMonthEnd());
  rows = signal<Row[]>([]);
  posted = signal<PostedCutoff | null>(null);
  accountOptions = signal<PickerOption[]>([]);
  loading = signal(false);
  busy = signal(false);

  next = computed(() => nextDay(this.date()));
  /** Lines can be edited until the cut-off of the date is posted. */
  editable = computed(() => !this.posted()?.entryId);
  validRows = computed(() => this.rows().filter(r => r.base > 0));
  invalidCount = computed(() => this.validRows().filter(r => !r.accountId).length);

  canClose(): boolean { return this.state.hasAuthority('LEDGER_CLOSE'); }

  ngOnInit(): void {
    this.groups.ensure();
    const d = this.route.snapshot.queryParamMap.get('date');
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) this.date.set(d);
    this.ledger.accounts().subscribe({
      next: list => this.accountOptions.set((list ?? []).filter(a => a.active).map(a => ({ id: a.id, code: a.code, label: a.name }))),
      error: () => undefined,
    });
    this.load();
  }

  setDate(d: string): void {
    if (!d) return;
    this.date.set(d);
    this.load();
  }

  load(): void {
    const date = this.date();
    this.loading.set(true);
    forkJoin({
      proposals: this.api.cutoffProposals(date).pipe(catchError(e => { this.fail(e); return of(null); })),
      posted: this.api.cutoff(date).pipe(catchError(() => of(null))),
    }).subscribe(r => {
      this.loading.set(false);
      this.posted.set(r.posted);
      const p = r.proposals;
      const codes = this.groups.vatCodes();
      const toRows = (type: CutoffType, list: CutoffItem[] | null | undefined): Row[] => (list ?? []).map(i => {
        const base = Number(i.base) || 0;
        const vat = Number(i.vat) || 0;
        const vatCode = i.vatCode || (WITH_VAT.has(type) && base && vat ? vatCodeForRate(codes, vat / base) : null);
        return {
          uid: ++nextUid, type, accountId: i.accountId ?? null, partnerId: i.partnerId, partnerName: i.partnerName,
          label: i.label ?? '', base, vatCode, sourceType: i.sourceType, sourceId: i.sourceId,
        };
      });
      this.rows.set(p ? [...toRows('FNP', p.fnp), ...toRows('FAE', p.fae), ...toRows('CCA', p.cca), ...toRows('PCA', p.pca)] : []);
    });
  }

  withVat(t: CutoffType): boolean { return WITH_VAT.has(t); }
  rowsOf(t: CutoffType): Row[] { return this.rows().filter(r => r.type === t); }

  vatOf(r: Row): number {
    return WITH_VAT.has(r.type) ? round2(r.base * vatFraction(this.groups.vatCodes(), r.vatCode)) : 0;
  }

  groupTotal(t: CutoffType): number {
    return round2(this.rowsOf(t).reduce((s, r) => s + r.base + this.vatOf(r), 0));
  }

  patch(r: Row, change: Partial<Row>): void {
    this.rows.update(list => list.map(x => (x.uid === r.uid ? { ...x, ...change } : x)));
  }

  remove(r: Row): void {
    this.rows.update(list => list.filter(x => x.uid !== r.uid));
  }

  addLine(type: CutoffType): void {
    this.rows.update(list => [...list, { uid: ++nextUid, type, accountId: null, label: '', base: 0, vatCode: null }]);
  }

  async post(): Promise<void> {
    const rows = this.validRows();
    const ok = await this.confirm.ask({
      title: this.i18n.t('ledger.cutoff.postTitle', { date: this.fmt(this.date()) }),
      message: this.i18n.t('ledger.cutoff.postText', { n: rows.length, date: this.fmt(this.date()), reversal: this.fmt(this.next()) }),
      confirmLabel: this.i18n.t('ledger.cutoff.post'),
    });
    if (!ok) return;
    const lines: CutoffLineRequest[] = rows.map(r => {
      const l: CutoffLineRequest = { type: r.type, accountId: r.accountId!, base: round2(r.base), label: r.label.trim() || this.i18n.t('ledger.cutoff.type.' + r.type) };
      if (r.partnerId) l.partnerId = r.partnerId;
      if (WITH_VAT.has(r.type) && r.vatCode) l.vatCode = r.vatCode;
      if (r.sourceType) l.sourceType = r.sourceType;
      if (r.sourceId) l.sourceId = r.sourceId;
      return l;
    });
    this.busy.set(true);
    this.api.postCutoff(this.date(), lines).subscribe({
      next: () => { this.busy.set(false); this.toast.show(this.i18n.t('ledger.cutoff.posted'), { type: 'success' }); this.load(); },
      error: e => this.fail(e),
    });
  }

  async cancelPosted(): Promise<void> {
    const ok = await this.confirm.ask({
      title: this.i18n.t('ledger.cutoff.cancelTitle'),
      message: this.i18n.t('ledger.closing.reverseText'),
      confirmLabel: this.i18n.t('ledger.cutoff.cancel'),
      danger: true,
    });
    if (!ok) return;
    this.busy.set(true);
    this.api.deleteCutoff(this.date()).subscribe({
      next: () => { this.busy.set(false); this.load(); },
      error: e => this.fail(e),
    });
  }

  money(v: number | null | undefined): string { return formatMoney(v); }
  fmt(iso: string | null | undefined): string { return iso ? shortDate(iso) : '—'; }

  private fail(e: unknown): void {
    this.busy.set(false);
    this.toast.show(errorDetail(e) || this.i18n.t('ledger.closing.error'), { type: 'error' });
  }
}
