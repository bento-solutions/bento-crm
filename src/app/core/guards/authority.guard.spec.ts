import { describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { Observable, firstValueFrom } from 'rxjs';
import { CrmStateService } from '../../services/crm-state.service';
import { authorityGuard } from './authority.guard';

function setup(status: 'pending' | 'loaded' | 'failed') {
  const authorities = signal(new Set<string>());
  const state = {
    isAuthenticated: signal(true),
    currentUserStatus: signal(status),
    hasAuthority: (a: string) => authorities().has(a),
  };
  TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: CrmStateService, useValue: state }] });
  const run = () => TestBed.runInInjectionContext(() => authorityGuard('INVOICES_READ')(null!, null!));
  return { state, authorities, run, router: TestBed.inject(Router) };
}

describe('authorityGuard', () => {
  it('waits for the user to load before judging a page opened by URL', async () => {
    const { state, authorities, run } = setup('pending');
    const result = run() as Observable<boolean | UrlTree>;
    expect(result).toBeInstanceOf(Observable);
    const decided = firstValueFrom(result);
    authorities.set(new Set(['INVOICES_READ']));
    state.currentUserStatus.set('loaded');
    TestBed.tick();
    expect(await decided).toBe(true);
  });

  it('sends a user without the right home once the role is known', () => {
    const { run, router } = setup('loaded');
    expect(router.serializeUrl(run() as UrlTree)).toBe('/');
  });
});
