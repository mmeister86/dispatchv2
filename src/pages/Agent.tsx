import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowUpRight,
  Check,
  MessageSquare,
  Plus,
  Send,
  Square,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  PageHeader,
  Section,
  Status,
  DemoNote,
  EmptyState,
  AccountSelect,
} from "@/components/shared";
import { useStore, useWorkspaceLocalState } from "@/lib/store";
import { canEdit, uid, now } from "@/lib/model";
import { demoMode } from "@/lib/auth-client";
import { ModelConfiguration } from "@/features/settings/models";
type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  at: string;
};
type Conversation = {
  id: string;
  accountId: string;
  title: string;
  messages: Message[];
  status: "idle" | "running" | "stopped" | "error" | "completed";
  progress: number;
  version: number;
  draftId?: string;
  source?: string;
};
const answer =
  "Ich sehe einen guten Ansatz: Erzähle von einer kleinen Produktentscheidung, die euren Nutzern Zeit spart.\n\nBeginne mit der konkreten Beobachtung. Zeige anschließend, was du geändert hast und welches Learning du mitnimmst. Eine persönliche Perspektive ist glaubwürdiger als ein allgemeines Versprechen.\n\nMein Vorschlag bleibt ein Entwurf. Prüfe Fakten, Ton und Quellen vor einer Freigabe.";
export function AgentPage() {
  return demoMode ? (
    <DemoAgentPage />
  ) : (
    <div className="fade-in">
      <PageHeader
        eyebrow="Dein kreativer Sparringspartner"
        title="Agent"
        description="Der Chat wird mit dem persistenten Agent verbunden."
      />
      <ModelConfiguration />
    </div>
  );
}
function DemoAgentPage() {
  const { state, createDraft } = useStore();
  const [params] = useSearchParams();
  const sourceContext = params.get("source") ?? "";
  const editable = canEdit(state.role);
  const navigate = useNavigate();
  const [conversations, setConversations] = useWorkspaceLocalState<
    Conversation[]
  >("agent-conversations", []);
  const [account, setAccount] = useState(state.activeAccountId);
  const [selected, setSelected] = useState("");
  const [prompt, setPrompt] = useState(params.get("question") ?? "");
  const [simulateError, setSimulateError] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const scoped = conversations.filter((c) => c.accountId === account);
  const conversation = scoped.find((c) => c.id === selected) ?? scoped[0];
  const update = (id: string, patch: Partial<Conversation>) => {
    if (editable)
      setConversations((cs) =>
        cs.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      );
  };
  useEffect(() => {
    if (!conversation || conversation.status !== "running" || !editable) return;
    const id = conversation.id;
    const timer = window.setTimeout(() => {
      setConversations((cs) =>
        cs.map((c) => {
          if (c.id !== id || c.status !== "running") return c;
          if (simulateError && c.progress >= 35)
            return { ...c, status: "error" };
          const progress = Math.min(c.progress + 14, 100);
          return {
            ...c,
            progress,
            status: progress === 100 ? "completed" : "running",
            messages:
              progress === 100
                ? [
                    ...c.messages,
                    {
                      id: uid("message"),
                      role: "assistant",
                      text: answer,
                      at: now(),
                    },
                  ]
                : c.messages,
          };
        }),
      );
    }, 330);
    return () => window.clearTimeout(timer);
  }, [
    conversation?.id,
    conversation?.progress,
    conversation?.status,
    editable,
    simulateError,
    setConversations,
  ]);
  function start(text: string) {
    if (!editable || !text.trim() || conversation?.status === "running") return;
    const message: Message = {
      id: uid("message"),
      role: "user",
      text: text.trim(),
      at: now(),
    };
    if (conversation)
      update(conversation.id, {
        messages: [...conversation.messages, message],
        status: "running",
        progress: 0,
        version: conversation.version + 1,
        draftId: undefined,
        source: sourceContext || conversation.source,
      });
    else {
      const id = uid("conversation");
      setConversations((cs) => [
        {
          id,
          accountId: account,
          title: text.trim().slice(0, 42),
          messages: [message],
          status: "running",
          progress: 0,
          version: 1,
          source: sourceContext,
        },
        ...cs,
      ]);
      setSelected(id);
    }
    setPrompt("");
  }
  function newConversation() {
    if (!editable) return;
    const id = uid("conversation");
    setConversations((cs) => [
      {
        id,
        accountId: account,
        title: "Neue Unterhaltung",
        messages: [],
        status: "idle",
        progress: 0,
        version: 0,
      },
      ...cs,
    ]);
    setSelected(id);
    setPrompt("");
  }
  async function draft() {
    if (!conversation || !editable) return;
    if (
      conversation.draftId &&
      state.drafts.some((d) => d.id === conversation.draftId)
    ) {
      navigate(`/drafts/${conversation.draftId}`);
      return;
    }
    const id = await createDraft(
      "Eine kleine Entscheidung, ein besseres Produkt",
      "Heute haben wir einen Ablauf vereinfacht. Ein Klick weniger, ein klarer nächster Schritt.\n\nKleine Entscheidungen machen ein Produkt jeden Tag ein bisschen besser.",
      `Agent · Unterhaltung ${conversation.id} · Vorschlag v${conversation.version} · simuliert · Quelle: ${conversation.source ?? "Eigene Notiz"} · ${state.accounts.find((a) => a.id === account)?.channel}`,
      account,
    );
    if (id) {
      update(conversation.id, { draftId: id });
      navigate(`/drafts/${id}`);
    }
  }
  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Dein kreativer Sparringspartner"
        title="Agent"
        description="Gedanken sortieren. Perspektiven entdecken. Gemeinsam weiterkommen."
        actions={
          <Button
            variant="outline"
            disabled={!editable}
            onClick={newConversation}
          >
            <Plus size={15} />
            Neue Unterhaltung
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="space-y-5">
          <AccountSelect
            value={account}
            onChange={(id) => {
              setAccount(id);
              setSelected("");
            }}
          />
          <div className="surface p-3">
            <div className="px-2 py-2 eyebrow">Unterhaltungen</div>
            {scoped.map((c) => (
              <div
                key={c.id}
                className={`flex items-center rounded-md ${conversation?.id === c.id ? "bg-secondary" : ""}`}
              >
                <button
                  className="flex-1 text-left px-2 py-3 min-w-0"
                  onClick={() => setSelected(c.id)}
                >
                  <span className="block truncate text-xs font-semibold">
                    {c.title}
                  </span>
                  <span className="muted text-[11px]">
                    {c.messages.length} Nachrichten · v{c.version}
                  </span>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={!editable}
                  aria-label={`${c.title} löschen`}
                  onClick={() => {
                    setConversations((cs) => cs.filter((x) => x.id !== c.id));
                    if (selected === c.id) setSelected("");
                  }}
                >
                  <Trash2 size={13} />
                </Button>
              </div>
            ))}
            {!scoped.length && (
              <p className="muted px-2 py-3 text-xs">
                Dein nächster Gedanke beginnt hier.
              </p>
            )}
          </div>
          <DemoNote>
            Lokaler Demo-Agent. Keine Verbindung zu einem KI-Dienst. Vorschläge
            werden erst durch deinen Klick als Entwurf gespeichert.
          </DemoNote>
          <label className="flex gap-2 items-center text-xs">
            <Switch
              aria-label="Demo-Fehler simulieren"
              checked={simulateError}
              onCheckedChange={setSimulateError}
              disabled={!editable}
            />
            Demo-Fehler simulieren
          </label>
        </aside>
        <div className="surface flex flex-col overflow-hidden min-h-[640px]">
          <div className="border-b px-6 py-4 flex justify-between items-center">
            <div>
              {renaming && conversation ? (
                <Input
                  aria-label="Unterhaltung umbenennen"
                  value={conversation.title}
                  onChange={(e) =>
                    update(conversation.id, { title: e.target.value })
                  }
                  onBlur={() => setRenaming(false)}
                  autoFocus
                />
              ) : (
                <button
                  className="text-sm font-semibold text-left"
                  disabled={!editable || !conversation}
                  onClick={() => setRenaming(true)}
                >
                  {conversation?.title ?? "Ein guter Gedanke ist ein Anfang"}
                </button>
              )}
              <p className="muted text-xs mt-1 mb-0">
                {state.accounts.find((a) => a.id === account)?.channel} ·{" "}
                {state.accounts.find((a) => a.id === account)?.handle}
              </p>
            </div>
            <Status tone="green">Demo-Modus</Status>
          </div>
          <div className="flex-1 px-6 py-7 space-y-6" aria-live="polite">
            {!conversation?.messages.length && (
              <>
                <EmptyState
                  icon={<MessageSquare size={28} />}
                  title="Woran möchtest du arbeiten?"
                  description="Ein halber Gedanke, eine Frage oder eine neue Perspektive. Wir machen etwas daraus."
                />
                <div className="grid gap-2 sm:grid-cols-2 max-w-xl mx-auto">
                  {[
                    "Welche Geschichte steckt in meinem letzten Release?",
                    "Hilf mir, ein Learning klarer zu erzählen.",
                    "Gib mir drei Perspektiven auf Produktdesign.",
                    "Wie kann ich aus einer Notiz einen Beitrag machen?",
                  ].map((p) => (
                    <button
                      key={p}
                      disabled={!editable}
                      onClick={() => start(p)}
                      className="border rounded-md text-left p-3 text-xs hover:bg-secondary leading-relaxed"
                    >
                      {p}
                      <ArrowUpRight size={12} className="mt-2 muted" />
                    </button>
                  ))}
                </div>
              </>
            )}
            {conversation?.messages.map((m) => (
              <div
                key={m.id}
                className={
                  m.role === "user"
                    ? "ml-auto bg-secondary p-4 rounded-lg max-w-[85%]"
                    : "max-w-[92%]"
                }
              >
                <span className="eyebrow block mb-2">
                  {m.role === "user" ? "Du" : "Dispatch Agent"}
                </span>
                <p className="whitespace-pre-wrap text-sm leading-7 mb-0">
                  {m.text}
                </p>
              </div>
            ))}
            {conversation &&
              (conversation.status === "running" ||
                conversation.status === "stopped" ||
                conversation.status === "error") && (
                <div>
                  <span className="eyebrow">
                    Dispatch Agent · v{conversation.version}
                  </span>
                  <div className="flex flex-wrap gap-2 mt-3 mb-4">
                    {[
                      "Kontext lesen",
                      "Perspektive entwickeln",
                      "Vorschlag formulieren",
                    ].map((s, i) => (
                      <Status
                        key={s}
                        tone={
                          conversation.progress > (i + 1) * 30
                            ? "green"
                            : "neutral"
                        }
                      >
                        {conversation.progress > (i + 1) * 30 && (
                          <Check size={11} />
                        )}{" "}
                        {s}
                      </Status>
                    ))}
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-7">
                    {answer.slice(
                      0,
                      Math.floor((answer.length * conversation.progress) / 100),
                    )}
                  </p>
                  <div className="flex gap-3 items-center">
                    <Status
                      tone={conversation.status === "error" ? "red" : "orange"}
                    >
                      {conversation.status === "running"
                        ? "Antwort wird simuliert…"
                        : conversation.status === "error"
                          ? "Demo-Verbindung unterbrochen"
                          : "Angehalten"}
                    </Status>
                    <span className="text-xs muted">
                      {(conversation.progress * 0.0004).toFixed(3)} €
                      Demo-Kosten
                    </span>
                  </div>
                  {conversation.status !== "running" && (
                    <Button
                      className="mt-4"
                      size="sm"
                      variant="outline"
                      disabled={!editable}
                      onClick={() => {
                        setSimulateError(false);
                        update(conversation.id, { status: "running" });
                      }}
                    >
                      {conversation.status === "error"
                        ? "Erneut versuchen"
                        : "Antwort fortsetzen"}
                    </Button>
                  )}
                </div>
              )}
            {conversation?.status === "completed" && (
              <div className="border rounded-lg p-5 bg-background">
                <div className="flex justify-between items-center mb-3">
                  <span className="eyebrow">
                    Vorschlag · v{conversation.version}
                  </span>
                  <Status>Zur Prüfung</Status>
                </div>
                <h3>Eine kleine Entscheidung, ein besseres Produkt</h3>
                <p className="muted text-xs leading-relaxed">
                  Format: persönliche Beobachtung · Quelle: deine eigene
                  Erfahrung. Ergänze konkrete, überprüfte Details im Editor.
                </p>
                <div className="flex flex-wrap gap-3 items-center">
                  <Button size="sm" disabled={!editable} onClick={draft}>
                    <Plus size={14} />
                    {conversation.draftId
                      ? "Entwurf öffnen"
                      : "Entwurf erstellen"}
                  </Button>
                  <Link
                    to="/research"
                    className="text-xs font-semibold hover:text-primary"
                  >
                    Quellen recherchieren{" "}
                    <ArrowUpRight size={12} className="inline" />
                  </Link>
                </div>
                <p className="text-[11px] muted mt-3 mb-0">
                  3 Schritte abgeschlossen · 0,040 € Demo-Kosten · separate
                  Freigabe im Editor
                </p>
              </div>
            )}
          </div>
          {sourceContext && (
            <div className="border-t px-5 py-3 text-xs muted">
              Quellenkontext: {sourceContext}
            </div>
          )}
          <form
            className="border-t p-5"
            onSubmit={(e) => {
              e.preventDefault();
              start(prompt);
            }}
          >
            <Textarea
              aria-label="Nachricht an Agent"
              placeholder="Teile deinen Gedanken…"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={!editable || conversation?.status === "running"}
              className="min-h-24 resize-none"
            />
            <div className="flex justify-between items-center mt-3">
              <span className="muted text-[11px]">
                {editable
                  ? "Demo-Antworten sind keine verifizierten Fakten."
                  : "Viewer können Unterhaltungen lesen."}
              </span>
              {conversation?.status === "running" ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!editable}
                  onClick={() => update(conversation.id, { status: "stopped" })}
                >
                  <Square size={12} />
                  Anhalten
                </Button>
              ) : (
                <Button size="sm" disabled={!editable || !prompt.trim()}>
                  <Send size={13} />
                  Senden
                </Button>
              )}
            </div>
          </form>
        </div>
      </div>
      <div className="mt-5">
        <Section
          title="Du behältst die Entscheidung"
          description="Der Agent erstellt keine Freigaben oder Termine. Jeder Vorschlag geht durch deinen eigenen Review."
        >
          <p className="text-xs muted mb-0">
            Unterhaltungen und Vorschlagsversionen werden lokal pro Workspace
            und Account gespeichert.
          </p>
        </Section>
      </div>
    </div>
  );
}
