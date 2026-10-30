import { Component, OnInit, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { TranslationService } from '../../services/translation.service';
import { errorDetail } from '../../pages/bank/bank-labels';
import { shortDate } from '../../shared/bank.util';
import { PortalApi, PortalDeliverable, PortalMission, saveBlob } from '../portal-api.service';

/** The work the firm does for the client, and what it delivered (with the files to download). */
@Component({
  selector: 'app-portal-missions',
  imports: [MatIconModule, TranslatePipe],
  template: `
    <div class="space-y-4">
      <h1 class="t-title">{{ 'portal.missions.title' | translate }}</h1>
      @if (error()) { <div class="alert alert-danger text-sm">{{ error() }}</div> }
      @if (loaded() && missions().length === 0) {
        <div class="card p-8 text-center text-sm text-ink-3">{{ 'portal.missions.empty' | translate }}</div>
      }
      @for (m of missions(); track m.id) {
        <section class="card p-4 space-y-3">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <h2 class="text-sm font-semibold text-ink break-words">{{ m.name }}</h2>
              <p class="text-xs text-ink-3">{{ date(m.startDate) }} → {{ date(m.dueDate) }}</p>
            </div>
            <span class="badge shrink-0" [class]="missionBadge(m.status)">{{ ('missions.statusName.' + m.status) | translate }}</span>
          </div>
          @if ((m.deliverables ?? []).length) {
            <ul class="divide-y divide-line border-t border-line">
              @for (x of m.deliverables ?? []; track x.id) {
                <li class="py-2 flex items-center justify-between gap-3">
                  <div class="min-w-0">
                    <div class="text-sm text-ink break-words">{{ x.title }}</div>
                    <div class="text-xs text-ink-3">
                      @if (x.status === 'DELIVERED' && x.deliveredAt) { {{ 'missions.deliveredOn' | translate: { date: date(x.deliveredAt) } }} }
                      @else if (x.dueDate) { {{ 'missions.dueOn' | translate: { date: date(x.dueDate) } }} }
                      @else { {{ ('missions.deliverableStatus.' + x.status) | translate }} }
                    </div>
                  </div>
                  @if (x.hasFile) {
                    <button class="btn-secondary btn-sm shrink-0" [disabled]="busy() === x.id" (click)="download(x)"><mat-icon>download</mat-icon>{{ 'portal.missions.download' | translate }}</button>
                  } @else {
                    <span class="badge shrink-0" [class]="x.status === 'DELIVERED' ? 'badge-success' : 'badge-neutral'">{{ ('missions.deliverableStatus.' + x.status) | translate }}</span>
                  }
                </li>
              }
            </ul>
          }
        </section>
      }
    </div>
  `,
})
export class PortalMissionsComponent implements OnInit {
  private api = inject(PortalApi);
  private i18n = inject(TranslationService);

  missions = signal<PortalMission[]>([]);
  loaded = signal(false);
  busy = signal<string | null>(null);
  error = signal<string | null>(null);

  ngOnInit(): void {
    this.api.missions().subscribe({
      next: m => { this.missions.set(m ?? []); this.loaded.set(true); },
      error: e => this.fail(e),
    });
  }

  download(x: PortalDeliverable): void {
    this.busy.set(x.id);
    this.api.deliverableFile(x.id).subscribe({
      next: blob => { this.busy.set(null); saveBlob(blob, x.fileName || x.title || 'document'); },
      error: e => { this.busy.set(null); this.fail(e); },
    });
  }

  missionBadge(s: string): string {
    return s === 'IN_PROGRESS' ? 'badge-info' : s === 'DONE' ? 'badge-success' : s === 'CANCELLED' ? 'badge-neutral' : 'badge-warning';
  }

  date(iso: string | null | undefined): string { return shortDate(iso); }

  private fail(e: unknown): void {
    this.error.set(errorDetail(e) || this.i18n.t('portal.error'));
  }
}
