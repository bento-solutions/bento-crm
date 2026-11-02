import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '../pipes/translate.pipe';
import { TranslationService } from '../services/translation.service';
import { ToastService } from '../services/toast.service';
import { CrmStateService } from '../services/crm-state.service';
import { PageHeaderComponent } from '../shared/ui/page-header.component';
import { ConfirmService } from '../shared/ui/confirm.service';
import { normaliseSender } from '../shared/documents.util';
import { InboundApi, InboundMailbox, InboundSettings } from '../services/domains/inbound.service';

/**
 * Settings → Inboxes: the two addresses suppliers and the bank send documents to, who may send
 * to them, whether confident invoices are booked without review, and whether documents sent on
 * WhatsApp go to the documents inbox too. Admins edit; finance readers can see the addresses.
 */
@Component({
  selector: 'app-settings-inboxes',
  imports: [FormsModule, MatIconModule, TranslatePipe, PageHeaderComponent],
  template: `
    <div class="page max-w-3xl">
      <app-page-header size="section" [title]="'inboxes.title' | translate" [subtitle]="'inboxes.subtitle' | translate" />

      @if (settings(); as s) {
        @if (s.aiEnabled) {
          <div class="alert alert-success">
            <mat-icon>document_scanner</mat-icon>
            <span>{{ 'inboxes.aiOn' | translate: { model: s.documentModel || '—' } }}</span>
          </div>
        } @else {
          <div class="alert alert-info">{{ 'inboxes.aiOff' | translate }}</div>
        }

        @for (m of s.mailboxes; track m.id) {
          <section class="card">
            <div class="card-header flex-wrap">
              <h3 class="card-title flex items-center gap-2">
                <mat-icon class="icon-sm text-ink-3">{{ m.kind === 'VENDOR_INVOICES' ? 'receipt_long' : 'account_balance' }}</mat-icon>
                {{ ('inboxes.kind.' + m.kind) | translate }}
              </h3>
              @if (!m.active) { <span class="badge badge-neutral">{{ 'inboxes.paused' | translate }}</span> }
            </div>
            <div class="card-body space-y-5">
              <div class="field">
                <span class="field-label">{{ 'inboxes.address' | translate }}</span>
                <div class="flex items-start gap-2 min-w-0">
                  <code class="code-block" dir="ltr">{{ m.address }}</code>
                  <button class="btn-secondary shrink-0" (click)="copy(m.address)"><mat-icon class="icon-sm">content_copy</mat-icon>{{ 'inboxes.copy' | translate }}</button>
                </div>
                <p class="field-hint">{{ ('inboxes.addressHint.' + m.kind) | translate }}</p>
              </div>

              <div class="field">
                <span class="field-label">{{ 'inboxes.trusted' | translate }}</span>
                <div class="flex flex-wrap gap-1.5">
                  @for (a of m.allowedSenders; track a) {
                    <span class="chip">{{ a }}
                      @if (canEdit()) {
                        <button type="button" class="inline-flex items-center text-ink-3 hover:text-ink" (click)="removeSender(m, a)" [attr.aria-label]="'inboxes.removeSender' | translate: { sender: a }">
                          <mat-icon class="icon-xs">close</mat-icon></button>
                      }
                    </span>
                  } @empty {
                    <span class="text-xs text-ink-3">{{ 'inboxes.anySender' | translate }}</span>
                  }
                </div>
                @if (canEdit()) {
                  <div class="flex gap-2">
                    <input class="input-field" [placeholder]="'inboxes.senderPlaceholder' | translate" [attr.aria-label]="'inboxes.trusted' | translate"
                           [(ngModel)]="drafts[m.id]" (keydown.enter)="addSender(m)" />
                    <button class="btn-secondary shrink-0" [disabled]="busy() || !drafts[m.id]" (click)="addSender(m)">{{ 'inboxes.add' | translate }}</button>
                  </div>
                }
                <p class="field-hint">{{ 'inboxes.trustedHint' | translate }}</p>
              </div>

              @if (m.kind === 'VENDOR_INVOICES') {
                <label class="switch-row" [for]="'inbox-autobook-' + m.id">
                  <button type="button" [id]="'inbox-autobook-' + m.id" role="switch" class="switch" [attr.aria-checked]="m.autoBook"
                          [disabled]="!canEdit() || busy()" [attr.aria-label]="'inboxes.autoBook' | translate"
                          (click)="save(m, { autoBook: !m.autoBook })"></button>
                  <span>
                    <span class="row-title">{{ 'inboxes.autoBook' | translate }}</span>
                    <span class="row-hint">{{ 'inboxes.autoBookHint' | translate }}</span>
                  </span>
                </label>
              }

              <label class="switch-row" [for]="'inbox-active-' + m.id">
                <button type="button" [id]="'inbox-active-' + m.id" role="switch" class="switch" [attr.aria-checked]="m.active"
                        [disabled]="!canEdit() || busy()" [attr.aria-label]="'inboxes.active' | translate"
                        (click)="save(m, { active: !m.active })"></button>
                <span>
                  <span class="row-title">{{ 'inboxes.active' | translate }}</span>
                  <span class="row-hint">{{ 'inboxes.activeHint' | translate }}</span>
                </span>
              </label>
            </div>
            @if (canEdit()) {
              <div class="card-footer flex-wrap justify-between">
                <span class="field-hint flex-1 basis-56">{{ 'inboxes.rotateHint' | translate }}</span>
                <button class="btn-danger-soft btn-sm" [disabled]="busy()" (click)="rotate(m)"><mat-icon class="icon-sm">autorenew</mat-icon>{{ 'inboxes.rotate' | translate }}</button>
              </div>
            }
          </section>
        }

        <section class="card">
          <div class="card-body">
            <label class="switch-row" for="inbox-whatsapp">
              <button type="button" id="inbox-whatsapp" role="switch" class="switch" [attr.aria-checked]="s.whatsappDocuments"
                      [disabled]="!canEdit() || busy()" [attr.aria-label]="'inboxes.whatsapp' | translate"
                      (click)="saveWhatsapp(!s.whatsappDocuments)"></button>
              <span>
                <span class="row-title">{{ 'inboxes.whatsapp' | translate }}</span>
                <span class="row-hint">{{ 'inboxes.whatsappHint' | translate }}</span>
              </span>
            </label>
          </div>
        </section>
        @if (!canEdit()) {
          <p class="field-hint">{{ 'inboxes.readOnly' | translate }}</p>
        }
      }
    </div>
  `,
})
export class SettingsInboxesComponent implements OnInit {
  private api = inject(InboundApi);
  private toast = inject(ToastService);
  private i18n = inject(TranslationService);
  private state = inject(CrmStateService);
  private confirm = inject(ConfirmService);

  settings = signal<InboundSettings | null>(null);
  busy = signal(false);
  drafts: Record<string, string> = {};

  canEdit(): boolean {
    return this.state.hasAuthority('ADMIN_ACCESS');
  }

  ngOnInit(): void {
    this.api.settings().subscribe({ next: s => this.settings.set(s), error: e => this.fail(e) });
  }

  copy(address: string): void {
    navigator.clipboard?.writeText(address).then(
      () => this.toast.show(this.i18n.t('inboxes.copied'), { type: 'success' }),
      () => this.toast.show(address, { type: 'info' }),
    );
  }

  addSender(m: InboundMailbox): void {
    const value = normaliseSender(this.drafts[m.id] ?? '');
    if (!value) {
      this.toast.show(this.i18n.t('inboxes.invalidSender'), { type: 'error' });
      return;
    }
    if (m.allowedSenders.includes(value)) {
      this.drafts[m.id] = '';
      return;
    }
    this.save(m, { allowedSenders: [...m.allowedSenders, value] }, () => { this.drafts[m.id] = ''; });
  }

  removeSender(m: InboundMailbox, sender: string): void {
    this.save(m, { allowedSenders: m.allowedSenders.filter(a => a !== sender) });
  }

  save(m: InboundMailbox, change: { allowedSenders?: string[]; autoBook?: boolean; active?: boolean }, after?: () => void): void {
    this.busy.set(true);
    this.api.updateMailbox(m.id, change).subscribe({
      next: updated => {
        this.busy.set(false);
        this.replace(updated);
        after?.();
        this.toast.show(this.i18n.t('inboxes.saved'), { type: 'success' });
      },
      error: e => this.fail(e),
    });
  }

  async rotate(m: InboundMailbox): Promise<void> {
    const ok = await this.confirm.ask({
      title: this.i18n.t('inboxes.rotateTitle'),
      message: this.i18n.t('inboxes.rotateText', { address: m.address }),
      confirmLabel: this.i18n.t('inboxes.rotate'), cancelLabel: this.i18n.t('inboxes.cancel'), danger: true,
    });
    if (!ok) return;
    this.busy.set(true);
    this.api.rotate(m.id).subscribe({
      next: updated => {
        this.busy.set(false);
        this.replace(updated);
        this.toast.show(this.i18n.t('inboxes.rotated'), { type: 'success' });
      },
      error: e => this.fail(e),
    });
  }

  saveWhatsapp(on: boolean): void {
    this.busy.set(true);
    this.api.saveSettings(on).subscribe({
      next: s => {
        this.busy.set(false);
        this.settings.set(s);
        this.toast.show(this.i18n.t('inboxes.saved'), { type: 'success' });
      },
      error: e => this.fail(e),
    });
  }

  private replace(m: InboundMailbox): void {
    this.settings.update(s => s ? { ...s, mailboxes: s.mailboxes.map(x => x.id === m.id ? m : x) } : s);
  }

  private fail(e: unknown): void {
    this.busy.set(false);
    const err = e as { error?: { detail?: string } };
    this.toast.show(err?.error?.detail || this.i18n.t('inboxes.error'), { type: 'error' });
  }
}
