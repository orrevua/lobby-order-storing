import { getServerUserWithCondo } from '@/infrastructure/supabase/server';
import { redirect } from 'next/navigation';
import { listInvites } from '@/lib/actions/invites';
import { InviteForm } from '@/components/cadastro/invite-form';
import { PageHeader } from '@/components/layout/page-header';

export default async function ConvitesPage() {
  const ctx = await getServerUserWithCondo();
  if (!ctx || ctx.role !== 'porteiro') redirect('/');

  const invites = await listInvites();

  return (
    <>
      <PageHeader title="Convites" />
      <div className="space-y-6">
        <InviteForm />
        {invites.length === 0 ? (
          <p className="py-8 text-center text-sm text-text-tertiary">
            Nenhum convite gerado.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-bg-secondary">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">Link</th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">Usos</th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">Expira em</th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">Criado em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bg-tertiary">
                {invites.map((invite) => (
                  <tr key={invite.id} className="hover:bg-bg-secondary">
                    <td className="px-4 py-3 text-text-primary">
                      <code className="text-xs break-all">/signup?token={invite.token.slice(0, 12)}...</code>
                    </td>
                    <td className="px-4 py-3 text-text-primary">
                      {invite.useCount}{invite.maxUses !== null ? ` / ${invite.maxUses}` : ''}
                    </td>
                    <td className="px-4 py-3 text-text-primary">
                      {invite.expiresAt
                        ? new Date(invite.expiresAt).toLocaleDateString('pt-BR')
                        : 'Sem limite'}
                    </td>
                    <td className="px-4 py-3 text-text-primary">
                      {new Date(invite.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
