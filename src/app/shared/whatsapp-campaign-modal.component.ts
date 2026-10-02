import { Component, computed, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { PartnersService } from '../services/domains';
import { WhatsAppCampaignsService } from '../services/domains/whatsapp-campaigns.service';

/**
 * Composer for a WhatsApp campaign: pick contacts, pick an approved template,
 * configure the relance, send.
 */
@Component({
  selector: 'app-whatsapp-campaign-modal',
  imports: [CommonModule, FormsModule, MatIconModule],
  template: `
    @if (open()) {
      <div class="modal-backdrop">
        <div class="modal modal-xl modal-flush">

          <div class="flex justify-between items-center p-6 pb-4 border-b border-line-soft">
            <div class="flex items-center gap-2">
              <mat-icon class="text-success-ink icon-lg">chat</mat-icon>
              <h3 class="modal-title">New WhatsApp Campaign</h3>
            </div>
            <button (click)="closed.emit()" title="Close" class="btn-icon btn-sm">
              <mat-icon class="icon-sm">close</mat-icon>
            </button>
          </div>

          <!-- No connected number means nothing can send; say so before the agent
               fills in the whole form. -->
          @if (!wa.hasAccount()) {
            <div class="mx-6 mt-4 p-4 rounded-xl bg-warning-soft border border-warning-line flex items-start gap-3">
              <mat-icon class="text-warning-ink shrink-0 icon-md">warning</mat-icon>
              <div class="flex-1">
                <p class="text-sm font-semibold text-warning-ink">No WhatsApp number connected</p>
                <p class="text-xs text-warning-ink mt-0.5">
                  Connect a simulated number to test the full flow now, without waiting for Meta approval.
                </p>
                <button (click)="wa.connectMock()"
                        class="btn-secondary btn-sm mt-2">
                  Connect simulated number
                </button>
              </div>
            </div>
          }

          <div class="flex-1 overflow-y-auto p-6 space-y-5">

            <div>
              <label for="campaign_title" class="field-label mb-1.5">Campaign title</label>
              <input id="campaign_title" [(ngModel)]="title" type="text" placeholder="Relance devis Q3"
                     class="input-field w-full" />
            </div>

            <!-- Contact picker -->
            <div>
              <div class="flex items-center justify-between mb-1.5">
                <label for="label_1" class="field-label">
                  Recipients
                  <span class="text-success-ink">({{ selectedIds().size }} selected)</span>
                </label>
                <div class="flex gap-2">
                  <button (click)="selectAllVisible()" class="text-xs text-ink-3 hover:text-ink transition-colors">Select all</button>
                  <span class="text-ink-4">|</span>
                  <button (click)="clearSelection()" class="text-xs text-ink-3 hover:text-ink transition-colors">Clear</button>
                </div>
              </div>

              <div class="relative mb-2">
                <mat-icon class="absolute left-3 top-1/2 -translate-y-1/2 text-ink-4 pointer-events-none icon-md">search</mat-icon>
                <input [(ngModel)]="search" type="text" placeholder="Search contacts by name, phone or city..."
                       class="input-field w-full pl-9 pr-3" />
              </div>

              <div class="border border-line rounded-xl max-h-56 overflow-y-auto divide-y divide-line-soft">
                @for (p of filteredPartners(); track p.id) {
                  <button (click)="toggle(p.id)" type="button"
                          class="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-subtle transition-colors"
                          [class.bg-success-soft]="selectedIds().has(p.id)">
                    <div class="check-box" [class.is-checked]="selectedIds().has(p.id)">
                      @if (selectedIds().has(p.id)) {
                        <mat-icon class="icon-xs">check</mat-icon>
                      }
                    </div>
                    <div class="min-w-0 flex-1">
                      <div class="text-sm font-medium text-ink truncate">{{ p.name }}</div>
                      <div class="text-xs text-ink-3 truncate">
                        {{ p.phone || 'No phone number' }}
                        @if (p.city) { <span class="text-ink-3">·</span> {{ p.city }} }
                      </div>
                    </div>
                    <!-- Flagged before sending rather than after: a contact with no
                         phone can never receive the campaign. -->
                    @if (!p.phone) {
                      <span class="badge shrink-0 badge-warning">No phone</span>
                    }
                  </button>
                } @empty {
                  <div class="px-3 py-6 text-center text-sm text-ink-3">No contacts match that search.</div>
                }
              </div>
              @if (selectedWithoutPhone() > 0) {
                <p class="mt-1.5 text-xs text-warning-ink">
                  {{ selectedWithoutPhone() }} selected contact(s) have no phone number and will be skipped.
                </p>
              }
            </div>

            @if (linked()) {
              <!-- Linked personal number: plain text, paced to protect the number. -->
              <div class="rounded-xl border border-warning-line bg-warning-soft p-3 text-xs text-warning-ink space-y-1">
                <p class="font-semibold">This sends from your own WhatsApp number{{ wa.account()?.linkedPhone ? ' (' + wa.account()?.linkedPhone + ')' : '' }}.</p>
                <p>
                  WhatsApp bans personal numbers that message many people who do not expect it. Bento sends at most
                  15 new chats a day and 30 first messages an hour, during business hours, so this campaign takes about
                  <strong>{{ estimatedDays() }} day(s)</strong>. Only include contacts who know you, and honour STOP replies.
                </p>
              </div>
              <div>
                <label for="linked_body" class="field-label mb-1.5">Message</label>
                <textarea id="linked_body" [(ngModel)]="bodyPreview" rows="4" maxlength="4096"
                          placeholder="Bonjour, je reviens vers vous concernant votre devis. Êtes-vous toujours intéressé ?"
                          class="input-field w-full"></textarea>
              </div>
            } @else {
            <!-- Template -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div class="sm:col-span-2">
                <label for="approved_template_na" class="field-label mb-1.5">Approved template name</label>
                <input id="approved_template_na" [(ngModel)]="templateName" type="text" placeholder="first_contact_fr"
                       class="input-field w-full font-mono" />
              </div>
              <div>
                <label for="language" class="field-label mb-1.5">Language</label>
                <select id="language" [(ngModel)]="templateLang"
                        class="input-field w-full">
                  <option value="fr">fr</option>
                  <option value="ar">ar</option>
                  <option value="en">en</option>
                </select>
              </div>
            </div>

            <div>
              <label for="label_4" class="field-label mb-1.5">
                Template variables
                <span class="normal-case font-normal text-ink-3">— comma separated, fills {{ '{{1}}' }}, {{ '{{2}}' }} …</span>
              </label>
              <input [(ngModel)]="paramsRaw" type="text" placeholder="Ahmed, votre devis #4821"
                     class="input-field w-full" />
            </div>

            <div>
              <label for="label_5" class="field-label mb-1.5">
                Message preview
                <span class="normal-case font-normal text-ink-3">— shown in the CRM timeline only</span>
              </label>
              <textarea [(ngModel)]="bodyPreview" rows="2" placeholder="Bonjour Ahmed, je reviens vers vous concernant votre devis #4821."
                        class="input-field w-full"></textarea>
            </div>
            }

            <!-- Relance -->
            <div class="rounded-xl border border-line p-4 space-y-3">
              <label for="label_6" class="flex items-center gap-2.5 cursor-pointer">
                <input id="label_6" type="checkbox" [(ngModel)]="followupEnabled" />
                <span class="text-sm font-medium text-ink">Send a relance if the contact does not reply</span>
              </label>

              @if (followupEnabled()) {
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-6.5">
                  <div>
                    <label for="delay_days" class="field-label mb-1.5">Delay (days)</label>
                    <input id="delay_days" [(ngModel)]="followupDelayDays" type="number" min="1"
                           class="input-field w-full" />
                  </div>
                  @if (!linked()) {
                  <div>
                    <label for="relance_template" class="field-label mb-1.5">Relance template</label>
                    <input id="relance_template" [(ngModel)]="followupTemplateName" type="text" placeholder="relance_j3_fr"
                           class="input-field w-full font-mono" />
                  </div>
                  }
                </div>
                @if (linked()) {
                  <div class="pl-6.5">
                    <label for="relance_body" class="field-label mb-1.5">Relance message</label>
                    <textarea id="relance_body" [(ngModel)]="followupBody" rows="2" maxlength="4096"
                              placeholder="Petit rappel concernant mon message précédent."
                              class="input-field w-full"></textarea>
                  </div>
                }

                <!-- Turns a three-day test cycle into a three-minute one. -->
                @if (wa.isMock()) {
                  <div class="pl-6.5">
                    <label for="label_9" class="flex items-center gap-2.5 cursor-pointer">
                      <input id="label_9" type="checkbox" [(ngModel)]="testMode" />
                      <span class="text-xs text-warning-ink">
                        Test mode — send the relance after
                        <input [(ngModel)]="followupDelayMinutes" type="number" min="1"
                               class="input-field w-14" />
                        minute(s) instead of days
                      </span>
                    </label>
                  </div>
                }
              }
            </div>
          </div>

          <div class="flex items-center justify-between gap-3 p-6 pt-4 border-t border-line-soft">
            <p class="text-xs text-ink-3">
              @if (validationError()) {
                <span class="text-danger-ink font-medium">{{ validationError() }}</span>
              } @else if (launchBlocker()) {
                <span class="text-warning-ink font-medium">{{ launchBlocker() }}</span>
              } @else {
                Sending to <strong class="text-ink">{{ sendableCount() }}</strong> contact(s).
              }
            </p>
            <div class="flex gap-2">
              <button (click)="closed.emit()"
                      class="btn-secondary">
                Cancel
              </button>
              <button (click)="submit(false)" [disabled]="!!validationError() || wa.isSending()"
                      class="btn-secondary">
                Save draft
              </button>
              <button (click)="submit(true)" [disabled]="!!validationError() || !!launchBlocker() || wa.isSending()"
                      class="btn-primary">
                <mat-icon class="icon-sm">send</mat-icon>
                {{ wa.isSending() ? 'Sending…' : linked() ? 'Start sending' : 'Send now' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    }
  `,
})
export class WhatsAppCampaignModalComponent {
  open = input<boolean>(false);
  closed = output<void>();
  created = output<string>();

  partnersService = inject(PartnersService);
  wa = inject(WhatsAppCampaignsService);

  title = signal('');
  search = signal('');
  templateName = signal('');
  templateLang = signal('fr');
  paramsRaw = signal('');
  bodyPreview = signal('');
  followupEnabled = signal(true);
  followupDelayDays = signal(3);
  followupTemplateName = signal('');
  followupBody = signal('');
  testMode = signal(false);
  followupDelayMinutes = signal(2);

  selectedIds = signal<Set<string>>(new Set());

  constructor() {
    this.partnersService.load();
    this.wa.loadAccount();
  }

  filteredPartners = computed(() => {
    const q = this.search().toLowerCase().trim();
    const all = this.partnersService.allPartners();
    if (!q) return all;
    return all.filter(p =>
      (p.name || '').toLowerCase().includes(q) ||
      (p.phone || '').toLowerCase().includes(q) ||
      (p.city || '').toLowerCase().includes(q)
    );
  });

  private selectedPartners = computed(() =>
    this.partnersService.allPartners().filter(p => this.selectedIds().has(p.id))
  );

  selectedWithoutPhone = computed(() => this.selectedPartners().filter(p => !p.phone).length);
  sendableCount = computed(() => this.selectedPartners().filter(p => !!p.phone).length);

  /** A personal number linked through the bot: plain text, paced, no templates. */
  linked = computed(() => this.wa.account()?.provider === 'BAILEYS');

  /** Rough duration at the default cap of 15 new chats a day. */
  estimatedDays = computed(() => Math.max(1, Math.ceil(this.sendableCount() / 15)));

  validationError = computed(() => {
    if (!this.wa.hasAccount()) return 'Connect a WhatsApp number first.';
    if (!this.title().trim()) return 'Give the campaign a title.';
    if (this.linked()) {
      if (!this.bodyPreview().trim()) return 'Write the message.';
      if (this.followupEnabled() && !this.followupBody().trim()) return 'Write the relance message, or turn the relance off.';
    } else if (!this.templateName().trim()) return 'Enter the approved template name.';
    if (this.selectedIds().size === 0) return 'Select at least one contact.';
    if (this.sendableCount() === 0) return 'None of the selected contacts have a phone number.';
    return null;
  });

  /** A draft can be saved while the linked number is offline; launching needs a live session. */
  launchBlocker = computed(() =>
    this.linked() && this.wa.account()?.sessionState !== 'open'
      ? 'Your WhatsApp number is not connected (Settings → WhatsApp). You can save a draft.'
      : null);

  toggle(id: string): void {
    // Signals compare by reference, so mutating the existing Set would not trigger
    // recomputation of the derived counts.
    const next = new Set(this.selectedIds());
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    this.selectedIds.set(next);
  }

  selectAllVisible(): void {
    const next = new Set(this.selectedIds());
    this.filteredPartners().forEach(p => next.add(p.id));
    this.selectedIds.set(next);
  }

  clearSelection(): void {
    this.selectedIds.set(new Set());
  }

  submit(launchNow: boolean): void {
    if (this.validationError() || (launchNow && this.launchBlocker())) return;

    this.wa.create({
      title: this.title().trim(),
      templateName: this.linked() ? undefined : this.templateName().trim(),
      templateLang: this.templateLang(),
      templateParams: this.paramsRaw().split(',').map(s => s.trim()).filter(Boolean),
      bodyPreview: this.bodyPreview().trim() || undefined,
      partnerIds: Array.from(this.selectedIds()),
      followupEnabled: this.followupEnabled(),
      followupDelayDays: this.followupDelayDays(),
      followupTemplateName: this.linked() ? undefined : this.followupTemplateName().trim() || undefined,
      followupBody: this.linked() ? this.followupBody().trim() || undefined : undefined,
      followupDelayMinutes: this.testMode() ? this.followupDelayMinutes() : undefined,
      launchNow,
    }, (campaignId) => {
      this.reset();
      this.created.emit(campaignId);
      this.closed.emit();
    });
  }

  private reset(): void {
    this.title.set('');
    this.search.set('');
    this.templateName.set('');
    this.paramsRaw.set('');
    this.bodyPreview.set('');
    this.followupTemplateName.set('');
    this.followupBody.set('');
    this.selectedIds.set(new Set());
  }
}
