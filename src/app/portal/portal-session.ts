import { Injectable, Injector, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { API_CONFIG } from '../core/config/api-config';

/** localStorage keys of the client portal session; distinct from the staff session's keys. */
export const PORTAL_TOKEN_KEY = 'bento_portal_token';
export const PORTAL_ME_KEY = 'bento_portal_me';

/** The signed-in client, as the API describes them. */
export interface PortalMe {
  id: string;
  email: string;
  displayName?: string | null;
  partnerId: string;
  companyName?: string | null;
  organizationId: string;
  firmName?: string | null;
  firmLogoUrl?: string | null;
}

export interface PortalSession {
  token: string;
  expiresInSeconds: number;
  me: PortalMe;
}

/** True for calls to the client portal API (/portal/...), which never carry the staff token. */
export function isPortalApiUrl(url: string): boolean {
  return url.startsWith(`${API_CONFIG.baseUrl}/portal/`);
}

/** The portal's public sign-in calls (login, accept, forgot, reset): sent without any token. */
export function isPortalAuthUrl(url: string): boolean {
  return url.startsWith(`${API_CONFIG.baseUrl}/portal/auth/`);
}

function read(key: string): string | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

function readMe(): PortalMe | null {
  const raw = read(PORTAL_ME_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PortalMe;
  } catch {
    return null;
  }
}

/**
 * The client portal's own session: its token and the signed-in client, kept under their own
 * localStorage keys so a client session and a staff session in the same browser never mix.
 * Has no HTTP dependency, so the auth interceptor can use it.
 */
@Injectable({ providedIn: 'root' })
export class PortalSessionStore {
  private injector = inject(Injector);

  private readonly tokenSignal = signal<string | null>(read(PORTAL_TOKEN_KEY));
  readonly me = signal<PortalMe | null>(readMe());
  readonly signedIn = computed(() => !!this.tokenSignal());

  token(): string | null {
    return this.tokenSignal();
  }

  start(session: PortalSession): void {
    this.tokenSignal.set(session.token);
    this.me.set(session.me ?? null);
    try {
      localStorage.setItem(PORTAL_TOKEN_KEY, session.token);
      localStorage.setItem(PORTAL_ME_KEY, JSON.stringify(session.me ?? null));
    } catch {
      // Private mode: the session lasts for this page only.
    }
  }

  setMe(me: PortalMe): void {
    this.me.set(me);
    try {
      localStorage.setItem(PORTAL_ME_KEY, JSON.stringify(me));
    } catch {
      // see start()
    }
  }

  clear(): void {
    this.tokenSignal.set(null);
    this.me.set(null);
    try {
      localStorage.removeItem(PORTAL_TOKEN_KEY);
      localStorage.removeItem(PORTAL_ME_KEY);
    } catch {
      // see start()
    }
  }

  /** The API refused the token (expired or revoked): sign out and go to the portal sign-in. */
  expire(): void {
    this.clear();
    // Resolved lazily: the HTTP interceptor depends on this store.
    void this.injector.get(Router).navigateByUrl('/portal/login');
  }
}
