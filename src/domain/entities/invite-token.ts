export type InviteToken = {
  id: string;
  condominioId: string;
  token: string;
  createdBy: string;
  expiresAt: string | null;
  maxUses: number | null;
  useCount: number;
  createdAt: string;
};
