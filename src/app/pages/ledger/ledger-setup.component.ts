import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Observable } from 'rxjs';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { TranslationService } from '../../services/translation.service';
import { ToastService } from '../../services/toast.service';
import { CrmStateService } from '../../services/crm-state.service';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { ConfirmService } from '../../shared/ui/confirm.service';
import {
  BankPostingMode, GeneralSetupRow, LedgerAccount, LedgerApi, PartnerGroup, PartnerGroupSide, PostingGroup, PostingSetup, RepostResult, VatRule, VatSetupRow,
} from '../../services/domains/ledger.service';
import { LedgerGroupsStore } from '../../services/domains/ledger-groups.store';
import { shortDate } from '../../shared/bank.util';
import { categoryLabel } from '../bank/bank-labels';
import { LedgerPickerComponent, PickerOption } from './ledger-picker.component';
import { errorDetail, sourceLabel } from './ledger-labels';

type Section = 'groups' | 'general' | 'vat' | 'bank' | 'categories';
type GroupKind = 'business-groups' | 'product-groups';

interface GroupForm {
  /** A partner group (with its side and account) or a business / product group. */
  kind: 'partner' | GroupKind;
  id?: string;
  code: string;
  name: string;
  side: PartnerGroupSide;
  accountId: string | null;
}

/**
 * General Ledger → Posting setup: which accounts automatic postings use. Partner groups give the
 * receivable / payable account, business × product groups the sales and purchase accounts, VAT
 * rates their VAT accounts, then the bank, cash and category accounts. Also the posting start
 * date and, for admins, re-posting the documents dated since then.
 */
@Component({
  selector: 'app-ledger-setup',
  imports: [FormsModule, MatIconModule, TranslatePipe, EmptyStateComponent, LedgerPickerComponent],
  template: `
    <div class="space-y-4">
      @if (setup(); as s) {
        <!-- Start date and history -->
        <div class="card">
          <div class="card-body flex flex-wrap items-end gap-3">
            <label class="block"><span class="field-label">{{ 'ledger.setup.startDate' | translate }}</span>
              <input type="date" class="input-field" [disabled]="!canWrite() || busy()" [ngModel]="startDate()" (ngModelChange)="startDate.set($event)" /></label>
            @if (canWrite()) {
              <button class="btn-secondary" [disabled]="busy() || !startDate() || startDate() === (s.startDate ?? '')" (click)="saveStartDate()">{{ 'ledger.save' | translate }}</button>
            }
            <p class="text-xs text-ink-3 basis-full sm:basis-auto sm:flex-1 min-w-48">{{ 'ledger.setup.startDateHint' | translate }}</p>
            @if (canClose()) {
              <button class="btn-secondary ms-auto" [disabled]="busy()" (click)="repost()"><mat-icon>history</mat-icon>{{ 'ledger.setup.repost' | translate }}</button>
            }
          </div>
          @if (repostResult(); as r) {
            <div class="card-footer space-y-2">
              <div class="alert text-sm" [class.alert-success]="!(r.errors?.length)" [class.alert-warning]="!!r.errors?.length">
                <span>{{ 'ledger.setup.repostDone' | translate: { posted: r.posted, skipped: r.skipped, errors: r.errors?.length ?? 0 } }}</span>
              </div>
              @if (r.errors?.length) {
                <div class="table-card">
                  <div class="overflow-x-auto">
                    <table class="data-table is-dense">
                      <thead><tr>
                        <th>{{ 'ledger.entries.source' | translate }}</th>
                        <th>{{ 'ledger.label' | translate }}</th>
                        <th>{{ 'ledger.setup.repostError' | translate }}</th>
                      </tr></thead>
                      <tbody>
                        @for (e of r.errors; track e.sourceType + e.sourceId) {
                          <tr>
                            <td class="whitespace-nowrap">{{ source(e.sourceType) }}</td>
                            <td class="cell-title">{{ e.label || '—' }}</td>
                            <td class="cell-muted min-w-48">{{ e.message || '—' }}</td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                </div>
              }
            </div>
          }
        </div>

        @if (!canWrite()) {
          <div class="alert alert-info text-sm"><mat-icon>lock</mat-icon><span>{{ 'ledger.setup.readOnly' | translate }}</span></div>
        }

        <div class="segmented max-w-full overflow-x-auto" role="group" [attr.aria-label]="'ledger.tab.setup' | translate">
          @for (x of sections; track x.key) {
            <button class="segmented__item" [class.is-active]="section() === x.key" [attr.aria-pressed]="section() === x.key" (click)="section.set(x.key)">
              {{ x.label | translate }}
            </button>
          }
        </div>

        @switch (section()) {
          @case ('groups') {
            <div class="space-y-4">
              @for (side of sides; track side) {
                <div class="table-card">
                  <div class="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-line">
                    <div class="min-w-0">
                      <h3 class="card-title">{{ ('ledger.setup.partnerGroups.' + side) | translate }}</h3>
                      <p class="text-xs text-ink-3">{{ ('ledger.setup.partnerGroupsHint.' + side) | translate }}</p>
                    </div>
                    @if (canWrite()) {
                      <button class="btn-ghost btn-sm ms-auto" [disabled]="busy()" (click)="openPartnerGroup(side)"><mat-icon>add</mat-icon>{{ 'ledger.setup.addGroup' | translate }}</button>
                    }
                  </div>
                  <div class="overflow-x-auto">
                    <table class="data-table">
                      <thead><tr>
                        <th>{{ 'ledger.code' | translate }}</th>
                        <th>{{ 'ledger.setup.name' | translate }}</th>
                        <th>{{ 'ledger.account' | translate }}</th>
                        <th class="col-actions"></th>
                      </tr></thead>
                      <tbody>
                        @for (g of partnerGroups(side); track g.id) {
                          <tr>
                            <td class="num cell-title whitespace-nowrap">{{ g.code }}
                              @if (g.isDefault) { <span class="badge badge-accent ms-1">{{ 'ledger.setup.default' | translate }}</span> }</td>
                            <td class="min-w-32 text-ink">{{ g.name }}</td>
                            <td class="min-w-56">
                              <app-ledger-picker [items]="accountOptions()" [value]="g.accountId ?? null" (valueChange)="setPartnerGroupAccount(g, $event)"
                                                 [placeholder]="g.accountCode || ('ledger.entries.pickAccount' | translate)" [emptyLabel]="'ledger.noMatch' | translate"
                                                 [ariaLabel]="'ledger.account' | translate" [disabled]="!canWrite() || busy()" />
                            </td>
                            <td class="col-actions whitespace-nowrap">
                              @if (canWrite()) {
                                <button class="btn-ghost btn-sm" [disabled]="busy()" (click)="editPartnerGroup(g)">{{ 'ledger.rename' | translate }}</button>
                                @if (!g.isDefault) {
                                  <button class="btn-ghost btn-sm" [disabled]="busy()" (click)="makeDefaultPartnerGroup(g)">{{ 'ledger.setup.makeDefault' | translate }}</button>
                                  <button class="btn-ghost btn-sm" [disabled]="busy()" (click)="removePartnerGroup(g)">{{ 'ledger.delete' | translate }}</button>
                                }
                              }
                            </td>
                          </tr>
                        } @empty {
                          <tr><td colspan="4" class="row-empty text-sm text-ink-3">{{ 'ledger.setup.noGroup' | translate }}</td></tr>
                        }
                      </tbody>
                    </table>
                  </div>
                </div>
              }
            </div>
            <div class="grid gap-4 mt-4 xl:grid-cols-2">
              @for (k of groupKinds; track k) {
                <div class="table-card">
                  <div class="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-line">
                    <div class="min-w-0">
                      <h3 class="card-title">{{ ('ledger.setup.' + k) | translate }}</h3>
                      <p class="text-xs text-ink-3">{{ ('ledger.setup.' + k + 'Hint') | translate }}</p>
                    </div>
                    @if (canWrite()) {
                      <button class="btn-ghost btn-sm ms-auto" [disabled]="busy()" (click)="openGroup(k)"><mat-icon>add</mat-icon>{{ 'ledger.setup.addGroup' | translate }}</button>
                    }
                  </div>
                  <div class="overflow-x-auto">
                    <table class="data-table">
                      <thead><tr>
                        <th>{{ 'ledger.code' | translate }}</th>
                        <th>{{ 'ledger.setup.name' | translate }}</th>
                        <th>{{ (k === 'product-groups' ? 'ledger.setup.vatCode' : 'ledger.setup.vatRule') | translate }}</th>
                        <th class="col-actions"></th>
                      </tr></thead>
                      <tbody>
                        @for (g of groups(k); track g.id) {
                          <tr>
                            <td class="num cell-title whitespace-nowrap">{{ g.code }}
                              @if (g.isDefault) { <span class="badge badge-accent ms-1">{{ 'ledger.setup.default' | translate }}</span> }</td>
                            <td class="min-w-32 text-ink">{{ g.name }}</td>
                            <td class="min-w-40">
                              @if (k === 'product-groups') {
                                <select class="input-field" [disabled]="!canWrite() || busy()" [attr.aria-label]="('ledger.setup.vatCode' | translate) + ' · ' + g.code"
                                        [ngModel]="g.vatCode ?? null" (ngModelChange)="setGroupVat(k, g, { vatCode: $event })">
                                  <option [ngValue]="null">{{ 'ledger.setup.vatCodeDefault' | translate }}</option>
                                  @for (c of vatCodes(); track c.code) { <option [ngValue]="c.code">{{ vatLabel(c.code) }}</option> }
                                </select>
                              } @else {
                                <div class="flex flex-wrap gap-2">
                                  <select class="input-field w-auto" [disabled]="!canWrite() || busy()" [attr.aria-label]="('ledger.setup.vatRule' | translate) + ' · ' + g.code"
                                          [ngModel]="g.vatRule ?? 'STANDARD'" (ngModelChange)="setGroupVat(k, g, { vatRule: $event, exemptVatCode: $event === 'EXEMPT' ? (g.exemptVatCode ?? firstExemptCode()) : null })">
                                    <option value="STANDARD">{{ 'ledger.setup.vatRule.STANDARD' | translate }}</option>
                                    <option value="EXEMPT">{{ 'ledger.setup.vatRule.EXEMPT' | translate }}</option>
                                  </select>
                                  @if (g.vatRule === 'EXEMPT') {
                                    <select class="input-field w-auto" [disabled]="!canWrite() || busy()" [attr.aria-label]="('ledger.setup.exemptVatCode' | translate) + ' · ' + g.code"
                                            [ngModel]="g.exemptVatCode ?? null" (ngModelChange)="setGroupVat(k, g, { vatRule: 'EXEMPT', exemptVatCode: $event })">
                                      @for (c of vatCodes(); track c.code) { <option [ngValue]="c.code">{{ vatLabel(c.code) }}</option> }
                                    </select>
                                  }
                                </div>
                              }
                            </td>
                            <td class="col-actions whitespace-nowrap">
                              @if (canWrite()) {
                                <button class="btn-ghost btn-sm" [disabled]="busy()" (click)="editGroup(k, g)">{{ 'ledger.rename' | translate }}</button>
                                @if (!g.isDefault) {
                                  <button class="btn-ghost btn-sm" [disabled]="busy()" (click)="makeDefaultGroup(k, g)">{{ 'ledger.setup.makeDefault' | translate }}</button>
                                  <button class="btn-ghost btn-sm" [disabled]="busy()" (click)="removeGroup(k, g)">{{ 'ledger.delete' | translate }}</button>
                                }
                              }
                            </td>
                          </tr>
                        } @empty {
                          <tr><td colspan="4" class="row-empty text-sm text-ink-3">{{ 'ledger.setup.noGroup' | translate }}</td></tr>
                        }
                      </tbody>
                    </table>
                  </div>
                </div>
              }
            </div>
          }

          @case ('general') {
            <div class="table-card">
              <div class="px-5 py-3 border-b border-line">
                <h3 class="card-title">{{ 'ledger.setup.general' | translate }}</h3>
                <p class="text-xs text-ink-3">{{ 'ledger.setup.generalHint' | translate }}</p>
              </div>
              <div class="overflow-x-auto">
                <table class="data-table">
                  <thead><tr>
                    <th>{{ 'ledger.setup.businessGroup' | translate }}</th>
                    @for (p of s.productGroups ?? []; track p.id) {
                      <th class="min-w-64"><span class="num">{{ p.code }}</span> · {{ p.name }}</th>
                    }
                  </tr></thead>
                  <tbody>
                    @for (b of s.businessGroups ?? []; track b.id) {
                      <tr>
                        <td class="whitespace-nowrap align-top">
                          <div class="num cell-title">{{ b.code }}</div>
                          <div class="cell-sub">{{ b.name }}</div>
                        </td>
                        @for (p of s.productGroups ?? []; track p.id) {
                          <td class="align-top">
                            @if (cell(b.id, p.id); as c) {
                              <div class="space-y-2">
                                <div><span class="field-label">{{ 'ledger.setup.sales' | translate }}</span>
                                  <app-ledger-picker [items]="accountOptions()" [value]="c.salesAccountId ?? null" (valueChange)="setGeneral(c, { salesAccountId: $event })"
                                                     [placeholder]="c.salesAccountCode || ('ledger.entries.pickAccount' | translate)" [emptyLabel]="'ledger.noMatch' | translate"
                                                     [ariaLabel]="('ledger.setup.sales' | translate) + ' · ' + b.code + ' · ' + p.code" [disabled]="!canWrite() || busy()" /></div>
                                <div><span class="field-label">{{ 'ledger.setup.purchases' | translate }}</span>
                                  <app-ledger-picker [items]="accountOptions()" [value]="c.purchaseAccountId ?? null" (valueChange)="setGeneral(c, { purchaseAccountId: $event })"
                                                     [placeholder]="c.purchaseAccountCode || ('ledger.entries.pickAccount' | translate)" [emptyLabel]="'ledger.noMatch' | translate"
                                                     [ariaLabel]="('ledger.setup.purchases' | translate) + ' · ' + b.code + ' · ' + p.code" [disabled]="!canWrite() || busy()" /></div>
                              </div>
                            } @else {
                              <span class="text-ink-3">—</span>
                            }
                          </td>
                        }
                      </tr>
                    } @empty {
                      <tr><td class="row-empty text-sm text-ink-3">{{ 'ledger.setup.noGroup' | translate }}</td></tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          }

          @case ('vat') {
            <div class="table-card">
              <div class="px-5 py-3 border-b border-line">
                <h3 class="card-title">{{ 'ledger.setup.vat' | translate }}</h3>
                <p class="text-xs text-ink-3">{{ 'ledger.setup.vatHint' | translate }}</p>
              </div>
              <div class="overflow-x-auto">
                <table class="data-table">
                  <thead><tr>
                    <th>{{ 'ledger.code' | translate }}</th>
                    <th>{{ 'ledger.setup.name' | translate }}</th>
                    <th class="col-num">{{ 'ledger.setup.rate' | translate }}</th>
                    <th>{{ 'ledger.setup.collected' | translate }}</th>
                    <th>{{ 'ledger.setup.recoverable' | translate }}</th>
                    <th>{{ 'ledger.setup.mention' | translate }}</th>
                  </tr></thead>
                  <tbody>
                    @for (v of s.vatSetup ?? []; track v.id) {
                      <tr>
                        <td class="num cell-title whitespace-nowrap">{{ v.code }}</td>
                        <td class="min-w-32 text-ink">{{ v.name }}
                          @if (v.exempt) { <span class="badge badge-neutral ms-1">{{ 'ledger.setup.exempt' | translate }}</span> }</td>
                        <td class="col-num num whitespace-nowrap">{{ rate(v.rate) }}</td>
                        @if (v.exempt) {
                          <td class="cell-muted">—</td><td class="cell-muted">—</td>
                        } @else {
                          <td class="min-w-56">
                            <app-ledger-picker [items]="accountOptions()" [value]="v.collectedAccountId ?? null" (valueChange)="setVat(v, { collectedAccountId: $event })"
                                               [placeholder]="v.collectedAccountCode || ('ledger.entries.pickAccount' | translate)" [emptyLabel]="'ledger.noMatch' | translate"
                                               [ariaLabel]="('ledger.setup.collected' | translate) + ' · ' + v.code" [disabled]="!canWrite() || busy()" />
                          </td>
                          <td class="min-w-56">
                            <app-ledger-picker [items]="accountOptions()" [value]="v.recoverableAccountId ?? null" (valueChange)="setVat(v, { recoverableAccountId: $event })"
                                               [placeholder]="v.recoverableAccountCode || ('ledger.entries.pickAccount' | translate)" [emptyLabel]="'ledger.noMatch' | translate"
                                               [ariaLabel]="('ledger.setup.recoverable' | translate) + ' · ' + v.code" [disabled]="!canWrite() || busy()" />
                          </td>
                        }
                        <td class="min-w-64">
                          <input class="input-field" maxlength="255" [disabled]="!canWrite() || busy()" [placeholder]="'ledger.setup.mentionHint' | translate"
                                 [attr.aria-label]="('ledger.setup.mention' | translate) + ' · ' + v.code"
                                 [ngModel]="v.mention ?? ''" (change)="setMention(v, $any($event.target).value)" />
                        </td>
                      </tr>
                    } @empty {
                      <tr><td colspan="6" class="row-empty text-sm text-ink-3">{{ 'ledger.setup.noVat' | translate }}</td></tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          }

          @case ('bank') {
            <div class="card mb-4">
              <div class="card-body space-y-3">
                <div>
                  <h3 class="card-title">{{ 'ledger.setup.bankPosting' | translate }}</h3>
                  <p class="text-xs text-ink-3">{{ 'ledger.setup.bankPostingHint' | translate }}</p>
                </div>
                <div class="grid gap-2 sm:grid-cols-2" role="radiogroup" [attr.aria-label]="'ledger.setup.bankPosting' | translate">
                  @for (m of bankModes; track m) {
                    <button type="button" role="radio" class="option-card option-card--row text-start" [class.is-selected]="bankMode() === m"
                            [attr.aria-checked]="bankMode() === m" [disabled]="!canWrite() || busy()" (click)="setBankMode(m)">
                      <mat-icon class="shrink-0">{{ m === 'ON_VALIDATION' ? 'fact_check' : 'bolt' }}</mat-icon>
                      <span>
                        <span class="block">{{ ('ledger.setup.bankMode.' + m) | translate }}</span>
                        <span class="text-xs font-normal text-ink-3">{{ ('ledger.setup.bankModeHint.' + m) | translate }}</span>
                      </span>
                    </button>
                  }
                </div>
              </div>
            </div>
            <div class="table-card">
              <div class="px-5 py-3 border-b border-line">
                <h3 class="card-title">{{ 'ledger.setup.bank' | translate }}</h3>
                <p class="text-xs text-ink-3">{{ 'ledger.setup.bankHint' | translate }}</p>
              </div>
              <div class="overflow-x-auto">
                <table class="data-table">
                  <thead><tr>
                    <th>{{ 'ledger.setup.bankAccount' | translate }}</th>
                    <th>{{ 'ledger.account' | translate }}</th>
                  </tr></thead>
                  <tbody>
                    @for (b of s.bankAccounts ?? []; track b.bankAccountId) {
                      <tr>
                        <td class="cell-title min-w-40">{{ b.bankAccountName }}</td>
                        <td class="min-w-56">
                          <app-ledger-picker [items]="accountOptions()" [value]="b.accountId ?? null" (valueChange)="setBank(b.bankAccountId, $event)"
                                             [placeholder]="b.accountCode || ('ledger.entries.pickAccount' | translate)" [emptyLabel]="'ledger.noMatch' | translate"
                                             [ariaLabel]="('ledger.account' | translate) + ' · ' + b.bankAccountName" [disabled]="!canWrite() || busy()" />
                        </td>
                      </tr>
                    }
                    <tr>
                      <td class="cell-title min-w-40">{{ 'ledger.setup.cash' | translate }}</td>
                      <td class="min-w-56">
                        <app-ledger-picker [items]="accountOptions()" [value]="s.cashAccountId ?? null" (valueChange)="setCash($event)"
                                           [placeholder]="s.cashAccountCode || ('ledger.entries.pickAccount' | translate)" [emptyLabel]="'ledger.noMatch' | translate"
                                           [ariaLabel]="'ledger.setup.cash' | translate" [disabled]="!canWrite() || busy()" />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          }

          @case ('categories') {
            <div class="grid gap-4 xl:grid-cols-2">
              @for (k of categoryKinds; track k) {
                <div class="table-card">
                  <div class="px-5 py-3 border-b border-line">
                    <h3 class="card-title">{{ ('ledger.setup.' + k) | translate }}</h3>
                    <p class="text-xs text-ink-3">{{ ('ledger.setup.' + k + 'Hint') | translate }}</p>
                  </div>
                  <div class="overflow-x-auto">
                    <table class="data-table">
                      <thead><tr>
                        <th>{{ 'ledger.setup.category' | translate }}</th>
                        <th>{{ 'ledger.account' | translate }}</th>
                      </tr></thead>
                      <tbody>
                        @for (c of categoryRows(k); track c.category) {
                          <tr>
                            <td class="text-ink min-w-32">{{ categoryName(k, c.category) }}</td>
                            <td class="min-w-56">
                              <app-ledger-picker [items]="accountOptions()" [value]="c.accountId ?? null" (valueChange)="setCategory(k, c.category, $event)"
                                                 [placeholder]="c.accountCode || ('ledger.entries.pickAccount' | translate)" [emptyLabel]="'ledger.noMatch' | translate"
                                                 [ariaLabel]="('ledger.account' | translate) + ' · ' + categoryName(k, c.category)" [disabled]="!canWrite() || busy()" />
                            </td>
                          </tr>
                        } @empty {
                          <tr><td colspan="2" class="row-empty text-sm text-ink-3">{{ 'ledger.setup.noCategory' | translate }}</td></tr>
                        }
                      </tbody>
                    </table>
                  </div>
                </div>
              }
            </div>
          }
        }
      } @else {
        <div class="table-card">
          <app-empty-state icon="tune" [title]="(loading() ? 'ledger.loading' : 'ledger.setup.unavailableTitle') | translate"
                           [text]="loading() ? '' : ('ledger.setup.unavailableText' | translate)" />
        </div>
      }
    </div>

    @if (form(); as f) {
      <div class="modal-backdrop">
        <div class="modal modal-md" role="dialog" aria-modal="true" aria-labelledby="ledger-group-title">
          <div class="modal-header">
            <h3 id="ledger-group-title" class="modal-title">{{ formTitle(f) | translate }}</h3>
            <button class="btn-icon btn-sm" (click)="form.set(null)" [attr.aria-label]="'ledger.cancel' | translate"><mat-icon class="icon-sm">close</mat-icon></button>
          </div>
          <fieldset class="space-y-3" [disabled]="busy()">
            <label class="block"><span class="field-label">{{ 'ledger.code' | translate }}</span>
              <input class="input-field num" maxlength="20" [disabled]="!!f.id" [(ngModel)]="f.code" /></label>
            <label class="block"><span class="field-label">{{ 'ledger.setup.name' | translate }}</span>
              <input class="input-field" maxlength="100" [(ngModel)]="f.name" /></label>
            @if (f.kind === 'partner') {
              <div class="block"><span class="field-label">{{ 'ledger.account' | translate }}</span>
                <app-ledger-picker [items]="accountOptions()" [(value)]="f.accountId" [placeholder]="'ledger.entries.pickAccount' | translate"
                                   [emptyLabel]="'ledger.noMatch' | translate" [ariaLabel]="'ledger.account' | translate" [disabled]="busy()" />
                <span class="field-hint">{{ ('ledger.setup.partnerGroupsHint.' + f.side) | translate }}</span></div>
            } @else if (!f.id) {
              <p class="text-xs text-ink-3">{{ 'ledger.setup.newGroupHint' | translate }}</p>
            }
          </fieldset>
          <div class="modal-footer">
            <button class="btn-secondary" (click)="form.set(null)">{{ 'ledger.cancel' | translate }}</button>
            <button class="btn-primary" [disabled]="busy() || !formValid(f)" (click)="saveForm(f)">{{ 'ledger.save' | translate }}</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class LedgerSetupComponent implements OnInit {
  private api = inject(LedgerApi);
  private store = inject(LedgerGroupsStore);
  private toast = inject(ToastService);
  private i18n = inject(TranslationService);
  private state = inject(CrmStateService);
  private confirm = inject(ConfirmService);

  readonly sections: { key: Section; label: string }[] = [
    { key: 'groups', label: 'ledger.setup.section.groups' },
    { key: 'general', label: 'ledger.setup.section.general' },
    { key: 'vat', label: 'ledger.setup.section.vat' },
    { key: 'bank', label: 'ledger.setup.section.bank' },
    { key: 'categories', label: 'ledger.setup.section.categories' },
  ];
  readonly sides: PartnerGroupSide[] = ['CUSTOMER', 'SUPPLIER'];
  readonly groupKinds: GroupKind[] = ['business-groups', 'product-groups'];
  readonly categoryKinds: ('bank-categories' | 'expense-categories')[] = ['bank-categories', 'expense-categories'];
  readonly bankModes: BankPostingMode[] = ['ON_VALIDATION', 'ON_IMPORT'];

  setup = signal<PostingSetup | null>(null);
  accounts = signal<LedgerAccount[]>([]);
  loading = signal(true);
  busy = signal(false);
  section = signal<Section>('groups');
  startDate = signal('');
  form = signal<GroupForm | null>(null);
  repostResult = signal<RepostResult | null>(null);

  accountOptions = computed<PickerOption[]>(() => this.accounts().map(a => ({ id: a.id, code: a.code, label: a.name })));
  private cells = computed(() => {
    const m = new Map<string, GeneralSetupRow>();
    for (const r of this.setup()?.generalSetup ?? []) m.set(`${r.businessGroupId}|${r.productGroupId}`, r);
    return m;
  });

  vatCodes = computed(() => this.setup()?.vatSetup ?? []);
  bankMode = computed<BankPostingMode>(() => this.setup()?.bankPostingMode ?? 'ON_VALIDATION');

  canWrite(): boolean { return this.state.hasAuthority('LEDGER_WRITE'); }
  canClose(): boolean { return this.state.hasAuthority('LEDGER_CLOSE'); }

  ngOnInit(): void {
    this.api.accounts().subscribe({ next: a => this.accounts.set(a ?? []), error: e => this.fail(e) });
    this.api.postingSetup().subscribe({
      next: s => { this.apply(s); this.loading.set(false); },
      // A server without phase 2 answers 404: the empty state says the setup is not available.
      error: () => this.loading.set(false),
    });
  }

  partnerGroups(side: PartnerGroupSide): PartnerGroup[] {
    return (this.setup()?.partnerGroups ?? []).filter(g => g.side === side);
  }

  groups(k: GroupKind): PostingGroup[] {
    return (k === 'business-groups' ? this.setup()?.businessGroups : this.setup()?.productGroups) ?? [];
  }

  cell(businessGroupId: string, productGroupId: string): GeneralSetupRow | undefined {
    return this.cells().get(`${businessGroupId}|${productGroupId}`);
  }

  categoryRows(k: 'bank-categories' | 'expense-categories') {
    return (k === 'bank-categories' ? this.setup()?.bankCategories : this.setup()?.expenseCategories) ?? [];
  }

  categoryName(k: 'bank-categories' | 'expense-categories', c: string): string {
    if (k === 'bank-categories') return categoryLabel(this.i18n, c);
    const key = `expenses.cat.${c}`;
    const label = this.i18n.t(key);
    return label === key ? c.charAt(0) + c.slice(1).toLowerCase().replace(/_/g, ' ') : label;
  }

  // Accounts
  setPartnerGroupAccount(g: PartnerGroup, accountId: string | null): void {
    if (!accountId || accountId === g.accountId) return;
    this.write(this.api.updatePartnerGroup(g.id, { accountId }));
  }

  setGeneral(c: GeneralSetupRow, patch: { salesAccountId?: string | null; purchaseAccountId?: string | null }): void {
    const next = { salesAccountId: c.salesAccountId ?? null, purchaseAccountId: c.purchaseAccountId ?? null, ...patch };
    if (next.salesAccountId === (c.salesAccountId ?? null) && next.purchaseAccountId === (c.purchaseAccountId ?? null)) return;
    this.write(this.api.updateGeneralSetup(c.id, next));
  }

  setVat(v: VatSetupRow, patch: { collectedAccountId?: string | null; recoverableAccountId?: string | null }): void {
    const next = { collectedAccountId: v.collectedAccountId ?? null, recoverableAccountId: v.recoverableAccountId ?? null, ...patch };
    if (next.collectedAccountId === (v.collectedAccountId ?? null) && next.recoverableAccountId === (v.recoverableAccountId ?? null)) return;
    this.write(this.api.updateVatSetup(v.id, next));
  }

  setMention(v: VatSetupRow, value: string): void {
    const mention = value.trim() || null;
    if (mention === (v.mention ?? null)) return;
    this.write(this.api.updateVatSetup(v.id, {
      collectedAccountId: v.collectedAccountId ?? null, recoverableAccountId: v.recoverableAccountId ?? null, mention,
    }));
  }

  setGroupVat(kind: GroupKind, g: PostingGroup, patch: { vatCode?: string | null; vatRule?: VatRule; exemptVatCode?: string | null }): void {
    if (kind === 'product-groups') {
      if ((patch.vatCode ?? null) === (g.vatCode ?? null)) return;
      this.write(this.api.updateGroup(kind, g.id, { vatCode: patch.vatCode ?? null }));
      return;
    }
    const vatRule = patch.vatRule ?? g.vatRule ?? 'STANDARD';
    const exemptVatCode = vatRule === 'EXEMPT' ? (patch.exemptVatCode ?? g.exemptVatCode ?? null) : null;
    if (vatRule === (g.vatRule ?? 'STANDARD') && exemptVatCode === (g.exemptVatCode ?? null)) return;
    this.write(this.api.updateGroup(kind, g.id, { vatRule, exemptVatCode }));
  }

  /** The code an EXEMPT business group starts with. */
  firstExemptCode(): string | null {
    const codes = this.vatCodes();
    return codes.find(c => c.code === 'EXPORT')?.code ?? codes.find(c => c.exempt)?.code ?? null;
  }

  vatLabel(code: string): string { return this.store.vatLabel(code); }

  setBankMode(mode: BankPostingMode): void {
    if (mode !== this.bankMode()) this.write(this.api.updateBankPostingMode(mode));
  }

  setBank(bankAccountId: string, accountId: string | null): void {
    if (accountId) this.write(this.api.updateBankSetup(bankAccountId, accountId));
  }

  setCash(accountId: string | null): void {
    if (accountId && accountId !== this.setup()?.cashAccountId) this.write(this.api.updateCashSetup(accountId));
  }

  setCategory(k: 'bank-categories' | 'expense-categories', category: string, accountId: string | null): void {
    if (accountId) this.write(this.api.updateCategorySetup(k, category, accountId));
  }

  saveStartDate(): void {
    const d = this.startDate();
    if (d) this.write(this.api.updateStartDate(d), 'ledger.setup.startDateSaved');
  }

  // Groups
  openPartnerGroup(side: PartnerGroupSide): void {
    this.form.set({ kind: 'partner', code: '', name: '', side, accountId: null });
  }

  editPartnerGroup(g: PartnerGroup): void {
    this.form.set({ kind: 'partner', id: g.id, code: g.code, name: g.name, side: g.side, accountId: g.accountId ?? null });
  }

  openGroup(kind: GroupKind): void {
    this.form.set({ kind, code: '', name: '', side: 'CUSTOMER', accountId: null });
  }

  editGroup(kind: GroupKind, g: PostingGroup): void {
    this.form.set({ kind, id: g.id, code: g.code, name: g.name, side: 'CUSTOMER', accountId: null });
  }

  formTitle(f: GroupForm): string {
    const what = f.kind === 'partner' ? `partnerGroups.${f.side}` : f.kind;
    return `ledger.setup.${f.id ? 'edit' : 'add'}.${what}`;
  }

  formValid(f: GroupForm): boolean {
    return !!f.code.trim() && !!f.name.trim() && (f.kind !== 'partner' || !!f.accountId);
  }

  saveForm(f: GroupForm): void {
    const code = f.code.trim();
    const name = f.name.trim();
    let call: Observable<PostingSetup>;
    if (f.kind === 'partner') {
      call = f.id
        ? this.api.updatePartnerGroup(f.id, { name, accountId: f.accountId ?? undefined })
        : this.api.createPartnerGroup({ code, name, side: f.side, accountId: f.accountId as string });
    } else {
      call = f.id ? this.api.updateGroup(f.kind, f.id, { name }) : this.api.createGroup(f.kind, { code, name });
    }
    this.write(call, f.id ? 'ledger.setup.groupSaved' : 'ledger.setup.groupCreated', () => this.form.set(null));
  }

  makeDefaultPartnerGroup(g: PartnerGroup): void {
    this.write(this.api.updatePartnerGroup(g.id, { isDefault: true }));
  }

  makeDefaultGroup(kind: GroupKind, g: PostingGroup): void {
    this.write(this.api.updateGroup(kind, g.id, { isDefault: true }));
  }

  async removePartnerGroup(g: PartnerGroup): Promise<void> {
    if (!(await this.askDelete(g.code))) return;
    this.write(this.api.deletePartnerGroup(g.id), 'ledger.setup.groupDeleted');
  }

  async removeGroup(kind: GroupKind, g: PostingGroup): Promise<void> {
    if (!(await this.askDelete(g.code))) return;
    this.write(this.api.deleteGroup(kind, g.id), 'ledger.setup.groupDeleted');
  }

  private askDelete(code: string): Promise<boolean> {
    return this.confirm.ask({
      title: this.i18n.t('ledger.setup.confirmDelete', { code }),
      message: this.i18n.t('ledger.setup.confirmDeleteText'),
      confirmLabel: this.i18n.t('ledger.delete'),
      danger: true,
    });
  }

  // History
  async repost(): Promise<void> {
    const ok = await this.confirm.ask({
      title: this.i18n.t('ledger.setup.repostTitle'),
      message: this.i18n.t('ledger.setup.repostText', { date: shortDate(this.setup()?.startDate) }),
      confirmLabel: this.i18n.t('ledger.setup.repost'),
    });
    if (!ok) return;
    this.busy.set(true);
    this.repostResult.set(null);
    this.api.repost().subscribe({
      next: r => {
        this.busy.set(false);
        this.repostResult.set({ posted: r?.posted ?? 0, skipped: r?.skipped ?? 0, errors: r?.errors ?? [] });
      },
      error: e => this.fail(e),
    });
  }

  rate(r: number | null | undefined): string {
    const n = Number(r) || 0;
    return `${n.toLocaleString('fr-MA', { maximumFractionDigits: 2 })} %`;
  }

  source(s: string | null | undefined): string { return sourceLabel(this.i18n, s); }

  /** Every write answers with the whole setup; a DELETE that answers nothing reloads it. */
  private write(call: Observable<PostingSetup | null>, doneKey = 'ledger.setup.saved', after?: () => void): void {
    this.busy.set(true);
    call.subscribe({
      next: s => {
        this.busy.set(false);
        after?.();
        this.toast.show(this.i18n.t(doneKey), { type: 'success' });
        if (s) this.apply(s);
        else this.api.postingSetup().subscribe({ next: x => this.apply(x), error: e => this.fail(e) });
      },
      error: e => this.fail(e),
    });
  }

  private apply(s: PostingSetup): void {
    this.setup.set(s);
    this.startDate.set(s?.startDate ?? '');
    this.store.replace(s);
  }

  private fail(e: unknown): void {
    this.busy.set(false);
    this.toast.show(errorDetail(e) || this.i18n.t('ledger.error'), { type: 'error' });
  }
}
