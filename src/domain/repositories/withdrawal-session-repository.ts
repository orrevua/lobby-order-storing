import type { WithdrawalSession, ConfirmationMethod, ManualReason } from '../entities/withdrawal-session';

export type CreateSessionInput = {
  apartamentoId: number;
  encomendaIds: number[];
  expiresAt: string;
  createdBy: string | null;
};

export type ConfirmSessionInput = {
  confirmationMethod: ConfirmationMethod;
  confirmedBy: string | null;
  manualReason?: ManualReason | null;
  doormanNote?: string | null;
  cpfConfirmacao?: string | null;
  signatureUrl?: string | null;
};

export interface WithdrawalSessionRepository {
  create(data: CreateSessionInput): Promise<WithdrawalSession>;
  findById(id: string): Promise<WithdrawalSession | null>;
  confirm(id: string, data: ConfirmSessionInput): Promise<WithdrawalSession>;
  cancel(id: string): Promise<void>;
  expireOverdue(): Promise<number>;
}
