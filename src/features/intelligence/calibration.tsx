import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
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
          unverändert. Kein Kandidat angepasst oder eingefroren; keine
          Aktivierung.
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
    </div>
  );
}
