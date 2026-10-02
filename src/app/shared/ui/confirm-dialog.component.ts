import { ChangeDetectionStrategy, Component, ElementRef, effect, inject, viewChild } from '@angular/core';
import { ConfirmService } from './confirm.service';

/** Mounted once in the app shell; shows whatever ConfirmService.ask() is waiting on. */
@Component({
  selector: 'app-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'cancel()' },
  template: `
    @if (confirm.request(); as req) {
      <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events,@angular-eslint/template/interactive-supports-focus -->
      <div class="modal-backdrop" (click)="cancel()">
        <div class="modal modal-sm" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title"
             [attr.aria-describedby]="req.message ? 'confirm-message' : null" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3 class="modal-title" id="confirm-title">{{ req.title }}</h3>
          </div>
          @if (req.message) {
            <p class="text-sm text-ink-2" id="confirm-message">{{ req.message }}</p>
          }
          <div class="modal-footer">
            <button type="button" class="btn-secondary" (click)="cancel()">{{ req.cancelLabel || 'Cancel' }}</button>
            <button #confirmButton type="button" [class]="req.danger ? 'btn-danger' : 'btn-primary'" (click)="accept()">
              {{ req.confirmLabel || (req.danger ? 'Delete' : 'Confirm') }}
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class ConfirmDialogComponent {
  protected confirm = inject(ConfirmService);
  private confirmButton = viewChild<ElementRef<HTMLButtonElement>>('confirmButton');

  constructor() {
    // Move focus into the dialog so Enter confirms and Tab stays inside it.
    effect(() => {
      const button = this.confirmButton();
      if (button) queueMicrotask(() => button.nativeElement.focus());
    });
  }

  protected accept(): void {
    this.confirm.answer(true);
  }

  protected cancel(): void {
    if (this.confirm.request()) this.confirm.answer(false);
  }
}
