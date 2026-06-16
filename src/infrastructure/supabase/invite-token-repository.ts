import type { SupabaseClient } from '@supabase/supabase-js';
import type { InviteToken } from '@/domain/entities/invite-token';
import type { InviteTokenRepository, CreateInviteTokenInput } from '@/domain/repositories/invite-token-repository';

type InviteTokenRow = {
  id: string;
  condominio_id: string;
  token: string;
  created_by: string;
  expires_at: string | null;
  max_uses: number | null;
  use_count: number;
  created_at: string;
};

function toDomain(row: InviteTokenRow): InviteToken {
  return {
    id: row.id,
    condominioId: row.condominio_id,
    token: row.token,
    createdBy: row.created_by,
    expiresAt: row.expires_at,
    maxUses: row.max_uses,
    useCount: row.use_count,
    createdAt: row.created_at,
  };
}

export class SupabaseInviteTokenRepository implements InviteTokenRepository {
  constructor(private client: SupabaseClient) {}

  async findByToken(token: string): Promise<InviteToken | null> {
    const { data, error } = await this.client
      .from('invite_tokens')
      .select('*')
      .eq('token', token)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(error.message);
    }
    return toDomain(data);
  }

  async listByCondominium(condominioId: string): Promise<InviteToken[]> {
    const { data, error } = await this.client
      .from('invite_tokens')
      .select('*')
      .eq('condominio_id', condominioId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return (data ?? []).map(toDomain);
  }

  async create(input: CreateInviteTokenInput): Promise<InviteToken> {
    const { data, error } = await this.client
      .from('invite_tokens')
      .insert({
        condominio_id: input.condominioId,
        token: input.token,
        created_by: input.createdBy,
        expires_at: input.expiresAt,
        max_uses: input.maxUses,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return toDomain(data);
  }

  async incrementUseCount(id: string): Promise<void> {
    const { data, error: fetchError } = await this.client
      .from('invite_tokens')
      .select('use_count')
      .eq('id', id)
      .single();

    if (fetchError) throw new Error(fetchError.message);

    const { error } = await this.client
      .from('invite_tokens')
      .update({ use_count: data.use_count + 1 })
      .eq('id', id);

    if (error) throw new Error(error.message);
  }
}
