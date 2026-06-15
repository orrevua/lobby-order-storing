import type { EncomendaRepository, RegisterPackageInput } from '@/domain/repositories/encomenda-repository';

export async function registerPackage(repo: EncomendaRepository, data: RegisterPackageInput) {
  if (!data.moradorId) {
    throw new Error('Morador é obrigatório.');
  }
  return repo.register(data);
}
