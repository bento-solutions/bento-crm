import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { TranslationService } from '../../services/translation.service';
import { ToastService } from '../../services/toast.service';
import { CrmStateService } from '../../services/crm-state.service';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { PaginatorComponent } from '../../shared/paginator.component';
import {
  CostCenter, Entry, EntryFilter, Journal, LedgerAccount, LedgerApi,
} from '../../services/domains/ledger.service';
import { formatMoney, shortDate } from '../../shared/bank.util';
import { canPostEntry, defaultPeriod, entryTotals, isoDate, lineError, toAmount } from '../../shared/ledger.util';
import { LedgerPickerComponent, PickerOption } from './ledger-picker.component';
import { errorDetail, sideAmount, sourceLabel } from './ledger-labels';

/** Journals a manual entry may be posted in. */
const MANUAL_KINDS = ['MISC', 'OPENING'];

interface DraftLine {
  key: number;
  accountId: string | null;
  partnerId: string | null;
  costCenterId: string | null;
  label: string;
  debit: number | null;
  credit: number | null;
}

interface EntryForm {
  journalId: string | null;
  entryDate: string;
  description: string;
}

interface ReverseForm {
  entry: Entry;
  entryDate: string;
  description: string;
}

/**
 * General Ledger → Journal entries: the posted entries, filtered and paged; one opens in a side
 * panel with its lines and can be reversed. Manual entries (OD, AN) are typed in a modal that only
 * saves once debit equals credit. Entries are never edited or deleted.
 */
@Component({
  selector: 'app-ledger-entries',
  imports: [FormsModule, MatIconModule, TranslatePipe, EmptyStateComponent, PaginatorComponent, LedgerPickerComponent],
  template: `
    <div class="space-y-4">
      <div class="flex flex-wrap items-end gap-3">
        <label class="block"><span class="field-label">{{ 'ledger.journal' | translate }}</span>
          <select class="input-field" [ngModel]="filter().journalId ?? ''" (ngModelChange)="setFilter({ journalId: $event || null })">
            <option value="">{{ 'ledger.allJournals' | translate }}</option>
            @for (j of journals(); track j.id) { <option [value]="j.id">{{ j.code }} · {{ j.name }}</option> }
          </select></label>
        <label class="block"><span class="field-label">{{ 'ledger.from' | translate }}</span>
          <input type="date" class="input-field" [ngModel]="filter().from ?? ''" (ngModelChange)="setFilter({ from: $event || null })" /></label>
        <label class="block"><span class="field-label">{{ 'ledger.to' | translate }}</span>
          <input type="date" class="input-field" [ngModel]="filter().to ?? ''" (ngModelChange)="setFilter({ to: $event || null })" /></label>
        <div class="block w-64 max-w-full"><span class="field-label">{{ 'ledger.account' | translate }}</span>
          <app-ledger-picker [items]="accountOptions()" [value]="filter().accountId ?? null" (valueChange)="setFilter({ accountId: $event })"
                             [allowClear]="true" [clearLabel]="'ledger.allAccounts' | translate" [placeholder]="'ledger.allAccounts' | translate"
                             [emptyLabel]="'ledger.noMatch' | translate" [ariaLabel]="'ledger.account' | translate" /></div>
        <label class="block"><span class="field-label">{{ 'ledger.search' | translate }}</span>
          <input class="input-field w-56 max-w-full" type="search" [placeholder]="'ledger.entries.searchHint' | translate" [ngModel]="q()"
                 (ngModelChange)="q.set($event)" (keyup.enter)="applySearch()" (blur)="applySearch()" /></label>
        <div class="flex gap-2 ms-auto">
          <button class="btn-ghost" (click)="resetFilter()">{{ 'ledger.reset' | translate }}</button>
          @if (canWrite()) {
            <button class="btn-primary" (click)="openNew()"><mat-icon>add</mat-icon>{{ 'ledger.entries.new' | translate }}</button>
          }
        </div>
      </div>

      <div class="table-card">
        <div class="overflow-x-auto">
          <table class="data-table">
            <thead><tr>
              <th>{{ 'ledger.entries.number' | translate }}</th>
              <th>{{ 'ledger.date' | translate }}</th>
              <th>{{ 'ledger.journal' | translate }}</th>
              <th>{{ 'ledger.description' | translate }}</th>
              <th class="col-num">{{ 'ledger.amount' | translate }}</th>
              <th>{{ 'ledger.entries.source' | translate }}</th>
            </tr></thead>
            <tbody>
              @for (e of entries(); track e.id) {
                <tr [class.is-selected]="selected()?.id === e.id">
                  <td class="whitespace-nowrap">
                    <button type="button" class="num cell-title hover:underline" (click)="select(e)">{{ e.number }}</button>
                  </td>
                  <td class="cell-muted whitespace-nowrap">{{ date(e.entryDate) }}</td>
                  <td class="whitespace-nowrap"><span class="chip">{{ e.journalCode }}</span></td>
                  <td class="max-w-80">
                    <div class="text-ink truncate">{{ e.description || '—' }}</div>
                    @if (e.reversedById) { <span class="badge badge-warning mt-0.5">{{ 'ledger.entries.reversed' | translate }}</span> }
                    @if (e.reversalOfId) { <span class="badge badge-neutral mt-0.5">{{ 'ledger.entries.reversal' | translate }}</span> }
                  </td>
                  <td class="col-num num whitespace-nowrap font-medium">{{ money(e.totalDebit) }}</td>
                  <td class="cell-muted whitespace-nowrap">
                    {{ source(e.sourceType) }}
                    @if (e.sourceLabel) { <div class="cell-sub truncate max-w-48">{{ e.sourceLabel }}</div> }
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="6" class="row-empty">
                  <app-empty-state icon="receipt_long" [title]="(loading() ? 'ledger.loading' : 'ledger.entries.emptyTitle') | translate"
                                   [text]="loading() ? '' : ('ledger.entries.emptyText' | translate)" />
                </td></tr>
              }
            </tbody>
          </table>
        </div>
        @if (total() > 0) {
          <app-paginator [currentPage]="page() + 1" [totalPages]="totalPages()" [pageSize]="size()" [label]="'ledger.entries.perPage' | translate"
                         (pageChange)="goPage($event - 1)" (pageSizeChange)="setSize($event)" />
        }
      </div>
    </div>

    <!-- One entry -->
    @if (selected(); as e) {
      <aside class="drawer-panel" role="dialog" aria-modal="false" aria-labelledby="ledger-entry-title">
        <header class="flex items-start justify-between gap-2 px-5 py-4 border-b border-line shrink-0">
          <div class="min-w-0">
            <h2 id="ledger-entry-title" class="section-title num">{{ e.number }}</h2>
            <p class="text-xs text-ink-3">{{ date(e.entryDate) }} · {{ journalName(e) }}</p>
          </div>
          <button class="btn-icon btn-sm shrink-0" (click)="close()" [attr.aria-label]="'ledger.close' | translate"><mat-icon class="icon-sm">close</mat-icon></button>
        </header>

        <div class="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <p class="text-sm text-ink break-words">{{ e.description || '—' }}</p>
          <dl class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <dt class="text-ink-3">{{ 'ledger.entries.source' | translate }}</dt>
            <dd class="text-ink break-words">{{ source(e.sourceType) }}@if (e.sourceLabel) { · {{ e.sourceLabel }} }</dd>
            <dt class="text-ink-3">{{ 'ledger.entries.postedBy' | translate }}</dt><dd class="text-ink">{{ e.postedBy || '—' }}</dd>
            <dt class="text-ink-3">{{ 'ledger.entries.postedOn' | translate }}</dt><dd class="text-ink">{{ date(e.createdAt) }}</dd>
          </dl>
          @if (e.reversedById) {
            <div class="alert alert-warning text-sm flex flex-wrap items-center gap-2">
              <span>{{ 'ledger.entries.reversedText' | translate }}</span>
              <button class="btn-ghost btn-sm" (click)="openById(e.reversedById)">{{ 'ledger.entries.openReversal' | translate }}</button>
            </div>
          }
          @if (e.reversalOfId) {
            <div class="alert alert-info text-sm flex flex-wrap items-center gap-2">
              <span>{{ 'ledger.entries.reversalText' | translate }}</span>
              <button class="btn-ghost btn-sm" (click)="openById(e.reversalOfId)">{{ 'ledger.entries.openOriginal' | translate }}</button>
            </div>
          }

          <div class="table-card">
            <div class="overflow-x-auto">
              <table class="data-table is-dense">
                <thead><tr>
                  <th>{{ 'ledger.account' | translate }}</th>
                  <th>{{ 'ledger.label' | translate }}</th>
                  <th class="col-num">{{ 'ledger.debit' | translate }}</th>
                  <th class="col-num">{{ 'ledger.credit' | translate }}</th>
                </tr></thead>
                <tbody>
                  @for (l of e.lines ?? []; track l.id) {
                    <tr>
                      <td class="min-w-40">
                        <div class="text-ink"><span class="num">{{ l.accountCode }}</span> · {{ l.accountName }}</div>
                        @if (l.partnerName || l.costCenterCode) {
                          <div class="cell-sub">{{ l.partnerName }}@if (l.partnerName && l.costCenterCode) { · }@if (l.costCenterCode) { {{ 'ledger.costCenterShort' | translate }} {{ l.costCenterCode }} }</div>
                        }
                      </td>
                      <td class="cell-muted">{{ l.label || '—' }}</td>
                      <td class="col-num num whitespace-nowrap">{{ side(l.debit) }}</td>
                      <td class="col-num num whitespace-nowrap">{{ side(l.credit) }}</td>
                    </tr>
                  }
                  <tr class="bg-subtle">
                    <td colspan="2" class="font-medium text-ink">{{ 'ledger.total' | translate }}</td>
                    <td class="col-num num whitespace-nowrap font-medium">{{ money(e.totalDebit) }}</td>
                    <td class="col-num num whitespace-nowrap font-medium">{{ money(e.totalCredit) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          @if (canWrite() && !e.reversedById && !e.reversalOfId) {
            <div class="flex justify-end">
              <button class="btn-secondary btn-sm" [disabled]="busy()" (click)="openReverse(e)"><mat-icon>undo</mat-icon>{{ 'ledger.entries.reverse' | translate }}</button>
            </div>
          }
        </div>
      </aside>
    }

    <!-- New manual entry -->
    @if (form(); as f) {
      <div class="modal-backdrop">
        <div class="modal modal-3xl" role="dialog" aria-modal="true" aria-labelledby="ledger-new-title">
          <div class="modal-header">
            <div class="min-w-0">
              <h3 id="ledger-new-title" class="modal-title">{{ 'ledger.entries.new' | translate }}</h3>
              <p class="modal-subtitle">{{ 'ledger.entries.newHint' | translate }}</p>
            </div>
            <button class="btn-icon btn-sm" (click)="form.set(null)" [attr.aria-label]="'ledger.cancel' | translate"><mat-icon class="icon-sm">close</mat-icon></button>
          </div>

          <fieldset class="grid grid-cols-1 sm:grid-cols-4 gap-3" [disabled]="busy()">
            <label class="block"><span class="field-label">{{ 'ledger.journal' | translate }}</span>
              <select class="input-field" [(ngModel)]="f.journalId">
                @for (j of manualJournals(); track j.id) { <option [ngValue]="j.id">{{ j.code }} · {{ j.name }}</option> }
              </select></label>
            <label class="block"><span class="field-label">{{ 'ledger.date' | translate }}</span>
              <input type="date" class="input-field" [(ngModel)]="f.entryDate" /></label>
            <label class="block sm:col-span-2"><span class="field-label">{{ 'ledger.description' | translate }}</span>
              <input class="input-field" maxlength="255" [(ngModel)]="f.description" /></label>
          </fieldset>

          <div class="space-y-2">
            <div class="hidden lg:grid grid-cols-12 gap-2 pe-10 text-xs font-medium text-ink-3">
              <span class="col-span-3">{{ 'ledger.account' | translate }}</span>
              <span class="col-span-2">{{ 'ledger.partner' | translate }}</span>
              <span class="col-span-1">{{ 'ledger.costCenterShort' | translate }}</span>
              <span class="col-span-2">{{ 'ledger.label' | translate }}</span>
              <span class="col-span-2 text-end">{{ 'ledger.debit' | translate }}</span>
              <span class="col-span-2 text-end">{{ 'ledger.credit' | translate }}</span>
            </div>
            @for (l of lines(); track l.key; let i = $index) {
              <div class="flex items-start gap-2 border-b border-line pb-2 lg:border-0 lg:pb-0">
                <div class="grid grid-cols-2 lg:grid-cols-12 gap-2 flex-1 min-w-0">
                  <div class="col-span-2 lg:col-span-3"><span class="field-label lg:sr-only">{{ 'ledger.account' | translate }}</span>
                    <app-ledger-picker [items]="accountOptions()" [value]="l.accountId" (valueChange)="patch(i, { accountId: $event })"
                                       [placeholder]="'ledger.entries.pickAccount' | translate" [emptyLabel]="'ledger.noMatch' | translate"
                                       [ariaLabel]="'ledger.account' | translate" [disabled]="busy()" /></div>
                  <div class="col-span-2 sm:col-span-1 lg:col-span-2"><span class="field-label lg:sr-only">{{ 'ledger.partner' | translate }}</span>
                    <app-ledger-picker [items]="partnerOptions()" [value]="l.partnerId" (valueChange)="patch(i, { partnerId: $event })"
                                       [allowClear]="true" [placeholder]="'ledger.optional' | translate" [emptyLabel]="'ledger.noMatch' | translate"
                                       [ariaLabel]="'ledger.partner' | translate" [disabled]="busy()" /></div>
                  <label class="col-span-2 sm:col-span-1 lg:col-span-1 block"><span class="field-label lg:sr-only">{{ 'ledger.costCenter' | translate }}</span>
                    <select class="input-field" [disabled]="busy()" [ngModel]="l.costCenterId" (ngModelChange)="patch(i, { costCenterId: $event })">
                      <option [ngValue]="null">—</option>
                      @for (c of costCenters(); track c.id) { <option [ngValue]="c.id">{{ c.code }} · {{ c.name }}</option> }
                    </select></label>
                  <label class="col-span-2 lg:col-span-2 block"><span class="field-label lg:sr-only">{{ 'ledger.label' | translate }}</span>
                    <input class="input-field" maxlength="255" [disabled]="busy()" [ngModel]="l.label" (ngModelChange)="patch(i, { label: $event })"
                           [placeholder]="f.description" /></label>
                  <label class="block lg:col-span-2"><span class="field-label lg:sr-only">{{ 'ledger.debit' | translate }}</span>
                    <input type="number" min="0" step="0.01" inputmode="decimal" class="input-field num text-end" [disabled]="busy()"
                           [ngModel]="l.debit" (ngModelChange)="patch(i, { debit: $event })" /></label>
                  <label class="block lg:col-span-2"><span class="field-label lg:sr-only">{{ 'ledger.credit' | translate }}</span>
                    <input type="number" min="0" step="0.01" inputmode="decimal" class="input-field num text-end" [disabled]="busy()"
                           [ngModel]="l.credit" (ngModelChange)="patch(i, { credit: $event })" /></label>
                  @if (lineIssue(l); as issue) {
                    <p class="col-span-2 lg:col-span-12 text-xs text-danger-ink">{{ ('ledger.entries.lineError.' + issue) | translate }}</p>
                  }
                </div>
                <button class="btn-icon btn-sm mt-6 lg:mt-0 shrink-0" [disabled]="busy() || lines().length <= 2" (click)="removeLine(i)"
                        [attr.aria-label]="'ledger.entries.removeLine' | translate"><mat-icon class="icon-sm">delete</mat-icon></button>
              </div>
            }
            <button class="btn-ghost btn-sm" [disabled]="busy()" (click)="addLine()"><mat-icon>add</mat-icon>{{ 'ledger.entries.addLine' | translate }}</button>
          </div>

          <div class="flex flex-wrap items-center justify-end gap-x-6 gap-y-1 text-sm border-t border-line pt-3">
            <span class="text-ink-3">{{ 'ledger.debit' | translate }} <span class="num text-ink font-medium">{{ money(totals().debit) }}</span></span>
            <span class="text-ink-3">{{ 'ledger.credit' | translate }} <span class="num text-ink font-medium">{{ money(totals().credit) }}</span></span>
            <span class="text-ink-3">{{ 'ledger.entries.difference' | translate }}
              <span class="num font-medium" [class.text-danger-ink]="totals().difference !== 0" [class.text-success-ink]="totals().difference === 0">{{ money(totals().difference) }}</span></span>
          </div>

          <div class="modal-footer">
            <button class="btn-secondary" (click)="form.set(null)">{{ 'ledger.cancel' | translate }}</button>
            <button class="btn-primary" [disabled]="busy() || !canSave()" (click)="save(f)">{{ 'ledger.entries.post' | translate }}</button>
          </div>
        </div>
      </div>
    }

    <!-- Reverse -->
    @if (reverseForm(); as r) {
      <div class="modal-backdrop">
        <div class="modal modal-md" role="dialog" aria-modal="true" aria-labelledby="ledger-reverse-title">
          <div class="modal-header">
            <div class="min-w-0">
              <h3 id="ledger-reverse-title" class="modal-title">{{ 'ledger.entries.reverseTitle' | translate: { number: r.entry.number } }}</h3>
              <p class="modal-subtitle">{{ 'ledger.entries.reverseHint' | translate }}</p>
            </div>
            <button class="btn-icon btn-sm" (click)="reverseForm.set(null)" [attr.aria-label]="'ledger.cancel' | translate"><mat-icon class="icon-sm">close</mat-icon></button>
          </div>
          <fieldset class="space-y-3" [disabled]="busy()">
            <label class="block"><span class="field-label">{{ 'ledger.date' | translate }}</span>
              <input type="date" class="input-field" [(ngModel)]="r.entryDate" /></label>
            <label class="block"><span class="field-label">{{ 'ledger.description' | translate }}</span>
              <input class="input-field" maxlength="255" [(ngModel)]="r.description" [placeholder]="'ledger.entries.reverseDefault' | translate: { number: r.entry.number }" /></label>
          </fieldset>
          <div class="modal-footer">
            <button class="btn-secondary" (click)="reverseForm.set(null)">{{ 'ledger.cancel' | translate }}</button>
            <button class="btn-danger" [disabled]="busy() || !r.entryDate" (click)="reverse(r)">{{ 'ledger.entries.reverse' | translate }}</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class LedgerEntriesComponent implements OnInit {
  private api = inject(LedgerApi);
  private toast = inject(ToastService);
  private i18n = inject(TranslationService);
  private state = inject(CrmStateService);

  /** An entry to open on arrival (from the general ledger). */
  openEntryId = input<string | null>(null);

  filter = signal<EntryFilter>({ ...defaultPeriod() });
  q = signal('');
  journals = signal<Journal[]>([]);
  accounts = signal<LedgerAccount[]>([]);
  costCenters = signal<CostCenter[]>([]);
  entries = signal<Entry[]>([]);
  loading = signal(true);
  total = signal(0);
  totalPages = signal(1);
  page = signal(0);
  size = signal(20);
  busy = signal(false);
  selected = signal<Entry | null>(null);

  form = signal<EntryForm | null>(null);
  lines = signal<DraftLine[]>([]);
  reverseForm = signal<ReverseForm | null>(null);
  private nextKey = 1;

  manualJournals = computed(() => this.journals().filter(j => MANUAL_KINDS.includes(j.kind)));
  accountOptions = computed<PickerOption[]>(() => this.accounts().map(a => ({ id: a.id, code: a.code, label: a.name })));
  partnerOptions = computed<PickerOption[]>(() =>
    this.state.partners().map(p => ({ id: p.id, label: p.name, hint: p.type })).sort((a, b) => a.label.localeCompare(b.label)));
  totals = computed(() => entryTotals(this.lines()));
  /** A method, not a computed: the form's fields are edited in place through ngModel, which a computed would not see. */
  canSave(): boolean {
    const f = this.form();
    return !!f && !!f.entryDate && !!f.description.trim() && canPostEntry(this.lines());
  }

  canWrite(): boolean { return this.state.hasAuthority('LEDGER_WRITE'); }

  ngOnInit(): void {
    this.api.journals().subscribe({ next: j => this.journals.set(j ?? []), error: e => this.fail(e) });
    this.api.accounts().subscribe({ next: a => this.accounts.set(a ?? []), error: e => this.fail(e) });
    this.api.costCenters().subscribe({ next: c => this.costCenters.set(c ?? []), error: () => { /* the picker stays empty */ } });
    this.load();
    const id = this.openEntryId();
    if (id) this.openById(id);
  }

  load(): void {
    this.loading.set(true);
    this.api.entries(this.filter(), this.page(), this.size()).subscribe({
      next: p => {
        this.entries.set(p.content ?? []);
        this.total.set(p.total_elements ?? (p.content ?? []).length);
        this.totalPages.set(Math.max(1, p.total_pages ?? 1));
        this.loading.set(false);
      },
      error: e => { this.loading.set(false); this.fail(e); },
    });
  }

  setFilter(patch: Partial<EntryFilter>): void {
    this.filter.update(f => ({ ...f, ...patch }));
    this.page.set(0);
    this.load();
  }

  applySearch(): void {
    const q = this.q().trim();
    if (q !== (this.filter().q ?? '')) this.setFilter({ q: q || null });
  }

  resetFilter(): void {
    this.filter.set({ ...defaultPeriod() });
    this.q.set('');
    this.page.set(0);
    this.load();
  }

  goPage(p: number): void {
    this.page.set(Math.max(0, p));
    this.load();
  }

  setSize(n: number): void {
    this.size.set(Number(n) || 20);
    this.page.set(0);
    this.load();
  }

  // Detail
  select(e: Entry): void {
    this.selected.set(e);
    this.openById(e.id);
  }

  /** Loads an entry in full (with its lines) into the side panel. */
  openById(id: string): void {
    this.api.entry(id).subscribe({
      next: full => this.selected.set(full),
      error: e => this.fail(e),
    });
  }

  close(): void {
    this.selected.set(null);
  }

  journalName(e: Entry): string {
    const j = this.journals().find(x => x.id === e.journalId);
    return j ? `${j.code} · ${j.name}` : e.journalCode;
  }

  // New entry
  openNew(): void {
    this.state.loadPartners();
    const od = this.manualJournals().find(j => j.kind === 'MISC') ?? this.manualJournals()[0];
    this.form.set({ journalId: od?.id ?? null, entryDate: isoDate(new Date()), description: '' });
    this.lines.set([this.blankLine(), this.blankLine()]);
  }

  private blankLine(): DraftLine {
    return { key: this.nextKey++, accountId: null, partnerId: null, costCenterId: null, label: '', debit: null, credit: null };
  }

  /** A new line starts with what is still missing on the other side, so two clicks balance an entry. */
  addLine(): void {
    const diff = this.totals().difference;
    const line = this.blankLine();
    if (diff > 0) line.credit = diff;
    else if (diff < 0) line.debit = -diff;
    this.lines.update(ls => [...ls, line]);
  }

  removeLine(i: number): void {
    this.lines.update(ls => ls.filter((_, j) => j !== i));
  }

  patch(i: number, p: Partial<DraftLine>): void {
    this.lines.update(ls => ls.map((l, j) => (j === i ? { ...l, ...p } : l)));
  }

  /** Only once something was typed on the line, so a fresh line is not shown as an error. */
  lineIssue(l: DraftLine): string | null {
    if (l.debit === null && l.credit === null) return null;
    const err = lineError(l);
    return err === 'none' && (l.debit === null || l.credit === null) ? null : err;
  }

  save(f: EntryForm): void {
    if (!this.canSave()) return;
    this.busy.set(true);
    this.api.createEntry({
      journalId: f.journalId,
      entryDate: f.entryDate,
      description: f.description.trim(),
      lines: this.lines().map(l => ({
        accountId: l.accountId as string,
        partnerId: l.partnerId,
        costCenterId: l.costCenterId,
        label: l.label.trim() || null,
        debit: toAmount(l.debit),
        credit: toAmount(l.credit),
      })),
    }).subscribe({
      next: created => {
        this.busy.set(false);
        this.form.set(null);
        this.toast.show(this.i18n.t('ledger.entries.posted', { number: created.number }), { type: 'success' });
        this.selected.set(created);
        this.load();
      },
      error: e => this.fail(e),
    });
  }

  // Reverse
  openReverse(e: Entry): void {
    this.reverseForm.set({ entry: e, entryDate: isoDate(new Date()), description: '' });
  }

  reverse(r: ReverseForm): void {
    this.busy.set(true);
    this.api.reverseEntry(r.entry.id, { entryDate: r.entryDate, description: r.description.trim() || null }).subscribe({
      next: created => {
        this.busy.set(false);
        this.reverseForm.set(null);
        this.toast.show(this.i18n.t('ledger.entries.reversedToast', { number: created.number }), { type: 'success' });
        this.selected.set(created);
        this.load();
      },
      error: e => this.fail(e),
    });
  }

  money(v: number | null | undefined): string { return formatMoney(v); }
  side(v: number | null | undefined): string { return sideAmount(v); }
  date(iso: string | null | undefined): string { return shortDate(iso); }
  source(s: string | null | undefined): string { return sourceLabel(this.i18n, s); }

  private fail(e: unknown): void {
    this.busy.set(false);
    this.toast.show(errorDetail(e) || this.i18n.t('ledger.error'), { type: 'error' });
  }
}
