import type { MoradorRepository, CreateResidentInput } from '@/domain/repositories/morador-repository';
import { validateCPF } from '@/domain/validators/cpf';

export async function createResident(repo: MoradorRepository, data: CreateResidentInput) {
  if (!data.nome.trim()) {
    throw new Error('Nome é obrigatório.');
  }
  if (!data.apartamentoId) {
    throw new Error('Apartamento é obrigatório.');
  }
  if (data.cpf && !validateCPF(data.cpf)) {
    throw new Error('CPF inválido.');
  }
  return repo.create({ ...data, cpf: data.cpf || null });
}
