import type { InviteToken } from '../entities/invite-token';

export type CreateInviteTokenInput = {
  condominioId: string;
  token: string;
  createdBy: string;
  expiresAt: string | null;
  maxUses: number | null;
};

export interface InviteTokenRepository {
  findByToken(token: string): Promise<InviteToken | null>;
  listByCondominium(condominioId: string): Promise<InviteToken[]>;
  create(data: CreateInviteTokenInput): Promise<InviteToken>;
  incrementUseCount(id: string): Promise<void>;
  invalidate(id: string): Promise<void>;
}
