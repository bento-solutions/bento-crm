import { Injectable, signal, computed, inject } from '@angular/core';
import { ApiService } from '../api.service';
import { ToastService } from '../toast.service';
import { CrmStateService, Deal, CallLog, EmailLog, Meeting, TeamsRecording, Note, FollowUp } from '../crm-state.service';

type ActivityLog = NonNullable<Deal['activityLog']>;
const EMPTY_ACTIVITY_LOG: ActivityLog = { calls: [], emails: [], meetings: [], recordings: [], notes: [], followUps: [] };

export type { Deal, CallLog, EmailLog, Meeting, TeamsRecording, Note, FollowUp };

@Injectable({
  providedIn: 'root'
})
export class DealsService {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private state = inject(CrmStateService);

  deals = signal<Deal[]>([]);
  isLoaded = signal<boolean>(false);
  isLoading = signal<boolean>(false);
  error = signal<string | null>(null);

  allDeals = computed(() => this.deals());
  isLoading$ = computed(() => this.isLoading());
  error$ = computed(() => this.error());

  load(params?: Record<string, string | number | boolean>, force = false): void {
    if (this.isLoaded() && !params && !force) return;
    this.isLoading.set(true);
    this.error.set(null);

    this.api.getDeals(params).subscribe({
      next: (deals) => {
        if (deals) {
          this.deals.set(deals.map(d => this.withSalesPersonName(d)));
        }
        this.isLoaded.set(true);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.warn('Failed to load deals from API:', err);
        this.isLoaded.set(true);
        this.isLoading.set(false);
        this.error.set('Failed to load deals from the server.');
      }
    });
  }

  /**
   * Returns an optimistic `Deal` synchronously (with a temporary id) so callers can chain
   * follow-up actions (e.g. opening an "assign task" modal) without waiting on the network.
   * The signal is reconciled with the server-assigned id once the request resolves.
   */
  addDeal(deal: Omit<Deal, 'id' | 'createdAt' | 'updatedAt'>): Deal {
    const localId = 'd-' + Date.now();
    const optimistic: Deal = { ...deal, id: localId, createdAt: new Date().toISOString() } as Deal;
    this.deals.update(deals => [...deals, optimistic]);
    this.api.createDeal(deal).subscribe({
      next: (raw) => {
        const created = this.withSalesPersonName(raw);
        this.deals.update(deals => deals.map(d => d.id === localId ? created : d));
        this.toast.show(`Deal <strong>${created.title}</strong> created`);
      },
      error: () => {
        this.deals.update(deals => deals.filter(d => d.id !== localId));
        this.toast.show('Failed to create deal', { type: 'error' });
      }
    });
    return optimistic;
  }

  /**
   * The backend's PATCH /deals/{id} re-validates the whole deal (title, partnerId, stage are
   * all required on the shared create/update DTO), so a partial body such as `{ stage }` is
   * rejected with 400. Bulk actions and other "change one field" callers go through here:
   * the change is merged onto the stored deal and the full record is sent.
   */
  patchDeal(id: string, changes: Partial<Deal>): void {
    const current = this.getDealById(id);
    if (!current) return;
    this.updateDeal(id, { ...current, ...changes });
  }

  /** The backend stores the salesperson as a user id; derive the name the UI displays. */
  private withSalesPersonName(deal: Deal): Deal {
    if (!deal.salesPersonUserId) return deal;
    const user = this.state.users().find(u => u.id === deal.salesPersonUserId);
    return user ? { ...deal, salesPerson: user.displayName } : deal;
  }

  updateDeal(id: string, deal: Partial<Deal>): void {
    this.api.updateDeal(id, deal as unknown).subscribe({
      next: (raw) => {
        const updated = this.withSalesPersonName(raw);
        this.deals.update(deals =>
          deals.map(d => d.id === id ? updated : d)
        );
        this.toast.show(`Deal updated`);
      },
      error: () => this.toast.show('Failed to update deal', { type: 'error' })
    });
  }

  deleteDeal(id: string): void {
    const deleted = this.deals().find(d => d.id === id);
    this.api.deleteDeal(id).subscribe({
      next: () => {
        this.deals.update(deals => deals.filter(d => d.id !== id));
        this.toast.show(`Deal <strong>${deleted?.title || id}</strong> deleted`, {
          undo: () => {
            if (deleted) {
              this.deals.update(deals => [...deals, deleted]);
            }
          }
        });
      },
      error: () => this.toast.show('Failed to delete deal', { type: 'error' })
    });
  }

  getDealById(id: string): Deal | undefined {
    return this.deals().find(d => d.id === id);
  }

  private toIso(dateStr?: string, timeStr?: string): string | undefined {
    if (!dateStr) return undefined;
    const d = timeStr ? new Date(`${dateStr}T${timeStr}`) : new Date(dateStr);
    return isNaN(d.getTime()) ? undefined : d.toISOString();
  }

  private reconcileDealActivityId(dealId: string, kind: keyof ActivityLog, localId: string, remoteId: string): void {
    this.deals.update(deals => deals.map(d => {
      if (d.id !== dealId || !d.activityLog) return d;
      const items = (d.activityLog[kind] as { id: string }[]).map(item => item.id === localId ? { ...item, id: remoteId } : item);
      return { ...d, activityLog: { ...d.activityLog, [kind]: items } };
    }));
  }

  addMeeting(dealId: string, meeting: Omit<Meeting, 'id'>): void {
    const localId = 'm' + Date.now();
    this.deals.update(deals => deals.map(d => {
      if (d.id !== dealId) return d;
      const log = d.activityLog || EMPTY_ACTIVITY_LOG;
      return { ...d, activityLog: { ...log, meetings: [...log.meetings, { ...meeting, id: localId }] } };
    }));
    this.api.createDealActivity(dealId, {
      type: 'MEETING', occurred_at: this.toIso(meeting.date, meeting.time), title: meeting.title,
      attendees: meeting.attendees, location: meeting.location, summary: meeting.summary, meeting_type: meeting.type
    }).subscribe({
      next: (dto) => this.reconcileDealActivityId(dealId, 'meetings', localId, dto.id),
      error: () => this.toast.show('Failed to save meeting to the server', { type: 'error' })
    });
    this.toast.show('Meeting logged');
  }

  addRecording(dealId: string, recording: Omit<TeamsRecording, 'id'>): void {
    const localId = 'r' + Date.now();
    this.deals.update(deals => deals.map(d => {
      if (d.id !== dealId) return d;
      const log = d.activityLog || EMPTY_ACTIVITY_LOG;
      return { ...d, activityLog: { ...log, recordings: [...log.recordings, { ...recording, id: localId }] } };
    }));
    this.api.createDealActivity(dealId, {
      type: 'RECORDING', occurred_at: this.toIso(recording.date), title: recording.title,
      meeting_link: recording.meetingLink, recording_link: recording.recordingLink, duration_text: recording.duration
    }).subscribe({
      next: (dto) => this.reconcileDealActivityId(dealId, 'recordings', localId, dto.id),
      error: () => this.toast.show('Failed to save recording to the server', { type: 'error' })
    });
    this.toast.show('Recording logged');
  }

  addNote(dealId: string, note: Omit<Note, 'id'>): void {
    const localId = 'n' + Date.now();
    this.deals.update(deals => deals.map(d => {
      if (d.id !== dealId) return d;
      const log = d.activityLog || EMPTY_ACTIVITY_LOG;
      return { ...d, activityLog: { ...log, notes: [...log.notes, { ...note, id: localId }] } };
    }));
    this.api.createDealActivity(dealId, {
      type: 'NOTE', occurred_at: this.toIso(note.date), author: note.author, content: note.content
    }).subscribe({
      next: (dto) => this.reconcileDealActivityId(dealId, 'notes', localId, dto.id),
      error: () => this.toast.show('Failed to save note to the server', { type: 'error' })
    });
    this.toast.show('Note added');
  }

  addFollowUp(dealId: string, followUp: Omit<FollowUp, 'id'>): void {
    const localId = 'f' + Date.now();
    this.deals.update(deals => deals.map(d => {
      if (d.id !== dealId) return d;
      const log = d.activityLog || EMPTY_ACTIVITY_LOG;
      return { ...d, activityLog: { ...log, followUps: [...log.followUps, { ...followUp, id: localId }] } };
    }));
    this.api.createDealActivity(dealId, {
      type: 'FOLLOW_UP', due_date: this.toIso(followUp.dueDate), title: followUp.title,
      assigned_to: followUp.assignedTo, status: followUp.status
    }).subscribe({
      next: (dto) => this.reconcileDealActivityId(dealId, 'followUps', localId, dto.id),
      error: () => this.toast.show('Failed to save follow-up to the server', { type: 'error' })
    });
    this.toast.show('Follow-up added');
  }

  updateDealStage(dealId: string, stage: string): void {
    const deal = this.getDealById(dealId);
    if (deal) {
      this.updateDeal(dealId, { ...deal, stage: stage as Deal['stage'] });
    }
  }

  /** Optimistically moves a deal to a new stage (no toast) and persists silently in the background. Used by the pipeline board, which drives its own toast/undo. */
  moveDealStage(dealId: string, stage: Deal['stage']): void {
    const deal = this.getDealById(dealId);
    if (!deal) return;
    this.deals.update(deals => deals.map(d => d.id === dealId ? { ...d, stage } : d));
    this.api.updateDeal(dealId, { ...deal, stage } as unknown).subscribe({
      next: () => {},
      error: () => this.toast.show('Failed to sync stage change with server', { type: 'error' })
    });
  }

  addEmailLog(dealId: string, email: Omit<EmailLog, 'id'>): void {
    const localId = 'e' + Date.now();
    this.deals.update(deals => deals.map(d => {
      if (d.id !== dealId) return d;
      const log = d.activityLog || EMPTY_ACTIVITY_LOG;
      return { ...d, activityLog: { ...log, emails: [...log.emails, { ...email, id: localId }] } };
    }));
    this.api.createDealActivity(dealId, {
      type: 'EMAIL', occurred_at: this.toIso(email.date), email_from: email.from, email_to: email.to,
      subject: email.subject, body: email.body, direction: email.direction
    }).subscribe({
      next: (dto) => this.reconcileDealActivityId(dealId, 'emails', localId, dto.id),
      error: () => this.toast.show('Failed to save email log to the server', { type: 'error' })
    });
    this.toast.show('Email logged');
  }

  addCallLog(dealId: string, call: Omit<CallLog, 'id'>): void {
    const localId = 'c' + Date.now();
    this.deals.update(deals => deals.map(d => {
      if (d.id !== dealId) return d;
      const log = d.activityLog || EMPTY_ACTIVITY_LOG;
      return { ...d, activityLog: { ...log, calls: [...log.calls, { ...call, id: localId }] } };
    }));
    this.api.createDealActivity(dealId, {
      type: 'CALL', occurred_at: this.toIso(call.date), duration_minutes: call.duration,
      caller_name: call.callerName, outcome: call.outcome, summary: call.summary
    }).subscribe({
      next: (dto) => this.reconcileDealActivityId(dealId, 'calls', localId, dto.id),
      error: () => this.toast.show('Failed to save call log to the server', { type: 'error' })
    });
    this.toast.show('Call logged');
  }

  updateFollowUpStatus(dealId: string, followUpId: string, status: 'pending' | 'done'): void {
    this.deals.update(deals => deals.map(d => {
      if (d.id !== dealId) return d;
      const log = d.activityLog || EMPTY_ACTIVITY_LOG;
      return { ...d, activityLog: { ...log, followUps: log.followUps.map(f => f.id === followUpId ? { ...f, status } : f) } };
    }));
    const followUp = this.deals().find(d => d.id === dealId)?.activityLog?.followUps.find(f => f.id === followUpId);
    if (followUp) {
      this.api.updateDealActivity(dealId, followUpId, {
        type: 'FOLLOW_UP', due_date: this.toIso(followUp.dueDate), title: followUp.title,
        assigned_to: followUp.assignedTo, status
      }).subscribe({
        error: () => this.toast.show('Failed to sync follow-up status to the server', { type: 'error' })
      });
    }
    this.toast.show(`Follow-up marked as ${status}`);
  }
}
