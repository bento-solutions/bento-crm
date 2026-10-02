# Bento design system

One visual language for every module. The rules below are enforced by `npm run lint:design`
(raw palette, hard-coded colours, arbitrary sizes, native dialogs, gradients, bold weights, dark-theme drift).

Source of truth: [`src/styles.css`](src/styles.css). Shared building blocks: [`src/app/shared/ui/`](src/app/shared/ui/).

## Principles

1. **Blue means interactive.** Primary buttons, links, selected tabs/nav, focus rings. Blue is never a status.
2. **Colour is for meaning.** Semantic hues (`success`, `warning`, `danger`, `info`) carry *status* and always come
   with text or an icon. Entity hues (see tones) carry *identity* and are decorative.
3. **Every screen has the same anatomy:** page header → stat cards → tabs → toolbar → content (table / cards / board).
4. **No local styling systems.** Pages compose shared classes and components; they do not invent buttons, badges,
   modals or colours.
5. **Both themes, always.** Colours come from tokens, so light, dark and "system" work with no `dark:` variants.

## Tokens

All colours are CSS variables on `:root`, with a dark override (`data-theme="dark"` and the `system` media query —
the two blocks must stay identical). Tailwind's raw palette is disabled; use the semantic utilities:

| Role | Utilities |
|---|---|
| Surfaces | `bg-canvas` (page) · `bg-surface` (cards, inputs) · `bg-subtle` (inset) · `bg-muted` / `bg-muted-strong` (hover, chips) |
| Lines | `border-line` · `border-line-soft` · `border-line-strong` |
| Ink | `text-ink` (primary) · `text-ink-2` (secondary) · `text-ink-3` (tertiary, meta) · `text-ink-4` (placeholder, decorative icons) |
| Action | `bg-primary` / `text-on-primary` · `text-accent-ink` (links) · `bg-accent-soft` (selected tint) |
| Status | `success` · `warning` · `danger` · `info` · `violet` × `-soft` (tint) · `-line` (border) · `-ink` (text on tint / white) · solid (dots, icons) |
| Inverse | `bg-inverse` / `text-on-inverse` (bulk action bar, tooltips) · `bg-scrim` (overlays) |

Text on any surface meets WCAG AA (4.5:1): use `-ink` variants for *text*, solid variants only for fills and icons.
Verified with a computed-style audit across all screens in both themes: no off-scale font sizes or radii, no sub-AA text.

Chart series use `--chart-1…6`; per-person identity colours come from `identityColor()` in
`shared/ui/identity-color.ts` (the one place hex is allowed).

## Type scale

Inter, 600 for emphasis (no 700+). Sizes are tokens — never `text-[13px]`.

| Token | px | Use |
|---|---|---|
| `text-meta` | 11 | eyebrows, badges, timestamps |
| `text-xs` | 12 | secondary text, helper text, table meta |
| `text-sm` / `text-body` | **13** | default body, controls, table cells |
| `text-base` | 14 | emphasised body |
| `text-lg` | 16 | card / modal / section titles |
| `text-xl` | 20 | page titles, KPI numerals |
| `text-2xl` | 24 | hero numerals |

Roles: `.t-title`, `.t-heading`, `.eyebrow` (11px caps), `.field-label` (12px), `.num` (tabular numerals).

## Space, radius, elevation

4px grid. Page gutter 24 (16 on phones), section gap 24, card padding 20, tile padding 16, control height 36 (28 small / 40 large).
Radius roles: controls **8** (`rounded-lg`) · cards **12** (`rounded-xl`) · overlays **16** (`rounded-2xl`) · pills `rounded-full`.
Shadows: `shadow-xs` cards, `shadow-lg` menus, `shadow-overlay` modals.

## Icons

Material Icons at five sizes only: `icon-xs` 14 · `icon-sm` 16 (buttons, row actions) · `icon-md` 20 (nav, headers) ·
`icon-lg` 24 · `icon-xl` 40 (empty states). Never size icons with `text-[…]` or `w-N h-N`.

## Components

| Need | Use |
|---|---|
| Page title, subtitle, actions, back link | `<app-page-header>` (`size="section"` for Settings sub-pages) |
| KPI | `<app-stat-card label value icon tone hint>` inside `.stat-grid` |
| Empty / zero data | `<app-empty-state icon title text>` (+ projected actions) |
| Buttons | `.btn-primary` · `.btn-secondary` · `.btn-ghost` · `.btn-danger` · `.btn-danger-soft` · `.btn-icon` (+ `.btn-sm`, `.btn-lg`, `.btn-block`) |
| Form | `.field-label` + `.input-field` (inputs, selects, textareas) · `.search-field` · `.pill-select` (inline-edit status) · `.choice-row` · `.switch` |
| Status | `.badge` + `.badge-success/warning/danger/info/violet/accent/neutral` · `.count-pill` |
| Section switching | `.tabs` + `.tab` (`is-active`) — navigation between sections |
| View switching | `.segmented` + `.segmented__item` — table/board, currency, sub-sections |
| Filters | `.toolbar` with `.search-field`, selects, `.toolbar__count`, `.toolbar__spacer` |
| Tables | `.table-card` > `table.data-table` (`.col-actions`, `.col-num`, `.row-empty`, `.cell-title`, `.cell-sub`) |
| Cards | `.card` (`.card-header` / `.card-title` / `.card-body` / `.card-footer`) |
| Banners | `.alert` + `-info/-success/-warning/-danger` |
| Overlays | `.modal-backdrop` > `.modal modal-sm/md/lg/xl` (`.modal-header`, `.modal-title`, `.modal-footer`); `.drawer`; `.menu` / `.menu-item` |
| Confirmations | `ConfirmService.ask({ title, message, danger })` — never `confirm()` |
| Notifications | `ToastService.show()` — never `alert()` |
| Charts | `readChartTheme()` from `shared/ui/chart-theme.ts`; rebuild with `onThemeChange()` |

### Entity tones

One hue per business entity, used for icon chips everywhere (`ENTITY_TONE` in `shared/ui/tones.ts`):
deals/pipeline **violet** · partners **blue** · tasks **emerald** · tickets **sky** · campaigns **amber** ·
finance **slate** · late/lost **rose**. A tone says *what* a thing is, never *how it is doing*.

## Page anatomy

```html
<div class="page">
  <app-page-header title="Tickets" subtitle="…"><button actions class="btn-primary">…</button></app-page-header>
  <div class="stat-grid"> <app-stat-card …/> … </div>      <!-- optional -->
  <div class="tabs">…</div>                                 <!-- optional -->
  <div class="toolbar">search · filters · view switch · count</div>
  <div class="table-card"><table class="data-table">…</table><app-paginator …/></div>
</div>
```

Primary action: top-right of the header, label "New …", `.btn-primary`. Global create lives in the topbar menu.

## Adding or changing UI

- Reach for a class from the table above first. If nothing fits, add it to `styles.css` (components layer) — not to a page.
- Utilities may adjust layout (`flex`, `gap-*`, `w-*`, `mt-*`); they should not re-style a component.
- Run `npm run lint:design` before committing.
