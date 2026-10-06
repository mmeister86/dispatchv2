import { aggregate } from "../../../convex/performance/metricDefinitions";
const windows = [0.25, 1, 6, 24, 48] as const;
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
    history = useQuery(api.performance.history.overview, args),
    startHistory = useMutation(api.performance.history.start),
    manageHistory = useMutation(api.performance.history.manage),
    removeHistory = useMutation(api.performance.history.remove),
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
      ...(history?.posts.map((p) => p.sourceUntil) ?? []),
      history?.policy?.expiresAt ?? Infinity,
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
              Unterstützte Fenster: 15 Minuten, 1, 6, 24 und 48 Stunden ab lokal
              bestätigter Veröffentlichung. Standard bleibt 24/48; weitere
              Abrufe benötigen eine eigene Fenster- und Budgetfreigabe. Gültige
              Lesetokens müssen zum Abruf vorliegen. Impressionen sind keine
              eindeutigen Personen.
            </p>
            {data.configuration && (
              <p className="text-sm">
                Aktuell freigegebene Fenster:{" "}
                {data.configuration.windows
                  .map((w) => (w === 0.25 ? "15 Minuten" : `${w} Stunden`))
                  .join(", ")}
                . Höchstens {data.configuration.windows.length} Abrufe je
                bestätigtem Post, je{" "}
                {(data.configuration.unitMicros / 1e6).toFixed(6)}{" "}
                {data.configuration.currency}; maximal{" "}
                {(
                  (data.configuration.windows.length *
                    data.configuration.unitMicros) /
                  1e6
                ).toFixed(6)}{" "}
                {data.configuration.currency} je Post. Aktivieren bestätigt
                genau diese Policy; zusätzliche Fenster benötigen eine neue
                Freigabe.
              </p>
            )}
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
                      ...(data.configuration
                        ? {
                            policyId: data.configuration.id,
                            policyFingerprint: data.configuration.fingerprint,
                          }
                        : {}),
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
                        X · Accountgröße unbekannt ·{" "}
                        {p.contentType === "thread-member"
                          ? "Thread-Mitglied"
                          : "Beitrag"}{" "}
                        · Medien{" "}
                        {p.mediaType === "none" ? "keine" : "unbekannt"} ·
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
                      {windows.map((window) => {
                        const row = p.snapshots.find(
                          (s) =>
                            s.windowHours === window &&
                            (s.expiresAt ?? Infinity) > clock,
                        );
                        return (
                          <div key={window} className="my-3">
                            <b className="text-sm">
                              {window === 0.25
                                ? "15 Minuten"
                                : `${window} Stunden`}
                            </b>
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
                                  · Soll{" "}
                                  {new Date(row.dueAt).toLocaleString("de-DE")}{" "}
                                  · Angefragt{" "}
                                  {row.requestedAt
                                    ? new Date(row.requestedAt).toLocaleString(
                                        "de-DE",
                                      )
                                    : "—"}{" "}
                                  ·{" "}
                                  {row.late
                                    ? "verspätet: kumulativ, kein historischer Fensterwert"
                                    : "Beobachtungsfenster"}{" "}
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
              title="Eigener historischer Kontext"
              description="Separater Zweck: eigene Originalbeiträge und Antworten als beschreibenden Analytics-Kontext importieren. Aktueller Provider-Text kann spätere Bearbeitungen enthalten. Keine automatische Agent-/Jev-Verarbeitung."
            >
              <p className="muted text-sm">
                Anzeige der neuesten 25 importierten Beiträge. Höchstens 3
                Seiten mit je {history?.maxResults ?? 100} Beiträgen pro
                ausdrücklichem Import. Begrenzte Timeline-Abdeckung; keine
                vollständige Account-Historie. Alte private Kennzahlen und
                damalige Analyse bleiben unbekannt. Geteilte
                Medien-/Videoaggregate sind nicht verfügbar.
              </p>
              {history?.policy && (
                <p className="text-sm">
                  Freigegebener Preis je zurückgegebenem Beitrag:{" "}
                  {(history.policy.unitMicros / 1e6).toFixed(6)}{" "}
                  {history.policy.currency}. Höchstens{" "}
                  {(
                    ((history.maxResults ?? 100) * history.policy.unitMicros) /
                    1e6
                  ).toFixed(6)}{" "}
                  {history.policy.currency} pro Seite /{" "}
                  {(
                    (3 *
                      (history.maxResults ?? 100) *
                      history.policy.unitMicros) /
                    1e6
                  ).toFixed(6)}{" "}
                  {history.policy.currency} pro Import. Maximale
                  Textaufbewahrung:{" "}
                  {(history.policy.retentionMs / 86400000).toFixed(1)} Tage,
                  begrenzt durch frühere Rechte-/Freigabeabläufe. Policy gültig
                  bis{" "}
                  {new Date(history.policy.expiresAt).toLocaleString("de-DE")}.
                </p>
              )}
              {history?.reason && (
                <p role="status">
                  Für den Import fehlen aktuelle Rechte, separater Datenzweck,
                  Preis-/Budgetfreigaben oder eine gültige Verbindung.{" "}
                  <a href="/settings/integrations">Historienfreigaben prüfen</a>{" "}
                  · {history.reason}
                </p>
              )}
              <div className="flex gap-2 my-3">
                <Button
                  disabled={
                    !admin ||
                    busy ||
                    !history ||
                    !!history.reason ||
                    !history.policy ||
                    history.policy.expiresAt <= clock ||
                    history.jobs.some((j) =>
                      ["queued", "reading", "paused"].includes(j.state),
                    )
                  }
                  onClick={() =>
                    run(() =>
                      startHistory({
                        ...(args as Exclude<typeof args, string>),
                        policyId: history!.policy!.id,
                        policyFingerprint: history!.policy!.fingerprint,
                        purpose: "own-history-analytics-context-v1",
                        consent: true,
                      }),
                    )
                  }
                >
                  Eigenen Kontext importieren und zustimmen
                </Button>
                <Button
                  variant="outline"
                  disabled={!admin || busy}
                  onClick={() =>
                    run(() =>
                      removeHistory(args as Exclude<typeof args, string>),
                    )
                  }
                >
                  Historischen Kontext löschen
                </Button>
              </div>
              {history?.jobs.map((j) => (
                <div key={j.id} className="border-b py-3">
                  <p role="status">
                    Import {j.state} · {j.pages}/3 Seiten · {j.imported}{" "}
                    importiert · {j.rejected} ausgelassen{" "}
                    {j.reason && `· ${j.reason}`}
                  </p>
                  <div className="flex gap-2">
                    {["queued", "reading"].includes(j.state) && (
                      <Button
                        variant="outline"
                        disabled={!admin || busy}
                        onClick={() =>
                          run(() =>
                            manageHistory({
                              workspaceId:
                                state.activeWorkspaceId as Id<"workspaces">,
                              jobId: j.id,
                              operation: "pause",
                            }),
                          )
                        }
                      >
                        Import pausieren
                      </Button>
                    )}
                    {j.state === "paused" && (
                      <Button
                        variant="outline"
                        disabled={
                          !admin || busy || !j.canResume || !!history.reason
                        }
                        onClick={() =>
                          run(() =>
                            manageHistory({
                              workspaceId:
                                state.activeWorkspaceId as Id<"workspaces">,
                              jobId: j.id,
                              operation: "resume",
                            }),
                          )
                        }
                      >
                        Import fortsetzen
                      </Button>
                    )}
                    {["queued", "reading", "paused"].includes(j.state) && (
                      <Button
                        variant="ghost"
                        disabled={!admin || busy}
                        onClick={() =>
                          run(() =>
                            manageHistory({
                              workspaceId:
                                state.activeWorkspaceId as Id<"workspaces">,
                              jobId: j.id,
                              operation: "cancel",
                            }),
                          )
                        }
                      >
                        Import abbrechen
                      </Button>
                    )}
                  </div>
                  {j.state === "paused" && !j.canResume && (
                    <p className="muted text-xs">
                      Eine bereits gesendete Seite wird nicht erneut abgerufen.
                      Abbrechen und einen ausdrücklich neuen Import starten.
                    </p>
                  )}
                </div>
              ))}
              {history?.posts.map((p) => (
                <article key={p._id} className="border-b py-4">
                  <a
                    href={`https://x.com/i/web/status/${p.externalId}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Post {p.externalId}
                  </a>
                  <p className="muted text-xs">
                    Historischer Import · X ·{" "}
                    {p.contentType === "reply"
                      ? "eigene Antwort"
                      : "eigener Originalbeitrag"}{" "}
                    · Medien {p.mediaType === "none" ? "keine" : "unbekannt"} ·
                    veröffentlicht{" "}
                    {new Date(p.providerCreatedAt).toLocaleString("de-DE")} ·
                    importiert {new Date(p.observedAt).toLocaleString("de-DE")}{" "}
                    · Accountgröße unbekannt
                  </p>
                  <p className="text-sm">
                    {p.text && p.sourceUntil > clock
                      ? p.text
                      : "Kontextquelle nicht mehr verfügbar"}
                  </p>
                  <p className="muted text-xs">
                    Kennzahlen unvollständig: nicht beobachtet; private
                    Abfragefenster{" "}
                    {Date.now() - p.providerCreatedAt >= 30 * 86400000
                      ? "abgelaufen"
                      : "nicht freigegeben"}
                    .{" "}
                    {p.versionId
                      ? `Bestätigte Originalversion ${p.versionId}; damaliges Wissen ${p.thenKnowledgeId ? "separat verknüpft" : "nicht erfasst"}`
                      : "Keine bestätigte Dispatch-Version / damalige Analyse unbekannt"}
                    . Nachträgliche Analyse: nicht durchgeführt.
                  </p>
                </article>
              ))}
            </Section>
          </div>
          <div className="mt-6">
            <Section
              title="Bekannte Thread-Abdeckung"
              description="Summen kompatibler eigener Post-Kennzahlen im selben Fenster. Impressionen zählen wiederholte Sichtkontakte. Fehlende oder verspätete Mitglieder bleiben außerhalb der Summe."
            >
              {[...new Set(data.posts.map((p) => p.scheduleId))].map((id) => {
                const members = data.posts.filter((p) => p.scheduleId === id),
                  total = members[0]?.coverage.total ?? null;
                return (
                  <div key={id}>
                    {windows.map((w) => {
                      const rows = members.flatMap((p) =>
                          p.snapshots.filter(
                            (s) => s.windowHours === w && s.expiresAt > clock,
                          ),
                        ),
                        sum = aggregate(rows, total);
                      return (
                        <p key={w} className="muted text-sm">
                          Thread {id} ·{" "}
                          {w === 0.25 ? "15 Minuten" : `${w} Stunden`} ·{" "}
                          {sum.covered}/{sum.total ?? "?"} kompatibel ·{" "}
                          {sum.fields.length
                            ? sum.fields
                                .map(
                                  (f) =>
                                    `${f.name}: ${f.value} (${f.covered}/${sum.total ?? "?"} bekannt)`,
                                )
                                .join(" · ")
                            : "keine kompatible Messung"}
                        </p>
                      );
                    })}
                  </div>
                );
              })}
              <p className="muted text-xs">
                Historische Antworten bilden ohne bestätigte Mitgliedschaft
                keinen Thread-Aggregatwert. Geteilte Medien-/Videometriken sind
                nicht unterstützt.
              </p>
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
