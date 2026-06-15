import type { MoradorRepository } from '@/domain/repositories/morador-repository';

export async function listResidentsByApartment(repo: MoradorRepository, apartamentoId: number) {
  return repo.listByApartment(apartamentoId);
}
