import { Component, inject, signal, computed, input, ChangeDetectionStrategy } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { CrmStateService } from '../services/crm-state.service';

interface CalendarDay {
  day: number;
  dateStr: string;
  isToday: boolean;
  isPast: boolean;
  teamMembers: string[];
}

@Component({
  selector: 'app-partner-schedule-calendar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  template: `
    <div class="cal" [class.cal--card]="!bare()">
      @if (!bare()) {
        <h3 class="cal__heading">Partner Schedule</h3>
      }

      <div class="cal__nav">
        <button class="cal__nav-btn" (click)="prevMonth()" aria-label="Previous month">
          <mat-icon>chevron_left</mat-icon>
        </button>
        <span class="cal__month">{{ monthNames[currentMonth()] }} {{ currentYear() }}</span>
        <button class="cal__nav-btn" (click)="nextMonth()" aria-label="Next month">
          <mat-icon>chevron_right</mat-icon>
        </button>
        @if (bare()) {
          <button class="cal__today" (click)="goToday()">Today</button>
        }
      </div>

      <div class="cal__dow">
        @for (h of dayHeaders; track h) {
          <span>{{ h }}</span>
        }
      </div>

      <div class="cal__grid">
        @for (cell of calendarDays(); track cell ? cell.dateStr : 'pad-' + $index) {
          @if (cell) {
            <div
              class="cal__cell"
              [class.is-today]="cell.isToday"
              [class.is-past]="cell.isPast"
              [class.has-people]="cell.teamMembers.length > 0"
            >
              <span class="cal__day">{{ cell.day }}</span>
              @if (cell.teamMembers.length) {
                <div class="cal__people">
                  @for (member of cell.teamMembers.slice(0, 3); track member) {
                    <span class="cal__avatar" [style.background-color]="getUserColor(member)" [title]="member">
                      {{ getInitials(member) }}
                    </span>
                  }
                  @if (cell.teamMembers.length > 3) {
                    <span class="cal__avatar cal__avatar--more">+{{ cell.teamMembers.length - 3 }}</span>
                  }
                </div>
              }
            </div>
          } @else {
            <div class="cal__cell cal__cell--pad"></div>
          }
        }
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; flex: 1; min-height: 0; }
    .cal { display: flex; flex-direction: column; height: 100%; min-height: 0; }
    .cal--card {
      background: var(--color-surface); border: 1px solid var(--color-border);
      border-radius: var(--radius-lg); padding: 14px;
    }
    .cal__heading {
      font-size: 11px; font-weight: 700; letter-spacing: 0.045em; text-transform: uppercase;
      color: var(--color-text-secondary); margin-bottom: 8px;
    }
    .cal__nav { display: flex; align-items: center; gap: 2px; margin-bottom: 6px; }
    .cal__nav-btn {
      width: 22px; height: 22px; border-radius: 6px; border: none; cursor: pointer;
      background: transparent; color: var(--color-text-tertiary);
      display: inline-flex; align-items: center; justify-content: center;
      transition: all var(--transition-fast);
    }
    .cal__nav-btn:hover { background: var(--color-surface-active); color: var(--color-text-primary); }
    .cal__nav-btn .mat-icon { font-size: 16px; width: 16px; height: 16px; line-height: 16px; }
    .cal__month { font-size: 11.5px; font-weight: 700; color: var(--color-text-primary); user-select: none; }
    .cal__today {
      margin-left: auto; font-size: 10px; font-weight: 700; padding: 3px 8px;
      border-radius: 999px; cursor: pointer;
      border: 1px solid var(--color-border); background: var(--color-surface);
      color: var(--color-text-secondary); transition: all var(--transition-fast);
    }
    .cal__today:hover { border-color: var(--color-text-tertiary); color: var(--color-text-primary); }

    .cal__dow { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 3px; margin-bottom: 3px; }
    .cal__dow span {
      text-align: center; font-size: 9px; font-weight: 700; letter-spacing: 0.05em;
      text-transform: uppercase; color: var(--color-text-placeholder);
    }

    /* 1fr rows make the weeks divide whatever height the tile gives us — no dead strip. */
    .cal__grid {
      flex: 1; min-height: 0; display: grid;
      grid-template-columns: repeat(7, minmax(0, 1fr));
      grid-auto-rows: minmax(0, 1fr); gap: 3px;
    }
    .cal__cell {
      position: relative; min-height: 0; min-width: 0; overflow: hidden;
      border-radius: var(--radius-sm); padding: 3px;
      display: flex; flex-direction: column; align-items: flex-start; gap: 2px;
      border: 1px solid var(--color-border-light); background: var(--color-surface);
    }
    .cal__cell--pad { border-color: transparent; background: transparent; }
    .cal__cell.is-past { background: var(--color-bg); }
    .cal__cell.has-people { border-color: var(--color-border-strong); }
    .cal__cell.is-today {
      background: var(--tile-soft, var(--color-accent-light));
      border-color: var(--tile, var(--color-accent));
      box-shadow: inset 0 0 0 1px var(--tile, var(--color-accent));
    }
    .cal__day { font-size: 10px; font-weight: 600; color: var(--color-text-tertiary); line-height: 1.1; }
    .cal__cell.is-today .cal__day { color: var(--tile, var(--color-accent)); font-weight: 800; }
    .cal__cell.has-people .cal__day { color: var(--color-text-primary); }
    .cal__people { display: flex; flex-wrap: wrap; gap: 1px; }
    .cal__avatar {
      width: 14px; height: 14px; border-radius: 999px; flex-shrink: 0;
      display: inline-flex; align-items: center; justify-content: center;
      font-size: 7px; font-weight: 700; color: #fff; line-height: 1;
    }
    .cal__avatar--more { background: var(--color-surface-active); color: var(--color-text-secondary); }
  `]
})
export class PartnerScheduleCalendarComponent {
  state = inject(CrmStateService);

  /** Rendered inside a bento tile, which already supplies the card surface and title. */
  readonly bare = input(false);

  currentMonth = signal(new Date().getMonth());
  currentYear = signal(new Date().getFullYear());

  monthNames = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December'
  ];

  dayHeaders = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

  private today = new Date();

  calendarDays = computed(() => {
    const year = this.currentYear();
    const month = this.currentMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();
    const startOffset = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

    const days: (CalendarDay | null)[] = [];

    for (let i = 0; i < startOffset; i++) {
      days.push(null);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const date = new Date(year, month, d);
      const isToday = this.today.getFullYear() === year && this.today.getMonth() === month && this.today.getDate() === d;
      const isPast = date < new Date(this.today.getFullYear(), this.today.getMonth(), this.today.getDate());

      const teamMembers = this.getTeamMembersForDate(dateStr);

      days.push({ day: d, dateStr, isToday, isPast, teamMembers });
    }

    return days;
  });

  private getTeamMembersForDate(dateStr: string): string[] {
    const membersSet = new Set<string>();

    for (const task of this.state.tasks()) {
      if (task.dueDate === dateStr && task.assignedToUserId) {
        const name = this.state.users().find(u => u.id === task.assignedToUserId)?.displayName;
        if (name) membersSet.add(name);
      }
    }

    for (const deal of this.state.deals()) {
      for (const meeting of (deal.activityLog?.meetings || [])) {
        if (meeting.date === dateStr) {
          for (const attendee of meeting.attendees) {
            membersSet.add(attendee);
          }
        }
      }
    }

    return Array.from(membersSet);
  }

  prevMonth() {
    if (this.currentMonth() === 0) {
      this.currentMonth.set(11);
      this.currentYear.update(y => y - 1);
    } else {
      this.currentMonth.update(m => m - 1);
    }
  }

  nextMonth() {
    if (this.currentMonth() === 11) {
      this.currentMonth.set(0);
      this.currentYear.update(y => y + 1);
    } else {
      this.currentMonth.update(m => m + 1);
    }
  }

  goToday() {
    const now = new Date();
    this.currentMonth.set(now.getMonth());
    this.currentYear.set(now.getFullYear());
  }

  getInitials(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0][0]?.toUpperCase() || '?';
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  getUserColor(name: string): string {
    const colors = [
      '#6366f1', '#10b981', '#f59e0b', '#ef4444',
      '#8b5cf6', '#ec4899', '#14b8a6', '#f97316',
      '#3b82f6', '#84cc16'
    ];
    const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return colors[hash % colors.length];
  }
}
