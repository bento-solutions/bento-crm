import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseApiService } from '../../core/services/base-api.service';

export interface CostCenterAllocation {
  costCenterId: string;
  percent: number;
}

/** One month's payroll totals (no payroll calculation) and the OD entry they post. */
export interface PayrollRun {
  id: string;
  /** YYYY-MM */
  period: string;
  date?: string | null;
  grossSalaries: number;
  employeeSocial: number;
  incomeTax: number;
  otherDeductions?: number | null;
  netPay: number;
  employerSocial: number;
  costCenterAllocations?: CostCenterAllocation[] | null;
  notes?: string | null;
  entryId?: string | null;
}

export interface PayrollRunRequest {
  period: string;
  date?: string | null;
  grossSalaries: number;
  employeeSocial: number;
  incomeTax: number;
  otherDeductions?: number | null;
  employerSocial: number;
  costCenterAllocations?: CostCenterAllocation[] | null;
  notes?: string | null;
}

/** Payroll runs (backend: PayrollRunController; LEDGER_READ to read, LEDGER_WRITE to write). */
@Injectable({ providedIn: 'root' })
export class PayrollApi extends BaseApiService {
  list(year: number): Observable<PayrollRun[]> {
    return this.get('/payroll-runs', { year });
  }

  save(body: PayrollRunRequest, id?: string): Observable<PayrollRun> {
    return id ? this.put(`/payroll-runs/${id}`, body) : this.post('/payroll-runs', body);
  }

  /** Reverses the entry. */
  remove(id: string): Observable<void> {
    return this.delete(`/payroll-runs/${id}`);
  }
}

/** net = gross − employee social − IR − other deductions, to the cent. */
export function payrollNet(r: { grossSalaries: number; employeeSocial: number; incomeTax: number; otherDeductions?: number | null }): number {
  const n = (Number(r.grossSalaries) || 0) - (Number(r.employeeSocial) || 0) - (Number(r.incomeTax) || 0) - (Number(r.otherDeductions) || 0);
  return Math.round(n * 100) / 100;
}

/** The last day of a YYYY-MM month, as YYYY-MM-DD. */
export function monthEnd(period: string): string {
  const [y, m] = period.split('-').map(Number);
  if (!y || !m) return '';
  const d = new Date(Date.UTC(y, m, 0));
  return d.toISOString().slice(0, 10);
}
