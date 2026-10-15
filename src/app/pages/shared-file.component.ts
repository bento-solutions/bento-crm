import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '../pipes/translate.pipe';
import { DriveApi, PublicSharedFile } from '../services/domains/drive.service';
import { formatBytes } from '../shared/documents.util';

/**
 * The recipient's side of a drive share link: the file's name, size and expiry, and a download
 * button. Reached with no session (like Pay-by-Link), so it renders without the app shell; the
 * token in the path is the credential. An expired or revoked link answers 404.
 */
@Component({
  selector: 'app-shared-file',
  imports: [MatIconModule, TranslatePipe],
  template: `
    <div class="min-h-screen bg-canvas flex items-start sm:items-center justify-center px-4 py-8">
      <div class="w-full max-w-[480px] space-y-4">
        @if (loading()) {
          <div class="card p-10 text-center">
            <div class="w-8 h-8 mx-auto border-2 border-line border-t-accent rounded-full animate-spin"></div>
          </div>
        } @else if (file(); as f) {
          <div class="card p-6 sm:p-8 space-y-6">
            <div class="flex items-center gap-3 min-w-0">
              <span class="icon-chip shrink-0"><mat-icon>{{ f.contentType === 'application/pdf' ? 'picture_as_pdf' : 'description' }}</mat-icon></span>
              <div class="min-w-0">
                <h1 class="t-title break-words">{{ f.fileName }}</h1>
                <p class="text-sm text-ink-3">{{ size(f.sizeBytes) }}</p>
              </div>
            </div>
            <a class="btn-primary w-full" [href]="downloadUrl" rel="noopener">
              <mat-icon class="icon-sm">download</mat-icon>{{ 'sharedFile.download' | translate }}
            </a>
            <p class="text-xs text-ink-3 text-center">{{ 'sharedFile.expires' | translate: { date: date(f.expiresAt) } }}</p>
          </div>
        } @else {
          <div class="card p-8 text-center space-y-3">
            <mat-icon class="text-ink-3">link_off</mat-icon>
            <h1 class="t-title">{{ (notFound() ? 'sharedFile.notFound' : 'sharedFile.error') | translate }}</h1>
            <p class="text-sm text-ink-3">{{ (notFound() ? 'sharedFile.notFoundHint' : 'sharedFile.errorHint') | translate }}</p>
          </div>
        }
      </div>
    </div>
  `,
})
export class SharedFileComponent implements OnInit {
  private api = inject(DriveApi);
  private route = inject(ActivatedRoute);

  token = '';
  downloadUrl = '';
  loading = signal(true);
  notFound = signal(false);
  file = signal<PublicSharedFile | null>(null);

  ngOnInit(): void {
    this.token = this.route.snapshot.paramMap.get('token') ?? '';
    this.downloadUrl = this.api.publicDownloadUrl(this.token);
    this.api.publicFile(this.token).subscribe({
      next: f => { this.file.set(f); this.loading.set(false); },
      error: (e: { status?: number }) => {
        this.notFound.set(e?.status === 404 || e?.status === 410 || e?.status === 400);
        this.loading.set(false);
      },
    });
  }

  size(bytes?: number | null): string {
    return formatBytes(bytes);
  }

  date(iso: string): string {
    return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
}
