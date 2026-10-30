import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { PortalSessionStore } from './portal-session';

/** The portal's signed-in pages: without a portal session, go to the portal sign-in. */
export const portalGuard: CanActivateFn = () => {
  const store = inject(PortalSessionStore);
  return store.signedIn() ? true : inject(Router).parseUrl('/portal/login');
};

/** The portal sign-in page: a client already signed in goes straight to their home. */
export const portalGuestGuard: CanActivateFn = () => {
  const store = inject(PortalSessionStore);
  return store.signedIn() ? inject(Router).parseUrl('/portal') : true;
};
