import type { CondominiumRepository } from '@/domain/repositories/condominium-repository';

export async function createCondominium(
  repo: CondominiumRepository,
  input: { name: string; address: string | null },
) {
  if (!input.name.trim()) throw new Error('Nome do condomínio é obrigatório.');
  return repo.create({ name: input.name.trim(), address: input.address?.trim() || null });
}
