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
    <div class="space-y-6 font-sans max-w-5xl mx-auto">
      <a routerLink="/marketing" class="inline-flex items-center gap-1 text-xs font-semibold text-zinc-500 hover:text-zinc-800 transition-colors">
        <mat-icon class="text-sm w-4 h-4 flex items-center justify-center">arrow_back</mat-icon>
        Back to Marketing
      </a>

      @if (campaign(); as c) {
        <!-- Header -->
        <div class="card rounded-2xl p-6 space-y-4">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div class="min-w-0 flex-1 space-y-2">
              <div class="flex flex-wrap items-center gap-2">
                <span [class]="channelColor(c.type)" class="inline-flex items-center gap-1 px-2.5 py-1 text-body font-semibold rounded-full border">
                  <mat-icon class="text-[16px] w-4 h-4">{{ channelIcon(c.type) }}</mat-icon>{{ c.type }}
                </span>
                <span class="text-meta text-zinc-400 font-mono">#{{ c.id.slice(0, 8) }}</span>
              </div>
              @if (editingTitle()) {
                <input [(ngModel)]="draftTitle" (keydown.enter)="saveTitle()" (keydown.escape)="editingTitle.set(false)"
                       class="w-full input-field rounded-lg p-2 text-xl font-bold text-zinc-950 focus:outline-blue-600" />
                <div class="flex gap-2">
                  <button (click)="saveTitle()" class="px-3 py-1.5 bg-zinc-900 text-white text-xs font-semibold rounded-lg">Save</button>
                  <button (click)="editingTitle.set(false)" class="px-3 py-1.5 border border-zinc-200 text-zinc-600 text-xs font-semibold rounded-lg">Cancel</button>
                </div>
              } @else {
                <h1 class="text-2xl font-bold text-zinc-950 leading-tight flex items-start gap-2 group">
                  <span>{{ c.title }}</span>
                  @if (canWrite()) {
                    <button (click)="startEditTitle(c)" title="Rename campaign" class="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-zinc-700 transition-opacity mt-1">
                      <mat-icon class="text-[18px] w-4.5 h-4.5">edit</mat-icon>
                    </button>
                  }
                </h1>
              }
              <app-created-by-badge [createdBy]="c.createdBy" [createdAt]="c.createdAt" [size]="20" />
            </div>
            @if (canDelete()) {
              <button (click)="deleteCampaign(c)" class="text-zinc-500 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors" title="Delete campaign">
                <mat-icon class="text-[20px] w-5 h-5">delete</mat-icon>
              </button>
            }
          </div>

          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-zinc-100">
            <div>
              <label for="cd_status" class="block text-xs font-semibold text-zinc-500 uppercase mb-1">Status</label>
              <select id="cd_status" [ngModel]="c.status" (ngModelChange)="patch({ status: $event })" [disabled]="!canWrite()" class="w-full input-field rounded-lg p-2 text-sm focus:outline-blue-600">
                <option value="Draft">Draft</option>
                <option value="Scheduled">Scheduled</option>
                <option value="Sending">Sending</option>
                <option value="Active">Active</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
            <div class="col-span-2 md:col-span-2">
              <label for="cd_audience" class="block text-xs font-semibold text-zinc-500 uppercase mb-1">Target audience label</label>
              <input id="cd_audience" [ngModel]="c.targetAudience || ''" (ngModelChange)="draftAudience = $event" (blur)="saveAudience(c)" [disabled]="!canWrite()"
                     placeholder="e.g. All active customers" class="w-full input-field rounded-lg p-2 text-sm focus:outline-blue-600" />
            </div>
            <div>
              <span class="block text-xs font-semibold text-zinc-500 uppercase mb-1">Messages sent</span>
              <div class="p-2 text-sm text-zinc-700 font-semibold">{{ c.sentCount || 0 }}</div>
            </div>
          </div>

          @if (isWhatsApp(c) && c.templateName) {
            <div class="grid grid-cols-2 md:grid-cols-3 gap-4 pt-4 border-t border-zinc-100 text-sm">
              <div>
                <div class="text-xs font-semibold text-zinc-500 uppercase mb-1">Template</div>
                <div class="font-mono text-zinc-800">{{ c.templateName }} <span class="text-zinc-400">({{ c.templateLang || 'fr' }})</span></div>
              </div>
              @if (c.followupEnabled) {
                <div>
                  <div class="text-xs font-semibold text-zinc-500 uppercase mb-1">Relance</div>
                  <div class="text-zinc-800">After {{ c.followupDelayDays || 3 }} day(s)</div>
                </div>
              }
              @if (c.bodyPreview) {
                <div class="col-span-2">
                  <div class="text-xs font-semibold text-zinc-500 uppercase mb-1">Preview</div>
                  <div class="text-zinc-600 truncate">{{ c.bodyPreview }}</div>
                </div>
              }
            </div>
          }

          @if (!isWhatsApp(c)) {
            <div class="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200">
              <mat-icon class="text-amber-600 text-[18px] w-4.5 h-4.5 shrink-0">info</mat-icon>
              <p class="text-xs text-amber-800">{{ c.type }} sending isn't wired up yet — build the audience below so it's ready to go once it is.</p>
            </div>
          } @else if (c.status === 'Draft' && canWrite()) {
            <div class="flex items-center justify-between gap-3 pt-4 border-t border-zinc-100">
              <span class="text-xs text-zinc-500">{{ pendingCount() }} recipient(s) ready to send</span>
              <button (click)="launch(c)" [disabled]="pendingCount() === 0 || launching()"
                      class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-200 disabled:text-zinc-400 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg flex items-center gap-1.5 transition-colors">
                <mat-icon class="text-[18px] w-4.5 h-4.5">send</mat-icon>{{ launching() ? 'Launching…' : 'Launch campaign' }}
              </button>
            </div>
          }
        </div>

        <!-- Message template -->
        @if (canWrite()) {
          <div class="card rounded-2xl p-6 space-y-4">
            <div class="flex items-center justify-between">
              <h2 class="text-base font-bold text-zinc-900 flex items-center gap-2">
                <mat-icon class="text-[20px] w-5 h-5 text-zinc-700">description</mat-icon>Message template
              </h2>
              @if (!newTemplateOpen()) {
                <button (click)="openNewTemplate()" class="text-xs font-semibold text-zinc-600 hover:text-zinc-900 flex items-center gap-1 transition-colors">
                  <mat-icon class="text-[16px] w-4 h-4">add</mat-icon>New template
                </button>
              }
            </div>

            @if (isWhatsApp(c)) {
              <p class="text-xs text-zinc-500 -mt-2">Reference copy for your team — the actual WhatsApp send uses the approved Meta template above (<span class="font-mono">{{ c.templateName || 'none set' }}</span>).</p>
            }

            <div>
              <label for="cd_template" class="block text-xs font-semibold text-zinc-500 uppercase mb-1">Template</label>
              <select id="cd_template" [ngModel]="c.templateId || ''" (ngModelChange)="onTemplateChange(c, $event)" class="w-full input-field rounded-lg p-2 text-sm focus:outline-blue-600">
                <option value="">-- No template --</option>
                @for (t of templatesForChannel(c); track t.id) { <option [value]="t.id">{{ t.name }}</option> }
              </select>
            </div>

            @if (selectedTemplate(c); as t) {
              <div class="rounded-xl border border-zinc-200 bg-zinc-50 p-4 space-y-2">
                @if (c.type === 'Email' && t.subject) {
                  <div class="text-sm"><span class="font-semibold text-zinc-500">Subject:</span> <span class="text-zinc-900">{{ t.subject }}</span></div>
                }
                <div class="text-sm text-zinc-700 whitespace-pre-wrap">{{ t.body }}</div>
              </div>
            } @else if (templatesForChannel(c).length === 0 && !newTemplateOpen()) {
              <p class="text-xs text-zinc-400">No {{ c.type }} templates yet — create one above.</p>
            }

            @if (newTemplateOpen()) {
              <div class="rounded-xl border border-zinc-200 p-4 space-y-3">
                <div>
                  <label for="cd_new_tpl_name" class="block text-xs font-semibold text-zinc-500 uppercase mb-1">Template name</label>
                  <input id="cd_new_tpl_name" [(ngModel)]="newTemplateName" type="text" placeholder="e.g. Relance rentrée" class="w-full input-field rounded-lg p-2 text-sm focus:outline-blue-600" />
                </div>
                @if (c.type === 'Email') {
                  <div>
                    <label for="cd_new_tpl_subject" class="block text-xs font-semibold text-zinc-500 uppercase mb-1">Subject</label>
                    <input id="cd_new_tpl_subject" [(ngModel)]="newTemplateSubject" type="text" placeholder="e.g. Votre offre Bento CRM Pro" class="w-full input-field rounded-lg p-2 text-sm focus:outline-blue-600" />
                  </div>
                }
                <div>
                  <label for="cd_new_tpl_body" class="block text-xs font-semibold text-zinc-500 uppercase mb-1">
                    Message
                    <span class="normal-case font-normal text-zinc-400">— {{ '{{name}}' }} and {{ '{{company}}' }} are filled in per contact</span>
                  </label>
                  <textarea id="cd_new_tpl_body" [(ngModel)]="newTemplateBody" rows="4" placeholder="Bonjour {{ '{{name}}' }}, …"
                            class="w-full input-field rounded-lg p-2 text-sm focus:outline-blue-600"></textarea>
                </div>
                <div class="flex justify-end gap-2">
                  <button (click)="newTemplateOpen.set(false)" class="px-3 py-1.5 border border-zinc-200 text-zinc-600 text-xs font-semibold rounded-lg hover:bg-zinc-50">Cancel</button>
                  <button (click)="saveNewTemplate(c)" [disabled]="!newTemplateName.trim() || !newTemplateBody.trim()"
                          class="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-950 disabled:bg-zinc-200 disabled:text-zinc-400 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg">
                    Save & use
                  </button>
                </div>
              </div>
            }
          </div>
        }

        <!-- Stats -->
        @if (isWhatsApp(c) && wa.stats(); as s) {
          <div class="grid grid-cols-3 sm:grid-cols-7 gap-px bg-zinc-100 border border-zinc-100 rounded-2xl overflow-hidden">
            <div class="bg-white p-3 text-center"><div class="text-lg font-semibold text-zinc-900">{{ s.total }}</div><div class="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Total</div></div>
            <div class="bg-white p-3 text-center"><div class="text-lg font-semibold text-zinc-500">{{ s.pending }}</div><div class="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Pending</div></div>
            <div class="bg-white p-3 text-center"><div class="text-lg font-semibold text-sky-700">{{ s.sent + s.delivered + s.read }}</div><div class="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Sent</div></div>
            <div class="bg-white p-3 text-center"><div class="text-lg font-semibold text-emerald-700">{{ s.replied }}</div><div class="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Replied</div></div>
            <div class="bg-white p-3 text-center"><div class="text-lg font-semibold text-red-700">{{ s.failed }}</div><div class="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Failed</div></div>
            <div class="bg-white p-3 text-center"><div class="text-lg font-semibold text-amber-700">{{ s.skipped }}</div><div class="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Skipped</div></div>
            <div class="bg-white p-3 text-center"><div class="text-lg font-semibold text-zinc-900">{{ s.replyRate }}%</div><div class="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Reply rate</div></div>
          </div>
          @if (s.followupsPending > 0) {
            <div class="flex items-center justify-between px-4 py-2 bg-white border border-zinc-100 rounded-xl">
              <span class="text-xs text-zinc-500">{{ s.followupsPending }} relance(s) due</span>
              <button (click)="cancelFollowups(c)" class="text-xs px-3 py-1.5 border border-zinc-200 hover:bg-zinc-50 text-zinc-700 rounded-lg font-medium transition-colors">
                Cancel all pending relances
              </button>
            </div>
          }
        } @else {
          <div class="grid grid-cols-3 gap-px bg-zinc-100 border border-zinc-100 rounded-2xl overflow-hidden">
            <div class="bg-white p-3 text-center"><div class="text-lg font-semibold text-zinc-900">{{ wa.recipients().length }}</div><div class="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Total</div></div>
            <div class="bg-white p-3 text-center"><div class="text-lg font-semibold text-zinc-500">{{ pendingCount() }}</div><div class="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Ready</div></div>
            <div class="bg-white p-3 text-center"><div class="text-lg font-semibold text-amber-700">{{ skippedCount() }}</div><div class="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Skipped</div></div>
          </div>
        }

        <!-- Audience builder -->
        @if (canWrite()) {
          <div class="card rounded-2xl p-6 space-y-4">
            <h2 class="text-base font-bold text-zinc-900 flex items-center gap-2">
              <mat-icon class="text-[20px] w-5 h-5 text-zinc-700">group_add</mat-icon>Add recipients
            </h2>

            <div class="flex flex-wrap items-center gap-2">
              <div class="relative flex-1 min-w-[200px]">
                <mat-icon class="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-[18px] w-4.5 h-4.5 pointer-events-none">search</mat-icon>
                <input [ngModel]="search()" (ngModelChange)="search.set($event)" type="text" placeholder="Search contacts by name, email or phone..."
                       class="w-full pl-9! pr-3 py-2 input-field rounded-lg text-sm focus:outline-blue-600" />
              </div>
              <select [ngModel]="typeFilter()" (ngModelChange)="typeFilter.set($event)" class="input-field rounded-lg px-2 py-2 text-sm focus:outline-blue-600 cursor-pointer">
                <option [ngValue]="null">All types</option>
                @for (t of partnerTypes; track t.value) { <option [ngValue]="t.value">{{ t.label }}</option> }
              </select>
              <select [ngModel]="groupFilter()" (ngModelChange)="groupFilter.set($event)" class="input-field rounded-lg px-2 py-2 text-sm focus:outline-blue-600 cursor-pointer max-w-[180px]">
                <option [ngValue]="null">All groups</option>
                @for (g of audienceGroups; track g.key) { <option [ngValue]="g.key">{{ g.label }}</option> }
              </select>
              @if (typeFilter() || groupFilter() || search()) {
                <button (click)="clearFilters()" class="text-xs text-zinc-500 hover:text-zinc-900 px-2 py-2 transition-colors">Clear</button>
              }
            </div>

            <div class="flex items-center justify-between px-1">
              <label class="flex items-center gap-2 text-xs font-medium text-zinc-600 cursor-pointer select-none">
                <input type="checkbox" [checked]="allFilteredSelected()" [disabled]="filteredPartners().length === 0"
                       (change)="toggleSelectAllFiltered()" class="w-4 h-4 rounded border-zinc-300 accent-zinc-900 cursor-pointer" />
                Select all {{ filteredPartners().length }} filtered
              </label>
              <span class="text-xs text-zinc-500">{{ selectedIds().size }} selected</span>
            </div>

            <div class="border border-zinc-200 rounded-xl max-h-72 overflow-y-auto divide-y divide-zinc-100">
              @for (p of filteredPartners(); track p.id) {
                <button (click)="toggleSelect(p.id)" type="button"
                        class="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-zinc-50 transition-colors"
                        [class.bg-zinc-50]="selectedIds().has(p.id)">
                  <div class="w-4 h-4 rounded border flex items-center justify-center shrink-0"
                       [class]="selectedIds().has(p.id) ? 'bg-zinc-900 border-zinc-900' : 'border-zinc-300'">
                    @if (selectedIds().has(p.id)) { <mat-icon class="text-white text-[12px]! w-3 h-3 leading-none!">check</mat-icon> }
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="text-sm font-medium text-zinc-900 truncate">{{ p.name }}</div>
                    <div class="text-xs text-zinc-500 truncate">{{ contactHint(c, p) }}<span class="text-zinc-300"> · </span>{{ p.type }}</div>
                  </div>
                  @if (isEnrolled(p.id)) {
                    <span class="text-[10px] font-semibold uppercase text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded shrink-0">Added</span>
                  }
                </button>
              } @empty {
                <div class="px-3 py-6 text-center text-sm text-zinc-500">No contacts match these filters.</div>
              }
            </div>
            <button (click)="addSelected(c)" [disabled]="selectedIds().size === 0"
                    class="px-4 py-2 bg-zinc-900 hover:bg-zinc-950 disabled:bg-zinc-200 disabled:text-zinc-400 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg">
              Add {{ selectedIds().size || '' }} selected
            </button>
          </div>
        }

        <!-- Recipients -->
        <div class="card rounded-2xl overflow-hidden">
          <div class="p-4 border-b border-zinc-100 flex items-center justify-between">
            <h2 class="text-base font-bold text-zinc-900">Recipients <span class="text-zinc-400 font-normal">({{ wa.recipients().length }})</span></h2>
            @if (isWhatsApp(c) && (c.status === 'Sending' || c.status === 'Active')) {
              <span class="text-xs text-zinc-500">Auto-refreshing every 5s</span>
            }
          </div>
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-zinc-100">
              <thead class="bg-zinc-50">
                <tr>
                  <th class="px-4 py-2.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Contact</th>
                  <th class="px-4 py-2.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Status</th>
                  @if (canWrite()) { <th class="px-4 py-2.5"></th> }
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-zinc-100">
                @for (r of wa.recipients(); track r.id) {
                  <tr class="hover:bg-zinc-50 transition-colors">
                    <td class="px-4 py-2.5">
                      <div class="text-sm font-medium text-zinc-900">{{ r.partnerName }}</div>
                      <div class="text-xs text-zinc-500 font-mono">{{ r.email || r.phone || '—' }}</div>
                    </td>
                    <td class="px-4 py-2.5">
                      <span [class]="statusClass(r.status)" class="px-2.5 py-1 text-xs font-medium rounded-full whitespace-nowrap">{{ statusLabel(r.status) }}</span>
                      @if (r.errorTitle) { <div class="text-[11px] text-red-600 mt-1 max-w-xs">{{ r.errorTitle }}</div> }
                    </td>
                    @if (canWrite()) {
                      <td class="px-4 py-2.5 text-right">
                        <button (click)="removeRecipient(c, r)" title="Remove" class="text-zinc-400 hover:text-red-600 p-1 rounded">
                          <mat-icon class="text-[16px] w-4 h-4">close</mat-icon>
                        </button>
                      </td>
                    }
                  </tr>
                } @empty {
                  <tr><td [attr.colspan]="canWrite() ? 3 : 2" class="px-4 py-10 text-center text-sm text-zinc-500">No recipients yet — add some above.</td></tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      } @else if (loading()) {
        <div class="card rounded-2xl p-12 text-center text-sm text-zinc-400">Loading campaign…</div>
      } @else {
        <div class="card rounded-2xl p-12 text-center space-y-3">
          <mat-icon class="text-[40px]! w-10 h-10 text-zinc-300 block mx-auto">campaign</mat-icon>
          <p class="text-sm text-zinc-500">This campaign doesn't exist or you don't have access to it.</p>
          <a routerLink="/marketing" class="inline-block bg-zinc-100 text-zinc-950 border border-zinc-200/50 px-4 py-2 rounded-xl text-xs font-bold">Return to Marketing</a>
        </div>
      }
    </div>
  `
})
export class CampaignDetailComponent {
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

  deleteCampaign(c: Campaign): void {
    if (!this.canDelete()) return;
    if (confirm(`Delete campaign "${c.title}"? This cannot be undone.`)) {
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
      case 'WhatsApp': return 'text-emerald-700 border-emerald-200 bg-emerald-50';
      case 'SMS': return 'text-purple-700 border-purple-200 bg-purple-50';
      default: return 'text-sky-700 border-sky-200 bg-sky-50';
    }
  }

  statusLabel(status: string): string {
    return status === 'OPTED_OUT' ? 'Opted out' : status.charAt(0) + status.slice(1).toLowerCase();
  }

  statusClass(status: string): string {
    switch (status) {
      case 'REPLIED': return 'bg-emerald-50 text-emerald-700';
      case 'READ': return 'bg-sky-50 text-sky-700';
      case 'DELIVERED': return 'bg-sky-50 text-sky-600';
      case 'SENT': return 'bg-zinc-100 text-zinc-700';
      case 'FAILED': return 'bg-red-50 text-red-700';
      case 'OPTED_OUT': return 'bg-orange-50 text-orange-700';
      case 'SKIPPED': return 'bg-amber-50 text-amber-700';
      default: return 'bg-zinc-100 text-zinc-600';
    }
  }
}
