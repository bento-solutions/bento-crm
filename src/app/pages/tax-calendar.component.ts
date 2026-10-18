import { Component, OnInit, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe } from '../pipes/translate.pipe';
import { TranslationService } from '../services/translation.service';
import { CrmStateService } from '../services/crm-state.service';
import { PageHeaderComponent } from '../shared/ui/page-header.component';
import { TaxDeadlinesComponent } from './tax/tax-deadlines.component';
import { TaxProfilesComponent } from './tax/tax-profiles.component';

type Tab = 'deadlines' | 'profiles';
const TABS: Tab[] = ['deadlines', 'profiles'];

/**
 * Tax calendar: the Moroccan filing deadlines (TVA, IS, IR, CNSS) of the company and of each
 * client, generated from their tax profiles, with what was filed and paid.
 */
@Component({
  selector: 'app-tax-calendar',
  imports: [MatIconModule, TranslatePipe, PageHeaderComponent, TaxDeadlinesComponent, TaxProfilesComponent],
  template: `
    <div class="page">
      <app-page-header [title]="'tax.title' | translate" [subtitle]="'tax.subtitle' | translate" />

      <div class="tabs" role="tablist">
        @for (t of tabs; track t.key) {
          <button role="tab" class="tab" [class.is-active]="tab() === t.key" [attr.aria-selected]="tab() === t.key" (click)="setTab(t.key)">
            <mat-icon>{{ t.icon }}</mat-icon>{{ t.label | translate }}
          </button>
        }
      </div>

      <p class="text-xs text-ink-3 flex items-start gap-1 mb-4"><mat-icon class="icon-xs shrink-0">info</mat-icon><span>{{ 'tax.disclaimer' | translate }}</span></p>

      @switch (tab()) {
        @case ('deadlines') { <app-tax-deadlines (setup)="setTab('profiles')" /> }
        @case ('profiles') { <app-tax-profiles /> }
      }
    </div>
  `,
})
export class TaxCalendarComponent implements OnInit {
  private i18n = inject(TranslationService);
  private state = inject(CrmStateService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'deadlines', label: 'tax.tab.deadlines', icon: 'event' },
    { key: 'profiles', label: 'tax.tab.profiles', icon: 'tune' },
  ];

  tab = signal<Tab>('deadlines');

  ngOnInit(): void {
    this.state.breadcrumbLabel.set(this.i18n.t('tax.title'));
    const t = this.route.snapshot.queryParamMap.get('tab') as Tab | null;
    if (t && TABS.includes(t)) this.tab.set(t);
  }

  setTab(t: Tab): void {
    this.tab.set(t);
    this.router.navigate([], { queryParams: { tab: t === 'deadlines' ? null : t }, replaceUrl: true });
  }
}
