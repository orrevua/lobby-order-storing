import type { Apartamento } from "@/domain/entities";
import { deleteApartment } from "@/lib/actions/apartments";

type ApartamentoListProps = {
  apartamentos: Apartamento[];
  canDelete: boolean;
};

export function ApartamentoList({ apartamentos, canDelete }: ApartamentoListProps) {
  if (apartamentos.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-text-tertiary">
        Nenhum apartamento cadastrado.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="min-w-full divide-y divide-border text-sm">
        <thead className="bg-bg-secondary">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-text-secondary">
              Bloco
            </th>
            <th className="px-4 py-3 text-left font-medium text-text-secondary">
              Número
            </th>
            {canDelete && (
              <th className="px-4 py-3 text-right font-medium text-text-secondary">
                Ações
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-bg-tertiary">
          {apartamentos.map((apt) => {
            async function handleExcluir() {
              "use server";
              await deleteApartment(apt.id);
            }

            return (
              <tr key={apt.id} className="hover:bg-bg-secondary">
                <td className="px-4 py-3 text-text-primary">{apt.bloco}</td>
                <td className="px-4 py-3 text-text-primary">{apt.numero}</td>
                {canDelete && (
                  <td className="px-4 py-3 text-right">
                    <form action={handleExcluir} className="inline">
                      <button
                        type="submit"
                        className="rounded px-2 py-1 text-xs font-medium text-error hover:bg-error/10"
                      >
                        Excluir
                      </button>
                    </form>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
