# Bento design system

One visual language for every module. The rules below are enforced by `npm run lint:design`
(raw palette, hard-coded colours, arbitrary sizes, native dialogs, gradients, bold weights, dark-theme drift).

Source of truth: [`src/styles.css`](src/styles.css). Shared building blocks: [`src/app/shared/ui/`](src/app/shared/ui/).

## Direction

The look follows an [unslop](https://github.com/heydamir/unslop) pass (unslop by Damir Sokolovsky,
[@heydamir](https://x.com/heydamir), CC BY 4.0).

- **Product:** a CRM and back office for Moroccan small businesses and their accountants, from lead to invoice, bank and tax deadline.
- **Character:** exact, steady, a little warm.
- **World:** the accountant's desk: ledgers, stamped invoices, dirham figures. Neutrals are a faintly warm graphite, the accent is stamp-ink blue.
- **Moments:** the dashboard's pipeline figure and its chart. Everything around them stays quiet.
- **Signature:** figures read like a ledger: tabular numerals, hairline rules, counts and references in mono.

What that means in practice: one accent (ink blue) used for the primary action, links, focus and the one figure that matters;
no coloured icon tiles; sentence-case labels (no uppercase tracking); weights 400/500 with 550 for rare emphasis;
one easing curve (`cubic-bezier(0.22, 1, 0.36, 1)`); no looping or bouncy motion.

## Principles

1. **Ink blue means interactive.** Primary buttons (light theme), links, selection and focus. On the dark theme the primary
   button is off-white and the blue lives in links and selection. Blue is never a status.
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

Instrument Sans for the interface, Geist Mono for counts and references. 500 for titles, `font-semibold` (550) for rare emphasis, never 700+. Sizes are tokens — never `text-[13px]`.

| Token | px | Use |
|---|---|---|
| `text-meta` | 11 | timestamps, tiny meta |
| `text-xs` | 12 | secondary text, helper text, table meta |
| `text-sm` / `text-body` | **14** | default body, controls, table cells |
| `text-base` | 15 | emphasised body |
| `text-lg` | 16 | card / modal / section titles |
| `text-xl` | 20 | section numerals |
| `text-2xl` | 24 | hero numerals |

Roles: `.t-title` (24), `.t-heading`, `.eyebrow` (12px, sentence case), `.field-label` (12px), `.num` (tabular numerals). Labels are sentence case everywhere: no `uppercase`, no wide tracking.

## Space, radius, elevation

4px grid. Page gutter 24 (16 on phones), section gap 24, card padding 20, tile padding 16, control height 36 (28 small / 40 large).
Radius roles: controls **8** (`rounded-lg`) · cards **12** (`rounded-xl`) · overlays **16** (`rounded-2xl`) · pills `rounded-full`.
Depth: cards and tiles are a surface plus a hairline, no shadow. `shadow-lg` menus, `shadow-overlay` modals.

## Icons

Material Symbols Outlined (line icons, weight 350, drawn through the `mat-icon` ligatures) at five sizes only: `icon-xs` 14 · `icon-sm` 16 (buttons, row actions) · `icon-md` 20 (nav, headers) ·
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
| Section switching | `.tabs` + `.tab` (`is-active`) — pill tabs in a white track, navigation between sections |
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

`ENTITY_TONE` in `shared/ui/tones.ts` still names a hue per business entity, but icon chips no longer paint with it:
icons take the text colour of their role. Tones remain for category pills and calendar markers, where colour tells
items apart. A tone says *what* a thing is, never *how it is doing*.

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
