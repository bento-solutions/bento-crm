import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

/**
 * The one page header every screen starts with: optional back link, an H1 title with optional
 * inline badges, a one-line description, and a right-aligned action slot.
 *
 *   <app-page-header title="Tickets" subtitle="Track and resolve customer issues">
 *     <button actions class="btn-primary"><mat-icon>add</mat-icon>New Ticket</button>
 *   </app-page-header>
 *
 * Slots: `[meta]` sits beside the title (badges, status), `[actions]` is the right-hand cluster.
 */
@Component({
  selector: 'app-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatIconModule],
  template: `
    <header class="page-header">
      <div class="page-header__main">
        @if (backLink()) {
          <a class="page-back" [routerLink]="backLink()">
            <mat-icon class="icon-sm">arrow_back</mat-icon>{{ backLabel() }}
          </a>
        }
        @if (size() === 'section') {
          <h2 class="section-title flex items-center gap-2 flex-wrap">
            <span class="min-w-0 truncate">{{ title() }}</span>
            <ng-content select="[meta]" />
          </h2>
        } @else {
          <h1 class="page-header__title">
            <span class="min-w-0 truncate">{{ title() }}</span>
            <ng-content select="[meta]" />
          </h1>
        }
        @if (subtitle()) {
          <p class="page-header__subtitle">{{ subtitle() }}</p>
        }
        <ng-content select="[subtitle]" />
      </div>
      <div class="page-header__actions">
        <ng-content select="[actions]" />
      </div>
    </header>
  `,
  styles: [`:host { display: block; }`]
})
export class PageHeaderComponent {
  title = input.required<string>();
  subtitle = input<string>('');
  /** Router link for the "back" affordance on detail pages. */
  backLink = input<string | readonly unknown[] | null>(null);
  backLabel = input<string>('Back');
  /** `section` renders an h2 for sub-pages that already sit under a page header (Settings tabs). */
  size = input<'page' | 'section'>('page');
}
