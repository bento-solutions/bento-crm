import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '../pipes/translate.pipe';
import { TranslationService } from '../services/translation.service';
import { ToastService } from '../services/toast.service';
import { CrmStateService } from '../services/crm-state.service';
import { PageHeaderComponent } from '../shared/ui/page-header.component';
import { InventoryApi, IssueTrigger, Warehouse } from '../services/domains/inventory.service';

interface WarehouseForm { id?: string; name: string; code: string; address: string }

/**
 * Settings → Stock: when sold goods leave the stock (deal won, invoice sent, or only by hand),
 * whether delivered purchase orders add to it, and the list of warehouses.
 */
@Component({
  selector: 'app-settings-stock',
  imports: [FormsModule, MatIconModule, TranslatePipe, PageHeaderComponent],
  template: `
    <div class="page max-w-3xl">
      <app-page-header size="section" [title]="'stockSettings.title' | translate" [subtitle]="'stockSettings.subtitle' | translate" />

      <section class="card">
        <div class="card-header">
          <h3 class="card-title">{{ 'stockSettings.trigger' | translate }}</h3>
        </div>
        <div class="card-body space-y-5">
          <div role="radiogroup" [attr.aria-label]="'stockSettings.trigger' | translate" class="space-y-2">
            @for (t of triggers; track t) {
              <label class="choice-row">
                <input type="radio" name="trigger" class="mt-1" [value]="t" [checked]="trigger() === t"
                       [disabled]="!canWrite()" (change)="trigger.set(t)" />
                <span>
                  <span class="row-title">{{ 'stockSettings.trigger.' + t | translate }}</span>
                  <span class="row-hint">{{ 'stockSettings.triggerHint.' + t | translate }}</span>
                </span>
              </label>
            }
          </div>

          <label class="switch-row" for="stock-receive-on-delivery">
            <button type="button" id="stock-receive-on-delivery" role="switch" class="switch" [attr.aria-checked]="receiveOnDelivery()"
                    [disabled]="!canWrite()" [attr.aria-label]="'stockSettings.receiveOnDelivery' | translate"
                    (click)="receiveOnDelivery.set(!receiveOnDelivery())"></button>
            <span>
              <span class="row-title">{{ 'stockSettings.receiveOnDelivery' | translate }}</span>
              <span class="row-hint">{{ 'stockSettings.receiveOnDeliveryHint' | translate }}</span>
            </span>
          </label>

          <div class="alert alert-info">{{ 'stockSettings.matching' | translate }}</div>
        </div>
        @if (canWrite()) {
          <div class="card-footer">
            <button type="button" class="btn-primary" [disabled]="busy()" (click)="saveSettings()">{{ 'stockSettings.save' | translate }}</button>
          </div>
        }
      </section>

      <section class="card">
        <div class="card-header">
          <h3 class="card-title">{{ 'stockSettings.warehouses' | translate }}</h3>
          @if (canWrite()) {
            <button type="button" class="btn-secondary btn-sm" (click)="edit({ name: '', code: '', address: '' })">
              <mat-icon class="icon-sm">add</mat-icon>{{ 'stockSettings.addWarehouse' | translate }}
            </button>
          }
        </div>
        @for (w of warehouses(); track w.id) {
          <div class="list-row" [class.opacity-50]="!w.isActive">
            <div class="list-row__main">
              <div class="flex flex-wrap items-center gap-2">
                <span class="row-title">{{ w.name }}</span>
                @if (w.code) { <code class="count-pill" dir="ltr">{{ w.code }}</code> }
                @if (w.isDefault) { <span class="badge badge-accent">{{ 'stockSettings.default' | translate }}</span> }
                @if (!w.isActive) { <span class="badge badge-neutral">{{ 'stockSettings.archived' | translate }}</span> }
              </div>
              @if (w.address) { <span class="row-hint">{{ w.address }}</span> }
            </div>
            @if (canWrite()) {
              <div class="list-row__actions">
                @if (!w.isDefault && w.isActive) {
                  <button class="btn-ghost btn-sm" [disabled]="busy()" (click)="update(w, { isDefault: true })">{{ 'stockSettings.makeDefault' | translate }}</button>
                }
                <button class="btn-ghost btn-sm" (click)="edit({ id: w.id, name: w.name, code: w.code || '', address: w.address || '' })">{{ 'stockSettings.edit' | translate }}</button>
                @if (!w.isDefault) {
                  <button class="btn-ghost btn-sm" [disabled]="busy()" (click)="update(w, { isActive: !w.isActive })">
                    {{ (w.isActive ? 'stockSettings.archive' : 'stockSettings.restore') | translate }}
                  </button>
                }
              </div>
            }
          </div>
        }
      </section>

      @if (form(); as f) {
        <div class="modal-backdrop">
          <div class="modal modal-md" role="dialog" aria-modal="true">
            <div class="modal-header">
              <h3 class="modal-title">{{ (f.id ? 'stockSettings.editWarehouse' : 'stockSettings.addWarehouse') | translate }}</h3>
              <button class="btn-icon btn-sm" (click)="form.set(null)" [attr.aria-label]="'stockSettings.cancel' | translate"><mat-icon class="icon-sm">close</mat-icon></button>
            </div>
            <div class="space-y-3">
              <label class="field"><span class="field-label">{{ 'stockSettings.name' | translate }}</span>
                <input class="input-field" maxlength="120" [(ngModel)]="f.name" /></label>
              <label class="field"><span class="field-label">{{ 'stockSettings.code' | translate }}</span>
                <input class="input-field" maxlength="30" [(ngModel)]="f.code" /></label>
              <label class="field"><span class="field-label">{{ 'stockSettings.address' | translate }}</span>
                <input class="input-field" [(ngModel)]="f.address" /></label>
            </div>
            <div class="modal-footer">
              <button class="btn-secondary" (click)="form.set(null)">{{ 'stockSettings.cancel' | translate }}</button>
              <button class="btn-primary" [disabled]="busy() || !f.name.trim()" (click)="saveWarehouse(f)">{{ 'stockSettings.save' | translate }}</button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class SettingsStockComponent implements OnInit {
  private api = inject(InventoryApi);
  private toast = inject(ToastService);
  private i18n = inject(TranslationService);
  private state = inject(CrmStateService);

  readonly triggers: IssueTrigger[] = ['INVOICE_SENT', 'DEAL_WON', 'MANUAL'];
  trigger = signal<IssueTrigger>('INVOICE_SENT');
  receiveOnDelivery = signal(true);
  warehouses = signal<Warehouse[]>([]);
  form = signal<WarehouseForm | null>(null);
  busy = signal(false);

  canWrite(): boolean {
    return this.state.hasAuthority('ADMIN_ACCESS');
  }

  ngOnInit(): void {
    this.api.settings().subscribe({
      next: s => {
        this.trigger.set(s.issueTrigger);
        this.receiveOnDelivery.set(s.receiveOnDelivery);
      },
      error: e => this.fail(e),
    });
    this.loadWarehouses();
  }

  saveSettings(): void {
    this.busy.set(true);
    this.api.saveSettings({ issueTrigger: this.trigger(), receiveOnDelivery: this.receiveOnDelivery() }).subscribe({
      next: () => this.done(),
      error: e => this.fail(e),
    });
  }

  edit(f: WarehouseForm): void {
    this.form.set({ ...f });
  }

  saveWarehouse(f: WarehouseForm): void {
    const existing = f.id ? this.warehouses().find(w => w.id === f.id) : undefined;
    this.busy.set(true);
    this.api.saveWarehouse({
      name: f.name.trim(), code: f.code, address: f.address,
      isDefault: existing?.isDefault, isActive: existing?.isActive ?? true,
    }, f.id).subscribe({
      next: () => this.done(() => this.form.set(null)),
      error: e => this.fail(e),
    });
  }

  update(w: Warehouse, change: Partial<Warehouse>): void {
    this.busy.set(true);
    this.api.saveWarehouse({
      name: w.name, code: w.code, address: w.address, isDefault: w.isDefault, isActive: w.isActive, ...change,
    }, w.id).subscribe({
      next: () => this.done(),
      error: e => this.fail(e),
    });
  }

  private loadWarehouses(): void {
    this.api.warehouses().subscribe({ next: list => this.warehouses.set(list), error: e => this.fail(e) });
  }

  private done(then?: () => void): void {
    this.busy.set(false);
    then?.();
    this.loadWarehouses();
    this.toast.show(this.i18n.t('stockSettings.saved'), { type: 'success' });
  }

  private fail(e: unknown): void {
    this.busy.set(false);
    const err = e as { error?: { detail?: string } };
    this.toast.show(err?.error?.detail || this.i18n.t('stockSettings.error'), { type: 'error' });
  }
}
