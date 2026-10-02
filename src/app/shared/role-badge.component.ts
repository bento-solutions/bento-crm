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
      class="badge"
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
        return 'badge-danger';
      case 'manager':
        return 'badge-violet';
      case 'salesperson':
        return 'badge-info';
      case 'support':
        return 'badge-success';
      case 'viewer':
      default:
        return 'bg-subtle text-ink-2 border-line';
    }
  }

  getRoleLabel(): string {
    return CRM_ROLES.find(r => r.id === this.roleId)?.label || 'Viewer';
  }
}
