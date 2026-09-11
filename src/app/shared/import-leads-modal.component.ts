import { Component, computed, inject, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { CrmStateService, Lead } from '../services/crm-state.service';
/* eslint-disable */

/** A `Lead` field an imported column can be mapped onto. */
interface LeadField {
  key: keyof Lead;
  label: string;
  /** Header fragments (lowercase) that auto-map onto this field. */
  aliases: string[];
  required?: boolean;
}

const LEAD_FIELDS: LeadField[] = [
  { key: 'name', label: 'Name', aliases: ['name', 'full name', 'contact', 'nom'], required: true },
  { key: 'companyName', label: 'Company', aliases: ['company', 'company name', 'organisation', 'organization', 'société', 'societe'] },
  { key: 'email', label: 'Email', aliases: ['email', 'e-mail', 'mail', 'courriel'] },
  { key: 'phone', label: 'Phone', aliases: ['phone', 'telephone', 'téléphone', 'mobile', 'tel'] },
  { key: 'status', label: 'Status', aliases: ['status', 'stage', 'statut'] },
  { key: 'priority', label: 'Priority', aliases: ['priority', 'priorité', 'priorite'] },
  { key: 'temperature', label: 'Temperature', aliases: ['temperature', 'température'] },
  { key: 'qualification', label: 'Qualification', aliases: ['qualification', 'qualified'] },
  { key: 'score', label: 'Score', aliases: ['score', 'rating', 'note'] },
  { key: 'source', label: 'Source', aliases: ['source', 'origin', 'origine', 'channel'] },
  { key: 'city', label: 'City', aliases: ['city', 'ville', 'town'] },
  { key: 'assignedSalesperson', label: 'Assigned To', aliases: ['assigned', 'assigned to', 'owner', 'salesperson', 'commercial'] },
  { key: 'notes', label: 'Notes', aliases: ['notes', 'note', 'comments', 'commentaires', 'remarks'] },
];

// Kept in step with the values the leads page filters on; anything outside these lists is
// reported as a row error rather than silently written through.
const STATUSES: Lead['status'][] = ['New', 'Contacted', 'Attempted Contact', 'Meeting Scheduled', 'Qualified', 'Proposal Requested', 'Converted', 'Lost', 'Disqualified'];
const PRIORITIES: Lead['priority'][] = ['Low', 'Medium', 'High'];
const TEMPERATURES: Lead['temperature'][] = ['Cold', 'Warm', 'Hot'];
const QUALIFICATIONS: Lead['qualification'][] = ['Qualified', 'Unqualified', 'Pending'];
const SOURCES: NonNullable<Lead['source']>[] = ['Website form', 'Trade show', 'LinkedIn', 'Marketing campaign', 'Referral'];

interface ParsedRow {
  rowNumber: number;
  lead: Partial<Lead>;
  errors: string[];
}

/**
 * Three-step bulk import for leads: pick a file, confirm how its columns map onto lead fields,
 * then review what will be created before committing.
 *
 * CSV and Excel share one code path — SheetJS reads both — so a user who exported from Excel
 * does not have to convert to CSV first.
 */
@Component({
  selector: 'app-import-leads-modal',
  imports: [CommonModule, FormsModule, MatIconModule],
  template: `
    <!-- eslint-disable-next-line @angular-eslint/template/interactive-supports-focus -->
    <div class="fixed inset-0 bg-zinc-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" role="button" (click)="close.emit()" (keydown.escape)="close.emit()">
      <!-- eslint-disable-next-line @angular-eslint/template/interactive-supports-focus -->
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col" role="button" (click)="$event.stopPropagation()" (keydown.escape)="$event.stopPropagation()">

        <div class="p-6 border-b border-zinc-100 flex items-center justify-between">
          <div>
            <h3 class="text-lg font-bold text-zinc-950">Import Leads</h3>
            <p class="text-sm text-zinc-500 mt-0.5">
              @switch (step()) {
                @case ('upload') { Choose a CSV or Excel file to load. }
                @case ('map') { Match each column to a lead field. }
                @case ('preview') { Review what will be created. }
              }
            </p>
          </div>
          <button (click)="close.emit()" (keydown.escape)="close.emit()" class="text-zinc-400 hover:text-zinc-600 transition-colors">
            <mat-icon>close</mat-icon>
          </button>
        </div>

        <div class="p-6 overflow-y-auto grow">

          <!-- Step 1: file -->
          @if (step() === 'upload') {
            <label class="block border-2 border-dashed border-zinc-200 hover:border-zinc-400 rounded-2xl p-12 text-center cursor-pointer transition-colors"
              (dragover)="$event.preventDefault()" (drop)="onDrop($event)">
              <mat-icon class="text-[40px]! w-10 h-10 text-zinc-300">upload_file</mat-icon>
              <div class="mt-3 text-sm font-semibold text-zinc-700">Drop a file here, or click to browse</div>
              <div class="mt-1 text-xs text-zinc-400">.csv, .xls or .xlsx — the first row must be the column headers</div>
              @if (parsing()) {
                <div class="mt-3 text-xs font-semibold text-zinc-500">Reading file…</div>
              }
              <input type="file" accept=".csv,.xls,.xlsx" class="hidden" (change)="onFileSelected($event)">
            </label>
            @if (parseError()) {
              <div class="mt-4 text-sm text-red-600">{{ parseError() }}</div>
            }
          }

          <!-- Step 2: column mapping -->
          @if (step() === 'map') {
            <div class="text-xs text-zinc-500 mb-4">
              <strong class="text-zinc-700">{{ fileName() }}</strong> — {{ rawRows().length }} data row(s), {{ headers().length }} column(s).
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              @for (header of headers(); track header) {
                <div class="flex items-center gap-3 bg-zinc-50 rounded-xl p-3">
                  <span class="text-sm font-mono text-zinc-700 truncate w-1/2" [title]="header">{{ header }}</span>
                  <mat-icon class="text-[16px]! w-4 h-4 text-zinc-300 shrink-0">arrow_forward</mat-icon>
                  <select [ngModel]="mapping()[header] || ''" (ngModelChange)="setMapping(header, $event)"
                    class="grow border border-zinc-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-zinc-700/20">
                    <option value="">— Ignore —</option>
                    @for (field of fields; track field.key) {
                      <option [value]="field.key">{{ field.label }}{{ field.required ? ' *' : '' }}</option>
                    }
                  </select>
                </div>
              }
            </div>
            @if (!hasNameMapping()) {
              <div class="mt-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
                Map a column to <strong>Name</strong> — a lead cannot be created without one.
              </div>
            }
          }

          <!-- Step 3: preview -->
          @if (step() === 'preview') {
            <div class="flex flex-wrap gap-3 mb-4">
              <span class="px-3 py-1.5 rounded-lg text-sm font-semibold bg-emerald-50 text-emerald-700">
                {{ validRows().length }} ready to import
              </span>
              @if (invalidRows().length > 0) {
                <span class="px-3 py-1.5 rounded-lg text-sm font-semibold bg-red-50 text-red-700">
                  {{ invalidRows().length }} will be skipped
                </span>
              }
            </div>

            <div class="overflow-x-auto border border-zinc-100 rounded-xl">
              <table class="min-w-full text-sm">
                <thead class="bg-zinc-50">
                  <tr class="text-xs uppercase tracking-wider text-zinc-500">
                    <th scope="col" class="px-3 py-2 text-left font-medium">Row</th>
                    @for (field of mappedFields(); track field.key) {
                      <th scope="col" class="px-3 py-2 text-left font-medium">{{ field.label }}</th>
                    }
                    <th scope="col" class="px-3 py-2 text-left font-medium">Issues</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-zinc-100">
                  @for (row of previewRows(); track row.rowNumber) {
                    <tr [class.bg-red-50/50]="row.errors.length > 0">
                      <td class="px-3 py-2 text-zinc-400 font-mono text-xs">{{ row.rowNumber }}</td>
                      @for (field of mappedFields(); track field.key) {
                        <td class="px-3 py-2 text-zinc-700 truncate max-w-[160px]">{{ row.lead[field.key] }}</td>
                      }
                      <td class="px-3 py-2 text-xs text-red-600">{{ row.errors.join('; ') }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            @if (parsedRows().length > previewRows().length) {
              <div class="mt-2 text-xs text-zinc-400">
                Showing the first {{ previewRows().length }} of {{ parsedRows().length }} rows.
              </div>
            }
          }
        </div>

        <div class="p-6 border-t border-zinc-100 flex justify-between gap-3">
          <button (click)="back()" (keydown.escape)="back()" [disabled]="step() === 'upload'"
            class="px-4 py-2 rounded-xl text-sm font-semibold text-zinc-600 hover:bg-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            Back
          </button>
          <div class="flex gap-3">
            <button (click)="close.emit()" (keydown.escape)="close.emit()" class="px-4 py-2 rounded-xl text-sm font-semibold text-zinc-600 hover:bg-zinc-100 transition-colors">
              Cancel
            </button>
            @if (step() === 'map') {
              <button (click)="step.set('preview')" (keydown.escape)="step.set('preview')" [disabled]="!hasNameMapping()"
                class="bg-zinc-900 hover:bg-zinc-950 disabled:opacity-40 disabled:cursor-not-allowed text-white px-5 py-2 rounded-xl text-sm font-semibold transition-colors">
                Preview
              </button>
            }
            @if (step() === 'preview') {
              <button (click)="runImport()" (keydown.escape)="runImport()" [disabled]="validRows().length === 0"
                class="bg-zinc-900 hover:bg-zinc-950 disabled:opacity-40 disabled:cursor-not-allowed text-white px-5 py-2 rounded-xl text-sm font-semibold transition-colors">
                Import {{ validRows().length }} lead(s)
              </button>
            }
          </div>
        </div>
      </div>
    </div>
  `,
})
export class ImportLeadsModalComponent {
  private state = inject(CrmStateService);

   
  close = output<void>();
  imported = output<{ imported: number; skipped: number }>();

  readonly fields = LEAD_FIELDS;

  step = signal<'upload' | 'map' | 'preview'>('upload');
  fileName = signal('');
  headers = signal<string[]>([]);
  rawRows = signal<Record<string, unknown>[]>([]);
  mapping = signal<Record<string, string>>({});
  parseError = signal<string | null>(null);
  parsing = signal(false);

  onFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.readFile(file);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (file) this.readFile(file);
  }

  private readFile(file: File) {
    this.parseError.set(null);
    this.parsing.set(true);
    const reader = new FileReader();
    reader.onerror = () => {
      this.parsing.set(false);
      this.parseError.set('That file could not be read.');
    };
    reader.onload = async () => {
      try {
        // SheetJS is ~390 kB, and most visits to this page never import anything, so it is
        // fetched on the first parse rather than bundled into the partners chunk.
        const XLSX = await import('xlsx');
        // `raw` disables type inference. Without it a CSV cell like the Moroccan phone number
        // "0661234567" is read as the number 661234567 and loses its leading zero.
        const workbook = XLSX.read(reader.result, { type: 'array', raw: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        if (!sheet) throw new Error('empty workbook');
        // `defval` keeps blank cells as empty strings so every row has the same keys, which
        // is what lets the preview table line up with the header list.
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
        if (rows.length === 0) {
          this.parseError.set('That file has headers but no data rows.');
          return;
        }
        this.fileName.set(file.name);
        this.headers.set(Object.keys(rows[0]));
        this.rawRows.set(rows);
        this.mapping.set(this.autoMap(Object.keys(rows[0])));
        this.step.set('map');
      } catch {
        this.parseError.set('That file could not be parsed as a CSV or Excel workbook.');
      } finally {
        this.parsing.set(false);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  /** Best-effort header matching so the common case needs no manual mapping at all. */
  private autoMap(headers: string[]): Record<string, string> {
    const result: Record<string, string> = {};
    const taken = new Set<string>();
    for (const header of headers) {
      const normalized = header.trim().toLowerCase();
      const match = LEAD_FIELDS.find(f =>
        !taken.has(f.key) && f.aliases.some(a => a === normalized || normalized.includes(a)));
      if (match) {
        result[header] = match.key;
        taken.add(match.key);
      }
    }
    return result;
  }

  setMapping(header: string, field: string) {
    this.mapping.update(current => {
      const next = { ...current };
      // A lead field can only come from one column, so claiming it releases the previous one.
      if (field) {
        for (const key of Object.keys(next)) {
          if (next[key] === field) delete next[key];
        }
        next[header] = field;
      } else {
        delete next[header];
      }
      return next;
    });
  }

  hasNameMapping = computed(() => Object.values(this.mapping()).includes('name'));

  mappedFields = computed(() => {
    const used = new Set(Object.values(this.mapping()));
    return LEAD_FIELDS.filter(f => used.has(f.key));
  });

  parsedRows = computed<ParsedRow[]>(() => {
    const map = this.mapping();
    return this.rawRows().map((raw, index) => {
      const lead: Partial<Lead> = {};
      const errors: string[] = [];

      for (const [header, field] of Object.entries(map)) {
        const value = String(raw[header] ?? '').trim();
        if (!value) continue;
        this.assign(lead, field as keyof Lead, value, errors);
      }

      if (!lead.name) errors.push('missing name');

      // `+2` because row 1 is the header and spreadsheets are 1-indexed, so this matches what
      // the user sees in Excel when they go to fix a bad row.
      return { rowNumber: index + 2, lead, errors };
    });
  });

  private assign(lead: Partial<Lead>, field: keyof Lead, value: string, errors: string[]) {
    switch (field) {
      case 'score': {
        const score = Number(value);
        if (isNaN(score)) { errors.push(`score "${value}" is not a number`); return; }
        lead.score = Math.max(0, Math.min(100, score));
        return;
      }
      case 'status':
        lead.status = this.parseEnum(STATUSES, value, 'status', errors);
        return;
      case 'priority':
        lead.priority = this.parseEnum(PRIORITIES, value, 'priority', errors);
        return;
      case 'temperature':
        lead.temperature = this.parseEnum(TEMPERATURES, value, 'temperature', errors);
        return;
      case 'qualification':
        lead.qualification = this.parseEnum(QUALIFICATIONS, value, 'qualification', errors);
        return;
      case 'source':
        lead.source = this.parseEnum(SOURCES, value, 'source', errors);
        return;
      default:
        (lead as Record<string, unknown>)[field] = value;
    }
  }

  /**
   * Resolves a spreadsheet cell onto one of the allowed values, recording a row error when it
   * matches none. An unrecognised value fails the row rather than silently defaulting, so a
   * mistyped column never quietly writes the wrong status onto every lead in the file.
   */
  private parseEnum<T extends string>(allowed: readonly T[], value: string, label: string, errors: string[]): T | undefined {
    const match = this.matchEnum(allowed, value);
    if (!match) errors.push(`unknown ${label} "${value}"`);
    return match;
  }

  /** Case- and spacing-insensitive enum match, so "qualified" and "QUALIFIED" both land. */
  private matchEnum<T extends string>(allowed: readonly T[], value: string): T | undefined {
    const normalized = value.trim().toLowerCase();
    return allowed.find(a => a.toLowerCase() === normalized);
  }

  validRows = computed(() => this.parsedRows().filter(r => r.errors.length === 0));
  invalidRows = computed(() => this.parsedRows().filter(r => r.errors.length > 0));

  /** Bad rows first, so a user checking the preview sees what needs fixing without scrolling. */
  previewRows = computed(() =>
    [...this.invalidRows(), ...this.validRows()].slice(0, 10));

  back() {
    if (this.step() === 'preview') this.step.set('map');
    else if (this.step() === 'map') this.step.set('upload');
  }

  runImport() {
    const rows = this.validRows();
    const imported = this.state.importLeads(rows.map(r => this.toNewLead(r.lead)));
    this.imported.emit({ imported, skipped: this.invalidRows().length });
    this.close.emit();
  }

  /** Fills the fields `addLead` requires but an import file will not usually carry. */
  private toNewLead(partial: Partial<Lead>) {
    return {
      ...partial,
      name: partial.name!,
      companyName: partial.companyName ?? '',
      status: partial.status ?? 'New',
      qualification: partial.qualification ?? 'Pending',
      priority: partial.priority ?? 'Medium',
      score: partial.score ?? 0,
      temperature: partial.temperature ?? 'Cold',
      stage: partial.stage ?? 'New',
    } as Parameters<CrmStateService['addLead']>[0];
  }
}
