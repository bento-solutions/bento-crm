# Bento CRM — Full-Stack Audit & Remediation Plan

**Date:** 2026-08-08
**Scope:** `crm-backend` (Spring Boot 3.3 / Java 17 / PostgreSQL / Redis / Flyway) and `crm` (Angular 21, standalone components + signals, SSR)
**Method:** Direct source review of security/tenancy config + two independent full-repo audits (backend, frontend)

---

## 0. Executive Summary

The backend has a well-designed permission and multi-tenancy *model* — but neither is actually enforced at runtime. Method security is globally disabled and almost every business route is `permitAll()`, so today **the entire CRM API is reachable by anyone with no login**. The frontend, independently, doesn't call most of that API in the first place: 9 of ~14 business modules run entirely off hardcoded in-memory arrays, so even once the backend is locked down, most of the UI still won't reflect real data until it's rewired.

Neither app is "broken" in the sense of crashing — both look and feel functional in a demo. But as shipped, this is a **prototype wearing production clothing**: real auth scaffolding, real DTOs, real JWT/refresh-token flow, real DB migrations — sitting mostly disconnected from the UI, with the security gates left open "for development."

**Top 5 things that must change before this touches real user data:**

1. Re-enable method security and remove the `permitAll()` blanket on business routes (`SecurityConfig.java`).
2. Remove the hardcoded JWT secret fallback and hardcoded default-tenant fallback.
3. Fix the one confirmed cross-tenant IDOR in `UserService`.
4. Wire the frontend's `load*()` methods into actual page/service lifecycles instead of leaving them dead.
5. Decide the fate of ~10 orphaned entities/features (notifications, file upload, automation execution, group messaging) — finish or delete them; half-built silent stubs are worse than missing features.

---

## 1. Architecture Overview

| Layer | Stack | Notes |
|---|---|---|
| Backend | Spring Boot 3.3, Java 17, PostgreSQL, Flyway, Redis (cache), JWT (jjwt), BCrypt | Modular by domain (`auth`, `deal`, `partner`, `invoice`, `ticket`, `task`, `proposal`, `purchaseorder`, `campaign`, `automation`, `identity`, `organization`, `file`, `notification`, `common`) |
| Frontend | Angular 21, standalone components, signals, Angular Material, Tailwind, SSR via Express | Single 4,771-line `CrmStateService` god-service backing nearly every page |
| Multi-tenancy | Hibernate `@Filter` on `BaseTenantEntity` + explicit `organizationId` params in most repos | Hybrid enforcement, inconsistently applied |
| RBAC model | 5 roles (`ADMIN/MANAGER/SALESPERSON/SUPPORT/VIEWER`) × 28 fine-grained `Permission` constants, `@PreAuthorize` on ~11 controllers | Fully defined, **entirely inert** at runtime |

---

## 2. Critical Findings (ranked by severity)

### P0 — Critical

| # | Finding | Evidence | Impact |
|---|---|---|---|
| 1 | **Method-level authorization globally disabled** | `common/config/SecurityConfig.java:21` — `@EnableMethodSecurity(prePostEnabled = false) // Disabled for development - allows public API access` | Every `@PreAuthorize` annotation in the codebase (~60+ across 11 controllers) is dead code. |
| 2 | **Nearly all business routes are `permitAll()`** | `SecurityConfig.java:33-51` lists `/users/**`, `/teams/**`, `/groups/**`, `/partners/**`, `/deals/**`, `/proposals/**`, `/tasks/**`, `/tickets/**`, `/invoices/**`, `/purchase-orders/**`, `/campaigns/**`, `/automation-rules/**` as `permitAll` | Full CRUD on every core CRM resource is reachable with **zero authentication**, e.g. `DELETE /deals/{id}` succeeds with no token. |
| 3 | **Hardcoded JWT signing-secret fallback** | `common/config/JwtProperties.java:19` — `@Value("${JWT_SECRET:your-secret-key-change-this-in-production}")` | If `JWT_SECRET` isn't set in any environment, tokens are signed with a publicly-known string — anyone can forge a valid JWT with arbitrary `org`/role claims. |
| 4 | **Tenant context silently defaults to a fixed org on missing/invalid JWT** | `common/config/TenantFilterInterceptor.java:52-55` — falls back to hardcoded UUID `550e8400-e29b-41d4-a716-446655440000` instead of rejecting the request | Unauthenticated callers transparently get real (seeded) tenant data instead of being denied. |
| 5 | **Confirmed cross-tenant IDOR in `UserService`** | `identity/service/UserService.java:51,58,84` — `getUserById`, `updateUser`, `deactivateUser` call `userRepository.findById(id)` with no org check, unlike every other service in the codebase | Any caller who knows/guesses a user UUID from another org can read, edit (including promote to `ADMIN`), or deactivate that user. |

### P1 — High

| # | Finding | Evidence |
|---|---|---|
| 6 | **Rate limiting fully disabled** | `pom.xml` bucket4j dependency commented out; `RateLimitFilter.java.bak` / `RateLimitConfig.java.bak` excluded from build; filter registration commented out in `SecurityConfig.java`. No brute-force protection on `/auth/login`. |
| 7 | **`AuthService.login` does a full-table scan** | `AuthService.java:41` — `userRepository.findAll()` then filters by email in Java, instead of using the existing `findByOrganizationIdAndEmail`. Perf + DoS-amplification risk as the user table grows. |
| 8 | **`AuthService.logout()` is a no-op** | `AuthService.java:112-116` logs "logged out" but never revokes refresh tokens — sessions stay valid until natural 30-day expiry after "logout." |
| 9 | **Frontend has zero route guards** | No `canActivate`/`canMatch` anywhere in `app.routes.ts`; auth gating is a single template `@if` in `app.ts`. Any authenticated user (including a seeded "Viewer") can navigate to `/settings/users`, admin pages, etc. by URL. |
| 10 | **Frontend RBAC model defined but never consulted** | `CrmStateService.currentUserPermissions` / `CRM_ROLES` exist but are referenced nowhere outside their own definition — zero buttons/menus/routes are gated by role. |
| 11 | **9 of ~14 business modules run entirely on hardcoded mock data** | `crm-state.service.ts` — `partners`, `deals`, `tasks`, `invoices`, `campaigns`, `tickets`, `automationRules`, `leadsData` all initialize from large inline arrays; their matching `load*()` API methods exist but are **never called** anywhere in the app. |

### P2 — Medium

| # | Finding | Evidence |
|---|---|---|
| 12 | **Broken permission-name mappings** — would break even with method security re-enabled | `AutomationRuleController` requires `AUTOMATION_RULES_*` but `Permission.java` only defines `AUTOMATION_READ/WRITE`; `GroupController` requires `GROUPS_*`, which don't exist at all — `/groups/**` would be unreachable by any role, including ADMIN. `TeamController` requires `TEAMS_CREATE`/`TEAMS_DELETE`, not defined either. |
| 13 | **No DTOs on 9+ modules** — entities bound directly as `@RequestBody` and returned directly as responses | `DealController`, `CampaignController`, `InvoiceController`, `ProposalController`, `PurchaseOrderController`, `TaskController`, `TicketController`, `AutomationRuleController`, `TeamController`, `GroupController`. Client-supplied `id` on create is not stripped — mass-assignment / merge-instead-of-insert risk. |
| 14 | **No Bean Validation on those same 8 entity-as-DTO modules** | Only 6 files in the whole backend use `@NotNull/@NotBlank/@Size/@Email/...`. `@Valid` on the rest is a no-op; malformed requests surface as raw 500s from DB constraint violations. |
| 15 | **Audit trail (`createdBy`/`updatedBy`) is silently always NULL** | `AuditingConfig.java:20` checks `principal instanceof UserDetails`, but `JwtAuthFilter.java:55-57` sets the principal to a plain `String` (user ID) — the check always fails. |
| 16 | **Inconsistent exception handling** | `IllegalArgumentException`/`IllegalStateException` (bad credentials, inactive account, last-admin guard, missing tenant context) have no dedicated `@ExceptionHandler` and fall through to a generic 500 handler, leaking internal messages and returning the wrong status code. |
| 17 | **Two competing frontend API-client patterns** | `core/services/base-api.service.ts` (timeout/retry/error-normalized, barely used) vs. flat `services/api.service.ts` (no timeout/retry, second hardcoded base URL) — `ApiService` is what the app actually uses for everything except auth. |
| 18 | **No environment-based frontend config** | No `src/environments/*.ts`; `http://localhost:8080/api/v1` hardcoded in two un-synced places (`api-config.ts` and `api.service.ts`). Will not work in any real deployment without a code change. |
| 19 | **`OrganizationController` is create-only** | No GET/PATCH for the org's own profile — the frontend's `updateOrganization()` can't persist because there's no backend endpoint to call. |
| 20 | **Broken 401 redirect** | `auth.interceptor.ts` redirects to `/login` on 401, but no `/login` route exists in `app.routes.ts` (login is a template swap, not a route) — dead code path. |

### P3 — Low / Informational

- Orphaned entities with DB tables but **zero application wiring**: `Notification`, `CreditNote`, `RecoveryReminder`, `ProposalTemplate`, `TicketType`, `PartnerActivity`, `PartnerAddress`, `PartnerContact`, `PartnerFiscalProfile`, `Tag`, `AutomationExecutionLog`, `DomainEvent`, `WebhookSubscription`.
- File upload/download service (`LocalFileStorageService`) is fully implemented but **has no controller** — unreachable via HTTP.
- Group messaging/meetings endpoints exist and are documented in Swagger but are literal stub bodies (`// TODO`) returning fake 200/201s with nothing persisted.
- "Automation" only supports CRUD on rule definitions — there is no rule-evaluation engine, event publisher, or webhook dispatcher despite the supporting entities existing.
- `@google/genai` is a declared frontend dependency with **zero usages anywhere in source** — dead dependency, or an unbuilt AI feature.
- "Sign in with Google" on the frontend is fake — it logs in as the first active user in the mock array, no OAuth.
- No pagination on any list view except one partner sub-tab; will not scale against real data volumes.
- No loading/error UI states anywhere in the frontend — failed API calls silently fall back to stale mock data with no user-visible signal.

---

## 3. Multi-Tenancy Assessment

**Mechanism:** Hibernate `@Filter` (`organizationFilter`) defined on `BaseTenantEntity`, enabled per-request in `TenantFilterInterceptor` from the JWT's `org` claim, **plus** explicit `organizationId` WHERE-clauses hand-written into most repository queries (defense in depth, done correctly in 16 of 17 repositories).

**Structural weakness:** every tenant repository still extends plain `JpaRepository`, so the *inherited* unscoped methods (`findById`, `findAll`, `deleteById`) remain callable and bypass the explicit tenant parameter, relying entirely on the Hibernate filter being enabled for that session. This is exploited today in `UserService` (finding #5).

**No Postgres Row-Level Security** — tenancy is purely an application-layer concern. Any code path that opens a new `EntityManager`/session outside the request filter (future `@Async`, `@Scheduled` jobs, batch imports) will not have the filter enabled and will see cross-tenant data by default.

**Recommendation:** treat the Hibernate filter as a second line of defense, not the primary one. Every repository method — including relying on inherited ones — should take an explicit `organizationId`. Longer-term, consider Postgres RLS as a DB-level backstop, especially before any async/background job work is added.

---

## 4. RBAC Assessment

| Layer | Status |
|---|---|
| Backend permission model | Well-designed: 5 roles × 28 fine-grained permissions, `Permission.forRole()` mapping |
| Backend enforcement | **Disabled entirely** (`prePostEnabled=false` + `permitAll()` on nearly all routes) |
| Backend permission-name correctness | Broken for Groups, Teams (create/delete), Automation Rules — would fail even if re-enabled as-is |
| Frontend permission model | Defined (`CRM_ROLES`, `currentUserPermissions`) |
| Frontend enforcement | **Unused** — zero components reference it; only one hand-rolled `isAdmin()` check gates one action (editing another user's profile) |
| Frontend route protection | **None** — no guards exist at all |

**Net effect:** RBAC exists as data/config in both layers but enforces nothing anywhere in the stack today.

---

## 5. CRUD Completeness Matrix

| Module | Backend CRUD | Frontend wired to API | Frontend UI CRUD |
|---|---|---|---|
| Users | Full (+ soft delete) | **Live** | Full |
| Teams | Full | **Live** | Full |
| Groups | Full (group itself); messages/meetings are stubs | Read-only live; create/message/meeting local-only | Partial |
| Deals | Full | **Mock** (load never called) | Create/update/detail rich; no delete |
| Partners | Full | **Mock** | Create/partial-update; no delete method |
| Proposals | Full | **Mock**, starts empty | Create/update; no general delete |
| Purchase Orders | Full | **Mock**, starts empty | Create/update; no delete |
| Tasks | Full | **Mock** | Create/status-update; no delete |
| Tickets | Full | **Mock** (API methods exist, unused) | Create/update/delete (local only) |
| Invoices | Full | **Mock** | Create/status-update; no delete |
| Campaigns | Full | **Mock** | No service methods exist at all in `CrmStateService` |
| Automation Rules | CRUD only, no execution engine | **Mock** | Full CRUD (local only) |
| Organization | **Create-only** (no read/update/delete) | Read live; update doesn't persist (no backend endpoint) | Edit UI exists, silently no-ops |
| Notifications | Not implemented (model only) | **Mock**, nothing to call | Mark-read only |
| Files | Service implemented, **no controller** | Not integrated | Not integrated |

---

## 6. Remediation Plan

Phased so each phase is independently shippable and the app is never in a worse state than before.

### Phase 0 — Stop the bleeding (security, do first, before any other work)
1. Set `@EnableMethodSecurity(prePostEnabled = true)` in `SecurityConfig.java`.
2. Replace the `permitAll()` block with only what's genuinely public: `/auth/login`, `/auth/refresh`, `/organizations` (signup), `/actuator/health`, Swagger docs. Everything else → `anyRequest().authenticated()`.
3. Fix the three broken permission-name mismatches (`Permission.java` needs `GROUPS_*`, `TEAMS_CREATE`/`TEAMS_DELETE`, `AUTOMATION_RULES_*` or the controllers need to use the existing names) — test every role against every endpoint after re-enabling method security.
4. Remove the hardcoded JWT secret fallback — fail fast at startup if `JWT_SECRET` is unset (`@Value` with no default, or a `@PostConstruct` check).
5. Make `TenantFilterInterceptor` reject requests with no/invalid `org` claim (401/403) instead of defaulting to a fixed organization.
6. Fix `UserService.getUserById/updateUser/deactivateUser` to use `findByOrganizationIdAndId` like every other service.
7. Implement `AuthService.logout()` to actually revoke refresh tokens.
8. Re-enable rate limiting on `/auth/login` (fix the bucket4j dependency or swap to a maintained alternative — Resilience4j's `RateLimiter`, or a simple Redis-backed token bucket given Redis is already in the stack).

*Exit criteria: an unauthenticated `curl` against any business endpoint returns 401; every role's actual permitted actions match the intended permission matrix.*

### Phase 1 — Make the frontend actually live
1. Call the existing `load*()` methods (`loadDeals`, `loadPartners`, `loadTasks`, `loadTickets`, `loadInvoices`, `loadPurchaseOrders`, `loadCampaigns`, `loadAutomationRules`, `loadProposals`) from the appropriate page `ngOnInit`/constructor, alongside the existing eager-load pattern.
2. Route all local-only mutators (`addDeal`, `updatePartner`, `addTicket`, etc.) through the already-implemented `ApiService` methods instead of pure signal mutation.
3. Add a minimal loading/error state to each page (spinner while fetching, visible banner on failure) — currently failures are invisible (`console.warn` + silent stale data).
4. Fix the base-URL duplication: single source of truth in `environment.ts` (add real environment files), consumed by both `api-config.ts` and `api.service.ts`.
5. Add a `FileController` backend endpoint to expose the already-built `LocalFileStorageService`, then wire attachment upload in the frontend.
6. Add read/update to `OrganizationController` so org-settings edits can actually persist.

*Exit criteria: killing the backend causes every page to show a visible error state, not silently-fine mock data — proof the app is actually calling the API.*

### Phase 2 — Close CRUD gaps
1. Add missing delete endpoints/UI for Deals, Partners, Tasks, Invoices, Purchase Orders (backend already has DELETE; frontend just needs to call it).
2. Add Campaign CRUD methods to `CrmStateService`/`ApiService` (currently entirely missing on the frontend).
3. Add pagination to every list view beyond the one partner sub-tab that already has it.
4. Decide per orphaned entity (Notifications, CreditNote, RecoveryReminder, ProposalTemplate, TicketType, Partner sub-entities, AutomationExecutionLog/DomainEvent/WebhookSubscription, Group messaging/meetings): **build it or delete the model+migration**. Silent stubs that return fake success are actively worse than a 404.

### Phase 3 — Harden architecture (SOLID / consistency)
1. Backend: introduce request/response DTOs for the 9 modules currently binding entities directly (`Deal`, `Task`, `Ticket`, `Invoice`, `Campaign`, `Proposal`, `PurchaseOrder`, `AutomationRule`, `Team`, `Group`), add Bean Validation to each.
2. Backend: add `@ExceptionHandler`s for `IllegalArgumentException`/`IllegalStateException` mapping to correct 400/401/409 responses instead of falling through to 500.
3. Backend: fix `AuditingConfig`/`JwtAuthFilter` mismatch so `createdBy`/`updatedBy` actually populate (either make the JWT principal a `UserDetails`, or change the `AuditorAware` check to work with the `String` principal already in use).
4. Frontend: split the 4,771-line `CrmStateService` into per-domain services (DealsService, PartnersService, TicketsService, ...), each owning its own signal + API calls — stop components (`sales.component.ts` in particular) from reaching directly into other services' signals.
5. Frontend: consolidate on one HTTP-client pattern (`BaseApiService`'s timeout/retry/error-normalization) instead of the two competing ones.
6. Frontend: add real route guards (`canActivate`) instead of the single template-level auth `@if`, and actually wire `currentUserPermissions` into UI gating (hide/disable actions by role) and route protection.
7. Frontend: replace the fake Google login with a real OAuth flow, or remove the button if out of scope.

### Phase 4 — Polish / follow-through
- Remove `.bak` files once rate limiting is properly reinstated (don't leave dead alternate implementations in the tree).
- Remove the unused `@google/genai` dependency, or scope and build the AI feature it implies.
- Turn off `org.springframework.security: DEBUG` logging outside local dev.
- Add Postgres Row-Level Security as a DB-level backstop for tenancy once any async/background job work begins.

---

## 7. Suggested Sequencing

Phase 0 is non-negotiable and should land before anything else — right now the API has no real access control. Phase 1 and Phase 2 can run in parallel workstreams (frontend-focused vs. backend-CRUD-focused) once Phase 0 is merged, since Phase 1 mostly consumes endpoints that already exist. Phase 3 is a larger refactor best done module-by-module rather than as one big-bang change, ideally as each module gets touched for Phase 1/2 work anyway. Phase 4 is cleanup that can be picked up opportunistically.
