import type { PostingGroup, VatSetupRow } from './ledger.service';

/**
 * VAT determination (general ledger phase 3), the same order the API applies when it saves a
 * document line:
 *  1. the line's own vatCode, when the user set one;
 *  2. the partner's business group (null = the default group) when its rule is EXEMPT: its exemptVatCode;
 *  3. the product's vatCode;
 *  4. the product group's vatCode: the line's override, else the product's group, else the default group;
 *  5. TVA20.
 */

/** A VAT code as forms offer it. `rate` is a percentage (20), as the posting setup holds it. */
export interface VatCode {
  code: string;
  name: string;
  rate: number;
  exempt: boolean;
  mention?: string | null;
}

export const DEFAULT_VAT_CODE = 'TVA20';

/** The codes the server seeds, for users who cannot read the posting setup. */
export const FALLBACK_VAT_CODES: VatCode[] = [
  { code: 'TVA20', name: 'TVA 20 %', rate: 20, exempt: false },
  { code: 'TVA14', name: 'TVA 14 %', rate: 14, exempt: false },
  { code: 'TVA10', name: 'TVA 10 %', rate: 10, exempt: false },
  { code: 'TVA7', name: 'TVA 7 %', rate: 7, exempt: false },
  { code: 'TVA0', name: 'TVA 0 %', rate: 0, exempt: false },
  { code: 'EXONERE', name: 'Exonéré', rate: 0, exempt: true },
  { code: 'EXPORT', name: 'Export (exonéré)', rate: 0, exempt: true },
];

export function vatCodesFrom(rows: VatSetupRow[] | null | undefined): VatCode[] {
  const list = (rows ?? []).map(r => ({
    code: r.code, name: r.name, rate: Number(r.rate) || 0, exempt: !!r.exempt, mention: r.mention ?? null,
  }));
  return list.length ? list : FALLBACK_VAT_CODES;
}

/** What determination needs to know about a product. */
export interface VatProduct {
  vatCode?: string | null;
  productGroupId?: string | null;
}

export interface VatContext {
  codes: VatCode[];
  businessGroups: PostingGroup[];
  productGroups: PostingGroup[];
}

export interface VatLineInput {
  /** Set only when the user chose the code by hand. */
  manualVatCode?: string | null;
  /** The partner's business group; null = the default group. */
  businessGroupId?: string | null;
  product?: VatProduct | null;
  /** The line's product group override. */
  productGroupId?: string | null;
}

function known(ctx: VatContext, code: string | null | undefined): code is string {
  return !!code && ctx.codes.some(c => c.code === code);
}

export function determineVatCode(ctx: VatContext, l: VatLineInput): string {
  if (known(ctx, l.manualVatCode)) return l.manualVatCode;
  const bg = (l.businessGroupId && ctx.businessGroups.find(g => g.id === l.businessGroupId))
    || ctx.businessGroups.find(g => g.isDefault);
  if (bg?.vatRule === 'EXEMPT' && known(ctx, bg.exemptVatCode)) return bg.exemptVatCode;
  if (known(ctx, l.product?.vatCode)) return l.product!.vatCode!;
  const groupId = l.productGroupId || l.product?.productGroupId || null;
  const pg = (groupId && ctx.productGroups.find(g => g.id === groupId)) || ctx.productGroups.find(g => g.isDefault);
  if (known(ctx, pg?.vatCode)) return pg!.vatCode!;
  return known(ctx, DEFAULT_VAT_CODE) ? DEFAULT_VAT_CODE : (ctx.codes[0]?.code ?? DEFAULT_VAT_CODE);
}

export function findVatCode(codes: VatCode[], code: string | null | undefined): VatCode | undefined {
  return code ? codes.find(c => c.code === code) : undefined;
}

/** The fraction a line stores as vatRate (0.20); exempt codes are 0. */
export function vatFraction(codes: VatCode[], code: string | null | undefined): number {
  const c = findVatCode(codes, code);
  if (!c || c.exempt) return 0;
  return Math.round(c.rate * 100) / 10000;
}

/** Old lines carry only a rate: the code is matched by rate (0 maps to TVA0). */
export function vatCodeForRate(codes: VatCode[], fraction: number | null | undefined): string | null {
  if (fraction === null || fraction === undefined) return null;
  const pct = Math.round(Number(fraction) * 10000) / 100;
  return codes.find(c => !c.exempt && Math.abs(c.rate - pct) < 0.001)?.code ?? null;
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export interface VatBreakdownRow {
  vatCode: string;
  /** A percentage, as on the posting setup. */
  rate: number;
  base: number;
  vat: number;
  mention?: string | null;
}

/** One row per VAT code used by the lines, in the order the codes are listed. */
export function vatBreakdown(codes: VatCode[], lines: { base: number; vatCode: string | null | undefined }[]): VatBreakdownRow[] {
  const by = new Map<string, number>();
  for (const l of lines) {
    const code = l.vatCode || DEFAULT_VAT_CODE;
    by.set(code, (by.get(code) ?? 0) + (Number(l.base) || 0));
  }
  const order = (code: string) => {
    const i = codes.findIndex(c => c.code === code);
    return i < 0 ? codes.length : i;
  };
  return [...by.entries()]
    .sort((a, b) => order(a[0]) - order(b[0]))
    .map(([vatCode, base]) => {
      const c = findVatCode(codes, vatCode);
      return {
        vatCode,
        rate: c && !c.exempt ? c.rate : 0,
        base: round2(base),
        vat: round2(base * vatFraction(codes, vatCode)),
        mention: c?.mention ?? null,
      };
    });
}
