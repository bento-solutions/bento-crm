import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseApiService } from '../core/services/base-api.service';
import { ChecklistDetail, ChecklistSummary } from '../services/domains/checklist.service';
import { PortalMe } from './portal-session';

export interface PortalHome {
  me: PortalMe;
  documentsMissing: number;
  openInvoices: number;
  amountDue?: number | null;
  overdueInvoices: number;
  nextTaxDeadline?: string | null;
  nextTaxDeadlineKind?: string | null;
  missionsInProgress: number;
}

export interface PortalInvoice {
  id: string;
  invoiceNumber?: string | null;
  invoiceDate?: string | null;
  dueDate?: string | null;
  status: string;
  total?: number | null;
  owed?: number | null;
  currency?: string | null;
  /** Full URL of the public pay page, when the invoice can be paid online. */
  payUrl?: string | null;
}

export interface PortalDeliverable {
  id: string;
  title: string;
  dueDate?: string | null;
  status: string;
  deliveredAt?: string | null;
  hasFile: boolean;
  fileName?: string | null;
}

export interface PortalMission {
  id: string;
  name: string;
  status: string;
  startDate?: string | null;
  dueDate?: string | null;
  deliverables?: PortalDeliverable[] | null;
}

export interface PortalTaxDeadline {
  id: string;
  kind: string;
  periodLabel?: string | null;
  dueDate: string;
  status: string;
  overdue: boolean;
}

/** The signed-in client's own data (backend: PortalController). The interceptor adds the portal token. */
@Injectable({ providedIn: 'root' })
export class PortalApi extends BaseApiService {
  me(): Observable<PortalMe> {
    return this.get('/portal/me');
  }

  home(): Observable<PortalHome> {
    return this.get('/portal/home');
  }

  invoices(): Observable<PortalInvoice[]> {
    return this.get('/portal/invoices');
  }

  invoicePdf(id: string): Observable<Blob> {
    return this.getBlob(`/portal/invoices/${id}/pdf`);
  }

  checklists(): Observable<ChecklistSummary[]> {
    return this.get('/portal/checklists');
  }

  checklist(id: string): Observable<ChecklistDetail> {
    return this.get(`/portal/checklists/${id}`);
  }

  upload(itemId: string, file: File): Observable<ChecklistDetail> {
    const form = new FormData();
    form.append('file', file);
    return this.post(`/portal/checklist-items/${itemId}/file`, form);
  }

  checklistFile(itemId: string): Observable<Blob> {
    return this.getBlob(`/portal/checklist-items/${itemId}/file`);
  }

  missions(): Observable<PortalMission[]> {
    return this.get('/portal/missions');
  }

  deliverableFile(id: string): Observable<Blob> {
    return this.getBlob(`/portal/deliverables/${id}/file`);
  }

  taxDeadlines(): Observable<PortalTaxDeadline[]> {
    return this.get('/portal/tax-deadlines');
  }
}

/** Saves a downloaded blob under the given name. */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
