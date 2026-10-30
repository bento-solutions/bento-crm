import { Injectable } from '@angular/core';
import { Observable, catchError, timeout } from 'rxjs';
import { BaseApiService } from '../../core/services/base-api.service';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface TaskProposalParams {
  title?: string;
  due_date?: string | null;
  contact_id?: string | null;
  priority?: string | null;
}

/** An invoice the server checked is this organization's and still owed. */
export interface ReminderInvoice {
  id: string;
  invoice_number?: string | null;
  customer_name?: string | null;
  due_date?: string | null;
  owed?: number | null;
}

export interface ReminderProposalParams {
  invoice_ids?: string[];
  invoices?: ReminderInvoice[];
  channel?: string | null;
}

export type AssistantProposal =
  | { kind: 'task'; params: TaskProposalParams }
  | { kind: 'invoice_reminders'; params: ReminderProposalParams };

export interface ChatReply {
  reply: string;
  proposals?: AssistantProposal[] | null;
  lookedUp?: string[] | null;
}

/** The in-app AI assistant (backend: AssistantController) and the actions it may propose. */
@Injectable({ providedIn: 'root' })
export class AssistantApi extends BaseApiService {
  status(): Observable<{ enabled: boolean }> {
    return this.get('/assistant/status');
  }

  /** The model may look several things up before answering, so this waits longer than the usual 30 s. */
  chat(messages: ChatMessage[]): Observable<ChatReply> {
    return this.http.post<ChatReply>(this.buildUrl('/assistant/chat'), { messages }).pipe(
      timeout(120_000),
      catchError(e => this.handleError(e)),
    );
  }

  createTask(body: Record<string, unknown>): Observable<unknown> {
    return this.post('/tasks', body);
  }

  sendReminders(invoiceIds: string[], channel?: string | null): Observable<{ sent?: number }> {
    return this.post('/invoices/reminders', channel ? { invoiceIds, channel } : { invoiceIds });
  }
}
