import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { CrmStateService } from '../services/crm-state.service';
import { RelatedWorkComponent } from '../shared/related-work.component';
import { PartnerLedgerComponent } from '../shared/partner-ledger.component';

/**
 * The vendor counterpart of the customer card.
 *
 * Vendors previously had no detail view at all, so this is deliberately a read-only identity
 * summary plus the account ledger — the payables side of the same data the customer card shows
 * on the receivables side.
 */
@Component({
  selector: 'app-supplier-card',
  imports: [CommonModule, MatIconModule, RelatedWorkComponent, PartnerLedgerComponent],
  template: `
    <div class="max-w-7xl mx-auto space-y-6 pb-12">

      <div class="bg-zinc-100 rounded-2xl p-5 flex items-center justify-between flex-wrap gap-4">
        <div class="flex items-center gap-4">
          <button (click)="goBack()" (keydown.escape)="goBack()" title="Go back" class="w-10 h-10 rounded-xl btn-secondary flex items-center justify-center text-zinc-400 hover:text-zinc-900 transition-all">
            <mat-icon class="text-[22px]">arrow_back</mat-icon>
          </button>
          <div>
            <h2 class="text-xl font-bold text-zinc-900">{{ partner()?.name || 'Supplier' }}</h2>
            <span class="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Supplier Card</span>
          </div>
        </div>
      </div>

      @if (partner(); as supplier) {
        <section class="card rounded-2xl p-6 space-y-5">
          <div class="flex items-center gap-2.5 pb-3 border-b border-white/30">
            <div class="w-8 h-8 rounded-lg bg-zinc-200/60 text-zinc-900 flex items-center justify-center">
              <mat-icon class="text-[18px]">store</mat-icon>
            </div>
            <h3 class="text-base font-bold text-zinc-800">1. Supplier Details</h3>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <span class="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Name</span>
              <span class="text-sm text-zinc-900 font-medium">{{ supplier.name }}</span>
            </div>
            <div>
              <span class="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Email</span>
              <span class="text-sm text-zinc-700">{{ supplier.email || '—' }}</span>
            </div>
            <div>
              <span class="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Phone</span>
              <span class="text-sm text-zinc-700 font-mono">{{ supplier.phone || '—' }}</span>
            </div>
            <div>
              <span class="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">City</span>
              <span class="text-sm text-zinc-700">{{ supplier.city || '—' }}</span>
            </div>
            @if (supplier.comments) {
              <div class="md:col-span-2 lg:col-span-4">
                <span class="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Notes</span>
                <span class="text-sm text-zinc-700">{{ supplier.comments }}</span>
              </div>
            }
          </div>
        </section>

        <app-partner-ledger [partnerId]="partnerId()" mode="supplier" />

        <section class="card rounded-2xl p-6 space-y-5">
          <div class="flex items-center gap-2.5 pb-3 border-b border-white/30">
            <div class="w-8 h-8 rounded-lg bg-zinc-200/60 text-zinc-900 flex items-center justify-center">
              <mat-icon class="text-[18px]">assignment</mat-icon>
            </div>
            <h3 class="text-base font-bold text-zinc-800">3. Tasks &amp; Tickets</h3>
          </div>
          <app-related-work entityType="PARTNER" [entityId]="partnerId()" />
        </section>
      } @else {
        <div class="card rounded-2xl p-12 text-center text-zinc-500">Supplier not found.</div>
      }
    </div>
  `,
})
export class SupplierCardComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  state = inject(CrmStateService);

  partnerId = signal('');

  partner = computed(() => this.state.partners().find(p => p.id === this.partnerId()) ?? null);

  ngOnInit() {
    this.route.paramMap.subscribe(params => this.partnerId.set(params.get('id') || ''));
  }

  goBack() {
    this.router.navigate(['/partners']);
  }
}
