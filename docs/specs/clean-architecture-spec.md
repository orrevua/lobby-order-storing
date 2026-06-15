# Clean Architecture Restructure -- Spec

**Status:** Draft
**Date:** 2026-06-15
**Related:** Supersedes `docs/specs/lobby-order-tracking-spec.md` (which remains as historical reference for UI/feature requirements)

## Goal

Restructure the lobby package tracking system from a flat server-action-to-Supabase architecture into Clean Architecture layers (domain, application, infrastructure, presentation) so the codebase supports multi-tenancy, testability, auth integration, and future billing as a commercial product sold to multiple condominium lobbies.

## Context & Current State

The project is a Next.js 16 App Router application (TypeScript, Tailwind v4, Supabase JS client). The following is already implemented:

- **Types:** `src/lib/types.ts:1-45` -- all domain types (`Apartamento`, `Morador`, `Encomenda`, `EncomendaComMorador`, `SearchFilters`, `ActionResult`)
- **Supabase client:** `src/lib/supabase.ts:1-6` -- singleton `createClient` with service role key
- **Queries:** `src/lib/queries/apartamentos.ts:1-13` -- `listarApartamentos()` calling Supabase directly
- **Actions:** `src/lib/actions/apartamentos.ts:1-73` -- `criarApartamento`, `atualizarApartamento`, `excluirApartamento` as server actions calling Supabase directly
- **Layout:** `src/app/layout.tsx`, `src/components/layout/sidebar.tsx`, `src/components/layout/page-header.tsx` -- sidebar navigation shell
- **Pages:** Root redirect (`src/app/page.tsx`), cadastro redirect (`src/app/cadastro/page.tsx`), apartamentos page (`src/app/cadastro/apartamentos/page.tsx`)
- **Components:** `src/components/cadastro/apartamento-form.tsx`, `src/components/cadastro/apartamento-list.tsx`
- **Schema:** `docs/schema.sql` -- 3 tables (apartamentos, moradores, encomendas)

**Problem:** Server actions import Supabase directly. There is no separation between business rules and data access. This makes it impossible to swap persistence, add cross-cutting concerns (auth, logging, multi-tenancy), or unit test business logic without hitting Supabase.

## Proposed Design

### Architecture Layers

```
src/
  domain/           -- Enterprise Business Rules (pure TS, zero imports from frameworks)
    entities/       -- Domain type definitions
    repositories/   -- Repository interface types (ports)

  application/      -- Application Business Rules (use cases)
    use-cases/      -- Functions that orchestrate domain logic via repository ports
      apartamentos/
      moradores/
      encomendas/

  infrastructure/   -- Adapters (implementations of ports)
    supabase/       -- Supabase repository implementations
      client.ts
      apartamento-repository.ts
      morador-repository.ts
      encomenda-repository.ts

  app/              -- Next.js App Router (presentation/controller layer)
  components/       -- React components (presentation)
  lib/              -- Shared utilities (kept minimal)
```

**Dependency Rule:** Dependencies point inward only. Domain imports nothing. Application imports only domain. Infrastructure imports domain (to implement interfaces). Presentation (app/, components/) imports application and infrastructure (for DI wiring).

### Key Decisions

1. **Repository interfaces as TypeScript types** (not abstract classes). Interfaces live in `src/domain/repositories/`. Implementations live in `src/infrastructure/supabase/`. This is the simplest port/adapter pattern for TypeScript.

2. **Use cases as plain functions**, not classes. Each use case is an exported async function that receives a repository instance as its first argument. This avoids class ceremony and a DI container. Example: `criarApartamento(repo: ApartamentoRepository, data: CriarApartamentoInput): Promise<Apartamento>`.

3. **Factory functions for DI wiring.** A single file `src/infrastructure/supabase/repositories.ts` exports pre-wired repository instances. Server actions import from there. This is the composition root.

4. **Domain entities are the same types** currently in `src/lib/types.ts`, relocated to `src/domain/entities/`. The `ActionResult<T>` type stays in `src/lib/types.ts` as it is a presentation-layer concern (server action return shape).

5. **Server actions become thin controllers.** They parse FormData, call a use case with the concrete repository, call `revalidatePath`, and return `ActionResult`. Business validation moves into use cases.

6. **Incremental migration.** We restructure module by module (apartamentos first, then moradores, then encomendas) rather than a big-bang rewrite. Existing UI components remain largely untouched -- only their import paths for types change.

7. **`SearchFilters` stays in domain** since it represents a domain query concept, not a UI concern.

### Data Flow (after restructure)

```
[Browser]
  --> [Server Action] (parse FormData, call use case, revalidate, return ActionResult)
    --> [Use Case] (validate business rules, call repository port)
      --> [Supabase Repository] (translate to Supabase query, return domain entity)
```

For reads (Server Components):
```
[Server Component]
  --> [Use Case / Query function] (call repository port)
    --> [Supabase Repository] (Supabase query, return domain entity)
```

### Error Handling Strategy

- **Domain/Application layer:** Use cases throw typed errors or return `Result<T, E>` discriminated unions. For v1 simplicity, use cases will throw `Error` with descriptive messages. Future: introduce a `DomainError` hierarchy.
- **Infrastructure layer:** Catches Supabase errors and translates them to domain-meaningful errors (e.g., unique constraint violation becomes "Apartamento ja cadastrado").
- **Server actions:** Catch all errors from use cases and wrap them in `ActionResult`.

## Scope

### In scope
- Create domain entities directory with types extracted from `src/lib/types.ts`
- Create repository interface types in `src/domain/repositories/`
- Create Supabase repository implementations in `src/infrastructure/supabase/`
- Create use cases in `src/application/use-cases/`
- Refactor existing apartamento server actions to use the new layers
- Refactor existing apartamento queries to use the new layers
- Update all imports throughout existing components and pages
- Create moradores and encomendas domain + infrastructure + use-case layers (new code)
- Build remaining UI modules (moradores CRUD, portaria, consulta) using clean architecture from the start

### Out of scope (explicitly)
- Authentication / authorization (future spec)
- Multi-tenancy data isolation (future spec, but architecture supports it)
- DI container or framework
- Unit tests (separate spec; but this architecture makes them trivial to add)
- Abstract error types / DomainError hierarchy (future refinement)

## Interfaces / Models / Contracts

### Domain Entities (`src/domain/entities/`)

```typescript
// src/domain/entities/apartamento.ts
export type Apartamento = {
  id: number;
  numero: string;
  bloco: string;
  createdAt: string;  // Note: camelCase in domain, snake_case in DB
};

// src/domain/entities/morador.ts
export type Morador = {
  id: number;
  nome: string;
  contato: string | null;
  apartamentoId: number | null;
  createdAt: string;
};

// src/domain/entities/encomenda.ts
export type Encomenda = {
  id: number;
  codigoRastreio: string | null;
  descricao: string | null;
  status: 'pendente' | 'retirada';
  dataChegada: string;
  dataRetirada: string | null;
  moradorId: number;
  createdAt: string;
};

export type EncomendaComMorador = Encomenda & {
  morador: Morador & {
    apartamento: Apartamento | null;
  };
};

// src/domain/entities/search-filters.ts
export type SearchFilters = {
  dataInicio?: string;
  dataFim?: string;
  apartamentoId?: number;
  nomeMorador?: string;
  codigoRastreio?: string;
  page?: number;
  perPage?: number;
};

// src/domain/entities/index.ts -- barrel export
```

**Decision: camelCase in domain.** The current types use `snake_case` matching the DB columns (`apartamento_id`, `created_at`). Domain entities should use TypeScript-idiomatic `camelCase` (`apartamentoId`, `createdAt`). The Supabase repository is responsible for mapping between the two. This decouples the domain from the database schema.

### Repository Interfaces (`src/domain/repositories/`)

```typescript
// src/domain/repositories/apartamento-repository.ts
export interface ApartamentoRepository {
  listar(): Promise<Apartamento[]>;
  buscarPorId(id: number): Promise<Apartamento | null>;
  criar(data: CriarApartamentoInput): Promise<Apartamento>;
  atualizar(id: number, data: AtualizarApartamentoInput): Promise<Apartamento>;
  excluir(id: number): Promise<void>;
}

export type CriarApartamentoInput = {
  numero: string;
  bloco: string;
};

export type AtualizarApartamentoInput = {
  numero: string;
  bloco: string;
};

// src/domain/repositories/morador-repository.ts
export interface MoradorRepository {
  listar(): Promise<(Morador & { apartamento: Apartamento | null })[]>;
  listarPorApartamento(apartamentoId: number): Promise<Morador[]>;
  buscarPorId(id: number): Promise<Morador | null>;
  criar(data: CriarMoradorInput): Promise<Morador>;
  atualizar(id: number, data: AtualizarMoradorInput): Promise<Morador>;
  excluir(id: number): Promise<void>;
}

export type CriarMoradorInput = {
  nome: string;
  contato: string | null;
  apartamentoId: number;
};

export type AtualizarMoradorInput = {
  nome: string;
  contato: string | null;
  apartamentoId: number;
};

// src/domain/repositories/encomenda-repository.ts
export interface EncomendaRepository {
  listarPendentes(apartamentoId?: number): Promise<EncomendaComMorador[]>;
  buscar(filters: SearchFilters): Promise<{ data: EncomendaComMorador[]; total: number }>;
  registrar(data: RegistrarEncomendaInput): Promise<Encomenda>;
  marcarRetirada(id: number): Promise<Encomenda>;
}

export type RegistrarEncomendaInput = {
  moradorId: number;
  codigoRastreio: string | null;
  descricao: string | null;
};
```

### Use Cases (`src/application/use-cases/`)

Each use case is a standalone async function. Signature pattern:

```typescript
// src/application/use-cases/apartamentos/criar-apartamento.ts
export async function criarApartamento(
  repo: ApartamentoRepository,
  data: CriarApartamentoInput
): Promise<Apartamento> {
  // Validate business rules
  if (!data.numero.trim() || !data.bloco.trim()) {
    throw new Error('Numero e bloco sao obrigatorios.');
  }
  return repo.criar(data);
}
```

Full use case list:

| File | Function | Responsibility |
|---|---|---|
| `apartamentos/listar-apartamentos.ts` | `listarApartamentos(repo)` | Delegates to `repo.listar()` |
| `apartamentos/criar-apartamento.ts` | `criarApartamento(repo, data)` | Validates numero+bloco non-empty, calls `repo.criar()` |
| `apartamentos/atualizar-apartamento.ts` | `atualizarApartamento(repo, id, data)` | Validates, calls `repo.atualizar()` |
| `apartamentos/excluir-apartamento.ts` | `excluirApartamento(repo, id)` | Calls `repo.excluir()` |
| `moradores/listar-moradores.ts` | `listarMoradores(repo)` | Delegates to `repo.listar()` |
| `moradores/listar-moradores-por-apartamento.ts` | `listarMoradoresPorApartamento(repo, aptId)` | Delegates to `repo.listarPorApartamento()` |
| `moradores/criar-morador.ts` | `criarMorador(repo, data)` | Validates nome non-empty, calls `repo.criar()` |
| `moradores/atualizar-morador.ts` | `atualizarMorador(repo, id, data)` | Validates, calls `repo.atualizar()` |
| `moradores/excluir-morador.ts` | `excluirMorador(repo, id)` | Calls `repo.excluir()` |
| `encomendas/listar-pendentes.ts` | `listarPendentes(repo, aptId?)` | Delegates to `repo.listarPendentes()` |
| `encomendas/buscar-encomendas.ts` | `buscarEncomendas(repo, filters)` | Delegates to `repo.buscar()` |
| `encomendas/registrar-encomenda.ts` | `registrarEncomenda(repo, data)` | Validates moradorId present, calls `repo.registrar()` |
| `encomendas/marcar-retirada.ts` | `marcarRetirada(repo, id)` | Calls `repo.marcarRetirada()` |

### Composition Root (`src/infrastructure/supabase/repositories.ts`)

```typescript
// Instantiates concrete repositories. This is the only file that knows about both
// the Supabase client and the repository implementations.
import { supabaseClient } from './client';
import { SupabaseApartamentoRepository } from './apartamento-repository';
import { SupabaseMoradorRepository } from './morador-repository';
import { SupabaseEncomendaRepository } from './encomenda-repository';

export const apartamentoRepository = new SupabaseApartamentoRepository(supabaseClient);
export const moradorRepository = new SupabaseMoradorRepository(supabaseClient);
export const encomendaRepository = new SupabaseEncomendaRepository(supabaseClient);
```

### Server Actions (refactored pattern)

```typescript
// src/lib/actions/apartamentos.ts (after refactoring)
'use server';
import { revalidatePath } from 'next/cache';
import { apartamentoRepository } from '@/infrastructure/supabase/repositories';
import { criarApartamento as criarApartamentoUC } from '@/application/use-cases/apartamentos/criar-apartamento';
import type { ActionResult } from '@/lib/types';
import type { Apartamento } from '@/domain/entities/apartamento';

export async function criarApartamento(formData: FormData): Promise<ActionResult<Apartamento>> {
  const numero = formData.get('numero')?.toString().trim() ?? '';
  const bloco = formData.get('bloco')?.toString().trim() ?? '';
  try {
    const data = await criarApartamentoUC(apartamentoRepository, { numero, bloco });
    revalidatePath('/cadastro/apartamentos');
    return { success: true, data };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Erro desconhecido.' };
  }
}
```

### File Inventory After Restructure

```
src/
  domain/
    entities/
      apartamento.ts
      morador.ts
      encomenda.ts
      search-filters.ts
      index.ts
    repositories/
      apartamento-repository.ts
      morador-repository.ts
      encomenda-repository.ts
      index.ts

  application/
    use-cases/
      apartamentos/
        listar-apartamentos.ts
        criar-apartamento.ts
        atualizar-apartamento.ts
        excluir-apartamento.ts
      moradores/
        listar-moradores.ts
        listar-moradores-por-apartamento.ts
        criar-morador.ts
        atualizar-morador.ts
        excluir-morador.ts
      encomendas/
        listar-pendentes.ts
        buscar-encomendas.ts
        registrar-encomenda.ts
        marcar-retirada.ts

  infrastructure/
    supabase/
      client.ts              (moved from src/lib/supabase.ts)
      apartamento-repository.ts
      morador-repository.ts
      encomenda-repository.ts
      repositories.ts        (composition root)

  app/                       (unchanged structure)
  components/                (unchanged structure, import paths updated)
  lib/
    types.ts                 (keeps only ActionResult<T>)
    actions/
      apartamentos.ts        (refactored to thin controller)
      moradores.ts           (new)
      encomendas.ts          (new)
```

**Deleted after migration:** `src/lib/queries/` directory (queries become use cases calling repositories).

## Impact Analysis

- **Existing UI components:** `apartamento-form.tsx` and `apartamento-list.tsx` import from `@/lib/types` and `@/lib/actions/apartamentos`. The `types` import path changes to `@/domain/entities`. The `actions` import path stays the same (actions still live in `src/lib/actions/`). The `Apartamento` type changes field names from `snake_case` to `camelCase`, so component references like `apt.bloco`, `apt.numero` stay the same (those fields have no underscores), but `apt.created_at` becomes `apt.createdAt`.
- **Server action signatures:** Unchanged externally (`FormData` in, `ActionResult` out). Internal implementation changes.
- **Queries file:** `src/lib/queries/apartamentos.ts` is deleted. The page at `src/app/cadastro/apartamentos/page.tsx:1` currently calls `listarApartamentos()` from queries. This changes to importing from use cases or calling the use case with the repository.
- **No new dependencies.** Pure TypeScript restructuring.
- **No schema changes.** Database and SQL remain identical.
- **No migration steps.** This is a code-only restructure.

## Implementation Units

### Phase 1 -- Domain Layer

**Unit 1: Domain entities**
- Files: `src/domain/entities/apartamento.ts`, `src/domain/entities/morador.ts`, `src/domain/entities/encomenda.ts`, `src/domain/entities/search-filters.ts`, `src/domain/entities/index.ts`
- Change: Create the 5 files with the domain entity types as defined in the Interfaces section. All types use camelCase field names. The barrel `index.ts` re-exports everything.
- Acceptance: Files compile with `npx tsc --noEmit`. No imports from any external package. `index.ts` exports `Apartamento`, `Morador`, `Encomenda`, `EncomendaComMorador`, `SearchFilters`.

**Unit 2: Repository interfaces**
- Files: `src/domain/repositories/apartamento-repository.ts`, `src/domain/repositories/morador-repository.ts`, `src/domain/repositories/encomenda-repository.ts`, `src/domain/repositories/index.ts`
- Change: Create the 4 files with repository interfaces and input types as defined in the Interfaces section. Each file imports entity types from `../entities`. The barrel re-exports all interfaces and input types.
- Acceptance: Files compile. Only imports are from `../entities` (domain-internal).

### Phase 2 -- Infrastructure Layer (Apartamentos)

**Unit 3: Supabase client relocation**
- Files: `src/infrastructure/supabase/client.ts`
- Change: Create this file with the same Supabase client setup currently in `src/lib/supabase.ts`. Export `supabaseClient` (renamed from `supabase` for clarity).
- Acceptance: File compiles. Exports a `SupabaseClient` instance.

**Unit 4: Supabase apartamento repository**
- Files: `src/infrastructure/supabase/apartamento-repository.ts`
- Change: Create a class `SupabaseApartamentoRepository` implementing `ApartamentoRepository`. Constructor receives the Supabase client. Each method maps between DB snake_case rows and domain camelCase entities. Translates Supabase errors (23505 -> "Este apartamento ja esta cadastrado", 23503 -> "Nao e possivel excluir: existem moradores vinculados").
- Acceptance: File compiles. Implements all 5 methods of the interface. Has snake-to-camel mapping logic.

**Unit 5: Composition root (apartamentos only)**
- Files: `src/infrastructure/supabase/repositories.ts`
- Change: Create file that imports `supabaseClient` from `./client` and `SupabaseApartamentoRepository` from `./apartamento-repository`. Exports `apartamentoRepository` singleton instance. (Morador and encomenda repositories will be added in later units.)
- Acceptance: File compiles. Exports `apartamentoRepository` typed as `ApartamentoRepository`.

### Phase 3 -- Application Layer (Apartamentos)

**Unit 6: Apartamento use cases**
- Files: `src/application/use-cases/apartamentos/listar-apartamentos.ts`, `src/application/use-cases/apartamentos/criar-apartamento.ts`, `src/application/use-cases/apartamentos/atualizar-apartamento.ts`, `src/application/use-cases/apartamentos/excluir-apartamento.ts`
- Change: Create 4 use case files. `listarApartamentos` delegates to `repo.listar()`. `criarApartamento` validates numero+bloco non-empty then calls `repo.criar()`. `atualizarApartamento` validates then calls `repo.atualizar()`. `excluirApartamento` calls `repo.excluir()`. Each function takes the repository interface as first parameter.
- Acceptance: Files compile. Business validation logic is in use cases, not in repository or action layer. Each file is under 20 LOC.

### Phase 4 -- Refactor Existing Apartamento Code

**Unit 7: Refactor apartamento server actions**
- Files: `src/lib/actions/apartamentos.ts`
- Change: Rewrite the 3 server actions to be thin controllers. Each parses FormData, calls the corresponding use case with `apartamentoRepository` from the composition root, wraps result in `ActionResult`, and calls `revalidatePath`. Remove direct Supabase imports. All business validation is now in use cases; all DB access is now in repository.
- Acceptance: File compiles. No imports from `@supabase/supabase-js`. Imports use cases + composition root + `ActionResult` only.

**Unit 8: Update apartamento queries to use case**
- Files: `src/app/cadastro/apartamentos/page.tsx`, delete `src/lib/queries/apartamentos.ts`
- Change: The page currently calls `listarApartamentos()` from `@/lib/queries/apartamentos`. Change it to import `listarApartamentos` use case and `apartamentoRepository`, calling `listarApartamentos(apartamentoRepository)`. Delete the old queries file.
- Acceptance: Page compiles. The old `src/lib/queries/apartamentos.ts` is deleted. Page renders the same data.

**Unit 9: Update type imports in existing components**
- Files: `src/components/cadastro/apartamento-list.tsx`, `src/components/cadastro/apartamento-form.tsx`, `src/lib/types.ts`
- Change: Update the two components to import `Apartamento` from `@/domain/entities` instead of `@/lib/types`. Update `src/lib/types.ts` to remove the domain types (`Apartamento`, `Morador`, `Encomenda`, `EncomendaComMorador`, `SearchFilters`) and keep only `ActionResult<T>`. If any component references `created_at`, update to `createdAt`.
- Acceptance: All files compile. `src/lib/types.ts` contains only `ActionResult`. Domain types are imported from `@/domain/entities` everywhere.

### Phase 5 -- Moradores (Full Stack)

**Unit 10: Supabase morador repository**
- Files: `src/infrastructure/supabase/morador-repository.ts`
- Change: Create `SupabaseMoradorRepository` implementing `MoradorRepository`. `listar()` fetches moradores with joined apartamento data (use Supabase `select('*, apartamento:apartamentos(*)')`). Maps snake_case to camelCase. Translates 23503 error for FK violation on delete.
- Acceptance: File compiles. Implements all 6 methods.

**Unit 11: Register morador repository in composition root**
- Files: `src/infrastructure/supabase/repositories.ts`
- Change: Add import and export for `moradorRepository`.
- Acceptance: File exports both `apartamentoRepository` and `moradorRepository`.

**Unit 12: Morador use cases**
- Files: `src/application/use-cases/moradores/listar-moradores.ts`, `src/application/use-cases/moradores/listar-moradores-por-apartamento.ts`, `src/application/use-cases/moradores/criar-morador.ts`, `src/application/use-cases/moradores/atualizar-morador.ts`, `src/application/use-cases/moradores/excluir-morador.ts`
- Change: Create 5 use case files. `criarMorador` validates nome non-empty and apartamentoId present. Others delegate to repository.
- Acceptance: Files compile. Each under 20 LOC.

**Unit 13: Morador server actions**
- Files: `src/lib/actions/moradores.ts`
- Change: Create server actions: `criarMorador`, `atualizarMorador`, `excluirMorador`. Same thin-controller pattern as apartamentos. Parse FormData, call use case with `moradorRepository`, revalidate `/cadastro/moradores`, return `ActionResult`.
- Acceptance: File compiles. No direct Supabase imports.

**Unit 14: Morador list page + component**
- Files: `src/app/cadastro/moradores/page.tsx`, `src/components/cadastro/morador-list.tsx`
- Change: Server Component page calls `listarMoradores(moradorRepository)`. Renders `MoradorList` with columns: Nome, Contato, Apartamento (Bloco + Numero), Acoes (Editar, Excluir). Empty state: "Nenhum morador cadastrado."
- Acceptance: Page renders at `/cadastro/moradores`. Imports from domain entities and use cases.

**Unit 15: Morador form component**
- Files: `src/components/cadastro/morador-form.tsx`
- Change: Client Component with fields: Nome (required), Contato (optional), Apartamento (select dropdown). Receives `apartamentos: Apartamento[]` as props. Create and edit modes. Submits via `criarMorador`/`atualizarMorador` server actions.
- Acceptance: Form creates/edits moradores. Dropdown shows "Bloco X - Apt Y" format.

**Unit 16: Wire morador form into page**
- Files: `src/app/cadastro/moradores/page.tsx`
- Change: Import `MoradorForm`, fetch `listarApartamentos(apartamentoRepository)` to pass as props. Replace placeholder with actual form.
- Acceptance: Complete morador CRUD flow works end-to-end.

### Phase 6 -- Encomendas (Full Stack)

**Unit 17: Supabase encomenda repository**
- Files: `src/infrastructure/supabase/encomenda-repository.ts`
- Change: Create `SupabaseEncomendaRepository` implementing `EncomendaRepository`. `listarPendentes` queries with status='pendente', joins morador+apartamento, orders by data_chegada DESC. `buscar` builds dynamic filters (date range, apartment, name ilike, tracking code ilike) with pagination. `registrar` inserts with status='pendente'. `marcarRetirada` updates status and data_retirada. All snake-to-camel mapping.
- Acceptance: File compiles. Implements all 4 methods. `buscar` returns `{ data, total }`.

**Unit 18: Register encomenda repository in composition root**
- Files: `src/infrastructure/supabase/repositories.ts`
- Change: Add import and export for `encomendaRepository`.
- Acceptance: File exports all 3 repositories.

**Unit 19: Encomenda use cases**
- Files: `src/application/use-cases/encomendas/listar-pendentes.ts`, `src/application/use-cases/encomendas/buscar-encomendas.ts`, `src/application/use-cases/encomendas/registrar-encomenda.ts`, `src/application/use-cases/encomendas/marcar-retirada.ts`
- Change: Create 4 use case files. `registrarEncomenda` validates moradorId is present. Others delegate.
- Acceptance: Files compile. Each under 20 LOC.

**Unit 20: Encomenda server actions**
- Files: `src/lib/actions/encomendas.ts`
- Change: Create server actions: `registrarEncomenda(formData)`, `marcarRetirada(id)`. Thin controllers calling use cases with `encomendaRepository`. Revalidate `/portaria`.
- Acceptance: File compiles. No direct Supabase imports.

### Phase 7 -- Portaria Module (UI)

**Unit 21: Portaria entry form**
- Files: `src/components/portaria/entry-form.tsx`
- Change: Client Component with cascade selects: Bloco dropdown (unique blocos from apartments) -> Apartamento dropdown (filtered) -> Morador dropdown (loaded via API route). Fields: Codigo de Rastreio (optional), Descricao (optional). Submits via `registrarEncomenda` server action.
- Acceptance: Cascade works. Package saves. Form clears on success.

**Unit 22: Moradores API route for cascade**
- Files: `src/app/api/moradores/route.ts`
- Change: GET endpoint accepting `?apartamento_id=N`. Calls `listarMoradoresPorApartamento` use case with `moradorRepository`. Returns JSON array.
- Acceptance: `GET /api/moradores?apartamento_id=1` returns residents JSON.

**Unit 23: Pending packages list**
- Files: `src/components/portaria/pending-list.tsx`
- Change: Component showing pending packages table: Morador, Apartamento (Bloco + Apt), Codigo Rastreio, Descricao, Data Chegada (dd/MM/yyyy HH:mm), Acao ("Marcar Retirada" button). Button calls `marcarRetirada` server action.
- Acceptance: Pending packages display. Marking retirada removes from list.

**Unit 24: Portaria page assembly**
- Files: `src/app/portaria/page.tsx`
- Change: Server Component composing PageHeader + EntryForm + PendingList. Fetches apartments and pending packages via use cases with repositories.
- Acceptance: `/portaria` shows entry form and pending list. Full register-and-pickup flow works.

### Phase 8 -- Consulta Module (UI)

**Unit 25: Search filters component**
- Files: `src/components/consulta/search-filters.tsx`
- Change: Client Component with filter fields: Data Inicio, Data Fim, Apartamento (select), Nome do Morador, Codigo de Rastreio. Submits as URL search params. "Limpar" resets.
- Acceptance: Filters appear as query params in URL.

**Unit 26: Search results table**
- Files: `src/components/consulta/results-table.tsx`
- Change: Component displaying results: Morador, Apartamento, Codigo Rastreio, Descricao, Data Chegada, Data Retirada, Status (badge: green="Retirada", yellow="Pendente"). Pagination controls.
- Acceptance: Table renders. Status badges correct. Pagination works.

**Unit 27: Consulta page assembly**
- Files: `src/app/consulta/page.tsx`
- Change: Server Component reading searchParams, calling `buscarEncomendas` use case with `encomendaRepository`. Renders SearchFilters + ResultsTable.
- Acceptance: `/consulta` shows filters and results. Filtering and pagination work.

### Phase 9 -- Cleanup

**Unit 28: Delete legacy files and final cleanup**
- Files: delete `src/lib/supabase.ts`, delete `src/lib/queries/` directory (if any remaining files)
- Change: Remove the old Supabase client file (superseded by `src/infrastructure/supabase/client.ts`). Remove any remaining query files. Verify no file imports from deleted paths.
- Acceptance: `npx tsc --noEmit` passes. No imports reference `@/lib/supabase` or `@/lib/queries/`.

**Unit 29: Loading states and error component**
- Files: `src/app/portaria/loading.tsx`, `src/app/consulta/loading.tsx`, `src/app/cadastro/apartamentos/loading.tsx`, `src/app/cadastro/moradores/loading.tsx`, `src/components/ui/error-message.tsx`
- Change: Add skeleton loading screens for each route. Create reusable `ErrorMessage` component. Ensure all server actions surface errors in UI.
- Acceptance: Loading states appear during navigation. Errors display in pt-BR.

**Unit 30: Responsive polish and empty states**
- Files: Various component files (minor tweaks)
- Change: Audit for mobile responsiveness. Horizontal scroll on tables. Empty state messages in pt-BR. App title in sidebar.
- Acceptance: Usable on tablet and mobile. No broken layouts.

## Open Questions

1. **camelCase vs snake_case in domain types.** Decision made: domain uses camelCase; infrastructure maps. This adds ~5 lines of mapping per repository method but fully decouples domain from DB schema. If this proves too verbose, we can revisit with a generic mapper utility.

2. **Error handling granularity.** For v1, use cases throw plain `Error`. If the product grows to need error codes for the frontend (e.g., distinguishing validation errors from conflict errors), introduce a `DomainError` class hierarchy in a follow-up spec.

3. **Where do server actions live?** Decision: keep in `src/lib/actions/` (not colocated in `src/app/`). This matches the existing pattern and keeps actions shareable across routes. The actions themselves are thin and only bridge FormData to use cases.
