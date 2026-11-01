"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/icon";

const items: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Dashboard", icon: "dashboard" },
  { href: "/sales-reports", label: "Sales Reports", icon: "reports" },
  { href: "/upload-report", label: "Upload Report", icon: "upload" },
  { href: "/ai-assistant", label: "AI Assistant", icon: "assistant" },
];

export function Navigation() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main navigation" className="grid grid-cols-2 gap-2 lg:grid-cols-1">
      {items.map(({ href, label, icon }) => {
        const active = pathname === href;
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors ${active ? "bg-emerald-50 text-emerald-900" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"}`}>
            <Icon name={icon} />{label}
          </Link>
        );
      })}
    </nav>
  );
}
