import type { Apartamento } from '../entities/apartamento';

export type CreateApartmentInput = {
  condominioId: string;
  numero: string;
  bloco: string;
};

export type UpdateApartmentInput = {
  numero: string;
  bloco: string;
};

export interface ApartamentoRepository {
  list(condominioId: string): Promise<Apartamento[]>;
  findById(id: number): Promise<Apartamento | null>;
  create(data: CreateApartmentInput): Promise<Apartamento>;
  update(id: number, data: UpdateApartmentInput): Promise<Apartamento>;
  delete(id: number): Promise<void>;
}
