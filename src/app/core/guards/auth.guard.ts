import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { CrmStateService } from '../../services/crm-state.service';

export const authGuard: CanActivateFn = () => {
  const state = inject(CrmStateService);

  if (state.isAuthenticated()) {
    return true;
  }

  // There is no standalone login route — the app shell renders <app-login>
  // whenever isAuthenticated() is false. Redirecting to '/' here would be an
  // infinite loop, since '/' is itself protected by this guard.
  return false;
};
