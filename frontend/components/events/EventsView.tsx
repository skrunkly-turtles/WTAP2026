"use client";
import { useEffect, useState } from "react";
import { CalendarDays, MapPin, Plus, Users } from "lucide-react";
import { api, EventItem } from "@/lib/api";
import { useView } from "@/lib/view";
import { formatDateTime } from "@/lib/format";
import { Badge, Button, Card, cx, ErrorNote, Field, inputCls, Modal, Spinner } from "../ui";

function CreateEventModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [f, setF] = useState({ title: "", description: "", starts_at: "", location: "", capacity: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      await api.createEvent({ ...f, capacity: f.capacity ? Number(f.capacity) : null });
      setF({ title: "", description: "", starts_at: "", location: "", capacity: "" });
      onCreated(); onClose();
    } catch (err) { setError((err as Error).message); } finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Create event">
      <form onSubmit={submit} className="space-y-3">
        <Field label="Title"><input className={inputCls} value={f.title} onChange={set("title")} required maxLength={200} /></Field>
        <Field label="Description"><textarea className={cx(inputCls, "min-h-20")} value={f.description} onChange={set("description")} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Date & time"><input type="datetime-local" className={inputCls} value={f.starts_at} onChange={set("starts_at")} required /></Field>
          <Field label="Capacity" hint="Optional"><input type="number" min={1} className={inputCls} value={f.capacity} onChange={set("capacity")} /></Field>
        </div>
        <Field label="Location"><input className={inputCls} value={f.location} onChange={set("location")} placeholder="Room, floor or Teams" /></Field>
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving}>Create</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function EventsView() {
  const { version } = useView();
  const [events, setEvents] = useState<EventItem[] | null>(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);

  const load = () => api.events().then(setEvents).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [version]);

  const toggle = async (ev: EventItem) => {
    setBusy(ev.id); setError("");
    try {
      const updated = ev.attending ? await api.leave(ev.id) : await api.join(ev.id);
      setEvents((es) => es?.map((e) => (e.id === ev.id ? updated : e)) ?? null);
    } catch (err) { setError((err as Error).message); } finally { setBusy(null); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">Meet other early talent. Anyone can create an event.</p>
        <Button variant="accent" onClick={() => setCreating(true)}><Plus className="h-4 w-4" />Create event</Button>
      </div>
      {error && <ErrorNote message={error} />}
      {!events && !error && <Spinner />}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {events?.map((ev) => {
          const d = new Date(ev.starts_at);
          const full = ev.capacity !== null && ev.attendee_count >= ev.capacity && !ev.attending;
          return (
            <Card key={ev.id} className="flex flex-col overflow-hidden">
              <div className="flex items-center gap-3 border-b border-line bg-brand-tint/50 p-4">
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-brand text-white">
                  <div className="text-center leading-none">
                    <div className="text-[10px] font-semibold uppercase text-accent">{d.toLocaleString(undefined, { month: "short" })}</div>
                    <div className="text-xl font-bold">{d.getDate()}</div>
                  </div>
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold leading-snug">{ev.title}</h3>
                  <p className="text-xs text-muted">by {ev.creator.name}</p>
                </div>
              </div>
              <div className="flex-1 space-y-2 p-4 text-sm">
                <p className="text-muted">{ev.description}</p>
                <p className="flex items-center gap-1.5 text-xs text-muted"><CalendarDays className="h-3.5 w-3.5" />{formatDateTime(ev.starts_at)}</p>
                {ev.location && <p className="flex items-center gap-1.5 text-xs text-muted"><MapPin className="h-3.5 w-3.5" />{ev.location}</p>}
              </div>
              <div className="flex items-center justify-between border-t border-line p-4">
                <span className="flex items-center gap-1.5 text-xs text-muted">
                  <Users className="h-3.5 w-3.5" />{ev.attendee_count}{ev.capacity ? ` / ${ev.capacity}` : ""} going
                  {ev.attending && <Badge tone="low">You&apos;re going</Badge>}
                </span>
                <Button variant={ev.attending ? "outline" : "primary"} onClick={() => toggle(ev)} loading={busy === ev.id} disabled={full}>
                  {ev.attending ? "Leave" : full ? "Full" : "Join"}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
      <CreateEventModal open={creating} onClose={() => setCreating(false)} onCreated={load} />
    </div>
  );
}
