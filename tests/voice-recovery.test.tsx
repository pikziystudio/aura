import {act,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {beforeEach,expect,it,vi} from "vitest";
import VoiceCapture from "../src/components/voice-capture";
const mocks=vi.hoisted(()=>({list:vi.fn(),save:vi.fn(),append:vi.fn(),read:vi.fn(),remove:vi.fn(),upload:vi.fn()}));
vi.mock("@/lib/recording-drafts",()=>({listDrafts:mocks.list,saveDraft:mocks.save,appendDraftChunk:mocks.append,readDraftAudio:mocks.read,deleteDraft:mocks.remove}));
vi.mock("@/lib/upload-recording",()=>({uploadRecording:mocks.upload}));
vi.mock("@/lib/supabase",()=>({getSupabase:()=>({auth:{getUser:()=>Promise.resolve({data:{user:{id:"owner"}}})},from:()=>{
 const query={select:()=>query,eq:()=>query,limit:()=>query,single:()=>Promise.resolve({data:{id:"workspace"}}),then:(fn:(r:{data:never[]})=>unknown)=>Promise.resolve({data:[]}).then(fn)};return query;
}})}));
const draft={id:"draft",ownerId:"owner",workspaceId:"workspace",mimeType:"audio/webm",title:"Recovered",projectId:null,createdAt:1,status:"recording"};
beforeEach(()=>{
 vi.resetAllMocks();mocks.list.mockResolvedValue([draft]);mocks.save.mockResolvedValue(undefined);mocks.append.mockResolvedValue(undefined);mocks.remove.mockResolvedValue(undefined);mocks.read.mockResolvedValue(new Blob(["saved chunks"],{type:"audio/webm"}));
 Object.defineProperty(URL,"createObjectURL",{configurable:true,value:vi.fn().mockReturnValue("blob:preview")});Object.defineProperty(URL,"revokeObjectURL",{configurable:true,value:vi.fn()});
});
it("offers recovered chunks with a partial-audio warning and retains them after failed upload",async()=>{
 mocks.upload.mockRejectedValue(Error("Offline. Local draft retained."));render(<VoiceCapture onClose={()=>{}}/>);
 fireEvent.click(await screen.findByRole("button",{name:"Recover draft"}));
 expect(await screen.findByRole("status")).toHaveTextContent("last uncommitted chunk may be missing");
 fireEvent.click(screen.getByRole("button",{name:"Save recording"}));
 expect(await screen.findByRole("alert")).toHaveTextContent("Local draft retained");expect(mocks.remove).not.toHaveBeenCalled();
});
it("deletes local chunks only after confirmed remote save",async()=>{
 let resolve!:()=>void;mocks.upload.mockReturnValue(new Promise<void>(r=>{resolve=r;}));render(<VoiceCapture onClose={()=>{}}/>);
 fireEvent.click(await screen.findByRole("button",{name:"Recover draft"}));await screen.findByRole("button",{name:"Save recording"});fireEvent.click(screen.getByRole("button",{name:"Save recording"}));
 await waitFor(()=>expect(mocks.upload).toHaveBeenCalledOnce());expect(mocks.remove).not.toHaveBeenCalled();
 await act(async()=>resolve());await waitFor(()=>expect(mocks.remove).toHaveBeenCalledWith("draft",expect.any(Blob)));expect(screen.getByRole("status")).toHaveTextContent("capture verified");
});
it("never starts the microphone if local draft creation fails",async()=>{
 const stop=vi.fn(),start=vi.fn();mocks.save.mockRejectedValue(Error("Quota exceeded"));
 class Recorder{static isTypeSupported(){return true;}mimeType="audio/webm";start=start;}
 vi.stubGlobal("MediaRecorder",Recorder);Object.defineProperty(navigator,"mediaDevices",{configurable:true,value:{getUserMedia:vi.fn().mockResolvedValue({getTracks:()=>[{stop}]})}});
 render(<VoiceCapture onClose={()=>{}}/>);await waitFor(()=>expect(screen.getByRole("button",{name:"Start recording"})).toBeEnabled());fireEvent.click(screen.getByRole("button",{name:"Start recording"}));
 expect(await screen.findByRole("alert")).toHaveTextContent("Quota exceeded");expect(start).not.toHaveBeenCalled();expect(stop).toHaveBeenCalled();vi.unstubAllGlobals();
});
it("waits for pending chunk writes before finalizing the draft",async()=>{
 const instances:Recorder[]=[];let commit!:()=>void;
 class Recorder{static isTypeSupported(){return true;}state="inactive";mimeType="audio/webm";ondataavailable:((e:{data:Blob})=>void)|null=null;onstop:(()=>void)|null=null;onerror:(()=>void)|null=null;constructor(){instances.push(this);}start(){this.state="recording";}stop(){this.state="inactive";this.onstop?.();}}
 vi.stubGlobal("MediaRecorder",Recorder);Object.defineProperty(navigator,"mediaDevices",{configurable:true,value:{getUserMedia:vi.fn().mockResolvedValue({getTracks:()=>[{stop:vi.fn()}]})}});
 mocks.append.mockReturnValue(new Promise<void>(r=>{commit=r;}));render(<VoiceCapture onClose={()=>{}}/>);await waitFor(()=>expect(screen.getByRole("button",{name:"Start recording"})).toBeEnabled());fireEvent.click(screen.getByRole("button",{name:"Start recording"}));await screen.findByText("Listening…");
 act(()=>instances[0].ondataavailable?.({data:new Blob(["chunk"])}));fireEvent.click(screen.getByRole("button",{name:"Finish"}));
 await waitFor(()=>expect(mocks.append).toHaveBeenCalledOnce());expect(screen.queryByRole("button",{name:"Save recording"})).not.toBeInTheDocument();
 await act(async()=>commit());expect(await screen.findByRole("button",{name:"Save recording"})).toBeEnabled();expect(mocks.save).toHaveBeenLastCalledWith(expect.objectContaining({status:"ready"}));vi.unstubAllGlobals();
});
it("stops on a failed chunk write and keeps the in-memory recording available to rescue",async()=>{
 const instances:Recorder[]=[];
 class Recorder{static isTypeSupported(){return true;}state="inactive";mimeType="audio/webm";ondataavailable:((e:{data:Blob})=>void)|null=null;onstop:(()=>void)|null=null;onerror:(()=>void)|null=null;constructor(){instances.push(this);}start(){this.state="recording";}stop(){this.state="inactive";this.onstop?.();}}
 vi.stubGlobal("MediaRecorder",Recorder);Object.defineProperty(navigator,"mediaDevices",{configurable:true,value:{getUserMedia:vi.fn().mockResolvedValue({getTracks:()=>[{stop:vi.fn()}]})}});
 mocks.append.mockRejectedValue(Error("quota"));render(<VoiceCapture onClose={()=>{}}/>);await waitFor(()=>expect(screen.getByRole("button",{name:"Start recording"})).toBeEnabled());fireEvent.click(screen.getByRole("button",{name:"Start recording"}));await screen.findByText("Listening…");
 act(()=>instances[0].ondataavailable?.({data:new Blob(["rescue audio"])}));
 expect(await screen.findByRole("alert")).toHaveTextContent("Local storage failed");expect(await screen.findByRole("button",{name:"Save recording"})).toBeEnabled();expect(screen.getByRole("link",{name:"Download a local copy"})).toBeVisible();expect(instances[0].state).toBe("inactive");vi.unstubAllGlobals();
});
