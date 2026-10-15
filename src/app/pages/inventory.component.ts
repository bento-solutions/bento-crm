import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../pipes/translate.pipe';
import { TranslationService } from '../services/translation.service';
import { ToastService } from '../services/toast.service';
import { CrmStateService } from '../services/crm-state.service';
import { PageHeaderComponent } from '../shared/ui/page-header.component';
import { StatCardComponent } from '../shared/ui/stat-card.component';
import { EmptyStateComponent } from '../shared/ui/empty-state.component';
import {
  CatalogProduct, InventoryApi, MovementType, StockLevel, StockMovement, Valuation, Warehouse,
} from '../services/domains/inventory.service';

type Tab = 'stock' | 'products' | 'movements' | 'value';
type MoveKind = 'receive' | 'issue' | 'transfer';

interface ProductForm {
  id?: string;
  sku: string;
  name: string;
  category: string;
  unitPrice: number | null;
  costPrice: number | null;
  vatPercent: number | null;
  trackStock: boolean;
  reorderLevel: number | null;
}

/**
 * Inventory: the product catalogue, on-hand stock per warehouse, the movement history and the
 * stock value. Receipts and issues also happen automatically (delivered purchase orders, sent
 * invoices or confirmed deals, per Settings → Stock); this page is for everything done by hand.
 */
@Component({
  selector: 'app-inventory',
  imports: [FormsModule, MatIconModule, RouterLink, TranslatePipe, PageHeaderComponent, StatCardComponent, EmptyStateComponent],
  template: `
    <div class="page">
      <app-page-header [title]="'inventory.title' | translate" [subtitle]="'inventory.subtitle' | translate">
        <div actions class="flex flex-wrap gap-2">
          @if (canMove()) {
            <button class="btn-secondary" (click)="openMove('receive')"><mat-icon>add_box</mat-icon>{{ 'inventory.receive' | translate }}</button>
            <button class="btn-secondary" (click)="openMove('issue')"><mat-icon>outbox</mat-icon>{{ 'inventory.issue' | translate }}</button>
            <button class="btn-secondary" (click)="openMove('transfer')"><mat-icon>sync_alt</mat-icon>{{ 'inventory.transfer' | translate }}</button>
            <button class="btn-secondary" (click)="openCount()"><mat-icon>fact_check</mat-icon>{{ 'inventory.count' | translate }}</button>
          }
          @if (canEditProducts()) {
            <button class="btn-primary" (click)="openProduct()"><mat-icon>add</mat-icon>{{ 'inventory.newProduct' | translate }}</button>
          }
        </div>
      </app-page-header>

      @if (valuation(); as v) {
        <div class="stat-grid">
          <app-stat-card [label]="'inventory.stockValue' | translate" [value]="money0(v.totalValue)" icon="inventory_2" tone="slate"
                         [hint]="'inventory.atCost' | translate" />
          <app-stat-card [label]="'inventory.units' | translate" [value]="qty(v.totalUnits)" icon="widgets" tone="blue"
                         [hint]="'inventory.trackedProducts' | translate: { n: v.products }" />
          <app-stat-card [label]="'inventory.lowStock' | translate" [value]="v.lowStock" icon="production_quantity_limits" tone="rose"
                         [hint]="'inventory.lowStockHint' | translate" />
        </div>
      }

      <div class="tabs" role="tablist">
        @for (t of tabs; track t.key) {
          <button role="tab" class="tab" [class.is-active]="tab() === t.key" [attr.aria-selected]="tab() === t.key" (click)="setTab(t.key)">
            <mat-icon>{{ t.icon }}</mat-icon>{{ t.label | translate }}
          </button>
        }
      </div>

      @if (tab() === 'stock') {
        <div class="flex flex-wrap items-center gap-3">
          <select class="input-field w-auto" [ngModel]="warehouseFilter()" (ngModelChange)="warehouseFilter.set($event)" [attr.aria-label]="'inventory.warehouse' | translate">
            <option [ngValue]="null">{{ 'inventory.allWarehouses' | translate }}</option>
            @for (w of warehouses(); track w.id) { <option [ngValue]="w.id">{{ w.name }}</option> }
          </select>
          <input class="input-field w-56" [placeholder]="'inventory.search' | translate" [ngModel]="search()" (ngModelChange)="search.set($event)" />
          <div class="flex items-center gap-2 text-sm text-ink-2">
            <button type="button" role="switch" class="switch" [attr.aria-checked]="lowOnly()" (click)="lowOnly.set(!lowOnly())"
                    [attr.aria-label]="'inventory.lowOnly' | translate"></button>
            <span aria-hidden="true">{{ 'inventory.lowOnly' | translate }}</span>
          </div>
        </div>
        <div class="table-card">
          <table class="data-table">
            <thead><tr>
              <th>{{ 'inventory.product' | translate }}</th>
              <th>{{ 'inventory.warehouse' | translate }}</th>
              <th class="col-num">{{ 'inventory.onHand' | translate }}</th>
              <th class="col-num">{{ 'inventory.reorderAt' | translate }}</th>
              <th class="col-num">{{ 'inventory.value' | translate }}</th>
              <th class="col-actions"></th>
            </tr></thead>
            <tbody>
              @for (l of visibleLevels(); track l.productId + l.warehouseId) {
                <tr>
                  <td><div class="cell-title">{{ l.name }}</div><div class="cell-sub">{{ l.sku }}{{ l.category ? ' · ' + l.category : '' }}</div></td>
                  <td class="cell-muted">{{ l.warehouseName }}</td>
                  <td class="col-num">
                    <span class="num font-medium" [class.text-danger-ink]="l.quantity < 0">{{ qty(l.quantity) }}</span>
                    @if (l.low) { <span class="badge badge-danger ms-2">{{ 'inventory.low' | translate }}</span> }
                  </td>
                  <td class="col-num num cell-muted">{{ l.reorderLevel !== null && l.reorderLevel !== undefined ? qty(l.reorderLevel) : '—' }}</td>
                  <td class="col-num num">{{ money(l.value) }}</td>
                  <td class="col-actions">
                    <button class="btn-ghost btn-sm" (click)="showHistory(l.productId)">{{ 'inventory.history' | translate }}</button>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="6" class="row-empty">
                  <app-empty-state icon="inventory_2" [title]="'inventory.emptyTitle' | translate" [text]="'inventory.emptyText' | translate" />
                </td></tr>
              }
            </tbody>
          </table>
        </div>
      }

      @if (tab() === 'products') {
        <div class="table-card">
          <table class="data-table">
            <thead><tr>
              <th>{{ 'inventory.product' | translate }}</th>
              <th>{{ 'inventory.category' | translate }}</th>
              <th class="col-num">{{ 'inventory.price' | translate }}</th>
              <th class="col-num">{{ 'inventory.cost' | translate }}</th>
              <th class="col-num">{{ 'inventory.vat' | translate }}</th>
              <th>{{ 'inventory.stock' | translate }}</th>
              <th class="col-actions"></th>
            </tr></thead>
            <tbody>
              @for (p of products(); track p.id) {
                <tr>
                  <td><div class="cell-title">{{ p.name }}</div><div class="cell-sub">{{ p.sku }}</div></td>
                  <td class="cell-muted">{{ p.category || '—' }}</td>
                  <td class="col-num num">{{ money(p.unitPrice) }}</td>
                  <td class="col-num num cell-muted">{{ p.costPrice !== null && p.costPrice !== undefined ? money(p.costPrice) : '—' }}</td>
                  <td class="col-num num cell-muted">{{ percent(p.taxRate) }}</td>
                  <td>
                    @if (p.trackStock) { <span class="badge badge-success">{{ 'inventory.tracked' | translate }}</span> }
                    @else { <span class="badge badge-neutral">{{ 'inventory.notTracked' | translate }}</span> }
                  </td>
                  <td class="col-actions">
                    @if (canEditProducts()) { <button class="btn-ghost btn-sm" (click)="openProduct(p)">{{ 'inventory.edit' | translate }}</button> }
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="7" class="row-empty">
                  <app-empty-state icon="category" [title]="'inventory.noProducts' | translate" [text]="'inventory.noProductsText' | translate" />
                </td></tr>
              }
            </tbody>
          </table>
        </div>
      }

      @if (tab() === 'movements') {
        <div class="flex flex-wrap items-center gap-3">
          <select class="input-field w-auto" [ngModel]="historyProduct()" (ngModelChange)="showHistory($event)" [attr.aria-label]="'inventory.product' | translate">
            <option [ngValue]="null">{{ 'inventory.allProducts' | translate }}</option>
            @for (p of trackedProducts(); track p.id) { <option [ngValue]="p.id">{{ p.name }}</option> }
          </select>
        </div>
        <div class="table-card">
          <table class="data-table">
            <thead><tr>
              <th>{{ 'inventory.date' | translate }}</th>
              <th>{{ 'inventory.product' | translate }}</th>
              <th>{{ 'inventory.movement' | translate }}</th>
              <th>{{ 'inventory.warehouse' | translate }}</th>
              <th class="col-num">{{ 'inventory.qty' | translate }}</th>
              <th class="col-num">{{ 'inventory.balance' | translate }}</th>
              <th>{{ 'inventory.reference' | translate }}</th>
            </tr></thead>
            <tbody>
              @for (m of movements(); track m.id) {
                <tr>
                  <td class="cell-muted whitespace-nowrap">{{ dateTime(m.createdAt) }}</td>
                  <td class="cell-title">{{ m.productName }}</td>
                  <td><span class="badge" [class]="movementBadge(m.type)">{{ ('inventory.type.' + m.type) | translate }}</span></td>
                  <td class="cell-muted">{{ m.warehouseName }}</td>
                  <td class="col-num num" [class.text-danger-ink]="m.quantity < 0">{{ signed(m.quantity) }}</td>
                  <td class="col-num num">{{ qty(m.balanceAfter) }}</td>
                  <td class="cell-muted">{{ m.referenceLabel || m.note || '—' }}</td>
                </tr>
              } @empty {
                <tr><td colspan="7" class="row-empty">
                  <app-empty-state icon="swap_vert" [title]="'inventory.noMovements' | translate" />
                </td></tr>
              }
            </tbody>
          </table>
        </div>
      }

      @if (tab() === 'value' && valuation(); as v) {
        <div class="grid gap-4 md:grid-cols-2">
          @for (group of [{ title: 'inventory.byWarehouse', rows: v.byWarehouse }, { title: 'inventory.byCategory', rows: v.byCategory }]; track group.title) {
            <div class="table-card">
              <table class="data-table">
                <thead><tr>
                  <th>{{ group.title | translate }}</th>
                  <th class="col-num">{{ 'inventory.units' | translate }}</th>
                  <th class="col-num">{{ 'inventory.value' | translate }}</th>
                </tr></thead>
                <tbody>
                  @for (g of group.rows; track g.key) {
                    <tr>
                      <td class="cell-title">{{ g.label || ('inventory.uncategorised' | translate) }}</td>
                      <td class="col-num num">{{ qty(g.units) }}</td>
                      <td class="col-num num">{{ money(g.value) }}</td>
                    </tr>
                  } @empty {
                    <tr><td colspan="3" class="cell-muted">{{ 'inventory.noMovements' | translate }}</td></tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>
        <p class="text-xs text-ink-3">{{ 'inventory.valueNote' | translate }}</p>
      }
    </div>

    <!-- Product -->
    @if (productForm(); as f) {
      <div class="modal-backdrop">
        <div class="modal modal-md">
          <div class="modal-header">
            <h3 class="modal-title">{{ (f.id ? 'inventory.editProduct' : 'inventory.newProduct') | translate }}</h3>
            <button class="btn-icon btn-sm" (click)="productForm.set(null)" [attr.aria-label]="'inventory.cancel' | translate"><mat-icon class="icon-sm">close</mat-icon></button>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <label class="block col-span-2"><span class="field-label">{{ 'inventory.name' | translate }}</span>
              <input class="input-field" [(ngModel)]="f.name" maxlength="255" /></label>
            <label class="block"><span class="field-label">SKU</span>
              <input class="input-field" [(ngModel)]="f.sku" maxlength="64" /></label>
            <label class="block"><span class="field-label">{{ 'inventory.category' | translate }}</span>
              <input class="input-field" [(ngModel)]="f.category" maxlength="100" /></label>
            <label class="block"><span class="field-label">{{ 'inventory.price' | translate }}</span>
              <input type="number" min="0" step="0.01" class="input-field" [(ngModel)]="f.unitPrice" /></label>
            <label class="block"><span class="field-label">{{ 'inventory.cost' | translate }}</span>
              <input type="number" min="0" step="0.01" class="input-field" [(ngModel)]="f.costPrice" /></label>
            <label class="block"><span class="field-label">{{ 'inventory.vatPercent' | translate }}</span>
              <input type="number" min="0" max="100" step="0.1" class="input-field" [(ngModel)]="f.vatPercent" /></label>
            <label class="block"><span class="field-label">{{ 'inventory.reorderAt' | translate }}</span>
              <input type="number" min="0" step="1" class="input-field" [(ngModel)]="f.reorderLevel" [disabled]="!f.trackStock" /></label>
            <div class="col-span-2 flex items-start gap-3 mt-1">
              <button type="button" role="switch" class="switch mt-0.5 shrink-0" [attr.aria-checked]="f.trackStock"
                      [attr.aria-label]="'inventory.trackStock' | translate" (click)="f.trackStock = !f.trackStock"></button>
              <span><span class="text-sm font-medium text-ink block">{{ 'inventory.trackStock' | translate }}</span>
                <span class="text-xs text-ink-3">{{ 'inventory.trackStockHint' | translate }}</span></span>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-secondary" (click)="productForm.set(null)">{{ 'inventory.cancel' | translate }}</button>
            <button class="btn-primary" [disabled]="busy() || !f.name.trim() || !f.sku.trim() || f.unitPrice === null" (click)="saveProduct(f)">{{ 'inventory.save' | translate }}</button>
          </div>
        </div>
      </div>
    }

    <!-- Receive / issue / transfer -->
    @if (move(); as kind) {
      <div class="modal-backdrop">
        <div class="modal modal-md">
          <div class="modal-header">
            <h3 class="modal-title">{{ ('inventory.' + kind) | translate }}</h3>
            <button class="btn-icon btn-sm" (click)="move.set(null)" [attr.aria-label]="'inventory.cancel' | translate"><mat-icon class="icon-sm">close</mat-icon></button>
          </div>
          @if (trackedProducts().length === 0) {
            <div class="alert alert-info text-sm">{{ 'inventory.noTracked' | translate }}</div>
          } @else {
            <div class="grid grid-cols-2 gap-3">
              <label class="block col-span-2"><span class="field-label">{{ 'inventory.product' | translate }}</span>
                <select class="input-field" [(ngModel)]="moveProduct">
                  @for (p of trackedProducts(); track p.id) { <option [ngValue]="p.id">{{ p.name }} · {{ p.sku }}</option> }
                </select></label>
              <label class="block" [class.col-span-2]="kind !== 'transfer'"><span class="field-label">{{ (kind === 'transfer' ? 'inventory.from' : 'inventory.warehouse') | translate }}</span>
                <select class="input-field" [(ngModel)]="moveFrom">
                  @for (w of activeWarehouses(); track w.id) { <option [ngValue]="w.id">{{ w.name }}</option> }
                </select></label>
              @if (kind === 'transfer') {
                <label class="block"><span class="field-label">{{ 'inventory.to' | translate }}</span>
                  <select class="input-field" [(ngModel)]="moveTo">
                    @for (w of activeWarehouses(); track w.id) { <option [ngValue]="w.id">{{ w.name }}</option> }
                  </select></label>
              }
              <label class="block"><span class="field-label">{{ 'inventory.qty' | translate }}</span>
                <input type="number" min="0" step="1" class="input-field" [(ngModel)]="moveQty" /></label>
              @if (kind === 'receive') {
                <label class="block"><span class="field-label">{{ 'inventory.unitCost' | translate }}</span>
                  <input type="number" min="0" step="0.01" class="input-field" [(ngModel)]="moveCost" [placeholder]="'inventory.costDefault' | translate" /></label>
              }
              <label class="block col-span-2"><span class="field-label">{{ 'inventory.note' | translate }}</span>
                <input class="input-field" [(ngModel)]="moveNote" maxlength="2000" /></label>
            </div>
            @if (kind === 'transfer' && workingWarehouses() < 2) {
              <p class="text-xs text-ink-3 mt-2">{{ 'inventory.needTwoWarehouses' | translate }}
                <a routerLink="/settings/stock" class="text-ink underline">{{ 'inventory.addWarehouse' | translate }}</a></p>
            }
          }
          <div class="modal-footer">
            <button class="btn-secondary" (click)="move.set(null)">{{ 'inventory.cancel' | translate }}</button>
            <button class="btn-primary" [disabled]="busy() || !moveProduct || !(moveQty > 0) || (kind === 'transfer' && (!moveTo || moveTo === moveFrom))" (click)="saveMove(kind)">{{ 'inventory.save' | translate }}</button>
          </div>
        </div>
      </div>
    }

    <!-- Inventory count -->
    @if (counting()) {
      <div class="modal-backdrop">
        <div class="modal modal-lg">
          <div class="modal-header">
            <h3 class="modal-title">{{ 'inventory.count' | translate }}</h3>
            <button class="btn-icon btn-sm" (click)="counting.set(false)" [attr.aria-label]="'inventory.cancel' | translate"><mat-icon class="icon-sm">close</mat-icon></button>
          </div>
          <p class="text-sm text-ink-2">{{ 'inventory.countHint' | translate }}</p>
          <label class="block mt-3"><span class="field-label">{{ 'inventory.warehouse' | translate }}</span>
            <select class="input-field" [ngModel]="countWarehouse()" (ngModelChange)="startCount($event)">
              @for (w of warehouses(); track w.id) { <option [ngValue]="w.id">{{ w.name }}</option> }
            </select></label>
          <div class="table-card mt-3 max-h-[50vh] overflow-y-auto">
            <table class="data-table">
              <thead><tr>
                <th>{{ 'inventory.product' | translate }}</th>
                <th class="col-num">{{ 'inventory.onBooks' | translate }}</th>
                <th class="col-num">{{ 'inventory.counted' | translate }}</th>
              </tr></thead>
              <tbody>
                @for (row of countRows(); track row.productId) {
                  <tr>
                    <td><div class="cell-title">{{ row.name }}</div><div class="cell-sub">{{ row.sku }}</div></td>
                    <td class="col-num num cell-muted">{{ qty(row.quantity) }}</td>
                    <td class="col-num"><input type="number" min="0" step="1" class="input-field w-24 text-end num"
                               [(ngModel)]="row.counted" [attr.aria-label]="'inventory.counted' | translate" /></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <div class="modal-footer">
            <span class="text-xs text-ink-3 me-auto">{{ 'inventory.changes' | translate: { n: countChanges() } }}</span>
            <button class="btn-secondary" (click)="counting.set(false)">{{ 'inventory.cancel' | translate }}</button>
            <button class="btn-primary" [disabled]="busy()" (click)="saveCount()">{{ 'inventory.saveCount' | translate }}</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class InventoryComponent implements OnInit {
  private api = inject(InventoryApi);
  private toast = inject(ToastService);
  private i18n = inject(TranslationService);
  private state = inject(CrmStateService);

  readonly tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'stock', label: 'inventory.tabStock', icon: 'inventory_2' },
    { key: 'products', label: 'inventory.tabProducts', icon: 'category' },
    { key: 'movements', label: 'inventory.tabMovements', icon: 'swap_vert' },
    { key: 'value', label: 'inventory.tabValue', icon: 'payments' },
  ];

  tab = signal<Tab>('stock');
  products = signal<CatalogProduct[]>([]);
  warehouses = signal<Warehouse[]>([]);
  levels = signal<StockLevel[]>([]);
  movements = signal<StockMovement[]>([]);
  valuation = signal<Valuation | null>(null);
  busy = signal(false);

  warehouseFilter = signal<string | null>(null);
  search = signal('');
  lowOnly = signal(false);
  historyProduct = signal<string | null>(null);

  productForm = signal<ProductForm | null>(null);
  move = signal<MoveKind | null>(null);
  moveProduct: string | null = null;
  moveFrom: string | null = null;
  moveTo: string | null = null;
  moveQty = 1;
  moveCost: number | null = null;
  moveNote = '';

  counting = signal(false);
  countWarehouse = signal<string | null>(null);
  countRows = signal<(StockLevel & { counted: number })[]>([]);

  trackedProducts = computed(() => this.products().filter(p => p.trackStock));
  activeWarehouses = computed(() => this.warehouses().filter(w => w.isActive));
  workingWarehouses = computed(() => this.activeWarehouses().length);
  visibleLevels = computed(() => {
    const q = this.search().trim().toLowerCase();
    const w = this.warehouseFilter();
    return this.levels().filter(l =>
      (!w || l.warehouseId === w) && (!this.lowOnly() || l.low)
      && (!q || l.name.toLowerCase().includes(q) || l.sku.toLowerCase().includes(q)));
  });

  canMove(): boolean {
    // Matches the API: only admins and managers move stock by hand.
    return this.state.hasAuthority('PURCHASE_ORDERS_WRITE');
  }

  canEditProducts(): boolean {
    return this.state.hasAuthority('PARTNERS_WRITE') || this.state.hasAuthority('DEALS_WRITE');
  }

  ngOnInit(): void {
    this.state.breadcrumbLabel.set(this.i18n.t('inventory.title'));
    this.reload();
  }

  setTab(t: Tab): void {
    this.tab.set(t);
    if (t === 'movements') this.loadMovements();
  }

  private reload(): void {
    this.api.products().subscribe({ next: p => this.products.set(p), error: e => this.fail(e) });
    this.api.warehouses().subscribe({ next: w => this.warehouses.set(w), error: e => this.fail(e) });
    this.api.levels().subscribe({ next: l => this.levels.set(l), error: e => this.fail(e) });
    this.api.valuation().subscribe({ next: v => this.valuation.set(v), error: e => this.fail(e) });
    if (this.tab() === 'movements') this.loadMovements();
  }

  private loadMovements(): void {
    this.api.movements(this.historyProduct()).subscribe({ next: p => this.movements.set(p.content ?? []), error: e => this.fail(e) });
  }

  showHistory(productId: string | null): void {
    this.historyProduct.set(productId);
    this.tab.set('movements');
    this.loadMovements();
  }

  // Products
  openProduct(p?: CatalogProduct): void {
    this.productForm.set(p ? {
      id: p.id, sku: p.sku, name: p.name, category: p.category ?? '', unitPrice: p.unitPrice, costPrice: p.costPrice ?? null,
      vatPercent: p.taxRate !== null && p.taxRate !== undefined ? Math.round(p.taxRate * 1000) / 10 : 20,
      trackStock: !!p.trackStock, reorderLevel: p.reorderLevel ?? null,
    } : { sku: '', name: '', category: '', unitPrice: null, costPrice: null, vatPercent: 20, trackStock: true, reorderLevel: null });
  }

  saveProduct(f: ProductForm): void {
    this.busy.set(true);
    this.api.saveProduct({
      sku: f.sku.trim(), name: f.name.trim(), category: f.category.trim() || null, unitPrice: Number(f.unitPrice),
      costPrice: f.costPrice !== null && f.costPrice !== undefined ? Number(f.costPrice) : null,
      taxRate: f.vatPercent !== null && f.vatPercent !== undefined ? Number(f.vatPercent) / 100 : null,
      trackStock: f.trackStock, reorderLevel: f.trackStock && f.reorderLevel !== null ? Number(f.reorderLevel) : null,
      isActive: true,
    }, f.id).subscribe({
      next: () => this.done('inventory.productSaved', () => this.productForm.set(null)),
      error: e => this.fail(e),
    });
  }

  // Movements
  openMove(kind: MoveKind): void {
    const def = this.warehouses().find(w => w.isDefault) ?? this.warehouses()[0];
    this.moveProduct = this.trackedProducts()[0]?.id ?? null;
    this.moveFrom = def?.id ?? null;
    this.moveTo = this.activeWarehouses().find(w => w.id !== def?.id)?.id ?? null;
    this.moveQty = 1;
    this.moveCost = null;
    this.moveNote = '';
    this.move.set(kind);
  }

  saveMove(kind: MoveKind): void {
    if (!this.moveProduct) return;
    this.busy.set(true);
    const note = this.moveNote.trim() || undefined;
    const after = { next: () => this.done('inventory.saved', () => this.move.set(null)), error: (e: unknown) => this.fail(e) };
    if (kind === 'transfer') {
      this.api.transfer({ productId: this.moveProduct, fromWarehouseId: this.moveFrom!, toWarehouseId: this.moveTo!, quantity: Number(this.moveQty), note }).subscribe(after);
    } else if (kind === 'receive') {
      this.api.receive({ productId: this.moveProduct, warehouseId: this.moveFrom, quantity: Number(this.moveQty),
        unitCost: this.moveCost !== null && this.moveCost !== undefined && `${this.moveCost}` !== '' ? Number(this.moveCost) : null, note }).subscribe(after);
    } else {
      this.api.issue({ productId: this.moveProduct, warehouseId: this.moveFrom, quantity: Number(this.moveQty), note }).subscribe(after);
    }
  }

  // Counts
  openCount(): void {
    const def = this.warehouses().find(w => w.isDefault) ?? this.warehouses()[0];
    this.counting.set(true);
    if (def) this.startCount(def.id);
  }

  startCount(warehouseId: string): void {
    this.countWarehouse.set(warehouseId);
    this.api.levels(warehouseId).subscribe({
      next: rows => this.countRows.set(rows.map(r => ({ ...r, counted: r.quantity }))),
      error: e => this.fail(e),
    });
  }

  countChanges(): number {
    return this.countRows().filter(r => Number(r.counted) !== r.quantity).length;
  }

  saveCount(): void {
    const warehouseId = this.countWarehouse();
    const lines = this.countRows().filter(r => `${r.counted}` !== '' && Number(r.counted) !== r.quantity)
      .map(r => ({ productId: r.productId, countedQuantity: Number(r.counted) }));
    if (!warehouseId || lines.length === 0) {
      this.counting.set(false);
      return;
    }
    this.busy.set(true);
    this.api.count({ warehouseId, lines }).subscribe({
      next: r => {
        this.toast.show(this.i18n.t('inventory.countSaved', { n: r.adjusted }), { type: 'success' });
        this.busy.set(false);
        this.counting.set(false);
        this.reload();
      },
      error: e => this.fail(e),
    });
  }

  private done(key: string, close: () => void): void {
    this.busy.set(false);
    close();
    this.toast.show(this.i18n.t(key), { type: 'success' });
    this.reload();
  }

  private fail(e: unknown): void {
    this.busy.set(false);
    const err = e as { error?: { detail?: string } };
    this.toast.show(err?.error?.detail || this.i18n.t('inventory.error'), { type: 'error' });
  }

  movementBadge(type: MovementType): string {
    switch (type) {
      case 'RECEIPT': case 'TRANSFER_IN': return 'badge badge-success';
      case 'ISSUE': case 'TRANSFER_OUT': return 'badge badge-info';
      default: return 'badge badge-warning';
    }
  }

  money(v: number | null | undefined): string {
    return new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(Number(v) || 0);
  }

  money0(v: number | null | undefined): string {
    return new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD', maximumFractionDigits: 0 }).format(Number(v) || 0);
  }

  qty(v: number | null | undefined): string {
    return new Intl.NumberFormat('fr-MA', { maximumFractionDigits: 3 }).format(Number(v) || 0);
  }

  signed(v: number): string {
    return (v > 0 ? '+' : '') + this.qty(v);
  }

  percent(rate: number | null | undefined): string {
    return rate === null || rate === undefined ? '—' : `${Math.round(rate * 1000) / 10} %`;
  }

  dateTime(iso: string): string {
    return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
}
