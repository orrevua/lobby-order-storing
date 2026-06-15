import type { EncomendaRepository } from '@/domain/repositories/encomenda-repository';

export async function markWithdrawn(repo: EncomendaRepository, id: number) {
  return repo.markWithdrawn(id);
}
