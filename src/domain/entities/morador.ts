export type Morador = {
  id: number;
  condominioId: string;
  nome: string;
  contato: string | null;
  cpf: string | null;
  signatureUrl: string | null;
  apartamentoId: number | null;
  createdBy: string | null;
  createdAt: string;
};
