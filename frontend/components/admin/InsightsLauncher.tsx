"use client";
import { useState } from "react";
import { Bot, X } from "lucide-react";
import { useView } from "@/lib/view";
import { cx, Modal } from "../ui";
import AgentChat from "./AgentChat";
import PostDetail from "../discussion/PostDetail";

// Floating round button (bottom right) that opens the Insights Agent chat on any page.
// The chat stays mounted while hidden so the conversation survives closing the panel.
export default function InsightsLauncher() {
  const { isAdmin } = useView();
  const [open, setOpen] = useState(false);
  const [post, setPost] = useState<number | null>(null);
  if (!isAdmin) return null;

  return (
    <>
      <div className={cx("fixed bottom-24 right-4 z-40 w-[calc(100vw-2rem)] max-w-sm sm:right-6", !open && "hidden")}>
        <AgentChat onOpenPost={setPost} onClose={() => setOpen(false)} className="h-[min(560px,calc(100vh-9rem))] shadow-2xl" />
      </div>

      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close Insights Agent" : "Open Insights Agent"}
        aria-expanded={open}
        title="Insights Agent"
        className="fixed bottom-6 right-4 z-40 grid h-14 w-14 place-items-center rounded-full bg-brand text-white shadow-lg ring-4 ring-accent/60 transition hover:bg-brand-dark hover:shadow-xl sm:right-6"
      >
        {open ? <X className="h-6 w-6" /> : <Bot className="h-6 w-6" />}
      </button>

      <Modal open={post !== null} onClose={() => setPost(null)} title={`Post #${post}`} wide>
        <div className="-m-5 h-[70vh]">{post !== null && <PostDetail postId={post} onChanged={() => {}} />}</div>
      </Modal>
    </>
  );
}
