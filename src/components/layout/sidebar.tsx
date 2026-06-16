"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabaseClient } from "@/infrastructure/supabase/client";

type NavItem = {
  label: string;
  href: string;
  children?: { label: string; href: string }[];
};

const ALL_NAV: NavItem[] = [
  { label: "Portaria", href: "/portaria" },
  { label: "Consulta", href: "/consulta" },
  {
    label: "Cadastro",
    href: "/cadastro",
    children: [
      { label: "Apartamentos", href: "/cadastro/apartamentos" },
      { label: "Moradores", href: "/cadastro/moradores" },
      { label: "Convites", href: "/cadastro/convites" },
    ],
  },
];

const MORADOR_NAV: NavItem[] = [
  {
    label: "Cadastro",
    href: "/cadastro",
    children: [
      { label: "Moradores", href: "/cadastro/moradores" },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cadastroOpen, setCadastroOpen] = useState(
    pathname.startsWith("/cadastro"),
  );
  const [loggingOut, setLoggingOut] = useState(false);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    supabaseClient.auth.getUser().then(({ data: { user } }) => {
      setRole(user?.app_metadata.role || "morador");
    });
  }, []);

  const navItems = role === "morador" ? MORADOR_NAV : ALL_NAV;

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  async function handleLogout() {
    setLoggingOut(true);
    await supabaseClient.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const nav = (
    <nav className="flex flex-col gap-1 px-3">
      {navItems.map((item) =>
        item.children ? (
          <div key={item.href}>
            <button
              type="button"
              onClick={() => setCadastroOpen((prev) => !prev)}
              className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive(item.href)
                  ? "bg-accent text-white"
                  : "text-bg-secondary hover:bg-bg-tertiary hover:text-bg-primary"
              }`}
            >
              {item.label}
              <svg
                className={`h-4 w-4 transition-transform ${cadastroOpen ? "rotate-90" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
            {cadastroOpen && (
              <div className="ml-3 mt-1 flex flex-col gap-1">
                {item.children.map((child) => (
                  <Link
                    key={child.href}
                    href={child.href}
                    onClick={() => setMobileOpen(false)}
                    className={`rounded-md px-3 py-2 text-sm transition-colors ${
                      isActive(child.href)
                        ? "bg-accent text-white"
                        : "text-bg-tertiary hover:bg-bg-tertiary hover:text-bg-primary"
                    }`}
                  >
                    {child.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ) : (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              isActive(item.href)
                ? "bg-accent text-white"
                : "text-bg-secondary hover:bg-bg-tertiary hover:text-bg-primary"
            }`}
          >
            {item.label}
          </Link>
        ),
      )}
    </nav>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-4 z-40 rounded-md bg-text-primary p-2 text-bg-primary md:hidden"
        aria-label="Abrir menu"
      >
        <svg
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-text-primary transition-transform md:static md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center">
            <Image src="/logo-light.svg" alt="LobbyEasy" width={160} height={32} priority />
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="rounded-md p-1 text-bg-tertiary hover:text-bg-primary md:hidden"
            aria-label="Fechar menu"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="mt-4 flex-1 overflow-y-auto">{nav}</div>

        <div className="px-3 py-4">
          <button
            type="button"
            disabled={loggingOut}
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-bg-secondary transition-colors hover:bg-bg-tertiary hover:text-bg-primary disabled:opacity-50"
          >
            {loggingOut ? (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            )}
            {loggingOut ? "Saindo..." : "Sair"}
          </button>
        </div>
      </aside>
    </>
  );
}
