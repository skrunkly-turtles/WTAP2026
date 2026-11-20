"use client";
import { useEffect, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, List, MapPin, Plus, Users } from "lucide-react";
import { api, EventItem } from "@/lib/api";
import { useView } from "@/lib/view";
import { formatDateTime } from "@/lib/format";
import { Badge, Button, Card, cx, ErrorNote, Field, inputCls, Modal, Spinner } from "../ui";

type CalendarView = "month" | "week" | "day" | "agenda" | "list";
const calendarViews: { id: CalendarView; label: string }[] = [
  { id: "month", label: "Month" },
  { id: "week", label: "Week" },
  { id: "day", label: "Day" },
  { id: "agenda", label: "Agenda" },
  { id: "list", label: "List" },
];
const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function dayStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function startOfWeek(date: Date) {
  const start = dayStart(date);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function dayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function getCalendarDays(date: Date, view: CalendarView) {
  if (view === "day") return [dayStart(date)];
  const start = startOfWeek(date);
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

function headingFor(date: Date, view: CalendarView) {
  if (view === "month") return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  if (view === "day") return date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const start = startOfWeek(date);
  const end = addDays(start, 6);
  if (start.getMonth() === end.getMonth()) {
    return `${start.toLocaleDateString(undefined, { month: "long" })} ${start.getDate()}–${end.getDate()}, ${end.getFullYear()}`;
  }
  return `${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${end.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
}

function EventDetailsModal({ event, busy, onClose, onToggle }: {
  event: EventItem | null;
  busy: boolean;
  onClose: () => void;
  onToggle: (event: EventItem) => void;
}) {
  if (!event) return null;
  const full = event.capacity !== null && event.attendee_count >= event.capacity && !event.attending;
  return (
    <Modal open onClose={onClose} title={event.title}>
      <div className="space-y-4">
        <p className="text-sm text-muted">{event.description || "No description provided."}</p>
        <p className="flex items-center gap-2 text-sm"><CalendarDays className="h-4 w-4 text-brand" />{formatDateTime(event.starts_at)}</p>
        {event.location && <p className="flex items-center gap-2 text-sm"><MapPin className="h-4 w-4 text-brand" />{event.location}</p>}
        <p className="flex items-center gap-2 text-sm text-muted"><Users className="h-4 w-4" />{event.attendee_count}{event.capacity ? ` / ${event.capacity}` : ""} going · hosted by {event.creator.name}</p>
        <div className="flex items-center justify-between border-t border-line pt-4">
          {event.attending && <Badge tone="low">You&apos;re going</Badge>}
          <Button className="ml-auto" variant={event.attending ? "outline" : "primary"} onClick={() => onToggle(event)} loading={busy} disabled={full}>
            {event.attending ? "Leave event" : full ? "Event full" : "Join event"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

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
  const [view, setView] = useState<CalendarView>("list");
  const [dateRange, setDateRange] = useState<"week" | "all">("week");
  const [date, setDate] = useState(() => new Date());
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);

  const load = () => api.events().then((items) => { setEvents(items); setError(""); }).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [version]);

  const toggle = async (ev: EventItem) => {
    setBusy(ev.id); setError("");
    try {
      const updated = ev.attending ? await api.leave(ev.id) : await api.join(ev.id);
      setEvents((es) => es?.map((e) => (e.id === ev.id ? updated : e)) ?? null);
      setSelectedEvent((selected) => selected?.id === ev.id ? updated : selected);
    } catch (err) { setError((err as Error).message); } finally { setBusy(null); }
  };

  const selectedWeekStart = startOfWeek(date);
  const selectedWeekEnd = addDays(selectedWeekStart, 7);
  const rangeEvents = (events ?? [])
    .filter((event) => {
      if (dateRange === "all") return true;
      const starts = new Date(event.starts_at).getTime();
      return Number.isFinite(starts) && starts >= selectedWeekStart.getTime() && starts < selectedWeekEnd.getTime();
    })
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  const eventsByDay = new Map<string, EventItem[]>();
  for (const event of events ?? []) {
    const eventDate = new Date(event.starts_at);
    if (!Number.isFinite(eventDate.getTime())) continue;
    const key = dayKey(eventDate);
    eventsByDay.set(key, [...(eventsByDay.get(key) ?? []), event]);
  }
  const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
  const monthGridStart = startOfWeek(monthStart);
  const monthDays = Array.from({ length: 42 }, (_, index) => addDays(monthGridStart, index));
  const calendarDays = getCalendarDays(date, view);
  const navigate = (direction: number) => {
    const next = new Date(date);
    if (view === "month") next.setMonth(next.getMonth() + direction);
    else if (view === "day") next.setDate(next.getDate() + direction);
    else next.setDate(next.getDate() + 7 * direction);
    setDate(next);
  };

  const renderEventButton = (event: EventItem, compact = false) => (
    <button
      key={event.id}
      type="button"
      onClick={() => setSelectedEvent(event)}
      className={cx(
        "block w-full overflow-hidden rounded-md border-l-2 border-brand bg-brand-tint px-2 py-1 text-left text-xs text-brand hover:bg-brand/15",
        compact && "truncate",
      )}
      title={`${new Date(event.starts_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} · ${event.title}`}
    >
      {!compact && <span className="mr-1 font-semibold">{new Date(event.starts_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</span>}
      {event.title}
    </button>
  );

  const renderMonth = () => (
    <div className="overflow-hidden rounded-xl border border-line bg-white">
      <div className="grid grid-cols-7 border-b border-line bg-surface">
        {weekDays.map((name) => <div key={name} className="px-2 py-2 text-center text-xs font-semibold text-muted">{name}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {monthDays.map((day) => {
          const dayEvents = eventsByDay.get(dayKey(day)) ?? [];
          const isToday = sameDay(day, new Date());
          return (
            <div key={dayKey(day)} className={cx("min-h-28 border-b border-r border-line p-1.5 sm:min-h-32 sm:p-2", day.getMonth() !== date.getMonth() && "bg-surface/60")}>
              <div className="mb-1 flex justify-end">
                <span className={cx("grid h-7 w-7 place-items-center rounded-full text-xs", isToday ? "bg-brand font-semibold text-white" : "text-muted")}>{day.getDate()}</span>
              </div>
              <div className="space-y-1">
                {dayEvents.slice(0, 3).map((event) => renderEventButton(event, true))}
                {dayEvents.length > 3 && <p className="px-1 text-[11px] text-muted">+{dayEvents.length - 3} more</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderTimeGrid = () => (
    <div className="overflow-x-auto rounded-xl border border-line bg-white">
      <div className={calendarDays.length === 1 ? "min-w-[400px]" : "min-w-[760px]"}>
        <div className="sticky top-0 z-10 grid border-b border-line bg-white" style={{ gridTemplateColumns: `56px repeat(${calendarDays.length}, minmax(0, 1fr))` }}>
          <div className="border-r border-line" />
          {calendarDays.map((day) => (
            <div key={dayKey(day)} className="border-r border-line px-2 py-3 text-center">
              <div className="text-xs font-medium text-muted">{weekDays[(day.getDay() + 6) % 7]}</div>
              <div className={cx("mx-auto mt-1 grid h-8 w-8 place-items-center rounded-full text-sm font-semibold", sameDay(day, new Date()) ? "bg-brand text-white" : "text-ink")}>{day.getDate()}</div>
            </div>
          ))}
        </div>
        <div className="grid" style={{ gridTemplateColumns: `56px repeat(${calendarDays.length}, minmax(0, 1fr))` }}>
          {Array.from({ length: 15 }, (_, index) => index + 7).map((hour) => (
            <div key={hour} className="contents">
              <div className="min-h-16 border-r border-b border-line px-1 pt-1 text-right text-[10px] text-muted">
                {hour === 0 ? "" : new Date(2000, 0, 1, hour).toLocaleTimeString(undefined, { hour: "numeric" })}
              </div>
              {calendarDays.map((day) => {
                const hourEvents = (eventsByDay.get(dayKey(day)) ?? []).filter((event) => new Date(event.starts_at).getHours() === hour);
                return (
                  <div key={`${dayKey(day)}-${hour}`} className="min-h-16 space-y-1 overflow-hidden border-r border-b border-line p-1">
                    {hourEvents.map((event) => renderEventButton(event))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderAgenda = () => (
    <div className="space-y-3">
      {rangeEvents.length ? rangeEvents.map((event) => {
        const eventDate = new Date(event.starts_at);
        return (
          <Card key={event.id} className="flex items-center gap-4 p-4">
            <div className="w-16 shrink-0 text-center">
              <p className="text-xs font-semibold uppercase text-muted">{eventDate.toLocaleDateString(undefined, { month: "short" })}</p>
              <p className="text-2xl font-bold text-brand">{eventDate.getDate()}</p>
            </div>
            <div className="min-w-0 flex-1">
              <button onClick={() => setSelectedEvent(event)} className="text-left font-semibold hover:text-brand">{event.title}</button>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted"><Clock3 className="h-3.5 w-3.5" />{formatDateTime(event.starts_at)}</p>
              {event.location && <p className="mt-1 flex items-center gap-1.5 text-xs text-muted"><MapPin className="h-3.5 w-3.5" />{event.location}</p>}
            </div>
            {event.attending && <Badge tone="low">You&apos;re going</Badge>}
            <Button className="hidden sm:inline-flex" variant={event.attending ? "outline" : "primary"} onClick={() => toggle(event)} loading={busy === event.id} disabled={event.capacity !== null && event.attendee_count >= event.capacity && !event.attending}>
              {event.attending ? "Leave" : event.capacity !== null && event.attendee_count >= event.capacity ? "Full" : "Join"}
            </Button>
          </Card>
        );
      }) : <Card className="p-8 text-center text-sm text-muted">No events in this range.</Card>}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">Meet other early talent. Anyone can create an event.</p>
        <Button variant="accent" onClick={() => setCreating(true)}><Plus className="h-4 w-4" />Create event</Button>
      </div>
      {error && <ErrorNote message={error} />}
      {!events && !error && <Spinner />}
      {events && (
        <Card className="space-y-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {(view !== "list" || dateRange === "week") && (
                <>
                  <Button variant="outline" className="px-2.5" aria-label="Previous period" onClick={() => navigate(-1)}><ChevronLeft className="h-4 w-4" /></Button>
                  <Button variant="outline" onClick={() => setDate(new Date())}>Today</Button>
                  <Button variant="outline" className="px-2.5" aria-label="Next period" onClick={() => navigate(1)}><ChevronRight className="h-4 w-4" /></Button>
                  <h2 className="ml-1 text-base font-semibold">{view === "agenda" && dateRange === "all" ? "All events" : headingFor(date, view === "list" ? "week" : view)}</h2>
                </>
              )}
              {view === "list" && dateRange === "all" && <h2 className="ml-1 text-base font-semibold">All events</h2>}
            </div>
            <div className="flex items-center gap-2">
              {(view === "list" || view === "agenda") && (
                <div className="flex gap-1 rounded-lg bg-surface p-1" role="group" aria-label={`${view === "list" ? "List" : "Agenda"} date range`}>
                  {(["week", "all"] as const).map((range) => (
                    <button key={range} type="button" aria-pressed={dateRange === range} onClick={() => setDateRange(range)}
                      className={cx("rounded-md px-3 py-1.5 text-sm font-medium transition", dateRange === range ? "bg-white text-brand shadow-sm" : "text-muted hover:text-ink")}>
                      {range === "week" ? "Week" : "All"}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex gap-1 overflow-x-auto rounded-lg bg-surface p-1" role="tablist" aria-label="Calendar view">
                {calendarViews.map((item) => (
                  <button key={item.id} role="tab" aria-selected={view === item.id} onClick={() => setView(item.id)}
                    className={cx("rounded-md px-3 py-1.5 text-sm font-medium transition", view === item.id ? "bg-white text-brand shadow-sm" : "text-muted hover:text-ink")}>
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {events.length === 0 ? (
            <div className="rounded-lg border border-dashed border-line py-12 text-center">
              <CalendarDays className="mx-auto h-8 w-8 text-muted" />
              <p className="mt-2 text-sm font-medium">No events yet</p>
              <p className="mt-1 text-sm text-muted">Create an event to get something on the calendar.</p>
            </div>
          ) : view === "month" ? renderMonth()
            : view === "week" || view === "day" ? renderTimeGrid()
              : view === "agenda" ? renderAgenda() : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {rangeEvents.map((ev) => {
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
                  {rangeEvents.length === 0 && <p className="col-span-full py-8 text-center text-sm text-muted">{dateRange === "week" ? "No events this week." : "No events."}</p>}
                </div>
              )}
        </Card>
      )}
      {view === "agenda" && events && events.length > 0 && (
        <div className="flex justify-end">
          <Button variant="ghost" onClick={() => setView("list")}><List className="h-4 w-4" />View all events</Button>
        </div>
      )}
      <EventDetailsModal event={selectedEvent} busy={selectedEvent ? busy === selectedEvent.id : false} onClose={() => setSelectedEvent(null)} onToggle={toggle} />
      <CreateEventModal open={creating} onClose={() => setCreating(false)} onCreated={load} />
    </div>
  );
}
