# Resident Signature Redesign -- Spec

**Status:** Draft
**Date:** 2026-06-15
**Related:** `docs/specs/cpf-signature-spec.md` (superseded for signature flow)

## Goal

Move signature capture from withdrawal-time to resident-registration-time. Residents upload a signature photo when they register (or edit their profile). At withdrawal confirmation, the saved CPF and signature are displayed read-only for visual verification -- no camera capture required. The withdrawal session still snapshots both values for audit.

## Context & Current State

The old `cpf-signature-spec.md` is fully implemented. The current flow:

1. Morador entity has `cpf: string | null` (`src/domain/entities/morador.ts:5`). No `signatureUrl` field.
2. Storage service uploads to `signatures/{sessionId}.{ext}` (`src/infrastructure/supabase/storage-service.ts:11`).
3. Confirmation form (`src/components/retirada/confirmation-form.tsx`) is a multi-step flow: packages -> CPF input -> camera capture -> submit. CPF is editable (pre-filled from morador). Signature is captured via `<input type="file" capture="environment">`.
4. Morador form (`src/components/cadastro/morador-form.tsx:70-91`) has CPF input only. No signature upload.
5. Server actions (`src/lib/actions/residents.ts:12-26`) handle CPF but not signature.
6. Withdrawal session entity (`src/domain/entities/withdrawal-session.ts:17-18`) stores `cpfConfirmacao` and `signatureUrl`.

### Files to modify
- `src/domain/entities/morador.ts` -- add `signatureUrl`
- `src/domain/repositories/morador-repository.ts` -- add `signatureUrl` to input types
- `src/infrastructure/supabase/morador-repository.ts` -- map `signature_url` column
- `src/infrastructure/supabase/storage-service.ts` -- add morador-path upload method
- `src/lib/actions/residents.ts` -- handle signature upload on create/update
- `src/components/cadastro/morador-form.tsx` -- add signature photo upload UI
- `src/components/retirada/confirmation-form.tsx` -- simplify to read-only display
- `src/app/retirada/[id]/page.tsx` -- pass signature URL to form
- `docs/schema.sql` -- add `signature_url` to moradores

### Files unchanged
- `src/domain/entities/withdrawal-session.ts` -- already has `signatureUrl`
- `src/domain/repositories/withdrawal-session-repository.ts` -- already has `signatureUrl` in `ConfirmSessionInput`
- `src/infrastructure/supabase/withdrawal-session-repository.ts` -- already maps `signature_url`
- `src/application/use-cases/retirada/confirm-withdrawal-qr.ts` -- already accepts `signatureUrl`
- `src/app/api/retirada/[id]/confirmar/route.ts` -- already passes `signatureUrl`
- `src/app/api/retirada/[id]/assinatura/route.ts` -- still needed for session-level signature, repurposed below

## Proposed Design

### 1. Morador gains `signatureUrl`

Add `signatureUrl: string | null` to the `Morador` type and `signature_url TEXT` to the `moradores` DB table. This stores the Supabase Storage path (not a signed URL) -- e.g., `morador-42.jpg`. Signed URLs are generated on demand.

### 2. Storage service: morador-scoped uploads

Add a new method `uploadMoradorSignature(moradorId: number, file: Buffer, contentType: string): Promise<string>` to `SupabaseStorageService`. Uploads to `morador-{moradorId}.{ext}` in the same `signatures` bucket. Existing session-scoped methods remain for backward compatibility and audit trail.

Add `getMoradorSignatureUrl(moradorId: number): Promise<string | null>` for generating signed URLs from the morador path.

### 3. Resident form: signature photo upload

The morador form (`morador-form.tsx`) gains a signature section below the existing fields. It uses `<input type="file" accept="image/*" capture="camera">` (native HTML, no dependencies). Shows a preview if morador already has a saved signature (via signed URL). On form submit, the signature file is included in the FormData.

**Decision: upload in server action, not separate API call.** Since the morador form already uses `FormData` via server actions, the signature file is appended to the same FormData. The server action reads the file, uploads to storage, and sets `signatureUrl` on the morador record. This avoids a two-step upload dance and keeps the flow atomic.

### 4. Simplified withdrawal confirmation

The confirmation form drops the CPF input step and signature capture step entirely. The new flow:

1. **Package list** -- same as today
2. **Confirmation step** -- displays morador's saved CPF (formatted, read-only text) and signature image (loaded from signed URL). Single "Confirmar Retirada" button.

On submit:
- POST to `/api/retirada/{id}/confirmar` with `{ cpf: moradorCpf, signatureUrl: moradorSignatureUrl }`
- The session still snapshots both values for audit

If the morador has no CPF or no signature, the confirmation still proceeds (these are informational, not blocking for withdrawal).

### 5. Retirada page passes signature URL

The server component at `src/app/retirada/[id]/page.tsx` already extracts `prefillCpf`. It additionally fetches a signed URL for the morador's signature using the storage service, and passes both `prefillCpf` and `signatureUrl` to the form.

### 6. Signature API route for morador context

Add a new API route `GET /api/moradores/[id]/assinatura` that returns a signed URL for a morador's signature. Used by the morador form to display the current signature preview. The existing `/api/retirada/[id]/assinatura` routes remain for session-level audit access.

### Data Flow

```
REGISTRATION:
Resident form submit (FormData with signature file)
  -> Server action: reads file from FormData
  -> storageService.uploadMoradorSignature(moradorId, buffer, contentType)
  -> Saves returned path as morador.signatureUrl
  -> Repository stores path in moradores.signature_url

WITHDRAWAL:
Resident opens /retirada/{id}
  -> Server component fetches session + encomendas (includes morador with cpf + signatureUrl)
  -> Generates signed URL from morador.signatureUrl via storageService
  -> Renders ConfirmationForm with prefillCpf + signatureImageUrl (signed)

Resident clicks "Confirmar Retirada"
  -> POST /api/retirada/{id}/confirmar { cpf: moradorCpf, signatureUrl: moradorSignaturePath }
  -> Use case snapshots cpf + signatureUrl on withdrawal_session for audit
  -> Marks encomendas as entregue
```

## Scope

### In scope
- `moradores` table: add `signature_url TEXT` column
- Morador entity: add `signatureUrl` field
- Morador repository types: add `signatureUrl` to create/update inputs
- Morador infrastructure: map `signature_url` in row type, toDomain, create, update
- Storage service: add morador-scoped upload/getUrl methods
- Server actions: handle signature file upload in create/update resident
- Morador form: add signature photo upload with preview
- Confirmation form: simplify to read-only CPF + signature display
- Retirada page: pass signed signature URL
- Morador signature API route for form preview

### Out of scope (explicitly)
- Removing session-scoped signature upload (kept for potential direct audit)
- Signature required for registration (stays optional)
- Image compression or resizing
- Signature for manual confirmation flow (unchanged)

## Interfaces / Models / Endpoints

### Domain Entity: Morador (updated)

```typescript
// src/domain/entities/morador.ts
export type Morador = {
  id: number;
  nome: string;
  contato: string | null;
  cpf: string | null;
  signatureUrl: string | null;  // NEW: storage path e.g. "morador-42.jpg"
  apartamentoId: number | null;
  createdAt: string;
};
```

### Repository Input Types (updated)

```typescript
// src/domain/repositories/morador-repository.ts
export type CreateResidentInput = {
  nome: string;
  contato: string | null;
  cpf: string | null;
  signatureUrl: string | null;  // NEW
  apartamentoId: number;
};

export type UpdateResidentInput = {
  nome: string;
  contato: string | null;
  cpf: string | null;
  signatureUrl: string | null;  // NEW
  apartamentoId: number;
};
```

### Storage Service (extended)

```typescript
// src/infrastructure/supabase/storage-service.ts -- new methods
async uploadMoradorSignature(moradorId: number, file: Buffer, contentType: string): Promise<string>;
async getMoradorSignatureUrl(moradorId: number): Promise<string | null>;
```

### API: GET `/api/moradores/[id]/assinatura`

**Response 200:** `{ signedUrl: string }`
**Response 404:** `{ error: "Assinatura nao encontrada." }`

### ConfirmationForm Props (updated)

```typescript
type Props = {
  sessionId: string;
  prefillCpf: string | null;
  signatureImageUrl: string | null;  // NEW: signed URL for display
  moradorSignaturePath: string | null;  // NEW: raw path for audit snapshot
  encomendas: PackageItem[];
};
```

## Impact Analysis

- **Morador entity consumers:** All code reading `Morador` type gains a new optional field. No runtime break -- `signatureUrl` is `null` for existing records.
- **Morador form:** Gains a signature upload section. Moderate UI change (~40 LOC).
- **Server actions:** Must handle `File` from FormData and call storage service. Moderate logic change (~20 LOC per action).
- **Confirmation form:** Major simplification -- remove ~80 LOC of multi-step CPF/signature capture, replace with ~30 LOC of read-only display.
- **Retirada page:** Minor change -- generate signed URL and pass new props.
- **Database migration:** Single `ALTER TABLE` (nullable, non-breaking).
- **No new npm dependencies.**
- **Backward compatibility:** Existing moradores have `signature_url = NULL`. Confirmation still works without signature (non-blocking). Existing withdrawal sessions with session-scoped signatures are unaffected.

## Implementation Units

### Phase 1 -- Schema & Domain

**Unit 1: Database schema -- add signature_url to moradores**
- Files: `docs/schema.sql`
- Change: Append `ALTER TABLE moradores ADD COLUMN signature_url TEXT;` after the existing ALTER statements.
- Acceptance: SQL is syntactically valid. Column is nullable.
- ~1 LOC

**Unit 2: Morador entity -- add signatureUrl field**
- Files: `src/domain/entities/morador.ts`
- Change: Add `signatureUrl: string | null;` after the `cpf` field.
- Acceptance: Type compiles. Field is between `cpf` and `apartamentoId`.
- ~1 LOC

**Unit 3: Repository input types -- add signatureUrl**
- Files: `src/domain/repositories/morador-repository.ts`
- Change: Add `signatureUrl: string | null;` to both `CreateResidentInput` and `UpdateResidentInput`.
- Acceptance: Both types compile with the new field.
- ~2 LOC

### Phase 2 -- Infrastructure

**Unit 4: Supabase morador repository -- map signature_url**
- Files: `src/infrastructure/supabase/morador-repository.ts`
- Change: (a) Add `signature_url: string | null;` to `MoradorRow` type at line 14. (b) Add `signatureUrl: row.signature_url` to `toDomain` at line 31. (c) Add `signature_url: input.signatureUrl` to the insert object in `create` at line 94. (d) Add `signature_url: input.signatureUrl` to the update object in `update` at line 110.
- Acceptance: Compiles. `signature_url` mapped in row type, toDomain, create, update.
- ~4 LOC across 4 locations

**Unit 5: Storage service -- add morador-scoped methods**
- Files: `src/infrastructure/supabase/storage-service.ts`
- Change: Add two methods to `SupabaseStorageService`: (a) `uploadMoradorSignature(moradorId: number, file: Buffer, contentType: string): Promise<string>` -- uploads to `morador-{moradorId}.{ext}` in the `signatures` bucket with `upsert: true`. Returns the path string. (b) `getMoradorSignatureUrl(moradorId: number): Promise<string | null>` -- tries `morador-{moradorId}.jpg`, `.png`, `.webp` extensions using `createSignedUrl`. Returns first match or null. Same pattern as existing `getSignatureUrl`.
- Acceptance: Compiles. Both methods use morador-prefixed paths. Existing session methods untouched.
- ~25 LOC

### Phase 3 -- Server Actions

**Unit 6: Resident server actions -- handle signature upload**
- Files: `src/lib/actions/residents.ts`
- Change: (a) Import `storageService` from `@/infrastructure/supabase/repositories`. (b) In `createResident`: after parsing other fields, check `formData.get('signature')` for a File. If present and is an image, convert to Buffer, call `storageService.uploadMoradorSignature(...)`. Problem: we don't have moradorId yet (it's created by the use case). Solution: create morador first (without signatureUrl), then upload signature, then update morador with the signatureUrl. (c) In `updateResident`: same file check. If present, upload to `morador-{id}` path. Pass `signatureUrl` to the update use case. If no new file, preserve existing `signatureUrl` by reading `formData.get('existing_signature_url')`.
- Acceptance: Compiles. Signature uploads on create (two-step: create then update) and update (single step). No signature = null signatureUrl.
- ~35 LOC

**Unit 7: Morador signature API route**
- Files: `src/app/api/moradores/[id]/assinatura/route.ts` (new)
- Change: GET handler: parse `id` from params, call `storageService.getMoradorSignatureUrl(Number(id))`. If found, return `{ signedUrl }`. If not, return 404.
- Acceptance: GET returns signed URL for existing signature. 404 for missing. Compiles.
- ~20 LOC

### Phase 4 -- UI: Morador Form

**Unit 8: Morador form -- add signature upload section**
- Files: `src/components/cadastro/morador-form.tsx`
- Change: Below the existing 4-column grid (after the `</div>` closing the grid at line 111), add a signature section: (a) Label "Assinatura". (b) If editing a morador with `signatureUrl`, show current signature image via `/api/moradores/{id}/assinatura` endpoint and a "hidden" input `existing_signature_url` with the raw path value. (c) `<input type="file" name="signature" accept="image/*" capture="camera">` styled consistently. (d) Preview of selected file using `URL.createObjectURL` (requires a small client-side state addition). The form already is `"use client"` so this is fine.
- Acceptance: Signature section renders. File input works. Existing signature shown on edit. Preview on file select.
- ~40 LOC

### Phase 5 -- UI: Simplified Confirmation

**Unit 9: Retirada page -- pass signature data**
- Files: `src/app/retirada/[id]/page.tsx`
- Change: (a) Import `storageService` from `@/infrastructure/supabase/repositories`. (b) After extracting `prefillCpf` at line 49, get the morador's `signatureUrl` path from `result.encomendas[0]?.morador?.signatureUrl ?? null`. (c) If path exists, generate a signed URL via `storageService.getMoradorSignatureUrl(moradorId)`. (d) Pass `signatureImageUrl` (signed URL for display) and `moradorSignaturePath` (raw path for audit) as new props to `ConfirmationForm`.
- Acceptance: Page passes both signature props. Compiles. Null-safe when morador has no signature.
- ~10 LOC

**Unit 10: Confirmation form -- simplify to read-only display**
- Files: `src/components/retirada/confirmation-form.tsx`
- Change: Major rewrite. Remove multi-step CPF input and camera capture. New flow: (a) Props: add `signatureImageUrl: string | null` and `moradorSignaturePath: string | null`. (b) Steps reduce to: `'packages' | 'confirm' | 'submitting' | 'success' | 'error'`. (c) Step `'packages'`: same package list + "Continuar" button. (d) Step `'confirm'`: read-only CPF display (formatted, from `prefillCpf`), signature image (from `signatureImageUrl`), "Confirmar Retirada" button. (e) On submit: POST to confirmar with `{ cpf: prefillCpf, signatureUrl: moradorSignaturePath }`. (f) Remove: `handleCpfChange`, `validateCpf`, `handleFileSelect`, `fileInputRef`, `signatureFile`, `signaturePreview`, `cpfError` state. Remove the CPF step and signature capture step entirely.
- Acceptance: Form has 2 steps (packages -> confirm). CPF is read-only text. Signature is an image display. No file input. Submit sends morador's saved data.
- ~50 LOC (rewrite, net reduction from current ~238 LOC)

## Open Questions

1. **Create-then-update for signature on new morador.** When creating a new morador, we need the morador ID to form the storage path. The server action creates the morador first, then uploads the signature, then updates the record. This is a 3-step operation (insert, upload, update). Acceptable tradeoff for simplicity -- no need for a temporary path scheme. If the upload fails after create, the morador exists without a signature (graceful degradation).

2. **Existing session-scoped signatures.** The `uploadSignature`/`getSignatureUrl` methods on the storage service remain. The session confirmation API route (`/api/retirada/[id]/assinatura`) still works. But the confirmation form no longer uses it. These endpoints could be removed in a future cleanup but are harmless to keep.

3. **Morador without CPF/signature at withdrawal.** Confirmation proceeds regardless. The read-only display shows "CPF nao cadastrado" / "Assinatura nao cadastrada" placeholder text instead of values.
