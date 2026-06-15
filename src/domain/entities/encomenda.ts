import type { Apartamento } from './apartamento';
import type { Morador } from './morador';

export type Encomenda = {
  id: number;
  codigoRastreio: string | null;
  descricao: string | null;
  status: 'pendente' | 'retirada' | 'entregue';
  dataChegada: string;
  dataRetirada: string | null;
  receivedBy: string | null;
  moradorId: number;
  createdAt: string;
};

export type EncomendaComMorador = Encomenda & {
  morador: Morador & {
    apartamento: Apartamento | null;
  };
};
