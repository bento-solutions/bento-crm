import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RoleId, CRM_ROLES } from '../services/crm-state.service';

@Component({
  selector: 'app-role-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span
      [class]="getBadgeClass()"
      class="inline-flex items-center px-2.5 py-0.5 rounded-full text-meta font-bold tracking-wide uppercase border font-sans"
    >
      {{ getRoleLabel() }}
    </span>
  `
})
export class RoleBadgeComponent {
  @Input() roleId: RoleId = 'viewer';

  getBadgeClass(): string {
    switch (this.roleId) {
      case 'admin':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'manager':
        return 'bg-violet-50 text-violet-700 border-violet-200';
      case 'salesperson':
        return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'support':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'viewer':
      default:
        return 'bg-zinc-50 text-zinc-600 border-zinc-200';
    }
  }

  getRoleLabel(): string {
    return CRM_ROLES.find(r => r.id === this.roleId)?.label || 'Viewer';
  }
}
