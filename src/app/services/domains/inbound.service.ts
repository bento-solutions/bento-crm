import { Injectable } from '@angular/core';
import { Observable, catchError, map, timeout } from 'rxjs';
import { BaseApiService } from '../../core/services/base-api.service';

export type InboundStatus = 'QUEUED' | 'BOOKED' | 'NEEDS_REVIEW' | 'FILED' | 'IGNORED' | 'DUPLICATE' | 'FAILED';
export type InboundKind = 'VENDOR_INVOICE' | 'BANK_STATEMENT' | 'OTHER';
export type MailboxKind = 'VENDOR_INVOICES' | 'BANK_STATEMENTS';

export interface InboundMailbox {
  id: string;
  kind: MailboxKind;
  address: string;
  allowedSenders: string[];
  autoBook: boolean;
  active: boolean;
}

export interface InboundSettings {
  aiEnabled: boolean;
  documentModel?: string | null;
  whatsappDocuments: boolean;
  mailboxes: InboundMailbox[];
}

export interface ExtractionLine {
  description?: string | null;
  quantity?: number | null;
  unitPrice?: number | null;
  vatRate?: number | null;
  total?: number | null;
}

export interface Extraction {
  documentType?: string | null;
  supplierName?: string | null;
  supplierIce?: string | null;
  supplierIf?: string | null;
  supplierEmail?: string | null;
  supplierPhone?: string | null;
  buyerIce?: string | null;
  invoiceNumber?: string | null;
  invoiceDate?: string | null;
  dueDate?: string | null;
  currency?: string | null;
  subtotal?: number | null;
  tax?: number | null;
  total?: number | null;
  lines?: ExtractionLine[] | null;
  confidence?: number | null;
}

export interface InboundDocument {
  id: string;
  channel?: string | null;
  kind: InboundKind;
  status: InboundStatus;
  fileId?: string | null;
  fileName?: string | null;
  contentType?: string | null;
  fileSize?: number | null;
  sender?: string | null;
  subject?: string | null;
  receivedAt?: string | null;
  extraction?: Extraction | null;
  confidence?: number | null;
  reviewReason?: string | null;
  partnerId?: string | null;
  partnerName?: string | null;
  invoiceId?: string | null;
  invoiceNumber?: string | null;
  error?: string | null;
  processedAt?: string | null;
}

export interface BookRequest {
  partnerId?: string | null;
  supplierName?: string | null;
  supplierIce?: string | null;
  supplierIf?: string | null;
  supplierEmail?: string | null;
  supplierPhone?: string | null;
  invoiceNumber?: string | null;
  invoiceDate?: string | null;
  dueDate?: string | null;
  subtotal?: number | null;
  tax?: number | null;
  total: number;
  lines?: ExtractionLine[] | null;
}

export interface DocumentPage {
  content: InboundDocument[];
  total: number;
}

/** Documents that arrive by email, WhatsApp or upload, and their review (backend: InboundController). */
@Injectable({ providedIn: 'root' })
export class InboundApi extends BaseApiService {
  settings(): Observable<InboundSettings> {
    return this.get('/inbound/settings');
  }

  saveSettings(whatsappDocuments: boolean): Observable<InboundSettings> {
    return this.put('/inbound/settings', { whatsappDocuments });
  }

  updateMailbox(id: string, body: { allowedSenders?: string[]; autoBook?: boolean; active?: boolean }): Observable<InboundMailbox> {
    return this.put(`/inbound/mailboxes/${id}`, body);
  }

  rotate(id: string): Observable<InboundMailbox> {
    return this.post(`/inbound/mailboxes/${id}/rotate`, {});
  }

  documents(statuses: InboundStatus[], page = 0, size = 25): Observable<DocumentPage> {
    const params: Record<string, string | number> = { page, size };
    if (statuses.length) params['status'] = statuses.join(',');
    return this.get<{ content?: InboundDocument[]; total_elements?: number; totalElements?: number }>('/inbound/documents', params).pipe(
      map(p => ({ content: p.content ?? [], total: p.total_elements ?? p.totalElements ?? (p.content ?? []).length })),
    );
  }

  counts(): Observable<Partial<Record<InboundStatus, number>>> {
    return this.get('/inbound/documents/counts');
  }

  document(id: string): Observable<InboundDocument> {
    return this.get(`/inbound/documents/${id}`);
  }

  upload(file: File, kind: InboundKind): Observable<InboundDocument> {
    const form = new FormData();
    form.append('file', file);
    form.append('kind', kind);
    return this.slowPost('/inbound/documents', form);
  }

  book(id: string, body: BookRequest): Observable<InboundDocument> {
    return this.post(`/inbound/documents/${id}/book`, body);
  }

  ignore(id: string): Observable<InboundDocument> {
    return this.post(`/inbound/documents/${id}/ignore`, {});
  }

  retry(id: string): Observable<InboundDocument> {
    return this.slowPost(`/inbound/documents/${id}/retry`, {});
  }

  /** Reading a document with the AI can take longer than the usual 30 s timeout; never retried. */
  private slowPost<T>(endpoint: string, body: unknown): Observable<T> {
    return this.http.post<T>(this.buildUrl(endpoint), body).pipe(
      timeout(120_000),
      catchError(e => this.handleError(e)),
    );
  }
}
