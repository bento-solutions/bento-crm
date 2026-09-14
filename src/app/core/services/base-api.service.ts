import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError, timer } from 'rxjs';
import { catchError, retry, timeout } from 'rxjs/operators';
import { API_CONFIG, HTTP_CONFIG } from '../config/api-config';

export interface ApiResponse<T> {
  data: T;
  message?: string;
  status?: number;
}

export interface ApiFieldError {
  field: string;
  message: string;
}

/** Shape of the RFC 7807-style error body returned by the backend GlobalExceptionHandler. */
export interface ApiErrorBody {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
  timestamp?: string;
  validationErrors?: ApiFieldError[];
  organizations?: any[];
  [key: string]: unknown;
}

/**
 * Error thrown by every BaseApiService call. Unlike a bare `Error`, it preserves the HTTP status
 * and the server's `detail` / `validationErrors`, so a component can show the real validation
 * message and branch on 401 vs 409 vs 422 instead of getting an opaque string.
 */
export class ApiClientError extends Error {
  readonly status: number;
  readonly detail?: string;
  readonly title?: string;
  readonly validationErrors: ApiFieldError[];
  readonly organizations?: any[];
  readonly body?: ApiErrorBody;
  readonly error?: any;

  constructor(status: number, message: string, body?: ApiErrorBody) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.detail = body?.detail;
    this.title = body?.title;
    this.validationErrors = body?.validationErrors ?? [];
    this.organizations = body?.organizations;
    this.body = body;
    this.error = body;
  }
}

@Injectable({ providedIn: 'root' })
export class BaseApiService {
  protected readonly baseUrl = API_CONFIG.baseUrl;

  // eslint-disable-next-line @angular-eslint/prefer-inject
  constructor(protected http: HttpClient) {}

  protected get<T>(endpoint: string, params?: Record<string, string | number | boolean> | HttpParams): Observable<T> {
    const url = this.buildUrl(endpoint);
    return this.http.get<T>(url, { params }).pipe(
      timeout(HTTP_CONFIG.timeout),
      // Only retry transient failures. Retrying a 4xx (validation error, auth
      // failure, not found) is pointless and, for auth endpoints, actively
      // harmful -- it burns rate-limit budget and can trip account lockout.
      retry({
        count: HTTP_CONFIG.retryAttempts,
        delay: (error: HttpErrorResponse, retryCount) =>
          error.status === 0 || error.status >= 500
            ? timer(HTTP_CONFIG.retryDelay * retryCount)
            : throwError(() => error),
      }),
      catchError(error => this.handleError(error))
    );
  }

  protected post<T>(endpoint: string, body: unknown): Observable<T> {
    const url = this.buildUrl(endpoint);
    return this.http.post<T>(url, body).pipe(
      timeout(HTTP_CONFIG.timeout),
      catchError(error => this.handleError(error))
    );
  }

  protected patch<T>(endpoint: string, body: unknown): Observable<T> {
    const url = this.buildUrl(endpoint);
    return this.http.patch<T>(url, body).pipe(
      timeout(HTTP_CONFIG.timeout),
      catchError(error => this.handleError(error))
    );
  }

  protected delete<T>(endpoint: string): Observable<T> {
    const url = this.buildUrl(endpoint);
    return this.http.delete<T>(url).pipe(
      timeout(HTTP_CONFIG.timeout),
      catchError(error => this.handleError(error))
    );
  }

  protected getBlob(endpoint: string): Observable<Blob> {
    const url = this.buildUrl(endpoint);
    return this.http.get(url, { responseType: 'blob' }).pipe(
      timeout(HTTP_CONFIG.timeout),
      catchError(error => this.handleError(error))
    );
  }

  protected buildUrl(endpoint: string): string {
    return `${this.baseUrl}${endpoint}`;
  }

  protected handleError(error: HttpErrorResponse): Observable<never> {
    if (error.error instanceof ErrorEvent) {
      // Client-side / network failure -- no HTTP status.
      console.error('API network error:', error.error.message);
      return throwError(() => new ApiClientError(0, error.error.message || 'Network error'));
    }

    let rawBody: any = error.error;
    if (typeof rawBody === 'string') {
      try {
        rawBody = JSON.parse(rawBody);
      } catch {
        // preserve non-JSON string
      }
    }

    const body: ApiErrorBody | undefined =
      rawBody && typeof rawBody === 'object' ? (rawBody as ApiErrorBody) : undefined;

    // Prefer the server's human-readable detail, then its title, then Angular's
    // own message. The status and validationErrors ride along on ApiClientError.
    const message =
      body?.detail ||
      body?.title ||
      error.message ||
      `Request failed with status ${error.status}`;

    console.error(`API error ${error.status}:`, message);
    return throwError(() => new ApiClientError(error.status, message, body));
  }
}
