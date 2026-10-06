import { Link, useNavigate } from "react-router-dom";
import type { FunctionReturnType } from "convex/server";
import { Input } from "@/components/ui/input";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/shared";
import { useGithubSourceProofClock } from "@/lib/github-source-proof";
type Operation = Doc<"researchSourcePolicies">["operation"];
type Command = (
  fn: (key: string) => Promise<unknown>,
  success: () => void,
) => Promise<void>;
export function ResearchPipeline({
  workspaceId,
  profileId,
  revision,
  config,
  disabled,
  command,
  onSelect,
}: {
  workspaceId: Id<"workspaces">;
  profileId: Id<"researchProfiles">;
  revision: number;
  config: Doc<"researchProfileVersions">["config"];
  disabled: boolean;
  command: Command;
  onSelect: (id: Id<"researchOrders">) => void;
}) {
  const start = useMutation(api.research.pipeline.start);
  const [operations, setOperations] = useState<Operation[]>(["web-search"]),
    [language, setLanguage] = useState(config.languages[0]);
  const effectiveLanguage = config.languages.includes(language)
    ? language
    : config.languages[0];
  return (
    <Section title="Research-Workflow">
      <p>
        Neue ausdrückliche Recherche mit gespeicherten Themen, Projektbezug und
        Ausschlüssen. Eine begrenzte Frage, getrennte Quellenbudgets und eine
        freigegebene Modellauswertung. Alte vorbereitete Zeitpläne bleiben
        blockiert.
      </p>
      <fieldset disabled={disabled} className="space-y-3 mt-4">
        <label>
          Workflow-Sprache
          <select
            className="w-full border rounded p-2"
            value={effectiveLanguage}
            onChange={(e) => setLanguage(e.target.value)}
          >
            {config.languages.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </label>
        <div className="flex gap-4">
          {(["x-recent", "x-trends", "web-search"] as const).map((op) => (
            <label key={op}>
              <input
                type="checkbox"
                checked={operations.includes(op)}
                onChange={(e) =>
                  setOperations(
                    e.target.checked
                      ? [...operations, op]
                      : operations.filter((x) => x !== op),
                  )
                }
              />
              {op === "web-search"
                ? "Web"
                : op === "x-recent"
                  ? "X Recent"
                  : "X Snapshot"}
            </label>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">
          API-Schlüssel aktivieren keine Verarbeitung. Aktuelle Quellenrechte,
          Suchpreise und drei Suchbudgets sowie freigegebene Modellpreise und
          drei Modellbudgets in derselben Limit-Währung sind erforderlich.
          Fehlende Konfiguration wird sichtbar; es gibt keine automatische
          Idea-/Draft-Übergabe.
        </p>
        <Button
          disabled={!config.cap || !operations.length}
          onClick={() => {
            const intent = {
              workspaceId,
              profileId,
              expectedRevision: revision,
              language: effectiveLanguage,
              operations: [...operations],
            };
            let id: Id<"researchOrders">;
            void command(
              async (key) => {
                id = await start({ ...intent, operationKey: key });
                return id;
              },
              () => onSelect(id),
            );
          }}
        >
          Research-Workflow ausdrücklich starten
        </Button>
      </fieldset>
    </Section>
  );
}
export function ResearchInbox({
  accountId,
  profile,
  onSelect,
  workspaceId,
  orderId,
  disabled,
  command,
}: {
  workspaceId: Id<"workspaces">;
  accountId: Id<"socialAccounts">;
  profile: {
    profileId: Id<"researchProfiles">;
    revision: number;
    config: Doc<"researchProfileVersions">["config"];
  } | null;
  onSelect: (id: Id<"researchOrders">) => void;
  orderId: Id<"researchOrders"> | null;
  disabled: boolean;
  command: Command;
}) {
  const [resumeMessage, setResumeMessage] = useState("");
  const row = useQuery(
      api.research.pipeline.results,
      orderId ? { workspaceId, orderId } : "skip",
    ),
    resume = useMutation(api.research.pipeline.resume);
  const clock = useGithubSourceProofClock(
    (row?.results ?? []).map((e) => ({
      authorized: true,
      proofExpiresAt: e.retentionUntil,
    })),
  );
  return (
    <Section title="Research-Inbox">
      <AccountInbox
        workspaceId={workspaceId}
        accountId={accountId}
        profile={profile}
        disabled={disabled}
        onSelect={onSelect}
      />
      {!orderId ? (
        <p>Wähle einen tatsächlichen Auftrag aus der Historie.</p>
      ) : row === undefined ? (
        <p>Workflow-Belege werden geladen …</p>
      ) : !row ? (
        <p>Dieser Auftrag enthält keinen Research-Workflow.</p>
      ) : (
        <div className="space-y-4">
          <p role="status">
            Schritt {row.step}/10 · {row.outcome} · automatische Übergabe{" "}
            {row.automaticHandoff?.state ?? "deaktiviert"}.
          </p>
          <p>
            {row.estimatedMicros === null
              ? "Verbrauch nicht vollständig bestätigt"
              : `Vorläufige Schätzung ${row.estimatedMicros / 1e6} ${row.currency}`}
            {row.usagePending
              ? " · finanzielle Haftung ungeklärt; kein automatischer bezahlter Wiederholungsversuch"
              : ""}
            . Abgerechneter Betrag nicht bestätigt.
          </p>
          <p>
            {row.nextAt === null
              ? "Kein aktivierter Workflow-Folgeaufruf."
              : `Nächster aktivierter Aufruf: ${new Date(row.nextAt).toISOString()}`}
          </p>
          {row.sourceCoverage === null && (
            <p>
              Frühere Quellen-Auswahlabdeckung nicht aufgezeichnet;
              Vollständigkeit unbekannt.
            </p>
          )}
          {row.sourceCoverage?.some((c) => c.omitted > 0) && (
            <p>
              Begrenzte Quellenabdeckung (maximal 10):{" "}
              {row.sourceCoverage
                .map(
                  (c) =>
                    `${c.operation}: ${c.delivered} geliefert, ${c.selected} ausgewählt, ${c.omitted} ausgelassen`,
                )
                .join(" · ")}
              . Ergebnisabdeckung ist unvollständig.
            </p>
          )}
          {row.historyIncomplete && (
            <p>
              Begrenzte Rechercheabdeckung; fehlende Treffer beweisen keine
              Neuheit.
            </p>
          )}
          {row.removed ? (
            <p>
              Quellenstand oder aktuelle Berechtigung nicht mehr nutzbar.
              Inhalte ausgeblendet; physische Bereinigung: {row.cleanupState}.
            </p>
          ) : !row.results.length ? (
            <p>
              Keine aktuell nutzbaren Inbox-Ergebnisse. Leere erfolgreiche Suche
              und technische Unterbrechung sind getrennte Auftragsstatus.
            </p>
          ) : (
            row.results.map((e) =>
              e.retentionUntil <= clock ? (
                <p key={e.evidenceId}>
                  Quellen- oder Berechtigungsnachweis abgelaufen; Ergebnis
                  ausgeblendet.
                </p>
              ) : (
                <article key={e.evidenceId} className="border-t pt-3">
                  <h3 className="font-semibold">
                    {e.payload?.model?.title ?? "Research-Ergebnis"} · Review
                  </h3>
                  <p>
                    Aussage der Quelle / ungeprüft:{" "}
                    {e.payload?.annotation.claim}
                  </p>
                  <p>Interpretation: {e.payload?.annotation.interpretation}</p>
                  <p>Account-Perspektive: {e.payload?.model?.perspective}</p>
                  <p>Relevanz: {e.payload?.annotation.relevance}</p>
                  <p>Neuheit: {e.payload?.annotation.novelty}</p>
                  <p>Dynamik: {e.payload?.model?.dynamics}</p>
                  <p>Unsicherheit: {e.payload?.annotation.uncertainty}</p>
                  <p>Lücken: {e.payload?.annotation.gaps.join(" · ")}</p>
                  <p>
                    Publiziert:{" "}
                    {e.publishedAt === null
                      ? "unbekannt"
                      : new Date(e.publishedAt).toISOString()}{" "}
                    · Beobachtet: {new Date(e.observedAt).toISOString()}. Kein
                    automatischer Gültigkeitsnachweis.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {e.provenance?.promptVersion} ·{" "}
                    {e.provenance?.policyVersion}
                  </p>
                </article>
              ),
            )
          )}
          {resumeMessage && <p role="status">{resumeMessage}</p>}
          {row.outcome === "pending" && (
            <Button
              variant="outline"
              disabled={disabled}
              onClick={() => {
                let status: "running" | "restarted";
                void command(
                  async () => {
                    status = await resume({ workspaceId, orderId: orderId! });
                  },
                  () =>
                    setResumeMessage(
                      status === "running"
                        ? "Workflow läuft bereits; gespeicherte Schritte und Aufträge werden weiterverwendet."
                        : "Workflow mit denselben gespeicherten Schritten fortgesetzt.",
                    ),
                );
              }}
            >
              Gespeicherten Workflow prüfen / fortsetzen
            </Button>
          )}
        </div>
      )}
    </Section>
  );
}

type InboxRow = FunctionReturnType<
  typeof api.research.evidence.inbox
>["page"][number];
type ProfileSelection = {
  profileId: Id<"researchProfiles">;
  revision: number;
  config: Doc<"researchProfileVersions">["config"];
} | null;
function AccountInbox({
  workspaceId,
  accountId,
  profile,
  disabled,
  onSelect,
}: {
  workspaceId: Id<"workspaces">;
  accountId: Id<"socialAccounts">;
  profile: ProfileSelection;
  disabled: boolean;
  onSelect: (id: Id<"researchOrders">) => void;
}) {
  const [cursor, setCursor] = useState<string | null>(null);
  const rows = useQuery(api.research.evidence.inbox, {
    workspaceId,
    accountId,
    paginationOpts: { cursor, numItems: 10 },
  });
  const clock = useGithubSourceProofClock(
    (rows?.page ?? []).flatMap((e) => [
      { authorized: !!e.payload, proofExpiresAt: e.proofUntil },
      {
        authorized: !!e.payload && e.validityUntil !== null,
        proofExpiresAt: e.validityUntil ?? 0,
      },
    ]),
  );
  return (
    <div className="space-y-4">
      <p>
        Account-Inbox · tatsächliche Belege; Review, Auftragsstatus und
        Ignorieren/Archivieren bleiben getrennt.
      </p>
      {rows === undefined ? (
        <p>Account-Inbox wird geladen …</p>
      ) : !rows.page.length ? (
        <p>Noch keine Account-Belege.</p>
      ) : (
        rows.page.map((e) =>
          e.payload && e.source && e.proofUntil > clock ? (
            <InboxItem
              key={e.evidenceId}
              e={e}
              workspaceId={workspaceId}
              accountId={accountId}
              profile={profile}
              disabled={disabled}
              onSelect={onSelect}
            />
          ) : (
            <p key={e.evidenceId}>
              Beleg {e.evidenceId}:{" "}
              {e.reason ?? "Quellen- oder Berechtigungsnachweis abgelaufen"};
              Inhalte und Aktionen ausgeblendet.
            </p>
          ),
        )
      )}
      <div className="flex gap-2">
        <Button
          variant="outline"
          disabled={!cursor}
          onClick={() => setCursor(null)}
        >
          Neueste Inbox-Belege
        </Button>
        <Button
          variant="outline"
          disabled={!rows || rows.isDone}
          onClick={() => setCursor(rows!.continueCursor)}
        >
          Ältere Inbox-Belege
        </Button>
      </div>
    </div>
  );
}
function InboxItem({
  e,
  workspaceId,
  accountId,
  profile,
  disabled,
  onSelect,
}: {
  e: InboxRow;
  workspaceId: Id<"workspaces">;
  accountId: Id<"socialAccounts">;
  profile: ProfileSelection;
  disabled: boolean;
  onSelect: (id: Id<"researchOrders">) => void;
}) {
  const navigate = useNavigate(),
    consume = useMutation(api.research.handoff.consume),
    dispose = useMutation(api.research.evidence.disposition),
    research = useMutation(api.research.pipeline.reResearch),
    create = useMutation(api.ai.conversations.create),
    attach = useMutation(api.ai.conversations.attachEvidence);
  const [intent, setIntent] = useState(""),
    [topic, setTopic] = useState(""),
    [target, setTarget] = useState<"idea" | "draft">("idea"),
    [count, setCount] = useState(1),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [results, setResults] = useState<
      FunctionReturnType<typeof api.research.handoff.consume>
    >([]),
    [researchId, setResearchId] = useState<Id<"researchOrders"> | null>(null),
    [retry, setRetry] = useState(false);
  const failed = useRef<(() => Promise<void>) | null>(null),
    alive = useRef(true),
    pending = useRef(false),
    writable = useRef(!disabled),
    permissionEpoch = useRef(0),
    actionEpoch = useRef(0);
  if (writable.current !== !disabled) permissionEpoch.current++;
  writable.current = !disabled;
  const canAcknowledge = () =>
    alive.current &&
    writable.current &&
    permissionEpoch.current === actionEpoch.current;
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      failed.current = null;
    };
  }, []);
  async function run(fn: () => Promise<void>) {
    if (pending.current || !writable.current) return;
    pending.current = true;
    actionEpoch.current = permissionEpoch.current;
    setBusy(true);
    setError("");
    try {
      await fn();
      if (alive.current) {
        failed.current = null;
        setRetry(false);
      }
    } catch (err) {
      if (canAcknowledge()) {
        failed.current = fn;
        setRetry(true);
        setError(
          `Nicht bestätigt: ${err instanceof Error ? err.message : String(err)}. Eingaben bleiben erhalten; aktuelle Quellen-, Modell-, Preis- und Budgetfreigaben erforderlich.`,
        );
      }
    } finally {
      pending.current = false;
      if (alive.current) setBusy(false);
    }
  }
  const p = e.payload!,
    source = e.source!;
  const date = (n: number | null | undefined) =>
    n == null ? "unbekannt" : new Date(n).toISOString();
  return (
    <article className="border-t pt-3 space-y-2">
      <h3 className="font-semibold">
        {p.model?.title ?? p.annotation.claim} · Review
      </h3>
      <p>
        Beleg {e.evidenceId} · Auftrag {e.orderId}: {e.runState}/
        {e.runOutcome ?? "kein Workflow"} · Inbox {e.inboxDisposition}
      </p>
      <a href={source.url ?? undefined} target="_blank" rel="noreferrer">
        {source.title}
      </a>
      <p>Aussage der Quelle / ungeprüft: {p.annotation.claim}</p>
      <p>
        Wörtlicher Beleg: {p.annotation.quote ?? "kein wörtlicher Textbeleg"}
      </p>
      <p>Interpretation: {p.annotation.interpretation}</p>
      <p>
        Account-Perspektive: {p.model?.perspective ?? p.perspective.audience}
      </p>
      <p>Unsicherheit: {p.annotation.uncertainty}</p>
      <p>Lücken: {p.annotation.gaps.join(" · ")}</p>
      <p>
        Publiziert: {date(source.publishedAt)} · Ereignis:{" "}
        {date(e.assessment?.eventAt ?? p.model?.eventAt)} · Beobachtet:{" "}
        {date(source.observedAt)}
      </p>
      <p>
        {e.automaticEligible &&
        e.validityUntil !== null &&
        e.validityUntil > Date.now()
          ? `Menschlich für Research-Kontext bewertet bis ${date(e.validityUntil)}; keine Veröffentlichungsfreigabe.`
          : "Aktuelle menschliche Support-/Gültigkeitsbewertung fehlt; nur ungeprüfte Review."}
      </p>
      {e.assessment && <p>Bewertung: {e.assessment.reason}</p>}
      {e.automaticHandoff && (
        <p>
          Automatische Übergabe: {e.automaticHandoff.state} ·{" "}
          {e.automaticHandoff.reason} · maximal{" "}
          {e.automaticHandoff.option.count} {e.automaticHandoff.option.target};
          tatsächlich {e.automaticHandoff.results?.length ?? 0}.
        </p>
      )}
      <fieldset disabled={disabled || busy || retry} className="space-y-2">
        <div className="flex gap-2">
          {(["ignored", "archived", "active"] as const).map((disposition) => (
            <Button
              key={disposition}
              variant="outline"
              onClick={() => {
                const commandKey = crypto.randomUUID(),
                  expectedRevision = e.inboxRevision;
                void run(async () => {
                  await dispose({
                    workspaceId,
                    evidenceId: e.evidenceId,
                    expectedRevision,
                    disposition,
                    commandKey,
                  });
                });
              }}
            >
              {disposition === "ignored"
                ? "Ignorieren"
                : disposition === "archived"
                  ? "Archivieren"
                  : "In Inbox zurücknehmen"}
            </Button>
          ))}
        </div>
        <label>
          Übergabeabsicht
          <Input value={intent} onChange={(x) => setIntent(x.target.value)} />
        </label>
        <label>
          Übergabeziel
          <select
            value={target}
            onChange={(x) => setTarget(x.target.value as "idea" | "draft")}
          >
            <option value="idea">Idea</option>
            <option value="draft">Draft</option>
          </select>
        </label>
        <label>
          Maximale Vorschläge
          <Input
            type="number"
            min={1}
            max={5}
            value={count}
            onChange={(x) => setCount(Number(x.target.value))}
          />
        </label>
        <p>
          Ein ausgewählter Beleg erzeugt höchstens einen eigenen Vorschlag;
          keine Auffüllung auf die gewünschte Obergrenze. Keine Freigabe,
          Planung oder Veröffentlichung.
        </p>
        <Button
          disabled={!intent.trim()}
          onClick={() => {
            const args = {
              workspaceId,
              accountId,
              evidenceIds: [e.evidenceId],
              target,
              intent,
              requestedCount: count,
              commandKey: crypto.randomUUID(),
            };
            void run(async () => {
              const r = await consume(args);
              if (canAcknowledge()) setResults(r);
            });
          }}
        >
          Idea/Draft ausdrücklich übergeben
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            const operationKey = crypto.randomUUID(),
              attachKey = crypto.randomUUID(),
              capturedIntent =
                intent.trim() ||
                "Beleg, Perspektive und Unsicherheit besprechen";
            let conversationId: Id<"conversations"> | null = null;
            void run(async () => {
              if (!conversationId)
                conversationId = await create({
                  workspaceId,
                  accountId,
                  operationKey,
                });
              const receipt = await attach({
                workspaceId,
                accountId,
                conversationId,
                evidenceId: e.evidenceId,
                intent: capturedIntent,
                operationKey: attachKey,
              });
              if (canAcknowledge())
                navigate(`/agent?conversation=${receipt.conversationId}`);
            });
          }}
        >
          Agent zu diesem Beleg fragen
        </Button>
        <label>
          Neues Recherchethema
          <Input value={topic} onChange={(x) => setTopic(x.target.value)} />
        </label>
        <Button
          variant="outline"
          disabled={!profile || !topic.trim()}
          onClick={() => {
            if (!profile) return;
            const args = {
              workspaceId,
              profileId: profile.profileId,
              expectedRevision: profile.revision,
              evidenceId: e.evidenceId,
              topic,
              language: profile.config.languages[0],
              operations: ["web-search" as const],
              operationKey: crypto.randomUUID(),
            };
            void run(async () => {
              const id = await research(args);
              if (canAcknowledge()) {
                setResearchId(id);
                onSelect(id);
              }
            });
          }}
        >
          Aus diesem Beleg neu recherchieren
        </Button>
        {!profile && (
          <p>
            Für neue Recherche ein aktuelles aktives Profil mit endlichem Limit
            auf dieser Seite speichern.
          </p>
        )}
      </fieldset>
      {error && <p role="alert">{error}</p>}
      {retry && (
        <Button
          disabled={disabled || busy}
          onClick={() => failed.current && void run(failed.current)}
        >
          Inbox-Anfrage erneut bestätigen
        </Button>
      )}
      {researchId && (
        <p role="status">Neuer tatsächlicher Rechercheauftrag {researchId}</p>
      )}
      {[...results, ...(e.automaticHandoff?.results ?? [])].map((r) => (
        <div key={r.ideaId}>
          <Link to={`/ideas?idea=${r.ideaId}`}>Idea {r.ideaId}</Link>
          {r.draftId && (
            <Link to={`/drafts/${r.draftId}`}> · Draft {r.draftId}</Link>
          )}
        </div>
      ))}
    </article>
  );
}
