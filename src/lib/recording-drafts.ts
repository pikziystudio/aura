export type RecordingDraft = {
  id: string; ownerId: string; workspaceId: string; mimeType: string;
  title: string; projectId: string | null; createdAt: number; status: "recording" | "ready";
};
const DATABASE = "aura-recording-drafts-v1";
export function openRecordingDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("drafts", { keyPath: "id" });
      request.result.createObjectStore("chunks", { keyPath: ["draftId", "sequence"] });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(Error("Close other AURA tabs to open recording storage."));
  });
}
async function transact<T>(stores: string[], mode: IDBTransactionMode, work: (tx: IDBTransaction, result: (value: T) => void) => void): Promise<T> {
  const db = await openRecordingDatabase();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(stores, mode, { durability: "strict" });
    let result: T;
    tx.oncomplete = () => { db.close(); resolve(result); };
    tx.onabort = tx.onerror = () => { db.close(); reject(tx.error || Error("Local recording storage failed.")); };
    try { work(tx, value => { result = value; }); } catch (error) { tx.abort(); reject(error); }
  });
}
export async function saveDraft(draft: RecordingDraft) {
  await transact<void>(["drafts"], "readwrite", tx => { tx.objectStore("drafts").put(draft); });
}
export async function appendDraftChunk(draftId: string, sequence: number, blob: Blob) {
  // ArrayBuffers are portable across IndexedDB implementations and retain binary provenance.
  const bytes = await blob.arrayBuffer();
  await transact<void>(["drafts", "chunks"], "readwrite", tx => {
    const request = tx.objectStore("drafts").get(draftId);
    request.onsuccess = () => {
      if (!request.result) { tx.abort(); return; }
      tx.objectStore("chunks").add({ draftId, sequence, bytes });
    };
  });
}
export async function listDrafts(ownerId: string, workspaceId: string): Promise<RecordingDraft[]> {
  return transact<RecordingDraft[]>(["drafts"], "readonly", (tx, result) => {
    const request = tx.objectStore("drafts").getAll();
    request.onsuccess = () => result((request.result as RecordingDraft[])
      .filter(d => d.ownerId === ownerId && d.workspaceId === workspaceId).sort((a,b) => b.createdAt-a.createdAt));
  });
}
export async function readDraftAudio(draft: RecordingDraft): Promise<Blob> {
  return transact<Blob>(["chunks"], "readonly", (tx, result) => {
    const request = tx.objectStore("chunks").getAll(IDBKeyRange.bound([draft.id,0],[draft.id,Number.MAX_SAFE_INTEGER]));
    request.onsuccess = () => {
      if(request.result.some((chunk,index)=>chunk.sequence!==index)){tx.abort();return;}
      result(new Blob(request.result.map(chunk => chunk.bytes), { type: draft.mimeType }));
    };
  });
}
export async function deleteDraft(id: string, expectedAudio?: Blob) {
  const expected=expectedAudio?new Uint8Array(await expectedAudio.arrayBuffer()):null;
  await transact<void>(["drafts", "chunks"], "readwrite", tx => {
    const remove=()=>{
      tx.objectStore("drafts").delete(id);
      tx.objectStore("chunks").delete(IDBKeyRange.bound([id,0],[id,Number.MAX_SAFE_INTEGER]));
    };
    if(!expected){remove();return;}
    const request=tx.objectStore("chunks").getAll(IDBKeyRange.bound([id,0],[id,Number.MAX_SAFE_INTEGER]));
    request.onsuccess=()=>{
      let offset=0;
      for(const chunk of request.result){
        const bytes=new Uint8Array(chunk.bytes);
        if(bytes.some((byte,index)=>byte!==expected[offset+index])){tx.abort();return;}
        offset+=bytes.length;
      }
      // A second tab may have appended audio while upload was in flight. Never delete it.
      if(offset!==expected.length){tx.abort();return;}
      remove();
    };
  });
}
