import { Injectable, inject } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpErrorResponse,
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, finalize, map, shareReplay, switchMap, take } from 'rxjs/operators';
import { CrmStateService } from '../../services/crm-state.service';
import { AuthApiService, LoginResponse } from '../services/auth-api.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private state = inject(CrmStateService);
  private authApi = inject(AuthApiService);

  // Coordinates concurrent 401s so only one /auth/refresh call is in flight at a
  // time. Every request that 401s while a refresh is running subscribes to this
  // same shared observable, so they all resolve together -- on success they retry
  // with the new token, and on failure they all receive the error. The previous
  // BehaviorSubject approach only ever emitted on success, so a failed refresh
  // left every queued request hanging forever (permanent spinners).
  private refresh$: Observable<string> | null = null;

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('accessToken') : null;
    const authedRequest = this.applyHeaders(request, token);
    const isAuthEndpoint = request.url.includes('/auth/login') || request.url.includes('/auth/refresh');

    return next.handle(authedRequest).pipe(
      catchError((error: HttpErrorResponse) => {
        // Only treat this as "the session expired" when the request actually
        // carried a token. A 401 on an unauthenticated (anonymous) request is
        // expected, not an error condition — reacting to it here previously
        // triggered a hard `window.location.href` reload, which re-ran the
        // app's eager data loads, re-fired the same 401s, and reloaded again:
        // an infinite reload loop for anyone who wasn't logged in yet.
        if (error.status === 401 && token && !isAuthEndpoint) {
          return this.handleUnauthorized(request, next);
        }
        return throwError(() => error);
      })
    );
  }

  private applyHeaders(request: HttpRequest<unknown>, token: string | null): HttpRequest<unknown> {
    let authedRequest = request;
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

  private handleUnauthorized(originalRequest: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const refreshToken = typeof localStorage !== 'undefined' ? localStorage.getItem('refreshToken') : null;
    if (!refreshToken) {
      this.state.logout();
      return throwError(() => new HttpErrorResponse({ status: 401, statusText: 'No refresh token available' }));
    }

    if (!this.refresh$) {
      this.refresh$ = this.authApi.refresh(refreshToken).pipe(
        map((response: LoginResponse) => {
          this.storeTokens(response);
          return response.access_token;
        }),
        catchError((refreshError) => {
          this.state.logout();
          return throwError(() => refreshError);
        }),
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

  private storeTokens(response: LoginResponse): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem('accessToken', response.access_token);
    if (response.refresh_token) {
      localStorage.setItem('refreshToken', response.refresh_token);
    }
  }
}
