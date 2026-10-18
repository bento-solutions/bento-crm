import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, map, tap } from 'rxjs';
import { BaseApiService } from '../core/services/base-api.service';
import { PortalSession, PortalSessionStore } from './portal-session';

/** One of the firms an email is a client of, when it is a client of several. */
export interface PortalFirmChoice {
  organizationId: string;
  firmName: string;
}

/** A login either signs the client in, or asks which firm's portal they mean. */
export type PortalLoginResult =
  | { kind: 'session'; session: PortalSession }
  | { kind: 'choose'; firms: PortalFirmChoice[] };

/** Minimum password length the portal accepts (the API checks it too). */
export const PORTAL_MIN_PASSWORD = 8;

/** Client portal sign-in (backend: PortalAuthController). Public calls: no token is sent. */
@Injectable({ providedIn: 'root' })
export class PortalAuthService extends BaseApiService {
  private store = inject(PortalSessionStore);
  private router = inject(Router);

  readonly me = this.store.me;
  readonly signedIn = this.store.signedIn;

  login(email: string, password: string, organizationId?: string | null): Observable<PortalLoginResult> {
    return this.post<PortalSession | { firms?: PortalFirmChoice[] }>('/portal/auth/login', {
      email: email.trim(), password, organizationId: organizationId || null,
    }).pipe(
      map((r): PortalLoginResult => 'token' in r && r.token
        ? { kind: 'session', session: r as PortalSession }
        : { kind: 'choose', firms: (r as { firms?: PortalFirmChoice[] }).firms ?? [] }),
      tap(r => { if (r.kind === 'session') this.store.start(r.session); }),
    );
  }

  /** Accepts an invitation by choosing a password; signs the client in. */
  accept(token: string, password: string, displayName?: string | null): Observable<PortalSession> {
    return this.post<PortalSession>('/portal/auth/accept', { token, password, displayName: displayName || null })
      .pipe(tap(s => this.store.start(s)));
  }

  /** Always answers 204, whether or not an account exists for the email. */
  forgot(email: string): Observable<void> {
    return this.post('/portal/auth/forgot', { email: email.trim() });
  }

  reset(token: string, password: string): Observable<PortalSession> {
    return this.post<PortalSession>('/portal/auth/reset', { token, password })
      .pipe(tap(s => this.store.start(s)));
  }

  logout(): void {
    this.store.clear();
    void this.router.navigateByUrl('/portal/login');
  }
}
