"use client";

import { useEffect, useState, type ReactNode } from "react";
import { getSupabase } from "@/lib/supabase";

type Props = { ownerId: string; children: ReactNode };

// This creates a personal workspace for the currently signed-in user on first access.
// Existing workspaces are reused. RLS enforces ownership on the database side.
export default function WorkspaceBootstrap({ ownerId, children }: Props) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    async function initialize() {
      try {
        const client = getSupabase();
        const { data: identity, error: identityError } = await client.auth.getUser();
        if (identityError || identity.user?.id !== ownerId) throw new Error("Your session could not be verified. Please sign in again.");

        const { data: workspaces, error: selectError } = await client
          .from("workspaces")
          .select("id")
          .eq("owner_id", ownerId)
          .eq("kind", "personal")
          .order("created_at", { ascending: true })
          .limit(1);
        if (selectError) throw selectError;
        if (!workspaces?.length) {
          const { error: insertError } = await client.from("workspaces").insert({
            owner_id: ownerId,
            name: "Personal",
            kind: "personal",
          });
          if (insertError) throw insertError;
        }
        if (!cancelled) setStatus("ready");
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : "Unable to load your personal workspace.");
          setStatus("error");
        }
      }
    }
    void initialize();
    return () => { cancelled = true; };
  }, [ownerId, attempt]);

  if (status === "loading") return <div className="auth-loading" role="status">Preparing your personal workspace…</div>;
  if (status === "error") return <main className="auth-loading"><div style={{textAlign:"center",padding:24}}>
    <h2>We couldn&apos;t open your workspace.</h2>
    <p role="alert">{errorMessage}</p>
    <button type="button" onClick={() => setAttempt(n => n + 1)}>Try again</button>
  </div></main>;
  return <>{children}</>;
}
