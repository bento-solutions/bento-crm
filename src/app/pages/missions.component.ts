import { Component, OnInit, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe } from '../pipes/translate.pipe';
import { TranslationService } from '../services/translation.service';
import { CrmStateService } from '../services/crm-state.service';
import { PageHeaderComponent } from '../shared/ui/page-header.component';
import { DisbursementQuery } from '../services/domains/mission.service';
import { MissionListComponent } from './missions/mission-list.component';
import { MissionCostsComponent } from './missions/mission-costs.component';

type Tab = 'missions' | 'costs';
const TABS: Tab[] = ['missions', 'costs'];

/**
 * Missions: the work done for each client (with its deliverables), and the costs paid on the
 * client's behalf (débours) that are billed back at cost.
 */
@Component({
  selector: 'app-missions',
  imports: [MatIconModule, TranslatePipe, PageHeaderComponent, MissionListComponent, MissionCostsComponent],
  template: `
    <div class="page">
      <app-page-header [title]="'missions.title' | translate" [subtitle]="'missions.subtitle' | translate" />

      <div class="tabs" role="tablist">
        @for (t of tabs; track t.key) {
          <button role="tab" class="tab" [class.is-active]="tab() === t.key" [attr.aria-selected]="tab() === t.key" (click)="setTab(t.key)">
            <mat-icon>{{ t.icon }}</mat-icon>{{ t.label | translate }}
          </button>
        }
      </div>

      @switch (tab()) {
        @case ('missions') { <app-mission-list (openCosts)="openCosts($event)" /> }
        @case ('costs') { <app-mission-costs [initialFilter]="costFilter()" /> }
      }
    </div>
  `,
})
export class MissionsComponent implements OnInit {
  private i18n = inject(TranslationService);
  private state = inject(CrmStateService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'missions', label: 'missions.tab.missions', icon: 'work' },
    { key: 'costs', label: 'missions.tab.costs', icon: 'receipt' },
  ];

  tab = signal<Tab>('missions');
  costFilter = signal<DisbursementQuery | null>(null);

  ngOnInit(): void {
    this.state.breadcrumbLabel.set(this.i18n.t('missions.title'));
    const t = this.route.snapshot.queryParamMap.get('tab') as Tab | null;
    if (t && TABS.includes(t)) this.tab.set(t);
  }

  setTab(t: Tab): void {
    this.costFilter.set(null);
    this.tab.set(t);
    this.router.navigate([], { queryParams: { tab: t === 'missions' ? null : t }, replaceUrl: true });
  }

  /** From a mission's panel: the Costs tab, filtered to that mission. */
  openCosts(filter: DisbursementQuery): void {
    this.setTab('costs');
    this.costFilter.set(filter);
  }
}
