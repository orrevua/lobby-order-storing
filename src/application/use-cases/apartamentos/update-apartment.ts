import type { ApartamentoRepository, UpdateApartmentInput } from '@/domain/repositories/apartamento-repository';

export async function updateApartment(repo: ApartamentoRepository, id: number, data: UpdateApartmentInput) {
  if (!data.numero.trim() || !data.bloco.trim()) {
    throw new Error('Número e bloco são obrigatórios.');
  }
  return repo.update(id, data);
}
