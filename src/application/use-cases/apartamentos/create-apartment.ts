import type { ApartamentoRepository, CreateApartmentInput } from '@/domain/repositories/apartamento-repository';

export async function createApartment(repo: ApartamentoRepository, data: CreateApartmentInput) {
  if (!data.numero.trim() || !data.bloco.trim()) {
    throw new Error('Número e bloco são obrigatórios.');
  }
  return repo.create(data);
}
