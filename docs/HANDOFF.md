# Session Handoff

**Date:** 2026-06-15
**Branch:** main

## Current State

A comprehensive multi-tenancy spec has been written at `docs/specs/multi-tenancy-condominiums-spec.md`. This restructures the entire system around condominiums as the top-level tenant boundary. The spec has 39 implementation units across 13 phases.

## What Was Done This Session

- Analyzed full codebase architecture (entities, repositories, use cases, actions, pages, middleware, sidebar)
- Created `docs/specs/multi-tenancy-condominiums-spec.md` with:
  - 2 new DB tables (`condominios`, `invite_tokens`)
  - 2 altered tables (`apartamentos`, `moradores` gain `condominio_id`)
  - 2 new entities, 2 new repository interfaces, 2 new Supabase implementations
  - All existing repositories updated for tenant scoping
  - New auth helper (`getServerUserWithCondo`)
  - New signup flows (portaria creates condo, morador uses invite token)
  - All pages, actions, middleware, sidebar updated
  - Invite management UI (page + form component)

## Next Steps

1. **Begin implementation at Unit 1** — SQL migration in `docs/schema.sql`
2. Follow unit order strictly (1-39); each unit depends on prior ones
3. Phase 1-2 is foundational (schema + types); Phase 3-4 is infrastructure; Phase 5-10 is wiring; Phase 11-13 is UI

## Key Decisions

- Condominium uses UUID primary key (matches auth user IDs)
- `condominio_id` denormalized on `moradores` to avoid joins
- Portaria signup creates condominium inline (no separate condo creation step)
- Morador signup requires invite token (no self-registration with role selection)
- Tenant scoping enforced at use-case level, not repository level
- No RLS policies — all access through `supabaseAdmin` (service role)
- Invite tokens are 256-bit random hex strings
- `/signup?token=<token>` pattern (not a separate route)

## Open Questions

None blocking. See spec for deferred decisions (withdrawal session denormalization, read-only apartment view for moradores).
