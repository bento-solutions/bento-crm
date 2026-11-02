import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { MatIconModule } from '@angular/material/icon';
import { PageHeaderComponent } from '../shared/ui/page-header.component';
import { EmptyStateComponent } from '../shared/ui/empty-state.component';
import { CrmStateService } from '../services/crm-state.service';
import { NAV_SECTIONS, NavItem } from '../nav';

/** A module's own page (/m/<key>): every page of the module, as cards that open it. */
@Component({
  selector: 'app-module-hub',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatIconModule, PageHeaderComponent, EmptyStateComponent],
  template: `
    <div class="page">
      @if (section(); as s) {
        <app-page-header [title]="s.label" [subtitle]="s.module?.subtitle ?? ''" />
        @if (items().length) {
          <div class="module-grid">
            @for (item of items(); track item.label) {
              <a class="card card-interactive module-card" [routerLink]="item.route"
                 [queryParams]="item.tab && !item.defaultTab ? { tab: item.tab } : null">
                <mat-icon class="module-card__icon">{{ item.icon }}</mat-icon>
                <span class="module-card__text">
                  <span class="module-card__title">{{ item.label }}</span>
                  @if (item.hint) { <span class="module-card__hint">{{ item.hint }}</span> }
                </span>
                <mat-icon class="module-card__go icon-sm">chevron_right</mat-icon>
              </a>
            }
          </div>
        } @else {
          <app-empty-state icon="lock" title="Nothing here for your role" text="Ask an admin for access to this module." />
        }
      } @else {
        <app-empty-state icon="search_off" title="Module not found" text="Pick a module in the sidebar." />
      }
    </div>
  `,
  styles: [`
    .module-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
    .module-card { display: flex; align-items: center; gap: 12px; padding: 16px; text-decoration: none; color: inherit; min-width: 0; }
    .module-card__icon { flex-shrink: 0; color: var(--color-text-secondary); }
    .module-card__text { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
    .module-card__title { font-size: 14px; font-weight: 500; color: var(--color-text-heading); }
    .module-card__hint { font-size: 13px; color: var(--color-text-secondary); }
    .module-card__go { flex-shrink: 0; color: var(--color-text-tertiary); }
  `],
})
export class ModuleHubComponent {
  private route = inject(ActivatedRoute);
  private state = inject(CrmStateService);

  private key = toSignal(this.route.paramMap.pipe(map(p => p.get('key'))), { initialValue: null });

  section = computed(() => NAV_SECTIONS.find(s => s.module?.key === this.key()) ?? null);

  items = computed(() => (this.section()?.items ?? []).filter(i => this.canSee(i)));

  private canSee(item: NavItem): boolean {
    if (!item.authority) return true;
    const needed = Array.isArray(item.authority) ? item.authority : [item.authority];
    return needed.some(a => this.state.hasAuthority(a));
  }
}
