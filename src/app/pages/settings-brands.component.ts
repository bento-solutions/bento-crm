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
  imports: [FormsModule, MatIconModule, TranslatePipe, PageHeaderComponent],
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
      <section class="card p-5 space-y-4">
        @if (editing() !== null) {
          <div class="space-y-4 pt-2">
            <div class="grid gap-3 sm:grid-cols-2">
              <label class="block">
                <span class="field-label">{{ 'brands.name' | translate }}</span>
                <input class="input-field w-full mt-1"
                       [placeholder]="'brands.namePlaceholder' | translate"
                       [ngModel]="form().name" (ngModelChange)="patchForm({ name: $event })" maxlength="100" />
              </label>
              <label class="block">
                <span class="field-label">{{ 'brands.code' | translate }}</span>
                <input class="input-field w-full mt-1"
                       [placeholder]="'brands.codePlaceholder' | translate"
                       [ngModel]="form().code" (ngModelChange)="patchForm({ code: $event })" maxlength="20" />
              </label>
            </div>
            <label class="block">
              <span class="field-label">{{ 'brands.description' | translate }}</span>
              <textarea class="input-field w-full mt-1" rows="2"
                        [placeholder]="'brands.descriptionPlaceholder' | translate"
                        [ngModel]="form().description" (ngModelChange)="patchForm({ description: $event })"></textarea>
            </label>
            <div class="flex flex-wrap items-end gap-4">
              <label class="block">
                <span class="field-label mb-1.5">{{ 'brands.color' | translate }}</span>
                <div class="flex items-center gap-2">
                  <input type="color" class="w-9 h-9 rounded-lg cursor-pointer border-0 bg-transparent"
                         [ngModel]="form().colorHex" (ngModelChange)="patchForm({ colorHex: $event })" />
                  <input class="input-field w-24" dir="ltr" maxlength="7"
                         [ngModel]="form().colorHex" (ngModelChange)="patchForm({ colorHex: $event })" />
                </div>
              </label>
              <label class="flex items-center gap-2 cursor-pointer pb-2">
                <input type="checkbox" [ngModel]="form().isDefault" (ngModelChange)="patchForm({ isDefault: $event })" />
                <span class="text-sm">{{ 'brands.isDefault' | translate }}</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer pb-2">
                <input type="checkbox" [ngModel]="form().isActive" (ngModelChange)="patchForm({ isActive: $event })" />
                <span class="text-sm">{{ 'brands.isActive' | translate }}</span>
              </label>
            </div>
            <div class="flex gap-2">
              <button type="button" class="btn-primary"
                      [disabled]="busy() || !form().name.trim()" (click)="save()">
                {{ (editing() === 'new' ? 'brands.create' : 'brands.saveChanges') | translate }}
              </button>
              <button type="button" class="btn-secondary" (click)="cancelEdit()">{{ 'inbox.cancel' | translate }}</button>
            </div>
          </div>
        }
      </section>
      }

      <section class="card p-5">
        <h3 class="card-title mb-2">{{ 'brands.list' | translate }}</h3>
        @for (b of state.brands(); track b.id) {
          <div class="border-t border-line-soft first:border-t-0 flex flex-wrap items-center justify-between gap-3 py-3">
            <div class="flex items-center gap-3 min-w-0">
              <span class="w-6 h-6 rounded-full border border-line shrink-0" [style.background-color]="b.colorHex || 'var(--color-text-placeholder)'"></span>
              <div class="min-w-0">
                <p class="text-sm font-semibold flex items-center gap-2 flex-wrap">
                  {{ b.name }}
                  @if (b.code) { <code class="badge badge-neutral font-mono" dir="ltr">{{ b.code }}</code> }
                  @if (b.isDefault) { <span class="badge badge-accent">{{ 'brands.default' | translate }}</span> }
                  @if (!b.isActive) { <span class="badge badge-neutral">{{ 'brands.inactive' | translate }}</span> }
                </p>
                @if (b.description) { <p class="text-xs text-ink-2 truncate">{{ b.description }}</p> }
              </div>
            </div>
            @if (canWrite()) {
              <div class="flex items-center gap-2 shrink-0">
                <button type="button" class="btn-secondary btn-sm" (click)="startEdit(b)">{{ 'brands.edit' | translate }}</button>
                <button type="button" class="btn-danger-soft btn-sm" (click)="brandToDelete.set(b)">{{ 'brands.delete' | translate }}</button>
              </div>
            }
          </div>
        } @empty {
          <p class="text-xs text-ink-3">{{ 'brands.none' | translate }}</p>
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
