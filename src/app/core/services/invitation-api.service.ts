import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';
import { BaseApiService } from './base-api.service';
import { API_CONFIG, HTTP_CONFIG } from '../config/api-config';
import { LoginResponse } from './auth-api.service';

/** Mirrors the backend UserRole enum. */
export type InvitationRole = 'ADMIN' | 'MANAGER' | 'SALESPERSON' | 'SUPPORT' | 'VIEWER';

/** EXPIRED is derived by the backend from expires_at, not a stored status. */
export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';

export interface CreateInvitationRequest {
  email: string;
  role: InvitationRole;
  team_id?: string | null;
  display_name?: string | null;
  job_title?: string | null;
  language?: string;
}

export interface InvitationDto {
  id: string;
  organization_id: string;
  email: string;
  role: InvitationRole;
  team_id: string | null;
  display_name: string | null;
  job_title: string | null;
  language: string;
  status: InvitationStatus;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  accepted_user_id: string | null;
  last_sent_at: string | null;
  send_count: number;
  invited_by: string | null;
  invited_by_name: string | null;
  created_at: string;
}

/** What the acceptance page can learn from a token before an account exists. */
export interface InvitationPreview {
  email: string;
  organization_name: string;
  role: InvitationRole;
  display_name: string | null;
  job_title: string | null;
  invited_by_name: string | null;
  expires_at: string;
}

export interface AcceptInvitationRequest {
  token: string;
  display_name: string;
  password: string;
  phone?: string;
}

@Injectable({ providedIn: 'root' })
export class InvitationApiService extends BaseApiService {
  // eslint-disable-next-line @angular-eslint/prefer-inject
  constructor(http: HttpClient) {
    super(http);
  }

  /**
   * The base implementation collapses every failure into a generic Error, discarding the
   * server's `detail`. For invitations that detail is the whole message -- "already a user"
   * and "already invited" call for different follow-up actions -- so the original
   * HttpErrorResponse is preserved here instead.
   */
  protected override handleError(error: HttpErrorResponse): Observable<never> {
    return throwError(() => error);
  }

  list(): Observable<InvitationDto[]> {
    return this.get<InvitationDto[]>(API_CONFIG.endpoints.invitations.list);
  }

  create(request: CreateInvitationRequest): Observable<InvitationDto> {
    return this.post<InvitationDto>(API_CONFIG.endpoints.invitations.create, request);
  }

  update(id: string, request: CreateInvitationRequest): Observable<InvitationDto> {
    return this.patch<InvitationDto>(API_CONFIG.endpoints.invitations.update(id), request);
  }

  resend(id: string): Observable<InvitationDto> {
    return this.post<InvitationDto>(API_CONFIG.endpoints.invitations.resend(id), {});
  }

  revoke(id: string): Observable<InvitationDto> {
    return this.post<InvitationDto>(API_CONFIG.endpoints.invitations.revoke(id), {});
  }

  // The two calls below run before the invitee has an account, so they hit the
  // unauthenticated /public/invitations endpoints. The auth interceptor simply finds no
  // token in localStorage and sends the request without an Authorization header.

  /**
   * Goes to HttpClient directly rather than through {@link BaseApiService#get} to skip its
   * blanket retry: an invalid or expired token is a permanent 404, and retrying it three times
   * would burn four slots of the server's per-IP invitation rate limit per page load.
   */
  preview(token: string): Observable<InvitationPreview> {
    return this.http
      .get<InvitationPreview>(this.buildUrl(API_CONFIG.endpoints.invitations.preview), { params: { token } })
      .pipe(
        timeout(HTTP_CONFIG.timeout),
        catchError((error: HttpErrorResponse) => throwError(() => error))
      );
  }

  /** Returns a full session: accepting signs the new user straight in. */
  accept(request: AcceptInvitationRequest): Observable<LoginResponse> {
    return this.post<LoginResponse>(API_CONFIG.endpoints.invitations.accept, request);
  }
}
