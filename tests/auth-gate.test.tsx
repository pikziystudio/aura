import { act, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import AuthGate from "../src/components/auth-gate";
const mocks=vi.hoisted(()=>({getSession:vi.fn(),onChange:vi.fn(),cleanup:vi.fn()}));
vi.mock("@/lib/supabase",()=>({getSupabase:()=>({auth:{getSession:mocks.getSession,onAuthStateChange:mocks.onChange}})}));
vi.mock("@/components/workspace-bootstrap",()=>({default:({children}:{children:React.ReactNode})=>children}));
let callback:(event:string,session:unknown)=>void;
beforeEach(()=>{vi.resetAllMocks();mocks.onChange.mockImplementation(fn=>{callback=fn;return {data:{subscription:{unsubscribe:vi.fn()}}};});});
function PrivateChild(){useEffect(()=>mocks.cleanup,[]);return <div>Private memory fixture</div>;}
it("unmounts private workspace state when switching accounts",async()=>{
 mocks.getSession.mockResolvedValue({data:{session:{user:{id:"a",email:"a@example.invalid"}}},error:null});
 render(<AuthGate><PrivateChild/></AuthGate>);await screen.findByText("Private memory fixture");
 act(()=>callback("SIGNED_IN",{user:{id:"b",email:"b@example.invalid"}}));
 expect(mocks.cleanup).toHaveBeenCalledOnce();expect(screen.getByText(/b@example.invalid/)).toBeVisible();
});
it("ignores an old getSession response received after sign-out",async()=>{
 let resolve!:(value:unknown)=>void;mocks.getSession.mockReturnValue(new Promise(r=>{resolve=r;}));
 render(<AuthGate><PrivateChild/></AuthGate>);
 act(()=>callback("SIGNED_OUT",null));
 await act(async()=>resolve({data:{session:{user:{id:"old"}}},error:null}));
 expect(screen.getByRole("button",{name:"Sign in"})).toBeVisible();
 expect(screen.queryByText("Private memory fixture")).not.toBeInTheDocument();
});
