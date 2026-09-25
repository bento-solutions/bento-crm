import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';
import { BaseApiService } from '../../core/services/base-api.service';
import { HTTP_CONFIG } from '../../core/config/api-config';
import type { BlockedNumber } from './whatsapp-inbox.service';

export type AutoCreateLeads = 'OFF' | 'INBOUND' | 'INBOUND_AND_PHONE';
export type InboxVisibility = 'ASSIGNED' | 'ALL';

/** Bot session states, as the backend mirrors them (see WaSessionService). */
export type SessionState =
  | 'stopped' | 'needs_pairing' | 'connecting' | 'pairing' | 'open' | 'reconnecting'
  | 'logged_out' | 'replaced' | 'pairing_failed' | 'error';

export interface WhatsAppSession {
  accountId: string;
  provider: 'MOCK' | 'META' | 'BAILEYS';
  state?: SessionState;
  requestedPhone?: string;
  linkedPhone?: string;
  linkedAt?: string;
  lastSeenAt?: string;
  pairingCode?: string;
  pairingExpiresAt?: string;
  pairingAttempt?: number;
  error?: string;
  botConfigured: boolean;
}

export interface WhatsAppSettings {
  autoCreateLeads: AutoCreateLeads;
  visibility: InboxVisibility;
  defaultAssigneeUserId?: string | null;
  replyMinGapSeconds?: number | null;
  outreachMinGapSeconds?: number | null;
  outreachPerHour?: number | null;
  newChatsPerDay?: number | null;
}

/** Linked-number session and inbox settings (backend: WaAccountController, WHATSAPP_ADMIN). */
@Injectable({ providedIn: 'root' })
export class WhatsAppAccountApi extends BaseApiService {
  session(): Observable<WhatsAppSession> {
    return this.get('/whatsapp/account/session');
  }

  prepare(phone: string, autoCreateLeads?: AutoCreateLeads): Observable<WhatsAppSession> {
    return this.post('/whatsapp/account/baileys/prepare', { phone, autoCreateLeads });
  }

  link(): Observable<WhatsAppSession> {
    return this.post('/whatsapp/account/baileys/link', {});
  }

  start(): Observable<WhatsAppSession> {
    return this.post('/whatsapp/account/baileys/start', {});
  }

  unlink(): Observable<WhatsAppSession> {
    return this.post('/whatsapp/account/baileys/unlink', {});
  }

  settings(): Observable<WhatsAppSettings> {
    return this.get('/whatsapp/account/settings');
  }

  saveSettings(settings: WhatsAppSettings): Observable<WhatsAppSettings> {
    return this.http.put<WhatsAppSettings>(this.buildUrl('/whatsapp/account/settings'), settings)
      .pipe(timeout(HTTP_CONFIG.timeout), catchError(e => this.handleError(e)));
  }

  blocked(): Observable<BlockedNumber[]> {
    return this.get('/whatsapp/blocked');
  }

  unblock(id: string): Observable<void> {
    return this.delete(`/whatsapp/blocked/${id}`);
  }
}
