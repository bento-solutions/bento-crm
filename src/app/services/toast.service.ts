import { Injectable, signal } from '@angular/core';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  undo?: () => void;
  action?: ToastAction;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private toastsSignal = signal<Toast[]>([]);

  readonly toasts = this.toastsSignal.asReadonly();

  private counter = 0;

  private timeouts = new Map<string, number>();
  private startedAt = new Map<string, number>();
  private durations = new Map<string, number>();

  show(message: string, options?: {
    type?: Toast['type'];
    undo?: () => void;
    action?: ToastAction;
    duration?: number;
  }) {
    const id = 'toast-' + ++this.counter;
    const toast: Toast = {
      id,
      message,
      type: options?.type ?? 'success',
      undo: options?.undo,
      action: options?.action,
    };
    this.toastsSignal.update(list => [...list, toast]);
    this.startTimer(id, options?.duration ?? 3000);
  }

  private startTimer(id: string, duration: number) {
    this.durations.set(id, duration);
    this.startedAt.set(id, Date.now());
    const timeoutId = window.setTimeout(() => this.dismiss(id), duration);
    this.timeouts.set(id, timeoutId);
  }

  pauseDismiss(id: string) {
    const timeoutId = this.timeouts.get(id);
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
      this.timeouts.delete(id);
      const started = this.startedAt.get(id);
      const duration = this.durations.get(id);
      if (started !== undefined && duration !== undefined) {
        const remaining = duration - (Date.now() - started);
        this.durations.set(id, Math.max(0, remaining));
      }
    }
  }

  resumeDismiss(id: string) {
    if (this.timeouts.has(id)) return;
    const remaining = this.durations.get(id);
    if (remaining !== undefined && remaining > 0) {
      this.startTimer(id, remaining);
    }
  }

  dismiss(id: string) {
    this.cleanup(id);
    this.toastsSignal.update(list => list.filter(t => t.id !== id));
  }

  clearAll() {
    for (const id of this.timeouts.keys()) {
      this.pauseDismiss(id);
    }
    this.toastsSignal.set([]);
  }

  private cleanup(id: string) {
    const timeoutId = this.timeouts.get(id);
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
    this.timeouts.delete(id);
    this.startedAt.delete(id);
    this.durations.delete(id);
  }
}
