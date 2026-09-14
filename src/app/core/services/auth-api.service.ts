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

  logout(): Observable<unknown> {
    return this.post<unknown>(API_CONFIG.endpoints.auth.logout, {});
  }

  refresh(refreshToken: string): Observable<LoginResponse> {
    return this.post<LoginResponse>(API_CONFIG.endpoints.auth.refresh, { refresh_token: refreshToken });
  }

  me(): Observable<CurrentUser> {
    return this.get<CurrentUser>(API_CONFIG.endpoints.auth.me);
  }
}
