import type { SupabaseClient } from '@supabase/supabase-js';
import type { Encomenda, EncomendaComMorador } from '@/domain/entities/encomenda';
import type { SearchFilters } from '@/domain/entities/search-filters';
import type {
  EncomendaRepository,
  RegisterPackageInput,
} from '@/domain/repositories/encomenda-repository';

type EncomendaRow = {
  id: number;
  codigo_rastreio: string | null;
  descricao: string | null;
  status: string;
  data_chegada: string;
  data_retirada: string | null;
  received_by: string | null;
  morador_id: number;
  created_at: string;
};

function toDomain(row: EncomendaRow): Encomenda {
  return {
    id: row.id,
    codigoRastreio: row.codigo_rastreio,
    descricao: row.descricao,
    status: row.status as Encomenda['status'],
    dataChegada: row.data_chegada,
    dataRetirada: row.data_retirada,
    receivedBy: row.received_by,
    moradorId: row.morador_id,
    createdAt: row.created_at,
  };
}

function mapJoined(row: any): EncomendaComMorador {
  return {
    ...toDomain(row),
    morador: {
      id: row.morador.id,
      nome: row.morador.nome,
      contato: row.morador.contato,
      cpf: row.morador.cpf ?? null,
      signatureUrl: row.morador.signature_url ?? null,
      apartamentoId: row.morador.apartamento_id,
      createdAt: row.morador.created_at,
      apartamento: row.morador.apartamento
        ? {
            id: row.morador.apartamento.id,
            numero: row.morador.apartamento.numero,
            bloco: row.morador.apartamento.bloco,
            createdAt: row.morador.apartamento.created_at,
          }
        : null,
    },
  };
}

const JOINED_SELECT = '*, morador:moradores(*, apartamento:apartamentos(*))';

export class SupabaseEncomendaRepository implements EncomendaRepository {
  constructor(private client: SupabaseClient) {}

  async listPending(apartamentoId?: number): Promise<EncomendaComMorador[]> {
    let query = this.client
      .from('encomendas')
      .select(JOINED_SELECT)
      .eq('status', 'pendente')
      .order('data_chegada', { ascending: false });

    if (apartamentoId) {
      query = query.eq('morador.apartamento_id', apartamentoId);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    let results = (data ?? []).map(mapJoined);

    // Filter out results where morador is null (can happen with nested filter)
    if (apartamentoId) {
      results = results.filter(
        (e) => e.morador.apartamento?.id === apartamentoId,
      );
    }

    return results;
  }

  async search(
    filters: SearchFilters,
  ): Promise<{ data: EncomendaComMorador[]; total: number }> {
    const page = filters.page ?? 1;
    const perPage = filters.perPage ?? 20;
    const from = (page - 1) * perPage;
    const to = from + perPage - 1;

    let query = this.client
      .from('encomendas')
      .select(JOINED_SELECT, { count: 'exact' })
      .order('data_chegada', { ascending: false })
      .range(from, to);

    if (filters.dataInicio) {
      query = query.gte('data_chegada', filters.dataInicio);
    }
    if (filters.dataFim) {
      query = query.lte('data_chegada', filters.dataFim + 'T23:59:59.999Z');
    }
    if (filters.codigoRastreio) {
      query = query.ilike('codigo_rastreio', `%${filters.codigoRastreio}%`);
    }
    if (filters.apartamentoId) {
      query = query.eq('morador.apartamento_id', filters.apartamentoId);
    }

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);

    let results = (data ?? []).map(mapJoined);

    // Filter by morador name client-side (Supabase can't ilike on nested relations easily)
    if (filters.nomeMorador) {
      const term = filters.nomeMorador.toLowerCase();
      results = results.filter((e) =>
        e.morador.nome.toLowerCase().includes(term),
      );
    }

    // Filter by apartment for nested relation
    if (filters.apartamentoId) {
      results = results.filter(
        (e) => e.morador.apartamento?.id === filters.apartamentoId,
      );
    }

    return { data: results, total: count ?? 0 };
  }

  async register(input: RegisterPackageInput): Promise<Encomenda> {
    const { data, error } = await this.client
      .from('encomendas')
      .insert({
        morador_id: input.moradorId,
        codigo_rastreio: input.codigoRastreio,
        descricao: input.descricao,
        received_by: input.receivedBy,
        status: 'pendente',
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return toDomain(data);
  }

  async markWithdrawn(id: number): Promise<Encomenda> {
    const { data, error } = await this.client
      .from('encomendas')
      .update({
        status: 'retirada',
        data_retirada: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return toDomain(data);
  }

  async markDelivered(ids: number[]): Promise<void> {
    const { data, error } = await this.client
      .from('encomendas')
      .update({
        status: 'entregue',
        data_retirada: new Date().toISOString(),
      })
      .in('id', ids)
      .select('id');

    if (error) throw new Error(error.message);
    if ((data?.length ?? 0) !== ids.length) {
      throw new Error(`Expected ${ids.length} updates but got ${data?.length ?? 0}`);
    }
  }
}
