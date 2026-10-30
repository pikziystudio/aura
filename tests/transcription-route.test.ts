// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../src/app/api/transcribe/route";
const mocks=vi.hoisted(()=>({getUser:vi.fn(),from:vi.fn(),storage:vi.fn()}));
vi.mock("@supabase/supabase-js",()=>({createClient:()=>({auth:{getUser:mocks.getUser},from:mocks.from,storage:{from:mocks.storage}})}));
const request=(body:unknown={},authorization="")=>new NextRequest("http://localhost/api/transcribe",{method:"POST",body:JSON.stringify(body),headers:{"Content-Type":"application/json",authorization}});
beforeEach(()=>{vi.resetAllMocks();vi.stubEnv("OPENAI_API_KEY","");vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL","https://rwivnjxlmjctjdbxlfxf.supabase.co");vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY","sb_publishable_synthetic");});
afterEach(()=>vi.unstubAllEnvs());
it("does not require a paid API key and reports the legacy route disabled",async()=>expect((await POST(request())).status).toBe(503));
it("requires authentication before accessing user data",async()=>{
 vi.stubEnv("OPENAI_API_KEY","synthetic");expect((await POST(request())).status).toBe(401);expect(mocks.from).not.toHaveBeenCalled();
});
it("rejects accidental access to a different Supabase project",async()=>{
 vi.stubEnv("OPENAI_API_KEY","synthetic");vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL","https://other.supabase.co");
 expect((await POST(request({},"Bearer synthetic"))).status).toBe(503);expect(mocks.getUser).not.toHaveBeenCalled();
});
it("rejects malformed capture IDs without querying Supabase",async()=>{
 vi.stubEnv("OPENAI_API_KEY","synthetic");expect((await POST(request({captureId:"malformed"},"Bearer synthetic"))).status).toBe(400);expect(mocks.from).not.toHaveBeenCalled();
});
it("rejects an expired/invalid bearer session",async()=>{
 vi.stubEnv("OPENAI_API_KEY","synthetic");mocks.getUser.mockResolvedValue({data:{user:null},error:{message:"expired"}});
 expect((await POST(request({captureId:"00000000-0000-4000-8000-000000000001"},"Bearer synthetic"))).status).toBe(401);expect(mocks.storage).not.toHaveBeenCalled();
});
it("rejects a non-owner audio path before downloading or contacting a provider",async()=>{
 vi.stubEnv("OPENAI_API_KEY","synthetic");mocks.getUser.mockResolvedValue({data:{user:{id:"owner"}},error:null});
 const chain={select:vi.fn(),eq:vi.fn(),single:vi.fn().mockResolvedValue({data:{file_storage_path:"other/audio.webm",raw_transcript:null},error:null})};chain.select.mockReturnValue(chain);chain.eq.mockReturnValue(chain);mocks.from.mockReturnValue(chain);
 expect((await POST(request({captureId:"00000000-0000-4000-8000-000000000001"},"Bearer synthetic"))).status).toBe(403);expect(mocks.storage).not.toHaveBeenCalled();
 expect(chain.eq).toHaveBeenCalledWith("owner_id","owner");
});
