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
import { PageHeaderComponent } from '../shared/ui/page-header.component';
import { ConfirmService } from '../shared/ui/confirm.service';

const PAIRING_STATES = new Set(['pairing', 'connecting']);

/**
 * Settings → WhatsApp: link the organization's number as a device (pairing code typed on the
 * phone), watch its state live, and choose how the inbox treats new numbers, who sees what, and
 * how fast outreach may go.
 */
@Component({
  selector: 'app-settings-whatsapp',
  imports: [FormsModule, MatIconModule, TranslatePipe, UserPickerComponent, PageHeaderComponent],
  template: `
    <div class="page max-w-3xl">
      <app-page-header size="section" [title]="'waSettings.title' | translate" [subtitle]="'waSettings.subtitle' | translate">
        @if (chip(); as c) {
          <span meta class="badge" [class]="c.cls">{{ c.label | translate }}</span>
        }
      </app-page-header>

      @if (session(); as s) {
        @if (!s.botConfigured) {
          <p class="alert alert-warning">
            <mat-icon class="shrink-0">warning</mat-icon>{{ 'waSettings.botMissing' | translate }}
          </p>
        }
      }

      <!-- Connection -->
      <section class="card p-5 space-y-5">
        @if (loading()) {
          <p class="text-sm text-ink-3">{{ 'inbox.loading' | translate }}</p>
        } @else if (state() === 'open') {
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p class="text-lg font-semibold" dir="ltr">{{ phone(session()?.linkedPhone) }}</p>
              @if (session()?.linkedAt) {
                <p class="text-xs text-ink-2">{{ 'waSettings.linkedSince' | translate: { date: date(session()?.linkedAt) } }}</p>
              }
            </div>
            <button type="button" class="btn-danger-soft" [disabled]="busy()" (click)="unlink()">
              {{ 'waSettings.unlink' | translate }}
            </button>
          </div>
        } @else if (state() === 'pairing' && session()?.pairingCode) {
          <div class="grid gap-4 sm:grid-cols-2 items-start">
            <div class="rounded-xl border border-dashed border-line-strong bg-subtle p-5 text-center">
              <p class="text-xs text-ink-2 mb-2">{{ 'waSettings.codeFor' | translate: { phone: phone(session()?.requestedPhone) } }}</p>
              <p class="text-3xl font-mono font-semibold tracking-[0.25em]" dir="ltr" aria-live="polite">{{ session()?.pairingCode }}</p>
              <p class="text-xs text-ink-2 mt-3">
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
          <p class="text-xs text-ink-3">{{ 'waSettings.pairingHint' | translate }}</p>
        } @else if (state() === 'connecting' || state() === 'reconnecting' || (state() === 'pairing' && !session()?.pairingCode)) {
          <p class="text-sm text-ink-2 flex items-center gap-2">
            <mat-icon class="animate-spin">progress_activity</mat-icon>{{ 'waSettings.connecting' | translate }}
          </p>
        } @else {
          @if (state() === 'replaced') {
            <p class="alert alert-warning">{{ 'waSettings.replacedHelp' | translate }}</p>
          } @else if (state() === 'logged_out') {
            <p class="alert alert-warning">{{ 'waSettings.loggedOutHelp' | translate }}</p>
          } @else if (state() === 'pairing_failed') {
            <p class="alert alert-warning">{{ 'waSettings.pairingFailedHelp' | translate }}</p>
          }
          @if (session()?.error && state() !== 'stopped') {
            <p class="text-xs text-danger-ink">{{ session()?.error }}</p>
          }
          <div class="flex flex-wrap items-end gap-3">
            <label class="flex-1 min-w-[220px]">
              <span class="field-label">{{ 'waSettings.phoneLabel' | translate }}</span>
              <input type="tel" dir="ltr" class="input-field w-full mt-1" placeholder="+212 6 12 34 56 78"
                     [ngModel]="phoneInput()" (ngModelChange)="phoneInput.set($event)" autocomplete="tel" />
            </label>
            <button type="button" class="btn-primary"
                    [disabled]="busy() || !phoneInput().trim() || !session()?.botConfigured" (click)="link()">
              {{ 'waSettings.getCode' | translate }}
            </button>
            @if (state() === 'replaced' || (state() === 'stopped' && session()?.linkedPhone)) {
              <button type="button" class="btn-secondary" [disabled]="busy()" (click)="reconnect()">
                {{ 'waSettings.reconnect' | translate }}
              </button>
            }
          </div>
          <p class="text-xs text-ink-3">{{ 'waSettings.linkHint' | translate }}</p>
        }
      </section>

      <!-- Leads & visibility -->
      @if (settings(); as st) {
        <section class="card p-5 space-y-5">
          <h2 class="card-title">{{ 'waSettings.leadsTitle' | translate }}</h2>
          <fieldset class="space-y-2">
            <legend class="text-sm font-semibold mb-2">{{ 'waSettings.autoLeads' | translate }}</legend>
            @for (opt of autoOptions; track opt) {
              <label class="choice-row">
                <input type="radio" name="autoLeads" class="mt-1" [value]="opt" [ngModel]="st.autoCreateLeads"
                       (ngModelChange)="patch({ autoCreateLeads: $event })" />
                <span>
                  <span class="text-sm font-semibold block">{{ ('waSettings.auto.' + opt) | translate }}</span>
                  <span class="text-xs text-ink-2">{{ ('waSettings.auto.' + opt + '.hint') | translate }}</span>
                </span>
              </label>
            }
          </fieldset>
          <fieldset class="space-y-2">
            <legend class="text-sm font-semibold mb-2">{{ 'waSettings.visibility' | translate }}</legend>
            @for (opt of visibilityOptions; track opt) {
              <label class="choice-row">
                <input type="radio" name="visibility" class="mt-1" [value]="opt" [ngModel]="st.visibility"
                       (ngModelChange)="patch({ visibility: $event })" />
                <span>
                  <span class="text-sm font-semibold block">{{ ('waSettings.visibility.' + opt) | translate }}</span>
                  <span class="text-xs text-ink-2">{{ ('waSettings.visibility.' + opt + '.hint') | translate }}</span>
                </span>
              </label>
            }
          </fieldset>
          <div class="max-w-sm">
            <span class="text-sm font-semibold">{{ 'waSettings.defaultAssignee' | translate }}</span>
            <p class="text-xs text-ink-2 mb-2">{{ 'waSettings.defaultAssigneeHint' | translate }}</p>
            <app-user-picker [value]="st.defaultAssigneeUserId ?? ''" (valueChange)="patch({ defaultAssigneeUserId: $event || null })" />
          </div>

          <details class="pt-2">
            <summary class="text-sm font-semibold cursor-pointer">{{ 'waSettings.limits' | translate }}</summary>
            <p class="text-xs text-ink-2 mt-2 mb-3">{{ 'waSettings.limitsHint' | translate }}</p>
            <div class="grid gap-3 sm:grid-cols-2">
              @for (f of limitFields; track f.key) {
                <label>
                  <span class="field-label">{{ f.label | translate }}</span>
                  <input type="number" min="0" class="input-field w-full mt-1" [placeholder]="f.placeholder"
                         [ngModel]="st[f.key]" (ngModelChange)="patchNumber(f.key, $event)" />
                </label>
              }
            </div>
          </details>

          <div class="flex justify-end">
            <button type="button" class="btn-primary" [disabled]="busy() || !dirty()" (click)="saveSettings()">
              {{ 'waSettings.save' | translate }}
            </button>
          </div>
        </section>
      }

      <!-- Ignored numbers -->
      <section class="card p-5 space-y-3">
        <h2 class="card-title">{{ 'waSettings.ignoredTitle' | translate }}</h2>
        <p class="text-sm text-ink-2">{{ 'waSettings.ignoredHint' | translate }}</p>
        @for (b of blocked(); track b.id) {
          <div class="flex items-center justify-between py-2 border-t border-line-soft">
            <span class="text-sm" dir="ltr">{{ phone(b.phone) }}</span>
            <button type="button" class="btn-secondary btn-sm" (click)="unblock(b)">{{ 'waSettings.stopIgnoring' | translate }}</button>
          </div>
        } @empty {
          <p class="text-xs text-ink-3">{{ 'waSettings.noIgnored' | translate }}</p>
        }
      </section>
    </div>
  `
})
export class SettingsWhatsAppComponent implements OnInit, OnDestroy {
  private confirmDialog = inject(ConfirmService);
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
      case 'open': return { label: 'waSettings.state.open', cls: 'badge-success' };
      case 'pairing':
      case 'connecting':
      case 'reconnecting': return { label: 'waSettings.state.' + this.state(), cls: 'badge-warning' };
      case 'logged_out':
      case 'replaced':
      case 'pairing_failed':
      case 'error': return { label: 'waSettings.state.' + this.state(), cls: 'badge-danger' };
      default: return { label: 'waSettings.state.notLinked', cls: 'badge-neutral' };
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
    if (!(await this.confirmDialog.ask({ title: this.i18n.t('waSettings.unlink'), message: this.i18n.t('waSettings.unlinkConfirm', { phone }), danger: true, confirmLabel: this.i18n.t('waSettings.unlink') }))) return;
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
