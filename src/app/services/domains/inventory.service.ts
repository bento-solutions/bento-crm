import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { BaseApiService } from '../../core/services/base-api.service';

export type IssueTrigger = 'DEAL_WON' | 'INVOICE_SENT' | 'MANUAL';
export type MovementType = 'RECEIPT' | 'ISSUE' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'ADJUSTMENT';

export interface CatalogProduct {
  id: string;
  sku: string;
  name: string;
  description?: string | null;
  category?: string | null;
  unitPrice: number;
  costPrice?: number | null;
  /** Stored as a fraction (0.2); the API also accepts a percentage. */
  taxRate?: number | null;
  isActive?: boolean;
  trackStock?: boolean;
  reorderLevel?: number | null;
}

export interface Warehouse {
  id: string;
  name: string;
  code?: string | null;
  address?: string | null;
  isDefault: boolean;
  isActive: boolean;
}

export interface StockLevel {
  productId: string;
  sku: string;
  name: string;
  category?: string | null;
  warehouseId: string;
  warehouseName: string;
  quantity: number;
  reorderLevel?: number | null;
  costPrice?: number | null;
  value: number;
  low: boolean;
}

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  warehouseId: string;
  warehouseName: string;
  type: MovementType;
  quantity: number;
  unitCost?: number | null;
  balanceAfter: number;
  referenceType?: string | null;
  referenceId?: string | null;
  referenceLabel?: string | null;
  note?: string | null;
  createdAt: string;
}

export interface ValuationGroup { key: string; label: string; value: number; units: number }
export interface Valuation {
  totalValue: number;
  totalUnits: number;
  products: number;
  lowStock: number;
  byWarehouse: ValuationGroup[];
  byCategory: ValuationGroup[];
}

export interface StockSettings { issueTrigger: IssueTrigger; receiveOnDelivery: boolean }

interface Page<T> { content: T[]; totalElements?: number }

/** Products, warehouses, stock levels and movements (backend: ProductController, StockController). */
@Injectable({ providedIn: 'root' })
export class InventoryApi extends BaseApiService {
  products(): Observable<CatalogProduct[]> {
    return this.get<Page<CatalogProduct>>('/products', { size: 1000, sort: 'name' }).pipe(map(p => p.content ?? []));
  }

  saveProduct(product: Partial<CatalogProduct>, id?: string): Observable<CatalogProduct> {
    return id ? this.patch(`/products/${id}`, product) : this.post('/products', product);
  }

  settings(): Observable<StockSettings> {
    return this.get('/stock/settings');
  }

  saveSettings(settings: StockSettings): Observable<StockSettings> {
    return this.put('/stock/settings', settings);
  }

  warehouses(): Observable<Warehouse[]> {
    return this.get('/stock/warehouses');
  }

  saveWarehouse(w: Partial<Warehouse>, id?: string): Observable<Warehouse> {
    return id ? this.put(`/stock/warehouses/${id}`, w) : this.post('/stock/warehouses', w);
  }

  levels(warehouseId?: string | null, lowOnly = false): Observable<StockLevel[]> {
    const params: Record<string, string | boolean> = { lowOnly };
    if (warehouseId) params['warehouseId'] = warehouseId;
    return this.get('/stock/levels', params);
  }

  movements(productId?: string | null, page = 0, size = 50): Observable<Page<StockMovement>> {
    const params: Record<string, string | number> = { page, size };
    if (productId) params['productId'] = productId;
    return this.get('/stock/movements', params);
  }

  valuation(): Observable<Valuation> {
    return this.get('/stock/valuation');
  }

  receive(body: { productId: string; warehouseId?: string | null; quantity: number; unitCost?: number | null; note?: string }): Observable<StockMovement> {
    return this.post('/stock/receipts', body);
  }

  issue(body: { productId: string; warehouseId?: string | null; quantity: number; note?: string }): Observable<StockMovement> {
    return this.post('/stock/issues', body);
  }

  transfer(body: { productId: string; fromWarehouseId: string; toWarehouseId: string; quantity: number; note?: string }): Observable<StockMovement[]> {
    return this.post('/stock/transfers', body);
  }

  count(body: { warehouseId: string; lines: { productId: string; countedQuantity: number }[]; note?: string }): Observable<{ adjusted: number; netChange: number }> {
    return this.post('/stock/counts', body);
  }
}
