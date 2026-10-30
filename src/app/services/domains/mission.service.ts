import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseApiService } from '../../core/services/base-api.service';

export type MissionStatus = 'PLANNED' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
export type DeliverableStatus = 'TODO' | 'IN_PROGRESS' | 'DELIVERED';

export const MISSION_STATUSES: MissionStatus[] = ['PLANNED', 'IN_PROGRESS', 'DONE', 'CANCELLED'];
export const DELIVERABLE_STATUSES: DeliverableStatus[] = ['TODO', 'IN_PROGRESS', 'DELIVERED'];
/** The VAT rates a cost can be rebilled with, as fractions (the API also takes 0.2, not 20). */
export const DISBURSEMENT_VAT_RATES = [0, 0.07, 0.1, 0.14, 0.2];

/** The JSON API omits null fields, so every nullable field is optional here. */
export interface MissionSummary {
  id: string;
  partnerId: string;
  partnerName?: string | null;
  name: string;
  status: MissionStatus;
  startDate?: string | null;
  dueDate?: string | null;
  feeAmount?: number | null;
  assignedUserId?: string | null;
  assignedUserName?: string | null;
  deliverables: number;
  delivered: number;
  unbilledDisbursements?: number | null;
  overdue: boolean;
}

export interface Deliverable {
  id: string;
  missionId: string;
  title: string;
  dueDate?: string | null;
  status: DeliverableStatus;
  fileId?: string | null;
  fileName?: string | null;
  deliveredAt?: string | null;
  visibleToClient: boolean;
}

export interface Disbursement {
  id: string;
  partnerId: string;
  partnerName?: string | null;
  missionId?: string | null;
  missionName?: string | null;
  spentOn: string;
  description: string;
  amount: number;
  vatRate?: number | null;
  rebillable: boolean;
  invoiceId?: string | null;
  invoiceNumber?: string | null;
  receiptFileId?: string | null;
}

export interface MissionDetail {
  mission: MissionSummary;
  description?: string | null;
  deliverables?: Deliverable[] | null;
  disbursements?: Disbursement[] | null;
}

export interface MissionRequest {
  partnerId?: string | null;
  name?: string | null;
  description?: string | null;
  status?: MissionStatus | null;
  startDate?: string | null;
  dueDate?: string | null;
  feeAmount?: number | null;
  assignedUserId?: string | null;
}

export interface DeliverableRequest {
  title?: string | null;
  dueDate?: string | null;
  status?: DeliverableStatus | null;
  fileId?: string | null;
  removeFile?: boolean | null;
  visibleToClient?: boolean | null;
}

export interface DisbursementRequest {
  partnerId?: string | null;
  missionId?: string | null;
  spentOn?: string | null;
  description?: string | null;
  amount?: number | null;
  vatRate?: number | null;
  rebillable?: boolean | null;
  receiptFileId?: string | null;
}

export interface DisbursementQuery {
  partnerId?: string | null;
  missionId?: string | null;
  unbilled?: boolean;
}

export interface BillResult {
  invoiceId: string;
  invoiceNumber?: string | null;
  lines: number;
  total: number;
}

/** Client missions, their deliverables and rebillable costs (backend: MissionController). */
@Injectable({ providedIn: 'root' })
export class MissionApi extends BaseApiService {
  list(partnerId?: string | null, status?: MissionStatus | null): Observable<MissionSummary[]> {
    const params: Record<string, string> = {};
    if (partnerId) params['partnerId'] = partnerId;
    if (status) params['status'] = status;
    return this.get('/missions', params);
  }

  detail(id: string): Observable<MissionDetail> {
    return this.get(`/missions/${id}`);
  }

  save(body: MissionRequest, id?: string): Observable<MissionDetail> {
    return id ? this.put(`/missions/${id}`, body) : this.post('/missions', body);
  }

  remove(id: string): Observable<void> {
    return this.delete(`/missions/${id}`);
  }

  // Deliverables
  addDeliverable(missionId: string, body: DeliverableRequest): Observable<Deliverable> {
    return this.post(`/missions/${missionId}/deliverables`, body);
  }

  updateDeliverable(id: string, body: DeliverableRequest): Observable<Deliverable> {
    return this.put(`/mission-deliverables/${id}`, body);
  }

  deleteDeliverable(id: string): Observable<void> {
    return this.delete(`/mission-deliverables/${id}`);
  }

  // Disbursements (débours)
  disbursements(q: DisbursementQuery): Observable<Disbursement[]> {
    const params: Record<string, string | boolean> = {};
    if (q.partnerId) params['partnerId'] = q.partnerId;
    if (q.missionId) params['missionId'] = q.missionId;
    if (q.unbilled) params['unbilled'] = true;
    return this.get('/disbursements', params);
  }

  saveDisbursement(body: DisbursementRequest, id?: string): Observable<Disbursement> {
    return id ? this.put(`/disbursements/${id}`, body) : this.post('/disbursements', body);
  }

  deleteDisbursement(id: string): Observable<void> {
    return this.delete(`/disbursements/${id}`);
  }

  bill(partnerId: string, disbursementIds: string[]): Observable<BillResult> {
    return this.post('/disbursements/bill', { partnerId, disbursementIds });
  }
}
