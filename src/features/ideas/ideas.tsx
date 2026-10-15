import { PerformanceContext } from "@/features/signals/performance";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useAction, useConvex } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { useNativeCommand } from "@/features/drafts/review";
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
import { demoMode } from "@/lib/auth-client";
import { useGithubSourceProofClock } from "@/lib/github-source-proof";
export function ideaError(e: unknown) {
  const s = e instanceof Error ? e.message : String(e);
  if (s.includes("STYLE_"))
    return "Der gebundene Account-Stil ist geändert oder nicht mehr verfügbar. Eingaben bleiben erhalten; starte nach Prüfung eine neue Anfrage.";
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
  const { state, nativeScope } = useStore(),
    nav = useNavigate(),
    convex = useConvex();
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
  const [outputKind, setOutputKind] = useState<
    "perspective" | "social-post-candidate"
  >("perspective");
  const [compositeOptIn, setCompositeOptIn] = useState(false);
  const [candidateMedia, setCandidateMedia] = useState<
    { assetId: Id<"mediaAssets">; alt: string }[]
  >([]);
  const [humanStrategy, setHumanStrategy] = useState(""),
    [objective, setObjective] = useState(""),
    [tone, setTone] = useState(""),
    [cta, setCta] = useState("");
  const [routingId, setRoutingId] = useState<Id<"jevRoutingOperations"> | null>(
    null,
  );
  const flow = useRef<{
    prepare: FunctionArgs<typeof api.ai.jev.routing.prepare>;
    generate: FunctionArgs<typeof api.content.ideas.generate>;
    id: Id<"jevRoutingOperations"> | null;
    scope: string;
    epoch: number;
    until: number | null;
    compositeOptIn: boolean;
  } | null>(null);
  const prepareRouting = useMutation(api.ai.jev.routing.prepare),
    classifyRouting = useAction(api.ai.jev.routing.classify);
  const routing = useQuery(
    api.ai.jev.routing.get,
    routingId ? { workspaceId, operationId: routingId } : "skip",
  );
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
  const style = useQuery(
    api.ai.styleProfiles.get,
    account && mode === "generate" && selected
      ? { workspaceId, accountId: account as Id<"socialAccounts"> }
      : "skip",
  );
  const selectedStyle = useQuery(
    api.ai.styleProfiles.version,
    style?.control?.selectedVersionId
      ? {
          workspaceId,
          accountId: account as Id<"socialAccounts">,
          versionId: style.control.selectedVersionId,
        }
      : "skip",
  );
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
    generateComposite = useMutation(api.content.ideas.generateComposite),
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
    [
      ...protectedVersions,
      ...(selectedStyle?.sourceUntil !== null &&
      selectedStyle?.sourceUntil !== undefined
        ? [
            {
              sourceProofUntil: selectedStyle.sourceUntil,
              sourceUnavailable: !style?.usable,
            },
          ]
        : []),
      ...(routing?.sourceUntil !== null && routing?.sourceUntil !== undefined
        ? [
            {
              sourceProofUntil: routing.sourceUntil,
              sourceUnavailable: false,
            },
          ]
        : []),
      ...(routing && !routing.result && !routing.usage
        ? [{ sourceProofUntil: routing.deadline, sourceUnavailable: false }]
        : []),
      ...(runs ?? [])
        .filter((r) => r.sourceUntil !== null && r.sourceUntil !== undefined)
        .map((r) => ({
          sourceProofUntil: r.sourceUntil!,
          sourceUnavailable: r.styleUnavailable || r.sourceUnavailable,
        })),
    ]
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
      setObjective("");
      setTone("");
      setCta("");
      flow.current = null;
      setRoutingId(null);
      setOpen(false);
      setMessage(
        "Die Quellenfreigabe ist abgelaufen oder geändert. Geschützte Inhalte wurden ausgeblendet.",
      );
    }
  }, [selected, selectedLive?.version.sourceUnavailable, proofClock]);
  const min = Math.min(
    selected?.version.sourceProofUntil ?? Infinity,
    selectedStyle?.sourceUntil ?? Infinity,
    routing?.sourceUntil ?? Infinity,
  );
  const generationUntil = Number.isFinite(min) ? min : null;
  const generationScope = JSON.stringify([
    nativeScope,
    account,
    selected?.idea._id,
    selected?.version._id,
    selectedLive?.idea.revision ?? selected?.idea.revision,
    selectedLive?.idea.currentVersionId ?? selected?.version._id,
    style?.control?.selectedVersionId ?? null,
    style?.control?.selectionReceiptId ?? null,
    style?.control?.selectedBy ?? null,
    style?.usable,
    mode,
    outputKind,
    compositeOptIn,
    !!selected,
  ]);
  const context = useRef({ scope: generationScope, epoch: 0 });
  if (context.current.scope !== generationScope)
    context.current = {
      scope: generationScope,
      epoch: context.current.epoch + 1,
    };
  const untilRef = useRef(generationUntil);
  untilRef.current = generationUntil;
  const generation = useNativeCommand(generationScope, generationUntil);
  const generationLocked =
    mode === "generate" && (generation.locked || !!flow.current);
  useEffect(() => {
    flow.current = null;
    setRoutingId(null);
  }, [generationScope]);
  useEffect(() => {
    if (
      routing?.applicability === "unavailable" ||
      (generationUntil !== null && generationUntil <= proofClock)
    ) {
      flow.current = null;
      setIntent("");
      setObjective("");
      setTone("");
      setCta("");
    }
  }, [routing?.applicability, generationUntil, proofClock]);
  const write = state.role !== "Viewer";
  async function requestPerspective() {
    if (
      !selected ||
      !account ||
      !style ||
      (style.control?.selectedVersionId && (!style.usable || !selectedStyle))
    )
      return;
    if (!flow.current) {
      const key = operation.current;
      flow.current = {
        prepare: {
          workspaceId,
          ideaId: selected.idea._id,
          expectedRevision: selected.idea.revision,
          accountId: account as Id<"socialAccounts">,
          operationKey: key,
          intent: {
            intent,
            strategy: humanStrategy || null,
            outputKind,
            ...(outputKind === "social-post-candidate"
              ? { media: candidateMedia }
              : {}),
            network: "x",
            objective: objective || null,
            tone: tone || null,
            cta: cta || null,
          },
        },
        generate: {
          workspaceId,
          ideaId: selected.idea._id,
          expectedRevision: selected.idea.revision,
          accountId: account as Id<"socialAccounts">,
          intent,
          operationKey: key,
          ...(outputKind === "social-post-candidate" ? { outputKind } : {}),
        },
        id: null,
        scope: generationScope,
        epoch: context.current.epoch,
        until: generationUntil,
        compositeOptIn:
          outputKind === "social-post-candidate" && compositeOptIn,
      };
    }
    const original = flow.current;
    const valid = () =>
      mounted.current &&
      context.current.scope === original.scope &&
      context.current.epoch === original.epoch &&
      (original.until === null || original.until > Date.now()) &&
      (untilRef.current === null || untilRef.current > Date.now());
    let configurationRequired = false;
    const call = async () => {
      setError("");
      try {
        if (!valid()) throw new Error("IDEA_CONTEXT_CHANGED");
        if (!original.id) original.id = await prepareRouting(original.prepare);
        if (!valid()) throw new Error("IDEA_CONTEXT_CHANGED");
        setRoutingId(original.id);
        const args = { workspaceId, operationId: original.id };
        let view = await convex.query(api.ai.jev.routing.get, args);
        if (
          !valid() ||
          view.applicability !== "current" ||
          (view.sourceUntil !== null && view.sourceUntil <= Date.now())
        )
          throw new Error("ROUTING_SOURCE_UNAVAILABLE");
        if (!view.result) {
          if (view.usage || view.deadline <= Date.now())
            throw new Error("ROUTING_USAGE_UNRESOLVED");
          await classifyRouting(args);
          view = await convex.query(api.ai.jev.routing.get, args);
        }
        if (
          !valid() ||
          view.applicability !== "current" ||
          !view.result ||
          (view.sourceUntil !== null && view.sourceUntil <= Date.now())
        )
          throw new Error("ROUTING_USAGE_UNRESOLVED");
        original.generate = {
          ...original.generate,
          routingOperationId: original.id,
        };
        if (original.compositeOptIn) {
          const result = await generateComposite({
            ...original.generate,
            outputKind: "social-post-candidate",
            routingOperationId: original.id,
          });
          configurationRequired = result.status === "configuration_required";
        } else await generate(original.generate);
      } catch (e) {
        if (valid()) setError(ideaError(e));
        throw e;
      }
    };
    if (await generation.execute(call))
      setMessage(
        configurationRequired
          ? "Gemeinsamer Rahmen benötigt Konfiguration · kein Generierungslauf gestartet."
          : "Lauf gespeichert. Eine Ausgabe gilt erst nach erfolgreicher Persistenz als Idee.",
      );
  }

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
    setHumanStrategy("");
    setOutputKind("perspective");
    setCompositeOptIn(false);
    setCandidateMedia([]);
    setObjective("");
    setTone("");
    setCta("");
    flow.current = null;
    setRoutingId(null);
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
        Manuelle Notizen und Entwürfe benötigen keinen Modellzugang.
        Intent-Routing und Generation prüfen getrennte Freigaben.{" "}
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
                    : row.version.candidate
                      ? "Social-Post-Kandidat"
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
              {row.version.candidate && (
                <CandidateApplication
                  versionId={row.version._id}
                  target={null}
                  disabled={!write || busy}
                  bufferScope="new-draft"
                  onApplied={(r) => nav(`/drafts/${r.draftId}`)}
                />
              )}
              {!row.version.candidate && (
                <p className="text-sm">
                  {row.version.runId
                    ? "Modellinterpretation · Klärung erforderlich"
                    : "Eigene Perspektive"}
                  : {row.version.perspective || "Noch offen"}
                </p>
              )}
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
                  disabled={!write || busy || !!row.version.candidate}
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
                ) : !row.version.candidate ? (
                  <Button
                    disabled={!write || busy || row.idea.status === "archived"}
                    onClick={() => begin(row, "handoff")}
                  >
                    Zum Entwurf
                  </Button>
                ) : null}
                <Button
                  variant="outline"
                  disabled={
                    !write ||
                    busy ||
                    row.idea.status === "archived" ||
                    !!row.version.candidate
                  }
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
          if (!busy && !generation.busy && !v) {
            setOpen(false);
            setSelected(null);
            setError("");
          }
        }}
      >
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
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
                disabled={busy || generation.busy || generationLocked}
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
                disabled={busy || generation.busy || generationLocked}
                value={intent}
                onChange={(e) => setIntent(e.target.value)}
                maxLength={1000}
              />
            </label>
          )}
          {selected && mode === "generate" && (
            <>
              <label>
                <span className="field-label">Ausgabe</span>
                <select
                  aria-label="Ausgabe"
                  className="native-select"
                  value={outputKind}
                  disabled={busy || generationLocked}
                  onChange={(e) =>
                    setOutputKind(e.target.value as typeof outputKind)
                  }
                >
                  <option value="perspective">Perspektive</option>
                  <option value="social-post-candidate">
                    Social-Post-Kandidat für X · ungeprüft
                  </option>
                </select>
              </label>
              {outputKind === "social-post-candidate" && (
                <div className="stack text-sm rounded-lg border p-3">
                  <label className="flex gap-2">
                    <input
                      type="checkbox"
                      checked={compositeOptIn}
                      disabled={busy || generationLocked}
                      onChange={(e) => setCompositeOptIn(e.target.checked)}
                    />
                    Eine risikoarme Nachbesserung im gemeinsamen Rahmen erlauben
                  </label>
                  <p className="muted">
                    Standardmäßig aus. Erste Generierung, Prüfung, höchstens
                    eine Nachbesserung und Schlussprüfung teilen die
                    ursprüngliche Uhr und einen konfigurierten Kostenrahmen in
                    einer Währung. Die vorausgehende Strategieprüfung läuft
                    separat. Ohne bestätigte Konfiguration startet keine
                    Generierung.
                  </p>
                </div>
              )}
              {outputKind === "social-post-candidate" && (
                <fieldset className="stack">
                  <legend className="field-label">
                    Medien ausdrücklich auswählen (optional)
                  </legend>
                  <p className="text-xs muted">
                    Nur sichtbare, bereite Medien. Reihenfolge und
                    Alternativtexte werden an diesen Auftrag gebunden.
                  </p>
                  {state.media
                    ?.filter(
                      (m) =>
                        m.workspaceId === workspaceId && m.status === "ready",
                    )
                    .slice(0, 20)
                    .map((m) => (
                      <div key={m.id}>
                        <label className="flex gap-2 text-sm">
                          <input
                            type="checkbox"
                            disabled={busy || generationLocked}
                            checked={candidateMedia.some(
                              (r) => r.assetId === m.id,
                            )}
                            onChange={(e) =>
                              setCandidateMedia((refs) =>
                                e.target.checked
                                  ? [
                                      ...refs,
                                      {
                                        assetId: m.id as Id<"mediaAssets">,
                                        alt: m.alt,
                                      },
                                    ]
                                  : refs.filter((r) => r.assetId !== m.id),
                              )
                            }
                          />
                          {m.name}
                        </label>
                        {candidateMedia.some((r) => r.assetId === m.id) && (
                          <label>
                            <span className="field-label">
                              Alternativtext für {m.name}
                            </span>
                            <Input
                              maxLength={1000}
                              disabled={busy || generationLocked}
                              value={
                                candidateMedia.find((r) => r.assetId === m.id)!
                                  .alt
                              }
                              onChange={(e) =>
                                setCandidateMedia((refs) =>
                                  refs.map((r) =>
                                    r.assetId === m.id
                                      ? { ...r, alt: e.target.value }
                                      : r,
                                  ),
                                )
                              }
                            />
                          </label>
                        )}
                      </div>
                    ))}
                </fieldset>
              )}
              <label>
                <span className="field-label">Ausdrückliche Strategie</span>
                <select
                  className="native-select"
                  value={humanStrategy}
                  disabled={busy || generationLocked}
                  onChange={(e) => setHumanStrategy(e.target.value)}
                >
                  <option value="">Keine ausdrückliche Auswahl</option>
                  {routingStrategies.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid gap-3 sm:grid-cols-3">
                {(
                  [
                    ["Ziel (optional)", objective, setObjective],
                    ["Ton (optional)", tone, setTone],
                    ["Handlungsaufforderung (optional)", cta, setCta],
                  ] as const
                ).map(([label, value, change]) => (
                  <label key={label}>
                    <span className="field-label">{label}</span>
                    <Input
                      maxLength={1000}
                      disabled={busy || generationLocked}
                      value={value}
                      onChange={(e) => change(e.target.value)}
                    />
                  </label>
                ))}
              </div>
              {style ? (
                <p className="text-xs muted">
                  {style.control?.selectedVersionId
                    ? `Account-Stil ausgewählt${!style.usable || (selectedStyle?.sourceUntil !== null && selectedStyle?.sourceUntil !== undefined && selectedStyle.sourceUntil <= proofClock) ? " · nicht verfügbar" : ""}`
                    : "Kein Account-Stil ausgewählt"}
                </p>
              ) : (
                <p role="status">Account-Stil wird geprüft …</p>
              )}
              {routing && <RoutingView view={routing} />}
              {generation.retry && (
                <Button
                  variant="outline"
                  disabled={
                    generation.busy || (!!routing?.usage && !routing.result)
                  }
                  onClick={() =>
                    void generation.execute(generation.retry!).then((ok) => {
                      if (ok)
                        setMessage(
                          "Lauf gespeichert. Eine Ausgabe gilt erst nach erfolgreicher Persistenz als Idee.",
                        );
                    })
                  }
                >
                  Denselben Auftrag wiederholen
                </Button>
              )}
              {(generation.conflict ||
                (!generation.retry &&
                  !generation.busy &&
                  !!flow.current &&
                  !!routing?.result)) && (
                <Button
                  variant="outline"
                  disabled={
                    !!routing?.usage && routing.usage.state !== "settled"
                  }
                  onClick={() => {
                    generation.reviewCurrent();
                    flow.current = null;
                    setRoutingId(null);
                    operation.current = crypto.randomUUID();
                    setError("");
                  }}
                >
                  Aktuellen Stand prüfen · neue Anfrage
                </Button>
              )}

              <p className="text-xs muted">
                Eine neue Idee enthält Originalbelege, ungeprüfte Nutzerangaben,
                eine getrennte Interpretation und offene Fragen. Ein
                tatsächliches Ergebnis erscheint erst nach gespeichertem Lauf.
              </p>
              {runs?.map((r) => (
                <div key={r.runId}>
                  {r.routingOperationId ? (
                    <RoutingHistory
                      workspaceId={workspaceId}
                      operationId={r.routingOperationId}
                    />
                  ) : (
                    <p className="text-xs muted">
                      Historischer Lauf ohne Intent-Routing · generische
                      Perspektive
                    </p>
                  )}
                  <p role="status">
                    Lauf {r.state}
                    {r.resultIdeaId
                      ? " · neue Idee gespeichert"
                      : " · kein gespeichertes Ergebnis"}
                  </p>
                  <p className="text-xs muted">
                    {r.styleVersionId
                      ? `Gebundene Stilversion: ${r.styleVersionId}`
                      : "Kein Account-Stil gebunden"}
                  </p>
                  {(r.styleUnavailable ||
                    (r.sourceUntil !== null &&
                      r.sourceUntil !== undefined &&
                      r.sourceUntil <= proofClock)) && (
                    <p role="alert">
                      Der gebundene Stil oder seine Quelle ist nicht mehr
                      verfügbar. Eine neue Anfrage prüft die aktuelle Auswahl.
                    </p>
                  )}
                  {r.usagePending && (
                    <p role="status">
                      Nutzung wird noch abgeglichen; ein Abbruch löscht keine
                      offenen Kosten.
                    </p>
                  )}
                  {r.errorCode && (
                    <p role="alert">{ideaError(new Error(r.errorCode))}</p>
                  )}
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
                generation.busy ||
                (mode === "generate" &&
                  !!selected &&
                  (generationLocked ||
                    !style ||
                    (style.control?.selectedVersionId &&
                      (!style.usable || !selectedStyle)) ||
                    state.accounts.find((a) => a.id === account)?.channel !==
                      "X")) ||
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
                selected && mode === "generate"
                  ? void requestPerspective()
                  : void command(
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
                            accountId:
                              (account as Id<"socialAccounts">) || null,
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
              {busy || generation.busy
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

const routingStrategies = [
  ["announcement", "Ankündigung"],
  ["milestone", "Meilenstein"],
  ["launch", "Produktstart"],
  ["educational", "Wissen vermitteln"],
  ["thought-leadership", "Standpunkt"],
  ["conversation", "Gespräch"],
  ["story", "Geschichte"],
  ["promotional", "Promotion"],
  ["generic", "Allgemein"],
] as const;
type RoutingViewValue = FunctionReturnType<typeof api.ai.jev.routing.get>;
function RoutingView({ view }: { view: RoutingViewValue }) {
  const clock = useGithubSourceProofClock(
    view.sourceUntil !== null
      ? [{ authorized: true, proofExpiresAt: view.sourceUntil }]
      : [],
  );
  const visible =
      view.applicability !== "unavailable" &&
      (view.sourceUntil === null || view.sourceUntil > clock),
    r = visible ? view.result : null;
  return (
    <div className="stack text-sm" role="status">
      <p>
        {visible
          ? view.applicability === "historical"
            ? "Historisches Intent-Routing · keine neue Freigabe"
            : "Aktuelles Intent-Routing"
          : "Intent-Routing nicht mehr verfügbar"}
      </p>
      {r ? (
        <>
          <p>
            {r.status === "human_choice"
              ? "Ausdrückliche menschliche Auswahl"
              : r.status === "configuration_required"
                ? "Intent-Routing benötigt Konfiguration · generischer Fallback"
                : r.status === "fallback"
                  ? "Generischer Fallback"
                  : r.status === "suggestion"
                    ? "Unverbindlicher Strategievorschlag"
                    : "Strategie zugeordnet"}
          </p>
          <p>
            Kategorie: {r.category ?? "nicht bestimmt"} · Vorschlag:{" "}
            {r.suggestion ?? "keiner"}
          </p>
          <p>
            {r.choiceConfidence !== null && (
              <>
                Hypothese zur Auswahl: {Math.round(r.choiceConfidence * 100)} %
                ·{" "}
              </>
            )}
            Wirksame Strategie: {r.effectiveStrategy} · Verfügbarer Generator:
            generische Perspektive
          </p>
        </>
      ) : (
        visible && (
          <p>
            Kein abgeschlossenes Routing-Ergebnis
            {view.deadline <= clock ? " · Klassifikationsfrist abgelaufen" : ""}
          </p>
        )
      )}
      {view.usage ? (
        <p>
          {view.usage.state === "settled"
            ? view.usage.estimatedMicros === null
              ? "Klassifikationsbetrag nicht verfügbar; keine Reservierung"
              : `Klassifikation: ${(view.usage.estimatedMicros / 1e6).toFixed(6)} ${view.usage.currency} geschätzt; keine Reservierung`
            : `${view.usage.state === "unknown" ? "Klassifikationskosten unbekannt" : "Klassifikationsbeleg noch offen"}; ${(view.usage.heldMicros / 1e6).toFixed(6)} ${view.usage.currency} bleiben reserviert`}
        </p>
      ) : (
        <p>Kein Klassifikationsversuch finanziert.</p>
      )}
    </div>
  );
}
function RoutingHistory({
  workspaceId,
  operationId,
}: {
  workspaceId: Id<"workspaces">;
  operationId: Id<"jevRoutingOperations">;
}) {
  const view = useQuery(api.ai.jev.routing.get, { workspaceId, operationId });
  return view ? (
    <RoutingView view={view} />
  ) : (
    <p role="status">Routing-Beleg wird geladen …</p>
  );
}

// Both native consumers keep the original whole application command on an uncertain ACK.
export function CandidateApplication({
  versionId,
  target,
  disabled,
  bufferScope,
  targetUntil = null,
  onApplied,
}: {
  versionId: Id<"ideaVersions">;
  target: FunctionArgs<typeof api.content.ideas.applyCandidate>["target"];
  disabled: boolean;
  bufferScope: string;
  targetUntil?: number | null;
  onApplied: (
    result: FunctionReturnType<typeof api.content.ideas.applyCandidate>,
  ) => void;
}) {
  const { state, nativeScope } = useStore();
  const view = useQuery(api.content.ideas.candidate, {
    workspaceId: state.activeWorkspaceId as Id<"workspaces">,
    versionId,
  });
  const apply = useMutation(api.content.ideas.applyCandidate);
  const repairCandidate = useMutation(api.ai.jev.composite.repair);
  const [chosenRepair, setChosenRepair] = useState<Id<"ideaVersions"> | null>(
    null,
  );
  const prepareVerification = useMutation(api.ai.jev.verify.prepare);
  const checkVerification = useAction(api.ai.jev.verify.check);
  const convex = useConvex();
  const [verificationReference, setVerificationReference] =
    useState<FunctionReturnType<typeof api.ai.jev.verify.prepare>["reference"]>(
      null,
    );
  const preparedReference =
    useRef<FunctionReturnType<typeof api.ai.jev.verify.prepare>["reference"]>(
      null,
    );
  const liveVerification = useQuery(
    api.ai.jev.verify.get,
    verificationReference
      ? {
          workspaceId: state.activeWorkspaceId as Id<"workspaces">,
          reference: verificationReference,
        }
      : "skip",
  );
  const verification = liveVerification ?? view?.verification;
  const [checkedResult, setCheckedResult] = useState(false),
    [verificationMessage, setVerificationMessage] = useState("");
  const resultRef = useRef<FunctionReturnType<
    typeof api.content.ideas.applyCandidate
  > | null>(null);
  const [intent, setIntent] = useState(""),
    [reviewed, setReviewed] = useState(false);
  const n = Math.min(
      view?.sourceUntil ?? Infinity,
      targetUntil ?? Infinity,
      checkedResult ? (verification?.sourceUntil ?? Infinity) : Infinity,
    ),
    until = Number.isFinite(n) ? n : null;
  const clock = useGithubSourceProofClock([
    ...(view?.composite &&
    ["initial", "verified", "repair"].includes(view.composite.state)
      ? [
          {
            authorized: !view.composite.sourceUnavailable,
            proofExpiresAt: view.composite.deadline,
          },
        ]
      : []),
    ...(verification?.state === "ready"
      ? [{ authorized: true, proofExpiresAt: verification.deadline }]
      : []),
    ...(verification?.sourceUntil !== null &&
    verification?.sourceUntil !== undefined
      ? [
          {
            authorized: verification.applicability !== "unavailable",
            proofExpiresAt: verification.sourceUntil,
          },
        ]
      : []),
    ...(until === null
      ? []
      : [
          {
            authorized: view?.applicability !== "unavailable",
            proofExpiresAt: until,
          },
        ]),
  ]);
  const scope = JSON.stringify([
    nativeScope,
    versionId,
    target,
    bufferScope,
    disabled,
    view?.applicability,
    view?.candidate?.contentHash,
    checkedResult ? verification?.result?.resultFingerprint : null,
    checkedResult,
  ]);
  const op = useNativeCommand(scope, until);
  const verificationScope = JSON.stringify([
    nativeScope,
    versionId,
    target,
    bufferScope,
    disabled,
    view?.applicability,
    view?.candidate?.contentHash,
  ]);
  const verificationCommand = useNativeCommand(
    verificationScope,
    view?.sourceUntil ?? null,
  );
  const repairUntil = Math.min(
    view?.sourceUntil ?? Infinity,
    view?.composite?.deadline ?? Infinity,
  );
  const repairCommand = useNativeCommand(
    verificationScope,
    Number.isFinite(repairUntil) ? repairUntil : null,
  );
  useEffect(() => {
    setChosenRepair(null);
  }, [verificationScope]);
  const verificationUsable =
    verification?.applicability === "current" &&
    (verification.sourceUntil === null || verification.sourceUntil > clock);
  const verificationResult = verificationUsable ? verification.result : null;
  useEffect(() => {
    setVerificationReference(null);
    preparedReference.current = null;
    setVerificationMessage("");
    setCheckedResult(false);
  }, [verificationScope]);
  useEffect(() => {
    if (!verificationUsable) setCheckedResult(false);
  }, [verificationUsable]);
  async function prepareCheck(call?: () => Promise<unknown>) {
    const args = {
      workspaceId: state.activeWorkspaceId as Id<"workspaces">,
      versionId,
      contentHash: view!.candidate!.contentHash,
      operationKey: crypto.randomUUID(),
    };
    if (
      await verificationCommand.execute(
        call ??
          (async () => {
            const result = await prepareVerification(args);
            preparedReference.current = result.reference;
          }),
      )
    ) {
      setVerificationReference(preparedReference.current);
      setVerificationMessage(
        preparedReference.current
          ? "Prüfbefehl gespeichert. Die einmalige Prüfung kann jetzt ausdrücklich gestartet werden."
          : "Kandidatenprüfung benötigt Konfiguration · Kandidat bleibt ungeprüft.",
      );
    }
  }
  async function readCheck() {
    const reference = verification?.reference ?? verificationReference;
    if (
      reference &&
      (await verificationCommand.execute(() =>
        convex.query(api.ai.jev.verify.get, {
          workspaceId: state.activeWorkspaceId as Id<"workspaces">,
          reference,
        }),
      ))
    )
      setVerificationMessage(
        "Ursprünglicher Prüfstatus gelesen · kein neuer Modellaufruf.",
      );
  }
  const usable =
    view?.applicability === "current" &&
    !!view.candidate &&
    (until === null || until > clock);
  useEffect(() => {
    setIntent("");
    setReviewed(false);
  }, [scope, usable]);
  if (demoMode) return null;
  if (view === undefined)
    return <p role="status">Social-Post-Kandidat wird geprüft …</p>;
  if (!view?.candidate || !usable)
    return (
      <p role="status">
        {view?.applicability === "historical"
          ? "Historischer Social-Post-Kandidat · keine neue Übernahme"
          : "Social-Post-Kandidat nicht verfügbar"}
      </p>
    );
  if (
    chosenRepair &&
    view.composite?.repairedCandidateVersionId === chosenRepair
  )
    return (
      <div className="stack text-sm">
        <p role="status">
          Ausgewählt: nachgebesserter Kandidat · weiterhin unfreigegeben.
        </p>
        <Button
          variant="outline"
          disabled={disabled}
          onClick={() => setChosenRepair(null)}
        >
          Ursprünglichen Kandidaten auswählen
        </Button>
        <CandidateApplication
          versionId={chosenRepair}
          target={target}
          disabled={disabled}
          bufferScope={bufferScope}
          targetUntil={targetUntil}
          onApplied={onApplied}
        />
      </div>
    );
  return (
    <div className="stack text-sm">
      <Status>
        Social-Post-Kandidat ·{" "}
        {verificationResult ? "mit Prüfergebnis · unfreigegeben" : "ungeprüft"}
      </Status>
      <p>
        Prüfe Angaben, Reihenfolge und Medien. Die Übernahme erzeugt eine
        Arbeitsversion; Freigabe und Veröffentlichung bleiben separate Schritte.
      </p>
      {view.composite && (
        <div
          className="stack rounded-lg border p-3"
          aria-label="Gemeinsamer Nachbesserungsrahmen"
        >
          <p>
            Gemeinsamer Rahmen ·{" "}
            {
              {
                initial: "Erste Generierung",
                verified: "Erste Prüfung beendet",
                repair: "Nachbesserung läuft",
                finished: "Ablauf beendet",
                stopped: "Beendet / Quelle nicht verfügbar",
              }[view.composite.state]
            }{" "}
            · ursprünglicher Start{" "}
            {new Date(view.composite.startedAt).toLocaleTimeString("de-DE")} ·
            Ende {new Date(view.composite.deadline).toLocaleTimeString("de-DE")}
          </p>
          <p>
            {(view.composite.bookedMicros / 1e6).toFixed(6)}{" "}
            {view.composite.currency} gebucht ·{" "}
            {(view.composite.heldMicros / 1e6).toFixed(6)} reserviert · Rahmen{" "}
            {(view.composite.maxCostMicros / 1e6).toFixed(6)}{" "}
            {view.composite.currency}. Kosten{" "}
            {view.composite.usagePending
              ? "ungewiss oder noch offen"
              : "abgerechnet"}
            ; keine Währungsumrechnung.
          </p>
          <p>
            Aufrufe {view.composite.calls}/{view.composite.maxCalls} ·
            Werkzeugschritte {view.composite.toolSteps}/
            {view.composite.maxToolSteps} · Schlussprüfung{" "}
            {view.composite.reservedFinal
              ? "reserviert, noch nicht gesendet"
              : "keine ungesendete Reservierung"}
            .
          </p>
          {view.composite.stickyRisk && (
            <p role="alert">
              Ursprüngliches Claim-/Bedeutungs-/Intentrisiko bleibt sichtbar.
              Manuelle Prüfung erforderlich.
            </p>
          )}
          {view.composite.deadline <= clock && (
            <p role="status">
              Gemeinsame Uhr abgelaufen · keine weitere bezahlte Fortsetzung.
            </p>
          )}
          {verificationResult?.decision === "repairable" &&
            verification?.reference.compositeStage === "first-verification" &&
            !view.composite.stickyRisk &&
            !view.composite.repairedCandidateVersionId &&
            view.composite.state === "verified" &&
            verificationResult.reasonKeys.every((key) =>
              ["toneFits", "ctaFits", "networkFits"].includes(key),
            ) && (
              <Button
                variant="outline"
                disabled={
                  disabled ||
                  state.role === "Viewer" ||
                  repairCommand.locked ||
                  view.composite.usagePending ||
                  view.composite.deadline <= clock
                }
                onClick={() => {
                  const args = {
                    workspaceId: state.activeWorkspaceId as Id<"workspaces">,
                    reference: verification.reference,
                    resultFingerprint: verificationResult.resultFingerprint,
                    operationKey: crypto.randomUUID(),
                  };
                  void repairCommand.execute(() => repairCandidate(args));
                }}
              >
                Einmal risikoarm nachbessern
              </Button>
            )}
          {repairCommand.retry && (
            <Button
              variant="outline"
              disabled={disabled || repairCommand.busy}
              onClick={() => void repairCommand.execute(repairCommand.retry!)}
            >
              Ursprüngliche Nachbesserung erneut bestätigen
            </Button>
          )}
          {repairCommand.error && (
            <p role="alert">{ideaError(repairCommand.error)}</p>
          )}
          {view.composite.repairedCandidateVersionId &&
            view.composite.repairedCandidateVersionId !== versionId &&
            !chosenRepair && (
              <Button
                variant="outline"
                disabled={disabled || op.locked || verificationCommand.busy}
                onClick={() =>
                  setChosenRepair(view.composite!.repairedCandidateVersionId)
                }
              >
                Nachgebesserten Kandidaten auswählen
              </Button>
            )}
          <p className="muted">
            Eine Nachbesserung bleibt bis zur ausdrücklichen Schlussprüfung
            ungeprüft. Die Auswahl ändert keinen Entwurf; die Übernahme erzeugt
            eine unfreigegebene Arbeitsversion.
          </p>
        </div>
      )}
      <ol className="list-decimal space-y-2 pl-5">
        {view.candidate.content.text.map((post, i) => (
          <li key={i} className="whitespace-pre-wrap break-words">
            {post}
          </li>
        ))}
      </ol>
      {view.candidate.content.media.map((m, i) => (
        <p key={m.assetId}>
          Medium {i + 1} · Alternativtext: {m.alt || "Noch zu prüfen"}
        </p>
      ))}
      <div
        className="stack rounded-lg border p-3"
        aria-label="Kandidatenprüfung"
      >
        <p className="font-medium">Einmalige Kandidatenprüfung</p>
        <p className="muted">
          Standardmäßig aus. Alle sieben Kriterien beziehen sich auf den ganzen
          geordneten Kandidaten und seine ursprüngliche Quelle.
          Noul-Wahrscheinlichkeit ist keine Confidence und kein Faktennachweis;
          Schwellen sind unkalibrierte Hypothesen. Freigabe bleibt separat.
        </p>
        {verification?.usage && (
          <p role="status">
            Prüfung:{" "}
            {verification.usage.state === "settled"
              ? verification.usage.estimatedMicros === null
                ? "Kostenbetrag nicht verfügbar; keine Reservierung"
                : `${(verification.usage.estimatedMicros / 1e6).toFixed(6)} ${verification.usage.currency} geschätzt`
              : `Kosten ${verification.usage.state === "unknown" ? "ungewiss" : "noch offen"} · ${(verification.usage.heldMicros / 1e6).toFixed(6)} ${verification.usage.currency} reserviert`}
            . Ein ursprünglicher Kostenbeleg, keine drei separaten Gebühren.
          </p>
        )}
        {verification && !verificationUsable && (
          <p role="status">
            Prüfergebnis{" "}
            {verification.applicability === "historical"
              ? "historisch"
              : "nicht verfügbar"}{" "}
            · aktuell ungeprüft.
          </p>
        )}
        {verificationResult && (
          <>
            <p role="status">
              {verificationResult.decision === "manual_review"
                ? "Manuelle Prüfung erforderlich · ursprüngliches Claim-/Bedeutungs-/Intentrisiko bleibt sichtbar."
                : verificationResult.decision === "repairable"
                  ? "Risikoarmer Fit-Hinweis · keine automatische Nachbesserung."
                  : verificationResult.decision === "accept_with_warning"
                    ? "Prüfung mit Hinweis · fehlende Präferenzen bleiben unspezifiziert."
                    : "Prüfung ohne markierte Abweichung · keine Freigabe."}
            </p>
            <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {Object.entries(verificationResult.criteria).map(
                ([key, value]) => (
                  <div key={key}>
                    <dt className="font-medium">
                      {
                        {
                          meaningPreserved: "Bedeutung erhalten",
                          intentPreserved: "Intention erhalten",
                          newStrongClaim: "Neuer starker Claim",
                          unwantedPromotion: "Unerwünschte Promotion",
                          toneFits: "Ton passend",
                          ctaFits: "CTA passend",
                          networkFits: "Netzwerk passend",
                        }[key]
                      }
                    </dt>
                    <dd>
                      {value.applicability === "unspecified"
                        ? "Unspezifiziert"
                        : `${(value.probability * 100).toFixed(1)} % Wahrscheinlichkeit`}
                    </dd>
                  </div>
                ),
              )}
            </dl>
            {verification?.stickyRisk && (
              <p role="alert">
                Ursprünglicher Kandidat benötigt manuelle Prüfung. Ein späterer
                Fehler oder eine andere Ansicht beseitigt dieses Risiko nicht.
              </p>
            )}
            <label className="flex gap-2">
              <input
                type="checkbox"
                checked={checkedResult}
                disabled={disabled || op.locked || verificationCommand.busy}
                onChange={(e) => setCheckedResult(e.target.checked)}
              />
              Exaktes Prüfergebnis bei der Übernahme vermerken · weiterhin
              unfreigegeben.
            </label>
          </>
        )}
        {verificationUsable &&
          !verificationResult &&
          verification?.state === "finished" && (
            <p role="status">
              Prüfung ohne gültiges Ergebnis · ungeprüft. Keine erneute bezahlte
              Prüfung.
            </p>
          )}
        {!verification && !verificationReference && (
          <Button
            variant="outline"
            disabled={
              disabled ||
              state.role === "Viewer" ||
              verificationCommand.locked ||
              op.busy
            }
            onClick={() => void prepareCheck()}
          >
            Prüfbefehl vorbereiten
          </Button>
        )}
        {verificationUsable &&
          verification?.state === "ready" &&
          !verification.usage &&
          verification.deadline > clock && (
            <Button
              variant="outline"
              disabled={
                disabled ||
                state.role === "Viewer" ||
                verificationCommand.locked ||
                op.busy
              }
              onClick={() => {
                const args = {
                  workspaceId: state.activeWorkspaceId as Id<"workspaces">,
                  reference: verification.reference,
                };
                void verificationCommand.execute(() => checkVerification(args));
              }}
            >
              Gespeicherte Prüfung einmalig starten
            </Button>
          )}
        {verification?.state === "ready" && verification.deadline <= clock && (
          <p role="status">
            Ursprünglicher Prüfzeitraum abgelaufen · ungeprüft, kein neuer
            Prüfbefehl.
          </p>
        )}
        {verificationMessage && <p role="status">{verificationMessage}</p>}
        {verificationCommand.error && (
          <p role="alert">{verificationCommand.error}</p>
        )}
        {verificationCommand.retry && !verification?.usage && (
          <Button
            variant="outline"
            disabled={disabled || verificationCommand.busy}
            onClick={() => void prepareCheck(verificationCommand.retry!)}
          >
            Denselben Prüfauftrag wiederholen
          </Button>
        )}
        {(verification?.usage || verificationCommand.conflict) && (
          <Button
            variant="outline"
            disabled={disabled || verificationCommand.busy}
            onClick={() => void readCheck()}
          >
            Ursprünglichen Prüfstatus lesen
          </Button>
        )}
      </div>
      <label>
        <span className="field-label">Absicht der Kandidatenübernahme</span>
        <Textarea
          maxLength={1000}
          value={intent}
          disabled={disabled || op.locked}
          onChange={(e) => setIntent(e.target.value)}
        />
      </label>
      <label className="flex gap-2">
        <input
          type="checkbox"
          checked={reviewed}
          disabled={disabled || op.locked}
          onChange={(e) => setReviewed(e.target.checked)}
        />
        Angaben, Posts und Medien geprüft · ungeprüfte Arbeitsversion
        übernehmen.
      </label>
      {disabled && (
        <p role="status">
          Übernahme gesperrt: Speichere oder verwerfe lokale Änderungen und
          prüfe den aktuellen Stand.
        </p>
      )}
      <Button
        disabled={
          disabled ||
          state.role === "Viewer" ||
          op.locked ||
          !reviewed ||
          !intent.trim()
        }
        onClick={() => {
          const args: FunctionArgs<typeof api.content.ideas.applyCandidate> = {
            workspaceId: state.activeWorkspaceId as Id<"workspaces">,
            versionId,
            contentHash: view.candidate!.contentHash,
            operationKey: crypto.randomUUID(),
            intent,
            claimsReviewed: reviewed,
            target: structuredClone(target),
            ...(checkedResult && verificationResult
              ? {
                  verification: {
                    reference: verification!.reference,
                    resultFingerprint: verificationResult.resultFingerprint,
                  },
                }
              : {}),
          };
          void op
            .execute(async () => {
              resultRef.current = await apply(args);
            })
            .then((ok) => {
              if (ok && resultRef.current) {
                setReviewed(false);
                setIntent("");
                onApplied(resultRef.current);
              }
            });
        }}
      >
        {target
          ? "Kandidat geprüft · neue Arbeitsversion"
          : "Kandidat geprüft · neuen Entwurf erstellen"}
      </Button>
      {op.error && <p role="alert">{op.error}</p>}
      {op.retry && (
        <Button
          variant="outline"
          disabled={disabled || op.busy}
          onClick={() =>
            void op.execute(op.retry!).then((ok) => {
              if (ok && resultRef.current) {
                setReviewed(false);
                setIntent("");
                onApplied(resultRef.current);
              }
            })
          }
        >
          Denselben Übernahmeauftrag wiederholen
        </Button>
      )}
      {op.conflict && (
        <>
          <p role="status">
            Prüfe den aktuellen Kandidaten und Entwurf erneut; eine geänderte
            Anfrage benötigt eine neue Bestätigung.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              setIntent("");
              setReviewed(false);
              op.reviewCurrent();
            }}
          >
            Aktuellen Stand prüfen · Übernahme neu bestätigen
          </Button>
        </>
      )}
    </div>
  );
}

export function ComposerCandidates(
  props: Omit<Parameters<typeof CandidateApplication>[0], "versionId">,
) {
  const { state } = useStore();
  const rows = useQuery(api.content.ideas.list, {
    workspaceId: state.activeWorkspaceId as Id<"workspaces">,
    paginationOpts: { numItems: 25, cursor: null },
  });
  return (
    <Section title="Social-Post-Kandidat für diesen Entwurf">
      <p className="text-xs muted">
        Bis zu 25 geladene aktuelle Ideen. Eine Übernahme gilt ausschließlich
        für diesen geöffneten Entwurf.
      </p>
      {rows?.page
        .filter((r) => r.version.candidate && r.idea.status === "new")
        .map((r) => (
          <CandidateApplication
            key={r.version._id}
            {...props}
            versionId={r.version._id}
          />
        ))}
      {rows &&
        !rows.page.some(
          (r) => r.version.candidate && r.idea.status === "new",
        ) && (
          <p className="text-sm muted">
            Kein aktueller Kandidat auf dieser Seite. Erstelle ihn ausdrücklich
            in der Ideenbibliothek.
          </p>
        )}
      <Link to="/ideas" className="text-sm underline">
        Ideenbibliothek öffnen
      </Link>
    </Section>
  );
}
