import { Component, inject, signal, computed, effect, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PageHeaderComponent } from '../shared/ui/page-header.component';
import {
  CrmStateService,
  CustomerCard,
  VatStatus,
} from '../services/crm-state.service';

const MOROCCAN_CITIES = [
  'Casablanca', 'Rabat', 'Marrakech', 'Tangier', 'Fès', 'Agadir',
  'Meknès', 'Oujda', 'Kenitra', 'Tétouan', 'Safi', 'El Jadida',
  'Béni Mellal', 'Nador', 'Taza', 'Settat', 'Mohammedia', 'Laâyoune',
  'Khouribga', 'Témara', 'Salé', 'Berkane', 'Chefchaouen', 'Essaouira',
];

const JOB_TITLES = [
  'Purchasing Manager', 'DAF', 'IT Manager', 'Logistics', 'CEO',
  'Operations Manager', 'Sales Manager', 'Administrative Assistant',
];

@Component({
  selector: 'app-customer-card',
  imports: [MatIconModule, CommonModule, FormsModule, PageHeaderComponent],
  template: `
    <div class="page max-w-7xl mx-auto pb-12">

      <app-page-header
        [title]="isExisting() ? 'Customer Card' : 'Convert to Customer'"
        [subtitle]="isExisting() ? 'Legal, billing and delivery details' : 'Complete the customer record to convert this prospect'">
        <button actions (click)="goBack()" class="btn-secondary">Cancel</button>
        <button actions (click)="saveCard()" [disabled]="!isValid()" class="btn-primary">
          <mat-icon>save</mat-icon>
          {{ isExisting() ? 'Update' : 'Convert to Customer' }}
        </button>
      </app-page-header>

      <!-- Section 1: Business Relation -->
      <section class="card p-5 space-y-5">
        <div class="flex items-center gap-2.5 pb-3 border-b border-line-soft">
          <div class="icon-chip">
            <mat-icon class="icon-md">business</mat-icon>
          </div>
          <h3 class="card-title">1. Business Relation</h3>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label for="account_id" class="field-label mb-1.5">Account ID</label>
            <input id="account_id" [value]="form().accountId" disabled class="input-field w-full">
          </div>
          <div>
            <label for="record_type" class="field-label mb-1.5">Record Type</label>
            <select id="record_type" [(ngModel)]="form().recordType" name="recordType" class="input-field w-full">
              <option value="Organization">Organization</option>
              <option value="Individual">Individual</option>
            </select>
          </div>
          <div class="lg:col-span-2">
            <label for="official_company_nam" class="field-label mb-1.5">Official Company Name</label>
            <input id="official_company_nam" [(ngModel)]="form().name" name="name" type="text" placeholder="e.g. Casablanca Technologies S.A.R.L." class="input-field w-full">
          </div>
          <div>
            <label for="search_name" class="field-label mb-1.5">Search Name</label>
            <input id="search_name" [(ngModel)]="form().searchName" name="searchName" type="text" placeholder="Short name / Acronym" class="input-field w-full">
          </div>
          <div>
            <label for="erp_customer_account" class="field-label mb-1.5">ERP Customer Account</label>
            <input id="erp_customer_account" [(ngModel)]="form().erpAccount" name="erpAccount" type="text" placeholder="Link to financial backend" class="input-field w-full">
          </div>
        </div>
      </section>

      <!-- Section 2: Moroccan Legal & Fiscal -->
      <section class="card p-5 space-y-5">
        <div class="flex items-center gap-2.5 pb-3 border-b border-line-soft">
          <div class="icon-chip">
            <mat-icon class="icon-md">gavel</mat-icon>
          </div>
          <h3 class="card-title">2. Moroccan Legal & Fiscal Details</h3>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label for="ice" class="field-label mb-1.5">ICE</label>
            <input id="ice" [(ngModel)]="form().ice" name="ice" type="text" maxlength="15" placeholder="15 digits"
              (input)="onIceInput($event)"
              class="input-field w-full font-mono"
              [class.input-field]="!iceError()"
              [class.bg-muted]="iceError()"
              [class.border-line-strong]="iceError()">
            @if (iceError()) {
              <p class="text-ink-2 text-xs mt-1.5 font-medium">{{ iceError() }}</p>
            }
          </div>
          <div>
            <label for="if_identifiant_fisca" class="field-label mb-1.5">IF (Identifiant Fiscal)</label>
            <input id="if_identifiant_fisca" [(ngModel)]="form().ifField" name="ifField" type="text" placeholder="IF" class="input-field w-full">
          </div>
          <div>
            <label for="rc_registre_de_comme" class="field-label mb-1.5">RC (Registre de Commerce)</label>
            <input id="rc_registre_de_comme" [(ngModel)]="form().rc" name="rc" type="text" placeholder="RC number" class="input-field w-full">
          </div>
          <div>
            <label for="ville_rc" class="field-label mb-1.5">Ville RC</label>
            <select id="ville_rc" [(ngModel)]="form().rcCity" name="rcCity" class="input-field w-full">
              <option value="">Select city</option>
              @for (city of cities; track city) {
                <option [value]="city">{{ city }}</option>
              }
            </select>
          </div>
          <div>
            <label for="tp_taxe_professionne" class="field-label mb-1.5">TP (Taxe Professionnelle)</label>
            <input id="tp_taxe_professionne" [(ngModel)]="form().tp" name="tp" type="text" placeholder="TP number" class="input-field w-full">
          </div>
          <div class="lg:col-span-3">
            <label for="tva_vat_status" class="field-label mb-1.5">TVA / VAT Status</label>
            <div class="flex flex-wrap gap-4">
              @for (option of vatOptions; track option) {
                <label for="label_11" class="badge badge-neutral flex items-center gap-2 cursor-pointer">
                  <input id="label_11" type="checkbox" [checked]="form().vatStatus.includes(option)" (change)="toggleVat(option)">
                  {{ option }}
                </label>
              }
            </div>
          </div>
        </div>
      </section>

      <!-- Section 3: Corporate Hierarchy -->
      <section class="card p-5 space-y-5">
        <div class="flex items-center gap-2.5 pb-3 border-b border-line-soft">
          <div class="icon-chip">
            <mat-icon class="icon-md">account_tree</mat-icon>
          </div>
          <h3 class="card-title">3. Corporate Hierarchy</h3>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label for="organization_type" class="field-label mb-1.5">Organization Type</label>
            <select id="organization_type" [(ngModel)]="form().orgType" name="orgType" class="input-field w-full">
              <option value="Headquarter">Headquarter</option>
              <option value="Subsidiary">Subsidiary</option>
              <option value="Branch">Branch</option>
            </select>
          </div>
          <div class="md:col-span-2">
            <label for="parent_account" class="field-label mb-1.5">Parent Account</label>
            <select id="parent_account" [(ngModel)]="form().parentAccountId" name="parentAccountId" class="input-field w-full">
              <option [ngValue]="null">None (standalone)</option>
              @for (card of existingCards(); track card.id) {
                @if (card.id !== form().id) {
                  <option [ngValue]="card.id">{{ card.name }} ({{ card.accountId }})</option>
                }
              }
            </select>
          </div>
        </div>
      </section>

      <!-- Section 4: Addresses -->
      <section class="card p-5 space-y-5">
        <div class="flex items-center justify-between pb-3 border-b border-line-soft">
          <div class="flex items-center gap-2.5">
            <div class="icon-chip">
              <mat-icon class="icon-md">location_on</mat-icon>
            </div>
            <h3 class="card-title">4. Addresses</h3>
          </div>
          <button (click)="addAddress()" class="btn-secondary rounded-xl px-3.5 py-2 text-sm font-semibold text-ink flex items-center gap-1.5">
            <mat-icon class="icon-md">add_circle</mat-icon>
            Add Address
          </button>
        </div>
        <div class="overflow-x-auto -mx-2">
          <table class="data-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Street Address</th>
                <th>Zone Industrielle</th>
                <th>Postal Code</th>
                <th>City</th>
                <th class="text-center">Primary</th>
                <th class="text-center w-10">Action</th>
              </tr>
            </thead>
            <tbody>
              @for (addr of form().addresses; track addr.id; let i = $index) {
                <tr>
                  <td>
                    <select [(ngModel)]="addr.addressType" [name]="'addrType' + i" class="input-field w-36">
                      <option value="Siège Social / Fiscal">Siège Social / Fiscal</option>
                      <option value="Delivery">Delivery</option>
                      <option value="Warehouse">Warehouse</option>
                      <option value="Billing">Billing</option>
                    </select>
                  </td>
                  <td>
                    <input [(ngModel)]="addr.streetAddress" [name]="'addrStreet' + i" type="text" placeholder="N°, Boulevard, Rue, Étage" class="input-field w-44">
                  </td>
                  <td>
                    <input [(ngModel)]="addr.industrialZone" [name]="'addrZone' + i" type="text" placeholder="e.g. ZI Sapino" class="input-field w-32">
                  </td>
                  <td>
                    <input [(ngModel)]="addr.postalCode" [name]="'addrPostal' + i" type="text" maxlength="5" placeholder="20000" class="input-field w-20 font-mono">
                  </td>
                  <td>
                    <select [(ngModel)]="addr.city" [name]="'addrCity' + i" class="input-field w-28">
                      @for (city of cities; track city) {
                        <option [value]="city">{{ city }}</option>
                      }
                    </select>
                  </td>
                  <td class="text-center">
                    <input type="radio" [name]="'primaryAddr'" [checked]="addr.isPrimary" (change)="setPrimaryAddress(i)">
                  </td>
                  <td class="text-center">
                    <button (click)="removeAddress(i)" title="Remove address" class="w-7 h-7 rounded-lg btn-secondary flex items-center justify-center text-ink-3 hover:text-ink-2 transition-colors">
                      <mat-icon class="icon-sm">remove_circle</mat-icon>
                    </button>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="7" class="text-center text-ink-3">No addresses added yet.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>

      <!-- Section 5: Company Contact Information -->
      <section class="card p-5 space-y-5">
        <div class="flex items-center gap-2.5 pb-3 border-b border-line-soft">
          <div class="icon-chip">
            <mat-icon class="icon-md">contact_phone</mat-icon>
          </div>
          <h3 class="card-title">5. Company Contact Information</h3>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label for="main_phone" class="field-label mb-1.5">Main Phone</label>
            <input id="main_phone" [(ngModel)]="form().mainPhone" name="mainPhone" type="text" placeholder="+212 5XX XX XX XX"
              (input)="onPhoneInput($event)"
              class="input-field w-full font-mono">
            <p class="text-ink-3 text-xs mt-1.5">Format: +212 X XX XX XX XX</p>
          </div>
          <div>
            <label for="corporate_email" class="field-label mb-1.5">Corporate Email</label>
            <input id="corporate_email" [(ngModel)]="form().corporateEmail" name="corporateEmail" type="email" placeholder="contact@client.ma" class="input-field w-full">
          </div>
          <div>
            <label for="website_url" class="field-label mb-1.5">Website URL</label>
            <input id="website_url" [(ngModel)]="form().websiteUrl" name="websiteUrl" type="url" placeholder="https://www.client.ma" class="input-field w-full">
          </div>
        </div>
      </section>

      <!-- Section 6: Associated Personnel -->
      <section class="card p-5 space-y-5">
        <div class="flex items-center justify-between pb-3 border-b border-line-soft">
          <div class="flex items-center gap-2.5">
            <div class="icon-chip">
              <mat-icon class="icon-md">people</mat-icon>
            </div>
            <h3 class="card-title">6. Associated Personnel</h3>
          </div>
          <button (click)="addPersonnel()" class="btn-secondary rounded-xl px-3.5 py-2 text-sm font-semibold text-ink flex items-center gap-1.5">
            <mat-icon class="icon-md">add_circle</mat-icon>
            Add Person
          </button>
        </div>
        <div class="overflow-x-auto -mx-2">
          <table class="data-table">
            <thead>
              <tr>
                <th>Full Name</th>
                <th>Job Title</th>
                <th>Direct Mobile</th>
                <th>Direct Email</th>
                <th class="text-center">Primary</th>
                <th class="text-center w-10">Action</th>
              </tr>
            </thead>
            <tbody>
              @for (person of form().personnel; track person.id; let i = $index) {
                <tr>
                  <td>
                    <input [(ngModel)]="person.fullName" [name]="'personName' + i" type="text" placeholder="First and Last Name" class="input-field w-40">
                  </td>
                  <td>
                    <select [(ngModel)]="person.jobTitle" [name]="'personTitle' + i" class="input-field w-32">
                      @for (title of jobTitles; track title) {
                        <option [value]="title">{{ title }}</option>
                      }
                    </select>
                  </td>
                  <td>
                    <input [(ngModel)]="person.directMobile" [name]="'personMobile' + i" type="text" placeholder="+212 6XX XX XX XX"
                      class="input-field w-36 font-mono">
                  </td>
                  <td>
                    <input [(ngModel)]="person.directEmail" [name]="'personEmail' + i" type="email" placeholder="name@client.ma" class="input-field w-40">
                  </td>
                  <td class="text-center">
                    <input type="radio" [name]="'primaryPerson'" [checked]="person.isPrimary" (change)="setPrimaryPerson(i)">
                  </td>
                  <td class="text-center">
                    <button (click)="removePersonnel(i)" title="Remove personnel" class="w-7 h-7 rounded-lg btn-secondary flex items-center justify-center text-ink-3 hover:text-ink-2 transition-colors">
                      <mat-icon class="icon-sm">remove_circle</mat-icon>
                    </button>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="6" class="text-center text-ink-3">No personnel added yet.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `
})
export class CustomerCardComponent implements OnInit {
  state = inject(CrmStateService);
  route = inject(ActivatedRoute);
  router = inject(Router);

  cities = MOROCCAN_CITIES;
  jobTitles = JOB_TITLES;
  vatOptions: VatStatus[] = ['Standard', 'No VAT', 'Export Trade'];

  partnerId = '';
  isExisting = signal(false);

  form = signal<CustomerCard>(this.emptyCard());

  iceError = signal<string | null>(null);

  partner = computed(() => this.state.partners().find(p => p.id === this.partnerId));

  existingCards = computed(() => this.state.customerCards());

  constructor() {
    // Applies the card once it arrives from the backend, covering the case where
    // loadCustomerCard() (fired from ngOnInit) resolves after the form has already
    // been initialized with defaults.
    effect(() => {
      const existing = this.state.customerCards().find(c => c.partnerId === this.partnerId);
      if (existing && !this.isExisting()) {
        this.form.set({ ...existing, addresses: [...existing.addresses], personnel: [...existing.personnel] });
        this.isExisting.set(true);
      }
    });
  }

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      this.partnerId = params.get('id') || '';
      this.state.loadCustomerCard(this.partnerId);
      const existing = this.state.getCustomerCard(this.partnerId);
      if (existing) {
        this.form.set({ ...existing, addresses: [...existing.addresses], personnel: [...existing.personnel] });
        this.isExisting.set(true);
      } else {
        const p = this.partner();
        const accountId = this.state.generateAccountId();
        this.form.set({
          id: 'cc-' + this.partnerId,
          partnerId: this.partnerId,
          accountId,
          recordType: 'Organization',
          name: p?.name || '',
          searchName: '',
          erpAccount: '',
          ice: '',
          ifField: '',
          rc: '',
          rcCity: '',
          tp: '',
          vatStatus: ['Standard'],
          orgType: 'Headquarter',
          parentAccountId: null,
          addresses: [],
          mainPhone: p?.phone || '',
          corporateEmail: p?.email || '',
          websiteUrl: '',
          personnel: [],
          createdBy: '',
          createdAt: '',
        });
      }
    });
  }

  emptyCard(): CustomerCard {
    return {
      id: '',
      partnerId: '',
      accountId: '',
      recordType: 'Organization',
      name: '',
      searchName: '',
      erpAccount: '',
      ice: '',
      ifField: '',
      rc: '',
      rcCity: '',
      tp: '',
      vatStatus: ['Standard'],
      orgType: 'Headquarter',
      parentAccountId: null,
      addresses: [],
      mainPhone: '',
      corporateEmail: '',
      websiteUrl: '',
      personnel: [],
      createdBy: '',
      createdAt: '',
    };
  }

  onIceInput(event: Event) {
    const input = event.target as HTMLInputElement;
    let val = input.value.replace(/\D/g, '');
    if (val.length > 15) val = val.slice(0, 15);
    input.value = val;
    this.form().ice = val;
    if (val.length > 0 && val.length !== 15) {
      this.iceError.set('ICE must be exactly 15 digits');
    } else {
      this.iceError.set(null);
    }
  }

  onPhoneInput(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.value && !input.value.startsWith('+212')) {
      input.value = '+212 ' + input.value.replace(/^\+212\s*/, '');
    }
  }

  toggleVat(option: VatStatus) {
    const current = this.form().vatStatus;
    if (current.includes(option)) {
      this.form().vatStatus = current.filter(v => v !== option);
    } else {
      this.form().vatStatus = [...current, option];
    }
  }

  addAddress() {
    this.form().addresses = [
      ...this.form().addresses,
      {
        id: 'addr-' + Date.now(),
        addressType: 'Siège Social / Fiscal',
        streetAddress: '',
        industrialZone: '',
        postalCode: '',
        city: 'Casablanca',
        isPrimary: this.form().addresses.length === 0,
      },
    ];
  }

  removeAddress(index: number) {
    this.form().addresses = this.form().addresses.filter((_, i) => i !== index);
    if (this.form().addresses.length > 0 && !this.form().addresses.some(a => a.isPrimary)) {
      this.form().addresses[0].isPrimary = true;
    }
  }

  setPrimaryAddress(index: number) {
    this.form().addresses = this.form().addresses.map((a, i) => ({ ...a, isPrimary: i === index }));
  }

  addPersonnel() {
    this.form().personnel = [
      ...this.form().personnel,
      {
        id: 'per-' + Date.now(),
        fullName: '',
        jobTitle: 'Purchasing Manager',
        directMobile: '',
        directEmail: '',
        isPrimary: this.form().personnel.length === 0,
      },
    ];
  }

  removePersonnel(index: number) {
    this.form().personnel = this.form().personnel.filter((_, i) => i !== index);
    if (this.form().personnel.length > 0 && !this.form().personnel.some(p => p.isPrimary)) {
      this.form().personnel[0].isPrimary = true;
    }
  }

  setPrimaryPerson(index: number) {
    this.form().personnel = this.form().personnel.map((p, i) => ({ ...p, isPrimary: i === index }));
  }

  isValid(): boolean {
    const f = this.form();
    if (!f.name.trim()) return false;
    if (!f.ice || f.ice.length !== 15) return false;
    if (!f.ifField || !f.ifField.trim()) return false;
    if (!f.rc || !f.rc.trim()) return false;
    return true;
  }

  saveCard() {
    if (!this.isValid()) return;

    if (!this.isExisting()) {
      this.state.convertToCustomer(this.partnerId);
    }
    this.state.saveCustomerCard(this.form());
    this.goBack();
  }

  goBack() {
    this.router.navigateByUrl('/partners');
  }
}
