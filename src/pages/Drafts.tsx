import { useEffect, useState, useRef } from "react";
import {
  Link,
  useBlocker,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  Plus,
  Search,
  ArrowLeft,
  Check,
  CalendarDays,
  Save,
  ImagePlus,
  GripVertical,
  Trash2,
  ChevronUp,
  ChevronDown,
  History,
  MessageSquare,
  ArrowRight,
  Copy,
  ShieldCheck,
  Sparkles,
  AlertCircle,
  GitCompareArrows,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
  AccountIcon,
  AccountSelect,
  EmptyState,
  DemoNote,
  formatDate,
} from "@/components/shared";
import { ScheduleDialog } from "@/components/ScheduleDialog";
import { demoMode } from "@/lib/auth-client";
import { useStore } from "@/lib/store";
import {
  currentVersion,
  approved,
  editDraft,
  approveDraft,
  draftValid,
  limits,
  canEdit,
  canApprove,
  uid,
  now,
  revokeDraftApproval,
  replaceScheduledVersion,
  type MediaAsset,
} from "@/lib/model";
export function VersionCommentInput({
  version,
  canWrite,
  onSubmit,
}: {
  version: number;
  canWrite: boolean;
  onSubmit: (text: string) => Promise<boolean>;
}) {
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const submitting = useRef(false);
  return (
    <>
      <label>
        <span className="field-label">Kommentar zu Version {version}</span>
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          disabled={!canWrite}
          placeholder="Was sollte vor der Freigabe geprüft werden?"
        />
      </label>
      <Button
        variant="outline"
        size="sm"
        className="mt-3"
        disabled={!comment.trim() || !canWrite || sending}
        onClick={async () => {
          if (submitting.current || !canWrite || !comment.trim()) return;
          submitting.current = true;
          setSending(true);
          const submitted = comment;
          try {
            if (await onSubmit(submitted))
              setComment((current) => (current === submitted ? "" : current));
          } finally {
            submitting.current = false;
            setSending(false);
          }
        }}
      >
        {sending ? "Kommentar wird gesendet …" : "Kommentar senden"}
      </Button>
    </>
  );
}
function MediaPreview({
  asset,
  className,
}: {
  asset: MediaAsset;
  className?: string;
}) {
  return asset.type === "video" ? (
    <video
      src={asset.url}
      aria-label={asset.alt || asset.name}
      controls
      preload="metadata"
      className={className}
    />
  ) : (
    <img src={asset.url} alt={asset.alt} className={className} />
  );
}
const strategies = [
  ["generic", "Allgemeiner Beitrag"],
  ["announcement", "Ankündigung"],
  ["milestone", "Meilenstein"],
  ["launch", "Launch"],
  ["educational", "Wissen teilen"],
  ["thought-leadership", "Standpunkt"],
  ["conversation", "Gespräch starten"],
  ["story", "Geschichte"],
  ["promotional", "Angebot"],
];
export function DraftsPage() {
  const {
    state,
    createDraft,
    hasMoreDrafts,
    loadMoreDrafts,
    resourcesLimited,
  } = useStore();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const filter = params.get("filter") ?? "all";
  const [channel, setChannel] = useState("all");
  const drafts = state.drafts
    .filter((d) => d.workspaceId === state.activeWorkspaceId)
    .filter((d) =>
      `${d.title} ${currentVersion(d).text.join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    )
    .filter(
      (d) =>
        channel === "all" ||
        state.accounts.find((a) => a.id === d.accountId)?.channel === channel,
    )
    .filter(
      (d) =>
        filter === "all" ||
        (filter === "review" && !approved(d)) ||
        (filter === "approved" && approved(d)) ||
        (filter === "scheduled" &&
          state.schedules.some(
            (s) => s.draftId === d.id && s.status === "scheduled",
          )) ||
        (["published", "failed", "partial", "uncertain"].includes(filter) &&
          state.schedules.some(
            (s) => s.draftId === d.id && s.status === filter,
          )),
    );
  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Redaktion"
        title="Deine Entwürfe"
        description="Ein Gedanke wird ein guter Beitrag. Hier gibst du ihm Form."
        actions={
          <Button
            disabled={!canEdit(state.role)}
            onClick={async () => {
              const id = await createDraft("Unbenannter Entwurf");
              if (id) nav(`/drafts/${id}`);
            }}
          >
            <Plus size={16} />
            Neuer Entwurf
          </Button>
        }
      />
      <div className="mb-5 flex flex-wrap justify-between gap-3">
        <div className="flex flex-wrap gap-1">
          {[
            ["all", "Alle Entwürfe"],
            ["review", "Zur Freigabe"],
            ["approved", "Freigegeben"],
            ["scheduled", "Geplant"],
            ["published", "Veröffentlicht"],
            ["partial", "Teilweise"],
            ["failed", "Fehler"],
            ["uncertain", "Abgleich"],
          ].map(([id, label]) => (
            <Button
              key={id}
              size="sm"
              variant={filter === id ? "secondary" : "ghost"}
              onClick={() => setParams(id === "all" ? {} : { filter: id })}
            >
              {label}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="relative">
            <Search size={14} className="absolute left-3 top-3 muted" />
            <Input
              aria-label="Entwürfe durchsuchen"
              placeholder="Entwürfe durchsuchen …"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </label>
          <select
            aria-label="Kanal filtern"
            className="native-select w-auto"
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
          >
            {["all", "X", "LinkedIn", "Bluesky", "Mastodon"].map((c) => (
              <option key={c} value={c}>
                {c === "all" ? "Alle Kanäle" : c}
              </option>
            ))}
          </select>
        </div>
      </div>
      {resourcesLimited && (
        <p role="status" className="mb-3 text-xs muted">
          Die ersten 100 Accounts und Medien werden angezeigt. Weitere
          Ressourcen benötigen eine paginierte Auswahl.
        </p>
      )}
      {drafts.some((d) => d.schedulesLimited) && (
        <p role="alert" className="mb-3 text-sm">
          Ein Entwurf hat mehr als 100 aktive Termine. Öffne den Entwurf, um
          sichtbare Termine zu stornieren und weitere Termine nachzuladen.
        </p>
      )}
      <div className="surface table-wrap">
        {drafts.length ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Beitrag</th>
                <th>Account</th>
                <th>Status</th>
                <th>Version</th>
                <th>Zuständig</th>
                <th>Bearbeitet</th>
              </tr>
            </thead>
            <tbody>
              {drafts.map((d) => {
                const a = state.accounts.find((a) => a.id === d.accountId);
                const v = currentVersion(d);
                const scheduled = state.schedules.find(
                  (s) => s.draftId === d.id && s.status === "scheduled",
                );
                return (
                  <tr key={d.id} className="hover:bg-muted/40">
                    <td className="min-w-64">
                      <Link to={`/drafts/${d.id}`} className="block">
                        <strong className="text-sm font-semibold">
                          {d.title}
                        </strong>
                        <span className="mt-1.5 block max-w-md truncate text-xs muted">
                          {v.text[0] || "Noch kein Text"}
                        </span>
                        <span className="mt-2 block text-[10px] muted">
                          {d.pillar}
                          {v.text.length > 1
                            ? ` · Thread mit ${v.text.length} Beiträgen`
                            : ""}
                        </span>
                      </Link>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <AccountIcon channel={a?.channel ?? "X"} />
                        <span className="text-xs whitespace-nowrap">
                          {a?.handle}
                        </span>
                      </div>
                    </td>
                    <td>
                      <Status tone={approved(d) ? "green" : "orange"}>
                        {approved(d) ? "Freigegeben" : "Entwurf"}
                      </Status>
                      {scheduled && (
                        <span className="mt-1 block text-[10px] muted">
                          Geplant: v{scheduled.version}
                        </span>
                      )}
                    </td>
                    <td className="text-xs">v{v.number}</td>
                    <td className="text-xs muted">
                      {d.assignee ?? "Nicht zugewiesen"}
                    </td>
                    <td className="text-[11px] muted whitespace-nowrap">
                      {formatDate(v.createdAt, state.preferences.timezone, {
                        hour: undefined,
                        minute: undefined,
                      })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <EmptyState
            icon={<Search size={28} />}
            title="Keine passenden Entwürfe"
            description="Ändere den Filter oder starte mit einem neuen Gedanken."
            action={
              <Button
                variant="outline"
                onClick={() => {
                  setQuery("");
                  setParams({});
                  setChannel("all");
                }}
              >
                Filter zurücksetzen
              </Button>
            }
          />
        )}
      </div>
      {hasMoreDrafts && (
        <Button className="mt-4" variant="outline" onClick={loadMoreDrafts}>
          Weitere Entwürfe laden
        </Button>
      )}
    </div>
  );
}
export function ComposerPage() {
  const { id } = useParams();
  const {
    state,
    mutate,
    createDraft,
    saveDraft,
    approveVersion,
    revokeApproval,
    replaceSchedule,
    cancelSchedule,
    loadMoreVersions,
    hasMoreVersions,
    members,
    addComment,
    resolveComment,
    assignDraft,
  } = useStore();
  const nav = useNavigate();
  const draft = state.drafts.find(
    (d) => d.id === id && d.workspaceId === state.activeWorkspaceId,
  );
  const v = draft ? currentVersion(draft) : undefined;
  const [text, setText] = useState<string[]>(v?.text ?? [""]);
  const [title, setTitle] = useState(draft?.title ?? "");
  const [accountId, setAccountId] = useState(
    draft?.accountId ?? state.activeAccountId,
  );
  const [mediaIds, setMediaIds] = useState<string[]>(v?.mediaIds ?? []);
  const [pillar, setPillar] = useState(draft?.pillar ?? "Building in public");
  const [strategy, setStrategy] = useState(draft?.strategy ?? "generic");
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [compare, setCompare] = useState<number>(1);
  const [tab, setTab] = useState("preview");
  const [analysis, setAnalysis] = useState<
    "idle" | "loading" | "ready" | "failed" | "disabled" | "low-confidence"
  >("idle");
  const [analysisVersion, setAnalysisVersion] = useState(0);
  const [analysisIdentity, setAnalysisIdentity] = useState("");
  const [analysisText, setAnalysisText] = useState<string[]>([]);
  const [recommendation, setRecommendation] = useState<number | null>(null);
  const [verification, setVerification] = useState<
    "unchecked" | "loading" | "warning" | "passed" | "unavailable"
  >("unchecked");
  const [verifyAttempts, setVerifyAttempts] = useState(0);
  const [variantOpen, setVariantOpen] = useState(false);
  const [variantAccount, setVariantAccount] = useState(state.activeAccountId);
  const base = useRef<{
    draftId: string;
    revision: number;
    text: string[];
    title: string;
    accountId: string;
    mediaIds: string[];
    pillar: string;
    strategy: string;
    media?: { assetId: string; alt: string }[];
  } | null>(
    draft && v
      ? {
          draftId: draft.id,
          revision: draft.revision ?? v.number,
          text: v.text,
          title: draft.title,
          accountId: draft.accountId,
          mediaIds: v.mediaIds,
          media: v.media,
          pillar: draft.pillar,
          strategy: draft.strategy,
        }
      : null,
  );
  const dirtyRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const identity = `${draft?.id}:${draft?.accountId}:${v?.number}`;
  useEffect(() => {
    setAnalysis("idle");
    setAnalysisVersion(0);
    setAnalysisIdentity("");
    setAnalysisText([]);
    setRecommendation(null);
    setVerification("unchecked");
    setVerifyAttempts(0);
    setCompare(1);
  }, [draft?.id, draft?.accountId]);
  useEffect(() => {
    setVerification("unchecked");
    setRecommendation(null);
    setVerifyAttempts(0);
    if (analysis === "loading") setAnalysis("idle");
  }, [v?.number]);
  useEffect(() => {
    if (draft && (!dirtyRef.current || base.current?.draftId !== draft.id)) {
      const ver = currentVersion(draft);
      setText(ver.text);
      setTitle(draft.title);
      setAccountId(draft.accountId);
      setMediaIds(ver.mediaIds);
      setPillar(draft.pillar);
      setStrategy(draft.strategy);
      base.current = {
        draftId: draft.id,
        revision: draft.revision ?? ver.number,
        text: ver.text,
        title: draft.title,
        accountId: draft.accountId,
        mediaIds: ver.mediaIds,
        media: ver.media,
        pillar: draft.pillar,
        strategy: draft.strategy,
      };
    }
  }, [draft?.id, v?.number]);
  const dirty =
    !!draft &&
    (JSON.stringify(text) !== JSON.stringify(base.current?.text) ||
      title !== base.current?.title ||
      accountId !== base.current?.accountId ||
      JSON.stringify(mediaIds) !== JSON.stringify(base.current?.mediaIds) ||
      pillar !== base.current?.pillar ||
      strategy !== base.current?.strategy);
  dirtyRef.current = dirty;
  const conflict =
    !!draft &&
    base.current?.draftId === draft.id &&
    base.current.revision !== (draft.revision ?? v?.number);
  const saveBuffer = async () => {
    if (!draft || saving) return false;
    setSaving(true);
    const revision = base.current?.revision ?? draft.revision ?? v!.number;
    const ok = await saveDraft({
      draftId: draft.id,
      expectedRevision: revision,
      title,
      text,
      accountId,
      mediaIds,
      media: base.current?.media ?? v?.media,
      pillar,
      strategy,
    });
    setSaving(false);
    if (ok) {
      base.current = {
        draftId: draft.id,
        revision: demoMode
          ? revision +
            (JSON.stringify(text) !== JSON.stringify(v?.text) ||
            JSON.stringify(mediaIds) !== JSON.stringify(v?.mediaIds) ||
            accountId !== draft.accountId
              ? 1
              : 0)
          : revision + 1,
        title,
        text,
        accountId,
        mediaIds,
        media: base.current?.media ?? v?.media,
        pillar,
        strategy,
      };
      dirtyRef.current = false;
      toast.success(
        "Neue Arbeitsversion gespeichert. Freigabe separat erforderlich.",
      );
    }
    return ok;
  };
  const allowTransition = useRef<string | undefined>(undefined);
  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (allowTransition.current === nextLocation.pathname) {
      allowTransition.current = undefined;
      return false;
    }
    allowTransition.current = undefined;
    return dirty && currentLocation.pathname !== nextLocation.pathname;
  });
  useEffect(() => {
    if (dirty) setVerification("unchecked");
  }, [dirty]);
  useEffect(() => {
    if (!dirty) return;
    const leave = (e: BeforeUnloadEvent) => e.preventDefault();
    const navigate = (e: Event) => {
      if (!window.confirm("Ungespeicherte Änderungen verwerfen?"))
        e.preventDefault();
      else
        allowTransition.current = (e as CustomEvent<{ destination?: string }>)
          .detail?.destination;
    };
    window.addEventListener("beforeunload", leave);
    window.addEventListener("dispatch:navigate", navigate);
    return () => {
      window.removeEventListener("beforeunload", leave);
      window.removeEventListener("dispatch:navigate", navigate);
    };
  }, [dirty]);
  useEffect(() => {
    if (analysis !== "loading") return;
    const analyzedIdentity = identity;
    const analyzedText = [...(v?.text ?? [])];
    const analyzedVersion = v?.number ?? 0;
    const t = setTimeout(() => {
      setAnalysis("ready");
      setAnalysisVersion(analyzedVersion);
      setAnalysisIdentity(analyzedIdentity);
      setAnalysisText(analyzedText);
    }, 700);
    return () => clearTimeout(t);
  }, [analysis, identity]);
  useEffect(() => {
    if (verification !== "loading") return;
    const t = setTimeout(() => setVerification("warning"), 600);
    return () => clearTimeout(t);
  }, [verification]);
  useEffect(() => {
    const saveKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (draft && dirty) void saveBuffer();
      }
    };
    window.addEventListener("keydown", saveKey);
    return () => window.removeEventListener("keydown", saveKey);
  }, [
    dirty,
    draft,
    title,
    accountId,
    pillar,
    strategy,
    text,
    mediaIds,
    mutate,
  ]);
  if (!draft || !v)
    return (
      <EmptyState
        icon={<AlertCircle size={28} />}
        title="Entwurf nicht gefunden"
        description="Dieser Entwurf ist in deinem aktiven Workspace nicht verfügbar."
        action={
          <Button asChild>
            <Link to="/drafts">Zu deinen Entwürfen</Link>
          </Button>
        }
      />
    );
  const account = state.accounts.find((a) => a.id === accountId);
  const canWrite = canEdit(state.role);
  const review = canApprove(state.role);
  const scheduled = state.schedules.filter(
    (s) => s.draftId === draft.id && s.status === "scheduled",
  );
  const activeMedia = state.media.filter(
    (m) => m.workspaceId === state.activeWorkspaceId,
  );
  const save = saveBuffer;
  const suggestions = [
    {
      title: "Mit der konkreten Beobachtung beginnen",
      reason:
        "Die Aussage wird schneller greifbar. Beispiel-Empfehlung für die Hook.",
      text: () => [
        (analysisText[0] ?? text[0]).replace(
          /^Heute /,
          "Ein Tag für die Details: ",
        ),
        ...(analysisText.length ? analysisText : text).slice(1),
      ],
    },
    {
      title: "Den eigenen Punkt klarer formulieren",
      reason:
        "Streiche vage Verstärker, ohne neue Aussagen oder künstliche Fragen einzufügen.",
      text: () =>
        (analysisText.length ? analysisText : text).map((t) =>
          t
            .replace(/ein bisschen /g, "")
            .replace(/überraschende Erkenntnis/g, "Erkenntnis")
            .replace(/Genau die Dinge/g, "Diese Dinge"),
        ),
    },
    {
      title: "Aussage kompakter machen",
      reason:
        "Kurze Absätze helfen beim Lesen. Prüfe, ob die Bedeutung erhalten bleibt.",
      text: () =>
        (analysisText.length ? analysisText : text).map((t) =>
          t
            .replace(/\n{3,}/g, "\n\n")
            .replace("ein bisschen ", "")
            .replace("Genau die Dinge", "Die Dinge"),
        ),
    },
  ];
  const similar = state.drafts
    .filter(
      (d) =>
        d.workspaceId === state.activeWorkspaceId &&
        d.id !== draft.id &&
        d.pillar === pillar,
    )
    .slice(0, 2);
  return (
    <div className="fade-in">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/drafts"
          className="inline-flex items-center gap-2 text-xs muted"
        >
          <ArrowLeft size={15} />
          Alle Entwürfe
        </Link>
        <span className="text-[11px] muted">
          {dirty
            ? "Ungespeicherte Änderungen"
            : `${demoMode ? "Lokal" : "Im Workspace"} gespeichert · Version ${v.number}`}
        </span>
      </div>
      <PageHeader
        eyebrow="Composer"
        title={draft.title}
        description={`${draft.source ?? "Manueller Entwurf"} · ${draft.versions.length} Version${draft.versions.length === 1 ? "" : "en"}`}
        actions={
          <>
            <Button
              variant="outline"
              disabled={!dirty || !canWrite || saving}
              onClick={save}
            >
              <Save size={15} />
              Speichern
            </Button>
            <Button
              disabled={
                dirty ||
                !review ||
                !draftValid(draft, state.accounts, state.media) ||
                approved(draft)
              }
              onClick={async () => {
                if (await approveVersion(draft))
                  toast.success("Version für diesen Account freigegeben.");
              }}
            >
              <ShieldCheck size={15} />
              {approved(draft)
                ? `v${v.number} freigegeben`
                : "Version freigeben"}
            </Button>
          </>
        }
      />
      {conflict && (
        <div role="alert" className="mb-4 surface p-4 text-sm">
          Eine neuere Version wurde gespeichert. Deine lokalen Änderungen
          bleiben erhalten. Vergleiche die Versionen und lade neu, um auf der
          aktuellen Version weiterzuarbeiten.
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (
                !dirty ||
                window.confirm(
                  "Lokale Änderungen verwerfen und aktuelle Version laden?",
                )
              ) {
                setText(v.text);
                setTitle(draft.title);
                setAccountId(draft.accountId);
                setMediaIds(v.mediaIds);
                setPillar(draft.pillar);
                setStrategy(draft.strategy);
                base.current = {
                  draftId: draft.id,
                  revision: draft.revision ?? v.number,
                  text: v.text,
                  title: draft.title,
                  accountId: draft.accountId,
                  mediaIds: v.mediaIds,
                  media: v.media,
                  pillar: draft.pillar,
                  strategy: draft.strategy,
                };
                dirtyRef.current = false;
              }
            }}
          >
            Aktuelle Version laden
          </Button>
        </div>
      )}
      {draft.schedulesLimited && (
        <div role="alert" className="mb-4 surface p-4 text-sm">
          Dieser Entwurf hat mehr als 100 aktive Termine. Die Terminansicht ist
          begrenzt; der Inhalt bleibt bearbeitbar. Storniere sichtbare geplante
          Termine, damit weitere Termine nachrücken. Neue Planung ist erst unter
          100 aktiven Terminen möglich.
          {scheduled[0] && (
            <Button
              variant="outline"
              size="sm"
              disabled={!review}
              onClick={async () => {
                if (await cancelSchedule(scheduled[0]))
                  toast.success(
                    "Termin storniert. Weitere Termine werden geladen.",
                  );
              }}
            >
              Angezeigten Termin stornieren
            </Button>
          )}
        </div>
      )}
      {scheduled.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-secondary/70 p-3 text-xs">
          <span>
            <CalendarDays size={14} className="mr-2 inline" />
            Geplant: v{scheduled[0].version} ·{" "}
            {formatDate(scheduled[0].at, state.preferences.timezone)}. Deine
            Arbeitsversion ersetzt diesen Snapshot nicht.
          </span>
          {scheduled[0].accountId !== draft.accountId && (
            <span role="alert">
              Account geändert: Den bisherigen Slot im Kalender stornieren und
              diese Kanalvariante separat planen.
            </span>
          )}
          {!demoMode &&
            draft.approvals?.some(
              (a) =>
                a.version === scheduled[0].version &&
                a.accountId === scheduled[0].accountId &&
                !a.revokedAt,
            ) && (
              <Button
                variant="ghost"
                size="sm"
                disabled={!review}
                onClick={async () => {
                  const approval = draft.approvals!.find(
                    (a) =>
                      a.version === scheduled[0].version &&
                      a.accountId === scheduled[0].accountId &&
                      !a.revokedAt,
                  )!;
                  if (await revokeApproval({ ...draft, approval }))
                    toast.success(
                      "Freigabe des geplanten Snapshots widerrufen.",
                    );
                }}
              >
                Geplante v{scheduled[0].version} widerrufen
              </Button>
            )}
          {scheduled[0].version !== v.number && (
            <Button
              variant="outline"
              size="sm"
              disabled={
                !approved(draft) ||
                dirty ||
                !review ||
                scheduled[0].accountId !== draft.accountId
              }
              onClick={async () => {
                if (await replaceSchedule(draft, scheduled[0]))
                  toast.success("Geplanten Snapshot ausdrücklich ersetzt.");
              }}
            >
              Geplante Version ersetzen
            </Button>
          )}
        </div>
      )}
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="stack">
          <Section
            title="Inhalt"
            actions={
              <Status
                tone={dirty ? "orange" : approved(draft) ? "green" : "neutral"}
              >
                {dirty
                  ? "Bearbeitung"
                  : approved(draft)
                    ? `Freigegeben · v${v.number}`
                    : `Arbeitsversion ${v.number}`}
              </Status>
            }
          >
            <div className="mb-5">
              <label className="field-label" htmlFor="draft-title">
                Interner Titel
              </label>
              <Input
                id="draft-title"
                value={title}
                disabled={!canWrite}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="form-grid mb-5">
              <AccountSelect
                value={accountId}
                onChange={setAccountId}
                disabled={!canWrite}
              />
              <label>
                <span className="field-label">Content Pillar</span>
                <select
                  className="native-select"
                  value={pillar}
                  onChange={(e) => setPillar(e.target.value)}
                  disabled={!canWrite}
                >
                  {[
                    "Building in public",
                    "Learnings",
                    "Produktupdates",
                    "Persönlich",
                  ].map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </label>
            </div>
            {!account?.connected && (
              <p
                role="alert"
                className="mb-4 rounded-md bg-destructive/10 p-3 text-xs text-destructive"
              >
                Account ist getrennt.{" "}
                <Link to="/settings/integrations" className="underline">
                  {demoMode
                    ? "Verbindung simuliert erneuern"
                    : "Account neu verbinden"}
                </Link>
                .
              </p>
            )}
            {(account?.capability?.maxThread === 1 ||
              (demoMode && account?.channel === "LinkedIn")) &&
              text.length > 1 && (
                <div
                  role="alert"
                  className="mb-4 rounded-md border border-primary/30 p-3 text-xs"
                >
                  <p>
                    Dieser Account unterstützt einen Einzelbeitrag. Die
                    übernommene Thread-Struktur bleibt erhalten, bis du sie
                    bewusst zusammenführst.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!canWrite}
                    onClick={() => setText((t) => [t.join("\n\n")])}
                  >
                    Thread als Einzelbeitrag zusammenführen
                  </Button>
                </div>
              )}
            <div className="mb-4 flex items-center justify-between">
              <span className="text-xs font-semibold">
                {text.length > 1
                  ? `Thread · ${text.length} Beiträge`
                  : "Einzelbeitrag"}
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={
                  !canWrite ||
                  text.length >=
                    (account?.capability?.maxThread ??
                      (demoMode
                        ? account?.channel === "LinkedIn"
                          ? 1
                          : 12
                        : 100))
                }
                onClick={() => setText((t) => [...t, ""])}
              >
                <Plus size={13} />
                Beitrag hinzufügen
              </Button>
            </div>
            <div className="space-y-4">
              {text.map((t, i) => (
                <div key={i} className="rounded-md border bg-background/30 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 text-[11px] muted">
                      <GripVertical size={12} />
                      {text.length > 1 ? `Beitrag ${i + 1}` : "Dein Beitrag"}
                    </span>
                    <div className="flex items-center gap-1">
                      {text.length > 1 && (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-6"
                            aria-label={`Beitrag ${i + 1} nach oben`}
                            disabled={!canWrite || i === 0}
                            onClick={() =>
                              setText((a) => {
                                const b = [...a];
                                [b[i - 1], b[i]] = [b[i], b[i - 1]];
                                return b;
                              })
                            }
                          >
                            <ChevronUp size={13} />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-6"
                            aria-label={`Beitrag ${i + 1} nach unten`}
                            disabled={!canWrite || i === text.length - 1}
                            onClick={() =>
                              setText((a) => {
                                const b = [...a];
                                [b[i + 1], b[i]] = [b[i], b[i + 1]];
                                return b;
                              })
                            }
                          >
                            <ChevronDown size={13} />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-6"
                            aria-label={`Beitrag ${i + 1} entfernen`}
                            disabled={!canWrite}
                            onClick={() =>
                              setText((a) => a.filter((_, n) => n !== i))
                            }
                          >
                            <Trash2 size={12} />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  <Textarea
                    aria-label={`Text Beitrag ${i + 1}`}
                    value={t}
                    disabled={!canWrite}
                    onChange={(e) =>
                      setText((a) =>
                        a.map((s, n) => (n === i ? e.target.value : s)),
                      )
                    }
                    className="min-h-44 resize-y border-0 bg-transparent px-1 text-[14px] leading-[1.85] shadow-none focus-visible:ring-0"
                    placeholder="Was möchtest du erzählen?"
                  />
                  <div className="mt-2 flex items-center justify-between text-[10px]">
                    <span className="muted">
                      {account?.channel} ·{" "}
                      {t.trim().split(/\s+/).filter(Boolean).length} Wörter
                    </span>
                    <span
                      className={
                        t.length >
                        (account?.capability?.maxText ??
                          (demoMode ? limits[account?.channel ?? "X"] : 25000))
                          ? "text-destructive font-semibold"
                          : "muted"
                      }
                    >
                      {t.length} /{" "}
                      {account?.capability?.maxText ??
                        (demoMode ? limits[account?.channel ?? "X"] : 25000)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!canWrite || !demoMode}
                onClick={() => setMediaOpen(true)}
              >
                <ImagePlus size={14} />
                Medien hinzufügen
              </Button>
              <span className="text-[11px] muted">
                {mediaIds.length
                  ? `${mediaIds.length} Medien · Alttext erforderlich`
                  : "Bis zu 4 Bilder oder ein Video"}
              </span>
            </div>
            {mediaIds.length > 0 && (
              <div className="mt-4 grid grid-cols-2 gap-3">
                {mediaIds.map((mid) => {
                  const m = activeMedia.find((m) => m.id === mid);
                  return m ? (
                    <div key={mid} className="relative">
                      <MediaPreview
                        asset={m}
                        className="h-24 w-full rounded-md object-cover"
                      />
                      <p className="mt-1 mb-0 truncate text-[10px] muted">
                        {m.alt || "Alttext fehlt"}
                      </p>
                      <Button
                        variant="secondary"
                        size="icon"
                        aria-label={`${m.name} entfernen`}
                        className="absolute right-1 top-1 size-6"
                        disabled={!canWrite}
                        onClick={() =>
                          setMediaIds((a) => a.filter((id) => id !== mid))
                        }
                      >
                        <Trash2 size={12} />
                      </Button>
                    </div>
                  ) : null;
                })}
              </div>
            )}
            <div className="mt-5 border-t pt-4">
              <label>
                <span className="field-label">Beitragsstrategie</span>
                <select
                  className="native-select"
                  value={strategy}
                  onChange={(e) => setStrategy(e.target.value)}
                  disabled={!canWrite}
                >
                  {strategies.map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <p className="mt-2 mb-0 text-[10px] muted">
                Manuelle Auswahl. Du behältst die Entscheidung.
              </p>
            </div>
          </Section>
          <Section title="Freigabe & Terminierung">
            <div className="mb-4 flex items-start gap-3">
              <ShieldCheck
                size={20}
                className={approved(draft) ? "text-[#5f7954]" : "muted"}
              />
              <div>
                <strong className="text-sm">
                  {approved(draft)
                    ? `Version ${v.number} für ${account?.handle} freigegeben`
                    : "Diese Arbeitsversion ist noch nicht freigegeben"}
                </strong>
                <p className="mt-2 mb-0 text-xs leading-relaxed muted">
                  {draft.approval
                    ? `Letzte Freigabe: v${draft.approval.version} · ${draft.approval.by}. Änderungen an Text, Account oder Medien benötigen eine neue Freigabe.`
                    : "Freigabe bestätigt den Inhalt. Ein Termin entsteht erst durch deine separate Planung."}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={
                  dirty ||
                  !approved(draft) ||
                  !review ||
                  !draftValid(draft, state.accounts, state.media) ||
                  scheduled.some((s) => s.version === v.number)
                }
                onClick={() => setScheduleOpen(true)}
              >
                <CalendarDays size={15} />
                Version planen
              </Button>
              {draft.approval && (
                <Button
                  variant="ghost"
                  disabled={!review}
                  onClick={async () => {
                    if (await revokeApproval(draft))
                      toast.success(
                        "Freigabe widerrufen. Neue Publishing-Claims gesperrt.",
                      );
                  }}
                >
                  Freigabe widerrufen
                </Button>
              )}
            </div>
            {!review && (
              <p className="mt-3 mb-0 text-xs muted">
                {state.role}: Freigabe und Planung bleiben Owner/Admin
                vorbehalten.{" "}
                <Link to="/team" className="underline">
                  Rolle ansehen
                </Link>
                .
              </p>
            )}
          </Section>
          <Section
            title="Zusammenarbeit"
            actions={<MessageSquare size={16} className="muted" />}
          >
            <label className="mb-4 block">
              <span className="field-label">Zuständig</span>
              <select
                className="native-select"
                value={draft.assignee ?? ""}
                disabled={!canWrite}
                onChange={async (e) => {
                  await assignDraft(draft, e.target.value);
                }}
              >
                <option value="">Nicht zugewiesen</option>
                {demoMode ? (
                  <>
                    <option>Matthias</option>
                    <option>Lea</option>
                    <option>Jonas</option>
                  </>
                ) : (
                  members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} · {m.role}
                    </option>
                  ))
                )}
              </select>
            </label>
            {draft.commentsLimited && (
              <p className="text-xs muted">
                Die letzten 100 Kommentare werden angezeigt. Ältere Kommentare
                bleiben gespeichert.
              </p>
            )}
            {draft.comments.map((c) => (
              <div key={c.id} className="mb-3 border-b pb-3">
                <div className="flex items-center justify-between">
                  <strong className="text-xs">
                    {members.find((m) => m.id === c.author)?.name ?? c.author} ·
                    v{c.version}
                  </strong>
                  <Status tone={c.resolved ? "green" : "neutral"}>
                    {c.resolved ? "Erledigt" : "Offen"}
                  </Status>
                </div>
                <p className="my-2 text-xs leading-relaxed">{c.text}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!canWrite}
                  onClick={async () => {
                    await resolveComment(c.id, c.resolved);
                  }}
                >
                  {c.resolved ? "Wieder öffnen" : "Als erledigt markieren"}
                </Button>
              </div>
            ))}
            <VersionCommentInput
              key={draft.id}
              version={v.number}
              canWrite={canWrite}
              onSubmit={(text) => addComment(draft, text)}
            />
          </Section>
        </div>
        <aside className="stack">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="w-full">
              <TabsTrigger value="preview" className="flex-1">
                Vorschau
              </TabsTrigger>
              <TabsTrigger
                value="intelligence"
                className="flex-1"
                disabled={!demoMode}
              >
                Intelligence
              </TabsTrigger>
              <TabsTrigger value="versions" className="flex-1">
                Versionen
              </TabsTrigger>
            </TabsList>
            <TabsContent value="preview">
              <div className="surface p-5">
                <div className="mb-4 flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-full bg-[#e0e5d9] text-xs font-semibold text-[#546545]">
                    M
                  </span>
                  <div>
                    <strong className="text-xs">{account?.name}</strong>
                    <span className="mt-0.5 block text-[10px] muted">
                      {account?.handle}
                    </span>
                  </div>
                  <AccountIcon channel={account?.channel ?? "X"} size={20} />
                </div>
                {text.map((t, i) => (
                  <div key={i} className={i ? "mt-5 border-t pt-4" : ""}>
                    <p className="mb-3 whitespace-pre-wrap text-[13px] leading-[1.8]">
                      {t || "Dein Text erscheint hier."}
                    </p>
                    {i === 0 &&
                      mediaIds.map((id) => {
                        const m = activeMedia.find((m) => m.id === id);
                        return m ? (
                          <MediaPreview
                            key={id}
                            asset={m}
                            className="mb-2 w-full rounded-lg"
                          />
                        ) : null;
                      })}
                    <div className="flex justify-between text-[10px] muted">
                      <span>♡ &nbsp;&nbsp; ↗ &nbsp;&nbsp; ◯</span>
                      <span>
                        {text.length > 1
                          ? `${i + 1}/${text.length}`
                          : "Vorschau"}
                      </span>
                    </div>
                  </div>
                ))}
                <p className="mt-5 mb-0 border-t pt-3 text-[10px] muted">
                  {account?.channel}-Vorschau · Plattformdarstellung kann
                  abweichen.
                </p>
              </div>
              <Section title="Ähnliche Inhalte" className="mt-4">
                {similar.length ? (
                  similar.map((d) => (
                    <Link
                      className="mb-3 block text-xs hover:text-primary"
                      key={d.id}
                      to={`/drafts/${d.id}`}
                    >
                      {d.title}
                      <ArrowRight size={12} className="ml-1 inline" />
                    </Link>
                  ))
                ) : (
                  <p className="text-xs muted">
                    Noch keine historischen Vergleichsbeiträge.
                  </p>
                )}
                <p className="mb-0 text-[10px] leading-relaxed muted">
                  Gleicher Themenbereich. Prüfe Wiederholung und Abstand
                  redaktionell; keine automatische Ähnlichkeitsanalyse.
                </p>
              </Section>
              <Section title="Quellen & Kontext" className="mt-4">
                <p className="text-xs">
                  {draft.source ?? "Keine externe Quelle"}
                </p>
                <p className="mb-0 text-[10px] leading-relaxed muted">
                  Quellenbezug bleibt am Entwurf erhalten. Aussagen vor einer
                  echten Veröffentlichung separat prüfen.
                </p>
              </Section>
            </TabsContent>
            <TabsContent value="intelligence">
              <Section title="Dispatch Score" actions={<Status>Demo</Status>}>
                <p className="text-xs leading-relaxed muted">
                  Freiwillige Heuristik zu einer konkreten Version. Keine
                  Reichweitenprognose.
                </p>
                <div className="mb-4 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={dirty || analysis === "loading"}
                    onClick={() => setAnalysis("loading")}
                  >
                    <Sparkles size={13} />
                    {analysis === "loading"
                      ? "Beispiel wird geladen …"
                      : "Beispielanalyse ansehen"}
                  </Button>
                  <select
                    className="native-select w-auto text-xs"
                    aria-label="Analysezustand demonstrieren"
                    value={analysis}
                    onChange={(e) => {
                      setAnalysis(e.target.value as typeof analysis);
                      if (
                        e.target.value === "ready" ||
                        e.target.value === "low-confidence"
                      ) {
                        setAnalysisVersion(v.number);
                        setAnalysisIdentity(identity);
                        setAnalysisText([...v.text]);
                      }
                    }}
                  >
                    <option value="idle">Nicht analysiert</option>
                    <option value="ready">Ergebnis verfügbar</option>
                    <option value="low-confidence">
                      Niedrige Sicherheit / unvollständig
                    </option>
                    <option value="failed">Ausfall</option>
                    <option value="disabled">Deaktiviert</option>
                  </select>
                </div>
                {(analysis === "failed" || analysis === "disabled") && (
                  <DemoNote>
                    Intelligence ist{" "}
                    {analysis === "failed" ? "nicht verfügbar" : "deaktiviert"}.
                    Dein freigegebener Beitrag kann weiterhin separat geplant
                    werden.
                  </DemoNote>
                )}
                {analysis === "idle" && (
                  <DemoNote>
                    Keine KI-Aufrufe. Du kannst ein festes Analyse-Beispiel
                    laden.
                  </DemoNote>
                )}
                {(analysis === "ready" || analysis === "low-confidence") && (
                  <>
                    <div className="mb-5 flex items-center gap-4">
                      <span className="text-5xl font-semibold tracking-tight">
                        {analysis === "low-confidence" ? "—" : 75}
                        <span className="text-lg muted"> / 100</span>
                      </span>
                      <div>
                        <Status
                          tone={
                            analysis === "low-confidence" ? "orange" : "green"
                          }
                        >
                          {analysis === "low-confidence"
                            ? "Unvollständige Bewertung"
                            : "Solide Grundlage"}
                        </Status>
                        <p className="mt-2 mb-0 text-[10px] muted">
                          v{analysisVersion} · Formel Demo 1.0
                        </p>
                      </div>
                    </div>
                    {(analysisIdentity !== identity || dirty) && (
                      <p role="status" className="mb-3 text-xs text-primary">
                        Ergebnis ist veraltet. Es gehört zu v{analysisVersion}.
                      </p>
                    )}
                    {[
                      ["Hook · 20 %", 72],
                      ["Klarheit · 20 %", 81],
                      [
                        "Diskussion · 20 %",
                        analysis === "low-confidence" ? null : 78,
                      ],
                      [
                        "Originalität · 15 %",
                        analysis === "low-confidence" ? null : 74,
                      ],
                      ["Natürliche CTA · 5 %", 70],
                      ["Struktur · 10 %", 91],
                      ["Historische Passung · 10 %", 50],
                    ].map(([n, value]) => (
                      <div key={n} className="mb-3">
                        <div className="mb-1 flex justify-between text-[10px]">
                          <span>{n}</span>
                          <span className="muted">
                            {value ?? "Keine Daten"}
                          </span>
                        </div>
                        {value !== null && (
                          <div className="h-1 rounded-full bg-secondary">
                            <div
                              className="h-1 rounded-full bg-[#74866a]"
                              style={{ width: `${value}%` }}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                    <p className="my-4 text-[10px] leading-relaxed muted">
                      {analysis === "low-confidence" ? "Niedrige" : "Mittlere"}{" "}
                      Sicherheit · Profil {account?.channel} Demo v3 · Frage-Set
                      Demo v1 · Audience Fit: keine Daten. Historische Passung
                      50 ist ein ausdrücklich markierter Cold-Start-Standard,
                      kein Messwert. Gewichteter Score nur bei vollständigen
                      Kernsignalen. Hypothetische Werte · Kosten: kein
                      Provider-Aufruf.
                    </p>
                    <h4 className="mb-3 text-xs font-semibold">
                      Drei mögliche Verbesserungen
                    </h4>
                    {suggestions.map((s, i) => (
                      <div key={s.title} className="mb-3 border-t pt-3">
                        <h4 className="mb-1 text-xs font-semibold">
                          {i + 1}. {s.title}
                        </h4>
                        <p className="mb-2 text-[11px] leading-relaxed muted">
                          {s.reason}
                        </p>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={
                            !canWrite ||
                            dirty ||
                            analysisIdentity !== identity ||
                            analysis === "low-confidence"
                          }
                          onClick={() => setRecommendation(i)}
                        >
                          <GitCompareArrows size={13} />
                          Änderung prüfen
                        </Button>
                      </div>
                    ))}
                  </>
                )}
                <div className="mt-5 border-t pt-4">
                  <h4 className="mb-2 text-xs font-semibold">
                    Inhaltliche Verifikation
                  </h4>
                  <p className="text-[11px] leading-relaxed muted">
                    Version {v.number}, Quellenaussagen, Ton und Netzwerkformat.
                    Fester Demo-Check, keine tatsächliche Prüfung.
                  </p>
                  <div className="mb-3 flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={
                        dirty ||
                        verification === "loading" ||
                        verifyAttempts >= 2
                      }
                      onClick={() => {
                        setVerifyAttempts((n) => n + 1);
                        setVerification("loading");
                      }}
                    >
                      {verification === "loading"
                        ? "Prüfung simulieren …"
                        : "Demo-Check ansehen"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setVerification("unavailable")}
                    >
                      Ausfall zeigen
                    </Button>
                  </div>
                  <Status
                    tone={
                      verification === "passed"
                        ? "green"
                        : verification === "warning"
                          ? "orange"
                          : "neutral"
                    }
                  >
                    {
                      {
                        unchecked: "Ungeprüft",
                        loading: "Demo-Prüfung läuft",
                        warning: "Manueller Review empfohlen",
                        passed: "Demo-Check bestätigt",
                        unavailable: "Prüfung nicht verfügbar",
                      }[verification]
                    }
                  </Status>
                  <p className="mt-3 mb-2 text-[10px] muted">
                    Prüfungen: {verifyAttempts}/2 · Demo-Budget: höchstens 2
                    Versuche, 0 € · Version {v.number}, {account?.channel},{" "}
                    {account?.handle}
                  </p>
                  {verifyAttempts >= 2 && (
                    <p role="status" className="text-xs text-primary">
                      Versuchslimit erreicht. Redaktionell prüfen oder die neue
                      Version bewusst bearbeiten.
                    </p>
                  )}
                  {verification !== "unchecked" &&
                    verification !== "loading" && (
                      <ul className="space-y-1 pl-4 text-[10px] muted">
                        <li>
                          Bedeutung und Quellenaussagen: manuelle Bestätigung
                          nötig
                        </li>
                        <li>
                          Ton und CTA: keine künstlichen Engagement-Fragen
                        </li>
                        <li>
                          Netzwerkformat: {account?.channel}, Zeichenlimit
                          separat geprüft
                        </li>
                        <li>
                          Starke Behauptungen: Quelle und Unsicherheit prüfen
                        </li>
                      </ul>
                    )}
                  {verification === "warning" && (
                    <p className="mt-3 text-xs leading-relaxed">
                      Prüfe konkrete Zahlen gegen die Originalquelle. Die Demo
                      kann deren Richtigkeit nicht bestätigen.
                    </p>
                  )}
                  {verification === "warning" && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!canWrite}
                        onClick={() => setVerification("passed")}
                      >
                        Hinweis als geprüft markieren
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={!canWrite || dirty || verifyAttempts >= 2}
                        onClick={() => {
                          const updated = v.text.map((t) =>
                            t
                              .replace(/ein bisschen /g, "")
                              .replace(
                                "überraschende Erkenntnis",
                                "Erkenntnis",
                              ),
                          );
                          if (
                            JSON.stringify(updated) === JSON.stringify(v.text)
                          ) {
                            toast.info(
                              "Kein sinnvoller fester Demo-Rewrite vorhanden. Bitte manuell bearbeiten.",
                            );
                            setVerification("unavailable");
                            return;
                          }
                          setAnalysisText([...v.text]);
                          setRecommendation(1);
                        }}
                      >
                        Demo-Nachbesserung prüfen
                      </Button>
                    </div>
                  )}
                </div>
              </Section>
            </TabsContent>
            <TabsContent value="versions">
              <Section title="Versionsverlauf" actions={<History size={15} />}>
                <p className="text-xs leading-relaxed muted">
                  Jede Inhaltsänderung bleibt nachvollziehbar. Wiederherstellung
                  erzeugt eine neue Arbeitsversion.
                </p>
                {draft.historyLimited && (
                  <p role="status" className="text-xs muted">
                    Die letzten 20 Versionen und geplante Snapshots werden
                    angezeigt. Ältere Versionen bleiben im Backend unverändert
                    erhalten.
                  </p>
                )}
                <label>
                  <span className="field-label">Vergleich mit</span>
                  <select
                    className="native-select"
                    value={compare}
                    onChange={(e) => setCompare(Number(e.target.value))}
                  >
                    {draft.versions.map((ver) => (
                      <option key={ver.number} value={ver.number}>
                        Version {ver.number} · {ver.reason}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="my-4 rounded-md border p-3">
                  <span className="eyebrow">Version {compare}</span>
                  <p className="mt-3 mb-0 whitespace-pre-wrap text-xs leading-relaxed">
                    {draft.versions
                      .find((ver) => ver.number === compare)
                      ?.text.join("\n\n—\n\n")}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!canWrite || dirty || compare === v.number}
                  onClick={async () => {
                    const old = draft.versions.find(
                      (ver) => ver.number === compare,
                    );
                    if (
                      old &&
                      (await saveDraft({
                        draftId: draft.id,
                        expectedRevision:
                          base.current?.revision ?? draft.revision ?? v.number,
                        title,
                        accountId,
                        pillar,
                        strategy,
                        text: old.text,
                        mediaIds: old.mediaIds,
                        media: old.media,
                        reason: `Wiederherstellung v${compare}`,
                      }))
                    )
                      toast.success(
                        "Als neue ungeprüfte Version wiederhergestellt.",
                      );
                  }}
                >
                  Als neue Version übernehmen
                </Button>
                {hasMoreVersions && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadMoreVersions}
                  >
                    Ältere Versionen laden
                  </Button>
                )}
                <div className="mt-5 space-y-4">
                  {[...draft.versions].reverse().map((ver) => (
                    <div key={ver.number} className="border-t pt-3">
                      <div className="flex justify-between">
                        <strong className="text-xs">
                          v{ver.number} · {ver.reason}
                        </strong>
                        <span className="text-[10px] muted">
                          {ver.number === v.number ? "Aktuell" : ""}
                        </span>
                      </div>
                      <p className="mt-1 mb-0 text-[10px] muted">
                        {formatDate(ver.createdAt, state.preferences.timezone)}
                      </p>
                    </div>
                  ))}
                </div>
              </Section>
            </TabsContent>
          </Tabs>
          <Button
            variant="ghost"
            size="sm"
            disabled={!demoMode || !canWrite || dirty}
            onClick={() => {
              setVariantAccount(
                state.accounts.find(
                  (a) =>
                    a.workspaceId === state.activeWorkspaceId &&
                    a.id !== draft.accountId,
                )?.id ?? draft.accountId,
              );
              setVariantOpen(true);
            }}
          >
            <Copy size={13} />
            Separate Kanalvariante erstellen
          </Button>
          {draft.packageId && (
            <Section title="Content-Paket">
              <p className="text-[10px] muted">
                Gemeinsamer Ursprung, eigene Versionen und Freigaben je Kanal.
              </p>
              {state.drafts
                .filter(
                  (d) =>
                    d.packageId === draft.packageId &&
                    d.workspaceId === state.activeWorkspaceId,
                )
                .map((d) => (
                  <Link
                    className="mb-2 block text-xs"
                    key={d.id}
                    to={`/drafts/${d.id}`}
                  >
                    {state.accounts.find((a) => a.id === d.accountId)?.channel}{" "}
                    · {d.title} · v{currentVersion(d).number}
                  </Link>
                ))}
            </Section>
          )}
        </aside>
      </div>
      {scheduleOpen && (
        <ScheduleDialog
          draft={draft}
          open={scheduleOpen}
          onOpenChange={setScheduleOpen}
        />
      )}
      <Dialog
        open={blocker.state === "blocked"}
        onOpenChange={(open) => {
          if (!open && blocker.state === "blocked") blocker.reset();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ungespeicherte Änderungen</DialogTitle>
            <DialogDescription>
              Deine Bearbeitung wurde noch nicht gespeichert. Möchtest du auf
              dieser Seite bleiben oder sie verwerfen?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => blocker.state === "blocked" && blocker.reset()}
            >
              Weiter bearbeiten
            </Button>
            <Button
              variant="destructive"
              onClick={() => blocker.state === "blocked" && blocker.proceed()}
            >
              Änderungen verwerfen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={variantOpen} onOpenChange={setVariantOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kanalvariante im Content-Paket erstellen</DialogTitle>
            <DialogDescription>
              Text, Thread-Reihenfolge und Medien werden unverändert übernommen.
              Die neue Variante hat eigene Freigaben und Termine;
              Plattformlimits werden separat geprüft.
            </DialogDescription>
          </DialogHeader>
          <AccountSelect
            value={variantAccount}
            onChange={setVariantAccount}
            label="Ziel-Account der Variante"
          />
          <DemoNote>
            Kein automatisches Umschreiben. Prüfe Ton, Länge, Thread- und
            Medienfähigkeiten für den ausgewählten Kanal.
          </DemoNote>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVariantOpen(false)}>
              Abbrechen
            </Button>
            <Button
              disabled={
                !demoMode || !canWrite || variantAccount === draft.accountId
              }
              onClick={() => {
                const did = uid("draft");
                const packageId = draft.packageId ?? uid("package");
                const saved = mutate((s) => ({
                  ...s,
                  drafts: [
                    {
                      ...draft,
                      id: did,
                      title: `${draft.title} · ${state.accounts.find((a) => a.id === variantAccount)?.channel}`,
                      accountId: variantAccount,
                      packageId,
                      approval: undefined,
                      approvals: [],
                      reviews: [],
                      comments: [],
                      versions: [
                        {
                          ...v,
                          number: 1,
                          text: [...v.text],
                          mediaIds: [...v.mediaIds],
                          createdAt: now(),
                          reason: `Kanalvariante aus ${draft.id} v${v.number}`,
                        },
                      ],
                    },
                    ...s.drafts.map((d) =>
                      d.id === draft.id ? { ...d, packageId } : d,
                    ),
                  ],
                }));
                if (!saved) return;
                setVariantOpen(false);
                nav(`/drafts/${did}`);
                toast.success(
                  "Kanalvariante mit unverändertem Inhalt erstellt. Eigene Freigabe erforderlich.",
                );
              }}
            >
              Variante erstellen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={mediaOpen} onOpenChange={setMediaOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Medien auswählen</DialogTitle>
            <DialogDescription>
              Medienwechsel benötigen eine neue Freigabe. Wähle bis zu vier
              Bilder oder ein Video.
            </DialogDescription>
          </DialogHeader>
          <div className="grid max-h-80 grid-cols-2 gap-3 overflow-y-auto">
            {activeMedia.map((m) => (
              <label key={m.id} className="surface cursor-pointer p-2">
                <MediaPreview
                  asset={m}
                  className="mb-2 h-24 w-full rounded object-cover"
                />
                <span className="flex items-center gap-2 text-xs">
                  <Checkbox
                    checked={mediaIds.includes(m.id)}
                    onCheckedChange={(checked) => {
                      if (
                        checked &&
                        (mediaIds.length >=
                          (account?.capability?.maxMedia ??
                            (demoMode ? 4 : 20)) ||
                          (m.type === "video" && mediaIds.length > 0) ||
                          mediaIds.some(
                            (id) =>
                              activeMedia.find((m) => m.id === id)?.type ===
                              "video",
                          ))
                      ) {
                        toast.error(
                          "Bis zu vier Bilder oder genau ein Video auswählen.",
                        );
                        return;
                      }
                      setMediaIds((ids) =>
                        checked
                          ? [...ids, m.id]
                          : ids.filter((id) => id !== m.id),
                      );
                    }}
                  />
                  {m.name}
                </span>
                {!m.alt && (
                  <span className="text-xs text-destructive">
                    Alttext fehlt
                  </span>
                )}
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" asChild>
              <Link to="/media">Medienbibliothek</Link>
            </Button>
            <Button onClick={() => setMediaOpen(false)}>
              Auswahl übernehmen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={recommendation !== null}
        onOpenChange={() => setRecommendation(null)}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Empfehlung als neue Version übernehmen</DialogTitle>
            <DialogDescription>
              {recommendation !== null ? suggestions[recommendation].title : ""}
              . Die neue Version ist ungeprüft; dein geplanter Snapshot bleibt
              unverändert.
            </DialogDescription>
          </DialogHeader>
          <div className="grid max-h-96 gap-4 overflow-y-auto sm:grid-cols-2">
            <div className="rounded-md border bg-destructive/5 p-3">
              <span className="field-label">Vorher · v{v.number}</span>
              <p className="whitespace-pre-wrap text-xs leading-relaxed">
                {text.join("\n\n")}
              </p>
            </div>
            <div className="rounded-md border bg-[#edf2e9] p-3 dark:bg-secondary">
              <span className="field-label">Nachher · neue Version</span>
              <p className="whitespace-pre-wrap text-xs leading-relaxed">
                {recommendation !== null
                  ? suggestions[recommendation].text().join("\n\n")
                  : ""}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecommendation(null)}>
              Verwerfen
            </Button>
            <Button
              onClick={() => {
                if (recommendation !== null) {
                  mutate(
                    (s) =>
                      editDraft(
                        s,
                        draft.id,
                        {},
                        suggestions[recommendation].text(),
                        undefined,
                        "Mock-Empfehlung übernommen",
                      ),
                    "Empfehlung in neue ungeprüfte Version übernommen.",
                  );
                  setRecommendation(null);
                }
              }}
            >
              <Check size={15} />
              Bewusst übernehmen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
