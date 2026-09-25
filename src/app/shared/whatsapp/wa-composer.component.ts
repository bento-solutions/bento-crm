import { Component, ElementRef, input, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '../../pipes/translate.pipe';

/** Message box: Enter sends, Shift+Enter adds a line. Shows why sending is blocked when it is. */
@Component({
  selector: 'app-wa-composer',
  imports: [FormsModule, MatIconModule, TranslatePipe],
  styles: [`
    :host { display: block; background: var(--color-surface); border-top: 1px solid var(--color-border); }
    textarea { background: var(--color-bg); border: 1px solid var(--color-border); color: var(--color-text-primary); }
    textarea:focus { outline: 2px solid var(--color-accent); outline-offset: -1px; }
    .wa-send { background: var(--color-success); color: #fff; }
    .wa-send:disabled { background: var(--color-surface-active); color: var(--color-text-tertiary); }
    .wa-note { color: var(--color-text-secondary); background: var(--color-warning-light); }
  `],
  template: `
    @if (blockedReason(); as reason) {
      <p class="wa-note text-xs px-4 py-2 flex items-center gap-2">
        <mat-icon class="!text-[16px] !w-4 !h-4 shrink-0">info</mat-icon>{{ reason | translate }}
      </p>
    }
    @if (canSend()) {
      <div class="flex items-end gap-2 p-3">
        <textarea
          #box
          rows="1"
          dir="auto"
          class="flex-1 resize-none rounded-2xl px-4 py-2.5 text-sm max-h-40"
          [placeholder]="'inbox.composer.placeholder' | translate"
          [attr.aria-label]="'inbox.composer.placeholder' | translate"
          [ngModel]="text()"
          (ngModelChange)="text.set($event); grow()"
          (keydown.enter)="onEnter($any($event))"
          [disabled]="sending()"
        ></textarea>
        <button
          type="button"
          class="wa-send h-10 w-10 rounded-full flex items-center justify-center shrink-0"
          [disabled]="!text().trim() || sending()"
          [attr.aria-label]="'inbox.composer.send' | translate"
          [title]="'inbox.composer.send' | translate"
          (click)="submit()"
        >
          <mat-icon class="rtl:-scale-x-100">send</mat-icon>
        </button>
      </div>
    } @else if (!blockedReason()) {
      <p class="text-xs px-4 py-3" style="color: var(--color-text-tertiary)">{{ 'inbox.composer.readOnly' | translate }}</p>
    }
  `
})
export class WaComposerComponent {
  canSend = input(true);
  sending = input(false);
  /** i18n key explaining why a reply is impossible or restricted, or null. */
  blockedReason = input<string | null>(null);
  send = output<string>();

  protected text = signal('');
  private box = viewChild<ElementRef<HTMLTextAreaElement>>('box');

  onEnter(event: KeyboardEvent): void {
    if (event.shiftKey || event.isComposing) return;
    event.preventDefault();
    this.submit();
  }

  submit(): void {
    const value = this.text().trim();
    if (!value || this.sending()) return;
    this.send.emit(value);
    this.text.set('');
    queueMicrotask(() => this.grow());
  }

  grow(): void {
    const el = this.box()?.nativeElement;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }
}
