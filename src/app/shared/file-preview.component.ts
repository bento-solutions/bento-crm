import { Component, DestroyRef, effect, inject, input, signal, untracked } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '../pipes/translate.pipe';
import { DriveApi } from '../services/domains/drive.service';
import { previewKind } from './documents.util';

/**
 * Inline preview of a drive file (PDF or image). The bytes are fetched with the session and shown
 * from an object URL, like the attachments list does: the content endpoint needs the Bearer token,
 * which a plain <iframe>/<img> src cannot carry. Other types show a short "no preview" note.
 */
@Component({
  selector: 'app-file-preview',
  imports: [MatIconModule, TranslatePipe],
  template: `
    @if (!kind()) {
      <div class="h-full min-h-48 flex flex-col items-center justify-center gap-2 text-center p-6 bg-subtle rounded-lg">
        <mat-icon class="text-ink-4 icon-xl">description</mat-icon>
        <p class="text-sm text-ink-3">{{ 'drive.noPreview' | translate }}</p>
      </div>
    } @else if (failed()) {
      <div class="h-full min-h-48 flex items-center justify-center p-6 bg-subtle rounded-lg">
        <p class="text-sm text-ink-3">{{ 'drive.previewFailed' | translate }}</p>
      </div>
    } @else if (!objectUrl()) {
      <div class="h-full min-h-48 flex items-center justify-center bg-subtle rounded-lg">
        <div class="w-8 h-8 border-2 border-line border-t-accent rounded-full animate-spin"></div>
      </div>
    } @else if (kind() === 'pdf') {
      <iframe class="w-full h-full min-h-96 rounded-lg border border-line bg-surface" [src]="safeUrl()" [title]="fileName()"></iframe>
    } @else {
      <div class="h-full flex items-center justify-center bg-subtle rounded-lg overflow-auto">
        <img [src]="objectUrl()" [alt]="fileName()" class="max-w-full max-h-full object-contain" />
      </div>
    }
  `,
  host: { class: 'block' },
})
export class FilePreviewComponent {
  private api = inject(DriveApi);
  private sanitizer = inject(DomSanitizer);

  fileId = input.required<string>();
  contentType = input<string | null | undefined>(null);
  fileName = input<string>('');

  kind = signal<'pdf' | 'image' | null>(null);
  objectUrl = signal<string | null>(null);
  safeUrl = signal<SafeResourceUrl | null>(null);
  failed = signal(false);

  constructor() {
    effect(() => {
      const id = this.fileId();
      const kind = previewKind(this.contentType());
      untracked(() => {
        this.release();
        this.kind.set(kind);
        this.failed.set(false);
        if (!id || !kind) return;
        this.api.content(id).subscribe({
          next: blob => {
            if (this.fileId() !== id) return;
            const url = URL.createObjectURL(blob);
            this.objectUrl.set(url);
            this.safeUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(url));
          },
          error: () => this.failed.set(true),
        });
      });
    });
    inject(DestroyRef).onDestroy(() => this.release());
  }

  private release(): void {
    const url = this.objectUrl();
    if (url) URL.revokeObjectURL(url);
    this.objectUrl.set(null);
    this.safeUrl.set(null);
  }
}
