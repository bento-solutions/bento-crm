import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseApiService } from '../../core/services/base-api.service';
import { InvoiceResponse } from './invoice.mapper';

export type AgingBucketKey = 'CURRENT' | 'D1_30' | 'D31_60' | 'D61_90' | 'D90_PLUS';

export interface AgingPartnerRow {
  partnerId: string;
  name: string;
  current: number;
  d1to30: number;
  d31to60: number;
  d61to90: number;
  d90plus: number;
  total: number;
  openInvoices: number;
  oldestDaysLate: number;
  nextScheduledPayment?: string | null;
}

export interface AgingReport {
  type: 'CUSTOMER' | 'VENDOR';
  asOf: string;
  invoiced: number;
  paid: number;
  pending: number;
  late: number;
  buckets: { key: AgingBucketKey; amount: number; count: number }[];
  partners: AgingPartnerRow[];
}

export interface BillFromPurchaseOrder {
  supplierInvoiceNumber?: string | null;
  invoiceDate?: string | null;
  dueDate?: string | null;
  paymentTermsDays?: number | null;
}

export interface InvoiceTemplate {
  legalName?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  ice?: string | null;
  ifNumber?: string | null;
  rc?: string | null;
  patente?: string | null;
  cnss?: string | null;
  capital?: string | null;
  bankName?: string | null;
  rib?: string | null;
  accentColor?: string | null;
  logoFileId?: string | null;
  paymentTermsText?: string | null;
  footerText?: string | null;
}

export interface BrandInvoiceStyle {
  id: string;
  name: string;
  color_hex?: string | null;
  invoice_logo_file_id?: string | null;
  invoice_footer?: string | null;
}

/**
 * Supplier bills, the aging report and the invoice template (backend: InvoiceController,
 * InvoiceTemplateController).
 */
@Injectable({ providedIn: 'root' })
export class PayablesApi extends BaseApiService {
  aging(type: 'CUSTOMER' | 'VENDOR'): Observable<AgingReport> {
    return this.get('/invoices/aging', { type });
  }

  billPurchaseOrder(purchaseOrderId: string, body: BillFromPurchaseOrder): Observable<InvoiceResponse> {
    return this.post(`/invoices/from-purchase-order/${purchaseOrderId}`, body);
  }

  schedulePayment(invoiceId: string, scheduledPaymentDate: string | null): Observable<InvoiceResponse> {
    return this.patch(`/invoices/${invoiceId}/payment-schedule`, { scheduledPaymentDate });
  }

  template(): Observable<InvoiceTemplate> {
    return this.get('/invoice-template');
  }

  saveTemplate(template: InvoiceTemplate): Observable<InvoiceTemplate> {
    return this.put('/invoice-template', template);
  }

  saveBrandStyle(brandId: string, logoFileId: string | null, footer: string | null): Observable<BrandInvoiceStyle> {
    return this.put(`/invoice-template/brands/${brandId}`, { logoFileId, footer });
  }

  preview(brandId?: string | null): Observable<Blob> {
    return this.getBlob(`/invoice-template/preview${brandId ? '?brandId=' + encodeURIComponent(brandId) : ''}`);
  }

  /** Logos are uploaded against the organization so the backend serves them publicly. */
  uploadLogo(file: File, organizationId: string): Observable<{ id: string }> {
    const form = new FormData();
    form.append('file', file);
    form.append('ownerEntityType', 'ORGANIZATION');
    form.append('ownerEntityId', organizationId);
    return this.post('/files', form);
  }

  logoUrl(fileId: string): string {
    return `${this.baseUrl}/files/public/${fileId}`;
  }
}
