import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { BaseApiService } from '../../core/services/base-api.service';
import type { PageResponse } from '../api.service';
import type { Invoice, InvoiceLineData } from '../crm-state.service';
import { InvoiceResponse, invoiceFromApi } from './invoice.mapper';

/** POST /invoices/advance: exactly one of amount or percent. */
export interface AdvanceInvoiceRequest {
  partnerId: string;
  dealId?: string | null;
  proposalId?: string | null;
  amount?: number | null;
  percent?: number | null;
  /** false (default): the amount is before VAT; true: VAT is split out of it. */
  amountIncludesVat?: boolean;
  vatCode?: string | null;
  date?: string | null;
  dueDate?: string | null;
  label?: string | null;
}

/** GET /invoices/advances/open: advance invoices not yet deducted from a final invoice. */
export interface OpenAdvance {
  id: string;
  number?: string | null;
  date?: string | null;
  base: number;
  vat: number;
  total: number;
  status: string;
  remainingBase: number;
  remainingVat: number;
}

/** GET /payments/advances/open: payments marked as advances, not yet applied to an invoice. */
export interface OpenAdvancePayment {
  id: string;
  partnerId?: string | null;
  partnerName?: string | null;
  amount: number;
  paymentDate?: string | null;
  date?: string | null;
  reference?: string | null;
  method?: string | null;
}

export interface CreditNoteRequest {
  /** Omitted: every line, for the full amount. */
  lines?: InvoiceLineData[];
  reason: string;
  date?: string | null;
}

/** Advance invoices, advance payments and credit notes (general ledger phase 3, backend: InvoiceController / PaymentController). */
@Injectable({ providedIn: 'root' })
export class AdvancesApi extends BaseApiService {
  createAdvance(body: AdvanceInvoiceRequest): Observable<Invoice> {
    return this.post<InvoiceResponse>('/invoices/advance', body).pipe(map(invoiceFromApi));
  }

  /** The invoices of a deal or a proposal (GET /invoices?dealId= or ?proposalId=). */
  invoicesOf(f: { dealId?: string | null; proposalId?: string | null }): Observable<Invoice[]> {
    const params: Record<string, string | number> = { size: 200 };
    if (f.dealId) params['dealId'] = f.dealId;
    if (f.proposalId) params['proposalId'] = f.proposalId;
    return this.get<PageResponse<InvoiceResponse>>('/invoices', params).pipe(map(p => (p?.content ?? []).map(invoiceFromApi)));
  }

  openAdvances(partnerId: string, dealId?: string | null): Observable<OpenAdvance[]> {
    const params: Record<string, string> = { partnerId };
    if (dealId) params['dealId'] = dealId;
    return this.get('/invoices/advances/open', params);
  }

  openAdvancePayments(partnerId: string): Observable<OpenAdvancePayment[]> {
    return this.get('/payments/advances/open', { partnerId });
  }

  applyPayment(paymentId: string, invoiceId: string): Observable<unknown> {
    return this.post(`/payments/${paymentId}/apply`, { invoiceId });
  }

  creditNote(invoiceId: string, body: CreditNoteRequest): Observable<Invoice> {
    return this.post<InvoiceResponse>(`/invoices/${invoiceId}/credit-note`, body).pipe(map(invoiceFromApi));
  }
}
