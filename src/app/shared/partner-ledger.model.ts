/** Shapes returned by `GET /partners/{id}/ledger`. */

export type LedgerTransactionType = 'INVOICE' | 'PAYMENT';

export interface LedgerOpenInvoice {
  id: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  vatAmount: number;
  status?: string;
  overdue: boolean;
}

export interface LedgerClosedInvoice {
  id: string;
  invoiceNumber?: string;
  paymentDate?: string;
  invoiceDate?: string;
  dueDate?: string;
  totalAmount: number;
  vatAmount: number;
}

export interface LedgerTransaction {
  date?: string;
  type: LedgerTransactionType;
  documentNumber?: string;
  /**
   * Already signed by the server according to which side of the relationship the partner is
   * on: for a customer an invoice is positive and a payment negative, for a supplier both are
   * inverted. The UI never re-derives the sign.
   */
  amount: number;
}

export interface LedgerTotals {
  totalInvoiced: number;
  totalPaid: number;
  totalOpen: number;
  totalOverdue: number;
  balance: number;
}

export interface PartnerLedger {
  partnerId: string;
  partnerType: 'LEAD' | 'PROSPECT' | 'CUSTOMER' | 'VENDOR';
  openInvoices: LedgerOpenInvoice[];
  closedInvoices: LedgerClosedInvoice[];
  transactions: LedgerTransaction[];
  totals: LedgerTotals;
}
