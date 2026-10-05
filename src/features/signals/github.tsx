import { useAction, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useStore } from "@/lib/store";
import {
  githubSourceAuthorized,
  useGithubSourceProofClock,
} from "@/lib/github-source-proof";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader, Section, Status } from "@/components/shared";
function errorMessage(e: unknown) {
  const code = e instanceof Error ? e.message : String(e);
  if (code.includes("PRIVATE_KEY"))
    return "GITHUB_APP_PRIVATE_KEY fehlt oder ist ungültig. Die Administration muss den GitHub-App-Schlüssel in Convex ergänzen.";
  if (code.includes("CONFIGURATION"))
    return "GITHUB_WEBHOOK_SECRET, GITHUB_APP_CLIENT_ID und GITHUB_APP_ID müssen in Convex eingerichtet sein. Abonniere Push und Release (published) und registriere /integrations/github/webhook als App-Webhook mit demselben Secret.";
  if (code.includes("SOURCE_DISABLED") || code.includes("SOURCE_BLOCKED"))
    return "Die Quelle ist gesperrt oder ihre Prüfung abgelaufen. Prüfe Repository-Auswahl und Monitoring-Freigabe erneut. Eine zuvor gesperrte Zustellung wird nicht stillschweigend freigegeben.";
  if (code.includes("NOT_READY"))
    return "Die Zustellung wartet auf den signierten Eingang oder die Wiederholungsfrist. Höchstens drei explizite Versuche je Zustellung, mindestens 15 Minuten Abstand.";
  if (code.includes("RATE_LIMITED"))
    return "GitHub begrenzt die Anfragen. Die angezeigte Wiederholungsfrist bleibt verbindlich.";
  if (code.includes("ALREADY_PROCESSED"))
    return "Diese Zustellung wurde bereits im Workspace verarbeitet.";
  if (code.includes("ROLE_ACCESS") || code.includes("WORKSPACE_CHANGED"))
    return "Rolle oder Workspace hat sich geändert. Die Aktion wurde nicht bestätigt.";
  return "Die GitHub-Anfrage konnte nicht bestätigt werden. Ein unklarer Redelivery-Ausgang gilt weiterhin als offen.";
}
export function GithubSignals() {
  const { state } = useStore();
  return (
    <GithubSignalWorkspace
      key={state.activeWorkspaceId}
      workspaceId={state.activeWorkspaceId as Id<"workspaces">}
      manage={["Owner", "Admin"].includes(state.role)}
    />
  );
}
function GithubSignalWorkspace({
  workspaceId,
  manage,
}: {
  workspaceId: Id<"workspaces">;
  manage: boolean;
}) {
  const [cursor, setCursor] = useState<string | null>(null),
    [recoveryCursor, setRecoveryCursor] = useState<string | null>(null);
  const sources = useQuery(api.integrations.github.repositories.list, {
    workspaceId,
  });
  const signals = useQuery(api.content.signals.list, {
    workspaceId,
    paginationOpts: { numItems: 25, cursor },
  });
  const recoveries = useQuery(
    api.content.signals.recoveries,
    manage
      ? {
          workspaceId,
          paginationOpts: { numItems: 25, cursor: recoveryCursor },
        }
      : "skip",
  );
  const scan = useQuery(
    api.integrations.github.recoveryState.scanStatus,
    manage ? { workspaceId } : "skip",
  );
  const detect = useAction(api.integrations.github.recovery.detect),
    redeliver = useAction(api.integrations.github.recovery.redeliver);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const mounted = useRef(false),
    pending = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const proofClock = useGithubSourceProofClock([
    ...(sources?.repositories ?? []),
    ...(recoveries?.page.flatMap((r) =>
      [r.leaseUntil, r.notBefore]
        .filter((at) => at > Date.now())
        .map((at) => ({ authorized: true, proofExpiresAt: at })),
    ) ?? []),
    ...(scan && scan.notBefore > Date.now()
      ? [{ authorized: true, proofExpiresAt: scan.notBefore }]
      : []),
  ]);
  const current =
    sources?.repositories.filter((r) =>
      githubSourceAuthorized(r, proofClock),
    ) ?? [];
  async function command(fn: () => Promise<unknown>, confirmed: string) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
      if (mounted.current) setMessage(confirmed);
    } catch (e) {
      if (mounted.current) setError(errorMessage(e));
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <div className="fade-in stack">
      <PageHeader
        title="GitHub-Signale"
        description="Signierte Push- und Release-Ereignisse aus freigegebenen Repository-Quellen."
      />
      <Section title="Repository-Quellen">
        <Button variant="outline" asChild>
          <Link to="/settings/integrations">Repository-Quellen verwalten</Link>
        </Button>
        {current.map((r) => (
          <p key={r._id} className="text-sm">
            {r.fullName} · {r.private ? "Privat" : "Öffentlich"} · Monitoring{" "}
            {r.monitoring ? "freigegeben" : "aus"} · Content{" "}
            {r.content ? "freigegeben" : "aus"}
          </p>
        ))}
        {!current.length && (
          <p className="text-sm muted">
            Keine aktuell geprüfte Quelle. Die Repository-Prüfung gilt 15
            Minuten und muss bei Ablauf ausdrücklich erneuert werden.
          </p>
        )}
        <p className="text-xs muted">
          Nur begrenzte Ereignismetadaten werden gespeichert. Dateien, Diffs und
          Release-Texte werden nicht übernommen. KI-Anreicherung und
          Ideen-Übergabe sind noch nicht verfügbar.
        </p>
      </Section>
      {!signals ? (
        <p role="status">Signale werden geladen …</p>
      ) : !signals.page.length ? (
        <EmptyState
          title="Noch keine verarbeiteten GitHub-Signale"
          description="Echte Push- und veröffentlichte Release-Ereignisse erscheinen erst nach verifiziertem Eingang und aktueller Monitoring-Freigabe. Hier werden keine Beispieldaten oder erfundenen Bewertungen angezeigt."
        />
      ) : (
        <Section title="Verarbeitete Ereignisse">
          {signals.page.map((s) => (
            <article key={s._id} className="border rounded-lg p-4 stack">
              <div className="flex flex-wrap justify-between gap-2">
                <h3>
                  {s.kind === "push"
                    ? `${s.commitCount} Commit-Einträge · ${s.ref}`
                    : `Release ${s.tag}${s.prerelease ? " · Vorabversion" : ""}`}
                </h3>
                <Status tone="green">
                  Signiert · im Workspace verarbeitet
                </Status>
              </div>
              <p className="text-sm">
                {s.fullName} · {s.private ? "Privat" : "Öffentlich"}
              </p>
              {s.kind === "push" && (
                <p className="text-xs muted">
                  {s.created ? "Ref angelegt. " : ""}
                  {s.deleted ? "Ref gelöscht. " : ""}
                  {s.forced ? "Erzwungener Push. " : ""}Commit-Metadaten sind
                  auf die von GitHub gelieferten Einträge begrenzt; der
                  Ereigniszeitpunkt ist nicht verfügbar.
                </p>
              )}
              <p className="text-xs muted">
                Eingegangen: {new Date(s.receivedAt).toLocaleString()} ·
                verarbeitet: {new Date(s.processedAt).toLocaleString()}
                {s.providerAt !== null
                  ? ` · Release veröffentlicht: ${new Date(s.providerAt).toLocaleString()}`
                  : ""}
              </p>
              {s.explicitRecovery && (
                <p className="text-xs muted">
                  Vorhandene signierte Fakten ausdrücklich lokal nachgeholt:{" "}
                  {new Date(s.explicitRecovery.authorizedAt).toLocaleString()}
                </p>
              )}
              <p className="text-xs muted">Zustellung: {s.guid}</p>
              {s.url && (
                <a
                  className="text-sm underline"
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Original bei GitHub öffnen
                </a>
              )}
            </article>
          ))}
        </Section>
      )}
      {signals && (
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={cursor === null}
            onClick={() => setCursor(null)}
          >
            Neueste Signale
          </Button>
          <Button
            variant="outline"
            disabled={signals.isDone}
            onClick={() => setCursor(signals.continueCursor)}
          >
            Ältere Signale
          </Button>
        </div>
      )}
      {manage && (
        <Section title="Zustellungen prüfen und nachholen">
          <p className="text-xs muted">
            GitHub stellt fehlgeschlagene Webhooks nicht automatisch erneut zu.
            Die eigene Prüfung läuft alle 15 Minuten und betrachtet höchstens
            1.000 Zustellversuche der letzten 24 Stunden. Provider-Retention,
            größere Payloads und Einträge außerhalb dieses Fensters bleiben
            mögliche Lücken. Der Empfänger akzeptiert höchstens 256 KiB.
            Ereignisse vor einer Monitoring-Freigabe oder ohne belegbare
            Freigabereihenfolge erfordern eine ausdrückliche lokale Nachholung
            unter aktueller Repository-Prüfung.
          </p>
          <Button
            variant="outline"
            disabled={busy || Boolean(scan && scan.notBefore > proofClock)}
            onClick={() =>
              void command(
                () => detect({ workspaceId }),
                "Zustellprüfung ausgeführt. Der dokumentierte Prüfumfang und einzelne Zustände stehen unten; dies bestätigt keinen Webhook-Eingang.",
              )
            }
          >
            {busy ? "Anfrage läuft …" : "Zustellungen jetzt prüfen"}
          </Button>
          {scan ? (
            <p className="text-xs muted">
              Letzter Prüfversuch: {new Date(scan.checkedAt).toLocaleString()} ·
              ältester betrachteter Ereignisversuch:{" "}
              {scan.oldestAt === null
                ? "nicht verfügbar"
                : new Date(scan.oldestAt).toLocaleString()}{" "}
              ·{" "}
              {scan.limited
                ? "Prüfung begrenzt oder unterbrochen"
                : "Listing im angegebenen Fenster abgeschlossen"}
              {scan.notBefore > proofClock
                ? ` · frühestens erneut ${new Date(scan.notBefore).toLocaleString()}`
                : ""}
            </p>
          ) : (
            <p className="text-xs muted">
              Noch kein Prüfbeleg. Fehlende Convex-Konfiguration wird nach der
              Prüfung angezeigt.
            </p>
          )}
          {scan?.errorCode && (
            <p role="alert">{errorMessage(scan.errorCode)}</p>
          )}
          {recoveries?.page.map((r) => {
            const source = current.find(
              (s) =>
                s._id === r.repositoryId &&
                s.providerId === r.providerId &&
                s.installationId === r.installationId &&
                s.monitoring,
            );
            const recoveryState =
              r.state === "requesting" && r.leaseUntil <= proofClock
                ? "unknown"
                : r.state;
            return (
              <article key={r._id} className="border rounded-lg p-4 stack">
                <p className="text-sm">
                  {r.event === "push" ? "Push" : "Release"} · Zustellung{" "}
                  {r.guid}
                </p>
                <p className="text-xs muted">
                  Provider-Zustellversuch:{" "}
                  {new Date(r.deliveredAt).toLocaleString()} · HTTP-Status{" "}
                  {r.providerStatus === null ? "unbekannt" : r.providerStatus} ·{" "}
                  {r.state === "processed"
                    ? "Signiert im Workspace verarbeitet"
                    : r.localReceipt
                      ? "Signierter Beleg vorhanden; lokale Faktennachholung möglich"
                      : r.state === "accepted"
                        ? "Redelivery angefordert (202); signierter Eingang steht noch aus"
                        : recoveryState === "requesting"
                          ? "Anfrage läuft; Ergebnis offen"
                          : recoveryState === "unknown"
                            ? "Anfrageausgang unklar; Eingang bleibt offen"
                            : "Kein verarbeiteter lokaler Beleg"}
                </p>
                {r.errorCode && <p role="alert">{errorMessage(r.errorCode)}</p>}
                <Button
                  variant="outline"
                  disabled={
                    busy ||
                    !source ||
                    r.state === "processed" ||
                    (!r.localReceipt &&
                      (r.leaseUntil > proofClock ||
                        r.notBefore > proofClock ||
                        r.attempts >= 3))
                  }
                  onClick={() =>
                    void command(
                      () =>
                        redeliver({
                          workspaceId,
                          recoveryId: r._id,
                          expectedGeneration: source!.generation,
                        }),
                      r.localReceipt
                        ? "Vorhandene signierte Fakten unter aktueller Freigabe lokal nachgeholt."
                        : "Redelivery-Schritt beendet. Erst ein verifizierter signierter Eingang bestätigt die Verarbeitung.",
                    )
                  }
                >
                  {r.localReceipt
                    ? "Signierte Fakten lokal nachholen"
                    : "Signierte Redelivery anfordern"}
                </Button>
                {!source && r.state !== "processed" && (
                  <p className="text-xs muted">
                    Aktuelle Repository-Prüfung und unveränderte
                    Monitoring-Freigabe erforderlich.
                  </p>
                )}
                {!r.localReceipt &&
                  r.attempts >= 3 &&
                  r.state !== "processed" && (
                    <p className="text-xs muted">
                      Drei Provider-Versuche ausgeschöpft. Die
                      GitHub-App-Administration muss die Zustellung dort prüfen;
                      ein späterer signierter Eingang wird weiterhin
                      dedupliziert verarbeitet.
                    </p>
                  )}
                {!r.localReceipt && r.notBefore > proofClock && (
                  <p className="text-xs muted">
                    Frühestens erneut: {new Date(r.notBefore).toLocaleString()}
                  </p>
                )}
              </article>
            );
          })}
          {recoveries && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={recoveryCursor === null}
                onClick={() => setRecoveryCursor(null)}
              >
                Neueste Zustellungen
              </Button>
              <Button
                variant="outline"
                disabled={recoveries.isDone}
                onClick={() => setRecoveryCursor(recoveries.continueCursor)}
              >
                Ältere Zustellungen
              </Button>
            </div>
          )}
        </Section>
      )}
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
    </div>
  );
}
