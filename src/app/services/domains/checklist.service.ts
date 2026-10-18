import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseApiService } from '../../core/services/base-api.service';

export type ChecklistStatus = 'OPEN' | 'COMPLETE' | 'CANCELLED';
export type ReminderChannel = 'NONE' | 'EMAIL' | 'WHATSAPP' | 'BOTH';
export type ChecklistItemStatus = 'MISSING' | 'RECEIVED' | 'ACCEPTED' | 'REJECTED';

export const CHECKLIST_STATUSES: ChecklistStatus[] = ['OPEN', 'COMPLETE', 'CANCELLED'];
export const REMINDER_CHANNELS: ReminderChannel[] = ['NONE', 'EMAIL', 'WHATSAPP', 'BOTH'];

/** The JSON API omits null fields, so every nullable field is optional here. */
export interface ChecklistSummary {
  id: string;
  partnerId: string;
  partnerName?: string | null;
  title: string;
  period?: string | null;
  dueDate?: string | null;
  status: ChecklistStatus;
  remindChannel: ReminderChannel;
  remindEveryDays: number;
  lastReminderAt?: string | null;
  reminderCount: number;
  items: number;
  missing: number;
  toCheck: number;
  accepted: number;
  overdue: boolean;
}

export interface ChecklistItem {
  id: string;
  label: string;
  required: boolean;
  status: ChecklistItemStatus;
  fileId?: string | null;
  fileName?: string | null;
  receivedAt?: string | null;
  reviewNote?: string | null;
  sortOrder: number;
}

export interface ChecklistDetail {
  request: ChecklistSummary;
  note?: string | null;
  items?: ChecklistItem[] | null;
}

export interface ChecklistCreateRequest {
  partnerId: string;
  title: string;
  period?: string | null;
  dueDate?: string | null;
  remindChannel?: ReminderChannel | null;
  remindEveryDays?: number | null;
  note?: string | null;
  template?: string | null;
  items?: string[] | null;
}

export interface ChecklistUpdateRequest {
  title?: string | null;
  period?: string | null;
  dueDate?: string | null;
  remindChannel?: ReminderChannel | null;
  remindEveryDays?: number | null;
  note?: string | null;
  status?: ChecklistStatus | null;
}

export interface ChecklistItemRequest {
  label?: string | null;
  required?: boolean | null;
  sortOrder?: number | null;
}

export interface ChecklistTemplate {
  key: string;
  title: string;
  items: string[];
}

export interface RemindResult {
  email: boolean;
  whatsapp: boolean;
  problem?: string | null;
}

/** Checklists of documents asked from clients, with reminders (backend: ChecklistController). */
@Injectable({ providedIn: 'root' })
export class ChecklistApi extends BaseApiService {
  templates(): Observable<ChecklistTemplate[]> {
    return this.get('/document-requests/templates');
  }

  list(partnerId?: string | null, status?: ChecklistStatus | null): Observable<ChecklistSummary[]> {
    const params: Record<string, string> = {};
    if (partnerId) params['partnerId'] = partnerId;
    if (status) params['status'] = status;
    return this.get('/document-requests', params);
  }

  detail(id: string): Observable<ChecklistDetail> {
    return this.get(`/document-requests/${id}`);
  }

  create(body: ChecklistCreateRequest): Observable<ChecklistDetail> {
    return this.post('/document-requests', body);
  }

  update(id: string, body: ChecklistUpdateRequest): Observable<ChecklistDetail> {
    return this.put(`/document-requests/${id}`, body);
  }

  remove(id: string): Observable<void> {
    return this.delete(`/document-requests/${id}`);
  }

  remind(id: string): Observable<RemindResult> {
    return this.post(`/document-requests/${id}/remind`, {});
  }

  addItem(id: string, body: ChecklistItemRequest): Observable<ChecklistDetail> {
    return this.post(`/document-requests/${id}/items`, body);
  }

  updateItem(itemId: string, body: ChecklistItemRequest): Observable<ChecklistDetail> {
    return this.put(`/document-request-items/${itemId}`, body);
  }

  deleteItem(itemId: string): Observable<ChecklistDetail> {
    return this.delete(`/document-request-items/${itemId}`);
  }

  review(itemId: string, status: 'ACCEPTED' | 'REJECTED', note?: string | null): Observable<ChecklistDetail> {
    return this.post(`/document-request-items/${itemId}/review`, { status, note: note || null });
  }

  upload(itemId: string, file: File): Observable<ChecklistDetail> {
    const form = new FormData();
    form.append('file', file);
    return this.post(`/document-request-items/${itemId}/file`, form);
  }
}
