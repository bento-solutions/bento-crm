import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BaseApiService } from './base-api.service';
import { API_CONFIG } from '../config/api-config';

export interface CreateOrganizationRequest {
  name: string;
  industry?: string;
  timezone?: string;
  default_currency?: string;
  admin_email: string;
  admin_name: string;
  admin_password: string;
}

export interface OrganizationResponse {
  id: string;
  name: string;
  logoUrl?: string;
  industry?: string;
  timezone?: string;
  fiscalYearStartMonth?: number;
  defaultCurrency?: string;
  plan?: string;
  createdAt?: string;
  updatedAt?: string;
}

@Injectable({ providedIn: 'root' })
export class OrganizationApiService extends BaseApiService {
  // eslint-disable-next-line @angular-eslint/prefer-inject
  constructor(http: HttpClient) {
    super(http);
  }

  create(request: CreateOrganizationRequest): Observable<OrganizationResponse> {
    return this.post<OrganizationResponse>(API_CONFIG.endpoints.organizations.create, request);
  }

  me(): Observable<OrganizationResponse> {
    return this.get<OrganizationResponse>(API_CONFIG.endpoints.organizations.me);
  }

  update(request: Partial<CreateOrganizationRequest>): Observable<OrganizationResponse> {
    return this.patch<OrganizationResponse>(API_CONFIG.endpoints.organizations.update, request);
  }
}
