import { useMutation } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ideaError } from "./ideas";
export function SignalIdeaHandoff({
  workspaceId,
  signalId,
  title,
  allowed,
}: {
  workspaceId: Id<"workspaces">;
  signalId: Id<"githubSignals">;
  title: string;
  allowed: boolean;
}) {
  const create = useMutation(api.content.ideas.create),
    [perspective, setPerspective] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [result, setResult] = useState<Id<"ideas"> | null>(null);
  const allowedNow = useRef(allowed);
  allowedNow.current = allowed;
  const mounted = useRef(false),
    pending = useRef(false),
    operation = useRef(crypto.randomUUID());
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return (
    <div className="stack">
      <label>
        <span className="field-label">Eigene redaktionelle Perspektive</span>
        <Textarea
          value={perspective}
          onChange={(e) => setPerspective(e.target.value)}
          maxLength={2000}
          disabled={!allowed || busy || !!result}
        />
      </label>
      {result ? (
        <Button asChild variant="outline">
          <Link to="/ideas">Gespeicherte Idee öffnen</Link>
        </Button>
      ) : (
        <Button
          disabled={!allowed || busy || !perspective.trim()}
          onClick={async () => {
            if (pending.current) return;
            pending.current = true;
            setBusy(true);
            setError("");
            try {
              const id = await create({
                workspaceId,
                title: title.slice(0, 200),
                perspective,
                note: "",
                priority: "normal",
                source: { kind: "signal", signalId },
                operationKey: operation.current,
              });
              if (mounted.current && allowedNow.current) setResult(id);
            } catch (e) {
              if (mounted.current) setError(ideaError(e));
            } finally {
              pending.current = false;
              if (mounted.current) setBusy(false);
            }
          }}
        >
          {busy ? "Idee wird gespeichert …" : "Als belegte Idee übernehmen"}
        </Button>
      )}
      {!allowed && (
        <p className="text-xs muted">
          Aktuelle Content-Freigabe, unveränderte Quellenversion und
          Editor-Rechte erforderlich.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
