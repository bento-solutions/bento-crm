import { Injectable, signal, computed, inject } from '@angular/core';
import { ApiService } from '../api.service';
import { ToastService } from '../toast.service';
import { AutomationRule } from '../crm-state.service';

export type { AutomationRule };

@Injectable({
  providedIn: 'root'
})
export class AutomationRulesService {
  private api = inject(ApiService);
  private toast = inject(ToastService);

  automationRules = signal<AutomationRule[]>([]);
  isLoaded = signal<boolean>(false);
  isLoading = signal<boolean>(false);
  error = signal<string | null>(null);

  allAutomationRules = computed(() => this.automationRules());
  isLoading$ = computed(() => this.isLoading());
  error$ = computed(() => this.error());

  load(): void {
    if (this.isLoaded()) return;
    this.isLoading.set(true);
    this.error.set(null);

    this.api.getAutomationRules().subscribe({
      next: (rules) => {
        if (rules && rules.length > 0) {
          this.automationRules.set(rules);
        }
        this.isLoaded.set(true);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.warn('Failed to load automation rules from API:', err);
        this.isLoaded.set(true);
        this.isLoading.set(false);
        this.error.set('Failed to load automation rules from the server.');
      }
    });
  }

  addRule(rule: Omit<AutomationRule, 'id' | 'createdAt' | 'updatedAt'>): void {
    this.api.createAutomationRule(rule as unknown).subscribe({
      next: (created) => {
        this.automationRules.update(rules => [...rules, created]);
        this.toast.show(`Automation rule <strong>${created.name}</strong> created`);
      },
      error: () => this.toast.show('Failed to create automation rule', { type: 'error' })
    });
  }

  updateRule(id: string, rule: Partial<AutomationRule>): void {
    this.api.updateAutomationRule(id, rule as unknown).subscribe({
      next: (updated) => {
        this.automationRules.update(rules =>
          rules.map(r => r.id === id ? updated : r)
        );
        this.toast.show(`Automation rule updated`);
      },
      error: () => this.toast.show('Failed to update automation rule', { type: 'error' })
    });
  }

  deleteRule(id: string): void {
    const deleted = this.automationRules().find(r => r.id === id);
    this.api.deleteAutomationRule(id).subscribe({
      next: () => {
        this.automationRules.update(rules => rules.filter(r => r.id !== id));
        this.toast.show(`Automation rule <strong>${deleted?.name || id}</strong> deleted`, {
          undo: () => {
            if (deleted) {
              this.automationRules.update(rules => [...rules, deleted]);
            }
          }
        });
      },
      error: () => this.toast.show('Failed to delete automation rule', { type: 'error' })
    });
  }

  getRuleById(id: string): AutomationRule | undefined {
    return this.automationRules().find(r => r.id === id);
  }
}
