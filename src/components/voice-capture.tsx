"use client";
import { useEffect, useRef, useState } from "react";
import { Mic, Pause, Play, Square, Upload, X } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { useObjectUrl } from "@/lib/use-object-url";
import { appendDraftChunk, deleteDraft, listDrafts, readDraftAudio, saveDraft, type RecordingDraft } from "@/lib/recording-drafts";
import { uploadRecording } from "@/lib/upload-recording";
type Props = { onClose: () => void };
type State = "idle" | "starting" | "recording" | "paused" | "saved" | "uploading";

export default function VoiceCapture({ onClose }: Props) {
  const mounted = useRef(true), recorder = useRef<MediaRecorder | null>(null), stream = useRef<MediaStream | null>(null);
  const currentDraft = useRef<RecordingDraft | null>(null);
  const [state, setState] = useState<State>("idle");
  const [audio, setAudio] = useState<Blob | null>(null), [title, setTitle] = useState("Voice note");
  const [error, setError] = useState(""), [progress, setProgress] = useState("");
  const [projects, setProjects] = useState<{id:string;name:string}[]>([]), [project, setProject] = useState("");
  const [workspace, setWorkspace] = useState(""), [owner, setOwner] = useState("");
  const [drafts, setDrafts] = useState<RecordingDraft[]>([]);
  const audioUrl = useObjectUrl(audio);

  useEffect(() => {
    mounted.current = true;
    let active = true;
    async function load() {
      const client = getSupabase();
      const {data:{user},error:authError} = await client.auth.getUser();
      if (authError || !user) throw Error("Please sign in again.");
      const {data:ws,error:workspaceError} = await client.from("workspaces").select("id")
        .eq("owner_id",user.id).eq("kind","personal").limit(1).single();
      if(workspaceError || !ws) throw Error("Workspace is unavailable.");
      const {data:ps,error:projectError} = await client.from("projects").select("id,name")
        .eq("workspace_id",ws.id).eq("owner_id",user.id).eq("status","active");
      if(projectError) throw projectError;
      const recovered = await listDrafts(user.id,ws.id);
      if(active){setOwner(user.id);setWorkspace(ws.id);setProjects(ps||[]);setDrafts(recovered);}
    }
    void load().catch(() => {if(active)setError("Could not open workspace or local recording storage. Check browser storage permissions and retry.");});
    return () => {
      active = false; mounted.current = false;
      if(recorder.current && recorder.current.state !== "inactive") recorder.current.stop();
      stream.current?.getTracks().forEach(track => track.stop());
    };
  }, []);
  useEffect(() => {
    if(state === "idle") return;
    const warn = (event:BeforeUnloadEvent) => {event.preventDefault();event.returnValue="";};
    const flush = () => {if(recorder.current && recorder.current.state!=="inactive")recorder.current.requestData();};
    window.addEventListener("beforeunload",warn);
    window.addEventListener("pagehide",flush);
    document.addEventListener("visibilitychange",flush);
    return () => {window.removeEventListener("beforeunload",warn);window.removeEventListener("pagehide",flush);document.removeEventListener("visibilitychange",flush);};
  }, [state]);

  async function start() {
    if(!owner || !workspace) {setError("Workspace and local storage must be ready before recording.");return;}
    setError("");setProgress("");setState("starting");
    try {
      if(!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw Error("Browser recording is unavailable. Use HTTPS and a recent browser.");
      const media = await navigator.mediaDevices.getUserMedia({audio:true});
      if(!mounted.current){media.getTracks().forEach(track=>track.stop());return;}
      stream.current=media;
      const type=["audio/webm;codecs=opus","audio/webm","audio/mp4"].find(type=>MediaRecorder.isTypeSupported(type));
      const recording=new MediaRecorder(media,type?{mimeType:type}:undefined);
      const draft:RecordingDraft={id:crypto.randomUUID(),ownerId:owner,workspaceId:workspace,mimeType:recording.mimeType||"audio/webm",
        title:"Voice note",projectId:null,createdAt:Date.now(),status:"recording"};
      await saveDraft(draft);
      if(!mounted.current){media.getTracks().forEach(track=>track.stop());return;}
      currentDraft.current=draft;recorder.current=recording;
      const chunks:Blob[]=[];
      let pending=Promise.resolve(), sequence=0, storageFailed=false;
      recording.ondataavailable=event=>{
        if(!event.data.size)return;
        chunks.push(event.data);
        const index=sequence++;
        pending=pending.then(()=>appendDraftChunk(draft.id,index,event.data)).catch(()=>{
          storageFailed=true;
          if(mounted.current)setError("Local storage failed. Recording stopped; keep this tab open and upload or download the audio before closing.");
          if(recording.state!=="inactive")recording.stop();
        });
      };
      recording.onstop=()=>{
        media.getTracks().forEach(track=>track.stop());
        void (async()=>{
          await pending;
          const ready={...draft,status:"ready" as const};
          try {if(!storageFailed)await saveDraft(ready);} catch {storageFailed=true;}
          if(mounted.current){
            currentDraft.current=ready;setAudio(new Blob(chunks,{type:draft.mimeType}));setState("saved");
            setProgress(storageFailed?"Local copy is incomplete. Keep this tab open and save the audio now.":"Audio chunks saved on this device. Upload when ready.");
          }
        })();
      };
      recording.onerror=()=>{if(mounted.current)setError("Recorder failed. Recover the saved chunks and verify playback before uploading.");if(recording.state!=="inactive")recording.stop();};
      recording.start(1000);setState("recording");
      // Persistence requests can be denied; never promise immunity from browser eviction.
      void navigator.storage?.persist?.().catch(()=>false);
    } catch (failure) {
      stream.current?.getTracks().forEach(track=>track.stop());
      if(mounted.current){setState("idle");setError(failure instanceof Error?failure.message:"Unable to start recording.");}
    }
  }
  async function recover(draft:RecordingDraft) {
    setError("");
    try {
      const blob=await readDraftAudio(draft);
      if(!blob.size)throw Error("No completed audio chunks were saved. You may discard this empty draft.");
      currentDraft.current=draft;setAudio(blob);setTitle(draft.title);setProject(draft.projectId||"");setState("saved");
      setProgress("Recovered saved chunks. The last uncommitted chunk may be missing; verify playback before uploading. Close any other recorder tab first.");
    } catch(failure){setError(failure instanceof Error?failure.message:"Recovery failed.");}
  }
  async function discard(draft:RecordingDraft) {
    if(!window.confirm("Permanently delete this local recording draft?"))return;
    try {await deleteDraft(draft.id);setDrafts(previous=>previous.filter(item=>item.id!==draft.id));
      if(currentDraft.current?.id===draft.id){currentDraft.current=null;setAudio(null);setState("idle");}
    }catch{setError("Draft could not be deleted. Local data retained.");}
  }
  async function upload() {
    const draft=currentDraft.current;
    if(!audio || !draft || state==="uploading")return;
    setState("uploading");setError("");
    try {
      const ready={...draft,title:title.trim()||"Voice note",projectId:project||null,status:"ready" as const};
      // Metadata failure must not prevent rescuing the in-memory audio after quota exhaustion.
      try {await saveDraft(ready);}catch{ /* Upload can still rescue the audio. */ }
      await uploadRecording(getSupabase(),ready,audio);
      await deleteDraft(draft.id,audio);
      if(mounted.current){setDrafts(previous=>previous.filter(item=>item.id!==draft.id));currentDraft.current=null;setAudio(null);setState("idle");setTitle("Voice note");setProject("");setProgress("Recording uploaded and capture verified. Local draft removed.");}
    }catch(failure){if(mounted.current){setError(failure instanceof Error?failure.message:"Upload failed; local draft retained.");setState("saved");}}
  }
  function close() {
    if(state!=="idle"&&!window.confirm("Close recorder? Completed local chunks are retained for recovery; the final chunk may not be saved yet."))return;
    onClose();
  }
  return <div className="capture-backdrop" role="presentation"><section className="capture-dialog" role="dialog" aria-modal="true" aria-label="Voice capture">
    <header><strong>Voice capture</strong><button type="button" onClick={close} aria-label="Close"><X size={20}/></button></header>
    <div className="capture-symbol"><Mic size={35}/></div><h2>{state==="starting"?"Opening microphone…":state==="recording"?"Listening…":state==="paused"?"Paused":state==="uploading"?"Saving…":state==="saved"?"Ready to save":"Capture a thought"}</h2>
    <p>Record first. Review and organize afterward.</p>
    <div className="capture-controls">{state==="idle"&&<button disabled={!owner||!workspace} onClick={()=>void start()}><Mic size={18}/> Start recording</button>}
    {(state==="recording"||state==="paused")&&<><button onClick={()=>{if(recorder.current?.state==="recording"){recorder.current.pause();setState("paused");}else if(recorder.current?.state==="paused"){recorder.current.resume();setState("recording");}}}>{state==="paused"?<Play size={17}/>:<Pause size={17}/>} {state==="paused"?"Resume":"Pause"}</button><button onClick={()=>recorder.current?.stop()}><Square size={17}/> Finish</button></>}</div>
    {state==="idle"&&drafts.length>0&&<section aria-label="Recover recordings"><h3>Local recording drafts</h3>{drafts.map(draft=><div key={draft.id}><span>{draft.title} · {new Date(draft.createdAt).toLocaleString()}</span><button onClick={()=>void recover(draft)}>Recover draft</button><button onClick={()=>void discard(draft)}>Delete draft</button></div>)}</section>}
    {audio&&<><audio controls src={audioUrl}/><a href={audioUrl} download={`aura-recording.${audio.type.includes("mp4")?"mp4":"webm"}`}>Download a local copy</a><label>Title<input disabled={state==="uploading"} value={title} onChange={event=>setTitle(event.target.value)} maxLength={140}/></label><label>Project (optional)<select disabled={state==="uploading"} value={project} onChange={event=>setProject(event.target.value)}><option value="">Personal</option>{projects.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label><button className="capture-save" disabled={state==="uploading"} onClick={()=>void upload()}><Upload size={17}/> {state==="uploading"?"Uploading…":"Save recording"}</button>{currentDraft.current&&<button disabled={state==="uploading"} onClick={()=>void discard(currentDraft.current!)}>Delete local draft</button>}</>}
    <small>Drafts are stored unencrypted in this browser profile, scoped in AURA to your account. Browser eviction, private browsing, device failure, or unsaved chunks can cause loss. Upload requires internet and sends audio to your private Supabase storage.</small>
    {progress&&<p role="status">{progress}</p>}{error&&<p role="alert" className="workspace-error">{error}</p>}
  </section></div>;
}
