import type { MoradorRepository, UpdateResidentInput } from '@/domain/repositories/morador-repository';
import { validateCPF } from '@/domain/validators/cpf';

export async function updateResident(repo: MoradorRepository, id: number, data: UpdateResidentInput) {
  if (!data.nome.trim()) {
    throw new Error('Nome é obrigatório.');
  }
  if (!data.apartamentoId) {
    throw new Error('Apartamento é obrigatório.');
  }
  if (data.cpf && !validateCPF(data.cpf)) {
    throw new Error('CPF inválido.');
  }
  return repo.update(id, { ...data, cpf: data.cpf || null });
}
