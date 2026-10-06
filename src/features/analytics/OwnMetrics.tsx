import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { PageHeader, Section, EmptyState, Status } from "@/components/shared";
export function OwnMetrics() {
  const { state } = useStore(),
    accounts = state.accounts.filter(
      (a) => a.workspaceId === state.activeWorkspaceId && a.channel === "X",
    );
  const [chosen, setChosen] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const account = accounts.find((a) => a.id === chosen) ?? accounts[0],
    args = account
      ? {
          workspaceId: state.activeWorkspaceId as Id<"workspaces">,
          accountId: account.id as Id<"socialAccounts">,
        }
      : ("skip" as const);
  const data = useQuery(api.performance.snapshots.overview, args),
    feedback = useQuery(api.content.feedback.list, args),
    consent = useMutation(api.performance.capabilities.consent),
    remove = useMutation(api.performance.capabilities.remove),
    decide = useMutation(api.content.feedback.decide);
  const [clock, setClock] = useState(Date.now());
  const nextWake = Math.min(
    ...[
      ...(data?.posts.map(
        (p) => p.knowledge?.assessment?.sourceUntil ?? Infinity,
      ) ?? []),
      ...(feedback?.map((f) => f.sourceUntil ?? Infinity) ?? []),
      ...(data?.posts.flatMap((p) =>
        p.snapshots.map((s) => s.expiresAt ?? Infinity),
      ) ?? []),
    ].filter((t) => t > clock),
  );
  useEffect(() => {
    if (!Number.isFinite(nextWake)) return;
    const timer = setTimeout(
      () => setClock(Date.now()),
      Math.min(2147483647, Math.max(0, nextWake - Date.now()) + 1),
    );
    return () => clearTimeout(timer);
  }, [nextWake, clock]);
  const admin = ["Owner", "Admin"].includes(state.role),
    editor = ["Owner", "Admin", "Editor"].includes(state.role);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Die Änderung konnte nicht gespeichert werden.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="page">
      <PageHeader
        title="Analytics"
        description="Eigene veröffentlichte Beiträge und redaktionelles Feedback."
      />
      <div className="flex gap-3 items-end mb-6">
        <label>
          <span className="field-label">X-Account</span>
          <select
            aria-label="X-Account"
            className="native-select"
            value={account?.id ?? ""}
            onChange={(e) => setChosen(e.target.value)}
          >
            {accounts.map((a) => (
              <option value={a.id} key={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <Status>
          {data?.enabled ? "Erfassung aktiviert" : "Erfassung pausiert"}
        </Status>
      </div>
      {!account ? (
        <EmptyState
          title="Kein X-Account"
          description="Verbinde einen eigenen X-Account in den Einstellungen."
        />
      ) : !data ? (
        <p role="status">Messgrundlage wird geladen …</p>
      ) : (
        <>
          <Section
            title="Metrikerfassung"
            description="Zweck: eigene Post-Kennzahlen beschreiben und redaktionelles Feedback auswerten. Keine Modellschulung, Wirksamkeitsbehauptung oder automatische Veröffentlichung."
          >
            {data.reason && (
              <p role="status">
                {data.reason.includes("CONFIGURATION")
                  ? "Für den Abruf fehlen bestätigte Leserechte, Feldverfügbarkeit, Datenzweck oder Preis- und Budgetfreigaben."
                  : data.reason.includes("REAUTH")
                    ? "Der Lesetoken fehlt oder ist abgelaufen. Aktualisiere die X-Verbindung in den Einstellungen."
                    : "Die Erfassung ist pausiert oder derzeit nicht verfügbar."}{" "}
                <a href="/settings/integrations">X-Verbindung und Freigaben</a>
              </p>
            )}
            <p className="text-sm muted">
              24- und 48-Stunden-Fenster ab lokal bestätigter Veröffentlichung.
              Gültige Lesetokens müssen zum Abruf vorliegen. Kein nachträglicher
              Import; Impressionen sind keine eindeutigen Personen.
            </p>
            <div className="flex gap-2">
              <Button
                disabled={
                  !admin ||
                  busy ||
                  (!data.enabled &&
                    !!data.reason &&
                    data.reason !== "OWN_METRICS_PAUSED")
                }
                onClick={() =>
                  run(() =>
                    consent({
                      ...(args as Exclude<typeof args, string>),
                      enabled: !data.enabled,
                    }),
                  )
                }
              >
                {data.enabled ? "Erfassung pausieren" : "Erfassung aktivieren"}
              </Button>
              <Button
                variant="outline"
                disabled={!admin || busy}
                onClick={() =>
                  run(() => remove(args as Exclude<typeof args, string>))
                }
              >
                Messwerte löschen
              </Button>
            </div>
          </Section>
          <div className="mt-6">
            <Section
              title="Veröffentlichte Beiträge"
              description="Ein Strich bedeutet unbekannt, nur ausdrücklich gemessene Werte können 0 sein. Thread-Positionen bleiben getrennt; keine unbelegten Summen oder Erfolgsprognosen."
            >
              {!data.posts.length ? (
                <EmptyState
                  title="Noch keine bestätigten Beiträge"
                  description="Veröffentlichungen ohne Analyse bleiben möglich."
                />
              ) : (
                <div className="space-y-5">
                  {data.posts.map((p) => (
                    <article key={p.postAttemptId} className="border-b pb-5">
                      <a
                        href={`https://x.com/i/web/status/${p.externalId}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Post {p.externalId}
                      </a>
                      <p className="muted text-xs">
                        Thread-Position {p.position + 1} ·{" "}
                        {p.coverage?.confirmed ?? "—"}/
                        {p.coverage?.total ?? "—"} bestätigt · Version{" "}
                        {p.versionId} · lokal bestätigt{" "}
                        {new Date(p.confirmedAt).toLocaleString("de-DE")}
                      </p>
                      <p className="text-sm">
                        Analyse bei Veröffentlichung:{" "}
                        {!p.knowledge
                          ? "nicht erfasst (älterer Beitrag)"
                          : !p.knowledge.assessmentId
                            ? "ausdrücklich keine Analyse"
                            : !p.knowledge.assessment ||
                                (p.knowledge.assessment.sourceUntil ??
                                  Infinity) <= clock
                              ? "Quelle nicht mehr verfügbar"
                              : p.knowledge.applicable
                                ? "damals aktuell"
                                : "damals vorhanden, nicht aktuell anwendbar"}
                      </p>
                      {p.knowledge?.assessment &&
                        (p.knowledge.assessment.sourceUntil ?? Infinity) >
                          clock && (
                          <p className="muted text-xs">
                            {p.knowledge.assessment.provenance.resolvedModel ??
                              p.knowledge.assessment.provenance
                                .requestedModel}{" "}
                            · {p.knowledge.assessment.result.questionVersion} ·
                            Formel{" "}
                            {p.knowledge.assessment.result.score
                              ?.formulaVersion ?? "unbekannt"}{" "}
                            · Erfasst{" "}
                            {new Date(p.knowledge.capturedAt).toLocaleString(
                              "de-DE",
                            )}
                          </p>
                        )}
                      {[24, 48].map((window) => {
                        const row = p.snapshots.find(
                          (s) =>
                            s.windowHours === window &&
                            (s.expiresAt ?? Infinity) > clock,
                        );
                        return (
                          <div key={window} className="my-3">
                            <b className="text-sm">{window} Stunden</b>
                            <span className="muted text-xs ml-3">
                              {!row
                                ? "nicht erfasst"
                                : row.state === "queued"
                                  ? "Abruf geplant"
                                  : row.state === "reading"
                                    ? "Abruf läuft"
                                    : row.reason
                                      ? "Abruf nicht verfügbar"
                                      : "Beobachtung erfasst"}
                            </span>
                            {row && (
                              <>
                                <p className="muted text-xs">
                                  {row.observedAt
                                    ? `Beobachtet ${new Date(row.observedAt).toLocaleString("de-DE")} · Alter seit Bestätigung ${((row.observedAt - p.confirmedAt) / 3600000).toFixed(1)} h`
                                    : "Noch keine Beobachtung"}{" "}
                                  · Provider-Zeit{" "}
                                  {row.providerCreatedAt
                                    ? new Date(
                                        row.providerCreatedAt,
                                      ).toLocaleString("de-DE")
                                    : "unbekannt"}
                                </p>
                                <dl className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                  {row.fields.map((f) => (
                                    <div
                                      key={
                                        (
                                          {
                                            impressions: "Impressionen",
                                            likes: "Likes",
                                            replies: "Antworten",
                                            reposts: "Reposts",
                                            quotes: "Zitate",
                                            bookmarks: "Lesezeichen",
                                            url_clicks: "Link-Klicks",
                                            profile_clicks: "Profil-Klicks",
                                          } as Record<string, string>
                                        )[f.name] ?? f.name
                                      }
                                    >
                                      <dt
                                        className="text-xs muted"
                                        title={f.definition}
                                      >
                                        {(
                                          {
                                            impressions: "Impressionen",
                                            likes: "Likes",
                                            replies: "Antworten",
                                            reposts: "Reposts",
                                            quotes: "Zitate",
                                            bookmarks: "Lesezeichen",
                                            url_clicks: "Link-Klicks",
                                            profile_clicks: "Profil-Klicks",
                                          } as Record<string, string>
                                        )[f.name] ?? f.name}
                                      </dt>
                                      <dd className="text-lg">
                                        {f.status === "measured" &&
                                        f.value !== null
                                          ? f.value.toLocaleString("de-DE")
                                          : "—"}
                                        <span className="text-xs muted ml-2">
                                          {
                                            {
                                              measured: "gemessen",
                                              missing: "fehlt",
                                              invalid: "ungültig",
                                              unavailable: "nicht verfügbar",
                                              deleted: "entfernt",
                                              access_expired:
                                                "Zugriff abgelaufen",
                                            }[f.status]
                                          }
                                        </span>
                                      </dd>
                                    </div>
                                  ))}
                                </dl>
                              </>
                            )}
                          </div>
                        );
                      })}
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          disabled={!editor || busy}
                          onClick={() =>
                            run(() =>
                              decide({
                                workspaceId:
                                  state.activeWorkspaceId as Id<"workspaces">,
                                versionId: p.versionId,
                                kind: "accept",
                              }),
                            )
                          }
                        >
                          Redaktionell annehmen
                        </Button>
                        <Button
                          variant="ghost"
                          disabled={!editor || busy}
                          onClick={() =>
                            run(() =>
                              decide({
                                workspaceId:
                                  state.activeWorkspaceId as Id<"workspaces">,
                                versionId: p.versionId,
                                kind: "reject",
                              }),
                            )
                          }
                        >
                          Redaktionell ablehnen
                        </Button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </Section>
          </div>
          <div className="mt-6">
            <Section
              title="Redaktionelles Feedback"
              description="Unabhängig von X-Kennzahlen. Bearbeitungsumfang zählt geänderte Codepoints im mittleren Textbereich; keine semantische Bewertung."
            >
              {!feedback?.length ? (
                <p className="muted text-sm">Noch kein Feedback erfasst.</p>
              ) : (
                <ul className="space-y-2">
                  {feedback.map((f) => (
                    <li key={f._id} className="text-sm">
                      {f.kind === "accept"
                        ? "Angenommen"
                        : f.kind === "reject"
                          ? "Abgelehnt"
                          : "Bearbeitet"}{" "}
                      · Version {f.versionId} ·{" "}
                      {f.sourceUnavailable ||
                      (f.sourceUntil ?? Infinity) <= clock
                        ? "Quellenkontext entfernt"
                        : f.editExtent !== null
                          ? `${f.editExtent} geänderte Codepoints`
                          : "ohne Bearbeitungsmessung"}
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        </>
      )}
      {error && (
        <p role="alert" className="mt-4">
          {error}
        </p>
      )}
    </div>
  );
}
