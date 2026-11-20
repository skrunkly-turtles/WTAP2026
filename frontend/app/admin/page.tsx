"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, LayoutDashboard, MessageSquareWarning } from "lucide-react";
import Overview from "@/components/admin/Overview";
import AtRisk from "@/components/admin/AtRisk";
import ConcerningPosts from "@/components/admin/ConcerningPosts";
import PostDetail from "@/components/discussion/PostDetail";
import { cx, Modal, Spinner, Tabs } from "@/components/ui";
import { useView, DEFAULT_ADMIN_ID } from "@/lib/view";

function AdminDashboard() {
  const params = useSearchParams();
  const router = useRouter();
  const { isAdmin, setActingUser } = useView();
  const raw = params.get("tab");
  const tab = raw === "risk" || raw === "concerning" ? raw : "overview";
  const [program, setProgram] = useState<string | undefined>();
  const [openPost, setOpenPost] = useState<number | null>(null);

  // Admin dashboard always runs as an admin.
  useEffect(() => { if (!isAdmin) setActingUser(DEFAULT_ADMIN_ID); }, [isAdmin, setActingUser]);
  if (!isAdmin) return <Spinner />;

  const setTab = (t: string) => router.replace(t === "overview" ? "/admin" : `/admin?tab=${t}`);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand-dark">Admin & HR Dashboard</h1>
          <p className="text-sm text-muted">What early talent are telling us, who needs support, and what to do next.</p>
        </div>
        <div className="flex rounded-lg border border-line bg-white p-1 text-sm" role="group" aria-label="Program filter">
          {[{ id: undefined, label: "All" }, { id: "coop", label: "Co-op" }, { id: "new_grad", label: "New Grad" }].map((p) => (
            <button key={p.label} onClick={() => setProgram(p.id)}
              className={cx("rounded-md px-3 py-1 font-medium", program === p.id ? "bg-brand text-white" : "text-muted hover:text-ink")}>{p.label}</button>
          ))}
        </div>
      </div>
      <Tabs
        tabs={[{ id: "overview", label: "Overview", icon: <LayoutDashboard className="h-4 w-4" /> },
               { id: "concerning", label: "Concerning Posts", icon: <MessageSquareWarning className="h-4 w-4" /> },
               { id: "risk", label: "At-Risk", icon: <AlertTriangle className="h-4 w-4" /> }]}
        value={tab}
        onChange={setTab}
      />
      {tab === "overview" && <Overview program={program} onOpenPost={setOpenPost} onShowRisk={() => setTab("risk")} />}
      {tab === "concerning" && <ConcerningPosts program={program} onOpenPost={setOpenPost} />}
      {tab === "risk" && <AtRisk program={program} />}
      <Modal open={openPost !== null} onClose={() => setOpenPost(null)} title={`Post #${openPost}`} wide>
        <div className="-m-5 h-[70vh]">{openPost !== null && <PostDetail postId={openPost} onChanged={() => {}} />}</div>
      </Modal>
    </div>
  );
}

export default function Page() {
  return <Suspense fallback={<Spinner />}><AdminDashboard /></Suspense>;
}
