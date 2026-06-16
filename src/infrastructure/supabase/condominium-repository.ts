import type { SupabaseClient } from '@supabase/supabase-js';
import type { Condominium } from '@/domain/entities/condominium';
import type { CondominiumRepository, CreateCondominiumInput } from '@/domain/repositories/condominium-repository';

type CondominiumRow = {
  id: string;
  name: string;
  address: string | null;
  created_at: string;
};

function toDomain(row: CondominiumRow): Condominium {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    createdAt: row.created_at,
  };
}

export class SupabaseCondominiumRepository implements CondominiumRepository {
  constructor(private client: SupabaseClient) {}

  async findById(id: string): Promise<Condominium | null> {
    const { data, error } = await this.client
      .from('condominios')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(error.message);
    }
    return toDomain(data);
  }

  async create(input: CreateCondominiumInput): Promise<Condominium> {
    const { data, error } = await this.client
      .from('condominios')
      .insert({ name: input.name, address: input.address })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return toDomain(data);
  }
}
