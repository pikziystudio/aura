import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FilingReview from "../src/components/filing-review";
const mocks=vi.hoisted(()=>({save:vi.fn(),getUser:vi.fn(),from:vi.fn()}));
vi.mock("@/lib/memory-filing",async importOriginal=>({...await importOriginal<typeof import("../src/lib/memory-filing")>(),saveMemoryFiling:mocks.save}));
vi.mock("@/lib/supabase",()=>({getSupabase:()=>({auth:{getUser:mocks.getUser},from:mocks.from})}));
const capture={id:"capture",title:"Voice note",project_id:null,filing_status:"inbox",raw_transcript:"Discuss D-R Mind tomorrow.",corrected_transcript:null};
const projects=[{id:"dear",name:"DearMind"}];
beforeEach(()=>{vi.resetAllMocks();mocks.from.mockReturnValue({select:()=>Promise.resolve({data:[],error:null})});mocks.save.mockResolvedValue(undefined);});
describe("explicit filing review",()=>{
 it("shows a suggestion without selecting or writing until confirmed",async()=>{
  const complete=vi.fn();render(<FilingReview capture={capture} projects={projects} onComplete={complete}/>);
  expect(await screen.findByRole("button",{name:"Select DearMind"})).toBeVisible();
  expect(screen.getByRole("combobox")).toHaveValue("");expect(mocks.save).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button",{name:"Confirm filing"}));
  expect(screen.getByRole("alert")).toHaveTextContent("select a project");expect(mocks.save).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button",{name:"Select DearMind"}));expect(mocks.save).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button",{name:"Confirm filing"}));
  await waitFor(()=>expect(complete).toHaveBeenCalledOnce());
  expect(mocks.save).toHaveBeenCalledWith(expect.anything(),capture,expect.objectContaining({projectId:"dear",decision:"file"}));
 });
 it("requires a separate removal confirmation for an assigned memory",async()=>{
  render(<FilingReview capture={{...capture,project_id:"dear",filing_status:"filed"}} projects={projects} onComplete={()=>{}}/>);
  expect(screen.getByRole("button",{name:"Keep in Inbox"})).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox"));fireEvent.click(screen.getByRole("button",{name:"Keep in Inbox"}));
  await waitFor(()=>expect(mocks.save).toHaveBeenCalledWith(expect.anything(),expect.anything(),expect.objectContaining({decision:"inbox",confirmUnfile:true})));
 });
 it("shows ambiguity and never preselects competing projects",async()=>{
  render(<FilingReview capture={{...capture,raw_transcript:"Deer Mind"}} projects={[...projects,{id:"deer",name:"DeerMind"}]} onComplete={()=>{}}/>);
  expect(screen.getByText(/Multiple possible projects/)).toHaveTextContent("DearMind");
  expect(screen.queryByRole("button",{name:/Select DearMind/})).not.toBeInTheDocument();
  expect(screen.getByRole("combobox")).toHaveValue("");
 });
 it("keeps partial history failures visible without reporting completion",async()=>{
  mocks.save.mockRejectedValue(Error("Filing saved, but history was not recorded. Refresh before retrying."));
  const complete=vi.fn();render(<FilingReview capture={capture} projects={projects} onComplete={complete}/>);
  fireEvent.change(screen.getByRole("combobox"),{target:{value:"dear"}});
  fireEvent.click(screen.getByRole("button",{name:"Confirm filing"}));
  expect(await screen.findByRole("alert")).toHaveTextContent("history was not recorded");expect(complete).not.toHaveBeenCalled();
 });
});
it("remembers an alias only after explicit confirmation and rejects canonical conflicts",async()=>{
 const insert=vi.fn().mockResolvedValue({error:null});
 const result={data:[],error:null};
 const query={then:(fn:(r:typeof result)=>unknown)=>Promise.resolve(result).then(fn),eq:()=>Promise.resolve(result)};
 mocks.from.mockReturnValue({select:()=>query,insert});mocks.getUser.mockResolvedValue({data:{user:{id:"user"}}});
 render(<FilingReview capture={capture} projects={[...projects,{id:"other",name:"OtherProject"}]} onComplete={()=>{}}/>);
 fireEvent.change(screen.getByRole("combobox"),{target:{value:"dear"}});
 fireEvent.change(screen.getByLabelText(/Verified pronunciation/),{target:{value:"Other Project"}});
 expect(insert).not.toHaveBeenCalled();fireEvent.click(screen.getByRole("button",{name:"Remember confirmed alias"}));
 expect(await screen.findByRole("alert")).toHaveTextContent("matches a different project");expect(insert).not.toHaveBeenCalled();
 fireEvent.change(screen.getByLabelText(/Verified pronunciation/),{target:{value:"Deer Mind"}});
 fireEvent.click(screen.getByRole("button",{name:"Remember confirmed alias"}));
 await waitFor(()=>expect(insert).toHaveBeenCalledOnce());
 expect(insert).toHaveBeenCalledWith({owner_id:"user",project_id:"dear",alias:"Deer Mind"});
});
