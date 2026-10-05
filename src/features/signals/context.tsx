import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ideaError } from "@/features/ideas/ideas";
export function SignalContext({
  workspaceId,
  signalId,
  generation,
  allowed,
  accountId,
}: {
  workspaceId: Id<"workspaces">;
  signalId: Id<"githubSignals">;
  generation: number;
  allowed: boolean;
  accountId: Id<"socialAccounts"> | null;
}) {
  const rows = useQuery(api.integrations.github.context.latest, {
    workspaceId,
    signalId,
  });
  const request = useMutation(api.integrations.github.context.request),
    approve = useMutation(api.integrations.github.context.approve),
    summarize = useMutation(api.integrations.github.context.summarize),
    stop = useMutation(api.ai.runs.stop);
  const [paths, setPaths] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false);
  const pending = useRef(false),
    mounted = useRef(false),
    operation = useRef(crypto.randomUUID()),
    eligibility = useRef({ allowed, accountId, generation });
  eligibility.current = { allowed, accountId, generation };
  useEffect(() => {
    operation.current = crypto.randomUUID();
  }, [generation]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  async function command(fn: () => Promise<unknown>, requireAccount = false) {
    if (pending.current || !allowed) return;
    const captured = { accountId, generation };
    const current = () =>
      mounted.current &&
      eligibility.current.allowed &&
      eligibility.current.generation === captured.generation &&
      (!requireAccount || eligibility.current.accountId === captured.accountId);
    pending.current = true;
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      await fn();
      if (current()) setSaved(true);
    } catch (e) {
      if (current())
        setError(
          String(e).includes("PRIVATE_KEY")
            ? "GITHUB_APP_PRIVATE_KEY fehlt. GitHub-App Contents-read und ein aktueller Repository-Nachweis sind erforderlich."
            : String(e).includes("CONTEXT")
              ? "Kontext ist unvollständig, gesperrt oder geändert. Prüfe Freigabe, Pfade und Quellenversion; deine Eingabe bleibt erhalten."
              : ideaError(e),
        );
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <details className="stack">
      <summary>Begrenzte Patch-Anreicherung</summary>
      <p className="text-xs muted">
        Ein einzelner historischer Push kann unter aktueller Freigabe neu
        geprüft werden. Nur bis zu drei ausdrücklich ausgewählte Text-Patches;
        keine vollständigen Dateien. Secrets-Prüfung ist nicht vollständig:
        prüfe jeden Auszug selbst vor Modellweitergabe. Releases,
        erzwungene/neue/gelöschte Refs und unvollständige Vergleiche benötigen
        anderen belegbaren Kontext.
      </p>
      <label>
        <span className="field-label">
          Geänderte Pfade, durch Komma getrennt
        </span>
        <Input
          value={paths}
          disabled={busy || !allowed}
          maxLength={602}
          onChange={(e) => {
            setPaths(e.target.value);
            operation.current = crypto.randomUUID();
          }}
          placeholder="src/example.ts, README.md"
        />
      </label>
      <Button
        disabled={busy || !allowed || !paths.trim()}
        onClick={() =>
          void command(() =>
            request({
              workspaceId,
              signalId,
              expectedGeneration: generation,
              paths: paths.split(",").map((p) => p.trim()),
              operationKey: operation.current,
            }),
          )
        }
      >
        Ausgewählte Patches prüfen
      </Button>
      {!allowed && (
        <p className="text-xs muted">
          Aktuelle separate Patch-Lese-Freigabe, gültiger Repository-Nachweis
          und Editor-Rechte nötig.
        </p>
      )}
      {rows?.map((c) => (
        <article className="border rounded p-3 stack" key={c._id}>
          <p className="text-sm">
            Kontext: {c.state} · ausgewählte Pfade: {c.paths.join(", ")}
          </p>
          {c.errorCode && (
            <p role="alert">
              {c.errorCode.includes("PRIVATE_KEY")
                ? "GITHUB_APP_PRIVATE_KEY fehlt. Kein Kontext wurde geladen."
                : c.errorCode.includes("COVERAGE")
                  ? "Auswahl ist nicht sicher vollständig prüfbar (Pfad, Secret, fehlender/binärer Patch oder Compare-Grenze). Keine Modellweitergabe."
                  : c.errorCode.includes("IMMUTABLE")
                    ? "Kein zulässiger unveränderlicher Push-Vergleich. Kein Modellaufruf."
                    : "GitHub-Kontext konnte nicht geladen werden. App-Konfiguration, Contents-read und aktuellen Zugriff prüfen."}
            </p>
          )}
          {c.excerpts.map((e) => (
            <div key={e.path}>
              <p className="text-xs">
                {e.path}
                {e.previousPath ? ` (vorher ${e.previousPath})` : ""} · Blob{" "}
                {e.blobSha}
              </p>
              <pre className="text-xs whitespace-pre-wrap break-all">
                {e.patch}
              </pre>
            </div>
          ))}
          {c.state === "ready" && (
            <>
              <p className="text-xs break-all">
                Freigabe bindet genau diese Auszüge und SHA-256 {c.hash}. Keine
                vollständige Datei-/Repository-Abdeckung.
              </p>
              <label className="flex gap-2">
                <Checkbox
                  checked={c.approvedHash === c.hash}
                  disabled={busy || !allowed || !c.canApprove}
                  onCheckedChange={(v) =>
                    void command(() =>
                      approve({
                        workspaceId,
                        contextId: c._id,
                        expectedHash: c.hash,
                        approved: Boolean(v),
                      }),
                    )
                  }
                />
                Ich habe diese Auszüge geprüft und erlaube genau ihre
                Modellweitergabe.
              </label>
              {!c.canApprove && (
                <p className="text-xs muted">
                  Nur die Person dieses Kontextauftrags kann seine
                  Modellweitergabe freigeben. Du kannst einen eigenen aktuellen
                  Auftrag erstellen.
                </p>
              )}
              {!c.runId && (
                <Button
                  disabled={
                    busy ||
                    !allowed ||
                    !c.canApprove ||
                    !accountId ||
                    c.approvedHash !== c.hash
                  }
                  onClick={() =>
                    void command(
                      () =>
                        summarize({
                          workspaceId,
                          contextId: c._id,
                          expectedHash: c.hash,
                          accountId: accountId!,
                        }),
                      true,
                    )
                  }
                >
                  Belegte redaktionelle Einordnung anfordern
                </Button>
              )}
              {!accountId && (
                <p className="text-xs muted">
                  Verbundenen Zielaccount auswählen. Separat nachgewiesene
                  Modellverarbeitung, Preise und drei Budget-Freigaben
                  erforderlich; ein API-Key allein aktiviert nichts.
                </p>
              )}
              {c.runId && (
                <SummaryRun
                  busy={busy}
                  state={c.runState}
                  stop={() =>
                    command(() => stop({ workspaceId, runId: c.runId! }))
                  }
                />
              )}
            </>
          )}
          {c.decision !== "pending" && (
            <>
              <p>
                Redaktionelle Entscheidung (Modellinterpretation): {c.decision}
              </p>
              <p>{c.summary}</p>
              <p>Begründung: {c.rationale}</p>
              <p>Neuigkeit: {c.novelty}</p>
              <p>Unkalibrierte Unsicherheit: {c.uncertainty}</p>
              <p className="text-xs">Bezüge: {c.references.join(", ")}</p>
              {c.evidence.map((e, i) => (
                <blockquote className="text-xs" key={i}>
                  {e.path}: {e.quote}
                </blockquote>
              ))}
              {c.resultIdeaId ? (
                <Link className="underline" to="/ideas">
                  Gespeicherte begründete Idee öffnen
                </Link>
              ) : (
                <p>Keine Idee und kein Draft angelegt.</p>
              )}
            </>
          )}
        </article>
      ))}
      {saved && (
        <p role="status">
          Server hat den Auftrag bestätigt. Ergebnis und Entscheidung erscheinen
          erst nach tatsächlicher Verarbeitung.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
    </details>
  );
}
function SummaryRun({
  busy,
  stop,
  state,
}: {
  busy: boolean;
  stop: () => Promise<void>;
  state: "ready" | "running" | "completed" | "stopped" | "failed" | null;
}) {
  return (
    <div className="stack">
      <p className="text-xs">
        Modellauftrag: {state ?? "Kein aktueller Laufbeleg verfügbar"}. Ein
        Fehler verliert das signierte Originalsignal nicht. Usage-Schätzungen
        sind keine Rechnung; unbekannte Kosten bleiben gehalten.
      </p>
      {(state === "running" || state === "ready") && (
        <Button variant="outline" disabled={busy} onClick={() => void stop()}>
          Anreicherung stoppen
        </Button>
      )}
    </div>
  );
}
