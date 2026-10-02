import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Destructive actions render the confirm button in the danger style. */
  danger?: boolean;
}

interface ConfirmRequest extends ConfirmOptions {
  resolve: (confirmed: boolean) => void;
}

/**
 * Promise-based replacement for window.confirm(): `if (await confirm.ask({ title: 'Delete deal?', danger: true })) …`.
 * Rendered once by <app-confirm-dialog> in the app shell, so every confirmation looks and behaves the same.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly pending = signal<ConfirmRequest | null>(null);
  readonly request = this.pending.asReadonly();

  ask(options: ConfirmOptions): Promise<boolean> {
    // A second request while one is open cancels the first rather than stacking dialogs.
    this.pending()?.resolve(false);
    return new Promise<boolean>(resolve => this.pending.set({ ...options, resolve }));
  }

  answer(confirmed: boolean): void {
    const current = this.pending();
    this.pending.set(null);
    current?.resolve(confirmed);
  }
}
