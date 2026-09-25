import { Component, signal, computed, viewChild, ElementRef, HostListener } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface UploadedFile {
  name: string;
  size: number;
  type: string;
}

interface SearchItem {
  mainMenu: string;
  mainIcon: string;
  mainRoute: string;
  submenu?: string;
  subIcon?: string;
  tab?: string;
  action: string;
  keywords: string;
}

const SEARCH_ITEMS: SearchItem[] = [
  { mainMenu: 'Dashboard', mainIcon: 'home', mainRoute: '/', action: 'View your customizable daily summary and KPIs', keywords: 'dashboard home kpi summary' },
  { mainMenu: 'Sales', mainIcon: 'monetization_on', mainRoute: '/sales', submenu: 'Deals', subIcon: 'monetization_on', tab: 'deals', action: 'Manage deals and sales pipeline', keywords: 'sales deals pipeline opportunities' },
  { mainMenu: 'Sales', mainIcon: 'monetization_on', mainRoute: '/sales', submenu: 'Proposals', subIcon: 'description', tab: 'proposals', action: 'Create and manage proposals', keywords: 'sales proposals quotes estimates' },
  { mainMenu: 'Sales', mainIcon: 'monetization_on', mainRoute: '/sales', submenu: 'Purchase Orders', subIcon: 'shopping_cart', tab: 'pos', action: 'Generate and track purchase orders', keywords: 'sales purchase orders po procurement' },
  { mainMenu: 'Inbox', mainIcon: 'forum', mainRoute: '/inbox', action: 'Read and answer WhatsApp conversations', keywords: 'inbox whatsapp messages conversations chat reply' },
  { mainMenu: 'Marketing', mainIcon: 'campaign', mainRoute: '/marketing', submenu: 'Email Campaigns', subIcon: 'email', tab: 'Email', action: 'Launch and manage email campaigns', keywords: 'marketing email campaigns' },
  { mainMenu: 'Marketing', mainIcon: 'campaign', mainRoute: '/marketing', submenu: 'WhatsApp Campaigns', subIcon: 'chat', tab: 'WhatsApp', action: 'Send WhatsApp campaigns to prospects', keywords: 'marketing whatsapp campaigns' },
  { mainMenu: 'Marketing', mainIcon: 'campaign', mainRoute: '/marketing', submenu: 'SMS Campaigns', subIcon: 'sms', tab: 'SMS', action: 'Send SMS campaigns to contacts', keywords: 'marketing sms campaigns' },
  { mainMenu: 'Leads', mainIcon: 'person_search', mainRoute: '/leads', action: 'Qualify leads, track interactions, and manage pipeline', keywords: 'leads qualification pipeline opportunities tracking' },
  { mainMenu: 'Tasks', mainIcon: 'task_alt', mainRoute: '/tasks', action: 'View tasks in list view', keywords: 'tasks assignments list view' },
  { mainMenu: 'Tasks', mainIcon: 'view_column', mainRoute: '/tasks', submenu: 'Kanban Board', subIcon: 'view_column', tab: 'kanban', action: 'View tasks in Kanban board', keywords: 'tasks kanban board drag drop columns' },
  { mainMenu: 'Tickets', mainIcon: 'support_agent', mainRoute: '/tickets', action: 'Manage customer support tickets and service requests', keywords: 'tickets support customer service' },
  { mainMenu: 'Analytics', mainIcon: 'bar_chart', mainRoute: '/analytics', action: 'View performance indicators, forecasts, and sales insights', keywords: 'analytics reports insights forecasts charts' },
  { mainMenu: 'Partners', mainIcon: 'handshake', mainRoute: '/partners', submenu: 'Leads', subIcon: 'filter_alt', tab: 'Lead', action: 'View and manage partner leads', keywords: 'partners leads directory' },
  { mainMenu: 'Partners', mainIcon: 'handshake', mainRoute: '/partners', submenu: 'Customers', subIcon: 'people', tab: 'Customer', action: 'View customer profiles and account details', keywords: 'partners customers clients' },
  { mainMenu: 'Partners', mainIcon: 'handshake', mainRoute: '/partners', submenu: 'Prospects', subIcon: 'person_search', tab: 'Prospect', action: 'Track and convert prospects to customers', keywords: 'partners prospects conversions' },
  { mainMenu: 'Partners', mainIcon: 'handshake', mainRoute: '/partners', submenu: 'Vendors', subIcon: 'store', tab: 'Vendor', action: 'Manage vendor and supplier directory', keywords: 'partners vendors suppliers' },
  { mainMenu: 'Finance', mainIcon: 'account_balance', mainRoute: '/finance', submenu: 'Customer Invoices', subIcon: 'receipt', tab: 'Customer', action: 'Manage customer invoices and billing', keywords: 'finance invoices customers billing' },
  { mainMenu: 'Finance', mainIcon: 'account_balance', mainRoute: '/finance', submenu: 'Vendor Invoices', subIcon: 'receipt_long', tab: 'Vendor', action: 'Manage vendor invoices and payables', keywords: 'finance invoices vendors billing' },
  { mainMenu: 'Finance', mainIcon: 'account_balance', mainRoute: '/finance', submenu: 'Recovery', subIcon: 'healing', tab: 'Recovery', action: 'Send payment reminders for overdue invoices', keywords: 'finance recovery reminders overdue invoices' },
  { mainMenu: 'Automation', mainIcon: 'smart_toy', mainRoute: '/automation', action: 'Create and manage workflow automation rules', keywords: 'automation workflows rules triggers conditions' },
  { mainMenu: 'Groups', mainIcon: 'group_work', mainRoute: '/groups', action: 'Collaborate with teams via chat, meetings, and file sharing', keywords: 'groups chat meetings collaboration teams' },
  { mainMenu: 'Settings', mainIcon: 'settings', mainRoute: '/settings/organization', submenu: 'Organization', subIcon: 'business', action: 'Configure organization profile and settings', keywords: 'settings organization company profile' },
  { mainMenu: 'Settings', mainIcon: 'settings', mainRoute: '/settings/users', submenu: 'Users', subIcon: 'people', action: 'Manage user accounts and permissions', keywords: 'settings users accounts permissions roles' },
  { mainMenu: 'Settings', mainIcon: 'settings', mainRoute: '/settings/teams', submenu: 'Teams', subIcon: 'groups', action: 'Configure teams, departments, and assignments', keywords: 'settings teams departments groups' },
  { mainMenu: 'Settings', mainIcon: 'settings', mainRoute: '/settings/groups', submenu: 'Groups', subIcon: 'forum', action: 'Manage collaboration group settings', keywords: 'settings groups collaboration' },
];

@Component({
  selector: 'app-support-modal',
  imports: [MatIconModule, CommonModule, FormsModule],
  styles: [`
    .drop-zone {
      transition: all 150ms ease;
    }
    .drop-zone.dragging {
      background: #EFF6FF;
      border-color: #3B82F6;
    }
  `],
  template: `
    @if (open()) {
      <div class="fixed inset-0 z-50 bg-zinc-900/40 backdrop-blur-xs flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-xl border border-zinc-100 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">

          @if (!submitted()) {
            <!-- Header -->
            <div class="flex justify-between items-center">
              <div class="flex items-center gap-2">
                <mat-icon class="text-zinc-900 text-[22px] w-5.5 h-5.5">help</mat-icon>
                <h3 class="text-lg font-bold text-zinc-950">Help & Support</h3>
              </div>
              <button (click)="closeModal()" title="Close" class="text-zinc-400 hover:text-zinc-600 transition-colors">
                <mat-icon class="w-5 h-5 text-[20px]! leading-none!">close</mat-icon>
              </button>
            </div>

            <!-- Feature / Page Selector (like global search) -->
            <div class="feature-search-wrap">
              <label for="which_feature_has_a_" class="block text-xs font-semibold text-zinc-500 uppercase mb-1.5">Which feature has a problem?</label>
              <div class="relative">
                <mat-icon class="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-[18px] w-4.5 h-4.5 pointer-events-none">search</mat-icon>
                <input id="which_feature_has_a_"
                  [ngModel]="featureSearch()"
                  (ngModelChange)="onFeatureSearch($event)"
                  (focus)="showFeatureDropdown.set(true)"
                  type="text"
                  placeholder="Search menus and pages..."
                  class="w-full pl-9 pr-3 py-2 bg-white border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-700/20 focus:border-zinc-700 transition-all placeholder:text-zinc-400"
                />
                @if (selectedFeature()) {
                  <button (click)="clearFeature()" title="Clear" class="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors">
                    <mat-icon class="text-[16px] w-4 h-4">close</mat-icon>
                  </button>
                }
                @if (showFeatureDropdown() && featureSearch().length >= 1 && filteredFeatures().length > 0) {
                  <div class="absolute left-0 right-0 mt-1 bg-white border border-zinc-200 rounded-lg shadow-lg z-10 max-h-56 overflow-y-auto">
                    @for (item of filteredFeatures(); track $index) {
                      <button
                        (click)="selectFeature(item)"
                        class="w-full flex items-start gap-3 px-3 py-2.5 text-left hover:bg-zinc-100 transition-colors border-b border-zinc-100 last:border-b-0"
                      >
                        <mat-icon class="text-zinc-400 text-[18px] w-[18px] h-[18px] mt-0.5 shrink-0">{{ item.subIcon || item.mainIcon }}</mat-icon>
                        <div class="min-w-0 flex-1">
                          <div class="flex items-baseline gap-2">
                            <span class="text-meta font-medium text-zinc-400 shrink-0">{{ item.mainMenu }}</span>
                            @if (item.submenu) {
                              <span class="text-xs font-semibold text-zinc-800 truncate">{{ item.submenu }}</span>
                            } @else {
                              <span class="text-xs font-semibold text-zinc-800 truncate">{{ item.mainMenu }}</span>
                            }
                          </div>
                          <p class="text-meta text-zinc-500 mt-0.5 leading-tight">{{ item.action }}</p>
                        </div>
                      </button>
                    }
                  </div>
                }
                @if (showFeatureDropdown() && featureSearch().length >= 1 && filteredFeatures().length === 0) {
                  <div class="absolute left-0 right-0 mt-1 bg-white border border-zinc-200 rounded-lg shadow-lg z-10 p-3 text-center">
                    <p class="text-sm text-zinc-400">No results found</p>
                  </div>
                }
              </div>
            </div>

            <!-- Contact Method -->
            <div>
              <label for="contact_via" class="block text-xs font-semibold text-zinc-500 uppercase mb-1.5">Contact via</label>
              <div class="flex gap-2">
                <button
                  (click)="contactMethod.set('email')"
                  class="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all"
                  [class.bg-zinc-100]="contactMethod() === 'email'"
                  [class.border-zinc-400]="contactMethod() === 'email'"
                  [class.text-zinc-950]="contactMethod() === 'email'"
                  [class.border-zinc-200]="contactMethod() !== 'email'"
                  [class.text-zinc-600]="contactMethod() !== 'email'"
                  [class.hover:bg-zinc-50]="contactMethod() !== 'email'"
                >
                  <mat-icon class="text-[18px] w-4.5 h-4.5">email</mat-icon>
                  Email
                </button>
                <button
                  (click)="contactMethod.set('whatsapp')"
                  class="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all"
                  [class.bg-zinc-100]="contactMethod() === 'whatsapp'"
                  [class.border-zinc-400]="contactMethod() === 'whatsapp'"
                  [class.text-zinc-950]="contactMethod() === 'whatsapp'"
                  [class.border-zinc-200]="contactMethod() !== 'whatsapp'"
                  [class.text-zinc-600]="contactMethod() !== 'whatsapp'"
                  [class.hover:bg-zinc-50]="contactMethod() !== 'whatsapp'"
                >
                  <mat-icon class="text-[18px] w-4.5 h-4.5">chat</mat-icon>
                  WhatsApp
                </button>
              </div>
            </div>

            <!-- Description -->
            <div>
              <label for="describe_the_bug_or_" class="block text-xs font-semibold text-zinc-500 uppercase mb-1.5">Describe the bug or request</label>
              <textarea id="describe_the_bug_or_"
                [(ngModel)]="description"
                rows="4"
                placeholder="Please describe what happened, what you expected, and any steps to reproduce..."
                class="w-full border border-zinc-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-700/20 focus:border-zinc-700 transition-all placeholder:text-zinc-400 resize-none"
              ></textarea>
            </div>

            <!-- Drag & Drop File Upload -->
            <div>
              <label for="attachments" class="block text-xs font-semibold text-zinc-500 uppercase mb-1.5">Attachments <span class="font-normal normal-case text-zinc-400">(screenshots, recordings, documents)</span></label>
              <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events,@angular-eslint/template/interactive-supports-focus -->
              <div
                class="drop-zone border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all"
                [class.dragging]="isDragging()"
                [class.border-zinc-200]="!isDragging()"
                [class.bg-zinc-50]="!isDragging()"
                (dragover)="onDragOver($event)"
                (dragleave)="onDragLeave($event)"
                (drop)="onDrop($event)"
                (click)="fileInput.click()"
              >
                <mat-icon class="text-zinc-300 text-[32px] w-8 h-8 mb-1">cloud_upload</mat-icon>
                <p class="text-sm text-zinc-500">
                  <span class="text-zinc-900 font-medium">Click to upload</span> or drag and drop
                </p>
                <p class="text-xs text-zinc-400 mt-0.5">PNG, JPG, MP4, PDF up to 10MB</p>
                <input #fileInput type="file" multiple accept="image/*,video/*,.pdf,.doc,.docx" (change)="onFileSelected($event)" class="hidden" />
              </div>

              @if (files().length > 0) {
                <div class="mt-2 space-y-1.5">
                  @for (file of files(); track file.name) {
                    <div class="flex items-center justify-between bg-zinc-50 rounded-lg px-3 py-1.5">
                      <div class="flex items-center gap-2 min-w-0">
                        @if (file.type.startsWith('image/')) {
                          <mat-icon class="text-zinc-500 text-[16px] w-4 h-4 shrink-0">image</mat-icon>
                        } @else if (file.type.startsWith('video/')) {
                          <mat-icon class="text-zinc-500 text-[16px] w-4 h-4 shrink-0">videocam</mat-icon>
                        } @else {
                          <mat-icon class="text-zinc-500 text-[16px] w-4 h-4 shrink-0">description</mat-icon>
                        }
                        <span class="text-sm text-zinc-700 truncate">{{ file.name }}</span>
                        <span class="text-xs text-zinc-400 shrink-0">{{ formatSize(file.size) }}</span>
                      </div>
                      <button (click)="removeFile(file.name)" title="Remove file" class="text-zinc-400 hover:text-zinc-700 transition-colors shrink-0 ml-2">
                        <mat-icon class="text-[16px] w-4 h-4">close</mat-icon>
                      </button>
                    </div>
                  }
                </div>
              }
            </div>

            <!-- Submit -->
            <button
              (click)="submit()"
              [disabled]="!description().trim()"
              class="w-full py-2.5 bg-zinc-900 hover:bg-zinc-950 disabled:bg-zinc-300 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg shadow-sm transition-all flex items-center justify-center gap-2"
            >
              <mat-icon class="text-[18px] w-4.5 h-4.5">send</mat-icon>
              Send via {{ contactMethod() === 'email' ? 'Email' : 'WhatsApp' }}
            </button>
          }

          <!-- Success Message -->
          @if (submitted()) {
            <div class="py-8 text-center space-y-4">
              <div class="w-16 h-16 bg-zinc-200 rounded-full flex items-center justify-center mx-auto">
                <mat-icon class="text-zinc-900 text-[32px] w-8 h-8">check_circle</mat-icon>
              </div>
              <h3 class="text-xl font-bold text-zinc-950">Thank you!</h3>
              <p class="text-sm text-zinc-500 max-w-sm mx-auto">
                Your message has been sent successfully. You will be contacted shortly by our support team.
              </p>
              <button
                (click)="closeModal()"
                class="mt-2 px-6 py-2 bg-zinc-900 hover:bg-zinc-950 text-white text-sm font-semibold rounded-lg shadow-sm transition-all"
              >
                Done
              </button>
            </div>
          }

        </div>
      </div>
    }
  `
})
export class SupportModalComponent {
  readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  open = signal(false);
  featureSearch = signal('');
  showFeatureDropdown = signal(false);
  selectedFeature = signal<SearchItem | null>(null);
  contactMethod = signal<'email' | 'whatsapp'>('email');
  description = signal('');
  files = signal<UploadedFile[]>([]);
  submitted = signal(false);
  isDragging = signal(false);

  filteredFeatures = computed(() => {
    const q = this.featureSearch().toLowerCase().trim();
    if (!q) return SEARCH_ITEMS;
    return SEARCH_ITEMS.filter(item =>
      item.mainMenu.toLowerCase().includes(q) ||
      item.action.toLowerCase().includes(q) ||
      item.keywords.toLowerCase().includes(q) ||
      (item.submenu && item.submenu.toLowerCase().includes(q))
    ).slice(0, 12);
  });

  openModal() {
    this.open.set(true);
    this.submitted.set(false);
    this.selectedFeature.set(null);
    this.description.set('');
    this.files.set([]);
    this.featureSearch.set('');
    this.contactMethod.set('email');
    this.showFeatureDropdown.set(false);
  }

  closeModal() {
    this.open.set(false);
    this.showFeatureDropdown.set(false);
  }

  onFeatureSearch(value: string) {
    this.featureSearch.set(value);
    this.selectedFeature.set(null);
    if (value.length >= 1) {
      this.showFeatureDropdown.set(true);
    } else {
      this.showFeatureDropdown.set(false);
    }
  }

  clearFeature() {
    this.featureSearch.set('');
    this.selectedFeature.set(null);
    this.showFeatureDropdown.set(false);
  }

  selectFeature(item: SearchItem) {
    this.selectedFeature.set(item);
    this.featureSearch.set(item.submenu || item.mainMenu);
    this.showFeatureDropdown.set(false);
  }

  @HostListener('document:click', ['$event'])
  handleDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (this.showFeatureDropdown() && !target.closest('.feature-search-wrap')) {
      this.showFeatureDropdown.set(false);
    }
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
    const droppedFiles = event.dataTransfer?.files;
    if (droppedFiles) {
      this.addFiles(Array.from(droppedFiles));
    }
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.addFiles(Array.from(input.files));
      input.value = '';
    }
  }

  addFiles(newFiles: File[]) {
    const current = this.files();
    const updated = [...current];
    for (const file of newFiles) {
      if (!updated.find(f => f.name === file.name && f.size === file.size)) {
        updated.push({ name: file.name, size: file.size, type: file.type });
      }
    }
    this.files.set(updated);
  }

  removeFile(fileName: string) {
    this.files.update(files => files.filter(f => f.name !== fileName));
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  submit() {
    const feature = this.selectedFeature();
    const desc = this.description().trim();
    const fileList = this.files();
    const fileInfo = fileList.map(f => `${f.name} (${this.formatSize(f.size)})`).join(', ') || 'None';
    const featureLabel = feature ? (feature.submenu || feature.mainMenu) : 'Not specified';

    if (this.contactMethod() === 'email') {
      const subject = encodeURIComponent(`[Support] ${featureLabel} Issue`);
      const body = encodeURIComponent(
        `Feature / Page: ${featureLabel}\n\n` +
        `Description:\n${desc}\n\n` +
        `Attachments:\n${fileInfo}\n\n---\nSent from CRM Support`
      );
      window.open(`mailto:contact@varyocrm.com?subject=${subject}&body=${body}`, '_blank');
    } else {
      const text = encodeURIComponent(
        `*Support Request*\n\n*Feature:* ${featureLabel}\n\n*Description:*\n${desc}\n\n*Files:* ${fileInfo}`
      );
      window.open(`https://wa.me/212XXXXXXXXX?text=${text}`, '_blank');
    }

    this.submitted.set(true);
  }
}
