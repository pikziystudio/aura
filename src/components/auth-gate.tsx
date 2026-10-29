"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";
import WorkspaceBootstrap from "@/components/workspace-bootstrap";
import { ArrowRight, LockKeyhole, LogOut, Mail, ShieldCheck } from "lucide-react";

type View = "login" | "recovery";
export default function AuthGate({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [view, setView] = useState<View>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [configured, setConfigured] = useState(true);

  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};
    try {
      const client = getSupabase();
      client.auth.getSession().then(({ data, error }) => {
        if (!active) return;
        if (error) setError("Could not check your session. Please try again.");
        setSession(data.session);
        setLoading(false);
      }).catch(() => { if (active) {setError("Unable to connect to authentication."); setLoading(false);} });
      const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
        if (active) {setSession(nextSession);setLoading(false);}
      });
      unsubscribe = () => data.subscription.unsubscribe();
    } catch {
      setConfigured(false);
      setLoading(false);
    }
    return () => { active = false; unsubscribe(); };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (working) return;
    setWorking(true); setError(""); setMessage("");
    try {
      const client = getSupabase();
      if (view === "login") {
        const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      } else {
        const redirectTo = `${window.location.origin}/auth/reset`;
        const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo });
        if (error) throw error;
        setMessage("If this address has an account, a recovery link will arrive by email.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally { setWorking(false); }
  }

  if (loading) return <div className="auth-loading" role="status">Opening AURA…</div>;
  if (!configured) return <div className="auth-loading">AURA authentication is not configured. Check the Vercel environment variables.</div>;
  if (session) return <><div className="session-toolbar"><span><ShieldCheck size={14}/> Signed in as {session.user.email || "AURA member"}</span><button type="button" onClick={() => void getSupabase().auth.signOut()}><LogOut size={14}/> Sign out</button></div><WorkspaceBootstrap ownerId={session.user.id}>{children}</WorkspaceBootstrap></>;

  return <main className="auth-page"><section className="auth-panel">
    <div className="auth-logo"><div className="auth-logo-orb"/>AURA</div>
    <div className="auth-orb" aria-hidden="true"><span /></div>
    <p className="auth-eyebrow">YOUR PRIVATE SPACE</p>
    <h1>{view === "login" ? "Welcome back." : "Reset your password."}</h1>
    <p className="auth-subtitle">{view === "login" ? "Your thoughts, memories, and everything in between." : "Enter your account email to receive a secure recovery link."}</p>
    <form onSubmit={submit} className="auth-form">
      <label htmlFor="email">Email address</label>
      <div className="auth-field"><Mail size={18}/><input id="email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required /></div>
      {view === "login" && <><label htmlFor="password">Password</label><div className="auth-field"><LockKeyhole size={18}/><input id="password" type="password" autoComplete="current-password" placeholder="Enter your password" value={password} onChange={e => setPassword(e.target.value)} minLength={6} required /></div></>}
      {error && <p className="auth-error" role="alert">{error}</p>}
      {message && <p className="auth-message" role="status">{message}</p>}
      <button className="auth-submit" type="submit" disabled={working}>{working ? "Please wait…" : view === "login" ? "Sign in" : "Send recovery link"}<ArrowRight size={18}/></button>
    </form>
    <button className="auth-link" type="button" onClick={() => {setError("");setMessage("");setView(view === "login" ? "recovery" : "login");}}>{view === "login" ? "Forgot password?" : "Return to sign in"}</button>
    <p className="auth-footnote">AURA is currently invitation-only. New account registration is closed.</p>
  </section></main>;
}
