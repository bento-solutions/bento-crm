import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { TranslationService } from '../../services/translation.service';
import { ToastService } from '../../services/toast.service';
import { CrmStateService } from '../../services/crm-state.service';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { PaginatorComponent } from '../../shared/paginator.component';
import { EXPENSE_REPORT_STATUSES, ExpenseReport, ExpenseReportStatus, ExpenseReportsApi } from '../../services/domains/expense-reports.service';
import { formatMoney, shortDate } from '../../shared/bank.util';
import { errorDetail } from '../bank/bank-labels';
import { expenseReportBadge, periodText } from './expense-report-labels';

/**
 * Account Payables → Expense reports (notes de frais): what employees spent for the company, filtered
 * by status, employee and period. Each report opens on its own page.
 */
@Component({
  selector: 'app-expense-reports',
  imports: [FormsModule, MatIconModule, TranslatePipe, PageHeaderComponent, EmptyStateComponent, PaginatorComponent],
  template: `
    <div class="page">
      <app-page-header [title]="'expenseReports.title' | translate" [subtitle]="'expenseReports.subtitle' | translate"
                       backLink="/finance" [backQueryParams]="{ tab: 'Expenses' }" [backLabel]="'expenseReports.backToExpenses' | translate">
        @if (canCreate()) {
          <button actions class="btn-primary" (click)="openNew()"><mat-icon>add</mat-icon>{{ 'expenseReports.new' | translate }}</button>
        }
      </app-page-header>

      <div class="flex flex-wrap items-end gap-3">
        <label class="block"><span class="field-label">{{ 'expenseReports.status' | translate }}</span>
          <select class="input-field" [ngModel]="status()" (ngModelChange)="status.set($event); reload()">
            <option [ngValue]="null">{{ 'expenseReports.allStatuses' | translate }}</option>
            @for (s of statuses; track s) { <option [ngValue]="s">{{ ('expenseReports.statusName.' + s) | translate }}</option> }
          </select></label>
        <label class="block"><span class="field-label">{{ 'expenseReports.employee' | translate }}</span>
          <input class="input-field" [ngModel]="employee()" (ngModelChange)="employee.set($event)" (keyup.enter)="reload()" (blur)="reload()"
                 [placeholder]="'expenseReports.employeeSearch' | translate" /></label>
        <label class="block"><span class="field-label">{{ 'expenses.from' | translate }}</span>
          <input type="date" class="input-field" [ngModel]="from()" (ngModelChange)="from.set($event); reload()" /></label>
        <label class="block"><span class="field-label">{{ 'expenses.to' | translate }}</span>
          <input type="date" class="input-field" [ngModel]="to()" (ngModelChange)="to.set($event); reload()" /></label>
      </div>

      <div class="table-card">
        <div class="overflow-x-auto">
          <table class="data-table">
            <thead><tr>
              <th>{{ 'expenseReports.number' | translate }}</th>
              <th>{{ 'expenseReports.employee' | translate }}</th>
              <th class="hidden md:table-cell">{{ 'expenseReports.titleField' | translate }}</th>
              <th class="hidden sm:table-cell">{{ 'expenseReports.period' | translate }}</th>
              <th class="col-num">{{ 'expenseReports.totalTtc' | translate }}</th>
              <th>{{ 'expenseReports.status' | translate }}</th>
            </tr></thead>
            <tbody>
              @for (r of reports(); track r.id) {
                <tr class="cursor-pointer hover:bg-subtle" (click)="open(r)">
                  <td><button type="button" class="cell-title hover:underline text-start num" (click)="$event.stopPropagation(); open(r)">{{ r.number || ('expenseReports.draftNumber' | translate) }}</button></td>
                  <td class="max-w-48 truncate">{{ r.employeeName || '—' }}</td>
                  <td class="hidden md:table-cell max-w-64 truncate">{{ r.title || '—' }}</td>
                  <td class="hidden sm:table-cell cell-muted whitespace-nowrap">{{ period(r) }}</td>
                  <td class="col-num num">{{ money(r.totals.ttc) }}</td>
                  <td><span class="badge" [class]="badge(r.status)">{{ ('expenseReports.statusName.' + r.status) | translate }}</span></td>
                </tr>
              } @empty {
                <tr><td colspan="6" class="row-empty">
                  <app-empty-state icon="receipt_long" [title]="'expenseReports.emptyTitle' | translate" [text]="'expenseReports.emptyText' | translate" />
                </td></tr>
              }
            </tbody>
          </table>
        </div>
        @if (totalPages() > 1) {
          <app-paginator [currentPage]="page() + 1" [totalPages]="totalPages()" [pageSize]="size()"
                         (pageChange)="page.set($event - 1); load()" (pageSizeChange)="size.set(+$event); page.set(0); load()" />
        }
      </div>
    </div>
  `,
})
export class ExpenseReportsComponent implements OnInit {
  private api = inject(ExpenseReportsApi);
  private state = inject(CrmStateService);
  private toast = inject(ToastService);
  private i18n = inject(TranslationService);
  private router = inject(Router);

  readonly statuses = EXPENSE_REPORT_STATUSES;
  reports = signal<ExpenseReport[]>([]);
  status = signal<ExpenseReportStatus | null>(null);
  employee = signal('');
  from = signal('');
  to = signal('');
  page = signal(0);
  size = signal(20);
  totalPages = signal(0);
  /** The employee filter last sent, so blur after Enter does not ask twice. */
  private lastQuery = '';

  canCreate(): boolean { return this.state.hasAuthority('PAYMENTS_CREATE'); }

  ngOnInit(): void {
    this.state.breadcrumbLabel.set(this.i18n.t('expenseReports.title'));
    this.load();
  }

  reload(): void {
    this.page.set(0);
    this.load();
  }

  load(): void {
    const q = { status: this.status(), employee: this.employee(), from: this.from() || null, to: this.to() || null, page: this.page(), size: this.size() };
    const key = JSON.stringify(q);
    if (key === this.lastQuery) return;
    this.lastQuery = key;
    this.api.list(q).subscribe({
      next: p => {
        this.reports.set(p.content);
        this.totalPages.set(p.totalPages);
      },
      error: e => {
        this.lastQuery = '';
        this.toast.show(errorDetail(e) || this.i18n.t('expenseReports.error'), { type: 'error' });
      },
    });
  }

  openNew(): void { this.router.navigate(['/finance/expense-reports', 'new']); }
  open(r: ExpenseReport): void { this.router.navigate(['/finance/expense-reports', r.id]); }

  period(r: ExpenseReport): string { return periodText(r.periodFrom, r.periodTo, shortDate); }
  badge(s: string): string { return expenseReportBadge(s); }
  money(v: number): string { return formatMoney(v); }
}
