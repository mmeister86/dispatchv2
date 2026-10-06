import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useUIMessages } from "@convex-dev/agent/react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, Send, Square, Trash2 } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useStore } from "@/lib/store";
import {
  useGithubSourceProofClock,
  githubSourceAuthorized,
} from "@/lib/github-source-proof";
import { canEdit } from "@/lib/model";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader, AccountSelect, Status } from "@/components/shared";
import { ModelConfiguration } from "@/features/settings/models";
export function RealAgentChat() {
  const { state } = useStore();
  const [account, setAccount] = useState(state.activeAccountId);
  const actualAccount = state.accounts.some((a) => a.id === account)
    ? account
    : state.activeAccountId;
  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Dein kreativer Sparringspartner"
        title="Agent"
        description="Gedanken sortieren und Vorschläge prüfen."
      />
      <AccountSelect value={actualAccount} onChange={setAccount} />
      {state.activeWorkspaceId && actualAccount ? (
        <ChatSession
          key={`${state.activeWorkspaceId}:${actualAccount}`}
          workspaceId={state.activeWorkspaceId as Id<"workspaces">}
          accountId={actualAccount as Id<"socialAccounts">}
          editable={canEdit(state.role)}
        />
      ) : (
        <p className="muted">Wähle einen Account für die Unterhaltung.</p>
      )}
      <ModelConfiguration />
    </div>
  );
}
function failure(e: unknown) {
  const s = e instanceof Error ? e.message : String(e);
  if (s.includes("CONFIGURATION") || s.includes("NOT_APPROVED"))
    return "Modellzugang benötigt einen freigegebenen EU-Verarbeitungspfad, aktuelle Preise und Budgets für Provider, Workspace und Account. Die Nachricht bleibt erhalten.";
  if (s.includes("RECONCILIATION"))
    return "Ein früherer Modellaufruf hat noch offene Verbrauchsbelege. Fortsetzung erst nach sicherem Abgleich.";
  if (s.includes("SOURCE") || s.includes("GITHUB"))
    return "Die frühere Quelle ist nicht mehr zur Verarbeitung freigegeben. Beginne eine neue Unterhaltung ohne diese Historie.";
  if (s.includes("BUSY"))
    return "In dieser Unterhaltung läuft bereits eine Antwort.";
  if (s.includes("RESEARCH_REVISION_CONFLICT"))
    return "Das gespeicherte Rechercheprofil wurde inzwischen geändert. Prüfe das aktuelle Profil auf der Recherche-Seite. Dein Recherchethema bleibt erhalten.";
  if (s.includes("REVISION"))
    return "Die Unterhaltung wurde inzwischen geändert. Dein Titel bleibt erhalten.";
  return "Die Aktion konnte nicht bestätigt werden. Deine Eingabe bleibt erhalten.";
}
function ChatSession({
  workspaceId,
  accountId,
  editable,
}: {
  workspaceId: Id<"workspaces">;
  accountId: Id<"socialAccounts">;
  editable: boolean;
}) {
  const scope = { workspaceId, accountId };
  const [params] = useSearchParams();
  const list = useQuery(api.ai.conversations.list, {
    ...scope,
    paginationOpts: { numItems: 25, cursor: null },
  });
  const [selected, setSelected] = useState<Id<"conversations"> | null>(null);
  const [prompt, setPrompt] = useState(params.get("question") ?? "");
  const [title, setTitle] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [allowIdeaCreation, setAllowIdeaCreation] = useState(false);
  const [ideaId, setIdeaId] = useState("");
  const ideas = useQuery(api.content.ideas.list, {
    workspaceId,
    paginationOpts: { numItems: 25, cursor: null },
  });
  const researchProfile = useQuery(api.research.profiles.get, scope);
  const [topic, setTopic] = useState("");
  const [language, setLanguage] = useState("");
  const [researchOperations, setResearchOperations] = useState<
    ("web-search" | "x-recent" | "x-trends")[]
  >(["web-search"]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const create = useMutation(api.ai.conversations.create),
    send = useMutation(api.ai.conversations.send),
    rename = useMutation(api.ai.conversations.rename),
    remove = useMutation(api.ai.conversations.remove),
    stop = useMutation(api.ai.conversations.stop),
    resume = useMutation(api.ai.conversations.resume),
    research = useMutation(api.ai.conversations.research),
    stopResearch = useMutation(api.research.runs.stop),
    resumeResearch = useMutation(api.research.pipeline.resume),
    cleanupUnavailable = useMutation(api.ai.conversations.cleanupUnavailable);
  const current =
    list?.page.find((c) => c.conversationId === selected) ??
    list?.page.find((c) => c.state === "active");
  const selection = current?.conversationId ?? null;
  const latest = useRef({ selection, editable, epoch: 0 });
  latest.current = {
    selection,
    editable,
    epoch:
      latest.current.epoch + (latest.current.editable === editable ? 0 : 1),
  };
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const operations = useQuery(
    api.ai.conversations.status,
    selection ? { ...scope, conversationId: selection } : "skip",
  );
  const researchOrders = useQuery(
    api.ai.conversations.researchStatus,
    selection ? { ...scope, conversationId: selection } : "skip",
  );
  const researchRunning = researchOrders?.some(
    (o) => o.state === "queued" || o.state === "running",
  );
  const operation = operations?.[0];
  const running =
    operation?.state === "ready" || operation?.state === "running";
  const projection = useQuery(
    api.ai.conversations.projection,
    selection ? { ...scope, conversationId: selection } : "skip",
  );
  const proofs = useMemo(() => (projection ? [projection] : []), [projection]);
  const clock = useGithubSourceProofClock(proofs);
  const readable = !!projection && githubSourceAuthorized(projection, clock);
  const history = useUIMessages(
    api.ai.conversations.messages,
    selection && current?.state === "active" && readable
      ? { ...scope, threadId: selection }
      : "skip",
    { initialNumItems: 20, stream: true },
  );
  useEffect(() => {
    if (projection && !readable) {
      setPrompt("");
      setTopic("");
      setTitle("");
      setIdeaId("");
      setAllowIdeaCreation(false);
      setRenaming(false);
      if (selection && current?.state === "active")
        void cleanupUnavailable({
          workspaceId,
          accountId,
          conversationId: selection,
        }).catch(() => {});
    }
  }, [
    projection?.authorized,
    projection?.proofExpiresAt,
    readable,
    selection,
    current?.state,
    cleanupUnavailable,
    workspaceId,
    accountId,
  ]);
  const researchKey = useRef({
    payload: "",
    key: crypto.randomUUID(),
    revision: 0,
  });
  const createKey = useRef(crypto.randomUUID()),
    sendKey = useRef({ payload: "", key: crypto.randomUUID() });
  async function command(
    action: () => Promise<unknown>,
    done?: () => void,
    ignoreSelection = false,
  ) {
    if (!editable || pending) return;
    const before = selection,
      epoch = latest.current.epoch;
    setPending(true);
    setError("");
    try {
      await action();
      if (
        alive.current &&
        latest.current.editable &&
        latest.current.epoch === epoch &&
        (ignoreSelection || latest.current.selection === before)
      )
        done?.();
    } catch (e) {
      if (
        alive.current &&
        latest.current.editable &&
        latest.current.epoch === epoch &&
        (ignoreSelection || latest.current.selection === before)
      )
        setError(failure(e));
    } finally {
      if (alive.current) setPending(false);
    }
  }
  async function newConversation() {
    let id: Id<"conversations"> | undefined;
    await command(
      async () => {
        id = await create({ ...scope, operationKey: createKey.current });
      },
      () => {
        setSelected(id!);
        createKey.current = crypto.randomUUID();
        setRenaming(false);
      },
      true,
    );
  }
  async function submit() {
    if (!selection || !prompt.trim() || running || researchRunning) return;
    const payload = JSON.stringify({ prompt, allowIdeaCreation, ideaId });
    if (payload !== sendKey.current.payload)
      sendKey.current = { payload, key: crypto.randomUUID() };
    await command(
      () =>
        send({
          ...scope,
          conversationId: selection,
          operationKey: sendKey.current.key,
          prompt,
          allowIdeaCreation,
          ...(ideaId ? { ideaId: ideaId as Id<"ideas"> } : {}),
        }),
      () => {
        setPrompt("");
        sendKey.current = { payload: "", key: crypto.randomUUID() };
      },
    );
  }
  async function requestResearch() {
    if (
      !selection ||
      !researchProfile ||
      !topic.trim() ||
      researchRunning ||
      running
    )
      return;
    const selectedLanguage =
      language || researchProfile.version.config.languages[0];
    const payload = JSON.stringify({
      selection,
      topic,
      language: selectedLanguage,
      operations: researchOperations,
      profileId: researchProfile.profile._id,
    });
    if (payload !== researchKey.current.payload)
      researchKey.current = {
        payload,
        key: crypto.randomUUID(),
        revision: researchProfile.profile.revision,
      };
    await command(
      () =>
        research({
          ...scope,
          conversationId: selection,
          profileId: researchProfile.profile._id,
          expectedRevision: researchKey.current.revision,
          operationKey: researchKey.current.key,
          topic,
          language: selectedLanguage,
          operations: researchOperations,
        }),
      () => {
        setTopic("");
        researchKey.current = {
          payload: "",
          key: crypto.randomUUID(),
          revision: 0,
        };
      },
    );
  }
  return (
    <div className="mt-5 grid gap-6 lg:grid-cols-[250px_minmax(0,1fr)]">
      <aside className="space-y-4">
        <Button
          variant="outline"
          disabled={!editable || pending}
          onClick={newConversation}
        >
          <Plus size={15} />
          Neue Unterhaltung
        </Button>
        <div className="surface p-3">
          <div className="eyebrow px-2 py-2">Unterhaltungen · letzte 25</div>
          {list === undefined ? (
            <p className="muted px-2">Unterhaltungen werden geladen …</p>
          ) : (
            list.page
              .filter((c) => c.state !== "deleted")
              .map((c) => (
                <div
                  key={c.conversationId}
                  className={`flex rounded-md ${selection === c.conversationId ? "bg-secondary" : ""}`}
                >
                  <button
                    className="min-w-0 flex-1 p-3 text-left"
                    disabled={pending}
                    onClick={() => {
                      setSelected(c.conversationId);
                      setRenaming(false);
                      setError("");
                    }}
                  >
                    <span className="block truncate text-xs font-semibold">
                      {c.title}
                    </span>
                    <span className="muted text-[11px]">
                      {c.state === "deleting"
                        ? "Lokale Bereinigung läuft"
                        : `${c.turns} Nachrichten gesendet`}
                    </span>
                  </button>
                  <Button
                    aria-label={`${c.title} löschen`}
                    variant="ghost"
                    size="icon"
                    disabled={!editable || pending || c.state !== "active"}
                    onClick={() =>
                      command(
                        () =>
                          remove({
                            ...scope,
                            conversationId: c.conversationId,
                          }),
                        () => {
                          setSelected(null);
                        },
                      )
                    }
                  >
                    <Trash2 size={13} />
                  </Button>
                </div>
              ))
          )}
          {list && !list.page.length && (
            <p className="muted text-xs p-2">Beginne eine neue Unterhaltung.</p>
          )}
        </div>
        <p className="muted text-xs">
          Neue Unterhaltungen und Titel werden gespeichert. KI-Verarbeitung
          benötigt aktuelle Freigaben. Quellen aus Links sind ungeprüfte
          Hinweise.
        </p>
      </aside>
      <div className="surface min-h-[600px] flex flex-col overflow-hidden">
        <div className="border-b p-5 flex gap-3 justify-between">
          <div>
            {renaming && current ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  command(
                    () =>
                      rename({
                        ...scope,
                        conversationId: current.conversationId,
                        title,
                        expectedRevision: current.revision,
                      }),
                    () => setRenaming(false),
                  );
                }}
              >
                <Input
                  aria-label="Unterhaltung umbenennen"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={pending}
                />
                <Button
                  size="sm"
                  disabled={pending || !editable || !title.trim()}
                >
                  Titel speichern
                </Button>
              </form>
            ) : (
              <button
                className="text-sm font-semibold"
                disabled={
                  !current || !editable || pending || current.state !== "active"
                }
                onClick={() => {
                  setTitle(current!.title);
                  setRenaming(true);
                }}
              >
                {current?.title ?? "Ein guter Gedanke ist ein Anfang"}
              </button>
            )}
          </div>
          <Status>
            {current?.state === "deleting"
              ? "Bereinigung läuft"
              : "Persistenter Chat"}
          </Status>
        </div>
        <div className="flex-1 p-6 space-y-5" aria-live="polite">
          {selection && !readable && (
            <p className="muted">
              Die Nachrichtenquelle ist nicht mehr zur Ansicht oder Verarbeitung
              freigegeben. Verbrauchsbelege bleiben sichtbar; beginne eine neue
              Unterhaltung.
            </p>
          )}
          {history.status === "LoadingFirstPage" && selection ? (
            <p className="muted">Nachrichten werden geladen …</p>
          ) : (
            (readable && current?.state === "active"
              ? history.results
              : []
            ).map((m) => (
              <div
                key={m.key}
                className={
                  m.role === "user"
                    ? "ml-auto bg-secondary p-4 rounded-lg max-w-[85%]"
                    : "max-w-[92%]"
                }
              >
                <span className="eyebrow block mb-2">
                  {m.role === "user" ? "Du" : "Dispatch Agent"} · {m.status}
                </span>
                {m.text && (
                  <p className="whitespace-pre-wrap text-sm leading-7">
                    {m.text}
                  </p>
                )}
                {m.parts
                  .filter((p) => p.type.startsWith("tool-"))
                  .map((p, i) => (
                    <span className="block text-xs muted" key={i}>
                      {p.type} · {"state" in p ? String(p.state) : ""}
                    </span>
                  ))}
              </div>
            ))
          )}
          {history.status === "CanLoadMore" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => history.loadMore(20)}
            >
              Ältere Nachrichten laden
            </Button>
          )}
          {operations?.map((o) => (
            <div
              className="border rounded-lg p-4 text-xs space-y-2"
              key={o.runId}
            >
              <Status
                tone={
                  o.state === "failed"
                    ? "red"
                    : o.state === "completed"
                      ? "green"
                      : "neutral"
                }
              >
                Lauf {o.state}
              </Status>
              <p className="muted mb-0">
                {o.model ?? "Modell noch nicht aufgerufen"} · Prompt{" "}
                {o.promptVersion} · Konfiguration {o.policyVersion}
              </p>
              <p className="muted mb-0">
                Tokens {o.inputTokens ?? "offen"} / {o.outputTokens ?? "offen"}{" "}
                ·{" "}
                {o.estimatedMicros === null
                  ? "Kostenbeleg offen"
                  : `${(o.estimatedMicros / 1e6).toFixed(6)} ${o.currency} geschätzt`}
                {o.heldMicros > 0
                  ? ` · ${(o.heldMicros / 1e6).toFixed(6)} ${o.currency} reserviert`
                  : ""}
                {o.usagePending ? " · Abgleich offen" : ""}
              </p>
              {o.errorCode && (
                <p>
                  Die Antwort konnte nicht abgeschlossen werden.
                  Verbrauchsbelege bleiben erhalten.
                </p>
              )}
              {o.resultIdeaId && (
                <Link
                  className="font-semibold text-primary"
                  to={`/ideas?idea=${o.resultIdeaId}`}
                >
                  Gespeicherte Idee prüfen · Klärung und Entwurf separat
                </Link>
              )}
              {(o.state === "stopped" || o.state === "failed") &&
                o.runId === operation?.runId && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={
                      !editable ||
                      pending ||
                      o.operationUsagePending ||
                      !readable ||
                      current?.state !== "active"
                    }
                    onClick={() =>
                      command(() =>
                        resume({
                          ...scope,
                          conversationId: selection!,
                          operationId: o.operationId,
                          expectedRunId: o.runId,
                        }),
                      )
                    }
                  >
                    Antwort fortsetzen
                  </Button>
                )}
            </div>
          ))}
        </div>
        {params.get("source") && (
          <p className="border-t px-5 py-3 text-xs muted">
            Ungeprüfter Quellenhinweis: {params.get("source")}
          </p>
        )}
        <div className="border-t p-5 space-y-3">
          <p className="text-sm font-semibold">
            Gezielte Recherche in dieser Unterhaltung
          </p>
          {!researchProfile ? (
            <Link to="/research" className="text-sm text-primary">
              Gespeichertes Rechercheprofil und Quellenbudgets auf der
              Recherche-Seite einrichten.
            </Link>
          ) : (
            <>
              <Input
                aria-label="Recherchethema"
                value={topic}
                maxLength={450}
                onChange={(e) => setTopic(e.target.value)}
                disabled={
                  !editable ||
                  pending ||
                  running ||
                  researchRunning ||
                  !readable
                }
              />
              <label className="text-xs">
                Recherchesprache{" "}
                <select
                  aria-label="Recherchesprache"
                  value={
                    language || researchProfile.version.config.languages[0]
                  }
                  onChange={(e) => setLanguage(e.target.value)}
                  disabled={!editable || pending || researchRunning}
                >
                  {researchProfile.version.config.languages.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex gap-4 text-xs">
                {(["web-search", "x-recent", "x-trends"] as const).map((op) => (
                  <label key={op}>
                    <input
                      type="checkbox"
                      checked={researchOperations.includes(op)}
                      disabled={!editable || pending || researchRunning}
                      onChange={(e) =>
                        setResearchOperations(
                          e.target.checked
                            ? [...researchOperations, op]
                            : researchOperations.filter((x) => x !== op),
                        )
                      }
                    />{" "}
                    {op}
                  </label>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={requestResearch}
                disabled={
                  !editable ||
                  pending ||
                  running ||
                  researchRunning ||
                  !readable ||
                  !selection ||
                  !topic.trim() ||
                  !researchOperations.length ||
                  !researchProfile.version.config.cap ||
                  researchProfile.profile.paused
                }
              >
                Recherche starten
              </Button>
              {!researchProfile.version.config.cap && (
                <Link to="/research" className="text-sm text-primary">
                  Recherchelimit im gespeicherten Profil einrichten.
                </Link>
              )}
              <p className="muted text-xs">
                Einmaliges Thema, gespeichertes Profil und eigene
                Recherchebudgets. Review bleibt ungeprüft; deine anschließende
                Nachricht benötigt separate Chat-Freigaben und einen verbundenen
                Account.
              </p>
            </>
          )}
          {researchOrders?.map((o) => (
            <div key={o.orderId} className="text-xs space-y-2">
              <p>
                Rechercheauftrag {o.orderId} · {o.state} · {o.outcome}
                {o.usagePending ? " · Verbrauchsabgleich offen" : ""}
                {o.messageSaved ? " · Ergebnisnachricht gespeichert" : ""}
              </p>
              {(o.state === "queued" || o.state === "running") && (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!editable || pending}
                    onClick={() =>
                      command(() =>
                        stopResearch({ workspaceId, orderId: o.orderId }),
                      )
                    }
                  >
                    Recherche anhalten
                  </Button>{" "}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!editable || pending || o.usagePending}
                    onClick={() =>
                      command(() =>
                        resumeResearch({ workspaceId, orderId: o.orderId }),
                      )
                    }
                  >
                    Recherchefortsetzung prüfen
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>
        <form
          className="border-t p-5"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Textarea
            aria-label="Nachricht an Agent"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Teile deinen Gedanken …"
            disabled={
              !editable ||
              pending ||
              running ||
              researchRunning ||
              !selection ||
              !readable ||
              current?.state !== "active"
            }
          />
          <label className="block text-xs my-3">
            Ideenkontext · letzte 25
            <select
              aria-label="Ideenkontext"
              className="block border rounded p-2 mt-2 w-full bg-background"
              value={ideaId}
              onChange={(e) => setIdeaId(e.target.value)}
              disabled={!editable || pending || running}
            >
              <option value="">Eigene Nachricht ohne neue Quelle</option>
              {ideas?.page
                .filter((x) => x.idea.status !== "archived")
                .map((x) => (
                  <option key={x.idea._id} value={x.idea._id}>
                    {x.version.title} · v{x.version.number}
                  </option>
                ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs my-3">
            <input
              type="checkbox"
              checked={allowIdeaCreation}
              disabled={!editable || pending || running}
              onChange={(e) => setAllowIdeaCreation(e.target.checked)}
            />
            Eine ungeprüfte Idee darf für diesen Auftrag gespeichert werden
          </label>
          <div className="flex items-center justify-between gap-3">
            <span className="muted text-[11px]">
              Keine automatische Freigabe, Planung oder Veröffentlichung.
              Entwürfe bestätigst du in Ideen.
            </span>
            {running ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!editable || pending}
                onClick={() =>
                  command(() => stop({ ...scope, conversationId: selection! }))
                }
              >
                <Square size={12} />
                Anhalten
              </Button>
            ) : (
              <Button
                size="sm"
                disabled={
                  !editable ||
                  pending ||
                  !selection ||
                  !prompt.trim() ||
                  current?.state !== "active"
                }
              >
                <Send size={13} />
                {pending ? "Wird bestätigt …" : "Senden"}
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
