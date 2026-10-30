import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { TranslationService } from '../../services/translation.service';
import { ToastService } from '../../services/toast.service';
import { CrmStateService } from '../../services/crm-state.service';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { ConfirmService } from '../../shared/ui/confirm.service';
import { ContactOption, DriveApi } from '../../services/domains/drive.service';
import { TaxApi, TaxProfile, VAT_REGIMES, VatRegime } from '../../services/domains/tax.service';
import { errorDetail } from '../bank/bank-labels';

interface ProfileForm {
  id?: string;
  /** null for the company's own profile. */
  partnerId: string | null;
  forCompany: boolean;
  vatRegime: VatRegime;
  corporateTax: boolean;
  fiscalYearEndMonth: number;
  hasEmployees: boolean;
  active: boolean;
}

/**
 * Tax calendar → Profiles: which declarations the company and each client file (TVA regime,
 * IS, financial year end, employees), from which the deadlines are generated.
 */
@Component({
  selector: 'app-tax-profiles',
  imports: [FormsModule, MatIconModule, TranslatePipe, EmptyStateComponent],
  template: `
    <div class="space-y-6">
      <!-- The company itself -->
      <section class="space-y-2">
        <h2 class="section-title">{{ 'tax.ourCompany' | translate }}</h2>
        @if (!loaded()) {
          <p class="text-sm text-ink-3">{{ 'bank.loading' | translate }}</p>
        } @else if (companyProfile(); as p) {
          <div class="card card-body flex flex-wrap items-start gap-4">
            <dl class="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-2 text-sm w-full sm:w-auto sm:flex-1 min-w-0">
              <div><dt class="text-ink-3 text-xs">{{ 'tax.profile.vat' | translate }}</dt><dd class="text-ink">{{ ('tax.vat.' + p.vatRegime) | translate }}</dd></div>
              <div><dt class="text-ink-3 text-xs">{{ 'tax.profile.is' | translate }}</dt><dd class="text-ink">{{ (p.corporateTax ? 'tax.yes' : 'tax.no') | translate }}</dd></div>
              <div><dt class="text-ink-3 text-xs">{{ 'tax.profile.fyEnd' | translate }}</dt><dd class="text-ink">{{ monthName(p.fiscalYearEndMonth) }}</dd></div>
              <div><dt class="text-ink-3 text-xs">{{ 'tax.profile.employees' | translate }}</dt><dd class="text-ink">{{ (p.hasEmployees ? 'tax.yes' : 'tax.no') | translate }}</dd></div>
            </dl>
            <div class="flex items-center gap-2">
              @if (!p.active) { <span class="badge badge-neutral">{{ 'tax.profile.paused' | translate }}</span> }
              @if (canWrite()) {
                <button class="btn-secondary btn-sm" (click)="openForm(p)">{{ 'bank.edit' | translate }}</button>
                <button class="btn-ghost btn-sm" [disabled]="busy()" (click)="remove(p)">{{ 'bank.delete' | translate }}</button>
              }
            </div>
          </div>
        } @else {
          <div class="card">
            <app-empty-state icon="business" [title]="'tax.profile.noCompanyTitle' | translate" [text]="'tax.profile.noCompanyText' | translate">
              @if (canWrite()) {
                <button class="btn-primary" (click)="openForm(null, true)"><mat-icon>add</mat-icon>{{ 'tax.profile.createCompany' | translate }}</button>
              }
            </app-empty-state>
          </div>
        }
      </section>

      <!-- Clients -->
      <section class="space-y-2">
        <div class="flex flex-wrap items-center gap-2">
          <h2 class="section-title me-auto">{{ 'tax.profile.clients' | translate }}</h2>
          @if (canWrite()) {
            <button class="btn-primary" (click)="openForm(null, false)"><mat-icon>add</mat-icon>{{ 'tax.profile.addClient' | translate }}</button>
          }
        </div>
        <div class="table-card">
          <div class="overflow-x-auto">
            <table class="data-table">
              <thead><tr>
                <th>{{ 'tax.profile.client' | translate }}</th>
                <th class="hidden sm:table-cell">{{ 'tax.profile.vat' | translate }}</th>
                <th class="hidden sm:table-cell">{{ 'tax.profile.is' | translate }}</th>
                <th class="hidden md:table-cell">{{ 'tax.profile.fyEnd' | translate }}</th>
                <th class="hidden md:table-cell">{{ 'tax.profile.employees' | translate }}</th>
                <th class="col-actions"></th>
              </tr></thead>
              <tbody>
                @for (p of clientProfiles(); track p.id) {
                  <tr>
                    <td class="max-w-48">
                      <div class="cell-title truncate">{{ p.partnerName || '—' }}
                        @if (!p.active) { <span class="badge badge-neutral ms-1">{{ 'tax.profile.paused' | translate }}</span> }</div>
                      <div class="cell-sub md:hidden"><span class="sm:hidden">{{ ('tax.vat.' + p.vatRegime) | translate }} · </span>{{ summary(p) }}</div>
                    </td>
                    <td class="whitespace-nowrap hidden sm:table-cell">{{ ('tax.vat.' + p.vatRegime) | translate }}</td>
                    <td class="hidden sm:table-cell">{{ (p.corporateTax ? 'tax.yes' : 'tax.no') | translate }}</td>
                    <td class="hidden md:table-cell whitespace-nowrap">{{ monthName(p.fiscalYearEndMonth) }}</td>
                    <td class="hidden md:table-cell">{{ (p.hasEmployees ? 'tax.yes' : 'tax.no') | translate }}</td>
                    <td class="col-actions whitespace-nowrap">
                      @if (canWrite()) {
                        <button class="btn-icon btn-sm" (click)="openForm(p)" [attr.aria-label]="'bank.edit' | translate" [title]="'bank.edit' | translate"><mat-icon class="icon-sm">edit</mat-icon></button>
                        <button class="btn-icon btn-sm" [disabled]="busy()" (click)="remove(p)" [attr.aria-label]="'bank.delete' | translate" [title]="'bank.delete' | translate"><mat-icon class="icon-sm">delete</mat-icon></button>
                      }
                    </td>
                  </tr>
                } @empty {
                  <tr><td colspan="6" class="row-empty">
                    <app-empty-state icon="groups" [title]="'tax.profile.noClientsTitle' | translate" [text]="'tax.profile.noClientsText' | translate" />
                  </td></tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>

    @if (form(); as f) {
      <div class="modal-backdrop">
        <div class="modal modal-md" role="dialog" aria-modal="true" aria-labelledby="tax-profile-title">
          <div class="modal-header">
            <div class="min-w-0">
              <h3 id="tax-profile-title" class="modal-title">{{ (f.id ? 'tax.profile.editTitle' : 'tax.profile.newTitle') | translate }}</h3>
              @if (f.forCompany) { <p class="modal-subtitle">{{ 'tax.ourCompany' | translate }}</p> }
              @else if (f.id) { <p class="modal-subtitle truncate">{{ clientName(f.partnerId) }}</p> }
            </div>
            <button class="btn-icon btn-sm" (click)="form.set(null)" [attr.aria-label]="'bank.cancel' | translate"><mat-icon class="icon-sm">close</mat-icon></button>
          </div>
          <fieldset class="grid grid-cols-1 sm:grid-cols-2 gap-3" [disabled]="busy()">
            @if (!f.forCompany && !f.id) {
              <label class="block sm:col-span-2"><span class="field-label">{{ 'tax.profile.client' | translate }}</span>
                <select class="input-field" [(ngModel)]="f.partnerId">
                  <option [ngValue]="null">{{ 'tax.profile.pickClient' | translate }}</option>
                  @for (c of availableClients(); track c.id) { <option [ngValue]="c.id">{{ c.name }}</option> }
                </select>
                @if (!availableClients().length) { <span class="field-hint">{{ 'tax.profile.noMoreClients' | translate }}</span> }
              </label>
            }
            <label class="block"><span class="field-label">{{ 'tax.profile.vat' | translate }}</span>
              <select class="input-field" [(ngModel)]="f.vatRegime">
                @for (v of regimes; track v) { <option [ngValue]="v">{{ ('tax.vat.' + v) | translate }}</option> }
              </select></label>
            <label class="block"><span class="field-label">{{ 'tax.profile.fyEnd' | translate }}</span>
              <select class="input-field" [(ngModel)]="f.fiscalYearEndMonth">
                @for (m of months; track m) { <option [ngValue]="m">{{ monthName(m) }}</option> }
              </select></label>
            <label class="choice-row sm:col-span-2">
              <input type="checkbox" [(ngModel)]="f.corporateTax" />
              <span class="text-sm text-ink">{{ 'tax.profile.isLong' | translate }}</span>
            </label>
            <label class="choice-row sm:col-span-2">
              <input type="checkbox" [(ngModel)]="f.hasEmployees" />
              <span class="text-sm text-ink">{{ 'tax.profile.employeesLong' | translate }}</span>
            </label>
            <label class="choice-row sm:col-span-2">
              <input type="checkbox" [(ngModel)]="f.active" />
              <span class="text-sm text-ink">{{ 'tax.profile.activeLong' | translate }}</span>
            </label>
          </fieldset>
          <div class="modal-footer">
            <button class="btn-secondary" (click)="form.set(null)">{{ 'bank.cancel' | translate }}</button>
            <button class="btn-primary" [disabled]="busy() || (!f.forCompany && !f.partnerId)" (click)="save(f)">{{ 'bank.save' | translate }}</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class TaxProfilesComponent implements OnInit {
  private api = inject(TaxApi);
  private drive = inject(DriveApi);
  private toast = inject(ToastService);
  private i18n = inject(TranslationService);
  private state = inject(CrmStateService);
  private confirm = inject(ConfirmService);

  readonly regimes = VAT_REGIMES;
  readonly months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  profiles = signal<TaxProfile[]>([]);
  clients = signal<ContactOption[]>([]);
  loaded = signal(false);
  busy = signal(false);
  form = signal<ProfileForm | null>(null);

  companyProfile = computed(() => this.profiles().find(p => !p.partnerId) ?? null);
  clientProfiles = computed(() => this.profiles().filter(p => !!p.partnerId)
    .sort((a, b) => (a.partnerName ?? '').localeCompare(b.partnerName ?? '')));
  /** Clients that have no profile yet. */
  availableClients = computed(() => {
    const taken = new Set(this.profiles().map(p => p.partnerId).filter(Boolean));
    return this.clients().filter(c => !taken.has(c.id));
  });

  canWrite(): boolean { return this.state.hasAuthority('INVOICES_WRITE') || this.state.hasAuthority('PAYMENTS_WRITE'); }

  ngOnInit(): void {
    this.load();
    this.drive.contacts('CUSTOMER').subscribe({ next: c => this.clients.set(c), error: () => { /* the picker stays empty */ } });
  }

  load(): void {
    this.api.profiles().subscribe({
      next: p => { this.profiles.set(p ?? []); this.loaded.set(true); },
      error: e => { this.loaded.set(true); this.fail(e); },
    });
  }

  openForm(p: TaxProfile | null, forCompany = false): void {
    this.form.set(p ? {
      id: p.id, partnerId: p.partnerId ?? null, forCompany: !p.partnerId, vatRegime: p.vatRegime,
      corporateTax: p.corporateTax, fiscalYearEndMonth: p.fiscalYearEndMonth, hasEmployees: p.hasEmployees, active: p.active,
    } : {
      partnerId: null, forCompany, vatRegime: 'MONTHLY', corporateTax: true, fiscalYearEndMonth: 12,
      hasEmployees: forCompany, active: true,
    });
  }

  save(f: ProfileForm): void {
    this.busy.set(true);
    this.api.saveProfile({
      partnerId: f.id || f.forCompany ? undefined : f.partnerId,
      vatRegime: f.vatRegime, corporateTax: f.corporateTax, fiscalYearEndMonth: Number(f.fiscalYearEndMonth),
      hasEmployees: f.hasEmployees, active: f.active,
    }, f.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.form.set(null);
        this.toast.show(this.i18n.t('tax.profile.saved'), { type: 'success' });
        this.load();
      },
      error: e => this.fail(e),
    });
  }

  async remove(p: TaxProfile): Promise<void> {
    const name = p.partnerId ? (p.partnerName || '—') : this.i18n.t('tax.ourCompany');
    if (!(await this.confirm.ask({
      title: this.i18n.t('tax.profile.confirmDelete', { name }),
      message: this.i18n.t('tax.profile.confirmDeleteText'),
      danger: true,
    }))) return;
    this.busy.set(true);
    this.api.deleteProfile(p.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.toast.show(this.i18n.t('tax.profile.deleted'), { type: 'success' });
        this.load();
      },
      error: e => this.fail(e),
    });
  }

  // Display
  monthName(m: number): string {
    const name = new Intl.DateTimeFormat(this.i18n.currentLang(), { month: 'long' }).format(new Date(2026, m - 1, 1));
    return name.charAt(0).toLocaleUpperCase() + name.slice(1);
  }

  summary(p: TaxProfile): string {
    const parts = [this.i18n.t(p.corporateTax ? 'tax.profile.isShort' : 'tax.profile.noIsShort')];
    parts.push(this.i18n.t('tax.profile.fyEndShort', { month: this.monthName(p.fiscalYearEndMonth) }));
    if (p.hasEmployees) parts.push(this.i18n.t('tax.profile.employeesShort'));
    return parts.join(' · ');
  }

  clientName(id: string | null): string {
    return this.profiles().find(p => p.partnerId === id)?.partnerName ?? this.clients().find(c => c.id === id)?.name ?? '—';
  }

  private fail(e: unknown): void {
    this.busy.set(false);
    this.toast.show(errorDetail(e) || this.i18n.t('bank.error'), { type: 'error' });
  }
}
