import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Section } from "@/components/shared";
const utcInput = (n: number) => new Date(n).toISOString().slice(0, 19);
const parseUTC = (value: string) =>
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value)
    ? Date.parse(value + "Z")
    : NaN;
const labels = {
  from: "Rahmen ab (UTC)",
  fitCutoff: "Trainingsgrenze (UTC)",
  holdout1Start: "Block 1 ab (UTC)",
  holdout1End: "Block 1 bis exklusiv (UTC)",
  holdout2Start: "Block 2 ab (UTC)",
  holdout2End: "Block 2 bis exklusiv (UTC)",
};
export function CalibrationReferences() {
  const { state } = useStore();
  const [selected, setSelected] = useState(state.activeAccountId ?? "");
  const account = state.accounts.find(
    (a) => a.id === selected && a.workspaceId === state.activeWorkspaceId,
  );
  return (
    <div className="stack">
      <label>
        Referenz-Account
        <select
          className="w-full rounded border p-2"
          value={account?.id ?? ""}
          onChange={(e) => setSelected(e.target.value)}
        >
          <option value="">Account auswählen</option>
          {state.accounts
            .filter((a) => a.workspaceId === state.activeWorkspaceId)
            .map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} · {a.channel}
              </option>
            ))}
        </select>
      </label>
      {account?.channel === "X" ? (
        <AccountReferences
          key={`${state.activeWorkspaceId}:${account.id}:${state.role}`}
          workspaceId={state.activeWorkspaceId as Id<"workspaces">}
          accountId={account.id as Id<"socialAccounts">}
        />
      ) : (
        <Section title="Lokale Kalibrierungsreferenzen">
          <p>
            {account
              ? "Für dieses Netzwerk ist kein Referenzvertrag verfügbar."
              : "Einen eigenen X-Account auswählen."}
          </p>
        </Section>
      )}
    </div>
  );
}
function AccountReferences({
  workspaceId,
  accountId,
}: {
  workspaceId: Id<"workspaces">;
  accountId: Id<"socialAccounts">;
}) {
  const { state } = useStore(),
    scope = { workspaceId, accountId };
  const data = useQuery(api.performance.calibration.get, scope);
  const consent = useMutation(api.performance.calibration.consent),
    create = useMutation(api.performance.calibration.createSpec),
    build = useMutation(api.performance.calibration.build),
    remove = useMutation(api.performance.calibration.remove);
  const [now, setNow] = useState(Date.now()),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const [failed, setFailed] = useState<(() => Promise<unknown>) | null>(null);
  const [choiceId, setChoiceId] = useState(""),
    [specId, setSpecId] = useState(""),
    [mode, setMode] = useState<"prospective" | "retrospective">("prospective");
  const [dates, setDates] = useState(() => ({
    from: utcInput(Date.now() - 30 * 86400000),
    fitCutoff: utcInput(Date.now() - 2 * 86400000),
    holdout1Start: utcInput(Date.now() + 86400000),
    holdout1End: utcInput(Date.now() + 8 * 86400000),
    holdout2Start: utcInput(Date.now() + 8 * 86400000),
    holdout2End: utcInput(Date.now() + 15 * 86400000),
  }));
  const [asOf, setAsOf] = useState(utcInput(Date.now()));
  const mounted = useRef(false),
    pending = useRef(false);
  const admin = state.role === "Owner" || state.role === "Admin";
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const deadline = data
    ? Math.min(
        ...[
          data.configuration?.expiresAt ?? Infinity,
          ...data.choices.map((c) => c.expiresAt),
          ...data.specs.map((s) => s.expiresAt),
          ...data.snapshots.map((s) => s.row.expiresAt),
        ].filter((expiresAt) => expiresAt > now),
      )
    : Infinity;
  useEffect(() => {
    if (!Number.isFinite(deadline) || deadline <= now) return;
    const timer = setTimeout(
      () => setNow(Date.now()),
      Math.min(2147483647, Math.max(0, deadline - Date.now() + 1)),
    );
    return () => clearTimeout(timer);
  }, [deadline, now]);
  async function run(action: () => Promise<unknown>) {
    if (pending.current || !admin) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
      if (mounted.current) {
        setFailed(null);
        setMessage("Anfrage bestätigt. Aktuelle gespeicherte Ansicht prüfen.");
      }
    } catch (e) {
      if (mounted.current) {
        setFailed(() => action);
        setError(
          String(e).includes("CALIBRATION_READ_CAPACITY")
            ? "Lesekapazität erreicht. Einen engeren Rahmen neu festlegen. Keine vollständige Materialisierung bestätigt."
            : "Anfrage nicht bestätigt. Eingaben bleiben erhalten. Das Ergebnis kann gespeichert sein; ursprüngliche Anfrage ausdrücklich wiederholen.",
        );
      }
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  if (!data)
    return (
      <Section title="Lokale Kalibrierungsreferenzen">
        <p role="status">Referenzen werden geladen …</p>
      </Section>
    );
  const p = data.configuration,
    enabled = data.enabled && !!p && p.expiresAt > now;
  const choices = enabled ? data.choices.filter((c) => c.expiresAt > now) : [],
    specs = enabled ? data.specs.filter((s) => s.expiresAt > now) : [],
    snapshots = enabled
      ? data.snapshots.filter((s) => s.row.expiresAt > now)
      : [];
  const choice = choices.find((c) => c.postAttemptId === choiceId),
    spec = specs.find((s) => s._id === specId);
  const parsed = Object.fromEntries(
    Object.entries(dates).map(([k, v]) => [k, parseUTC(v)]),
  ) as Record<keyof typeof labels, number>;
  const valid =
    Object.values(parsed).every(Number.isSafeInteger) &&
    parsed.from >= 0 &&
    parsed.from < parsed.fitCutoff &&
    parsed.fitCutoff <= parsed.holdout1Start &&
    parsed.holdout1Start < parsed.holdout1End &&
    parsed.holdout1End <= parsed.holdout2Start &&
    parsed.holdout2Start < parsed.holdout2End &&
    parsed.holdout2End - parsed.from <= 366 * 86400000 &&
    parsed.fitCutoff <= Date.now() &&
    (mode === "retrospective" || parsed.holdout1Start > Date.now());
  const writable = admin && enabled && !busy && !failed;
  return (
    <div className="stack">
      <Section
        title="Lokale Kalibrierungsreferenzen"
        description="Gemessene Antwort-Ereignisse je gemessener Impression · einzelne eigene Textposts auf X · 24 Stunden ± 60 Sekunden."
      >
        <p>
          Statische Inhaltsheuristik und gemessener Verlauf bleiben getrennt.
          Die Antwortrate ist keine Wahrscheinlichkeit, redaktionelle Wahrheit
          oder kausale Prognose. Jev wird weder trainiert noch verändert.
        </p>
        <p>
          Vorgeschlagene lokale Klarheit/Diskussion-Gewichtsverschiebungen: −0,1
          bis +0,1 in neun Stufen. Andere Gewichte und Historie 0,5 bleiben
          unverändert. Referenzpläne bleiben unverändert; Kandidaten entstehen
          nur im getrennten Schattenvergleich. Befristete Freigaben stehen
          separat.
        </p>
        <p role="status">
          {enabled
            ? "Separate lokale Lernzweck-Zustimmung bestätigt."
            : "Lokaler Lernzweck ist AUS. Separate bestätigte Verarbeitungsrechte und aktuelle Owner/Admin-Zustimmung erforderlich."}
        </p>
        {!p && (
          <p>
            Konfiguration fehlt. Eine verantwortliche Person muss einen
            unveränderlichen lokalen Zweck mit Belegen für Analyse-Derivate und
            Messwerte, Account-Identität, Ablauf und Aufbewahrung konfigurieren.
            Analytics- oder Providerfreigaben werden nicht übernommen.
          </p>
        )}
        {p && (
          <div className="space-y-2 break-words">
            <p>
              Zweckversion {p.version} · bis{" "}
              {new Date(p.expiresAt).toISOString()} · Aufbewahrung höchstens{" "}
              {p.retentionMs / 86400000} Tage.
            </p>
            {p.expiresAt > now && !p.withdrawn && (
              <>
                <p>{p.explanation}</p>
                <p>Rechtebeleg: {p.rightsEvidence}</p>
              </>
            )}
            <p>
              {p.withdrawn
                ? "Widerrufen. Diese Version kann nicht erneut freigegeben werden."
                : (data.reason ?? "Aktuell nutzbar.")}
            </p>
          </div>
        )}
        {!admin && (
          <p>
            Owner/Admin-Rechte für Zustimmung, Referenzaufbau und Entfernung
            erforderlich.
          </p>
        )}
        {error && <p role="alert">{error}</p>}
        {message && <p role="status">{message}</p>}
        {failed && admin && (
          <div className="flex flex-wrap gap-2">
            <Button
              className="h-auto max-w-full whitespace-normal text-left"
              disabled={busy}
              onClick={() => void run(failed)}
            >
              Ursprüngliche Anfrage wiederholen
            </Button>
            <Button
              className="h-auto max-w-full whitespace-normal text-left"
              variant="outline"
              disabled={busy}
              onClick={() => {
                setFailed(null);
                setError("");
                setMessage(
                  "Aktuelle Ansicht prüfen, dann neue Anfrage ausdrücklich auslösen.",
                );
              }}
            >
              Neue Anfrage vorbereiten
            </Button>
          </div>
        )}
        {p && (
          <div className="flex flex-wrap gap-2">
            <Button
              className="h-auto max-w-full whitespace-normal text-left"
              disabled={
                !admin ||
                busy ||
                !!failed ||
                p.withdrawn ||
                (!enabled && p.expiresAt <= now)
              }
              onClick={() => {
                const input = {
                  ...scope,
                  purposeId: p.id,
                  purposeFingerprint: p.fingerprint,
                  enabled: !enabled,
                  commandKey: crypto.randomUUID(),
                };
                void run(() => consent(input));
              }}
            >
              {enabled
                ? "Lokale Lernzweck-Zustimmung widerrufen"
                : "Diesem lokalen Lernzweck ausdrücklich zustimmen"}
            </Button>
            <Button
              className="h-auto max-w-full whitespace-normal text-left"
              variant="outline"
              disabled={!admin || busy || !!failed}
              onClick={() => {
                const input = { ...scope, purposeId: p.id };
                void run(() => remove(input));
              }}
            >
              Lokale Referenzen entfernen und widerrufen
            </Button>
          </div>
        )}
      </Section>
      <Section
        title="Unveränderlichen Referenzplan festlegen"
        description="Halboffene UTC-Zeiträume [ab, bis). Training verwendet ausschließlich bereits bis zur Trainingsgrenze beobachtete Labels."
      >
        {!choices.length && (
          <p>
            Keine aktuell rechtmäßig lesbare, vollständige native
            24h-Veröffentlichung mit anwendbarer Bewertung vor dem Senden
            verfügbar. Fehlende Messwerte, Null-Zeiger, Threads, Medien,
            unbekannte Modelle oder abgelaufene Belege werden nicht repariert.
          </p>
        )}
        <fieldset disabled={!writable || !choices.length} className="stack">
          <label>
            Native Referenz-Veröffentlichung
            <select
              className="w-full rounded border p-2"
              value={choiceId}
              onChange={(e) => setChoiceId(e.target.value)}
            >
              <option value="">Veröffentlichung auswählen</option>
              {choices.map((c) => (
                <option key={c.postAttemptId} value={c.postAttemptId}>
                  {new Date(c.publishedAt).toISOString()} · Entwurf v
                  {c.versionNumber} · {c.requestedModel} → {c.resolvedModel}
                </option>
              ))}
            </select>
          </label>
          {data.choicesPartial && (
            <p>
              Auswahl aus den neuesten 5 bestätigten Versuchen; ältere
              Veröffentlichungen sind hier nicht vollständig aufgelistet.
            </p>
          )}
          <label>
            Referenzmodus
            <select
              className="w-full rounded border p-2"
              value={mode}
              onChange={(e) => setMode(e.target.value as typeof mode)}
            >
              <option value="prospective">
                Prospektiver Plan · Kandidat noch nicht eingefroren
              </option>
              <option value="retrospective">
                Retrospektiv · dauerhaft nur Diagnose
              </option>
            </select>
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            {Object.entries(labels).map(([key, label]) => (
              <label key={key}>
                {label}
                <Input
                  type="datetime-local"
                  step="1"
                  value={dates[key as keyof typeof labels]}
                  onChange={(e) =>
                    setDates((d) => ({ ...d, [key]: e.target.value }))
                  }
                />
              </label>
            ))}
          </div>
          {!valid && (
            <p role="alert">
              Geordnete UTC-Grenzen, höchstens 366 Tage und bei prospektivem
              Plan zukünftige Kontrollblöcke erforderlich.
            </p>
          )}
          <Button
            className="h-auto max-w-full whitespace-normal text-left"
            disabled={!choice || !valid}
            onClick={() => {
              if (!choice || !p || !valid) return;
              const input = {
                ...scope,
                ...parsed,
                purposeId: p.id,
                commandKey: crypto.randomUUID(),
                mode,
                referencePostAttemptId: choice.postAttemptId,
                referenceAssessmentId: choice.assessmentId,
              };
              void run(() => create(input));
            }}
          >
            Referenzplan unveränderlich speichern
          </Button>
        </fieldset>
      </Section>
      <Section
        title="Native Referenzen materialisieren"
        description="Maximal 200 bestätigte Versuche im expliziten Rahmen. Ein 201. Versuch bedeutet Teilmenge und unbekannte Gesamtzahl."
      >
        <fieldset disabled={!writable || !specs.length} className="stack">
          <label>
            Gespeicherter Referenzplan
            <select
              className="w-full rounded border p-2"
              value={specId}
              onChange={(e) => setSpecId(e.target.value)}
            >
              <option value="">Plan auswählen</option>
              {specs.map((s) => (
                <option key={s._id} value={s._id}>
                  {new Date(s.createdAt).toISOString()} · {s.payload.mode} ·{" "}
                  {s.payload.compatibility.resolvedModel}
                </option>
              ))}
            </select>
          </label>
          <label>
            Wissensstand (UTC)
            <Input
              type="datetime-local"
              step="1"
              value={asOf}
              onChange={(e) => setAsOf(e.target.value)}
            />
          </label>
          <p>
            Der Wissensstand muss nach Plan, Zweck und bestätigter Zustimmung
            liegen. Nach einem neuen Plan ausdrücklich aktualisieren.
          </p>
          <Button
            variant="outline"
            className="h-auto whitespace-normal"
            onClick={() => setAsOf(utcInput(Date.now()))}
          >
            Wissensstand auf aktuelle UTC setzen
          </Button>
          <Button
            className="h-auto max-w-full whitespace-normal text-left"
            disabled={
              !spec ||
              !Number.isSafeInteger(parseUTC(asOf)) ||
              parseUTC(asOf) > Date.now() ||
              parseUTC(asOf) < spec.createdAt
            }
            onClick={() => {
              if (!spec) return;
              const input = {
                ...scope,
                specId: spec._id,
                asOf: parseUTC(asOf),
                commandKey: crypto.randomUUID(),
              };
              void run(() => build(input));
            }}
          >
            Referenzen nach Wissensstand aufbauen
          </Button>
        </fieldset>
        {!specs.length && (
          <p>Noch kein aktuell lesbarer Referenzplan vorhanden.</p>
        )}
        {spec && (
          <details className="break-words">
            <summary>Versionen, Zeitraum und Herkunft</summary>
            <p>
              {spec.payload.prospectiveStatus} · endet{" "}
              {new Date(spec.payload.holdout2End).toISOString()} · ursprüngliche
              Grenze {new Date(spec.expiresAt).toISOString()}
            </p>
            <p>
              {spec.payload.compatibility.questionVersion} ·{" "}
              {spec.payload.compatibility.normalizationVersion} ·{" "}
              {spec.payload.compatibility.formulaVersion} ·{" "}
              {spec.payload.compatibility.metricVersion} ·{" "}
              {spec.payload.compatibility.dialect}
            </p>
            <p>
              Algorithmus {spec.payload.compatibility.algorithmId} · Zielgruppe{" "}
              {spec.payload.compatibility.audienceId} · exakte Versionen, keine
              ähnliche Namensgruppe.
            </p>
          </details>
        )}
      </Section>
      <Section
        title="Referenzdiagnose"
        description="Die neuesten 5 Pläne und nur die neueste Materialisierung werden unter aktueller Quellenprüfung angezeigt. 30 unabhängige Posts / 28 Tage sind eine unvalidierte notwendige technische Vorprüfung. Alle empirischen Mindest-, Segment-, Nutzen-, Drift- und Abdeckungskriterien sind UNGESETZT → INAKTIV."
      >
        {!snapshots.length && (
          <p>Keine aktuell lesbare Referenzdiagnose vorhanden.</p>
        )}
        {snapshots.map(({ row, measurements }) => (
          <div key={row._id} className="space-y-3 border-b py-4 break-words">
            <p>
              Wissensstand {new Date(row.payload.asOf).toISOString()} · lesbar
              bis {new Date(row.expiresAt).toISOString()}
            </p>
            <p>
              n={row.payload.counts.n} · Training {row.payload.counts.train} ·
              Block 1 {row.payload.counts.block1} · Block 2{" "}
              {row.payload.counts.block2}
            </p>
            <p>
              {row.payload.frameComplete
                ? "Rahmen vollständig"
                : "Rahmen teilweise; Gesamtzahl unbekannt"}{" "}
              · geprüft {row.payload.scanned} · Grundgesamtheit{" "}
              {row.payload.populationTotal ??
                `mindestens ${row.payload.populationLowerBound}, unbekannt`}{" "}
              · Zeitspanne {(row.payload.timeSpanMs / 86400000).toFixed(1)}{" "}
              Tage.
            </p>
            <p>
              Technische Vorprüfung{" "}
              {row.payload.engineeringScreen
                ? "erfüllt (unvalidiert)"
                : "nicht erfüllt"}
              . Empirische Politik fehlt. Kein gemessener Kandidatenfehler,
              Stabilitäts- oder Driftgewinn.
            </p>
            <p>Unbekannte Segmente: {row.payload.unknownSegments.join(", ")}</p>
            <details>
              <summary>Messwerte, Herkunft und Ausschlüsse</summary>
              <ul>
                {measurements.map((m) => (
                  <li key={m.postAttemptId}>
                    {m.replies} Antwort-Ereignisse / {m.impressions}{" "}
                    Impressionen = {m.rate.toFixed(5)} · ursprüngliche
                    Inhaltsheuristik {m.staticScore.toFixed(1)} / 100.
                  </li>
                ))}
              </ul>
              {row.payload.refs.map((r) => (
                <p key={r.postAttemptId}>
                  {r.membership} · publiziert{" "}
                  {new Date(r.publishedAt).toISOString()} · beobachtet{" "}
                  {new Date(r.observedAt).toISOString()} · Bewertung{" "}
                  {r.assessmentId} · ursprüngliche Grenze{" "}
                  {new Date(r.originalUntil).toISOString()}
                </p>
              ))}
              {row.payload.exclusions.map((x) => (
                <p key={x.postAttemptId}>Ausgeschlossen: {x.reason}</p>
              ))}
            </details>
          </div>
        ))}
        {data.unavailable.map((x) => (
          <p key={x.id}>Geschützter Nachweis nicht mehr lesbar: {x.reason}.</p>
        ))}
      </Section>
      <OperationalCalibration
        workspaceId={workspaceId}
        accountId={accountId}
        admin={admin}
        owner={state.role === "Owner"}
        writable={writable}
        locked={busy || !!failed}
        specs={specs}
        snapshots={snapshots.map((x) => x.row)}
        run={run}
      />
      <ShadowModels
        workspaceId={workspaceId}
        accountId={accountId}
        admin={admin}
        enabled={enabled}
        writable={writable}
        busy={busy}
        specs={specs}
        snapshots={snapshots.map((x) => x.row)}
        run={run}
      />
    </div>
  );
}

function ShadowModels({
  workspaceId,
  accountId,
  admin,
  enabled,
  writable,
  busy,
  specs,
  snapshots,
  run,
}: {
  workspaceId: Id<"workspaces">;
  accountId: Id<"socialAccounts">;
  admin: boolean;
  enabled: boolean;
  writable: boolean;
  busy: boolean;
  specs: Extract<Doc<"calibrationReferences">, { kind: "spec" }>[];
  snapshots: Extract<Doc<"calibrationReferences">, { kind: "snapshot" }>[];
  run: (action: () => Promise<unknown>) => Promise<void>;
}) {
  const scope = { workspaceId, accountId },
    [selected, setSelected] = useState(""),
    [plan, setPlan] = useState(""),
    [snapshot, setSnapshot] = useState(""),
    [now, setNow] = useState(Date.now());
  const data = useQuery(
    api.performance.models.get,
    admin
      ? {
          ...scope,
          ...(selected
            ? { selectedExperimentId: selected as Id<"calibrationModels"> }
            : {}),
        }
      : "skip",
  );
  const predeclare = useMutation(api.performance.models.predeclare),
    fit = useMutation(api.performance.models.fit),
    compare = useMutation(api.performance.models.compare);
  useEffect(() => {
    if (!data?.proofUntil || data.proofUntil <= now) return;
    const timer = setTimeout(
      () => setNow(Date.now()),
      Math.min(2147483647, Math.max(0, data.proofUntil - Date.now() + 1)),
    );
    return () => clearTimeout(timer);
  }, [data?.proofUntil, now]);
  const visible = enabled && !!data?.proofUntil && data.proofUntil > now,
    e = visible ? data?.experiment : null,
    c = visible ? data?.candidate : null,
    evaluation = visible ? data?.evaluation : null;
  const current = specs.find((s) => s._id === plan),
    chosen = snapshots.find(
      (s) => s._id === snapshot && s.specId === e?.specId,
    );
  return (
    <Section
      title="Kalibrierung im Schattenbetrieb"
      description="Statische Baseline gegen genau einen eingefrorenen lokalen Kandidaten. Dieser Schattennachweis selbst erteilt keine Betriebsfreigabe."
    >
      <div className="stack break-words">
        <p>
          Empirische Politik standardmäßig NULL: dauerhaft keine
          Evidenzqualifikation. Eine verantwortliche Owner/Admin-Person muss vor
          zukünftiger Kontrollsammlung eine vollständige Politik mit Beleg,
          Begründung, unabhängigen Mindestfällen, Nutzen-, Stabilitäts- und
          Driftgrenzen sowie Prüffrist ausdrücklich über die Modellkonfiguration
          vorerklären. Keine Schwellen werden übernommen. Ein bestehender
          NULL-Versuch kann nicht nachträglich aufgewertet werden.
        </p>
        <p>
          Trainingsauswahl: neun feste Klarheit/Diskussion-Verschiebungen;
          kleinster Paarordnungsfehler, bei Gleichstand statische Baseline.
          Antwortrate = Antwort-Ereignisse / Impressionen, keine
          Wahrscheinlichkeit. Paarvergleiche sind keine unabhängigen Fälle.
        </p>
        {!admin ? (
          <p>Owner/Admin-Rechte für Modellnachweise erforderlich.</p>
        ) : !data ? (
          <p role="status">Schattenversuche werden geladen …</p>
        ) : (
          <>
            <fieldset disabled={!writable} className="stack">
              <label>
                Plan für neuen Schattenversuch
                <select
                  className="w-full rounded border p-2"
                  value={plan}
                  onChange={(ev) => setPlan(ev.target.value)}
                >
                  <option value="">Plan auswählen</option>
                  {specs.map((s) => (
                    <option key={s._id} value={s._id}>
                      {new Date(s.createdAt).toISOString()} · {s.payload.mode} ·{" "}
                      {s.payload.compatibility.formulaVersion}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                className="h-auto whitespace-normal"
                disabled={!current}
                onClick={() => {
                  if (!current) return;
                  const input = {
                    ...scope,
                    specId: current._id,
                    policy: null,
                    commandKey: crypto.randomUUID(),
                  };
                  void run(() => predeclare(input));
                }}
              >
                Diagnostischen Schattenversuch mit NULL-Politik vorerklären
              </Button>
            </fieldset>
            <label>
              Gespeicherter Schattenversuch
              <select
                className="w-full rounded border p-2"
                disabled={busy}
                value={data.selectedId ?? ""}
                onChange={(ev) => {
                  setSelected(ev.target.value);
                  setSnapshot("");
                }}
              >
                <option value="">Kein Versuch</option>
                {data.experiments.map((x) => (
                  <option key={x.id} value={x.id}>
                    {new Date(x.createdAt).toISOString()} · {x.mode}
                  </option>
                ))}
              </select>
            </label>
            {(data.reason || (!visible && data.selectedId)) && (
              <p role="status">
                Schattennachweis nicht verfügbar:{" "}
                {data.reason ?? "ursprüngliche Nachweisfrist abgelaufen"}.
              </p>
            )}
            {e && (
              <>
                <p>
                  {e.payload.mode === "prospective"
                    ? "Prospektiver Schattenversuch"
                    : "Retrospektiv · dauerhaft nur Diagnose"}{" "}
                  · Politik{" "}
                  {e.payload.policy
                    ? "explizit vorerklärt; keine empirische Zertifizierung"
                    : "NULL / unkonfiguriert"}{" "}
                  · {e.payload.lossVersion} · vorerklärt{" "}
                  {new Date(e.payload.predeclaredAt).toISOString()}.
                </p>
                <p>
                  Exakte Gruppe: eigener X-Account · einzelner Text · 24h ± 60s
                  · {e.payload.compatibility.questionVersion} ·{" "}
                  {e.payload.compatibility.resolvedModel} ·{" "}
                  {e.payload.compatibility.formulaVersion} ·{" "}
                  {e.payload.compatibility.metricVersion} ·{" "}
                  {e.payload.compatibility.dialect}.
                </p>
                <fieldset disabled={!writable} className="stack">
                  <label>
                    Native Materialisierung für diesen Versuch
                    <select
                      className="w-full rounded border p-2"
                      value={snapshot}
                      onChange={(ev) => setSnapshot(ev.target.value)}
                    >
                      <option value="">Materialisierung auswählen</option>
                      {snapshots
                        .filter((s) => s.specId === e.specId)
                        .map((s) => (
                          <option key={s._id} value={s._id}>
                            {new Date(s.payload.asOf).toISOString()} · Training{" "}
                            {s.payload.counts.train} / Block 1{" "}
                            {s.payload.counts.block1} / Block 2{" "}
                            {s.payload.counts.block2}
                            {s.payload.frameComplete ? "" : " · unvollständig"}
                          </option>
                        ))}
                    </select>
                  </label>
                  <Button
                    className="h-auto whitespace-normal"
                    disabled={!!c || !chosen || !chosen.payload.frameComplete}
                    onClick={() => {
                      if (!chosen) return;
                      const input = {
                        ...scope,
                        experimentId: e._id,
                        snapshotId: chosen._id,
                        commandKey: crypto.randomUUID(),
                      };
                      void run(() => fit(input));
                    }}
                  >
                    Nur Training anpassen und Kandidat unveränderlich einfrieren
                  </Button>
                  <Button
                    variant="outline"
                    className="h-auto whitespace-normal"
                    disabled={!c || !chosen || !chosen.payload.frameComplete}
                    onClick={() => {
                      if (!chosen) return;
                      const input = {
                        ...scope,
                        experimentId: e._id,
                        snapshotId: chosen._id,
                        commandKey: crypto.randomUUID(),
                      };
                      void run(() => compare(input));
                    }}
                  >
                    Eingefrorenen Kandidaten mit Baseline vergleichen
                  </Button>
                </fieldset>
                {c && (
                  <p>
                    Unabhängige Trainingsfälle n={c.payload.n} · Zeitspanne{" "}
                    {(c.payload.spanMs / 86400000).toFixed(2)} Tage ·{" "}
                    {c.payload.baseline.pairs} vergleichbare Paare /{" "}
                    {c.payload.baseline.targetTies} Zielgleichstände ·
                    statischer Fehler{" "}
                    {c.payload.baseline.loss ?? "nicht verfügbar"} · Gewinner t=
                    {c.payload.transfer ??
                      "nicht verfügbar: keine vergleichbaren Paare"}{" "}
                    · eingefroren {new Date(c.payload.frozenAt).toISOString()}.
                    Keine personalisierten Gewichte aktiv.
                  </p>
                )}
                {evaluation && (
                  <>
                    <p>
                      Evidenzqualifikation{" "}
                      {evaluation.payload.evidenceQualified
                        ? "vorbereitende gruppenspezifische Voraussetzungen erfüllt"
                        : "nicht erfüllt"}
                      . Aktivierung AUS. Wissensstand{" "}
                      {new Date(evaluation.payload.asOf).toISOString()} ·
                      Training n={evaluation.payload.trainN}.
                    </p>
                    {[evaluation.payload.block1, evaluation.payload.block2].map(
                      (b, i) => (
                        <div key={i} className="space-y-1">
                          <p>
                            Block {i + 1}: unabhängiges n={b.n} ·{" "}
                            {b.baseline.pairs} vergleichbare Paare /{" "}
                            {b.baseline.targetTies} Zielgleichstände ·
                            statischer Fehler{" "}
                            {b.baseline.loss ?? "nicht verfügbar"} ·
                            Kandidatenfehler{" "}
                            {b.candidate.loss ?? "nicht verfügbar"} ·
                            Verbesserung {b.improvement ?? "nicht verfügbar"}.
                          </p>
                          <p>
                            Drift zu Training: Klarheitsmittel{" "}
                            {b.drift.clarity ?? "nicht verfügbar"},
                            Diskussionsmittel{" "}
                            {b.drift.discussion ?? "nicht verfügbar"},
                            Antwort-Ereignisse/Impressionen-Mittel{" "}
                            {b.drift.replyRate ?? "nicht verfügbar"}. Keine
                            Signifikanzbehauptung.
                          </p>
                        </div>
                      ),
                    )}
                    <p>
                      Notwendige technische Vorprüfung 30 Posts / 28 Tage:{" "}
                      {evaluation.payload.engineeringScreen
                        ? "erfüllt (unvalidiert)"
                        : "nicht erfüllt"}
                      . Kein empirischer Angemessenheitsbeleg.
                    </p>
                    <p>
                      Stabilität: absolute Variation der beiden Verbesserungen{" "}
                      {evaluation.payload.stability ?? "nicht verfügbar"} ·
                      ausgeschlossen{" "}
                      {(100 * evaluation.payload.excludedFraction).toFixed(1)}%
                      · Population{" "}
                      {evaluation.payload.populationTotal ??
                        `unbekannt; mindestens ${evaluation.payload.populationLowerBound}`}{" "}
                      · gescannt {evaluation.payload.scanned}.
                    </p>
                    <p>
                      Inaktivitätsgründe:{" "}
                      {evaluation.payload.reasons.join(", ") ||
                        "keine technischen Gründe; Produktionsfreigabe bleibt separat"}
                      .
                    </p>
                    <p>
                      Unbekannte Segmente:{" "}
                      {evaluation.payload.unknownSegments.join(", ")}.
                    </p>
                  </>
                )}
                <p>
                  Ursprüngliche Nachweisgrenze{" "}
                  {new Date(data.proofUntil!).toISOString()}. Neue Belege
                  verlängern alte Trainingsquellen nicht; 30-Tage-Aufbewahrung
                  kann den Versuch unmöglich machen.
                </p>
              </>
            )}
          </>
        )}
      </div>
    </Section>
  );
}

const monitoringLabels = {
  minBlockN: "Unabhängige Mindestfälle im Kontrollblock",
  minBlockSpanMs: "Mindestspanne im Kontrollblock (ms)",
  maxExcludedFraction: "Maximaler Ausschlussanteil im gesamten Rahmen (0–1)",
  minImprovement: "Minimaler Nutzen im Paarordnungsfehler (0–1)",
  maxClarityDrift: "Maximale Klarheitsdrift (0–1)",
  maxDiscussionDrift: "Maximale Diskussionsdrift (0–1)",
  maxReplyRateDrift: "Maximale Antwortraten-Drift (Ereignisse/Impressionen)",
};

function OperationalCalibration({
  workspaceId,
  accountId,
  admin,
  owner,
  writable,
  locked,
  specs,
  snapshots,
  run,
}: {
  workspaceId: Id<"workspaces">;
  accountId: Id<"socialAccounts">;
  admin: boolean;
  owner: boolean;
  writable: boolean;
  locked: boolean;
  specs: Extract<Doc<"calibrationReferences">, { kind: "spec" }>[];
  snapshots: Extract<Doc<"calibrationReferences">, { kind: "snapshot" }>[];
  run: (action: () => Promise<unknown>) => Promise<void>;
}) {
  const [selected, setSelected] = useState(""),
    [snapshotId, setSnapshotId] = useState(""),
    [now, setNow] = useState(Date.now());
  const [experimentId, setExperimentId] = useState(""),
    [monitoringSpecId, setMonitoringSpecId] = useState(""),
    [numbers, setNumbers] = useState(
      () =>
        Object.fromEntries(
          Object.keys(monitoringLabels).map((k) => [k, ""]),
        ) as Record<keyof typeof monitoringLabels, string>,
    ),
    [reviewUntil, setReviewUntil] = useState(""),
    [finalValidUntil, setFinalValidUntil] = useState(""),
    [evidence, setEvidence] = useState(""),
    [rationale, setRationale] = useState("");
  const model = useQuery(
    api.performance.models.get,
    admin
      ? {
          workspaceId,
          accountId,
          ...(experimentId
            ? { selectedExperimentId: experimentId as Id<"calibrationModels"> }
            : {}),
        }
      : "skip",
  );
  const declare = useMutation(api.performance.models.declareMonitoring);
  const policy = {
    ...(Object.fromEntries(
      Object.entries(numbers).map(([k, v]) => [k, Number(v)]),
    ) as Record<keyof typeof monitoringLabels, number>),
    reviewUntil: parseUTC(reviewUntil),
    finalValidUntil: parseUTC(finalValidUntil),
    evidence,
    rationale,
  };
  const plan = specs.find((s) => s._id === monitoringSpecId),
    qualified =
      model?.evaluation?.payload.evidenceQualified &&
      model.experiment?.payload.mode === "prospective" &&
      !!model.candidate &&
      (model.proofUntil ?? 0) > now;
  const validPolicy =
    Object.values(numbers).every(
      (v) => v.trim() !== "" && Number.isFinite(Number(v)) && Number(v) >= 0,
    ) &&
    Number.isSafeInteger(policy.minBlockN) &&
    policy.minBlockN >= 2 &&
    policy.minBlockN <= 200 &&
    Number.isSafeInteger(policy.minBlockSpanMs) &&
    [
      policy.maxExcludedFraction,
      policy.minImprovement,
      policy.maxClarityDrift,
      policy.maxDiscussionDrift,
    ].every((n) => n <= 1) &&
    Number.isSafeInteger(policy.reviewUntil) &&
    policy.reviewUntil > now &&
    Number.isSafeInteger(policy.finalValidUntil) &&
    evidence.trim().length > 0 &&
    evidence.length <= 2000 &&
    rationale.trim().length > 0 &&
    rationale.length <= 2000 &&
    !!plan &&
    plan.payload.mode === "prospective" &&
    plan.payload.holdout1Start > now &&
    plan._id !== model?.experiment?.specId &&
    plan.purposeId === model?.experiment?.purposeId &&
    policy.finalValidUntil > plan.payload.holdout1End &&
    policy.finalValidUntil <=
      Math.min(
        plan.payload.holdout2Start,
        policy.reviewUntil,
        model?.proofUntil ?? 0,
        plan.expiresAt,
      ) &&
    policy.minBlockSpanMs <=
      plan.payload.holdout1End - plan.payload.holdout1Start;
  const scope = { workspaceId, accountId },
    data = useQuery(
      api.performance.models.control,
      admin
        ? {
            ...scope,
            ...(selected
              ? { selectedDeclarationId: selected as Id<"calibrationModels"> }
              : {}),
          }
        : "skip",
    );
  const check = useMutation(api.performance.models.checkMonitoring),
    activate = useMutation(api.performance.models.activate),
    rollback = useMutation(api.performance.models.rollback);
  const d = data?.declaration,
    p = d?.payload.policy,
    until = Math.min(
      data?.proofUntil ?? Infinity,
      p?.finalValidUntil ?? Infinity,
    );
  const next = Math.min(
    ...[
      until,
      d?.payload.firstEnd ?? Infinity,
      model?.proofUntil ?? Infinity,
    ].filter((t) => t > now),
  );
  useEffect(() => {
    if (!Number.isFinite(next)) return;
    const timer = setTimeout(
      () => setNow(Date.now()),
      Math.min(2147483647, Math.max(0, next - Date.now() + 1)),
    );
    return () => clearTimeout(timer);
  }, [next]);
  const visible = !!d && until > now,
    chosen = snapshots.find(
      (s) => s._id === snapshotId && s.specId === d?.specId,
    ),
    final = !!data?.check || data?.checkFinal,
    ready =
      visible &&
      now >= d.payload.firstEnd &&
      data?.check?.payload.status === "pass";
  return (
    <Section
      title="Befristete lokale Kalibrierungsfreigabe"
      description="Ein gemessener Kontrollblock, befristete Freigabe; kein laufender Driftbeleg."
    >
      <div className="stack break-words">
        <p>
          Nur derselbe eigene X-Account, Einzeltext und exakt gleiche Fragen-,
          Profil-, Modell-, Formel-, Schwellen- und Messversion. Neue
          Bewertungen erhalten eine getrennte Projektion; Originalscore und
          Jev-Antworten bleiben erhalten.
        </p>
        {!admin ? (
          <p>
            Owner/Admin für Nachweise; ausschließlich Owner für Freigabe und
            Rückkehr zur statischen Formel.
          </p>
        ) : !data ? (
          <p role="status">Freigabestatus wird geladen …</p>
        ) : (
          <>
            <p role="status">
              {data.state === "candidate" && visible
                ? "Befristete Kandidatenprojektion freigegeben"
                : "Statische Formel aktiv"}{" "}
              · Revision {data.revision} ·{" "}
              {visible
                ? data.reason
                : (data.reason ?? "Ursprüngliche Frist abgelaufen")}
            </p>
            {!data.declarations.length && (
              <p>
                Betriebspolitik UNGESETZT. Vor zukünftiger Sammlung muss ein
                Owner einen neuen prospektiven Referenzplan an einen
                qualifizierten eingefrorenen Kandidaten und dessen exakten
                Vergleich binden. Mindestzahl, Mindestspanne,
                Gesamtrahmen-Abdeckung, Nutzen, Driftgrenzen, absolute Prüf- und
                Endfrist sowie tatsächliche Belege sind bewusst ohne
                Vorgabewerte.
              </p>
            )}
            <details>
              <summary>Neue Betriebspolitik ausdrücklich vorerklären</summary>
              <fieldset className="stack mt-3" disabled={!owner || !writable}>
                <label>
                  Qualifizierter ursprünglicher Schattenversuch
                  <select
                    className="w-full rounded border p-2"
                    value={model?.selectedId ?? experimentId}
                    onChange={(e) => {
                      setExperimentId(e.target.value);
                      setMonitoringSpecId("");
                    }}
                  >
                    <option value="">Versuch auswählen</option>
                    {model?.experiments.map((e) => (
                      <option key={e.id} value={e.id}>
                        {new Date(e.createdAt).toISOString()} · {e.mode}
                      </option>
                    ))}
                  </select>
                </label>
                {!qualified && (
                  <p>
                    Ein aktuell lesbarer qualifizierter prospektiver Vergleich
                    mit eingefrorenem Kandidaten ist erforderlich. NULL-Politik
                    und rückblickende Diagnose reichen nicht aus.
                  </p>
                )}
                {qualified && (
                  <p>
                    Exakte Bindung: Kandidat {model!.candidate!._id} · Vergleich{" "}
                    {model!.evaluation!._id} · Ursprung bis{" "}
                    {new Date(model!.proofUntil!).toISOString()}.
                  </p>
                )}
                <label>
                  Neuer prospektiver Kontrollplan
                  <select
                    className="w-full rounded border p-2"
                    value={monitoringSpecId}
                    onChange={(e) => setMonitoringSpecId(e.target.value)}
                  >
                    <option value="">Kontrollplan auswählen</option>
                    {specs
                      .filter(
                        (s) =>
                          s.payload.mode === "prospective" &&
                          s._id !== model?.experiment?.specId,
                      )
                      .map((s) => (
                        <option key={s._id} value={s._id}>
                          {new Date(s.createdAt).toISOString()} · Kontrollende{" "}
                          {new Date(s.payload.holdout1End).toISOString()} ·{" "}
                          {s.payload.compatibility.resolvedModel}
                        </option>
                      ))}
                  </select>
                </label>
                <div className="grid gap-4 md:grid-cols-2">
                  {Object.entries(monitoringLabels).map(([key, label]) => (
                    <label key={key}>
                      {label}
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={numbers[key as keyof typeof monitoringLabels]}
                        onChange={(e) =>
                          setNumbers((v) => ({ ...v, [key]: e.target.value }))
                        }
                      />
                    </label>
                  ))}
                </div>
                <label>
                  Betriebspolitik prüfen bis (UTC)
                  <Input
                    type="datetime-local"
                    step="1"
                    value={reviewUntil}
                    onChange={(e) => setReviewUntil(e.target.value)}
                  />
                </label>
                <label>
                  Absolute Betriebs-Endfrist (UTC)
                  <Input
                    type="datetime-local"
                    step="1"
                    value={finalValidUntil}
                    onChange={(e) => setFinalValidUntil(e.target.value)}
                  />
                </label>
                <label>
                  Tatsächlicher Betriebspolitik-Beleg
                  <Input
                    maxLength={2000}
                    value={evidence}
                    onChange={(e) => setEvidence(e.target.value)}
                  />
                </label>
                <label>
                  Begründung der erklärten Betriebspolitik
                  <Input
                    maxLength={2000}
                    value={rationale}
                    onChange={(e) => setRationale(e.target.value)}
                  />
                </label>
                <p>
                  Eine Deklaration pro Kandidat, ein abschließender
                  Kontrollbeleg – auch nach Rechteverlust oder
                  Wiederherstellung. Alle Zahlen bewusst leer. Endfrist nach dem
                  gemessenen Kontrollende und spätestens beim ungenutzten
                  zweiten Blockbeginn sowie der frühesten ursprünglichen
                  Nachweisfrist. Die Serverprüfung bindet exakte
                  Versionsfingerprints.
                </p>
                <Button
                  className="h-auto whitespace-normal"
                  disabled={!qualified || !validPolicy}
                  onClick={() => {
                    if (
                      !model?.candidate ||
                      !model.evaluation ||
                      !plan ||
                      !validPolicy
                    )
                      return;
                    const input = {
                      workspaceId,
                      accountId,
                      candidateId: model.candidate._id,
                      evaluationId: model.evaluation._id,
                      monitoringSpecId: plan._id,
                      policy,
                      commandKey: crypto.randomUUID(),
                    };
                    void run(() => declare(input));
                  }}
                >
                  Betriebspolitik und Kontrollplan unveränderlich binden
                </Button>
              </fieldset>
            </details>
            <label>
              Gespeicherte Betriebsdeklaration
              <select
                className="w-full rounded border p-2"
                disabled={locked}
                value={d?._id ?? selected}
                onChange={(e) => {
                  setSelected(e.target.value);
                  setSnapshotId("");
                }}
              >
                <option value="">Keine Deklaration</option>
                {data.declarations.map((x) => (
                  <option key={x.id} value={x.id}>
                    {new Date(x.createdAt).toISOString()} · Kontrollende{" "}
                    {new Date(x.firstEnd).toISOString()} · Freigabe bis{" "}
                    {new Date(x.finalValidUntil).toISOString()}
                  </option>
                ))}
              </select>
            </label>
            {visible && (
              <>
                <p>
                  Kontrollende {new Date(d.payload.firstEnd).toISOString()} ·
                  absolute Endfrist {new Date(p!.finalValidUntil).toISOString()}{" "}
                  · früheste Nachweisfrist {new Date(until).toISOString()}.
                  Spätestens dann automatisch statisch; Wiederholen oder
                  erneutes Freigeben verlängert keine Frist.
                </p>
                <p>
                  Kontrollstatus:{" "}
                  {data.check?.payload.status ??
                    (data.checkFinal
                      ? "geschützter endgültiger Nachweis nicht mehr lesbar"
                      : "noch kein abschließender Nachweis")}
                  . Ein reifes unbekanntes oder fehlgeschlagenes Ergebnis bleibt
                  endgültig.
                </p>
                <details>
                  <summary>Exakte Bindung und erklärte Betriebspolitik</summary>
                  <p>
                    Deklaration {d._id} · Kandidat {d.candidateId} · Vergleich{" "}
                    {d.payload.evaluationId} · Referenzplan {d.specId} ·
                    Kontrollbeleg {data.check?._id ?? "fehlt"}.
                  </p>
                  <p>
                    {d.payload.compatibility.questionVersion} ·{" "}
                    {d.payload.compatibility.resolvedModel} ·{" "}
                    {d.payload.compatibility.metricVersion} ·{" "}
                    {d.payload.compatibility.formulaVersion} ·{" "}
                    {d.payload.compatibility.thresholdVersion}.
                  </p>
                  <p>
                    n ≥ {p!.minBlockN} · Spanne ≥ {p!.minBlockSpanMs} ms ·
                    Ausschlüsse im gesamten erklärten Rahmen ≤{" "}
                    {p!.maxExcludedFraction} · Nutzen ≥ {p!.minImprovement} ·
                    Drift Klarheit/Diskussion/Antwortrate ≤ {p!.maxClarityDrift}
                    /{p!.maxDiscussionDrift}/{p!.maxReplyRateDrift}.
                  </p>
                  <p>
                    {p!.evidence} · {p!.rationale}
                  </p>
                </details>
                <label>
                  Native Kontrollmaterialisierung
                  <select
                    className="w-full rounded border p-2"
                    disabled={!writable || final}
                    value={snapshotId}
                    onChange={(e) => setSnapshotId(e.target.value)}
                  >
                    <option value="">Materialisierung auswählen</option>
                    {snapshots
                      .filter((s) => s.specId === d.specId)
                      .map((s) => (
                        <option key={s._id} value={s._id}>
                          {new Date(s.payload.asOf).toISOString()} ·
                          Kontrollblock n={s.payload.counts.block1} ·{" "}
                          {s.payload.frameComplete
                            ? "vollständig"
                            : "unvollständig"}
                        </option>
                      ))}
                  </select>
                </label>
                <Button
                  className="h-auto whitespace-normal"
                  disabled={
                    !writable ||
                    final ||
                    !chosen ||
                    now < d.payload.firstEnd ||
                    chosen.payload.asOf < d.payload.firstEnd
                  }
                  onClick={() => {
                    if (!chosen) return;
                    const input = {
                      ...scope,
                      declarationId: d._id,
                      snapshotId: chosen._id,
                      block: 1 as const,
                      commandKey: crypto.randomUUID(),
                    };
                    void run(() => check(input));
                  }}
                >
                  Reifen Kontrollblock abschließend prüfen
                </Button>
                <Button
                  className="h-auto whitespace-normal"
                  disabled={!owner || !writable || !ready}
                  onClick={() => {
                    if (!data.check) return;
                    const input = {
                      ...scope,
                      evaluationId: d.payload.evaluationId,
                      declarationId: d._id,
                      checkId: data.check._id,
                      expectedRevision: data.revision,
                      commandKey: crypto.randomUUID(),
                    };
                    void run(() => activate(input));
                  }}
                >
                  Exakten Kandidaten bis zur Endfrist freigeben
                </Button>
              </>
            )}
            <p>
              Rückkehr: dispatch-score-v1 mit ursprünglichen Gewichten und
              jev-confidence-startup-v1. Keine Schwellenanpassung.
            </p>
            <Button
              variant="outline"
              className="h-auto whitespace-normal"
              disabled={!owner || locked}
              onClick={() => {
                const input = {
                  ...scope,
                  expectedRevision: data.revision,
                  commandKey: crypto.randomUUID(),
                };
                void run(() => rollback(input));
              }}
            >
              Zur ursprünglichen statischen Formel zurückkehren
            </Button>
          </>
        )}
      </div>
    </Section>
  );
}
