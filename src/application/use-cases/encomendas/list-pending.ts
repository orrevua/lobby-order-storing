import type { EncomendaRepository } from '@/domain/repositories/encomenda-repository';

export async function listPending(repo: EncomendaRepository, apartamentoId?: number) {
  return repo.listPending(apartamentoId);
}
