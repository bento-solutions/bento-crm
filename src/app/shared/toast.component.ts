import { Component, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { ToastService, Toast } from '../services/toast.service';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [MatIconModule, CommonModule],
  template: `
    <div class="fixed bottom-6 right-6 z-[9999] flex flex-col-reverse gap-3 pointer-events-none">
      @for (toast of toasts(); track toast.id) {
        <div
          (mouseenter)="service.pauseDismiss(toast.id)"
          (mouseleave)="service.resumeDismiss(toast.id)"
          class="pointer-events-auto flex items-start gap-3 px-4 py-3.5 rounded-xl shadow-xl border backdrop-blur-sm 
                 min-w-[340px] max-w-[420px] animate-slide-in-right"
          [class]="getTypeClasses(toast.type)"
        >
          <mat-icon class="text-[20px] w-5 h-5 mt-0.5 shrink-0">{{ getTypeIcon(toast.type) }}</mat-icon>

          <p class="flex-1 text-sm font-medium leading-snug min-w-0 [&_strong]:font-semibold" [innerHTML]="toast.message"></p>

          @if (toast.undo) {
            <button
              (click)="handleUndo(toast)"
              class="text-xs font-semibold uppercase tracking-wider shrink-0 px-2 py-1 rounded-lg transition-colors"
              [class]="getUndoClasses(toast.type)"
            >
              Undo
            </button>
          }

          @if (toast.action) {
            <button
              (click)="handleAction(toast)"
              class="text-xs font-semibold shrink-0 px-2 py-1 rounded-lg transition-colors"
              [class]="getActionClasses(toast.type)"
            >
              {{ toast.action.label }}
            </button>
          }

          <button
            (click)="service.dismiss(toast.id)"
            class="shrink-0 p-0.5 rounded-md transition-colors flex items-center justify-center"
            [class]="getCloseClasses(toast.type)"
          >
            <mat-icon class="text-[16px] w-4 h-4">close</mat-icon>
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    @keyframes slide-in-right {
      from {
        opacity: 0;
        transform: translateX(100%) scale(0.95);
      }
      to {
        opacity: 1;
        transform: translateX(0) scale(1);
      }
    }
    @keyframes fade-out {
      from { opacity: 1; transform: translateX(0); }
      to { opacity: 0; transform: translateX(100%); }
    }
    .animate-slide-in-right {
      animation: slide-in-right 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .animate-fade-out {
      animation: fade-out 0.2s ease-in forwards;
    }
  `]
})
export class ToastContainerComponent {
  service = inject(ToastService);
  toasts = this.service.toasts;

  getTypeClasses(type: string): string {
    switch (type) {
      case 'success': return 'bg-emerald-50 border-emerald-200 text-emerald-900';
      case 'error':   return 'bg-red-50 border-red-200 text-red-900';
      case 'warning': return 'bg-amber-50 border-amber-200 text-amber-900';
      case 'info':    return 'bg-sky-50 border-sky-200 text-sky-900';
      default:        return 'bg-white border-zinc-200 text-zinc-900';
    }
  }

  getTypeIcon(type: string): string {
    switch (type) {
      case 'success': return 'check_circle';
      case 'error':   return 'error';
      case 'warning': return 'warning';
      case 'info':    return 'info';
      default:        return 'check_circle';
    }
  }

  getUndoClasses(type: string): string {
    switch (type) {
      case 'success': return 'text-emerald-700 hover:bg-emerald-100';
      case 'error':   return 'text-red-700 hover:bg-red-100';
      case 'warning': return 'text-amber-700 hover:bg-amber-100';
      case 'info':    return 'text-sky-700 hover:bg-sky-100';
      default:        return 'text-zinc-700 hover:bg-zinc-100';
    }
  }

  getActionClasses(type: string): string {
    switch (type) {
      case 'success': return 'text-emerald-700 bg-emerald-100 hover:bg-emerald-200';
      case 'error':   return 'text-red-700 bg-red-100 hover:bg-red-200';
      case 'warning': return 'text-amber-700 bg-amber-100 hover:bg-amber-200';
      case 'info':    return 'text-sky-700 bg-sky-100 hover:bg-sky-200';
      default:        return 'text-zinc-700 bg-zinc-100 hover:bg-zinc-200';
    }
  }

  getCloseClasses(type: string): string {
    switch (type) {
      case 'success': return 'text-emerald-400 hover:text-emerald-700 hover:bg-emerald-100';
      case 'error':   return 'text-red-400 hover:text-red-700 hover:bg-red-100';
      case 'warning': return 'text-amber-400 hover:text-amber-700 hover:bg-amber-100';
      case 'info':    return 'text-sky-400 hover:text-sky-700 hover:bg-sky-100';
      default:        return 'text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100';
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
