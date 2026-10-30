import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseApiService } from '../../core/services/base-api.service';

export type VatRegime = 'NONE' | 'MONTHLY' | 'QUARTERLY';
export type TaxKind = 'TVA' | 'IS_INSTALLMENT' | 'IS_RETURN' | 'IR_SALARIES' | 'CNSS' | 'IR_ANNUAL_SALARIES';
export type DeadlineStatus = 'TODO' | 'DONE' | 'NOT_APPLICABLE';

export const VAT_REGIMES: VatRegime[] = ['NONE', 'MONTHLY', 'QUARTERLY'];
export const DEADLINE_STATUSES: DeadlineStatus[] = ['TODO', 'DONE', 'NOT_APPLICABLE'];

/** The JSON API omits null fields, so every nullable field is optional here. */
export interface TaxProfile {
  id: string;
  /** Absent for the company's own profile. */
  partnerId?: string | null;
  partnerName?: string | null;
  vatRegime: VatRegime;
  corporateTax: boolean;
  fiscalYearEndMonth: number;
  hasEmployees: boolean;
  active: boolean;
}

export interface TaxProfileRequest {
  partnerId?: string | null;
  vatRegime?: VatRegime | null;
  corporateTax?: boolean | null;
  fiscalYearEndMonth?: number | null;
  hasEmployees?: boolean | null;
  active?: boolean | null;
}

export interface TaxDeadline {
  id: string;
  profileId: string;
  partnerId?: string | null;
  partnerName?: string | null;
  kind: TaxKind;
  periodLabel: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  dueDate: string;
  status: DeadlineStatus;
  doneAt?: string | null;
  amount?: number | null;
  note?: string | null;
  overdue: boolean;
}

export interface DeadlineQuery {
  from?: string | null;
  to?: string | null;
  partnerId?: string | null;
  companyOnly?: boolean;
  status?: DeadlineStatus | null;
}

export interface DeadlineUpdate {
  status?: DeadlineStatus | null;
  amount?: number | null;
  note?: string | null;
}

/** Moroccan tax deadlines for the company and its clients (backend: TaxCalendarController). */
@Injectable({ providedIn: 'root' })
export class TaxApi extends BaseApiService {
  profiles(): Observable<TaxProfile[]> {
    return this.get('/tax-calendar/profiles');
  }

  saveProfile(body: TaxProfileRequest, id?: string): Observable<TaxProfile> {
    return id ? this.put(`/tax-calendar/profiles/${id}`, body) : this.post('/tax-calendar/profiles', body);
  }

  deleteProfile(id: string): Observable<void> {
    return this.delete(`/tax-calendar/profiles/${id}`);
  }

  deadlines(q: DeadlineQuery): Observable<TaxDeadline[]> {
    const params: Record<string, string | boolean> = {};
    if (q.from) params['from'] = q.from;
    if (q.to) params['to'] = q.to;
    if (q.partnerId) params['partnerId'] = q.partnerId;
    if (q.companyOnly) params['companyOnly'] = true;
    if (q.status) params['status'] = q.status;
    return this.get('/tax-calendar/deadlines', params);
  }

  updateDeadline(id: string, body: DeadlineUpdate): Observable<TaxDeadline> {
    return this.put(`/tax-calendar/deadlines/${id}`, body);
  }
}
