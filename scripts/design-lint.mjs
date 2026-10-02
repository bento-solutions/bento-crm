#!/usr/bin/env node
/**
 * Design guard: fails when UI code steps outside the Bento design system.
 * Run with `npm run lint:design` (also wired into CI-friendly `npm run lint:all`).
 *
 * Rules (see DESIGN_SYSTEM.md):
 *  - no raw Tailwind palette utilities (bg-zinc-100, text-blue-600 …) — use semantic tokens
 *  - no arbitrary colour/size utilities (text-[13px], bg-[#fff])
 *  - no hex/rgb colours in components (data colours live in shared/ui/identity-color.ts)
 *  - no native confirm()/alert() — use ConfirmService / ToastService
 *  - no bold/extrabold/black weights, no gradients
 *  - the two dark-theme token blocks in styles.css must stay identical
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = join(ROOT, 'src/app');
const HEX_ALLOWED = new Set(['src/app/shared/ui/identity-color.ts']);

const PALETTE = 'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';
const rules = [
  { id: 'palette', rx: new RegExp(`(?<![\\w-])(?:[\\w\\[\\]:&>*-]+:)*(?:bg|text|border|ring|divide|outline|from|to|via|fill|stroke|decoration|placeholder|accent|caret|shadow)-(?:${PALETTE})-\\d{2,3}(?![\\w-])`, 'g'), msg: 'raw palette utility — use a semantic token (bg-surface, text-ink-2, border-line, badge-success …)' },
  { id: 'arbitrary-size', rx: /(?<![\w-])text-\[\d+(?:\.\d+)?px\]/g, msg: 'arbitrary font size — use text-meta/xs/sm/base/lg/xl/2xl or icon-* for icons' },
  { id: 'arbitrary-colour', rx: /(?<![\w-])(?:bg|text|border|ring|fill|stroke)-\[(?:#|rgb|hsl)[^\]]*\]/g, msg: 'arbitrary colour — use a semantic token' },
  { id: 'important-size', rx: /(?<![\w-])!(?:text|w|h|size)-[\w\[\]./]+/g, msg: 'important-modifier sizing — use icon-xs/sm/md/lg/xl on icons, or a type token' },
  { id: 'weight', rx: /(?<![\w-])font-(?:bold|extrabold|black)(?![\w-])/g, msg: 'use font-semibold (headings/emphasis) or font-medium' },
  { id: 'gradient', rx: /(?<![\w-])bg-gradient-to-/g, msg: 'no gradients — flat surfaces only' },
  { id: 'native-dialog', rx: /(?<![\w.])(?:confirm|alert|prompt)\(/g, msg: 'native browser dialog — use ConfirmService / ToastService', skipComments: true },
  { id: 'hex', rx: /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b(?![0-9a-fA-F])/g, msg: 'hard-coded colour — use a CSS variable (var(--color-…)) or identityColor()', hex: true },
  { id: 'rgb', rx: /\brgba?\(\s*\d/g, msg: 'hard-coded rgb() colour — use a token', hex: true },
];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|html)$/.test(name) && !name.endsWith('.spec.ts')) out.push(p);
  }
  return out;
}

const problems = [];
for (const file of walk(SRC)) {
  const rel = relative(ROOT, file);
  const text = readFileSync(file, 'utf8');
  const lines = text.split('\n');
  for (const rule of rules) {
    if (rule.hex && HEX_ALLOWED.has(rel)) continue;
    lines.forEach((line, i) => {
      const code = rule.skipComments ? line.replace(/\/\/.*$|\/\*.*?\*\/|`[^`]*(?:confirm|alert)\([^`]*`/g, '') : line;
      if (rule.skipComments && /^\s*(\*|\/\/)/.test(line)) return;
      rule.rx.lastIndex = 0;
      let m;
      while ((m = rule.rx.exec(code))) {
        // HTML entities such as &#8203; are not colours
        if (rule.hex && code[m.index - 1] === '&') continue;
        problems.push(`${rel}:${i + 1}  [${rule.id}] ${m[0]} — ${rule.msg}`);
      }
    });
  }
}

// Dark-theme parity: the prefers-color-scheme block and [data-theme="dark"] must declare the same tokens.
const css = readFileSync(join(ROOT, 'src/styles.css'), 'utf8');
const decls = (block) => block.split('\n').map(l => l.trim()).filter(l => l.startsWith('--')).sort().join('\n');
const media = css.match(/@media \(prefers-color-scheme: dark\) \{\s*:root:not\(\[data-theme\]\),\s*:root\[data-theme="system"\] \{([\s\S]*?)\n  \}\n\}/);
const explicit = css.match(/:root\[data-theme="dark"\] \{([\s\S]*?)\n\}/);
if (!media || !explicit) problems.push('src/styles.css  [dark-parity] could not locate both dark token blocks');
else if (decls(media[1]) !== decls(explicit[1])) problems.push('src/styles.css  [dark-parity] the two dark-theme token blocks differ — keep them identical');

if (problems.length) {
  console.error(problems.join('\n'));
  console.error(`\n✖ ${problems.length} design-system violation${problems.length === 1 ? '' : 's'} (see DESIGN_SYSTEM.md)`);
  process.exit(1);
}
console.log('✔ design-system check passed');
