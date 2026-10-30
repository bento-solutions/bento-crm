import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { AuthInterceptor } from '../core/interceptors/auth.interceptor';
import { CrmStateService } from '../services/crm-state.service';
import { API_CONFIG } from '../core/config/api-config';
import { PortalAuthService } from './portal-auth.service';
import { PORTAL_ME_KEY, PORTAL_TOKEN_KEY, PortalSessionStore } from './portal-session';
import { portalGuard, portalGuestGuard } from './portal.guard';

const LOGIN = `${API_CONFIG.baseUrl}/portal/auth/login`;
const me = { id: 'p1', email: 'client@acme.ma', partnerId: 'c1', organizationId: 'o1', firmName: 'Cabinet A' };
const session = { token: 'portal-token', expiresInSeconds: 3600, me };

describe('PortalAuthService', () => {
  let auth: PortalAuthService;
  let store: PortalSessionStore;
  let backend: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
        { provide: CrmStateService, useValue: { logout: () => undefined } },
      ],
    });
    auth = TestBed.inject(PortalAuthService);
    store = TestBed.inject(PortalSessionStore);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    backend.verify();
    localStorage.clear();
  });

  it('stores the session under its own keys, apart from the staff token', () => {
    localStorage.setItem('accessToken', 'staff-token');
    let kind = '';
    auth.login('client@acme.ma ', 'secret123').subscribe(r => (kind = r.kind));
    const req = backend.expectOne(LOGIN);
    expect(req.request.body).toEqual({ email: 'client@acme.ma', password: 'secret123', organizationId: null });
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush(session);

    expect(kind).toBe('session');
    expect(store.signedIn()).toBe(true);
    expect(localStorage.getItem(PORTAL_TOKEN_KEY)).toBe('portal-token');
    expect(JSON.parse(localStorage.getItem(PORTAL_ME_KEY)!).firmName).toBe('Cabinet A');
    expect(localStorage.getItem('accessToken')).toBe('staff-token');
  });

  it('returns the firms to choose from without signing in, then signs in to the chosen one', () => {
    let firms: unknown;
    auth.login('client@acme.ma', 'secret123').subscribe(r => { if (r.kind === 'choose') firms = r.firms; });
    backend.expectOne(LOGIN).flush({ firms: [{ organizationId: 'o1', firmName: 'A' }, { organizationId: 'o2', firmName: 'B' }] });
    expect(firms).toHaveLength(2);
    expect(store.signedIn()).toBe(false);

    auth.login('client@acme.ma', 'secret123', 'o2').subscribe();
    const req = backend.expectOne(LOGIN);
    expect(req.request.body.organizationId).toBe('o2');
    req.flush(session);
    expect(store.signedIn()).toBe(true);
  });

  it('signs in after accepting an invitation', () => {
    auth.accept('invite-token', 'secret123', 'Amal').subscribe();
    const req = backend.expectOne(`${API_CONFIG.baseUrl}/portal/auth/accept`);
    expect(req.request.body).toEqual({ token: 'invite-token', password: 'secret123', displayName: 'Amal' });
    req.flush(session);
    expect(store.token()).toBe('portal-token');
  });

  it('signing out clears the portal session and goes to the portal sign-in', () => {
    store.start(session);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    auth.logout();
    expect(store.signedIn()).toBe(false);
    expect(localStorage.getItem(PORTAL_TOKEN_KEY)).toBeNull();
    expect(navigate).toHaveBeenCalledWith('/portal/login');
  });
});

describe('portal guards', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  afterEach(() => localStorage.clear());

  const run = (guard: typeof portalGuard) => TestBed.runInInjectionContext(() => guard(null!, null!));

  it('sends a visitor without a portal session to the portal sign-in', () => {
    const result = run(portalGuard) as UrlTree;
    expect(TestBed.inject(Router).serializeUrl(result)).toBe('/portal/login');
  });

  it('ignores a staff session', () => {
    localStorage.setItem('accessToken', 'staff-token');
    localStorage.setItem('bento_auth', 'true');
    expect(run(portalGuard)).not.toBe(true);
  });

  it('lets a signed-in client in, and skips the sign-in page for them', () => {
    TestBed.inject(PortalSessionStore).start(session);
    expect(run(portalGuard)).toBe(true);
    expect(TestBed.inject(Router).serializeUrl(run(portalGuestGuard) as UrlTree)).toBe('/portal');
  });
});
