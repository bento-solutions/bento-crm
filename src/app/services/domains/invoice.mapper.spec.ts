import { describe, expect, it } from 'vitest';
import { invoiceFromApi, invoiceToApi, remainingAmount } from './invoice.mapper';

const base = { id: 'i1', type: 'CUSTOMER', partnerId: 'p1', total: 3600 };

describe('invoice mapper', () => {
  it('shows a partially paid invoice past its due date as overdue, with what is left to pay', () => {
    const invoice = invoiceFromApi({ ...base, status: 'PARTIALLY_PAID', dueDate: '2020-01-01', amountPaid: '500' });
    expect(invoice.status).toBe('Overdue');
    expect(invoice.amountPaid).toBe(500);
    expect(remainingAmount(invoice)).toBe(3100);
  });

  it('keeps a partially paid invoice that is not yet due as pending', () => {
    const invoice = invoiceFromApi({ ...base, status: 'PARTIALLY_PAID', dueDate: '2999-01-01', amountPaid: 500 });
    expect(invoice.status).toBe('Pending');
  });

  it('sends PARTIALLY_PAID back when such an invoice is saved unchanged', () => {
    const invoice = invoiceFromApi({ ...base, status: 'PARTIALLY_PAID', dueDate: '2020-01-01', amountPaid: 500 });
    expect(invoiceToApi(invoice)['status']).toBe('PARTIALLY_PAID');
    expect(invoiceToApi({ ...invoice, status: 'Paid' })['status']).toBe('PAID');
  });
});
