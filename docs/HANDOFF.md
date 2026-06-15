# Session Handoff

**Date:** 2026-06-15
**Branch:** master

## Current State

The project has a working apartamentos CRUD module (list page with form placeholder, create/update/delete server actions, Supabase queries) built with a flat architecture (server actions calling Supabase directly).

A new Clean Architecture spec has been written at `docs/specs/clean-architecture-spec.md` to restructure the project for commercial use (multi-tenancy, testability, auth readiness).

## What Was Done This Session

- Analyzed the full codebase (12 existing source files)
- Created `docs/specs/clean-architecture-spec.md` with 30 implementation units across 9 phases
- The old spec (`docs/specs/lobby-order-tracking-spec.md`) is superseded for architecture decisions but remains valid for UI/feature requirements

## Next Steps

1. **Begin implementation at Unit 1** -- Create domain entity types in `src/domain/entities/`
2. Follow the unit order strictly (1-30); each unit depends on prior ones
3. Phase 1-4 restructures existing apartamento code; Phase 5-8 builds new modules; Phase 9 cleans up

## Key Decisions

- Domain types use **camelCase** (e.g., `apartamentoId`, `createdAt`); infrastructure maps to/from DB snake_case
- Use cases are **plain functions** receiving repository interface as first parameter (no DI container)
- Server actions stay in `src/lib/actions/` (existing pattern preserved)
- Composition root at `src/infrastructure/supabase/repositories.ts` wires concrete implementations
- `ActionResult<T>` stays in `src/lib/types.ts` (presentation concern, not domain)

## Open Questions

None blocking. See spec for deferred decisions (error hierarchy, camelCase mapping verbosity).
