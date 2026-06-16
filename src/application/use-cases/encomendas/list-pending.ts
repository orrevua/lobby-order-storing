import type { EncomendaRepository } from '@/domain/repositories/encomenda-repository';

export async function listPending(repo: EncomendaRepository, condominioId: string, apartamentoId?: number) {
  return repo.listPending(condominioId, apartamentoId);
}
