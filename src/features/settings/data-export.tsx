import { useEffect, useRef, useState } from "react";
import { useConvex } from "convex/react";
import { Download } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { authClient } from "@/lib/auth-client";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/shared";

export function NativeProfileExport() {
  const { state, nativeScope } = useStore();
  const { data: session } = authClient.useSession();
  const convex = useConvex();
  const authId = session?.user.id,
    sessionId = session?.session.id;
  const workspaceId = state.activeWorkspaceId;
  const current = useRef({ nativeScope, authId, sessionId, workspaceId });
  current.current = { nativeScope, authId, sessionId, workspaceId };
  const ticket = useRef(0),
    alive = useRef(true),
    inFlight = useRef(false);
  const objectURL = useRef<string | null>(null);
  const revokeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [handedOff, setHandedOff] = useState(false);
  const revoke = () => {
    if (revokeTimer.current) clearTimeout(revokeTimer.current);
    if (objectURL.current) URL.revokeObjectURL(objectURL.current);
    objectURL.current = null;
    revokeTimer.current = null;
  };
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      ticket.current++;
      revoke();
    };
  }, []);
  const download = async () => {
    if (inFlight.current || !authId || !sessionId) return;
    inFlight.current = true;
    const ownTicket = ++ticket.current;
    const scope = current.current;
    const stillCurrent = () =>
      alive.current &&
      ticket.current === ownTicket &&
      current.current.nativeScope === scope.nativeScope &&
      current.current.authId === scope.authId &&
      current.current.sessionId === scope.sessionId &&
      current.current.workspaceId === scope.workspaceId;
    setBusy(true);
    setError("");
    setHandedOff(false);
    try {
      const requestKey = crypto.randomUUID();
      const result = await convex.query(api.operations.export.self, {
        workspaceId: workspaceId as Id<"workspaces">,
        expectedAuthId: authId,
        requestKey,
      });
      if (!stillCurrent()) return;
      if (
        result.requestKey !== requestKey ||
        result.authId !== authId ||
        result.sessionId !== sessionId ||
        result.data.workspace.id !== workspaceId
      ) {
        setError(
          "Anmeldung oder Auswahl hat sich geändert. Bitte erneut herunterladen.",
        );
        return;
      }
      revoke();
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(result.data, null, 2)], {
          type: "application/json",
        }),
      );
      objectURL.current = url;
      const link = document.createElement("a");
      link.href = url;
      link.download = "dispatch-self-profile.json";
      link.click();
      revokeTimer.current = setTimeout(revoke, 1000);
      setHandedOff(true);
    } catch {
      if (stillCurrent()) {
        revoke();
        setError(
          "Profil-Export konnte nicht erstellt werden. Bitte erneut versuchen.",
        );
      }
    } finally {
      if (stillCurrent()) {
        inFlight.current = false;
        setBusy(false);
      }
    }
  };
  return (
    <Section
      title="Eigenes Profil exportieren"
      description="Lade dein Profil und deine eigene Mitgliedschaft im ausgewählten Workspace herunter. Dies ist ein Teil-Export: Chats, Inhalte, Medien und Auth-Datensätze sind nicht enthalten."
    >
      <Button
        variant="outline"
        disabled={busy || !authId || !sessionId}
        onClick={download}
      >
        <Download size={15} />
        Eigenes Profil als JSON herunterladen
      </Button>
      {busy && (
        <p role="status" className="muted text-sm mt-3">
          Profil wird geladen …
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm mt-3">
          {error}
        </p>
      )}
      {handedOff && (
        <p role="status" className="muted text-sm mt-3">
          Profil-JSON wurde zum Download übergeben.
        </p>
      )}
    </Section>
  );
}
