import { Directive, ElementRef, inject, input, effect } from '@angular/core';

/**
 * Animates a host element's text content from its current numeric value to a new
 * target whenever `countUp` changes, easing like a counter ramping up. Ramps from
 * zero on first render so KPI tiles count up on initial load instead of popping in.
 */
@Directive({
  selector: '[appCountUp]',
  standalone: true
})
export class CountUpDirective {
  private el = inject(ElementRef<HTMLElement>).nativeElement as HTMLElement;

  appCountUp = input.required<number>();
  appCountUpFormat = input<(v: number) => string>(v => `${Math.round(v)}`);
  appCountUpDuration = input(800);

  private current = 0;
  private frame: number | null = null;

  private reduceMotion =
    typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor() {
    effect(() => {
      const target = this.appCountUp();
      const fmt = this.appCountUpFormat();

      if (this.reduceMotion) {
        this.current = target;
        this.el.textContent = fmt(target);
        return;
      }

      const from = this.current;
      if (from === target) {
        this.el.textContent = fmt(target);
        return;
      }

      if (this.frame !== null) cancelAnimationFrame(this.frame);
      const start = performance.now();
      const dur = this.appCountUpDuration();

      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / dur);
        const eased = 1 - Math.pow(1 - t, 3);
        const v = from + (target - from) * eased;
        this.el.textContent = fmt(v);
        if (t < 1) {
          this.frame = requestAnimationFrame(tick);
        } else {
          this.current = target;
          this.frame = null;
        }
      };
      this.frame = requestAnimationFrame(tick);
    });
  }
}
