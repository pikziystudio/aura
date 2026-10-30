import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { saveMemoryFiling, suggestMemoryTitle, type FilingCommand } from "../src/lib/memory-filing";
const capture = { id:"capture",title:"Voice note",project_id:null,filing_status:"inbox" };
const command: FilingCommand = {decision:"file",projectId:"project",title:"Reviewed title",suggestedTitle:"Suggestion",suggestedProjectId:null,confirmUnfile:false};
function fixture(options: { owner?: string; authenticated?: boolean; project?: boolean; saved?: boolean; historyError?: boolean; stale?: boolean; updateError?: boolean } = {}) {
  const results = [
    {data:{...capture,owner_id:options.owner||"user",workspace_id:"workspace",...(options.stale?{title:"Changed"}:{})},error:null},
    {data:options.project===false?null:{id:"project"},error:null},
    {data:options.saved===false?null:{id:"capture"},error:options.updateError?{message:"denied"}:null},
  ];
  const chain = {select:vi.fn(),eq:vi.fn(),is:vi.fn(),single:vi.fn(),update:vi.fn(),insert:vi.fn()};
  for(const method of ["select","eq","is","update"] as const)chain[method].mockReturnValue(chain);
  chain.single.mockImplementation(async()=>results.shift());
  chain.insert.mockResolvedValue({error:options.historyError?{message:"denied"}:null});
  const client = {auth:{getUser:vi.fn().mockResolvedValue({data:{user:options.authenticated===false?null:{id:"user"}},error:null})},from:vi.fn().mockReturnValue(chain)};
  return {client:client as unknown as SupabaseClient,chain,from:client.from};
}
describe("memory filing persistence",()=>{
  it("files only a selected project and records the same confirmed title/UUID",async()=>{
    const {client,chain}=fixture();
    await saveMemoryFiling(client,capture,command);
    expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({title:"Reviewed title",project_id:"project",filing_status:"filed"}));
    expect(chain.insert).toHaveBeenCalledWith({owner_id:"user",capture_id:"capture",project_id:"project",title:"Reviewed title",decision:"file"});
    expect(chain.eq).toHaveBeenCalledWith("owner_id","user");
    expect(chain.eq).toHaveBeenCalledWith("workspace_id","workspace");
    expect(chain.is).toHaveBeenCalledWith("project_id",null);
    expect(Object.keys(chain.update.mock.calls[0][0])).not.toContain("raw_transcript");
    expect(Object.keys(chain.update.mock.calls[0][0])).not.toContain("corrected_transcript");
  });
  it("does not auto-file a suggested project",async()=>{
    const {client,chain}=fixture();
    await expect(saveMemoryFiling(client,capture,{...command,projectId:"",suggestedProjectId:"project"})).rejects.toThrow("select a project");
    expect(chain.update).not.toHaveBeenCalled();
  });
  it("requires explicit removal of a previously assigned project",async()=>{
    const {client,chain}=fixture();
    await expect(saveMemoryFiling(client,{...capture,project_id:"previous"},{...command,decision:"inbox"})).rejects.toThrow("Confirm removing");
    expect(chain.update).not.toHaveBeenCalled();
  });
  it("supports explicitly confirmed removal to Inbox",async()=>{
    const {client,chain}=fixture();
    chain.single.mockReset().mockResolvedValueOnce({data:{...capture,project_id:"previous",owner_id:"user",workspace_id:"workspace"},error:null}).mockResolvedValueOnce({data:{id:"capture"},error:null});
    await saveMemoryFiling(client,{...capture,project_id:"previous"},{...command,decision:"inbox",confirmUnfile:true});
    expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({project_id:null,filing_status:"inbox"}));
    expect(chain.insert).toHaveBeenCalledWith(expect.objectContaining({project_id:null,decision:"inbox"}));
  });
  it.each([
    ["expired session",{authenticated:false},"Sign in"],
    ["another owner's capture",{owner:"other"},"unavailable"],
    ["foreign/missing project",{project:false},"project is unavailable"],
    ["stale editor",{stale:true},"changed"],
    ["zero-row update",{saved:false},"could not be updated"],
    ["denied update",{updateError:true},"could not be updated"],
    ["history failure",{historyError:true},"Filing saved, but history was not recorded"],
  ] as const)("reports %s instead of success",async(_label,options,message)=>{
    const {client,chain}=fixture(options);
    await expect(saveMemoryFiling(client,capture,command)).rejects.toThrow(message);
    if(!("historyError" in options))expect(chain.insert).not.toHaveBeenCalled();
  });
});

describe("source-derived title suggestions",()=>{
 it("keeps the full first sentence when it fits",()=>expect(suggestMemoryTitle("Discuss tomorrow. More context.")).toBe("Discuss tomorrow"));
 it("truncates long sentences only at the length limit",()=>expect(suggestMemoryTitle("word ".repeat(30)).length).toBeLessThanOrEqual(82));
 it("supplies a neutral fallback without inventing a project",()=>expect(suggestMemoryTitle(" ")).toBe("Untitled recording"));
});
