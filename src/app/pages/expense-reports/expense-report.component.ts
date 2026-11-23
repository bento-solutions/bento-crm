import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { TranslationService } from '../../services/translation.service';
import { ToastService } from '../../services/toast.service';
import { CrmStateService } from '../../services/crm-state.service';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { ConfirmService } from '../../shared/ui/confirm.service';
import { AttachmentsComponent } from '../../shared/attachments.component';
import { LedgerEntryLinkComponent } from '../ledger/ledger-entry-link.component';
import {
  ExpenseReport, ExpenseReportInput, ExpenseReportLine, ExpenseReportLineInput, ExpenseReportsApi, ReimbursementMethod,
} from '../../services/domains/expense-reports.service';
import { ExpensesApi } from '../../services/domains/expenses.service';
import { BankAccount, BankApi } from '../../services/domains/bank.service';
import { LedgerGroupsStore } from '../../services/domains/ledger-groups.store';
import { round2, vatFraction } from '../../services/domains/vat';
import { formatMoney, shortDate } from '../../shared/bank.util';
import { errorDetail } from '../bank/bank-labels';
import { saveBlob, todayIso } from '../delivery-notes/delivery-note-labels';
import { DEFAULT_CATEGORIES } from '../finance-expenses.component';
import { expenseReportBadge } from './expense-report-labels';

const OTHER_EMPLOYEE = '__other';

interface HeaderForm {
  /** An org user's id, or OTHER_EMPLOYEE for a name typed by hand. */
  employeeChoice: string;
  employeeName: string;
  title: string;
  periodFrom: string;
  periodTo: string;
  costCenterId: string | null;
  notes: string;
}

interface LineForm {
  id?: string;
  expenseDate: string;
  category: string;
  description: string;
  vendorName: string;
  reference: string;
  amount: number | null;
  vatCode: string | null;
  vatAmount: number | null;
  costCenterId: string | null;
}

interface ReimburseForm {
  date: string;
  method: ReimbursementMethod;
  bankAccountId: string | null;
}

function monthBounds(): { from: string; to: string } {
  const d = new Date();
  const iso = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  return { from: iso(new Date(d.getFullYear(), d.getMonth(), 1)), to: iso(new Date(d.getFullYear(), d.getMonth() + 1, 0)) };
}

/**
 * One expense report (note de frais): the employee and period, its lines (each an expense with its
 * receipts), totals, and the post → reimburse flow. /finance/expense-reports/new starts a new one.
 */
@Component({
  selector: 'app-expense-report',
  imports: [FormsModule, MatIconModule, TranslatePipe, PageHeaderComponent, EmptyStateComponent, AttachmentsComponent, LedgerEntryLinkComponent],
  template: `
    <div class="page">
      <app-page-header [title]="pageTitle()" [subtitle]="report()?.title || ('expenseReports.subtitle' | translate)"
                       backLink="/finance/expense-reports" [backLabel]="'expenseReports.back' | translate">
        @if (report(); as r) {
          <span meta class="badge" [class]="badge(r.status)">{{ ('expenseReports.statusName.' + r.status) | translate }}</span>
        }
        <div actions class="flex flex-wrap gap-2">
          @if (report(); as r) {
            @if (r.status === 'DRAFT' && canWrite()) {
              <button class="btn-ghost" [disabled]="busy()" (click)="cancelReport()">{{ 'expenseReports.cancelReport' | translate }}</button>
              <button class="btn-secondary" [disabled]="busy() || !headerValid()" (click)="saveHeader()"><mat-icon>save</mat-icon>{{ 'expenseReports.save' | translate }}</button>
              <button class="btn-primary" [disabled]="busy() || !headerValid() || !r.lines.length" (click)="post()"
                      [attr.title]="r.lines.length ? null : ('expenseReports.postNeedsLines' | translate)"><mat-icon>task_alt</mat-icon>{{ 'expenseReports.post' | translate }}</button>
            }
            @if (r.status === 'POSTED' && canWrite()) {
              <button class="btn-secondary" [disabled]="busy()" (click)="unpost()"><mat-icon>undo</mat-icon>{{ 'expenseReports.unpost' | translate }}</button>
              <button class="btn-primary" [disabled]="busy()" (click)="openReimburse()"><mat-icon>payments</mat-icon>{{ 'expenseReports.reimburse' | translate }}</button>
            }
            @if (r.status === 'POSTED' || r.status === 'REIMBURSED') {
              <button class="btn-secondary" [disabled]="busy()" (click)="downloadPdf(r)"><mat-icon>picture_as_pdf</mat-icon>{{ 'expenseReports.pdf' | translate }}</button>
            }
          } @else if (canWrite()) {
            <button class="btn-primary" [disabled]="busy() || !headerValid()" (click)="saveHeader()"><mat-icon>save</mat-icon>{{ 'expenseReports.create' | translate }}</button>
          }
        </div>
      </app-page-header>

      <p class="text-sm text-ink-2 flex items-start gap-2 mb-4">
        <mat-icon class="icon-sm text-ink-3 shrink-0">info</mat-icon>{{ 'expenseReports.help' | translate }}
      </p>

      @if (loadError()) {
        <app-empty-state icon="error_outline" [title]="'expenseReports.notFound' | translate" [text]="loadError()!" />
      } @else {
        <section class="card mb-4">
          <div class="card-header"><h2 class="card-title">{{ 'expenseReports.header' | translate }}</h2></div>
          <fieldset class="card-body grid gap-3 sm:grid-cols-2 lg:grid-cols-3" [disabled]="!editable()">
            <label class="block"><span class="field-label">{{ 'expenseReports.employee' | translate }} *</span>
              <select class="input-field w-full" [ngModel]="head().employeeChoice" (ngModelChange)="pickEmployee($event)">
                <option value="">{{ 'expenseReports.pickEmployee' | translate }}</option>
                @for (u of users(); track u.id) { <option [value]="u.id">{{ u.displayName }}</option> }
                <option [value]="OTHER">{{ 'expenseReports.otherEmployee' | translate }}</option>
              </select></label>
            @if (head().employeeChoice === OTHER) {
              <label class="block"><span class="field-label">{{ 'expenseReports.employeeName' | translate }} *</span>
                <input class="input-field w-full" maxlength="255" [ngModel]="head().employeeName" (ngModelChange)="patchHead({ employeeName: $event })" /></label>
            }
            <label class="block"><span class="field-label">{{ 'expenseReports.titleField' | translate }}</span>
              <input class="input-field w-full" maxlength="255" [ngModel]="head().title" (ngModelChange)="patchHead({ title: $event })"
                     [placeholder]="'expenseReports.titlePlaceholder' | translate" /></label>
            <label class="block"><span class="field-label">{{ 'expenseReports.periodFrom' | translate }}</span>
              <input type="date" class="input-field w-full" [ngModel]="head().periodFrom" (ngModelChange)="patchHead({ periodFrom: $event })" /></label>
            <label class="block"><span class="field-label">{{ 'expenseReports.periodTo' | translate }}</span>
              <input type="date" class="input-field w-full" [ngModel]="head().periodTo" (ngModelChange)="patchHead({ periodTo: $event })" /></label>
            @if (groups.enabled()) {
              <label class="block"><span class="field-label">{{ 'expenseReports.defaultCostCenter' | translate }}</span>
                <select class="input-field w-full" [ngModel]="head().costCenterId" (ngModelChange)="patchHead({ costCenterId: $event })">
                  <option [ngValue]="null">{{ 'expenses.noProject' | translate }}</option>
                  @for (c of groups.costCenters(); track c.id) { <option [ngValue]="c.id">{{ c.code }} · {{ c.name }}</option> }
                </select></label>
            }
            <label class="block sm:col-span-2 lg:col-span-3"><span class="field-label">{{ 'expenseReports.notes' | translate }}</span>
              <textarea class="input-field w-full" rows="2" [ngModel]="head().notes" (ngModelChange)="patchHead({ notes: $event })"></textarea></label>
          </fieldset>
          @if (periodInvalid()) { <p class="px-4 pb-3 text-meta text-danger-ink">{{ 'expenseReports.periodInvalid' | translate }}</p> }
        </section>

        <section class="table-card mb-4">
          <div class="card-header flex items-center justify-between gap-2">
            <h2 class="card-title">{{ 'expenseReports.lines' | translate }}</h2>
            @if (report() && editable()) {
              <button class="btn-secondary btn-sm" (click)="openLine()"><mat-icon>add</mat-icon>{{ 'expenseReports.addLine' | translate }}</button>
            }
          </div>
          @if (!report()) {
            <p class="px-4 py-6 text-sm text-ink-3">{{ 'expenseReports.saveFirst' | translate }}</p>
          } @else {
            <div class="overflow-x-auto">
              <table class="data-table">
                <thead><tr>
                  <th>{{ 'expenses.date' | translate }}</th>
                  <th>{{ 'expenses.category' | translate }}</th>
                  <th>{{ 'expenses.description' | translate }}</th>
                  <th class="hidden lg:table-cell">{{ 'expenses.vendor' | translate }}</th>
                  <th class="hidden lg:table-cell">{{ 'expenseReports.reference' | translate }}</th>
                  <th class="col-num">{{ 'expenseReports.ttc' | translate }}</th>
                  <th class="hidden md:table-cell">{{ 'expenses.vatCode' | translate }}</th>
                  <th class="col-num hidden sm:table-cell">{{ 'expenseReports.vat' | translate }}</th>
                  @if (groups.enabled()) { <th class="hidden xl:table-cell">{{ 'expenses.project' | translate }}</th> }
                  <th class="col-actions"><span class="sr-only">{{ 'expenseReports.receipts' | translate }}</span></th>
                  <th class="col-actions"></th>
                </tr></thead>
                <tbody>
                  @for (l of report()!.lines; track l.id) {
                    <tr>
                      <td class="cell-muted whitespace-nowrap">{{ date(l.expenseDate) }}</td>
                      <td><span class="badge badge-neutral">{{ categoryLabel(l.category) }}</span></td>
                      <td class="max-w-56 truncate">{{ l.description || '—' }}</td>
                      <td class="hidden lg:table-cell max-w-40 truncate">{{ l.vendorName || '—' }}</td>
                      <td class="hidden lg:table-cell cell-muted">{{ l.reference || '—' }}</td>
                      <td class="col-num num">{{ money(l.amount) }}</td>
                      <td class="hidden md:table-cell cell-muted">{{ l.vatCode ? groups.vatLabel(l.vatCode) : '—' }}</td>
                      <td class="col-num num hidden sm:table-cell">{{ money(l.vatAmount ?? 0) }}</td>
                      @if (groups.enabled()) { <td class="hidden xl:table-cell cell-muted">{{ costCenterCode(l.costCenterId) }}</td> }
                      <td class="col-actions">
                        <button class="btn-icon btn-sm relative" (click)="receiptsFor.set(l)"
                                [attr.title]="'expenseReports.receipts' | translate" [attr.aria-label]="'expenseReports.receipts' | translate">
                          <mat-icon class="icon-sm">attach_file</mat-icon>
                          @if (l.attachmentCount) { <span class="count-pill">{{ l.attachmentCount }}</span> }
                        </button>
                      </td>
                      <td class="col-actions whitespace-nowrap">
                        @if (editable()) {
                          <button class="btn-ghost btn-sm" (click)="openLine(l)">{{ 'expenses.edit' | translate }}</button>
                          <button class="btn-icon btn-sm btn-danger-hover" [disabled]="busy()" (click)="removeLine(l)"
                                  [attr.aria-label]="'expenses.delete' | translate"><mat-icon class="icon-sm">delete_outline</mat-icon></button>
                        }
                      </td>
                    </tr>
                  } @empty {
                    <tr><td [attr.colspan]="groups.enabled() ? 11 : 10" class="row-empty">
                      <app-empty-state icon="receipt_long" [title]="'expenseReports.noLines' | translate" [text]="'expenseReports.noLinesText' | translate" />
                    </td></tr>
                  }
                </tbody>
              </table>
            </div>
            <div class="flex flex-wrap justify-end gap-6 px-4 py-3 border-t border-line-soft text-sm">
              <div>{{ 'expenseReports.ht' | translate }} <span class="num font-semibold text-ink ms-1">{{ money(report()!.totals.ht) }}</span></div>
              <div>{{ 'expenseReports.vat' | translate }} <span class="num font-semibold text-ink ms-1">{{ money(report()!.totals.vat) }}</span></div>
              <div>{{ 'expenseReports.ttc' | translate }} <span class="num font-semibold text-ink ms-1">{{ money(report()!.totals.ttc) }}</span></div>
            </div>
          }
        </section>

        @if (report(); as r) {
          <div class="grid gap-4 lg:grid-cols-2">
            <section class="card">
              <div class="card-body">
                <app-attachments ownerEntityType="EXPENSE_REPORT" [ownerEntityId]="r.id" [canWrite]="canWrite() && r.status !== 'CANCELLED'" />
              </div>
            </section>
            @if (r.status === 'POSTED' || r.status === 'REIMBURSED') {
              <section class="card">
                <div class="card-header"><h2 class="card-title">{{ 'expenseReports.entries' | translate }}</h2></div>
                <div class="card-body space-y-2 text-sm">
                  <div class="flex items-center justify-between gap-2">
                    <span class="text-ink-2">{{ 'ledger.source.EXPENSE_REPORT' | translate }}@if (r.postedAt) { · {{ date(r.postedAt) }} }</span>
                    <app-ledger-entry-link sourceType="EXPENSE_REPORT" [sourceId]="r.id" />
                  </div>
                  @if (r.status === 'REIMBURSED') {
                    <div class="flex items-center justify-between gap-2">
                      <span class="text-ink-2">{{ 'ledger.source.EXPENSE_REPORT_REIMB' | translate }}@if (r.reimbursedAt) { · {{ date(r.reimbursedAt) }} }@if (r.reimbursementMethod) { · {{ ('expenseReports.method.' + r.reimbursementMethod) | translate }} }</span>
                      <app-ledger-entry-link sourceType="EXPENSE_REPORT_REIMB" [sourceId]="r.id" />
                    </div>
                  }
                </div>
              </section>
            }
          </div>
        }
      }
    </div>

    @if (line(); as f) {
      <div class="modal-backdrop">
        <div class="modal modal-lg" role="dialog" aria-modal="true">
          <div class="modal-header">
            <h3 class="modal-title">{{ (f.id ? 'expenseReports.editLine' : 'expenseReports.addLine') | translate }}</h3>
            <button class="btn-icon btn-sm" (click)="line.set(null)" [attr.aria-label]="'expenses.cancel' | translate"><mat-icon class="icon-sm">close</mat-icon></button>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <label class="block"><span class="field-label">{{ 'expenses.date' | translate }} *</span>
              <input type="date" class="input-field w-full" [(ngModel)]="f.expenseDate" /></label>
            <label class="block"><span class="field-label">{{ 'expenses.category' | translate }} *</span>
              <select class="input-field w-full" [(ngModel)]="f.category">
                @for (c of categories(); track c) { <option [value]="c">{{ categoryLabel(c) }}</option> }
              </select></label>
            <label class="block col-span-2"><span class="field-label">{{ 'expenses.description' | translate }}</span>
              <input class="input-field w-full" maxlength="255" [(ngModel)]="f.description" /></label>
            <label class="block"><span class="field-label">{{ 'expenses.vendor' | translate }}</span>
              <input class="input-field w-full" maxlength="255" [(ngModel)]="f.vendorName" /></label>
            <label class="block"><span class="field-label">{{ 'expenseReports.reference' | translate }}</span>
              <input class="input-field w-full" maxlength="100" [(ngModel)]="f.reference" /></label>
            <label class="block"><span class="field-label">{{ 'expenses.amountTtc' | translate }} *</span>
              <input type="number" min="0" step="0.01" class="input-field w-full" [ngModel]="f.amount" (ngModelChange)="f.amount = $event; recomputeVat(f)" /></label>
            <label class="block"><span class="field-label">{{ 'expenses.vatCode' | translate }}</span>
              <select class="input-field w-full" [ngModel]="f.vatCode" (ngModelChange)="f.vatCode = $event; recomputeVat(f)">
                <option [ngValue]="null">{{ 'expenses.vatCodeAuto' | translate }}</option>
                @for (c of groups.vatCodes(); track c.code) { <option [ngValue]="c.code">{{ groups.vatLabel(c.code) }}</option> }
              </select></label>
            <label class="block"><span class="field-label">{{ 'expenses.vatIncluded' | translate }}</span>
              <input type="number" min="0" step="0.01" class="input-field w-full" [(ngModel)]="f.vatAmount" />
              @if (vatTooHigh(f)) { <span class="text-meta text-danger-ink mt-1 block">{{ 'expenses.vatTooHigh' | translate }}</span> }</label>
            @if (groups.enabled()) {
              <label class="block"><span class="field-label">{{ 'expenses.project' | translate }}</span>
                <select class="input-field w-full" [(ngModel)]="f.costCenterId">
                  <option [ngValue]="null">{{ 'expenseReports.reportCostCenter' | translate }}</option>
                  @for (c of groups.costCenters(); track c.id) { <option [ngValue]="c.id">{{ c.code }} · {{ c.name }}</option> }
                </select></label>
            }
          </div>
          @if (!f.id) { <p class="text-xs text-ink-3 mt-3">{{ 'expenseReports.receiptAfterSave' | translate }}</p> }
          <div class="modal-footer">
            <button class="btn-secondary" (click)="line.set(null)">{{ 'expenses.cancel' | translate }}</button>
            <button class="btn-primary" [disabled]="busy() || !lineValid(f)" (click)="saveLine(f)">{{ 'expenses.save' | translate }}</button>
          </div>
        </div>
      </div>
    }

    @if (receiptsFor(); as l) {
      <div class="modal-backdrop">
        <div class="modal modal-md" role="dialog" aria-modal="true">
          <div class="modal-header">
            <h3 class="modal-title">{{ 'expenseReports.receiptsOf' | translate: { what: l.description || categoryLabel(l.category), amount: money(l.amount) } }}</h3>
            <button class="btn-icon btn-sm" (click)="closeReceipts()" [attr.aria-label]="'expenses.close' | translate"><mat-icon class="icon-sm">close</mat-icon></button>
          </div>
          <app-attachments ownerEntityType="EXPENSE" [ownerEntityId]="l.id" [canWrite]="editable()" />
          <div class="modal-footer">
            <button class="btn-secondary" (click)="closeReceipts()">{{ 'expenses.close' | translate }}</button>
          </div>
        </div>
      </div>
    }

    @if (reimburseForm(); as f) {
      <div class="modal-backdrop">
        <div class="modal modal-md" role="dialog" aria-modal="true">
          <div class="modal-header">
            <h3 class="modal-title">{{ 'expenseReports.reimburseTitle' | translate }}</h3>
            <button class="btn-icon btn-sm" (click)="reimburseForm.set(null)" [attr.aria-label]="'expenses.cancel' | translate"><mat-icon class="icon-sm">close</mat-icon></button>
          </div>
          @if (report(); as r) {
            <p class="text-sm text-ink-2 mb-3">{{ 'expenseReports.reimburseHint' | translate: { amount: money(r.totals.ttc), name: r.employeeName } }}</p>
          }
          <div class="grid gap-3">
            <label class="block"><span class="field-label">{{ 'expenses.date' | translate }} *</span>
              <input type="date" class="input-field w-full" [(ngModel)]="f.date" /></label>
            <label class="block"><span class="field-label">{{ 'expenseReports.methodLabel' | translate }}</span>
              <select class="input-field w-full" [(ngModel)]="f.method">
                <option value="BANK_TRANSFER">{{ 'expenseReports.method.BANK_TRANSFER' | translate }}</option>
                <option value="CASH">{{ 'expenseReports.method.CASH' | translate }}</option>
              </select></label>
            @if (f.method === 'BANK_TRANSFER') {
              <label class="block"><span class="field-label">{{ 'expenseReports.bankAccount' | translate }} *</span>
                <select class="input-field w-full" [(ngModel)]="f.bankAccountId">
                  <option [ngValue]="null">—</option>
                  @for (a of bankAccounts(); track a.id) { <option [ngValue]="a.id">{{ a.name }}</option> }
                </select></label>
            }
          </div>
          <div class="modal-footer">
            <button class="btn-secondary" (click)="reimburseForm.set(null)">{{ 'expenses.cancel' | translate }}</button>
            <button class="btn-primary" [disabled]="busy() || !f.date || (f.method === 'BANK_TRANSFER' && !f.bankAccountId)" (click)="reimburse(f)">{{ 'expenseReports.reimburse' | translate }}</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ExpenseReportComponent implements OnInit {
  private api = inject(ExpenseReportsApi);
  private expensesApi = inject(ExpensesApi);
  private bankApi = inject(BankApi);
  private state = inject(CrmStateService);
  private toast = inject(ToastService);
  private i18n = inject(TranslationService);
  private confirm = inject(ConfirmService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  groups = inject(LedgerGroupsStore);

  readonly OTHER = OTHER_EMPLOYEE;

  /** null while the report is new (not saved yet). */
  report = signal<ExpenseReport | null>(null);
  loadError = signal<string | null>(null);
  head = signal<HeaderForm>(this.emptyHead());
  line = signal<LineForm | null>(null);
  receiptsFor = signal<ExpenseReportLine | null>(null);
  reimburseForm = signal<ReimburseForm | null>(null);
  bankAccounts = signal<BankAccount[]>([]);
  busy = signal(false);
  categories = signal<string[]>(DEFAULT_CATEGORIES);

  users = computed(() => this.state.users().filter(u => u.isActive !== false));
  /** Lines and header can change only on a draft (or a report not saved yet). */
  editable = computed(() => this.canWrite() && (!this.report() || this.report()!.status === 'DRAFT'));
  pageTitle = computed(() => {
    const r = this.report();
    if (!r) return this.i18n.t('expenseReports.new');
    return `${this.i18n.t('expenseReports.one')} ${r.number || this.i18n.t('expenseReports.draftNumber')}`;
  });
  periodInvalid = computed(() => {
    const h = this.head();
    return !!h.periodFrom && !!h.periodTo && h.periodFrom > h.periodTo;
  });
  headerValid = computed(() => !!this.employeeName().trim() && !this.periodInvalid());

  canWrite(): boolean { return this.state.hasAuthority('PAYMENTS_CREATE'); }

  ngOnInit(): void {
    this.groups.ensure(true);
    const { from, to } = monthBounds();
    this.expensesApi.summary(`${from.slice(0, 4)}-01-01`, to).subscribe({
      next: s => { if (s?.categories?.length) this.categories.set(s.categories); },
      error: () => { /* the default list stays */ },
    });
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(p => {
      const id = p.get('id');
      if (!id || id === 'new') {
        this.report.set(null);
        this.head.set(this.emptyHead());
        this.state.breadcrumbLabel.set(this.i18n.t('expenseReports.new'));
      } else if (id !== this.report()?.id) {
        this.load(id, true);
      }
    });
  }

  private emptyHead(): HeaderForm {
    const { from, to } = monthBounds();
    return { employeeChoice: '', employeeName: '', title: '', periodFrom: from, periodTo: to, costCenterId: null, notes: '' };
  }

  private load(id: string, resetHead: boolean): void {
    this.api.getOne(id).subscribe({
      next: r => {
        this.loadError.set(null);
        this.report.set(r);
        if (resetHead) this.head.set(this.headFrom(r));
        this.state.breadcrumbLabel.set(r.number || this.i18n.t('expenseReports.one'));
      },
      error: e => this.loadError.set(errorDetail(e) || this.i18n.t('expenseReports.error')),
    });
  }

  private headFrom(r: ExpenseReport): HeaderForm {
    const known = r.employeeUserId && this.state.users().some(u => u.id === r.employeeUserId);
    return {
      employeeChoice: known ? r.employeeUserId! : (r.employeeName ? OTHER_EMPLOYEE : ''),
      employeeName: r.employeeName ?? '',
      title: r.title ?? '',
      periodFrom: r.periodFrom ?? '',
      periodTo: r.periodTo ?? '',
      costCenterId: r.costCenterId,
      notes: r.notes ?? '',
    };
  }

  patchHead(change: Partial<HeaderForm>): void {
    this.head.update(h => ({ ...h, ...change }));
  }

  /** Picking a user fills the name from them; "someone else" keeps a name typed by hand. */
  pickEmployee(choice: string): void {
    const u = this.state.users().find(x => x.id === choice);
    this.head.update(h => ({ ...h, employeeChoice: choice, employeeName: u ? u.displayName : (choice === OTHER_EMPLOYEE ? (h.employeeChoice === OTHER_EMPLOYEE ? h.employeeName : '') : '') }));
  }

  private employeeName(): string {
    const h = this.head();
    if (h.employeeChoice === OTHER_EMPLOYEE) return h.employeeName;
    return this.state.users().find(u => u.id === h.employeeChoice)?.displayName ?? h.employeeName;
  }

  private headerInput(): ExpenseReportInput {
    const h = this.head();
    const userId = h.employeeChoice && h.employeeChoice !== OTHER_EMPLOYEE ? h.employeeChoice : null;
    return {
      employeeUserId: userId,
      employeeName: this.employeeName().trim(),
      title: h.title.trim() || null,
      periodFrom: h.periodFrom || null,
      periodTo: h.periodTo || null,
      notes: h.notes.trim() || null,
      costCenterId: h.costCenterId,
    };
  }

  async saveHeader(silent = false): Promise<boolean> {
    if (!this.headerValid()) return false;
    this.busy.set(true);
    const id = this.report()?.id ?? null;
    try {
      const saved = await firstValueFrom(this.api.save(this.headerInput(), id));
      this.busy.set(false);
      if (!silent) this.toast.show(this.i18n.t('expenseReports.saved'), { type: 'success' });
      if (!id) {
        this.report.set({ ...saved, lines: saved.lines ?? [] });
        this.router.navigate(['/finance/expense-reports', saved.id], { replaceUrl: true });
      }
      this.load(saved.id || id!, false);
      return true;
    } catch (e) {
      this.fail(e);
      return false;
    }
  }

  async post(): Promise<void> {
    const r = this.report();
    if (!r) return;
    if (!(await this.confirm.ask({
      title: this.i18n.t('expenseReports.postConfirm'),
      message: this.i18n.t('expenseReports.postConfirmText', { amount: this.money(r.totals.ttc), name: this.employeeName() }),
      confirmLabel: this.i18n.t('expenseReports.post'),
    }))) return;
    // The header goes first, so the entry is dated and labelled from what is on screen.
    if (!(await this.saveHeader(true))) return;
    this.run(this.api.postReport(r.id), 'expenseReports.posted');
  }

  async unpost(): Promise<void> {
    const r = this.report();
    if (!r || !(await this.confirm.ask({ title: this.i18n.t('expenseReports.unpostConfirm'), message: this.i18n.t('expenseReports.unpostConfirmText') }))) return;
    this.run(this.api.unpost(r.id), 'expenseReports.unposted');
  }

  async cancelReport(): Promise<void> {
    const r = this.report();
    if (!r || !(await this.confirm.ask({ title: this.i18n.t('expenseReports.cancelConfirm'), danger: true, confirmLabel: this.i18n.t('expenseReports.cancelReport') }))) return;
    this.run(this.api.cancel(r.id), 'expenseReports.cancelled');
  }

  openReimburse(): void {
    this.reimburseForm.set({ date: todayIso(), method: 'BANK_TRANSFER', bankAccountId: null });
    this.bankApi.accounts().subscribe({
      next: list => {
        const active = (list ?? []).filter(a => a.active !== false);
        this.bankAccounts.set(active);
        if (active.length === 1) this.reimburseForm.update(f => (f ? { ...f, bankAccountId: active[0].id } : f));
      },
      error: e => this.fail(e),
    });
  }

  reimburse(f: ReimburseForm): void {
    const r = this.report();
    if (!r) return;
    this.run(this.api.reimburse(r.id, { date: f.date, method: f.method, bankAccountId: f.method === 'BANK_TRANSFER' ? f.bankAccountId : null }),
      'expenseReports.reimbursed', () => this.reimburseForm.set(null));
  }

  downloadPdf(r: ExpenseReport): void {
    this.api.pdf(r.id).subscribe({
      next: blob => saveBlob(blob, `${r.number || 'note-de-frais'}.pdf`),
      error: e => this.fail(e),
    });
  }

  // Lines

  openLine(l?: ExpenseReportLine): void {
    const r = this.report();
    this.line.set(l ? {
      id: l.id, expenseDate: l.expenseDate, category: l.category, description: l.description ?? '', vendorName: l.vendorName ?? '',
      reference: l.reference ?? '', amount: l.amount, vatCode: l.vatCode ?? null, vatAmount: l.vatAmount ?? null, costCenterId: l.costCenterId ?? null,
    } : {
      expenseDate: this.defaultLineDate(r), category: 'MEALS', description: '', vendorName: '', reference: '',
      amount: null, vatCode: null, vatAmount: null, costCenterId: null,
    });
  }

  private defaultLineDate(r: ExpenseReport | null): string {
    const today = todayIso();
    const to = r?.periodTo;
    return to && to < today ? to : today;
  }

  /** The VAT included in the amount at the chosen code's rate; still editable by hand. */
  recomputeVat(f: LineForm): void {
    if (!f.vatCode || f.amount === null || !(f.amount > 0)) return;
    const rate = vatFraction(this.groups.vatCodes(), f.vatCode);
    f.vatAmount = round2(f.amount * rate / (1 + rate));
  }

  vatTooHigh(f: LineForm): boolean {
    return f.vatAmount !== null && f.amount !== null && f.vatAmount > f.amount;
  }

  lineValid(f: LineForm): boolean {
    return !!f.expenseDate && !!f.category && f.amount !== null && f.amount > 0
      && (f.vatAmount === null || (f.vatAmount >= 0 && f.vatAmount <= f.amount));
  }

  saveLine(f: LineForm): void {
    const r = this.report();
    if (!r) return;
    const body: ExpenseReportLineInput = {
      expenseDate: f.expenseDate, category: f.category, description: f.description.trim() || null, amount: f.amount!,
      vatAmount: f.vatAmount, vatCode: f.vatCode, vendorName: f.vendorName.trim() || null, reference: f.reference.trim() || null,
      costCenterId: f.costCenterId,
    };
    const isNew = !f.id;
    this.busy.set(true);
    this.api.saveLine(r.id, body, f.id).subscribe({
      next: saved => {
        this.busy.set(false);
        this.line.set(null);
        this.toast.show(this.i18n.t(isNew ? 'expenseReports.lineAdded' : 'expenseReports.lineSaved'), { type: 'success' });
        // A new line opens its receipts right away, so the proof goes with it.
        if (isNew && saved?.id) this.receiptsFor.set(saved);
        this.load(r.id, false);
      },
      error: e => this.fail(e),
    });
  }

  async removeLine(l: ExpenseReportLine): Promise<void> {
    const r = this.report();
    if (!r || !(await this.confirm.ask({ title: this.i18n.t('expenseReports.removeLineConfirm'), danger: true }))) return;
    this.busy.set(true);
    this.api.removeLine(r.id, l.id).subscribe({
      next: () => { this.busy.set(false); this.load(r.id, false); },
      error: e => this.fail(e),
    });
  }

  closeReceipts(): void {
    this.receiptsFor.set(null);
    const r = this.report();
    if (r) this.load(r.id, false);
  }

  // Display

  categoryLabel(c: string): string {
    const key = `expenses.cat.${c}`;
    const label = this.i18n.t(key);
    return label === key ? c.charAt(0) + c.slice(1).toLowerCase().replace(/_/g, ' ') : label;
  }

  costCenterCode(id: string | null | undefined): string {
    const r = this.report();
    const cc = id ?? r?.costCenterId;
    if (!cc) return '—';
    const c = this.groups.costCenters().find(x => x.id === cc);
    return c ? c.code + (id ? '' : ' *') : '—';
  }

  badge(s: string): string { return expenseReportBadge(s); }
  money(v: number | null | undefined): string { return formatMoney(v ?? 0); }
  date(v: string | null | undefined): string { return shortDate(v); }

  private run(obs: ReturnType<ExpenseReportsApi['postReport']>, okKey: string, after?: () => void): void {
    const id = this.report()?.id;
    this.busy.set(true);
    obs.subscribe({
      next: () => {
        this.busy.set(false);
        after?.();
        this.toast.show(this.i18n.t(okKey), { type: 'success' });
        if (id) this.load(id, true);
      },
      error: e => this.fail(e),
    });
  }

  private fail(e: unknown): void {
    this.busy.set(false);
    this.toast.show(errorDetail(e) || this.i18n.t('expenseReports.error'), { type: 'error' });
  }
}
