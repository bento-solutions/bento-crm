import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { CrmStateService } from '../../services/crm-state.service';
import { LedgerApi, PostingSourceType } from '../../services/domains/ledger.service';

/**
 * "View journal entry" on a document (invoice, bill, payment, expense, bank line): asks the ledger
 * for the document's live entry and links to it on the Journal entries tab. Shows nothing while it
 * asks, when the user cannot read the ledger, or when the document has no entry (404).
 */
@Component({
  selector: 'app-ledger-entry-link',
  imports: [MatIconModule, RouterLink, TranslatePipe],
  template: `
    @if (entryId(); as id) {
      @if (compact()) {
        <a class="btn-icon btn-sm" [routerLink]="'/ledger'" [queryParams]="{ tab: 'entries', entry: id }"
           [attr.title]="'ledger.viewEntry' | translate" [attr.aria-label]="'ledger.viewEntry' | translate"><mat-icon class="icon-sm">menu_book</mat-icon></a>
      } @else {
        <a class="btn-ghost btn-sm" [routerLink]="'/ledger'" [queryParams]="{ tab: 'entries', entry: id }">
          <mat-icon>menu_book</mat-icon>{{ 'ledger.viewEntry' | translate }}@if (entryNumber()) { <span class="num text-ink-3">{{ entryNumber() }}</span> }</a>
      }
    }
  `,
  styles: [':host { display: contents; }'],
})
export class LedgerEntryLinkComponent {
  private api = inject(LedgerApi);
  private state = inject(CrmStateService);

  sourceType = input.required<PostingSourceType>();
  sourceId = input<string | null | undefined>(null);
  /** An icon button for table rows; otherwise a labelled ghost button. */
  compact = input(false);

  entryId = signal<string | null>(null);
  entryNumber = signal<string | null>(null);

  constructor() {
    effect(() => {
      const type = this.sourceType();
      const id = this.sourceId();
      untracked(() => this.lookUp(type, id));
    });
  }

  private lookUp(type: PostingSourceType, id: string | null | undefined): void {
    this.entryId.set(null);
    this.entryNumber.set(null);
    if (!id || !this.state.hasAuthority('LEDGER_READ')) return;
    this.api.sourceEntry(type, id).subscribe({
      next: e => {
        // Ignore an answer for a document the input has moved away from.
        if (this.sourceId() !== id || !e?.id) return;
        this.entryId.set(e.id);
        this.entryNumber.set(e.number ?? null);
      },
      error: () => { /* 404: not posted (yet), so no link */ },
    });
  }
}
