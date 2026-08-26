import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, retry, timeout } from 'rxjs/operators';
import { API_CONFIG, HTTP_CONFIG } from '../config/api-config';

export interface ApiResponse<T> {
  data: T;
  message?: string;
  status?: number;
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
      retry(HTTP_CONFIG.retryAttempts),
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

  protected buildUrl(endpoint: string): string {
    return `${this.baseUrl}${endpoint}`;
  }

  protected handleError(error: HttpErrorResponse): Observable<never> {
    console.error('API Error:', error);
    let errorMessage = 'An error occurred';

    if (error.error instanceof ErrorEvent) {
      errorMessage = `Error: ${error.error.message}`;
    } else {
      errorMessage = `Error Code: ${error.status}\nMessage: ${error.message}`;
    }

    return throwError(() => new Error(errorMessage));
  }
}
