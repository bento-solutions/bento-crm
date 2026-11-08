import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BaseApiService } from './base-api.service';
import { API_CONFIG } from '../config/api-config';

export interface LoginRequest {
  email: string;
  password: string;
  organization_id?: string;
}

export interface OrganizationChoice {
  organization_id: string;
  organization_name: string;
  role?: string;
  joined_at?: string;
  last_active_at?: string;
  logo_url?: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  user: CurrentUser;
}

export interface CurrentUser {
  id: string;
  organization_id: string;
  email: string;
  display_name: string;
  initials: string;
  avatar_color: string;
  role: string;
  team_id: string | null;
  is_active: boolean;
  phone: string | null;
  job_title: string | null;
  language: string;
  last_active_at: string | null;
}

@Injectable({ providedIn: 'root' })
export class AuthApiService extends BaseApiService {
  // eslint-disable-next-line @angular-eslint/prefer-inject
  constructor(http: HttpClient) {
    super(http);
  }

  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.post<LoginResponse>(API_CONFIG.endpoints.auth.login, credentials);
  }

  /** Ends this device's session on the server; the person's other devices stay signed in. */
  logout(refreshToken: string | null): Observable<unknown> {
    return this.post<unknown>(API_CONFIG.endpoints.auth.logout, { refresh_token: refreshToken || undefined });
  }

  refresh(refreshToken: string): Observable<LoginResponse> {
    return this.post<LoginResponse>(API_CONFIG.endpoints.auth.refresh, { refresh_token: refreshToken });
  }

  me(): Observable<CurrentUser> {
    return this.get<CurrentUser>(API_CONFIG.endpoints.auth.me);
  }

  // Emailed links. The requests that send one always answer 202, whether or not the
  // address has an account, so the screens must not suggest otherwise.

  verifyEmail(token: string): Observable<void> {
    return this.post<void>(API_CONFIG.endpoints.auth.verifyEmail, { token });
  }

  resendVerification(email: string): Observable<void> {
    return this.post<void>(API_CONFIG.endpoints.auth.resendVerification, { email });
  }

  requestPasswordReset(email: string): Observable<void> {
    return this.post<void>(API_CONFIG.endpoints.auth.passwordReset, { email });
  }

  resetPassword(token: string, password: string): Observable<void> {
    return this.post<void>(API_CONFIG.endpoints.auth.passwordResetConfirm, { token, password });
  }

  // The signed-in person's account.

  organizations(): Observable<AccountOrganizations> {
    return this.get<AccountOrganizations>(API_CONFIG.endpoints.account.organizations);
  }

  switchOrganization(organizationId: string, refreshToken: string | null): Observable<LoginResponse> {
    return this.post<LoginResponse>(API_CONFIG.endpoints.account.switch, {
      organization_id: organizationId,
      refresh_token: refreshToken || undefined,
    });
  }

  createOrganization(request: NewOrganizationRequest): Observable<LoginResponse> {
    return this.post<LoginResponse>(API_CONFIG.endpoints.account.organizations, request);
  }

  leaveOrganization(): Observable<void> {
    return this.post<void>(API_CONFIG.endpoints.account.leave, {});
  }

  changePassword(currentPassword: string, newPassword: string): Observable<LoginResponse> {
    return this.put<LoginResponse>(API_CONFIG.endpoints.account.password, {
      current_password: currentPassword,
      new_password: newPassword,
    });
  }

  signOutEverywhere(): Observable<void> {
    return this.post<void>(API_CONFIG.endpoints.account.signOutEverywhere, {});
  }
}

export interface AccountOrganizations {
  current_organization_id: string;
  organizations: OrganizationChoice[];
}

export interface NewOrganizationRequest {
  name: string;
  industry?: string;
  default_currency?: string;
  timezone?: string;
}

/** Answer to a request that only completes from an emailed link (HTTP 202). */
export interface CheckEmailResponse {
  status: 'check_email';
  email: string;
}

export function isCheckEmail(value: unknown): value is CheckEmailResponse {
  return (value as CheckEmailResponse | null)?.status === 'check_email';
}

/** An error the API answers when the password was right but the address isn't confirmed yet. */
export function isEmailNotVerified(err: { status?: number; title?: string } | null | undefined): boolean {
  return err?.status === 403 && err?.title === 'Email Not Verified';
}
