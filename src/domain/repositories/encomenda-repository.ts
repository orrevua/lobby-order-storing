import type { Encomenda, EncomendaComMorador } from '../entities/encomenda';
import type { SearchFilters } from '../entities/search-filters';

export type RegisterPackageInput = {
  moradorId: number;
  codigoRastreio: string | null;
  descricao: string | null;
  receivedBy: string | null;
};

export interface EncomendaRepository {
  listPending(condominioId: string, apartamentoId?: number): Promise<EncomendaComMorador[]>;
  search(condominioId: string, filters: SearchFilters): Promise<{ data: EncomendaComMorador[]; total: number }>;
  register(data: RegisterPackageInput): Promise<Encomenda>;
  markWithdrawn(id: number): Promise<Encomenda>;
  markDelivered(ids: number[]): Promise<void>;
}
