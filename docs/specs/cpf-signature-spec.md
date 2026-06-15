# CPF & Signature Capture -- Spec

**Status:** Draft
**Date:** 2026-06-15
**Related:** `docs/specs/withdrawal-session-spec.md` (extends), `docs/specs/clean-architecture-spec.md` (follows)

## Goal

Add CPF (Brazilian national ID) registration on moradores and signature photo capture on withdrawal confirmation to create a legally defensible audit trail for package deliveries. When a resident confirms via QR, they verify/enter their CPF and photograph a handwritten signature before finalizing.

## Context & Current State

### Morador entity
- `src/domain/entities/morador.ts:1-7` -- `Morador` has `id`, `nome`, `contato`, `apartamentoId`, `createdAt`. No CPF field.
- `src/domain/repositories/morador-repository.ts:4-8` -- `CriarMoradorInput` and `AtualizarMoradorInput` have `nome`, `contato`, `apartamentoId`. No CPF.
- `src/infrastructure/supabase/morador-repository.ts:10-16` -- `MoradorRow` maps DB columns. No CPF column.
- `src/components/cadastro/morador-form.tsx:43-87` -- Form has Nome, Contato, Apartamento fields. No CPF input.
- `src/lib/actions/moradores.ts:11-23` -- `criarMorador` server action parses `nome`, `contato`, `apartamento_id` from FormData.
- `docs/schema.sql:16-21` -- `moradores` table has `nome`, `contato`, `apartamento_id`, `created_at`.

### Withdrawal session & confirmation
- `src/domain/entities/withdrawal-session.ts:5-18` -- `WithdrawalSession` has no CPF or signature fields.
- `src/domain/repositories/withdrawal-session-repository.ts:10-15` -- `ConfirmarSessaoInput` has `confirmationMethod`, `confirmedBy`, `manualReason`, `doormanNote`. No CPF or signature.
- `src/infrastructure/supabase/withdrawal-session-repository.ts:74-90` -- `confirmar` method updates status + confirmation fields. No CPF or signature handling.
- `src/app/retirada/[id]/page.tsx:49-59` -- Renders `ConfirmationForm` with session ID and encomenda list.
- `src/components/retirada/confirmation-form.tsx:17-86` -- Shows package list and a single "Confirmar Retirada" button. No intermediate steps.
- `src/app/api/retirada/[id]/confirmar/route.ts:5-21` -- POST handler calls `confirmarRetiradaQr` with no body payload.
- `src/application/use-cases/retirada/confirmar-retirada-qr.ts:4-21` -- Takes `sessionId` only.

### Supabase Storage
- Not currently used. The project uses `@supabase/supabase-js` v2.108.1 (`package.json:12`) which includes the Storage API.
- The server-side client (`src/infrastructure/supabase/client.ts:1-6`) uses `SUPABASE_SERVICE_ROLE_KEY`, which has full storage access.

### Consulta module
- `src/components/consulta/results-table.tsx:57-89` -- Table columns: Morador, Apartamento, Codigo Rastreio, Descricao, Data Chegada, Data Retirada, Status. No CPF or signature display.

## Proposed Design

### 1. CPF on Morador

Add an optional `cpf` field (`VARCHAR(11)`, digits only) to the `moradores` table and the `Morador` domain entity. CPF is stored as 11 raw digits (no punctuation) in the database and domain layer. Formatting (`XXX.XXX.XXX-XX`) is a presentation concern handled in components.

**CPF validation** is a pure domain function. The algorithm:
1. Must be exactly 11 digits
2. All digits cannot be the same (e.g., `11111111111` is invalid)
3. First check digit: sum first 9 digits weighted 10..2, mod 11, complement
4. Second check digit: sum first 10 digits weighted 11..2, mod 11, complement

This function lives in `src/domain/validators/cpf.ts` (new directory for domain validation functions).

**Decision: CPF is optional.** Not all moradores will have CPF registered. The field is `null` by default. The morador form allows entering/editing it but does not require it.

### 2. Withdrawal Session CPF + Signature

Add two fields to `withdrawal_sessions`:
- `cpf_confirmacao VARCHAR(11)` -- The CPF entered/confirmed at withdrawal time. This is a snapshot (may differ from the morador's registered CPF if a different person picks up).
- `signature_url TEXT` -- URL to the uploaded signature image in Supabase Storage.

Both are nullable. For QR confirmation, the flow requires CPF + signature. For manual confirmation, CPF is optional and signature is optional (doorman may not capture them).

### 3. Signature Upload Flow

The signature is a photograph of a handwritten signature on paper. The resident uses their phone camera via `<input type="file" accept="image/*" capture="environment">` (native browser camera API, no extra dependencies).

**Upload path:** The image is uploaded through a new API route (`POST /api/retirada/[id]/assinatura`) that uses the service role Supabase client to store the file in a `signatures` bucket. This avoids exposing storage credentials to the client.

**Storage structure:** `signatures/{session_id}.{ext}` -- one signature per session, named by session UUID. Overwriting is fine since each session is single-use.

**Supabase Storage bucket:** `signatures` must be created in Supabase Dashboard. The bucket is private (no public access). The API route generates a signed URL (time-limited) for display in the consulta module.

**Decision: upload via API route, not direct client upload.** This keeps `SUPABASE_SERVICE_ROLE_KEY` server-side only and avoids configuring Supabase Storage RLS policies on the bucket. The tradeoff is an extra network hop (phone -> Next.js -> Supabase Storage), but signature images are small (< 2MB).

### 4. Confirmation Page Flow Change

The current confirmation page (`/retirada/[id]`) shows packages and a confirm button. The new flow:

1. **Package list** -- same as today
2. **CPF step** -- Input pre-filled with the morador's registered CPF (fetched from session's apartment moradores). Resident can edit. Validated client-side with the CPF algorithm before proceeding.
3. **Signature step** -- Camera capture button. Shows preview of captured image. Required before confirming.
4. **Confirm button** -- Uploads signature image, then POSTs confirmation with CPF.

This is implemented as a multi-step form within the existing `ConfirmationForm` client component, not as separate pages.

### 5. Consulta Enhancement

The results table gains a "Detalhes" column with a link/button for confirmed orders that have a signature. Clicking opens a small modal/popover showing: CPF used at confirmation (masked), signature image (loaded via signed URL from a new API endpoint), and confirmation timestamp.

### Data Flow

```
Resident opens /retirada/{id}
  -> Server component fetches session + encomendas + morador CPF
  -> Renders ConfirmationForm with prefilled CPF

Resident enters CPF, captures signature photo
  -> Client validates CPF (domain validator, bundled for client)
  -> POST /api/retirada/{id}/assinatura (multipart/form-data with image)
    -> API route uploads to Supabase Storage: signatures/{id}.jpg
    -> Returns { signatureUrl: "..." }
  -> POST /api/retirada/{id}/confirmar (JSON: { cpf: "12345678901" })
    -> Use case validates session + CPF format
    -> Marks encomendas as entregue
    -> Confirms session with cpf_confirmacao + signature_url
    -> Returns success

Doorman's consulta page
  -> GET /api/retirada/{id}/assinatura (signed URL redirect)
    -> Returns signed Supabase Storage URL for the image
```

## Scope

### In scope
- `moradores` table: add `cpf VARCHAR(11)` column
- `withdrawal_sessions` table: add `cpf_confirmacao VARCHAR(11)`, `signature_url TEXT` columns
- Supabase Storage: `signatures` bucket (manual creation, documented)
- Domain: CPF validator function, Morador entity update, WithdrawalSession entity update
- Repository: Morador input types gain `cpf`, WithdrawalSession confirmar gains CPF + signature fields
- Infrastructure: Morador repo maps CPF, WithdrawalSession repo maps new fields, new storage service
- API: Signature upload route, update confirmar route to accept CPF, signature view route
- UI: Morador form CPF field, multi-step confirmation page, consulta signature viewer

### Out of scope (explicitly)
- CPF uniqueness enforcement (multiple moradores may share a CPF, e.g., family members)
- CPF lookup/validation against government APIs (Receita Federal)
- Digital/electronic signatures (this is a photo of a physical signature)
- Image compression or processing
- Signature for manual confirmations (optional enhancement, not in v1 flow)

## Interfaces / Models / Endpoints

### Domain: CPF Validator

```typescript
// src/domain/validators/cpf.ts
export function validarCPF(cpf: string): boolean;
export function formatarCPF(cpf: string): string;  // "12345678901" -> "123.456.789-01"
export function limparCPF(cpf: string): string;     // "123.456.789-01" -> "12345678901"
```

### Domain Entity: Morador (updated)

```typescript
export type Morador = {
  id: number;
  nome: string;
  contato: string | null;
  cpf: string | null;          // NEW: 11 digits, no formatting
  apartamentoId: number | null;
  createdAt: string;
};
```

### Domain Entity: WithdrawalSession (updated)

```typescript
export type WithdrawalSession = {
  // ... existing fields ...
  cpfConfirmacao: string | null;   // NEW: CPF used at confirmation time
  signatureUrl: string | null;     // NEW: URL to signature image in storage
};
```

### Repository: MoradorRepository (updated input types)

```typescript
export type CriarMoradorInput = {
  nome: string;
  contato: string | null;
  cpf: string | null;             // NEW
  apartamentoId: number;
};

export type AtualizarMoradorInput = {
  nome: string;
  contato: string | null;
  cpf: string | null;             // NEW
  apartamentoId: number;
};
```

### Repository: WithdrawalSessionRepository (updated confirmar input)

```typescript
export type ConfirmarSessaoInput = {
  confirmationMethod: ConfirmationMethod;
  confirmedBy: string | null;
  manualReason?: ManualReason | null;
  doormanNote?: string | null;
  cpfConfirmacao?: string | null;    // NEW
  signatureUrl?: string | null;      // NEW
};
```

### Infrastructure: Storage Service

```typescript
// src/infrastructure/supabase/storage-service.ts
export class SupabaseStorageService {
  constructor(private client: SupabaseClient) {}
  async uploadSignature(sessionId: string, file: Buffer, contentType: string): Promise<string>;
  async getSignatureUrl(sessionId: string): Promise<string | null>;
}
```

### API: POST `/api/retirada/[id]/assinatura`

**Request:** `multipart/form-data` with field `file` (image)
**Response 200:** `{ success: true, signatureUrl: string }`
**Response 400:** `{ success: false, error: string }` (no file, too large, wrong type)

### API: POST `/api/retirada/[id]/confirmar` (updated)

**Request body (JSON):** `{ cpf?: string }` (was empty body before)
**Response:** unchanged

### API: GET `/api/retirada/[id]/assinatura`

**Response 302:** Redirect to signed Supabase Storage URL (expires in 1 hour)
**Response 404:** No signature found

### Page: `/retirada/[id]` (updated server component)

Now also fetches the morador's CPF (via the encomendas' morador data already loaded) and passes it to `ConfirmationForm` as `prefillCpf`.

## Impact Analysis

- **Morador entity:** Gains `cpf` field. All consumers of `Morador` type are affected at compile time but most don't use CPF, so runtime impact is nil. The `toDomain` mapper in `src/infrastructure/supabase/morador-repository.ts:25-33` must include the new field.
- **MoradorRow type:** Gains `cpf` in `src/infrastructure/supabase/morador-repository.ts:10-16`.
- **Morador form:** Gains a new field. The grid changes from 3 columns to 4 (or 2 rows).
- **Morador server actions:** `criarMorador` and `atualizarMorador` in `src/lib/actions/moradores.ts` must parse `cpf` from FormData.
- **Morador use cases:** `criarMorador` and `atualizarMorador` in `src/application/use-cases/moradores/` must validate CPF format when provided.
- **WithdrawalSession entity:** Gains 2 fields. The `toDomain` mapper in `src/infrastructure/supabase/withdrawal-session-repository.ts:24-38` must include them.
- **SessionRow type:** Gains `cpf_confirmacao` and `signature_url` in `src/infrastructure/supabase/withdrawal-session-repository.ts:9-22`.
- **ConfirmarSessaoInput:** Gains optional CPF + signature URL fields. The `confirmar` method in the Supabase repo must write them.
- **ConfirmationForm:** Major rewrite from single-button to multi-step (CPF input -> camera capture -> confirm).
- **Confirmar API route:** Must accept `cpf` in request body and pass it through.
- **confirmarRetiradaQr use case:** Must accept and validate CPF, and receive `signatureUrl`.
- **Results table:** Gains a "Detalhes" action column for confirmed orders.
- **New files:** CPF validator, storage service, signature upload route, signature view route.
- **No new npm dependencies.** Uses native `<input type="file" capture>` and existing Supabase Storage API.
- **Database migration:** Two ALTER TABLE statements (add columns). Non-breaking (all new columns are nullable).

## Implementation Units

### Phase 1 -- Schema & Domain Foundation

**Unit 1: Database schema changes**
- Files: `docs/schema.sql` (append)
- Change: Add `ALTER TABLE moradores ADD COLUMN cpf VARCHAR(11);` and `ALTER TABLE withdrawal_sessions ADD COLUMN cpf_confirmacao VARCHAR(11); ALTER TABLE withdrawal_sessions ADD COLUMN signature_url TEXT;`. Add a comment about creating the `signatures` storage bucket manually.
- Acceptance: SQL is syntactically valid. All new columns are nullable.
- ~10 LOC

**Unit 2: CPF validator (domain)**
- Files: `src/domain/validators/cpf.ts`
- Change: Create `validarCPF(cpf: string): boolean` (check digit algorithm), `formatarCPF(cpf: string): string` (add dots/dash), `limparCPF(cpf: string): string` (strip non-digits). Pure functions, no imports.
- Acceptance: `validarCPF('12345678909')` returns true (valid). `validarCPF('11111111111')` returns false. `formatarCPF('12345678909')` returns `'123.456.789-09'`. `limparCPF('123.456.789-09')` returns `'12345678909'`. File compiles with no imports.
- ~40 LOC

**Unit 3: Update Morador domain entity**
- Files: `src/domain/entities/morador.ts`
- Change: Add `cpf: string | null;` to the `Morador` type, after `contato`.
- Acceptance: Type compiles. Single field addition.
- ~1 LOC change

**Unit 4: Update Morador repository input types**
- Files: `src/domain/repositories/morador-repository.ts`
- Change: Add `cpf: string | null;` to both `CriarMoradorInput` and `AtualizarMoradorInput`.
- Acceptance: Compiles. Both input types include `cpf`.
- ~2 LOC change

**Unit 5: Update WithdrawalSession domain entity**
- Files: `src/domain/entities/withdrawal-session.ts`
- Change: Add `cpfConfirmacao: string | null;` and `signatureUrl: string | null;` to the `WithdrawalSession` type.
- Acceptance: Type compiles. Two new fields.
- ~2 LOC change

**Unit 6: Update ConfirmarSessaoInput**
- Files: `src/domain/repositories/withdrawal-session-repository.ts`
- Change: Add `cpfConfirmacao?: string | null;` and `signatureUrl?: string | null;` to `ConfirmarSessaoInput`.
- Acceptance: Compiles. Both fields are optional.
- ~2 LOC change

### Phase 2 -- Infrastructure

**Unit 7: Update Supabase morador repository**
- Files: `src/infrastructure/supabase/morador-repository.ts`
- Change: Add `cpf: string | null;` to `MoradorRow` type (line 10-16). Add `cpf: row.cpf` to `toDomain` function (line 25-33). Add `cpf: input.cpf` to the `insert` call in `criar` (line 87-94) and the `update` call in `atualizar` (line 101-110).
- Acceptance: Compiles. CPF is mapped in all CRUD operations.
- ~4 LOC change across 4 locations

**Unit 8: Update Supabase withdrawal session repository**
- Files: `src/infrastructure/supabase/withdrawal-session-repository.ts`
- Change: Add `cpf_confirmacao: string | null;` and `signature_url: string | null;` to `SessionRow` (line 9-22). Add mappings to `toDomain` (line 24-38). Add both fields to the `update` call in `confirmar` method (line 74-90).
- Acceptance: Compiles. New fields are mapped in row type, toDomain, and confirmar update.
- ~6 LOC change across 3 locations

**Unit 9: Supabase storage service**
- Files: `src/infrastructure/supabase/storage-service.ts`
- Change: Create `SupabaseStorageService` class. Constructor receives SupabaseClient. `uploadSignature(sessionId, file, contentType)` uploads to `signatures/{sessionId}.jpg` using `client.storage.from('signatures').upload(...)`. Returns the file path. `getSignatureUrl(sessionId)` calls `client.storage.from('signatures').createSignedUrl(...)` with 1-hour expiry. Returns signed URL or null if file doesn't exist.
- Acceptance: Compiles. Both methods implemented. Uses Supabase Storage API.
- ~35 LOC

**Unit 10: Register storage service in composition root**
- Files: `src/infrastructure/supabase/repositories.ts`
- Change: Import `SupabaseStorageService`, instantiate with `supabaseClient`, export as `storageService`.
- Acceptance: File exports 5 items (4 repositories + storage service). Compiles.
- ~3 LOC change

### Phase 3 -- Use Cases

**Unit 11: Update morador use cases for CPF validation**
- Files: `src/application/use-cases/moradores/criar-morador.ts`, `src/application/use-cases/moradores/atualizar-morador.ts`
- Change: Import `validarCPF` from `@/domain/validators/cpf`. In both use cases, after existing validations, add: if `data.cpf` is provided and not empty, validate with `validarCPF(data.cpf)` and throw `'CPF invalido.'` if false. If `data.cpf` is empty string, normalize to `null`.
- Acceptance: Both files compile. CPF validation fires only when CPF is provided. Invalid CPF throws.
- ~10 LOC change total

**Unit 12: Update confirmarRetiradaQr use case**
- Files: `src/application/use-cases/retirada/confirmar-retirada-qr.ts`
- Change: Expand function signature to accept `cpf: string | null` and `signatureUrl: string | null`. Import `validarCPF`. If `cpf` is provided, validate format. Pass `cpfConfirmacao` and `signatureUrl` to `sessionRepo.confirmar()`.
- Acceptance: Compiles. CPF validated when provided. Both fields passed to confirmar.
- ~10 LOC change

**Unit 13: Update confirmarRetiradaManual use case**
- Files: `src/application/use-cases/retirada/confirmar-retirada-manual.ts`
- Change: Add `cpf: string | null` to the `Input` type. Import `validarCPF`. If provided, validate. Pass `cpfConfirmacao` to `sessionRepo.confirmar()`. Signature URL is not added (manual confirmation doesn't require signature in v1).
- Acceptance: Compiles. CPF is optional for manual flow.
- ~5 LOC change

### Phase 4 -- API Routes

**Unit 14: Signature upload API route**
- Files: `src/app/api/retirada/[id]/assinatura/route.ts`
- Change: POST handler: extract `id` from params. Read `file` from `request.formData()`. Validate file exists, is image type (`image/jpeg`, `image/png`, `image/webp`), and under 5MB. Convert to Buffer. Call `storageService.uploadSignature(id, buffer, contentType)`. Return `{ success: true, signatureUrl }`. GET handler: call `storageService.getSignatureUrl(id)`. If found, return 302 redirect to signed URL. If not, return 404.
- Acceptance: POST accepts image upload. GET returns signed redirect. Validates file type and size.
- ~45 LOC

**Unit 15: Update confirmar API route**
- Files: `src/app/api/retirada/[id]/confirmar/route.ts`
- Change: Parse optional JSON body `{ cpf?: string, signatureUrl?: string }` from request. Pass `cpf` and `signatureUrl` to `confirmarRetiradaQr` use case. Handle case where body is empty (backward compatible).
- Acceptance: Route accepts CPF + signatureUrl in body. Still works with empty body.
- ~10 LOC change

### Phase 5 -- UI: Morador Form

**Unit 16: Add CPF field to morador form**
- Files: `src/components/cadastro/morador-form.tsx`
- Change: Add a CPF input field after Contato. Use `type="text"`, `name="cpf"`, `maxLength={14}`, `placeholder="000.000.000-00"`. Apply client-side input mask that auto-inserts dots and dash as user types. Default value from `morador?.cpf` formatted with `formatarCPF`. The grid changes to accommodate 4 fields (2 columns on small, 4 on large).
- Acceptance: CPF field renders. Mask formats as user types. Submits raw digits.
- ~25 LOC change

**Unit 17: Update morador server actions for CPF**
- Files: `src/lib/actions/moradores.ts`
- Change: In `criarMorador` and `atualizarMorador`, parse `cpf` from FormData. Strip non-digits with `limparCPF`. If empty after stripping, set to `null`. Pass to use case.
- Acceptance: Server actions parse and forward CPF. Compiles.
- ~6 LOC change

### Phase 6 -- UI: Confirmation Page

**Unit 18: Update retirada page to pass morador CPF**
- Files: `src/app/retirada/[id]/page.tsx`
- Change: Extract the first morador's CPF from the encomendas data (all encomendas in a session belong to one apartment; pick the first morador's CPF). Pass `prefillCpf` prop to `ConfirmationForm`. Also pass `sessionId` for signature upload.
- Acceptance: Page passes prefillCpf to form. Compiles.
- ~5 LOC change

**Unit 19: Multi-step confirmation form -- CPF step**
- Files: `src/components/retirada/confirmation-form.tsx`
- Change: Refactor from single-button to multi-step. Add `step` state (`'packages' | 'cpf' | 'signature' | 'confirm'`). Step 1 (packages): same package list + "Continuar" button. Step 2 (cpf): CPF input pre-filled from `prefillCpf`, client-side validation using `validarCPF`, "Continuar" button. Import CPF validator (it's a pure function, safe for client bundle).
- Acceptance: Steps 1 and 2 work. CPF validation blocks progression if invalid. Back navigation works.
- ~40 LOC change

**Unit 20: Multi-step confirmation form -- Signature step**
- Files: `src/components/retirada/confirmation-form.tsx`
- Change: Step 3 (signature): render `<input type="file" accept="image/*" capture="environment">` styled as a button ("Fotografar Assinatura"). On file select, show image preview with `URL.createObjectURL`. "Continuar" button enabled only when image is captured. User can retake (replaces preview).
- Acceptance: Camera opens on mobile. Preview displays. Retake works. Cannot proceed without image.
- ~30 LOC change

**Unit 21: Multi-step confirmation form -- Submit step**
- Files: `src/components/retirada/confirmation-form.tsx`
- Change: Step 4 (confirm): Show summary (CPF masked, signature thumbnail). "Confirmar Retirada" button. On click: (1) upload signature via `POST /api/retirada/{id}/assinatura` with FormData, (2) on success, confirm via `POST /api/retirada/{id}/confirmar` with `{ cpf, signatureUrl }`. Show loading state during both requests. On error, show message and allow retry.
- Acceptance: Full flow works: packages -> CPF -> signature -> confirm. Both API calls execute in sequence. Success/error states render.
- ~35 LOC change

### Phase 7 -- Consulta Enhancement

**Unit 22: Signature detail viewer API**
- Files: already covered by GET handler in Unit 14 (`/api/retirada/[id]/assinatura`)
- Note: This unit is a no-op if Unit 14 already includes the GET handler. If not, add it.

**Unit 23: Update results table with signature detail**
- Files: `src/components/consulta/results-table.tsx`
- Change: The `EncomendaComMorador` type does not include withdrawal session data, so the detail link requires knowing the session ID. For v1, add a "CPF" column showing the morador's registered CPF (masked) from the existing `morador` join data. The full withdrawal session audit (signature image, confirmation CPF) is deferred to a dedicated session detail page in a future spec.
- Acceptance: CPF column shows masked CPF for moradores that have one. Shows "--" otherwise.
- ~15 LOC change

### Phase 8 -- Update manual flow for CPF

**Unit 24: Update manual confirmation route for CPF**
- Files: `src/app/api/retirada/[id]/manual/route.ts`
- Change: Parse optional `cpf` from request body. Pass to `confirmarRetiradaManual` use case.
- Acceptance: Route accepts optional CPF. Backward compatible (CPF not required).
- ~3 LOC change

**Unit 25: Update manual confirmation form for CPF**
- Files: `src/components/portaria/manual-confirmation-form.tsx`
- Change: Add an optional CPF input field to the manual confirmation form. Strip and validate if provided.
- Acceptance: CPF field renders. Optional. Validated when provided.
- ~10 LOC change

## Open Questions

1. **CPF uniqueness.** Decision: not enforced. Multiple moradores in the same apartment (family) may share a CPF, or different moradores may have the same CPF. The CPF is informational for audit, not an identifier.

2. **Signature bucket access.** The `signatures` bucket must be created manually in Supabase Dashboard as a private bucket. This is documented in the schema file. No RLS needed because all access goes through the service role client via API routes.

3. **Image size limit.** Set to 5MB. Phone camera photos are typically 2-4MB. No server-side compression in v1. If this becomes a storage concern, add client-side compression in a future iteration.

4. **CPF required for QR confirmation?** Decision: CPF and signature are both required for QR confirmation to maximize legal defensibility. For manual confirmation, both are optional (doorman's judgment).

5. **Session-to-encomenda CPF linkage for consulta.** The withdrawal session stores the confirmation CPF, but the consulta results table queries encomendas, not sessions. Linking them requires a join or a separate lookup. For v1, the consulta table shows the morador's registered CPF (from the morador join). Showing the confirmation CPF + signature requires a session detail view, deferred to a future spec.
