import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { BaseApiService } from '../../core/services/base-api.service';
import type { PageResponse } from '../api.service';
import type { Invoice } from '../crm-state.service';
import { InvoiceResponse, invoiceFromApi } from './invoice.mapper';

export type DeliveryNoteStatus = 'DRAFT' | 'DELIVERED' | 'INVOICED' | 'CANCELLED';
export const DELIVERY_NOTE_STATUSES: DeliveryNoteStatus[] = ['DRAFT', 'DELIVERED', 'INVOICED', 'CANCELLED'];

export interface DeliveryNoteLine {
  description: string;
  qty: number;
  unit?: string | null;
  productId?: string | null;
}

/** A delivery slip (bon de livraison). It never posts; the number is allocated when it is delivered. */
export interface DeliveryNote {
  id: string;
  number?: string | null;
  partnerId: string;
  partnerName?: string | null;
  dealId?: string | null;
  missionId?: string | null;
  date?: string | null;
  status: DeliveryNoteStatus;
  lines?: DeliveryNoteLine[] | null;
  notes?: string | null;
  invoiceId?: string | null;
  deliveredAt?: string | null;
  signedBy?: string | null;
}

export interface DeliveryNoteRequest {
  partnerId?: string | null;
  dealId?: string | null;
  missionId?: string | null;
  date?: string | null;
  lines?: DeliveryNoteLine[];
  notes?: string | null;
}

export interface DeliveryNoteQuery {
  partnerId?: string | null;
  dealId?: string | null;
  missionId?: string | null;
  status?: DeliveryNoteStatus | null;
  page?: number;
  size?: number;
}

/** Delivery slips (backend: DeliveryNoteController; INVOICES_READ to read, INVOICES_CREATE to write). */
@Injectable({ providedIn: 'root' })
export class DeliveryNotesApi extends BaseApiService {
  list(q: DeliveryNoteQuery = {}): Observable<PageResponse<DeliveryNote>> {
    const params: Record<string, string | number> = { page: q.page ?? 0, size: q.size ?? 50 };
    if (q.partnerId) params['partnerId'] = q.partnerId;
    if (q.dealId) params['dealId'] = q.dealId;
    if (q.missionId) params['missionId'] = q.missionId;
    if (q.status) params['status'] = q.status;
    return this.get('/delivery-notes', params);
  }

  getOne(id: string): Observable<DeliveryNote> {
    return this.get(`/delivery-notes/${id}`);
  }

  create(body: DeliveryNoteRequest): Observable<DeliveryNote> {
    return this.post('/delivery-notes', body);
  }

  /** Allowed while DRAFT. */
  update(id: string, body: DeliveryNoteRequest): Observable<DeliveryNote> {
    return this.put(`/delivery-notes/${id}`, body);
  }

  /** Allowed while DRAFT. */
  remove(id: string): Observable<void> {
    return this.delete(`/delivery-notes/${id}`);
  }

  /** A DRAFT note from the deal's order lines (or one line from its title). */
  fromDeal(dealId: string): Observable<DeliveryNote> {
    return this.post(`/deals/${dealId}/delivery-note`, {});
  }

  deliver(id: string, body: { date?: string | null; signedBy?: string | null }): Observable<DeliveryNote> {
    return this.post(`/delivery-notes/${id}/deliver`, body);
  }

  /** A DRAFT customer invoice from the deal, with its open advances deducted. */
  invoice(id: string): Observable<Invoice> {
    return this.post<InvoiceResponse>(`/delivery-notes/${id}/invoice`, {}).pipe(map(invoiceFromApi));
  }

  pdf(id: string): Observable<Blob> {
    return this.getBlob(`/delivery-notes/${id}/pdf`);
  }
}
