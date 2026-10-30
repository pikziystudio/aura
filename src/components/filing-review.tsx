"use client";
import {useEffect,useMemo,useState,useRef} from "react";
import {getSupabase} from "@/lib/supabase";
import {findProjects,hasAliasConflict,normalizeProjectText,type Project,type ProjectAlias as Alias} from "@/lib/project-matching";
import {saveMemoryFiling,suggestMemoryTitle} from "@/lib/memory-filing";
type Capture={id:string;title:string|null;raw_transcript:string|null;corrected_transcript:string|null;project_id:string|null;filing_status?:string;filing_version?:number};
export default function FilingReview({capture,projects,onComplete}:{capture:Capture;projects:Project[];onComplete:()=>void}){
 const request=useRef<{fingerprint:string;id:string}|null>(null);
 const [aliases,setAliases]=useState<Alias[]>([]);
 const [confirmUnfile,setConfirmUnfile]=useState(false);
 const [title,setTitle]=useState(capture.title==="Voice note"?"":capture.title||"");
 const [project,setProject]=useState(capture.project_id||"");
 const [aliasText,setAliasText]=useState("");
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const transcript=capture.corrected_transcript||capture.raw_transcript||"";
 useEffect(()=>{let active=true;getSupabase().from("project_aliases").select("project_id,alias").then(({data,error})=>{if(active){if(error)setError("Could not load project aliases. Refresh before relying on suggestions.");else setAliases(data||[])}});return()=>{active=false};},[]);
 const matches=useMemo(()=>findProjects(transcript,projects,aliases),[transcript,projects,aliases]);
 const suggestedTitle=useMemo(()=>suggestMemoryTitle(transcript),[transcript]);
 useEffect(()=>{if(!title)setTitle(suggestedTitle)},[suggestedTitle,title]);
 const suggested=matches.length===1?matches[0].project:null;
 async function save(decision:"file"|"inbox"){
  if(busy)return;if(decision==="file"&&!project){setError("Please select a project, or keep this recording in Inbox.");return;}setBusy(true);setError("");
  try{
   const fingerprint=JSON.stringify([capture.id,capture.filing_version,decision,project,title,suggestedTitle,suggested?.id,confirmUnfile]);
   if(request.current?.fingerprint!==fingerprint)request.current={fingerprint,id:crypto.randomUUID()};
   await saveMemoryFiling(getSupabase(),capture,{requestId:request.current.id,
    decision,projectId:project,title:(title||suggestedTitle).trim(),suggestedTitle,
    suggestedProjectId:suggested?.id||null,confirmUnfile,
   });
   onComplete();
  }catch(e){setError(e instanceof Error?e.message:"Could not file recording.");}
  finally{setBusy(false);}
 }
 async function addAlias(){
  if(busy||!project||aliasText.trim().length<2)return;
  setBusy(true);setError("");
  try{const {data:{user}}=await getSupabase().auth.getUser();if(!user)throw Error("Sign in again.");
   const alias=aliasText.trim();
   const {data:existing,error:aliasError}=await getSupabase().from("project_aliases").select("project_id,alias").eq("owner_id",user.id);
   if(aliasError)throw aliasError;
   if(hasAliasConflict(alias,project,projects,existing||[]))throw Error("This alias matches a different project. Please review it manually.");
   if((existing||[]).some(a=>a.project_id===project&&normalizeProjectText(a.alias)===normalizeProjectText(alias))){setNotice("This alias is already saved.");return;}
   const {error}=await getSupabase().from("project_aliases").insert({owner_id:user.id,project_id:project,alias});if(error)throw error;
   setAliases(prev=>[...prev,{project_id:project,alias}]);setAliasText("");setNotice("Verified alias saved for future matching.");
  }catch(e){setError(e instanceof Error?e.message:"Couldn't save alias.");}
  finally{setBusy(false);}
 }
 return <section className="editor-card filing-review-card" aria-label="Review memory filing">
  <div className="editor-head"><h2>Review before filing</h2><span className="eyebrow">NOT AUTO-FILED</span></div>
  <p>{transcript.slice(0,380)||"No transcript yet. You can still file manually."}</p>
  <label>Suggested title <input value={title} maxLength={200} onChange={e=>setTitle(e.target.value)} /></label>
  <label>Project <select value={project} onChange={e=>setProject(e.target.value)}>
    <option value="">No project / Inbox</option>
    {projects.map(p=><option key={p.id} value={p.id}>{p.name}{matches.some(x=>x.project.id===p.id)?" (name match)":""}</option>)}
  </select></label>
  {suggested&&<div><p role="status">Possible project: <strong>{suggested.name}</strong> ({matches[0].evidence}). Please verify before filing.</p><button type="button" className="subtle-action" disabled={busy} onClick={()=>setProject(suggested.id)}>Select {suggested.name}</button></div>}
  {matches.length>1&&<p className="workspace-error">Multiple possible projects: {matches.map(m=>`${m.project.name} (${m.evidence})`).join(", ")}. Please choose manually.</p>}
  {project&&<div><label>Verified pronunciation / spelling alias (optional)<input value={aliasText} onChange={e=>setAliasText(e.target.value)} placeholder="e.g. Deer Mind" /></label><button type="button" className="subtle-action" disabled={busy||aliasText.trim().length<2} onClick={()=>void addAlias()}>Remember confirmed alias</button></div>}
  {capture.project_id&&<label><input type="checkbox" checked={confirmUnfile} onChange={e=>setConfirmUnfile(e.target.checked)}/> Remove the existing project when moving to Inbox</label>}
  {notice&&<p role="status">{notice}</p>}{error&&<p role="alert" className="workspace-error">{error}</p>}
  <div style={{display:"flex",flexWrap:"wrap",gap:8}}><button className="primary-action" disabled={busy} onClick={()=>void save("file")}>Confirm filing</button><button className="subtle-action" disabled={busy||Boolean(capture.project_id&&!confirmUnfile)} onClick={()=>void save("inbox")}>Keep in Inbox</button></div>
 </section>;
}
