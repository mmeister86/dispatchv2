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
  function submit(kind: "declare" | "start" | "stop") {
    if (!writable) return;
    let action: Command["action"];
    if (kind === "declare") {
      if (
        Object.values(form).some((v) => !v.trim()) ||
        units.length < 2 ||
        units.some((u) => !u.reviewerId) ||
        !units.some((u) => u.arm === "A") ||
        !units.some((u) => u.arm === "B")
      ) {
        setError(
          "Alle Werte, beide Varianten und genaue Versionen mit prüfenden Personen ausdrücklich angeben.",
        );
        return;
      }
      const startsAt = Date.parse(`${form.startsAt}Z`),
        endsAt = Date.parse(`${form.endsAt}Z`);
      if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt)) {
        setError("Gültige UTC-Zeitgrenzen angeben.");
        return;
      }
      action = {
        kind,
        spec: {
          ...form,
          dimension: form.dimension as "hook" | "format" | "timing",
          outcome: "editorial-decision-v1",
          startsAt,
          endsAt,
          sampleCap: Number(form.sampleCap),
        },
        units,
      };
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
        description="Exakte redaktionelle Entscheidungen. Varianten sind menschliche Angaben; Ergebnisse sind beschreibend."
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
        description="Direkte menschliche Angaben. Höchstens 32 Version-Person-Einheiten und 28 Tage sind Softwaregrenzen, keine validierte Stichprobengröße."
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
          <p className="text-xs muted">
            Wähle jede unveränderliche Version und ihre prüfende Person. Bereits
            entschiedene Versionen sind ausgeschlossen. Eine spätere Bearbeitung
            zählt nicht als neue Probe.
          </p>
          {!catalog?.candidates.length && (
            <p>Keine aktuellen Entwurfsversionen für diesen Account.</p>
          )}
          {catalog?.candidates.map((c) => {
            const u = units.find((u) => u.versionId === c.versionId);
            return (
              <div key={c.versionId} className="surface p-3 space-y-2 min-w-0">
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
                          : units.filter((u) => u.versionId !== c.versionId),
                      )
                    }
                  />
                  Version {c.number} · {c.versionId}
                </label>
                {u && (
                  <div className="form-grid">
                    <label>
                      <span className="field-label">Arm für {c.versionId}</span>
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
                                    reviewerId: e.target.value as Id<"users">,
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
            {readable && (
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
                  <p>Bearbeitungsbelege fehlen: {detail.counts.missingEdits}</p>
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
                    {u.arm ?? "Zurückgezogen"} · {u.versionId} · {u.reviewerId}:{" "}
                    {u.outcome} · Änderungsausmaß{" "}
                    {u.editExtent === null ? "nicht verfügbar" : u.editExtent}
                  </p>
                ))}
              </>
            )}
            <p className="text-xs muted">
              Entschieden = angenommen + abgelehnt. Konflikte, fehlendes
              Feedback und zurückgezogene Belege bleiben eigene Nenner.
              Bearbeitung ist keine Ablehnung, Akzeptanz oder Zeitersparnis.
              Auswahl, Thema, Länge, Stil und Zeitpunkt können sich
              unterscheiden; unbekannte Unterschiede bleiben unbekannt. Keine
              kausale Gewinneraussage.
            </p>
            <div className="flex flex-wrap gap-3">
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
