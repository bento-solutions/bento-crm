import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Bento's mark: a lunch box seen from above, one long compartment and two short ones.
 * Drawn flat in one colour (the ink accent by default) so it reads at 16px and in both themes.
 */
@Component({
  selector: 'app-brand-mark',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'brand-mark', '[style.width.px]': 'size()', '[style.height.px]': 'size()', 'aria-hidden': 'true' },
  styles: [`:host { display: inline-flex; flex-shrink: 0; color: var(--color-accent-text); } svg { width: 100%; height: 100%; }`],
  template: `
    <svg viewBox="0 0 24 24" fill="none">
      <rect x="2.75" y="2.75" width="18.5" height="18.5" rx="4.25" stroke="currentColor" stroke-width="1.5" />
      <path d="M11 3v18M11 12h10" stroke="currentColor" stroke-width="1.5" />
    </svg>
  `
})
export class BrandMarkComponent {
  size = input<number>(24);
}
