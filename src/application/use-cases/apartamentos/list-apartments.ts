import type { ApartamentoRepository } from '@/domain/repositories/apartamento-repository';

export async function listApartments(repo: ApartamentoRepository, condominioId: string) {
  return repo.list(condominioId);
}
