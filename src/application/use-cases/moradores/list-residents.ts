import type { MoradorRepository } from '@/domain/repositories/morador-repository';

export async function listResidents(repo: MoradorRepository) {
  return repo.list();
}
