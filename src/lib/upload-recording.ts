import type { SupabaseClient } from "@supabase/supabase-js";
import type { RecordingDraft } from "./recording-drafts";
const digest = async (blob: Blob) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()))).join(",");

/** Stable IDs make retries after ambiguous network responses safe; never overwrite audio. */
export async function uploadRecording(client: SupabaseClient, draft: RecordingDraft, audio: Blob) {
  const {data:{user},error:authError}=await client.auth.getUser();
  if(authError || user?.id!==draft.ownerId)throw Error("Sign in to the original account before uploading this draft.");
  if(!audio.size)throw Error("No saved audio chunks are available.");
  const extension=draft.mimeType.includes("mp4")?"mp4":draft.mimeType.includes("ogg")?"ogg":"webm";
  const path=`${draft.ownerId}/${draft.id}.${extension}`;
  const bucket=client.storage.from("aura-recordings");
  const {error:uploadError}=await bucket.upload(path,audio,{contentType:draft.mimeType,upsert:false});
  if(uploadError){
    // A previous attempt may have committed despite a lost response. Verify bytes, not only existence.
    const {data:existing,error}=await bucket.download(path);
    if(error||!existing||await digest(existing)!==await digest(audio))throw Error("Audio upload was not verified. Local draft retained; retry when online.");
  }
  const row={id:draft.id,owner_id:draft.ownerId,workspace_id:draft.workspaceId,project_id:draft.projectId,
    kind:"note",title:draft.title.trim()||"Voice note",file_storage_path:path,processing_status:"pending"};
  const {error:insertError}=await client.from("captures").insert(row);
  if(insertError){
    const {data:existing,error}=await client.from("captures").select("id,file_storage_path,workspace_id")
      .eq("id",draft.id).eq("owner_id",draft.ownerId).single();
    if(error||!existing||existing.file_storage_path!==path||existing.workspace_id!==draft.workspaceId)
      throw Error("Capture save was not verified. Local draft retained; retry without recording again.");
  }
}
