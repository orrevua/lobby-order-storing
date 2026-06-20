export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen w-full">
      <div className="hidden w-1/2 flex-col justify-between bg-gradient-to-br from-accent/[0.07] via-bg-secondary to-bg-tertiary/60 p-12 lg:flex">
        <div className="flex items-center gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" className="h-8 w-8">
            <path d="M6 15 L16 19 L16 30 L6 26 Z" fill="#C2410C" opacity="0.25" stroke="#C2410C" strokeWidth="1.5" strokeLinejoin="round"/>
            <path d="M16 19 L28 14 L28 25 L16 30 Z" fill="#C2410C" opacity="0.12" stroke="#C2410C" strokeWidth="1.5" strokeLinejoin="round"/>
            <path d="M6 15 L16 10 L28 14 L16 19 Z" fill="#C2410C" opacity="0.06" stroke="#C2410C" strokeWidth="1.5" strokeLinejoin="round"/>
            <path d="M6 15 L16 10 L12 3 L2 8 Z" fill="#C2410C" opacity="0.18" stroke="#C2410C" strokeWidth="1.5" strokeLinejoin="round"/>
            <path d="M16 10 L28 14 L30 6 L18 2 Z" fill="#C2410C" opacity="0.1" stroke="#C2410C" strokeWidth="1.5" strokeLinejoin="round"/>
          </svg>
          <span className="text-lg font-semibold text-text-primary">LobbyEasy</span>
        </div>

        <div className="flex flex-1 items-center justify-center">
          <LoginIllustration />
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium text-text-secondary">
            Controle de encomendas simplificado
          </p>
          <div className="flex gap-6">
            <Feature icon={<PackageIcon />} text="Registro rápido" />
            <Feature icon={<QrIcon />} text="Retirada por QR" />
            <Feature icon={<ShieldIcon />} text="Rastreamento seguro" />
          </div>
        </div>
      </div>

      <div className="flex w-full items-center justify-center px-6 lg:w-1/2">
        {children}
      </div>
    </div>
  );
}

function Feature({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2 text-text-tertiary">
      {icon}
      <span className="text-xs">{text}</span>
    </div>
  );
}

function PackageIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  );
}

function QrIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  );
}

function LoginIllustration() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" className="w-full max-w-[220px] opacity-80">
      <path d="M6 15 L16 19 L16 30 L6 26 Z" fill="#C2410C" opacity="0.25" stroke="#C2410C" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M16 19 L28 14 L28 25 L16 30 Z" fill="#C2410C" opacity="0.12" stroke="#C2410C" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M6 15 L16 10 L28 14 L16 19 Z" fill="#C2410C" opacity="0.06" stroke="#C2410C" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M6 15 L16 10 L12 3 L2 8 Z" fill="#C2410C" opacity="0.18" stroke="#C2410C" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M16 10 L28 14 L30 6 L18 2 Z" fill="#C2410C" opacity="0.1" stroke="#C2410C" strokeWidth="1.5" strokeLinejoin="round"/>
    </svg>
  );
}
