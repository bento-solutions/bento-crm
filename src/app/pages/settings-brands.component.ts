import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { firstValueFrom } from 'rxjs';
import { TranslatePipe } from '../pipes/translate.pipe';
import { TranslationService } from '../services/translation.service';
import { ToastService } from '../services/toast.service';
import { CrmStateService, Brand } from '../services/crm-state.service';
import { ApiService } from '../services/api.service';
import { ApiClientError } from '../core/services/base-api.service';
import { PageHeaderComponent } from '../shared/ui/page-header.component';
import { EmptyStateComponent } from '../shared/ui/empty-state.component';
import { IDENTITY_PALETTE } from '../shared/ui/identity-color';

interface BrandForm {
  name: string;
  code: string;
  description: string;
  colorHex: string;
  isDefault: boolean;
  isActive: boolean;
}

const EMPTY_FORM: BrandForm = { name: '', code: '', description: '', colorHex: IDENTITY_PALETTE[8], isDefault: false, isActive: true };

/**
 * Settings → Brands: the product-line referential (BentoCars, BentoTravel, CRMbento...) leads
 * and campaigns are attributed to. See backend BrandController for the CRUD this drives.
 */
@Component({
  selector: 'app-settings-brands',
  imports: [FormsModule, MatIconModule, TranslatePipe, PageHeaderComponent, EmptyStateComponent],
  template: `
    <div class="page max-w-3xl">
      <app-page-header size="section" [title]="'brands.title' | translate" [subtitle]="'brands.subtitle' | translate">
        @if (editing() === null && canWrite()) {
          <button actions type="button" class="btn-primary" (click)="startCreate()">
            <mat-icon>add</mat-icon>
            {{ 'brands.new' | translate }}
          </button>
        }
      </app-page-header>

      @if (editing() !== null) {
        <section class="card">
          <div class="card-header">
            <h3 class="card-title">{{ (editing() === 'new' ? 'brands.new' : 'brands.edit') | translate }}</h3>
          </div>
          <div class="card-body space-y-4">
            <div class="grid gap-4 sm:grid-cols-2">
              <label class="field">
                <span class="field-label">{{ 'brands.name' | translate }}</span>
                <input class="input-field"
                       [placeholder]="'brands.namePlaceholder' | translate"
                       [ngModel]="form().name" (ngModelChange)="patchForm({ name: $event })" maxlength="100" />
              </label>
              <label class="field">
                <span class="field-label">{{ 'brands.code' | translate }}</span>
                <input class="input-field"
                       [placeholder]="'brands.codePlaceholder' | translate"
                       [ngModel]="form().code" (ngModelChange)="patchForm({ code: $event })" maxlength="20" />
              </label>
            </div>
            <label class="field">
              <span class="field-label">{{ 'brands.description' | translate }}</span>
              <textarea class="input-field" rows="2"
                        [placeholder]="'brands.descriptionPlaceholder' | translate"
                        [ngModel]="form().description" (ngModelChange)="patchForm({ description: $event })"></textarea>
            </label>
            <div class="flex flex-wrap items-end gap-x-6 gap-y-3">
              <div class="field">
                <span class="field-label">{{ 'brands.color' | translate }}</span>
                <div class="flex items-center gap-2">
                  <input type="color" class="color-input" [attr.aria-label]="'brands.color' | translate"
                         [ngModel]="form().colorHex" (ngModelChange)="patchForm({ colorHex: $event })" />
                  <input class="input-field w-28" dir="ltr" maxlength="7" [attr.aria-label]="'brands.color' | translate"
                         [ngModel]="form().colorHex" (ngModelChange)="patchForm({ colorHex: $event })" />
                </div>
              </div>
              <label class="flex items-center gap-2 cursor-pointer h-9">
                <input type="checkbox" [ngModel]="form().isDefault" (ngModelChange)="patchForm({ isDefault: $event })" />
                <span class="text-sm">{{ 'brands.isDefault' | translate }}</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer h-9">
                <input type="checkbox" [ngModel]="form().isActive" (ngModelChange)="patchForm({ isActive: $event })" />
                <span class="text-sm">{{ 'brands.isActive' | translate }}</span>
              </label>
            </div>
          </div>
          <div class="card-footer">
            <button type="button" class="btn-secondary" (click)="cancelEdit()">{{ 'inbox.cancel' | translate }}</button>
            <button type="button" class="btn-primary"
                    [disabled]="busy() || !form().name.trim()" (click)="save()">
              {{ (editing() === 'new' ? 'brands.create' : 'brands.saveChanges') | translate }}
            </button>
          </div>
        </section>
      }

      <section class="card">
        @for (b of state.brands(); track b.id) {
          <div class="list-row">
            <div class="list-row__main flex items-center gap-3">
              <span class="w-3 h-3 rounded-full shrink-0" [style.background-color]="b.colorHex || 'var(--color-text-placeholder)'"></span>
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="row-title">{{ b.name }}</span>
                  @if (b.code) { <code class="count-pill" dir="ltr">{{ b.code }}</code> }
                  @if (b.isDefault) { <span class="badge badge-accent">{{ 'brands.default' | translate }}</span> }
                  @if (!b.isActive) { <span class="badge badge-neutral">{{ 'brands.inactive' | translate }}</span> }
                </div>
                @if (b.description) { <span class="row-hint truncate">{{ b.description }}</span> }
              </div>
            </div>
            @if (canWrite()) {
              <div class="list-row__actions">
                <button type="button" class="btn-secondary btn-sm" (click)="startEdit(b)">{{ 'brands.edit' | translate }}</button>
                <button type="button" class="btn-icon btn-sm btn-danger-hover" (click)="brandToDelete.set(b)"
                        [title]="'brands.delete' | translate" [attr.aria-label]="'brands.delete' | translate">
                  <mat-icon class="icon-sm">delete</mat-icon>
                </button>
              </div>
            }
          </div>
        } @empty {
          <app-empty-state icon="sell" [title]="'brands.none' | translate" />
        }
      </section>

      @if (brandToDelete(); as target) {
        <div class="modal-backdrop" role="presentation">
          <div class="modal modal-sm" role="dialog" aria-modal="true" aria-labelledby="brand-delete-title">
            <div class="modal-header">
              <h3 class="modal-title" id="brand-delete-title">{{ 'brands.delete' | translate }}</h3>
            </div>
            <p class="text-sm text-ink-2">{{ 'brands.deleteConfirm' | translate: { name: target.name } }}</p>
            <div class="modal-footer">
              <button type="button" class="btn-secondary" (click)="brandToDelete.set(null)">{{ 'inbox.cancel' | translate }}</button>
              <button type="button" class="btn-danger" (click)="remove(target)">{{ 'brands.delete' | translate }}</button>
            </div>
          </div>
        </div>
      }
    </div>
  `
})
export class SettingsBrandsComponent implements OnInit {
  protected state = inject(CrmStateService);
  private api = inject(ApiService);
  private i18n = inject(TranslationService);
  private toast = inject(ToastService);

  protected editing = signal<string | null>(null); // brand id being edited, or 'new'
  protected brandToDelete = signal<Brand | null>(null);
  protected busy = signal(false);
  protected form = signal<BrandForm>({ ...EMPTY_FORM });

  protected canWrite = () => this.state.hasAuthority('PARTNERS_WRITE');

  ngOnInit(): void {
    this.state.loadBrandsFromApi(true);
  }

  patchForm(patch: Partial<BrandForm>): void {
    this.form.set({ ...this.form(), ...patch });
  }

  startCreate(): void {
    this.form.set({ ...EMPTY_FORM });
    this.editing.set('new');
  }

  startEdit(b: Brand): void {
    this.form.set({
      name: b.name,
      code: b.code || '',
      description: b.description || '',
      colorHex: b.colorHex || IDENTITY_PALETTE[8],
      isDefault: !!b.isDefault,
      isActive: b.isActive !== false
    });
    this.editing.set(b.id);
  }

  cancelEdit(): void {
    this.editing.set(null);
  }

  async save(): Promise<void> {
    const id = this.editing();
    if (id === null) return;
    const f = this.form();
    const payload = {
      name: f.name.trim(),
      code: f.code.trim() || null,
      description: f.description.trim() || null,
      color_hex: f.colorHex || null,
      is_default: f.isDefault,
      is_active: f.isActive
    };
    this.busy.set(true);
    try {
      if (id === 'new') {
        await firstValueFrom(this.api.createBrand(payload));
      } else {
        await firstValueFrom(this.api.updateBrand(id, payload));
      }
      this.editing.set(null);
      this.state.loadBrandsFromApi(true);
    } catch (e) {
      this.toast.show((e as ApiClientError)?.detail || this.i18n.t('waSettings.error'), { type: 'error' });
    } finally {
      this.busy.set(false);
    }
  }

  async remove(b: Brand): Promise<void> {
    this.brandToDelete.set(null);
    try {
      await firstValueFrom(this.api.deleteBrand(b.id));
      this.state.loadBrandsFromApi(true);
    } catch (e) {
      this.toast.show((e as ApiClientError)?.detail || this.i18n.t('brands.deleteBlocked'), { type: 'error' });
    }
  }
}
