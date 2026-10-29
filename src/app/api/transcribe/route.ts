import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 60;
const MAX_BYTES = 24 * 1024 * 1024;
function failure(message: string, status: number) {return NextResponse.json({ error: message },{status,headers:{"Cache-Control":"no-store"}});}

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return failure("Transcription is not configured. Add the server-only OPENAI_API_KEY in Vercel.",503);
  const authHeader = request.headers.get("authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return failure("Sign in to transcribe recordings.",401);
  const projectUrl=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(!projectUrl||!publishableKey)return failure("Server configuration is missing.",503);
  let captureId: string;
  try{
    const body=await request.json();
    if(typeof body.captureId!=="string" || !/^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(body.captureId))return failure("Invalid capture ID.",400);
    captureId=body.captureId;
  }catch{return failure("Invalid request.",400);}
  const userClient=createClient(projectUrl,publishableKey,{global:{headers:{Authorization:authHeader}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error:userError}=await userClient.auth.getUser(authHeader.slice(7));
  if(userError||!user)return failure("Invalid or expired session.",401);
  const {data:capture,error:readError}=await userClient.from("captures")
    .select("id,owner_id,file_storage_path,processing_status,raw_transcript").eq("id",captureId).eq("owner_id",user.id).single();
  if(readError||!capture)return failure("Recording not found.",404);
  if(!capture.file_storage_path)return failure("This entry does not have an audio recording.",400);
  if(capture.raw_transcript?.trim())return NextResponse.json({transcript:capture.raw_transcript,alreadyProcessed:true});
  if(!capture.file_storage_path.startsWith(user.id+"/"))return failure("Invalid recording ownership.",403);
  const {data:file,error:downloadError}=await userClient.storage.from("aura-recordings").download(capture.file_storage_path);
  if(downloadError||!file)return failure("Could not download recording.",502);
  if(file.size>MAX_BYTES)return failure("Recording exceeds the 24MB transcription limit.",413);
  const type=file.type||"audio/webm";
  if(!["audio/webm","audio/mp4","audio/mpeg","audio/ogg","audio/wav","audio/x-wav"].some(t=>type.startsWith(t)))return failure("Unsupported audio format.",415);
  const suffix=capture.file_storage_path.split(".").pop()?.toLowerCase();
  const ext=["webm","mp4","mp3","ogg","wav"].includes(suffix||"")?suffix:"webm";
  const form=new FormData();
  form.append("model",process.env.OPENAI_TRANSCRIPTION_MODEL||"gpt-4o-mini-transcribe");
  form.append("file",new File([file],`recording.${ext}`,{type}));
  let response:Response;
  try{response=await fetch("https://api.openai.com/v1/audio/transcriptions",{
    method:"POST",headers:{Authorization:`Bearer ${apiKey}`},body:form,signal:AbortSignal.timeout(50000)
  });}catch{return failure("Transcription service could not be reached. Please retry.",502);}
  if(!response.ok){
    let providerCode = "";
    try {
      const body = await response.json() as {error?:{code?:string;type?:string}};
      providerCode = String(body.error?.code || body.error?.type || "").toLowerCase();
    } catch { /* Never pass raw provider responses to clients. */ }
    console.error("AURA transcription provider failure", {httpStatus:response.status,code:providerCode.slice(0,100)});
    if(response.status===401) return failure("Transcription provider rejected the API key. Verify OPENAI_API_KEY in Vercel.",502);
    if(response.status===403) return failure("Transcription provider denied access. Check API key permissions and project access.",502);
    if(response.status===429){
      if(providerCode.includes("quota")||providerCode.includes("billing"))return failure("Transcription provider has insufficient quota or billing credits. Check API billing and limits.",503);
      return failure("Transcription rate limit reached. Try again later.",429);
    }
    if(response.status===400){
      if(providerCode.includes("model"))return failure("The configured transcription model is not available to this API project.",502);
      return failure("The transcription provider rejected this recording or model. Check the audio format and model setting.",422);
    }
    if(response.status===413)return failure("The provider rejected the recording size.",413);
    return failure("Transcription provider temporarily failed (HTTP "+response.status+").",502);
  }
  const result=await response.json() as {text?:unknown};
  if(typeof result.text!=="string" || !result.text.trim())return failure("No speech was recognized.",422);
  const transcript=result.text.trim().slice(0,200000);
  const {error:saveError}=await userClient.from("captures").update({raw_transcript:transcript,processing_status:"complete"})
    .eq("id",captureId).eq("owner_id",user.id).is("raw_transcript",null);
  if(saveError)return failure("Transcript generated but could not be saved. Please retry.",500);
  return NextResponse.json({transcript},{headers:{"Cache-Control":"no-store"}});
}
