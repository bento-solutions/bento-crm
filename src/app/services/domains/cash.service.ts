import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseApiService } from '../../core/services/base-api.service';
import type { PageResponse } from '../api.service';

// The cash register (caisse, account 5161), general ledger phase 3 section 10.

export type CashKind = 'IN' | 'OUT';

export interface CashRegister {
  balance: number;
  accountId?: string | null;
  accountCode?: string | null;
}

export interface CashMovement {
  id: string;
  date: string;
  kind: CashKind;
  amount: number;
  label?: string | null;
  category?: string | null;
  partnerId?: string | null;
  partnerName?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  entryId?: string | null;
}

export interface CashMovementRequest {
  date: string;
  kind: CashKind;
  amount: number;
  label: string;
  category?: string | null;
  partnerId?: string | null;
  costCenterId?: string | null;
}

@Injectable({ providedIn: 'root' })
export class CashApi extends BaseApiService {
  register(): Observable<CashRegister> {
    return this.get('/cash/register');
  }

  movements(f: { from?: string | null; to?: string | null }, page = 0, size = 50): Observable<PageResponse<CashMovement>> {
    const p: Record<string, string | number> = { page, size };
    if (f.from) p['from'] = f.from;
    if (f.to) p['to'] = f.to;
    return this.get('/cash/movements', p);
  }

  create(body: CashMovementRequest): Observable<CashMovement> {
    return this.post('/cash/movements', body);
  }

  remove(id: string): Observable<void> {
    return this.delete(`/cash/movements/${id}`);
  }
}
