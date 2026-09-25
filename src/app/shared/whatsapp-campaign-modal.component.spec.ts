import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { computed, signal } from '@angular/core';
import { PartnersService } from '../services/domains/partners.service';
import { WhatsAppAccount, WhatsAppCampaignsService } from '../services/domains/whatsapp-campaigns.service';
import { WhatsAppCampaignModalComponent } from './whatsapp-campaign-modal.component';

function setup(account: Partial<WhatsAppAccount>) {
  const accountSignal = signal<WhatsAppAccount | null>({
    id: 'acc', phoneNumberId: '', status: 'CONNECTED', hasAccessToken: false, provider: 'META', ...account,
  } as WhatsAppAccount);
  const wa = {
    account: accountSignal,
    hasAccount: computed(() => accountSignal() !== null),
    isMock: computed(() => accountSignal()?.provider === 'MOCK'),
    isSending: signal(false),
    loadAccount: vi.fn(),
    create: vi.fn(),
  };
  const partners = {
    allPartners: signal([{ id: 'p1', name: 'Ahmed', phone: '+212600000001', city: 'Rabat' }]),
    load: vi.fn(),
  };
  TestBed.configureTestingModule({
    imports: [WhatsAppCampaignModalComponent],
    providers: [
      { provide: WhatsAppCampaignsService, useValue: wa },
      { provide: PartnersService, useValue: partners },
    ],
  });
  const fixture = TestBed.createComponent(WhatsAppCampaignModalComponent);
  fixture.componentRef.setInput('open', true);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const button = (label: string) =>
    Array.from(el.querySelectorAll('button')).find(b => b.textContent?.trim().includes(label)) as HTMLButtonElement;
  return { fixture, component: fixture.componentInstance, wa, el, button };
}

describe('WhatsAppCampaignModalComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('asks a Meta account for an approved template', () => {
    const { component, el } = setup({ provider: 'META' });
    expect(el.querySelector('#approved_template_na')).not.toBeNull();
    expect(el.querySelector('#linked_body')).toBeNull();
    component.title.set('Q3');
    component.selectedIds.set(new Set(['p1']));
    expect(component.validationError()).toBe('Enter the approved template name.');
  });

  it('sends plain text from a linked number, with the ban-risk warning and a text relance', () => {
    const { fixture, component, wa, el, button } = setup({ provider: 'BAILEYS', sessionState: 'open', linkedPhone: '+212600000009' });
    expect(el.querySelector('#approved_template_na')).toBeNull();
    expect(el.querySelector('#relance_template')).toBeNull();
    expect(el.querySelector('#linked_body')).not.toBeNull();
    expect(el.querySelector('#relance_body')).not.toBeNull();
    expect(el.textContent).toContain('15 new chats a day');

    component.title.set('Relance devis');
    component.selectedIds.set(new Set(['p1']));
    expect(component.validationError()).toBe('Write the message.');
    component.bodyPreview.set('Bonjour, toujours intéressé ?');
    expect(component.validationError()).toBe('Write the relance message, or turn the relance off.');
    component.followupBody.set('Petit rappel.');
    expect(component.validationError()).toBeNull();
    fixture.detectChanges();

    button('Start sending').click();
    const draft = wa.create.mock.calls[0][0];
    expect(draft.templateName).toBeUndefined();
    expect(draft.followupTemplateName).toBeUndefined();
    expect(draft).toMatchObject({ bodyPreview: 'Bonjour, toujours intéressé ?', followupBody: 'Petit rappel.', launchNow: true });
  });

  it('lets a linked number save a draft while offline, but not launch', () => {
    const { fixture, component, wa, button } = setup({ provider: 'BAILEYS', sessionState: 'close' });
    component.title.set('Offline');
    component.selectedIds.set(new Set(['p1']));
    component.bodyPreview.set('Bonjour');
    component.followupEnabled.set(false);
    fixture.detectChanges();

    expect(component.validationError()).toBeNull();
    expect(component.launchBlocker()).toContain('not connected');
    expect(button('Start sending').disabled).toBe(true);
    expect(button('Save draft').disabled).toBe(false);
    button('Save draft').click();
    expect(wa.create.mock.calls[0][0]).toMatchObject({ launchNow: false, bodyPreview: 'Bonjour' });
  });
});
