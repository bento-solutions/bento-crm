import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseApiService } from '../../core/services/base-api.service';

/** A person at a client company who can sign in to the client portal. */
export interface PortalAccount {
  id: string;
  partnerId: string;
  email: string;
  displayName?: string | null;
  active: boolean;
  invitePending: boolean;
  inviteExpiresAt?: string | null;
  lastLoginAt?: string | null;
  createdAt?: string | null;
}

/** The invitation link is returned once, so it can also be sent by WhatsApp. */
export interface PortalInvited {
  account: PortalAccount;
  inviteUrl: string;
  emailed: boolean;
}

/** Staff side of the client portal: who at a client can sign in (backend: ClientPortalController). */
@Injectable({ providedIn: 'root' })
export class ClientPortalApi extends BaseApiService {
  accounts(partnerId: string): Observable<PortalAccount[]> {
    return this.get('/client-portal/accounts', { partnerId });
  }

  /** Invites a new person, or sends a fresh link to an existing one. */
  invite(partnerId: string, email: string, displayName?: string | null): Observable<PortalInvited> {
    return this.post('/client-portal/accounts', { partnerId, email, displayName: displayName || null });
  }

  update(id: string, body: { active?: boolean; displayName?: string | null }): Observable<PortalAccount> {
    return this.put(`/client-portal/accounts/${id}`, body);
  }

  remove(id: string): Observable<void> {
    return this.delete(`/client-portal/accounts/${id}`);
  }
}
