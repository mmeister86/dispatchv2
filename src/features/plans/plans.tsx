import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { Link } from "react-router-dom";
import { CalendarDays } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, Section, Status, EmptyState } from "@/components/shared";
import { addCivilDays, defaultSchedule } from "@/lib/time";
import { useGithubSourceProofClock } from "@/lib/github-source-proof";
const reasons: Record<string, string> = {
  UNVERIFIED_LINEAGE: "Quellenbezug nicht verifiziert",
  RESEARCH_REVIEW_REQUIRED:
    "Research benötigt eine gültige menschliche Bewertung",
  NO_SUITABLE_MATERIAL:
    "Keine passenden Entwürfe; Signale und Research ohne geprüften Entwurf werden nicht ergänzt",
  SOURCE_VALIDITY_BEFORE_SLOT:
    "Quellengültigkeit endet vor dem gewünschten Slot",
  SLOT_OCCUPIED: "Slot ist im Kalender belegt",
  AMBIGUOUS_LOCAL_TIME: "Doppelte lokale Uhrzeit übersprungen",
  NONEXISTENT_LOCAL_TIME: "Nicht existierende lokale Uhrzeit übersprungen",
  SLOT_IN_PAST: "Vergangener Slot übersprungen",
  ALREADY_PLANNED: "Entwurf bereits geplant",
  VERSION_PROPOSAL_LIMIT:
    "Vorschlagsgrenze für diese Version erreicht · neue Entwurfsversion erforderlich",
  ALREADY_PROPOSED:
    "Diese konkrete Version hat bereits einen offenen Vorschlag",
  SOURCE_MIX_MISMATCH: "Quellenmix passt nicht",
  TOPIC_MISMATCH: "Themenschwerpunkt passt nicht",
  ACCOUNT_OR_VERSION_MISMATCH: "Account-Zuordnung oder Version passt nicht",
  ACCOUNT_REAUTH_OR_CAPABILITY_REQUIRED:
    "Publishing-Zugang für den Account fehlt",
};
const states: Record<string, string> = {
  proposed: "Vorschlag",
  rejected: "Abgelehnt",
  expired: "Abgelaufen",
  version_changed: "Version geändert · neuen Vorschlag prüfen",
  conflict: "Slot inzwischen belegt",
  context_changed: "Früherer Kontext geändert · neuen Vorschlag prüfen",
  source_unavailable: "Quelle oder Publishing-Zugang nicht mehr verfügbar",
};
export function RealPlans() {
  const { state } = useStore();
  return (
    <PlanWorkspace
      key={`${state.activeWorkspaceId}:${state.activeAccountId}`}
      workspaceId={state.activeWorkspaceId as Id<"workspaces">}
      accountId={state.activeAccountId as Id<"socialAccounts">}
    />
  );
}
function PlanWorkspace({
  workspaceId,
  accountId,
}: {
  workspaceId: Id<"workspaces">;
  accountId: Id<"socialAccounts">;
}) {
  const context = useQuery(api.planning.plans.context, { workspaceId });
  if (context === undefined)
    return <p role="status">Planungsrahmen wird geladen…</p>;
  if (!context || !accountId)
    return (
      <EmptyState
        icon={<CalendarDays />}
        title="Planungsrahmen fehlt"
        description="Wähle einen vorhandenen Account und vervollständige dein Workspace-Profil."
      />
    );
  return (
    <PlanForm
      workspaceId={workspaceId}
      accountId={accountId}
      context={context}
    />
  );
}
function PlanForm({
  workspaceId,
  accountId,
  context,
}: {
  workspaceId: Id<"workspaces">;
  accountId: Id<"socialAccounts">;
  context: { preferenceId: Id<"preferences">; timezone: string };
}) {
  const { state } = useStore(),
    write = state.role !== "Viewer";
  const first = defaultSchedule(context.timezone).slice(0, 10);
  const [start, setStart] = useState(first),
    [end, setEnd] = useState(addCivilDays(first, 6)),
    [clock, setClock] = useState("10:00"),
    [timezone, setTimezone] = useState(context.timezone),
    [count, setCount] = useState(3),
    [mode, setMode] = useState<"work" | "research" | "mixed">("mixed"),
    [topics, setTopics] = useState("");
  const [selected, setSelected] = useState<Id<"contentPlans"> | null>(null),
    [busy, setBusy] = useState(false),
    [rejecting, setRejecting] = useState<Id<"contentPlanItems"> | null>(null),
    [error, setError] = useState("");
  const list = useQuery(api.planning.plans.list, { workspaceId, accountId });
  const detail = useQuery(
    api.planning.plans.get,
    selected ? { workspaceId, planId: selected } : "skip",
  );
  const propose = useMutation(api.planning.plans.propose),
    reject = useMutation(api.planning.plans.reject);
  const mounted = useRef(false),
    pending = useRef(false),
    currentRole = useRef(state.role);
  currentRole.current = state.role;
  const command = useRef({ fingerprint: "", key: crypto.randomUUID() });
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const proofClock = useGithubSourceProofClock(
    detail?.items.map((p) => ({
      authorized: true,
      proofExpiresAt: p.displayUntil,
    })) ?? [],
  );
  async function create() {
    if (!write || pending.current) return;
    const role = state.role;
    pending.current = true;
    setBusy(true);
    setError("");
    const request = {
      accountId,
      preferenceId: context.preferenceId,
      desiredCount: count,
      start,
      end,
      clock,
      timezone,
      mode,
      topics,
    };
    const fingerprint = JSON.stringify(request);
    if (command.current.fingerprint !== fingerprint)
      command.current = { fingerprint, key: crypto.randomUUID() };
    try {
      const id = await propose({
        workspaceId,
        ...request,
        commandKey: command.current.key,
      });
      if (mounted.current && currentRole.current === role) {
        setSelected(id);
        command.current = { fingerprint: "", key: crypto.randomUUID() };
      }
    } catch (e) {
      if (mounted.current && currentRole.current === role)
        setError(
          e instanceof ConvexError && e.data === "SLOT_SCAN_LIMIT"
            ? "Suchgrenze erreicht. Der Kalender oder die Entwurfshistorie kann in dieser begrenzten Suche nicht sicher geprüft werden. Deine Eingaben bleiben erhalten."
            : e instanceof ConvexError && e.data === "VERSION_PROPOSAL_LIMIT"
              ? "Vorschlagsgrenze für diese Version erreicht. Erstelle nach einer bewussten Überarbeitung eine neue Entwurfsversion. Deine Eingaben bleiben erhalten."
              : "Vorschläge wurden nicht bestätigt. Prüfe Zeitraum, Zeitzone, Account und deine Rolle. Deine Eingaben bleiben erhalten.",
        );
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function rejectItem(itemId: Id<"contentPlanItems">) {
    if (!write || pending.current) return;
    const role = state.role;
    pending.current = true;
    setRejecting(itemId);
    setError("");
    try {
      await reject({ workspaceId, itemId });
    } catch {
      if (mounted.current && currentRole.current === role)
        setError("Ablehnung wurde nicht bestätigt. Bitte erneut prüfen.");
    } finally {
      pending.current = false;
      if (mounted.current) setRejecting(null);
    }
  }
  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Planvorschläge"
        title="Aus deinen geprüften Entwürfen"
        description="Wähle konkrete vorhandene Versionen für freie Tagesfenster. Fehlendes Material bleibt sichtbar."
        actions={
          <Button variant="outline" asChild>
            <Link to="/calendar">Kalender öffnen</Link>
          </Button>
        }
      />
      <div className="content-grid">
        <div className="stack">
          <Section title="Dein redaktioneller Rahmen">
            <p className="text-xs muted">
              Account:{" "}
              {state.accounts.find((a) => a.id === accountId)?.name ??
                "Ausgewählter Account"}
              . Publishing-Zugang und Quellen werden beim Erstellen geprüft.
            </p>
            <fieldset
              disabled={!write || busy || !!rejecting}
              className="form-grid"
            >
              <label>
                <span className="field-label">Gewünschte Beiträge</span>
                <Input
                  type="number"
                  min={1}
                  max={7}
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                />
              </label>
              <label>
                <span className="field-label">Startdatum</span>
                <Input
                  type="date"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </label>
              <label>
                <span className="field-label">Enddatum</span>
                <Input
                  type="date"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </label>
              <label>
                <span className="field-label">Tägliche lokale Uhrzeit</span>
                <Input
                  type="time"
                  value={clock}
                  onChange={(e) => setClock(e.target.value)}
                />
              </label>
              <label>
                <span className="field-label">IANA-Zeitzone</span>
                <Input
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                />
              </label>
              <label>
                <span className="field-label">Quellenmix</span>
                <select
                  className="native-select"
                  value={mode}
                  onChange={(e) => setMode(e.target.value as typeof mode)}
                >
                  <option value="mixed">Arbeit + Research</option>
                  <option value="work">Nur Arbeitssignale</option>
                  <option value="research">Nur Research</option>
                </select>
              </label>
              <label>
                <span className="field-label">Themenschwerpunkt</span>
                <Input
                  value={topics}
                  onChange={(e) => setTopics(e.target.value)}
                  placeholder="Leer: Themen mischen; sonst exakte Entwurfsrubrik"
                />
              </label>
            </fieldset>
            <p className="text-[11px] muted mt-4">
              Eine Uhrzeit je Tag · höchstens 93 Tage und 7 Vorschläge · die
              letzten 25 Workspace-Entwürfe. Themenvielfalt bevorzugt; keine
              Reichweitenprognose oder KI-Generation.
            </p>
            <Button disabled={!write || busy || !!rejecting} onClick={create}>
              {busy ? "Vorschläge werden erstellt" : "Planvorschläge erstellen"}
            </Button>
            {error && (
              <p role="alert" className="text-xs mt-3">
                {error}
              </p>
            )}
          </Section>
          <Section title="Gespeicherte Pläne">
            {list === undefined ? (
              <p role="status">Pläne werden geladen…</p>
            ) : list.length ? (
              <div className="flex flex-wrap gap-2">
                {list.map((p) => (
                  <Button
                    key={p._id}
                    variant={selected === p._id ? "default" : "outline"}
                    onClick={() => setSelected(p._id)}
                  >
                    {p.selectedCount} von {p.desiredCount} Beiträgen · {p.start}
                  </Button>
                ))}
              </div>
            ) : (
              <p className="text-xs muted">
                Noch keine Planvorschläge für diesen Account.
              </p>
            )}
            <p className="text-[11px] muted mt-3">
              Letzte 25 Pläne für diesen Account.
            </p>
          </Section>
          {selected && detail === undefined && (
            <p role="status">Vorschläge werden geladen…</p>
          )}
          {detail && (
            <section>
              <h2>Vorschläge prüfen</h2>
              <p className="text-xs">
                {detail.plan.selectedCount} von {detail.plan.desiredCount}{" "}
                Beiträgen · {detail.plan.start} bis {detail.plan.end}
              </p>
              {detail.plan.historyContext ? (
                <p className="text-xs muted">
                  Bei Erstellung: {detail.plan.historyContext.available} von{" "}
                  {detail.plan.historyContext.scanned} früheren Terminen nutzbar
                  · {detail.plan.historyContext.unavailable} nicht nutzbar.
                  {detail.plan.historyContext.partial
                    ? " Ausschnitt: höchstens 10 Termine berücksichtigt."
                    : ""}{" "}
                  Themenvergleich, keine Aussage über Veröffentlichungserfolg.
                </p>
              ) : (
                <p className="text-xs muted">
                  Früherer Kontext dieses gespeicherten Plans ist nicht
                  dokumentiert.
                </p>
              )}
              {detail.plan.coveragePartial && (
                <p className="text-xs muted">
                  Ausschnitt: Nur die letzten 25 Workspace-Entwürfe wurden
                  geprüft.
                </p>
              )}
              {detail.plan.shortages.map((s) => (
                <p className="text-xs muted" key={s.code}>
                  {s.count} ×{" "}
                  {reasons[s.code] ??
                    "Entwurf oder Quelle aktuell nicht geeignet"}{" "}
                  <span className="text-[10px]">({s.code})</span>
                </p>
              ))}
              {!detail.items.length && (
                <EmptyState
                  icon={<CalendarDays />}
                  title="Keine passenden Entwürfe"
                  description="Ergänze oder prüfe bestehende Entwürfe und ihre Quellen. Es werden keine Fülltexte erzeugt."
                />
              )}
              <div className="space-y-4">
                {detail.items.map(
                  ({ item, title, text, state: status, displayUntil }) => {
                    const expired = displayUntil <= proofClock,
                      readable = !expired && !!title;
                    return (
                      <article className="surface p-5" key={item._id}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="text-sm mb-0">
                            {readable ? title : "Quelle nicht mehr lesbar"}
                          </h3>
                          <Status
                            tone={
                              expired || status !== "proposed"
                                ? "orange"
                                : "neutral"
                            }
                          >
                            {expired && status === "proposed"
                              ? "Abgelaufen"
                              : (states[status] ?? status)}
                          </Status>
                        </div>
                        <p className="text-[11px] muted mt-2">
                          Festgehaltene Version v{item.versionNumber} ·{" "}
                          {item.versionId}
                        </p>
                        {readable && (
                          <p className="text-xs whitespace-pre-wrap">
                            {text.join("\n\n")}
                          </p>
                        )}
                        <div className="rounded-md bg-background p-3 text-[11px] break-words">
                          <p>
                            {item.localTime} · {item.timezone}
                          </p>
                          <p>UTC: {new Date(item.at).toISOString()}</p>
                          <p>
                            Quellennachweis bis{" "}
                            {new Date(item.proofUntil).toISOString()} ·
                            Gültigkeitsgrenze bis{" "}
                            {new Date(item.validityUntil).toISOString()}
                          </p>
                          {item.sources.map((s, i) => (
                            <p key={i}>
                              {"kind" in s
                                ? `Research ${s.evidenceId} · Quelle ${s.sourceId} · Bewertung ${s.assessmentFingerprint ?? "fehlt"}`
                                : `Arbeit ${s.repositoryId} · Signal ${s.signalId ?? "Kontext"} · Generation ${s.generation}`}
                            </p>
                          ))}
                          {item.historyVersionIds && (
                            <p>
                              Kontext-Versionen:{" "}
                              {item.historyVersionIds.join(", ") ||
                                "keine nutzbaren früheren Termine"}
                              {item.contextProofUntil != null
                                ? ` · Nachweis bis ${new Date(item.contextProofUntil).toISOString()}`
                                : ""}
                            </p>
                          )}
                          <p>{item.reason}</p>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-3">
                          <Button variant="outline" size="sm" asChild>
                            <Link to={`/drafts/${item.draftId}`}>
                              Entwurf öffnen
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={
                              !write ||
                              busy ||
                              !!rejecting ||
                              item.status !== "proposed"
                            }
                            onClick={() => rejectItem(item._id)}
                          >
                            {rejecting === item._id
                              ? "Wird abgelehnt"
                              : "Ablehnen"}
                          </Button>
                        </div>
                      </article>
                    );
                  },
                )}
              </div>
            </section>
          )}
        </div>
        <aside className="stack">
          <Section title="Vorschläge sind noch keine Termine">
            <p className="text-xs leading-relaxed">
              Diese Auswahl reserviert keinen Slot. Freigabe und selektive
              Annahme werden separat ergänzt. Die spätere Aktion „Version
              freigeben und planen“ prüft konkrete Version, Quelle und Kalender
              erneut.
            </p>
            <Button disabled variant="outline">
              Slots annehmen · noch nicht verfügbar
            </Button>
          </Section>
          <Section title="Wiederkehrende Serien">
            <p className="text-xs muted">
              Serienplanung ist noch nicht verfügbar.
            </p>
          </Section>
        </aside>
      </div>
    </div>
  );
}
