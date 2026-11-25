import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { CanActivateFn, Router } from '@angular/router';
import { filter, map, take, timeout, catchError, of } from 'rxjs';
import { CrmStateService, CrmRole } from '../../services/crm-state.service';

/**
 * Blocks navigation unless the current user's role grants the given permission.
 * Waits for /auth/me to resolve before deciding so page refreshes never judge
 * the user with Viewer defaults.
 */
export function permissionGuard(permission: keyof CrmRole['permissions']): CanActivateFn {
  return () => {
    const state = inject(CrmStateService);
    const router = inject(Router);

    if (!state.isAuthenticated()) {
      return router.parseUrl('/');
    }

    const decide = () => state.currentUserPermissions()[permission] ? true : router.parseUrl('/');
    if (state.currentUserStatus() !== 'pending') {
      return decide();
    }
    return toObservable(state.currentUserStatus).pipe(
      filter(s => s !== 'pending'),
      take(1),
      timeout(15000),
      map(decide),
      catchError(() => of(router.parseUrl('/')))
    );
  };
}
