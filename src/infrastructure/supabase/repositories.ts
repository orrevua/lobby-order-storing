import { supabaseAdmin } from './admin';
import { SupabaseApartamentoRepository } from './apartamento-repository';
import { SupabaseEncomendaRepository } from './encomenda-repository';
import { SupabaseMoradorRepository } from './morador-repository';
import { SupabaseWithdrawalSessionRepository } from './withdrawal-session-repository';
import { SupabaseStorageService } from './storage-service';

export const apartmentRepository = new SupabaseApartamentoRepository(supabaseAdmin);
export const packageRepository = new SupabaseEncomendaRepository(supabaseAdmin);
export const residentRepository = new SupabaseMoradorRepository(supabaseAdmin);
export const withdrawalSessionRepository = new SupabaseWithdrawalSessionRepository(supabaseAdmin);
export const storageService = new SupabaseStorageService(supabaseAdmin);
