import { Component, DestroyRef, effect, inject, input, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { ApiService } from '../services/api.service';

export interface StoredFileDto {
  id: string;
  fileName: string;
  sizeBytes?: number;
  createdAt?: string;
  contentType?: string;
}

/**
 * Generic attachment list for any entity, backed directly by the `/files` API
 * (`ownerEntityType`/`ownerEntityId`) rather than a locally-cached array — the file
 * list itself is the source of truth, so it survives a page reload.
 */
@Component({
  selector: 'app-attachments',
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="space-y-2">
      <div class="flex items-center justify-between">
        <h4 class="eyebrow">Attachments</h4>
        @if (canWrite()) {
          <label class="text-xs font-semibold text-accent-ink hover:text-accent-ink cursor-pointer flex items-center gap-1">
            <mat-icon class="icon-sm">attach_file</mat-icon>
            {{ uploading() ? 'Uploading…' : 'Add file' }}
            <input type="file" class="hidden" [disabled]="uploading()" (change)="onFileSelected($event)" />
          </label>
        }
      </div>

      @if (loading()) {
        <p class="text-xs text-ink-3 italic">Loading attachments…</p>
      } @else if (files().length === 0) {
        <p class="text-xs text-ink-3 italic">No attachments yet.</p>
      } @else {
        <div class="space-y-1.5">
          @for (file of files(); track file.id) {
            <div class="flex items-center justify-between gap-2 bg-subtle border border-line-soft rounded-lg px-3 py-2">
              <div class="flex items-center gap-2 min-w-0">
                @if (isImage(file) && previewUrls()[file.id]; as previewUrl) {
                  <img [src]="previewUrl" [alt]="file.fileName" (click)="openPreview(file)" class="w-8 h-8 rounded-sm object-cover shrink-0 cursor-pointer" />
                } @else {
                  <mat-icon class="text-ink-4 shrink-0 icon-sm">description</mat-icon>
                }
                <span
                  class="text-xs font-semibold text-ink truncate"
                  [class.cursor-pointer]="isImage(file) && previewUrls()[file.id]"
                  [class.hover:underline]="isImage(file) && previewUrls()[file.id]"
                  (click)="isImage(file) && openPreview(file)"
                >{{ file.fileName }}</span>
                <span class="text-meta text-ink-3 shrink-0">{{ formatFileSize(file.sizeBytes) }}</span>
              </div>
              <div class="flex items-center gap-0.5 shrink-0">
                <button (click)="downloadFile(file)" title="Download" class="btn-icon btn-sm">
                  <mat-icon class="icon-sm">file_download</mat-icon>
                </button>
                @if (canWrite()) {
                  <button (click)="deleteFile(file.id)" title="Delete" class="btn-icon btn-sm btn-danger-hover">
                    <mat-icon class="icon-sm">close</mat-icon>
                  </button>
                }
              </div>
            </div>
          }
        </div>
      }
    </div>

    @if (previewFile(); as preview) {
      <div class="modal-backdrop" (click)="closePreview()">
        <img [src]="preview.url" [alt]="preview.fileName" class="max-w-full max-h-full rounded-lg shadow-2xl" (click)="$event.stopPropagation()" />
        <button (click)="closePreview()" title="Close" class="absolute top-4 right-4 text-white/80 hover:text-white p-2">
          <mat-icon>close</mat-icon>
        </button>
      </div>
    }
  `
})
export class AttachmentsComponent {
  private api = inject(ApiService);
  private destroyRef = inject(DestroyRef);

  ownerEntityType = input.required<string>();
  ownerEntityId = input.required<string>();
  canWrite = input<boolean>(true);

  files = signal<StoredFileDto[]>([]);
  loading = signal(false);
  uploading = signal(false);

  // Object URLs for image attachments, fetched via the authenticated Blob download
  // rather than a plain <img src> — the /files/{id} endpoint requires a Bearer token,
  // which a browser-issued <img> request can't carry. Keyed by file id, revoked on
  // owner change / delete / destroy so they don't leak.
  previewUrls = signal<Record<string, string>>({});
  previewFile = signal<{ url: string; fileName: string } | null>(null);

  constructor() {
    effect(() => {
      const type = this.ownerEntityType();
      const id = this.ownerEntityId();
      if (!id) return;
      this.loading.set(true);
      // Reading `previewUrls()` here (even via the private helper) would make the effect
      // depend on it — and since clearPreviews() also writes a fresh `{}` to it, the effect
      // would retrigger itself on every run, hammering this endpoint in an infinite loop.
      untracked(() => this.clearPreviews());
      this.api.getFilesForOwner(type, id).subscribe({
        next: (files) => {
          this.files.set(files || []);
          this.loading.set(false);
          (files || []).filter(f => this.isImage(f)).forEach(f => this.loadPreview(f));
        },
        error: () => this.loading.set(false)
      });
    });

    this.destroyRef.onDestroy(() => this.clearPreviews());
  }

  isImage(file: StoredFileDto): boolean {
    return !!file.contentType?.startsWith('image/');
  }

  openPreview(file: StoredFileDto): void {
    const url = this.previewUrls()[file.id];
    if (!url) return;
    this.previewFile.set({ url, fileName: file.fileName });
  }

  closePreview(): void {
    this.previewFile.set(null);
  }

  private loadPreview(file: StoredFileDto): void {
    if (this.previewUrls()[file.id]) return;
    this.api.downloadStoredFile(file.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        this.previewUrls.update(urls => ({ ...urls, [file.id]: url }));
      },
      error: () => { /* leave the generic file icon as a fallback */ }
    });
  }

  private clearPreviews(): void {
    Object.values(this.previewUrls()).forEach(url => URL.revokeObjectURL(url));
    this.previewUrls.set({});
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !this.canWrite()) return;
    this.uploading.set(true);
    this.api.uploadFile(file, this.ownerEntityType(), this.ownerEntityId()).subscribe({
      next: (dto) => {
        this.uploading.set(false);
        this.files.update(files => [...files, dto]);
        if (this.isImage(dto)) this.loadPreview(dto);
        input.value = '';
      },
      error: () => {
        this.uploading.set(false);
        input.value = '';
      }
    });
  }

  deleteFile(fileId: string): void {
    if (!this.canWrite()) return;
    const prev = this.files();
    this.files.update(files => files.filter(f => f.id !== fileId));
    const url = this.previewUrls()[fileId];
    if (url) {
      URL.revokeObjectURL(url);
      this.previewUrls.update(urls => {
        const rest = { ...urls };
        delete rest[fileId];
        return rest;
      });
    }
    this.api.deleteFile(fileId).subscribe({
      error: () => this.files.set(prev)
    });
  }

  downloadFile(file: StoredFileDto): void {
    this.api.downloadStoredFile(file.id).subscribe({
      next: (blob) => this.api.downloadBlob(blob, file.fileName),
      error: () => { /* handle error */ }
    });
  }

  formatFileSize(bytes?: number): string {
    if (!bytes) return 'N/A';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
