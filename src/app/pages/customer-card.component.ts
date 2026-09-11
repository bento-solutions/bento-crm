import { Component, inject, signal, computed, effect, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
  imports: [MatIconModule, CommonModule, FormsModule],
  template: `
    <div class="max-w-7xl mx-auto space-y-6 pb-12">

      <!-- Page Header Strip -->
      <div class="bg-zinc-100 rounded-2xl p-5 flex items-center justify-between flex-wrap gap-4">
        <div class="flex items-center gap-4">
          <button (click)="goBack()" title="Go back" class="w-10 h-10 rounded-xl btn-secondary flex items-center justify-center text-zinc-400 hover:text-zinc-900 transition-all">
            <mat-icon class="text-[22px]">arrow_back</mat-icon>
          </button>
        </div>
        <button (click)="saveCard()" [disabled]="!isValid()" class="bg-zinc-900 hover:bg-zinc-950 disabled:opacity-40 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 shadow-lg shadow-zinc-300">
          <mat-icon class="w-5 h-5 text-[20px]! leading-none!">save</mat-icon>
          {{ isExisting() ? 'Update' : 'Convert to Customer' }}
        </button>
      </div>

      <!-- Section 1: Business Relation -->
      <section class="card rounded-2xl p-6 space-y-5">
        <div class="flex items-center gap-2.5 pb-3 border-b border-white/30">
          <div class="w-8 h-8 rounded-lg bg-zinc-200/60 text-zinc-900 flex items-center justify-center">
            <mat-icon class="text-[18px]">business</mat-icon>
          </div>
          <h3 class="text-base font-bold text-zinc-800">1. Business Relation</h3>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label for="account_id" class="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Account ID</label>
            <input id="account_id" [value]="form().accountId" disabled class="w-full input-field rounded-xl p-2.5 text-sm text-zinc-500 opacity-60">
          </div>
          <div>
            <label for="record_type" class="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Record Type</label>
            <select id="record_type" [(ngModel)]="form().recordType" name="recordType" class="w-full input-field rounded-xl p-2.5 text-sm outline-none bg-transparent">
              <option value="Organization">Organization</option>
              <option value="Individual">Individual</option>
            </select>
          </div>
          <div class="lg:col-span-2">
            <label for="official_company_nam" class="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Official Company Name</label>
            <input id="official_company_nam" [(ngModel)]="form().name" name="name" type="text" placeholder="e.g. Casablanca Technologies S.A.R.L." class="w-full input-field rounded-xl p-2.5 text-sm outline-none">
          </div>
          <div>
            <label for="search_name" class="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Search Name</label>
            <input id="search_name" [(ngModel)]="form().searchName" name="searchName" type="text" placeholder="Short name / Acronym" class="w-full input-field rounded-xl p-2.5 text-sm outline-none">
          </div>
          <div>
            <label for="erp_customer_account" class="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">ERP Customer Account</label>
            <input id="erp_customer_account" [(ngModel)]="form().erpAccount" name="erpAccount" type="text" placeholder="Link to financial backend" class="w-full input-field rounded-xl p-2.5 text-sm outline-none">
          </div>
        </div>
      </section>

      <!-- Section 2: Moroccan Legal & Fiscal -->
      <section class="card rounded-2xl p-6 space-y-5">
        <div class="flex items-center gap-2.5 pb-3 border-b border-white/30">
          <div class="w-8 h-8 rounded-lg bg-zinc-200/60 text-zinc-900 flex items-center justify-center">
            <mat-icon class="text-[18px]">gavel</mat-icon>
          </div>
          <h3 class="text-base font-bold text-zinc-800">2. Moroccan Legal & Fiscal Details</h3>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label for="ice" class="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">ICE</label>
            <input id="ice" [(ngModel)]="form().ice" name="ice" type="text" maxlength="15" placeholder="15 digits"
              (input)="onIceInput($event)"
              class="w-full rounded-xl p-2.5 text-sm outline-none font-mono transition-all"
              [class.input-field]="!iceError()"
              [class.bg-zinc-100/50]="iceError()"
              [class.border-zinc-400/50]="iceError()">
            @if (iceError()) {
              <p class="text-zinc-700 text-xs mt-1.5 font-medium">{{ iceError() }}</p>
            }
          </div>
          <div>
            <label for="if_identifiant_fisca" class="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">IF (Identifiant Fiscal)</label>
            <input id="if_identifiant_fisca" [(ngModel)]="form().ifField" name="ifField" type="text" placeholder="IF" class="w-full input-field rounded-xl p-2.5 text-sm outline-none">
          </div>
          <div>
            <label for="rc_registre_de_comme" class="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">RC (Registre de Commerce)</label>
            <input id="rc_registre_de_comme" [(ngModel)]="form().rc" name="rc" type="text" placeholder="RC number" class="w-full input-field rounded-xl p-2.5 text-sm outline-none">
          </div>
          <div>
            <label for="ville_rc" class="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Ville RC</label>
            <select id="ville_rc" [(ngModel)]="form().rcCity" name="rcCity" class="w-full input-field rounded-xl p-2.5 text-sm outline-none bg-transparent">
              <option value="">Select city</option>
              @for (city of cities; track city) {
                <option [value]="city">{{ city }}</option>
              }
            </select>
          </div>
          <div>
            <label for="tp_taxe_professionne" class="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">TP (Taxe Professionnelle)</label>
            <input id="tp_taxe_professionne" [(ngModel)]="form().tp" name="tp" type="text" placeholder="TP number" class="w-full input-field rounded-xl p-2.5 text-sm outline-none">
          </div>
          <div class="lg:col-span-3">
            <label for="tva_vat_status" class="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">TVA / VAT Status</label>
            <div class="flex flex-wrap gap-4">
              @for (option of vatOptions; track option) {
                <label for="label_11" class="flex items-center gap-2 text-sm text-zinc-600 cursor-pointer badge rounded-lg px-3 py-1.5">
                  <input id="label_11" type="checkbox" [checked]="form().vatStatus.includes(option)" (change)="toggleVat(option)"
                    class="w-4 h-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-700">
                  {{ option }}
                </label>
              }
            </div>
          </div>
        </div>
      </section>

      <!-- Section 3: Corporate Hierarchy -->
      <section class="card rounded-2xl p-6 space-y-5">
        <div class="flex items-center gap-2.5 pb-3 border-b border-white/30">
          <div class="w-8 h-8 rounded-lg bg-zinc-200/60 text-zinc-900 flex items-center justify-center">
            <mat-icon class="text-[18px]">account_tree</mat-icon>
          </div>
          <h3 class="text-base font-bold text-zinc-800">3. Corporate Hierarchy</h3>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label for="organization_type" class="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Organization Type</label>
            <select id="organization_type" [(ngModel)]="form().orgType" name="orgType" class="w-full input-field rounded-xl p-2.5 text-sm outline-none bg-transparent">
              <option value="Headquarter">Headquarter</option>
              <option value="Subsidiary">Subsidiary</option>
              <option value="Branch">Branch</option>
            </select>
          </div>
          <div class="md:col-span-2">
            <label for="parent_account" class="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Parent Account</label>
            <select id="parent_account" [(ngModel)]="form().parentAccountId" name="parentAccountId" class="w-full input-field rounded-xl p-2.5 text-sm outline-none bg-transparent">
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
      <section class="card rounded-2xl p-6 space-y-5">
        <div class="flex items-center justify-between pb-3 border-b border-white/30">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-lg bg-zinc-200/60 text-zinc-900 flex items-center justify-center">
              <mat-icon class="text-[18px]">location_on</mat-icon>
            </div>
            <h3 class="text-base font-bold text-zinc-800">4. Addresses</h3>
          </div>
          <button (click)="addAddress()" class="btn-secondary rounded-xl px-3.5 py-2 text-sm font-semibold text-zinc-900 flex items-center gap-1.5">
            <mat-icon class="text-[18px] w-[18px] h-[18px]">add_circle</mat-icon>
            Add Address
          </button>
        </div>
        <div class="overflow-x-auto -mx-2">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-xs text-zinc-400 font-semibold uppercase tracking-wider border-b border-white/30">
                <th class="text-left py-2.5 px-2">Type</th>
                <th class="text-left py-2.5 px-2">Street Address</th>
                <th class="text-left py-2.5 px-2">Zone Industrielle</th>
                <th class="text-left py-2.5 px-2">Postal Code</th>
                <th class="text-left py-2.5 px-2">City</th>
                <th class="text-center py-2.5 px-2">Primary</th>
                <th class="text-center py-2.5 w-10">Action</th>
              </tr>
            </thead>
            <tbody>
              @for (addr of form().addresses; track addr.id; let i = $index) {
                <tr class="border-b border-white/20 hover:bg-white/30 transition-colors">
                  <td class="py-2.5 px-2">
                    <select [(ngModel)]="addr.addressType" [name]="'addrType' + i" class="w-36 input-field rounded-lg p-1.5 text-xs outline-none bg-transparent">
                      <option value="Siège Social / Fiscal">Siège Social / Fiscal</option>
                      <option value="Delivery">Delivery</option>
                      <option value="Warehouse">Warehouse</option>
                      <option value="Billing">Billing</option>
                    </select>
                  </td>
                  <td class="py-2.5 px-2">
                    <input [(ngModel)]="addr.streetAddress" [name]="'addrStreet' + i" type="text" placeholder="N°, Boulevard, Rue, Étage" class="w-44 input-field rounded-lg p-1.5 text-xs outline-none">
                  </td>
                  <td class="py-2.5 px-2">
                    <input [(ngModel)]="addr.industrialZone" [name]="'addrZone' + i" type="text" placeholder="e.g. ZI Sapino" class="w-32 input-field rounded-lg p-1.5 text-xs outline-none">
                  </td>
                  <td class="py-2.5 px-2">
                    <input [(ngModel)]="addr.postalCode" [name]="'addrPostal' + i" type="text" maxlength="5" placeholder="20000" class="w-20 input-field rounded-lg p-1.5 text-xs outline-none font-mono">
                  </td>
                  <td class="py-2.5 px-2">
                    <select [(ngModel)]="addr.city" [name]="'addrCity' + i" class="w-28 input-field rounded-lg p-1.5 text-xs outline-none bg-transparent">
                      @for (city of cities; track city) {
                        <option [value]="city">{{ city }}</option>
                      }
                    </select>
                  </td>
                  <td class="py-2.5 px-2 text-center">
                    <input type="radio" [name]="'primaryAddr'" [checked]="addr.isPrimary" (change)="setPrimaryAddress(i)"
                      class="w-4 h-4 text-zinc-900 border-zinc-300 focus:ring-zinc-700">
                  </td>
                  <td class="py-2.5 px-2 text-center">
                    <button (click)="removeAddress(i)" title="Remove address" class="w-7 h-7 rounded-lg btn-secondary flex items-center justify-center text-zinc-400 hover:text-zinc-700 transition-colors">
                      <mat-icon class="text-[16px] w-[16px] h-[16px]">remove_circle</mat-icon>
                    </button>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="7" class="py-10 text-center text-zinc-400 text-sm">No addresses added yet.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>

      <!-- Section 5: Company Contact Information -->
      <section class="card rounded-2xl p-6 space-y-5">
        <div class="flex items-center gap-2.5 pb-3 border-b border-white/30">
          <div class="w-8 h-8 rounded-lg bg-zinc-200/60 text-zinc-900 flex items-center justify-center">
            <mat-icon class="text-[18px]">contact_phone</mat-icon>
          </div>
          <h3 class="text-base font-bold text-zinc-800">5. Company Contact Information</h3>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label for="main_phone" class="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Main Phone</label>
            <input id="main_phone" [(ngModel)]="form().mainPhone" name="mainPhone" type="text" placeholder="+212 5XX XX XX XX"
              (input)="onPhoneInput($event)"
              class="w-full input-field rounded-xl p-2.5 text-sm outline-none font-mono">
            <p class="text-zinc-400 text-xs mt-1.5">Format: +212 X XX XX XX XX</p>
          </div>
          <div>
            <label for="corporate_email" class="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Corporate Email</label>
            <input id="corporate_email" [(ngModel)]="form().corporateEmail" name="corporateEmail" type="email" placeholder="contact@client.ma" class="w-full input-field rounded-xl p-2.5 text-sm outline-none">
          </div>
          <div>
            <label for="website_url" class="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Website URL</label>
            <input id="website_url" [(ngModel)]="form().websiteUrl" name="websiteUrl" type="url" placeholder="https://www.client.ma" class="w-full input-field rounded-xl p-2.5 text-sm outline-none">
          </div>
        </div>
      </section>

      <!-- Section 6: Associated Personnel -->
      <section class="card rounded-2xl p-6 space-y-5">
        <div class="flex items-center justify-between pb-3 border-b border-white/30">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-lg bg-zinc-200/60 text-zinc-900 flex items-center justify-center">
              <mat-icon class="text-[18px]">people</mat-icon>
            </div>
            <h3 class="text-base font-bold text-zinc-800">6. Associated Personnel</h3>
          </div>
          <button (click)="addPersonnel()" class="btn-secondary rounded-xl px-3.5 py-2 text-sm font-semibold text-zinc-900 flex items-center gap-1.5">
            <mat-icon class="text-[18px] w-[18px] h-[18px]">add_circle</mat-icon>
            Add Person
          </button>
        </div>
        <div class="overflow-x-auto -mx-2">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-xs text-zinc-400 font-semibold uppercase tracking-wider border-b border-white/30">
                <th class="text-left py-2.5 px-2">Full Name</th>
                <th class="text-left py-2.5 px-2">Job Title</th>
                <th class="text-left py-2.5 px-2">Direct Mobile</th>
                <th class="text-left py-2.5 px-2">Direct Email</th>
                <th class="text-center py-2.5 px-2">Primary</th>
                <th class="text-center py-2.5 w-10">Action</th>
              </tr>
            </thead>
            <tbody>
              @for (person of form().personnel; track person.id; let i = $index) {
                <tr class="border-b border-white/20 hover:bg-white/30 transition-colors">
                  <td class="py-2.5 px-2">
                    <input [(ngModel)]="person.fullName" [name]="'personName' + i" type="text" placeholder="First and Last Name" class="w-40 input-field rounded-lg p-1.5 text-xs outline-none">
                  </td>
                  <td class="py-2.5 px-2">
                    <select [(ngModel)]="person.jobTitle" [name]="'personTitle' + i" class="w-32 input-field rounded-lg p-1.5 text-xs outline-none bg-transparent">
                      @for (title of jobTitles; track title) {
                        <option [value]="title">{{ title }}</option>
                      }
                    </select>
                  </td>
                  <td class="py-2.5 px-2">
                    <input [(ngModel)]="person.directMobile" [name]="'personMobile' + i" type="text" placeholder="+212 6XX XX XX XX"
                      class="w-36 input-field rounded-lg p-1.5 text-xs outline-none font-mono">
                  </td>
                  <td class="py-2.5 px-2">
                    <input [(ngModel)]="person.directEmail" [name]="'personEmail' + i" type="email" placeholder="name@client.ma" class="w-40 input-field rounded-lg p-1.5 text-xs outline-none">
                  </td>
                  <td class="py-2.5 px-2 text-center">
                    <input type="radio" [name]="'primaryPerson'" [checked]="person.isPrimary" (change)="setPrimaryPerson(i)"
                      class="w-4 h-4 text-zinc-900 border-zinc-300 focus:ring-zinc-700">
                  </td>
                  <td class="py-2.5 px-2 text-center">
                    <button (click)="removePersonnel(i)" title="Remove personnel" class="w-7 h-7 rounded-lg btn-secondary flex items-center justify-center text-zinc-400 hover:text-zinc-700 transition-colors">
                      <mat-icon class="text-[16px] w-[16px] h-[16px]">remove_circle</mat-icon>
                    </button>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="6" class="py-10 text-center text-zinc-400 text-sm">No personnel added yet.</td>
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
