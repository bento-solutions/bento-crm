import { AfterViewInit, DestroyRef, Directive, ElementRef, inject, signal } from '@angular/core';

/**
 * Reports whether a `line-clamp`/`truncate` element is actually cutting its text off, so a
 * "Read more" hint can show only when there is more to read. Re-measures when the element is
 * resized (window width, sidebar toggle) or its text changes.
 *
 *   <span appClampDetect #c="clampDetect" class="line-clamp-2">…</span>
 *   @if (c.clamped()) { Read more }
 */
@Directive({ selector: '[appClampDetect]', exportAs: 'clampDetect' })
export class ClampDetectDirective implements AfterViewInit {
  private el = inject<ElementRef<HTMLElement>>(ElementRef);
  private destroyRef = inject(DestroyRef);

  readonly clamped = signal(false);

  ngAfterViewInit(): void {
    const node = this.el.nativeElement;
    const measure = () => this.clamped.set(
      node.scrollHeight > node.clientHeight + 1 || node.scrollWidth > node.clientWidth + 1
    );
    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(node);
    const mutation = new MutationObserver(measure);
    mutation.observe(node, { characterData: true, childList: true, subtree: true });
    this.destroyRef.onDestroy(() => { resize.disconnect(); mutation.disconnect(); });
  }
}
