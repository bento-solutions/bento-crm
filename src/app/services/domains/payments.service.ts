import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseApiService } from '../../core/services/base-api.service';

export type PaymentProvider = 'NONE' | 'MOCK' | 'STRIPE';

export interface PaymentSettings {
  provider: PaymentProvider;
  includeInEmails: boolean;
  /** Providers this server can run; Stripe appears only once its keys are configured. */
  available: PaymentProvider[];
}

export interface PaymentLink {
  id: string;
  invoiceId: string;
  url: string;
  status: 'OPEN' | 'PAID' | 'CANCELLED';
  provider: PaymentProvider;
  paidAt?: string | null;
  createdAt: string;
}

export interface PublicInvoice {
  organizationName: string;
  logoFileId?: string | null;
  accentColor?: string | null;
  customerName?: string | null;
  invoiceNumber: string;
  invoiceDate?: string | null;
  dueDate?: string | null;
  currency: string;
  total: number;
  paid: number;
  remaining: number;
  status: 'OPEN' | 'PAID' | 'CANCELLED';
  testMode: boolean;
  lines: { description: string; quantity?: number | null; unitPrice?: number | null; amount?: number | null }[];
}

/** Pay-by-Link (backend: PaymentLinkController, PublicPayController). */
@Injectable({ providedIn: 'root' })
export class PaymentsApi extends BaseApiService {
  settings(): Observable<PaymentSettings> {
    return this.get('/payment-settings');
  }

  saveSettings(provider: PaymentProvider, includeInEmails: boolean): Observable<PaymentSettings> {
    return this.put('/payment-settings', { provider, includeInEmails });
  }

  /** The invoice's open link, created on first call. */
  link(invoiceId: string): Observable<PaymentLink> {
    return this.post(`/invoices/${invoiceId}/payment-link`, {});
  }

  cancelLink(invoiceId: string): Observable<void> {
    return this.delete(`/invoices/${invoiceId}/payment-link`);
  }

  // Public side: no session, the token is the credential.
  publicInvoice(token: string): Observable<PublicInvoice> {
    return this.get(`/public/pay/${encodeURIComponent(token)}`);
  }

  checkout(token: string): Observable<{ url: string }> {
    return this.post(`/public/pay/${encodeURIComponent(token)}/checkout`, {});
  }

  completeTestPayment(token: string, sessionId: string): Observable<void> {
    return this.post(`/public/pay/${encodeURIComponent(token)}/mock-complete`, { sessionId });
  }

  pdfUrl(token: string): string {
    return `${this.baseUrl}/public/pay/${encodeURIComponent(token)}/pdf`;
  }

  logoUrl(fileId: string): string {
    return `${this.baseUrl}/files/public/${fileId}`;
  }
}
