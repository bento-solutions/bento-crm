import { Component, OnDestroy, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { CrmStateService, Lead, LeadActivity, LeadAttachment } from '../services/crm-state.service';
import { CreatedByBadgeComponent } from '../shared/created-by-badge.component';
import { UserAvatarComponent } from '../shared/user-avatar.component';
import { ApiService } from '../services/api.service';
import { WhatsAppInboxStore } from '../services/domains/whatsapp-inbox.service';
import { WaThreadComponent } from '../shared/whatsapp/wa-thread.component';
import { WaComposerComponent } from '../shared/whatsapp/wa-composer.component';
import { TranslatePipe } from '../pipes/translate.pipe';

@Component({
  selector: 'app-lead-detail',
  imports: [CommonModule, FormsModule, MatIconModule, RouterLink, CreatedByBadgeComponent, UserAvatarComponent,
    WaThreadComponent, WaComposerComponent, TranslatePipe],
  template: `
    <div class="page max-w-5xl mx-auto">
      <a routerLink="/partners" class="page-back">
        <mat-icon class="icon-sm">arrow_back</mat-icon>
        Back to Partners
      </a>

      @if (lead(); as lead) {
        <!-- Header -->
        <div class="card p-5">
          <div class="flex items-start justify-between">
            <div class="flex items-center gap-4">
              <div class="h-14 w-14 bg-muted text-ink font-semibold rounded-xl flex items-center justify-center text-lg">
                {{ getInitials(lead.name) }}
              </div>
              <div>
                <h1 class="t-title">{{ lead.name }}</h1>
                <p class="text-sm text-ink-3 mt-0.5"><span class="font-mono">#{{ lead.id.slice(0, 8) }}</span> &bull; {{ lead.companyName }}</p>
                <div class="flex items-center gap-2 mt-2">
                  <span [class]="getStatusClass(lead.status)" class="badge">{{ lead.status }}</span>
                  <span [class]="getPriorityBadge(lead.priority)" class="badge">{{ lead.priority }}</span>
                  <span [class]="getTempBadge(lead.temperature)" class="badge">{{ lead.temperature }}</span>
                </div>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <div class="flex items-center gap-2">
                <span class="field-label">Status</span>
                <select [ngModel]="lead.status" (ngModelChange)="onStatusChange(lead.id, $event)" class="input-field input-sm w-auto cursor-pointer">
                  <option value="New">New</option>
                  <option value="Contacted">Contacted</option>
                  <option value="Attempted Contact">Attempted Contact</option>
                  <option value="Meeting Scheduled">Meeting Scheduled</option>
                  <option value="Qualified">Qualified</option>
                  <option value="Proposal Requested">Proposal Requested</option>
                  <option value="Converted">Converted</option>
                  <option value="Lost">Lost</option>
                  <option value="Disqualified">Disqualified</option>
                </select>
              </div>
              @if (lead.status !== 'Converted') {
                <div class="relative">
                  <button (click)="toggleConvertMenu($event)" class="btn-primary btn-sm">
                    <mat-icon class="icon-xs">arrow_forward</mat-icon>
                    Convert
                  </button>
                  @if (showConvertMenu()) {
                    <div class="menu absolute right-0 top-9 z-10 w-44">
                      <button (click)="$event.stopPropagation(); convertToProspect(lead)" class="menu-item">
                        <mat-icon class="text-ink-4 icon-sm">swap_horiz</mat-icon>
                        Convert to Prospect
                      </button>
                      <button (click)="$event.stopPropagation(); markLeadAsLost(lead)" class="menu-item">
                        <mat-icon class="text-ink-4 icon-sm">cancel</mat-icon>
                        Mark as Lost
                      </button>
                      <button (click)="$event.stopPropagation(); deleteLead(lead)" class="menu-item">
                        <mat-icon class="text-danger icon-sm">delete_outline</mat-icon>
                        Delete Lead
                      </button>
                    </div>
                  }
                </div>
              }
            </div>
          </div>
        </div>

        <!-- KPI Cards -->
        <div class="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div class="card p-4">
            <span class="eyebrow">Lead Score</span>
            <div class="flex items-center gap-2 mt-1">
              <div class="flex-1 bg-surface rounded-full h-2 overflow-hidden">
                <div [style.width.%]="lead.score" [class]="getScoreColor(lead.score)" class="h-full rounded-full"></div>
              </div>
              <span class="text-lg font-semibold" [class]="lead.score >= 80 ? 'text-success-ink' : lead.score >= 50 ? 'text-warning-ink' : 'text-ink-2'">{{ lead.score }}</span>
            </div>
          </div>
          <div class="card p-4">
            <span class="eyebrow">Origin</span>
            <div class="text-lg font-semibold text-ink mt-1">{{ lead.origin || lead.campaigns?.[0]?.source || '—' }}</div>
          </div>
          <div class="card p-4">
            <span class="eyebrow">Probability</span>
            <div class="text-lg font-semibold text-ink mt-1">{{ lead.probability || '0' }}%</div>
          </div>
          <div class="card p-4">
            <span class="eyebrow">Expected Close</span>
            <div class="text-lg font-semibold text-ink mt-1">{{ lead.expectedCloseDate || '—' }}</div>
          </div>
        </div>

        <!-- Tabs -->
        <div class="card overflow-hidden">
          <div class="px-6 border-b border-line-soft flex gap-6">
            <button (click)="activeTab.set('info')" [class.is-active]="activeTab() === 'info'" class="tab">Info</button>
            <button (click)="activeTab.set('activities')" [class.is-active]="activeTab() === 'activities'" class="tab">Activities & Notes</button>
            <button (click)="activeTab.set('attachments')" [class.is-active]="activeTab() === 'attachments'" class="tab">Attachments</button>
            <button (click)="activeTab.set('history')" [class.is-active]="activeTab() === 'history'" class="tab">Status History</button>
            @if (canReadWhatsApp()) {
              <button (click)="openWhatsAppTab(lead.id)" [class.is-active]="activeTab() === 'whatsapp'" class="tab">{{ 'inbox.leadTab.title' | translate }}</button>
            }
          </div>

          <div class="p-6">
            @if (activeTab() === 'info') {
              <div class="space-y-6">
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <!-- Basic Information -->
                  <div class="card p-5 space-y-3">
                    <h3 class="eyebrow">Basic Information</h3>
                    <div class="grid grid-cols-2 gap-4 text-sm">
                      <div><div class="eyebrow">Lead Name</div><div class="font-semibold text-ink mt-0.5">{{ lead.name }}</div></div>
                      <div><div class="eyebrow">Company</div><div class="font-semibold text-ink mt-0.5">{{ lead.companyName }}</div></div>
                      <div><div class="eyebrow">Assigned Salesperson</div><div class="font-semibold text-ink mt-0.5">{{ lead.assignedSalesperson || 'Unassigned' }}</div></div>
                      <div><div class="eyebrow">Sales Team</div><div class="font-semibold text-ink mt-0.5">{{ lead.salesTeam || '—' }}</div></div>
                      <div><div class="eyebrow">Email</div><a href="mailto:{{ lead.contacts?.[0]?.email }}" class="font-semibold text-ink hover:underline mt-0.5 block truncate">{{ lead.contacts?.[0]?.email || '—' }}</a></div>
                      <div><div class="eyebrow">Phone</div><div class="font-semibold text-ink mt-0.5">{{ lead.contacts?.[0]?.phone || '—' }}</div></div>
                      @if (lead.contacts?.[0]?.website; as web) {
                        <div><div class="eyebrow">Website</div><a href="http://{{web}}" target="_blank" class="font-semibold text-ink hover:underline mt-0.5 block truncate">{{ web }}</a></div>
                      }
                      @if (lead.contacts?.[0]?.linkedin; as li) {
                        <div><div class="eyebrow">LinkedIn</div><a href="http://{{li}}" target="_blank" class="font-semibold text-ink hover:underline mt-0.5 block truncate">{{ li }}</a></div>
                      }
                    </div>
                  </div>

                  <!-- Attribution -->
                  <div class="card p-5 space-y-3">
                    <h3 class="eyebrow">Attribution</h3>
                    <div class="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div class="eyebrow">Brand</div>
                        <div class="font-semibold text-ink mt-0.5 flex items-center gap-1.5">
                          @if (lead.brandColor) { <span class="w-2 h-2 rounded-full shrink-0" [style.background-color]="lead.brandColor"></span> }
                          {{ lead.brandName || '—' }}
                        </div>
                      </div>
                      <div><div class="eyebrow">Business Type</div><div class="font-semibold text-ink mt-0.5">{{ lead.businessTypeName || '—' }}</div></div>
                    </div>
                  </div>

                  <!-- Company Information -->
                  <div class="card p-5 space-y-3">
                    <h3 class="eyebrow">Company Information</h3>
                    <div class="grid grid-cols-2 gap-4 text-sm">
                      <div><div class="eyebrow">Industry</div><div class="font-semibold text-ink mt-0.5">{{ lead.company?.industry || '—' }}</div></div>
                      <div><div class="eyebrow">Company Size</div><div class="font-semibold text-ink mt-0.5">{{ lead.company?.size || '—' }}</div></div>
                      <div><div class="eyebrow">Annual Revenue</div><div class="font-semibold text-ink mt-0.5">{{ lead.company?.annualRevenue || '—' }}</div></div>
                      <div><div class="eyebrow">Offices Count</div><div class="font-semibold text-ink mt-0.5">{{ lead.company?.officesCount || '—' }}</div></div>
                      <div class="col-span-2"><div class="eyebrow">Address</div><div class="font-semibold text-ink mt-0.5">{{ lead.company?.address || '—' }}, {{ lead.company?.city || '—' }}, {{ lead.company?.country || '—' }}</div></div>
                    </div>
                  </div>

                  <!-- Origin & Campaign -->
                  <div class="card p-5 space-y-3">
                    <h3 class="eyebrow">Origin & Marketing Campaign</h3>
                    <div class="grid grid-cols-2 gap-4 text-sm">
                      <div><div class="eyebrow">Origin</div><div class="font-semibold text-ink mt-0.5">{{ lead.origin || lead.campaigns?.[0]?.source || '—' }}</div></div>
                      <div><div class="eyebrow">Campaign</div><div class="font-semibold text-ink mt-0.5">{{ lead.campaigns?.[0]?.campaign || '—' }}</div></div>
                      @if (lead.campaigns?.[0]?.referralPartner) { <div><div class="eyebrow">Referral Partner</div><div class="font-semibold text-ink mt-0.5">{{ lead.campaigns?.[0]?.referralPartner }}</div></div> }
                      @if (lead.campaigns?.[0]?.tradeShow) { <div><div class="eyebrow">Trade Show</div><div class="font-semibold text-ink mt-0.5">{{ lead.campaigns?.[0]?.tradeShow }}</div></div> }
                    </div>
                  </div>

                  <!-- Key Stakeholders -->
                  <div class="card p-5 space-y-3">
                    <h3 class="eyebrow">Key Stakeholders</h3>
                    <div class="grid grid-cols-2 gap-4 text-sm">
                      <div><div class="eyebrow">Decision Maker</div><div class="font-semibold text-ink mt-0.5">{{ lead.decisionMaker || '—' }}</div></div>
                      <div><div class="eyebrow">Influencer</div><div class="font-semibold text-ink mt-0.5">{{ lead.influencer || '—' }}</div></div>
                      <div><div class="eyebrow">Finance Contact</div><div class="font-semibold text-ink mt-0.5">{{ lead.financeContact || '—' }}</div></div>
                      <div><div class="eyebrow">Technical Contact</div><div class="font-semibold text-ink mt-0.5">{{ lead.technicalContact || '—' }}</div></div>
                    </div>
                  </div>
                </div>

                <!-- Audit Trail -->
                <div class="card p-5">
                  <h3 class="eyebrow">Audit Trail</h3>
                  <div class="grid grid-cols-2 gap-4 text-xs text-ink-3 mt-3">
                    <div><div>Created By</div><div class="mt-1"><app-created-by-badge [createdBy]="lead.createdBy" [createdAt]="lead.createdDate" /></div></div>
                    <div><div>Modified</div><div class="font-semibold text-ink-2 mt-1">{{ lead.modifiedDate }} by <app-user-avatar [userId]="lead.modifiedBy" [size]="20" /> {{ getUserName(lead.modifiedBy) }}</div></div>
                  </div>
                </div>
              </div>
            }

            @if (activeTab() === 'activities') {
              <div class="space-y-6">
                <div class="card p-5 text-sm">
                  <h3 class="eyebrow">Lead Qualification & Sales Potential</h3>
                  <div class="grid grid-cols-2 gap-4 mt-3">
                    <div><div class="eyebrow">Interested Product</div><div class="font-semibold text-ink mt-0.5">{{ lead.productInterests?.[0]?.product || '—' }}</div></div>
                    <div><div class="eyebrow">Solution</div><div class="font-semibold text-ink-2 mt-0.5">{{ lead.productInterests?.[0]?.solution || '—' }}</div></div>
                    <div><div class="eyebrow">Origin</div><div class="font-semibold text-ink mt-0.5">{{ lead.origin || lead.campaigns?.[0]?.source || '—' }}</div></div>
                    <div><div class="eyebrow">Deal Probability</div><div class="font-semibold text-ink-2 mt-0.5">{{ lead.probability || '0' }}%</div></div>
                  </div>
                </div>

                <div class="card p-5">
                  <h3 class="eyebrow">Notes & Comments</h3>
                  <div class="mt-2 text-sm text-ink-2 leading-relaxed whitespace-pre-line">{{ lead.notes || 'No notes added for this lead yet.' }}</div>
                </div>

                <div class="card p-5 space-y-3">
                  <h3 class="eyebrow">Log New Activity</h3>
                  <div class="grid grid-cols-2 gap-3">
                    <div><label for="type" class="field-label mb-1.5">Type</label>
                      <select id="type" [(ngModel)]="newActivity.type" class="input-field w-full">
                        <option value="Call">Call</option><option value="Email">Email</option><option value="Meeting">Meeting</option><option value="Note">Note</option><option value="Task">Task</option>
                      </select></div>
                    <div><label for="date" class="field-label mb-1.5">Date</label>
                      <input id="date" [(ngModel)]="newActivity.date" type="date" class="input-field w-full"></div>
                  </div>
                  <div><label for="summary" class="field-label mb-1.5">Summary</label>
                    <input id="summary" [(ngModel)]="newActivity.summary" type="text" placeholder="e.g. Discussed pricing options" class="input-field w-full"></div>
                  <div><label for="details" class="field-label mb-1.5">Details</label>
                    <textarea id="details" [(ngModel)]="newActivity.detail" rows="2" placeholder="More detailed recap..." class="input-field w-full"></textarea></div>
                  <div class="flex justify-end pt-2">
                    <button (click)="submitActivity(lead.id)" class="btn-primary btn-sm">Log Activity</button>
                  </div>
                </div>

                <div class="space-y-4">
                  <h3 class="eyebrow">Interactions Timeline</h3>
                  <div class="space-y-4">
                    @for (act of lead.activities; track act.id) {
                      <div class="flex gap-4 items-start border-l-2 border-line-soft pl-4 relative">
                        <div class="absolute -left-1.5 top-1 h-3.5 w-3.5 rounded-full border-2 border-line-soft flex items-center justify-center" [class]="getActivityIconClass(act.type)"></div>
                        <div class="flex-1 space-y-1">
                          <div class="flex justify-between items-center">
                            <span class="text-xs font-semibold text-ink">{{ act.summary }}</span>
                            <span class="text-meta text-ink-3 font-medium">{{ act.date }}</span>
                          </div>
                          @if (act.detail) { <p class="text-xs text-ink-3 leading-relaxed">{{ act.detail }}</p> }
                          <div class="text-meta font-semibold text-ink-3 flex items-center gap-1">
                            <span class="badge">{{ act.type }}</span>
                            @if (act.assignedTo) { <span>Assigned: {{ act.assignedTo }}</span> }
                          </div>
                        </div>
                      </div>
                    } @empty { <p class="text-xs text-ink-3 text-center py-4">No logged interactions yet.</p> }
                  </div>
                </div>
              </div>
            }

            @if (activeTab() === 'attachments') {
              <div class="space-y-6">
                <div class="card p-5 space-y-3">
                  <h3 class="eyebrow">Upload Document</h3>
                  <div class="flex gap-3 items-center">
                    <input #fileInput type="file" (change)="onFileSelected($event, lead.id)" class="flex-1 text-xs">
                    @if (uploading()) { <span class="text-meta text-ink-3">Uploading&hellip;</span> }
                  </div>
                </div>
                <div class="space-y-3">
                  <h3 class="eyebrow">Uploaded Files</h3>
                  <div class="card divide-y divide-line-soft overflow-hidden">
                    @for (file of lead.attachments; track file.id) {
                      <div class="px-4 py-3 flex justify-between items-center text-xs">
                        <div class="flex items-center gap-2.5">
                          <mat-icon class="text-ink-4 icon-md">insert_drive_file</mat-icon>
                          <div>
                            <div class="font-semibold text-ink">
                              @if (file.fileId) {
                                <a href="" (click)="downloadAttachment($event, file)" class="hover:underline">{{ file.fileName }}</a>
                              } @else { {{ file.fileName }} }
                            </div>
                            <div class="text-meta text-ink-3">Uploaded: {{ file.uploadedAt }} &bull; {{ file.fileSize || 'N/A' }}</div>
                          </div>
                        </div>
                        <button title="Delete attachment" (click)="deleteAttachment(lead.id, file)" class="btn-icon btn-sm"><mat-icon class="icon-sm">delete_outline</mat-icon></button>
                      </div>
                    } @empty { <p class="text-xs text-ink-3 text-center py-6">No attachments uploaded yet.</p> }
                  </div>
                </div>
              </div>
            }

            @if (activeTab() === 'whatsapp') {
              <div class="rounded-xl overflow-hidden flex flex-col h-[560px]" style="border: 1px solid var(--color-border)">
                @if (inbox.selected(); as c) {
                  <div class="flex items-center justify-between px-4 py-2 text-xs" style="border-bottom: 1px solid var(--color-border); color: var(--color-text-secondary)">
                    <span dir="ltr">{{ c.phone }}</span>
                    <a [routerLink]="['/inbox']" [queryParams]="{ c: c.id }" class="font-semibold" style="color: var(--color-accent-text)">{{ 'inbox.leadTab.openInInbox' | translate }}</a>
                  </div>
                  <app-wa-thread
                    class="flex-1 min-h-0"
                    [messages]="inbox.messages()"
                    [loading]="inbox.loadingMessages()"
                    [hasOlder]="!!inbox.olderCursor()"
                    [canApprove]="canSendWhatsApp()"
                    (loadOlder)="inbox.loadOlder()"
                    (approve)="inbox.approve($event.id, $event.text)"
                    (discard)="inbox.discard($event)"
                  />
                  <app-wa-composer [canSend]="canSendWhatsApp()" [sending]="inbox.sending()" (send)="inbox.send($event)" />
                } @else if (waLoading()) {
                  <p class="flex-1 flex items-center justify-center text-sm" style="color: var(--color-text-tertiary)">{{ 'inbox.loading' | translate }}</p>
                } @else if (lead.phone) {
                  <div class="flex-1 flex items-center justify-center text-sm p-6 text-center" style="color: var(--color-text-secondary)">
                    {{ 'inbox.leadTab.empty' | translate }}
                  </div>
                  <app-wa-composer [canSend]="canSendWhatsApp()" [sending]="inbox.sending()" (send)="inbox.startWithPartner(lead.id, $event)" />
                } @else {
                  <p class="flex-1 flex items-center justify-center text-sm p-6 text-center" style="color: var(--color-text-secondary)">{{ 'inbox.leadTab.noPhone' | translate }}</p>
                }
              </div>
            }

            @if (activeTab() === 'history') {
              <div class="space-y-4">
                <h3 class="eyebrow">Status Transition Log</h3>
                <div class="space-y-4">
                  @for (hist of lead.statusHistory; track $index) {
                    <div class="flex gap-4 items-start pl-4 border-l-2 border-line-soft relative">
                      <div class="absolute -left-1.5 top-1 h-3.5 w-3.5 rounded-full border-2 border-line-soft bg-muted"></div>
                      <div class="flex-1 text-xs">
                        <div class="flex justify-between font-semibold text-ink">
                          <span>Status updated to: {{ hist.status }}</span>
                          <span class="text-meta text-ink-3 font-medium">{{ hist.timestamp }}</span>
                        </div>
                        <div class="text-meta text-ink-3 font-medium mt-0.5">Changed by: {{ hist.user }}</div>
                      </div>
                    </div>
                  } @empty { <p class="text-xs text-ink-3 text-center py-4">No status changes logged.</p> }
                </div>
              </div>
            }
          </div>
        </div>
      } @else {
        <div class="text-center py-20 text-ink-3">
          <mat-icon class="mb-3 text-ink-4 icon-xl">filter_alt</mat-icon>
          <p class="font-semibold text-ink-3">Lead not found</p>
        </div>
      }
    </div>
  `
})
export class LeadDetailComponent implements OnDestroy {
  state = inject(CrmStateService);
  route = inject(ActivatedRoute);
  router = inject(Router);
  api = inject(ApiService);
  uploading = signal(false);

  activeTab = signal<'info' | 'activities' | 'attachments' | 'history' | 'whatsapp'>('info');
  inbox = inject(WhatsAppInboxStore);
  waLoading = signal(false);
  canReadWhatsApp = computed(() => this.state.hasAuthority('WHATSAPP_READ'));
  canSendWhatsApp = computed(() => this.state.hasAuthority('WHATSAPP_SEND'));
  showConvertMenu = signal(false);

  newActivity = {
    type: 'Call' as LeadActivity['type'],
    date: new Date().toISOString().split('T')[0],
    summary: '',
    detail: ''
  };

  lead = computed(() => {
    const id = this.route.snapshot.paramMap.get('id');
    return this.state.leadsData().find(l => l.id === id) || null;
  });

  onStatusChange(leadId: string, status: Lead['status']) {
    this.state.updateLeadStatus(leadId, status);
  }

  constructor() {
    // Deep-link entry point (no selectLead ran): hydrate server sub-resources once.
    effect(() => {
      const id = this.route.snapshot.paramMap.get('id');
      if (id) this.state.loadLeadDetails(id);
    });
    if (typeof window !== 'undefined') {
      window.addEventListener('click', () => {
        this.showConvertMenu.set(false);
      });
    }
  }

  async openWhatsAppTab(leadId: string) {
    this.activeTab.set('whatsapp');
    this.waLoading.set(true);
    await this.inbox.openForPartner(leadId);
    this.waLoading.set(false);
  }

  ngOnDestroy() {
    this.inbox.select(null);
  }

  toggleConvertMenu(event: Event) {
    event.stopPropagation();
    this.showConvertMenu.update(v => !v);
  }

  markLeadAsLost(lead: Lead) {
    this.showConvertMenu.set(false);
    this.state.updateLeadStatus(lead.id, 'Lost');
  }

  deleteLead(lead: Lead) {
    this.showConvertMenu.set(false);
    this.state.deleteLead(lead.id);
    this.router.navigate(['/partners']);
  }

  convertToProspect(lead: Lead) {
    this.showConvertMenu.set(false);
    this.state.convertLeadDataToProspect(lead);
    this.router.navigate(['/partners']);
  }

  submitActivity(leadId: string) {
    if (!this.newActivity.summary.trim()) return;
    this.state.addLeadActivity(leadId, {
      type: this.newActivity.type,
      date: this.newActivity.date,
      summary: this.newActivity.summary,
      detail: this.newActivity.detail,
      assignedTo: 'Achraf (Manager)'
    });
    this.newActivity = {
      type: 'Call',
      date: new Date().toISOString().split('T')[0],
      summary: '',
      detail: ''
    };
  }

  onFileSelected(event: Event, leadId: string) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!this.state.isPersistedPartnerId(leadId)) {
      // Lead not yet persisted (local-only id): keep the attachment local-only.
      this.state.addLeadAttachment(leadId, {
        fileName: file.name,
        fileSize: this.formatFileSize(file.size),
        uploadedAt: new Date().toISOString().split('T')[0]
      });
      input.value = '';
      return;
    }
    this.uploading.set(true);
    this.api.uploadFile(file, 'PARTNER', leadId).subscribe({
      next: (dto) => {
        this.uploading.set(false);
        this.state.addLeadAttachment(leadId, {
          fileName: dto.fileName,
          fileSize: this.formatFileSize(dto.sizeBytes),
          uploadedAt: new Date().toISOString().split('T')[0],
          fileId: dto.id
        });
        input.value = '';
      },
      error: () => {
        this.uploading.set(false);
        input.value = '';
      }
    });
  }

  formatFileSize(bytes?: number): string {
    if (!bytes) return 'N/A';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  downloadAttachment(event: Event, file: LeadAttachment): void {
    event.preventDefault();
    if (!file.fileId) return;
    this.api.downloadStoredFile(file.fileId).subscribe({
      next: (blob) => this.api.downloadBlob(blob, file.fileName),
      error: () => { /* handle error */ }
    });
  }

  deleteAttachment(leadId: string, file: LeadAttachment) {
    this.state.removeLeadAttachment(leadId, file.id);
    if (file.fileId) {
      this.api.deleteFile(file.fileId).subscribe({ error: () => { /* ignore error */ } });
    }
  }

  getInitials(name: string): string {
    if (!name) return 'LD';
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  }

  getUserName(userId: string): string {
    return this.state.users().find(u => u.id === userId)?.displayName || userId;
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'New': return 'bg-muted text-ink-2';
      case 'Contacted': return 'badge-info';
      case 'Attempted Contact': return 'badge-info';
      case 'Meeting Scheduled': return 'badge-violet';
      case 'Qualified': return 'badge-violet';
      case 'Proposal Requested': return 'badge-violet';
      case 'Converted': return 'badge-success';
      case 'Lost': return 'badge-danger';
      case 'Disqualified': return 'badge-danger';
      default: return 'bg-muted text-ink';
    }
  }

  getPriorityBadge(priority: string): string {
    switch(priority) {
      case 'High': return 'badge-danger';
      case 'Medium': return 'badge-warning';
      case 'Low': return 'bg-subtle text-ink-2 border border-line-soft';
      default: return 'bg-subtle text-ink-2';
    }
  }

  getTempBadge(temp: string): string {
    switch(temp) {
      case 'Hot': return 'badge-danger';
      case 'Warm': return 'badge-warning';
      case 'Cold': return 'badge-info';
      default: return 'bg-subtle text-ink-2';
    }
  }

  getScoreColor(score: number): string {
    if (score >= 80) return 'bg-success';
    if (score >= 50) return 'bg-warning';
    return 'bg-ink-4';
  }

  getActivityIconClass(type: string): string {
    switch(type) {
      case 'Call': return 'bg-ink-2 border-line-strong';
      case 'Email': return 'bg-ink-2 border-line-strong';
      case 'Meeting': return 'bg-ink-2 border-line-strong';
      case 'Task': return 'bg-ink-2 border-line-strong';
      default: return 'bg-ink-3 border-line';
    }
  }
}
