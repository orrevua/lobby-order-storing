import type { MoradorRepository } from '@/domain/repositories/morador-repository';

export async function listResidents(repo: MoradorRepository, condominioId: string) {
  return repo.list(condominioId);
}
