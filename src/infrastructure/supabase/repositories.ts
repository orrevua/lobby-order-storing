import { supabaseClient } from './client';
import { SupabaseApartamentoRepository } from './apartamento-repository';
import { SupabaseEncomendaRepository } from './encomenda-repository';
import { SupabaseMoradorRepository } from './morador-repository';
import { SupabaseWithdrawalSessionRepository } from './withdrawal-session-repository';
import { SupabaseStorageService } from './storage-service';

export const apartmentRepository = new SupabaseApartamentoRepository(supabaseClient);
export const packageRepository = new SupabaseEncomendaRepository(supabaseClient);
export const residentRepository = new SupabaseMoradorRepository(supabaseClient);
export const withdrawalSessionRepository = new SupabaseWithdrawalSessionRepository(supabaseClient);
export const storageService = new SupabaseStorageService(supabaseClient);
