import type { ApartamentoRepository } from '@/domain/repositories/apartamento-repository';

export async function listApartments(repo: ApartamentoRepository) {
  return repo.list();
}
