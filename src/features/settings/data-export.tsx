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

export function NativePreferencesExport() {
  const { state, nativeScope } = useStore();
  const { data: session } = authClient.useSession();
  const convex = useConvex();
  const authId = session?.user.id,
    sessionId = session?.session.id;
  const workspaceId = state.activeWorkspaceId;
  const scopeKey = `${nativeScope}:${authId}:${sessionId}:${workspaceId}`;
  const current = useRef({ scopeKey, epoch: 0 });
  if (current.current.scopeKey !== scopeKey)
    current.current = { scopeKey, epoch: current.current.epoch + 1 };
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
  useEffect(() => {
    ticket.current++;
    inFlight.current = false;
    setBusy(false);
    setError("");
    setHandedOff(false);
    revoke();
  }, [nativeScope, authId, sessionId, workspaceId]);
  const download = async () => {
    if (inFlight.current || !authId || !sessionId) return;
    inFlight.current = true;
    const ownTicket = ++ticket.current;
    const scope = current.current;
    const stillCurrent = () =>
      alive.current &&
      ticket.current === ownTicket &&
      current.current.scopeKey === scope.scopeKey &&
      current.current.epoch === scope.epoch;
    setBusy(true);
    setError("");
    setHandedOff(false);
    try {
      const requestKey = crypto.randomUUID();
      const result = await convex.query(api.operations.export.preferences, {
        workspaceId: workspaceId as Id<"workspaces">,
        expectedAuthId: authId,
        expectedSessionId: sessionId,
        requestKey,
      });
      if (!stillCurrent()) return;
      const now = Date.now();
      if (
        !Number.isFinite(now) ||
        Object.is(now, -0) ||
        result.requestKey !== requestKey ||
        result.authId !== authId ||
        result.sessionId !== sessionId ||
        result.workspaceId !== workspaceId ||
        result.data.workspaceId !== workspaceId ||
        result.data.format !== "dispatch-self-preferences" ||
        result.data.version !== 1 ||
        result.data.researchSummaries.length > 5 ||
        ![
          result.observedAt,
          result.data.observedAt,
          result.proofValidUntil,
          result.data.profile.onboardingStep,
          ...(result.data.notifications
            ? [result.data.notifications.revision]
            : []),
          ...result.data.researchSummaries.flatMap((r) => [
            r.generation,
            r.finishedAt,
            r.deadline,
            r.sourceUntil,
            r.availableAt,
            r.proofValidUntil,
          ]),
        ].every((n) => Number.isFinite(n) && !Object.is(n, -0)) ||
        result.data.observedAt !== result.observedAt ||
        result.observedAt > now ||
        result.proofValidUntil <= now ||
        result.proofValidUntil > result.observedAt + 30_000 ||
        result.data.researchSummaries.some(
          (r) =>
            r.proofValidUntil <= now ||
            r.proofValidUntil > r.sourceUntil ||
            r.proofValidUntil > r.deadline ||
            result.proofValidUntil > r.proofValidUntil,
        ) ||
        new TextEncoder().encode(JSON.stringify(result)).length > 64 * 1024
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
      link.download = "dispatch-self-preferences.json";
      const handoffAt = Date.now();
      if (
        !stillCurrent() ||
        !Number.isFinite(handoffAt) ||
        Object.is(handoffAt, -0) ||
        handoffAt >= result.proofValidUntil
      ) {
        revoke();
        throw new Error("EXPORT_SOURCE_EXPIRED");
      }
      link.click();
      revokeTimer.current = setTimeout(revoke, 1000);
      setHandedOff(true);
    } catch {
      if (stillCurrent()) {
        revoke();
        setError(
          "Einstellungs-Export konnte nicht erstellt werden. Bitte erneut versuchen.",
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
      title="Eigene Einstellungen exportieren"
      description="Lade dein Profil, gespeicherte Benachrichtigungseinstellungen und aktuell erlaubte Metadaten eigener Research-Zusammenfassungen herunter. Dies ist ein Teil-Export des ausgewählten Workspaces; Inhalte, Quellen, andere Personen und Auth-Datensätze sind nicht enthalten."
    >
      <Button
        variant="outline"
        disabled={busy || !authId || !sessionId}
        onClick={download}
      >
        <Download size={15} />
        Eigene Einstellungen als JSON herunterladen
      </Button>
      {busy && (
        <p role="status" className="muted text-sm mt-3">
          Einstellungen werden geladen …
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm mt-3">
          {error}
        </p>
      )}
      {handedOff && (
        <p role="status" className="muted text-sm mt-3">
          Einstellungs-JSON wurde zum Download übergeben.
        </p>
      )}
    </Section>
  );
}

export function WorkspaceVersionsExport() {
  const { state, nativeScope } = useStore();
  const { data: session } = authClient.useSession();
  const convex = useConvex();
  const authId = session?.user.id,
    sessionId = session?.session.id;
  const workspaceId = state.activeWorkspaceId,
    accountId = state.activeAccountId,
    role = state.role;
  const scope = `${nativeScope}:${authId}:${sessionId}:${workspaceId}:${accountId}:${role}`;
  const current = useRef({ scope, epoch: 0 });
  if (current.current.scope !== scope)
    current.current = { scope, epoch: current.current.epoch + 1 };
  const alive = useRef(true),
    nonce = useRef(0),
    inFlight = useRef(false);
  const position = useRef<{
    cursor: string | null;
    creationUpperBound: number | null;
    epoch: number;
  }>({ cursor: null, creationUpperBound: null, epoch: current.current.epoch });
  if (position.current.epoch !== current.current.epoch)
    position.current = {
      cursor: null,
      creationUpperBound: null,
      epoch: current.current.epoch,
    };
  const objectURL = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [status, setStatus] = useState("");
  const [done, setDone] = useState(false);
  const revoke = () => {
    if (timer.current) clearTimeout(timer.current);
    if (objectURL.current) URL.revokeObjectURL(objectURL.current);
    objectURL.current = null;
    timer.current = null;
  };
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      nonce.current++;
      revoke();
    };
  }, []);
  useEffect(() => {
    nonce.current++;
    inFlight.current = false;
    setBusy(false);
    setDone(false);
    setError("");
    setStatus("");
    revoke();
  }, [scope]);
  const download = async () => {
    if (
      inFlight.current ||
      !authId ||
      !sessionId ||
      !["Owner", "Admin"].includes(role)
    )
      return;
    inFlight.current = true;
    if (done) {
      position.current = {
        cursor: null,
        creationUpperBound: null,
        epoch: current.current.epoch,
      };
      setDone(false);
    }
    const ticket = ++nonce.current,
      epoch = current.current.epoch;
    const stillCurrent = () =>
      alive.current &&
      nonce.current === ticket &&
      current.current.epoch === epoch &&
      current.current.scope === scope;
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const requestKey = crypto.randomUUID();
      const sent = position.current;
      const result = await convex.query(api.operations.export.versions, {
        workspaceId: workspaceId as Id<"workspaces">,
        expectedAuthId: authId,
        requestKey,
        cursor: sent.cursor,
        creationUpperBound: sent.creationUpperBound,
      });
      if (!stillCurrent()) return;
      const now = Date.now();
      if (
        !Number.isFinite(now) ||
        Object.is(now, -0) ||
        result.requestKey !== requestKey ||
        result.authId !== authId ||
        result.sessionId !== sessionId ||
        result.workspaceId !== workspaceId ||
        result.data.workspaceId !== workspaceId ||
        result.role !== role ||
        result.data.format !== "dispatch-workspace-draft-versions" ||
        result.data.version !== 1 ||
        result.data.versions.length > 1 ||
        typeof result.cursor !== "string" ||
        (!result.isDone && (!result.cursor || result.cursor === sent.cursor)) ||
        typeof result.isDone !== "boolean" ||
        ![
          result.creationUpperBound,
          result.observedAt,
          result.proofValidUntil,
          ...result.data.versions.flatMap((r) => [
            r.createdAt,
            r.versionNumber,
          ]),
        ].every((n) => Number.isFinite(n) && !Object.is(n, -0)) ||
        result.creationUpperBound > result.observedAt ||
        result.observedAt > now ||
        result.proofValidUntil <= now ||
        result.proofValidUntil > result.observedAt + 30_000 ||
        (sent.creationUpperBound !== null &&
          result.creationUpperBound !== sent.creationUpperBound) ||
        new TextEncoder().encode(JSON.stringify(result)).length > 64 * 1024
      )
        throw new Error("EXPORT_SCOPE_CHANGED");
      revoke();
      if (result.data.versions.length) {
        const payload = {
          format: result.data.format,
          version: result.data.version,
          workspaceId: result.data.workspaceId,
          versions: result.data.versions.map(
            ({
              versionId,
              draftId,
              versionNumber,
              createdAt,
              title,
              text,
              accountId,
              pillar,
              strategy,
              reason,
            }) => ({
              versionId,
              draftId,
              versionNumber,
              createdAt,
              title,
              text,
              accountId,
              pillar,
              strategy,
              reason,
            }),
          ),
        };
        const url = URL.createObjectURL(
          new Blob([JSON.stringify(payload)], { type: "application/json" }),
        );
        objectURL.current = url;
        const link = document.createElement("a");
        link.href = url;
        link.download = "dispatch-workspace-draft-versions.json";
        const handoffAt = Date.now();
        if (
          !stillCurrent() ||
          !Number.isFinite(handoffAt) ||
          Object.is(handoffAt, -0) ||
          handoffAt >= result.proofValidUntil
        )
          throw new Error("EXPORT_SOURCE_EXPIRED");
        link.click();
        timer.current = setTimeout(revoke, 1000);
        setStatus("Versionsseite wurde zum Download übergeben.");
      } else
        setStatus("Diese Seite enthält keine freigegebenen Versionsinhalte.");
      const advanceAt = Date.now();
      if (
        !stillCurrent() ||
        !Number.isFinite(advanceAt) ||
        Object.is(advanceAt, -0) ||
        advanceAt >= result.proofValidUntil
      )
        throw new Error("EXPORT_SOURCE_EXPIRED");
      position.current = {
        cursor: result.cursor,
        creationUpperBound: result.creationUpperBound,
        epoch,
      };
      setDone(result.isDone);
    } catch {
      if (stillCurrent()) {
        revoke();
        setError(
          "Versions-Export konnte nicht erstellt werden. Bitte erneut versuchen.",
        );
      }
    } finally {
      if (stillCurrent()) {
        inFlight.current = false;
        setBusy(false);
      }
    }
  };
  if (!["Owner", "Admin"].includes(role)) return null;
  return (
    <Section
      title="Geteilte Draft-Versionen exportieren"
      description="Lade geteilte Versionsinhalte des ausgewählten Workspace seitenweise herunter. Jede Seite prüft die aktuellen Quellen erneut. Dies ist eine Teilauswahl und kein Snapshot; Medien und private Archive sind nicht enthalten."
    >
      <Button
        variant="outline"
        disabled={busy || !authId || !sessionId}
        onClick={download}
      >
        <Download size={15} />
        {done
          ? "Neue Versionsauswahl beginnen"
          : position.current.cursor === null
            ? "Erste Versionsseite herunterladen"
            : "Nächste Versionsseite herunterladen"}
      </Button>
      {busy && (
        <p role="status" className="muted text-sm mt-3">
          Versionsseite wird geprüft …
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm mt-3">
          {error}
        </p>
      )}
      {status && (
        <p role="status" className="muted text-sm mt-3">
          {status}
          {done
            ? " Das Ende dieser Auswahl wurde erreicht."
            : " Die nächste Seite kann geladen werden."}
        </p>
      )}
    </Section>
  );
}
