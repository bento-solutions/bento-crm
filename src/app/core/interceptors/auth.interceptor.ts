import { Injectable, inject } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpErrorResponse,
} from '@angular/common/http';
import { Observable, defer, firstValueFrom, throwError } from 'rxjs';
import { catchError, finalize, shareReplay, switchMap, take } from 'rxjs/operators';
import { CrmStateService } from '../../services/crm-state.service';
import { AuthApiService, LoginResponse } from '../services/auth-api.service';

/** Name of the Web Lock that serialises token refreshes across every tab of the app. */
const REFRESH_LOCK = 'bento-auth-refresh';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private state = inject(CrmStateService);
  private authApi = inject(AuthApiService);

  // Coordinates concurrent 401s so only one /auth/refresh call is in flight per
  // tab. Every request that 401s while a refresh is running subscribes to this
  // same shared observable, so they all resolve together -- on success they retry
  // with the new token, and on failure they all receive the error. The previous
  // BehaviorSubject approach only ever emitted on success, so a failed refresh
  // left every queued request hanging forever (permanent spinners).
  private refresh$: Observable<string> | null = null;

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const isAuthEndpoint = request.url.includes('/auth/login') || request.url.includes('/auth/refresh');
    const isSignup = request.method === 'POST' && /\/organizations\/?$/.test(request.url.split('?')[0]);
    // A login or signup must never carry a leftover token: the backend scopes the request to
    // that token's organization, and logging into a different one then fails its
    // cross-tenant write guard (500) instead of simply signing the user in.
    const token = typeof localStorage !== 'undefined' && !isAuthEndpoint && !isSignup
      ? localStorage.getItem('accessToken') : null;
    const authedRequest = this.applyHeaders(request, token);

    return next.handle(authedRequest).pipe(
      catchError((error: HttpErrorResponse) => {
        // Only treat this as "the session expired" when the request actually
        // carried a token. A 401 on an unauthenticated (anonymous) request is
        // expected, not an error condition — reacting to it here previously
        // triggered a hard `window.location.href` reload, which re-ran the
        // app's eager data loads, re-fired the same 401s, and reloaded again:
        // an infinite reload loop for anyone who wasn't logged in yet.
        if (error.status === 401 && token && !isAuthEndpoint) {
          return this.handleUnauthorized(request, next, token);
        }
        return throwError(() => error);
      })
    );
  }

  private applyHeaders(request: HttpRequest<unknown>, token: string | null): HttpRequest<unknown> {
    let authedRequest = request.clone({ withCredentials: true });
    if (token) {
      authedRequest = authedRequest.clone({
        setHeaders: { Authorization: `Bearer ${token}` },
      });
    }

    // Let the browser set the multipart boundary itself for file uploads —
    // forcing application/json here would strip it and break the upload.
    if (!(request.body instanceof FormData)) {
      authedRequest = authedRequest.clone({
        setHeaders: { 'Content-Type': 'application/json' },
      });
    }

    return authedRequest;
  }

  private handleUnauthorized(
    originalRequest: HttpRequest<unknown>,
    next: HttpHandler,
    rejectedToken: string
  ): Observable<HttpEvent<unknown>> {
    // The rejected token may already have been replaced -- by a refresh this tab
    // finished a moment ago, or by another tab, since all tabs share localStorage.
    // Retrying with the current one costs nothing, whereas refreshing again would
    // present a refresh token that has already been spent.
    const current = this.readAccessToken();
    if (current && current !== rejectedToken) {
      return next.handle(this.applyHeaders(originalRequest, current));
    }

    if (!this.refresh$) {
      this.refresh$ = defer(() => this.refreshAcrossTabs(rejectedToken)).pipe(
        // Reset once the cycle settles (success or failure) so the next 401 starts
        // a fresh refresh instead of replaying this one's stale result.
        finalize(() => { this.refresh$ = null; }),
        // One refresh shared by every concurrent 401; late subscribers still get
        // the settled value or the error.
        shareReplay({ bufferSize: 1, refCount: false })
      );
    }

    return this.refresh$.pipe(
      take(1),
      switchMap((token) => next.handle(this.applyHeaders(originalRequest, token)))
    );
  }

  /**
   * Refresh tokens are single-use: the backend rotates them on every refresh and
   * treats a spent one presented again as a stolen credential. All tabs share one
   * refresh token through localStorage, so two tabs whose access token expired
   * together both presented it; the slower one was refused, logged out, and in
   * doing so cleared the tokens the faster tab had just stored -- leaving that tab
   * signed in on screen with no session behind it. A Web Lock makes the tabs take
   * turns, and inside it each tab first checks whether the one ahead of it already
   * refreshed.
   */
  private async refreshAcrossTabs(rejectedToken: string): Promise<string> {
    const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
    if (!locks) {
      return this.refreshOnce(rejectedToken);
    }
    // request() holds the lock until the callback's promise settles, then resolves with its value.
    return await locks.request(REFRESH_LOCK, () => this.refreshOnce(rejectedToken));
  }

  private async refreshOnce(rejectedToken: string): Promise<string> {
    const current = this.readAccessToken();
    if (current && current !== rejectedToken) {
      return current;
    }

    const presented = typeof localStorage !== 'undefined' ? localStorage.getItem('refreshToken') || '' : '';
    try {
      const response = await firstValueFrom(this.authApi.refresh(presented));
      this.storeTokens(response);
      return response.access_token;
    } catch (refreshError) {
      // Only the backend refusing the refresh token ends the session. A 429, a 5xx
      // or a dropped connection says nothing about whether it is still valid, and
      // logging out on those threw users back to the login screen whenever the rate
      // limiter tripped. And if another tab has stored a newer refresh token in the
      // meantime, the session is alive even though this attempt lost.
      const status = (refreshError as { status?: number }).status;
      const rejected = status === 401 || status === 403;
      const unchanged = typeof localStorage === 'undefined' || localStorage.getItem('refreshToken') === (presented || null);
      if (rejected && unchanged) {
        this.state.logout();
      }
      throw refreshError;
    }
  }

  private readAccessToken(): string | null {
    return typeof localStorage !== 'undefined' ? localStorage.getItem('accessToken') : null;
  }

  private storeTokens(response: LoginResponse): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem('accessToken', response.access_token);
    if (response.refresh_token) {
      localStorage.setItem('refreshToken', response.refresh_token);
    }
  }
}
