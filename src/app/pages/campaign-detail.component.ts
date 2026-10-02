import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { CrmStateService, Campaign, ProposalTemplate } from '../services/crm-state.service';
import { CampaignsService } from '../services/domains';
import { PartnersService, Partner } from '../services/domains/partners.service';
import { WhatsAppCampaignsService, CampaignRecipient } from '../services/domains/whatsapp-campaigns.service';
import { CreatedByBadgeComponent } from '../shared/created-by-badge.component';
import { ConfirmService } from '../shared/ui/confirm.service';

/**
 * One preset combination of partner type + backend stage(s), for the "group" filter. `type`
 * matches `Partner.type` (the frontend's own casing, 'Lead'/'Prospect'/…); `stages`/
 * `excludeStages` match `Partner.stage`, which — unlike most partner fields — passes through
 * from the API response untranslated (see the note on `Partner.stage` in crm-state.service.ts).
 */
interface AudienceGroup {
  key: string;
  label: string;
  description: string;
  type: 'Lead' | 'Prospect' | 'Customer' | 'Vendor';
  /** Stages this group includes; omit to mean "every stage for this type". */
  stages?: string[];
  /** Stages to exclude instead — used for "every stage except these" groups. */
  excludeStages?: string[];
}

const AUDIENCE_GROUPS: AudienceGroup[] = [
  { key: 'valid-leads', label: 'Valid leads', description: 'Leads still in play (not lost or disqualified)',
    type: 'Lead', excludeStages: ['LOST', 'DISQUALIFIED'] },
  { key: 'qualified-leads', label: 'Qualified leads', description: 'Leads marked Qualified', type: 'Lead', stages: ['QUALIFIED'] },
  { key: 'new-leads', label: 'New leads', description: 'Not yet contacted', type: 'Lead', stages: ['NEW'] },
  { key: 'lost-leads', label: 'Lost leads', description: 'Leads marked Lost', type: 'Lead', stages: ['LOST'] },
  { key: 'active-prospects', label: 'Active prospects', description: 'Prospects still in play (not lost or disqualified)',
    type: 'Prospect', excludeStages: ['LOST', 'DISQUALIFIED'] },
  { key: 'proposal-sent-prospects', label: 'Proposal sent', description: 'Prospects with a proposal out',
    type: 'Prospect', stages: ['PROPOSAL_SENT'] },
  { key: 'lost-prospects', label: 'Lost prospects', description: 'Prospects marked Lost', type: 'Prospect', stages: ['LOST'] },
  { key: 'all-customers', label: 'All customers', description: 'Every converted customer', type: 'Customer' },
];

/**
 * One campaign's full detail: its own fields, editable in place, and its recipients — added
 * individually, by partner type, or by a stage-based smart group ("Valid leads", "Lost
 * prospects"…). Works the same for Email, SMS and WhatsApp; only WhatsApp has a live send path
 * today, so Launch and delivery tracking only appear there — Email/SMS still build an audience
 * now, ready for when sending is wired up.
 */
@Component({
  selector: 'app-campaign-detail',
  imports: [CommonModule, FormsModule, MatIconModule, RouterLink, CreatedByBadgeComponent],
  template: `
    <div class="page max-w-5xl mx-auto">
      <a routerLink="/marketing" class="page-back">
        <mat-icon class="icon-sm">arrow_back</mat-icon>
        Back to Marketing
      </a>

      @if (campaign(); as c) {
        <!-- Header -->
        <div class="card p-5 space-y-4">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div class="min-w-0 flex-1 space-y-2">
              <div class="flex flex-wrap items-center gap-2">
                <span [class]="channelColor(c.type)" class="badge">
                  <mat-icon class="icon-sm">{{ channelIcon(c.type) }}</mat-icon>{{ c.type }}
                </span>
                <span class="text-meta text-ink-3 font-mono">#{{ c.id.slice(0, 8) }}</span>
              </div>
              @if (editingTitle()) {
                <input [(ngModel)]="draftTitle" (keydown.enter)="saveTitle()" (keydown.escape)="editingTitle.set(false)"
                       class="input-field w-full text-xl" />
                <div class="flex gap-2">
                  <button (click)="saveTitle()" class="btn-primary btn-sm">Save</button>
                  <button (click)="editingTitle.set(false)" class="btn-secondary btn-sm">Cancel</button>
                </div>
              } @else {
                <h1 class="t-title leading-tight flex items-start gap-2">
                  <span>{{ c.title }}</span>
                  @if (canWrite()) {
                    <button (click)="startEditTitle(c)" title="Rename campaign" class="opacity-0 group-hover:opacity-100 text-ink-3 hover:text-ink-2 transition-opacity mt-1">
                      <mat-icon class="icon-md">edit</mat-icon>
                    </button>
                  }
                </h1>
              }
              <app-created-by-badge [createdBy]="c.createdBy" [createdAt]="c.createdAt" [size]="20" />
            </div>
            @if (canDelete()) {
              <button (click)="deleteCampaign(c)" class="btn-icon btn-sm btn-danger-hover" title="Delete campaign">
                <mat-icon class="icon-sm">delete</mat-icon>
              </button>
            }
          </div>

          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-line-soft">
            <div>
              <label for="cd_status" class="field-label mb-1.5">Status</label>
              <select id="cd_status" [ngModel]="c.status" (ngModelChange)="patch({ status: $event })" [disabled]="!canWrite()" class="input-field w-full">
                <option value="Draft">Draft</option>
                <option value="Scheduled">Scheduled</option>
                <option value="Sending">Sending</option>
                <option value="Active">Active</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
            <div class="col-span-2 md:col-span-2">
              <label for="cd_audience" class="field-label mb-1.5">Target audience label</label>
              <input id="cd_audience" [ngModel]="c.targetAudience || ''" (ngModelChange)="draftAudience = $event" (blur)="saveAudience(c)" [disabled]="!canWrite()"
                     placeholder="e.g. All active customers" class="input-field w-full" />
            </div>
            <div>
              <span class="eyebrow block mb-1">Messages sent</span>
              <div class="p-2 text-sm text-ink-2 font-semibold">{{ c.sentCount || 0 }}</div>
            </div>
          </div>

          @if (isWhatsApp(c) && c.templateName) {
            <div class="grid grid-cols-2 md:grid-cols-3 gap-4 pt-4 border-t border-line-soft text-sm">
              <div>
                <div class="eyebrow mb-1">Template</div>
                <div class="font-mono text-ink">{{ c.templateName }} <span class="text-ink-3">({{ c.templateLang || 'fr' }})</span></div>
              </div>
              @if (c.followupEnabled) {
                <div>
                  <div class="eyebrow mb-1">Relance</div>
                  <div class="text-ink">After {{ c.followupDelayDays || 3 }} day(s)</div>
                </div>
              }
              @if (c.bodyPreview) {
                <div class="col-span-2">
                  <div class="eyebrow mb-1">Preview</div>
                  <div class="text-ink-2 truncate">{{ c.bodyPreview }}</div>
                </div>
              }
            </div>
          }

          @if (!isWhatsApp(c)) {
            <div class="flex items-start gap-2.5 p-3 rounded-xl bg-warning-soft border border-warning-line">
              <mat-icon class="text-warning-ink shrink-0 icon-md">info</mat-icon>
              <p class="text-xs text-warning-ink">{{ c.type }} sending isn't wired up yet — build the audience below so it's ready to go once it is.</p>
            </div>
          } @else if (c.status === 'Draft' && canWrite()) {
            <div class="flex items-center justify-between gap-3 pt-4 border-t border-line-soft">
              <span class="text-xs text-ink-3">{{ pendingCount() }} recipient(s) ready to send</span>
              <button (click)="launch(c)" [disabled]="pendingCount() === 0 || launching()"
                      class="btn-primary">
                <mat-icon class="icon-md">send</mat-icon>{{ launching() ? 'Launching…' : 'Launch campaign' }}
              </button>
            </div>
          }
        </div>

        <!-- Message template -->
        @if (canWrite()) {
          <div class="card p-5 space-y-4">
            <div class="flex items-center justify-between">
              <h2 class="card-title flex items-center gap-2">
                <mat-icon class="text-ink-2 icon-md">description</mat-icon>Message template
              </h2>
              @if (!newTemplateOpen()) {
                <button (click)="openNewTemplate()" class="text-xs font-semibold text-ink-2 hover:text-ink flex items-center gap-1 transition-colors">
                  <mat-icon class="icon-sm">add</mat-icon>New template
                </button>
              }
            </div>

            @if (isWhatsApp(c)) {
              <p class="text-xs text-ink-3 -mt-2">Reference copy for your team — the actual WhatsApp send uses the approved Meta template above (<span class="font-mono">{{ c.templateName || 'none set' }}</span>).</p>
            }

            <div>
              <label for="cd_template" class="field-label mb-1.5">Template</label>
              <select id="cd_template" [ngModel]="c.templateId || ''" (ngModelChange)="onTemplateChange(c, $event)" class="input-field w-full">
                <option value="">-- No template --</option>
                @for (t of templatesForChannel(c); track t.id) { <option [value]="t.id">{{ t.name }}</option> }
              </select>
            </div>

            @if (selectedTemplate(c); as t) {
              <div class="rounded-xl border border-line bg-subtle p-4 space-y-2">
                @if (c.type === 'Email' && t.subject) {
                  <div class="text-sm"><span class="font-semibold text-ink-3">Subject:</span> <span class="text-ink">{{ t.subject }}</span></div>
                }
                <div class="text-sm text-ink-2 whitespace-pre-wrap">{{ t.body }}</div>
              </div>
            } @else if (templatesForChannel(c).length === 0 && !newTemplateOpen()) {
              <p class="text-xs text-ink-3">No {{ c.type }} templates yet — create one above.</p>
            }

            @if (newTemplateOpen()) {
              <div class="rounded-xl border border-line p-4 space-y-3">
                <div>
                  <label for="cd_new_tpl_name" class="field-label mb-1.5">Template name</label>
                  <input id="cd_new_tpl_name" [(ngModel)]="newTemplateName" type="text" placeholder="e.g. Relance rentrée" class="input-field w-full" />
                </div>
                @if (c.type === 'Email') {
                  <div>
                    <label for="cd_new_tpl_subject" class="field-label mb-1.5">Subject</label>
                    <input id="cd_new_tpl_subject" [(ngModel)]="newTemplateSubject" type="text" placeholder="e.g. Votre offre Bento CRM Pro" class="input-field w-full" />
                  </div>
                }
                <div>
                  <label for="cd_new_tpl_body" class="field-label mb-1.5">
                    Message
                    <span class="normal-case font-normal text-ink-3">— {{ '{{name}}' }} and {{ '{{company}}' }} are filled in per contact</span>
                  </label>
                  <textarea id="cd_new_tpl_body" [(ngModel)]="newTemplateBody" rows="4" placeholder="Bonjour {{ '{{name}}' }}, …"
                            class="input-field w-full"></textarea>
                </div>
                <div class="flex justify-end gap-2">
                  <button (click)="newTemplateOpen.set(false)" class="btn-secondary btn-sm">Cancel</button>
                  <button (click)="saveNewTemplate(c)" [disabled]="!newTemplateName.trim() || !newTemplateBody.trim()"
                          class="btn-primary btn-sm">
                    Save & use
                  </button>
                </div>
              </div>
            }
          </div>
        }

        <!-- Stats -->
        @if (isWhatsApp(c) && wa.stats(); as s) {
          <div class="grid grid-cols-3 sm:grid-cols-7 gap-px bg-muted border border-line-soft rounded-2xl overflow-hidden">
            <div class="bg-surface p-3 text-center"><div class="text-lg font-semibold text-ink">{{ s.total }}</div><div class="text-meta font-semibold uppercase tracking-wider text-ink-3">Total</div></div>
            <div class="bg-surface p-3 text-center"><div class="text-lg font-semibold text-ink-3">{{ s.pending }}</div><div class="text-meta font-semibold uppercase tracking-wider text-ink-3">Pending</div></div>
            <div class="bg-surface p-3 text-center"><div class="text-lg font-semibold text-info-ink">{{ s.sent + s.delivered + s.read }}</div><div class="text-meta font-semibold uppercase tracking-wider text-ink-3">Sent</div></div>
            <div class="bg-surface p-3 text-center"><div class="text-lg font-semibold text-success-ink">{{ s.replied }}</div><div class="text-meta font-semibold uppercase tracking-wider text-ink-3">Replied</div></div>
            <div class="bg-surface p-3 text-center"><div class="text-lg font-semibold text-danger-ink">{{ s.failed }}</div><div class="text-meta font-semibold uppercase tracking-wider text-ink-3">Failed</div></div>
            <div class="bg-surface p-3 text-center"><div class="text-lg font-semibold text-warning-ink">{{ s.skipped }}</div><div class="text-meta font-semibold uppercase tracking-wider text-ink-3">Skipped</div></div>
            <div class="bg-surface p-3 text-center"><div class="text-lg font-semibold text-ink">{{ s.replyRate }}%</div><div class="text-meta font-semibold uppercase tracking-wider text-ink-3">Reply rate</div></div>
          </div>
          @if (s.followupsPending > 0) {
            <div class="card flex items-center justify-between px-4 py-2">
              <span class="text-xs text-ink-3">{{ s.followupsPending }} relance(s) due</span>
              <button (click)="cancelFollowups(c)" class="btn-secondary btn-sm">
                Cancel all pending relances
              </button>
            </div>
          }
        } @else {
          <div class="grid grid-cols-3 gap-px bg-muted border border-line-soft rounded-2xl overflow-hidden">
            <div class="bg-surface p-3 text-center"><div class="text-lg font-semibold text-ink">{{ wa.recipients().length }}</div><div class="text-meta font-semibold uppercase tracking-wider text-ink-3">Total</div></div>
            <div class="bg-surface p-3 text-center"><div class="text-lg font-semibold text-ink-3">{{ pendingCount() }}</div><div class="text-meta font-semibold uppercase tracking-wider text-ink-3">Ready</div></div>
            <div class="bg-surface p-3 text-center"><div class="text-lg font-semibold text-warning-ink">{{ skippedCount() }}</div><div class="text-meta font-semibold uppercase tracking-wider text-ink-3">Skipped</div></div>
          </div>
        }

        <!-- Audience builder -->
        @if (canWrite()) {
          <div class="card p-5 space-y-4">
            <h2 class="card-title flex items-center gap-2">
              <mat-icon class="text-ink-2 icon-md">group_add</mat-icon>Add recipients
            </h2>

            <div class="flex flex-wrap items-center gap-2">
              <div class="relative flex-1 min-w-[200px]">
                <mat-icon class="absolute left-3 top-1/2 -translate-y-1/2 text-ink-4 pointer-events-none icon-md">search</mat-icon>
                <input [ngModel]="search()" (ngModelChange)="search.set($event)" type="text" placeholder="Search contacts by name, email or phone..."
                       class="input-field w-full pl-9! pr-3" />
              </div>
              <select [ngModel]="typeFilter()" (ngModelChange)="typeFilter.set($event)" class="input-field cursor-pointer">
                <option [ngValue]="null">All types</option>
                @for (t of partnerTypes; track t.value) { <option [ngValue]="t.value">{{ t.label }}</option> }
              </select>
              <select [ngModel]="groupFilter()" (ngModelChange)="groupFilter.set($event)" class="input-field cursor-pointer max-w-[180px]">
                <option [ngValue]="null">All groups</option>
                @for (g of audienceGroups; track g.key) { <option [ngValue]="g.key">{{ g.label }}</option> }
              </select>
              @if (typeFilter() || groupFilter() || search()) {
                <button (click)="clearFilters()" class="text-xs text-ink-3 hover:text-ink px-2 py-2 transition-colors">Clear</button>
              }
            </div>

            <div class="flex items-center justify-between px-1">
              <label class="flex items-center gap-2 text-xs font-medium text-ink-2 cursor-pointer select-none">
                <input type="checkbox" [checked]="allFilteredSelected()" [disabled]="filteredPartners().length === 0"
                       (change)="toggleSelectAllFiltered()" class="cursor-pointer" />
                Select all {{ filteredPartners().length }} filtered
              </label>
              <span class="text-xs text-ink-3">{{ selectedIds().size }} selected</span>
            </div>

            <div class="border border-line rounded-xl max-h-72 overflow-y-auto divide-y divide-line-soft">
              @for (p of filteredPartners(); track p.id) {
                <button (click)="toggleSelect(p.id)" type="button"
                        class="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-subtle transition-colors"
                        [class.bg-subtle]="selectedIds().has(p.id)">
                  <div class="check-box" [class.is-checked]="selectedIds().has(p.id)">
                    @if (selectedIds().has(p.id)) { <mat-icon class="icon-xs">check</mat-icon> }
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="text-sm font-medium text-ink truncate">{{ p.name }}</div>
                    <div class="text-xs text-ink-3 truncate">{{ contactHint(c, p) }}<span class="text-ink-3"> · </span>{{ p.type }}</div>
                  </div>
                  @if (isEnrolled(p.id)) {
                    <span class="badge badge-neutral shrink-0">Added</span>
                  }
                </button>
              } @empty {
                <div class="px-3 py-6 text-center text-sm text-ink-3">No contacts match these filters.</div>
              }
            </div>
            <button (click)="addSelected(c)" [disabled]="selectedIds().size === 0"
                    class="btn-primary">
              Add {{ selectedIds().size || '' }} selected
            </button>
          </div>
        }

        <!-- Recipients -->
        <div class="card overflow-hidden">
          <div class="p-4 border-b border-line-soft flex items-center justify-between">
            <h2 class="card-title">Recipients <span class="text-ink-3 font-normal">({{ wa.recipients().length }})</span></h2>
            @if (isWhatsApp(c) && (c.status === 'Sending' || c.status === 'Active')) {
              <span class="text-xs text-ink-3">Auto-refreshing every 5s</span>
            }
          </div>
          <div class="overflow-x-auto">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Contact</th>
                  <th>Status</th>
                  @if (canWrite()) { <th></th> }
                </tr>
              </thead>
              <tbody>
                @for (r of wa.recipients(); track r.id) {
                  <tr>
                    <td>
                      <div class="text-sm font-medium text-ink">{{ r.partnerName }}</div>
                      <div class="text-xs text-ink-3 font-mono">{{ r.email || r.phone || '—' }}</div>
                    </td>
                    <td>
                      <span [class]="statusClass(r.status)" class="badge">{{ statusLabel(r.status) }}</span>
                      @if (r.errorTitle) { <div class="text-meta text-danger-ink mt-1 max-w-xs">{{ r.errorTitle }}</div> }
                    </td>
                    @if (canWrite()) {
                      <td class="text-right">
                        <button (click)="removeRecipient(c, r)" title="Remove" class="btn-icon btn-sm btn-danger-hover">
                          <mat-icon class="icon-sm">close</mat-icon>
                        </button>
                      </td>
                    }
                  </tr>
                } @empty {
                  <tr><td [attr.colspan]="canWrite() ? 3 : 2" class="text-center text-ink-3">No recipients yet — add some above.</td></tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      } @else if (loading()) {
        <div class="card p-12 text-center text-sm text-ink-3">Loading campaign…</div>
      } @else {
        <div class="card p-12 text-center space-y-3">
          <mat-icon class="text-ink-4 block mx-auto icon-xl">campaign</mat-icon>
          <p class="text-sm text-ink-3">This campaign doesn't exist or you don't have access to it.</p>
          <a routerLink="/marketing" class="inline-block bg-muted text-ink border border-line px-4 py-2 rounded-xl text-xs font-semibold">Return to Marketing</a>
        </div>
      }
    </div>
  `
})
export class CampaignDetailComponent {
  private confirmDialog = inject(ConfirmService);
  state = inject(CrmStateService);
  campaignsService = inject(CampaignsService);
  partnersService = inject(PartnersService);
  wa = inject(WhatsAppCampaignsService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  readonly audienceGroups = AUDIENCE_GROUPS;
  readonly partnerTypes: { value: 'Lead' | 'Prospect' | 'Customer' | 'Vendor'; label: string }[] = [
    { value: 'Lead', label: 'Leads' }, { value: 'Prospect', label: 'Prospects' },
    { value: 'Customer', label: 'Customers' }, { value: 'Vendor', label: 'Vendors' },
  ];

  campaignId = signal<string>('');
  loading = signal(true);
  editingTitle = signal(false);
  draftTitle = '';
  draftAudience: string | null = null;
  launching = signal(false);

  search = signal('');
  typeFilter = signal<'Lead' | 'Prospect' | 'Customer' | 'Vendor' | null>(null);
  groupFilter = signal<string | null>(null);
  selectedIds = signal<Set<string>>(new Set());

  newTemplateOpen = signal(false);
  newTemplateName = '';
  newTemplateSubject = '';
  newTemplateBody = '';

  private timer: ReturnType<typeof setInterval> | null = null;

  campaign = computed<Campaign | undefined>(() => this.campaignsService.getCampaignById(this.campaignId()));

  enrolledPartnerIds = computed(() => new Set(this.wa.recipients().map(r => r.partnerId)));
  pendingCount = computed(() => this.wa.recipients().filter(r => r.status === 'PENDING').length);
  skippedCount = computed(() => this.wa.recipients().filter(r => r.status === 'SKIPPED').length);

  /**
   * Individual/type/group are one filtered list now, not three separate pickers — search text,
   * partner type and group preset all narrow the same list, and "select all" ticks whatever
   * that combination currently shows.
   */
  filteredPartners = computed(() => {
    const q = this.search().trim().toLowerCase();
    const type = this.typeFilter();
    const group = this.groupFilter() ? AUDIENCE_GROUPS.find(g => g.key === this.groupFilter()) : undefined;

    // Defensive cap, not a real limit at today's org sizes: keeps the list (and a "select all")
    // bounded if this is ever pointed at a much larger partner base.
    return this.partnersService.allPartners().filter(p => {
      if (q && !(p.name.toLowerCase().includes(q) || (p.email || '').toLowerCase().includes(q) || (p.phone || '').includes(q))) {
        return false;
      }
      if (type && p.type !== type) return false;
      if (group) {
        if (p.type !== group.type) return false;
        if (group.stages && !(p.stage && group.stages.includes(p.stage))) return false;
        // A partner with no stage recorded isn't known to be lost/disqualified, so it still
        // counts for an "excludeStages" group — only a stage that's actually on the list drops it.
        if (group.excludeStages && p.stage && group.excludeStages.includes(p.stage)) return false;
      }
      return true;
    }).slice(0, 200);
  });

  allFilteredSelected = computed(() => {
    const filtered = this.filteredPartners();
    return filtered.length > 0 && filtered.every(p => this.selectedIds().has(p.id));
  });

  canWrite(): boolean { return this.state.hasAuthority('CAMPAIGNS_WRITE'); }
  canDelete(): boolean { return this.state.hasAuthority('CAMPAIGNS_DELETE'); }

  constructor() {
    this.campaignsService.load();
    this.partnersService.load();
    this.state.loadProposalTemplates();

    const sub = this.route.paramMap.subscribe(params => {
      const id = params.get('id') || '';
      this.campaignId.set(id);
      this.editingTitle.set(false);
      this.clearFilters();
      this.selectedIds.set(new Set());
      this.loading.set(true);
      this.campaignsService.fetchCampaign(id).subscribe({
        next: () => this.loading.set(false),
        error: () => this.loading.set(false)
      });
      this.refresh(id);
    });
    this.destroyRef.onDestroy(() => {
      sub.unsubscribe();
      this.stopPolling();
      this.state.breadcrumbLabel.set(null);
    });

    effect(() => {
      const c = this.campaign();
      this.state.breadcrumbLabel.set(c ? c.title : null);
      this.stopPolling();
      if (c && this.isWhatsApp(c) && (c.status === 'Sending' || c.status === 'Active')) {
        const id = this.campaignId();
        this.timer = setInterval(() => this.refresh(id), 5000);
      }
    });
  }

  private refresh(id: string): void {
    if (!id) return;
    this.wa.loadRecipients(id);
    this.wa.loadStats(id);
  }

  private stopPolling(): void {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }

  // ---- Campaign edits ----

  patch(changes: Partial<Campaign>): void {
    if (!this.canWrite()) return;
    this.campaignsService.patchCampaign(this.campaignId(), changes);
  }

  startEditTitle(c: Campaign): void {
    this.draftTitle = c.title;
    this.editingTitle.set(true);
  }

  saveTitle(): void {
    const title = this.draftTitle.trim();
    if (title && title !== this.campaign()?.title) this.patch({ title });
    this.editingTitle.set(false);
  }

  saveAudience(c: Campaign): void {
    if (this.draftAudience !== null && this.draftAudience !== (c.targetAudience || '')) {
      this.patch({ targetAudience: this.draftAudience });
    }
    this.draftAudience = null;
  }

  async deleteCampaign(c: Campaign): Promise<void> {
    if (!this.canDelete()) return;
    if (await this.confirmDialog.ask({ title: 'Delete campaign?', message: `"${c.title}" and its delivery history will be permanently deleted.`, confirmLabel: 'Delete campaign', danger: true })) {
      this.campaignsService.deleteCampaign(c.id);
      this.router.navigate(['/marketing']);
    }
  }

  launch(c: Campaign): void {
    if (!this.canWrite() || this.launching()) return;
    this.launching.set(true);
    this.wa.launch(c.id, () => {
      this.launching.set(false);
      this.campaignsService.fetchCampaign(c.id).subscribe();
      this.refresh(c.id);
    });
  }

  cancelFollowups(c: Campaign): void {
    this.wa.cancelFollowups(c.id, () => this.refresh(c.id));
  }

  // ---- Audience builder ----

  toggleSelect(id: string): void {
    const next = new Set(this.selectedIds());
    if (next.has(id)) next.delete(id); else next.add(id);
    this.selectedIds.set(next);
  }

  isEnrolled(partnerId: string): boolean {
    return this.enrolledPartnerIds().has(partnerId);
  }

  toggleSelectAllFiltered(): void {
    const filtered = this.filteredPartners();
    const next = new Set(this.selectedIds());
    if (this.allFilteredSelected()) {
      filtered.forEach(p => next.delete(p.id));
    } else {
      filtered.forEach(p => next.add(p.id));
    }
    this.selectedIds.set(next);
  }

  clearFilters(): void {
    this.search.set('');
    this.typeFilter.set(null);
    this.groupFilter.set(null);
  }

  addSelected(c: Campaign): void {
    const ids = Array.from(this.selectedIds());
    if (ids.length === 0) return;
    this.wa.addRecipients(c.id, ids, () => this.selectedIds.set(new Set()));
  }

  removeRecipient(c: Campaign, r: CampaignRecipient): void {
    if (!this.canWrite()) return;
    this.wa.removeRecipient(c.id, r.id);
  }

  // ---- Message template ----

  /** The backend `ProposalTemplate.channel` value that matches this campaign's own channel. */
  private templateChannelOf(c: Campaign): 'EMAIL' | 'WHATSAPP' | 'SMS' {
    return c.type === 'WhatsApp' ? 'WHATSAPP' : c.type === 'SMS' ? 'SMS' : 'EMAIL';
  }

  templatesForChannel(c: Campaign): ProposalTemplate[] {
    const channel = this.templateChannelOf(c);
    return this.state.proposalTemplates().filter(t => t.channel === channel);
  }

  selectedTemplate(c: Campaign): ProposalTemplate | undefined {
    return c.templateId ? this.templatesForChannel(c).find(t => t.id === c.templateId) : undefined;
  }

  onTemplateChange(c: Campaign, templateId: string): void {
    this.patch({ templateId: templateId || undefined });
  }

  openNewTemplate(): void {
    this.newTemplateName = '';
    this.newTemplateSubject = '';
    this.newTemplateBody = '';
    this.newTemplateOpen.set(true);
  }

  saveNewTemplate(c: Campaign): void {
    const name = this.newTemplateName.trim();
    const body = this.newTemplateBody.trim();
    if (!name || !body) return;
    // Selecting the template on this campaign needs its real, server-assigned id — the campaign
    // PATCH's templateId deserializes as UUID on the backend, so the synchronous return value's
    // local temp id (used only for showing the row immediately) would 400 if used here instead.
    this.state.addProposalTemplate({
      name,
      subject: this.newTemplateSubject.trim(),
      body,
      lines: [],
      channel: this.templateChannelOf(c)
    }, (created) => this.onTemplateChange(c, created.id));
    this.newTemplateOpen.set(false);
  }

  // ---- Display helpers ----

  isWhatsApp(c: Campaign): boolean { return c.type === 'WhatsApp'; }

  contactHint(c: Campaign, p: Partner): string {
    if (c.type === 'Email') return p.email || 'No email';
    return p.phone || 'No phone';
  }

  channelIcon(type: string): string {
    switch (type) {
      case 'WhatsApp': return 'chat';
      case 'SMS': return 'sms';
      default: return 'mail';
    }
  }

  channelColor(type: string): string {
    switch (type) {
      case 'WhatsApp': return 'badge-success';
      case 'SMS': return 'badge-violet';
      default: return 'badge-info';
    }
  }

  statusLabel(status: string): string {
    return status === 'OPTED_OUT' ? 'Opted out' : status.charAt(0) + status.slice(1).toLowerCase();
  }

  statusClass(status: string): string {
    switch (status) {
      case 'REPLIED': return 'badge-success';
      case 'READ': return 'badge-info';
      case 'DELIVERED': return 'badge-info';
      case 'SENT': return 'bg-muted text-ink-2';
      case 'FAILED': return 'badge-danger';
      case 'OPTED_OUT': return 'badge-warning';
      case 'SKIPPED': return 'badge-warning';
      default: return 'bg-muted text-ink-2';
    }
  }
}
