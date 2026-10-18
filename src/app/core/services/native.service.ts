import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { firstValueFrom } from 'rxjs';
import { API_CONFIG } from '../config/api-config';

/** Where the phone's push token is remembered, to unregister it at sign-out. */
const PUSH_TOKEN_KEY = 'bento_push_token';

/**
 * The page a tapped push notification opens, from the related record's type and id the server
 * sends with it. Records without a page of their own open the dashboard.
 */
export function pushRoute(entityType?: string | null, entityId?: string | null): string {
  const id = entityId ? encodeURIComponent(entityId) : '';
  switch ((entityType ?? '').toUpperCase()) {
    case 'DOCUMENT_REQUEST': return id ? `/checklists?open=${id}` : '/checklists';
    case 'TAX_DEADLINE': return '/tax-calendar';
    case 'INBOUND_DOCUMENT': return '/inbox-documents';
    case 'MISSION': return '/missions';
    case 'TASK': return '/tasks';
    case 'TICKET': return id ? `/tickets/${id}` : '/tickets';
    case 'DEAL': return id ? `/sales/deals/${id}` : '/sales';
    case 'LEAD': return id ? `/partners/lead/${id}` : '/partners';
    case 'WA_CONVERSATION': return id ? `/inbox?c=${id}` : '/inbox';
    case 'INVOICE':
    case 'SUPPLIER_BILLS': return '/finance';
    default: return '/';
  }
}

/** The platform name the API's device registration expects. */
export function pushPlatform(platform: string): 'android' | 'ios' | null {
  return platform === 'android' || platform === 'ios' ? platform : null;
}

/**
 * What the staff app does differently inside the Capacitor wrapper (Android / iOS): the camera
 * and push notifications. Every method is a no-op in a browser, so callers need no checks.
 */
@Injectable({ providedIn: 'root' })
export class NativeService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private listening = false;
  private registering = false;

  isNative(): boolean {
    return Capacitor.isNativePlatform();
  }

  /** Takes a photo with the phone's camera; null when cancelled or in a browser. */
  async takePhoto(): Promise<File | null> {
    if (!this.isNative()) return null;
    const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
    try {
      const photo = await Camera.getPhoto({
        source: CameraSource.Camera, resultType: CameraResultType.Uri, quality: 85, correctOrientation: true,
      });
      if (!photo.webPath) return null;
      const blob = await (await fetch(photo.webPath)).blob();
      const ext = photo.format || 'jpeg';
      return new File([blob], `photo-${Date.now()}.${ext}`, { type: blob.type || `image/${ext}` });
    } catch {
      // Cancelled, or the camera permission was refused.
      return null;
    }
  }

  /**
   * After sign-in on a phone: asks for permission to notify, registers with FCM / APNs and sends
   * the token to the API, so in-app notifications also arrive as pushes.
   */
  async registerPush(): Promise<void> {
    const platform = pushPlatform(Capacitor.getPlatform());
    if (!this.isNative() || !platform || this.registering) return;
    this.registering = true;
    try {
      const { PushNotifications } = await import('@capacitor/push-notifications');
      if (!this.listening) {
        this.listening = true;
        await PushNotifications.addListener('registration', ({ value }) => {
          try { localStorage.setItem(PUSH_TOKEN_KEY, value); } catch { /* unregistered at sign-out only if stored */ }
          this.http.post(`${API_CONFIG.baseUrl}/devices`, { platform, token: value })
            .subscribe({ error: e => console.warn('Push registration refused by the server', e) });
        });
        await PushNotifications.addListener('registrationError', e => console.warn('Push registration failed', e));
        await PushNotifications.addListener('pushNotificationActionPerformed', action => {
          const data = (action.notification?.data ?? {}) as { entityType?: string; entityId?: string };
          void this.router.navigateByUrl(pushRoute(data.entityType, data.entityId));
        });
      }
      let status = await PushNotifications.checkPermissions();
      if (status.receive === 'prompt' || status.receive === 'prompt-with-rationale') {
        status = await PushNotifications.requestPermissions();
      }
      if (status.receive === 'granted') await PushNotifications.register();
    } catch (e) {
      console.warn('Push notifications unavailable', e);
    } finally {
      this.registering = false;
    }
  }

  /** At sign-out, while the session still exists: this phone stops receiving the user's pushes. */
  async unregisterPush(): Promise<void> {
    if (!this.isNative()) return;
    let token: string | null = null;
    try { token = localStorage.getItem(PUSH_TOKEN_KEY); } catch { /* nothing stored */ }
    if (!token) return;
    try {
      await firstValueFrom(this.http.delete(`${API_CONFIG.baseUrl}/devices`, { body: { token } }));
    } catch {
      // The server forgets stale tokens on its own when a push to them fails.
    }
    try { localStorage.removeItem(PUSH_TOKEN_KEY); } catch { /* ignore */ }
  }
}
