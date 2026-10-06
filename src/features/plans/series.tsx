import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useStore } from "@/lib/store";
import { useGithubSourceProofClock } from "@/lib/github-source-proof";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Section } from "@/components/shared";
export function FiniteSeries({
  workspaceId,
  accountId,
  preferenceId,
}: {
  workspaceId: Id<"workspaces">;
  accountId: Id<"socialAccounts">;
  preferenceId: Id<"preferences">;
}) {
  const { state } = useStore(),
    write = state.role !== "Viewer";
  const data = useQuery(api.planning.strategy.get, { workspaceId, accountId });
  const change = useMutation(api.planning.strategy.change);
  const [form, setForm] = useState({
    theme: "",
    desiredFormat: "",
    threshold: "",
    timezone: "",
    frequency: "",
    weekday: "",
    callbackClock: "",
    publishingClocks: "",
    start: "",
    end: "",
    occurrences: "",
    itemsPerBatch: "",
    historyFrom: "",
    historyTo: "",
  });
  const [pool, setPool] = useState<Id<"draftVersions">[]>([]),
    [pillars, setPillars] = useState<{ name: string; weight: number }[]>([]);
  const [chosenStyle, setChosenStyle] =
    useState<Id<"styleProfileVersions"> | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [revisionConflict, setRevisionConflict] = useState(false);
  const mounted = useRef(false),
    pending = useRef(false),
    role = useRef(state.role);
  role.current = state.role;
  const command = useRef<{
    intent: string;
    key: string;
    revision: number;
    seriesId?: Id<"planningSeries">;
  } | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    setError("");
    setNotice("");
  }, [state.role]);
  const clock = useGithubSourceProofClock([
    ...(data?.styleUntil != null
      ? [{ authorized: true, proofExpiresAt: data.styleUntil }]
      : []),
    ...(data?.version
      ? [{ authorized: true, proofExpiresAt: data.version.sourceUntil }]
      : []),
    ...(data?.candidates
      .filter((p) => p.sourceUntil !== null)
      .map((p) => ({ authorized: true, proofExpiresAt: p.sourceUntil! })) ??
      []),
  ]);
  const versionReadable =
    data?.version &&
    !data.version.sourceUnavailable &&
    data.version.sourceUntil > clock;
  const availablePillars =
    data && (data.styleUntil === null || data.styleUntil > clock)
      ? data.pillars
      : [];
  const candidates =
    data?.candidates.filter(
      (p) => p.sourceUntil === null || p.sourceUntil > clock,
    ) ?? [];
  const field = (name: keyof typeof form, label: string, type = "text") => (
    <label>
      <span className="field-label">{label}</span>
      <Input
        type={type}
        value={form[name]}
        onChange={(e) => setForm({ ...form, [name]: e.target.value })}
      />
    </label>
  );
  async function submit(disable = false) {
    if (!write || pending.current || revisionConflict || !data) return;
    const currentRole = state.role;
    const config = {
      preferenceId,
      styleVersionId: chosenStyle!,
      theme: form.theme,
      candidateVersionIds: pool,
      pillars,
      desiredFormat: form.desiredFormat as "single" | "thread",
      threshold: Number(form.threshold),
      timezone: form.timezone,
      frequency: "weekly" as const,
      weekday: Number(form.weekday),
      callbackClock: form.callbackClock,
      publishingClocks: form.publishingClocks.split(",").map((s) => s.trim()),
      start: form.start,
      end: form.end,
      occurrences: Number(form.occurrences),
      itemsPerBatch: Number(form.itemsPerBatch),
      historyFrom: Date.parse(`${form.historyFrom}Z`),
      historyTo: Date.parse(`${form.historyTo}Z`),
    };
    if (
      !disable &&
      (Object.values(form).some((s) => !s.trim()) ||
        !pool.length ||
        !pillars.length ||
        !chosenStyle ||
        !Number.isSafeInteger(config.historyFrom) ||
        !Number.isSafeInteger(config.historyTo))
    ) {
      setError(
        "Alle Serienwerte und die genaue Themenzuordnung ausdrücklich angeben.",
      );
      return;
    }
    const action = disable
      ? { kind: "disable" as const }
      : { kind: "configure" as const, config };
    const intent = JSON.stringify({
      workspaceId,
      accountId,
      action,
    });
    if (command.current?.intent !== intent)
      command.current = {
        intent,
        key: crypto.randomUUID(),
        revision: data.control?.revision ?? 0,
        seriesId: data.control?._id,
      };
    pending.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await change({
        workspaceId,
        accountId,
        ...(command.current.seriesId
          ? { seriesId: command.current.seriesId }
          : {}),
        expectedRevision: command.current.revision,
        commandKey: command.current.key,
        action,
      });
      if (mounted.current && role.current === currentRole) {
        command.current = null;
        setRevisionConflict(false);
        setNotice(
          disable
            ? "Serie deaktiviert. Angenommene Termine bleiben erhalten."
            : "Endliche Serie gespeichert. Vorschläge erscheinen in den gespeicherten Plänen.",
        );
      }
    } catch (e) {
      if (mounted.current && role.current === currentRole) {
        const code = e instanceof ConvexError ? String(e.data) : "";
        if (code === "SERIES_REVISION_CONFLICT") setRevisionConflict(true);
        setError(
          code === "SERIES_REVISION_CONFLICT"
            ? "Revision geändert. Gespeicherte Version prüfen; deine Eingaben bleiben erhalten."
            : code === "EMBEDDING_FRAME_RESOURCE_CEILING"
              ? "Nachweisgrenze erreicht. Kleineren exakten Themenpool wählen."
              : e instanceof ConvexError
                ? `Serie nicht bestätigt (${code}). Stil, Quellen, vollständige Vektoren und Eingaben prüfen.`
                : "Ergebnis nicht bestätigt. Gespeicherte Serie vor erneutem Versuch prüfen; derselbe Auftrag wird wiederverwendet.",
        );
      }
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <Section title="Wiederkehrende Serien">
      <p className="text-xs muted">
        Standardmäßig aus. Höchstens vier wöchentliche Vorschlagsbatches in 28
        Kalendertagen, je höchstens sieben Slots. Vorhandene exakte Versionen
        werden deinem Thema ausdrücklich zugeordnet.
      </p>
      {data === undefined ? (
        <p role="status">Serienrahmen wird geladen…</p>
      ) : (
        <>
          <p className="text-xs">
            {data.control?.enabled ? "Serie aktiv" : "Serie aus"} · Revision{" "}
            {data.control?.revision ?? 0} · {data.control?.remaining ?? 0}{" "}
            verbleibende Batches
          </p>
          {data.control?.nextAt != null && (
            <p className="text-xs break-words">
              Nächster Vorschlag: {new Date(data.control.nextAt).toISOString()}
            </p>
          )}
          {versionReadable ? (
            <div className="text-xs break-words">
              <p>Unveränderliche Version: {data.version!._id}</p>
              <p>
                Thema: {data.version!.config?.theme} · gewünschtes Format:{" "}
                {data.version!.config?.desiredFormat} (unbelegt)
              </p>
              <p>
                Originalnachweis bis{" "}
                {new Date(data.version!.sourceUntil).toISOString()}
              </p>
            </div>
          ) : data.version ? (
            <p className="text-xs">
              Serieninhalt nicht mehr lesbar; keine erneute Aktivierung durch
              Wiederherstellung.
            </p>
          ) : null}
          {data.reason && (
            <p role="status" className="text-xs">
              Serienrahmen nicht verfügbar: {data.reason}
            </p>
          )}
          <fieldset disabled={!write || busy} className="form-grid">
            {field("theme", "Serienthema")}
            <label>
              <span className="field-label">Gewünschtes Format (unbelegt)</span>
              <select
                className="native-select"
                value={form.desiredFormat}
                onChange={(e) =>
                  setForm({ ...form, desiredFormat: e.target.value })
                }
              >
                <option value="">Ausdrücklich wählen</option>
                <option value="single">Einzelbeitrag</option>
                <option value="thread">Thread</option>
              </select>
            </label>
            {field("threshold", "Deklarierte Cosinusgrenze", "number")}
            {field("timezone", "Serien-IANA-Zeitzone")}
            <label>
              <span className="field-label">Serienfrequenz</span>
              <select
                className="native-select"
                value={form.frequency}
                onChange={(e) =>
                  setForm({ ...form, frequency: e.target.value })
                }
              >
                <option value="">Ausdrücklich wählen</option>
                <option value="weekly">Wöchentlich</option>
              </select>
            </label>
            <label>
              <span className="field-label">Callback-Wochentag</span>
              <select
                className="native-select"
                value={form.weekday}
                onChange={(e) => setForm({ ...form, weekday: e.target.value })}
              >
                <option value="">Ausdrücklich wählen</option>
                {[
                  "Sonntag",
                  "Montag",
                  "Dienstag",
                  "Mittwoch",
                  "Donnerstag",
                  "Freitag",
                  "Samstag",
                ].map((day, i) => (
                  <option key={day} value={i}>
                    {day}
                  </option>
                ))}
              </select>
            </label>
            {field("callbackClock", "Lokale Vorschlagsuhrzeit", "time")}
            {field(
              "publishingClocks",
              "Lokale Publishing-Fenster (HH:mm, mit Komma)",
            )}
            {field("start", "Serienstart (einschließlich)", "date")}
            {field("end", "Serienende (einschließlich)", "date")}
            {field("occurrences", "Anzahl Batches (1–4)", "number")}
            {field("itemsPerBatch", "Slots je Batch (1–7)", "number")}
            {field("historyFrom", "Historienrahmen ab (UTC)", "datetime-local")}
            {field("historyTo", "Historienrahmen bis (UTC)", "datetime-local")}
            <div className="min-w-0">
              <span className="field-label">
                Tatsächliche ausgewählte Stilsäulen
              </span>
              {data.selectedStyleVersionId && (
                <p className="text-[11px] break-all">
                  Aktuell ausgewählte Stilversion: {data.selectedStyleVersionId}
                </p>
              )}
              {availablePillars.map((p) => (
                <label className="flex gap-2 text-xs" key={p.name}>
                  <input
                    type="checkbox"
                    checked={pillars.some((q) => q.name === p.name)}
                    onChange={(e) => {
                      const selected =
                        chosenStyle === data.selectedStyleVersionId
                          ? pillars
                          : [];
                      const next = e.target.checked
                        ? [...selected, p]
                        : selected.filter((q) => q.name !== p.name);
                      setChosenStyle(data.selectedStyleVersionId);
                      setPillars(
                        availablePillars.filter((q) =>
                          next.some(
                            (r) => r.name === q.name && r.weight === q.weight,
                          ),
                        ),
                      );
                    }}
                  />
                  {p.name} · Gewicht {p.weight}
                </label>
              ))}
              {!availablePillars.length && (
                <p className="text-xs">
                  Zuerst ein eigenes Stilprofil auswählen.
                </p>
              )}
            </div>
            <div className="min-w-0">
              <span className="field-label">
                Diese exakten Versionen dem Thema zuordnen (max. 25)
              </span>
              {candidates.map((p) => (
                <label
                  className="flex gap-2 text-xs break-words"
                  key={p.versionId}
                >
                  <input
                    type="checkbox"
                    checked={pool.includes(p.versionId)}
                    onChange={(e) =>
                      setPool(
                        e.target.checked
                          ? [...pool, p.versionId]
                          : pool.filter((id) => id !== p.versionId),
                      )
                    }
                  />
                  <span className="min-w-0 break-all">
                    {p.title} · {p.versionId}
                  </span>
                </label>
              ))}
              {!candidates.length && (
                <p className="text-xs">
                  Keine aktuell lesbaren Versionen im 25-Entwürfe-Ausschnitt.
                </p>
              )}
            </div>
          </fieldset>
          <p className="text-[11px] muted mt-3">
            Alle Vektoren des vollständigen Rahmens müssen bereits vorbereitet
            sein. Cosinusvergleich ist eine deklarierte Ausschlussregel;
            Neuheit, Format und optimale Uhrzeit bleiben unbelegt. DST-Callbacks
            wählen die erste doppelte Uhrzeit und überspringen Lücken;
            mehrdeutige Publishing-Fenster bleiben Shortage. Verpasste
            Callback-Tage werden übersprungen. Vier mal sieben Slots
            überschreiten den Pool von 25 Versionen: fehlendes Material bleibt
            sichtbar.
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <Button
              disabled={!write || busy || revisionConflict}
              onClick={() => submit()}
            >
              {busy
                ? "Serienauftrag wird geprüft"
                : "Endliche Vorschlagsserie aktivieren"}
            </Button>
            <Button
              variant="outline"
              disabled={
                !write || busy || revisionConflict || !data.control?.enabled
              }
              onClick={() => submit(true)}
            >
              Serie deaktivieren
            </Button>
          </div>
          {revisionConflict && (
            <Button
              className="mt-3"
              variant="outline"
              disabled={
                !write ||
                busy ||
                (data.control?.revision ?? 0) === command.current?.revision
              }
              onClick={() => {
                if (!command.current) return;
                command.current = {
                  ...command.current,
                  key: crypto.randomUUID(),
                  revision: data.control?.revision ?? 0,
                  seriesId: data.control?._id,
                };
                setRevisionConflict(false);
                setError("");
                setNotice(
                  `Revision ${data.control?.revision ?? 0} geprüft. Die nächste ausdrückliche Aktivierung beginnt einen neuen Auftrag mit deinen Eingaben.`,
                );
              }}
            >
              Aktuelle Revision {data.control?.revision ?? 0} prüfen und neuen
              Auftrag vorbereiten
            </Button>
          )}
          {error && (
            <p role="alert" className="text-xs mt-3">
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="text-xs mt-3">
              {notice}
            </p>
          )}
        </>
      )}
    </Section>
  );
}
