// @vitest-environment node
import "fake-indexeddb/auto";
import {expect,it} from "vitest";
import {appendDraftChunk,deleteDraft,listDrafts,openRecordingDatabase,readDraftAudio,saveDraft,type RecordingDraft} from "../src/lib/recording-drafts";
const draft:RecordingDraft={id:"synthetic-draft",ownerId:"a",workspaceId:"workspace",mimeType:"audio/webm",title:"Voice note",projectId:null,createdAt:1,status:"recording"};
it("recovers committed chunks in sequence after a database close/reopen",async()=>{
 await saveDraft(draft);await appendDraftChunk(draft.id,1,new Blob(["second"]));await appendDraftChunk(draft.id,0,new Blob(["first"]));
 const db=await openRecordingDatabase();db.close();
 const recovered=await listDrafts("a","workspace");expect(recovered).toHaveLength(1);expect(await (await readDraftAudio(recovered[0])).text()).toBe("firstsecond");
 expect(await listDrafts("b","workspace")).toEqual([]);expect(await listDrafts("a","other-workspace")).toEqual([]);
 await deleteDraft(draft.id);expect(await listDrafts("a","workspace")).toEqual([]);expect((await readDraftAudio(draft)).size).toBe(0);
});
it("rejects duplicate chunks instead of silently replacing source bytes",async()=>{
 const next={...draft,id:"duplicate"};await saveDraft(next);await appendDraftChunk(next.id,0,new Blob(["original"]));
 await expect(appendDraftChunk(next.id,0,new Blob(["replacement"]))).rejects.toThrow();expect(await (await readDraftAudio(next)).text()).toBe("original");await deleteDraft(next.id);
});
it("does not resurrect deleted drafts through a late chunk",async()=>{
 await saveDraft(draft);await deleteDraft(draft.id);await expect(appendDraftChunk(draft.id,0,new Blob(["late"]))).rejects.toThrow();expect(await listDrafts("a","workspace")).toEqual([]);
});
it("rejects a recording with a missing chunk instead of presenting corrupt audio as recovered",async()=>{
 const next={...draft,id:"gap"};await saveDraft(next);await appendDraftChunk(next.id,1,new Blob(["missing header"]));
 await expect(readDraftAudio(next)).rejects.toThrow();expect(await listDrafts("a","workspace")).toHaveLength(1);await deleteDraft(next.id);
});
it("does not delete chunks appended by another tab during upload",async()=>{
 const next={...draft,id:"concurrent-draft"};await saveDraft(next);await appendDraftChunk(next.id,0,new Blob(["first"]));
 const uploadSnapshot=await readDraftAudio(next);await appendDraftChunk(next.id,1,new Blob(["second"]));
 await expect(deleteDraft(next.id,uploadSnapshot)).rejects.toThrow();expect(await (await readDraftAudio(next)).text()).toBe("firstsecond");
 await deleteDraft(next.id,await readDraftAudio(next));expect(await listDrafts("a","workspace")).toEqual([]);
});
