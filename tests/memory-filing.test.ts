import {describe,expect,it,vi} from "vitest";
import type {SupabaseClient} from "@supabase/supabase-js";
import {saveMemoryFiling,suggestMemoryTitle,type FilingCommand} from "../src/lib/memory-filing";
const capture={id:"capture",title:"Voice note",project_id:null,filing_status:"inbox",filing_version:3};
const command:FilingCommand={decision:"file",projectId:"project",title:" Reviewed ",suggestedTitle:"Suggestion",suggestedProjectId:null,confirmUnfile:false,requestId:"stable-request"};
function fixture(code?:string){
 const rpc=vi.fn().mockResolvedValue({data:code?null:"decision-id",error:code?{code}:null});
 const from=vi.fn();const auth={getUser:vi.fn().mockResolvedValue({data:{user:{id:"user"}},error:null})};
 return {client:{rpc,from,auth} as unknown as SupabaseClient,rpc,from,auth};
}
describe("atomic memory filing client",()=>{
 it("makes one owner-authenticated RPC, with version and stable retry ID; never splits writes",async()=>{
  const {client,rpc,from}=fixture();await saveMemoryFiling(client,capture,command);
  expect(rpc).toHaveBeenCalledWith("file_memory",{p_capture_id:"capture",p_expected_version:3,p_request_id:"stable-request",p_decision:"file",p_project_id:"project",p_title:"Reviewed",p_suggested_title:"Suggestion",p_suggested_project_id:null,p_confirm_unfile:false});
  expect(from).not.toHaveBeenCalled();
 });
 it("does not auto-file a suggestion without explicit project selection",async()=>{
  const {client,rpc}=fixture();await expect(saveMemoryFiling(client,capture,{...command,projectId:"",suggestedProjectId:"project"})).rejects.toThrow("select a project");expect(rpc).not.toHaveBeenCalled();
 });
 it("requires explicit removal before moving an assigned record to Inbox",async()=>{
  const {client,rpc}=fixture();await expect(saveMemoryFiling(client,{...capture,project_id:"previous"},{...command,decision:"inbox"})).rejects.toThrow("Confirm removing");expect(rpc).not.toHaveBeenCalled();
 });
 it("sends null project with confirmed Inbox decision",async()=>{
  const {client,rpc}=fixture();await saveMemoryFiling(client,{...capture,project_id:"previous"},{...command,decision:"inbox",confirmUnfile:true});expect(rpc).toHaveBeenCalledWith("file_memory",expect.objectContaining({p_project_id:null,p_confirm_unfile:true}));
 });
 it("rejects missing migration/version before RPC",async()=>{
  const {client,rpc}=fixture();await expect(saveMemoryFiling(client,{...capture,filing_version:undefined},command)).rejects.toThrow("migration is required");expect(rpc).not.toHaveBeenCalled();
 });
 it("rejects expired sessions",async()=>{
  const {client,rpc,auth}=fixture();auth.getUser.mockResolvedValue({data:{user:null},error:null} as never);await expect(saveMemoryFiling(client,capture,command)).rejects.toThrow("Sign in");expect(rpc).not.toHaveBeenCalled();
 });
 it.each([["40001","changed"],["PGRST202","migration is required"],["42501","not confirmed"],["NETWORK","not confirmed"]])("reports %s without a fallback write",async(code,message)=>{
  const {client,from}=fixture(code);await expect(saveMemoryFiling(client,capture,command)).rejects.toThrow(message);expect(from).not.toHaveBeenCalled();
 });
 it("preserves retry ID after an ambiguous error",async()=>{
  const {client,rpc}=fixture("NETWORK");await expect(saveMemoryFiling(client,capture,command)).rejects.toThrow();rpc.mockResolvedValue({data:"decision-id",error:null});await saveMemoryFiling(client,capture,command);expect(rpc.mock.calls[0]).toEqual(rpc.mock.calls[1]);
 });
});
describe("source-derived titles",()=>{
 it("retains a short sentence",()=>expect(suggestMemoryTitle("Discuss tomorrow. Context")).toBe("Discuss tomorrow"));
 it("truncates long text",()=>expect(suggestMemoryTitle("word ".repeat(30)).length).toBeLessThanOrEqual(82));
 it("uses a neutral fallback",()=>expect(suggestMemoryTitle(" ")).toBe("Untitled recording"));
});
