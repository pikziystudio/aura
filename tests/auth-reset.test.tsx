import { act, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import PasswordReset from "../src/app/auth/reset/page";
const mocks=vi.hoisted(()=>({get:vi.fn(),getSession:vi.fn(),onChange:vi.fn(),unsubscribe:vi.fn()}));
vi.mock("@/lib/supabase",()=>({getSupabase:mocks.get}));
beforeEach(()=>{vi.resetAllMocks();mocks.get.mockReturnValue({auth:{getSession:mocks.getSession,onAuthStateChange:mocks.onChange}});mocks.getSession.mockResolvedValue({data:{session:null},error:null});mocks.onChange.mockReturnValue({data:{subscription:{unsubscribe:mocks.unsubscribe}}});});
it("shows missing auth configuration instead of throwing from its effect",async()=>{
 mocks.get.mockImplementation(()=>{throw Error("missing config");});render(<PasswordReset/>);
 expect(await screen.findByRole("status")).toHaveTextContent("Authentication is not configured");
});
it("handles recovery-session network failures",async()=>{
 mocks.getSession.mockRejectedValue(Error("offline"));render(<PasswordReset/>);
 expect(await screen.findByRole("status")).toHaveTextContent("Could not verify recovery session");
});
it("removes password update form after sign-out",async()=>{
 let callback!:(event:string,session:unknown)=>void;
 mocks.onChange.mockImplementation((fn)=>{callback=fn;return {data:{subscription:{unsubscribe:mocks.unsubscribe}}};});
 const {unmount}=render(<PasswordReset/>);await act(async()=>{});
 act(()=>callback("PASSWORD_RECOVERY",{user:{id:"synthetic"}}));expect(screen.getByLabelText("New password")).toBeVisible();
 act(()=>callback("SIGNED_OUT",null));expect(screen.queryByLabelText("New password")).not.toBeInTheDocument();
 unmount();expect(mocks.unsubscribe).toHaveBeenCalledOnce();
});
it("ignores a stale session response after a sign-out event",async()=>{
 let resolve!:(value:unknown)=>void;let callback!:(event:string,session:unknown)=>void;
 mocks.getSession.mockReturnValue(new Promise(r=>{resolve=r;}));
 mocks.onChange.mockImplementation(fn=>{callback=fn;return {data:{subscription:{unsubscribe:mocks.unsubscribe}}};});
 render(<PasswordReset/>);act(()=>callback("SIGNED_OUT",null));
 await act(async()=>resolve({data:{session:{user:{id:"stale"}}},error:null}));
 expect(screen.queryByLabelText("New password")).not.toBeInTheDocument();
});
