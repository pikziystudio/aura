"use client";
import { useEffect, useRef, useState } from "react";
import { Mic, Pause, Play, Square, Upload, X } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { useObjectUrl } from "@/lib/use-object-url";
type Props={onClose:()=>void};
export default function VoiceCapture({onClose}:Props){
 const mounted=useRef(true);
 const recorder=useRef<MediaRecorder|null>(null),stream=useRef<MediaStream|null>(null),parts=useRef<Blob[]>([]);
 const [state,setState]=useState<"idle"|"starting"|"recording"|"paused"|"saved"|"uploading">("idle");
 const [audio,setAudio]=useState<Blob|null>(null),[title,setTitle]=useState("Voice note"),[error,setError]=useState(""),[progress,setProgress]=useState("");
 const audioUrl=useObjectUrl(audio);
 const [projects,setProjects]=useState<{id:string;name:string}[]>([]),[project,setProject]=useState("");
 const [workspace,setWorkspace]=useState(""),[owner,setOwner]=useState("");
 useEffect(()=>{mounted.current=true;let active=true;getSupabase().auth.getUser().then(async ({data})=>{if(!data.user)return;const user=data.user;
 const {data:ws}=await getSupabase().from("workspaces").select("id").eq("owner_id",user.id).eq("kind","personal").limit(1).single();
 if(!ws||!active)return;setOwner(user.id);setWorkspace(ws.id);
 const {data:ps}=await getSupabase().from("projects").select("id,name").eq("workspace_id",ws.id).eq("owner_id",user.id).eq("status","active");if(active)setProjects(ps||[]);
 }).catch(()=>{});return()=>{active=false;mounted.current=false;recorder.current?.state!=="inactive"&&recorder.current?.stop();stream.current?.getTracks().forEach(t=>t.stop());};},[]);
 useEffect(()=>{
  if(state==="idle")return;
  const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue="";};
  window.addEventListener("beforeunload",warn);
  return()=>window.removeEventListener("beforeunload",warn);
 },[state]);
 function close(){
  if(state!=="idle"&&!window.confirm("This recording is not safely saved yet. Close and discard it?"))return;
  onClose();
 }
 async function start(){setError("");setState("starting");try{if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)throw Error("Browser recording is unavailable. Use a recent browser and HTTPS.");
 const media=await navigator.mediaDevices.getUserMedia({audio:true});if(!mounted.current){media.getTracks().forEach(t=>t.stop());return;}stream.current=media;parts.current=[];
 const type=["audio/webm;codecs=opus","audio/webm","audio/mp4"].find(t=>MediaRecorder.isTypeSupported(t));
 const r=new MediaRecorder(media,type?{mimeType:type}:undefined);recorder.current=r;r.ondataavailable=e=>{if(e.data.size)parts.current.push(e.data);};
 r.onstop=()=>{const blob=new Blob(parts.current,{type:r.mimeType||"audio/webm"});if(mounted.current){setAudio(blob);setState("saved");}media.getTracks().forEach(t=>t.stop());};r.start(1000);setState("recording");
 }catch(e){stream.current?.getTracks().forEach(t=>t.stop());if(mounted.current){setState("idle");setError(e instanceof Error?e.message:"Microphone access failed.");}}}
 function stop(){if(recorder.current?.state!=="inactive")recorder.current?.stop();}
 async function upload(){if(!audio||!workspace||!owner)return setError("Workspace is not ready.");setState("uploading");setError("");
 try{const {data:{user},error:authError}=await getSupabase().auth.getUser();if(authError||user?.id!==owner)throw Error("Sign in again.");
 const ext=audio.type.includes("mp4")?"mp4":audio.type.includes("ogg")?"ogg":"webm";
 const path=`${owner}/${crypto.randomUUID()}.${ext}`;
 const {error:upErr}=await getSupabase().storage.from("aura-recordings").upload(path,audio,{contentType:audio.type||"audio/webm",upsert:false});
 if(upErr)throw upErr;
 const {error:dbErr}=await getSupabase().from("captures").insert({owner_id:owner,workspace_id:workspace,project_id:project||null,kind:"note",title:title.trim()||"Voice note",file_storage_path:path,processing_status:"pending"});
 if(dbErr)throw Error("Audio uploaded but capture record failed. Keep this window open and contact support: "+dbErr.message);
 setProgress("Recording saved securely to your private workspace.");setAudio(null);setState("idle");
 }catch(e){setError(e instanceof Error?e.message:"Upload failed.");setState("saved");}}
 return <div className="capture-backdrop" role="presentation"><section className="capture-dialog" role="dialog" aria-modal="true" aria-label="Voice capture">
 <header><strong>Voice capture</strong><button type="button" onClick={close} aria-label="Close"><X size={20}/></button></header>
 <div className="capture-symbol"><Mic size={35}/></div><h2>{state==="starting"?"Opening microphone…":state==="recording"?"Listening…":state==="paused"?"Paused":state==="uploading"?"Saving…":state==="saved"?"Ready to save":"Capture a thought"}</h2>
 <p>Keep your original recording. Transcription is coming later.</p>
 <div className="capture-controls">{state==="idle"&&<button onClick={()=>void start()}><Mic size={18}/> Start recording</button>}
 {(state==="recording"||state==="paused")&&<><button onClick={()=>{if(recorder.current?.state==="recording"){recorder.current.pause();setState("paused");}else if(recorder.current?.state==="paused"){recorder.current.resume();setState("recording");}}}>{state==="paused"?<Play size={17}/>:<Pause size={17}/>} {state==="paused"?"Resume":"Pause"}</button><button onClick={stop}><Square size={17}/> Finish</button></>}</div>
 {audio&&<><audio controls src={audioUrl} /><label>Title<input value={title} onChange={e=>setTitle(e.target.value)} maxLength={140}/></label><label>Project (optional)<select value={project} onChange={e=>setProject(e.target.value)}><option value="">Personal</option>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><button className="capture-save" disabled={state==="uploading"} onClick={()=>void upload()}><Upload size={17}/> {state==="uploading"?"Uploading…":"Save recording"}</button><small>Upload requires internet. The recording is not yet safely stored offline if this tab closes.</small></>}
 {progress&&<p role="status">{progress}</p>}{error&&<p role="alert" className="workspace-error">{error}</p>}</section></div>;
}
