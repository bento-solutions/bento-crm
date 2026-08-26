/**
 * The optional link a task or ticket carries to the record it concerns.
 *
 * `RelatedEntityType` mirrors the backend enum of the same name and is what gets persisted;
 * `RelatedEntityKind` is the finer-grained choice the user actually makes in the UI. Several
 * kinds collapse onto one persisted type — a customer, prospect, lead and vendor are all rows
 * of `partner`, so they all persist as `PARTNER` and are told apart by the partner's own type.
 */
export type RelatedEntityType =
  | 'PARTNER'
  | 'DEAL'
  | 'PROPOSAL'
  | 'PURCHASE_ORDER'
  | 'INVOICE'
  | 'TICKET'
  | 'CAMPAIGN'
  | 'TASK';

/** Flat link pair, matching the wire format of the tasks/tickets API. */
export interface EntityLink {
  relatedEntityType?: RelatedEntityType | null;
  relatedEntityId?: string | null;
}

export interface RelatedEntityKind {
  /** Stable key used by the picker's `<select>`. */
  key: string;
  label: string;
  /** What this kind persists as. */
  type: RelatedEntityType;
  /** For kinds backed by `partner`, the partner type they narrow to. */
  partnerType?: 'Lead' | 'Prospect' | 'Customer' | 'Vendor';
  icon: string;
}

/**
 * Every kind a task or ticket can be attached to, in the order the picker offers them.
 * Order matters for `kindOfLink()`: the first kind matching a persisted type is used as the
 * fallback when the record itself can no longer be found.
 */
export const RELATED_ENTITY_KINDS: readonly RelatedEntityKind[] = [
  { key: 'DEAL', label: 'Deal', type: 'DEAL', icon: 'handshake' },
  { key: 'PROPOSAL', label: 'Proposal', type: 'PROPOSAL', icon: 'description' },
  { key: 'CUSTOMER', label: 'Customer', type: 'PARTNER', partnerType: 'Customer', icon: 'business_center' },
  { key: 'PROSPECT', label: 'Prospect', type: 'PARTNER', partnerType: 'Prospect', icon: 'person_search' },
  { key: 'LEAD', label: 'Lead', type: 'PARTNER', partnerType: 'Lead', icon: 'person_add' },
  { key: 'VENDOR', label: 'Vendor', type: 'PARTNER', partnerType: 'Vendor', icon: 'local_shipping' },
  { key: 'TICKET', label: 'Ticket', type: 'TICKET', icon: 'confirmation_number' },
  { key: 'PURCHASE_ORDER', label: 'Purchase Order', type: 'PURCHASE_ORDER', icon: 'receipt_long' },
  { key: 'INVOICE', label: 'Invoice', type: 'INVOICE', icon: 'request_quote' },
  { key: 'CAMPAIGN', label: 'Campaign', type: 'CAMPAIGN', icon: 'campaign' },
];

/**
 * Kinds offered when linking a ticket: the deal/proposal/customer/prospect a ticket is raised
 * against, plus the two remaining partner flavours so no existing partner link is left without
 * a matching option in the picker.
 */
export const TICKET_RELATED_ENTITY_KEYS = [
  'DEAL', 'PROPOSAL', 'CUSTOMER', 'PROSPECT', 'LEAD', 'VENDOR',
] as const;

export function findKind(key: string | null | undefined): RelatedEntityKind | undefined {
  return RELATED_ENTITY_KINDS.find(k => k.key === key);
}

export interface RelatedEntityOption {
  id: string;
  label: string;
}

/** True when both halves are set — a half-filled link is rejected by the API. */
export function isLinked(link: EntityLink | null | undefined): boolean {
  return !!link?.relatedEntityType && !!link?.relatedEntityId;
}
