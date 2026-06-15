import type { Apartamento } from '../entities/apartamento';
import type { Morador } from '../entities/morador';

export type CreateResidentInput = {
  nome: string;
  contato: string | null;
  cpf: string | null;
  signatureUrl: string | null;
  apartamentoId: number;
};

export type UpdateResidentInput = {
  nome: string;
  contato: string | null;
  cpf: string | null;
  signatureUrl: string | null;
  apartamentoId: number;
};

export interface MoradorRepository {
  list(): Promise<(Morador & { apartamento: Apartamento | null })[]>;
  listByApartment(apartamentoId: number): Promise<Morador[]>;
  findById(id: number): Promise<Morador | null>;
  create(data: CreateResidentInput): Promise<Morador>;
  update(id: number, data: UpdateResidentInput): Promise<Morador>;
  delete(id: number): Promise<void>;
}
