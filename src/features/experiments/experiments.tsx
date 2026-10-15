import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import type { FunctionArgs } from "convex/server";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useStore } from "@/lib/store";
import { useGithubSourceProofClock } from "@/lib/github-source-proof";
import { PageHeader, Section } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
type Command = FunctionArgs<typeof api.performance.experiments.change>;
export function RealExperiments() {
  const { state } = useStore();
  const account = state.accounts.find(
    (a) =>
      a.id === state.activeAccountId &&
      a.workspaceId === state.activeWorkspaceId,
  );
  if (!account)
    return (
      <Section title="Redaktionelle Experimente">
        <p>Wähle einen Account für die Beobachtung.</p>
      </Section>
    );
  return (
    <ExperimentsAccount
      key={`${state.activeWorkspaceId}:${account.id}`}
      workspaceId={state.activeWorkspaceId as Id<"workspaces">}
      accountId={account.id as Id<"socialAccounts">}
    />
  );
}
function ExperimentsAccount({
  workspaceId,
  accountId,
}: {
  workspaceId: Id<"workspaces">;
  accountId: Id<"socialAccounts">;
}) {
  const { state } = useStore(),
    admin = state.role === "Owner" || state.role === "Admin";
  const catalog = useQuery(api.performance.experiments.list, {
    workspaceId,
    accountId,
  });
  const [selected, setSelected] = useState<Id<"editorialExperiments"> | null>(
    null,
  );
  const detail = useQuery(
    api.performance.experiments.get,
    selected ? { workspaceId, accountId, experimentId: selected } : "skip",
  );
  const change = useMutation(api.performance.experiments.change);
  const [form, setForm] = useState({
    hypothesis: "",
    dimension: "",
    a: "",
    b: "",
    outcome: "",
    startsAt: "",
    endsAt: "",
    sampleCap: "",
    stopCondition: "",
    context: "",
    frequency: "",
  });
  const [units, setUnits] = useState<
    Extract<Command["action"], { kind: "declare" }>["units"]
  >([]);
  const [publicationUnits, setPublicationUnits] = useState<
    Extract<Command["action"], { kind: "declarePublication" }>["units"]
  >([]);
  const [publicationForm, setPublicationForm] = useState({
    metric: "",
    windowHours: "",
    rightsEvidence: "",
    explanation: "",
    expiresAt: "",
  });
  const publicationMode = form.outcome === "publication-count-v1";
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [failed, setFailed] = useState<Command | null>(null),
    [conflict, setConflict] = useState(false);
  const mounted = useRef(false),
    pending = useRef(false),
    fence = useRef({ role: state.role, epoch: 0 });
  if (fence.current.role !== state.role)
    fence.current = { role: state.role, epoch: fence.current.epoch + 1 };
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    setError("");
    setNotice("");
    setFailed(null);
    setConflict(false);
    setBusy(false);
  }, [state.role]);
  const clock = useGithubSourceProofClock([
    ...(detail
      ? [
          { authorized: true, proofExpiresAt: detail.endsAt },
          ...(detail.sourceUntil !== null
            ? [{ authorized: true, proofExpiresAt: detail.sourceUntil }]
            : []),
          ...detail.units
            .filter((u) => u.until !== null)
            .map((u) => ({ authorized: true, proofExpiresAt: u.until! })),
        ]
      : []),
  ]);
  const expired =
    detail &&
    ((detail.sourceUntil !== null && detail.sourceUntil <= clock) ||
      detail.units.some((u) => u.until !== null && u.until <= clock));
  const ended = detail && detail.endsAt <= clock;
  const readable = detail && !expired && detail.spec;
  const writable = admin && !!catalog && !busy && !failed && !conflict;
  async function execute(command: Command) {
    if (!admin || pending.current) return;
    const epoch = fence.current.epoch;
    pending.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await change(command);
      if (!mounted.current || fence.current.epoch !== epoch) return;
      setFailed(null);
      setSelected(result.experimentId);
      setNotice("Auftrag bestätigt. Aktuelle Beobachtung wird geladen.");
    } catch (e) {
      if (!mounted.current || fence.current.epoch !== epoch) return;
      if (e instanceof ConvexError) {
        setFailed(null);
        setError(String(e.data));
        setConflict(e.data === "EXPERIMENT_REVISION_CONFLICT");
      } else {
        setFailed(command);
        setError(
          "Antwort unklar. Derselbe Auftrag kann mit unveränderten Angaben erneut gesendet werden.",
        );
      }
    } finally {
      pending.current = false;
      if (mounted.current && fence.current.epoch === epoch) setBusy(false);
    }
  }
  function submit(kind: "declare" | "start" | "stop" | "withdraw") {
    if (!writable) return;
    let action: Command["action"];
    if (kind === "declare") {
      if (
        Object.values(form).some((v) => !v.trim()) ||
        (publicationMode
          ? publicationUnits.length < 2 ||
            !publicationUnits.some((u) => u.arm === "A") ||
            !publicationUnits.some((u) => u.arm === "B") ||
            Object.values(publicationForm).some((v) => !v.trim()) ||
            !catalog?.publicationConfiguration
          : units.length < 2 ||
            units.some((u) => !u.reviewerId) ||
            !units.some((u) => u.arm === "A") ||
            !units.some((u) => u.arm === "B"))
      ) {
        setError(
          publicationMode
            ? "Alle Werte, beide Varianten, genaue freigegebene Termine, Messalter/Zählwert und eigene Experiment-Nutzungsrechte ausdrücklich angeben."
            : "Alle Werte, beide Varianten und genaue Versionen mit prüfenden Personen ausdrücklich angeben.",
        );
        return;
      }
      const startsAt = Date.parse(`${form.startsAt}Z`),
        endsAt = Date.parse(`${form.endsAt}Z`);
      if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt)) {
        setError("Gültige UTC-Zeitgrenzen angeben.");
        return;
      }
      const editorial = {
        kind,
        spec: {
          ...form,
          dimension: form.dimension as "hook" | "format" | "timing",
          outcome: "editorial-decision-v1" as const,
          startsAt,
          endsAt,
          sampleCap: Number(form.sampleCap),
        },
        units,
      };
      action = editorial;
      if (publicationMode) {
        const expiresAt = Date.parse(`${publicationForm.expiresAt}Z`);
        if (!Number.isFinite(expiresAt)) {
          setError(
            "Gültiges Ende der eigenen Experiment-Nutzungsrechte angeben.",
          );
          return;
        }
        action = {
          kind: "declarePublication",
          spec: {
            ...editorial.spec,
            outcome: "publication-count-v1",
            publication: {
              metric: publicationForm.metric as "likes",
              windowHours: Number(publicationForm.windowHours) as 24,
              policyId: catalog!.publicationConfiguration!.policyId,
              policyFingerprint:
                catalog!.publicationConfiguration!.policyFingerprint,
              rightsEvidence: publicationForm.rightsEvidence,
              explanation: publicationForm.explanation,
              expiresAt,
            },
          },
          units: publicationUnits,
        };
      }
    } else action = { kind };
    void execute({
      workspaceId,
      accountId,
      ...(kind !== "declare" && selected ? { experimentId: selected } : {}),
      expectedRevision: kind === "declare" ? 0 : detail!.revision,
      commandKey: crypto.randomUUID(),
      action,
    });
  }
  const field = (key: keyof typeof form, label: string, type = "text") => (
    <label>
      <span className="field-label">{label}</span>
      <Input
        type={type}
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
      />
    </label>
  );
  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Begrenzte Beobachtung"
        title="Experimente"
        description="Exakte redaktionelle Entscheidungen oder vorhandene Publikationsmessungen. Varianten sind menschliche Angaben; Ergebnisse sind beschreibend."
      />
      {!catalog && <p role="status">Experimente werden geladen.</p>}
      {!admin && (
        <p>
          Leserechte: Deklaration, Start und Stop benötigen Owner oder Admin.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm break-words">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {failed && admin && (
        <Button disabled={busy} onClick={() => void execute(failed)}>
          Denselben Auftrag erneut senden
        </Button>
      )}
      {conflict && admin && (
        <Button
          disabled={busy || !detail}
          onClick={() => {
            setConflict(false);
            setError("");
          }}
        >
          Aktuelle Revision prüfen und übernehmen
        </Button>
      )}
      <Section
        title="Neue Hypothese"
        description="Direkte menschliche Angaben. Höchstens 32 Version-Person- oder Publikations-Einheiten und 28 Tage sind Softwaregrenzen, keine validierte Stichprobengröße."
      >
        <fieldset disabled={!writable} className="space-y-4 min-w-0">
          <label>
            <span className="field-label">Hypothese</span>
            <Textarea
              aria-label="Hypothese"
              value={form.hypothesis}
              onChange={(e) => setForm({ ...form, hypothesis: e.target.value })}
            />
          </label>
          <div className="form-grid">
            <label>
              <span className="field-label">Eine getestete Dimension</span>
              <select
                aria-label="Eine getestete Dimension"
                className="native-select"
                value={form.dimension}
                onChange={(e) =>
                  setForm({ ...form, dimension: e.target.value })
                }
              >
                <option value="">Auswählen</option>
                <option value="hook">Einstieg</option>
                <option value="format">Format</option>
                <option value="timing">Zeitpunkt</option>
              </select>
            </label>
            <label>
              <span className="field-label">Beobachtetes Ergebnis</span>
              <select
                aria-label="Beobachtetes Ergebnis"
                className="native-select"
                value={form.outcome}
                onChange={(e) => setForm({ ...form, outcome: e.target.value })}
              >
                <option value="">Auswählen</option>
                <option value="editorial-decision-v1">
                  Redaktionell angenommen / abgelehnt
                </option>
                <option value="publication-count-v1">
                  Exakte vorhandene Publikationszählwerte
                </option>
              </select>
            </label>
            {field("a", "Variante A")}
            {field("b", "Variante B")}
            {field("startsAt", "Start (UTC, einschließlich)", "datetime-local")}
            {field("endsAt", "Ende (UTC, ausschließlich)", "datetime-local")}
            {field("sampleCap", "Maximale Stichprobe (2–32)", "number")}
            {field("stopCondition", "Stop-Bedingung")}
            {field("context", "Tatsächlicher Kontext / Referenz")}
            {field("frequency", "Tatsächliche Frequenz / Referenz")}
          </div>
          {publicationMode ? (
            <div className="space-y-4 min-w-0">
              <p className="text-sm">
                Eine bestehende freigegebene Publikation oder ein ganzer Thread
                zählt als eine Probe. Zuordnung und Start sind ausschließlich
                vor jeder Text- oder Medienvorbereitung möglich. Termine und
                unabhängige Messsammlung bleiben unverändert.
              </p>
              {!catalog?.publicationConfiguration ? (
                <p role="status">
                  Messkonfiguration und unabhängige Nutzungsrechte fehlen. Keine
                  Ergebnisse oder Kosten werden erzeugt.
                </p>
              ) : (
                <div className="form-grid">
                  <label>
                    <span className="field-label">Exakter Zählwert</span>
                    <select
                      aria-label="Exakter Zählwert"
                      className="native-select"
                      value={publicationForm.metric}
                      onChange={(e) =>
                        setPublicationForm({
                          ...publicationForm,
                          metric: e.target.value,
                        })
                      }
                    >
                      <option value="">Auswählen</option>
                      {catalog.publicationConfiguration.fields.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="field-label">Messalter (Stunden)</span>
                    <select
                      aria-label="Messalter (Stunden)"
                      className="native-select"
                      value={publicationForm.windowHours}
                      onChange={(e) =>
                        setPublicationForm({
                          ...publicationForm,
                          windowHours: e.target.value,
                        })
                      }
                    >
                      <option value="">Auswählen</option>
                      {catalog.publicationConfiguration.windows.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </label>
                  {(
                    [
                      [
                        "rightsEvidence",
                        "Eigener Beleg für Experiment-Nutzungsrechte",
                      ],
                      [
                        "explanation",
                        "Erklärung und Umfang der Experiment-Nutzung",
                      ],
                      ["expiresAt", "Ende der Experiment-Nutzungsrechte (UTC)"],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key}>
                      <span className="field-label">{label}</span>
                      <Input
                        type={key === "expiresAt" ? "datetime-local" : "text"}
                        value={publicationForm[key]}
                        onChange={(e) =>
                          setPublicationForm({
                            ...publicationForm,
                            [key]: e.target.value,
                          })
                        }
                      />
                    </label>
                  ))}
                </div>
              )}
              <p className="text-xs muted">
                Die Account- und Workspace-Rechte werden aus der aktuellen
                nativen Konfiguration geprüft. Bestehende Messrechte ersetzen
                keinen eigenen Beleg für diese Experiment-Nutzung. Eine
                Verlängerung verlängert alte Proben nicht.
              </p>
              {!catalog?.schedules?.length && (
                <p>
                  Keine vorhandenen freigegebenen Termine für diesen Account.
                </p>
              )}
              {catalog?.schedules?.map((c) => {
                const u = publicationUnits.find(
                  (u) => u.scheduleId === c.scheduleId,
                );
                return (
                  <div
                    key={c.scheduleId}
                    className="surface p-3 space-y-2 min-w-0"
                  >
                    <label className="flex gap-2 items-start text-sm break-all">
                      <input
                        type="checkbox"
                        checked={!!u}
                        onChange={(e) =>
                          setPublicationUnits(
                            e.target.checked
                              ? [
                                  ...publicationUnits,
                                  {
                                    scheduleId: c.scheduleId,
                                    arm: "A",
                                    planItemId: null,
                                  },
                                ]
                              : publicationUnits.filter(
                                  (u) => u.scheduleId !== c.scheduleId,
                                ),
                          )
                        }
                      />
                      Termin {c.scheduleId} · {c.positions} Positionen ·{" "}
                      {new Date(c.at).toISOString()}
                    </label>
                    {u && (
                      <label>
                        <span className="field-label">
                          Arm für Termin {c.scheduleId}
                        </span>
                        <select
                          aria-label={`Arm für Termin ${c.scheduleId}`}
                          className="native-select"
                          value={u.arm}
                          onChange={(e) =>
                            setPublicationUnits(
                              publicationUnits.map((x) =>
                                x === u
                                  ? { ...x, arm: e.target.value as "A" | "B" }
                                  : x,
                              ),
                            )
                          }
                        >
                          <option>A</option>
                          <option>B</option>
                        </select>
                      </label>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <>
              <p className="text-xs muted">
                Wähle jede unveränderliche Version und ihre prüfende Person.
                Bereits entschiedene Versionen sind ausgeschlossen. Eine spätere
                Bearbeitung zählt nicht als neue Probe.
              </p>
              {!catalog?.candidates.length && (
                <p>Keine aktuellen Entwurfsversionen für diesen Account.</p>
              )}
              {catalog?.candidates.map((c) => {
                const u = units.find((u) => u.versionId === c.versionId);
                return (
                  <div
                    key={c.versionId}
                    className="surface p-3 space-y-2 min-w-0"
                  >
                    <label className="flex gap-2 items-start text-sm break-all">
                      <input
                        type="checkbox"
                        checked={!!u}
                        onChange={(e) =>
                          setUnits(
                            e.target.checked
                              ? [
                                  ...units,
                                  {
                                    versionId: c.versionId,
                                    reviewerId: "" as Id<"users">,
                                    arm: "A",
                                    planItemId: null,
                                  },
                                ]
                              : units.filter(
                                  (u) => u.versionId !== c.versionId,
                                ),
                          )
                        }
                      />
                      Version {c.number} · {c.versionId}
                    </label>
                    {u && (
                      <div className="form-grid">
                        <label>
                          <span className="field-label">
                            Arm für {c.versionId}
                          </span>
                          <select
                            aria-label={`Arm für ${c.versionId}`}
                            className="native-select"
                            value={u.arm}
                            onChange={(e) =>
                              setUnits(
                                units.map((x) =>
                                  x === u
                                    ? { ...x, arm: e.target.value as "A" | "B" }
                                    : x,
                                ),
                              )
                            }
                          >
                            <option>A</option>
                            <option>B</option>
                          </select>
                        </label>
                        <label>
                          <span className="field-label">
                            Prüfende Person für {c.versionId}
                          </span>
                          <select
                            aria-label={`Prüfende Person für ${c.versionId}`}
                            className="native-select"
                            value={u.reviewerId}
                            onChange={(e) =>
                              setUnits(
                                units.map((x) =>
                                  x === u
                                    ? {
                                        ...x,
                                        reviewerId: e.target
                                          .value as Id<"users">,
                                      }
                                    : x,
                                ),
                              )
                            }
                          >
                            <option value="">Auswählen</option>
                            {catalog.reviewers.map((r) => (
                              <option key={r.reviewerId} value={r.reviewerId}>
                                {r.role} · {r.reviewerId}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
          <Button onClick={() => submit("declare")}>
            Experiment deklarieren
          </Button>
        </fieldset>
      </Section>
      <Section title="Gespeicherte Experimente">
        {!catalog?.experiments.length && (
          <p>
            Noch keine nativen Experimente. Keine Beobachtung wurde gestartet.
          </p>
        )}
        <label>
          <span className="field-label">Experiment auswählen</span>
          <select
            aria-label="Experiment auswählen"
            className="native-select"
            disabled={busy || !!failed}
            value={selected ?? ""}
            onChange={(e) => {
              setSelected(
                (e.target.value as Id<"editorialExperiments">) || null,
              );
              setConflict(false);
              setError("");
            }}
          >
            <option value="">Auswählen</option>
            {catalog?.experiments.map((e) => (
              <option key={e.experimentId} value={e.experimentId}>
                {e.state} · Revision {e.revision} · {e.experimentId}
              </option>
            ))}
          </select>
        </label>
        {selected && !detail && <p role="status">Beobachtung wird geladen.</p>}
        {detail && (
          <div className="space-y-4 mt-4">
            <p>
              Zuordnung vor Start eingefroren
              {detail.enrollmentCapped
                ? " · deklarierte Einschreibungsgrenze erreicht"
                : ""}
              .
            </p>
            <p>
              Status:{" "}
              {expired
                ? "withdrawn"
                : ended && detail.state !== "stopped"
                  ? "ended"
                  : detail.state}{" "}
              · Revision {detail.revision}
            </p>
            {readable ? (
              <>
                <h2 className="text-lg">{detail.spec!.hypothesis}</h2>
                <p className="text-sm">
                  A: {detail.spec!.a} · B: {detail.spec!.b}
                </p>
                <p className="text-xs muted">
                  Kontext: {detail.spec!.context} · Frequenz:{" "}
                  {detail.spec!.frequency} · Stop: {detail.spec!.stopCondition}
                </p>
              </>
            ) : (
              <p>
                Quellenbeleg zurückgezogen oder abgelaufen. Geschützte Angaben
                und Ergebnisse sind nicht verfügbar.
              </p>
            )}
            {readable && detail.publication ? (
              <div className="space-y-3">
                <p>
                  Publikationen zählen je Termin; ein Thread ist eine Probe.
                  Gültige Nullwerte bleiben 0, fehlende oder partielle Messungen
                  sind nicht verfügbar.
                </p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {Object.entries(detail.publication.counts).map(([key, n]) => (
                    <p key={key}>
                      {
                        {
                          assigned: "Zugeordnet",
                          confirmed: "Bestätigt",
                          measured: "Gemessen",
                          partial: "Partiell",
                          unknown: "Unbekannt",
                          excluded: "Ausgeschlossen",
                          withdrawn: "Zurückgezogen",
                          missing: "Fehlen",
                        }[key as "assigned"]
                      }
                      : {n}
                    </p>
                  ))}
                </div>
                {(["A", "B"] as const).map((arm) => (
                  <p className="text-sm" key={arm}>
                    Arm {arm}: {detail.publication!.arms[arm].assigned}{" "}
                    zugeordnet · {detail.publication!.arms[arm].confirmed}{" "}
                    bestätigt · {detail.publication!.arms[arm].measured}{" "}
                    gemessen · {detail.publication!.arms[arm].partial} partiell
                    · {detail.publication!.arms[arm].unknown} unbekannt ·{" "}
                    {detail.publication!.arms[arm].excluded} ausgeschlossen ·{" "}
                    {detail.publication!.arms[arm].missing} fehlen
                  </p>
                ))}
                {detail.publication.cohorts.map((c) => (
                  <div
                    key={c.key}
                    className="surface p-3 text-sm space-y-2 break-words"
                  >
                    <p>
                      {c.metric} · {c.format} · Medien: {c.media} ·{" "}
                      {c.windowHours} Stunden · {c.definitionVersion} ·{" "}
                      {c.dialect}
                    </p>
                    <p>
                      {c.definition} · {c.rawField}
                    </p>
                    {(["A", "B"] as const).map((arm) => (
                      <p key={arm}>
                        Arm {arm}: n={c[arm].n} · Summe{" "}
                        {c[arm].sum ?? "nicht verfügbar"} · Mittelwert{" "}
                        {c[arm].mean ?? "nicht verfügbar"} · Zeitraum{" "}
                        {c[arm].from === null
                          ? "nicht verfügbar"
                          : new Date(c[arm].from).toISOString()}{" "}
                        bis{" "}
                        {c[arm].to === null
                          ? "nicht verfügbar"
                          : new Date(c[arm].to).toISOString()}
                      </p>
                    ))}
                    <p>
                      Beobachtete Mittelwertdifferenz B − A:{" "}
                      {c.difference ?? "nicht verfügbar"}
                    </p>
                  </div>
                ))}
                {!detail.publication.cohorts.length && (
                  <p>Kein vollständiges vergleichbares Messpaar verfügbar.</p>
                )}
                {detail.publication.units.map((u) => (
                  <p key={u.assignmentId} className="text-xs break-all">
                    {u.arm ?? "Zurückgezogen"} · {u.scheduleId} · {u.outcome} ·{" "}
                    {u.reason ?? "belegt"} · Wert {u.value ?? "nicht verfügbar"}
                  </p>
                ))}
              </div>
            ) : (
              readable && (
                <>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <p>Eingeschrieben: {detail.counts.enrolled}</p>
                    <p>Entschieden: {detail.counts.decided}</p>
                    <p>Angenommen: {detail.counts.accept}</p>
                    <p>Abgelehnt: {detail.counts.reject}</p>
                    <p>Konflikte: {detail.counts.conflict}</p>
                    <p>Ohne Feedback: {detail.counts.noFeedback}</p>
                    <p>Zurückgezogen: {detail.counts.withdrawn}</p>
                    <p>Bearbeitet: {detail.counts.edited}</p>
                    <p>
                      Bearbeitungsbelege fehlen: {detail.counts.missingEdits}
                    </p>
                  </div>
                  {(["A", "B"] as const).map((arm) => (
                    <p key={arm} className="text-sm">
                      Arm {arm}: {detail.arms[arm].enrolled} belegt ·{" "}
                      {detail.arms[arm].decided} entschieden ·{" "}
                      {detail.arms[arm].accept} angenommen ·{" "}
                      {detail.arms[arm].reject} abgelehnt ·{" "}
                      {detail.arms[arm].conflict} Konflikte ·{" "}
                      {detail.arms[arm].noFeedback} ohne Feedback
                    </p>
                  ))}
                  {detail.units.map((u) => (
                    <p key={u.assignmentId} className="text-xs break-all">
                      {u.arm ?? "Zurückgezogen"} · {u.versionId} ·{" "}
                      {u.reviewerId}: {u.outcome} · Änderungsausmaß{" "}
                      {u.editExtent === null ? "nicht verfügbar" : u.editExtent}
                    </p>
                  ))}
                </>
              )
            )}
            <p className="text-xs muted">
              {detail.spec?.publication ? (
                "Publikationszählwerte vergleichen nur gleiche Definition, Format, Medien und Messalter. Bestätigt umfasst auch gemessen; die übrigen Ergebnisgruppen sind getrennt. Unvollständige Threads, unbekannte Wirkungen, fehlende oder ungeeignete Messungen bleiben unavailable. Das ist eine beobachtete Zuordnung, kein kausaler Gewinner, keine Signifikanz und keine Aussage über Followerwachstum oder beste Uhrzeit."
              ) : (
                <>
                  Entschieden = angenommen + abgelehnt. Konflikte, fehlendes
                  Feedback und zurückgezogene Belege bleiben eigene Nenner.
                  Bearbeitung ist keine Ablehnung, Akzeptanz oder Zeitersparnis.
                  Auswahl, Thema, Länge, Stil und Zeitpunkt können sich
                  unterscheiden; unbekannte Unterschiede bleiben unbekannt.
                  Keine kausale Gewinneraussage.
                </>
              )}
            </p>
            <div className="flex flex-wrap gap-3">
              {detail.spec?.publication && (
                <Button
                  variant="outline"
                  disabled={!writable}
                  onClick={() => submit("withdraw")}
                >
                  Experiment-Nutzungsrechte zurückziehen
                </Button>
              )}
              <Button
                disabled={
                  !writable || !readable || ended || detail.state !== "planned"
                }
                onClick={() => submit("start")}
              >
                Beobachtung starten
              </Button>
              <Button
                variant="outline"
                disabled={
                  !writable ||
                  !readable ||
                  detail.state === "stopped" ||
                  detail.state === "withdrawn"
                }
                onClick={() => submit("stop")}
              >
                Beobachtung stoppen
              </Button>
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}
