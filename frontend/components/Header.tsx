"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ShieldCheck, Users } from "lucide-react";
import { cx } from "./ui";

// The app always runs as the default admin (see lib/view.tsx); the switch only changes dashboards.
export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const onAdmin = pathname.startsWith("/admin");

  return (
    <header className="sticky top-0 z-40 bg-brand text-white shadow">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-lg font-bold tracking-tight">RB<span className="text-accent">Connect</span></span>
        </Link>

        <div className="ml-auto flex rounded-full bg-brand-dark p-1 text-sm" role="tablist" aria-label="Dashboard">
          <button role="tab" aria-selected={!onAdmin} onClick={() => router.push("/")}
            className={cx("flex items-center gap-1.5 rounded-full px-3 py-1 font-medium transition", !onAdmin ? "bg-accent text-brand-dark" : "text-white/80 hover:text-white")}>
            <Users className="h-4 w-4" /> Main
          </button>
          <button role="tab" aria-selected={onAdmin} onClick={() => router.push("/admin")}
            className={cx("flex items-center gap-1.5 rounded-full px-3 py-1 font-medium transition", onAdmin ? "bg-accent text-brand-dark" : "text-white/80 hover:text-white")}>
            <ShieldCheck className="h-4 w-4" /> Admin
          </button>
        </div>
      </div>
    </header>
  );
}
