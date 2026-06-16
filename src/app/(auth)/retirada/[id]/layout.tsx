export default function RetiradaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-primary p-4">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
