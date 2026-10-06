import { CalibrationReferences } from "@/features/intelligence/calibration";
import { IntelligenceProfiles } from "@/features/intelligence/profiles";
import { demoMode } from "@/lib/auth-client";
import { useState } from "react";
import { Activity, ArrowRight, Check, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { DemoNote, PageHeader, Section, Status } from "@/components/shared";
import { useStore, useWorkspaceLocalState } from "@/lib/store";
import { approved, uid } from "@/lib/model";
import { Field } from "./Settings";
import { toast } from "sonner";

type HealthEvent = {
  id: string;
  name: string;
  source: string;
  status: "healthy" | "failed" | "uncertain" | "retrying";
  correlation: string;
  detail: string;
  retries: number;
  reconciled: boolean;
};
const eventSeed: HealthEvent[] = [
  {
    id: "evt-1",
    name: "GitHub · Release v0.8",
    source: "Repository-Monitor",
    status: "healthy",
    correlation: "corr-demo-gh-080",
    detail:
      "Demo-Ereignis normalisiert. Eine Idee wurde dedupliziert; kein privater Kontext verarbeitet.",
    retries: 0,
    reconciled: false,
  },
  {
    id: "evt-2",
    name: "RSS · Produktentwicklung",
    source: "Öffentliche Quelle",
    status: "failed",
    correlation: "corr-demo-rss-042",
    detail:
      "Beispiel: Quelle nicht erreichbar (HTTP 503). Wiederholung ist nur eine lokale Simulation.",
    retries: 0,
    reconciled: false,
  },
  {
    id: "evt-3",
    name: "LinkedIn · Veröffentlichungsabgleich",
    source: "Publisher",
    status: "uncertain",
    correlation: "corr-demo-li-017",
    detail:
      "Beispiel: Timeout nach Übergabe. Vor einer Wiederholung muss das Ergebnis abgeglichen werden, um Duplikate zu vermeiden.",
    retries: 0,
    reconciled: false,
  },
];
const label = {
  healthy: "In Ordnung",
  failed: "Fehlgeschlagen",
  uncertain: "Abgleich nötig",
  retrying: "Wiederholung läuft",
};
export function OperationsPage() {
  return demoMode ? <DemoOperationsPage /> : <RealOperationsPage />;
}
function RealOperationsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Unter der Oberfläche"
        title="Betrieb & Qualität"
        description="Gespeicherte Profile und nachvollziehbare Referenzen. Lokale Kalibrierung standardmäßig aus."
        actions={<Status>Gespeicherte Nachweise</Status>}
      />
      <Tabs defaultValue="calibration">
        <TabsList className="h-auto flex-wrap justify-start mb-6">
          <TabsTrigger value="health">Systemzustand</TabsTrigger>
          <TabsTrigger value="pilot">Pilot-Auswertung</TabsTrigger>
          <TabsTrigger value="calibration">Kalibrierungsreferenzen</TabsTrigger>
          <TabsTrigger value="algorithm">Algorithmusprofile</TabsTrigger>
        </TabsList>
        <TabsContent value="health">
          <Section title="Systemzustand">
            <p>Echte Systemzustandsprüfung noch nicht verfügbar (TASK-31).</p>
          </Section>
        </TabsContent>
        <TabsContent value="pilot">
          <Section title="Pilot-Auswertung">
            <p>Echte Pilot-Auswertung noch nicht verfügbar (TASK-35).</p>
          </Section>
        </TabsContent>
        <TabsContent value="calibration">
          <CalibrationReferences />
        </TabsContent>
        <TabsContent value="algorithm">
          <IntelligenceProfiles />
        </TabsContent>
      </Tabs>
    </>
  );
}
function DemoOperationsPage() {
  const { state } = useStore();
  const admin = state.role === "Owner" || state.role === "Admin";
  const [tab, setTab] = useState("health");
  return (
    <>
      <PageHeader
        eyebrow="Unter der Oberfläche"
        title="Betrieb & Qualität"
        description="Verstehen, was passiert. Erst prüfen, dann etwas verändern."
        actions={
          <Status>
            <Activity size={12} />
            {!demoMode && tab === "algorithm"
              ? "Gespeicherte Profile"
              : "Lokale Demo"}
          </Status>
        }
      />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-auto flex-wrap justify-start mb-6">
          <TabsTrigger value="health">Systemzustand</TabsTrigger>
          <TabsTrigger value="pilot">Pilot-Auswertung</TabsTrigger>
          <TabsTrigger value="calibration">Shadow-Kalibrierung</TabsTrigger>
          <TabsTrigger value="algorithm">Algorithmusprofile</TabsTrigger>
        </TabsList>
        <TabsContent value="health">
          <HealthPanel admin={admin} />
        </TabsContent>
        <TabsContent value="pilot">
          <PilotPanel />
        </TabsContent>
        <TabsContent value="calibration">
          <CalibrationPanel admin={admin} />
        </TabsContent>
        <TabsContent value="algorithm">
          {demoMode ? (
            <AlgorithmPanel admin={admin} />
          ) : (
            <IntelligenceProfiles />
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}
function HealthPanel({ admin }: { admin: boolean }) {
  const [events, setEvents] = useWorkspaceLocalState<HealthEvent[]>(
    "health-events",
    eventSeed,
  );
  const [selected, setSelected] = useState("evt-2");
  const event = events.find((e) => e.id === selected);
  const [filter, setFilter] = useState("all");
  const retry = (id: string) => {
    if (!admin) return;
    const e = events.find((e) => e.id === id);
    if (!e || e.status !== "failed") return;
    setEvents((es) =>
      es.map((e) =>
        e.id === id ? { ...e, status: "retrying", retries: e.retries + 1 } : e,
      ),
    );
    setTimeout(
      () =>
        setEvents((es) =>
          es.map((e) =>
            e.id === id
              ? {
                  ...e,
                  status: "healthy",
                  detail:
                    "Lokale Demo-Wiederholung abgeschlossen. Kein Remote-Ereignis oder Beitrag ausgeführt.",
                }
              : e,
          ),
        ),
      650,
    );
  };
  return (
    <div className="stack">
      <div className="flex flex-wrap gap-4 border-y py-6">
        <div className="flex-1 min-w-36">
          <span className="eyebrow">Gesunde Ereignisse</span>
          <p className="text-3xl font-semibold mt-2 mb-0">
            {events.filter((e) => e.status === "healthy").length}
            <span className="text-sm muted font-normal">
              {" "}
              / {events.length}
            </span>
          </p>
        </div>
        <div className="flex-1 min-w-36">
          <span className="eyebrow">Brauchen Aufmerksamkeit</span>
          <p className="text-3xl font-semibold mt-2 mb-0 text-primary">
            {events.filter((e) => e.status !== "healthy").length}
          </p>
        </div>
        <div className="flex-1 min-w-36">
          <span className="eyebrow">Datengrundlage</span>
          <p className="text-sm font-semibold mt-3 mb-0">
            Simulierte Ereignisse
          </p>
          <p className="muted text-xs mt-1 mb-0">Kein Live-Monitoring</p>
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Section
          title="Ereignisprotokoll"
          actions={
            <select
              aria-label="Ereignisse filtern"
              className="native-select w-auto"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">Alle</option>
              <option value="attention">Aufmerksamkeit</option>
              <option value="healthy">In Ordnung</option>
            </select>
          }
        >
          <div className="divide-y">
            {events
              .filter(
                (e) =>
                  filter === "all" ||
                  (filter === "attention"
                    ? e.status !== "healthy"
                    : e.status === "healthy"),
              )
              .map((e) => (
                <button
                  key={e.id}
                  className={`w-full text-left py-5 px-2 rounded-md flex gap-3 items-center justify-between ${selected === e.id ? "bg-secondary" : ""}`}
                  onClick={() => setSelected(e.id)}
                >
                  <span>
                    <span className="font-semibold block mb-1">{e.name}</span>
                    <span className="text-xs muted">
                      {e.source} · {e.correlation}
                    </span>
                  </span>
                  <Status
                    tone={
                      e.status === "healthy"
                        ? "green"
                        : e.status === "failed"
                          ? "red"
                          : "orange"
                    }
                  >
                    {label[e.status]}
                  </Status>
                </button>
              ))}
          </div>
        </Section>
        {event && (
          <Section title="Ereignisdetails">
            <Status tone={event.status === "healthy" ? "green" : "orange"}>
              {label[event.status]}
            </Status>
            <h3 className="mt-5">{event.name}</h3>
            <p className="muted text-sm leading-relaxed">{event.detail}</p>
            <dl className="space-y-3 text-xs">
              <div>
                <dt className="muted">Korrelations-ID</dt>
                <dd className="ml-0 mt-1 break-all">{event.correlation}</dd>
              </div>
              <div>
                <dt className="muted">Wiederholungen</dt>
                <dd className="ml-0 mt-1">{event.retries}</dd>
              </div>
              <div>
                <dt className="muted">Abgleich</dt>
                <dd className="ml-0 mt-1">
                  {event.reconciled
                    ? "Lokal abgeschlossen"
                    : "Noch nicht durchgeführt"}
                </dd>
              </div>
            </dl>
            <div className="flex flex-wrap gap-2 mt-5">
              <Button
                size="sm"
                variant="outline"
                disabled={!admin || event.status !== "failed"}
                onClick={() => retry(event.id)}
              >
                <RefreshCw size={14} />
                Demo-Wiederholung
              </Button>
              <Button
                size="sm"
                disabled={!admin || event.status !== "uncertain"}
                onClick={() => {
                  if (!admin) return;
                  setEvents((es) =>
                    es.map((e) =>
                      e.id === event.id
                        ? {
                            ...e,
                            status: "healthy",
                            reconciled: true,
                            detail:
                              "Demo-Abgleich: Beispiel-Remote-Beitrag gefunden. Kein erneutes Senden. Produktionsstatus im Kalender bleibt unverändert.",
                          }
                        : e,
                    ),
                  );
                }}
              >
                <Check size={14} />
                Abgleich simulieren
              </Button>
            </div>
            <p className="muted text-xs leading-relaxed mt-4 mb-0">
              Unklare Veröffentlichungen dürfen erst nach dem Abgleich erneut
              gesendet werden. Dieser Betriebssimulator ändert keine geplanten
              oder veröffentlichten Beiträge.
            </p>
          </Section>
        )}
      </div>
      <DemoNote>
        Health-Status und Wiederholungen dienen der Bedienvorschau. Tatsächliche
        Veröffentlichungszustände findest du im Kalender.
      </DemoNote>
    </div>
  );
}
function PilotPanel() {
  const { state } = useStore();
  const [effort, setEffort] = useWorkspaceLocalState("pilot-effort", {
    manualMinutes: 25,
    actualMinutes: 10,
    totalCost: 2.4,
  });
  const pilotEditable = state.role === "Owner" || state.role === "Admin";
  const drafts = state.drafts.filter(
    (d) => d.workspaceId === state.activeWorkspaceId,
  );
  const schedules = state.schedules.filter(
    (s) => s.workspaceId === state.activeWorkspaceId,
  );
  const approvalRate = drafts.length
    ? Math.round((drafts.filter(approved).length / drafts.length) * 100)
    : 0;
  return (
    <div className="stack">
      <Section
        title="Was der Pilot zeigt"
        description="Die folgenden Werte werden aus deinen lokalen Workspace-Inhalten berechnet."
      >
        <div className="grid gap-7 sm:grid-cols-3">
          <div>
            <span className="eyebrow">Entwürfe</span>
            <p className="text-4xl font-semibold mt-3 mb-2">{drafts.length}</p>
            <p className="muted text-xs mb-0">Alle gespeicherten Versionen</p>
          </div>
          <div>
            <span className="eyebrow">Aktuell freigegeben</span>
            <p className="text-4xl font-semibold mt-3 mb-2">{approvalRate} %</p>
            <Progress
              aria-label="Anteil freigegebener Pilot-Inhalte"
              value={approvalRate}
            />
          </div>
          <div>
            <span className="eyebrow">Aufmerksamkeit im Kalender</span>
            <p className="text-4xl font-semibold mt-3 mb-2">
              {
                schedules.filter((s) =>
                  ["failed", "uncertain", "partial"].includes(s.status),
                ).length
              }
            </p>
            <p className="muted text-xs mb-0">Fehler · unklar · teilweise</p>
          </div>
        </div>
      </Section>
      <Section
        title="Aufwand & Nutzen protokollieren"
        description="Manuelle Pilotannahmen. Keine automatisch gemessene Zeit oder Kosten."
      >
        <div className="form-grid">
          <Field label="Ohne Dispatch: Minuten pro Entwurf">
            <Input
              type="number"
              min="0"
              value={effort.manualMinutes}
              disabled={!pilotEditable}
              onChange={(e) =>
                setEffort({
                  ...effort,
                  manualMinutes: Math.max(0, Number(e.target.value)),
                })
              }
            />
          </Field>
          <Field label="Tatsächlicher Editieraufwand: Minuten pro Entwurf">
            <Input
              type="number"
              min="0"
              value={effort.actualMinutes}
              disabled={!pilotEditable}
              onChange={(e) =>
                setEffort({
                  ...effort,
                  actualMinutes: Math.max(0, Number(e.target.value)),
                })
              }
            />
          </Field>
          <Field label="Gesamtkosten des Pilots (€)">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={effort.totalCost}
              disabled={!pilotEditable}
              onChange={(e) =>
                setEffort({
                  ...effort,
                  totalCost: Math.max(0, Number(e.target.value)),
                })
              }
            />
          </Field>
        </div>
        <div className="grid sm:grid-cols-2 gap-5 border-t mt-5 pt-5">
          <div>
            <span className="eyebrow">Geschätzte Ersparnis</span>
            <p className="mt-2 mb-0 font-semibold">
              {effort.manualMinutes - effort.actualMinutes} Minuten / Entwurf
            </p>
          </div>
          <div>
            <span className="eyebrow">Kosten je akzeptiertem Entwurf</span>
            <p className="mt-2 mb-0 font-semibold">
              {drafts.filter(approved).length
                ? (
                    effort.totalCost / drafts.filter(approved).length
                  ).toLocaleString("de-DE", {
                    style: "currency",
                    currency: "EUR",
                  })
                : "Noch kein akzeptierter Entwurf"}
            </p>
          </div>
        </div>
      </Section>
      <Section title="Erfolg braucht mehr als einen Score">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Pilot-Kriterium</th>
                <th>Lokale Beobachtung</th>
                <th>Aussagekraft</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Veröffentlichung abgeschlossen</td>
                <td>
                  {schedules.filter((s) => s.status === "published").length}{" "}
                  Beispiele
                </td>
                <td className="muted text-xs">
                  Demo, keine bestätigten Remote-Beiträge
                </td>
              </tr>
              <tr>
                <td>Review-Feedback</td>
                <td>
                  {drafts.reduce((n, d) => n + d.comments.length, 0)} Kommentare
                </td>
                <td className="muted text-xs">
                  Aus lokal gespeicherten Kommentaren
                </td>
              </tr>
              <tr>
                <td>Freigabe aktueller Version</td>
                <td>
                  {drafts.filter(approved).length} / {drafts.length}
                </td>
                <td className="muted text-xs">
                  An Version und Account gebunden
                </td>
              </tr>
              <tr>
                <td>Reichweite / Conversions</td>
                <td>Keine Daten</td>
                <td className="muted text-xs">
                  Ohne Live-Analytics keine Messung
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>
      <DemoNote>
        Keine künstlichen Reichweiten- oder Umsatzversprechen. Ein guter
        Demo-Score belegt keinen Erfolg auf einer Social-Plattform.
      </DemoNote>
    </div>
  );
}
function CalibrationPanel({ admin }: { admin: boolean }) {
  const [calibration, setCalibration] = useWorkspaceLocalState("calibration", {
    active: "v1.2",
    baseline: "v1.2",
    candidate: "v1.3",
    evaluated: false,
    passed: false,
    previous: "",
    scenario: "stabil",
    sample: 40,
  });
  const [running, setRunning] = useState(false);
  const [log, setLog] = useWorkspaceLocalState<string[]>("calibration-log", []);
  const evaluate = () => {
    if (!admin) return;
    setRunning(true);
    setTimeout(() => {
      const passed =
        calibration.scenario === "stabil" && calibration.sample >= 30;
      setCalibration((c) => ({ ...c, evaluated: true, passed }));
      setLog((l) => [
        `Demo-Auswertung ${calibration.candidate}: ${calibration.sample} Beispiele, ${passed ? "Grenzwerte erfüllt" : "nicht aktivierbar"}.`,
        ...l,
      ]);
      setRunning(false);
    }, 700);
  };
  return (
    <div className="stack">
      <Section
        title="Erst im Schatten testen"
        description="Vergleiche einen Kandidaten mit der Baseline, bevor du eine Demo-Version aktivierst."
        actions={<Status tone="green">Aktiv {calibration.active}</Status>}
      >
        <div className="form-grid">
          <Field label="Baseline">
            <Input readOnly value={calibration.baseline} />
          </Field>
          <Field label="Kandidat">
            <Input
              value={calibration.candidate}
              disabled={!admin || running}
              onChange={(e) =>
                setCalibration({
                  ...calibration,
                  candidate: e.target.value,
                  evaluated: false,
                })
              }
            />
          </Field>
          <Field label="Stichprobengröße">
            <Input
              type="number"
              min="1"
              max="1000"
              value={calibration.sample}
              disabled={!admin || running}
              onChange={(e) =>
                setCalibration({
                  ...calibration,
                  sample: Math.max(1, Math.min(1000, Number(e.target.value))),
                  evaluated: false,
                })
              }
            />
          </Field>
          <Field label="Demo-Szenario">
            <select
              className="native-select"
              value={calibration.scenario}
              disabled={!admin || running}
              onChange={(e) =>
                setCalibration({
                  ...calibration,
                  scenario: e.target.value,
                  evaluated: false,
                })
              }
            >
              <option value="stabil">Stabile Verbesserung</option>
              <option value="drift">Inhaltlicher Drift</option>
              <option value="error">Erhöhte Fehlerrate</option>
            </select>
          </Field>
        </div>
        <div className="flex flex-wrap gap-2 mt-5">
          <Button
            disabled={!admin || running || !calibration.candidate.trim()}
            onClick={evaluate}
          >
            <RefreshCw size={15} />
            {running ? "Beispiele prüfen…" : "Shadow-Auswertung simulieren"}
          </Button>
          <Button
            variant="outline"
            disabled={
              !admin ||
              !calibration.evaluated ||
              !calibration.passed ||
              calibration.active === calibration.candidate ||
              running
            }
            onClick={() => {
              if (!admin || !calibration.passed) return;
              setCalibration((c) => ({
                ...c,
                previous: c.active,
                active: c.candidate,
                baseline: c.candidate,
              }));
              setLog((l) => [
                `Demo-Version ${calibration.candidate} aktiviert.`,
                ...l,
              ]);
            }}
          >
            Kandidat aktivieren
          </Button>
          <Button
            variant="ghost"
            disabled={!admin || !calibration.previous || running}
            onClick={() => {
              setLog((l) => [`Rollback auf ${calibration.previous}.`, ...l]);
              setCalibration((c) => ({
                ...c,
                active: c.previous,
                baseline: c.previous,
                previous: "",
                evaluated: false,
              }));
            }}
          >
            Zurückrollen
          </Button>
        </div>
        {running && (
          <Progress
            aria-label="Simulierter Kalibrierungslauf"
            value={55}
            className="mt-5"
          />
        )}
      </Section>
      {calibration.evaluated && (
        <Section
          title="Vergleichsergebnis"
          actions={
            <Status tone={calibration.passed ? "green" : "red"}>
              {calibration.passed
                ? "Demo-Grenzwerte erfüllt"
                : "Aktivierung gesperrt"}
            </Status>
          }
        >
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Prüfung</th>
                  <th>Baseline</th>
                  <th>Kandidat</th>
                  <th>Grenzwert</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Qualität im Beispielsatz</td>
                  <td>72 / 100</td>
                  <td>{calibration.scenario === "stabil" ? 77 : 68} / 100</td>
                  <td>Keine Verschlechterung</td>
                </tr>
                <tr>
                  <td>Inhaltlicher Drift</td>
                  <td>2 %</td>
                  <td>{calibration.scenario === "drift" ? 18 : 3} %</td>
                  <td>≤ 5 %</td>
                </tr>
                <tr>
                  <td>Fehlerrate</td>
                  <td>1 %</td>
                  <td>{calibration.scenario === "error" ? 9 : 1} %</td>
                  <td>≤ 2 %</td>
                </tr>
                <tr>
                  <td>Stabilität / Stichprobe</td>
                  <td>40 Beispiele</td>
                  <td>{calibration.sample} Beispiele</td>
                  <td>Mindestens 30</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="muted text-xs mt-4 mb-0">
            Fest definierte Beispielwerte zur Vorschau des Prüfablaufs. Keine
            KI-Aufrufe und keine statistische Kalibrierung.
          </p>
        </Section>
      )}
      <Section title="Änderungsprotokoll">
        {log.length ? (
          log.map((entry, i) => (
            <p className="text-sm border-b pb-3" key={i}>
              {entry}
            </p>
          ))
        ) : (
          <p className="muted text-sm mb-0">
            Noch keine Auswertung oder Aktivierung.
          </p>
        )}
      </Section>
    </div>
  );
}
function AlgorithmPanel({ admin }: { admin: boolean }) {
  const [profile, setProfile] = useWorkspaceLocalState("algorithm-profile", {
    active: "Editorial v1",
    candidate: "Editorial v2",
    previous: "",
    evaluated: false,
    discarded: false,
    activatedAt: "",
    freshness: 30,
    relevance: 50,
    voice: 20,
  });
  const [candidateWeights, setCandidateWeights] = useWorkspaceLocalState(
    "algorithm-candidate-weights",
    { freshness: 20, relevance: 50, voice: 30 },
  );
  const [log, setLog] = useWorkspaceLocalState<string[]>("algorithm-log", []);
  const [busy, setBusy] = useState(false);
  const [sourceChange, setSourceChange] = useWorkspaceLocalState(
    "algorithm-source-change",
    {
      source: "Öffentliche Plattform-Richtlinie · Beispielquelle",
      before:
        "Frische Inhalte werden stärker priorisiert als markentreue Formulierungen.",
      after: "Relevanz und eigene Stimme zählen stärker als reine Aktualität.",
      interpretation:
        "Mehr Gewicht auf Markenstimme, Aktualität behutsam reduzieren.",
      rule: "Gewicht Eigene Stimme: 20 → 30; Aktualität: 30 → 20.",
      reviewed: false,
    },
  );
  const total =
    candidateWeights.freshness +
    candidateWeights.relevance +
    candidateWeights.voice;
  return (
    <div className="stack">
      <Section
        title="Quellenänderung prüfen"
        description="Mock-Quellenänderung. Kein Abruf einer tatsächlichen Plattform-Richtlinie."
      >
        <p className="text-xs font-semibold muted">{sourceChange.source}</p>
        <div className="form-grid">
          <div>
            <span className="field-label">Vorher</span>
            <p className="bg-background p-4 rounded-md text-sm leading-relaxed">
              {sourceChange.before}
            </p>
          </div>
          <Field label="Nachher · Beispieltext">
            <Input
              value={sourceChange.after}
              disabled={!admin}
              onChange={(e) => {
                setSourceChange({
                  ...sourceChange,
                  after: e.target.value,
                  reviewed: false,
                });
                setProfile((p) => ({ ...p, evaluated: false }));
              }}
            />
          </Field>
          <Field label="Interpretation">
            <Input
              value={sourceChange.interpretation}
              disabled={!admin}
              onChange={(e) => {
                setSourceChange({
                  ...sourceChange,
                  interpretation: e.target.value,
                  reviewed: false,
                });
                setProfile((p) => ({ ...p, evaluated: false }));
              }}
            />
          </Field>
          <Field label="Betroffene Regel">
            <Input
              value={sourceChange.rule}
              disabled={!admin}
              onChange={(e) => {
                setSourceChange({
                  ...sourceChange,
                  rule: e.target.value,
                  reviewed: false,
                });
                setProfile((p) => ({ ...p, evaluated: false }));
              }}
            />
          </Field>
        </div>
        <Button
          className="mt-4"
          variant="outline"
          disabled={
            !admin ||
            sourceChange.reviewed ||
            !sourceChange.after.trim() ||
            !sourceChange.interpretation.trim() ||
            !sourceChange.rule.trim()
          }
          onClick={() => {
            setSourceChange({ ...sourceChange, reviewed: true });
            setLog((l) => [
              "Quellenänderung, Interpretation und betroffene Regel manuell geprüft.",
              ...l,
            ]);
          }}
        >
          {sourceChange.reviewed
            ? "Quellenänderung geprüft"
            : "Interpretation & Regel bestätigen"}
        </Button>
      </Section>
      <Section
        title="Algorithmusprofile"
        description="Nachvollziehbare Gewichtungen für lokale Vorschläge. Keine Empfehlung eines externen Social-Algorithmus."
        actions={<Status tone="green">{profile.active}</Status>}
      >
        <div className="flex items-center gap-3 text-sm mb-6">
          <span>Aktives Profil</span>
          <ArrowRight size={15} />
          <span className="font-semibold">
            {profile.discarded ? "Kein Kandidat" : profile.candidate}
          </span>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Signal</th>
                <th>Aktiv</th>
                <th>Kandidat</th>
                <th>Änderung</th>
              </tr>
            </thead>
            <tbody>
              {(["freshness", "relevance", "voice"] as const).map((key) => (
                <tr key={key}>
                  <td>
                    {key === "freshness"
                      ? "Aktualität"
                      : key === "relevance"
                        ? "Themenrelevanz"
                        : "Eigene Stimme"}
                  </td>
                  <td>{profile[key]} %</td>
                  <td>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      className="w-24"
                      aria-label={`Kandidat ${key}`}
                      value={candidateWeights[key]}
                      disabled={!admin || profile.discarded || busy}
                      onChange={(e) => {
                        setCandidateWeights((w) => ({
                          ...w,
                          [key]: Math.max(
                            0,
                            Math.min(100, Number(e.target.value)),
                          ),
                        }));
                        setProfile((p) => ({ ...p, evaluated: false }));
                      }}
                    />
                  </td>
                  <td className="muted">
                    {candidateWeights[key] - profile[key] > 0 ? "+" : ""}
                    {candidateWeights[key] - profile[key]} Punkte
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p
          className={`text-xs mt-4 ${total !== 100 ? "text-destructive" : "muted"}`}
        >
          Kandidat: {total} / 100 %
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={
              !admin ||
              !sourceChange.reviewed ||
              profile.discarded ||
              total !== 100 ||
              busy
            }
            onClick={() => {
              setBusy(true);
              setTimeout(() => {
                setProfile((p) => ({ ...p, evaluated: true }));
                setLog((l) => [
                  `${profile.candidate}: lokaler Beispielsatz geprüft. Gewichte ${total} %.`,
                  ...l,
                ]);
                setBusy(false);
              }, 500);
            }}
          >
            {busy ? "Wird geprüft…" : "Beispielsatz evaluieren"}
          </Button>
          <Button
            variant="outline"
            disabled={
              !admin ||
              !sourceChange.reviewed ||
              !profile.evaluated ||
              profile.discarded ||
              total !== 100 ||
              busy
            }
            onClick={() => {
              setProfile((p) => ({
                ...p,
                previous: JSON.stringify({
                  name: p.active,
                  freshness: p.freshness,
                  relevance: p.relevance,
                  voice: p.voice,
                }),
                active: p.candidate,
                ...candidateWeights,
                activatedAt: new Date().toISOString(),
                evaluated: false,
                discarded: true,
              }));
              setLog((l) => [`${profile.candidate} lokal aktiviert.`, ...l]);
            }}
          >
            Aktivieren
          </Button>
          <Button
            variant="ghost"
            disabled={!admin || profile.discarded || busy}
            onClick={() => {
              setProfile((p) => ({ ...p, discarded: true, evaluated: false }));
              setLog((l) => [
                "Kandidat verworfen. Aktives Profil unverändert.",
                ...l,
              ]);
            }}
          >
            Verwerfen
          </Button>
          <Button
            variant="ghost"
            disabled={!admin || !profile.previous || busy}
            onClick={() => {
              try {
                const previous = JSON.parse(profile.previous);
                setProfile((p) => ({
                  ...p,
                  active: previous.name,
                  freshness: previous.freshness,
                  relevance: previous.relevance,
                  voice: previous.voice,
                  previous: "",
                  evaluated: false,
                }));
                setLog((l) => [`Rollback auf ${previous.name}.`, ...l]);
              } catch {
                toast.error(
                  "Gespeichertes Profil konnte nicht wiederhergestellt werden.",
                );
              }
            }}
          >
            Rollback
          </Button>
          {profile.discarded && (
            <Button
              variant="outline"
              disabled={!admin || busy}
              onClick={() =>
                setProfile((p) => ({
                  ...p,
                  candidate: `Editorial ${uid("candidate").slice(-5)}`,
                  discarded: false,
                  evaluated: false,
                }))
              }
            >
              Neuen Kandidaten erstellen
            </Button>
          )}
        </div>
        {profile.evaluated && (
          <p role="status" className="text-sm mt-5 mb-0">
            Demo-Auswertung: Gewichtung gültig, drei Beispielinhalte geprüft.
            Beispielbewertung 76/100. Keine Garantie für Plattform-Reichweite.
          </p>
        )}
      </Section>
      <Section
        title="Quellen & Versionsverlauf"
        description="Profilbasis: lokale Markenstrategie, manuelle Richtlinien, öffentliche Beispielquellen."
      >
        <p className="muted text-sm">
          Private GitHub-Inhalte und externe Reichweitensignale werden für diese
          Vorschau nicht genutzt.
        </p>
        {log.length ? (
          <ol className="space-y-3 text-sm">
            {log.map((entry, i) => (
              <li key={i} className="border-b pb-3">
                {entry}
              </li>
            ))}
          </ol>
        ) : (
          <p className="muted text-xs mb-0">Noch keine Profiländerungen.</p>
        )}
      </Section>
      <DemoNote>
        Aktivierung und Rollback ändern ausschließlich dieses lokale
        Algorithmusprofil. Generierung, Ranking und Veröffentlichungen werden
        nicht automatisch ausgelöst.
      </DemoNote>
    </div>
  );
}
