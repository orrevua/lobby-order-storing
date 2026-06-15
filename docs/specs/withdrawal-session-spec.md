# Withdrawal Session (Sessao de Retirada) -- Spec

**Status:** Draft
**Date:** 2026-06-15
**Related:** `docs/specs/clean-architecture-spec.md` (extends), `docs/specs/lobby-order-tracking-spec.md` (historical)

## Goal

Replace the current direct "Marcar Retirada" button with a QR-code-based withdrawal confirmation flow where the resident scans a code and confirms pickup on their own phone, creating a verifiable audit trail. A manual fallback preserves the doorman's ability to confirm pickup when the resident cannot scan.

## Context & Current State

### Current withdrawal flow
The doorman clicks "Marcar Retirada" on the pending list (`src/components/portaria/pending-list.tsx:27-31`), which calls the `marcarRetirada` server action (`src/lib/actions/encomendas.ts:28-36`). This immediately sets `status='retirada'` and `data_retirada=now()` on the encomenda via `EncomendaRepository.marcarRetirada` (`src/infrastructure/supabase/encomenda-repository.ts:151-164`). There is no resident confirmation, no session concept, and no audit trail beyond the timestamp.

### Existing architecture layers
- **Domain entities:** `src/domain/entities/` -- `Encomenda` has `status: 'pendente' | 'retirada'` (`src/domain/entities/encomenda.ts:8`)
- **Repository interfaces:** `src/domain/repositories/encomenda-repository.ts` -- `marcarRetirada(id: number)` is the only withdrawal method
- **Infrastructure:** `src/infrastructure/supabase/encomenda-repository.ts` -- Supabase implementation
- **Composition root:** `src/infrastructure/supabase/repositories.ts` -- wires all 3 repositories
- **Use cases:** `src/application/use-cases/encomendas/marcar-retirada.ts` -- delegates to repo
- **Server actions:** `src/lib/actions/encomendas.ts` -- thin controller pattern
- **UI:** `src/components/portaria/pending-list.tsx` -- client component with per-row action buttons

### Supabase Realtime
The `@supabase/supabase-js` client (v2.108.1, `package.json:13`) supports Realtime subscriptions natively. No additional dependency needed. The current client (`src/infrastructure/supabase/client.ts`) uses the service role key, which is server-side only. The Realtime subscription on the doorman's tablet will need a **public anon key** client (`NEXT_PUBLIC_SUPABASE_ANON_KEY`) since it runs in the browser.

## Proposed Design

### New status value

Extend the `Encomenda.status` union from `'pendente' | 'retirada'` to `'pendente' | 'retirada' | 'entregue'`. The original `'retirada'` status is preserved for backward compatibility (existing records). New QR-confirmed withdrawals use `'entregue'`; manual confirmations also use `'entregue'`. The distinction between QR vs manual is captured in the `withdrawal_sessions` audit record, not in the status field.

**Decision: single new status `'entregue'`**. Having both `'retirada'` (legacy) and `'entregue'` (new) lets existing data remain valid without migration. All new withdrawals go through the session flow producing `'entregue'`. The UI treats both `'retirada'` and `'entregue'` as "delivered" for display purposes.

### Database schema additions

#### Table: `withdrawal_sessions`

```sql
CREATE TABLE withdrawal_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    apartamento_id INT NOT NULL REFERENCES apartamentos(id),
    encomenda_ids INT[] NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    -- status values: 'pending', 'confirmed', 'expired', 'cancelled'
    confirmation_method VARCHAR(20),
    -- 'qr_scan' | 'manual'
    manual_reason VARCHAR(50),
    -- reason code for manual confirmation (null when qr_scan)
    doorman_note TEXT,
    -- optional free-text note from doorman
    created_by TEXT,
    -- doorman identifier (future: auth user ID; for now: name/badge string)
    confirmed_by TEXT,
    -- who confirmed: 'resident' for QR, doorman identifier for manual
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    confirmed_at TIMESTAMPTZ,
    CONSTRAINT valid_encomenda_ids CHECK (array_length(encomenda_ids, 1) > 0)
);

CREATE INDEX idx_ws_status ON withdrawal_sessions(status);
CREATE INDEX idx_ws_apartamento ON withdrawal_sessions(apartamento_id);
CREATE INDEX idx_ws_expires ON withdrawal_sessions(expires_at) WHERE status = 'pending';
```

**Design decisions:**
- `encomenda_ids INT[]` uses a Postgres array rather than a junction table. This is simpler for the "batch of packages for one apartment" pattern and avoids a many-to-many table for what is essentially an immutable snapshot. The array is validated at the application layer to ensure all IDs exist and are `'pendente'`.
- `expires_at` is computed as `created_at + interval '5 minutes'` at session creation time. TTL logic is in the use case, not a DB trigger.
- No FK constraint on `encomenda_ids` array elements (Postgres limitation). The use case validates existence before insert.
- `confirmation_method` is set on confirmation, not on creation. A session starts method-agnostic.

#### Encomendas table changes

No schema migration needed. The `status` column is `VARCHAR(20)` (`docs/schema.sql:29`), so `'entregue'` fits without DDL changes. The `data_retirada` column continues to record the delivery timestamp regardless of method.

### Domain layer

#### New entity: `WithdrawalSession`

```typescript
// src/domain/entities/withdrawal-session.ts
export type WithdrawalSessionStatus = 'pending' | 'confirmed' | 'expired' | 'cancelled';
export type ConfirmationMethod = 'qr_scan' | 'manual';
export type ManualReason = 'sem_celular' | 'idoso' | 'portador_necessidades' | 'outro';

export type WithdrawalSession = {
  id: string;                          // UUID
  apartamentoId: number;
  encomendaIds: number[];
  status: WithdrawalSessionStatus;
  confirmationMethod: ConfirmationMethod | null;
  manualReason: ManualReason | null;
  doormanNote: string | null;
  createdBy: string | null;
  confirmedBy: string | null;
  createdAt: string;
  expiresAt: string;
  confirmedAt: string | null;
};
```

#### Updated entity: `Encomenda`

Add `'entregue'` to the status union:
```typescript
status: 'pendente' | 'retirada' | 'entregue';
```

#### New repository interface: `WithdrawalSessionRepository`

```typescript
// src/domain/repositories/withdrawal-session-repository.ts
export type CriarSessaoInput = {
  apartamentoId: number;
  encomendaIds: number[];
  expiresAt: string;           // ISO timestamp
  createdBy: string | null;
};

export type ConfirmarSessaoInput = {
  confirmationMethod: ConfirmationMethod;
  confirmedBy: string | null;
  manualReason?: ManualReason | null;
  doormanNote?: string | null;
};

export interface WithdrawalSessionRepository {
  criar(data: CriarSessaoInput): Promise<WithdrawalSession>;
  buscarPorId(id: string): Promise<WithdrawalSession | null>;
  confirmar(id: string, data: ConfirmarSessaoInput): Promise<WithdrawalSession>;
  cancelar(id: string): Promise<void>;
  expirarVencidas(): Promise<number>;  // returns count of expired sessions
}
```

#### Updated repository interface: `EncomendaRepository`

Add a new method for batch status update:
```typescript
marcarEntregue(ids: number[]): Promise<void>;
```

This method sets `status='entregue'` and `data_retirada=now()` on all provided encomenda IDs atomically.

### Application layer (use cases)

#### `criar-sessao-retirada.ts` -- Create Withdrawal Session

1. Receive `apartamentoId`, `encomendaIds`, `createdBy`
2. Validate: all encomenda IDs exist and have `status='pendente'`
3. Validate: all encomendas belong to moradores in the given apartment
4. Compute `expiresAt = now() + 5 minutes`
5. Create session via `WithdrawalSessionRepository.criar()`
6. Return the session (its `id` is the QR code payload)

#### `confirmar-retirada-qr.ts` -- Confirm Withdrawal via QR Scan

1. Receive `sessionId` (UUID from QR code URL)
2. Fetch session via `WithdrawalSessionRepository.buscarPorId()`
3. Validate: session exists
4. Validate: `session.status === 'pending'`
5. Validate: `new Date() < new Date(session.expiresAt)` (not expired)
6. Call `EncomendaRepository.marcarEntregue(session.encomendaIds)`
7. Call `WithdrawalSessionRepository.confirmar(id, { confirmationMethod: 'qr_scan', confirmedBy: 'resident' })`
8. Return the confirmed session

#### `confirmar-retirada-manual.ts` -- Manual Confirmation

1. Receive `sessionId`, `manualReason`, `doormanNote`, `confirmedBy` (doorman identifier)
2. Same validation as QR (exists, pending, not expired)
3. Call `EncomendaRepository.marcarEntregue(session.encomendaIds)`
4. Call `WithdrawalSessionRepository.confirmar(id, { confirmationMethod: 'manual', confirmedBy, manualReason, doormanNote })`
5. Return the confirmed session

**Alternative considered: manual confirmation without a session.** Rejected because having a session for both paths gives a uniform audit trail and prevents the doorman from marking arbitrary packages without the session selection step.

#### `buscar-sessao-retirada.ts` -- Get Session Details (for confirmation page)

1. Receive `sessionId`
2. Fetch session
3. If session not found or not `'pending'`, return descriptive error state
4. If expired (`now() > expiresAt`), mark as expired via repo, return expired state
5. Fetch the encomendas by IDs (with morador+apartamento joins) for display
6. Return session + encomenda details

#### `cancelar-sessao.ts` -- Cancel Session

1. Receive `sessionId`
2. Set status to `'cancelled'`
3. Used when doorman dismisses the QR screen before confirmation

### Presentation layer

#### API Routes

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/retirada/sessao` | POST | Server action (doorman) | Create a withdrawal session |
| `/api/retirada/[id]` | GET | Public (no auth) | Get session details for confirmation page |
| `/api/retirada/[id]/confirmar` | POST | Public (no auth) | Confirm withdrawal (QR scan) |
| `/api/retirada/[id]/manual` | POST | Server action (doorman) | Manual confirmation |
| `/api/retirada/[id]/cancelar` | POST | Server action (doorman) | Cancel session |

**Decision: use API routes for the public confirmation endpoints** (`GET /api/retirada/[id]`, `POST /api/retirada/[id]/confirmar`). These are called from the resident's phone browser, not from the doorman's app, so they cannot be server actions. The doorman-side operations use server actions for consistency with the rest of the codebase.

#### Pages

| Route | Purpose | Auth |
|---|---|---|
| `/retirada/[id]` | Resident confirmation page (scanned from QR) | Public, no login |

This page is a server component that fetches session details. If the session is valid, it renders the package list and a "Confirmar Retirada" button. If expired/consumed/not-found, it shows an appropriate message.

#### Portaria UI changes

The current `PendingList` component (`src/components/portaria/pending-list.tsx`) changes from per-row "Marcar Retirada" buttons to:
1. **Checkbox selection** per row (within same apartment grouping)
2. **"Gerar QR Code" button** that creates a session and shows the QR modal
3. **"Confirmacao Manual" button** as fallback

The pending list should group packages by apartment for easier batch selection.

#### QR Code Modal

A modal/overlay on the portaria page that:
- Displays a QR code encoding the URL `{APP_URL}/retirada/{session_id}`
- Shows a countdown timer (5 min TTL)
- Has a "Confirmacao Manual" fallback button
- Has a "Cancelar" button
- Listens to Supabase Realtime for `withdrawal_sessions` row changes
- When `status` changes to `'confirmed'`, dismisses the modal and shows success

#### Supabase Realtime subscription

The QR modal subscribes to Postgres changes on the `withdrawal_sessions` table filtered by the session's UUID. When the row updates to `status='confirmed'`, the modal auto-dismisses.

Implementation uses a browser-side Supabase client with the anon key:
```typescript
// src/infrastructure/supabase/browser-client.ts
import { createClient } from '@supabase/supabase-js';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
export const supabaseBrowser = createClient(supabaseUrl, anonKey);
```

**Supabase RLS requirement:** The `withdrawal_sessions` table needs a Row Level Security policy allowing `SELECT` for the anon role on rows matching the subscribed session ID. Without this, Realtime won't deliver the change event. The policy:
```sql
ALTER TABLE withdrawal_sessions ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read a specific session (needed for Realtime + public confirmation page)
CREATE POLICY "Public read withdrawal sessions"
  ON withdrawal_sessions FOR SELECT
  USING (true);

-- Only service role can insert/update/delete
CREATE POLICY "Service role manages withdrawal sessions"
  ON withdrawal_sessions FOR ALL
  USING (auth.role() = 'service_role');
```

**Realtime must be enabled** for the `withdrawal_sessions` table in Supabase Dashboard > Database > Replication.

### QR Code generation

Use a lightweight client-side QR library. Options: `qrcode` (npm, ~30KB) or `qrcode.react` (~10KB, React component). Decision: **`qrcode.react`** -- it is a single React component, zero config, works in the client component directly.

New dependency: `qrcode.react` (add to `package.json`).

### Data flow diagrams

#### QR Confirmation Flow
```
Doorman selects packages -> POST /api/retirada/sessao (create session)
  -> Returns session UUID
  -> QR modal renders QR code with URL /retirada/{uuid}
  -> Subscribes to Realtime on withdrawal_sessions.id = uuid

Resident scans QR -> Opens /retirada/{uuid} in phone browser
  -> Server component fetches session details (GET)
  -> Renders package list + confirm button
  -> Resident clicks confirm -> POST /api/retirada/{uuid}/confirmar
    -> Use case validates session (exists, pending, not expired)
    -> Marks encomendas as 'entregue'
    -> Marks session as 'confirmed'
    -> Returns success

Doorman's tablet receives Realtime update (status -> 'confirmed')
  -> QR modal auto-closes, success notification shown
  -> Page revalidates to refresh pending list
```

#### Manual Confirmation Flow
```
Doorman selects packages -> POST /api/retirada/sessao (create session)
  -> Returns session UUID
  -> QR modal renders (same as above)
  -> Doorman clicks "Confirmacao Manual" button
    -> Opens manual confirmation form (reason select + optional note)
    -> Server action POST /api/retirada/{uuid}/manual
      -> Same validation + marks entregue + marks session confirmed with method='manual'
    -> Modal closes, page revalidates
```

### Error handling

| Scenario | Behavior |
|---|---|
| Session not found (invalid UUID) | Confirmation page: "Sessao nao encontrada." |
| Session expired (TTL elapsed) | Confirmation page: "Sessao expirada. Solicite um novo QR code ao porteiro." |
| Session already confirmed | Confirmation page: "Retirada ja confirmada." with green checkmark |
| Session cancelled | Confirmation page: "Sessao cancelada pelo porteiro." |
| Encomenda already not pending at confirm time | Use case throws; atomic rollback; show error |
| Network failure during confirm | Standard error message; resident can retry (idempotency: if session is already confirmed, show success) |

### Security considerations

1. **No auth on confirmation page** -- by design. The session UUID is unguessable (UUIDv4, 122 bits of entropy). The URL is only exposed via QR code displayed on the doorman's tablet for 5 minutes.
2. **Single-use** -- once confirmed, the session cannot be confirmed again. The use case checks `status === 'pending'` before proceeding.
3. **TTL enforcement** -- 5-minute window. After expiry, the use case rejects confirmation. A background cleanup (`expirarVencidas`) can mark stale sessions as expired, but the primary guard is the timestamp check in the use case.
4. **No package IDs in URL** -- only the session UUID. Package IDs are stored server-side in the session record.
5. **RLS on withdrawal_sessions** -- anon can SELECT (needed for Realtime), but only service_role can mutate. The public confirmation POST goes through the Next.js API route which uses the service role client.
6. **Rate limiting** -- not in scope for v1 but the 5-minute TTL + single-use naturally limits abuse.

## Scope

### In scope
- `withdrawal_sessions` table DDL + RLS policies
- Domain entity `WithdrawalSession` + repository interface
- Supabase repository implementation for withdrawal sessions
- `marcarEntregue` batch method on `EncomendaRepository`
- 4 use cases (create session, confirm QR, confirm manual, get session details, cancel)
- API routes for public confirmation endpoints
- `/retirada/[id]` public confirmation page
- Updated `PendingList` with checkbox selection + apartment grouping
- QR code modal with Realtime subscription
- Manual confirmation form
- Browser-side Supabase client for Realtime
- `qrcode.react` dependency

### Out of scope (explicitly)
- Authentication/authorization (doorman identity is a free-text field for now)
- Background job to expire stale sessions (TTL check is in the use case)
- Push notifications to residents
- Session history/audit UI (data is stored; UI is a future spec)
- Changing existing `'retirada'` records to `'entregue'` (backward compatible)

## Interfaces / Models / Endpoints

### Domain entity: `WithdrawalSession`

See "Domain layer" section above for the full type definition.

### API: POST `/api/retirada/sessao`

**Request body (JSON):**
```typescript
{
  apartamentoId: number;
  encomendaIds: number[];
  createdBy?: string;  // doorman identifier
}
```

**Response 201:**
```typescript
{
  success: true;
  data: {
    sessionId: string;        // UUID
    expiresAt: string;        // ISO timestamp
    qrCodeUrl: string;        // full URL: {APP_URL}/retirada/{sessionId}
  }
}
```

**Response 400:** validation errors (no encomendas, wrong apartment, not pending)

### API: GET `/api/retirada/[id]`

**Response 200:**
```typescript
{
  status: 'pending' | 'confirmed' | 'expired' | 'cancelled';
  session: WithdrawalSession;        // when status is 'pending'
  encomendas: EncomendaComMorador[];  // when status is 'pending'
  message?: string;                   // human-readable for non-pending states
}
```

### API: POST `/api/retirada/[id]/confirmar`

**Request body:** empty (session ID is in the URL)

**Response 200:**
```typescript
{ success: true; message: 'Retirada confirmada com sucesso.' }
```

**Response 400/404/410:** error states (not found, expired, already confirmed)

### API: POST `/api/retirada/[id]/manual`

**Request body (JSON):**
```typescript
{
  manualReason: 'sem_celular' | 'idoso' | 'portador_necessidades' | 'outro';
  doormanNote?: string;
  confirmedBy: string;  // doorman identifier
}
```

**Response 200:**
```typescript
{ success: true; message: 'Retirada manual confirmada.' }
```

### API: POST `/api/retirada/[id]/cancelar`

**Request body:** empty

**Response 200:**
```typescript
{ success: true }
```

## Impact Analysis

- **Encomenda entity:** `status` union gains `'entregue'`. This affects `src/domain/entities/encomenda.ts:8`. All consumers of the `status` field (display badges in `src/components/consulta/results-table.tsx`, pending list filter in `src/infrastructure/supabase/encomenda-repository.ts:63`) must treat `'entregue'` correctly.
- **EncomendaRepository:** Gains `marcarEntregue(ids: number[])` method. The existing `marcarRetirada(id)` stays for backward compatibility but the portaria UI will no longer call it directly.
- **PendingList component:** Major rewrite -- from simple action buttons to checkbox selection + grouped layout + QR modal trigger. The current component (`src/components/portaria/pending-list.tsx`, 88 lines) will be replaced.
- **New dependency:** `qrcode.react` -- small, well-maintained, React-specific.
- **Environment variable:** `NEXT_PUBLIC_SUPABASE_ANON_KEY` must be added for the browser Realtime client.
- **Supabase configuration:** Realtime must be enabled for `withdrawal_sessions` table. RLS policies must be applied.
- **Backward compatibility:** Existing `'retirada'` records remain valid. The consulta/search module should display both `'retirada'` and `'entregue'` as delivered states.
- **No existing tests to break** (no test suite exists).

## Implementation Units

### Phase 1 -- Schema & Domain

**Unit 1: Withdrawal session SQL**
- Files: `docs/schema.sql` (append)
- Change: Add `withdrawal_sessions` table DDL, indexes, RLS policies, and Realtime replication note as a comment. Append to the existing schema file after the encomendas section.
- Acceptance: SQL is syntactically valid. Includes CREATE TABLE, indexes, RLS enable + policies.
- ~25 LOC

**Unit 2: WithdrawalSession domain entity**
- Files: `src/domain/entities/withdrawal-session.ts`, `src/domain/entities/index.ts` (update barrel)
- Change: Create the `WithdrawalSession` type, `WithdrawalSessionStatus`, `ConfirmationMethod`, and `ManualReason` types. Update barrel to re-export.
- Acceptance: `npx tsc --noEmit` passes. No external imports. Barrel exports the new types.
- ~25 LOC

**Unit 3: Update Encomenda status union**
- Files: `src/domain/entities/encomenda.ts`
- Change: Add `'entregue'` to the `Encomenda.status` type union: `'pendente' | 'retirada' | 'entregue'`.
- Acceptance: Type compiles. Single-line change.
- ~1 LOC change

**Unit 4: WithdrawalSession repository interface**
- Files: `src/domain/repositories/withdrawal-session-repository.ts`, `src/domain/repositories/index.ts` (update barrel)
- Change: Create the repository interface with `criar`, `buscarPorId`, `confirmar`, `cancelar`, `expirarVencidas` methods and the input types `CriarSessaoInput`, `ConfirmarSessaoInput`. Update barrel.
- Acceptance: Compiles. Imports only from `../entities`. Barrel re-exports.
- ~35 LOC

**Unit 5: Add `marcarEntregue` to EncomendaRepository**
- Files: `src/domain/repositories/encomenda-repository.ts`
- Change: Add `marcarEntregue(ids: number[]): Promise<void>` to the `EncomendaRepository` interface.
- Acceptance: Interface compiles (implementation will fail until Unit 7, expected).
- ~1 LOC change

### Phase 2 -- Infrastructure

**Unit 6: Supabase withdrawal session repository**
- Files: `src/infrastructure/supabase/withdrawal-session-repository.ts`
- Change: Create `SupabaseWithdrawalSessionRepository` implementing `WithdrawalSessionRepository`. Maps DB snake_case to domain camelCase. `criar` inserts row. `buscarPorId` selects by UUID. `confirmar` updates status + confirmation fields + confirmed_at. `cancelar` sets status='cancelled'. `expirarVencidas` updates pending sessions past expires_at to 'expired'.
- Acceptance: Compiles. All 5 methods implemented. Snake-to-camel mapping present.
- ~50 LOC

**Unit 7: Implement `marcarEntregue` in Supabase encomenda repository**
- Files: `src/infrastructure/supabase/encomenda-repository.ts`
- Change: Add `marcarEntregue(ids: number[])` method. Uses `.update({ status: 'entregue', data_retirada: new Date().toISOString() }).in('id', ids)`. Validates that the number of updated rows matches `ids.length` (throws if mismatch, indicating some IDs were invalid).
- Acceptance: Compiles. Method exists on the class.
- ~15 LOC

**Unit 8: Register withdrawal session repository in composition root**
- Files: `src/infrastructure/supabase/repositories.ts`
- Change: Import `SupabaseWithdrawalSessionRepository`, instantiate with `supabaseClient`, export as `withdrawalSessionRepository`.
- Acceptance: File exports 4 repositories. Compiles.
- ~5 LOC

**Unit 9: Browser Supabase client**
- Files: `src/infrastructure/supabase/browser-client.ts`
- Change: Create a browser-safe Supabase client using `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. This client is only used for Realtime subscriptions in client components.
- Acceptance: File compiles. Exports `supabaseBrowser`. Uses only `NEXT_PUBLIC_` env vars.
- ~5 LOC

### Phase 3 -- Use Cases

**Unit 10: `criar-sessao-retirada` use case**
- Files: `src/application/use-cases/retirada/criar-sessao-retirada.ts`
- Change: Validates encomendaIds non-empty; fetches pending encomendas to verify all exist, all are 'pendente', and all belong to moradores in the given apartment; computes expiresAt (now + 5 min); calls `WithdrawalSessionRepository.criar()`. Receives both `EncomendaRepository` and `WithdrawalSessionRepository` as parameters.
- Acceptance: Compiles. Throws on invalid encomenda IDs or wrong apartment. Returns created session.
- ~40 LOC

**Unit 11: `buscar-sessao-retirada` use case**
- Files: `src/application/use-cases/retirada/buscar-sessao-retirada.ts`
- Change: Fetches session by ID. If not found, returns `{ status: 'not_found' }`. If expired (now > expiresAt and status still pending), marks expired via repo and returns `{ status: 'expired' }`. If confirmed/cancelled, returns that status. If pending and valid, fetches encomendas details and returns `{ status: 'pending', session, encomendas }`.
- Acceptance: Compiles. Handles all 4 status states + not_found. Returns encomenda details for pending sessions.
- ~40 LOC

**Unit 12: `confirmar-retirada-qr` use case**
- Files: `src/application/use-cases/retirada/confirmar-retirada-qr.ts`
- Change: Fetches session, validates (exists, pending, not expired). Calls `encomendaRepo.marcarEntregue(session.encomendaIds)`. Calls `sessionRepo.confirmar(id, { confirmationMethod: 'qr_scan', confirmedBy: 'resident' })`. Returns confirmed session.
- Acceptance: Compiles. Throws descriptive errors for each failure mode.
- ~30 LOC

**Unit 13: `confirmar-retirada-manual` use case**
- Files: `src/application/use-cases/retirada/confirmar-retirada-manual.ts`
- Change: Same as QR but receives `manualReason`, `doormanNote`, `confirmedBy`. Calls `confirmar` with `confirmationMethod: 'manual'`.
- Acceptance: Compiles. Throws on missing reason or confirmedBy.
- ~30 LOC

**Unit 14: `cancelar-sessao` use case**
- Files: `src/application/use-cases/retirada/cancelar-sessao.ts`
- Change: Fetches session, validates status is 'pending', calls `sessionRepo.cancelar(id)`.
- Acceptance: Compiles. Throws if session not found or not pending.
- ~15 LOC

### Phase 4 -- API Routes

**Unit 15: POST `/api/retirada/sessao` route**
- Files: `src/app/api/retirada/sessao/route.ts`
- Change: Parse JSON body (`apartamentoId`, `encomendaIds`, `createdBy`). Call `criarSessaoRetirada` use case with both repositories from composition root. Return 201 with `{ success: true, data: { sessionId, expiresAt, qrCodeUrl } }` where `qrCodeUrl` is `${process.env.NEXT_PUBLIC_APP_URL}/retirada/${session.id}`. Handle errors with 400.
- Acceptance: Route responds to POST. Returns session data. Returns 400 on invalid input.
- ~30 LOC

**Unit 16: GET `/api/retirada/[id]` route**
- Files: `src/app/api/retirada/[id]/route.ts`
- Change: Extract `id` from params. Call `buscarSessaoRetirada` use case. Return session details with appropriate status. Use 200 for all cases (status is in the body).
- Acceptance: Route responds to GET. Returns different payloads based on session state.
- ~25 LOC

**Unit 17: POST `/api/retirada/[id]/confirmar` route**
- Files: `src/app/api/retirada/[id]/confirmar/route.ts`
- Change: Extract `id` from params. Call `confirmarRetiradaQr` use case. Return 200 on success. Return 404/410/409 for not-found/expired/already-confirmed.
- Acceptance: Route responds to POST. Correctly maps error types to HTTP status codes.
- ~25 LOC

**Unit 18: POST `/api/retirada/[id]/manual` route**
- Files: `src/app/api/retirada/[id]/manual/route.ts`
- Change: Parse JSON body (`manualReason`, `doormanNote`, `confirmedBy`). Call `confirmarRetiradaManual` use case. Return 200 on success.
- Acceptance: Route responds to POST. Validates required fields.
- ~25 LOC

**Unit 19: POST `/api/retirada/[id]/cancelar` route**
- Files: `src/app/api/retirada/[id]/cancelar/route.ts`
- Change: Extract `id`. Call `cancelarSessao` use case. Return 200 on success.
- Acceptance: Route responds to POST.
- ~15 LOC

### Phase 5 -- Public Confirmation Page

**Unit 20: Resident confirmation page**
- Files: `src/app/retirada/[id]/page.tsx`
- Change: Server component. Fetches session details via use case (not API route -- direct use case call since this is a server component). Renders based on status: pending shows package list + confirm button; expired/confirmed/cancelled/not-found show appropriate messages in pt-BR. The confirm button calls the API route via client-side fetch.
- Acceptance: Page renders at `/retirada/{uuid}`. Shows packages for valid sessions. Shows error states for invalid ones.
- ~40 LOC

**Unit 21: Confirmation client component**
- Files: `src/components/retirada/confirmation-form.tsx`
- Change: Client component rendered inside the confirmation page. Shows the package list (passed as props), a "Confirmar Retirada" button, loading state, success state, and error state. On click, POSTs to `/api/retirada/{id}/confirmar`. On success, shows green checkmark + "Retirada confirmada!" message.
- Acceptance: Button triggers confirmation. Success/error states render correctly.
- ~45 LOC

### Phase 6 -- Portaria UI Overhaul

**Unit 22: Install `qrcode.react` dependency**
- Files: `package.json`
- Change: Add `qrcode.react` to dependencies. Run `npm install qrcode.react`.
- Acceptance: Package installed. Import resolves.
- ~1 LOC

**Unit 23: Grouped pending list with checkboxes**
- Files: `src/components/portaria/pending-list.tsx`
- Change: Rewrite the pending list to group encomendas by apartment (`bloco + numero`). Each group is a collapsible section. Each row has a checkbox. A floating action bar appears when items are selected showing "Gerar QR Code" and "Confirmacao Manual" buttons. Selection is scoped within a single apartment group (selecting in another group clears the previous selection).
- Acceptance: Packages display grouped by apartment. Checkboxes work. Action bar appears on selection. Cross-group selection is prevented.
- ~50 LOC (split from old 88-line component)

**Unit 24: QR code modal component**
- Files: `src/components/portaria/qr-modal.tsx`
- Change: Client component. Receives `sessionId`, `expiresAt`, `qrCodeUrl`, and an `onClose` callback. Renders: QR code (via `qrcode.react`), countdown timer derived from `expiresAt`, "Confirmacao Manual" button, "Cancelar" button. The QR code encodes the full URL. Timer shows MM:SS remaining. When timer hits 0, show "Sessao expirada" and auto-close after 3 seconds.
- Acceptance: QR renders correctly. Timer counts down. Expiration is handled.
- ~50 LOC

**Unit 25: Realtime subscription hook**
- Files: `src/infrastructure/supabase/use-realtime-session.ts`
- Change: Custom React hook `useRealtimeSession(sessionId: string, onConfirmed: () => void)`. Subscribes to Postgres changes on `withdrawal_sessions` table filtered by `id = sessionId`. When `status` changes to `'confirmed'`, calls `onConfirmed`. Cleans up subscription on unmount.
- Acceptance: Hook compiles. Subscription is set up and torn down correctly.
- ~25 LOC

**Unit 26: Wire Realtime into QR modal**
- Files: `src/components/portaria/qr-modal.tsx` (update)
- Change: Use the `useRealtimeSession` hook inside the QR modal. When `onConfirmed` fires, transition the modal to a success state (green checkmark, "Retirada confirmada pelo morador!"), then auto-close after 2 seconds and trigger page refresh via `router.refresh()`.
- Acceptance: Modal auto-closes when resident confirms on their phone. Page refreshes.
- ~15 LOC change

**Unit 27: Manual confirmation form component**
- Files: `src/components/portaria/manual-confirmation-form.tsx`
- Change: Client component. Receives `sessionId` and `onClose` callback. Renders a form with: reason select (sem_celular, idoso, portador_necessidades, outro), optional note textarea, doorman name input (required). Submit POSTs to `/api/retirada/{id}/manual`. On success, closes and triggers page refresh.
- Acceptance: Form submits. Validation works. Success closes the form.
- ~45 LOC

**Unit 28: Wire session creation into pending list**
- Files: `src/components/portaria/pending-list.tsx` (update)
- Change: Implement the "Gerar QR Code" button handler. On click, POST to `/api/retirada/sessao` with the selected apartment ID and encomenda IDs. On success, open the QR modal with the returned session data. Implement the "Confirmacao Manual" button to open the QR modal which then allows switching to manual mode. Handle loading/error states.
- Acceptance: Full QR flow works end-to-end from the pending list. Full manual flow works.
- ~30 LOC change

### Phase 7 -- Polish

**Unit 29: Update status badges in consulta module**
- Files: `src/components/consulta/results-table.tsx`
- Change: Update the status badge logic to handle 3 states: `'pendente'` (yellow), `'retirada'` (green, label "Retirada"), `'entregue'` (green, label "Entregue"). Both delivered states use green.
- Acceptance: All three statuses display correctly in search results.
- ~10 LOC change

**Unit 30: Environment variable documentation**
- Files: `docs/specs/withdrawal-session-spec.md` (this spec, no code change), `.env.local.example` (update)
- Change: Add `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `NEXT_PUBLIC_APP_URL` to the env example file with placeholder values and comments.
- Acceptance: `.env.local.example` contains all required env vars for the withdrawal session feature.
- ~3 LOC

## Open Questions

1. **Apartment-scoped vs individual package selection.** Decision made: packages are selected within a single apartment group. One QR session = one apartment = N packages. This matches the physical workflow (resident picks up all their packages at once).

2. **TTL value.** Set to 5 minutes. Configurable via environment variable in a future iteration if needed. Hardcoded in the use case for v1.

3. **Doorman identity.** For v1, this is a free-text string field (`createdBy`, `confirmedBy`). When auth is added, these become user IDs. The schema uses `TEXT` to accommodate both.

4. **Expired session cleanup.** The `expirarVencidas` repo method exists but is not called on a schedule. Stale sessions are lazily expired when accessed (in `buscar-sessao-retirada` use case). A cron job or Supabase scheduled function can be added later.

5. **Concurrent session for same packages.** The `criar-sessao-retirada` use case validates that all encomendas are `'pendente'`. If two sessions are created for overlapping packages, the first to confirm wins; the second will fail because the encomendas are no longer pending. This is acceptable -- the doorman should not create two sessions for the same packages.
