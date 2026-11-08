import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PageHeaderComponent } from '../shared/ui/page-header.component';
import { AuthApiService } from '../core/services/auth-api.service';
import { CrmStateService } from '../services/crm-state.service';
import { errorMessage } from '../shared/error-message.util';

const INDUSTRIES = ['Technology', 'Finance', 'Consulting', 'Logistics', 'Retail', 'Education', 'Healthcare', 'Other'];
const CURRENCIES = ['MAD', 'EUR', 'USD', 'GBP', 'CAD', 'AUD'];

/**
 * A signed-in person creates another organization with the same account. They become its admin
 * and the app reopens in it; their other organizations stay in the organization menu.
 */
@Component({
  selector: 'app-new-organization',
  standalone: true,
  imports: [FormsModule, PageHeaderComponent],
  template: `
    <div class="page">
      <app-page-header
        title="New organization"
        subtitle="Create another organization with this account. You'll be its admin, and you keep your other organizations." />

      <div class="card p-5 max-w-[520px]">
        @if (error()) {
          <div class="alert alert-danger mb-4" role="alert">{{ error() }}</div>
        }
        <form (ngSubmit)="create()" class="space-y-4">
          <div>
            <label for="org_name" class="field-label mb-1.5">Organization name</label>
            <input id="org_name" [(ngModel)]="name" name="name" type="text" required maxlength="200"
              autocomplete="organization" class="input-field w-full" />
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label for="org_industry" class="field-label mb-1.5">Industry</label>
              <select id="org_industry" [(ngModel)]="industry" name="industry" class="input-field w-full">
                @for (option of industries; track option) {
                  <option [value]="option">{{ option }}</option>
                }
              </select>
            </div>
            <div>
              <label for="org_currency" class="field-label mb-1.5">Currency</label>
              <select id="org_currency" [(ngModel)]="currency" name="currency" class="input-field w-full">
                @for (option of currencies; track option) {
                  <option [value]="option">{{ option }}</option>
                }
              </select>
            </div>
          </div>
          <div class="flex justify-end">
            <button type="submit" class="btn-primary" [disabled]="saving()">
              {{ saving() ? 'Creating…' : 'Create and open it' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  `
})
export class NewOrganizationComponent {
  private authApi = inject(AuthApiService);
  private state = inject(CrmStateService);

  readonly industries = INDUSTRIES;
  readonly currencies = CURRENCIES;
  name = '';
  industry = 'Other';
  currency = CURRENCIES[0];
  saving = signal(false);
  error = signal('');

  create(): void {
    const name = this.name.trim();
    if (!name) {
      this.error.set('Enter a name for the organization');
      return;
    }
    this.error.set('');
    this.saving.set(true);
    this.authApi.createOrganization({
      name,
      industry: this.industry,
      default_currency: this.currency,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    }).subscribe({
      next: (session) => {
        this.state.startSession(session);
        // Everything loaded so far belongs to the previous organization: start over in the new one.
        window.location.href = '/';
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(errorMessage(err, 'Could not create the organization. Please try again.'));
      }
    });
  }
}
