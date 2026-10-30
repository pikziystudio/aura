import { expect, it } from "vitest";
import { AURA_SUPABASE_URL, validateSupabaseConfig } from "../src/lib/supabase-config";
const jwt=(role:string)=>`synthetic.${btoa(JSON.stringify({role}))}.signature`;
it("accepts publishable and legacy anon key configuration",()=>{
 expect(validateSupabaseConfig(AURA_SUPABASE_URL,"sb_publishable_synthetic").url).toBe(AURA_SUPABASE_URL);
 expect(validateSupabaseConfig(AURA_SUPABASE_URL,jwt("anon")).key).toBe(jwt("anon"));
});
it.each([undefined,"http://rwivnjxlmjctjdbxlfxf.supabase.co","https://another-project.supabase.co",AURA_SUPABASE_URL+"/anything"])("rejects missing or different project URL %s",url=>{
 expect(()=>validateSupabaseConfig(url,"sb_publishable_synthetic")).toThrow();
});
it.each([undefined,"sb_secret_synthetic",jwt("service_role"),jwt("authenticated"),"not-a-key"])("rejects missing, privileged or invalid credential configuration",key=>{
 expect(()=>validateSupabaseConfig(AURA_SUPABASE_URL,key)).toThrow();
});
