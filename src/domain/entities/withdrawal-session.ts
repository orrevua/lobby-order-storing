export type WithdrawalSessionStatus = 'pending' | 'confirmed' | 'expired' | 'cancelled';
export type ConfirmationMethod = 'qr_scan' | 'manual';
export type ManualReason = 'sem_celular' | 'idoso' | 'portador_necessidades' | 'outro';

export type WithdrawalSession = {
  id: string;
  apartamentoId: number;
  encomendaIds: number[];
  status: WithdrawalSessionStatus;
  confirmationMethod: ConfirmationMethod | null;
  manualReason: ManualReason | null;
  doormanNote: string | null;
  createdBy: string | null;
  confirmedBy: string | null;
  createdAt: string;
  expiresAt: string;
  cpfConfirmacao: string | null;
  signatureUrl: string | null;
  confirmedAt: string | null;
};
