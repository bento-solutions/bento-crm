import { Component, effect, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { ApiService } from '../services/api.service';

export interface StoredFileDto {
  id: string;
  fileName: string;
  sizeBytes?: number;
  createdAt?: string;
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
        <h4 class="text-xs font-bold text-zinc-500 uppercase tracking-wide">Attachments</h4>
        @if (canWrite()) {
          <label class="text-xs font-semibold text-blue-700 hover:text-blue-800 cursor-pointer flex items-center gap-1">
            <mat-icon class="text-[16px] w-4 h-4">attach_file</mat-icon>
            {{ uploading() ? 'Uploading…' : 'Add file' }}
            <input type="file" class="hidden" [disabled]="uploading()" (change)="onFileSelected($event)" />
          </label>
        }
      </div>

      @if (loading()) {
        <p class="text-xs text-zinc-400 italic">Loading attachments…</p>
      } @else if (files().length === 0) {
        <p class="text-xs text-zinc-400 italic">No attachments yet.</p>
      } @else {
        <div class="space-y-1.5">
          @for (file of files(); track file.id) {
            <div class="flex items-center justify-between gap-2 bg-zinc-50 border border-zinc-100 rounded-lg px-3 py-2">
              <div class="flex items-center gap-2 min-w-0">
                <mat-icon class="text-[16px] w-4 h-4 text-zinc-400 shrink-0">description</mat-icon>
                <a [href]="downloadUrl(file.id)" target="_blank" class="text-xs font-semibold text-zinc-800 hover:underline truncate">{{ file.fileName }}</a>
                <span class="text-meta text-zinc-400 shrink-0">{{ formatFileSize(file.sizeBytes) }}</span>
              </div>
              @if (canWrite()) {
                <button (click)="deleteFile(file.id)" title="Delete" class="text-zinc-400 hover:text-red-600 p-1 rounded transition-colors shrink-0">
                  <mat-icon class="text-[16px] w-4 h-4">close</mat-icon>
                </button>
              }
            </div>
          }
        </div>
      }
    </div>
  `
})
export class AttachmentsComponent {
  private api = inject(ApiService);

  ownerEntityType = input.required<string>();
  ownerEntityId = input.required<string>();
  canWrite = input<boolean>(true);

  files = signal<StoredFileDto[]>([]);
  loading = signal(false);
  uploading = signal(false);

  constructor() {
    effect(() => {
      const type = this.ownerEntityType();
      const id = this.ownerEntityId();
      if (!id) return;
      this.loading.set(true);
      this.api.getFilesForOwner(type, id).subscribe({
        next: (files) => {
          this.files.set(files || []);
          this.loading.set(false);
        },
        error: () => this.loading.set(false)
      });
    });
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
    this.api.deleteFile(fileId).subscribe({
      error: () => this.files.set(prev)
    });
  }

  downloadUrl(fileId: string): string {
    return this.api.getFileDownloadUrl(fileId);
  }

  formatFileSize(bytes?: number): string {
    if (!bytes) return 'N/A';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
