import { Component, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { firstValueFrom } from 'rxjs';
import { TranslatePipe } from '../pipes/translate.pipe';
import { TranslationService } from '../services/translation.service';
import { ToastService } from '../services/toast.service';
import { UserPickerComponent } from '../shared/user-picker.component';
import { formatPhone } from '../shared/whatsapp/wa-format';
import {
  AutoCreateLeads, InboxVisibility, WhatsAppAccountApi, WhatsAppSession, WhatsAppSettings
} from '../services/domains/whatsapp-account.service';
import { BlockedNumber, WhatsAppInboxStore } from '../services/domains/whatsapp-inbox.service';

const PAIRING_STATES = new Set(['pairing', 'connecting']);

/**
 * Settings → WhatsApp: link the organization's number as a device (pairing code typed on the
 * phone), watch its state live, and choose how the inbox treats new numbers, who sees what, and
 * how fast outreach may go.
 */
@Component({
  selector: 'app-settings-whatsapp',
  imports: [FormsModule, MatIconModule, TranslatePipe, UserPickerComponent],
  styles: [`
    .ws-card { background: var(--color-surface); border: 1px solid var(--color-border); }
    .ws-muted { color: var(--color-text-secondary); }
    .ws-faint { color: var(--color-text-tertiary); }
    .ws-input { background: var(--color-bg); border: 1px solid var(--color-border); color: var(--color-text-primary); }
    .ws-btn { border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text-primary); }
    .ws-btn-primary { background: var(--color-text-primary); color: var(--color-surface); }
    .ws-btn-primary:disabled, .ws-btn:disabled { opacity: .5; cursor: not-allowed; }
    .ws-danger { color: var(--color-danger); }
    .ws-code { background: var(--color-bg); border: 1px dashed var(--color-border-strong, var(--color-border)); }
    .ws-chip-ok { background: var(--color-success-light); color: var(--color-success); }
    .ws-chip-wait { background: var(--color-warning-light); color: var(--color-warning); }
    .ws-chip-bad { background: var(--color-danger-light); color: var(--color-danger); }
    .ws-chip-off { background: var(--color-surface-active); color: var(--color-text-secondary); }
    .ws-note { background: var(--color-warning-light); color: var(--color-text-primary); }
    .ws-option { border: 1px solid var(--color-border); }
    .ws-option:has(input:checked) { border-color: var(--color-accent); background: var(--color-accent-light); }
  `],
  template: `
    <div class="space-y-6 max-w-3xl">
      @if (session(); as s) {
        @if (!s.botConfigured) {
          <p class="ws-note text-sm rounded-xl px-4 py-3 flex gap-2">
            <mat-icon class="shrink-0">warning</mat-icon>{{ 'waSettings.botMissing' | translate }}
          </p>
        }
      }

      <!-- Connection -->
      <section class="ws-card rounded-2xl p-6 space-y-5">
        <div class="flex items-start justify-between gap-4">
          <div>
            <h2 class="text-base font-bold">{{ 'waSettings.title' | translate }}</h2>
            <p class="text-sm ws-muted mt-1">{{ 'waSettings.subtitle' | translate }}</p>
          </div>
          @if (chip(); as c) {
            <span class="text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap" [class]="c.cls">{{ c.label | translate }}</span>
          }
        </div>

        @if (loading()) {
          <p class="text-sm ws-faint">{{ 'inbox.loading' | translate }}</p>
        } @else if (state() === 'open') {
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p class="text-lg font-bold" dir="ltr">{{ phone(session()?.linkedPhone) }}</p>
              @if (session()?.linkedAt) {
                <p class="text-xs ws-muted">{{ 'waSettings.linkedSince' | translate: { date: date(session()?.linkedAt) } }}</p>
              }
            </div>
            <button type="button" class="ws-btn ws-danger text-sm font-semibold px-3 py-2 rounded-lg" [disabled]="busy()" (click)="unlink()">
              {{ 'waSettings.unlink' | translate }}
            </button>
          </div>
        } @else if (state() === 'pairing' && session()?.pairingCode) {
          <div class="grid gap-5 sm:grid-cols-2 items-start">
            <div class="ws-code rounded-2xl p-5 text-center">
              <p class="text-xs ws-muted mb-2">{{ 'waSettings.codeFor' | translate: { phone: phone(session()?.requestedPhone) } }}</p>
              <p class="text-3xl font-mono font-bold tracking-[0.25em]" dir="ltr" aria-live="polite">{{ session()?.pairingCode }}</p>
              <p class="text-xs ws-muted mt-3">
                {{ 'waSettings.expiresIn' | translate: { time: countdown() } }}
                · {{ 'waSettings.attempt' | translate: { n: session()?.pairingAttempt ?? 1, max: 5 } }}
              </p>
            </div>
            <ol class="text-sm space-y-2 list-decimal ps-5">
              <li>{{ 'waSettings.step1' | translate }}</li>
              <li>{{ 'waSettings.step2' | translate }}</li>
              <li>{{ 'waSettings.step3' | translate }}</li>
              <li>{{ 'waSettings.step4' | translate }}</li>
            </ol>
          </div>
          <p class="text-xs ws-faint">{{ 'waSettings.pairingHint' | translate }}</p>
        } @else if (state() === 'connecting' || state() === 'reconnecting' || (state() === 'pairing' && !session()?.pairingCode)) {
          <p class="text-sm ws-muted flex items-center gap-2">
            <mat-icon class="animate-spin">progress_activity</mat-icon>{{ 'waSettings.connecting' | translate }}
          </p>
        } @else {
          @if (state() === 'replaced') {
            <p class="ws-note text-sm rounded-xl px-4 py-3">{{ 'waSettings.replacedHelp' | translate }}</p>
          } @else if (state() === 'logged_out') {
            <p class="ws-note text-sm rounded-xl px-4 py-3">{{ 'waSettings.loggedOutHelp' | translate }}</p>
          } @else if (state() === 'pairing_failed') {
            <p class="ws-note text-sm rounded-xl px-4 py-3">{{ 'waSettings.pairingFailedHelp' | translate }}</p>
          }
          @if (session()?.error && state() !== 'stopped') {
            <p class="text-xs ws-danger">{{ session()?.error }}</p>
          }
          <div class="flex flex-wrap items-end gap-3">
            <label class="flex-1 min-w-[220px]">
              <span class="text-xs font-semibold ws-muted">{{ 'waSettings.phoneLabel' | translate }}</span>
              <input type="tel" dir="ltr" class="ws-input w-full rounded-lg px-3 py-2 mt-1 text-sm" placeholder="+212 6 12 34 56 78"
                     [ngModel]="phoneInput()" (ngModelChange)="phoneInput.set($event)" autocomplete="tel" />
            </label>
            <button type="button" class="ws-btn-primary text-sm font-semibold px-4 py-2 rounded-lg"
                    [disabled]="busy() || !phoneInput().trim() || !session()?.botConfigured" (click)="link()">
              {{ 'waSettings.getCode' | translate }}
            </button>
            @if (state() === 'replaced' || (state() === 'stopped' && session()?.linkedPhone)) {
              <button type="button" class="ws-btn text-sm font-semibold px-4 py-2 rounded-lg" [disabled]="busy()" (click)="reconnect()">
                {{ 'waSettings.reconnect' | translate }}
              </button>
            }
          </div>
          <p class="text-xs ws-faint">{{ 'waSettings.linkHint' | translate }}</p>
        }
      </section>

      <!-- Leads & visibility -->
      @if (settings(); as st) {
        <section class="ws-card rounded-2xl p-6 space-y-5">
          <h2 class="text-base font-bold">{{ 'waSettings.leadsTitle' | translate }}</h2>
          <fieldset class="space-y-2">
            <legend class="text-sm font-semibold mb-2">{{ 'waSettings.autoLeads' | translate }}</legend>
            @for (opt of autoOptions; track opt) {
              <label class="ws-option flex items-start gap-3 rounded-xl px-3 py-2.5 cursor-pointer">
                <input type="radio" name="autoLeads" class="mt-1" [value]="opt" [ngModel]="st.autoCreateLeads"
                       (ngModelChange)="patch({ autoCreateLeads: $event })" />
                <span>
                  <span class="text-sm font-semibold block">{{ ('waSettings.auto.' + opt) | translate }}</span>
                  <span class="text-xs ws-muted">{{ ('waSettings.auto.' + opt + '.hint') | translate }}</span>
                </span>
              </label>
            }
          </fieldset>
          <fieldset class="space-y-2">
            <legend class="text-sm font-semibold mb-2">{{ 'waSettings.visibility' | translate }}</legend>
            @for (opt of visibilityOptions; track opt) {
              <label class="ws-option flex items-start gap-3 rounded-xl px-3 py-2.5 cursor-pointer">
                <input type="radio" name="visibility" class="mt-1" [value]="opt" [ngModel]="st.visibility"
                       (ngModelChange)="patch({ visibility: $event })" />
                <span>
                  <span class="text-sm font-semibold block">{{ ('waSettings.visibility.' + opt) | translate }}</span>
                  <span class="text-xs ws-muted">{{ ('waSettings.visibility.' + opt + '.hint') | translate }}</span>
                </span>
              </label>
            }
          </fieldset>
          <div class="max-w-sm">
            <span class="text-sm font-semibold">{{ 'waSettings.defaultAssignee' | translate }}</span>
            <p class="text-xs ws-muted mb-2">{{ 'waSettings.defaultAssigneeHint' | translate }}</p>
            <app-user-picker [value]="st.defaultAssigneeUserId ?? ''" (valueChange)="patch({ defaultAssigneeUserId: $event || null })" />
          </div>

          <details class="pt-2">
            <summary class="text-sm font-semibold cursor-pointer">{{ 'waSettings.limits' | translate }}</summary>
            <p class="text-xs ws-muted mt-2 mb-3">{{ 'waSettings.limitsHint' | translate }}</p>
            <div class="grid gap-3 sm:grid-cols-2">
              @for (f of limitFields; track f.key) {
                <label>
                  <span class="text-xs font-semibold ws-muted">{{ f.label | translate }}</span>
                  <input type="number" min="0" class="ws-input w-full rounded-lg px-3 py-2 mt-1 text-sm" [placeholder]="f.placeholder"
                         [ngModel]="st[f.key]" (ngModelChange)="patchNumber(f.key, $event)" />
                </label>
              }
            </div>
          </details>

          <div class="flex justify-end">
            <button type="button" class="ws-btn-primary text-sm font-semibold px-4 py-2 rounded-lg" [disabled]="busy() || !dirty()" (click)="saveSettings()">
              {{ 'waSettings.save' | translate }}
            </button>
          </div>
        </section>
      }

      <!-- Ignored numbers -->
      <section class="ws-card rounded-2xl p-6 space-y-3">
        <h2 class="text-base font-bold">{{ 'waSettings.ignoredTitle' | translate }}</h2>
        <p class="text-sm ws-muted">{{ 'waSettings.ignoredHint' | translate }}</p>
        @for (b of blocked(); track b.id) {
          <div class="flex items-center justify-between py-2" style="border-top: 1px solid var(--color-border-light)">
            <span class="text-sm" dir="ltr">{{ phone(b.phone) }}</span>
            <button type="button" class="ws-btn text-xs px-2.5 py-1 rounded-lg" (click)="unblock(b)">{{ 'waSettings.stopIgnoring' | translate }}</button>
          </div>
        } @empty {
          <p class="text-xs ws-faint">{{ 'waSettings.noIgnored' | translate }}</p>
        }
      </section>
    </div>
  `
})
export class SettingsWhatsAppComponent implements OnInit, OnDestroy {
  private api = inject(WhatsAppAccountApi);
  private inbox = inject(WhatsAppInboxStore);
  private i18n = inject(TranslationService);
  private toast = inject(ToastService);

  protected session = signal<WhatsAppSession | null>(null);
  protected settings = signal<WhatsAppSettings | null>(null);
  protected blocked = signal<BlockedNumber[]>([]);
  protected loading = signal(true);
  protected busy = signal(false);
  protected dirty = signal(false);
  protected phoneInput = signal('');
  private now = signal(Date.now());

  protected readonly autoOptions: AutoCreateLeads[] = ['OFF', 'INBOUND', 'INBOUND_AND_PHONE'];
  protected readonly visibilityOptions: InboxVisibility[] = ['ASSIGNED', 'ALL'];
  protected readonly limitFields: { key: 'replyMinGapSeconds' | 'outreachMinGapSeconds' | 'outreachPerHour' | 'newChatsPerDay'; label: string; placeholder: string }[] = [
    { key: 'replyMinGapSeconds', label: 'waSettings.replyGap', placeholder: '3' },
    { key: 'outreachMinGapSeconds', label: 'waSettings.outreachGap', placeholder: '10' },
    { key: 'outreachPerHour', label: 'waSettings.outreachPerHour', placeholder: '30' },
    { key: 'newChatsPerDay', label: 'waSettings.newChatsPerDay', placeholder: '15' },
  ];

  protected state = computed(() => {
    const s = this.session();
    return s?.provider === 'BAILEYS' ? (s.state ?? 'stopped') : 'none';
  });

  protected chip = computed(() => {
    switch (this.state()) {
      case 'open': return { label: 'waSettings.state.open', cls: 'ws-chip-ok' };
      case 'pairing':
      case 'connecting':
      case 'reconnecting': return { label: 'waSettings.state.' + this.state(), cls: 'ws-chip-wait' };
      case 'logged_out':
      case 'replaced':
      case 'pairing_failed':
      case 'error': return { label: 'waSettings.state.' + this.state(), cls: 'ws-chip-bad' };
      default: return { label: 'waSettings.state.notLinked', cls: 'ws-chip-off' };
    }
  });

  protected countdown = computed(() => {
    const expires = this.session()?.pairingExpiresAt;
    if (!expires) return '—';
    const ms = Math.max(0, new Date(expires).getTime() - this.now());
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${m}:${s.toString().padStart(2, '0')}`;
  });

  private ticker: ReturnType<typeof setInterval> | null = null;
  private poller: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Live updates arrive as stream hints; refetch the session whenever one does.
    effect(() => {
      if (this.inbox.sessionVersion() > 0) this.refreshSession();
    });
  }

  ngOnInit(): void {
    this.load();
    this.ticker = setInterval(() => this.now.set(Date.now()), 1000);
    // Fallback while pairing, in case the stream is reconnecting at that moment.
    this.poller = setInterval(() => {
      if (PAIRING_STATES.has(this.state())) this.refreshSession();
    }, 2000);
  }

  ngOnDestroy(): void {
    if (this.ticker) clearInterval(this.ticker);
    if (this.poller) clearInterval(this.poller);
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      const s = await firstValueFrom(this.api.session());
      this.session.set(s);
      this.phoneInput.set(s.requestedPhone ?? s.linkedPhone ?? '');
      this.settings.set(await firstValueFrom(this.api.settings()));
      this.blocked.set(await firstValueFrom(this.api.blocked()));
    } catch {
      // No WhatsApp account yet: the connection card offers to link one.
      this.session.set({ accountId: '', provider: 'MOCK', botConfigured: true });
    } finally {
      this.loading.set(false);
    }
  }

  private refreshSession(): void {
    this.api.session().subscribe({
      next: s => {
        const wasOpen = this.session()?.state === 'open';
        this.session.set(s);
        if (!wasOpen && s.state === 'open') {
          this.toast.show(this.i18n.t('waSettings.linkedToast', { phone: formatPhone(s.linkedPhone) }));
          if (!this.settings()) this.api.settings().subscribe(st => this.settings.set(st));
        }
      },
      error: () => undefined
    });
  }

  async link(): Promise<void> {
    await this.run(async () => {
      await firstValueFrom(this.api.prepare(this.phoneInput().trim()));
      this.session.set(await firstValueFrom(this.api.link()));
      if (!this.settings()) this.settings.set(await firstValueFrom(this.api.settings()));
    });
  }

  async reconnect(): Promise<void> {
    await this.run(async () => this.session.set(await firstValueFrom(this.api.start())));
  }

  async unlink(): Promise<void> {
    const phone = formatPhone(this.session()?.linkedPhone);
    if (!confirm(this.i18n.t('waSettings.unlinkConfirm', { phone }))) return;
    await this.run(async () => this.session.set(await firstValueFrom(this.api.unlink())));
  }

  patch(change: Partial<WhatsAppSettings>): void {
    const current = this.settings();
    if (!current) return;
    this.settings.set({ ...current, ...change });
    this.dirty.set(true);
  }

  patchNumber(key: 'replyMinGapSeconds' | 'outreachMinGapSeconds' | 'outreachPerHour' | 'newChatsPerDay', value: unknown): void {
    const n = value === '' || value === null || value === undefined ? null : Number(value);
    this.patch({ [key]: Number.isFinite(n as number) ? n : null } as Partial<WhatsAppSettings>);
  }

  async saveSettings(): Promise<void> {
    const current = this.settings();
    if (!current) return;
    await this.run(async () => {
      this.settings.set(await firstValueFrom(this.api.saveSettings(current)));
      this.dirty.set(false);
      this.toast.show(this.i18n.t('waSettings.saved'));
    });
  }

  async unblock(b: BlockedNumber): Promise<void> {
    await this.run(async () => {
      await firstValueFrom(this.api.unblock(b.id));
      this.blocked.update(list => list.filter(x => x.id !== b.id));
    });
  }

  phone(p?: string): string {
    return formatPhone(p);
  }

  date(iso?: string): string {
    return iso ? new Date(iso).toLocaleDateString(this.i18n.currentLang(), { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  }

  private async run(action: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    try {
      await action();
    } catch (e) {
      const detail = (e as { detail?: string })?.detail;
      this.toast.show(detail || this.i18n.t('waSettings.error'), { type: 'error' });
    } finally {
      this.busy.set(false);
    }
  }
}
