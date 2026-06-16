'use client';

import { useState, useTransition } from 'react';
import { createInvite } from '@/lib/actions/invites';

export function InviteForm() {
  const [isPending, startTransition] = useTransition();
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    setGeneratedUrl(null);
    startTransition(async () => {
      const result = await createInvite(formData);
      if (!result.success) {
        setError(result.error);
      } else {
        const url = `${window.location.origin}/signup?token=${result.data!.token}`;
        setGeneratedUrl(url);
      }
    });
  }

  async function handleCopy() {
    if (!generatedUrl) return;
    await navigator.clipboard.writeText(generatedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-lg border border-border bg-bg-secondary p-4">
      <h3 className="mb-3 text-sm font-semibold text-text-primary">Gerar Novo Convite</h3>
      {error && <p className="mb-3 text-sm text-error">{error}</p>}

      <form action={handleSubmit} className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="invite-max-uses" className="text-sm font-medium text-text-secondary">
            Máx. de usos
          </label>
          <input
            id="invite-max-uses"
            name="max_uses"
            type="number"
            min="1"
            placeholder="Ilimitado"
            className="w-32 rounded-md border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="invite-expires" className="text-sm font-medium text-text-secondary">
            Expira em
          </label>
          <input
            id="invite-expires"
            name="expires_at"
            type="date"
            className="rounded-md border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {isPending ? 'Gerando...' : 'Gerar Link'}
        </button>
      </form>

      {generatedUrl && (
        <div className="mt-4 flex items-center gap-2 rounded-md border border-accent/30 bg-accent/5 p-3">
          <code className="flex-1 text-xs text-text-primary break-all">{generatedUrl}</code>
          <button
            type="button"
            onClick={handleCopy}
            className="shrink-0 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover"
          >
            {copied ? 'Copiado!' : 'Copiar'}
          </button>
        </div>
      )}
    </div>
  );
}
