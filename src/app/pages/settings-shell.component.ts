import { Component, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { CrmStateService } from '../services/crm-state.service';

@Component({
  selector: 'app-settings-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, MatIconModule],
  template: `
    <div class="space-y-8 font-sans">
      <div class="flex gap-5 sm:gap-6 border-b border-zinc-200">
        <a
          routerLink="/settings/organization"
          routerLinkActive="border-zinc-900 text-zinc-900"
          [routerLinkActiveOptions]="{ exact: true }"
          class="px-1 py-3 -mb-px border-b-2 border-transparent text-zinc-400 hover:text-zinc-600 text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap"
        >
          <mat-icon class="text-[18px] w-[18px] h-[18px]">business</mat-icon>
          Organization
        </a>
        @if (state.currentUserPermissions().canManageUsers) {
          <a
            routerLink="/settings/users"
            routerLinkActive="border-zinc-900 text-zinc-900"
            class="px-1 py-3 -mb-px border-b-2 border-transparent text-zinc-400 hover:text-zinc-600 text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap"
          >
            <mat-icon class="text-[18px] w-[18px] h-[18px]">group</mat-icon>
            Users
          </a>
        }
        @if (state.currentUserPermissions().canManageTeams) {
          <a
            routerLink="/settings/teams"
            routerLinkActive="border-zinc-900 text-zinc-900"
            class="px-1 py-3 -mb-px border-b-2 border-transparent text-zinc-400 hover:text-zinc-600 text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap"
          >
            <mat-icon class="text-[18px] w-[18px] h-[18px]">groups</mat-icon>
            Teams
          </a>
        }
        <a
          routerLink="/settings/groups"
          routerLinkActive="border-zinc-900 text-zinc-900"
          class="px-1 py-3 -mb-px border-b-2 border-transparent text-zinc-400 hover:text-zinc-600 text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap"
        >
          <mat-icon class="text-[18px] w-[18px] h-[18px]">forum</mat-icon>
          Groups
        </a>
      </div>

      <router-outlet></router-outlet>
    </div>
  `
})
export class SettingsShellComponent {
  state = inject(CrmStateService);
}
