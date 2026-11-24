import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

/**
 * Bento's own sidebar icons: light blue, two tones, drawn on a 24×24 grid.
 * Layers: f = soft fill + outline, s = outline, d = solid dot, w = paper fill + outline, k = accent stroke.
 */
const GLYPHS: Record<string, [string, string][]> = {
  home: [['f', '<path d="M6.5 15a5.5 5.5 0 0 1 11 0z"/>'], ['s', '<path d="M3 15h18M7 19h10M12 4v2.5M4.9 7.9l1.6 1.6M19.1 7.9l-1.6 1.6"/>']],
  analytics: [['s', '<path d="M10.5 5.6A8 8 0 1 0 18.4 13.5h-7.9z"/>'], ['f', '<path d="M13.5 3a7.5 7.5 0 0 1 7.5 7.5h-7.5z"/>']],
  inbox: [['s', '<path d="M9 8V6.5A2.5 2.5 0 0 1 11.5 4h7A2.5 2.5 0 0 1 21 6.5v4a2.5 2.5 0 0 1-2.5 2.5H17"/>'],
    ['f', '<path d="M5 9h8a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H9l-3.5 3v-3H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2z"/>'], ['d', '<circle cx="20" cy="4.5" r="2.3"/>']],
  sales: [['f', '<path d="M3 4.5v6.3c0 .6.2 1.1.6 1.5l8.6 8.6a2 2 0 0 0 2.8 0l5.9-5.9a2 2 0 0 0 0-2.8L12.3 3.6A2.1 2.1 0 0 0 10.8 3H4.5A1.5 1.5 0 0 0 3 4.5z"/>'],
    ['w', '<circle cx="7.6" cy="7.6" r="1.7"/>'], ['k', '<path d="M11.5 13.5l3 3M13.5 11.5l3 3"/>']],
  contacts: [['f', '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/>'], ['w', '<circle cx="8.5" cy="10.5" r="2.2"/>'],
    ['s', '<path d="M5 16.3c.8-1.5 2-2.2 3.5-2.2s2.7.7 3.5 2.2M15 10h3.5M15 13.5h3.5"/>']],
  work: [['s', '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M9 4v16M15 4v16"/>'],
    ['d', '<rect x="4.6" y="6.5" width="2.8" height="3.2" rx=".8"/><rect x="10.6" y="6.5" width="2.8" height="5.5" rx=".8"/><rect x="16.6" y="6.5" width="2.8" height="2.4" rx=".8"/>']],
  receivables: [['f', '<path d="M3 3h11v18l-1.8-1.4-1.9 1.4-1.8-1.4-1.9 1.4-1.8-1.4L3 21z"/>'], ['s', '<path d="M6 8h5M6 11.5h3.5"/>'],
    ['k', '<path d="M21.5 9.5l-7.5 7.5M14 12v5h5"/>']],
  payables: [['f', '<path d="M3 3h11v18l-1.8-1.4-1.9 1.4-1.8-1.4-1.9 1.4-1.8-1.4L3 21z"/>'], ['s', '<path d="M6 8h5M6 11.5h3.5"/>'],
    ['k', '<path d="M13.5 17.5l7.5-7.5M16 10h5v5"/>']],
  bank: [['f', '<rect x="3" y="7" width="18" height="13" rx="2.5"/>'], ['s', '<path d="M5.5 7l9.5-3.5L16.3 7"/>'],
    ['w', '<path d="M21 11h-3.5a2.25 2.25 0 0 0 0 4.5H21z"/>'], ['d', '<circle cx="17.6" cy="13.25" r="1"/>']],
  ledger: [['s', '<path d="M12 5v15M8 20h8M4.5 7h15M4.5 7L2 13M4.5 7L7 13M19.5 7L17 13M19.5 7L22 13"/>'],
    ['f', '<path d="M2 13a2.5 2.5 0 0 0 5 0zM17 13a2.5 2.5 0 0 0 5 0z"/>'], ['d', '<circle cx="12" cy="4.5" r="1.4"/>']],
  inventory: [['f', '<rect x="2.5" y="12" width="9" height="8.5" rx="1.3"/><rect x="12.5" y="12" width="9" height="8.5" rx="1.3"/><rect x="7.5" y="3.5" width="9" height="8.5" rx="1.3"/>'],
    ['s', '<path d="M7 12v2.5M17 12v2.5M12 3.5V6"/>']],
  settings: [['s', '<path d="M4 7h16M4 12h16M4 17h16"/>'], ['w', '<circle cx="9" cy="7" r="2.2"/><circle cx="15.5" cy="12" r="2.2"/><circle cx="7" cy="17" r="2.2"/>']],
  help: [['f', '<circle cx="12" cy="12" r="9"/>'], ['w', '<circle cx="12" cy="12" r="4"/>'],
    ['s', '<path d="M5.6 5.6l3.6 3.6M18.4 5.6l-3.6 3.6M5.6 18.4l3.6-3.6M18.4 18.4l-3.6-3.6"/>']],
};

export const NAV_GLYPHS = Object.keys(GLYPHS);

@Component({
  selector: 'app-nav-glyph',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<svg viewBox="0 0 24 24" aria-hidden="true" [innerHTML]="markup()"></svg>`,
  styles: [`
    /* Each icon sits in a soft light blue tile; on the active row the tile turns to paper. Colours: --nav-blue* in styles.css. */
    :host { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;
      width: 26px; height: 26px; border-radius: 7px; background: var(--nav-blue-bg); transition: background var(--transition-fast, 120ms); }
    :host-context(.active) { background: var(--color-surface); }
    svg { width: 16px; height: 16px; overflow: visible; }
    svg ::ng-deep g { fill: none; stroke: var(--nav-blue); stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
    svg ::ng-deep g.f { fill: var(--nav-blue-soft); }
    svg ::ng-deep g.w { fill: var(--color-surface); }
    svg ::ng-deep g.d { fill: var(--nav-blue-solid); stroke: none; }
    svg ::ng-deep g.k { stroke: var(--nav-blue-solid); stroke-width: 2.2; }
  `],
})
export class NavGlyphComponent {
  name = input.required<string>();
  private sanitizer = inject(DomSanitizer);
  // The markup is our own constant above, never user input.
  markup = computed<SafeHtml>(() => this.sanitizer.bypassSecurityTrustHtml(
    (GLYPHS[this.name()] ?? []).map(([c, x]) => `<g class="${c}">${x}</g>`).join('')));
}
