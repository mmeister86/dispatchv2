import { useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarDays,
  Check,
  ArrowRight,
  ShieldCheck,
  Layers,
  Plus,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  PageHeader,
  Section,
  AccountSelect,
  Status,
  DemoNote,
  formatDate,
  EmptyState,
} from "@/components/shared";
import { useStore, useWorkspaceLocalState } from "@/lib/store";
import {
  uid,
  now,
  currentVersion,
  approveDraft,
  scheduleDraft,
  approved,
  canApprove,
  type Draft,
} from "@/lib/model";
import { defaultSchedule, resolveLocalTime } from "@/lib/time";
interface Proposal {
  id: string;
  draftId: string;
  at: string;
  reason: string;
  status: "proposed" | "accepted" | "rejected" | "expired";
}
export function PlansPage() {
  const { state, mutate } = useStore();
  const [proposals, setProposals] = useWorkspaceLocalState<Proposal[]>(
    "plan-proposals",
    [],
  );
  const [selection, setSelection] = useState<string[]>([]);
  const [account, setAccount] = useState(state.activeAccountId);
  const [count, setCount] = useState(3);
  const [date, setDate] = useState(
    defaultSchedule(state.preferences.timezone).slice(0, 10),
  );
  const [hour, setHour] = useState("09:30");
  const [source, setSource] = useState("mix");
  const [pillar, setPillar] = useState("Gemischt");
  const [series, setSeries] = useWorkspaceLocalState("content-series", {
    enabled: false,
    frequency: "weekly",
    name: "Building in public",
    end: "2026-12-31",
  });
  const review = canApprove(state.role);
  const write = state.role !== "Viewer";
  const propose = () => {
    if (!write) return;
    const start = resolveLocalTime(
      `${date}T${hour}`,
      state.preferences.timezone,
    );
    if (start.length !== 1 || new Date(start[0]).getTime() <= Date.now()) {
      toast.error("Bitte einen eindeutigen zukünftigen Startzeitpunkt wählen.");
      return;
    }
    const available = 3;
    const n = Math.min(count, available);
    const drafts: Draft[] = [];
    const next: Proposal[] = [];
    const seeds = [
      [
        "Die kleinen Produktentscheidungen",
        "Diese Woche haben wir drei kleine Abläufe vereinfacht.\n\nKein großes Feature. Aber weniger Reibung im Alltag.\n\nWas hast du zuletzt weggelassen?",
        "Arbeitssignal: Kalender-PR",
      ],
      [
        "Eine Erkenntnis aus den ersten Gesprächen",
        "Eine Erkenntnis aus unseren ersten Gesprächen: Menschen wünschen sich selten mehr Features. Sie wünschen sich weniger Arbeit.\n\nDarauf konzentrieren wir uns.",
        "Research: Produktentwicklung",
      ],
      [
        "Ein ehrlicher Wochenrückblick",
        "Diese Woche: ein kleiner Release, zwei schwierige Entscheidungen und viele Gespräche.\n\nDas Beste daran? Wir wissen jetzt klarer, was wir als Nächstes bauen.",
        "Manuelle Redaktionsnotiz",
      ],
    ];
    for (let i = 0; i < n; i++) {
      const id = uid("draft");
      const [title, text, origin] = seeds[i];
      drafts.push({
        id,
        workspaceId: state.activeWorkspaceId,
        accountId: account,
        title,
        versions: [
          {
            number: 1,
            text: [text],
            mediaIds: [],
            createdAt: now(),
            reason: "Lokaler Planvorschlag",
          },
        ],
        comments: [],
        reviewPolicy: state.reviewPolicies?.[state.activeWorkspaceId],
        strategy: "story",
        pillar:
          pillar === "Gemischt"
            ? i === 1
              ? "Learnings"
              : "Building in public"
            : pillar,
        source:
          source === "github"
            ? "GitHub · Demo-Quelle"
            : source === "research"
              ? "Research · Demo-Quelle"
              : origin,
      });
      const day = new Date(`${date}T12:00:00Z`);
      day.setUTCDate(day.getUTCDate() + i * 2);
      const at = resolveLocalTime(
        `${day.toISOString().slice(0, 10)}T${hour}`,
        state.preferences.timezone,
      )[0];
      next.push({
        id: uid("proposal"),
        draftId: id,
        at,
        reason:
          i === 0
            ? "Ein konkreter Blick auf deine Arbeit."
            : i === 1
              ? "Ein Learning zwischen zwei Produktgeschichten."
              : "Ein persönlicher Abschluss mit Abstand zum Release.",
        status: "proposed",
      });
    }
    if (!mutate((s) => ({ ...s, drafts: [...drafts, ...s.drafts] }))) return;
    setProposals((p) => [...next, ...p]);
    setSelection([]);
    toast.success(
      `${n} feste Demo-Vorschläge erstellt.${count > available ? " Mehr passende Inhalte liegen in diesem Beispiel nicht vor." : ""}`,
    );
  };
  const accept = () => {
    const selected = proposals.filter(
      (p) => selection.includes(p.id) && p.status === "proposed",
    );
    if (!selected.length) return;
    const accepted: string[] = [];
    const ok = mutate((s) => {
      let next = s;
      for (const p of selected) {
        if (new Date(p.at).getTime() <= Date.now())
          throw new Error(
            "Ein Slot ist inzwischen abgelaufen. Bitte neu vorschlagen.",
          );
        next = scheduleDraft(next, p.draftId, p.at);
        accepted.push(p.id);
      }
      return next;
    }, `${selected.length} ausgewählte Vorschläge im Demo-Kalender angenommen.`);
    if (ok) {
      setProposals((p) =>
        p.map((x) =>
          accepted.includes(x.id) ? { ...x, status: "accepted" } : x,
        ),
      );
      setSelection([]);
    }
  };
  const active = proposals.filter((p) => p.status !== "rejected");
  const acceptedCount = proposals.filter((p) => p.status === "accepted").length;
  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Planvorschläge"
        title="Eine Woche, die zu dir passt"
        description="Prüfe die Geschichten, gib konkrete Versionen frei und nimm nur die passenden Slots an."
        actions={
          <Button variant="outline" asChild>
            <Link to="/calendar">
              <CalendarDays size={15} />
              Kalender öffnen
            </Link>
          </Button>
        }
      />
      <div className="content-grid">
        <div className="stack">
          <Section
            title="Dein redaktioneller Rahmen"
            actions={<Layers size={16} className="muted" />}
          >
            <div className="form-grid">
              <AccountSelect value={account} onChange={setAccount} />
              <label>
                <span className="field-label">Gewünschte Beiträge</span>
                <Input
                  type="number"
                  min={1}
                  max={7}
                  value={count}
                  onChange={(e) =>
                    setCount(
                      Math.max(1, Math.min(7, Number(e.target.value) || 1)),
                    )
                  }
                />
              </label>
              <label>
                <span className="field-label">Startdatum</span>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </label>
              <label>
                <span className="field-label">
                  Lokales Zeitfenster · {state.preferences.timezone}
                </span>
                <Input
                  type="time"
                  value={hour}
                  onChange={(e) => setHour(e.target.value)}
                />
              </label>
              <label>
                <span className="field-label">Quellenmix</span>
                <select
                  className="native-select"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                >
                  <option value="mix">
                    Arbeit + Recherche + eigene Notizen
                  </option>
                  <option value="github">Arbeitssignale</option>
                  <option value="research">Recherche</option>
                </select>
              </label>
              <label>
                <span className="field-label">Themenschwerpunkt</span>
                <select
                  className="native-select"
                  value={pillar}
                  onChange={(e) => setPillar(e.target.value)}
                >
                  {[
                    "Gemischt",
                    "Building in public",
                    "Learnings",
                    "Produktupdates",
                  ].map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button disabled={!write} onClick={propose}>
                <Plus size={15} />
                Demo-Vorschläge erstellen
              </Button>
              <span className="text-[11px] muted">
                Bis zu 3 passende Beispiele · keine KI-Aufrufe
              </span>
            </div>
          </Section>
          <section>
            <div className="section-heading">
              <h2>Vorschläge prüfen</h2>
              {active.length > 0 && (
                <Status tone={acceptedCount ? "green" : "neutral"}>
                  {acceptedCount} angenommen ·{" "}
                  {active.filter((p) => p.status === "proposed").length} offen
                </Status>
              )}
            </div>
            {active.length ? (
              <div className="space-y-4">
                {active.map((p) => {
                  const d = state.drafts.find(
                    (d) =>
                      d.id === p.draftId &&
                      d.workspaceId === state.activeWorkspaceId,
                  );
                  if (!d) return null;
                  const past = new Date(p.at).getTime() <= Date.now();
                  return (
                    <article className="surface p-5" key={p.id}>
                      <div className="mb-3 flex items-start gap-3">
                        <Checkbox
                          aria-label={`Vorschlag ${d.title} auswählen`}
                          className="mt-1"
                          checked={selection.includes(p.id)}
                          disabled={p.status !== "proposed" || past || !review}
                          onCheckedChange={(checked) =>
                            setSelection((s) =>
                              checked
                                ? [...s, p.id]
                                : s.filter((id) => id !== p.id),
                            )
                          }
                        />
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                            <h3 className="mb-0 text-sm">{d.title}</h3>
                            <Status
                              tone={
                                p.status === "accepted"
                                  ? "green"
                                  : past
                                    ? "orange"
                                    : "neutral"
                              }
                            >
                              {p.status === "accepted"
                                ? "Termin angenommen"
                                : past
                                  ? "Slot abgelaufen"
                                  : "Vorschlag"}
                            </Status>
                          </div>
                          <span className="text-[10px] muted">
                            {d.source} · {d.pillar} · v
                            {currentVersion(d).number}
                          </span>
                        </div>
                      </div>
                      <p className="mb-4 whitespace-pre-wrap text-xs leading-relaxed">
                        {currentVersion(d).text.join("\n\n")}
                      </p>
                      <div className="mb-4 rounded-md bg-background p-3">
                        <span className="text-[11px]">
                          <Clock size={13} className="mr-1 inline" />
                          {formatDate(p.at, state.preferences.timezone)} ·{" "}
                          {state.preferences.timezone}
                        </span>
                        <p className="mt-2 mb-0 text-[10px] muted">
                          {p.reason}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <Status tone={approved(d) ? "green" : "orange"}>
                          {approved(d)
                            ? `v${currentVersion(d).number} freigegeben`
                            : "Inhaltsfreigabe fehlt"}
                        </Status>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" asChild>
                            <Link to={`/drafts/${d.id}`}>
                              Bearbeiten
                              <ArrowRight size={12} />
                            </Link>
                          </Button>
                          {p.status === "proposed" && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={!review || approved(d)}
                                onClick={() =>
                                  mutate(
                                    (s) => approveDraft(s, d.id),
                                    "Konkrete Version freigegeben. Noch kein Termin erzeugt.",
                                  )
                                }
                              >
                                <ShieldCheck size={13} />
                                Version freigeben
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={!write}
                                onClick={() => {
                                  setProposals((s) =>
                                    s.map((x) =>
                                      x.id === p.id
                                        ? { ...x, status: "rejected" }
                                        : x,
                                    ),
                                  );
                                  setSelection((s) =>
                                    s.filter((id) => id !== p.id),
                                  );
                                }}
                              >
                                Ablehnen
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="surface">
                <EmptyState
                  icon={<CalendarDays size={28} />}
                  title="Dein Plan beginnt mit einem Rahmen"
                  description="Wähle Account, Datum und Quellenmix. Vorschläge werden erst nach deiner Freigabe und Annahme zu Terminen."
                />
              </div>
            )}
          </section>
          {selection.length > 0 && (
            <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4 shadow-md">
              <div>
                <strong className="text-sm">
                  {selection.length} Vorschläge ausgewählt
                </strong>
                <p className="mt-1 mb-0 text-[10px] muted">
                  Nur ausgewählte, gültig freigegebene Versionen erhalten
                  Termine.
                </p>
              </div>
              <Button
                disabled={
                  !review ||
                  selection.some((id) => {
                    const p = proposals.find((p) => p.id === id);
                    const d = state.drafts.find((d) => d.id === p?.draftId);
                    return !d || !approved(d);
                  })
                }
                onClick={accept}
              >
                <Check size={15} />
                Ausgewählte Slots annehmen
              </Button>
            </div>
          )}
        </div>
        <aside className="stack">
          <Section title="Drei klare Entscheidungen">
            <ol className="space-y-5 pl-4 text-xs leading-relaxed">
              <li>
                <strong>Geschichte prüfen</strong>
                <p className="mt-1 mb-0 muted">
                  Passt der Entwurf zu dir und zu seiner Quelle?
                </p>
              </li>
              <li>
                <strong>Inhalt freigeben</strong>
                <p className="mt-1 mb-0 muted">
                  Für diese konkrete Version und diesen Account.
                </p>
              </li>
              <li>
                <strong>Slot annehmen</strong>
                <p className="mt-1 mb-0 muted">
                  Erst jetzt entsteht ein Termin im Kalender.
                </p>
              </li>
            </ol>
            <DemoNote>
              Wenn nur zwei von drei Vorschlägen passen, entstehen genau zwei
              Termine.
            </DemoNote>
          </Section>
          <Section title="Eine wiederkehrende Serie">
            <label className="mb-4 flex items-center gap-2 text-xs">
              <Checkbox
                checked={series.enabled}
                disabled={!write}
                onCheckedChange={(v) =>
                  setSeries((s) => ({ ...s, enabled: !!v }))
                }
              />
              Serienvorschläge vormerken
            </label>
            <label>
              <span className="field-label">Serie</span>
              <Input
                value={series.name}
                disabled={!write}
                onChange={(e) =>
                  setSeries((s) => ({ ...s, name: e.target.value }))
                }
              />
            </label>
            <label className="mt-4 block">
              <span className="field-label">Häufigkeit</span>
              <select
                className="native-select"
                value={series.frequency}
                disabled={!write}
                onChange={(e) =>
                  setSeries((s) => ({ ...s, frequency: e.target.value }))
                }
              >
                <option value="weekly">Wöchentlich</option>
                <option value="biweekly">Alle zwei Wochen</option>
                <option value="monthly">Monatlich</option>
              </select>
            </label>
            <label className="mt-4 block">
              <span className="field-label">Bis</span>
              <Input
                type="date"
                value={series.end}
                disabled={!write}
                onChange={(e) =>
                  setSeries((s) => ({ ...s, end: e.target.value }))
                }
              />
            </label>
            <p className="mt-4 mb-0 text-[10px] leading-relaxed muted">
              Lokale Planungspräferenz. Keine automatische Veröffentlichung oder
              verdeckte Freigabe.
            </p>
          </Section>
        </aside>
      </div>
    </div>
  );
}
