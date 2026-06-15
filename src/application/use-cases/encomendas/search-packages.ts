import type { EncomendaRepository } from '@/domain/repositories/encomenda-repository';
import type { SearchFilters } from '@/domain/entities/search-filters';

export async function searchPackages(repo: EncomendaRepository, filters: SearchFilters) {
  return repo.search(filters);
}
