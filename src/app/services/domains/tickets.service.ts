import { Injectable, signal, computed, inject } from '@angular/core';
import { ApiService } from '../api.service';
import { ToastService } from '../toast.service';
import { Ticket } from '../crm-state.service';
import { Observable, tap } from 'rxjs';
import { EntityLink, isLinked } from '../../shared/related-entity.model';

export type { Ticket };

@Injectable({
  providedIn: 'root'
})
export class TicketsService {
  private api = inject(ApiService);
  private toast = inject(ToastService);

  tickets = signal<Ticket[]>([]);
  isLoaded = signal<boolean>(false);
  isLoading = signal<boolean>(false);
  error = signal<string | null>(null);

  allTickets = computed(() => this.tickets());
  isLoading$ = computed(() => this.isLoading());
  error$ = computed(() => this.error());

  load(): void {
    if (this.isLoaded()) return;
    this.isLoading.set(true);
    this.error.set(null);

    this.api.getTickets().subscribe({
      next: (tickets) => {
        if (tickets && tickets.length > 0) {
          this.tickets.set(tickets);
        }
        this.isLoaded.set(true);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.warn('Failed to load tickets from API:', err);
        this.isLoaded.set(true);
        this.isLoading.set(false);
        this.error.set('Failed to load tickets from the server.');
      }
    });
  }

  addTicket(ticket: Omit<Ticket, 'id' | 'createdAt' | 'updatedAt'>): void {
    this.api.createTicket(ticket).subscribe({
      next: (created) => {
        this.tickets.update(tickets => [...tickets, created]);
        this.toast.show(`Ticket <strong>${created.title}</strong> created`);
      },
      error: () => this.toast.show('Failed to create ticket', { type: 'error' })
    });
  }

  /**
   * Fetches one ticket by id and merges it into the store — for deep links to a ticket page
   * before (or instead of) the full list being loaded.
   */
  fetchTicket(id: string): Observable<Ticket> {
    return this.api.getTicket(id).pipe(
      tap(ticket => this.tickets.update(tickets =>
        tickets.some(t => t.id === id) ? tickets.map(t => t.id === id ? ticket : t) : [...tickets, ticket]))
    );
  }

  /**
   * Applies a partial change on top of the stored ticket and sends the whole record, because
   * PATCH /tickets/{id} re-validates every required field (title, status…). The partner link
   * is sent in both the legacy `partnerId` form and the generic link pair so either reader
   * on the backend sees it.
   */
  patchTicket(id: string, changes: Partial<Ticket>): void {
    const current = this.tickets().find(t => t.id === id);
    if (!current) return;
    const merged: Ticket = { ...current, ...changes };
    const partnerId = merged.relatedPartnerId || merged.partnerId || undefined;
    const link = merged.relatedEntityType && merged.relatedEntityId
      ? { relatedEntityType: merged.relatedEntityType, relatedEntityId: merged.relatedEntityId }
      : partnerId ? { relatedEntityType: 'PARTNER' as const, relatedEntityId: partnerId } : {};
    this.updateTicket(id, {
      title: merged.title,
      description: merged.description,
      type: merged.type,
      status: merged.status,
      priority: merged.priority,
      assignedToUserId: merged.assignedToUserId || undefined,
      deadline: merged.deadline || undefined,
      resolution: merged.resolution,
      partnerId,
      ...link
    });
  }

  updateTicket(id: string, ticket: Partial<Ticket>): void {
    this.api.updateTicket(id, ticket).subscribe({
      next: (updated) => {
        this.tickets.update(tickets =>
          tickets.map(t => t.id === id ? updated : t)
        );
        this.toast.show(`Ticket updated`);
      },
      error: () => this.toast.show('Failed to update ticket', { type: 'error' })
    });
  }

  deleteTicket(id: string): void {
    const deleted = this.tickets().find(t => t.id === id);
    this.api.deleteTicket(id).subscribe({
      next: () => {
        this.tickets.update(tickets => tickets.filter(t => t.id !== id));
        this.toast.show(`Ticket <strong>${deleted?.title || id}</strong> deleted`, {
          undo: () => {
            if (deleted) {
              this.tickets.update(tickets => [...tickets, deleted]);
            }
          }
        });
      },
      error: () => this.toast.show('Failed to delete ticket', { type: 'error' })
    });
  }

  getTicketById(id: string): Ticket | undefined {
    return this.tickets().find(t => t.id === id);
  }

  /** Tickets linked to the given record, from the already-loaded list. */
  relatedTo(link: EntityLink): Ticket[] {
    if (!isLinked(link)) return [];
    if (link.relatedEntityType === 'PARTNER') {
      return this.tickets().filter(t => t.relatedPartnerId === link.relatedEntityId || t.partnerId === link.relatedEntityId);
    }
    return this.tickets().filter(t =>
      t.relatedEntityType === link.relatedEntityType && t.relatedEntityId === link.relatedEntityId);
  }

  /**
   * Ensures the tickets for one record are present. The current API only exposes the
   * unfiltered/paginated list, so this simply guarantees the shared store is loaded;
   * `relatedTo` then filters from it.
   */
  loadRelatedTo(_link: EntityLink): void {
    this.load();
  }
}
