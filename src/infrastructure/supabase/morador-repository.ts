import type { SupabaseClient } from '@supabase/supabase-js';
import type { Apartamento } from '@/domain/entities/apartamento';
import type { Morador } from '@/domain/entities/morador';
import type {
  MoradorRepository,
  CreateResidentInput,
  UpdateResidentInput,
} from '@/domain/repositories/morador-repository';

type MoradorRow = {
  id: number;
  nome: string;
  contato: string | null;
  cpf: string | null;
  signature_url: string | null;
  apartamento_id: number | null;
  created_at: string;
};

type ApartamentoRow = {
  id: number;
  numero: string;
  bloco: string;
  created_at: string;
};

function toDomain(row: MoradorRow): Morador {
  return {
    id: row.id,
    nome: row.nome,
    contato: row.contato,
    cpf: row.cpf,
    signatureUrl: row.signature_url,
    apartamentoId: row.apartamento_id,
    createdAt: row.created_at,
  };
}

function aptToDomain(row: ApartamentoRow): Apartamento {
  return {
    id: row.id,
    numero: row.numero,
    bloco: row.bloco,
    createdAt: row.created_at,
  };
}

export class SupabaseMoradorRepository implements MoradorRepository {
  constructor(private client: SupabaseClient) {}

  async list(): Promise<(Morador & { apartamento: Apartamento | null })[]> {
    const { data, error } = await this.client
      .from('moradores')
      .select('*, apartamento:apartamentos(*)')
      .order('nome', { ascending: true });

    if (error) throw new Error(error.message);

    return (data ?? []).map((row: any) => ({
      ...toDomain(row),
      apartamento: row.apartamento ? aptToDomain(row.apartamento) : null,
    }));
  }

  async listByApartment(apartamentoId: number): Promise<Morador[]> {
    const { data, error } = await this.client
      .from('moradores')
      .select('*')
      .eq('apartamento_id', apartamentoId)
      .order('nome', { ascending: true });

    if (error) throw new Error(error.message);
    return (data ?? []).map(toDomain);
  }

  async findById(id: number): Promise<Morador | null> {
    const { data, error } = await this.client
      .from('moradores')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(error.message);
    }
    return toDomain(data);
  }

  async create(input: CreateResidentInput): Promise<Morador> {
    const { data, error } = await this.client
      .from('moradores')
      .insert({
        nome: input.nome,
        contato: input.contato,
        cpf: input.cpf,
        signature_url: input.signatureUrl,
        apartamento_id: input.apartamentoId,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return toDomain(data);
  }

  async update(id: number, input: UpdateResidentInput): Promise<Morador> {
    const { data, error } = await this.client
      .from('moradores')
      .update({
        nome: input.nome,
        contato: input.contato,
        cpf: input.cpf,
        signature_url: input.signatureUrl,
        apartamento_id: input.apartamentoId,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return toDomain(data);
  }

  async delete(id: number): Promise<void> {
    const { error } = await this.client
      .from('moradores')
      .delete()
      .eq('id', id);

    if (error) {
      if (error.code === '23503') {
        throw new Error(
          'Não é possível excluir: este morador possui encomendas registradas.',
        );
      }
      throw new Error(error.message);
    }
  }
}
