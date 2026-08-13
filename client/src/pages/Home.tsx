import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import StaffConsole from "./StaffConsole";
import StudentTerminal from "./StudentTerminal";

type AuthMode = "login" | "register";

function AuthScreen() {
  const utils = trpc.useUtils();
  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"staff" | "student">("student");
  const login = trpc.auth.login.useMutation();
  const register = trpc.auth.register.useMutation();
  const busy = login.isPending || register.isPending;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    try {
      if (mode === "login") {
        await login.mutateAsync({ email, password });
        toast.success("Secure session established.");
      } else {
        await register.mutateAsync({ name, email, password, role });
        toast.success(`Account initialized for ${role} workspace.`);
      }
      await utils.auth.me.invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not authenticate this account.");
    }
  }

  return (
    <main className="auth-shell">
      <div className="scanlines" aria-hidden="true" />
      <section className="auth-hero">
        <p className="eyebrow">CLASSROOM OPERATIONS // ONLINE</p>
        <h1>Track the work.<br /><span>See the signal.</span></h1>
        <p className="hero-copy">A focused assignment network for staff command and student momentum.</p>
        <div className="signal-legend" aria-label="Assignment status legend">
          <span><i className="dot cyan" /> Assigned work</span>
          <span><i className="dot orange" /> Due soon</span>
          <span><i className="dot red" /> Overdue</span>
        </div>
      </section>

      <section className="auth-card clipped-card">
        <div className="card-corner" aria-hidden="true" />
        <div className="terminal-caption"><span className="pulse-dot" /> ACCESS GATEWAY</div>
        <div className="auth-tabs" role="tablist" aria-label="Authentication">
          <button type="button" className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Log in</button>
          <button type="button" className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>Create account</button>
        </div>
        <form onSubmit={submit} className="auth-form">
          {mode === "register" && <label>Display name<input value={name} onChange={event => setName(event.target.value)} minLength={2} maxLength={120} required placeholder="e.g. Avery Chen" /></label>}
          <label>Email address<input value={email} onChange={event => setEmail(event.target.value)} type="email" required autoComplete="email" placeholder="name@school.edu" /></label>
          <label>Password<input value={password} onChange={event => setPassword(event.target.value)} type="password" minLength={8} required autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder="At least 8 characters" /></label>
          {mode === "register" && (
            <fieldset className="role-picker">
              <legend>Workspace type</legend>
              <button type="button" className={role === "student" ? "selected" : ""} onClick={() => setRole("student")}><strong>Student</strong><small>Personal planner</small></button>
              <button type="button" className={role === "staff" ? "selected" : ""} onClick={() => setRole("staff")}><strong>Staff</strong><small>Command console</small></button>
            </fieldset>
          )}
          <button className="primary-action" disabled={busy} type="submit">
            {busy ? <><Loader2 size={16} className="spin" /> Establishing link…</> : mode === "login" ? "Enter workspace" : "Initialize account"}
          </button>
        </form>
        <p className="form-note">Passwords are salted and securely hashed. Role data is enforced by the server.</p>
      </section>
    </main>
  );
}

export default function Home() {
  const { data: user, isLoading } = trpc.auth.me.useQuery();
  if (isLoading) return <div className="app-loading"><Loader2 className="spin" size={28} /><span>Booting workspace…</span></div>;
  if (!user) return <AuthScreen />;
  return user.role === "staff" ? <StaffConsole user={user} /> : <StudentTerminal user={user} />;
}
