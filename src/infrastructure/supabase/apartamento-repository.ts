import type { SupabaseClient } from '@supabase/supabase-js';
import type { Apartamento } from '@/domain/entities/apartamento';
import type {
  ApartamentoRepository,
  CreateApartmentInput,
  UpdateApartmentInput,
} from '@/domain/repositories/apartamento-repository';

type ApartamentoRow = {
  id: number;
  numero: string;
  bloco: string;
  created_at: string;
};

function toDomain(row: ApartamentoRow): Apartamento {
  return {
    id: row.id,
    numero: row.numero,
    bloco: row.bloco,
    createdAt: row.created_at,
  };
}

export class SupabaseApartamentoRepository implements ApartamentoRepository {
  constructor(private client: SupabaseClient) {}

  async list(): Promise<Apartamento[]> {
    const { data, error } = await this.client
      .from('apartamentos')
      .select('*')
      .order('bloco', { ascending: true })
      .order('numero', { ascending: true });

    if (error) throw new Error(error.message);
    return (data ?? []).map(toDomain);
  }

  async findById(id: number): Promise<Apartamento | null> {
    const { data, error } = await this.client
      .from('apartamentos')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(error.message);
    }
    return toDomain(data);
  }

  async create(input: CreateApartmentInput): Promise<Apartamento> {
    const { data, error } = await this.client
      .from('apartamentos')
      .insert({ numero: input.numero, bloco: input.bloco })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new Error('Este apartamento já está cadastrado.');
      }
      throw new Error(error.message);
    }
    return toDomain(data);
  }

  async update(
    id: number,
    input: UpdateApartmentInput,
  ): Promise<Apartamento> {
    const { data, error } = await this.client
      .from('apartamentos')
      .update({ numero: input.numero, bloco: input.bloco })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new Error('Este apartamento já está cadastrado.');
      }
      throw new Error(error.message);
    }
    return toDomain(data);
  }

  async delete(id: number): Promise<void> {
    const { error } = await this.client
      .from('apartamentos')
      .delete()
      .eq('id', id);

    if (error) {
      if (error.code === '23503') {
        throw new Error(
          'Não é possível excluir: existem moradores vinculados a este apartamento.',
        );
      }
      throw new Error(error.message);
    }
  }
}
