import { Suspense } from 'react';
import { SignupForm } from './signup-form';

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="w-full max-w-md rounded-xl border border-border bg-bg-secondary p-8 shadow-sm animate-pulse">
        <div className="h-8 bg-bg-tertiary rounded w-48 mb-4" />
        <div className="space-y-4">
          <div className="h-10 bg-bg-tertiary rounded" />
          <div className="h-10 bg-bg-tertiary rounded" />
          <div className="h-10 bg-bg-tertiary rounded" />
        </div>
      </div>
    }>
      <SignupForm />
    </Suspense>
  );
}
