import { Invoice, InvoiceStatus } from '../crm-state.service';

/**
 * Anti-corruption layer between the invoice API contract and the frontend `Invoice` model.
 *
 * The backend uses upper-case Java enum names (`CUSTOMER`/`VENDOR`, `DRAFT`/`SENT`/
 * `PARTIALLY_PAID`/`PAID`/`OVERDUE`) and a `total` money field, while the frontend model uses
 * title-case literals and `amount`. Centralizing the translation here keeps that mismatch out of
 * every component and out of the raw HTTP layer.
 */

export interface InvoiceResponse {
  id: string;
  type: string;
  partnerId: string;
  total: number | string;
  status: string;
  dueDate?: string;
  dealId?: string;
  purchaseOrderId?: string;
  createdBy?: string;
  createdAt?: string;
  invoiceNumber?: string;
  customerAccount?: string;
  customerName?: string;
  deliveryAddress?: string;
  vatNumber?: string;
  lines?: Invoice['lines'];
}

const TYPE_FROM_API: Record<string, 'Customer' | 'Vendor'> = {
  CUSTOMER: 'Customer',
  VENDOR: 'Vendor',
};

const TYPE_TO_API: Record<'Customer' | 'Vendor', string> = {
  Customer: 'CUSTOMER',
  Vendor: 'VENDOR',
};

// The backend's PARTIALLY_PAID has no frontend equivalent and collapses into 'Pending';
// round-tripping such an invoice through the UI without changing its status will re-send it
// as SENT rather than PARTIALLY_PAID.
const STATUS_FROM_API: Record<string, InvoiceStatus> = {
  DRAFT: 'Draft',
  SENT: 'Pending',
  PARTIALLY_PAID: 'Pending',
  PAID: 'Paid',
  OVERDUE: 'Overdue',
};

const STATUS_TO_API: Record<InvoiceStatus, string> = {
  Draft: 'DRAFT',
  Pending: 'SENT',
  Paid: 'PAID',
  Overdue: 'OVERDUE',
};

/** Maps an `InvoiceResponse` from the API into the frontend `Invoice` model. */
export function invoiceFromApi(dto: InvoiceResponse): Invoice {
  return {
    id: dto.id,
    type: TYPE_FROM_API[dto.type] ?? dto.type,
    partnerId: dto.partnerId,
    amount: Number(dto.total ?? 0),
    status: STATUS_FROM_API[dto.status] ?? dto.status,
    dueDate: dto.dueDate ?? '',
    dealId: dto.dealId ?? undefined,
    purchaseOrderId: dto.purchaseOrderId ?? undefined,
    createdBy: dto.createdBy ?? undefined,
    createdAt: dto.createdAt ?? new Date().toISOString(),
    invoiceNumber: dto.invoiceNumber ?? undefined,
    customerAccount: dto.customerAccount ?? undefined,
    customerName: dto.customerName ?? undefined,
    deliveryAddress: dto.deliveryAddress ?? undefined,
    vatNumber: dto.vatNumber ?? undefined,
    lines: dto.lines ?? undefined,
  };
}

/**
 * Maps a (possibly partial) frontend `Invoice` into the API's `CreateInvoiceRequest` shape, used
 * for both create (POST) and update (PATCH, which the backend applies as a full replace).
 * `createdBy` is intentionally omitted: the backend derives it from the authenticated user rather
 * than accepting it from the client.
 */
export function invoiceToApi(invoice: Partial<Invoice>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (invoice.type !== undefined) payload['type'] = TYPE_TO_API[invoice.type];
  if (invoice.partnerId !== undefined) payload['partnerId'] = invoice.partnerId;
  if (invoice.amount !== undefined) payload['total'] = invoice.amount;
  if (invoice.status !== undefined) payload['status'] = STATUS_TO_API[invoice.status];
  if (invoice.dueDate !== undefined) payload['dueDate'] = invoice.dueDate;
  if (invoice.dealId !== undefined) payload['dealId'] = invoice.dealId;
  if (invoice.purchaseOrderId !== undefined) payload['purchaseOrderId'] = invoice.purchaseOrderId;
  if (invoice.invoiceNumber !== undefined) payload['invoiceNumber'] = invoice.invoiceNumber;
  if (invoice.customerAccount !== undefined) payload['customerAccount'] = invoice.customerAccount;
  if (invoice.customerName !== undefined) payload['customerName'] = invoice.customerName;
  if (invoice.deliveryAddress !== undefined) payload['deliveryAddress'] = invoice.deliveryAddress;
  if (invoice.vatNumber !== undefined) payload['vatNumber'] = invoice.vatNumber;
  if (invoice.lines !== undefined) payload['lines'] = invoice.lines;
  return payload;
}
