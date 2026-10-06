import { PerformanceContext } from "@/features/signals/performance";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader, Section, Status, EmptyState } from "@/components/shared";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useGithubSourceProofClock } from "@/lib/github-source-proof";
export function ideaError(e: unknown) {
  const s = e instanceof Error ? e.message : String(e);
  if (s.includes("RESEARCH_CONTENT_GENERATION_NOT_CONFIGURED"))
    return "Quellengebundene Research-Generation ist noch nicht freigegeben. Übergib die geprüften Angaben manuell als ungeprüften Entwurf; eine Publishing-Freigabe bleibt separat erforderlich.";
  if (s.includes("CLARIFICATION_REQUIRED"))
    return "Modellinterpretationen und unbelegte Angaben müssen vor der Entwurfsübergabe ausdrücklich geklärt werden.";
  if (s.includes("REVISION_CONFLICT"))
    return "Diese Idee wurde inzwischen geändert. Der Eingabepuffer bleibt erhalten; öffne die aktuelle Version erneut.";
  if (s.includes("HANDOFF_ALREADY_BOUND"))
    return "Diese Idee ist bereits an eine andere Version oder Account-Auswahl gebunden. Öffne den vorhandenen Entwurf; er wird nicht ersetzt.";
  if (s.includes("SOURCE"))
    return "Die Quellenfreigabe ist geändert oder abgelaufen. Prüfe die Quelle erneut; historische Belege erteilen keine neue Freigabe.";
  if (
    s.includes("CONFIGURATION") ||
    s.includes("BUDGET") ||
    s.includes("PURPOSE")
  )
    return "Generation benötigt einen freigegebenen EU-Verarbeitungspfad, nachgewiesene Preise und gültige Workspace-/Account-Budgets. Manuelle Ideen bleiben verfügbar.";
  if (s.includes("CAPABILITY"))
    return "Der Text passt nicht zu den Account-Grenzen. Kürze ihn oder speichere den Entwurf zunächst ohne Account.";
  if (s.includes("OPERATION_CONFLICT"))
    return "Eine frühere Anfrage mit dieser Kennung hatte andere Eingaben. Prüfe die gespeicherten Ideen vor einer neuen Anfrage.";
  return "Die Aktion wurde nicht bestätigt. Eingaben bleiben erhalten; prüfe deine Rolle und versuche es erneut.";
}
export function RealIdeas() {
  const { state } = useStore();
  return (
    <IdeaWorkspace
      key={state.activeWorkspaceId}
      workspaceId={state.activeWorkspaceId as Id<"workspaces">}
    />
  );
}
function IdeaWorkspace({ workspaceId }: { workspaceId: Id<"workspaces"> }) {
  const { state } = useStore(),
    nav = useNavigate();
  const [params] = useSearchParams();
  const linkedId = params.get("idea");
  const linked = useQuery(
    api.content.ideas.get,
    linkedId ? { workspaceId, ideaId: linkedId } : "skip",
  );
  const [clarified, setClarified] = useState(false);
  const [historyCursor, setHistoryCursor] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null),
    [filter, setFilter] = useState("new"),
    [query, setQuery] = useState(""),
    [open, setOpen] = useState(false),
    [selected, setSelected] = useState<{
      idea: Doc<"ideas">;
      version: Doc<"ideaVersions">;
    } | null>(null),
    [mode, setMode] = useState<"edit" | "handoff" | "generate">("edit");
  const [title, setTitle] = useState(""),
    [note, setNote] = useState(""),
    [perspective, setPerspective] = useState(""),
    [priority, setPriority] = useState<"low" | "normal" | "high">("normal"),
    [intent, setIntent] = useState(""),
    [draftText, setDraftText] = useState(""),
    [account, setAccount] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const contextSnapshot = `${state.role}:${state.activeAccountId}`;
  const latestContext = useRef(contextSnapshot);
  latestContext.current = contextSnapshot;
  const mounted = useRef(false),
    pending = useRef(false),
    operation = useRef(crypto.randomUUID());
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const list = useQuery(api.content.ideas.list, {
      workspaceId,
      paginationOpts: { numItems: 25, cursor },
    }),
    availability = useQuery(api.ai.runs.availability, { workspaceId });
  const create = useMutation(api.content.ideas.create),
    edit = useMutation(api.content.ideas.edit),
    archive = useMutation(api.content.ideas.archive),
    handoff = useMutation(api.content.ideas.handoff),
    generate = useMutation(api.content.ideas.generate),
    stopRun = useMutation(api.ai.runs.stop);
  const runs = useQuery(
    api.content.ideas.generationStatus,
    selected ? { workspaceId, ideaId: selected.idea._id } : "skip",
  );
  const feedback = useQuery(
    api.content.ideas.feedback,
    selected
      ? {
          workspaceId,
          ideaId: selected.idea._id,
          paginationOpts: { numItems: 10, cursor: null },
        }
      : "skip",
  );
  const history = useQuery(
    api.content.ideas.history,
    selected
      ? {
          workspaceId,
          ideaId: selected.idea._id,
          paginationOpts: { numItems: 10, cursor: historyCursor },
        }
      : "skip",
  );
  const protectedVersions = [
    ...(list?.page.map((r) => r.version) ?? []),
    ...(linked ? [linked.version] : []),
    ...(history?.page ?? []),
    ...(selected ? [selected.version] : []),
  ];
  const proofClock = useGithubSourceProofClock(
    protectedVersions
      .filter((v) => v.sourceProofUntil !== undefined)
      .map((v) => ({
        authorized: !v.sourceUnavailable,
        proofExpiresAt: v.sourceProofUntil!,
      })),
  );
  const unavailable = (v: Doc<"ideaVersions">) =>
    v.sourceUnavailable ||
    (v.sourceProofUntil !== undefined && v.sourceProofUntil <= proofClock);
  const selectedLive = selected
    ? [linked, ...(list?.page ?? [])].find(
        (r) => r?.idea._id === selected.idea._id,
      )
    : null;
  useEffect(() => {
    if (
      selected &&
      (unavailable(selected.version) || selectedLive?.version.sourceUnavailable)
    ) {
      setSelected(null);
      setTitle("");
      setNote("");
      setPerspective("");
      setDraftText("");
      setIntent("");
      setOpen(false);
      setMessage(
        "Die Quellenfreigabe ist abgelaufen oder geändert. Geschützte Inhalte wurden ausgeblendet.",
      );
    }
  }, [selected, selectedLive?.version.sourceUnavailable, proofClock]);
  const write = state.role !== "Viewer";
  async function command(fn: () => Promise<unknown>, success: () => void) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
      if (mounted.current && latestContext.current === contextSnapshot)
        success();
    } catch (e) {
      if (mounted.current && latestContext.current === contextSnapshot)
        setError(ideaError(e));
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  function begin(row: NonNullable<typeof selected>, next: typeof mode) {
    setSelected(row);
    setHistoryCursor(null);
    setMode(next);
    setTitle(row.version.title);
    setNote(row.version.note);
    setPerspective(row.version.perspective);
    setPriority(row.version.priority);
    setIntent("");
    setClarified(false);
    setDraftText(
      row.version.originals.length
        ? row.version.originals.join("\n\n")
        : `Nutzerangabe (noch zu prüfen): ${row.version.note}`,
    );
    setAccount(state.activeAccountId);
    setError("");
    operation.current = crypto.randomUUID();
  }
  const rows = (
    linkedId
      ? linked
        ? [linked]
        : []
      : (list?.page.filter(
          (r) =>
            (filter === "all" || r.idea.status === filter) &&
            `${r.version.title} ${r.version.perspective} ${r.version.note}`
              .toLowerCase()
              .includes(query.toLowerCase()),
        ) ?? [])
  ).filter((r) => !unavailable(r.version));
  return (
    <div className="fade-in stack">
      <PageHeader
        eyebrow="Ideenbibliothek"
        title="Hier beginnt die Geschichte"
        description="Originale, eigene Angaben und Perspektiven bleiben nachvollziehbar getrennt."
        actions={
          <Button
            disabled={!write || busy}
            onClick={() => {
              setTitle("");
              setNote("");
              setPerspective("");
              setPriority("normal");
              setError("");
              operation.current = crypto.randomUUID();
              setOpen(true);
            }}
          >
            Idee festhalten
          </Button>
        }
      />
      <PerformanceContext workspaceId={workspaceId} />
      <div className="flex flex-wrap gap-2">
        {[
          ["new", "Neue Ideen"],
          ["accepted", "Übernommen"],
          ["archived", "Archiv"],
          ["all", "Alle"],
        ].map(([value, label]) => (
          <Button
            key={value}
            variant={filter === value ? "secondary" : "ghost"}
            onClick={() => setFilter(value)}
          >
            {label}
          </Button>
        ))}
        <Input
          aria-label="Ideen durchsuchen"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <p className="text-xs muted">
        Jev ist deaktiviert. Manuelle Notizen und Entwürfe benötigen keinen
        Modellzugang.{" "}
        {availability?.processingApproved && availability.pricingApproved
          ? "Generation prüft bei jeder Anfrage die konkreten Freigaben und Budgets."
          : "Generation wartet auf EU-Verarbeitung, Preise und gültige Budgets."}
      </p>
      {linkedId && linked === null && (
        <p role="status">
          Die verlinkte Idee ist in diesem Workspace nicht verfügbar.{" "}
          <Link to="/ideas">Ideenbibliothek öffnen</Link>
        </p>
      )}
      {!list || (linkedId && linked === undefined) ? (
        <p role="status">Ideen werden geladen …</p>
      ) : !rows.length ? (
        <EmptyState
          title="Noch Raum für neue Gedanken"
          description="Halte eine eigene Idee fest oder übernimm ein aktuell freigegebenes Signal."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => (
            <Section key={row.idea._id} title={row.version.title}>
              <Status>
                {row.idea.status === "accepted"
                  ? "In Redaktion"
                  : row.idea.status === "archived"
                    ? "Archiviert"
                    : "Neue Perspektive"}{" "}
                · Priorität {row.version.priority}
              </Status>
              <p className="text-xs muted">
                Version {row.version.number} · Quelle:{" "}
                {row.version.source.kind === "signal"
                  ? "Signiertes GitHub-Ereignis"
                  : row.version.source.kind === "context"
                    ? "Signierter Push mit menschlich freigegebenen Patch-Auszügen"
                    : row.version.source.kind === "research"
                      ? "Recherche · ungeprüfte Review"
                      : row.version.source.kind === "context-set"
                        ? "Gebundene Quellen aus dem persönlichen Chat"
                        : "Manuelle Notiz"}
              </p>
              {row.version.originals.map((o, i) => (
                <p key={i} className="text-sm">
                  Originalfakt: {o}
                </p>
              ))}
              {row.version.note && (
                <p className="text-sm">
                  Nutzerangabe · ungeprüft: {row.version.note}
                </p>
              )}
              <p className="text-sm">
                {row.version.runId
                  ? "Modellinterpretation · Klärung erforderlich"
                  : "Eigene Perspektive"}
                : {row.version.perspective || "Noch offen"}
              </p>
              {row.version.rationale && (
                <p className="text-sm">
                  Begründung der Interpretation: {row.version.rationale}
                </p>
              )}
              {row.version.questions.map((q, i) => (
                <p key={i} className="text-sm">
                  Offene Frage: {q}
                </p>
              ))}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  disabled={!write || busy}
                  onClick={() => begin(row, "edit")}
                >
                  Bearbeiten
                </Button>
                {row.idea.handoff ? (
                  <Button asChild variant="outline">
                    <Link to={`/drafts/${row.idea.handoff.draftId}`}>
                      Entwurf öffnen · Ideenversion{" "}
                      {row.idea.handoff.ideaVersionId === row.version._id
                        ? row.version.number
                        : "historisch"}
                    </Link>
                  </Button>
                ) : (
                  <Button
                    disabled={!write || busy || row.idea.status === "archived"}
                    onClick={() => begin(row, "handoff")}
                  >
                    Zum Entwurf
                  </Button>
                )}
                <Button
                  variant="outline"
                  disabled={!write || busy || row.idea.status === "archived"}
                  onClick={() => begin(row, "generate")}
                >
                  Perspektive vorschlagen
                </Button>
                <Button
                  variant="ghost"
                  disabled={!write || busy}
                  onClick={() =>
                    void command(
                      () =>
                        archive({
                          workspaceId,
                          ideaId: row.idea._id,
                          expectedRevision: row.idea.revision,
                          archived: row.idea.status !== "archived",
                          feedback:
                            row.idea.status === "archived"
                              ? "Aus Archiv wiederhergestellt"
                              : "Idee ausdrücklich archiviert",
                        }),
                      () => setMessage("Ideenstatus gespeichert."),
                    )
                  }
                >
                  {row.idea.status === "archived"
                    ? "Wiederherstellen"
                    : "Archivieren"}
                </Button>
              </div>
            </Section>
          ))}
        </div>
      )}
      {list && (
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={!cursor}
            onClick={() => setCursor(null)}
          >
            Neueste Ideen
          </Button>
          <Button
            variant="outline"
            disabled={list.isDone}
            onClick={() => setCursor(list.continueCursor)}
          >
            Ältere Ideen
          </Button>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      <Dialog
        open={open || !!selected}
        onOpenChange={(v) => {
          if (!busy && !v) {
            setOpen(false);
            setSelected(null);
            setError("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {!selected
                ? "Eine Idee festhalten"
                : mode === "edit"
                  ? "Idee überarbeiten"
                  : mode === "handoff"
                    ? "Editierbaren Entwurf erstellen"
                    : "Begründete Perspektive vorschlagen"}
            </DialogTitle>
            <DialogDescription>
              {mode === "handoff" && selected
                ? "Prüfe den Text und bestätige deine konkrete Absicht. Es entstehen keine Freigabe und kein Termin."
                : "Eigene Angaben gelten als ungeprüfte Nutzerangaben. Modellinterpretationen erfordern menschliche Klärung."}
            </DialogDescription>
          </DialogHeader>
          {(!selected || mode === "edit") && (
            <>
              <label>
                <span className="field-label">Titel</span>
                <Input
                  disabled={busy}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={200}
                />
              </label>
              <label>
                <span className="field-label">Eigene Angaben (ungeprüft)</span>
                <Textarea
                  disabled={busy}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={4000}
                />
              </label>
              <label>
                <span className="field-label">Perspektive</span>
                <Textarea
                  disabled={busy}
                  value={perspective}
                  onChange={(e) => setPerspective(e.target.value)}
                  maxLength={2000}
                />
              </label>
              <label>
                <span className="field-label">Priorität</span>
                <select
                  className="native-select"
                  disabled={busy}
                  value={priority}
                  onChange={(e) =>
                    setPriority(e.target.value as typeof priority)
                  }
                >
                  <option value="low">Niedrig</option>
                  <option value="normal">Normal</option>
                  <option value="high">Hoch</option>
                </select>
              </label>
            </>
          )}
          {selected?.version.runId && mode === "handoff" && (
            <label className="flex gap-2 text-sm">
              <input
                type="checkbox"
                checked={clarified}
                disabled={busy}
                onChange={(e) => setClarified(e.target.checked)}
              />
              Modellinterpretation und unbelegte Angaben geklärt; nur geprüften
              Text übernehmen.
            </label>
          )}
          {selected && mode === "handoff" && (
            <label>
              <span className="field-label">
                Entwurfstext · Angaben und Interpretation vor Übernahme prüfen
              </span>
              <Textarea
                disabled={busy}
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
              />
            </label>
          )}
          {selected && (mode === "handoff" || mode === "generate") && (
            <label>
              <span className="field-label">Zielaccount</span>
              <select
                className="native-select"
                value={account}
                disabled={busy}
                onChange={(e) => setAccount(e.target.value)}
              >
                <option value="">Ohne Account (manueller Entwurf)</option>
                {state.accounts
                  .filter((a) => a.workspaceId === workspaceId)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
              </select>
            </label>
          )}
          {selected && (
            <label>
              <span className="field-label">
                {mode === "edit"
                  ? "Änderungsfeedback"
                  : "Konkrete Absicht / geklärte Angaben"}
              </span>
              <Textarea
                disabled={busy}
                value={intent}
                onChange={(e) => setIntent(e.target.value)}
                maxLength={1000}
              />
            </label>
          )}
          {selected && mode === "generate" && (
            <>
              <p className="text-xs muted">
                Eine neue Idee enthält Originalbelege, ungeprüfte Nutzerangaben,
                eine getrennte Interpretation und offene Fragen. Ein
                tatsächliches Ergebnis erscheint erst nach gespeichertem Lauf.
              </p>
              {runs?.map((r) => (
                <div key={r.runId}>
                  <p role="status">
                    Lauf {r.state}
                    {r.resultIdeaId
                      ? " · neue Idee gespeichert"
                      : " · kein gespeichertes Ergebnis"}
                  </p>
                  {(r.state === "ready" || r.state === "running") && (
                    <Button
                      variant="outline"
                      disabled={!write || busy}
                      onClick={() =>
                        void command(
                          () => stopRun({ workspaceId, runId: r.runId }),
                          () =>
                            setMessage(
                              "Abbruch gespeichert. Ein spätes Ergebnis erzeugt keine neue Idee.",
                            ),
                        )
                      }
                    >
                      Generierung abbrechen
                    </Button>
                  )}
                </div>
              ))}
            </>
          )}
          {selected && mode === "edit" && history && (
            <details>
              <summary>Unveränderliche Ideenversionen</summary>
              {history.page
                .filter((v) => !unavailable(v))
                .map((v) => (
                  <div className="border-t py-2" key={v._id}>
                    <p className="text-xs">
                      Version {v.number}: {v.title}
                    </p>
                    <p className="text-xs muted">
                      {v.source.kind === "signal"
                        ? "Signiertes Ereignis"
                        : v.source.kind === "context"
                          ? "Freigegebene Patch-Auszüge"
                          : v.source.kind === "research"
                            ? "Recherche · ungeprüfte Review"
                            : v.source.kind === "context-set"
                              ? "Gebundene Chat-Quellen"
                              : "Manuelle Notiz"}{" "}
                      ·{" "}
                      {v.runId
                        ? "Modellinterpretation, Klärung erforderlich"
                        : "Eigene Perspektive"}
                    </p>
                    {v.originals.map((o, i) => (
                      <p className="text-xs" key={i}>
                        Originalfakt: {o}
                      </p>
                    ))}
                    <p className="text-xs">Nutzerangabe: {v.note}</p>
                    <p className="text-xs">Perspektive: {v.perspective}</p>
                  </div>
                ))}
              <Button
                variant="outline"
                size="sm"
                disabled={history.isDone}
                onClick={() => setHistoryCursor(history.continueCursor)}
              >
                Ältere Ideenversionen
              </Button>
            </details>
          )}
          {selected &&
            mode === "edit" &&
            feedback?.page.map((f) => (
              <p key={f._id} className="text-xs muted">
                Feedback ({f.kind}): {f.text}
              </p>
            ))}
          {error && <p role="alert">{error}</p>}
          <DialogFooter>
            <Button
              disabled={
                !write ||
                busy ||
                (!selected && !title.trim()) ||
                (!!selected &&
                  (mode === "edit"
                    ? !title.trim() || !intent.trim()
                    : !intent.trim() ||
                      (mode === "handoff"
                        ? !draftText.trim() ||
                          (!!selected.version.runId && !clarified)
                        : !account)))
              }
              onClick={() =>
                void command(
                  async () => {
                    if (!selected)
                      await create({
                        workspaceId,
                        title,
                        note,
                        perspective,
                        priority,
                        source: { kind: "note" },
                        operationKey: operation.current,
                      });
                    else if (mode === "edit")
                      await edit({
                        workspaceId,
                        ideaId: selected.idea._id,
                        expectedRevision: selected.idea.revision,
                        title,
                        note,
                        perspective,
                        priority,
                        feedback: intent,
                      });
                    else if (mode === "handoff") {
                      const r = await handoff({
                        workspaceId,
                        ideaId: selected.idea._id,
                        expectedRevision: selected.idea.revision,
                        accountId: (account as Id<"socialAccounts">) || null,
                        intent,
                        draftText,
                        clarificationConfirmed: clarified,
                      });
                      if (
                        mounted.current &&
                        latestContext.current === contextSnapshot
                      )
                        nav(`/drafts/${r.draftId}`);
                    } else
                      await generate({
                        workspaceId,
                        ideaId: selected.idea._id,
                        expectedRevision: selected.idea.revision,
                        accountId: account as Id<"socialAccounts">,
                        intent,
                        operationKey: operation.current,
                      });
                  },
                  () => {
                    if (selected && mode === "generate")
                      setMessage(
                        "Lauf gespeichert. Eine Ausgabe gilt erst nach erfolgreicher Persistenz als Idee.",
                      );
                    else {
                      setOpen(false);
                      setSelected(null);
                      setTitle("");
                      setNote("");
                      setPerspective("");
                      setMessage("Gespeichert.");
                    }
                  },
                )
              }
            >
              {busy
                ? "Wird gespeichert …"
                : selected && mode === "handoff"
                  ? "Text geprüft · Entwurf erstellen"
                  : selected && mode === "generate"
                    ? "Vorschlag anfordern"
                    : "Idee speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
