import {DeferBlockBehavior, DeferBlockState, TestBed} from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {provideRouter} from '@angular/router';
import {App} from './app';
import {SupportModalComponent} from './shared/support-modal.component';
import {NotificationInboxDrawerComponent} from './shared/notification-inbox-drawer.component';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('loads the login screen for a signed-out visitor', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-login')).not.toBeNull();
  });
});

describe('App shell, signed in', () => {
  beforeEach(async () => {
    localStorage.setItem('accessToken', 'test-token');
    localStorage.setItem('bento_auth', 'true');
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
      deferBlockBehavior: DeferBlockBehavior.Manual,
    }).compileComponents();
  });

  afterEach(() => localStorage.clear());

  async function supportBlock(fixture: ReturnType<typeof TestBed.createComponent<App>>) {
    const blocks = await fixture.getDeferBlocks();
    return blocks[0];
  }

  it('keeps the support modal and notifications drawer out of the first render', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.directive(SupportModalComponent))).toBeNull();
    expect(fixture.debugElement.query(By.directive(NotificationInboxDrawerComponent))).toBeNull();
  });

  it('opens the support modal when it is asked for before its code has arrived', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    fixture.componentInstance.openSupportModal();
    await (await supportBlock(fixture)).render(DeferBlockState.Complete);
    fixture.detectChanges();

    const modal = fixture.debugElement.query(By.directive(SupportModalComponent)).componentInstance as SupportModalComponent;
    expect(modal.open()).toBe(true);
  });

  it('opens the support modal directly once it is loaded', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await (await supportBlock(fixture)).render(DeferBlockState.Complete);
    fixture.detectChanges();

    const modal = fixture.debugElement.query(By.directive(SupportModalComponent)).componentInstance as SupportModalComponent;
    expect(modal.open()).toBe(false);
    fixture.componentInstance.openSupportModal();
    expect(modal.open()).toBe(true);
  });

  it('mirrors the search box into the query, and clears the box with it', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('.topbar-search input') as HTMLInputElement;

    input.value = 'deals';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(fixture.componentInstance.searchQuery()).toBe('deals');

    fixture.componentInstance.clearSearch();
    fixture.detectChanges();
    expect(input.value).toBe('');
  });

  it('shows the notifications drawer open once it is loaded', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    fixture.componentInstance.openNotifications();
    fixture.detectChanges();
    const blocks = await fixture.getDeferBlocks();
    await blocks[1].render(DeferBlockState.Complete);
    fixture.detectChanges();

    const drawer = fixture.debugElement.query(By.directive(NotificationInboxDrawerComponent)).componentInstance as NotificationInboxDrawerComponent;
    expect(drawer.open()).toBe(true);
  });
});
