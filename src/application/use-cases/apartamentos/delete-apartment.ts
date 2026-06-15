import type { ApartamentoRepository } from '@/domain/repositories/apartamento-repository';

export async function deleteApartment(repo: ApartamentoRepository, id: number) {
  return repo.delete(id);
}
