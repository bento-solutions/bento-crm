import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { TranslationService } from '../../services/translation.service';
import { ToastService } from '../../services/toast.service';
import { CrmStateService } from '../../services/crm-state.service';
import { ConfirmService } from '../../shared/ui/confirm.service';
import { ClientPortalApi, PortalAccount, PortalInvited } from '../../services/domains/client-portal.service';
import { shortDate } from '../../shared/bank.util';
import { errorDetail } from '../bank/bank-labels';

/**
 * Who at a client company can sign in to the client portal: invite someone (the link is shown
 * once, to copy into WhatsApp too), turn access off and on, rename or remove.
 */
@Component({
  selector: 'app-client-portal-access',
  host: { '(document:keydown.escape)': 'onEscape()' },
  imports: [FormsModule, MatIconModule, TranslatePipe],
  template: `
    <section class="card p-5 space-y-4">
      <div class="flex items-center justify-between gap-2 pb-3 border-b border-line-soft">
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="icon-chip"><mat-icon class="icon-md">key</mat-icon></div>
          <div class="min-w-0">
            <h3 class="card-title truncate">{{ 'portalAccess.title' | translate }}</h3>
            <p class="text-xs text-ink-3">{{ 'portalAccess.subtitle' | translate }}</p>
          </div>
        </div>
        @if (canWrite()) {
          <button class="btn-secondary btn-sm shrink-0" (click)="openInvite()"><mat-icon>person_add</mat-icon>{{ 'portalAccess.invite' | translate }}</button>
        }
      </div>

      @if (invited(); as inv) {
        <div class="alert alert-success text-sm space-y-2" role="status">
          <div>{{ (inv.emailed ? 'portalAccess.invitedEmailed' : 'portalAccess.invitedNotEmailed') | translate: { email: inv.account.email } }}</div>
          <div class="flex items-center gap-2 min-w-0">
            <input class="input-field input-sm flex-1 min-w-0 font-mono" readonly [value]="inv.inviteUrl" [attr.aria-label]="'portalAccess.inviteLink' | translate" />
            <button class="btn-secondary btn-sm shrink-0" (click)="copy(inv.inviteUrl)"><mat-icon>content_copy</mat-icon>{{ 'portalAccess.copy' | translate }}</button>
            <button class="btn-icon btn-sm shrink-0" (click)="invited.set(null)" [attr.aria-label]="'bank.close' | translate"><mat-icon class="icon-sm">close</mat-icon></button>
          </div>
        </div>
      }
      @if (failed()) { <p class="text-sm text-ink-3">{{ 'portalAccess.loadFailed' | translate }}</p> }

      <div class="divide-y divide-line">
        @for (a of accounts(); track a.id) {
          <div class="py-2 flex flex-wrap items-center gap-2">
            <!-- Full width on phones so the name and email stay readable; status and actions go below. -->
            <div class="min-w-0 w-full sm:w-auto sm:flex-1">
              @if (renaming()?.id === a.id) {
                <div class="flex items-center gap-2">
                  <input class="input-field input-sm flex-1 min-w-0" maxlength="120" [(ngModel)]="renameValue" (keyup.enter)="saveRename(a)" [attr.aria-label]="'portalAccess.displayName' | translate" />
                  <button class="btn-primary btn-sm" [disabled]="busy()" (click)="saveRename(a)">{{ 'bank.save' | translate }}</button>
                  <button class="btn-ghost btn-sm" (click)="renaming.set(null)">{{ 'bank.cancel' | translate }}</button>
                </div>
              } @else {
                <div class="text-sm text-ink truncate">{{ a.displayName || a.email }}</div>
                <div class="text-xs text-ink-3 truncate">
                  @if (a.displayName) { {{ a.email }} · }
                  @if (a.invitePending) { {{ 'portalAccess.pendingUntil' | translate: { date: date(a.inviteExpiresAt) } }} }
                  @else if (a.lastLoginAt) { {{ 'portalAccess.lastLogin' | translate: { date: date(a.lastLoginAt) } }} }
                  @else { {{ 'portalAccess.neverSignedIn' | translate }} }
                </div>
              }
            </div>
            <span class="badge shrink-0" [class]="!a.active ? 'badge-neutral' : a.invitePending ? 'badge-warning' : 'badge-success'">
              {{ (!a.active ? 'portalAccess.inactive' : a.invitePending ? 'portalAccess.pending' : 'portalAccess.active') | translate }}
            </span>
            @if (canWrite() && renaming()?.id !== a.id) {
              <div class="flex flex-wrap gap-1 shrink-0">
                @if (a.invitePending) {
                  <button class="btn-ghost btn-sm" [disabled]="busy()" (click)="resend(a)">{{ 'portalAccess.resend' | translate }}</button>
                }
                <button class="btn-ghost btn-sm" [disabled]="busy()" (click)="toggle(a)">{{ (a.active ? 'portalAccess.deactivate' : 'portalAccess.activate') | translate }}</button>
                <button class="btn-ghost btn-sm" (click)="startRename(a)">{{ 'portalAccess.rename' | translate }}</button>
                <button class="btn-ghost btn-sm" [disabled]="busy()" (click)="remove(a)">{{ 'bank.delete' | translate }}</button>
              </div>
            }
          </div>
        } @empty {
          @if (!failed()) { <p class="text-sm text-ink-3 py-2">{{ 'portalAccess.none' | translate }}</p> }
        }
      </div>
    </section>

    @if (inviteForm(); as f) {
      <div class="modal-backdrop">
        <div class="modal modal-md" role="dialog" aria-modal="true" aria-labelledby="portal-invite-title">
          <div class="modal-header">
            <h3 id="portal-invite-title" class="modal-title">{{ 'portalAccess.inviteTitle' | translate }}</h3>
            <button class="btn-icon btn-sm" (click)="inviteForm.set(null)" [attr.aria-label]="'bank.cancel' | translate"><mat-icon class="icon-sm">close</mat-icon></button>
          </div>
          <fieldset class="space-y-3" [disabled]="busy()">
            <label class="block"><span class="field-label">{{ 'portalAccess.email' | translate }}</span>
              <input class="input-field" type="email" maxlength="200" [(ngModel)]="f.email" /></label>
            <label class="block"><span class="field-label">{{ 'portalAccess.displayName' | translate }}</span>
              <input class="input-field" maxlength="120" [(ngModel)]="f.displayName" /></label>
            <p class="text-xs text-ink-3">{{ 'portalAccess.inviteHint' | translate }}</p>
          </fieldset>
          <div class="modal-footer">
            <button class="btn-secondary" (click)="inviteForm.set(null)">{{ 'bank.cancel' | translate }}</button>
            <button class="btn-primary" [disabled]="busy() || !validEmail(f.email)" (click)="invite(f.email, f.displayName)">{{ 'portalAccess.sendInvite' | translate }}</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ClientPortalAccessComponent {
  private api = inject(ClientPortalApi);
  private toast = inject(ToastService);
  private i18n = inject(TranslationService);
  private state = inject(CrmStateService);
  private confirm = inject(ConfirmService);

  partnerId = input.required<string>();

  accounts = signal<PortalAccount[]>([]);
  failed = signal(false);
  busy = signal(false);
  invited = signal<PortalInvited | null>(null);
  inviteForm = signal<{ email: string; displayName: string } | null>(null);
  renaming = signal<PortalAccount | null>(null);
  renameValue = '';

  constructor() {
    effect(() => {
      const id = this.partnerId();
      untracked(() => { if (id) this.load(); });
    });
  }

  canWrite(): boolean { return this.state.hasAuthority('PARTNERS_WRITE'); }

  load(): void {
    this.api.accounts(this.partnerId()).subscribe({
      next: a => { this.accounts.set(a ?? []); this.failed.set(false); },
      error: () => this.failed.set(true),
    });
  }

  openInvite(): void {
    this.inviteForm.set({ email: '', displayName: '' });
  }

  validEmail(v: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((v ?? '').trim());
  }

  invite(email: string, displayName?: string | null): void {
    this.busy.set(true);
    this.api.invite(this.partnerId(), email.trim(), displayName?.trim() || null).subscribe({
      next: res => {
        this.busy.set(false);
        this.inviteForm.set(null);
        this.invited.set(res);
        this.load();
      },
      error: e => this.fail(e),
    });
  }

  /** Inviting the same email again sends a fresh link. */
  resend(a: PortalAccount): void {
    this.invite(a.email, a.displayName);
  }

  toggle(a: PortalAccount): void {
    this.patch(a, { active: !a.active }, a.active ? 'portalAccess.deactivated' : 'portalAccess.activated');
  }

  startRename(a: PortalAccount): void {
    this.renameValue = a.displayName ?? '';
    this.renaming.set(a);
  }

  saveRename(a: PortalAccount): void {
    this.patch(a, { displayName: this.renameValue.trim() }, 'portalAccess.renamed', () => this.renaming.set(null));
  }

  async remove(a: PortalAccount): Promise<void> {
    if (!(await this.confirm.ask({
      title: this.i18n.t('portalAccess.confirmRemove', { email: a.email }),
      message: this.i18n.t('portalAccess.confirmRemoveText'),
      danger: true,
    }))) return;
    this.busy.set(true);
    this.api.remove(a.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.toast.show(this.i18n.t('portalAccess.removed'), { type: 'success' });
        this.load();
      },
      error: e => this.fail(e),
    });
  }

  copy(url: string): void {
    navigator.clipboard?.writeText(url).then(
      () => this.toast.show(this.i18n.t('portalAccess.copied'), { type: 'success' }),
      () => this.toast.show(this.i18n.t('portalAccess.copyFailed'), { type: 'error' }),
    );
  }

  onEscape(): void {
    if (this.busy()) return;
    if (this.inviteForm()) this.inviteForm.set(null);
    else if (this.renaming()) this.renaming.set(null);
  }

  date(iso: string | null | undefined): string { return shortDate(iso); }

  private patch(a: PortalAccount, body: { active?: boolean; displayName?: string | null }, messageKey: string, after?: () => void): void {
    this.busy.set(true);
    this.api.update(a.id, body).subscribe({
      next: () => {
        this.busy.set(false);
        after?.();
        this.toast.show(this.i18n.t(messageKey), { type: 'success' });
        this.load();
      },
      error: e => this.fail(e),
    });
  }

  private fail(e: unknown): void {
    this.busy.set(false);
    this.toast.show(errorDetail(e) || this.i18n.t('bank.error'), { type: 'error' });
  }
}
