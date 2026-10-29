"use client";
import {useEffect,useMemo,useState} from "react";
import {getSupabase} from "@/lib/supabase";
type Project={id:string;name:string};
type Alias={project_id:string;alias:string};
type Capture={id:string;title:string|null;raw_transcript:string|null;corrected_transcript:string|null;project_id:string|null;filing_status?:string};
const norm=(s:string)=>s.replace(/([a-z])([A-Z])/g,"$1 $2").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim();
const compact=(s:string)=>norm(s).replace(/\s/g,"");
function findProjects(text:string,projects:Project[],aliases:Alias[]){
 const tokens=norm(text).split(" ").filter(Boolean);
 const input=" "+tokens.join(" ")+" ";
 return projects.map(project=>{
  const names=[project.name,...aliases.filter(a=>a.project_id===project.id).map(a=>a.alias)];
  let best={project,matched:"",score:0};
  for(const name of names){
   const n=norm(name),words=n.split(" ").filter(Boolean);
   if(!words.length)continue;
   let score=input.includes(" "+n+" ")?100:0;
   const key=compact(name);
   for(let i=0;i<tokens.length;i++){
    for(let size=Math.max(1,words.length-1);size<=Math.min(words.length+2,tokens.length-i);size++){
     if(compact(tokens.slice(i,i+size).join(" "))===key)score=Math.max(score,92);
    }
   }
   if(words.length===2&&["dear","deer","dr"].includes(words[0])&&words[1]==="mind"){
    for(let i=0;i<tokens.length-1;i++){
     if(tokens[i+1]==="mind"&&["dear","deer","dr"].includes(tokens[i]))score=Math.max(score,76);
     if(tokens[i+1]==="mind"&&tokens[i]==="your"&&tokens.slice(i+2,i+4).includes("project"))score=Math.max(score,58);
    }
   }
   if(score>best.score)best={project,matched:name,score};
  }
  return best;
 }).filter(x=>x.score>=55).sort((a,b)=>b.score-a.score);
}
export default function FilingReview({capture,projects,onComplete}:{capture:Capture;projects:Project[];onComplete:()=>void}){
 const [aliases,setAliases]=useState<Alias[]>([]);
 const [title,setTitle]=useState(capture.title==="Voice note"?"":capture.title||"");
 const [project,setProject]=useState(capture.project_id||"");
 const [aliasText,setAliasText]=useState("");
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const transcript=capture.corrected_transcript||capture.raw_transcript||"";
 useEffect(()=>{let active=true;getSupabase().from("project_aliases").select("project_id,alias").then(({data})=>{if(active)setAliases(data||[])});return()=>{active=false};},[]);
 const matches=useMemo(()=>findProjects(transcript,projects,aliases),[transcript,projects,aliases]);
 const suggestedTitle=useMemo(()=>{
  const sentence=transcript.split(/[.!?\n]/)[0]?.trim()||"";
  return sentence?sentence.slice(0,82).replace(/\s+\S*$/,"").trim()||sentence.slice(0,82):"Untitled recording";
 },[transcript]);
 useEffect(()=>{if(!title)setTitle(suggestedTitle)},[suggestedTitle,title]);
 const suggested=matches.length===1?matches[0].project:null;
 async function save(decision:"file"|"inbox"){
  if(busy)return;if(decision==="file"&&!project){setError("Please select a project, or keep this recording in Inbox.");return;}setBusy(true);setError("");
  try{
   const client=getSupabase();const {data:{user}}=await client.auth.getUser();if(!user)throw Error("Sign in again.");
   const finalProject=decision==="file"?(project||null):null;
   const finalTitle=(title||suggestedTitle).trim();
   const {data:before,error:readError}=await client.from("captures").select("id,owner_id").eq("id",capture.id).single();
   if(readError||before?.owner_id!==user.id)throw Error("Recording is unavailable.");
   const {error:updateError}=await client.from("captures").update({title:finalTitle,project_id:finalProject,filing_status:decision==="file"?"filed":"inbox",suggested_title:suggestedTitle,suggested_project_id:suggested?.id||null}).eq("id",capture.id).eq("owner_id",user.id);
   if(updateError)throw updateError;
   const {error:historyError}=await client.from("filing_decisions").insert({owner_id:user.id,capture_id:capture.id,project_id:finalProject,title:finalTitle,decision});
   if(historyError)throw Error("Filing saved, but history was not recorded: "+historyError.message);
   onComplete();
  }catch(e){setError(e instanceof Error?e.message:"Could not file recording.");}
  finally{setBusy(false);}
 }
 async function addAlias(){
  if(!project||aliasText.trim().length<2)return;
  setBusy(true);setError("");
  try{const {data:{user}}=await getSupabase().auth.getUser();if(!user)throw Error("Sign in again.");
   const alias=aliasText.trim();
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
  {suggested&&<div><p role="status">Possible project: <strong>{suggested.name}</strong> ({matches[0].score===100?"name found":matches[0].score>=90?"spelling variation":matches[0].score>=70?"phonetic possibility":"weak contextual possibility"}). Please verify before filing.</p><button type="button" className="subtle-action" onClick={()=>setProject(suggested.id)}>Select {suggested.name}</button></div>}
  {matches.length>1&&<p className="workspace-error">Multiple project-name matches. Please choose manually.</p>}
  {project&&<div><label>Verified pronunciation / spelling alias (optional)<input value={aliasText} onChange={e=>setAliasText(e.target.value)} placeholder="e.g. Deer Mind" /></label><button type="button" className="subtle-action" disabled={busy||aliasText.trim().length<2} onClick={()=>void addAlias()}>Remember confirmed alias</button></div>}
  {notice&&<p role="status">{notice}</p>}{error&&<p role="alert" className="workspace-error">{error}</p>}
  <div style={{display:"flex",flexWrap:"wrap",gap:8}}><button className="primary-action" disabled={busy} onClick={()=>void save("file")}>Confirm filing</button><button className="subtle-action" disabled={busy} onClick={()=>void save("inbox")}>Keep in Inbox</button></div>
 </section>;
}
