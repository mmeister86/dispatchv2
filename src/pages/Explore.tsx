import { useState } from "react";
import { demoMode } from "@/lib/auth-client";
import { RealExperiments } from "@/features/experiments/experiments";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  FlaskConical,
  Plus,
  Scissors,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  PageHeader,
  Section,
  Status,
  DemoNote,
  EmptyState,
} from "@/components/shared";
import { useStore, useWorkspaceLocalState } from "@/lib/store";
import { canEdit, uid } from "@/lib/model";
type Experiment = {
  id: string;
  title: string;
  hypothesis: string;
  metric: string;
  a: string;
  b: string;
  window: number;
  stop: string;
  status: "planned" | "running" | "stopped" | "completed";
  samples: number;
  resultA: number;
  resultB: number;
};
const freshExperiment: Experiment = {
  id: "",
  title: "",
  hypothesis: "",
  metric: "Interaktionsrate",
  a: "Persönliche Beobachtung",
  b: "Konkrete Frage",
  window: 14,
  stop: "Mindestens 20 Beiträge oder Ende des Zeitfensters",
  status: "planned",
  samples: 0,
  resultA: 0,
  resultB: 0,
};
export function ExperimentsPage() {
  return demoMode ? <DemoExperiments /> : <RealExperiments />;
}
function DemoExperiments() {
  const { state } = useStore();
  const editable = canEdit(state.role);
  const [experiments, setExperiments] = useWorkspaceLocalState<Experiment[]>(
    "experiments",
    [
      {
        ...freshExperiment,
        id: "experiment-1",
        title: "Fragen, die ein Gespräch eröffnen",
        hypothesis:
          "Eine konkrete Frage am Ende lädt häufiger zu einer Antwort ein.",
        status: "running",
        samples: 8,
        resultA: 4.2,
        resultB: 5.1,
      },
      {
        ...freshExperiment,
        id: "experiment-2",
        title: "Kleine Entscheidungen als Serie",
        hypothesis:
          "Eine zusammenhängende Serie erleichtert das Wiedererkennen.",
        a: "Einzelner Beitrag",
        b: "Beitrag in Serie",
        metric: "Antworten pro Beitrag",
        status: "planned",
      },
    ],
  );
  const [edit, setEdit] = useState<Experiment | null>(null);
  const [error, setError] = useState("");
  const change = (id: string, patch: Partial<Experiment>) => {
    if (editable)
      setExperiments((es) =>
        es.map((e) => (e.id === id ? { ...e, ...patch } : e)),
      );
  };
  function save() {
    if (!editable || !edit) return;
    if (
      !edit.title.trim() ||
      !edit.hypothesis.trim() ||
      !edit.a.trim() ||
      !edit.b.trim() ||
      !edit.stop.trim()
    ) {
      setError(
        "Titel, Hypothese, beide Varianten und Stop-Bedingung ausfüllen.",
      );
      return;
    }
    setExperiments((es) =>
      es.some((e) => e.id === edit.id)
        ? es.map((e) => (e.id === edit.id ? edit : e))
        : [{ ...edit, id: uid("experiment") }, ...es],
    );
    setEdit(null);
    setError("");
  }
  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Neugier mit Methode"
        title="Experimente"
        description="Eine klare Frage. Zwei Perspektiven. Etwas, das du daraus lernen kannst."
        actions={
          <Button
            disabled={!editable}
            onClick={() => {
              setEdit({ ...freshExperiment });
              setError("");
            }}
          >
            <Plus size={15} />
            Experiment anlegen
          </Button>
        }
      />
      <DemoNote>
        Experimente verwenden synthetische Ergebnisse. Keine automatische
        Veröffentlichung, Optimierung oder zufällige Zuweisung von Beiträgen.
      </DemoNote>
      <div className="space-y-5 mt-6">
        {experiments.map((e) => (
          <Section
            key={e.id}
            title={e.title}
            actions={
              <Status tone={e.status === "running" ? "green" : "neutral"}>
                {
                  {
                    planned: "Geplant",
                    running: "Läuft",
                    stopped: "Gestoppt",
                    completed: "Abgeschlossen",
                  }[e.status]
                }
              </Status>
            }
          >
            <p className="text-sm leading-relaxed max-w-3xl">
              <span className="muted">Hypothese:</span> {e.hypothesis}
            </p>
            <div className="grid gap-6 md:grid-cols-[1fr_1fr_.8fr]">
              <div className="border-t pt-4">
                <span className="eyebrow">Variante A</span>
                <h3 className="text-sm mt-2">{e.a}</h3>
                <p className="text-2xl font-semibold mb-1">
                  {e.samples
                    ? `${e.resultA.toFixed(1)}${e.metric === "Interaktionsrate" ? " %" : ""}`
                    : "—"}
                </p>
                <span className="text-[11px] muted">
                  {Math.floor(e.samples / 2)} Demo-Beiträge
                </span>
              </div>
              <div className="border-t pt-4">
                <span className="eyebrow">Variante B</span>
                <h3 className="text-sm mt-2">{e.b}</h3>
                <p className="text-2xl font-semibold mb-1">
                  {e.samples
                    ? `${e.resultB.toFixed(1)}${e.metric === "Interaktionsrate" ? " %" : ""}`
                    : "—"}
                </p>
                <span className="text-[11px] muted">
                  {Math.ceil(e.samples / 2)} Demo-Beiträge
                </span>
              </div>
              <div className="border-t pt-4 text-xs leading-relaxed">
                <span className="field-label">Rahmen</span>
                {e.metric}
                <br />
                {e.window} Tage Beobachtung
                <p className="muted mt-2 mb-0">Stop: {e.stop}</p>
              </div>
            </div>
            <div className="bg-secondary/60 p-3 rounded-md my-5 text-xs leading-relaxed">
              {e.samples
                ? "Noch keine belastbare Aussage. Die Demo-Unterschiede können durch Zufall, Thema oder Uhrzeit entstehen."
                : "Definiere vor dem Start eine Baseline und prüfe, ob die Varianten nur den beabsichtigten Unterschied enthalten."}{" "}
              {e.samples > 0 &&
                `Stichprobe n = ${e.samples}; keine Signifikanzberechnung, kein Gewinner.`}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!editable}
                onClick={() => {
                  setEdit({ ...e });
                  setError("");
                }}
              >
                Bearbeiten
              </Button>
              {e.status === "planned" && (
                <Button
                  size="sm"
                  disabled={!editable}
                  onClick={() => change(e.id, { status: "running" })}
                >
                  Experiment starten
                </Button>
              )}
              {e.status === "running" && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!editable}
                    onClick={() =>
                      change(e.id, {
                        samples: e.samples + 4,
                        resultA: 4.2,
                        resultB: 5.1,
                      })
                    }
                  >
                    Demo-Ergebnisse ergänzen
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={!editable}
                    onClick={() => change(e.id, { status: "stopped" })}
                  >
                    Stoppen
                  </Button>
                </>
              )}
              {e.status === "stopped" && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!editable}
                  onClick={() => change(e.id, { status: "running" })}
                >
                  Fortsetzen
                </Button>
              )}
              {["running", "stopped"].includes(e.status) && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={!editable}
                  onClick={() => change(e.id, { status: "completed" })}
                >
                  Auswertung abschließen
                </Button>
              )}
            </div>
          </Section>
        ))}
      </div>
      {!experiments.length && (
        <EmptyState
          icon={<FlaskConical />}
          title="Welche Frage möchtest du beantworten?"
          description="Starte mit einer Hypothese, die du mit deinen eigenen Inhalten überprüfen kannst."
        />
      )}
      <Dialog
        open={!!edit}
        onOpenChange={(open) => {
          if (!open) setEdit(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {edit?.id
                ? "Experiment bearbeiten"
                : "Eine Frage zum Experiment machen"}
            </DialogTitle>
            <DialogDescription>
              Definiere Varianten und Stop-Bedingung, bevor du Ergebnisse
              vergleichst.
            </DialogDescription>
          </DialogHeader>
          {edit && (
            <div className="space-y-4">
              <label className="block">
                <span className="field-label">Titel</span>
                <Input
                  value={edit.title}
                  onChange={(ev) =>
                    setEdit({ ...edit, title: ev.target.value })
                  }
                />
              </label>
              <label className="block">
                <span className="field-label">Hypothese</span>
                <Textarea
                  aria-label="Hypothese"
                  value={edit.hypothesis}
                  onChange={(ev) =>
                    setEdit({ ...edit, hypothesis: ev.target.value })
                  }
                />
              </label>
              <div className="form-grid">
                <label>
                  <span className="field-label">Variante A</span>
                  <Input
                    value={edit.a}
                    onChange={(ev) => setEdit({ ...edit, a: ev.target.value })}
                  />
                </label>
                <label>
                  <span className="field-label">Variante B</span>
                  <Input
                    value={edit.b}
                    onChange={(ev) => setEdit({ ...edit, b: ev.target.value })}
                  />
                </label>
                <label>
                  <span className="field-label">Zielmetrik</span>
                  <select
                    aria-label="Zielmetrik"
                    className="native-select"
                    value={edit.metric}
                    onChange={(ev) =>
                      setEdit({ ...edit, metric: ev.target.value })
                    }
                  >
                    <option>Interaktionsrate</option>
                    <option>Antworten pro Beitrag</option>
                    <option>Link-Klicks pro Beitrag</option>
                  </select>
                </label>
                <label>
                  <span className="field-label">
                    Beobachtungsfenster (Tage)
                  </span>
                  <Input
                    type="number"
                    min="1"
                    max="90"
                    value={edit.window}
                    onChange={(ev) =>
                      setEdit({
                        ...edit,
                        window: Math.max(
                          1,
                          Math.min(90, Number(ev.target.value)),
                        ),
                      })
                    }
                  />
                </label>
              </div>
              <label className="block">
                <span className="field-label">Stop-Bedingung</span>
                <Input
                  value={edit.stop}
                  onChange={(ev) => setEdit({ ...edit, stop: ev.target.value })}
                />
              </label>
              {error && (
                <p className="text-destructive text-xs" role="alert">
                  {error}
                </p>
              )}
              <Button disabled={!editable} onClick={save}>
                Experiment speichern
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
const excerptSections = [
  {
    id: "observation",
    title: "Die Beobachtung",
    text: "Menschen wünschen sich selten mehr Features. Sie wünschen sich weniger Arbeit.",
  },
  {
    id: "decision",
    title: "Die Entscheidung",
    text: "Wir haben drei Funktionen gestrichen und einen Ablauf vereinfacht. Das Ergebnis fühlt sich besser an.",
  },
  {
    id: "learning",
    title: "Das Learning",
    text: "Ein klarer nächster Schritt ist mehr wert als zehn Optionen. Gute Produkte respektieren deine Zeit.",
  },
];
export function RepurposePage() {
  const { state, createDraft } = useStore();
  const editable = canEdit(state.role);
  const navigate = useNavigate();
  const [input, setInput] = useWorkspaceLocalState("repurpose-input", "");
  const [permission, setPermission] = useWorkspaceLocalState(
    "repurpose-permission",
    false,
  );
  const [sections, setSections] = useWorkspaceLocalState<string[]>(
    "repurpose-sections",
    ["observation", "learning"],
  );
  const [loaded, setLoaded] = useWorkspaceLocalState("repurpose-loaded", false);
  const [handoffs, setHandoffs] = useWorkspaceLocalState<
    Record<string, string>
  >("repurpose-handoffs", {});
  const [error, setError] = useState("");
  const [kind, setKind] = useWorkspaceLocalState("repurpose-kind", "text");
  const accounts = state.accounts.filter(
    (a) => a.workspaceId === state.activeWorkspaceId,
  );
  const [chosen, setChosen] = useState(
    accounts.filter((a) => a.connected).map((a) => a.id),
  );
  const [reviewed, setReviewed] = useState<string[]>([]);
  const sourceText = sections
    .map((id) => excerptSections.find((s) => s.id === id)?.text ?? "")
    .join("\n\n");
  function load() {
    if (!editable || !input.trim() || !permission) return;
    if (kind === "url") {
      try {
        const url = new URL(input);
        if (!["http:", "https:"].includes(url.protocol)) throw new Error();
      } catch {
        setError("Bitte eine gültige HTTP- oder HTTPS-URL eingeben.");
        return;
      }
    }
    setError("");
    setLoaded(true);
    setHandoffs({});
    setReviewed([]);
  }
  async function handoff(accountId: string) {
    if (!editable || !permission || !sourceText) return;
    const key = `${accountId}-${sections.join("-")}`;
    const existing = handoffs[key];
    if (existing && state.drafts.some((d) => d.id === existing)) {
      navigate(`/drafts/${existing}`);
      return;
    }
    const account = accounts.find((a) => a.id === accountId);
    if (!account) return;
    const text =
      account.channel === "LinkedIn"
        ? `${sourceText}\n\nWelche kleine Entscheidung hat dein Produkt zuletzt einfacher gemacht?`
        : sourceText.slice(0, 250);
    const id = await createDraft(
      `Repurpose · ${account.channel} · Gute Produkte respektieren Zeit`,
      text,
      `Repurpose → ${kind === "url" ? input : "Eigener Text: " + input.slice(0, 300)} · feste Demo-Auszüge (${sections.join(", ")}) · Nutzungsrecht vom Nutzer bestätigt · separater Review erforderlich`,
      accountId,
    );
    if (id) {
      setHandoffs((h) => ({ ...h, [key]: id }));
      navigate(`/drafts/${id}`);
    }
  }
  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Aus einem Gedanken wird mehr"
        title="Repurpose"
        description="Eine Geschichte. Mehrere passende Perspektiven."
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="space-y-5">
          <Section
            title="Deine Ausgangsgeschichte"
            description="Text oder URL als lokale Referenz. URLs werden nicht abgerufen."
          >
            <div className="flex gap-2 mb-4">
              <Button
                variant={kind === "text" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setKind("text")}
              >
                Text einfügen
              </Button>
              <Button
                variant={kind === "url" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setKind("url")}
              >
                URL hinterlegen
              </Button>
            </div>
            <label className="block">
              <span className="field-label">
                {kind === "url" ? "Quellen-URL" : "Dein Text"}
              </span>
              <Textarea
                aria-label={kind === "url" ? "Quellen-URL" : "Dein Text"}
                value={input}
                disabled={!editable}
                onChange={(e) => {
                  setInput(e.target.value);
                  setPermission(false);
                  setLoaded(false);
                }}
                rows={7}
                placeholder={
                  kind === "url"
                    ? "https://example.com/deine-geschichte"
                    : "Ein Blogartikel, eine Notiz oder ein Gedanke…"
                }
              />
            </label>
            <label className="flex gap-3 items-start text-xs leading-relaxed mt-4">
              <Checkbox
                checked={permission}
                disabled={!editable}
                onCheckedChange={(v) => setPermission(v === true)}
                aria-label="Nutzungsrecht bestätigen"
              />
              <span>
                Ich habe die nötigen Rechte, diesen Inhalt für meine eigenen
                Beiträge zu verwenden.
              </span>
            </label>
            {error && (
              <p className="text-destructive text-xs mt-3" role="alert">
                {error}
              </p>
            )}
            <Button
              className="mt-5"
              disabled={!editable || !permission || !input.trim()}
              onClick={load}
            >
              <Scissors size={14} />
              Demo-Auszüge vorbereiten
            </Button>
          </Section>
          {loaded && (
            <Section
              title="Welche Gedanken möchtest du weitertragen?"
              description="Feste Beispielauszüge; dein eingefügter Inhalt wird nicht automatisch analysiert."
            >
              <div className="space-y-4">
                {excerptSections.map((s) => (
                  <label
                    key={s.id}
                    className="flex gap-3 items-start border-b last:border-0 pb-4 last:pb-0"
                  >
                    <Checkbox
                      aria-label={`${s.title} auswählen`}
                      disabled={!editable}
                      checked={sections.includes(s.id)}
                      onCheckedChange={(v) => {
                        setSections((list) =>
                          v === true
                            ? [...list, s.id]
                            : list.filter((id) => id !== s.id),
                        );
                        setReviewed([]);
                      }}
                    />
                    <span>
                      <b className="text-sm">{s.title}</b>
                      <span className="block text-xs muted leading-relaxed mt-2">
                        {s.text}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </Section>
          )}
        </div>
        <Section
          title="Für jeden Kanal eine eigene Perspektive"
          description="Prüfe jede Variante separat, bevor du sie im Editor weiterbearbeitest."
        >
          {loaded ? (
            <>
              <div className="p-3 bg-secondary rounded-md text-xs leading-relaxed mb-5">
                <b>Inhaltliche Überlappung</b>
                <p className="muted mt-1 mb-0">
                  Alle Varianten nutzen dieselben Demo-Auszüge. Zeitlich nahe
                  Veröffentlichungen können sich wiederholen. Passe Einstieg und
                  Kontext pro Kanal an.
                </p>
              </div>
              <div className="space-y-5">
                {accounts.map((account) => {
                  const included = chosen.includes(account.id);
                  return (
                    <article
                      key={account.id}
                      className="border-b last:border-0 pb-5"
                    >
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <label className="flex gap-2 items-center text-sm font-semibold">
                          <Checkbox
                            aria-label={`${account.channel} auswählen`}
                            checked={included}
                            onCheckedChange={(v) =>
                              setChosen((ids) =>
                                v === true
                                  ? [...ids, account.id]
                                  : ids.filter((id) => id !== account.id),
                              )
                            }
                          />
                          {account.channel}
                        </label>
                        <Status>{account.handle}</Status>
                      </div>
                      {included && (
                        <>
                          <p className="whitespace-pre-wrap text-sm leading-relaxed">
                            {sourceText ||
                              "Wähle mindestens einen Abschnitt aus."}
                            {account.channel === "LinkedIn" && sourceText
                              ? "\n\nWelche kleine Entscheidung hat dein Produkt zuletzt einfacher gemacht?"
                              : ""}
                          </p>
                          <label className="flex gap-2 items-center text-xs mb-3">
                            <Checkbox
                              aria-label={`${account.channel} separat geprüft`}
                              checked={reviewed.includes(account.id)}
                              disabled={!editable || !sourceText}
                              onCheckedChange={(v) =>
                                setReviewed((ids) =>
                                  v === true
                                    ? [...ids, account.id]
                                    : ids.filter((id) => id !== account.id),
                                )
                              }
                            />
                            Diese Variante ist separat geprüft.
                          </label>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={
                              !editable ||
                              !permission ||
                              !sections.length ||
                              !reviewed.includes(account.id)
                            }
                            onClick={() => handoff(account.id)}
                          >
                            <Plus size={13} />
                            {handoffs[`${account.id}-${sections.join("-")}`]
                              ? "Entwurf öffnen"
                              : "Entwurf erstellen"}
                          </Button>
                        </>
                      )}
                    </article>
                  );
                })}
              </div>
            </>
          ) : (
            <EmptyState
              icon={<Scissors size={25} />}
              title="Mehr aus einer guten Geschichte machen"
              description="Hinterlege zuerst deinen Ausgangstext und bestätige das Nutzungsrecht. Danach kannst du Demo-Abschnitte auswählen."
            />
          )}
        </Section>
      </div>
      <div className="mt-6">
        <DemoNote>
          Keine externe Analyse, keine automatische Veröffentlichung.
          Quellenreferenz und gewählte Abschnitte bleiben am Entwurf erhalten.
          Jeder Entwurf benötigt seine eigene Freigabe.
        </DemoNote>
      </div>
    </div>
  );
}
type Comparison = {
  topicA: string;
  topicB: string;
  accountA: string;
  accountB: string;
  window: number;
  threshold: number;
};
export function TrendsPage() {
  const { state } = useStore();
  const editable = canEdit(state.role);
  const accounts = state.accounts.filter(
    (a) => a.workspaceId === state.activeWorkspaceId,
  );
  const [config, setConfig] = useWorkspaceLocalState<Comparison>(
    "trend-comparison",
    {
      topicA: "Produktdesign",
      topicB: "Build in public",
      accountA: accounts[0]?.id ?? "",
      accountB: accounts[1]?.id ?? accounts[0]?.id ?? "",
      window: 30,
      threshold: 20,
    },
  );
  const [backtest, setBacktest] = useWorkspaceLocalState(
    "trend-backtest",
    false,
  );
  const [editing, setEditing] = useState(false);
  const [comparison, setComparison] = useWorkspaceLocalState<Comparison | null>(
    "trend-result",
    null,
  );
  const show = comparison ?? config;
  const a = [42, 47, 43, 51, 56, 60, 54];
  const b = [34, 39, 45, 38, 43, 45, 49];
  function line(values: number[]) {
    return values.map((v, i) => `${45 + i * 78},${190 - v * 2}`).join(" ");
  }
  const patch = (value: Partial<Comparison>) => {
    if (editable) setConfig((c) => ({ ...c, ...value }));
  };
  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Signale mit Abstand betrachten"
        title="Trends"
        description="Was sich verändert. Was nur wie Veränderung aussieht."
        actions={
          <>
            <Button
              variant="outline"
              disabled={!editable}
              onClick={() => setEditing((v) => !v)}
            >
              Vergleich bearbeiten
            </Button>
            <Button
              disabled={!editable}
              onClick={() => {
                setComparison({ ...config });
                setEditing(false);
              }}
            >
              Demo-Vergleich erstellen
            </Button>
          </>
        }
      />
      {editing && (
        <Section
          title="Dein Vergleich"
          description="Die Konfiguration wird lokal gespeichert. Kurven bleiben festes Demo-Material."
        >
          <fieldset disabled={!editable} className="form-grid">
            <label>
              <span className="field-label">Thema A</span>
              <Input
                value={config.topicA}
                onChange={(e) => patch({ topicA: e.target.value })}
              />
            </label>
            <label>
              <span className="field-label">Thema B</span>
              <Input
                value={config.topicB}
                onChange={(e) => patch({ topicB: e.target.value })}
              />
            </label>
            {(["accountA", "accountB"] as const).map((key, i) => (
              <label key={key}>
                <span className="field-label">
                  Account {i === 0 ? "A" : "B"}
                </span>
                <select
                  aria-label={`Account ${i === 0 ? "A" : "B"}`}
                  className="native-select"
                  value={config[key]}
                  onChange={(e) => patch({ [key]: e.target.value })}
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.channel} · {a.handle}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <label>
              <span className="field-label">Beobachtungsfenster (Tage)</span>
              <Input
                type="number"
                min="7"
                max="90"
                value={config.window}
                onChange={(e) =>
                  patch({
                    window: Math.min(90, Math.max(7, Number(e.target.value))),
                  })
                }
              />
            </label>
            <label>
              <span className="field-label">Demo-Signalschwelle (%)</span>
              <Input
                type="number"
                min="1"
                max="100"
                value={config.threshold}
                onChange={(e) =>
                  patch({
                    threshold: Math.min(
                      100,
                      Math.max(1, Number(e.target.value)),
                    ),
                  })
                }
              />
            </label>
          </fieldset>
        </Section>
      )}
      <div className="surface p-4 flex flex-wrap justify-between gap-3 my-6">
        <span className="text-sm">
          <b>{show.topicA}</b> vs. <b>{show.topicB}</b>
          <span className="muted"> · {show.window} Tage</span>
        </span>
        <Status tone="orange">Synthetischer Vergleich</Status>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(240px,1fr)]">
        <Section
          title="Aufmerksamkeit im Vergleich"
          description="Relativer Demo-Index (0–100), sieben Messpunkte. Kein Suchvolumen und keine Prognose."
        >
          <svg
            viewBox="0 0 560 240"
            className="w-full"
            role="img"
            aria-label={`${show.topicA}: Index 42 bis 54. ${show.topicB}: Index 34 bis 49. Synthetische Werte.`}
          >
            {[0, 25, 50, 75].map((n) => (
              <g key={n}>
                <line
                  x1="40"
                  x2="530"
                  y1={190 - n * 2}
                  y2={190 - n * 2}
                  stroke="currentColor"
                  opacity=".1"
                />
                <text x="6" y={194 - n * 2} fontSize="11" fill="currentColor">
                  {n}
                </text>
              </g>
            ))}
            <polyline
              points={line(a)}
              fill="none"
              stroke="#b65332"
              strokeWidth="3"
            />
            <polyline
              points={line(b)}
              fill="none"
              stroke="#778b6b"
              strokeWidth="3"
            />
            {a.map((_, i) => (
              <text
                key={i}
                x={45 + i * 78}
                y="222"
                textAnchor="middle"
                fontSize="10"
                fill="currentColor"
              >
                T−{Math.round((show.window * (6 - i)) / 6)}
              </text>
            ))}
          </svg>
          <div className="flex flex-wrap gap-5 text-xs">
            <span>
              <span className="inline-block bg-[#b65332] h-2 w-2 rounded-full mr-2" />
              {show.topicA} ·{" "}
              {accounts.find((a) => a.id === show.accountA)?.channel}
            </span>
            <span>
              <span className="inline-block bg-[#778b6b] h-2 w-2 rounded-full mr-2" />
              {show.topicB} ·{" "}
              {accounts.find((a) => a.id === show.accountB)?.channel}
            </span>
          </div>
        </Section>
        <Section title="Ein Signal ist eine Frage">
          <Status tone="orange">
            {show.threshold <= 28 ? "Mögliches Signal" : "Unter Signalschwelle"}
          </Status>
          <h2 className="text-xl leading-snug mt-5">
            Mehr Aufmerksamkeit ist noch kein Trend.
          </h2>
          <p className="muted text-sm leading-relaxed">
            Der feste Demo-Index für {show.topicA} steigt um rund 29 %. Einzelne
            Beiträge und eine kleine Stichprobe können den Verlauf verzerren.
          </p>
          <p className="text-xs leading-relaxed border-t pt-4 mb-0">
            Demo-Stichprobe: 14 Beobachtungen. Accounts unterscheiden sich in
            Publikum und Reichweite. Der Vergleich erlaubt keine kausale
            Aussage.
          </p>
        </Section>
      </div>
      <div className="grid gap-6 lg:grid-cols-2 mt-6">
        <Section
          title="Was gegen das Signal spricht"
          description="Gegenargumente gehören zum Vergleich."
        >
          <ul className="text-sm leading-7 list-disc pl-5 mb-0">
            <li>Ein einzelner Beitrag kann mehrere Messpunkte prägen.</li>
            <li>Kleine Ausgangswerte vergrößern relative Veränderungen.</li>
            <li>
              Unterschiedliche Zielgruppen erschweren den Account-Vergleich.
            </li>
          </ul>
        </Section>
        <Section
          title="Rückblick statt Vorhersage"
          actions={
            <Button
              variant="outline"
              size="sm"
              disabled={!editable}
              onClick={() => setBacktest((v) => !v)}
            >
              {backtest ? "Rückblick ausblenden" : "Demo-Backtest anzeigen"}
            </Button>
          }
        >
          {backtest ? (
            <>
              <div className="flex items-center gap-3 mb-4">
                <TrendingUp size={18} />
                <b className="text-sm">
                  3 von 5 Demo-Signalen waren Fehlalarme.
                </b>
              </div>
              <p className="muted text-xs leading-relaxed">
                Feste Beispieldaten: zwei Signale blieben vier Wochen sichtbar,
                drei verschwanden. Das ist keine Gütebewertung eines echten
                Modells. Die Signalschwelle ist für diesen Demo-Rückblick nicht
                optimiert.
              </p>
              <Status tone="orange">n = 5 · hohe Unsicherheit</Status>
            </>
          ) : (
            <p className="muted text-sm leading-relaxed mb-0">
              Prüfe frühere Signale, bevor du einer aktuellen Bewegung Gewicht
              gibst. Der lokale Demo-Backtest zeigt bewusst auch Fehlalarme.
            </p>
          )}
        </Section>
      </div>
      <div className="mt-6">
        <DemoNote>
          Alle Kurven und Rückblicke sind lokale Beispiele. Nutze die
          Beobachtung als Recherchefrage. Es werden keine Trends recherchiert
          oder zukünftige Ergebnisse vorhergesagt.
        </DemoNote>
      </div>
      <div className="mt-5 flex flex-wrap gap-5 text-xs font-semibold">
        <Link to="/research" className="hover:text-primary">
          Quellen prüfen <ArrowUpRight size={12} className="inline" />
        </Link>
        <Link to="/experiments" className="hover:text-primary">
          Eine Hypothese testen <ArrowUpRight size={12} className="inline" />
        </Link>
      </div>
    </div>
  );
}
