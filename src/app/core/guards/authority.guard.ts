import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { CrmStateService } from '../../services/crm-state.service';

/**
 * Blocks navigation unless the current user's role grants the given backend authority
 * (see AUTHORITIES_BY_ROLE / Permission.forRole() on the backend). Use this over
 * permissionGuard when the check maps to one of the backend's actual @PreAuthorize
 * authorities rather than one of the coarser legacy CrmRole.permissions flags.
 */
export function authorityGuard(authority: string): CanActivateFn {
  return () => {
    const state = inject(CrmStateService);
    const router = inject(Router);

    if (!state.isAuthenticated()) {
      return router.parseUrl('/');
    }

    if (state.hasAuthority(authority)) {
      return true;
    }

    return router.parseUrl('/');
  };
}
