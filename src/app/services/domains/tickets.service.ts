import { Injectable, signal, computed, inject } from '@angular/core';
import { ApiService } from '../api.service';
import { ToastService } from '../toast.service';
import { Ticket } from '../crm-state.service';

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
    this.api.createTicket(ticket as unknown).subscribe({
      next: (created) => {
        this.tickets.update(tickets => [...tickets, created]);
        this.toast.show(`Ticket <strong>${created.title}</strong> created`);
      },
      error: () => this.toast.show('Failed to create ticket', { type: 'error' })
    });
  }

  updateTicket(id: string, ticket: Partial<Ticket>): void {
    this.api.updateTicket(id, ticket as unknown).subscribe({
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
}
