import { Component, OnInit, computed, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { TasksService } from '../services/domains/tasks.service';
import { TicketsService } from '../services/domains/tickets.service';
import { EntityLink, RelatedEntityType, isLinked } from './related-entity.model';

/**
 * The tasks and tickets attached to one record, for the deal / proposal / customer / prospect
 * cards — "everything open against this customer" without leaving their tab.
 *
 * Renders from the shared task/ticket stores so it stays in step with edits made elsewhere in
 * the session, and asks the API for this record's items on init because the unfiltered list
 * loads only the first page.
 */
@Component({
  selector: 'app-related-work',
  imports: [CommonModule, MatIconModule, RouterModule],
  template: `
    <div class="space-y-5">
      <section>
        <div class="flex items-center justify-between mb-2">
          <h4 class="text-xs font-bold text-zinc-500 uppercase tracking-wide flex items-center gap-1.5">
            <mat-icon class="text-[16px] w-4 h-4 text-zinc-400">checklist</mat-icon>
            Tasks
            <span class="text-zinc-400 font-semibold">({{ tasks().length }})</span>
          </h4>
          <a routerLink="/tasks" class="text-xs font-semibold text-blue-700 hover:text-blue-800">All tasks</a>
        </div>

        @if (tasks().length === 0) {
          <p class="text-xs text-zinc-400 italic">No tasks linked to this record.</p>
        } @else {
          <div class="space-y-1.5">
            @for (task of tasks(); track task.id) {
              <div class="flex items-center justify-between gap-3 bg-zinc-50 border border-zinc-100 rounded-lg px-3 py-2">
                <div class="min-w-0">
                  <p class="text-xs font-semibold text-zinc-800 truncate">{{ task.title }}</p>
                  @if (task.deadline) {
                    <p class="text-meta text-zinc-400">Due {{ task.deadline }}</p>
                  }
                </div>
                <div class="flex items-center gap-2 shrink-0">
                  @if (task.priority) {
                    <span class="text-meta font-bold uppercase" [class]="taskPriorityClass(task.priority)">{{ task.priority }}</span>
                  }
                  <span class="text-meta font-semibold px-2 py-0.5 rounded-full" [class]="taskStatusClass(task.status)">{{ task.status }}</span>
                </div>
              </div>
            }
          </div>
        }
      </section>

      <section>
        <div class="flex items-center justify-between mb-2">
          <h4 class="text-xs font-bold text-zinc-500 uppercase tracking-wide flex items-center gap-1.5">
            <mat-icon class="text-[16px] w-4 h-4 text-zinc-400">confirmation_number</mat-icon>
            Tickets
            <span class="text-zinc-400 font-semibold">({{ tickets().length }})</span>
          </h4>
          <a routerLink="/tickets" class="text-xs font-semibold text-blue-700 hover:text-blue-800">All tickets</a>
        </div>

        @if (tickets().length === 0) {
          <p class="text-xs text-zinc-400 italic">No tickets linked to this record.</p>
        } @else {
          <div class="space-y-1.5">
            @for (ticket of tickets(); track ticket.id) {
              <div class="flex items-center justify-between gap-3 bg-zinc-50 border border-zinc-100 rounded-lg px-3 py-2">
                <div class="min-w-0">
                  <p class="text-xs font-semibold text-zinc-800 truncate">{{ ticket.title }}</p>
                  @if (ticket.type) {
                    <p class="text-meta text-zinc-400">{{ ticket.type }}</p>
                  }
                </div>
                <span class="text-meta font-semibold px-2 py-0.5 rounded-full shrink-0" [class]="ticketStatusClass(ticket.status)">
                  {{ ticketStatusLabel(ticket.status) }}
                </span>
              </div>
            }
          </div>
        }
      </section>
    </div>
  `
})
export class RelatedWorkComponent implements OnInit {
  private tasksService = inject(TasksService);
  private ticketsService = inject(TicketsService);

  entityType = input.required<RelatedEntityType>();
  entityId = input.required<string>();

  private link = computed<EntityLink>(() => ({
    relatedEntityType: this.entityType(),
    relatedEntityId: this.entityId(),
  }));

  tasks = computed(() => this.tasksService.relatedTo(this.link()));
  tickets = computed(() => this.ticketsService.relatedTo(this.link()));

  constructor() {
    this.tasksService.load();
    this.ticketsService.load();
  }

  ngOnInit(): void {
    const link = this.link();
    if (!isLinked(link)) return;
    this.tasksService.loadRelatedTo(link);
    this.ticketsService.loadRelatedTo(link);
  }

  taskStatusClass(status: string): string {
    switch (status) {
      case 'Completed': return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
      case 'In Progress': return 'bg-sky-50 text-sky-700 border border-sky-200';
      default: return 'bg-zinc-100 text-zinc-700 border border-zinc-200';
    }
  }

  taskPriorityClass(priority: string): string {
    switch (priority) {
      case 'Urgent': return 'text-red-600';
      case 'Medium': return 'text-amber-600';
      default: return 'text-emerald-600';
    }
  }

  ticketStatusLabel(status: string): string {
    switch (status) {
      case 'IN_PROGRESS': return 'In Progress';
      case 'OPEN': return 'Open';
      case 'RESOLVED': return 'Resolved';
      case 'CLOSED': return 'Closed';
      default: return status;
    }
  }

  ticketStatusClass(status: string): string {
    switch (status) {
      case 'OPEN': return 'bg-red-50 text-red-600 border border-red-200';
      case 'IN_PROGRESS': return 'bg-amber-50 text-amber-700 border border-amber-200';
      case 'RESOLVED': return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
      default: return 'bg-zinc-100 text-zinc-500 border border-zinc-200';
    }
  }
}
