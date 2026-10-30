import type { SupabaseClient } from "@supabase/supabase-js";

export type FilingCapture = {
  id: string; title: string | null; project_id: string | null; filing_status?: string; filing_version?: number;
};
export type FilingCommand = {
  decision: "file" | "inbox"; projectId: string; title: string;
  suggestedTitle: string; suggestedProjectId: string | null;
  confirmUnfile: boolean; requestId?: string;
};

export async function saveMemoryFiling(client: SupabaseClient, capture: FilingCapture, command: FilingCommand) {
  if (!command.title.trim()) throw Error("Please enter a title.");
  if (command.decision === "file" && !command.projectId) throw Error("Please select a project, or keep this recording in Inbox.");
  if (command.decision === "inbox" && capture.project_id && !command.confirmUnfile) {
    throw Error("Confirm removing the existing project before moving to Inbox.");
  }
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) throw Error("Sign in again.");
  if (!Number.isSafeInteger(capture.filing_version) || capture.filing_version! < 0) {
    throw Error("Atomic filing migration is required. Contact the workspace administrator.");
  }
  const { data, error } = await client.rpc("file_memory", {
    p_capture_id: capture.id, p_expected_version: capture.filing_version,
    p_request_id: command.requestId || crypto.randomUUID(),
    p_decision: command.decision, p_project_id: command.decision === "file" ? command.projectId : null,
    p_title: command.title.trim(), p_suggested_title: command.suggestedTitle,
    p_suggested_project_id: command.suggestedProjectId, p_confirm_unfile: command.confirmUnfile,
  });
  if (error) {
    if (error.code === "40001") throw Error("This recording changed. Refresh before filing.");
    if (error.code === "PGRST202" || error.code === "42883") throw Error("Atomic filing migration is required. Contact the workspace administrator.");
    throw Error("Filing was not confirmed. Your local review is retained; retry or refresh before changing it.");
  }
  if (!data) throw Error("Filing was not confirmed. Retry with the same review.");
}

export function suggestMemoryTitle(transcript: string): string {
  const sentence=transcript.split(/[.!?\n]/)[0]?.trim()||"";
  if(!sentence)return "Untitled recording";
  if(sentence.length<=82)return sentence;
  return sentence.slice(0,82).replace(/\s+\S*$/,"").trim()||sentence.slice(0,82);
}
