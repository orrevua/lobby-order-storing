# Multi-Tenancy Condominiums — Spec

**Status:** Draft
**Date:** 2026-06-15
**Related:** `docs/specs/clean-architecture-spec.md`, `docs/HANDOFF.md`
**Supersedes:** Current single-tenant data model

## Goal

Restructure the system around condominiums as the top-level tenant boundary. Every apartment, resident, package, and withdrawal session belongs to exactly one condominium. Portaria users manage their own condominium. Morador users sign up via invite links scoped to a specific condominium and can only manage residents they created.

## Context & Current State

### Data Model (no tenant scoping)
- `apartamentos` table has `(numero, bloco)` unique constraint — `docs/schema.sql:9`
- `moradores` has `apartamento_id` FK and `created_by` UUID — `docs/schema.sql:16`, `docs/schema.sql:91`
- `encomendas` has `morador_id` FK — `docs/schema.sql:24`
- `withdrawal_sessions` has `apartamento_id` FK — `docs/schema.sql:43`

### Auth
- Roles stored in `app_metadata.role` as `'porteiro'` or `'morador'` — `src/lib/actions/auth.ts:16`
- Middleware allows all paths for porteiro, restricts morador to `/cadastro/moradores` and `/cadastro/apartamentos` — `src/middleware.ts:7-8`
- Signup page lets user self-select role — `src/app/(public)/signup/page.tsx:77-86` (must be removed)

### Architecture
- Clean arch: entities (`src/domain/entities/`) -> repository interfaces (`src/domain/repositories/`) -> Supabase implementations (`src/infrastructure/supabase/`) -> use cases (`src/application/use-cases/`) -> server actions (`src/lib/actions/`) -> pages
- Composition root at `src/infrastructure/supabase/repositories.ts` — singleton instances using `supabaseAdmin`
- All DB access through `supabaseAdmin` (service role) — `src/infrastructure/supabase/admin.ts:6`
- `getServerUser()` reads auth from cookies — `src/infrastructure/supabase/server.ts:4`
- `ActionResult<T>` pattern for server actions — `src/lib/types.ts:1`

### Queries are NOT scoped
- `apartmentRepository.list()` returns ALL apartments — `src/infrastructure/supabase/apartamento-repository.ts:28`
- `residentRepository.list()` returns ALL residents — `src/infrastructure/supabase/morador-repository.ts:53`
- `packageRepository.listPending()` returns ALL pending packages — `src/infrastructure/supabase/encomenda-repository.ts:64`
- Only resident listing has partial scoping: `listByUser` filters by `created_by` for morador role — `src/app/(app)/cadastro/moradores/page.tsx:14`

## Proposed Design

### 1. New `condominios` Table

```
condominios (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(200) NOT NULL,
  address    TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
)
```

UUID primary key for consistency with auth IDs and future scalability.

### 2. New `invite_tokens` Table

```
invite_tokens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id   UUID NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
  token           VARCHAR(64) NOT NULL UNIQUE,
  created_by      UUID NOT NULL,         -- portaria user who created it
  expires_at      TIMESTAMPTZ,           -- NULL = never expires
  max_uses        INT,                   -- NULL = unlimited
  use_count       INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now()
)
```

Tokens are random 32-byte hex strings. The portaria user generates them, and the resulting link is `/signup?token=<token>`. When a morador signs up via this link, the token's `condominio_id` is written into their `app_metadata.condominio_id`.

### 3. Schema Migration for `apartamentos`

Add `condominio_id UUID REFERENCES condominios(id) ON DELETE CASCADE` to `apartamentos`.
Change unique constraint from `(numero, bloco)` to `(condominio_id, numero, bloco)`.

### 4. User Metadata Changes

- `app_metadata.role`: `'porteiro'` or `'morador'` (unchanged name)
- `app_metadata.condominio_id`: UUID — set at signup time
- Portaria users: set when they create their condominium (or at signup if we create it inline)
- Morador users: set from the invite token's `condominio_id`

**Decision:** Portaria signup will create a condominium inline. The signup flow becomes:
- `/signup` (no token) = portaria signup: collects email, password, condominium name/address. Creates condominium + user in one action.
- `/signup?token=<token>` = morador signup: collects email, password only. Condominium is derived from token.

### 5. Tenant Scoping Strategy

All repository methods that list/query data will accept `condominioId` as a required parameter. This is enforced at the use-case level — every use case that touches tenant data must receive the condominio ID (extracted from the authenticated user's `app_metadata`).

**Why at the use-case level, not repository level?** Repositories stay generic (testable, reusable). The use case is the policy layer that enforces "you can only see your condominium's data." This matches the existing pattern where use cases receive the repository as a parameter.

For tables that don't have a direct `condominio_id` column (moradores, encomendas, withdrawal_sessions), scoping flows through joins:
- `moradores` -> `apartamento_id` -> `apartamentos.condominio_id`
- `encomendas` -> `morador_id` -> `moradores.apartamento_id` -> `apartamentos.condominio_id`
- `withdrawal_sessions` -> `apartamento_id` -> `apartamentos.condominio_id`

**Optimization:** Add `condominio_id` directly to `moradores` as a denormalized FK to avoid joins on every query. Apartments can change, but a resident's condominium does not. This avoids N+1 joins and simplifies RLS if we add it later.

### 6. Role-Based Access (Updated)

| Capability | porteiro | morador |
|---|---|---|
| Sidebar: Portaria | Yes | No |
| Sidebar: Consulta | Yes | No |
| Sidebar: Cadastro > Apartamentos | Yes | No |
| Sidebar: Cadastro > Moradores | Yes | Yes |
| Create/edit/delete apartments | Yes | No |
| Create residents | Yes | Yes |
| Edit/delete residents | All in condo | Only own (`created_by`) |
| Register/manage packages | Yes | No |
| Manage withdrawals | Yes | No |
| Generate invite links | Yes | No |

**Change from current:** Morador loses access to `/cadastro/apartamentos` (currently allowed at `src/middleware.ts:8`). They only see Moradores.

### 7. Invite Link Flow

1. Portaria user goes to a new "Convites" section (or a button in settings)
2. Server action generates a cryptographic token, stores it in `invite_tokens`
3. UI shows the full URL: `{BASE_URL}/signup?token={token}`
4. Portaria can copy the link
5. When morador visits the link, signup page reads the token, validates it, shows simplified form (email + password only)
6. On submit, server action: validates token, creates user with `app_metadata: { role: 'morador', condominio_id: token.condominio_id }`, increments `use_count`

### 8. Portaria Signup Flow (New)

The current signup page (`src/app/(public)/signup/page.tsx`) lets users self-select roles. This is replaced:
- Without token: portaria signup form (email, password, condo name, condo address)
- With valid token: morador signup form (email, password only)
- With invalid/expired token: error message

### 9. Condominium Entity & Repository

New domain entity and repository following existing patterns.

## Scope

### In scope
- `condominios` table, entity, repository, use cases
- `invite_tokens` table, entity, repository, use cases
- Schema migration: `apartamentos` + `moradores` get `condominio_id`
- All existing queries scoped by `condominio_id`
- New signup flows (portaria with condo creation, morador with token)
- Middleware updates for new role permissions
- Sidebar updates (morador sees only Moradores)
- Server action updates to extract and pass `condominio_id`
- Invite management UI for portaria

### Out of scope (explicitly)
- RLS policies at the database level (using application-level scoping for now since all access goes through `supabaseAdmin`)
- Condominium settings/profile page
- Multiple condominiums per portaria user
- Invite token revocation UI (can be added later)
- Email notifications for invites
- Migration of existing data (fresh start assumed; production migration can be a follow-up)

## Interfaces / Models / Endpoints

### New Entity: `Condominium`
```typescript
// src/domain/entities/condominium.ts
type Condominium = {
  id: string;        // UUID
  name: string;
  address: string | null;
  createdAt: string;
};
```

### New Entity: `InviteToken`
```typescript
// src/domain/entities/invite-token.ts
type InviteToken = {
  id: string;        // UUID
  condominioId: string;
  token: string;
  createdBy: string; // UUID
  expiresAt: string | null;
  maxUses: number | null;
  useCount: number;
  createdAt: string;
};
```

### Updated Entity: `Apartamento`
```typescript
// src/domain/entities/apartamento.ts — add condominioId
type Apartamento = {
  id: number;
  condominioId: string;  // NEW
  numero: string;
  bloco: string;
  createdAt: string;
};
```

### Updated Entity: `Morador`
```typescript
// src/domain/entities/morador.ts — add condominioId
type Morador = {
  id: number;
  condominioId: string;  // NEW (denormalized)
  nome: string;
  contato: string | null;
  cpf: string | null;
  signatureUrl: string | null;
  apartamentoId: number | null;
  createdBy: string | null;
  createdAt: string;
};
```

### New Repository: `CondominiumRepository`
```typescript
interface CondominiumRepository {
  findById(id: string): Promise<Condominium | null>;
  create(data: { name: string; address: string | null }): Promise<Condominium>;
}
```

### New Repository: `InviteTokenRepository`
```typescript
interface InviteTokenRepository {
  findByToken(token: string): Promise<InviteToken | null>;
  listByCondominium(condominioId: string): Promise<InviteToken[]>;
  create(data: { condominioId: string; token: string; createdBy: string; expiresAt: string | null; maxUses: number | null }): Promise<InviteToken>;
  incrementUseCount(id: string): Promise<void>;
}
```

### Updated Repository: `ApartamentoRepository`
```typescript
interface ApartamentoRepository {
  list(condominioId: string): Promise<Apartamento[]>;                    // CHANGED: added param
  findById(id: number): Promise<Apartamento | null>;                     // unchanged
  create(data: CreateApartmentInput): Promise<Apartamento>;              // input gains condominioId
  update(id: number, data: UpdateApartmentInput): Promise<Apartamento>;  // unchanged
  delete(id: number): Promise<void>;                                     // unchanged
}

type CreateApartmentInput = {
  condominioId: string;  // NEW
  numero: string;
  bloco: string;
};
```

### Updated Repository: `MoradorRepository`
```typescript
interface MoradorRepository {
  list(condominioId: string): Promise<(Morador & { apartamento: Apartamento | null })[]>;           // CHANGED
  listByUser(userId: string): Promise<(Morador & { apartamento: Apartamento | null })[]>;           // unchanged (already scoped by user)
  listByApartment(apartamentoId: number): Promise<Morador[]>;                                        // unchanged
  findById(id: number): Promise<Morador | null>;                                                     // unchanged
  create(data: CreateResidentInput): Promise<Morador>;                                               // input gains condominioId
  update(id: number, data: UpdateResidentInput): Promise<Morador>;                                   // unchanged
  delete(id: number): Promise<void>;                                                                 // unchanged
}

type CreateResidentInput = {
  condominioId: string;  // NEW
  nome: string;
  contato: string | null;
  cpf: string | null;
  signatureUrl: string | null;
  apartamentoId: number;
  createdBy: string | null;
};
```

### Updated Repository: `EncomendaRepository`
- `listPending(condominioId: string, apartamentoId?: number)` — CHANGED: mandatory condominio param
- `search(condominioId: string, filters: SearchFilters)` — CHANGED: mandatory condominio param
- `register`, `markWithdrawn`, `markDelivered` — unchanged (operate on specific IDs)

### Updated Repository: `WithdrawalSessionRepository`
- All listing/creation methods scoped by condominio via the `apartamento_id` join

### New Server Actions
- `signUpPortaria(email, password, condoName, condoAddress)` — creates condominium + user
- `signUpMorador(email, password, token)` — validates token, creates user with condominium
- `generateInviteToken(expiresAt?, maxUses?)` — creates invite token for current user's condo
- `listInviteTokens()` — lists tokens for current user's condo

### New Route
- `/signup?token=...` — existing route, but page logic changes based on token presence
- `/convites` or `/cadastro/convites` — invite management (portaria only)

### Helper: `getServerUserWithCondo`
Extend `getServerUser()` pattern to also return `condominioId` from `app_metadata`:
```typescript
async function getServerUserWithCondo(): Promise<{ userId: string; role: string; condominioId: string } | null>
```
This becomes the standard way to extract tenant context in server actions and pages.

## Impact Analysis

### Tests
- No existing test suite found. Testing is out of scope but the architecture supports it (repository interfaces can be mocked).

### Dependencies / Layers Affected
- **Schema**: 2 new tables, 2 altered tables
- **Domain entities**: 2 new, 2 modified
- **Domain repositories**: 2 new interfaces, 3 modified interfaces
- **Infrastructure**: 2 new Supabase repos, 3 modified repos
- **Use cases**: All existing use cases that list data need condominio param; new use cases for invites and condo creation
- **Server actions**: All existing actions need to extract condominio from user; new actions for signup/invites
- **Pages**: Signup page rewritten; moradores/apartamentos pages pass condominio; portaria/consulta pages pass condominio
- **Middleware**: Update morador allowed paths (remove apartamentos)
- **Sidebar**: Update morador nav (remove apartamentos)
- **Composition root**: Add new repository singletons

### Backward Compatibility
- **Breaking for existing data.** Existing apartments/residents have no `condominio_id`. A migration script would be needed for production. This spec assumes fresh DB or manual data migration.
- **Breaking for existing users.** Existing users have no `condominio_id` in `app_metadata`. They will need to be manually updated or re-created.

### Security
- All tenant isolation is application-level (through `supabaseAdmin`). No RLS. This is acceptable because all DB access goes through server actions, never client-side Supabase queries.
- Invite tokens use `crypto.randomBytes(32).toString('hex')` for 256-bit entropy.
- Token validation checks: exists, not expired, use_count < max_uses.

### Performance
- Adding `condominio_id` to `apartamentos` and `moradores` with indexes ensures scoped queries don't degrade.
- Denormalizing `condominio_id` on `moradores` avoids joins for resident listing.

## Implementation Units

### Phase 1: Schema & Domain Foundation

**Unit 1 — SQL migration: new tables and altered columns**
- Files: `docs/schema.sql`
- Change: Add `condominios` table, `invite_tokens` table, `ALTER apartamentos ADD condominio_id`, `ALTER moradores ADD condominio_id`, update unique constraint on apartamentos to include `condominio_id`, add indexes
- Acceptance: SQL can be run on a fresh Supabase project without errors

**Unit 2 — Condominium domain entity**
- Files: `src/domain/entities/condominium.ts`, `src/domain/entities/index.ts`
- Change: Create `Condominium` type, export from index
- Acceptance: Type is importable from `@/domain/entities`

**Unit 3 — InviteToken domain entity**
- Files: `src/domain/entities/invite-token.ts`, `src/domain/entities/index.ts`
- Change: Create `InviteToken` type, export from index
- Acceptance: Type is importable from `@/domain/entities`

**Unit 4 — Update Apartamento entity**
- Files: `src/domain/entities/apartamento.ts`
- Change: Add `condominioId: string` field
- Acceptance: Type includes `condominioId`

**Unit 5 — Update Morador entity**
- Files: `src/domain/entities/morador.ts`
- Change: Add `condominioId: string` field
- Acceptance: Type includes `condominioId`

### Phase 2: Repository Interfaces

**Unit 6 — CondominiumRepository interface**
- Files: `src/domain/repositories/condominium-repository.ts`, `src/domain/repositories/index.ts`
- Change: Create interface with `findById`, `create` methods. Export from index.
- Acceptance: Interface is importable

**Unit 7 — InviteTokenRepository interface**
- Files: `src/domain/repositories/invite-token-repository.ts`, `src/domain/repositories/index.ts`
- Change: Create interface with `findByToken`, `listByCondominium`, `create`, `incrementUseCount`. Export from index.
- Acceptance: Interface is importable

**Unit 8 — Update ApartamentoRepository interface**
- Files: `src/domain/repositories/apartamento-repository.ts`
- Change: `list()` becomes `list(condominioId: string)`. `CreateApartmentInput` gains `condominioId: string`.
- Acceptance: Interface compiles with new signatures

**Unit 9 — Update MoradorRepository interface**
- Files: `src/domain/repositories/morador-repository.ts`
- Change: `list()` becomes `list(condominioId: string)`. `CreateResidentInput` gains `condominioId: string`.
- Acceptance: Interface compiles with new signatures

**Unit 10 — Update EncomendaRepository interface**
- Files: `src/domain/repositories/encomenda-repository.ts`
- Change: `listPending(apartamentoId?)` becomes `listPending(condominioId: string, apartamentoId?: number)`. `search(filters)` becomes `search(condominioId: string, filters)`.
- Acceptance: Interface compiles with new signatures

### Phase 3: Infrastructure — New Repositories

**Unit 11 — Supabase CondominiumRepository implementation**
- Files: `src/infrastructure/supabase/condominium-repository.ts`
- Change: Implement `CondominiumRepository` with Supabase queries, including row mapping (snake_case -> camelCase)
- Acceptance: `findById` and `create` work against `condominios` table

**Unit 12 — Supabase InviteTokenRepository implementation**
- Files: `src/infrastructure/supabase/invite-token-repository.ts`
- Change: Implement `InviteTokenRepository` with Supabase queries
- Acceptance: All four methods work against `invite_tokens` table

**Unit 13 — Register new repos in composition root**
- Files: `src/infrastructure/supabase/repositories.ts`
- Change: Import and instantiate `SupabaseCondominiumRepository` and `SupabaseInviteTokenRepository`, export as singletons
- Acceptance: `condominiumRepository` and `inviteTokenRepository` are importable from the composition root

### Phase 4: Infrastructure — Update Existing Repositories

**Unit 14 — Update SupabaseApartamentoRepository**
- Files: `src/infrastructure/supabase/apartamento-repository.ts`
- Change: `list(condominioId)` adds `.eq('condominio_id', condominioId)` filter. `create` inserts `condominio_id`. `toDomain` maps `condominio_id` -> `condominioId`. Update `ApartamentoRow` type.
- Acceptance: list filters by condominio, create stores condominio_id

**Unit 15 — Update SupabaseMoradorRepository**
- Files: `src/infrastructure/supabase/morador-repository.ts`
- Change: `list(condominioId)` adds `.eq('condominio_id', condominioId)` filter. `create` inserts `condominio_id`. `toDomain` maps `condominio_id` -> `condominioId`. Update `MoradorRow` type.
- Acceptance: list filters by condominio, create stores condominio_id

**Unit 16 — Update SupabaseEncomendaRepository**
- Files: `src/infrastructure/supabase/encomenda-repository.ts`
- Change: `listPending(condominioId, apartamentoId?)` joins through `moradores.condominio_id` to filter. `search(condominioId, filters)` similarly scoped. Update `mapJoined` to include `condominioId` in morador mapping.
- Acceptance: Both methods scope results to the given condominium

### Phase 5: Auth Helper

**Unit 17 — Create `getServerUserWithCondo` helper**
- Files: `src/infrastructure/supabase/server.ts`
- Change: Add `getServerUserWithCondo()` that returns `{ userId, role, condominioId }` or null. Uses existing `getServerUser` internally. Throws if user lacks `condominio_id` in metadata (shouldn't happen for properly created users).
- Acceptance: Returns structured user context with condominio ID

### Phase 6: Use Cases

**Unit 18 — Condominium use cases**
- Files: `src/application/use-cases/condominios/create-condominium.ts`
- Change: Validates name is non-empty, calls `repo.create()`
- Acceptance: Returns created condominium

**Unit 19 — Invite token use cases: generate**
- Files: `src/application/use-cases/invites/generate-invite.ts`
- Change: Generates cryptographic token, calls `repo.create()`. Uses `crypto.randomBytes(32).toString('hex')`.
- Acceptance: Returns created invite token with random token string

**Unit 20 — Invite token use cases: validate**
- Files: `src/application/use-cases/invites/validate-invite.ts`
- Change: Looks up token, checks expiry and use count, returns `{ valid: true, condominioId }` or `{ valid: false, reason }`.
- Acceptance: Correctly rejects expired/exhausted tokens, accepts valid ones

**Unit 21 — Update apartment use cases**
- Files: `src/application/use-cases/apartamentos/create-apartment.ts`, `src/application/use-cases/apartamentos/list-apartments.ts`
- Change: `createApartment` input gains `condominioId`. `listApartments` gains `condominioId` param passed to repo.
- Acceptance: Both use cases pass condominio through

**Unit 22 — Update resident use cases**
- Files: `src/application/use-cases/moradores/create-resident.ts`, `src/application/use-cases/moradores/list-residents.ts`
- Change: `createResident` input gains `condominioId`. `listResidents` gains `condominioId` param passed to repo.
- Acceptance: Both use cases pass condominio through

**Unit 23 — Update package use cases**
- Files: `src/application/use-cases/encomendas/list-pending.ts`, `src/application/use-cases/encomendas/search-packages.ts`
- Change: Both gain `condominioId` param passed to repo
- Acceptance: Both use cases pass condominio through

### Phase 7: Auth & Signup Server Actions

**Unit 24 — Portaria signup server action**
- Files: `src/lib/actions/auth.ts`
- Change: Replace existing `signUp` with `signUpPortaria(email, password, condoName, condoAddress)`. Creates condominium first, then creates user with `app_metadata: { role: 'porteiro', condominio_id: condo.id }`.
- Acceptance: Creates both condominium and user in one action

**Unit 25 — Morador signup server action**
- Files: `src/lib/actions/auth.ts`
- Change: Add `signUpMorador(email, password, token)`. Validates token via use case, creates user with `app_metadata: { role: 'morador', condominio_id: tokenData.condominioId }`, increments token use count.
- Acceptance: Creates user scoped to token's condominium, rejects invalid tokens

**Unit 26 — Invite management server actions**
- Files: `src/lib/actions/invites.ts`
- Change: `generateInvite(formData)` extracts user's condominio, generates token. `listInvites()` lists tokens for user's condominio.
- Acceptance: Both actions work with correct condominium scoping

### Phase 8: Signup UI

**Unit 27 — Rewrite signup page**
- Files: `src/app/(public)/signup/page.tsx`
- Change: Check URL for `token` query param. If present and valid: show morador form (email + password). If absent: show portaria form (email + password + condo name + condo address). If token invalid: show error.
- Acceptance: Both flows render correctly, invalid tokens show error

### Phase 9: Update Existing Server Actions for Tenant Scoping

**Unit 28 — Update apartment server actions**
- Files: `src/lib/actions/apartments.ts`
- Change: `createApartment` extracts `condominioId` from user via `getServerUserWithCondo`, passes to use case. `listApartments` (if called from actions) passes condominio.
- Acceptance: Apartments are created with condominio_id

**Unit 29 — Update resident server actions**
- Files: `src/lib/actions/residents.ts`
- Change: `createResident` extracts `condominioId` from user, passes to use case.
- Acceptance: Residents are created with condominio_id

**Unit 30 — Update package server actions**
- Files: `src/lib/actions/packages.ts`
- Change: All actions that list/search packages extract `condominioId` from user and pass to use cases.
- Acceptance: Package queries scoped by condominium

### Phase 10: Update Pages for Tenant Scoping

**Unit 31 — Update apartamentos page**
- Files: `src/app/(app)/cadastro/apartamentos/page.tsx`
- Change: Use `getServerUserWithCondo` to get condominio, pass to `listApartments(repo, condominioId)`. Hide form for morador role (though middleware should already block them).
- Acceptance: Page only shows apartments for user's condominium

**Unit 32 — Update moradores page**
- Files: `src/app/(app)/cadastro/moradores/page.tsx`
- Change: Use `getServerUserWithCondo` to get condominio, pass to `listApartments(repo, condominioId)` for the apartment dropdown and `listResidents(repo, condominioId)` for the list (porteiro) or keep `listByUser` (morador).
- Acceptance: Apartment dropdown and resident list scoped by condominium

**Unit 33 — Update portaria page**
- Files: `src/app/(app)/portaria/page.tsx`
- Change: Use `getServerUserWithCondo`, pass condominio to `listApartments` and `listPending`.
- Acceptance: Portaria page only shows data for user's condominium

**Unit 34 — Update consulta page**
- Files: `src/app/(app)/consulta/page.tsx`
- Change: Use `getServerUserWithCondo`, pass condominio to `listApartments` and package search.
- Acceptance: Search results scoped by condominium

### Phase 11: Middleware & Sidebar Updates

**Unit 35 — Update middleware role permissions**
- Files: `src/middleware.ts`
- Change: Morador allowed paths becomes `['/cadastro/moradores']` only (remove `/cadastro/apartamentos`). Add `/convites` to porteiro paths (or keep as unrestricted for porteiro).
- Acceptance: Morador is redirected when accessing `/cadastro/apartamentos`

**Unit 36 — Update sidebar navigation**
- Files: `src/components/layout/sidebar.tsx`
- Change: `MORADOR_NAV` only includes "Cadastro > Moradores" (remove Apartamentos). Add "Convites" item to `ALL_NAV` under Cadastro.
- Acceptance: Morador sees only Moradores. Porteiro sees Convites option.

### Phase 12: Invite Management UI

**Unit 37 — Invite management page**
- Files: `src/app/(app)/cadastro/convites/page.tsx`
- Change: Server component that lists existing invite tokens for the condominium. Shows token URL, use count, expiry. Has a "Generate New Link" button.
- Acceptance: Page renders with invite list

**Unit 38 — Invite generation form component**
- Files: `src/components/cadastro/invite-form.tsx`
- Change: Client component with optional expiry date and max uses inputs. Calls `generateInvite` server action. Shows the generated link with a copy button.
- Acceptance: Form submits and displays the new invite URL

### Phase 13: Home Page Redirect

**Unit 39 — Update home page redirect logic**
- Files: `src/app/(app)/page.tsx`
- Change: Porteiro redirects to `/portaria`, morador redirects to `/cadastro/moradores`.
- Acceptance: Each role lands on their primary page

## Open Questions

1. **Should withdrawal sessions get `condominio_id` directly?** Current design scopes them through `apartamento_id` join. Direct column would simplify queries but adds denormalization. **Decision: defer — current join through `apartamento_id` is sufficient given expected volumes.**

2. **Token-based signup link format:** Using `/signup?token=<token>`. Alternative: `/convite/<token>` as a dedicated route. **Decision: use query param on `/signup` — simpler, reuses existing route.**

3. **Should morador see apartment list read-only?** Current spec removes their access entirely. If needed, can add a read-only view later. **Decision: remove access for now, follow requirements exactly.**
