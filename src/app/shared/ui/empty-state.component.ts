import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/**
 * Empty / zero-data state. Always tells the user what this place is for and, where
 * possible, offers the next action through the projected content.
 *
 *   <app-empty-state icon="support_agent" title="No tickets yet" text="Create one to get started.">
 *     <button class="btn-primary">New Ticket</button>
 *   </app-empty-state>
 */
@Component({
  selector: 'app-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  host: { class: 'empty-state' },
  template: `
    @if (icon()) {
      <span class="empty-state__icon"><mat-icon>{{ icon() }}</mat-icon></span>
    }
    <div class="empty-state__title">{{ title() }}</div>
    @if (text()) {
      <p class="empty-state__text">{{ text() }}</p>
    }
    <div class="empty-state__actions empty:hidden"><ng-content /></div>
  `
})
export class EmptyStateComponent {
  icon = input<string>('inbox');
  title = input.required<string>();
  text = input<string>('');
}
