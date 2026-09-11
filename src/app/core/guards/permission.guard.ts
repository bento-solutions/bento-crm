import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { CrmStateService, CrmRole } from '../../services/crm-state.service';

/** Blocks navigation unless the current user's role grants the given permission. */
export function permissionGuard(permission: keyof CrmRole['permissions']): CanActivateFn {
  return () => {
    const state = inject(CrmStateService);
    const router = inject(Router);

    if (!state.isAuthenticated()) {
      return router.parseUrl('/');
    }

    if (state.currentUserPermissions()[permission]) {
      return true;
    }

    return router.parseUrl('/');
  };
}
