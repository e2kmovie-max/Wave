import Link from "next/link";
import { requireAdminUser } from "@/lib/admin-access";

export const dynamic = "force-dynamic";

const sections = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/channels", label: "Required channels" },
  { href: "/admin/cookies", label: "Cookie pool" },
  { href: "/admin/instances", label: "Instances" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdminUser();

  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col px-6 py-10">
      <header className="mb-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-sm text-[var(--color-muted)] hover:underline">
          ← Home
        </Link>
        <span className="text-xs uppercase tracking-wider text-[var(--color-muted)]">Wave admin</span>
      </header>

      <nav className="mb-6 flex flex-wrap gap-2 border-b border-white/5 pb-3">
        {sections.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="rounded-md px-3 py-1.5 text-sm text-[var(--color-muted)] hover:bg-white/5 hover:text-[var(--color-fg)]"
          >
            {section.label}
          </Link>
        ))}
      </nav>

      {children}
    </main>
  );
}
