import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  children?: ReactNode;
};

export function PageHeader({ title, children }: PageHeaderProps) {
  return (
    <header className="flex items-center justify-between pb-6">
      <h1 className="text-2xl font-semibold text-text-primary">{title}</h1>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </header>
  );
}
