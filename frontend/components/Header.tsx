"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ShieldCheck, Users, Eye } from "lucide-react";
import { useView, DEFAULT_ADMIN_ID } from "@/lib/view";
import { PROGRAM_LABEL } from "@/lib/format";
import { cx } from "./ui";

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { meta, actingUser, setActingUser } = useView();
  const onAdmin = pathname.startsWith("/admin");

  const goto = (dest: "main" | "admin") => {
    if (dest === "admin") {
      if (actingUser?.role !== "admin") setActingUser(DEFAULT_ADMIN_ID);
      router.push("/admin");
    } else router.push("/");
  };

  return (
    <header className="sticky top-0 z-40 bg-brand text-white shadow">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-accent text-sm font-black text-brand-dark">RB</span>
          <span className="text-lg font-bold tracking-tight">RB<span className="text-accent">Connect</span></span>
        </Link>

        <div className="ml-auto flex flex-wrap items-center gap-3">
          {!onAdmin && meta && (
            <label className="flex items-center gap-2 text-xs text-white/80">
              <Eye className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Viewing as</span>
              <select
                className="max-w-[12rem] rounded-md border border-white/30 bg-brand-dark px-2 py-1 text-xs text-white outline-none focus:ring-2 focus:ring-accent"
                value={actingUser?.id ?? DEFAULT_ADMIN_ID}
                onChange={(e) => setActingUser(Number(e.target.value))}
              >
                <optgroup label="Admin / HR">
                  {meta.personas.filter((p) => p.role === "admin").map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </optgroup>
                <optgroup label="Participants (preview)">
                  {meta.personas.filter((p) => p.role === "participant").map((p) => (
                    <option key={p.id} value={p.id}>{p.name} · {PROGRAM_LABEL[p.program ?? ""]}</option>
                  ))}
                </optgroup>
              </select>
            </label>
          )}

          <div className="flex rounded-full bg-brand-dark p-1 text-sm" role="tablist" aria-label="Dashboard">
            <button role="tab" aria-selected={!onAdmin} onClick={() => goto("main")}
              className={cx("flex items-center gap-1.5 rounded-full px-3 py-1 font-medium transition", !onAdmin ? "bg-accent text-brand-dark" : "text-white/80 hover:text-white")}>
              <Users className="h-4 w-4" /> Main
            </button>
            <button role="tab" aria-selected={onAdmin} onClick={() => goto("admin")}
              className={cx("flex items-center gap-1.5 rounded-full px-3 py-1 font-medium transition", onAdmin ? "bg-accent text-brand-dark" : "text-white/80 hover:text-white")}>
              <ShieldCheck className="h-4 w-4" /> Admin
            </button>
          </div>
        </div>
      </div>
      {actingUser?.role === "participant" && !onAdmin && (
        <div className="bg-accent px-4 py-1.5 text-center text-xs font-medium text-brand-dark">
          Previewing as participant <b>{actingUser.name}</b>. Switch to Admin to return to HR view.
        </div>
      )}
    </header>
  );
}
