import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../pipes/translate.pipe';
import { TranslationService } from '../services/translation.service';
import { ToastService } from '../services/toast.service';
import { CrmStateService } from '../services/crm-state.service';
import { PageHeaderComponent } from '../shared/ui/page-header.component';
import { EmptyStateComponent } from '../shared/ui/empty-state.component';
import { ConfirmService } from '../shared/ui/confirm.service';
import { FilePreviewComponent } from '../shared/file-preview.component';
import { absoluteUrl, formatBytes } from '../shared/documents.util';
import {
  ContactOption, DriveApi, DriveFile, DriveFolder, DriveListing, FileSource, ShareLink,
} from '../services/domains/drive.service';

interface FolderForm {
  id?: string;
  name: string;
  parentId: string | null;
  partnerId?: string | null;
  /** 'rename' shows the name only, 'move' the parent only. */
  mode: 'new' | 'rename' | 'move';
}

interface FileForm {
  id: string;
  fileName: string;
  tags: string;
  description: string;
  partnerId: string | null;
  folderId: string | null;
  originalPartnerId: string | null;
  originalFolderId: string | null;
}

const PAGE_SIZE = 50;

/**
 * Documents: the organisation's drive. Folders (some are kept by the system: per contact, inbound
 * mail...), files with tags and a contact, search across the whole drive, drag-and-drop upload,
 * inline preview and time-limited public share links.
 */
@Component({
  selector: 'app-drive',
  imports: [FormsModule, MatIconModule, RouterLink, TranslatePipe, PageHeaderComponent, EmptyStateComponent, FilePreviewComponent],
  template: `
    <div class="page">
      <app-page-header [title]="'drive.title' | translate" [subtitle]="'drive.subtitle' | translate">
        <div actions class="flex flex-wrap gap-2">
          @if (canSeeInbox()) {
            <a routerLink="/inbox-documents" class="btn-secondary"><mat-icon>move_to_inbox</mat-icon>{{ 'drive.inbox' | translate }}</a>
          }
          @if (canWrite()) {
            <button class="btn-secondary" (click)="openNewFolder()"><mat-icon>create_new_folder</mat-icon>{{ 'drive.newFolder' | translate }}</button>
            <label class="btn-primary cursor-pointer">
              <mat-icon>upload</mat-icon>{{ (uploading() ? 'drive.uploading' : 'drive.upload') | translate }}
              <input type="file" multiple class="hidden" [disabled]="uploading()" (change)="onPick($event)" />
            </label>
          }
        </div>
      </app-page-header>

      <!-- Where we are -->
      <nav class="flex flex-wrap items-center gap-1 text-sm" [attr.aria-label]="'drive.breadcrumb' | translate">
        <button class="btn-ghost btn-sm" (click)="openFolder(null)" [class.text-ink]="!folderId()">
          <mat-icon class="icon-sm">folder_open</mat-icon>{{ 'drive.root' | translate }}
        </button>
        @for (f of listing()?.path ?? []; track f.id) {
          <mat-icon class="icon-xs text-ink-4 rtl:rotate-180">chevron_right</mat-icon>
          <button class="btn-ghost btn-sm" (click)="openFolder(f.id)">{{ f.name }}</button>
        }
        @if (currentFolder(); as cf) {
          @if (canWrite() && !cf.locked && !searching()) {
            <span class="ms-auto flex gap-1">
              <button class="btn-ghost btn-sm" (click)="openRename(cf)"><mat-icon class="icon-sm">edit</mat-icon>{{ 'drive.rename' | translate }}</button>
              <button class="btn-ghost btn-sm" (click)="openMoveFolder(cf)"><mat-icon class="icon-sm">drive_file_move</mat-icon>{{ 'drive.move' | translate }}</button>
              <button class="btn-ghost btn-sm" (click)="deleteFolder(cf)"><mat-icon class="icon-sm">delete</mat-icon>{{ 'drive.delete' | translate }}</button>
            </span>
          } @else if (cf.locked) {
            <span class="ms-auto badge badge-neutral"><mat-icon class="icon-xs">lock</mat-icon>{{ 'drive.systemFolder' | translate }}</span>
          }
        }
      </nav>

      <div class="toolbar">
        <label class="search-field">
          <mat-icon>search</mat-icon>
          <input class="input-field" type="search" [placeholder]="'drive.search' | translate" [attr.aria-label]="'drive.search' | translate"
                 [ngModel]="q()" (ngModelChange)="onSearch($event)" />
        </label>
        <select class="input-field" [ngModel]="tag()" (ngModelChange)="tag.set($event); page.set(0); load()" [attr.aria-label]="'drive.tag' | translate">
          <option [ngValue]="null">{{ 'drive.allTags' | translate }}</option>
          @for (t of tags(); track t) { <option [ngValue]="t">{{ t }}</option> }
        </select>
        <select class="input-field" [ngModel]="partnerId()" (ngModelChange)="partnerId.set($event); page.set(0); load()" [attr.aria-label]="'drive.contact' | translate">
          <option [ngValue]="null">{{ 'drive.allContacts' | translate }}</option>
          @for (c of contacts(); track c.id) { <option [ngValue]="c.id">{{ c.name }}</option> }
        </select>
        @if (searching()) {
          <button class="btn-ghost btn-sm" (click)="clearFilters()">{{ 'drive.clearFilters' | translate }}</button>
        }
        <span class="toolbar__spacer"></span>
        <span class="toolbar__count">{{ 'drive.fileCount' | translate: { n: listing()?.totalFiles ?? 0 } }}</span>
      </div>

      @if (searching()) {
        <p class="text-xs text-ink-3">{{ 'drive.searchAll' | translate }}</p>
      }

      @if (!searching() && (listing()?.folders ?? []).length) {
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          @for (f of listing()!.folders; track f.id) {
            <button class="card card-interactive flex items-center gap-2 p-3 text-start min-w-0" (click)="openFolder(f.id)">
              <mat-icon class="text-ink-3 shrink-0">{{ f.locked ? 'folder_special' : 'folder' }}</mat-icon>
              <span class="text-sm font-medium text-ink truncate">{{ f.name }}</span>
            </button>
          }
        </div>
      }

      <section class="table-card relative" [class.ring-2]="dragging()" [class.ring-primary]="dragging()"
               (dragover)="onDragOver($event)" (dragleave)="dragging.set(false)" (drop)="onDrop($event)"
               [attr.aria-label]="'drive.files' | translate">
        <table class="data-table">
          <thead><tr>
            <th>{{ 'drive.name' | translate }}</th>
            <th>{{ 'drive.tags' | translate }}</th>
            <th>{{ 'drive.contact' | translate }}</th>
            <th class="col-num">{{ 'drive.size' | translate }}</th>
            <th>{{ 'drive.source' | translate }}</th>
            <th>{{ 'drive.date' | translate }}</th>
            <th class="col-actions"></th>
          </tr></thead>
          <tbody>
            @for (f of listing()?.files ?? []; track f.id) {
              <tr>
                <td class="max-w-72">
                  <button class="flex items-center gap-2 text-start min-w-0" (click)="preview.set(f)">
                    <mat-icon class="icon-sm text-ink-4 shrink-0">{{ icon(f) }}</mat-icon>
                    <span class="cell-title truncate hover:underline">{{ f.fileName }}</span>
                  </button>
                  @if (f.description) { <div class="cell-sub truncate">{{ f.description }}</div> }
                </td>
                <td>
                  <div class="flex flex-wrap gap-1">
                    @for (t of f.tags; track t) {
                      <button class="chip" (click)="tag.set(t); page.set(0); load()">{{ t }}</button>
                    }
                  </div>
                </td>
                <td class="cell-muted whitespace-nowrap">{{ f.partnerName || '—' }}</td>
                <td class="col-num num cell-muted whitespace-nowrap">{{ size(f.sizeBytes) }}</td>
                <td><span class="badge" [class]="sourceBadge(f.source)">{{ ('drive.source.' + (f.source || 'UPLOAD')) | translate }}</span></td>
                <td class="cell-muted whitespace-nowrap">{{ date(f.uploadedAt) }}</td>
                <td class="col-actions">
                  <button class="btn-icon btn-sm" (click)="preview.set(f)" [title]="'drive.preview' | translate" [attr.aria-label]="'drive.preview' | translate"><mat-icon class="icon-sm">visibility</mat-icon></button>
                  <button class="btn-icon btn-sm" (click)="download(f)" [title]="'drive.download' | translate" [attr.aria-label]="'drive.download' | translate"><mat-icon class="icon-sm">download</mat-icon></button>
                  <button class="btn-icon btn-sm" (click)="openShare(f)" [title]="'drive.share' | translate" [attr.aria-label]="'drive.share' | translate"><mat-icon class="icon-sm">share</mat-icon></button>
                  @if (canWrite()) {
                    <button class="btn-icon btn-sm" (click)="openEdit(f)" [title]="'drive.edit' | translate" [attr.aria-label]="'drive.edit' | translate"><mat-icon class="icon-sm">edit</mat-icon></button>
                    <button class="btn-icon btn-sm btn-danger-hover" (click)="deleteFile(f)" [title]="'drive.delete' | translate" [attr.aria-label]="'drive.delete' | translate"><mat-icon class="icon-sm">delete</mat-icon></button>
                  }
                </td>
              </tr>
            } @empty {
              <tr><td colspan="7" class="row-empty">
                <app-empty-state icon="folder_open" [title]="(searching() ? 'drive.noResults' : 'drive.emptyTitle') | translate"
                                 [text]="(canWrite() && !searching() ? 'drive.emptyText' : '') | translate" />
              </td></tr>
            }
          </tbody>
        </table>
        @if (totalPages() > 1) {
          <div class="flex items-center justify-end gap-2 px-5 py-3 border-t border-line">
            <button class="btn-icon btn-sm" [disabled]="page() === 0" (click)="goPage(page() - 1)" [attr.aria-label]="'drive.previous' | translate"><mat-icon class="icon-sm rtl:rotate-180">chevron_left</mat-icon></button>
            <span class="text-xs text-ink-2 num">{{ 'drive.pageOf' | translate: { page: page() + 1, pages: totalPages() } }}</span>
            <button class="btn-icon btn-sm" [disabled]="page() + 1 >= totalPages()" (click)="goPage(page() + 1)" [attr.aria-label]="'drive.next' | translate"><mat-icon class="icon-sm rtl:rotate-180">chevron_right</mat-icon></button>
          </div>
        }
        @if (canWrite()) {
          <p class="text-xs text-ink-3 px-5 py-3 border-t border-line flex items-center gap-1">
            <mat-icon class="icon-xs">upload_file</mat-icon>{{ 'drive.dropHint' | translate }}
          </p>
        }
      </section>
    </div>

    <!-- New / rename / move folder -->
    @if (folderForm(); as ff) {
      <div class="modal-backdrop">
        <div class="modal modal-md" role="dialog" aria-modal="true">
          <div class="modal-header">
            <h3 class="modal-title">{{ ('drive.folderTitle.' + ff.mode) | translate }}</h3>
            <button class="btn-icon btn-sm" (click)="folderForm.set(null)" [attr.aria-label]="'drive.cancel' | translate"><mat-icon class="icon-sm">close</mat-icon></button>
          </div>
          @if (ff.mode !== 'move') {
            <label class="block"><span class="field-label">{{ 'drive.folderName' | translate }}</span>
              <input class="input-field" [(ngModel)]="ff.name" maxlength="120" (keydown.enter)="saveFolder(ff)" /></label>
          }
          @if (ff.mode === 'move') {
            <label class="block"><span class="field-label">{{ 'drive.moveTo' | translate }}</span>
              <select class="input-field" [(ngModel)]="ff.parentId">
                <option [ngValue]="null">{{ 'drive.root' | translate }}</option>
                @for (o of folderOptions(ff.id); track o.id) { <option [ngValue]="o.id">{{ o.label }}</option> }
              </select></label>
          }
          <div class="modal-footer">
            <button class="btn-secondary" (click)="folderForm.set(null)">{{ 'drive.cancel' | translate }}</button>
            <button class="btn-primary" [disabled]="busy() || !ff.name.trim()" (click)="saveFolder(ff)">{{ 'drive.save' | translate }}</button>
          </div>
        </div>
      </div>
    }

    <!-- Edit file -->
    @if (fileForm(); as fm) {
      <div class="modal-backdrop">
        <div class="modal modal-lg" role="dialog" aria-modal="true">
          <div class="modal-header">
            <h3 class="modal-title">{{ 'drive.editFile' | translate }}</h3>
            <button class="btn-icon btn-sm" (click)="fileForm.set(null)" [attr.aria-label]="'drive.cancel' | translate"><mat-icon class="icon-sm">close</mat-icon></button>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label class="block sm:col-span-2"><span class="field-label">{{ 'drive.name' | translate }}</span>
              <input class="input-field" [(ngModel)]="fm.fileName" maxlength="255" /></label>
            <label class="block sm:col-span-2"><span class="field-label">{{ 'drive.tags' | translate }}</span>
              <input class="input-field" [(ngModel)]="fm.tags" [placeholder]="'drive.tagsPlaceholder' | translate" list="drive-tags" />
              <span class="field-hint">{{ 'drive.tagsHint' | translate }}</span></label>
            <datalist id="drive-tags">@for (t of tags(); track t) { <option [value]="t"></option> }</datalist>
            <label class="block sm:col-span-2"><span class="field-label">{{ 'drive.description' | translate }}</span>
              <textarea class="input-field" rows="2" maxlength="500" [(ngModel)]="fm.description"></textarea></label>
            <label class="block"><span class="field-label">{{ 'drive.contact' | translate }}</span>
              <select class="input-field" [(ngModel)]="fm.partnerId">
                <option [ngValue]="null">{{ 'drive.noContact' | translate }}</option>
                @for (c of contacts(); track c.id) { <option [ngValue]="c.id">{{ c.name }}</option> }
              </select></label>
            <label class="block"><span class="field-label">{{ 'drive.folder' | translate }}</span>
              <select class="input-field" [(ngModel)]="fm.folderId">
                <option [ngValue]="null">{{ 'drive.root' | translate }}</option>
                @for (o of folderOptions(); track o.id) { <option [ngValue]="o.id">{{ o.label }}</option> }
              </select></label>
          </div>
          <div class="modal-footer">
            <button class="btn-secondary" (click)="fileForm.set(null)">{{ 'drive.cancel' | translate }}</button>
            <button class="btn-primary" [disabled]="busy() || !fm.fileName.trim()" (click)="saveFile(fm)">{{ 'drive.save' | translate }}</button>
          </div>
        </div>
      </div>
    }

    <!-- Preview -->
    @if (preview(); as p) {
      <div class="modal-backdrop">
        <div class="modal modal-3xl h-full" role="dialog" aria-modal="true">
          <div class="modal-header">
            <div class="min-w-0">
              <h3 class="modal-title truncate">{{ p.fileName }}</h3>
              <p class="modal-subtitle">{{ size(p.sizeBytes) }}@if (p.partnerName) { · {{ p.partnerName }} }</p>
            </div>
            <div class="flex gap-1 shrink-0">
              <button class="btn-secondary btn-sm" (click)="download(p)"><mat-icon class="icon-sm">download</mat-icon>{{ 'drive.download' | translate }}</button>
              <button class="btn-icon btn-sm" (click)="preview.set(null)" [attr.aria-label]="'drive.close' | translate"><mat-icon class="icon-sm">close</mat-icon></button>
            </div>
          </div>
          <app-file-preview class="flex-1 min-h-0" [fileId]="p.id" [contentType]="p.contentType" [fileName]="p.fileName" />
        </div>
      </div>
    }

    <!-- Share links -->
    @if (sharing(); as s) {
      <div class="modal-backdrop">
        <div class="modal modal-lg" role="dialog" aria-modal="true">
          <div class="modal-header">
            <div class="min-w-0">
              <h3 class="modal-title">{{ 'drive.shareTitle' | translate }}</h3>
              <p class="modal-subtitle truncate">{{ s.fileName }}</p>
            </div>
            <button class="btn-icon btn-sm" (click)="sharing.set(null)" [attr.aria-label]="'drive.close' | translate"><mat-icon class="icon-sm">close</mat-icon></button>
          </div>
          @if (canWrite()) {
            <div class="flex flex-wrap items-end gap-3">
              <label class="block"><span class="field-label">{{ 'drive.expiresIn' | translate }}</span>
                <input type="number" min="1" max="90" step="1" class="input-field w-28 num" [(ngModel)]="shareDays" /></label>
              <button class="btn-primary" [disabled]="busy() || !validDays()" (click)="createShare(s)"><mat-icon>link</mat-icon>{{ 'drive.createLink' | translate }}</button>
            </div>
            <p class="text-xs text-ink-3">{{ 'drive.shareHint' | translate }}</p>
          }
          <div class="table-card">
            <table class="data-table is-dense">
              <thead><tr>
                <th>{{ 'drive.link' | translate }}</th>
                <th>{{ 'drive.expires' | translate }}</th>
                <th class="col-num">{{ 'drive.downloads' | translate }}</th>
                <th class="col-actions"></th>
              </tr></thead>
              <tbody>
                @for (l of shares(); track l.id) {
                  <tr>
                    <td class="max-w-56"><span class="text-xs t-mono truncate block" [title]="l.url">{{ l.url }}</span>
                      @if (!l.active) { <span class="badge badge-neutral mt-1">{{ 'drive.inactive' | translate }}</span> }</td>
                    <td class="cell-muted whitespace-nowrap">{{ date(l.expiresAt) }}</td>
                    <td class="col-num num">{{ l.downloadCount }}</td>
                    <td class="col-actions">
                      @if (l.active) {
                        <button class="btn-icon btn-sm" (click)="copy(l)" [title]="'drive.copy' | translate" [attr.aria-label]="'drive.copy' | translate"><mat-icon class="icon-sm">content_copy</mat-icon></button>
                        @if (canWrite()) {
                          <button class="btn-ghost btn-sm" (click)="revoke(s, l)">{{ 'drive.revoke' | translate }}</button>
                        }
                      }
                    </td>
                  </tr>
                } @empty {
                  <tr><td colspan="4" class="cell-muted text-center">{{ 'drive.noLinks' | translate }}</td></tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
    }
  `,
})
export class DriveComponent implements OnInit, OnDestroy {
  private api = inject(DriveApi);
  private toast = inject(ToastService);
  private i18n = inject(TranslationService);
  private state = inject(CrmStateService);
  private confirm = inject(ConfirmService);

  listing = signal<DriveListing | null>(null);
  allFolders = signal<DriveFolder[]>([]);
  tags = signal<string[]>([]);
  contacts = signal<ContactOption[]>([]);

  folderId = signal<string | null>(null);
  q = signal('');
  tag = signal<string | null>(null);
  partnerId = signal<string | null>(null);
  page = signal(0);

  busy = signal(false);
  uploading = signal(false);
  dragging = signal(false);

  folderForm = signal<FolderForm | null>(null);
  fileForm = signal<FileForm | null>(null);
  preview = signal<DriveFile | null>(null);
  sharing = signal<DriveFile | null>(null);
  shares = signal<ShareLink[]>([]);
  shareDays = 7;

  private searchTimer?: ReturnType<typeof setTimeout>;

  searching = computed(() => !!this.q().trim() || !!this.tag() || !!this.partnerId());
  currentFolder = computed(() => this.listing()?.folder ?? null);
  totalPages = computed(() => Math.max(1, Math.ceil((this.listing()?.totalFiles ?? 0) / PAGE_SIZE)));

  canWrite(): boolean {
    return this.state.hasAuthority('FILES_WRITE');
  }

  canSeeInbox(): boolean {
    return this.state.hasAuthority('INVOICES_READ') || this.state.hasAuthority('PAYMENTS_READ');
  }

  ngOnInit(): void {
    this.state.breadcrumbLabel.set(this.i18n.t('drive.title'));
    this.load();
    this.loadMeta();
    this.api.contacts().subscribe({ next: c => this.contacts.set(c), error: () => { /* the filter just stays empty */ } });
  }

  ngOnDestroy(): void {
    clearTimeout(this.searchTimer);
  }

  load(): void {
    this.api.list({
      folderId: this.searching() ? null : this.folderId(),
      q: this.q().trim() || null, tag: this.tag(), partnerId: this.partnerId(),
      page: this.page(), size: PAGE_SIZE,
    }).subscribe({ next: l => this.listing.set(l), error: e => this.fail(e) });
  }

  private loadMeta(): void {
    this.api.folders().subscribe({ next: f => this.allFolders.set(f), error: () => { /* pickers fall back to root only */ } });
    this.api.tags().subscribe({ next: t => this.tags.set(t), error: () => { /* no tag filter */ } });
  }

  openFolder(id: string | null): void {
    this.folderId.set(id);
    this.q.set('');
    this.tag.set(null);
    this.partnerId.set(null);
    this.page.set(0);
    this.load();
  }

  onSearch(value: string): void {
    this.q.set(value);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => { this.page.set(0); this.load(); }, 300);
  }

  clearFilters(): void {
    this.openFolder(this.folderId());
  }

  goPage(p: number): void {
    this.page.set(p);
    this.load();
  }

  // Upload
  onPick(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    this.uploadAll(files);
  }

  onDragOver(event: DragEvent): void {
    if (!this.canWrite()) return;
    event.preventDefault();
    this.dragging.set(true);
  }

  onDrop(event: DragEvent): void {
    if (!this.canWrite()) return;
    event.preventDefault();
    this.dragging.set(false);
    this.uploadAll(Array.from(event.dataTransfer?.files ?? []));
  }

  private uploadAll(files: File[]): void {
    if (!files.length || !this.canWrite()) return;
    // Uploads land in the folder being viewed, not in a search's "all folders" view.
    const target = this.folderId();
    this.uploading.set(true);
    let done = 0;
    let failed = 0;
    const next = (): void => {
      const file = files[done + failed];
      if (!file) {
        this.uploading.set(false);
        if (done) this.toast.show(this.i18n.t('drive.uploaded', { n: done }), { type: 'success' });
        this.load();
        this.loadMeta();
        return;
      }
      this.api.upload(file, target).subscribe({
        next: () => { done++; next(); },
        error: e => { failed++; this.fail(e, file.name); next(); },
      });
    };
    next();
  }

  // Folders
  openNewFolder(): void {
    this.folderForm.set({ name: '', parentId: this.folderId(), mode: 'new' });
  }

  openRename(f: DriveFolder): void {
    this.folderForm.set({ id: f.id, name: f.name, parentId: f.parentId ?? null, partnerId: f.partnerId ?? null, mode: 'rename' });
  }

  openMoveFolder(f: DriveFolder): void {
    this.folderForm.set({ id: f.id, name: f.name, parentId: f.parentId ?? null, partnerId: f.partnerId ?? null, mode: 'move' });
  }

  saveFolder(ff: FolderForm): void {
    const name = ff.name.trim();
    if (!name || this.busy()) return;
    this.busy.set(true);
    const req = ff.id
      ? this.api.updateFolder(ff.id, { name, parentId: ff.parentId, partnerId: ff.partnerId ?? null })
      : this.api.createFolder(name, ff.parentId);
    req.subscribe({
      next: () => {
        this.busy.set(false);
        this.folderForm.set(null);
        this.toast.show(this.i18n.t('drive.folderSaved'), { type: 'success' });
        this.load();
        this.loadMeta();
      },
      error: e => this.fail(e),
    });
  }

  async deleteFolder(f: DriveFolder): Promise<void> {
    const ok = await this.confirm.ask({
      title: this.i18n.t('drive.deleteFolderTitle', { name: f.name }),
      message: this.i18n.t('drive.deleteFolderText'),
      confirmLabel: this.i18n.t('drive.delete'), cancelLabel: this.i18n.t('drive.cancel'), danger: true,
    });
    if (!ok) return;
    this.api.deleteFolder(f.id).subscribe({
      next: () => {
        this.toast.show(this.i18n.t('drive.folderDeleted'), { type: 'success' });
        this.loadMeta();
        this.openFolder(f.parentId ?? null);
      },
      error: e => this.fail(e),
    });
  }

  /** Every folder as "Parent / Child", for the move pickers; `exclude` drops a folder and its sub-folders. */
  folderOptions(exclude?: string): { id: string; label: string }[] {
    const all = this.allFolders();
    const byId = new Map(all.map(f => [f.id, f]));
    const isUnder = (f: DriveFolder): boolean => {
      for (let cur: DriveFolder | undefined = f; cur; cur = cur.parentId ? byId.get(cur.parentId) : undefined) {
        if (cur.id === exclude) return true;
      }
      return false;
    };
    const label = (f: DriveFolder): string => {
      const parts: string[] = [];
      for (let cur: DriveFolder | undefined = f; cur && parts.length < 10; cur = cur.parentId ? byId.get(cur.parentId) : undefined) {
        parts.unshift(cur.name);
      }
      return parts.join(' / ');
    };
    return all.filter(f => !exclude || !isUnder(f)).map(f => ({ id: f.id, label: label(f) }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  // Files
  openEdit(f: DriveFile): void {
    this.fileForm.set({
      id: f.id, fileName: f.fileName, tags: (f.tags ?? []).join(', '), description: f.description ?? '',
      partnerId: f.partnerId ?? null, folderId: f.folderId ?? null,
      originalPartnerId: f.partnerId ?? null, originalFolderId: f.folderId ?? null,
    });
  }

  saveFile(fm: FileForm): void {
    this.busy.set(true);
    const tags = fm.tags.split(',').map(t => t.trim()).filter(Boolean);
    this.api.updateFile(fm.id, {
      fileName: fm.fileName.trim(),
      tags: [...new Set(tags)],
      description: fm.description.trim(),
      ...(fm.partnerId ? { partnerId: fm.partnerId } : fm.originalPartnerId ? { unlinkPartner: true } : {}),
      ...(fm.folderId ? { folderId: fm.folderId } : fm.originalFolderId ? { moveToRoot: true } : {}),
    }).subscribe({
      next: () => {
        this.busy.set(false);
        this.fileForm.set(null);
        this.toast.show(this.i18n.t('drive.fileSaved'), { type: 'success' });
        this.load();
        this.loadMeta();
      },
      error: e => this.fail(e),
    });
  }

  async deleteFile(f: DriveFile): Promise<void> {
    const ok = await this.confirm.ask({
      title: this.i18n.t('drive.deleteFileTitle', { name: f.fileName }),
      message: this.i18n.t('drive.deleteFileText'),
      confirmLabel: this.i18n.t('drive.delete'), cancelLabel: this.i18n.t('drive.cancel'), danger: true,
    });
    if (!ok) return;
    this.api.deleteFile(f.id).subscribe({
      next: () => { this.toast.show(this.i18n.t('drive.fileDeleted'), { type: 'success' }); this.load(); },
      error: e => this.fail(e),
    });
  }

  download(f: DriveFile): void {
    this.api.content(f.id, true).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = f.fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
      error: e => this.fail(e),
    });
  }

  // Sharing
  openShare(f: DriveFile): void {
    this.sharing.set(f);
    this.shares.set([]);
    this.shareDays = 7;
    this.loadShares(f);
  }

  private loadShares(f: DriveFile): void {
    this.api.shares(f.id).subscribe({ next: s => this.shares.set(s), error: e => this.fail(e) });
  }

  validDays(): boolean {
    const d = Number(this.shareDays);
    return Number.isInteger(d) && d >= 1 && d <= 90;
  }

  createShare(f: DriveFile): void {
    if (!this.validDays()) return;
    this.busy.set(true);
    this.api.share(f.id, Number(this.shareDays)).subscribe({
      next: link => {
        this.busy.set(false);
        this.loadShares(f);
        this.copy(link);
      },
      error: e => this.fail(e),
    });
  }

  copy(link: ShareLink): void {
    const url = absoluteUrl(link.url, window.location.origin);
    navigator.clipboard?.writeText(url).then(
      () => this.toast.show(this.i18n.t('drive.linkCopied'), { type: 'success' }),
      () => this.toast.show(url, { type: 'info' }),
    );
  }

  async revoke(f: DriveFile, link: ShareLink): Promise<void> {
    const ok = await this.confirm.ask({
      title: this.i18n.t('drive.revokeTitle'), message: this.i18n.t('drive.revokeText'),
      confirmLabel: this.i18n.t('drive.revoke'), cancelLabel: this.i18n.t('drive.cancel'), danger: true,
    });
    if (!ok) return;
    this.api.revokeShare(link.id).subscribe({ next: () => this.loadShares(f), error: e => this.fail(e) });
  }

  // Display
  icon(f: DriveFile): string {
    const t = (f.contentType ?? '').toLowerCase();
    if (t === 'application/pdf') return 'picture_as_pdf';
    if (t.startsWith('image/')) return 'image';
    if (t.includes('sheet') || t.includes('excel') || t.includes('csv')) return 'table_chart';
    return 'description';
  }

  sourceBadge(source?: FileSource | null): string {
    switch (source) {
      case 'EMAIL': return 'badge badge-info';
      case 'WHATSAPP': return 'badge badge-success';
      case 'SYSTEM': return 'badge badge-violet';
      default: return 'badge badge-neutral';
    }
  }

  size(bytes?: number | null): string {
    return formatBytes(bytes);
  }

  date(iso?: string | null): string {
    return iso ? new Date(iso).toLocaleDateString('fr-FR') : '—';
  }

  private fail(e: unknown, context?: string): void {
    this.busy.set(false);
    const err = e as { error?: { detail?: string } };
    const msg = err?.error?.detail || this.i18n.t('drive.error');
    this.toast.show(context ? `${context}: ${msg}` : msg, { type: 'error' });
  }
}
