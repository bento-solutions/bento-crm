import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { firstValueFrom } from 'rxjs';
import { TranslatePipe } from '../pipes/translate.pipe';
import { TranslationService } from '../services/translation.service';
import { ToastService } from '../services/toast.service';
import { CrmStateService } from '../services/crm-state.service';
import { ApiScope, ApiTokenView, ApiTokensApi } from '../services/domains/api-tokens.service';

interface ScopeOption {
  scope: ApiScope;
  /** Any of these authorities on the user's role makes the scope grantable. */
  needs: string[];
}

const SCOPES: ScopeOption[] = [
  { scope: 'whatsapp:read', needs: ['WHATSAPP_READ'] },
  { scope: 'whatsapp:draft', needs: ['WHATSAPP_DRAFT'] },
  { scope: 'whatsapp:send', needs: ['WHATSAPP_SEND'] },
  { scope: 'partners:read', needs: ['PARTNERS_READ'] },
];

/**
 * Settings → API tokens: personal tokens that let an AI agent (Claude, n8n, …) read the WhatsApp
 * inbox and propose or send messages as the person who created them, narrowed to chosen scopes.
 */
@Component({
  selector: 'app-settings-api-tokens',
  imports: [FormsModule, MatIconModule, TranslatePipe],
  styles: [`
    .tk-card { background: var(--color-surface); border: 1px solid var(--color-border); }
    .tk-muted { color: var(--color-text-secondary); }
    .tk-faint { color: var(--color-text-tertiary); }
    .tk-input { background: var(--color-bg); border: 1px solid var(--color-border); color: var(--color-text-primary); }
    .tk-btn { border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text-primary); }
    .tk-btn-primary { background: var(--color-text-primary); color: var(--color-surface); }
    .tk-btn-primary:disabled { opacity: .5; cursor: not-allowed; }
    .tk-danger { color: var(--color-danger); }
    .tk-secret { background: var(--color-success-light); border: 1px solid var(--color-success); }
    .tk-code { background: var(--color-bg); border: 1px solid var(--color-border); font-family: var(--font-mono); }
    .tk-option { border: 1px solid var(--color-border); }
    .tk-option:has(input:checked) { border-color: var(--color-accent); background: var(--color-accent-light); }
    .tk-row { border-top: 1px solid var(--color-border-light); }
  `],
  template: `
    <div class="space-y-6 max-w-3xl">
      <section class="tk-card rounded-2xl p-6 space-y-4">
        <div>
          <h2 class="text-base font-bold">{{ 'tokens.title' | translate }}</h2>
          <p class="text-sm tk-muted mt-1">{{ 'tokens.subtitle' | translate }}</p>
        </div>

        @if (created(); as c) {
          <div class="tk-secret rounded-xl p-4 space-y-3" role="alert">
            <p class="text-sm font-semibold">{{ 'tokens.copyNow' | translate }}</p>
            <div class="flex gap-2 items-center">
              <code class="tk-code flex-1 rounded-lg px-3 py-2 text-xs break-all" dir="ltr">{{ c.token }}</code>
              <button type="button" class="tk-btn text-xs font-semibold px-3 py-2 rounded-lg inline-flex items-center gap-1" (click)="copy(c.token, 'token')">
                <mat-icon class="!text-[14px] !w-3.5 !h-3.5">content_copy</mat-icon>{{ (copied() === 'token' ? 'tokens.copied' : 'tokens.copy') | translate }}
              </button>
            </div>
            <div>
              <p class="text-xs font-semibold mb-1">{{ 'tokens.claudeCode' | translate }}</p>
              <div class="flex gap-2 items-start">
                <code class="tk-code flex-1 rounded-lg px-3 py-2 text-xs break-all" dir="ltr">{{ claudeCommand(c.token) }}</code>
                <button type="button" class="tk-btn text-xs px-2 py-2 rounded-lg" (click)="copy(claudeCommand(c.token), 'claude')" [attr.aria-label]="'tokens.copy' | translate">
                  <mat-icon class="!text-[14px] !w-3.5 !h-3.5">{{ copied() === 'claude' ? 'check' : 'content_copy' }}</mat-icon>
                </button>
              </div>
            </div>
            <div>
              <p class="text-xs font-semibold mb-1">{{ 'tokens.claudeDesktop' | translate }}</p>
              <div class="flex gap-2 items-start">
                <code class="tk-code flex-1 rounded-lg px-3 py-2 text-xs break-all" dir="ltr">{{ desktopCommand() }}</code>
                <button type="button" class="tk-btn text-xs px-2 py-2 rounded-lg" (click)="copy(desktopCommand(), 'desktop')" [attr.aria-label]="'tokens.copy' | translate">
                  <mat-icon class="!text-[14px] !w-3.5 !h-3.5">{{ copied() === 'desktop' ? 'check' : 'content_copy' }}</mat-icon>
                </button>
              </div>
              <p class="text-xs tk-muted mt-1">{{ 'tokens.desktopHint' | translate }}</p>
            </div>
            <button type="button" class="tk-btn text-xs px-3 py-1.5 rounded-lg" (click)="created.set(null)">{{ 'tokens.done' | translate }}</button>
          </div>
        }

        @if (creating()) {
          <div class="space-y-4 pt-2">
            <label class="block max-w-sm">
              <span class="text-xs font-semibold tk-muted">{{ 'tokens.name' | translate }}</span>
              <input class="tk-input w-full rounded-lg px-3 py-2 mt-1 text-sm" [placeholder]="'tokens.namePlaceholder' | translate"
                     [ngModel]="name()" (ngModelChange)="name.set($event)" maxlength="100" />
            </label>
            <fieldset class="space-y-2">
              <legend class="text-xs font-semibold tk-muted mb-1">{{ 'tokens.scopes' | translate }}</legend>
              @for (opt of grantable(); track opt.scope) {
                <label class="tk-option flex items-start gap-3 rounded-xl px-3 py-2 cursor-pointer">
                  <input type="checkbox" class="mt-1" [checked]="scopes().has(opt.scope)" (change)="toggleScope(opt.scope)" />
                  <span>
                    <span class="text-sm font-semibold block"><code dir="ltr">{{ opt.scope }}</code></span>
                    <span class="text-xs tk-muted">{{ ('tokens.scope.' + opt.scope) | translate }}</span>
                  </span>
                </label>
              }
            </fieldset>
            @if (scopes().has('whatsapp:send')) {
              <p class="text-xs rounded-lg px-3 py-2" style="background: var(--color-warning-light)">{{ 'tokens.sendWarning' | translate }}</p>
            }
            <div class="grid gap-3 sm:grid-cols-2 max-w-lg">
              <label>
                <span class="text-xs font-semibold tk-muted">{{ 'tokens.expiry' | translate }}</span>
                <select class="tk-input w-full rounded-lg px-3 py-2 mt-1 text-sm" [ngModel]="expiry()" (ngModelChange)="expiry.set(+$event)">
                  @for (d of [30, 90, 365]; track d) {
                    <option [value]="d">{{ 'tokens.days' | translate: { n: d } }}</option>
                  }
                </select>
              </label>
              <label>
                <span class="text-xs font-semibold tk-muted">{{ 'tokens.cap' | translate }}</span>
                <input type="number" min="1" max="200" class="tk-input w-full rounded-lg px-3 py-2 mt-1 text-sm"
                       [ngModel]="cap()" (ngModelChange)="cap.set(+$event)" />
              </label>
            </div>
            <div class="flex gap-2">
              <button type="button" class="tk-btn-primary text-sm font-semibold px-4 py-2 rounded-lg"
                      [disabled]="busy() || !name().trim() || scopes().size === 0" (click)="create()">
                {{ 'tokens.create' | translate }}
              </button>
              <button type="button" class="tk-btn text-sm px-4 py-2 rounded-lg" (click)="creating.set(false)">{{ 'inbox.cancel' | translate }}</button>
            </div>
          </div>
        } @else if (!created()) {
          <button type="button" class="tk-btn-primary text-sm font-semibold px-4 py-2 rounded-lg" (click)="startCreate()">
            {{ 'tokens.new' | translate }}
          </button>
        }
      </section>

      <section class="tk-card rounded-2xl p-6">
        <h3 class="text-sm font-bold mb-2">{{ 'tokens.yours' | translate }}</h3>
        @for (t of tokens(); track t.id) {
          <div class="tk-row flex flex-wrap items-center justify-between gap-2 py-3">
            <div class="min-w-0">
              <p class="text-sm font-semibold">{{ t.name }} <code class="text-xs tk-faint" dir="ltr">{{ t.tokenPrefix }}…</code></p>
              <p class="text-xs tk-muted">{{ t.scopes.join(', ') }} · {{ 'tokens.capShort' | translate: { n: t.maxSendsPerHour ?? 20 } }}</p>
              <p class="text-xs tk-faint">
                @if (t.revokedAt) {
                  <span class="tk-danger">{{ 'tokens.revoked' | translate }}</span>
                } @else if (expired(t)) {
                  <span class="tk-danger">{{ 'tokens.expired' | translate }}</span>
                } @else {
                  {{ 'tokens.expires' | translate: { date: date(t.expiresAt) } }}
                }
                · {{ t.lastUsedAt ? ('tokens.lastUsed' | translate: { date: date(t.lastUsedAt) }) : ('tokens.neverUsed' | translate) }}
              </p>
            </div>
            @if (!t.revokedAt) {
              <button type="button" class="tk-btn tk-danger text-xs font-semibold px-3 py-1.5 rounded-lg" (click)="revoke(t)">{{ 'tokens.revoke' | translate }}</button>
            }
          </div>
        } @empty {
          <p class="text-xs tk-faint">{{ 'tokens.none' | translate }}</p>
        }
      </section>
    </div>
  `
})
export class SettingsApiTokensComponent implements OnInit {
  private api = inject(ApiTokensApi);
  private state = inject(CrmStateService);
  private i18n = inject(TranslationService);
  private toast = inject(ToastService);

  protected tokens = signal<ApiTokenView[]>([]);
  protected created = signal<{ token: string } | null>(null);
  protected creating = signal(false);
  protected busy = signal(false);
  protected copied = signal<string | null>(null);
  protected name = signal('');
  protected scopes = signal(new Set<ApiScope>(['whatsapp:read', 'whatsapp:draft']));
  protected expiry = signal(90);
  protected cap = signal(20);

  protected grantable = computed(() =>
    SCOPES.filter(s => s.needs.some(a => this.state.hasAuthority(a))));

  ngOnInit(): void {
    this.reload();
  }

  private reload(): void {
    this.api.list().subscribe({ next: list => this.tokens.set(list), error: () => undefined });
  }

  startCreate(): void {
    this.name.set('');
    this.scopes.set(new Set<ApiScope>(['whatsapp:read', 'whatsapp:draft'].filter(s =>
      this.grantable().some(g => g.scope === s)) as ApiScope[]));
    this.creating.set(true);
  }

  toggleScope(scope: ApiScope): void {
    const next = new Set(this.scopes());
    if (next.has(scope)) next.delete(scope); else next.add(scope);
    this.scopes.set(next);
  }

  async create(): Promise<void> {
    this.busy.set(true);
    try {
      const result = await firstValueFrom(this.api.create(this.name().trim(), [...this.scopes()], this.expiry(), this.cap()));
      this.created.set({ token: result.token });
      this.creating.set(false);
      this.reload();
    } catch (e) {
      this.toast.show((e as { detail?: string })?.detail || this.i18n.t('waSettings.error'), { type: 'error' });
    } finally {
      this.busy.set(false);
    }
  }

  async revoke(t: ApiTokenView): Promise<void> {
    if (!confirm(this.i18n.t('tokens.revokeConfirm', { name: t.name }))) return;
    try {
      await firstValueFrom(this.api.revoke(t.id));
      this.reload();
    } catch (e) {
      this.toast.show((e as { detail?: string })?.detail || this.i18n.t('waSettings.error'), { type: 'error' });
    }
  }

  claudeCommand(token: string): string {
    return `claude mcp add --transport http bento ${this.api.mcpUrl()} --header "Authorization: Bearer ${token}"`;
  }

  desktopCommand(): string {
    return `npx mcp-remote ${this.api.mcpUrl()} --header "Authorization: Bearer \${BENTO_TOKEN}"`;
  }

  copy(text: string, key: string): void {
    navigator.clipboard.writeText(text).then(() => {
      this.copied.set(key);
      setTimeout(() => { if (this.copied() === key) this.copied.set(null); }, 2000);
    });
  }

  expired(t: ApiTokenView): boolean {
    return !!t.expiresAt && new Date(t.expiresAt).getTime() < Date.now();
  }

  date(iso?: string): string {
    return iso ? new Date(iso).toLocaleDateString(this.i18n.currentLang(), { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
  }
}
