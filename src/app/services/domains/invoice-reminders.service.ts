import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseApiService } from '../../core/services/base-api.service';

export interface ReminderPolicy {
  enabled: boolean;
  /** Days relative to the due date: -3 is three days before it, 7 a week after. */
  offsetsDays: number[];
  channel: 'EMAIL';
  message?: string | null;
}

export interface ReminderRunResult {
  markedOverdue: number;
  remindersSent: number;
  skippedNoEmail: number;
}

/** Automatic payment reminders (backend: InvoiceReminderController). */
@Injectable({ providedIn: 'root' })
export class InvoiceRemindersApi extends BaseApiService {
  policy(): Observable<ReminderPolicy> {
    return this.get('/invoice-reminders/policy');
  }

  savePolicy(policy: Pick<ReminderPolicy, 'enabled' | 'offsetsDays' | 'message'>): Observable<ReminderPolicy> {
    return this.put('/invoice-reminders/policy', policy);
  }

  runNow(): Observable<ReminderRunResult> {
    return this.post('/invoice-reminders/run', {});
  }
}
