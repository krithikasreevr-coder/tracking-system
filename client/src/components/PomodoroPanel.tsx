import { BellRing, Pause, Play, RotateCcw, TimerReset } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

type TimerSettings = { focusMinutes: number; shortBreakMinutes: number; longBreakMinutes: number };
type AssignmentOption = { id: number; title: string; subject: string; done?: boolean };

export function PomodoroPanel({ settings, assignments, onSaveSettings }: { settings: TimerSettings; assignments: AssignmentOption[]; onSaveSettings: (next: TimerSettings) => Promise<void> }) {
  const utils = trpc.useUtils();
  const [phase, setPhase] = useState<"focus" | "short" | "long">("focus");
  const [secondsLeft, setSecondsLeft] = useState(settings.focusMinutes * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [cycles, setCycles] = useState(0);
  const [assignmentId, setAssignmentId] = useState<string>("");
  const [showSettings, setShowSettings] = useState(false);
  const [draft, setDraft] = useState<TimerSettings>(settings);
  const logSession = trpc.student.logPomodoro.useMutation({ onSuccess: () => utils.student.pomodoroSessions.invalidate() });
  const duration = phase === "focus" ? settings.focusMinutes : phase === "short" ? settings.shortBreakMinutes : settings.longBreakMinutes;
  const label = phase === "focus" ? "FOCUS MODE" : phase === "short" ? "SHORT BREAK" : "LONG BREAK";
  const timerText = `${String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:${String(secondsLeft % 60).padStart(2, "0")}`;
  const progress = Math.max(0, Math.min(100, ((duration * 60 - secondsLeft) / (duration * 60)) * 100));

  useEffect(() => { if (!isRunning) return; const interval = window.setInterval(() => setSecondsLeft(value => Math.max(0, value - 1)), 1000); return () => window.clearInterval(interval); }, [isRunning]);
  useEffect(() => { setDraft(settings); if (!isRunning) setSecondsLeft(duration * 60); }, [settings, duration, isRunning]);
  useEffect(() => {
    if (secondsLeft !== 0 || !isRunning) return;
    setIsRunning(false);
    if (typeof Notification !== "undefined" && Notification.permission === "granted") new Notification(phase === "focus" ? "Focus cycle complete" : "Break complete", { body: phase === "focus" ? "Take a reset before the next signal." : "Ready for another focus cycle?" });
    if (phase === "focus") {
      logSession.mutate({ assignmentId: assignmentId ? Number(assignmentId) : null, durationMinutes: settings.focusMinutes });
      const nextCycles = cycles + 1;
      setCycles(nextCycles);
      setPhase(nextCycles % 4 === 0 ? "long" : "short");
      toast.success("Focus session logged.");
    } else setPhase("focus");
  }, [secondsLeft, isRunning, phase, assignmentId, settings.focusMinutes, cycles, logSession]);

  function reset() { setIsRunning(false); setSecondsLeft(duration * 60); }
  async function save() { try { await onSaveSettings(draft); setShowSettings(false); toast.success("Focus settings saved."); } catch { toast.error("Could not save focus settings."); } }
  async function requestNotifications() { if (typeof Notification === "undefined") return toast.error("Notifications are not available in this browser."); const result = await Notification.requestPermission(); if (result === "granted") toast.success("Focus notifications enabled."); else toast.error("Notifications remain disabled."); }

  return <section className="pomodoro-panel clipped-card"><div className="panel-heading"><div><span className="eyebrow">FOCUS LINK</span><h2>Pomodoro signal</h2></div><button className="quiet-action" onClick={() => setShowSettings(value => !value)}><TimerReset size={15} /> Settings</button></div>
    {showSettings && <div className="pomodoro-settings"><label>Focus minutes<input type="number" min="1" max="120" value={draft.focusMinutes} onChange={event => setDraft({ ...draft, focusMinutes: Number(event.target.value) })} /></label><label>Short break<input type="number" min="1" max="60" value={draft.shortBreakMinutes} onChange={event => setDraft({ ...draft, shortBreakMinutes: Number(event.target.value) })} /></label><label>Long break<input type="number" min="1" max="120" value={draft.longBreakMinutes} onChange={event => setDraft({ ...draft, longBreakMinutes: Number(event.target.value) })} /></label><button className="secondary-action" onClick={save}>Save timing</button></div>}
    <div className="timer-layout"><div className={`timer-orbit ${phase}`} style={{ "--progress": `${progress * 3.6}deg` } as React.CSSProperties}><span>{label}</span><strong>{timerText}</strong><small>{cycles} completed cycle{cycles === 1 ? "" : "s"}</small></div><div className="timer-controls"><label>Working on<select value={assignmentId} onChange={event => setAssignmentId(event.target.value)}><option value="">No assignment link</option>{assignments.filter(item => !item.done).map(item => <option key={item.id} value={item.id}>{item.subject} · {item.title}</option>)}</select></label><div><button className="primary-action compact" onClick={() => setIsRunning(value => !value)}>{isRunning ? <><Pause size={15} /> Pause</> : <><Play size={15} /> Start</>}</button><button className="secondary-action icon-only" onClick={reset} aria-label="Reset focus timer"><RotateCcw size={15} /></button></div><button className="quiet-action notification-button" onClick={requestNotifications}><BellRing size={15} /> Enable alerts</button></div></div>
  </section>;
}
