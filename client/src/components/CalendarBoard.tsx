import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

export type CalendarItem = {
  id: number;
  title: string;
  subject: string;
  dueDate: Date | string;
  priority: "low" | "medium" | "high";
  done?: boolean;
};

const startOfDay = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate());
const keyFor = (value: Date) => `${value.getFullYear()}-${value.getMonth()}-${value.getDate()}`;
const isOverdue = (item: CalendarItem) => !item.done && startOfDay(new Date(item.dueDate)).getTime() < startOfDay(new Date()).getTime();

export function CalendarBoard({ items, caption }: { items: CalendarItem[]; caption: string }) {
  const [cursor, setCursor] = useState(() => startOfDay(new Date()));
  const [mode, setMode] = useState<"month" | "week">("month");
  const [selectedKey, setSelectedKey] = useState(() => keyFor(new Date()));
  const days = useMemo(() => {
    if (mode === "week") {
      const weekStart = new Date(cursor);
      weekStart.setDate(cursor.getDate() - ((cursor.getDay() + 6) % 7));
      return Array.from({ length: 7 }, (_, index) => {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + index);
        return date;
      });
    }
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const calendarStart = new Date(first);
    calendarStart.setDate(first.getDate() - ((first.getDay() + 6) % 7));
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(calendarStart);
      date.setDate(calendarStart.getDate() + index);
      return date;
    });
  }, [cursor, mode]);
  const byDay = useMemo(() => items.reduce<Record<string, CalendarItem[]>>((accumulator, item) => {
    const key = keyFor(new Date(item.dueDate));
    accumulator[key] = [...(accumulator[key] ?? []), item];
    return accumulator;
  }, {}), [items]);
  const selected = byDay[selectedKey] ?? [];
  const advance = (direction: number) => setCursor(current => {
    const next = new Date(current);
    if (mode === "month") next.setMonth(next.getMonth() + direction);
    else next.setDate(next.getDate() + direction * 7);
    return next;
  });
  const label = mode === "month"
    ? new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(cursor)
    : `${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(days[0])} – ${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(days.at(-1)! )}`;

  return <section className="panel-card clipped-card calendar-board">
    <div className="panel-heading"><div><span className="eyebrow">{caption}</span><h2>Deadline radar</h2></div><div className="calendar-controls"><button className={mode === "month" ? "active" : ""} onClick={() => setMode("month")}>Month</button><button className={mode === "week" ? "active" : ""} onClick={() => setMode("week")}>Week</button></div></div>
    <div className="calendar-nav"><button onClick={() => advance(-1)} aria-label="Previous calendar period"><ChevronLeft size={16} /></button><strong>{label}</strong><button onClick={() => advance(1)} aria-label="Next calendar period"><ChevronRight size={16} /></button></div>
    <div className={`calendar-grid ${mode}`}>
      {days.map((date, index) => <button key={date.toISOString()} className={`calendar-day ${date.getMonth() !== cursor.getMonth() && mode === "month" ? "outside" : ""} ${selectedKey === keyFor(date) ? "selected" : ""}`} onClick={() => setSelectedKey(keyFor(date))}>
        {mode === "month" && index < 7 && <span className="calendar-weekday">{new Intl.DateTimeFormat(undefined, { weekday: "narrow" }).format(date)}</span>}
        <span className="calendar-number">{date.getDate()}</span>
        <span className="calendar-dots">{(byDay[keyFor(date)] ?? []).slice(0, 4).map(item => <i key={item.id} className={`priority-dot ${item.priority} ${item.done ? "complete" : isOverdue(item) ? "overdue" : ""}`} />)}</span>
      </button>)}
    </div>
    <div className="calendar-selection"><span className="eyebrow">SELECTED DATE</span><div>{selected.length ? selected.map(item => <div className="calendar-event" key={item.id}><i className={`priority-dot ${item.priority} ${item.done ? "complete" : isOverdue(item) ? "overdue" : ""}`} /><div><strong>{item.title}</strong><small>{item.subject} · {item.done ? "complete" : isOverdue(item) ? "overdue" : item.priority} priority</small></div></div>) : <p>No assignments are due on this date.</p>}</div>
    </div>
  </section>;
}
