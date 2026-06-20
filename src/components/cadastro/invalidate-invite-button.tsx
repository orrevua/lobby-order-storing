'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { invalidateInvite } from '@/lib/actions/invites';

export function InvalidateInviteButton({ inviteId }: { inviteId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleInvalidate() {
    setLoading(true);
    await invalidateInvite(inviteId);
    router.refresh();
  }

  return (
    <button
      onClick={handleInvalidate}
      disabled={loading}
      className="rounded-md border border-error/30 px-2 py-1 text-xs font-medium text-error hover:bg-error/10 disabled:opacity-50"
    >
      {loading ? '...' : 'Invalidar'}
    </button>
  );
}
