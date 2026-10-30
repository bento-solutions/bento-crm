import { Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '../pipes/translate.pipe';
import { PortalLanguageComponent } from './portal-language.component';

/** The centred card the portal's sign-in, invitation and password pages share. */
@Component({
  selector: 'app-portal-auth-frame',
  imports: [MatIconModule, TranslatePipe, PortalLanguageComponent],
  template: `
    <div class="min-h-screen bg-canvas flex items-start sm:items-center justify-center px-4 py-8">
      <div class="w-full max-w-md space-y-4">
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-2 min-w-0">
            <span class="icon-chip shrink-0"><mat-icon>lock</mat-icon></span>
            <span class="text-sm font-semibold text-ink truncate">{{ 'portal.title' | translate }}</span>
          </div>
          <app-portal-language />
        </div>
        <div class="card p-6 sm:p-8 space-y-5">
          <div class="space-y-1">
            <h1 class="t-title">{{ heading() }}</h1>
            @if (subheading()) { <p class="text-sm text-ink-3">{{ subheading() }}</p> }
          </div>
          <ng-content />
        </div>
      </div>
    </div>
  `,
})
export class PortalAuthFrameComponent {
  heading = input.required<string>();
  subheading = input<string>('');
}
