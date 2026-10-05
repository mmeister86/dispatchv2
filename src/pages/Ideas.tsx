import { demoMode } from "@/lib/auth-client";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Plus,
  ArrowRight,
  Lightbulb,
  GitPullRequest,
  Radio,
  Search,
  Archive,
  Check,
  Code2,
  GitCommit,
  MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  PageHeader,
  Section,
  Status,
  EmptyState,
  DemoNote,
} from "@/components/shared";
import { useStore, useWorkspaceLocalState } from "@/lib/store";
import { uid, type Idea } from "@/lib/model";
export function IdeasPage() {
  const { state, setState, ideaToDraft } = useStore();
  const nav = useNavigate();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("new");
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const write = state.role !== "Viewer";
  const ideas = state.ideas.filter(
    (i) =>
      i.workspaceId === state.activeWorkspaceId &&
      (filter === "all" || i.status === filter) &&
      `${i.title} ${i.description}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Ideenbibliothek"
        title="Hier beginnt die Geschichte"
        description="Sammle Gedanken, die mehr erzählen als ein Changelog."
        actions={
          <Button disabled={!write} onClick={() => setOpen(true)}>
            <Plus size={15} />
            Idee festhalten
          </Button>
        }
      />
      <div className="mb-5 flex flex-wrap justify-between gap-3">
        <div className="flex gap-1">
          {[
            ["new", "Neue Ideen"],
            ["accepted", "Übernommen"],
            ["archived", "Archiv"],
            ["all", "Alle"],
          ].map(([v, label]) => (
            <Button
              key={v}
              size="sm"
              variant={filter === v ? "secondary" : "ghost"}
              onClick={() => setFilter(v)}
            >
              {label}
            </Button>
          ))}
        </div>
        <Input
          className="max-w-xs"
          aria-label="Ideen durchsuchen"
          placeholder="Ideen durchsuchen …"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {ideas.map((i) => (
          <article key={i.id} className="surface flex flex-col p-5">
            <div className="mb-5 flex justify-between gap-3">
              <Status tone={i.status === "accepted" ? "green" : "neutral"}>
                {i.status === "new"
                  ? "Neue Perspektive"
                  : i.status === "accepted"
                    ? "In Redaktion"
                    : "Archiviert"}
              </Status>
              <Lightbulb size={16} className="muted" />
            </div>
            <span className="eyebrow mb-2">{i.pillar}</span>
            <h2 className="mb-3 text-lg leading-snug">{i.title}</h2>
            <p className="mb-5 flex-1 text-xs leading-relaxed muted">
              {i.description}
            </p>
            <div className="mb-4 border-t pt-3 text-[10px] muted">
              Quelle: {i.source}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!write}
                onClick={async () => {
                  const id = await ideaToDraft(i);
                  if (id) nav(`/drafts/${id}`);
                }}
              >
                {i.draftId ? "Entwurf öffnen" : "Zum Entwurf"}
                <ArrowRight size={13} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={
                  i.status === "archived"
                    ? "Idee wiederherstellen"
                    : "Idee archivieren"
                }
                disabled={!write}
                onClick={() =>
                  setState((s) => ({
                    ...s,
                    ideas: s.ideas.map((x) =>
                      x.id === i.id
                        ? {
                            ...x,
                            status:
                              i.status === "archived" ? "new" : "archived",
                          }
                        : x,
                    ),
                  }))
                }
              >
                <Archive size={14} />
              </Button>
            </div>
          </article>
        ))}
      </div>
      {!ideas.length && (
        <EmptyState
          icon={<Lightbulb size={28} />}
          title="Noch Raum für neue Gedanken"
          description="Halte eine eigene Idee fest oder übernimm einen Impuls aus Signalen und Recherche."
          action={
            <Button variant="outline" asChild>
              <Link to="/signals">Signale erkunden</Link>
            </Button>
          }
        />
      )}
      <div className="mt-6">
        <DemoNote>
          Eine Idee anzunehmen oder zum Entwurf zu machen erteilt keine
          Inhaltsfreigabe und erzeugt keinen Termin.
        </DemoNote>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eine Idee festhalten</DialogTitle>
            <DialogDescription>
              Ein Satz reicht für den Anfang. Kontext kannst du später ergänzen.
            </DialogDescription>
          </DialogHeader>
          <label>
            <span className="field-label">Titel</span>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Was möchtest du erzählen?"
            />
          </label>
          <label>
            <span className="field-label">Gedanke & Perspektive</span>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Warum ist das für deine Zielgruppe interessant?"
            />
          </label>
          <DialogFooter>
            <Button
              disabled={!title.trim()}
              onClick={() => {
                setState((s) => ({
                  ...s,
                  ideas: [
                    {
                      id: uid("idea"),
                      workspaceId: s.activeWorkspaceId,
                      title: title.trim(),
                      description: description.trim(),
                      source: "Manuelle Notiz",
                      pillar: "Persönlich",
                      status: "new",
                    },
                    ...s.ideas,
                  ],
                }));
                setTitle("");
                setDescription("");
                setOpen(false);
              }}
            >
              Idee speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
const signalSeed = [
  {
    id: "1",
    title: "Kalenderansicht aufgeräumt",
    type: "Pull Request",
    source: "dispatch/calendar · PR #128",
    desc: "Vier kleine Verbesserungen: schnellere Terminwahl, klarere Status und ein Klick weniger.",
    context:
      "Die Änderung zeigt eine konkrete Produktentscheidung. Erzähle lieber die Motivation als die Implementierungsdetails.",
    relevance: 91,
    novelty: "Neue Perspektive",
    confidence: "Hoch",
    private: false,
    status: "new",
    icon: GitPullRequest,
  },
  {
    id: "2",
    title: "Release v0.8 ist bereit",
    type: "Release",
    source: "dispatch · v0.8.0",
    desc: "Der neue Composer ist veröffentlicht. Thread-Reihenfolge und Versionsvergleich sind überarbeitet.",
    context:
      "Ein Release-Anlass mit persönlicher Geschichte: Was war überraschend schwierig?",
    relevance: 87,
    novelty: "Aktuell",
    confidence: "Hoch",
    private: false,
    status: "new",
    icon: Radio,
  },
  {
    id: "3",
    title: "Fehlermeldungen verständlicher gemacht",
    type: "Commit",
    source: "dispatch · commit a2d71ef",
    desc: "Sieben neue Fehlermeldungen erklären den nächsten Schritt statt nur ein Problem zu melden.",
    context: "Eine kleine Änderung mit gutem Lernwert für andere Builder.",
    relevance: 74,
    novelty: "Wiederkehrendes Thema",
    confidence: "Mittel",
    private: true,
    status: "new",
    icon: GitCommit,
  },
  {
    id: "4",
    title: "Abhängigkeiten aktualisiert",
    type: "Commit",
    source: "dispatch · maintenance",
    desc: "Routine-Update ohne eigenständige Nutzergeschichte.",
    context:
      "Wartungsrauschen. Zusammen mit einem größeren Anlass erneut prüfen.",
    relevance: 18,
    novelty: "Wartung",
    confidence: "Hoch",
    private: false,
    status: "processed",
    icon: Code2,
  },
  {
    id: "5",
    title: "Diskussion: weniger Einstellungen",
    type: "Discussion",
    source: "dispatch · Discussion #42",
    desc: "Drei Nutzer wünschen sich bessere Defaults statt weiterer Konfiguration.",
    context:
      "Die Diskussion verbindet Kundenfeedback mit einer nachvollziehbaren Produktentscheidung.",
    relevance: 85,
    novelty: "Neue Perspektive",
    confidence: "Mittel",
    private: false,
    status: "new",
    icon: MessageCircle,
  },
  {
    id: "6",
    title: "Issue: Speicherfehler im Browser",
    type: "Issue",
    source: "dispatch · Issue #140",
    desc: "Signal bleibt verfügbar, aber die automatische Anreicherung ist im Beispiel fehlgeschlagen.",
    context:
      "Demo-Ausfall. Originalereignis erhalten, Interpretation manuell ergänzen.",
    relevance: 0,
    novelty: "Nicht angereichert",
    confidence: "Unbekannt",
    private: true,
    status: "failed",
    icon: Code2,
  },
];
export function SignalsPage() {
  return demoMode ? <DemoSignalsPage /> : <GithubSignalsGuide />;
}
function DemoSignalsPage() {
  const { state, setState } = useStore();
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  const [decisions, setDecisions] = useWorkspaceLocalState<
    Record<string, { status: string; ideaId?: string }>
  >("signals", {});
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [showProcessed, setShowProcessed] = useState(false);
  const selected = signalSeed.find((s) => s.id === params.get("signal"));
  const filtered = signalSeed.filter(
    (s) =>
      (type === "all" || s.type === type) &&
      `${s.title} ${s.source}`.toLowerCase().includes(query.toLowerCase()) &&
      (showProcessed || (decisions[s.id]?.status ?? s.status) !== "processed"),
  );
  const write = state.role !== "Viewer";
  const transfer = (s: (typeof signalSeed)[number]) => {
    const existing = decisions[s.id]?.ideaId;
    if (existing) {
      nav("/ideas");
      return;
    }
    const id = uid("idea");
    const idea: Idea = {
      id,
      workspaceId: state.activeWorkspaceId,
      title: s.title,
      description: s.context,
      source: `GitHub · ${s.source}`,
      pillar: "Building in public",
      status: "new",
    };
    setState((st) => ({ ...st, ideas: [idea, ...st.ideas] }));
    setDecisions((d) => ({ ...d, [s.id]: { status: "accepted", ideaId: id } }));
    nav("/ideas");
  };
  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Aus deiner Arbeit"
        title="Signale mit Substanz"
        description="Nicht jeder Commit ist eine Geschichte. Hier entscheidest du, was relevant wird."
        actions={
          <Button variant="outline" asChild>
            <Link to="/settings/integrations">Quellen verwalten</Link>
          </Button>
        }
      />
      <div className="mb-5 flex flex-wrap gap-3">
        <label className="relative min-w-60 flex-1">
          <Search size={14} className="absolute left-3 top-3 muted" />
          <Input
            aria-label="Signale durchsuchen"
            className="pl-9"
            placeholder="Titel, Repository oder Ereignis …"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select
          className="native-select w-auto"
          aria-label="Signaltyp"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="all">Alle Ereignisse</option>
          {["Pull Request", "Release", "Commit", "Discussion", "Issue"].map(
            (v) => (
              <option key={v}>{v}</option>
            ),
          )}
        </select>
        <Button
          variant={showProcessed ? "secondary" : "outline"}
          onClick={() => setShowProcessed((v) => !v)}
        >
          Wartung & verarbeitete
        </Button>
      </div>
      <div className="content-grid">
        <section className="surface divide-y">
          {filtered.map((s) => (
            <button
              key={s.id}
              className="flex w-full gap-4 p-5 text-left hover:bg-muted/40"
              onClick={() => setParams({ signal: s.id })}
            >
              <s.icon size={20} className="mt-1 shrink-0 text-[#6c7e5e]" />
              <div className="flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="mb-1 text-sm">{s.title}</h3>
                  <Status tone={s.relevance > 80 ? "green" : "neutral"}>
                    {s.status === "failed"
                      ? "Anreicherung fehlgeschlagen"
                      : `${s.relevance} · Relevanz`}
                  </Status>
                </div>
                <span className="text-[10px] muted">
                  {s.source} · {s.private ? "Privater Kontext" : "Öffentlich"} ·
                  Demo
                </span>
                <p className="mt-3 mb-2 text-xs leading-relaxed muted">
                  {s.desc}
                </p>
                <div className="flex gap-2">
                  <Status>{s.type}</Status>
                  <Status>
                    {decisions[s.id]?.status === "accepted"
                      ? "Übernommen"
                      : decisions[s.id]?.status === "processed"
                        ? "Verarbeitet"
                        : s.novelty}
                  </Status>
                </div>
              </div>
            </button>
          ))}
          {!filtered.length && (
            <EmptyState
              title="Keine passenden Signale"
              description="Ändere die Filter oder die Auswahl deiner überwachten Repositories."
            />
          )}
        </section>
        <aside className="stack">
          {selected ? (
            <Section title={selected.title}>
              <p className="text-[11px] muted">{selected.source}</p>
              <h4 className="text-xs font-semibold">Originalereignis</h4>
              <p className="text-xs leading-relaxed">{selected.desc}</p>
              <h4 className="text-xs font-semibold">
                Redaktionelle Perspektive
              </h4>
              <p className="text-xs leading-relaxed muted">
                {selected.context}
              </p>
              <div className="mb-4 flex flex-wrap gap-2">
                <Status>Sicherheit: {selected.confidence}</Status>
                {selected.private && (
                  <Status tone="orange">Privater Kontext</Status>
                )}
              </div>
              <DemoNote>
                Feste synthetische Signale. Keine GitHub-Zugriffe und keine
                KI-Anreicherung.
              </DemoNote>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={!write}
                  onClick={() => transfer(selected)}
                >
                  {decisions[selected.id]?.ideaId
                    ? "Idee öffnen"
                    : "Als Idee übernehmen"}
                  <ArrowRight size={13} />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!write}
                  onClick={() =>
                    setDecisions((d) => ({
                      ...d,
                      [selected.id]: { ...d[selected.id], status: "processed" },
                    }))
                  }
                >
                  <Check size={13} />
                  Verarbeitet
                </Button>
              </div>
            </Section>
          ) : (
            <Section title="Was macht ein gutes Signal?">
              <p className="text-xs leading-relaxed muted">
                Eigene Arbeit, konkrete Veränderung und eine nachvollziehbare
                Perspektive. Wähle ein Ereignis für Kontext und Übergabe in die
                Redaktion.
              </p>
              <DemoNote>
                Wartungsrauschen bleibt erhalten und lässt sich mit dem Filter
                wieder einblenden.
              </DemoNote>
            </Section>
          )}
        </aside>
      </div>
    </div>
  );
}

function GithubSignalsGuide() {
  const { state } = useStore();
  const sources = useQuery(api.integrations.github.repositories.list, {
    workspaceId: state.activeWorkspaceId as Id<"workspaces">,
  });
  return (
    <div className="fade-in">
      <EmptyState
        title="GitHub-Signale werden noch nicht eingelesen"
        description="Die Quellen-Auswahl ist verfügbar. Echte Ereignisse erscheinen nach Aktivierung der verifizierten Signal-Ingestion; hier werden keine Beispieldaten oder erfundenen Bewertungen angezeigt."
        action={
          <Button variant="outline" asChild>
            <Link to="/settings/integrations">
              Repository-Quellen verwalten
            </Link>
          </Button>
        }
      />
      {sources?.repositories.map((r) => (
        <p key={r._id} className="text-sm">
          {r.fullName} · {r.private ? "Privat" : "Öffentlich"} · Monitoring{" "}
          {r.monitoring ? "freigegeben" : "aus"} · Content{" "}
          {r.content ? "freigegeben" : "aus"}
        </p>
      ))}
    </div>
  );
}
