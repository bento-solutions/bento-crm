import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { BaseApiService } from '../../core/services/base-api.service';

export type FileSource = 'UPLOAD' | 'EMAIL' | 'WHATSAPP' | 'SYSTEM';

export interface DriveFolder {
  id: string;
  name: string;
  parentId?: string | null;
  partnerId?: string | null;
  systemKey?: string | null;
  /** System folders (per-contact, inbound mail...) cannot be renamed or deleted. */
  locked: boolean;
}

export interface DriveFile {
  id: string;
  fileName: string;
  contentType?: string | null;
  sizeBytes?: number | null;
  folderId?: string | null;
  tags: string[];
  description?: string | null;
  partnerId?: string | null;
  partnerName?: string | null;
  ownerEntityType?: string | null;
  ownerEntityId?: string | null;
  source?: FileSource | null;
  uploadedAt?: string | null;
}

export interface DriveListing {
  folder?: DriveFolder | null;
  path: DriveFolder[];
  folders: DriveFolder[];
  files: DriveFile[];
  totalFiles: number;
}

export interface DriveQuery {
  folderId?: string | null;
  q?: string | null;
  tag?: string | null;
  partnerId?: string | null;
  page?: number;
  size?: number;
}

export interface FileUpdate {
  fileName?: string;
  folderId?: string | null;
  moveToRoot?: boolean;
  tags?: string[];
  description?: string | null;
  partnerId?: string | null;
  unlinkPartner?: boolean;
}

export interface ShareLink {
  id: string;
  url: string;
  expiresAt: string;
  active: boolean;
  downloadCount: number;
  createdAt: string;
}

export interface PublicSharedFile {
  fileName: string;
  contentType?: string | null;
  sizeBytes?: number | null;
  expiresAt: string;
}

export interface ContactOption {
  id: string;
  name: string;
}

/** The document drive (backend: DriveController, PublicFileController). */
@Injectable({ providedIn: 'root' })
export class DriveApi extends BaseApiService {
  list(query: DriveQuery): Observable<DriveListing> {
    const params: Record<string, string | number> = { page: query.page ?? 0, size: query.size ?? 100 };
    if (query.folderId) params['folderId'] = query.folderId;
    if (query.q) params['q'] = query.q;
    if (query.tag) params['tag'] = query.tag;
    if (query.partnerId) params['partnerId'] = query.partnerId;
    return this.get('/drive', params);
  }

  folders(): Observable<DriveFolder[]> {
    return this.get('/drive/folders');
  }

  tags(): Observable<string[]> {
    return this.get('/drive/tags');
  }

  createFolder(name: string, parentId?: string | null): Observable<DriveFolder> {
    return this.post('/drive/folders', { name, parentId: parentId ?? null });
  }

  updateFolder(id: string, body: { name: string; parentId?: string | null; partnerId?: string | null }): Observable<DriveFolder> {
    return this.put(`/drive/folders/${id}`, body);
  }

  deleteFolder(id: string): Observable<void> {
    return this.delete(`/drive/folders/${id}`);
  }

  upload(file: File, folderId?: string | null): Observable<DriveFile> {
    const form = new FormData();
    form.append('file', file);
    if (folderId) form.append('folderId', folderId);
    return this.post('/drive/files', form);
  }

  updateFile(id: string, body: FileUpdate): Observable<DriveFile> {
    return this.put(`/drive/files/${id}`, body);
  }

  deleteFile(id: string): Observable<void> {
    return this.delete(`/drive/files/${id}`);
  }

  /** The file's bytes, fetched with the session (a plain <img>/<iframe> src cannot carry the token). */
  content(id: string, download = false): Observable<Blob> {
    return this.getBlob(`/drive/files/${id}/content${download ? '?download=true' : ''}`);
  }

  shares(fileId: string): Observable<ShareLink[]> {
    return this.get(`/drive/files/${fileId}/shares`);
  }

  share(fileId: string, expiresInDays: number): Observable<ShareLink> {
    return this.post(`/drive/files/${fileId}/shares`, { expiresInDays });
  }

  revokeShare(linkId: string): Observable<void> {
    return this.delete(`/drive/shares/${linkId}`);
  }

  /** Every contact, for the contact filter and the "link to contact" picker. */
  contacts(type?: 'VENDOR' | 'CUSTOMER'): Observable<ContactOption[]> {
    const endpoint = type ? `/partners/type/${type}` : '/partners';
    return this.get<{ content?: { id: string; name: string }[] }>(endpoint, { size: 1000 }).pipe(
      map(page => (page.content ?? []).map(p => ({ id: p.id, name: p.name }))
        .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))),
    );
  }

  // Public side: no session, the token is the credential.
  publicFile(token: string): Observable<PublicSharedFile> {
    return this.get(`/public/files/${encodeURIComponent(token)}`);
  }

  publicDownloadUrl(token: string): string {
    return `${this.baseUrl}/public/files/${encodeURIComponent(token)}/download`;
  }
}
