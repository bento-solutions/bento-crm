import { DEFAULT_INVOICE_ACCENT } from '../shared/ui/identity-color';
import { Component, OnInit, effect, inject, signal, untracked } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { firstValueFrom } from 'rxjs';
import { TranslatePipe } from '../pipes/translate.pipe';
import { TranslationService } from '../services/translation.service';
import { ToastService } from '../services/toast.service';
import { Brand, CrmStateService } from '../services/crm-state.service';
import { PageHeaderComponent } from '../shared/ui/page-header.component';
import { InvoiceTemplate, PayablesApi } from '../services/domains/payables.service';

type TextField = Exclude<keyof InvoiceTemplate, 'logoFileId'>;

const COMPANY: { key: TextField; label: string; placeholder?: string; wide?: boolean }[] = [
  { key: 'legalName', label: 'template.legalName', placeholder: 'Atlas Services SARL' },
  { key: 'capital', label: 'template.capital', placeholder: '100 000 MAD' },
  { key: 'address', label: 'template.address', placeholder: '12 bd Zerktouni, 20000 Casablanca', wide: true },
  { key: 'phone', label: 'template.phone', placeholder: '+212 5 22 00 00 00' },
  { key: 'email', label: 'template.email', placeholder: 'facturation@exemple.ma' },
  { key: 'website', label: 'template.website', placeholder: 'www.exemple.ma' },
];

const LEGAL: { key: TextField; label: string; placeholder?: string }[] = [
  { key: 'ice', label: 'template.ice', placeholder: '001525874000045' },
  { key: 'ifNumber', label: 'template.if', placeholder: '40123456' },
  { key: 'rc', label: 'template.rc', placeholder: 'Casablanca 412345' },
  { key: 'patente', label: 'template.patente', placeholder: '34567890' },
  { key: 'cnss', label: 'template.cnss', placeholder: '1234567' },
];

/**
 * Settings → Invoices: what is printed on every invoice PDF. The Moroccan legal identifiers,
 * bank details, logo, colour and footer, with a logo and footer per brand.
 */
@Component({
  selector: 'app-settings-invoice-template',
  imports: [MatIconModule, TranslatePipe, PageHeaderComponent],
  styles: [`
    .logo-box { flex-shrink: 0; width: 160px; height: 64px; display: flex; align-items: center; justify-content: center;
      border: 1px solid var(--color-border); border-radius: var(--r-control); background: var(--color-subtle); overflow: hidden; }
    .logo-box img { max-width: 100%; max-height: 100%; object-fit: contain; }
  `],
  template: `
    <div class="page max-w-3xl">
      <app-page-header size="section" [title]="'template.title' | translate" [subtitle]="'template.subtitle' | translate">
        <button actions type="button" class="btn-secondary" [disabled]="busy()" (click)="preview(null)">
          <mat-icon class="icon-sm">visibility</mat-icon>{{ 'template.preview' | translate }}
        </button>
      </app-page-header>

      <section class="card">
        <div class="card-header"><h3 class="card-title">{{ 'template.company' | translate }}</h3></div>
        <div class="card-body grid gap-4 sm:grid-cols-2">
          @for (f of company; track f.key) {
            <label class="field" [class.sm:col-span-2]="f.wide">
              <span class="field-label">{{ f.label | translate }}</span>
              <input class="input-field" [disabled]="!canWrite()" [placeholder]="f.placeholder ?? ''"
                     [value]="value(f.key)" (input)="set(f.key, $any($event.target).value)" />
            </label>
          }
        </div>
      </section>

      <section class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">{{ 'template.legal' | translate }}</h3>
            <p class="row-hint">{{ 'template.legalHint' | translate }}</p>
          </div>
        </div>
        <div class="card-body grid gap-4 sm:grid-cols-3">
          @for (f of legal; track f.key) {
            <label class="field">
              <span class="field-label">{{ f.label | translate }}</span>
              <input class="input-field" [disabled]="!canWrite()" [placeholder]="f.placeholder ?? ''"
                     [attr.aria-invalid]="f.key === 'ice' && !iceValid()"
                     [value]="value(f.key)" (input)="set(f.key, $any($event.target).value)" />
              @if (f.key === 'ice' && !iceValid()) {
                <span class="field-error">{{ 'template.iceInvalid' | translate }}</span>
              }
            </label>
          }
        </div>
      </section>

      <section class="card">
        <div class="card-header"><h3 class="card-title">{{ 'template.payment' | translate }}</h3></div>
        <div class="card-body grid gap-4 sm:grid-cols-2">
          <label class="field">
            <span class="field-label">{{ 'template.bank' | translate }}</span>
            <input class="input-field" [disabled]="!canWrite()" placeholder="Attijariwafa bank"
                   [value]="value('bankName')" (input)="set('bankName', $any($event.target).value)" />
          </label>
          <label class="field">
            <span class="field-label">{{ 'template.rib' | translate }}</span>
            <input class="input-field num" [disabled]="!canWrite()" placeholder="007 780 0001234567890123 45"
                   [attr.aria-invalid]="!ribValid()"
                   [value]="value('rib')" (input)="set('rib', $any($event.target).value)" />
            @if (!ribValid()) {
              <span class="field-error">{{ 'template.ribInvalid' | translate }}</span>
            }
          </label>
          <label class="field sm:col-span-2">
            <span class="field-label">{{ 'template.terms' | translate }}</span>
            <textarea rows="2" class="input-field" [disabled]="!canWrite()" [placeholder]="'template.termsPlaceholder' | translate"
                      [value]="value('paymentTermsText')" (input)="set('paymentTermsText', $any($event.target).value)"></textarea>
          </label>
        </div>
      </section>

      <section class="card">
        <div class="card-header"><h3 class="card-title">{{ 'template.look' | translate }}</h3></div>
        <div class="card-body space-y-5">
          <div class="flex flex-wrap items-end gap-6">
            <div class="field">
              <span class="field-label">{{ 'template.logo' | translate }}</span>
              <div class="flex flex-wrap items-center gap-3">
                <div class="logo-box">
                  @if (template().logoFileId) {
                    <img [src]="api.logoUrl(template().logoFileId!)" [alt]="'template.logo' | translate" />
                  } @else {
                    <mat-icon class="text-ink-4">image</mat-icon>
                  }
                </div>
                @if (canWrite()) {
                  <div class="flex flex-col items-start gap-1.5">
                    <label class="btn-secondary btn-sm cursor-pointer">
                      <mat-icon class="icon-sm">upload</mat-icon>{{ 'template.upload' | translate }}
                      <input type="file" accept="image/png,image/jpeg" class="hidden" (change)="uploadLogo($event, null)" />
                    </label>
                    @if (template().logoFileId) {
                      <button type="button" class="btn-ghost btn-sm" (click)="setLogo(null)">{{ 'template.removeLogo' | translate }}</button>
                    }
                  </div>
                }
              </div>
            </div>
            <label class="field">
              <span class="field-label">{{ 'template.accent' | translate }}</span>
              <span class="flex items-center gap-2">
                <input type="color" class="color-input" [disabled]="!canWrite()" [value]="template().accentColor || defaultAccent"
                       (input)="set('accentColor', $any($event.target).value)" />
                <span class="field-hint">{{ 'template.accentHint' | translate }}</span>
              </span>
            </label>
          </div>
          <label class="field">
            <span class="field-label">{{ 'template.footer' | translate }}</span>
            <textarea rows="2" maxlength="2000" class="input-field" [disabled]="!canWrite()" [placeholder]="'template.footerPlaceholder' | translate"
                      [value]="value('footerText')" (input)="set('footerText', $any($event.target).value)"></textarea>
          </label>
        </div>
      </section>

      @if (canWrite()) {
        <div class="form-actions">
          <button type="button" class="btn-primary" [disabled]="busy() || !iceValid() || !ribValid()" (click)="save()">
            {{ 'template.save' | translate }}
          </button>
        </div>
      }

      @if (brands().length) {
        <section class="card">
          <div class="card-header">
            <div>
              <h3 class="card-title">{{ 'template.brands' | translate }}</h3>
              <p class="row-hint">{{ 'template.brandsHint' | translate }}</p>
            </div>
          </div>
          <div>
            @for (b of brands(); track b.id) {
              <div class="list-row items-start">
                <div class="logo-box">
                  @if (b.invoiceLogoFileId) {
                    <img [src]="api.logoUrl(b.invoiceLogoFileId)" [alt]="b.name" />
                  } @else {
                    <span class="text-xs text-ink-3">{{ 'template.usesDefault' | translate }}</span>
                  }
                </div>
                <div class="list-row__main space-y-2">
                  <div class="row-title flex items-center gap-2">
                    <span class="w-3 h-3 rounded-full shrink-0" [style.background]="b.colorHex || 'var(--color-border)'"></span>
                    {{ b.name }}
                  </div>
                  <textarea rows="2" maxlength="2000" class="input-field" [disabled]="!canWrite()" [placeholder]="'template.brandFooter' | translate"
                            [value]="b.invoiceFooter ?? ''" (input)="patchBrand(b.id, { invoiceFooter: $any($event.target).value })"></textarea>
                  @if (canWrite()) {
                    <div class="flex flex-wrap gap-2">
                      <label class="btn-secondary btn-sm cursor-pointer">
                        <mat-icon class="icon-sm">upload</mat-icon>{{ 'template.upload' | translate }}
                        <input type="file" accept="image/png,image/jpeg" class="hidden" (change)="uploadLogo($event, b.id)" />
                      </label>
                      @if (b.invoiceLogoFileId) {
                        <button type="button" class="btn-ghost btn-sm" (click)="patchBrand(b.id, { invoiceLogoFileId: null })">{{ 'template.removeLogo' | translate }}</button>
                      }
                      <button type="button" class="btn-ghost btn-sm" (click)="preview(b.id)">{{ 'template.preview' | translate }}</button>
                      <button type="button" class="btn-primary btn-sm" [disabled]="busy()" (click)="saveBrand(b)">{{ 'template.saveBrand' | translate }}</button>
                    </div>
                  }
                </div>
              </div>
            }
          </div>
        </section>
      }
    </div>
  `
})
export class SettingsInvoiceTemplateComponent implements OnInit {
  /** Matches the backend's default PDF accent (dark slate). */
  readonly defaultAccent = DEFAULT_INVOICE_ACCENT;
  protected api = inject(PayablesApi);
  private state = inject(CrmStateService);
  private i18n = inject(TranslationService);
  private toast = inject(ToastService);

  protected readonly company = COMPANY;
  protected readonly legal = LEGAL;
  protected template = signal<InvoiceTemplate>({});
  protected brands = signal<Brand[]>([]);
  protected busy = signal(false);
  private brandsEdited = false;

  constructor() {
    // Copy the brands as they load, so edits stay on this page until each brand is saved.
    effect(() => {
      const loaded = this.state.brands();
      untracked(() => {
        if (!this.brandsEdited) {
          this.brands.set(loaded.filter(b => b.isActive !== false).map(b => ({ ...b })));
        }
      });
    });
  }

  ngOnInit(): void {
    this.api.template().subscribe({ next: t => this.template.set(t ?? {}), error: e => this.fail(e) });
    this.state.loadBrandsFromApi(true);
  }

  protected canWrite(): boolean {
    return this.state.hasAuthority('INVOICES_WRITE');
  }

  protected value(key: TextField): string {
    return (this.template()[key] as string | null | undefined) ?? '';
  }

  protected set(key: TextField, value: string): void {
    this.template.update(t => ({ ...t, [key]: value }));
  }

  protected iceValid(): boolean {
    const ice = this.value('ice').trim();
    return !ice || /^\d{15}$/.test(ice);
  }

  protected ribValid(): boolean {
    const rib = this.value('rib').trim();
    return !rib || /^[\d ]{24,30}$/.test(rib);
  }

  setLogo(id: string | null): void {
    this.template.update(t => ({ ...t, logoFileId: id }));
  }

  patchBrand(id: string, change: Partial<Brand>): void {
    this.brandsEdited = true;
    this.brands.update(list => list.map(b => (b.id === id ? { ...b, ...change } : b)));
  }

  async uploadLogo(event: Event, brandId: string | null): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      this.toast.show(this.i18n.t('template.logoType'), { type: 'error' });
      return;
    }
    this.busy.set(true);
    try {
      const stored = await firstValueFrom(this.api.uploadLogo(file, this.state.organization().id));
      if (brandId) {
        this.patchBrand(brandId, { invoiceLogoFileId: stored.id });
      } else {
        this.setLogo(stored.id);
      }
      this.toast.show(this.i18n.t('template.logoUploaded'), { type: 'success' });
    } catch (e) {
      this.fail(e);
    } finally {
      this.busy.set(false);
    }
  }

  async save(): Promise<void> {
    this.busy.set(true);
    try {
      this.template.set(await firstValueFrom(this.api.saveTemplate(this.template())));
      this.toast.show(this.i18n.t('template.saved'), { type: 'success' });
    } catch (e) {
      this.fail(e);
    } finally {
      this.busy.set(false);
    }
  }

  async saveBrand(b: Brand): Promise<void> {
    this.busy.set(true);
    try {
      await firstValueFrom(this.api.saveBrandStyle(b.id, b.invoiceLogoFileId ?? null, b.invoiceFooter?.trim() || null));
      this.toast.show(this.i18n.t('template.brandSaved', { name: b.name }), { type: 'success' });
    } catch (e) {
      this.fail(e);
    } finally {
      this.busy.set(false);
    }
  }

  async preview(brandId: string | null): Promise<void> {
    // Open the tab now, while the click still counts as a user gesture, then point it at the PDF.
    const tab = window.open('', '_blank');
    try {
      // The preview prints what is saved, so save the page's edits first.
      if (this.canWrite() && this.iceValid() && this.ribValid()) {
        this.template.set(await firstValueFrom(this.api.saveTemplate(this.template())));
        if (brandId) {
          const b = this.brands().find(x => x.id === brandId);
          if (b) await firstValueFrom(this.api.saveBrandStyle(b.id, b.invoiceLogoFileId ?? null, b.invoiceFooter?.trim() || null));
        }
      }
      const blob = await firstValueFrom(this.api.preview(brandId));
      const url = URL.createObjectURL(blob);
      if (tab) {
        tab.location.href = url;
      } else {
        window.open(url, '_blank');
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      tab?.close();
      this.fail(e);
    }
  }

  private fail(e: unknown): void {
    const err = e as { detail?: string; message?: string };
    this.toast.show(err?.detail || err?.message || this.i18n.t('template.error'), { type: 'error' });
  }
}
