import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { BaseApiService } from '../../core/services/base-api.service';

export type RecurringFrequency = 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
export type RecurringStatus = 'ACTIVE' | 'PAUSED' | 'ENDED';

export interface RecurringLine {
  description: string;
  qty: number;
  unitPrice: number;
  /** 0.2 = 20 % */
  vatRate: number;
}

export interface RecurringInvoice {
  id: string;
  partnerId: string;
  name: string;
  frequency: RecurringFrequency;
  intervalCount: number;
  startDate: string;
  endDate?: string | null;
  nextRunDate?: string | null;
  status: RecurringStatus;
  paymentTermsDays: number;
  autoSend: boolean;
  customerName?: string | null;
  deliveryAddress?: string | null;
  vatNumber?: string | null;
  lines: RecurringLine[];
  subtotal?: number | null;
  tax?: number | null;
  total?: number | null;
  generatedCount: number;
  /** Frequency and start date can no longer change once a period has been billed or skipped. */
  scheduleLocked: boolean;
  lastRunAt?: string | null;
  lastInvoiceId?: string | null;
  createdAt: string;
}

export interface RecurringInvoiceInput {
  partnerId: string;
  name: string;
  frequency: RecurringFrequency;
  intervalCount: number;
  startDate: string;
  endDate?: string | null;
  paymentTermsDays: number;
  autoSend: boolean;
  lines: RecurringLine[];
}

/** An invoice a template generated, as the backend's InvoiceResponse sends it. */
export interface GeneratedInvoice {
  id: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string;
  status: 'DRAFT' | 'SENT' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE';
  total?: number;
}

interface Page<T> {
  content: T[];
}

/** Recurring invoice templates (backend: RecurringInvoiceController). */
@Injectable({ providedIn: 'root' })
export class RecurringInvoicesApi extends BaseApiService {
  list(): Observable<RecurringInvoice[]> {
    return this.get<Page<RecurringInvoice>>('/recurring-invoices', { size: 200 }).pipe(map(page => page.content ?? []));
  }

  create(input: RecurringInvoiceInput): Observable<RecurringInvoice> {
    return this.post('/recurring-invoices', input);
  }

  update(id: string, input: RecurringInvoiceInput): Observable<RecurringInvoice> {
    return this.patch(`/recurring-invoices/${id}`, input);
  }

  pause(id: string): Observable<RecurringInvoice> {
    return this.post(`/recurring-invoices/${id}/pause`, {});
  }

  resume(id: string): Observable<RecurringInvoice> {
    return this.post(`/recurring-invoices/${id}/resume`, {});
  }

  generateNow(id: string): Observable<GeneratedInvoice> {
    return this.post(`/recurring-invoices/${id}/generate`, {});
  }

  invoices(id: string): Observable<GeneratedInvoice[]> {
    return this.get(`/recurring-invoices/${id}/invoices`);
  }

  remove(id: string): Observable<void> {
    return this.delete(`/recurring-invoices/${id}`);
  }
}
