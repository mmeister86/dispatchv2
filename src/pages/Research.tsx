import { demoMode } from "@/lib/auth-client";
import { RealResearch } from "@/features/research/profile-editor";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  BookOpen,
  Check,
  Play,
  Plus,
  RefreshCw,
  Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  PageHeader,
  Section,
  Status,
  DemoNote,
  EmptyState,
  formatDate,
} from "@/components/shared";
import { useStore, useWorkspaceLocalState } from "@/lib/store";
import { canEdit, uid, now } from "@/lib/model";

type ResearchItem = {
  id: string;
  title: string;
  topic: string;
  excerpt: string;
  claim: string;
  interpretation: string;
  source: string;
  url: string;
  confidence: number;
  relevance?: number;
  date: string;
  status: "new" | "archived" | "ignored";
  draftId?: string;
  ideaId?: string;
};
type Run = {
  id: string;
  at: string;
  status: string;
  count: number;
  cost: number;
  profile?: typeof initialProfile;
  outcome?: string;
};
const age = (days: number) =>
  new Date(Date.now() - days * 86400000).toISOString();
const sample: ResearchItem[] = [
  {
    id: "research-1",
    title: "Weniger Funktionen. Mehr Produkt.",
    topic: "Produktentwicklung",
    excerpt:
      "Wie kleine Teams mit klaren Prioritäten bessere Produkte bauen — und was wir daraus lernen können.",
    claim:
      "Die Beispielquelle beschreibt drei vereinfachte Abläufe in einem kleinen Produktteam. Eine Wirkung auf Umsatz wurde nicht gemessen.",
    interpretation:
      "Ein persönlicher Beitrag über unsere eigenen gestrichenen Features könnte die Diskussion sinnvoll ergänzen.",
    source: "Produktnotizen · Beispielquelle",
    url: "https://example.com/research/product-focus",
    confidence: 86,
    relevance: 92,
    date: age(0),
    status: "new",
  },
  {
    id: "research-2",
    title: "Build in public braucht keine großen Ankündigungen",
    topic: "Build in public",
    excerpt:
      "Kleine Entscheidungen und ehrliche Einblicke sind oft die interessanteren Geschichten.",
    claim:
      "Die Demo-Auswertung enthält zwölf Beispielbeiträge. Sechs zeigen Entscheidungen, sechs zeigen Release-Ankündigungen; keine repräsentative Stichprobe.",
    interpretation:
      "Die Geschichte eines verworfenen Designs eignet sich als Gesprächseinstieg. Eine höhere Reichweite lässt sich daraus nicht ableiten.",
    source: "Community-Notizen · Beispielquelle",
    url: "https://example.com/research/small-stories",
    confidence: 73,
    relevance: 85,
    date: age(1),
    status: "new",
  },
  {
    id: "research-3",
    title: "Zuhören vor dem nächsten Feature",
    topic: "Learnings",
    excerpt:
      "Was Nutzerinterviews sichtbar machen, das ein Dashboard leicht übersieht.",
    claim:
      "In fünf simulierten Interviews wünschen sich drei Personen eine einfachere Navigation. Dies ist synthetisches Demonstrationsmaterial.",
    interpretation:
      "Nutze diese Frage als Interviewimpuls, nicht als Aussage über deine eigenen Nutzer.",
    source: "Interview-Sammlung · Beispielquelle",
    url: "https://example.com/research/listening",
    confidence: 64,
    relevance: 68,
    date: age(12),
    status: "new",
  },
];
const initialProfile = {
  topics: "Produktentwicklung, Build in public, Learnings",
  audience: "Gründer und Menschen, die gute Produkte bauen",
  language: "Deutsch",
  sources: "Produktblogs, Community, Primärquellen",
  exclusions: "Werbung, unbelegte Wachstumsversprechen",
  frequency: "Täglich",
  budget: 2,
  window: 7,
  region: "DACH",
  count: 5,
  paused: false,
  autoHandoff: false,
};
const labels: Record<string, string> = {
  idle: "Bereit",
  running: "Läuft",
  cancelled: "Abgebrochen",
  completed: "Abgeschlossen",
  partial: "Teilweise",
  budget: "Budget erreicht",
  failed: "Fehlgeschlagen",
  empty: "Keine Treffer",
};
export function ResearchPage() {
  return demoMode ? <DemoResearch /> : <RealResearch />;
}
function DemoResearch() {
  const { state, createDraft, mutate } = useStore();
  const navigate = useNavigate();
  const editable = canEdit(state.role);
  const [profile, setProfile] = useWorkspaceLocalState(
    `research-profile-${state.activeAccountId}`,
    initialProfile,
  );
  const [items, setItems] = useWorkspaceLocalState<ResearchItem[]>(
    `research-inbox-${state.activeAccountId}`,
    sample,
  );
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const [runs, setRuns] = useWorkspaceLocalState<Run[]>(
    `research-runs-${state.activeAccountId}`,
    [{ id: "seed-run", at: age(0), status: "completed", count: 3, cost: 0.18 }],
  );
  const [selected, setSelected] = useState("research-1");
  const [filter, setFilter] = useState("new");
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("inbox");
  const [demoResult, setDemoResult] = useState("completed");
  const activeRun = runs.find((r) => r.status === "running");
  useEffect(() => {
    if (!activeRun || !editable) return;
    const snapshot = activeRun.profile ?? profile;
    const timer = window.setTimeout(async () => {
      const outcome =
        activeRun.cost > snapshot.budget
          ? "budget"
          : (activeRun.outcome ?? "completed");
      setRuns((rs) =>
        rs.map((r) =>
          r.id === activeRun.id
            ? {
                ...r,
                status: outcome,
                count:
                  outcome === "completed"
                    ? Math.min(3, snapshot.count)
                    : outcome === "partial"
                      ? 1
                      : 0,
                cost:
                  outcome === "failed" ? 0 : Math.min(0.18, snapshot.budget),
              }
            : r,
        ),
      );
      if (outcome === "completed" || outcome === "partial") {
        const latest = itemsRef.current;
        const fresh = sample
          .slice(0, outcome === "partial" ? 1 : Math.min(3, snapshot.count))
          .map((i) => ({
            ...(latest.find((p) => p.url === i.url) ?? i),
            date: now(),
          }));
        if (snapshot.autoHandoff && outcome === "completed")
          for (const item of fresh)
            if (
              !item.draftId ||
              !state.drafts.some((d) => d.id === item.draftId)
            )
              item.draftId = await createDraft(
                item.title,
                item.interpretation,
                `Research → ${item.source} → ${item.url} · Quelle: ${item.claim} · Interpretation: ${item.interpretation}`,
              );
        setItems([
          ...fresh,
          ...latest.filter((p) => !fresh.some((i) => i.url === p.url)),
        ]);
      }
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [activeRun?.id, editable]);
  const visible = items.filter(
    (i) =>
      (filter === "all" || i.status === filter) &&
      `${i.title} ${i.topic}`.toLowerCase().includes(query.toLowerCase()),
  );
  const detail = items.find((i) => i.id === selected) ?? visible[0];
  const patch = (id: string, update: Partial<ResearchItem>) => {
    if (editable)
      setItems((list) =>
        list.map((i) => (i.id === id ? { ...i, ...update } : i)),
      );
  };
  async function toDraft(item: ResearchItem) {
    if (!editable) return;
    if (item.draftId && state.drafts.some((d) => d.id === item.draftId)) {
      navigate(`/drafts/${item.draftId}`);
      return;
    }
    const source = `Research → ${item.source} → ${item.url} · Stand ${item.date} · Konfidenz ${item.confidence}% · Quelle: ${item.claim} · Interpretation: ${item.interpretation}`;
    const id = await createDraft(item.title, item.interpretation, source);
    if (id) {
      patch(item.id, { draftId: id });
      navigate(`/drafts/${id}`);
    }
  }
  function toIdea(item: ResearchItem) {
    if (!editable || item.ideaId) return;
    const id = uid("idea");
    if (
      mutate(
        (s) => ({
          ...s,
          ideas: [
            {
              id,
              workspaceId: s.activeWorkspaceId,
              title: item.title,
              description: item.interpretation,
              source: `Research → ${item.source} → ${item.url} · ${item.claim}`,
              pillar: item.topic,
              status: "new",
            },
            ...s.ideas,
          ],
        }),
        "Idee mit Quellenkette gespeichert",
      )
    )
      patch(item.id, { ideaId: id });
  }
  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Entdecken & verstehen"
        title="Research"
        description="Gute Inhalte beginnen mit einer guten Quelle."
        actions={
          <>
            <Button variant="outline" onClick={() => setTab("profile")}>
              <Settings2 size={15} /> Profil bearbeiten
            </Button>
            <Button
              disabled={!editable || !!activeRun}
              onClick={() =>
                setRuns((r) => [
                  {
                    id: uid("run"),
                    at: now(),
                    status: "running",
                    count: 0,
                    cost: 0.18,
                    profile: { ...profile },
                    outcome: demoResult,
                  },
                  ...r,
                ])
              }
            >
              <Play size={14} /> Demo-Recherche starten
            </Button>
          </>
        }
      />
      <div className="surface px-5 py-3 flex flex-wrap justify-between gap-3 mb-6">
        <span className="text-sm">
          <span className="inline-block w-2 h-2 rounded-full bg-[#769167] mr-2" />{" "}
          {profile.topics}{" "}
          <span className="muted">
            · {profile.language} · {profile.region}
          </span>
        </span>
        <label className="flex gap-2 items-center text-xs">
          <Switch
            aria-label="Recherche pausieren"
            checked={profile.paused}
            disabled={!editable}
            onCheckedChange={(paused) => setProfile((p) => ({ ...p, paused }))}
          />
          {profile.paused ? "Pausiert" : "Profil aktiv"}
        </label>
      </div>
      <p className="muted text-xs mb-5">
        Letzter Erfolg:{" "}
        {runs.find((r) => r.status === "completed")
          ? formatDate(runs.find((r) => r.status === "completed")!.at)
          : "Noch kein Lauf"}{" "}
        · Nächster Profil-Slot:{" "}
        {profile.paused
          ? "pausiert"
          : profile.frequency === "Nur manuell"
            ? "manuell"
            : profile.frequency === "Täglich"
              ? "morgen, 09:00 Uhr"
              : "nächste Woche, 09:00 Uhr"}{" "}
        · Demo ohne automatische Ausführung
      </p>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-6 flex h-auto max-w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="inbox">
            Inbox{" "}
            <span className="ml-2 muted">
              {items.filter((i) => i.status === "new").length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="history">Rechercheverlauf</TabsTrigger>
          <TabsTrigger value="profile">Rechercheprofil</TabsTrigger>
        </TabsList>
        <TabsContent value="inbox">
          <div className="grid gap-6 lg:grid-cols-[minmax(260px,.9fr)_minmax(0,1.3fr)]">
            <div>
              <div className="flex gap-2 mb-4">
                <Input
                  aria-label="Research durchsuchen"
                  placeholder="Thema oder Titel suchen…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <select
                  className="native-select max-w-32"
                  aria-label="Inbox Status"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="new">Neu</option>
                  <option value="archived">Archiv</option>
                  <option value="ignored">Ignoriert</option>
                  <option value="all">Alle</option>
                </select>
              </div>
              <div className="surface overflow-hidden">
                {visible.map((i) => (
                  <button
                    key={i.id}
                    onClick={() => setSelected(i.id)}
                    className={`block text-left w-full p-5 border-b last:border-b-0 hover:bg-secondary/60 ${detail?.id === i.id ? "bg-secondary/70" : ""}`}
                  >
                    <div className="flex justify-between gap-2 mb-3">
                      <span className="eyebrow">{i.topic}</span>
                      <span className="muted text-[11px]">
                        {new Date(i.date).toLocaleDateString("de-DE")}
                      </span>
                    </div>
                    <h3 className="text-base mb-2 leading-snug">{i.title}</h3>
                    <p className="muted text-xs leading-relaxed mb-3">
                      {i.excerpt}
                    </p>
                    <div className="flex gap-2">
                      <Status tone="green">{i.confidence}% Konfidenz</Status>
                      {Date.now() - Date.parse(i.date) >
                        profile.window * 86400000 && (
                        <Status tone="orange">Quelle veraltet</Status>
                      )}
                      {i.draftId && <Status>Entwurf erstellt</Status>}
                    </div>
                  </button>
                ))}
                {!visible.length && (
                  <EmptyState
                    icon={<BookOpen />}
                    title="Hier ist Raum für neue Gedanken"
                    description="Passe den Filter an oder starte eine lokale Demo-Recherche."
                  />
                )}
              </div>
            </div>
            {detail ? (
              <Section
                title="Ein Fundstück, eingeordnet"
                actions={<Status tone="orange">Demo-Quelle</Status>}
              >
                <span className="eyebrow">{detail.topic}</span>
                <h2 className="text-2xl mt-3 leading-snug">{detail.title}</h2>
                <p className="muted leading-relaxed">{detail.excerpt}</p>
                <div className="border-t border-b py-5 my-5">
                  <div className="flex flex-wrap gap-2 mb-4">
                    <Status tone="green">
                      {detail.relevance ?? 75}% Projektrelevanz · Demo
                    </Status>
                    <span className="muted text-xs self-center">
                      Passend zu Produktentwicklung und persönlichem Lernen.
                    </span>
                  </div>
                  <span className="field-label">Was die Quelle behauptet</span>
                  <p className="text-sm leading-relaxed mb-5">{detail.claim}</p>
                  <span className="field-label text-primary">
                    Unsere Interpretation
                  </span>
                  <p className="text-sm leading-relaxed mb-0">
                    {detail.interpretation}
                  </p>
                </div>
                <a
                  className="flex items-center gap-2 text-sm font-semibold hover:text-primary"
                  href={detail.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {detail.source}
                  <ArrowUpRight size={15} />
                </a>
                <p className="muted text-xs mt-2">
                  Stand {formatDate(detail.date)} · Konfidenz ist eine
                  Demo-Einschätzung, keine Faktenprüfung.
                </p>
                {Date.now() - Date.parse(detail.date) >
                  profile.window * 86400000 && (
                  <p className="text-xs text-primary">
                    Außerhalb deines Zeitfensters. Vor Verwendung die Quelle
                    prüfen.
                  </p>
                )}
                <div className="flex flex-wrap gap-2 mt-6">
                  <Button disabled={!editable} onClick={() => toDraft(detail)}>
                    <Plus size={14} />
                    {detail.draftId
                      ? "Entwurf öffnen"
                      : "Als Entwurf verwenden"}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={!editable || !!detail.ideaId}
                    onClick={() => toIdea(detail)}
                  >
                    {detail.ideaId ? <Check size={14} /> : <Plus size={14} />}
                    Als Idee speichern
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!editable}
                    onClick={() =>
                      patch(detail.id, {
                        status:
                          detail.status === "archived" ? "new" : "archived",
                      })
                    }
                  >
                    {detail.status === "archived" ? "Zur Inbox" : "Archivieren"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!editable}
                    onClick={() => patch(detail.id, { status: "ignored" })}
                  >
                    Ignorieren
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!editable}
                    onClick={() =>
                      patch(detail.id, {
                        date: now(),
                        confidence: Math.min(detail.confidence + 2, 95),
                      })
                    }
                  >
                    <RefreshCw size={13} />
                    Demo-Quelle aktualisieren
                  </Button>
                  <Link
                    className="self-center text-xs font-semibold hover:text-primary"
                    to={`/agent?source=${encodeURIComponent(`${detail.source} → ${detail.url} · ${detail.claim}`)}&question=${encodeURIComponent(`Wie könnte ich ${detail.title} mit meiner eigenen Erfahrung verbinden?`)}`}
                  >
                    Agent fragen <ArrowUpRight size={12} className="inline" />
                  </Link>
                </div>
              </Section>
            ) : (
              <DemoNote>
                Keine Auswahl. Dein Rechercheprofil bestimmt, welche Fundstücke
                in dieser lokalen Demo auftauchen.
              </DemoNote>
            )}
          </div>
        </TabsContent>
        <TabsContent value="history">
          <Section
            title="Manuelle Demo-Läufe"
            description="Das Profil startet keine Hintergrundrecherche. Kosten und Quellen sind simuliert."
            actions={
              <select
                aria-label="Demo-Ergebnis"
                className="native-select max-w-48"
                value={demoResult}
                onChange={(e) => setDemoResult(e.target.value)}
              >
                {["completed", "partial", "budget", "failed", "empty"].map(
                  (s) => (
                    <option key={s} value={s}>
                      {labels[s]} simulieren
                    </option>
                  ),
                )}
              </select>
            }
          >
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Gestartet</th>
                    <th>Status</th>
                    <th>Fundstücke</th>
                    <th>Demo-Kosten</th>
                    <th>Aktion</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r) => (
                    <tr key={r.id}>
                      <td>{formatDate(r.at)}</td>
                      <td>
                        <Status
                          tone={
                            r.status === "completed"
                              ? "green"
                              : r.status === "failed"
                                ? "red"
                                : "orange"
                          }
                        >
                          {labels[r.status]}
                        </Status>
                      </td>
                      <td>{r.count}</td>
                      <td>{r.cost.toFixed(2)} €</td>
                      <td>
                        {r.status === "running" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={!editable}
                            onClick={() =>
                              setRuns((rs) =>
                                rs.map((x) =>
                                  x.id === r.id
                                    ? { ...x, status: "cancelled", cost: 0 }
                                    : x,
                                ),
                              )
                            }
                          >
                            Abbrechen
                          </Button>
                        ) : (
                          <span className="muted text-xs">
                            {r.status === "failed"
                              ? "Erneut manuell starten"
                              : "Protokoll gespeichert"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </TabsContent>
        <TabsContent value="profile">
          <Section
            title="Dein Blick auf die Welt"
            description="Änderungen werden lokal für diesen Workspace gespeichert."
          >
            <fieldset disabled={!editable} className="form-grid">
              <label>
                <span className="field-label">Themen</span>
                <Input
                  value={profile.topics}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, topics: e.target.value }))
                  }
                />
              </label>
              <label>
                <span className="field-label">Zielgruppe</span>
                <Input
                  value={profile.audience}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, audience: e.target.value }))
                  }
                />
              </label>
              <label>
                <span className="field-label">Sprache</span>
                <Input
                  value={profile.language}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, language: e.target.value }))
                  }
                />
              </label>
              <label>
                <span className="field-label">Region</span>
                <Input
                  value={profile.region}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, region: e.target.value }))
                  }
                />
              </label>
              <label>
                <span className="field-label">Quellenmix</span>
                <Textarea
                  aria-label="Quellenmix"
                  value={profile.sources}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, sources: e.target.value }))
                  }
                />
              </label>
              <label>
                <span className="field-label">Ausschlüsse</span>
                <Textarea
                  aria-label="Ausschlüsse"
                  value={profile.exclusions}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, exclusions: e.target.value }))
                  }
                />
              </label>
              <label>
                <span className="field-label">Frequenz des Profils</span>
                <select
                  aria-label="Frequenz des Profils"
                  className="native-select"
                  value={profile.frequency}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, frequency: e.target.value }))
                  }
                >
                  <option>Täglich</option>
                  <option>Wöchentlich</option>
                  <option>Nur manuell</option>
                </select>
              </label>
              <label>
                <span className="field-label">Demo-Budget pro Lauf (€)</span>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={profile.budget}
                  onChange={(e) =>
                    setProfile((p) => ({
                      ...p,
                      budget: Math.max(0, Number(e.target.value)),
                    }))
                  }
                />
              </label>
              <label>
                <span className="field-label">Zeitfenster (Tage)</span>
                <Input
                  type="number"
                  min="1"
                  max="365"
                  value={profile.window}
                  onChange={(e) =>
                    setProfile((p) => ({
                      ...p,
                      window: Math.max(1, Number(e.target.value)),
                    }))
                  }
                />
              </label>
              <label>
                <span className="field-label">Gewünschte Fundstücke</span>
                <Input
                  type="number"
                  min="1"
                  max="20"
                  value={profile.count}
                  onChange={(e) =>
                    setProfile((p) => ({
                      ...p,
                      count: Math.max(1, Math.min(20, Number(e.target.value))),
                    }))
                  }
                />
              </label>
            </fieldset>
            <label className="flex items-center gap-3 mt-5 text-xs leading-relaxed">
              <Switch
                aria-label="Automatische Entwurf-Übergabe"
                checked={profile.autoHandoff ?? false}
                disabled={!editable}
                onCheckedChange={(autoHandoff) =>
                  setProfile((p) => ({ ...p, autoHandoff }))
                }
              />
              Vollständige Demo-Fundstücke automatisch als ungeprüfte Entwürfe
              übernehmen.
            </label>
            <div className="mt-5">
              <DemoNote>
                Alle Fundstücke und Kosten sind Beispiele. Demo-Läufe verwenden
                feste lokale Inhalte; Profilfelder sind für die spätere
                Recherche-Konfiguration vorbereitet.
              </DemoNote>
            </div>
          </Section>
        </TabsContent>
      </Tabs>
    </div>
  );
}
