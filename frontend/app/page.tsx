"use client";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, MessagesSquare } from "lucide-react";
import Board from "@/components/discussion/Board";
import EventsView from "@/components/events/EventsView";
import { Spinner, Tabs } from "@/components/ui";

function MainDashboard() {
  const params = useSearchParams();
  const router = useRouter();
  const tab = params.get("tab") === "events" ? "events" : "discussion";
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-brand-dark">Early Talent Community</h1>
        <p className="text-sm text-muted">Share what&apos;s on your mind — publicly, anonymously, or privately with HR.</p>
      </div>
      <Tabs
        tabs={[{ id: "discussion", label: "Discussion", icon: <MessagesSquare className="h-4 w-4" /> },
               { id: "events", label: "Events", icon: <CalendarDays className="h-4 w-4" /> }]}
        value={tab}
        onChange={(t) => router.replace(t === "events" ? "/?tab=events" : "/")}
      />
      {tab === "discussion" ? <Board /> : <EventsView />}
    </div>
  );
}

export default function Page() {
  return <Suspense fallback={<Spinner />}><MainDashboard /></Suspense>;
}
