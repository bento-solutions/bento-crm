import { Component, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { ToastService, Toast } from '../services/toast.service';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [MatIconModule, CommonModule],
  template: `
    <div class="toast-stack" aria-live="polite">
      @for (toast of toasts(); track toast.id) {
        <div
          (mouseenter)="service.pauseDismiss(toast.id)"
          (mouseleave)="service.resumeDismiss(toast.id)"
          class="toast animate-slide-in-right"
          [attr.data-type]="toast.type"
          [attr.role]="toast.type === 'error' ? 'alert' : 'status'"
        >
          <mat-icon class="toast__icon">{{ getTypeIcon(toast.type) }}</mat-icon>

          <p class="toast__message" [innerHTML]="toast.message"></p>

          @if (toast.undo) {
            <button (click)="handleUndo(toast)" class="btn-ghost btn-sm">Undo</button>
          }

          @if (toast.action) {
            <button (click)="handleAction(toast)" class="btn-ghost btn-sm">{{ toast.action.label }}</button>
          }

          <button (click)="service.dismiss(toast.id)" class="btn-icon btn-sm" aria-label="Dismiss notification">
            <mat-icon class="icon-sm">close</mat-icon>
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    .toast-stack {
      position: fixed; bottom: 24px; inset-inline-end: 24px; z-index: var(--z-toast);
      display: flex; flex-direction: column-reverse; gap: 8px; pointer-events: none;
    }
    .toast {
      pointer-events: auto; display: flex; align-items: flex-start; gap: 10px;
      min-width: 320px; max-width: 420px; padding: 12px 12px 12px 14px;
      background: var(--color-surface); color: var(--color-text-primary);
      border: 1px solid var(--color-border); border-radius: var(--r-card); box-shadow: var(--shadow-lg);
    }
    .toast__icon { flex-shrink: 0; margin-top: 1px; font-size: 20px; width: 20px; height: 20px; line-height: 20px; color: var(--color-text-tertiary); }
    .toast[data-type='success'] .toast__icon { color: var(--color-success); }
    .toast[data-type='error'] .toast__icon { color: var(--color-danger); }
    .toast[data-type='warning'] .toast__icon { color: var(--color-warning); }
    .toast[data-type='info'] .toast__icon { color: var(--color-info); }
    .toast__message { flex: 1; min-width: 0; margin: 0; padding-top: 2px; font-size: 13px; line-height: 1.45; font-weight: 500; }
    .toast__message :is(strong, b) { font-weight: 600; }
    @keyframes slide-in-right {
      from { opacity: 0; transform: translateX(24px) scale(0.98); }
      to { opacity: 1; transform: translateX(0) scale(1); }
    }
    .animate-slide-in-right { animation: slide-in-right 0.22s cubic-bezier(0.16, 1, 0.3, 1); }
  `]
})
export class ToastContainerComponent {
  service = inject(ToastService);
  toasts = this.service.toasts;

  getTypeIcon(type: string): string {
    switch (type) {
      case 'success': return 'check_circle';
      case 'error':   return 'error';
      case 'warning': return 'warning';
      case 'info':    return 'info';
      default:        return 'check_circle';
    }
  }

  handleUndo(toast: Toast) {
    toast.undo?.();
    this.service.dismiss(toast.id);
  }

  handleAction(toast: Toast) {
    toast.action?.onClick();
    this.service.dismiss(toast.id);
  }
}
