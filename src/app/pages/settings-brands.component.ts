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

interface BrandForm {
  name: string;
  code: string;
  description: string;
  colorHex: string;
  isDefault: boolean;
  isActive: boolean;
}

const EMPTY_FORM: BrandForm = { name: '', code: '', description: '', colorHex: '#2563EB', isDefault: false, isActive: true };

/**
 * Settings → Brands: the product-line referential (BentoCars, BentoTravel, CRMbento...) leads
 * and campaigns are attributed to. See backend BrandController for the CRUD this drives.
 */
@Component({
  selector: 'app-settings-brands',
  imports: [FormsModule, MatIconModule, TranslatePipe],
  styles: [`
    .bd-card { background: var(--color-surface); border: 1px solid var(--color-border); }
    .bd-muted { color: var(--color-text-secondary); }
    .bd-faint { color: var(--color-text-tertiary); }
    .bd-input { background: var(--color-bg); border: 1px solid var(--color-border); color: var(--color-text-primary); }
    .bd-btn { border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text-primary); }
    .bd-btn-primary { background: var(--color-text-primary); color: var(--color-surface); }
    .bd-btn-primary:disabled { opacity: .5; cursor: not-allowed; }
    .bd-danger { color: var(--color-danger); }
    .bd-row { border-top: 1px solid var(--color-border-light); }
    .bd-swatch { width: 1.5rem; height: 1.5rem; border-radius: 9999px; border: 1px solid var(--color-border); }
    .bd-badge { background: var(--color-bg); border: 1px solid var(--color-border); }
  `],
  template: `
    <div class="space-y-6 max-w-3xl">
      <section class="bd-card rounded-2xl p-6 space-y-4">
        <div>
          <h2 class="text-base font-bold">{{ 'brands.title' | translate }}</h2>
          <p class="text-sm bd-muted mt-1">{{ 'brands.subtitle' | translate }}</p>
        </div>

        @if (editing() !== null) {
          <div class="space-y-4 pt-2">
            <div class="grid gap-3 sm:grid-cols-2">
              <label class="block">
                <span class="text-xs font-semibold bd-muted">{{ 'brands.name' | translate }}</span>
                <input class="bd-input w-full rounded-lg px-3 py-2 mt-1 text-sm"
                       [placeholder]="'brands.namePlaceholder' | translate"
                       [ngModel]="form().name" (ngModelChange)="patchForm({ name: $event })" maxlength="100" />
              </label>
              <label class="block">
                <span class="text-xs font-semibold bd-muted">{{ 'brands.code' | translate }}</span>
                <input class="bd-input w-full rounded-lg px-3 py-2 mt-1 text-sm"
                       [placeholder]="'brands.codePlaceholder' | translate"
                       [ngModel]="form().code" (ngModelChange)="patchForm({ code: $event })" maxlength="20" />
              </label>
            </div>
            <label class="block">
              <span class="text-xs font-semibold bd-muted">{{ 'brands.description' | translate }}</span>
              <textarea class="bd-input w-full rounded-lg px-3 py-2 mt-1 text-sm" rows="2"
                        [placeholder]="'brands.descriptionPlaceholder' | translate"
                        [ngModel]="form().description" (ngModelChange)="patchForm({ description: $event })"></textarea>
            </label>
            <div class="flex flex-wrap items-end gap-4">
              <label class="block">
                <span class="text-xs font-semibold bd-muted block mb-1">{{ 'brands.color' | translate }}</span>
                <div class="flex items-center gap-2">
                  <input type="color" class="w-9 h-9 rounded-lg cursor-pointer border-0 bg-transparent"
                         [ngModel]="form().colorHex" (ngModelChange)="patchForm({ colorHex: $event })" />
                  <input class="bd-input rounded-lg px-2 py-1.5 text-xs w-24" dir="ltr" maxlength="7"
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
              <button type="button" class="bd-btn-primary text-sm font-semibold px-4 py-2 rounded-lg"
                      [disabled]="busy() || !form().name.trim()" (click)="save()">
                {{ (editing() === 'new' ? 'brands.create' : 'brands.saveChanges') | translate }}
              </button>
              <button type="button" class="bd-btn text-sm px-4 py-2 rounded-lg" (click)="cancelEdit()">{{ 'inbox.cancel' | translate }}</button>
            </div>
          </div>
        } @else if (canWrite()) {
          <button type="button" class="bd-btn-primary text-sm font-semibold px-4 py-2 rounded-lg" (click)="startCreate()">
            {{ 'brands.new' | translate }}
          </button>
        }
      </section>

      <section class="bd-card rounded-2xl p-6">
        <h3 class="text-sm font-bold mb-2">{{ 'brands.list' | translate }}</h3>
        @for (b of state.brands(); track b.id) {
          <div class="bd-row flex flex-wrap items-center justify-between gap-3 py-3">
            <div class="flex items-center gap-3 min-w-0">
              <span class="bd-swatch shrink-0" [style.background-color]="b.colorHex || '#a1a1aa'"></span>
              <div class="min-w-0">
                <p class="text-sm font-semibold flex items-center gap-2 flex-wrap">
                  {{ b.name }}
                  @if (b.code) { <code class="bd-badge text-[11px] px-1.5 py-0.5 rounded" dir="ltr">{{ b.code }}</code> }
                  @if (b.isDefault) { <span class="bd-badge text-[11px] px-1.5 py-0.5 rounded">{{ 'brands.default' | translate }}</span> }
                  @if (!b.isActive) { <span class="bd-badge text-[11px] px-1.5 py-0.5 rounded bd-muted">{{ 'brands.inactive' | translate }}</span> }
                </p>
                @if (b.description) { <p class="text-xs bd-muted truncate">{{ b.description }}</p> }
              </div>
            </div>
            @if (canWrite()) {
              <div class="flex items-center gap-2 shrink-0">
                <button type="button" class="bd-btn text-xs font-semibold px-3 py-1.5 rounded-lg" (click)="startEdit(b)">{{ 'brands.edit' | translate }}</button>
                <button type="button" class="bd-btn bd-danger text-xs font-semibold px-3 py-1.5 rounded-lg" (click)="remove(b)">{{ 'brands.delete' | translate }}</button>
              </div>
            }
          </div>
        } @empty {
          <p class="text-xs bd-faint">{{ 'brands.none' | translate }}</p>
        }
      </section>
    </div>
  `
})
export class SettingsBrandsComponent implements OnInit {
  protected state = inject(CrmStateService);
  private api = inject(ApiService);
  private i18n = inject(TranslationService);
  private toast = inject(ToastService);

  protected editing = signal<string | null>(null); // brand id being edited, or 'new'
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
      colorHex: b.colorHex || '#2563EB',
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
    if (!confirm(this.i18n.t('brands.deleteConfirm', { name: b.name }))) return;
    try {
      await firstValueFrom(this.api.deleteBrand(b.id));
      this.state.loadBrandsFromApi(true);
    } catch (e) {
      this.toast.show((e as ApiClientError)?.detail || this.i18n.t('brands.deleteBlocked'), { type: 'error' });
    }
  }
}
