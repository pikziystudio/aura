"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { getSupabase } from "@/lib/supabase";
import {hasAliasConflict} from "@/lib/project-matching";
import FilingReview from "@/components/filing-review";
import { Archive, ArrowLeft, FileText, FolderPlus, Plus, RefreshCw, Search, X } from "lucide-react";

type Project = {id:string;name:string;description:string|null;status:string;created_at:string};
type Memory = {id:string;title:string|null;raw_transcript:string|null;corrected_transcript:string|null;project_id:string|null;captured_at:string;file_storage_path:string|null;processing_status:string;filing_status?:string};
type Section = "projects" | "memory";
type AliasSuggestion = {projectId:string;projectName:string;alias:string;captureId:string};
function proposeAlias(original:string,corrected:string,projectName:string):string|null{
 const words=(v:string)=>v.match(/[\p{L}\p{N}]+/gu)||[];
 const a=words(original),b=words(corrected),project=words(projectName);
 if(!project.length||!a.length||!b.length||a.length>300||b.length>300)return null;
 const eq=(x:string,y:string)=>x.toLocaleLowerCase()===y.toLocaleLowerCase();
 let at=-1;
 for(let i=0;i<=b.length-project.length;i++)if(project.every((w,j)=>eq(w,b[i+j]))){at=i;break;}
 if(at<0)return null;
 // Keep all words outside the project span exactly aligned. Never infer from unrelated edits.
 if(a.length!==b.length||at+project.length>a.length)return null;
 if(a.some((w,i)=>(i<at||i>=at+project.length)&&!eq(w,b[i])))return null;
 const raw=a.slice(at,at+project.length).join(" ");
 if(raw.toLocaleLowerCase()===projectName.toLocaleLowerCase()||raw.length<2)return null;
 return raw;
}
export default function KnowledgeWorkspace({section,onBack}:{section:Section;onBack:()=>void}){
 const [owner,setOwner]=useState("");const [workspace,setWorkspace]=useState("");const [projects,setProjects]=useState<Project[]>([]);
 const [notes,setNotes]=useState<Memory[]>([]);const [aliasSuggestion,setAliasSuggestion]=useState<AliasSuggestion|null>(null);const [aliasBusy,setAliasBusy]=useState(false);const [reviewId,setReviewId]=useState<string|null>(null);const [editingTranscript,setEditingTranscript]=useState<string|null>(null);const [draftTranscript,setDraftTranscript]=useState("");const [savingCorrection,setSavingCorrection]=useState(false);const [modelChoice,setModelChoice]=useState<"whisper-base"|"whisper-small">("whisper-base");const [transcribing,setTranscribing]=useState<string|null>(null);const [transcribeProgress,setTranscribeProgress]=useState("");const [playing,setPlaying]=useState<string|null>(null);const [audioUrl,setAudioUrl]=useState<string|null>(null);const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");const [notice,setNotice]=useState("");const [query,setQuery]=useState("");
 const [creating,setCreating]=useState(false);const [title,setTitle]=useState("");const [body,setBody]=useState("");const [projectId,setProjectId]=useState("");
 const load=useCallback(async()=>{
  setLoading(true);setError("");
  try{
   const client=getSupabase();const {data:{user},error:authError}=await client.auth.getUser();
   if(authError||!user)throw new Error("Please sign in again.");
   const {data:ws,error:wError}=await client.from("workspaces").select("id").eq("owner_id",user.id).eq("kind","personal").limit(1).single();
   if(wError||!ws)throw wError||new Error("Personal workspace not available.");
   const [p,n]=await Promise.all([
    client.from("projects").select("id,name,description,status,created_at").eq("workspace_id",ws.id).eq("owner_id",user.id).order("created_at",{ascending:false}),
    client.from("captures").select("id,title,raw_transcript,corrected_transcript,project_id,captured_at,file_storage_path,processing_status,filing_status").eq("workspace_id",ws.id).eq("owner_id",user.id).eq("kind","note").order("captured_at",{ascending:false})
   ]);
   if(p.error)throw p.error;if(n.error)throw n.error;
   setOwner(user.id);setWorkspace(ws.id);setProjects(p.data||[]);setNotes(n.data||[]);
  }catch(e){setError(e instanceof Error?e.message:"Could not load your workspace.");}
  finally{setLoading(false);}
 },[]);
 useEffect(()=>{void load()},[load]);
 async function add(e:FormEvent){
  e.preventDefault();if(!title.trim()||busy)return;setBusy(true);setError("");setNotice("");
  try{
   const {data:{user}}=await getSupabase().auth.getUser();if(!user||user.id!==owner)throw new Error("Session expired.");
   if(section==="projects"){
    const {error}=await getSupabase().from("projects").insert({owner_id:owner,workspace_id:workspace,name:title.trim(),description:body.trim()||null});if(error)throw error;
   }else{
    const {error}=await getSupabase().from("captures").insert({owner_id:owner,workspace_id:workspace,project_id:projectId||null,kind:"note",title:title.trim(),raw_transcript:body.trim()||null,processing_status:"complete"});if(error)throw error;
   }
   setCreating(false);setTitle("");setBody("");setProjectId("");setNotice(section==="projects"?"Project created.":"Note saved.");await load();
  }catch(e){setError(e instanceof Error?e.message:"Unable to save.");}finally{setBusy(false);}
 }
 async function transcribe(note:Memory){
  if(!note.file_storage_path || transcribing)return;
  setError("");setNotice("");setTranscribing(note.id);setTranscribeProgress("Retrieving your private audio…");
  let engine: { dispose: () => void } | null = null;
  try {
    const client=getSupabase();
    const {data:{user},error:authError}=await client.auth.getUser();
    if(authError || user?.id !== owner)throw Error("Please sign in again.");
    const {data:audio,error:downloadError}=await client.storage.from("aura-recordings").download(note.file_storage_path);
    if(downloadError || !audio)throw Error(downloadError?.message || "Unable to download your audio.");
    setTranscribeProgress("Loading a free local Whisper model for this browser. First download may be large…");
    const { BrowserWhisper }=await import("browser-whisper");
    const whisper=new BrowserWhisper({model:modelChoice});
    engine=whisper;
    const file=new File([audio],"recording."+ (note.file_storage_path.split(".").pop()||"webm"),{type:audio.type||"audio/webm"});
    const segments=await whisper.transcribe(file,{
      onProgress:({stage,progress}:{stage:string;progress:number})=>setTranscribeProgress(
        (stage==="loading"?"Downloading model":stage==="decoding"?"Preparing audio":"Transcribing locally")+
        " · "+Math.round(progress*100)+"%"
      )
    }).collect();
    const transcript=segments.map(segment=>segment.text).join(" ").trim();
    if(!transcript)throw Error("No speech recognized. Try a clearer recording or a larger model.");
    const {error:saveError}=await client.from("captures").update({raw_transcript:transcript,processing_status:"complete"})
      .eq("id",note.id).eq("owner_id",owner).is("raw_transcript",null);
    if(saveError)throw Error("Recognized speech, but failed to save: "+saveError.message);
    setNotice("Transcript saved. Review the suggested project before filing.");
    setReviewId(note.id);
    await load();
  }catch(e){setError(e instanceof Error?e.message:"Local transcription failed.");}
  finally{engine?.dispose();setTranscribing(null);setTranscribeProgress("");}
 }
 async function saveCorrection(note:Memory){
  if(!draftTranscript.trim())return setError("Corrected transcript cannot be empty.");
  setSavingCorrection(true);setError("");
  try{
   const {error}=await getSupabase().from("captures").update({corrected_transcript:draftTranscript.trim()}).eq("id",note.id).eq("owner_id",owner);
   if(error)throw error;
   setEditingTranscript(null);
   const knownProject=projects.find(p=>p.id===note.project_id);
   const possibleAlias=knownProject&&note.raw_transcript?proposeAlias(note.raw_transcript,draftTranscript.trim(),knownProject.name):null;
   setAliasSuggestion(possibleAlias&&knownProject?{projectId:knownProject.id,projectName:knownProject.name,alias:possibleAlias,captureId:note.id}:null);
   setNotes(prev=>prev.map(n=>n.id===note.id?{...n,corrected_transcript:draftTranscript.trim()}:n));
   setNotice("Correction saved. Original machine transcript preserved.");
   await load();
  }catch(e){setError(e instanceof Error?e.message:"Could not save correction.");}
  finally{setSavingCorrection(false);}
 }
 async function confirmAlias(){
  if(!aliasSuggestion||aliasBusy)return;
  setAliasBusy(true);setError("");
  try{
   const {data:{user}}=await getSupabase().auth.getUser();
   if(!user||user.id!==owner)throw new Error("Please sign in again.");
   const {data:existing,error:checkError}=await getSupabase().from("project_aliases").select("project_id,alias").eq("owner_id",owner);
   if(checkError)throw checkError;
   if(hasAliasConflict(aliasSuggestion.alias,aliasSuggestion.projectId,projects,existing||[]))throw new Error("This alias is already associated with a different project. Please review it manually.");
   if(!existing?.some(a=>a.project_id===aliasSuggestion.projectId&&a.alias.toLowerCase()===aliasSuggestion.alias.toLowerCase())){
    const {error}=await getSupabase().from("project_aliases").insert({owner_id:owner,project_id:aliasSuggestion.projectId,alias:aliasSuggestion.alias});
    if(error)throw error;
   }
   setAliasSuggestion(null);setNotice("Verified spelling remembered for future project suggestions.");
  }catch(e){setError(e instanceof Error?e.message:"Could not remember alias.");}
  finally{setAliasBusy(false);}
 }
 async function playRecording(note:Memory){
  if(!note.file_storage_path)return;setError("");setPlaying(note.id);setAudioUrl(null);
  const {data,error}=await getSupabase().storage.from("aura-recordings").createSignedUrl(note.file_storage_path,300);
  if(error||!data?.signedUrl){setError(error?.message||"Recording unavailable.");setPlaying(null);return;}
  setAudioUrl(data.signedUrl);
 }
 async function archive(p:Project){
  if(!confirm("Archive this project? Its notes will be kept."))return;
  setError("");const {error}=await getSupabase().from("projects").update({status:"archived"}).eq("id",p.id).eq("owner_id",owner);
  if(error)setError(error.message);else void load();
 }
 const filteredProjects=projects.filter(p=>p.name.toLowerCase().includes(query.toLowerCase())&&p.status!=="archived");
 const filteredNotes=notes.filter(n=>[n.title,n.raw_transcript,n.corrected_transcript,projects.find(p=>p.id===n.project_id)?.name].some(s=>s?.toLowerCase().includes(query.toLowerCase())));
 return <div className="workspace-view">
  <div className="workspace-top"><button className="subtle-action" onClick={onBack}><ArrowLeft size={17}/> Home</button><span>Private workspace</span></div>
  <div className="workspace-heading"><div><span className="eyebrow">YOUR SPACE TO THINK</span><h1>{section==="projects"?"Your projects.":"My Memory."}</h1><p>{section==="projects"?"A quiet place for everything you're building.":"Thoughts and notes, safely kept and easy to find."}</p></div><button className="primary-action" onClick={()=>setCreating(v=>!v)}><Plus size={18}/>{section==="projects"?"New project":"New note"}</button></div>
  <div className="workspace-tools"><label className="workspace-search"><Search size={19}/><input aria-label="Search" placeholder={section==="projects"?"Find a project":"Find a note"} value={query} onChange={e=>setQuery(e.target.value)}/></label><button className="subtle-action" onClick={()=>void load()}><RefreshCw size={17}/> Refresh</button></div>
  {creating&&<form className="editor-card" onSubmit={add}><div className="editor-head"><h2>{section==="projects"?"Create project":"Capture a note"}</h2><button type="button" className="icon-action" aria-label="Close form" onClick={()=>setCreating(false)}><X size={19}/></button></div><label>Title<input value={title} onChange={e=>setTitle(e.target.value)} maxLength={section==="projects"?200:150} required placeholder={section==="projects"?"Project name":"What's on your mind?"}/></label><label>{section==="projects"?"Description (optional)":"Your thoughts"}<textarea value={body} onChange={e=>setBody(e.target.value)} rows={4} placeholder="Write naturally…"/></label>{section==="memory"&&<label>Related project (optional)<select value={projectId} onChange={e=>setProjectId(e.target.value)}><option value="">No project</option>{projects.filter(p=>p.status==="active").map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}<button disabled={busy} type="submit" className="primary-action">{busy?"Saving…":"Save"}</button></form>}
  {error&&<p role="alert" className="workspace-error">{error}</p>}{transcribing&&<p role="status" className="workspace-notice">{transcribeProgress}</p>}{notice&&<p role="status" className="workspace-notice">{notice}</p>}
  {aliasSuggestion&&<section className="editor-card" aria-label="Confirm project vocabulary">
   <h2>Remember this project spelling?</h2>
   <p>AURA noticed a possible project-name correction. Should <strong>{aliasSuggestion.alias}</strong> refer to <strong>{aliasSuggestion.projectName}</strong> in future matching?</p>
   <p>Only confirm if these names refer to the same project. This does not change your original audio or raw transcript.</p>
   <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
    <button type="button" className="primary-action" disabled={aliasBusy} onClick={()=>void confirmAlias()}>{aliasBusy?"Saving…":"Yes, remember alias"}</button>
    <button type="button" className="subtle-action" disabled={aliasBusy} onClick={()=>setAliasSuggestion(null)}>No, just save correction</button>
   </div>
  </section>}
  {loading?<div className="workspace-empty">Loading your workspace…</div>:section==="projects"?
    filteredProjects.length?<div className="workspace-grid">{filteredProjects.map(p=><article className="record-card" key={p.id}><div className="record-icon"><FolderPlus size={23}/></div><h2>{p.name}</h2><p>{p.description||"A new space for your ideas and notes."}</p><div className="record-footer"><span>Created {new Date(p.created_at).toLocaleDateString()}</span><button className="subtle-action" aria-label={"Archive "+p.name} onClick={()=>void archive(p)}><Archive size={16}/> Archive</button></div></article>)}</div>:<div className="workspace-empty"><FolderPlus size={30}/><h2>No projects yet</h2><p>Create your first project to start organizing your thoughts.</p></div>:
    filteredNotes.length?<div className="workspace-list">{filteredNotes.map(n=><article className="memory-record" key={n.id}><span className="record-icon"><FileText size={20}/></span><div><h2>{n.title||"Untitled note"}</h2><p>{n.corrected_transcript||n.raw_transcript|| (n.file_storage_path?"Audio saved. Transcript not available yet.":"No details added.")}</p>{n.raw_transcript&&<div><button type="button" className="subtle-action" onClick={()=>setReviewId(reviewId===n.id?null:n.id)}>{reviewId===n.id?"Close filing review":"Review filing"}</button><button type="button" className="subtle-action" onClick={()=>{setEditingTranscript(n.id);setDraftTranscript(n.corrected_transcript||n.raw_transcript||"");}}>Correct transcript</button>{n.corrected_transcript&&<small>Human-corrected · Original retained</small>}{editingTranscript===n.id&&<div className="editor-card"><label>Corrected transcript<textarea rows={4} value={draftTranscript} onChange={e=>setDraftTranscript(e.target.value)} /></label><div><button type="button" className="primary-action" disabled={savingCorrection} onClick={()=>void saveCorrection(n)}>{savingCorrection?"Saving…":"Save correction"}</button><button type="button" className="subtle-action" onClick={()=>setEditingTranscript(null)}>Cancel</button></div></div>}</div>}{reviewId===n.id&&<FilingReview capture={n} projects={projects} onComplete={()=>{setReviewId(null);void load();}}/>}{n.file_storage_path&&<div><button type="button" className="subtle-action" onClick={()=>void playRecording(n)}>Play recording</button>{!n.raw_transcript&&<label style={{display:"inline-flex",alignItems:"center",gap:6,fontSize:12}}>Model <select value={modelChoice} onChange={e=>setModelChoice(e.target.value as "whisper-base"|"whisper-small")} disabled={!!transcribing}><option value="whisper-base">Base · faster</option><option value="whisper-small">Small · more accurate, ~586 MB</option></select></label>}{!n.raw_transcript&&<button type="button" className="subtle-action" disabled={!!transcribing} onClick={()=>void transcribe(n)}>{transcribing===n.id?"Working locally…":"Transcribe offline (free)"}</button>}{playing===n.id&&audioUrl&&<audio controls src={audioUrl} preload="none" />}</div>}<small>{new Date(n.captured_at).toLocaleString()} {n.project_id?"· "+(projects.find(p=>p.id===n.project_id)?.name||"Project"):""}</small></div></article>)}</div>:<div className="workspace-empty"><FileText size={30}/><h2>No notes yet</h2><p>Capture a thought to begin building your personal memory.</p></div>}
 </div>;
}
