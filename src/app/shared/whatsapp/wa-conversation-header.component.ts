import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { ApiService } from '../../services/api.service';
import { WaConversation } from '../../services/domains/whatsapp-inbox.service';
import { conversationTitle, formatPhone, initials } from './wa-format';

interface PartnerHit { id: string; name: string; phone?: string; type?: string }

/**
 * Who the conversation is with, its WhatsApp state (reply window, opt-out), and what can be done
 * about the contact: open the lead, link an existing partner, create a lead, or ignore the number.
 */
@Component({
  selector: 'app-wa-conversation-header',
  imports: [FormsModule, RouterLink, MatIconModule, TranslatePipe],
  styles: [`
    :host { display: block; background: var(--color-surface); border-bottom: 1px solid var(--color-border); }
    .wa-avatar { background: var(--color-surface-active); color: var(--color-text-primary); }
    .wa-muted { color: var(--color-text-secondary); }
    .wa-pill-ok { background: var(--color-success-light); color: var(--color-success); }
    .wa-pill-off { background: var(--color-surface-active); color: var(--color-text-secondary); }
    .wa-pill-bad { background: var(--color-danger-light); color: var(--color-danger); }
    .wa-icon-btn { color: var(--color-text-secondary); }
    .wa-icon-btn:hover { background: var(--color-surface-hover); color: var(--color-text-primary); }
    .wa-menu { background: var(--color-surface); border: 1px solid var(--color-border); box-shadow: var(--shadow-lg); }
    .wa-menu button:hover { background: var(--color-surface-hover); }
    .wa-input { background: var(--color-bg); border: 1px solid var(--color-border); color: var(--color-text-primary); }
    .wa-danger { color: var(--color-danger); }
  `],
  template: `
    @let c = conversation();
    <div class="flex items-center gap-3 px-3 sm:px-4 py-2.5">
      @if (showBack()) {
        <button type="button" class="wa-icon-btn p-1.5 rounded-lg md:hidden" (click)="back.emit()" [attr.aria-label]="'inbox.back' | translate">
          <mat-icon class="rtl:-scale-x-100">arrow_back</mat-icon>
        </button>
      }
      <span class="wa-avatar h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0">{{ avatar() }}</span>
      <div class="min-w-0 flex-1">
        <h2 class="text-sm font-bold truncate">{{ title() }}</h2>
        <p class="text-xs wa-muted truncate">
          <span dir="ltr">{{ phone() }}</span>
          @if (c.displayName && c.displayName !== title()) { · ~{{ c.displayName }} }
        </p>
        <div class="flex flex-wrap gap-1 mt-1">
          @if (c.optedOut) {
            <span class="wa-pill-bad text-meta font-semibold px-1.5 py-0.5 rounded">{{ 'inbox.header.optedOut' | translate }}</span>
          } @else if (c.windowOpen) {
            <span class="wa-pill-ok text-meta font-semibold px-1.5 py-0.5 rounded">{{ 'inbox.header.windowOpen' | translate }}</span>
          } @else {
            <span class="wa-pill-off text-meta font-semibold px-1.5 py-0.5 rounded">{{ 'inbox.header.windowClosed' | translate }}</span>
          }
          @if (!c.partnerId) {
            <span class="wa-pill-off text-meta font-semibold px-1.5 py-0.5 rounded">{{ 'inbox.header.unknown' | translate }}</span>
          }
        </div>
      </div>

      <div class="flex items-center gap-1 shrink-0">
        @if (c.partnerId && c.partnerType === 'LEAD') {
          <a [routerLink]="['/partners/lead', c.partnerId]" class="wa-icon-btn text-xs font-semibold px-2 py-1.5 rounded-lg hidden sm:inline-flex items-center gap-1">
            <mat-icon class="!text-[16px] !w-4 !h-4">open_in_new</mat-icon>{{ 'inbox.header.openLead' | translate }}
          </a>
        } @else if (!c.partnerId && canCreateLead()) {
          <button type="button" class="wa-icon-btn text-xs font-semibold px-2 py-1.5 rounded-lg inline-flex items-center gap-1" (click)="createLead.emit()">
            <mat-icon class="!text-[16px] !w-4 !h-4">person_add</mat-icon><span class="hidden sm:inline">{{ 'inbox.header.createLead' | translate }}</span>
          </button>
        }
        <div class="relative">
          <button type="button" class="wa-icon-btn p-1.5 rounded-lg" (click)="menuOpen.set(!menuOpen())"
                  [attr.aria-expanded]="menuOpen()" [attr.aria-label]="'inbox.header.more' | translate">
            <mat-icon>more_vert</mat-icon>
          </button>
          @if (menuOpen()) {
            <div class="wa-menu absolute end-0 top-10 z-30 w-64 rounded-xl py-1 text-sm">
              @if (c.partnerId && c.partnerType === 'LEAD') {
                <a [routerLink]="['/partners/lead', c.partnerId]" class="flex items-center gap-2 px-3 py-2 sm:hidden" (click)="menuOpen.set(false)">
                  <mat-icon class="!text-[18px] wa-muted">open_in_new</mat-icon>{{ 'inbox.header.openLead' | translate }}
                </a>
              }
              @if (canLink()) {
                @if (linking()) {
                  <div class="px-3 py-2 space-y-1.5">
                    <input type="search" class="wa-input w-full rounded-lg px-2 py-1.5 text-sm"
                           [placeholder]="'inbox.linkPartner.search' | translate"
                           [ngModel]="partnerQuery()" (ngModelChange)="searchPartners($event)" />
                    <div class="max-h-48 overflow-y-auto">
                      @for (p of partnerHits(); track p.id) {
                        <button type="button" class="w-full text-start px-2 py-1.5 rounded-lg" (click)="pick(p)">
                          <span class="block text-sm font-semibold truncate">{{ p.name }}</span>
                          <span class="block text-meta wa-muted" dir="ltr">{{ p.phone }}</span>
                        </button>
                      } @empty {
                        @if (partnerQuery().length > 1) {
                          <p class="text-xs wa-muted px-2 py-1">{{ 'inbox.linkPartner.none' | translate }}</p>
                        }
                      }
                    </div>
                  </div>
                } @else {
                  <button type="button" class="w-full flex items-center gap-2 px-3 py-2 text-start" (click)="linking.set(true)">
                    <mat-icon class="!text-[18px] wa-muted">link</mat-icon>{{ 'inbox.header.linkPartner' | translate }}
                  </button>
                  @if (c.partnerId) {
                    <button type="button" class="w-full flex items-center gap-2 px-3 py-2 text-start" (click)="linkPartner.emit(null); close()">
                      <mat-icon class="!text-[18px] wa-muted">link_off</mat-icon>{{ 'inbox.header.unlink' | translate }}
                    </button>
                  }
                }
              }
              @if (canIgnore()) {
                <button type="button" class="w-full flex items-center gap-2 px-3 py-2 text-start wa-danger" (click)="confirmIgnore()">
                  <mat-icon class="!text-[18px]">block</mat-icon>{{ 'inbox.header.ignore' | translate }}
                </button>
              }
            </div>
          }
        </div>
      </div>
    </div>
  `
})
export class WaConversationHeaderComponent {
  private api = inject(ApiService);

  conversation = input.required<WaConversation>();
  showBack = input(false);
  canLink = input(false);
  canCreateLead = input(false);
  canIgnore = input(false);

  back = output<void>();
  createLead = output<void>();
  linkPartner = output<string | null>();
  ignore = output<void>();

  protected menuOpen = signal(false);
  protected linking = signal(false);
  protected partnerQuery = signal('');
  protected partnerHits = signal<PartnerHit[]>([]);
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  protected title = computed(() => conversationTitle(this.conversation()));
  protected avatar = computed(() => initials(this.title()));
  protected phone = computed(() => formatPhone(this.conversation().phone));

  searchPartners(q: string): void {
    this.partnerQuery.set(q);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    if (q.trim().length < 2) {
      this.partnerHits.set([]);
      return;
    }
    this.searchTimer = setTimeout(() => {
      this.api.getPartners({ q: q.trim(), size: 8 }).subscribe({
        next: list => this.partnerHits.set(list.map(p => ({ id: p.id, name: p.name, phone: p.phone, type: String(p.type) }))),
        error: () => this.partnerHits.set([])
      });
    }, 250);
  }

  pick(p: PartnerHit): void {
    this.linkPartner.emit(p.id);
    this.close();
  }

  confirmIgnore(): void {
    this.close();
    this.ignore.emit();
  }

  close(): void {
    this.menuOpen.set(false);
    this.linking.set(false);
    this.partnerQuery.set('');
    this.partnerHits.set([]);
  }
}
