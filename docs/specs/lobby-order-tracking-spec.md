# Lobby Order/Package Tracking System — Spec

**Status:** Approved
**Date:** 2026-06-15
**Related:** None (greenfield project)

## Goal

Provide doormen at Brazilian residential buildings with a fast, searchable web app for logging package arrivals and pickups, eliminating the need to double-write in a physical notebook. The system must support long-term storage and audit queries spanning months/years.

## Context & Current State

This is a greenfield repository (`lobby-order-storing`) with no existing code. The repo is empty aside from `.git/`.

## Proposed Design

### Architecture

**Next.js App Router** (TypeScript) with Server Actions for data mutations and Server Components for data fetching. No separate API layer — Next.js server actions talk directly to Supabase via the JS client. This is the simplest viable architecture for a single-user-class CRUD app.

```
Browser
  |
  v
Next.js App Router (Vercel)
  ├── Server Components (reads)
  └── Server Actions (writes)
        |
        v
  Supabase JS Client
        |
        v
  Supabase PostgreSQL (free tier)
```

**Why this over alternatives:**
- No REST/GraphQL API to maintain — Server Actions are typed end-to-end.
- Server Components eliminate client-side data fetching boilerplate.
- Supabase JS client is simpler than Prisma/Drizzle for this scale.
- Free deployment on Vercel pairs naturally with Next.js.

### Route Structure

```
/                     → Redirect to /portaria
/portaria             → Doorman quick-entry + pending list
/consulta             → Search & history with filters
/cadastro             → Admin: apartments & residents CRUD
/cadastro/apartamentos
/cadastro/moradores
```

### Key Design Decisions

1. **No auth initially.** This runs on a lobby computer behind a building network. Auth can be added later via Supabase Auth (the schema supports it).
2. **Server Actions for all mutations.** No client-side Supabase calls. This keeps the Supabase service key server-side only.
3. **Revalidation via `revalidatePath`.** After each mutation, revalidate the relevant page to refresh server component data.
4. **Pagination via offset/limit.** Simple and sufficient for the query patterns (date range, apartment, name, tracking code).
5. **All UI strings in pt-BR.** No i18n library — hardcoded Portuguese strings since this is a single-locale app.
6. **Status enum as string.** `encomendas.status` uses `'pendente'` and `'retirada'` (lowercase). Display labels map these to `'Pendente'` and `'Retirada'`.

## Scope

### In scope
- Project scaffolding (Next.js + Tailwind + Supabase client)
- Supabase schema (3 tables, indexes, constraints)
- Portaria module: quick package entry, pending list, mark-as-picked-up
- Consulta module: search/filter with pagination
- Cadastro module: CRUD for apartments and residents
- Vercel-ready deployment config

### Out of scope (explicitly)
- Authentication / authorization
- Notifications (push, email, SMS)
- Multi-building / multi-tenant support
- Mobile native app
- File uploads (photos of packages)
- Internationalization beyond pt-BR

## Data Model

Three tables as specified by the user. Reproduced here with clarifications:

### `apartamentos`
| Column | Type | Constraints |
|---|---|---|
| id | SERIAL | PK |
| numero | VARCHAR(10) | NOT NULL |
| bloco | VARCHAR(10) | NOT NULL |
| created_at | TIMESTAMPTZ | DEFAULT now() |
| | | UNIQUE(numero, bloco) |

### `moradores`
| Column | Type | Constraints |
|---|---|---|
| id | SERIAL | PK |
| nome | VARCHAR(150) | NOT NULL |
| contato | VARCHAR(50) | nullable |
| apartamento_id | INT | FK -> apartamentos(id) ON DELETE SET NULL |
| created_at | TIMESTAMPTZ | DEFAULT now() |

### `encomendas`
| Column | Type | Constraints |
|---|---|---|
| id | SERIAL | PK |
| codigo_rastreio | VARCHAR(100) | nullable |
| descricao | TEXT | nullable |
| status | VARCHAR(20) | DEFAULT 'pendente' |
| data_chegada | TIMESTAMPTZ | DEFAULT now() |
| data_retirada | TIMESTAMPTZ | nullable |
| morador_id | INT | FK -> moradores(id) ON DELETE RESTRICT |
| created_at | TIMESTAMPTZ | DEFAULT now() |

**Indexes:** `idx_encomendas_status`, `idx_encomendas_morador`, `idx_moradores_nome`

### TypeScript Types

```typescript
// src/lib/types.ts
type Apartamento = {
  id: number;
  numero: string;
  bloco: string;
  created_at: string;
};

type Morador = {
  id: number;
  nome: string;
  contato: string | null;
  apartamento_id: number | null;
  created_at: string;
};

type Encomenda = {
  id: number;
  codigo_rastreio: string | null;
  descricao: string | null;
  status: 'pendente' | 'retirada';
  data_chegada: string;
  data_retirada: string | null;
  morador_id: number;
  created_at: string;
};

// Joined type for display
type EncomendaComMorador = Encomenda & {
  morador: Morador & {
    apartamento: Apartamento | null;
  };
};
```

## Interfaces — Server Actions

All server actions live in `src/lib/actions/`. Each returns `{ success: true; data?: T }` or `{ success: false; error: string }`.

### Apartamento Actions (`src/lib/actions/apartamentos.ts`)
- `criarApartamento(formData: FormData): Promise<ActionResult<Apartamento>>`
- `atualizarApartamento(id: number, formData: FormData): Promise<ActionResult<Apartamento>>`
- `excluirApartamento(id: number): Promise<ActionResult<void>>`

### Morador Actions (`src/lib/actions/moradores.ts`)
- `criarMorador(formData: FormData): Promise<ActionResult<Morador>>`
- `atualizarMorador(id: number, formData: FormData): Promise<ActionResult<Morador>>`
- `excluirMorador(id: number): Promise<ActionResult<void>>`

### Encomenda Actions (`src/lib/actions/encomendas.ts`)
- `registrarEncomenda(formData: FormData): Promise<ActionResult<Encomenda>>`
- `marcarRetirada(id: number): Promise<ActionResult<Encomenda>>` — sets `status='retirada'`, `data_retirada=now()`

### Query Functions (`src/lib/queries/`)
These are async server-side functions called from Server Components:

- `listarApartamentos(): Promise<Apartamento[]>` — ordered by bloco, numero
- `listarMoradoresPorApartamento(apartamentoId: number): Promise<Morador[]>`
- `listarMoradores(): Promise<(Morador & { apartamento: Apartamento | null })[]>`
- `listarEncomendasPendentes(apartamentoId?: number): Promise<EncomendaComMorador[]>`
- `buscarEncomendas(filters: SearchFilters): Promise<{ data: EncomendaComMorador[]; total: number }>`

```typescript
type SearchFilters = {
  dataInicio?: string;   // ISO date
  dataFim?: string;      // ISO date
  apartamentoId?: number;
  nomeMorador?: string;  // partial match, case-insensitive
  codigoRastreio?: string;
  page?: number;         // default 1
  perPage?: number;      // default 20
};
```

## Component Tree

```
src/
├── app/
│   ├── layout.tsx              — Shell: sidebar nav + content area
│   ├── page.tsx                — Redirect to /portaria
│   ├── portaria/
│   │   └── page.tsx            — Server Component: pending list + entry form
│   ├── consulta/
│   │   └── page.tsx            — Server Component: search filters + results table
│   └── cadastro/
│       ├── page.tsx            — Redirect to /cadastro/apartamentos
│       ├── apartamentos/
│       │   └── page.tsx        — CRUD list + form
│       └── moradores/
│           └── page.tsx        — CRUD list + form
├── components/
│   ├── layout/
│   │   ├── sidebar.tsx         — Navigation sidebar
│   │   └── page-header.tsx     — Page title + optional actions
│   ├── portaria/
│   │   ├── entry-form.tsx      — Client Component: block→apt→resident cascade + save
│   │   └── pending-list.tsx    — Server Component: pending packages table
│   ├── consulta/
│   │   ├── search-filters.tsx  — Client Component: filter form
│   │   └── results-table.tsx   — Server Component: paginated results
│   └── cadastro/
│       ├── apartamento-form.tsx— Client Component: create/edit apartment
│       ├── apartamento-list.tsx— Server Component: apartment table
│       ├── morador-form.tsx    — Client Component: create/edit resident
│       └── morador-list.tsx    — Server Component: resident table
└── lib/
    ├── supabase.ts             — Supabase client singleton (server-side)
    ├── types.ts                — TypeScript types
    ├── actions/
    │   ├── apartamentos.ts
    │   ├── moradores.ts
    │   └── encomendas.ts
    └── queries/
        ├── apartamentos.ts
        ├── moradores.ts
        └── encomendas.ts
```

## Impact Analysis

- **Tests:** No existing tests. Unit tests for server actions and query functions should be added per module. Testing strategy: Vitest for unit tests on action/query logic.
- **Dependencies:** `next`, `react`, `react-dom`, `typescript`, `tailwindcss`, `@supabase/supabase-js`, `postcss`, `autoprefixer`.
- **Migration:** The SQL schema must be run manually in Supabase Dashboard SQL Editor (no migration tool needed for this scale).
- **Security:** Supabase service key stays server-side only (env var `SUPABASE_SERVICE_ROLE_KEY`). No client-side Supabase access. Env var `NEXT_PUBLIC_SUPABASE_URL` is safe to expose (read-only awareness).
- **Performance:** ~500 records/day is trivial. Indexes on status, morador_id, and nome cover all query patterns. Pagination prevents large result sets.
- **Failure modes:** Supabase downtime = app is down (acceptable for this scale). All actions return error objects; UI displays toast/inline errors.

## Implementation Units

### Phase 0 — Project Scaffolding

**Unit 1: Initialize Next.js project**
- Files: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`, `src/app/globals.css`, `src/app/layout.tsx`
- Change: Run `npx create-next-app@latest` with App Router + TypeScript + Tailwind + src directory. Configure default font to Inter. Set `<html lang="pt-BR">`.
- Acceptance: `npm run dev` starts without errors. Browser shows default Next.js page in pt-BR.

**Unit 2: Supabase client setup + types**
- Files: `src/lib/supabase.ts`, `src/lib/types.ts`, `.env.local.example`
- Change: Create server-side Supabase client using `createClient` with `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Define all TypeScript types (`Apartamento`, `Morador`, `Encomenda`, `EncomendaComMorador`, `SearchFilters`, `ActionResult<T>`). Create `.env.local.example` with placeholder values.
- Acceptance: Types compile. Supabase client module exports a `supabase` instance. No runtime errors on import.

**Unit 3: Database schema SQL**
- Files: `docs/schema.sql`
- Change: Write the complete SQL schema (3 tables, constraints, indexes) as a single file ready to paste into Supabase SQL Editor. Include comments explaining each table.
- Acceptance: SQL is syntactically valid and matches the data model section of this spec.

### Phase 1 — Layout Shell

**Unit 4: Root layout + sidebar navigation**
- Files: `src/app/layout.tsx` (modify), `src/components/layout/sidebar.tsx`, `src/components/layout/page-header.tsx`
- Change: Create a responsive layout with a left sidebar containing nav links: Portaria, Consulta, Cadastro (with sub-links Apartamentos, Moradores). Use Tailwind. Sidebar highlights active route. Mobile: collapsible sidebar. Page header component accepts `title` and optional `children` (action buttons).
- Acceptance: All nav links render. Active route is visually highlighted. Layout is responsive.

**Unit 5: Root page redirect**
- Files: `src/app/page.tsx`
- Change: Redirect `/` to `/portaria` using Next.js `redirect()`.
- Acceptance: Navigating to `/` lands on `/portaria`.

### Phase 2 — Cadastro Module (Apartments)

**Unit 6: Apartment queries**
- Files: `src/lib/queries/apartamentos.ts`
- Change: Implement `listarApartamentos()` — fetches all apartments ordered by `bloco ASC, numero ASC`.
- Acceptance: Function returns typed `Apartamento[]`. Handles empty result and Supabase errors.

**Unit 7: Apartment actions**
- Files: `src/lib/actions/apartamentos.ts`
- Change: Implement `criarApartamento`, `atualizarApartamento`, `excluirApartamento` server actions. Validate: `numero` and `bloco` required, non-empty. Use `revalidatePath('/cadastro/apartamentos')`.
- Acceptance: All three actions return `ActionResult`. Validation rejects empty fields. Duplicate (numero, bloco) returns an error message in pt-BR.

**Unit 8: Apartment list page**
- Files: `src/app/cadastro/apartamentos/page.tsx`, `src/components/cadastro/apartamento-list.tsx`
- Change: Server Component page that calls `listarApartamentos()` and renders a table with columns: Bloco, Numero, Acoes (Editar, Excluir). Empty state message: "Nenhum apartamento cadastrado."
- Acceptance: Page renders at `/cadastro/apartamentos`. Shows table or empty state. Delete button calls `excluirApartamento`.

**Unit 9: Apartment form**
- Files: `src/components/cadastro/apartamento-form.tsx`
- Change: Client Component (`'use client'`) with fields: Bloco (text), Numero (text). Supports create and edit modes (edit pre-fills values). Submits via server action. Shows inline validation errors. Success clears form (create) or shows success message (edit).
- Acceptance: Form creates new apartments. Form edits existing apartments. Validation errors display inline.

**Unit 10: Cadastro index redirect**
- Files: `src/app/cadastro/page.tsx`
- Change: Redirect `/cadastro` to `/cadastro/apartamentos`.
- Acceptance: Navigating to `/cadastro` lands on `/cadastro/apartamentos`.

### Phase 3 — Cadastro Module (Residents)

**Unit 11: Resident queries**
- Files: `src/lib/queries/moradores.ts`
- Change: Implement `listarMoradores()` — fetches all residents joined with their apartment, ordered by `nome ASC`. Implement `listarMoradoresPorApartamento(apartamentoId)`.
- Acceptance: Functions return correctly typed arrays with joined apartment data.

**Unit 12: Resident actions**
- Files: `src/lib/actions/moradores.ts`
- Change: Implement `criarMorador`, `atualizarMorador`, `excluirMorador`. Validate: `nome` required, `apartamento_id` required. Use `revalidatePath('/cadastro/moradores')`.
- Acceptance: All three actions work. Cannot delete a resident who has packages (ON DELETE RESTRICT handled gracefully with pt-BR error).

**Unit 13: Resident list page**
- Files: `src/app/cadastro/moradores/page.tsx`, `src/components/cadastro/morador-list.tsx`
- Change: Server Component page showing residents table: Nome, Contato, Apartamento (Bloco + Numero), Acoes. Empty state message.
- Acceptance: Page renders at `/cadastro/moradores`. Shows resident data with apartment info.

**Unit 14: Resident form**
- Files: `src/components/cadastro/morador-form.tsx`
- Change: Client Component with fields: Nome (text, required), Contato (text, optional), Apartamento (select dropdown populated from `listarApartamentos()`). Create and edit modes.
- Acceptance: Form creates/edits residents. Apartment dropdown shows "Bloco X - Apt Y" format.

### Phase 4 — Portaria Module

**Unit 15: Package entry queries**
- Files: `src/lib/queries/encomendas.ts`
- Change: Implement `listarEncomendasPendentes(apartamentoId?)` — fetches encomendas where `status='pendente'`, joined with morador and apartamento, ordered by `data_chegada DESC`. Optional filter by apartment.
- Acceptance: Returns `EncomendaComMorador[]` with correct joins.

**Unit 16: Package entry actions**
- Files: `src/lib/actions/encomendas.ts`
- Change: Implement `registrarEncomenda(formData)` — extracts `morador_id` (required), `codigo_rastreio` (optional), `descricao` (optional). Sets `status='pendente'`. Implement `marcarRetirada(id)` — sets `status='retirada'`, `data_retirada=new Date().toISOString()`. Both revalidate `/portaria`.
- Acceptance: Can register a package. Can mark it as picked up. Timestamp is recorded.

**Unit 17: Package entry form**
- Files: `src/components/portaria/entry-form.tsx`
- Change: Client Component with cascade selects: Bloco (select unique blocos) -> Apartamento (filtered by selected bloco) -> Morador (auto-populated from selected apartment). Fields: Codigo de Rastreio (text, optional), Descricao (text, optional). Submit calls `registrarEncomenda`. On success, clears form and shows confirmation. Fetches apartment/resident data client-side via a dedicated API route or passed as props from server component.
- Acceptance: Cascade select works: changing bloco filters apartments, changing apartment loads residents. Package saves correctly.

**Unit 18: Entry form data endpoint**
- Files: `src/app/api/moradores/route.ts`
- Change: GET endpoint that accepts `?apartamento_id=N` query param and returns `Morador[]` for that apartment. Used by the entry form's cascade select to dynamically load residents when apartment changes.
- Acceptance: `GET /api/moradores?apartamento_id=1` returns JSON array of residents.

**Unit 19: Pending packages list**
- Files: `src/components/portaria/pending-list.tsx`
- Change: Component (can be server or client) showing pending packages in a table: Morador, Apartamento (Bloco + Apt), Codigo Rastreio, Descricao, Data Chegada (formatted dd/MM/yyyy HH:mm), Acao ("Marcar Retirada" button). Button calls `marcarRetirada`. Optional apartment filter dropdown above the table.
- Acceptance: Pending packages display. "Marcar Retirada" updates status and removes from list after revalidation.

**Unit 20: Portaria page assembly**
- Files: `src/app/portaria/page.tsx`
- Change: Server Component that composes the page: PageHeader with title "Portaria", EntryForm (with apartments data passed as props), PendingList (with pending packages data). Fetches `listarApartamentos()` and `listarEncomendasPendentes()` at the server level.
- Acceptance: `/portaria` shows both the entry form and pending list. Full flow works: register package -> appears in pending -> mark as picked up -> disappears.

### Phase 5 — Consulta Module

**Unit 21: Search query function**
- Files: `src/lib/queries/encomendas.ts` (extend)
- Change: Implement `buscarEncomendas(filters: SearchFilters)` — builds a Supabase query dynamically based on provided filters: date range on `data_chegada`, apartment ID, partial name match (ilike), tracking code match (ilike). Returns paginated results with total count.
- Acceptance: Filters combine correctly. Pagination returns correct slice and total. Empty filters return all (paginated).

**Unit 22: Search filters component**
- Files: `src/components/consulta/search-filters.tsx`
- Change: Client Component with filter fields: Data Inicio (date input), Data Fim (date input), Apartamento (select), Nome do Morador (text), Codigo de Rastreio (text). "Buscar" button submits filters as URL search params (to keep Server Component pattern). "Limpar" button resets.
- Acceptance: Filters submit as query params. Clearing resets URL.

**Unit 23: Search results table**
- Files: `src/components/consulta/results-table.tsx`
- Change: Component displaying search results: Morador, Apartamento, Codigo Rastreio, Descricao, Data Chegada, Data Retirada, Status (badge: green for "Retirada", yellow for "Pendente"). Pagination controls (Anterior/Proximo) updating page query param.
- Acceptance: Table renders results. Status badge colors correct. Pagination navigates between pages.

**Unit 24: Consulta page assembly**
- Files: `src/app/consulta/page.tsx`
- Change: Server Component that reads `searchParams`, calls `buscarEncomendas(filters)`, and renders SearchFilters + ResultsTable. Passes apartments list to filter dropdown.
- Acceptance: `/consulta` shows filters and results. Applying filters updates results. Pagination works across filtered results.

### Phase 6 — Polish & Deploy

**Unit 25: Error handling & loading states**
- Files: `src/app/portaria/loading.tsx`, `src/app/consulta/loading.tsx`, `src/app/cadastro/apartamentos/loading.tsx`, `src/app/cadastro/moradores/loading.tsx`, `src/components/ui/error-message.tsx`
- Change: Add `loading.tsx` skeleton screens for each route. Create a reusable `ErrorMessage` component for displaying action errors. Ensure all server actions' error returns are surfaced in the UI.
- Acceptance: Loading states appear during navigation. Errors display clearly in pt-BR.

**Unit 26: Responsive polish & empty states**
- Files: Various component files (minor tweaks)
- Change: Audit all pages for mobile responsiveness. Ensure tables scroll horizontally on small screens. Verify all empty states have pt-BR messages. Add a simple app logo/title in sidebar header.
- Acceptance: App is usable on tablet (primary doorman device) and mobile. No broken layouts at any breakpoint.

**Unit 27: Environment & deployment config**
- Files: `.env.local.example` (update if needed), `README.md`
- Change: Create README with setup instructions (clone, env vars, run schema SQL in Supabase, npm install, npm run dev). Document Vercel deployment steps. List required env vars.
- Acceptance: A new developer can follow the README to set up and run the project locally.

## Open Questions

1. **Authentication:** Not in scope for v1, but the Supabase service role key is used server-side. If the app is exposed to the internet (Vercel deployment), anyone with the URL can access it. Consider adding basic HTTP auth or Supabase Auth in a fast-follow. **Decision for v1:** Accept this risk — the app stores no sensitive PII beyond names/phone numbers, and the URL can be kept semi-private.

2. **Bulk import:** Existing apartment/resident data may need to be bulk-imported. **Decision:** Out of scope for v1. Manual entry via Cadastro module or direct SQL insert into Supabase.

3. **Soft delete vs hard delete:** For apartments and residents. **Decision:** Hard delete for v1 (with FK constraints preventing deletion of residents with packages). Can add soft delete later if needed.
