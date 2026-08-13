import { trpc } from "@/lib/trpc";
import { BarChart3, BookOpen, CalendarDays, Check, ChevronRight, ClipboardList, Edit3, GraduationCap, LayoutDashboard, LineChart, LogOut, Plus, Trash2, UserPlus, Users, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarBoard } from "@/components/CalendarBoard";
import { StaffAnalyticsPanel } from "@/components/StaffAnalyticsPanel";

type StaffUser = { id: number; name: string; email: string | null; role: "staff" | "student"; createdAt: Date; updatedAt: Date };
type AssignmentDraft = { subject: string; title: string; description: string; dueDate: string; priority: "low" | "medium" | "high"; targetType: "class" | "students"; classId: string; studentIds: number[] };
const blankDraft = (): AssignmentDraft => ({ subject: "", title: "", description: "", dueDate: "", priority: "medium", targetType: "class", classId: "", studentIds: [] });
const dayStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
const dateInputValue = (value: Date) => new Date(value.getTime() - value.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
const dueState = (date: Date, done = false) => {
  if (done) return "complete";
  const days = Math.ceil((dayStart(date) - dayStart(new Date())) / 86_400_000);
  if (days < 0) return "overdue";
  if (days <= 3) return "soon";
  return "open";
};
const dueLabel = (date: Date) => new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);

export default function StaffConsole({ user }: { user: StaffUser }) {
  const utils = trpc.useUtils();
  const { data: classes = [] } = trpc.classes.list.useQuery(undefined);
  const { data: assignments = [], isLoading: assignmentsLoading } = trpc.staff.assignments.useQuery(undefined);
  const { data: roster = [] } = trpc.staff.students.useQuery(undefined);
  const [activePanel, setActivePanel] = useState<"overview" | "assignments" | "classes" | "calendar" | "analytics">("overview");
  const [assignmentSort, setAssignmentSort] = useState<"due" | "priority">("due");
  const [activeClassId, setActiveClassId] = useState<number | null>(null);
  const [className, setClassName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [draft, setDraft] = useState<AssignmentDraft>(blankDraft());
  const [showComposer, setShowComposer] = useState(false);
  const [editingAssignmentId, setEditingAssignmentId] = useState<number | null>(null);
  const classRoster = trpc.classes.students.useQuery({ classId: activeClassId ?? 0 }, { enabled: activeClassId !== null });
  const studentSearch = trpc.classes.findStudent.useQuery({ email: studentEmail || "missing@school.invalid" }, { enabled: false });
  const createClass = trpc.classes.create.useMutation({ onSuccess: async () => { await utils.classes.list.invalidate(); toast.success("Class channel created."); setClassName(""); } });
  const deleteClass = trpc.classes.delete.useMutation({ onSuccess: async () => { await utils.classes.list.invalidate(); toast.success("Class removed."); } });
  const addStudent = trpc.classes.addStudent.useMutation({ onSuccess: async () => { await Promise.all([utils.classes.students.invalidate(), utils.staff.students.invalidate(), utils.classes.list.invalidate()]); toast.success("Student enrolled."); setStudentEmail(""); } });
  const removeStudent = trpc.classes.removeStudent.useMutation({ onSuccess: async () => { await Promise.all([utils.classes.students.invalidate(), utils.staff.students.invalidate(), utils.classes.list.invalidate()]); toast.success("Student removed from this class."); } });
  const createAssignment = trpc.staff.createAssignment.useMutation({ onSuccess: async () => { await utils.staff.assignments.invalidate(); toast.success("Assignment transmitted."); closeComposer(); } });
  const updateAssignment = trpc.staff.updateAssignment.useMutation({ onSuccess: async () => { await utils.staff.assignments.invalidate(); toast.success("Assignment updated."); closeComposer(); } });
  const deleteAssignment = trpc.staff.deleteAssignment.useMutation({ onSuccess: async () => { await utils.staff.assignments.invalidate(); toast.success("Assignment deleted."); } });
  const logout = trpc.auth.logout.useMutation({ onSuccess: async () => { await utils.auth.me.invalidate(); toast.success("Session closed."); } });

  useEffect(() => {
    if (!activeClassId && classes[0]) setActiveClassId(classes[0].id);
    if (activeClassId && !classes.some(classroom => classroom.id === activeClassId)) setActiveClassId(classes[0]?.id ?? null);
  }, [activeClassId, classes]);

  const metrics = useMemo(() => {
    const targetTotal = assignments.reduce((total, assignment) => total + assignment.totalStudents, 0);
    const complete = assignments.reduce((total, assignment) => total + assignment.completedStudents, 0);
    const overdue = assignments.filter(assignment => dueState(new Date(assignment.dueDate)) === "overdue").length;
    return { targetTotal, complete, overdue, rate: targetTotal ? Math.round((complete / targetTotal) * 100) : 0 };
  }, [assignments]);
  const sortedAssignments = useMemo(() => [...assignments].sort((a, b) => assignmentSort === "priority" ? ({ high: 0, medium: 1, low: 2 }[a.priority] - { high: 0, medium: 1, low: 2 }[b.priority]) || new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime() : new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()), [assignments, assignmentSort]);

  function closeComposer() { setShowComposer(false); setEditingAssignmentId(null); setDraft(blankDraft()); }
  function openCreate() { setDraft({ ...blankDraft(), classId: activeClassId ? String(activeClassId) : classes[0] ? String(classes[0].id) : "" }); setEditingAssignmentId(null); setShowComposer(true); setActivePanel("assignments"); }
  function openEdit(assignment: typeof assignments[number]) {
    setEditingAssignmentId(assignment.id);
    setDraft({ subject: assignment.subject, title: assignment.title, description: assignment.description ?? "", dueDate: dateInputValue(new Date(assignment.dueDate)), priority: assignment.priority, targetType: assignment.classId ? "class" : "students", classId: assignment.classId ? String(assignment.classId) : "", studentIds: assignment.targetStudents.map(student => student.id) });
    setShowComposer(true); setActivePanel("assignments");
  }
  async function saveAssignment(event: React.FormEvent) {
    event.preventDefault();
    const payload = { subject: draft.subject, title: draft.title, description: draft.description || null, dueDate: new Date(`${draft.dueDate}T12:00:00`).getTime(), priority: draft.priority, classId: draft.targetType === "class" && draft.classId ? Number(draft.classId) : null, studentIds: draft.targetType === "students" ? draft.studentIds : [] };
    try {
      if (editingAssignmentId) await updateAssignment.mutateAsync({ id: editingAssignmentId, assignment: payload });
      else await createAssignment.mutateAsync(payload);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not save assignment."); }
  }
  async function enrollStudent(event: React.FormEvent) {
    event.preventDefault();
    if (!activeClassId) return toast.error("Create and select a class first.");
    const found = await studentSearch.refetch();
    if (!found.data) return toast.error("No registered student found with that email.");
    try { await addStudent.mutateAsync({ classId: activeClassId, studentId: found.data.id }); } catch (error) { toast.error(error instanceof Error ? error.message : "Could not add student."); }
  }

  return (
    <div className="console-shell">
      <aside className="console-sidebar">
        <div className="brand-lockup"><span className="brand-mark">N</span><div><strong>NEON</strong><small>CLASSROOM OS</small></div></div>
        <nav className="side-nav" aria-label="Staff navigation">
          <button className={activePanel === "overview" ? "active" : ""} onClick={() => setActivePanel("overview")}><LayoutDashboard size={17} />Overview</button>
          <button className={activePanel === "assignments" ? "active" : ""} onClick={() => setActivePanel("assignments")}><ClipboardList size={17} />Assignments</button>
          <button className={activePanel === "classes" ? "active" : ""} onClick={() => setActivePanel("classes")}><Users size={17} />Classes</button>
          <button className={activePanel === "calendar" ? "active" : ""} onClick={() => setActivePanel("calendar")}><CalendarDays size={17} />Calendar</button>
          <button className={activePanel === "analytics" ? "active" : ""} onClick={() => setActivePanel("analytics")}><LineChart size={17} />Analytics</button>
        </nav>
        <div className="sidebar-user"><span>{user.name.slice(0, 2).toUpperCase()}</span><div><strong>{user.name}</strong><small>STAFF NODE</small></div><button onClick={() => logout.mutate()} aria-label="Log out"><LogOut size={16} /></button></div>
      </aside>
      <main className="console-main">
        <header className="workspace-header"><div><p className="eyebrow">STAFF COMMAND CONSOLE</p><h1>{activePanel === "overview" ? "Signal overview" : activePanel === "assignments" ? "Assignment control" : activePanel === "classes" ? "Class directory" : activePanel === "calendar" ? "Deadline calendar" : "Learning analytics"}</h1></div><button className="primary-action compact" onClick={openCreate}><Plus size={16} /> New assignment</button></header>

        {activePanel === "overview" && <>
          <section className="metric-grid">
            <article className="metric-card clipped-card"><span>COMPLETION RATE</span><strong>{metrics.rate}<small>%</small></strong><div className="progress-track"><i style={{ width: `${metrics.rate}%` }} /></div><p>{metrics.complete} of {metrics.targetTotal} learner signals complete</p></article>
            <article className="metric-card clipped-card"><span>ACTIVE ASSIGNMENTS</span><strong>{assignments.length}</strong><p>Across {classes.length} class channel{classes.length === 1 ? "" : "s"}</p></article>
            <article className="metric-card clipped-card danger"><span>NEEDS ATTENTION</span><strong>{metrics.overdue}</strong><p>Assignment{metrics.overdue === 1 ? "" : "s"} beyond deadline</p></article>
          </section>
          <section className="panel-card clipped-card heatmap-panel"><div className="panel-heading"><div><span className="eyebrow">LIVE MATRIX</span><h2>Completion grid</h2></div><button className="quiet-action" onClick={() => setActivePanel("assignments")}>View assignments <ChevronRight size={15} /></button></div>
            {assignmentsLoading ? <div className="empty-state">Syncing completion signals…</div> : !assignments.length ? <div className="empty-state"><BarChart3 size={26} /><strong>No signals yet</strong><p>Create an assignment to activate the class matrix.</p><button className="quiet-action" onClick={openCreate}>Create assignment</button></div> : <div className="heatmap-scroll"><div className="heatmap" style={{ gridTemplateColumns: `minmax(138px, 1.4fr) repeat(${Math.min(assignments.length, 6)}, minmax(50px, .65fr))` }}><div className="heatmap-label">STUDENT / TASK</div>{assignments.slice(0, 6).map(assignment => <div className="heatmap-head" key={assignment.id} title={assignment.title}>{assignment.subject.slice(0, 4).toUpperCase()}</div>)}{roster.map(student => <><div className="heatmap-student" key={`name-${student.id}`}>{student.name}</div>{assignments.slice(0, 6).map(assignment => { const status = assignment.completion.find(item => item.studentId === student.id); return <div className={`heat-cell ${status?.done ? "done" : status ? "pending" : "muted"}`} key={`${student.id}-${assignment.id}`}>{status?.done ? <Check size={14} /> : status ? "·" : "—"}</div>; })}</>)}</div></div>}
          </section>
        </>}

        {activePanel === "assignments" && <section className="panel-card clipped-card">
          <div className="panel-heading"><div><span className="eyebrow">ASSIGNMENT QUEUE</span><h2>Transmit and monitor work</h2></div><div className="staff-sort"><button className={assignmentSort === "due" ? "active" : ""} onClick={() => setAssignmentSort("due")}>Due date</button><button className={assignmentSort === "priority" ? "active" : ""} onClick={() => setAssignmentSort("priority")}>Priority</button><button className="quiet-action" onClick={() => setShowComposer(value => !value)}>{showComposer ? <><X size={15} /> Close</> : <><Plus size={15} /> Compose</>}</button></div></div>
          {showComposer && <form className="composer" onSubmit={saveAssignment}><div className="form-grid"><label>Subject<input required value={draft.subject} onChange={event => setDraft({ ...draft, subject: event.target.value })} placeholder="e.g. Biology" /></label><label>Due date<input required type="date" value={draft.dueDate} onChange={event => setDraft({ ...draft, dueDate: event.target.value })} /></label></div><label>Assignment title<input required value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} placeholder="e.g. Cell transport lab notes" /></label><label>Briefing<textarea value={draft.description} onChange={event => setDraft({ ...draft, description: event.target.value })} rows={3} placeholder="Instructions, outcomes, or submission notes." /></label><fieldset className="priority-picker"><legend>Priority signal</legend>{(["low", "medium", "high"] as const).map(priority => <button type="button" className={draft.priority === priority ? `selected ${priority}` : priority} onClick={() => setDraft({ ...draft, priority })} key={priority}><i className={`priority-dot ${priority}`} />{priority}</button>)}</fieldset><fieldset className="target-picker"><legend>Transmit to</legend><button type="button" className={draft.targetType === "class" ? "selected" : ""} onClick={() => setDraft({ ...draft, targetType: "class", studentIds: [] })}><BookOpen size={15} /> Entire class</button><button type="button" className={draft.targetType === "students" ? "selected" : ""} onClick={() => setDraft({ ...draft, targetType: "students", classId: "" })}><GraduationCap size={15} /> Individual students</button></fieldset>{draft.targetType === "class" ? <label>Class<select required value={draft.classId} onChange={event => setDraft({ ...draft, classId: event.target.value })}><option value="">Select class</option>{classes.map(classroom => <option value={classroom.id} key={classroom.id}>{classroom.name} · {classroom.studentCount} students</option>)}</select></label> : <div className="student-checks">{roster.length ? roster.map(student => <label key={student.id}><input type="checkbox" checked={draft.studentIds.includes(student.id)} onChange={() => setDraft({ ...draft, studentIds: draft.studentIds.includes(student.id) ? draft.studentIds.filter(id => id !== student.id) : [...draft.studentIds, student.id] })} />{student.name}</label>) : <p>Enroll students in a class before assigning individual work.</p>}</div>}<div className="composer-actions"><button type="button" className="secondary-action" onClick={closeComposer}>Cancel</button><button className="primary-action compact" disabled={createAssignment.isPending || updateAssignment.isPending}>{editingAssignmentId ? "Save changes" : "Transmit assignment"}</button></div></form>}
          <div className="assignment-table">{!assignments.length ? <div className="empty-state"><ClipboardList size={26} /><strong>Queue is clear</strong><p>Create your first assignment to begin tracking class momentum.</p></div> : sortedAssignments.map(assignment => { const progress = assignment.totalStudents ? Math.round((assignment.completedStudents / assignment.totalStudents) * 100) : 0; const state = dueState(new Date(assignment.dueDate)); return <article className={`assignment-row priority-${assignment.priority}`} key={assignment.id}><div className="subject-chip"><i className={`priority-dot ${assignment.priority}`} />{assignment.subject}</div><div className="assignment-title"><strong>{assignment.title}</strong><small>{assignment.className ?? `${assignment.totalStudents} selected student${assignment.totalStudents === 1 ? "" : "s"}`}</small></div><span className={`priority-badge ${assignment.priority}`}>{assignment.priority}</span><span className={`date-stamp ${state}`}>DUE {dueLabel(new Date(assignment.dueDate))}</span><div className="row-progress"><span>{assignment.completedStudents}/{assignment.totalStudents}</span><i><b style={{ width: `${progress}%` }} /></i></div><div className="row-actions"><button onClick={() => openEdit(assignment)} aria-label="Edit assignment"><Edit3 size={15} /></button><button className="danger-button" onClick={() => { if (confirm(`Delete “${assignment.title}”?`)) deleteAssignment.mutate({ id: assignment.id }); }} aria-label="Delete assignment"><Trash2 size={15} /></button></div></article>; })}</div>
        </section>}

        {activePanel === "classes" && <section className="classes-layout"><article className="panel-card clipped-card class-list"><div className="panel-heading"><div><span className="eyebrow">CLASS CHANNELS</span><h2>Directory</h2></div></div><form className="inline-form" onSubmit={event => { event.preventDefault(); if (className.trim()) createClass.mutate({ name: className }); }}><input value={className} onChange={event => setClassName(event.target.value)} placeholder="New class name" required /><button className="primary-action compact" disabled={createClass.isPending}><Plus size={15} /></button></form><div className="class-options">{classes.length ? classes.map(classroom => <button className={classroom.id === activeClassId ? "active" : ""} onClick={() => setActiveClassId(classroom.id)} key={classroom.id}><span><BookOpen size={16} />{classroom.name}</span><small>{classroom.studentCount} students</small></button>) : <div className="empty-state"><BookOpen size={25} /><p>Create a class to start organizing your roster.</p></div>}</div></article>
          <article className="panel-card clipped-card roster-panel"><div className="panel-heading"><div><span className="eyebrow">ROSTER CONTROL</span><h2>{classes.find(item => item.id === activeClassId)?.name ?? "Select a class"}</h2></div>{activeClassId && <button className="danger-text" onClick={() => { if (confirm("Delete this class and its class-assignment link?")) deleteClass.mutate({ id: activeClassId }); }}>Delete class</button>}</div>{activeClassId ? <><form className="enroll-form" onSubmit={enrollStudent}><UserPlus size={17} /><input type="email" value={studentEmail} onChange={event => setStudentEmail(event.target.value)} required placeholder="Registered student email" /><button className="secondary-action" disabled={addStudent.isPending}>Enroll</button></form><p className="form-note">Students register themselves first. Enter their exact account email to enroll them in this class.</p><div className="roster-list">{classRoster.isLoading ? <div className="empty-state">Loading roster…</div> : classRoster.data?.length ? classRoster.data.map(student => <div className="roster-item" key={student.id}><span>{student.name.slice(0, 2).toUpperCase()}</span><div><strong>{student.name}</strong><small>{student.email}</small></div><button className="danger-button" onClick={() => removeStudent.mutate({ classId: activeClassId, studentId: student.id })} aria-label={`Remove ${student.name}`}><X size={15} /></button></div>) : <div className="empty-state"><Users size={25} /><strong>Roster is open</strong><p>Enroll registered students to activate class-level assignments.</p></div>}</div></> : <div className="empty-state"><Users size={25} /><p>Choose or create a class channel to manage its roster.</p></div>}</article></section>}
        {activePanel === "calendar" && <CalendarBoard caption="CLASS DEADLINE LOAD" items={assignments.map(assignment => ({ id: assignment.id, title: assignment.title, subject: assignment.subject, dueDate: assignment.dueDate, priority: assignment.priority, done: assignment.totalStudents > 0 && assignment.completedStudents === assignment.totalStudents }))} />}
        {activePanel === "analytics" && <StaffAnalyticsPanel />}
      </main>
    </div>
  );
}
