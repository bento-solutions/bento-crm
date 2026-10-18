import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { CanActivateFn, Router } from '@angular/router';
import { filter, map, take, timeout, catchError, of } from 'rxjs';
import { CrmStateService } from '../../services/crm-state.service';

/**
 * Blocks navigation unless the current user's role grants the given backend authority
 * (see AUTHORITIES_BY_ROLE / Permission.forRole() on the backend). Use this over
 * permissionGuard when the check maps to one of the backend's actual @PreAuthorize
 * authorities rather than one of the coarser legacy CrmRole.permissions flags.
 *
 * A page opened or refreshed by URL runs this before /auth/me has answered, so the guard
 * waits for the user's role instead of judging them as a viewer.
 */
export function authorityGuard(...authorities: string[]): CanActivateFn {
  return () => {
    const state = inject(CrmStateService);
    const router = inject(Router);

    if (!state.isAuthenticated()) {
      return router.parseUrl('/');
    }

    const decide = () => authorities.some(a => state.hasAuthority(a)) ? true : router.parseUrl('/');
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
