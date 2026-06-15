import type { MoradorRepository } from '@/domain/repositories/morador-repository';

export async function deleteResident(repo: MoradorRepository, id: number) {
  return repo.delete(id);
}
