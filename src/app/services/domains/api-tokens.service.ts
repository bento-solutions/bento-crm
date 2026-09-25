import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseApiService } from '../../core/services/base-api.service';

export type ApiScope = 'whatsapp:read' | 'whatsapp:draft' | 'whatsapp:send' | 'partners:read';

export interface ApiTokenView {
  id: string;
  userId: string;
  name: string;
  tokenPrefix: string;
  scopes: ApiScope[];
  maxSendsPerHour?: number;
  expiresAt?: string;
  lastUsedAt?: string;
  revokedAt?: string;
  createdAt: string;
}

export interface CreatedApiToken {
  /** Shown once; never retrievable again. */
  token: string;
  view: ApiTokenView;
}

/** Personal API tokens (backend: ApiTokenController). */
@Injectable({ providedIn: 'root' })
export class ApiTokensApi extends BaseApiService {
  list(all = false): Observable<ApiTokenView[]> {
    return this.get('/api-tokens', { all });
  }

  create(name: string, scopes: ApiScope[], expiresInDays: number, maxSendsPerHour: number): Observable<CreatedApiToken> {
    return this.post('/api-tokens', { name, scopes, expiresInDays, maxSendsPerHour });
  }

  revoke(id: string): Observable<ApiTokenView> {
    return this.delete(`/api-tokens/${id}`);
  }

  /** The MCP endpoint agents connect to, next to the REST API. */
  mcpUrl(): string {
    return this.buildUrl('/mcp');
  }
}
