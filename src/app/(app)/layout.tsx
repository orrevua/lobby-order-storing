import { Sidebar } from "@/components/layout/sidebar";
import { getServerUserWithCondo } from "@/infrastructure/supabase/server";
import { redirect } from "next/navigation";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getServerUserWithCondo();
  if (!ctx) redirect("/login");

  return (
    <>
      <Sidebar role={ctx.role} />
      <main className="flex-1 overflow-y-auto px-6 py-8 md:px-10">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </>
  );
}
