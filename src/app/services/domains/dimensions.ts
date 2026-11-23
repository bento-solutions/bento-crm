/**
 * Analytic dimensions: Mission, Deal, Customer and Vendor, all optional, carried by expenses,
 * expense-report lines, supplier bill lines and the expense (class 6) lines of ledger entries.
 *
 * The API was built alongside these screens. Every field and query-parameter name it uses for the
 * dimensions is in this file and nowhere else: a renamed field is fixed here only.
 */

export type DimensionKey = 'missionId' | 'dealId' | 'customerId' | 'vendorId';
export const DIMENSION_KEYS: DimensionKey[] = ['missionId', 'dealId', 'customerId', 'vendorId'];

export interface Dimensions {
  missionId: string | null;
  dealId: string | null;
  customerId: string | null;
  vendorId: string | null;
}

/** The display names the API sends with the ids, when it can. */
export interface DimensionNames {
  missionName?: string | null;
  dealName?: string | null;
  customerName?: string | null;
  vendorName?: string | null;
}

export type DimensionValues = Dimensions & DimensionNames;

/** A filter on the dimensions (and the cost center) of ledger lines. */
export interface DimensionFilter {
  missionId?: string | null;
  dealId?: string | null;
  customerId?: string | null;
  vendorId?: string | null;
  costCenterId?: string | null;
}

/** The JSON field each dimension is read from (first match wins) and written to. */
const RESPONSE_FIELDS: Record<DimensionKey, { id: string[]; name: string[] }> = {
  missionId: { id: ['missionId'], name: ['missionName'] },
  dealId: { id: ['dealId'], name: ['dealName', 'dealNumber', 'dealTitle'] },
  customerId: { id: ['customerId'], name: ['customerName'] },
  // On an expense the Vendor dimension is the expense's vendor partner (vendor_partner_id).
  vendorId: { id: ['vendorId', 'vendorPartnerId'], name: ['vendorPartnerName', 'vendorDisplayName'] },
};
const NAME_OF: Record<DimensionKey, keyof DimensionNames> = {
  missionId: 'missionName', dealId: 'dealName', customerId: 'customerName', vendorId: 'vendorName',
};
const REQUEST_FIELDS: Record<DimensionKey, string[]> = {
  missionId: ['missionId'],
  dealId: ['dealId'],
  customerId: ['customerId'],
  vendorId: ['vendorId'],
};
/** On an expense, the vendor dimension is also sent as the vendor partner it reuses. */
const EXPENSE_VENDOR_ALIAS = 'vendorPartnerId';
const QUERY_PARAMS: Record<keyof DimensionFilter, string> = {
  missionId: 'missionId', dealId: 'dealId', customerId: 'customerId', vendorId: 'vendorId', costCenterId: 'costCenterId',
};

type Raw = Record<string, unknown> | null | undefined;

function first(r: Raw, keys: string[]): string | null {
  if (!r) return null;
  for (const k of keys) {
    const v = r[k];
    if (v !== undefined && v !== null && v !== '') return String(v);
  }
  return null;
}

export function emptyDimensions(): Dimensions {
  return { missionId: null, dealId: null, customerId: null, vendorId: null };
}

/**
 * The dimensions of an expense, a report line, a bill line or a ledger line, as the API sends them.
 * `vendorName` on an expense is the free-text supplier name, not the Vendor dimension's, so it is
 * read only where the line has a vendorId of its own.
 */
export function dimensionsFromApi(r: Raw): DimensionValues {
  const out: DimensionValues = emptyDimensions();
  for (const k of DIMENSION_KEYS) {
    out[k] = first(r, RESPONSE_FIELDS[k].id);
    const nameKeys = k === 'vendorId' && r && r['vendorId'] !== undefined ? ['vendorName', ...RESPONSE_FIELDS[k].name] : RESPONSE_FIELDS[k].name;
    out[NAME_OF[k]] = first(r, nameKeys);
  }
  return out;
}

/** The dimensions as a request body takes them (null clears one: PUT replaces the document). */
export function dimensionsToApi(d: Partial<Dimensions> | null | undefined, opts: { expense?: boolean } = {}): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const k of DIMENSION_KEYS) for (const f of REQUEST_FIELDS[k]) out[f] = d?.[k] ?? null;
  if (opts.expense) out[EXPENSE_VENDOR_ALIAS] = d?.vendorId ?? null;
  return out;
}

/** The non-empty filters as query parameters. */
export function dimensionQuery(f: DimensionFilter | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!f) return out;
  for (const k of Object.keys(QUERY_PARAMS) as (keyof DimensionFilter)[]) {
    const v = f[k];
    if (v !== null && v !== undefined && String(v).trim() !== '') out[QUERY_PARAMS[k]] = String(v).trim();
  }
  return out;
}

export function hasDimensions(d: Partial<Dimensions> | null | undefined): boolean {
  return !!d && DIMENSION_KEYS.some(k => !!d[k]);
}

/** GET /missions/{id}/summary → costsByCostCenter. */
export interface CostCenterCost {
  costCenterId: string | null;
  code: string | null;
  name: string | null;
  amount: number;
}

export function costsByCostCenterFromApi(r: Raw): CostCenterCost[] {
  const list = (r?.['costsByCostCenter'] ?? r?.['costCenters']) as Raw[] | undefined;
  if (!Array.isArray(list)) return [];
  return list.map(c => ({
    costCenterId: first(c, ['costCenterId', 'id']),
    code: first(c, ['code', 'costCenterCode']),
    name: first(c, ['name', 'costCenterName']),
    amount: Number(c?.['amount'] ?? 0) || 0,
  }));
}
