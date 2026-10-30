import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { useObjectUrl } from "../src/lib/use-object-url";
import VoiceCapture from "../src/components/voice-capture";
vi.mock("@/lib/supabase",()=>({getSupabase:()=>({auth:{getUser:()=>Promise.resolve({data:{user:null}})}})}));
beforeEach(()=>{vi.restoreAllMocks();Object.defineProperty(URL,"createObjectURL",{configurable:true,value:vi.fn().mockReturnValue("blob:preview")});Object.defineProperty(URL,"revokeObjectURL",{configurable:true,value:vi.fn()});});
it("creates one preview per blob, revoking it on replacement, clear and unmount",()=>{
 const blob=new Blob(["synthetic"]);
 const {result,rerender,unmount}=renderHook(({audio})=>useObjectUrl(audio),{initialProps:{audio:blob as Blob|null}});
 expect(result.current).toBe("blob:preview");rerender({audio:blob});expect(URL.createObjectURL).toHaveBeenCalledOnce();
 rerender({audio:new Blob(["replacement"])});expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
 rerender({audio:null});expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);expect(result.current).toBeUndefined();
 rerender({audio:blob});unmount();expect(URL.revokeObjectURL).toHaveBeenCalledTimes(3);
});
it("warns before closing/disposing an unsaved recording and on tab navigation",async()=>{
 const stopTrack=vi.fn();const stop=vi.fn();
 class Recorder {static isTypeSupported(){return true;}state="recording";mimeType="audio/webm";start(){}stop=stop;}
 vi.stubGlobal("MediaRecorder",Recorder);
 Object.defineProperty(navigator,"mediaDevices",{configurable:true,value:{getUserMedia:vi.fn().mockResolvedValue({getTracks:()=>[{stop:stopTrack}]})}});
 const onClose=vi.fn();const confirm=vi.spyOn(window,"confirm").mockReturnValue(false);
 const {unmount}=render(<VoiceCapture onClose={onClose}/>);
 fireEvent.click(screen.getByRole("button",{name:"Start recording"}));
 await screen.findByText("Listening…");
 const event=new Event("beforeunload",{cancelable:true});window.dispatchEvent(event);expect(event.defaultPrevented).toBe(true);
 fireEvent.click(screen.getByRole("button",{name:"Close"}));expect(onClose).not.toHaveBeenCalled();
 confirm.mockReturnValue(true);fireEvent.click(screen.getByRole("button",{name:"Close"}));expect(onClose).toHaveBeenCalledOnce();
 unmount();expect(stopTrack).toHaveBeenCalled();expect(stop).toHaveBeenCalled();
 const after=new Event("beforeunload",{cancelable:true});window.dispatchEvent(after);expect(after.defaultPrevented).toBe(false);
 vi.unstubAllGlobals();
});
it("releases microphone permission resolved after unmount",async()=>{
 let resolve!:(value:unknown)=>void;const stop=vi.fn();
 vi.stubGlobal("MediaRecorder",class {});
 Object.defineProperty(navigator,"mediaDevices",{configurable:true,value:{getUserMedia:()=>new Promise(r=>{resolve=r;})}});
 const {unmount}=render(<VoiceCapture onClose={()=>{}}/>);fireEvent.click(screen.getByRole("button",{name:"Start recording"}));unmount();
 await act(async()=>{resolve({getTracks:()=>[{stop}]});});
 await waitFor(()=>expect(stop).toHaveBeenCalledOnce());vi.unstubAllGlobals();
});
