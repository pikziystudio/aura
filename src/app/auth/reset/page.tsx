"use client";

import { useEffect, useState, type FormEvent } from "react";
import { getSupabase } from "@/lib/supabase";
import Link from "next/link";

export default function PasswordReset() {
  const [password,setPassword]=useState("");
  const [ready,setReady]=useState(false);
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  useEffect(()=>{
    let active=true;
    let sessionEventSeen=false;
    let unsubscribe=()=>{};
    try {
      const client=getSupabase();
      client.auth.getSession().then(({data,error})=>{
        if(!active||sessionEventSeen)return;
        if(error)setMessage("Could not verify recovery session. Open a new recovery link.");
        else setReady(Boolean(data.session));
      }).catch(()=>{if(active&&!sessionEventSeen)setMessage("Could not verify recovery session. Please try again.");});
      const {data}=client.auth.onAuthStateChange((_event,session)=>{sessionEventSeen=true;if(active)setReady(Boolean(session));});
      unsubscribe=()=>data.subscription.unsubscribe();
    } catch { setMessage("Authentication is not configured. Contact the workspace administrator."); }
    return ()=>{active=false;unsubscribe();};
  },[]);
  async function save(e:FormEvent){
    e.preventDefault();setBusy(true);setMessage("");
    try{
      const {error}=await getSupabase().auth.updateUser({password});
      if(error)throw error;
      setMessage("Password updated. You can return to AURA.");
    }catch(err){setMessage(err instanceof Error?err.message:"Could not update password.");}
    finally{setBusy(false);}
  }
  return <main className="auth-page"><section className="auth-panel"><div className="auth-logo"><div className="auth-logo-orb"/>AURA</div><h1>Choose a new password.</h1><p className="auth-subtitle">Follow the recovery link from your email before updating your password.</p>{ready?<form className="auth-form" onSubmit={save}><label htmlFor="newpass">New password</label><div className="auth-field"><input id="newpass" type="password" minLength={12} value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password" required/></div><button className="auth-submit" disabled={busy}>{busy?"Updating…":"Update password"}</button></form>:<p className="auth-error">No active recovery session yet. Open the latest password recovery email link.</p>}{message&&<p role="status">{message}</p>}<Link className="auth-link" href="/">Return to AURA</Link></section></main>;
}
