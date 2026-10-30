// @vitest-environment node
import {expect,it,vi} from "vitest";
import type {SupabaseClient} from "@supabase/supabase-js";
import type {RecordingDraft} from "../src/lib/recording-drafts";
import {uploadRecording} from "../src/lib/upload-recording";
const draft:RecordingDraft={id:"stable",ownerId:"owner",workspaceId:"workspace",mimeType:"audio/webm",title:"Voice note",projectId:null,createdAt:1,status:"ready"};
function fixture(){
 const upload=vi.fn().mockResolvedValue({error:null}),download=vi.fn().mockResolvedValue({data:new Blob(["audio"]),error:null}),insert=vi.fn().mockResolvedValue({error:null});
 const query={select:vi.fn(),eq:vi.fn(),single:vi.fn().mockResolvedValue({data:{id:"stable",workspace_id:"workspace",file_storage_path:"owner/stable.webm"},error:null})};query.select.mockReturnValue(query);query.eq.mockReturnValue(query);
 const getUser=vi.fn().mockResolvedValue({data:{user:{id:"owner"}},error:null});
 const client={auth:{getUser},storage:{from:()=>({upload,download})},from:()=>({...query,insert})} as unknown as SupabaseClient;
 return {client,upload,download,insert,query,getUser};
}
it("uses stable audio path and capture ID and never overwrites audio",async()=>{
 const {client,upload,insert}=fixture();const audio=new Blob(["audio"]);await uploadRecording(client,draft,audio);
 expect(upload).toHaveBeenCalledWith("owner/stable.webm",audio,{contentType:"audio/webm",upsert:false});expect(insert).toHaveBeenCalledWith(expect.objectContaining({id:"stable",owner_id:"owner",file_storage_path:"owner/stable.webm"}));
});
it("recovers ambiguous upload/insert responses by verifying existing bytes and capture linkage",async()=>{
 const {client,upload,insert,download}=fixture();upload.mockResolvedValue({error:{message:"lost response"}});insert.mockResolvedValue({error:{message:"duplicate id"}});
 await uploadRecording(client,draft,new Blob(["audio"]));expect(download).toHaveBeenCalledWith("owner/stable.webm");
});
it("does not accept different bytes at a conflicting storage path",async()=>{
 const {client,upload,insert,download}=fixture();upload.mockResolvedValue({error:{message:"conflict"}});download.mockResolvedValue({data:new Blob(["different"]),error:null});
 await expect(uploadRecording(client,draft,new Blob(["audio"]))).rejects.toThrow("not verified");expect(insert).not.toHaveBeenCalled();
});
it("retains retry failure if capture insertion did not commit",async()=>{
 const {client,insert,query}=fixture();insert.mockResolvedValue({error:{message:"offline"}});query.single.mockResolvedValue({data:null,error:{message:"missing"}} as never);
 await expect(uploadRecording(client,draft,new Blob(["audio"]))).rejects.toThrow("Local draft retained");
});
it("refuses to upload another account's recovered draft",async()=>{
 const {client,getUser,upload}=fixture();getUser.mockResolvedValue({data:{user:{id:"other"}},error:null});await expect(uploadRecording(client,draft,new Blob(["audio"]))).rejects.toThrow("original account");expect(upload).not.toHaveBeenCalled();
});
