import { Component, inject, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { CrmStateService, Customer360View } from '../services/crm-state.service';
import { identityColor } from '../shared/ui/identity-color';
import { EmptyStateComponent } from '../shared/ui/empty-state.component';

@Component({
  selector: 'app-customer-360',
  imports: [MatIconModule, CommonModule, EmptyStateComponent],
  template: `
    <div class="grid grid-cols-12 gap-6">

      <!-- ─── LEFT COLUMN (5/12) ────────────────────────── -->
      <div class="col-span-12 lg:col-span-5 space-y-6">

        <!-- Profile Card -->
        <div class="card p-5 flex flex-col items-center text-center relative overflow-hidden">
                    <div class="w-32 h-32 rounded-full bg-primary text-on-primary flex items-center justify-center font-semibold text-3xl uppercase mb-6 relative z-10 border-4 border-surface shadow-md">
            {{ initials() }}
          </div>
          <h2 class="section-title">{{ view().partner.name }}</h2>
          <p class="text-sm font-semibold text-ink-3 mt-1 relative z-10">{{ jobTitle() }}</p>
          <div class="flex items-center gap-4 mt-8 relative z-10">
            <button class="w-12 h-12 rounded-full bg-muted text-ink-2 hover:bg-muted-strong hover:text-ink flex items-center justify-center transition-all cursor-pointer shadow-sm">
              <mat-icon>edit</mat-icon>
            </button>
            <button class="w-12 h-12 rounded-full bg-muted text-ink-2 hover:bg-muted-strong hover:text-ink flex items-center justify-center transition-all cursor-pointer shadow-sm">
              <mat-icon>mail</mat-icon>
            </button>
            <button class="w-12 h-12 rounded-full bg-muted text-ink-2 hover:bg-muted-strong hover:text-ink flex items-center justify-center transition-all cursor-pointer shadow-sm">
              <mat-icon>call</mat-icon>
            </button>
            <button class="w-12 h-12 rounded-full bg-muted text-ink-2 hover:bg-muted-strong hover:text-ink flex items-center justify-center transition-all cursor-pointer shadow-sm">
              <mat-icon>add</mat-icon>
            </button>
            <button class="w-12 h-12 rounded-full bg-muted text-ink-2 hover:bg-muted-strong hover:text-ink flex items-center justify-center transition-all cursor-pointer shadow-sm">
              <mat-icon>calendar_today</mat-icon>
            </button>
          </div>
        </div>

        <!-- Detailed Information Card -->
        <div class="card p-8 space-y-6 transition-all">
          <h3 class="card-title flex items-center justify-between">
            Detailed Information
            <button class="w-8 h-8 rounded-full bg-muted hover:bg-muted-strong flex items-center justify-center transition-colors">
              <mat-icon class="text-ink-2">edit</mat-icon>
            </button>
          </h3>
          <div class="space-y-5">
            <div class="flex items-center gap-4 group">
              <mat-icon class="text-ink-4 shrink-0">person_outline</mat-icon>
              <div class="flex-1">
                <span class="eyebrow block">First Name</span>
                <span class="text-base font-semibold text-ink">{{ firstName() }}</span>
              </div>
            </div>
            <div class="flex items-center gap-4 group">
              <mat-icon class="text-ink-4 shrink-0">person_outline</mat-icon>
              <div class="flex-1">
                <span class="eyebrow block">Last Name</span>
                <span class="text-base font-semibold text-ink">{{ lastName() }}</span>
              </div>
            </div>
            <div class="flex items-center gap-4 group">
              <mat-icon class="text-ink-4 shrink-0">mail_outline</mat-icon>
              <div class="flex-1 min-w-0">
                <span class="eyebrow block">Email</span>
                <span class="text-base font-semibold text-ink truncate block">{{ view().partner.email || '—' }}</span>
              </div>
            </div>
            <div class="flex items-center gap-4 group">
              <mat-icon class="text-ink-4 shrink-0">phone_outline</mat-icon>
              <div class="flex-1">
                <span class="eyebrow block">Phone Number</span>
                <span class="text-base font-semibold text-ink">{{ view().partner.phone || '—' }}</span>
              </div>
            </div>
            <div class="flex items-start gap-4 group">
              <mat-icon class="text-ink-4 shrink-0 mt-1">hub</mat-icon>
              <div class="flex-1">
                <span class="eyebrow block mb-1">Sources</span>
                <div class="flex flex-wrap gap-2">
                  @for (src of sources(); track src) {
                    <div class="w-8 h-8 rounded-full bg-muted flex items-center justify-center shadow-sm" [title]="src">
                      <mat-icon [class]="sourceIconColor(src)">{{ sourceIcon(src) }}</mat-icon>
                    </div>
                  }
                </div>
              </div>
            </div>
            <div class="flex items-center gap-4 group">
              <mat-icon class="text-ink-4 shrink-0">calendar_month</mat-icon>
              <div class="flex-1">
                <span class="eyebrow block">Last Contacted</span>
                <span class="text-base font-semibold text-ink">{{ lastContacted() }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ─── RIGHT COLUMN (7/12) ───────────────────────── -->
      <div class="col-span-12 lg:col-span-7 space-y-6">

        <!-- Interaction History Card -->
        <div class="card p-8 transition-all">
          <div class="flex items-center justify-between mb-6">
            <h3 class="modal-title">Interaction History</h3>
            <button class="w-8 h-8 rounded-full bg-muted hover:bg-muted-strong flex items-center justify-center transition-colors">
              <mat-icon class="text-ink-2">more_horiz</mat-icon>
            </button>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            @for (order of recentOrders(); track order.id) {
              <div class="card p-5 flex flex-col justify-between min-h-[140px]">
                <div class="flex items-start justify-between gap-2 mb-2">
                  <div class="min-w-0">
                    <div class="eyebrow mb-1">
                      {{ order.date ? (order.date | date:'MMM d') : '—' }}
                    </div>
                    <span class="font-semibold text-sm leading-snug line-clamp-2" [title]="order.title">{{ order.title }}</span>
                  </div>
                  <span class="badge shrink-0" [class]="dealCardClass(order.stage)">{{ order.stage }}</span>
                </div>
                <div class="flex items-end justify-between mt-4">
                  <span class="t-numeral">{{ formatCurrencyWithoutSymbol(order.amount) }}<span class="text-sm font-medium text-ink-3"> {{ currencySymbol() }}</span></span>
                  <div class="flex -space-x-2">
                    @for (member of teamMembers().slice(0, 3); track member.name) {
                      <div class="w-6 h-6 rounded-full flex items-center justify-center text-white text-meta font-semibold border-2 border-surface"
                           [style.background]="member.color"
                           [title]="member.name">
                        {{ member.initials }}
                      </div>
                    }
                  </div>
                </div>
              </div>
            } @empty {
              <div class="col-span-full card"><app-empty-state icon="history" title="No interactions recorded" text="Orders and activity for this customer will appear here." /></div>
            }
          </div>
        </div>

        <!-- Bottom Row: Task Schedule + Stage Funnel -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <!-- Task Schedule Card -->
          <div class="card p-8 transition-all">
            <div class="flex items-center justify-between mb-6">
              <h3 class="modal-title">Tasks Schedule</h3>
              <button class="w-8 h-8 rounded-full bg-muted hover:bg-muted-strong flex items-center justify-center transition-colors">
                <mat-icon class="text-ink-2">open_in_new</mat-icon>
              </button>
            </div>
            <div class="space-y-3">
              @for (item of scheduleItems(); track item.id) {
                <div class="card flex items-center gap-4 p-3 hover:bg-surface">
                  <div class="w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-semibold text-white text-xs"
                       [class]="item.type === 'task' ? (item.status === 'Completed' ? 'bg-success' : item.status === 'In Progress' ? 'bg-info' : 'bg-primary') : 'bg-ink-3'">
                    {{ item.dateLabel | slice:8:10 }}
                  </div>
                  <div class="min-w-0 flex-1">
                    <span class="text-sm font-semibold text-ink block truncate">{{ item.title }}</span>
                    <span class="eyebrow">{{ item.status || 'Scheduled' }}</span>
                  </div>
                </div>
              } @empty {
                <div class="card"><app-empty-state icon="event_available" title="No scheduled tasks" /></div>
              }
            </div>
          </div>

          <!-- Stage Funnel Card -->
          <div class="card p-8 transition-all">
            <div class="flex items-center justify-between mb-6">
              <h3 class="modal-title">Stage Funnel</h3>
              <button class="w-8 h-8 rounded-full bg-muted hover:bg-muted-strong flex items-center justify-center transition-colors">
                <mat-icon class="text-ink-2">open_in_new</mat-icon>
              </button>
            </div>
            <div class="space-y-5">
              <div class="flex items-center justify-between mb-2">
                <div class="badge badge-neutral">Total in Pipeline</div>
              </div>
              <div>
                <span class="text-3xl font-semibold text-ink">{{ formatCurrencyWithoutSymbol(totalValue()) }}<span class="text-lg font-semibold opacity-60">{{ currencySymbol() }}</span></span>
              </div>
              
              <div class="pt-4 space-y-3">
                @for (item of stageBreakdown(); track item.stage) {
                  <div class="card p-3 flex items-center justify-between">
                    <div class="min-w-0 pr-2">
                      <span class="eyebrow block truncate mb-0.5">{{ item.stage }}</span>
                      <span class="text-sm font-semibold text-ink">{{ formatCurrency(item.value) }}</span>
                    </div>
                    <div class="flex items-center gap-1">
                      <button class="w-6 h-6 rounded-full hover:bg-muted-strong flex items-center justify-center transition-colors">
                         <mat-icon class="text-ink-4">refresh</mat-icon>
                      </button>
                      <button class="w-6 h-6 rounded-full hover:bg-muted-strong flex items-center justify-center transition-colors">
                         <mat-icon class="text-ink-4">open_in_full</mat-icon>
                      </button>
                    </div>
                  </div>
                }
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  `,
  styles: [`
    :host { display: contents; }
  `]
})
export class Customer360Component {
  state = inject(CrmStateService);
  view = input.required<Customer360View>();

  primaryContact = computed(() => this.view().contacts[0] ?? null);

  initials = computed(() => {
    const name = this.view().partner.name;
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  });

  jobTitle = computed(() => this.primaryContact()?.jobTitle || 'Customer');

  firstName = computed(() => {
    const contact = this.primaryContact();
    if (contact) {
      const parts = contact.name.trim().split(/\s+/);
      return parts[0] || '—';
    }
    const parts = this.view().partner.name.trim().split(/\s+/);
    return parts[0] || '—';
  });

  lastName = computed(() => {
    const contact = this.primaryContact();
    if (contact) {
      const parts = contact.name.trim().split(/\s+/);
      return parts.length > 1 ? parts.slice(1).join(' ') : '—';
    }
    const parts = this.view().partner.name.trim().split(/\s+/);
    return parts.length > 1 ? parts.slice(1).join(' ') : '—';
  });

  sources = computed(() => {
    const set = new Set<string>();
    const partner = this.view().partner;
    if (partner.source) set.add(partner.source);
    for (const o of this.view().orders) {
      const deal = this.state.deals().find(d => d.id === o.id);
      if (deal?.activityLog) {
        if (deal.activityLog.calls.length) set.add('Call');
        if (deal.activityLog.emails.length) set.add('Email');
        if (deal.activityLog.meetings.some(m => m.type === 'teams')) set.add('Teams');
        if (deal.activityLog.meetings.some(m => m.type === 'in-person' || m.type === 'demo')) set.add('In-Person');
      }
    }
    if (this.view().tickets.length) set.add('Support');
    return Array.from(set);
  });

  lastContacted = computed(() => {
    const dates: string[] = [];
    for (const o of this.view().orders) {
      if (o.date) dates.push(o.date);
      const deal = this.state.deals().find(d => d.id === o.id);
      if (deal?.activityLog) {
        for (const c of deal.activityLog.calls) dates.push(c.date);
        for (const e of deal.activityLog.emails) dates.push(e.date);
        for (const m of deal.activityLog.meetings) dates.push(m.date);
      }
    }
    for (const m of this.view().meetings) dates.push(m.date);
    if (!dates.length) return 'No interactions yet';
    return [...dates].sort().reverse()[0];
  });

  recentOrders = computed(() => {
    return [...this.view().orders]
      .sort((a, b) => {
        if (!a.date && !b.date) return 0;
        if (!a.date) return 1;
        if (!b.date) return -1;
        return b.date.localeCompare(a.date);
      })
      .slice(0, 6);
  });

  teamMembers = computed(() => {
    const set = new Set<string>();
    const partnerId = this.view().partner.id;
    for (const o of this.view().orders) {
      const deal = this.state.deals().find(d => d.id === o.id);
      if (deal?.salesPerson) set.add(deal.salesPerson);
      if (deal?.activityLog) {
        for (const m of deal.activityLog.meetings) {
          for (const a of m.attendees) set.add(a);
        }
        for (const c of deal.activityLog.calls) set.add(c.callerName);
      }
    }
    for (const t of this.state.tickets().filter(tk => tk.partnerId === partnerId)) {
      if (t.assignedTo) set.add(t.assignedTo);
    }
    return Array.from(set).map(name => {
      const user = this.state.users().find(
        u => u.displayName === name || u.displayName.includes(name) || name.includes(u.displayName)
      );
      if (user) {
        const team = this.state.teams().find(t => t.id === user.teamId);
        return {
          name: user.displayName,
          initials: user.initials,
          color: user.avatarColor,
          role: team?.name || user.jobTitle || ''
        };
      }
      const initials = name.split(/\s+/).filter(Boolean).map(p => p[0]).join('').toUpperCase().slice(0, 2);
      return { name, initials, color: identityColor(name), role: '' };
    });
  });

  scheduleItems = computed(() => {
    const partnerId = this.view().partner.id;
    const items: { id: string; title: string; dateLabel: string; type: 'task' | 'meeting'; status?: string }[] = [];

    for (const t of this.state.tasks()) {
      if (t.relatedEntityId === partnerId) {
        items.push({ id: t.id, title: t.title, dateLabel: t.createdAt, type: 'task', status: t.status });
      }
    }
    for (const o of this.view().orders) {
      const deal = this.state.deals().find(d => d.id === o.id);
      if (deal?.activityLog) {
        for (const m of deal.activityLog.meetings) {
          if (!items.some(i => i.title === m.title)) {
            items.push({ id: m.id, title: m.title, dateLabel: m.date + ' · ' + m.time, type: 'meeting' });
          }
        }
      }
    }
    return items.sort((a, b) => b.dateLabel.localeCompare(a.dateLabel));
  });

  weightedValue = computed(() => {
    return Math.round(this.view().orders.reduce((sum, o) => sum + o.amount * this.stageWeight(o.stage), 0));
  });

  totalValue = computed(() => this.view().orders.reduce((sum, o) => sum + o.amount, 0));

  stageBreakdown = computed(() => {
    const map = new Map<string, { value: number; count: number }>();
    for (const o of this.view().orders) {
      const entry = map.get(o.stage) || { value: 0, count: 0 };
      entry.value += o.amount;
      entry.count += 1;
      map.set(o.stage, entry);
    }
    const colors: Record<string, string> = {
      'New': 'var(--color-info)', 'Proposal sent': 'var(--color-warning)', 'Confirmed': 'var(--color-success)',
      'Awaiting Invoicing': 'var(--color-violet)', 'Invoiced': 'var(--color-accent)', 'Closed Won': 'var(--color-success)',
      'Closed Lost': 'var(--color-danger)'
    };
    return Array.from(map.entries()).map(([stage, data]) => ({
      stage,
      value: data.value,
      count: data.count,
      color: colors[stage] || 'var(--color-text-tertiary)'
    }));
  });

  formatCurrency(value: number) {
    const cur = this.state.globalCurrency();
    const locale = cur === 'MAD' ? 'fr-MA' : cur === 'EUR' ? 'fr-FR' : 'en-US';
    return new Intl.NumberFormat(locale, { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(value);
  }

  stageWeight(stage: string): number {
    switch (stage) {
      case 'Closed Won': return 1;
      case 'Invoiced': return 0.95;
      case 'Awaiting Invoicing': return 0.9;
      case 'Confirmed': return 0.85;
      case 'Proposal sent': return 0.5;
      case 'New': return 0.2;
      case 'Closed Lost': return 0;
      default: return 0.3;
    }
  }

  stageBadgeClass(stage: string): string {
    switch (stage) {
      case 'Confirmed':
      case 'Closed Won': return 'badge-success';
      case 'Awaiting Invoicing':
      case 'Invoiced': return 'badge-info';
      case 'New': return 'bg-muted text-ink-2 border-line';
      case 'Proposal sent': return 'badge-violet';
      case 'Closed Lost': return 'badge-danger';
      default: return 'bg-subtle text-ink-2 border-line-soft';
    }
  }

  sourceBadgeClass(source: string): string {
    switch (source) {
      case 'LinkedIn': return 'bg-muted text-ink border-line';
      case 'Call': return 'bg-muted text-ink border-line';
      case 'Email': return 'bg-muted text-ink border-line';
      case 'Teams': return 'bg-muted text-ink border-line';
      case 'In-Person': return 'bg-muted text-ink border-line';
      case 'Support': return 'bg-muted text-ink border-line';
      case 'Website form': return 'bg-muted text-ink border-line';
      case 'Referral': return 'bg-muted text-ink border-line';
      case 'Marketing campaign': return 'bg-muted text-ink border-line';
      default: return 'bg-subtle text-ink-2 border-line-soft';
    }
  }

  sourceIconColor(source: string): string {
    switch (source) {
      case 'LinkedIn': return 'text-ink-2';
      case 'Call': return 'text-ink-2';
      case 'Email': return 'text-ink-2';
      case 'Teams': return 'text-ink-2';
      case 'In-Person': return 'text-ink-2';
      case 'Support': return 'text-ink-2';
      case 'Website form': return 'text-ink-2';
      case 'Referral': return 'text-ink-2';
      case 'Marketing campaign': return 'text-ink-2';
      default: return 'text-ink-3';
    }
  }

  sourceIcon(source: string): string {
    switch (source) {
      case 'LinkedIn': return 'business';
      case 'Call': return 'call';
      case 'Email': return 'mail';
      case 'Teams': return 'video_camera_front';
      case 'In-Person': return 'location_on';
      case 'Support': return 'headset_mic';
      case 'Website form': return 'public';
      case 'Referral': return 'group_add';
      case 'Marketing campaign': return 'campaign';
      default: return 'source';
    }
  }

  dealCardClass(stage: string): string {
    switch (stage) {
      case 'Closed Won': return 'badge-success';
      case 'Confirmed':
      case 'Invoiced': return 'badge-info';
      case 'Awaiting Invoicing': return 'badge-warning';
      case 'Proposal sent': return 'badge-accent';
      case 'New': return 'badge-neutral';
      case 'Closed Lost': return 'badge-danger';
      default: return 'badge-neutral';
    }
  }

  formatCurrencyWithoutSymbol(value: number) {
    const cur = this.state.globalCurrency();
    const locale = cur === 'MAD' ? 'fr-MA' : cur === 'EUR' ? 'fr-FR' : 'en-US';
    return new Intl.NumberFormat(locale, { style: 'decimal', maximumFractionDigits: 0 }).format(value);
  }

  currencySymbol(): string {
    const cur = this.state.globalCurrency();
    if (cur === 'MAD') return ' DH';
    if (cur === 'EUR') return '€';
    return '$';
  }
}
