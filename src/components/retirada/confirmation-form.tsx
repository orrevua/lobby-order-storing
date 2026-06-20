'use client';

import { useState } from 'react';
import { formatCPF } from '@/domain/validators/cpf';

type PackageItem = {
  id: number;
  descricao: string | null;
  codigoRastreio: string | null;
  moradorNome: string;
};

type Props = {
  sessionId: string;
  moradorNome: string;
  prefillCpf: string | null;
  signatureImageUrl: string | null;
  moradorSignaturePath: string | null;
  encomendas: PackageItem[];
};

type Step = 'packages' | 'confirm' | 'submitting' | 'success' | 'error';

export function ConfirmationForm({ sessionId, moradorNome, prefillCpf, signatureImageUrl, moradorSignaturePath, encomendas }: Props) {
  const [step, setStep] = useState<Step>('packages');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit() {
    setStep('submitting');
    setErrorMsg('');

    try {
      const res = await fetch(`/api/retirada/${sessionId}/confirmar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpf: prefillCpf, signatureUrl: moradorSignaturePath }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setStep('success');
      } else {
        throw new Error(data.error ?? 'Erro ao confirmar.');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro de conexão.');
      setStep('error');
    }
  }

  if (step === 'success') {
    return (
      <div className="rounded-xl border border-success/30 bg-success/5 p-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
          <svg className="h-6 w-6 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-lg font-medium text-success">Retirada confirmada!</p>
        <p className="mt-2 text-sm text-text-tertiary">Você pode fechar esta página.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-bg-secondary p-6">
      {step === 'packages' && (
        <>
          <h1 className="text-lg font-semibold text-text-primary">Confirmar Retirada</h1>
          <p className="mt-1 text-sm text-text-tertiary">
            {encomendas.length} encomenda{encomendas.length > 1 ? 's' : ''} para retirada
          </p>
          <ul className="mt-4 space-y-2">
            {encomendas.map((e) => (
              <li key={e.id} className="rounded-lg border border-border bg-bg-primary px-4 py-3">
                <p className="text-sm font-medium text-text-primary">{e.descricao ?? 'Encomenda'}</p>
                {e.codigoRastreio && <p className="text-xs text-text-tertiary">{e.codigoRastreio}</p>}
                <p className="text-xs text-text-secondary">{e.moradorNome}</p>
              </li>
            ))}
          </ul>
          <button
            onClick={() => setStep('confirm')}
            className="mt-5 w-full rounded-lg bg-accent px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
          >
            Continuar
          </button>
        </>
      )}

      {step === 'confirm' && (
        <>
          <h1 className="text-lg font-semibold text-text-primary">Confirme seus dados</h1>
          <p className="mt-1 text-sm text-text-tertiary">Verifique suas informações antes de confirmar</p>

          <div className="mt-4 space-y-4">
            <div className="rounded-lg border border-border bg-bg-primary px-4 py-3">
              <p className="text-xs font-medium text-text-tertiary">Nome</p>
              <p className="mt-1 text-base text-text-primary">{moradorNome}</p>
            </div>

            <div className="rounded-lg border border-border bg-bg-primary px-4 py-3">
              <p className="text-xs font-medium text-text-tertiary">CPF</p>
              <p className="mt-1 text-lg tracking-wider text-text-primary">
                {prefillCpf ? formatCPF(prefillCpf) : <span className="text-sm text-text-tertiary">CPF não cadastrado</span>}
              </p>
            </div>

            <div className="rounded-lg border border-border bg-bg-primary px-4 py-3">
              <p className="text-xs font-medium text-text-tertiary">Assinatura</p>
              {signatureImageUrl ? (
                <img src={signatureImageUrl} alt="Assinatura" className="mt-2 h-24 w-auto rounded border border-border object-contain" />
              ) : (
                <p className="mt-1 text-sm text-text-tertiary">Assinatura não cadastrada</p>
              )}
            </div>
          </div>

          <div className="mt-5 flex gap-2">
            <button
              onClick={() => setStep('packages')}
              className="flex-1 rounded-lg border border-border bg-bg-primary px-4 py-3 text-sm font-medium text-text-primary hover:bg-bg-tertiary"
            >
              Voltar
            </button>
            <button
              onClick={handleSubmit}
              className="flex-1 rounded-lg bg-accent px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
            >
              Confirmar Retirada
            </button>
          </div>
        </>
      )}

      {step === 'submitting' && (
        <div className="py-8 text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <p className="text-sm text-text-tertiary">Processando...</p>
        </div>
      )}

      {step === 'error' && (
        <div className="text-center">
          <p className="text-sm text-error">{errorMsg}</p>
          <button
            onClick={() => setStep('confirm')}
            className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
          >
            Tentar novamente
          </button>
        </div>
      )}
    </div>
  );
}
