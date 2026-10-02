import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

export type Tone = 'slate' | 'blue' | 'sky' | 'violet' | 'emerald' | 'amber' | 'rose';

/**
 * KPI card used by every module. Same anatomy as a dashboard tile: tone-tinted icon chip,
 * eyebrow label, tabular numeral, optional unit and hint. Tone encodes the *entity*
 * (see ENTITY_TONE in tones.ts), never a status.
 *
 *   <app-stat-card label="Total Leads" [value]="count()" icon="groups" tone="blue" />
 */
@Component({
  selector: 'app-stat-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, MatTooltipModule],
  host: { class: 'stat-card tone', '[attr.data-tone]': 'tone()' },
  template: `
    <div class="stat-card__head">
      @if (icon()) {
        <span class="icon-chip"><mat-icon>{{ icon() }}</mat-icon></span>
      }
      <span class="stat-card__label" [matTooltip]="tooltip()" matTooltipPosition="above">{{ label() }}</span>
    </div>
    <div class="stat-card__value">
      {{ value() }}@if (unit()) {<span class="stat-card__unit"> {{ unit() }}</span>}
    </div>
    @if (hint()) {
      <div class="stat-card__hint">{{ hint() }}</div>
    }
    <ng-content />
  `
})
export class StatCardComponent {
  label = input.required<string>();
  value = input.required<string | number>();
  icon = input<string>('');
  tone = input<Tone>('slate');
  unit = input<string>('');
  hint = input<string>('');
  tooltip = input<string>('');
}
