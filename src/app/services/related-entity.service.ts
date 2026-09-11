import { inject, Injectable } from '@angular/core';
import { CrmStateService } from './crm-state.service';
import {
  EntityLink,
  RELATED_ENTITY_KINDS,
  RelatedEntityKind,
  RelatedEntityOption,
  RelatedEntityType,
  findKind,
} from '../shared/related-entity.model';

/**
 * Resolves the optional links tasks and tickets carry against the records they point at:
 * which records can be picked for a given kind, and how to label a link that is already set.
 *
 * Kept out of `CrmStateService` deliberately — it only reads the record collections, so keeping
 * it separate stops the link vocabulary leaking into the (already very large) state service, and
 * lets the picker/summary components depend on this narrow surface instead of all of the CRM.
 */
@Injectable({ providedIn: 'root' })
export class RelatedEntityService {
  private state = inject(CrmStateService);

  readonly kinds = RELATED_ENTITY_KINDS;

  kindsFor(keys?: readonly string[]): RelatedEntityKind[] {
    if (!keys) return [...RELATED_ENTITY_KINDS];
    return keys.map(key => findKind(key)).filter((k): k is RelatedEntityKind => !!k);
  }

  /** The records that can be linked for a given kind, ready for a `<select>`. */
  optionsFor(kindKey: string | null | undefined): RelatedEntityOption[] {
    const kind = findKind(kindKey);
    if (!kind) return [];

    if (kind.partnerType) {
      return this.state.partners()
        .filter(p => p.type === kind.partnerType)
        .map(p => ({ id: p.id, label: p.name }));
    }

    switch (kind.type) {
      case 'DEAL':
        return this.state.deals().map(d => ({ id: d.id, label: d.title }));
      case 'PROPOSAL':
        return this.state.proposals().map(p => ({ id: p.id, label: p.title }));
      case 'PURCHASE_ORDER':
        return this.state.purchaseOrders().map(po => ({ id: po.id, label: `PO #${po.id}` }));
      case 'INVOICE':
        return this.state.invoices().map(i => ({ id: i.id, label: `Invoice #${i.id}` }));
      case 'TICKET':
        return this.state.tickets().map(t => ({ id: t.id, label: t.title }));
      case 'CAMPAIGN':
        return this.state.campaigns().map(c => ({ id: c.id, label: c.title }));
      default:
        return [];
    }
  }

  /**
   * The kind a stored link represents. Partner links carry no sub-type of their own, so the
   * partner's `type` is what tells a customer link from a prospect one.
   */
  kindOfLink(link: EntityLink | null | undefined): RelatedEntityKind | undefined {
    if (!link?.relatedEntityType || !link.relatedEntityId) return undefined;
    if (link.relatedEntityType === 'PARTNER') {
      const partner = this.state.partners().find(p => p.id === link.relatedEntityId);
      const byPartnerType = partner
        ? RELATED_ENTITY_KINDS.find(k => k.partnerType === partner.type)
        : undefined;
      return byPartnerType ?? RELATED_ENTITY_KINDS.find(k => k.type === 'PARTNER');
    }
    return RELATED_ENTITY_KINDS.find(k => k.type === link.relatedEntityType);
  }

  /** Human-readable name of the linked record, or `null` when there is no link. */
  labelOfLink(link: EntityLink | null | undefined): string | null {
    const kind = this.kindOfLink(link);
    if (!kind) return null;
    const match = this.optionsFor(kind.key).find(o => o.id === link!.relatedEntityId);
    // A link can outlive the record it points at (deleted, or not loaded yet); showing the kind
    // is more useful than showing a raw id.
    return match ? match.label : kind.label;
  }

  iconOfLink(link: EntityLink | null | undefined): string {
    return this.kindOfLink(link)?.icon ?? 'link';
  }

  /** The link that points at a given record, for the "what's attached to me" panels. */
  linkTo(type: RelatedEntityType, id: string): EntityLink {
    return { relatedEntityType: type, relatedEntityId: id };
  }
}
