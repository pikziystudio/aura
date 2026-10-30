import type { SupabaseClient } from "@supabase/supabase-js";

export type FilingCapture = {
  id: string; title: string | null; project_id: string | null; filing_status?: string;
};
export type FilingCommand = {
  decision: "file" | "inbox"; projectId: string; title: string;
  suggestedTitle: string; suggestedProjectId: string | null;
  confirmUnfile: boolean;
};

export async function saveMemoryFiling(client: SupabaseClient, capture: FilingCapture, command: FilingCommand) {
  if (!command.title.trim()) throw Error("Please enter a title.");
  if (command.decision === "file" && !command.projectId) throw Error("Please select a project, or keep this recording in Inbox.");
  if (command.decision === "inbox" && capture.project_id && !command.confirmUnfile) {
    throw Error("Confirm removing the existing project before moving to Inbox.");
  }
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) throw Error("Sign in again.");
  const { data: before, error: readError } = await client.from("captures")
    .select("id,owner_id,workspace_id,title,project_id,filing_status").eq("id", capture.id).eq("owner_id", user.id).single();
  if (readError || !before || before.owner_id !== user.id) throw Error("Recording is unavailable.");
  if (before.title !== capture.title || before.project_id !== capture.project_id || before.filing_status !== capture.filing_status) {
    throw Error("This recording changed. Refresh before filing.");
  }
  const projectId = command.decision === "file" ? command.projectId : null;
  // Do not trust a UUID submitted by the UI. RLS/composite FKs remain the security boundary.
  for (const id of new Set([projectId, command.suggestedProjectId].filter((id): id is string => Boolean(id)))) {
    const { data: project, error } = await client.from("projects").select("id")
      .eq("id", id).eq("owner_id", user.id).eq("workspace_id", before.workspace_id).single();
    if (error || !project) throw Error("Selected project is unavailable in this workspace.");
  }
  let update = client.from("captures").update({
    title: command.title.trim(), project_id: projectId,
    filing_status: command.decision === "file" ? "filed" : "inbox",
    suggested_title: command.suggestedTitle, suggested_project_id: command.suggestedProjectId,
  }).eq("id", capture.id).eq("owner_id", user.id).eq("filing_status", before.filing_status);
  update = before.project_id === null ? update.is("project_id", null) : update.eq("project_id", before.project_id);
  update = before.title === null ? update.is("title", null) : update.eq("title", before.title);
  const { data: saved, error: updateError } = await update.select("id").single();
  if (updateError || !saved) throw Error("Recording could not be updated or changed concurrently. Refresh before retrying.");
  const { error: historyError } = await client.from("filing_decisions").insert({
    owner_id: user.id, capture_id: capture.id, project_id: projectId, title: command.title.trim(), decision: command.decision,
  });
  // Never retry/roll back blindly: another editor may have changed the record already.
  // An owner-scoped transactional RPC requires a separately reviewed migration.
  if (historyError) throw Error("Filing saved, but history was not recorded. Refresh before retrying.");
}

export function suggestMemoryTitle(transcript: string): string {
  const sentence=transcript.split(/[.!?\n]/)[0]?.trim()||"";
  if(!sentence)return "Untitled recording";
  if(sentence.length<=82)return sentence;
  return sentence.slice(0,82).replace(/\s+\S*$/,"").trim()||sentence.slice(0,82);
}
