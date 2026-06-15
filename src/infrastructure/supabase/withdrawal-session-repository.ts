import type { SupabaseClient } from '@supabase/supabase-js';
import type { WithdrawalSession } from '@/domain/entities/withdrawal-session';
import type {
  WithdrawalSessionRepository,
  CreateSessionInput,
  ConfirmSessionInput,
} from '@/domain/repositories/withdrawal-session-repository';

type SessionRow = {
  id: string;
  apartamento_id: number;
  encomenda_ids: number[];
  status: string;
  confirmation_method: string | null;
  manual_reason: string | null;
  doorman_note: string | null;
  created_by: string | null;
  confirmed_by: string | null;
  created_at: string;
  expires_at: string;
  cpf_confirmacao: string | null;
  signature_url: string | null;
  confirmed_at: string | null;
};

function toDomain(row: SessionRow): WithdrawalSession {
  return {
    id: row.id,
    apartamentoId: row.apartamento_id,
    encomendaIds: row.encomenda_ids,
    status: row.status as WithdrawalSession['status'],
    confirmationMethod: row.confirmation_method as WithdrawalSession['confirmationMethod'],
    manualReason: row.manual_reason as WithdrawalSession['manualReason'],
    doormanNote: row.doorman_note,
    createdBy: row.created_by,
    confirmedBy: row.confirmed_by,
    cpfConfirmacao: row.cpf_confirmacao,
    signatureUrl: row.signature_url,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    confirmedAt: row.confirmed_at,
  };
}

export class SupabaseWithdrawalSessionRepository implements WithdrawalSessionRepository {
  constructor(private client: SupabaseClient) {}

  async create(data: CreateSessionInput): Promise<WithdrawalSession> {
    const { data: row, error } = await this.client
      .from('withdrawal_sessions')
      .insert({
        apartamento_id: data.apartamentoId,
        encomenda_ids: data.encomendaIds,
        expires_at: data.expiresAt,
        created_by: data.createdBy,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return toDomain(row);
  }

  async findById(id: string): Promise<WithdrawalSession | null> {
    const { data: row, error } = await this.client
      .from('withdrawal_sessions')
      .select()
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(error.message);
    }
    return toDomain(row);
  }

  async confirm(id: string, data: ConfirmSessionInput): Promise<WithdrawalSession> {
    const { data: row, error } = await this.client
      .from('withdrawal_sessions')
      .update({
        status: 'confirmed',
        confirmation_method: data.confirmationMethod,
        confirmed_by: data.confirmedBy,
        manual_reason: data.manualReason ?? null,
        doorman_note: data.doormanNote ?? null,
        cpf_confirmacao: data.cpfConfirmacao ?? null,
        signature_url: data.signatureUrl ?? null,
        confirmed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return toDomain(row);
  }

  async cancel(id: string): Promise<void> {
    const { error } = await this.client
      .from('withdrawal_sessions')
      .update({ status: 'cancelled' })
      .eq('id', id);

    if (error) throw new Error(error.message);
  }

  async expireOverdue(): Promise<number> {
    const { data, error } = await this.client
      .from('withdrawal_sessions')
      .update({ status: 'expired' })
      .eq('status', 'pending')
      .lt('expires_at', new Date().toISOString())
      .select('id');

    if (error) throw new Error(error.message);
    return data?.length ?? 0;
  }
}
