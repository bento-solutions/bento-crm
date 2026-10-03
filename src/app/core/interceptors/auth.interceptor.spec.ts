import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HTTP_INTERCEPTORS, HttpClient, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthInterceptor } from './auth.interceptor';
import { CrmStateService } from '../../services/crm-state.service';
import { API_CONFIG } from '../config/api-config';

const REFRESH_URL = `${API_CONFIG.baseUrl}/auth/refresh`;
const user = { id: 'u1', organization_id: 'o1', email: 'a@b.c', display_name: 'A B', initials: 'AB', avatar_color: '', role: 'ADMIN', team_id: null, is_active: true, phone: null, job_title: null, language: 'en', last_active_at: null };

/** Lets the interceptor's promise-based refresh advance between assertions. */
const settle = () => new Promise(resolve => setTimeout(resolve, 0));

describe('AuthInterceptor token refresh', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let logout: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('accessToken', 'access-1');
    localStorage.setItem('refreshToken', 'refresh-1');
    localStorage.setItem('bento_auth', 'true');
    logout = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
        { provide: CrmStateService, useValue: { logout } },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    backend.verify();
    localStorage.clear();
  });

  it('refreshes once for concurrent 401s and retries both with the new token', async () => {
    const results: unknown[] = [];
    http.get('/api/a').subscribe(r => results.push(r));
    http.get('/api/b').subscribe(r => results.push(r));
    backend.expectOne('/api/a').flush(null, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne('/api/b').flush(null, { status: 401, statusText: 'Unauthorized' });
    await settle();

    const refresh = backend.expectOne(REFRESH_URL);
    expect(refresh.request.body).toEqual({ refresh_token: 'refresh-1' });
    refresh.flush({ access_token: 'access-2', refresh_token: 'refresh-2', user });
    await settle();

    for (const url of ['/api/a', '/api/b']) {
      const retry = backend.expectOne(url);
      expect(retry.request.headers.get('Authorization')).toBe('Bearer access-2');
      retry.flush({ ok: url });
    }
    expect(results).toHaveLength(2);
    expect(localStorage.getItem('refreshToken')).toBe('refresh-2');
  });

  it('reuses a token another tab already refreshed instead of spending the refresh token again', async () => {
    let result: unknown;
    http.get('/api/a').subscribe(r => (result = r));
    // Another tab refreshed while this request was in flight.
    localStorage.setItem('accessToken', 'access-from-other-tab');
    localStorage.setItem('refreshToken', 'refresh-from-other-tab');
    backend.expectOne('/api/a').flush(null, { status: 401, statusText: 'Unauthorized' });
    await settle();

    backend.expectNone(REFRESH_URL);
    const retry = backend.expectOne('/api/a');
    expect(retry.request.headers.get('Authorization')).toBe('Bearer access-from-other-tab');
    retry.flush({ ok: true });
    expect(result).toEqual({ ok: true });
  });

  it('serialises refreshes across tabs through a Web Lock', async () => {
    const request = vi.fn((_name: string, callback: () => Promise<string>) => callback());
    vi.stubGlobal('navigator', { ...navigator, locks: { request } });
    try {
      http.get('/api/a').subscribe();
      backend.expectOne('/api/a').flush(null, { status: 401, statusText: 'Unauthorized' });
      await settle();
      expect(request).toHaveBeenCalledWith('bento-auth-refresh', expect.any(Function));
      backend.expectOne(REFRESH_URL).flush({ access_token: 'access-2', refresh_token: 'refresh-2', user });
      await settle();
      backend.expectOne('/api/a').flush({});
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('keeps the session when the refresh is rate limited', async () => {
    let failed = false;
    http.get('/api/a').subscribe({ error: () => (failed = true) });
    backend.expectOne('/api/a').flush(null, { status: 401, statusText: 'Unauthorized' });
    await settle();
    backend.expectOne(REFRESH_URL).flush('Rate limit exceeded', {
      status: 429, statusText: 'Too Many Requests', headers: { 'X-Rate-Limit-Retry-After-Seconds': '60' },
    });
    await settle();

    expect(failed).toBe(true);
    expect(logout).not.toHaveBeenCalled();
    expect(localStorage.getItem('refreshToken')).toBe('refresh-1');
  });

  it('logs out when the backend rejects the refresh token', async () => {
    http.get('/api/a').subscribe({ error: () => undefined });
    backend.expectOne('/api/a').flush(null, { status: 401, statusText: 'Unauthorized' });
    await settle();
    backend.expectOne(REFRESH_URL).flush(null, { status: 401, statusText: 'Unauthorized' });
    await settle();

    expect(logout).toHaveBeenCalledTimes(1);
  });

  it('does not log out when another tab stored a newer refresh token while this one failed', async () => {
    http.get('/api/a').subscribe({ error: () => undefined });
    backend.expectOne('/api/a').flush(null, { status: 401, statusText: 'Unauthorized' });
    await settle();
    localStorage.setItem('refreshToken', 'refresh-from-other-tab');
    backend.expectOne(REFRESH_URL).flush(null, { status: 401, statusText: 'Unauthorized' });
    await settle();

    expect(logout).not.toHaveBeenCalled();
  });
});
