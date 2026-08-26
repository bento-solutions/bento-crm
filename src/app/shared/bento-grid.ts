import {
  Directive,
  ElementRef,
  DestroyRef,
  afterRenderEffect,
  contentChildren,
  inject,
  input,
  output,
} from '@angular/core';

/**
 * Bento drag-to-rearrange grid.
 *
 * The tiles never move in the DOM — the grid owns each tile's CSS `order`, and CSS grid
 * auto-placement (with `dense` flow) does the packing. A drag therefore costs one style
 * write per tile plus a FLIP pass, and never triggers change detection: the model is only
 * committed on drop. That is what keeps it at 60fps with tiles of mixed sizes.
 */

interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

const SWAP_MS = 240;
const SWAP_EASE = 'cubic-bezier(0.2, 0.9, 0.25, 1)';
const DROP_MS = 380;
/** Slight overshoot past 1 so the tile settles into the slot instead of just stopping. */
const DROP_EASE = 'cubic-bezier(0.18, 1.14, 0.36, 1)';
const LIFT_SCALE = 1.03;
const MOVE_THRESHOLD = 4;
const TOUCH_HOLD_MS = 180;
const TOUCH_HOLD_SLOP = 10;
const SWAP_LOCK_MS = 110;
const EDGE_ZONE = 80;
const EDGE_SPEED = 18;

@Directive({
  selector: '[appBentoTile]',
  host: { class: 'bento-tile', '[attr.data-bento-id]': 'bentoTile()' },
})
export class BentoTile {
  /**
   * Not `input.required`: the grid reads this from a content query, which can resolve a beat
   * before Angular applies the binding. A required input would throw NG0950 there and abort
   * the whole update pass, leaving the tiles rendered but unbound.
   */
  readonly bentoTile = input<string>('');
  readonly el: HTMLElement = inject(ElementRef).nativeElement;
}

@Directive({
  selector: '[appBentoGrid]',
  host: { class: 'bento-grid' },
})
export class BentoGrid {
  /** Tile ids in display order. Source of truth; only read, never written by the grid. */
  readonly bentoGrid = input.required<string[]>();
  /** Editing mode: the whole tile becomes a drag handle, not just the grip. */
  readonly bentoEditing = input(false);
  readonly bentoDisabled = input(false);

  /** Emitted once, on drop, with the committed order. */
  readonly bentoReorder = output<string[]>();
  /** Emitted when a drag starts/ends so the host can dim chrome, etc. */
  readonly bentoDragging = output<boolean>();

  private readonly tiles = contentChildren(BentoTile, { descendants: true });
  private readonly host: HTMLElement = inject(ElementRef).nativeElement;

  private preview: string[] = [];
  private rects = new Map<string, Rect>();

  private pointerId: number | null = null;
  private dragging = false;
  private armTimer: ReturnType<typeof setTimeout> | null = null;
  private startX = 0;
  private startY = 0;
  private pointerX = 0;
  private pointerY = 0;
  private grabDx = 0;
  private grabDy = 0;
  private draggedId: string | null = null;
  private draggedEl: HTMLElement | null = null;
  private baseRect: Rect | null = null;
  private rafId = 0;
  private swapLockUntil = 0;
  private scrollParent: HTMLElement | null = null;

  /** Keyboard drag: id of the tile currently "picked up" via the keyboard. */
  private kbId: string | null = null;

  constructor() {
    // afterRenderEffect, not effect: this writes to the DOM and must run once the tiles'
    // inputs have actually been applied.
    afterRenderEffect(() => {
      const order = this.bentoGrid();
      this.tiles(); // re-run when tiles are added or removed
      if (this.dragging || this.kbId) return;
      this.preview = [...order];
      this.writeOrder(this.preview);
    });

    this.host.addEventListener('pointerdown', this.onPointerDown);
    this.host.addEventListener('keydown', this.onKeyDown);

    inject(DestroyRef).onDestroy(() => {
      this.host.removeEventListener('pointerdown', this.onPointerDown);
      this.host.removeEventListener('keydown', this.onKeyDown);
      this.teardownWindowListeners();
      if (this.rafId) cancelAnimationFrame(this.rafId);
      if (this.armTimer) clearTimeout(this.armTimer);
    });
  }

  // ──────────────────────────────────────────────────────────────
  // Order bookkeeping
  // ──────────────────────────────────────────────────────────────

  private writeOrder(order: string[]) {
    for (const tile of this.tiles()) {
      const id = tile.bentoTile();
      if (!id) continue;
      const i = order.indexOf(id);
      tile.el.style.order = String(i === -1 ? order.length : i);
    }
  }

  private elFor(id: string): HTMLElement | null {
    return this.tiles().find(t => t.bentoTile() === id)?.el ?? null;
  }

  private idFor(el: HTMLElement): string | null {
    return this.tiles().find(t => t.el === el)?.bentoTile() ?? null;
  }

  private motion(ms: number): number {
    if (typeof matchMedia === 'undefined') return ms;
    return matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : ms;
  }

  // ──────────────────────────────────────────────────────────────
  // Pointer drag
  // ──────────────────────────────────────────────────────────────

  private onPointerDown = (ev: PointerEvent) => {
    if (this.bentoDisabled() || this.dragging || ev.button !== 0) return;

    const target = ev.target as HTMLElement | null;
    if (!target) return;

    const tileEl = target.closest<HTMLElement>('.bento-tile');
    if (!tileEl || !this.host.contains(tileEl)) return;

    const onHandle = !!target.closest('[data-bento-handle]');
    if (!onHandle) {
      // Outside edit mode only the grip starts a drag, so the tile stays clickable.
      if (!this.bentoEditing()) return;
      if (target.closest('button, a, input, select, textarea, [data-no-drag]')) return;
    }

    const id = this.idFor(tileEl);
    if (!id) return;

    this.pointerId = ev.pointerId;
    this.draggedId = id;
    this.draggedEl = tileEl;
    this.startX = this.pointerX = ev.clientX;
    this.startY = this.pointerY = ev.clientY;

    window.addEventListener('pointermove', this.onPointerMove, { passive: false });
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerCancel);

    if (ev.pointerType === 'touch') {
      // Hold-to-drag on touch so the page can still be scrolled from a tile.
      this.armTimer = setTimeout(() => {
        this.armTimer = null;
        this.beginDrag();
      }, TOUCH_HOLD_MS);
    }
  };

  private onPointerMove = (ev: PointerEvent) => {
    if (ev.pointerId !== this.pointerId) return;
    this.pointerX = ev.clientX;
    this.pointerY = ev.clientY;

    if (!this.dragging) {
      const dist = Math.hypot(ev.clientX - this.startX, ev.clientY - this.startY);
      if (this.armTimer) {
        if (dist > TOUCH_HOLD_SLOP) this.reset();
        return;
      }
      if (ev.pointerType === 'touch') return;
      if (dist <= MOVE_THRESHOLD) return;
      this.beginDrag();
    }

    ev.preventDefault();

    // The browser already coalesces pointermove to the display refresh rate, so following the
    // pointer here is frame-accurate without a rAF loop of our own. track() is a single style
    // write and maybeSwap() is math over cached rects, so this stays cheap per event.
    this.track();
    this.maybeSwap();
    this.updateEdgeScroll();
  };

  private onPointerUp = () => {
    if (this.dragging) this.endDrag(true);
    else this.reset();
  };

  private onPointerCancel = () => {
    if (this.dragging) this.endDrag(false);
    else this.reset();
  };

  private beginDrag() {
    const el = this.draggedEl;
    if (!el || !this.draggedId) return;

    this.dragging = true;
    this.swapLockUntil = 0;
    this.preview = [...this.bentoGrid()];
    this.scrollParent = findScrollParent(this.host);

    this.measure();
    const rect = this.rects.get(this.draggedId);
    if (!rect) {
      this.reset();
      return;
    }
    this.baseRect = rect;
    this.grabDx = this.pointerX - rect.left;
    this.grabDy = this.pointerY - rect.top;

    // Anchoring the scale to the grab point keeps the tile pinned under the cursor.
    el.style.transformOrigin = `${(this.grabDx / rect.width) * 100}% ${(this.grabDy / rect.height) * 100}%`;
    el.style.willChange = 'transform';
    el.style.transition = 'box-shadow 160ms ease, opacity 160ms ease';
    el.classList.add('is-dragging');
    this.host.classList.add('is-dragging-active');
    document.body.classList.add('bento-dragging');

    this.track();
    this.bentoDragging.emit(true);
  }

  private endDrag(commit: boolean) {
    const el = this.draggedEl;
    this.stopEdgeScroll();

    if (!commit) {
      this.relayout([...this.bentoGrid()]);
    }

    if (el) {
      const ms = this.motion(DROP_MS);
      el.style.transition = ms
        ? `transform ${ms}ms ${DROP_EASE}, box-shadow ${ms}ms ease`
        : 'none';
      el.style.transform = 'none';
      el.classList.remove('is-dragging');
      el.classList.add('is-landing');
      const landed = el;
      setTimeout(() => {
        landed.classList.remove('is-landing');
        landed.style.transition = '';
        landed.style.transformOrigin = '';
        landed.style.willChange = '';
      }, ms + 20);
    }

    this.host.classList.remove('is-dragging-active');
    document.body.classList.remove('bento-dragging');

    const next = commit ? [...this.preview] : null;
    this.dragging = false;
    this.reset();
    this.bentoDragging.emit(false);

    if (next && !sameOrder(next, this.bentoGrid())) this.bentoReorder.emit(next);
  }

  private reset() {
    if (this.armTimer) {
      clearTimeout(this.armTimer);
      this.armTimer = null;
    }
    this.teardownWindowListeners();
    this.pointerId = null;
    this.draggedId = null;
    this.draggedEl = null;
    this.baseRect = null;
    this.scrollParent = null;
  }

  private teardownWindowListeners() {
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerCancel);
  }

  // ──────────────────────────────────────────────────────────────
  // Frame loop: follow the pointer, auto-scroll, maybe swap
  // ──────────────────────────────────────────────────────────────

  /**
   * Only auto-scroll needs a clock of its own: it has to keep scrolling while the pointer sits
   * still in the edge zone, so there are no pointermove events to ride on.
   */
  private updateEdgeScroll() {
    if (this.edgeVelocity() === 0) this.stopEdgeScroll();
    else if (!this.rafId) this.edgeLoop();
  }

  private edgeLoop = () => {
    this.rafId = requestAnimationFrame(() => {
      this.rafId = 0;
      if (!this.dragging) return;
      if (this.autoScroll()) {
        this.track();
        this.maybeSwap();
        this.edgeLoop();
      }
    });
  };

  private stopEdgeScroll() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }

  /** Pixels to scroll this frame, signed; 0 when the pointer is away from either edge. */
  private edgeVelocity(): number {
    const sp = this.scrollParent;
    if (!sp) return 0;
    const viewport = sp === document.scrollingElement
      ? { top: 0, bottom: window.innerHeight }
      : sp.getBoundingClientRect();

    if (this.pointerY < viewport.top + EDGE_ZONE) {
      return -(1 - (this.pointerY - viewport.top) / EDGE_ZONE) * EDGE_SPEED;
    }
    if (this.pointerY > viewport.bottom - EDGE_ZONE) {
      return (1 - (viewport.bottom - this.pointerY) / EDGE_ZONE) * EDGE_SPEED;
    }
    return 0;
  }

  private track() {
    const el = this.draggedEl;
    const base = this.baseRect;
    if (!el || !base) return;
    const tx = this.pointerX - this.grabDx - base.left;
    const ty = this.pointerY - this.grabDy - base.top;
    el.style.transform = `translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, 0) scale(${LIFT_SCALE})`;
  }

  /** Returns true while it is still scrolling, so the caller knows to keep the loop alive. */
  private autoScroll(): boolean {
    const sp = this.scrollParent;
    const delta = this.edgeVelocity();
    if (!sp || !delta) return false;

    const before = sp.scrollTop;
    sp.scrollTop = before + delta;
    const moved = sp.scrollTop - before;
    if (!moved) return false;

    // Everything shifted by `moved`; patch the cache instead of re-measuring.
    for (const r of this.rects.values()) {
      r.top -= moved;
      r.bottom -= moved;
    }
    if (this.baseRect) {
      this.baseRect.top -= moved;
      this.baseRect.bottom -= moved;
    }
    return true;
  }

  private maybeSwap() {
    if (!this.draggedId) return;
    if (performance.now() < this.swapLockUntil) return;

    const targetId = this.hitTest(this.pointerX, this.pointerY);
    if (!targetId) return;

    const next = [...this.preview];
    const from = next.indexOf(this.draggedId);
    const to = next.indexOf(targetId);
    if (from < 0 || to < 0 || from === to) return;

    next.splice(from, 1);
    next.splice(to, 0, this.draggedId);
    this.swapLockUntil = performance.now() + SWAP_LOCK_MS;
    this.relayout(next);
  }

  private hitTest(x: number, y: number): string | null {
    for (const [id, r] of this.rects) {
      if (id === this.draggedId) continue;
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return id;
    }
    return null;
  }

  // ──────────────────────────────────────────────────────────────
  // FLIP
  // ──────────────────────────────────────────────────────────────

  /** Reads every tile's true layout rect into `this.rects`. Costs one reflow. */
  private measure() {
    this.rects.clear();
    for (const tile of this.tiles()) {
      const r = tile.el.getBoundingClientRect();
      this.rects.set(tile.bentoTile(), {
        left: r.left,
        top: r.top,
        right: r.right,
        bottom: r.bottom,
        width: r.width,
        height: r.height,
      });
    }
  }

  /**
   * Commit `next` to the tiles' CSS `order` and animate every tile that moved from its old
   * visual position to its new slot. The dragged tile is excluded — the pointer owns it.
   */
  private relayout(next: string[]) {
    const dragged = this.draggedEl;
    const movers = this.tiles()
      .map(t => t.el)
      .filter(el => el !== dragged);

    // Take the dragged tile out of transform space so every rect below is true layout.
    if (dragged) dragged.style.transform = 'none';

    // FIRST — current visual positions (in-flight transforms included, so interruptions blend).
    const first = movers.map(el => el.getBoundingClientRect());

    // Neutralise, then mutate. No paint happens between these writes.
    for (const el of movers) {
      el.style.transition = 'none';
      el.style.transform = 'none';
    }

    this.preview = next;
    this.writeOrder(next);

    // LAST — reading forces the single reflow that settles the new layout.
    this.measure();
    if (this.draggedId) this.baseRect = this.rects.get(this.draggedId) ?? this.baseRect;

    // Invert.
    for (let i = 0; i < movers.length; i++) {
      const el = movers[i];
      const id = this.idFor(el);
      const last = id ? this.rects.get(id) : null;
      if (!last) continue;
      const dx = first[i].left - last.left;
      const dy = first[i].top - last.top;
      el.style.transform = dx || dy ? `translate3d(${dx}px, ${dy}px, 0)` : 'none';
    }

    // Play.
    void this.host.offsetHeight;
    const ms = this.motion(SWAP_MS);
    for (const el of movers) {
      el.style.transition = ms ? `transform ${ms}ms ${SWAP_EASE}` : 'none';
      el.style.transform = 'none';
    }

    if (dragged) this.track();
  }

  // ──────────────────────────────────────────────────────────────
  // Keyboard drag — space to pick up, arrows to move, space/escape to finish
  // ──────────────────────────────────────────────────────────────

  private onKeyDown = (ev: KeyboardEvent) => {
    if (this.bentoDisabled() || this.dragging) return;

    const target = ev.target as HTMLElement | null;
    const tileEl = target?.closest<HTMLElement>('.bento-tile');
    if (!tileEl) return;
    const id = this.idFor(tileEl);
    if (!id) return;

    if (ev.key === ' ' || ev.key === 'Enter') {
      if (!target?.closest('[data-bento-handle]')) return;
      ev.preventDefault();
      if (this.kbId === id) this.endKeyboard(true);
      else this.beginKeyboard(id, tileEl);
      return;
    }

    if (this.kbId !== id) return;

    if (ev.key === 'Escape') {
      ev.preventDefault();
      this.endKeyboard(false);
      return;
    }

    const step =
      ev.key === 'ArrowLeft' || ev.key === 'ArrowUp'
        ? -1
        : ev.key === 'ArrowRight' || ev.key === 'ArrowDown'
          ? 1
          : 0;
    if (!step) return;

    ev.preventDefault();
    const next = [...this.preview];
    const from = next.indexOf(id);
    const to = from + step;
    if (to < 0 || to >= next.length) return;
    next.splice(from, 1);
    next.splice(to, 0, id);
    this.relayout(next);
  };

  private beginKeyboard(id: string, el: HTMLElement) {
    this.kbId = id;
    this.preview = [...this.bentoGrid()];
    this.measure();
    el.classList.add('is-kb-grabbed');
    el.setAttribute('aria-grabbed', 'true');
  }

  private endKeyboard(commit: boolean) {
    const id = this.kbId;
    if (!id) return;
    const el = this.elFor(id);
    el?.classList.remove('is-kb-grabbed');
    el?.removeAttribute('aria-grabbed');
    this.kbId = null;

    if (commit) {
      const next = [...this.preview];
      if (!sameOrder(next, this.bentoGrid())) this.bentoReorder.emit(next);
    } else {
      this.relayout([...this.bentoGrid()]);
    }
  }
}

function sameOrder(a: string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function findScrollParent(el: HTMLElement): HTMLElement | null {
  let node: HTMLElement | null = el.parentElement;
  while (node) {
    const { overflowY } = getComputedStyle(node);
    if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) {
      return node;
    }
    node = node.parentElement;
  }
  return (document.scrollingElement as HTMLElement) ?? null;
}
