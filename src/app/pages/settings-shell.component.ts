import { Component, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { CrmStateService } from '../services/crm-state.service';
import { PageHeaderComponent } from '../shared/ui/page-header.component';

@Component({
  selector: 'app-settings-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, MatIconModule, PageHeaderComponent],
  template: `
    <div class="page">
      <app-page-header title="Settings" subtitle="Organization, people and integrations" />

      <nav class="tabs" aria-label="Settings sections">
        <a routerLink="/settings/organization" routerLinkActive="is-active" [routerLinkActiveOptions]="{ exact: true }" class="tab">
          <mat-icon>business</mat-icon>
          Organization
        </a>
        @if (state.currentUserPermissions().canManageUsers) {
          <a routerLink="/settings/users" routerLinkActive="is-active" class="tab">
            <mat-icon>group</mat-icon>
            Users
          </a>
        }
        @if (state.currentUserPermissions().canManageTeams) {
          <a routerLink="/settings/teams" routerLinkActive="is-active" class="tab">
            <mat-icon>groups</mat-icon>
            Teams
          </a>
        }
        <a routerLink="/settings/groups" routerLinkActive="is-active" class="tab">
          <mat-icon>forum</mat-icon>
          Groups
        </a>
        @if (state.hasAuthority('WHATSAPP_ADMIN')) {
          <a routerLink="/settings/whatsapp" routerLinkActive="is-active" class="tab">
            <mat-icon>chat</mat-icon>
            WhatsApp
          </a>
        }
        @if (state.hasAuthority('API_TOKENS_MANAGE')) {
          <a routerLink="/settings/api-tokens" routerLinkActive="is-active" class="tab">
            <mat-icon>key</mat-icon>
            API tokens
          </a>
        }
        @if (state.hasAuthority('PARTNERS_WRITE')) {
          <a routerLink="/settings/brands" routerLinkActive="is-active" class="tab">
            <mat-icon>sell</mat-icon>
            Brands
          </a>
        }
      </nav>

      <router-outlet></router-outlet>
    </div>
  `
})
export class SettingsShellComponent {
  state = inject(CrmStateService);
}
