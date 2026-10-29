"use client";

import AuthGate from "@/components/auth-gate";

import { useState } from "react";
import { AudioLines, Brain, FolderClosed, Home, Lightbulb, ListTodo, Mic, Search, Settings2, Sparkles } from "lucide-react";

const nav = [{ label: "Home", Icon: Home },{ label: "My Memory", Icon: Brain },{ label: "Projects", Icon: FolderClosed },{ label: "Ideas", Icon: Lightbulb },{ label: "Tasks", Icon: ListTodo },{ label: "Search", Icon: Search }];

function HomeContent() {
  const [mode, setMode] = useState<"ready" | "preview">("ready");
  return <div className="shell">
    <aside className="sidebar"><div className="brand"><span className="brand-orb" /><span><strong>AURA</strong><small>Your personal AI assistant</small></span></div>
      <nav aria-label="Main navigation">{nav.map(({label,Icon})=><button key={label} className={label==="Home"?"nav-item active":"nav-item"} type="button" aria-current={label==="Home"?"page":undefined} onClick={()=>label!=="Home"&&alert(label+" will be available in a later milestone.")}><Icon size={19}/>{label}</button>)}</nav>
      <div className="sidebar-bottom"><span className="status-dot" /> Development preview<br/><button className="nav-item settings" onClick={()=>alert("Settings are planned for a later milestone.")}><Settings2 size={18}/> Settings</button></div>
    </aside>
    <main className="main"><div className="topbar"><span>AURA / Home</span><span>Design preview · No recording connected</span></div>
      <section className="hero" aria-labelledby="hero-title"><div className="ambient ambient-one"/><div className="ambient ambient-two"/><div className="hero-inner"><span className="eyebrow">YOUR SPACE TO THINK</span><h1 id="hero-title">Good morning<span className="period">.</span></h1><p>What's on your mind today?</p>
      <button className="voice-orb" type="button" aria-label="Preview voice interaction" onClick={()=>setMode(mode==="ready"?"preview":"ready")}><AudioLines size={40} strokeWidth={1.6}/></button>
      <strong>{mode==="ready"?"Tap to speak":"Voice capture preview"}</strong><span className="hint">{mode==="ready"?"AURA is ready":"Microphone recording isn't connected yet"}</span>
      <div className="quick-actions"><button onClick={()=>setMode("preview")}><Mic size={17}/> Capture a thought</button><button onClick={()=>alert("AI conversation is coming later.")}><Sparkles size={17}/> Ask AURA</button><button onClick={()=>alert("Project summaries are coming later.")}>Summarize</button></div></div></section>
      <section className="bottom-content"><div className="section-heading"><h2>Pick up where you left off</h2><span>A quieter way to keep going</span></div><div className="project-row">{[{name:"AURA",description:"Your personal AI assistant",symbol:"✦"},{name:"PikZiy Books",description:"Accounting platform",symbol:"▣"},{name:"ALPY",description:"Booking platform",symbol:"◈"}].map(x=><button className="project" key={x.name} onClick={()=>alert("Project details are not connected yet.")}><span className="project-icon">{x.symbol}</span><span><strong>{x.name}</strong><small>{x.description}</small></span><span className="chevron">›</span></button>)}</div></section>
      <footer>Private by design · Voice first · Built for Windows and Android</footer>
    </main>
  </div>;
}

export default function HomePage() { return <AuthGate><HomeContent /></AuthGate>; }
