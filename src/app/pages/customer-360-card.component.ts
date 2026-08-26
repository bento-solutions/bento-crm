import { Component, inject, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { CrmStateService, Customer360View } from '../services/crm-state.service';

@Component({
  selector: 'app-customer-360',
  imports: [MatIconModule, CommonModule],
  template: `
    <div class="grid grid-cols-12 gap-6">

      <!-- ─── LEFT COLUMN (5/12) ────────────────────────── -->
      <div class="col-span-12 lg:col-span-5 space-y-6">

        <!-- Profile Card -->
        <div class="card rounded-[32px] p-10 flex flex-col items-center text-center hover:shadow-lg transition-all relative overflow-hidden">
          <div class="absolute inset-0 bg-gradient-to-b from-white/60 to-transparent pointer-events-none"></div>
          <div class="w-32 h-32 rounded-full bg-gradient-to-br from-blue-500 via-blue-400 to-sky-500 text-white flex items-center justify-center font-extrabold text-5xl uppercase shadow-xl mb-6 relative z-10 border-4 border-white/50">
            {{ initials() }}
          </div>
          <h2 class="text-2xl font-extrabold text-zinc-900 font-sans relative z-10">{{ view().partner.name }}</h2>
          <p class="text-sm font-semibold text-zinc-500 font-sans mt-1 relative z-10">{{ jobTitle() }}</p>
          <div class="flex items-center gap-4 mt-8 relative z-10">
            <button class="w-12 h-12 rounded-full bg-zinc-100 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900 flex items-center justify-center transition-all cursor-pointer shadow-sm">
              <mat-icon style="font-size:20px;width:20px;height:20px">edit</mat-icon>
            </button>
            <button class="w-12 h-12 rounded-full bg-zinc-100 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900 flex items-center justify-center transition-all cursor-pointer shadow-sm">
              <mat-icon style="font-size:20px;width:20px;height:20px">mail</mat-icon>
            </button>
            <button class="w-12 h-12 rounded-full bg-zinc-100 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900 flex items-center justify-center transition-all cursor-pointer shadow-sm">
              <mat-icon style="font-size:20px;width:20px;height:20px">call</mat-icon>
            </button>
            <button class="w-12 h-12 rounded-full bg-zinc-100 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900 flex items-center justify-center transition-all cursor-pointer shadow-sm">
              <mat-icon style="font-size:20px;width:20px;height:20px">add</mat-icon>
            </button>
            <button class="w-12 h-12 rounded-full bg-zinc-100 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900 flex items-center justify-center transition-all cursor-pointer shadow-sm">
              <mat-icon style="font-size:20px;width:20px;height:20px">calendar_today</mat-icon>
            </button>
          </div>
        </div>

        <!-- Detailed Information Card -->
        <div class="card rounded-[32px] p-8 space-y-6 hover:shadow-lg transition-all">
          <h3 class="text-base font-extrabold text-zinc-900 font-sans flex items-center justify-between">
            Detailed Information
            <button class="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center transition-colors">
              <mat-icon style="font-size:16px;width:16px;height:16px" class="text-zinc-600">edit</mat-icon>
            </button>
          </h3>
          <div class="space-y-5">
            <div class="flex items-center gap-4 group">
              <mat-icon class="text-zinc-400 shrink-0" style="font-size:20px;width:20px;height:20px">person_outline</mat-icon>
              <div class="flex-1">
                <span class="text-meta font-bold text-zinc-400 uppercase tracking-wider font-sans block">First Name</span>
                <span class="text-base font-bold text-zinc-900 font-sans">{{ firstName() }}</span>
              </div>
            </div>
            <div class="flex items-center gap-4 group">
              <mat-icon class="text-zinc-400 shrink-0" style="font-size:20px;width:20px;height:20px">person_outline</mat-icon>
              <div class="flex-1">
                <span class="text-meta font-bold text-zinc-400 uppercase tracking-wider font-sans block">Last Name</span>
                <span class="text-base font-bold text-zinc-900 font-sans">{{ lastName() }}</span>
              </div>
            </div>
            <div class="flex items-center gap-4 group">
              <mat-icon class="text-zinc-400 shrink-0" style="font-size:20px;width:20px;height:20px">mail_outline</mat-icon>
              <div class="flex-1 min-w-0">
                <span class="text-meta font-bold text-zinc-400 uppercase tracking-wider font-sans block">Email</span>
                <span class="text-base font-bold text-zinc-900 font-sans truncate block">{{ view().partner.email || '—' }}</span>
              </div>
            </div>
            <div class="flex items-center gap-4 group">
              <mat-icon class="text-zinc-400 shrink-0" style="font-size:20px;width:20px;height:20px">phone_outline</mat-icon>
              <div class="flex-1">
                <span class="text-meta font-bold text-zinc-400 uppercase tracking-wider font-sans block">Phone Number</span>
                <span class="text-base font-bold text-zinc-900 font-sans">{{ view().partner.phone || '—' }}</span>
              </div>
            </div>
            <div class="flex items-start gap-4 group">
              <mat-icon class="text-zinc-400 shrink-0 mt-1" style="font-size:20px;width:20px;height:20px">hub</mat-icon>
              <div class="flex-1">
                <span class="text-meta font-bold text-zinc-400 uppercase tracking-wider font-sans block mb-1">Sources</span>
                <div class="flex flex-wrap gap-2">
                  @for (src of sources(); track src) {
                    <div class="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center shadow-sm" [title]="src">
                      <mat-icon style="font-size:16px;width:16px;height:16px" [class]="sourceIconColor(src)">{{ sourceIcon(src) }}</mat-icon>
                    </div>
                  }
                </div>
              </div>
            </div>
            <div class="flex items-center gap-4 group">
              <mat-icon class="text-zinc-400 shrink-0" style="font-size:20px;width:20px;height:20px">calendar_month</mat-icon>
              <div class="flex-1">
                <span class="text-meta font-bold text-zinc-400 uppercase tracking-wider font-sans block">Last Contacted</span>
                <span class="text-base font-bold text-zinc-900 font-sans">{{ lastContacted() }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ─── RIGHT COLUMN (7/12) ───────────────────────── -->
      <div class="col-span-12 lg:col-span-7 space-y-6">

        <!-- Interaction History Card -->
        <div class="card rounded-[32px] p-8 hover:shadow-lg transition-all">
          <div class="flex items-center justify-between mb-6">
            <h3 class="font-extrabold text-zinc-900 text-lg font-sans">Interaction History</h3>
            <button class="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center transition-colors">
              <mat-icon style="font-size:20px;width:20px;height:20px" class="text-zinc-600">more_horiz</mat-icon>
            </button>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            @for (order of recentOrders(); track order.id) {
              <div class="p-5 rounded-[24px] flex flex-col justify-between shadow-md hover:scale-[1.02] transition-transform min-h-[140px]" [class]="dealCardClass(order.stage)">
                <div class="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <div class="text-meta font-bold opacity-80 uppercase tracking-wide font-sans mb-1">
                      {{ order.date ? (order.date | date:'MMM d') : '—' }}
                    </div>
                    <span class="font-bold text-sm font-sans leading-snug line-clamp-2" [title]="order.title">{{ order.title }}</span>
                  </div>
                  <button class="w-6 h-6 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center shrink-0 transition-colors">
                    <mat-icon style="font-size:14px;width:14px;height:14px">more_horiz</mat-icon>
                  </button>
                </div>
                <div class="flex items-end justify-between mt-4">
                  <span class="font-extrabold font-sans text-2xl">{{ formatCurrencyWithoutSymbol(order.amount) }}<span class="text-sm font-bold opacity-80">{{ currencySymbol() }}</span></span>
                  <div class="flex -space-x-2">
                    @for (member of teamMembers().slice(0, 3); track member.name) {
                      <div class="w-6 h-6 rounded-full flex items-center justify-center text-white text-[8px] font-bold font-sans border border-white/50 shadow-sm"
                           [style.background]="member.color"
                           [title]="member.name">
                        {{ member.initials }}
                      </div>
                    }
                  </div>
                </div>
              </div>
            } @empty {
              <div class="col-span-2 text-center py-12 text-zinc-400 text-sm font-sans bg-white border border-zinc-200 rounded-[24px]">No interactions recorded.</div>
            }
          </div>
        </div>

        <!-- Bottom Row: Task Schedule + Stage Funnel -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <!-- Task Schedule Card -->
          <div class="card rounded-[32px] p-8 hover:shadow-lg transition-all">
            <div class="flex items-center justify-between mb-6">
              <h3 class="font-extrabold text-zinc-900 text-lg font-sans">Tasks Schedule</h3>
              <button class="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center transition-colors">
                <mat-icon style="font-size:20px;width:20px;height:20px" class="text-zinc-600">open_in_new</mat-icon>
              </button>
            </div>
            <div class="space-y-3">
              @for (item of scheduleItems(); track item.id) {
                <div class="flex items-center gap-4 p-3 bg-white border border-zinc-200 rounded-[16px] hover:bg-white/80 transition-colors shadow-sm">
                  <div class="w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-bold text-white text-xs font-sans shadow-inner"
                       [class]="item.type === 'task' ? (item.status === 'Completed' ? 'bg-zinc-700' : item.status === 'In Progress' ? 'bg-zinc-700' : 'bg-[#2E5AAC]') : 'bg-zinc-500'">
                    {{ item.dateLabel | slice:8:10 }}
                  </div>
                  <div class="min-w-0 flex-1">
                    <span class="text-sm font-bold text-zinc-800 font-sans block truncate">{{ item.title }}</span>
                    <span class="text-meta font-bold text-zinc-400 uppercase tracking-wide font-sans">{{ item.status || 'Scheduled' }}</span>
                  </div>
                </div>
              } @empty {
                <div class="text-center py-6 text-zinc-400 text-sm font-sans bg-white border border-zinc-200 rounded-[16px]">No scheduled tasks</div>
              }
            </div>
          </div>

          <!-- Stage Funnel Card -->
          <div class="card rounded-[32px] p-8 hover:shadow-lg transition-all">
            <div class="flex items-center justify-between mb-6">
              <h3 class="font-extrabold text-zinc-900 text-lg font-sans">Stage Funnel</h3>
              <button class="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center transition-colors">
                <mat-icon style="font-size:20px;width:20px;height:20px" class="text-zinc-600">open_in_new</mat-icon>
              </button>
            </div>
            <div class="space-y-5">
              <div class="flex items-center justify-between mb-2">
                <div class="text-meta font-bold text-zinc-400 uppercase tracking-wider font-sans bg-zinc-100 px-3 py-1 rounded-full">Total in Pipeline</div>
              </div>
              <div>
                <span class="text-3xl font-extrabold font-sans text-zinc-900">{{ formatCurrencyWithoutSymbol(totalValue()) }}<span class="text-lg font-bold opacity-60">{{ currencySymbol() }}</span></span>
              </div>
              
              <div class="pt-4 space-y-3">
                @for (item of stageBreakdown(); track item.stage) {
                  <div class="bg-white border border-zinc-200 rounded-[16px] p-3 flex items-center justify-between shadow-sm">
                    <div class="min-w-0 pr-2">
                      <span class="text-meta font-bold text-zinc-500 font-sans block truncate uppercase tracking-wider mb-0.5">{{ item.stage }}</span>
                      <span class="text-sm font-extrabold font-sans text-zinc-800">{{ formatCurrency(item.value) }}</span>
                    </div>
                    <div class="flex items-center gap-1">
                      <button class="w-6 h-6 rounded-full hover:bg-zinc-200 flex items-center justify-center transition-colors">
                         <mat-icon style="font-size:14px;width:14px;height:14px" class="text-zinc-400">refresh</mat-icon>
                      </button>
                      <button class="w-6 h-6 rounded-full hover:bg-zinc-200 flex items-center justify-center transition-colors">
                         <mat-icon style="font-size:14px;width:14px;height:14px" class="text-zinc-400">open_in_full</mat-icon>
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
      const colors = ['#7F77DD', '#1D9E75', '#D85A30', '#378ADD', '#BA7517', '#D4537E'];
      return { name, initials, color: colors[name.length % colors.length], role: '' };
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
      'New': '#378ADD', 'Proposal sent': '#BA7517', 'Confirmed': '#1D9E75',
      'Awaiting Invoicing': '#7F77DD', 'Invoiced': '#D4537E', 'Closed Won': '#059669',
      'Closed Lost': '#DC2626'
    };
    return Array.from(map.entries()).map(([stage, data]) => ({
      stage,
      value: data.value,
      count: data.count,
      color: colors[stage] || '#94A3B8'
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
      case 'Closed Won': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Awaiting Invoicing':
      case 'Invoiced': return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'New': return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'Proposal sent': return 'bg-violet-50 text-violet-700 border-violet-200';
      case 'Closed Lost': return 'bg-red-50 text-red-700 border-red-200';
      default: return 'bg-zinc-50 text-zinc-700 border-zinc-100';
    }
  }

  sourceBadgeClass(source: string): string {
    switch (source) {
      case 'LinkedIn': return 'bg-zinc-100 text-zinc-950 border-zinc-200';
      case 'Call': return 'bg-zinc-100 text-zinc-950 border-zinc-200';
      case 'Email': return 'bg-zinc-100 text-zinc-950 border-zinc-200';
      case 'Teams': return 'bg-zinc-100 text-zinc-950 border-zinc-200';
      case 'In-Person': return 'bg-zinc-100 text-zinc-950 border-zinc-200';
      case 'Support': return 'bg-zinc-100 text-zinc-950 border-zinc-200';
      case 'Website form': return 'bg-zinc-100 text-zinc-950 border-zinc-200';
      case 'Referral': return 'bg-zinc-100 text-zinc-950 border-zinc-200';
      case 'Marketing campaign': return 'bg-zinc-100 text-zinc-950 border-zinc-200';
      default: return 'bg-zinc-50 text-zinc-700 border-zinc-100';
    }
  }

  sourceIconColor(source: string): string {
    switch (source) {
      case 'LinkedIn': return 'text-zinc-700';
      case 'Call': return 'text-zinc-700';
      case 'Email': return 'text-zinc-700';
      case 'Teams': return 'text-zinc-700';
      case 'In-Person': return 'text-zinc-700';
      case 'Support': return 'text-zinc-700';
      case 'Website form': return 'text-zinc-700';
      case 'Referral': return 'text-zinc-700';
      case 'Marketing campaign': return 'text-zinc-700';
      default: return 'text-zinc-500';
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
      case 'Closed Won': return 'bg-zinc-900 text-white';
      case 'Confirmed':
      case 'Invoiced':
      case 'Awaiting Invoicing': return 'bg-[#4A8FA0] text-white';
      case 'Proposal sent': return 'bg-[#2E5AAC] text-white';
      case 'New': return 'bg-[#F5C518] text-zinc-900';
      case 'Closed Lost': return 'bg-zinc-700 text-white';
      default: return 'bg-white text-zinc-900';
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
