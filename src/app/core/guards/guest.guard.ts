import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { CrmStateService } from '../../services/crm-state.service';

export const guestGuard: CanActivateFn = () => {
  const state = inject(CrmStateService);
  const router = inject(Router);

  if (!state.isAuthenticated()) {
    return true;
  }

  return router.parseUrl('/');
};
