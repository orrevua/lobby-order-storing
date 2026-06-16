import type { Condominium } from '../entities/condominium';

export type CreateCondominiumInput = {
  name: string;
  address: string | null;
};

export interface CondominiumRepository {
  findById(id: string): Promise<Condominium | null>;
  create(data: CreateCondominiumInput): Promise<Condominium>;
}
