import { useEffect, useState } from "react";
import { BarChart3, Download, Pause, Play, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  PageHeader,
  Section,
  Status,
  DemoNote,
  EmptyState,
} from "@/components/shared";
import { useStore, useWorkspaceLocalState } from "@/lib/store";
import { canEdit, uid } from "@/lib/model";
type Metric = {
  id: string;
  accountId: string;
  channel: string;
  title: string;
  topic: string;
  format: string;
  day: number;
  hour: number;
  impressions: number | null;
  engagements: number | null;
  clicks: number | null;
  origin: string;
};
const examples = [
  [
    "Die kleinen Dinge machen das Produkt",
    "Produktdesign",
    "Beobachtung",
    2,
    9,
    1840,
    98,
    14,
  ],
  [
    "Was wir aus 100 Gesprächen gelernt haben",
    "Learnings",
    "Learning",
    5,
    12,
    2650,
    176,
    31,
  ],
  ["Drei Features weniger", "Produktdesign", "Thread", 9, 9, 3200, 217, 28],
  [
    "Ein Blick hinter die Kulissen",
    "Build in public",
    "Beobachtung",
    14,
    17,
    1420,
    75,
    null,
  ],
  [
    "Unser neuer Release ist da",
    "Produktupdates",
    "Update",
    21,
    12,
    980,
    32,
    8,
  ],
  [
    "Die Arbeit, die niemand sieht",
    "Build in public",
    "Thread",
    27,
    9,
    2140,
    123,
    null,
  ],
] as const;
export function AnalyticsPage() {
  const { state } = useStore();
  const editable = canEdit(state.role);
  const accounts = state.accounts.filter(
    (a) => a.workspaceId === state.activeWorkspaceId,
  );
  const seed: Metric[] = accounts.flatMap((a, index) =>
    examples.map((e, i) => ({
      id: `metric-${a.id}-${i}`,
      accountId: a.id,
      channel: a.channel,
      title: e[0],
      topic: e[1],
      format: e[2],
      day: e[3],
      hour: e[4],
      impressions: a.connected
        ? Math.round(e[5] * (index === 1 ? 1.4 : 1))
        : null,
      engagements: a.connected
        ? Math.round(e[6] * (index === 1 ? 1.2 : 1))
        : null,
      clicks: a.connected ? e[7] : null,
      origin: "Demo-Beitrag",
    })),
  );
  const [metrics, setMetrics] = useWorkspaceLocalState<Metric[]>(
    "analytics-metrics",
    seed,
  );
  const [collection, setCollection] = useWorkspaceLocalState(
    "analytics-collection",
    true,
  );
  const [job, setJob] = useWorkspaceLocalState("analytics-import", {
    status: "idle",
    progress: 0,
    id: "",
  });
  const [days, setDays] = useState("30");
  const [account, setAccount] = useState(state.activeAccountId);
  const [channel, setChannel] = useState("all");
  const [compare, setCompare] = useState("topic");
  useEffect(() => {
    if (job.status !== "running" || !editable) return;
    const timer = window.setTimeout(() => {
      if (job.progress >= 80) {
        setJob((j) => ({ ...j, progress: 100, status: "completed" }));
        setMetrics((ms) => [
          ...ms,
          ...accounts
            .filter((a) => a.connected)
            .flatMap((a) => [
              {
                id: `historical-demo-${a.id}`,
                accountId: a.id,
                channel: a.channel,
                title: "Rückblick: Unser erster Prototyp",
                topic: "Build in public",
                format: "Beobachtung",
                day: 58,
                hour: 9,
                impressions: 1600,
                engagements: 64,
                clicks: null,
                origin: "Historischer Demo-Import",
              },
            ])
            .filter((m) => !ms.some((x) => x.id === m.id)),
        ]);
      } else setJob((j) => ({ ...j, progress: j.progress + 20 }));
    }, 500);
    return () => window.clearTimeout(timer);
  }, [
    job.status,
    job.progress,
    job.id,
    editable,
    setJob,
    setMetrics,
    accounts,
  ]);
  const data = metrics.filter(
    (m) =>
      m.day <= Number(days) &&
      (account === "all" || m.accountId === account) &&
      (channel === "all" || m.channel === channel),
  );
  const available = data.filter((m) => m.impressions !== null);
  const impressions = available.reduce((s, m) => s + (m.impressions ?? 0), 0);
  const interactions = available.reduce((s, m) => s + (m.engagements ?? 0), 0);
  const clicksData = data.filter((m) => m.clicks !== null);
  const clicks = clicksData.reduce((s, m) => s + (m.clicks ?? 0), 0);
  const rate = impressions ? (100 * interactions) / impressions : null;
  const accountRows = accounts
    .filter(
      (a) =>
        (account === "all" || a.id === account) &&
        (channel === "all" || a.channel === channel),
    )
    .map((a) => {
      const rows = data.filter((m) => m.accountId === a.id);
      const observed = rows.filter((m) => m.impressions !== null);
      const views = observed.reduce((n, m) => n + (m.impressions ?? 0), 0);
      const reactions = observed.reduce((n, m) => n + (m.engagements ?? 0), 0);
      const clickRows = rows.filter((m) => m.clicks !== null);
      return {
        account: a,
        observed: observed.length,
        impressions: observed.length ? views : null,
        interactions: observed.length ? reactions : null,
        rate: views ? (100 * reactions) / views : null,
        clicks: clickRows.length
          ? clickRows.reduce((n, m) => n + (m.clicks ?? 0), 0)
          : null,
        baseline: observed.length ? Math.round(views / observed.length) : null,
      };
    });
  const multipleAccounts = accountRows.length > 1;
  const weeks = [0, 1, 2, 3]
    .map((i) =>
      data
        .filter((m) => m.day >= i * 7 && m.day < (i + 1) * 7)
        .reduce((s, m) => s + (m.impressions ?? 0), 0),
    )
    .reverse();
  const max = Math.max(...weeks, 1);
  const chartPoints = weeks
    .map((v, i) => `${70 + i * 175},${200 - (v / max) * 150}`)
    .join(" ");
  const groups = accountRows.flatMap(({ account: a }) => {
    const accountData = data.filter((m) => m.accountId === a.id);
    return [
      ...new Set(
        accountData.map((m) =>
          compare === "topic"
            ? m.topic
            : compare === "format"
              ? m.format
              : `${m.hour}:00 Uhr`,
        ),
      ),
    ].map((label) => {
      const rows = accountData
        .filter(
          (m) =>
            (compare === "topic"
              ? m.topic
              : compare === "format"
                ? m.format
                : `${m.hour}:00 Uhr`) === label,
        )
        .filter((m) => m.impressions !== null);
      const total = rows.reduce((s, m) => s + (m.impressions ?? 0), 0);
      return {
        label: multipleAccounts ? `${a.channel} · ${a.name} · ${label}` : label,
        n: rows.length,
        reach: rows.length ? Math.round(total / rows.length) : null,
        rate: total
          ? (100 * rows.reduce((s, m) => s + (m.engagements ?? 0), 0)) / total
          : null,
      };
    });
  });
  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Aus Inhalten lernen"
        title="Analytics"
        description="Was Resonanz findet — und welche Fragen noch offenbleiben."
        actions={
          <Button
            variant="outline"
            disabled={
              !editable || job.status === "running" || job.status === "paused"
            }
            onClick={() =>
              setJob({ id: uid("import"), status: "running", progress: 0 })
            }
          >
            <Download size={14} />
            Historie importieren
          </Button>
        }
      />
      <div className="flex flex-wrap gap-3 mb-6">
        <label>
          <span className="field-label">Zeitraum</span>
          <select
            aria-label="Zeitraum"
            className="native-select w-40"
            value={days}
            onChange={(e) => setDays(e.target.value)}
          >
            <option value="7">Letzte 7 Tage</option>
            <option value="30">Letzte 30 Tage</option>
            <option value="90">Letzte 90 Tage</option>
          </select>
        </label>
        <label>
          <span className="field-label">Account</span>
          <select
            aria-label="Account"
            className="native-select w-52"
            value={account}
            onChange={(e) => setAccount(e.target.value)}
          >
            <option value="all">Alle Accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.channel} · {a.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="field-label">Kanal</span>
          <select
            aria-label="Kanal"
            className="native-select w-40"
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
          >
            <option value="all">Alle Kanäle</option>
            {[...new Set(accounts.map((a) => a.channel))].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <span className="text-xs muted self-end mb-3">
          Alle Kennzahlen sind Demo-Daten.
        </span>
      </div>
      <div className="surface grid grid-cols-2 lg:grid-cols-4 mb-6 divide-x">
        {[
          [
            "Impressionen",
            multipleAccounts
              ? "Je Account"
              : available.length
                ? impressions.toLocaleString("de-DE")
                : "—",
            `${available.length} Beiträge mit Messwerten`,
          ],
          [
            "Interaktionen",
            multipleAccounts
              ? "Je Account"
              : available.length
                ? interactions.toLocaleString("de-DE")
                : "—",
            "Reaktionen, Antworten und Shares",
          ],
          [
            "Interaktionsrate",
            multipleAccounts
              ? "Je Account"
              : rate !== null
                ? `${rate.toFixed(1)} %`
                : "—",
            "Interaktionen / Impressionen",
          ],
          [
            "Link-Klicks",
            multipleAccounts
              ? "Je Account"
              : clicksData.length
                ? clicks.toLocaleString("de-DE")
                : "—",
            `${clicksData.length} von ${data.length} Beiträgen erfasst`,
          ],
        ].map(([label, value, hint]) => (
          <div key={label} className="p-5">
            <span className="text-xs muted">{label}</span>
            <div className="text-3xl font-semibold tracking-tight my-2">
              {value}
            </div>
            <span className="text-[11px] muted">{hint}</span>
          </div>
        ))}
      </div>
      <Tabs defaultValue="overview">
        <TabsList className="mb-5 flex h-auto max-w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="overview">Überblick</TabsTrigger>
          <TabsTrigger value="posts">Beiträge</TabsTrigger>
          <TabsTrigger value="patterns">Muster & Learnings</TabsTrigger>
          <TabsTrigger value="data">Datenverwaltung</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(260px,1fr)]">
            <Section
              title="Resonanz im Verlauf"
              description={
                multipleAccounts
                  ? "Getrennte Messwerte pro Account und Kanal. Fehlende Metriken werden nicht als null gewertet."
                  : "Wöchentliche Impressionen im jüngsten 28-Tage-Ausschnitt. Fehlende Metriken werden nicht als null gewertet."
              }
              actions={<Status>Beispieldaten</Status>}
            >
              {multipleAccounts ? (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Account / Kanal</th>
                        <th>Impressionen</th>
                        <th>Rate</th>
                        <th>Baseline / n</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accountRows.map((r) => (
                        <tr key={r.account.id}>
                          <td>
                            {r.account.name}
                            <div className="muted text-xs">
                              {r.account.channel} · {r.account.handle}
                            </div>
                          </td>
                          <td>
                            {r.impressions?.toLocaleString("de-DE") ?? "—"}
                          </td>
                          <td>
                            {r.rate !== null ? `${r.rate.toFixed(1)} %` : "—"}
                          </td>
                          <td>
                            {r.baseline?.toLocaleString("de-DE") ?? "—"} Ø
                            <div className="text-xs muted">
                              n = {r.observed}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="muted text-xs mt-4">
                    Jeder Account hat seine eigene Baseline. Kanäle werden nicht
                    zusammengeführt.
                  </p>
                </div>
              ) : available.length ? (
                <svg
                  viewBox="0 0 650 250"
                  className="w-full mt-4"
                  role="img"
                  aria-label={`Impressionen pro Woche: ${weeks.join(", ")}. Y-Achse 0 bis ${max}.`}
                >
                  <title>Impressionen pro Woche</title>
                  {[0, 0.5, 1].map((f) => (
                    <g key={f}>
                      <line
                        x1="65"
                        y1={200 - f * 150}
                        x2="610"
                        y2={200 - f * 150}
                        stroke="currentColor"
                        opacity=".12"
                      />
                      <text
                        x="5"
                        y={204 - f * 150}
                        fontSize="11"
                        fill="currentColor"
                        opacity=".6"
                      >
                        {Math.round(max * f).toLocaleString("de-DE")}
                      </text>
                    </g>
                  ))}
                  <polyline
                    points={chartPoints}
                    fill="none"
                    stroke="#bd5634"
                    strokeWidth="3"
                  />
                  {weeks.map((v, i) => (
                    <g key={i}>
                      <circle
                        cx={70 + i * 175}
                        cy={200 - (v / max) * 150}
                        r="5"
                        fill="#bd5634"
                      />
                      <text
                        x={70 + i * 175}
                        y="232"
                        textAnchor="middle"
                        fontSize="11"
                        fill="currentColor"
                      >
                        {
                          [
                            "Vor 4 Wochen",
                            "Vor 3 Wochen",
                            "Vor 2 Wochen",
                            "Diese Woche",
                          ][i]
                        }
                      </text>
                    </g>
                  ))}
                </svg>
              ) : (
                <EmptyState
                  icon={<BarChart3 />}
                  title="Noch keine Messwerte"
                  description="Für diese Auswahl liegen keine Impressionen vor. Wähle einen verbundenen Demo-Account."
                />
              )}
            </Section>
            <Section title="Eine Beobachtung für dich">
              <Status tone="orange">Heuristik · kleine Stichprobe</Status>
              <h2 className="text-xl leading-snug mt-5">
                Konkrete Learnings laden zum Gespräch ein.
              </h2>
              <p className="muted text-sm leading-relaxed">
                In den Beispieldaten erhalten Learning-Beiträge häufiger
                Reaktionen. Thema, Format und Veröffentlichungszeit können das
                Ergebnis mitbestimmen.
              </p>
              <div className="border-t pt-4 text-xs leading-relaxed">
                <b>{available.length} beobachtete Demo-Beiträge</b>
                <p className="muted mt-2 mb-0">
                  Keine kausale Aussage. Teste die Idee mit einer klaren
                  Hypothese und deiner eigenen Baseline.
                </p>
              </div>
            </Section>
          </div>
        </TabsContent>
        <TabsContent value="posts">
          <Section
            title="Beitragsperformance"
            description="Ein Strich bedeutet: Diese Metrik fehlt."
          >
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Beitrag</th>
                    <th>Kanal / Alter</th>
                    <th>Impressionen</th>
                    <th>Interaktionen</th>
                    <th>Link-Klicks</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((m) => (
                    <tr key={m.id}>
                      <td className="min-w-64">
                        <b className="text-sm">{m.title}</b>
                        <div className="text-xs muted mt-1">
                          {m.topic} · {m.origin}
                        </div>
                      </td>
                      <td>
                        {m.channel}
                        <div className="text-xs muted">Vor {m.day} Tagen</div>
                      </td>
                      <td>{m.impressions?.toLocaleString("de-DE") ?? "—"}</td>
                      <td>{m.engagements ?? "—"}</td>
                      <td>{m.clicks ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!data.length && (
                <EmptyState
                  title="Keine Beiträge in dieser Auswahl"
                  description="Erweitere den Zeitraum oder ändere den Account-Filter."
                />
              )}
            </div>
          </Section>
        </TabsContent>
        <TabsContent value="patterns">
          <Section
            title="Vergleiche mit Kontext"
            description="Baseline: durchschnittliche Impressionen der gefilterten Beiträge. Kategorien mit wenigen Beiträgen sind unsicher."
            actions={
              <select
                className="native-select max-w-44"
                aria-label="Vergleich gruppieren"
                value={compare}
                onChange={(e) => setCompare(e.target.value)}
              >
                <option value="topic">Nach Thema</option>
                <option value="format">Nach Format</option>
                <option value="time">Nach Uhrzeit</option>
              </select>
            }
          >
            <div className="space-y-2 mb-5">
              {accountRows.map((r) => (
                <p key={r.account.id} className="text-xs muted mb-0">
                  {r.account.channel} · {r.account.name}: Baseline{" "}
                  {r.baseline?.toLocaleString("de-DE") ?? "—"} Impressionen · n
                  = {r.observed}
                </p>
              ))}
            </div>
            <div className="space-y-5">
              {groups.map((g) => (
                <div key={g.label}>
                  <div className="flex justify-between text-sm mb-2">
                    <b>{g.label}</b>
                    <span>
                      {g.reach?.toLocaleString("de-DE") ?? "—"} Ø Impressionen
                    </span>
                  </div>
                  <div className="bg-secondary h-2 rounded">
                    <div
                      className="bg-[#8a9b7e] h-2 rounded"
                      style={{
                        width: `${g.reach ? (g.reach / Math.max(...groups.map((x) => x.reach ?? 0), 1)) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <p className="muted text-xs mt-2 mb-0">
                    n = {g.n} · {g.rate?.toFixed(1) ?? "—"} % Interaktionsrate ·{" "}
                    {g.n < 10 ? "unsichere Stichprobe" : "nur deskriptiv"}
                  </p>
                </div>
              ))}
            </div>
          </Section>
          <div className="mt-5">
            <Section
              title="Historische Ähnlichkeiten & Serien"
              description="Lokale Heuristik, keine Bewertung deiner Inhalte."
            >
              <p className="text-sm leading-relaxed">
                „Die kleinen Dinge machen das Produkt“ und „Drei Features
                weniger“ teilen das Thema Produktdesign. Eine mögliche Serie:
                eine konkrete Entscheidung pro Woche.
              </p>
              <p className="muted text-xs mb-0">
                Ähnlichkeit nach Themenetikett. Prüfe Überlappung und
                Perspektive jedes Beitrags einzeln; Wiederholung ist kein Beleg
                für Erfolg.
              </p>
            </Section>
          </div>
        </TabsContent>
        <TabsContent value="data">
          <div className="grid gap-6 lg:grid-cols-2">
            <Section
              title="Historischer Demo-Import"
              description="Fügt einen festen Beispielbeitrag pro verbundenem Account hinzu. Kein Abruf externer Daten."
            >
              <Status tone={job.status === "completed" ? "green" : "neutral"}>
                {{
                  idle: "Bereit",
                  running: "Import läuft",
                  paused: "Pausiert",
                  cancelled: "Abgebrochen",
                  completed: "Import abgeschlossen",
                }[job.status] ?? job.status}
              </Status>
              <Progress
                value={job.progress}
                className="my-5"
                aria-label="Import-Fortschritt"
              />
              <p className="text-xs muted">
                {job.progress}% ·{" "}
                {job.status === "completed"
                  ? "Beispiele mit Herkunft gespeichert"
                  : "Unterbrechbar; pausierter Fortschritt bleibt lokal erhalten."}
              </p>
              <div className="flex gap-2">
                {job.status === "running" ? (
                  <Button
                    variant="outline"
                    disabled={!editable}
                    onClick={() => setJob((j) => ({ ...j, status: "paused" }))}
                  >
                    <Pause size={14} />
                    Pausieren
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    disabled={!editable}
                    onClick={() =>
                      setJob((j) => ({
                        ...j,
                        id: j.status === "paused" ? j.id : uid("import"),
                        status: "running",
                        progress: j.status === "paused" ? j.progress : 0,
                      }))
                    }
                  >
                    <Play size={14} />
                    {job.status === "paused" ? "Fortsetzen" : "Import starten"}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  disabled={
                    !editable || !["running", "paused"].includes(job.status)
                  }
                  onClick={() => setJob((j) => ({ ...j, status: "cancelled" }))}
                >
                  Abbrechen
                </Button>
              </div>
            </Section>
            <Section
              title="Metrikerfassung"
              description="Diese Demo speichert nur lokale Beispielwerte."
            >
              <label className="flex gap-3 items-center">
                <Switch
                  checked={collection}
                  disabled={!editable}
                  onCheckedChange={setCollection}
                  aria-label="Metrikerfassung aktivieren"
                />
                <span className="text-sm">
                  {collection ? "Erfassung aktiviert" : "Erfassung pausiert"}
                </span>
              </label>
              <p className="muted text-xs mt-4">
                {metrics.length} Messdatensätze im Workspace. Löschen entfernt
                nur die Metriken; Entwürfe bleiben erhalten.
              </p>
              <Button
                variant="outline"
                disabled={!editable || metrics.length === 0}
                onClick={() => {
                  setCollection(false);
                  setMetrics([]);
                  setJob({ id: "", status: "idle", progress: 0 });
                }}
              >
                <Trash2 size={14} />
                Lokale Metriken löschen
              </Button>
              {!metrics.length && (
                <Button
                  variant="ghost"
                  className="mt-2"
                  disabled={!editable}
                  onClick={() => setMetrics(seed)}
                >
                  Demo-Daten wiederherstellen
                </Button>
              )}
            </Section>
          </div>
        </TabsContent>
      </Tabs>
      <div className="mt-6">
        <DemoNote>
          Beobachtet bedeutet hier: gemessener Wert im synthetischen Datensatz.
          Muster sind Hypothesen. Weder optimale Posting-Zeiten noch Reichweite
          werden prognostiziert.
        </DemoNote>
      </div>
    </div>
  );
}
