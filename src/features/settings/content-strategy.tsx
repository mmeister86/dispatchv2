import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionArgs } from "convex/server";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { useStore } from "@/lib/store";
import { Section } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
type Payload = NonNullable<Doc<"styleProfileVersions">["payload"]>;
type Action = FunctionArgs<typeof api.ai.styleProfiles.change>["action"];
const empty = (): Payload => ({
  author: "",
  experiences: [],
  tone: "",
  positioning: "",
  pillars: [{ name: "", weight: 100 }],
  examples: [],
  forbidden: [],
});
export function ContentStrategy() {
  const { state } = useStore();
  const account = state.accounts.find(
    (a) =>
      a.id === state.activeAccountId &&
      a.workspaceId === state.activeWorkspaceId,
  );
  if (!account)
    return (
      <Section title="Account-Stilprofil">
        <p>Account für Stilprofil auswählen.</p>
      </Section>
    );
  return (
    <StrategyAccount
      key={`${state.activeWorkspaceId}:${account.id}`}
      workspaceId={state.activeWorkspaceId as Id<"workspaces">}
      accountId={account.id as Id<"socialAccounts">}
    />
  );
}
function StrategyAccount({
  workspaceId,
  accountId,
}: {
  workspaceId: Id<"workspaces">;
  accountId: Id<"socialAccounts">;
}) {
  const { state } = useStore(),
    args = { workspaceId, accountId };
  const row = useQuery(api.ai.styleProfiles.get, args),
    feedback = useQuery(api.content.feedback.list, args);
  const change = useMutation(api.ai.styleProfiles.change);
  const [cursor, setCursor] = useState<string | null>(null),
    [proposalId, setProposal] = useState<Id<"learningProposals"> | null>(null);
  const history = useQuery(api.ai.styleProfiles.history, {
    ...args,
    paginationOpts: { numItems: 10, cursor },
  });
  const inspection = useQuery(
    api.ai.styleProfiles.inspect,
    proposalId ? { ...args, proposalId } : "skip",
  );
  const [input, setInput] = useState<Payload>(empty),
    [baseId, setBase] = useState<Id<"styleProfileVersions"> | null>(null),
    [attest, setAttest] = useState(false),
    [ownExamples, setOwnExamples] = useState(false),
    [reason, setReason] = useState(""),
    [feedbackId, setFeedback] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [failed, setFailed] = useState<(() => Promise<unknown>) | null>(null),
    [revision, setRevision] = useState<number | null>(null),
    [now, setNow] = useState(Date.now());
  const mounted = useRef(false),
    pending = useRef(false),
    context = useRef({ role: state.role, epoch: 0 });
  if (context.current.role !== state.role)
    context.current = { role: state.role, epoch: context.current.epoch + 1 };
  useEffect(() => {
    mounted.current = true;
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => {
      mounted.current = false;
      clearInterval(timer);
    };
  }, []);
  const admin = state.role === "Owner" || state.role === "Admin",
    writable = admin && !busy && !failed && !!row;
  async function run(execute: () => Promise<unknown>, retry = false) {
    if (pending.current || !admin) return;
    const epoch = context.current.epoch;
    pending.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await execute();
      if (mounted.current && context.current.epoch === epoch) {
        setFailed(null);
        setMessage(
          retry
            ? "Ursprüngliche Anfrage bestätigt. Aktuelle Auswahl prüfen."
            : "Anfrage bestätigt. Auswahl bleibt ein eigener Schritt.",
        );
        setCursor(null);
        setRevision(null);
      }
    } catch (e) {
      if (mounted.current && context.current.epoch === epoch) {
        setFailed(() => execute);
        setError(
          String(e).includes("REVISION_CONFLICT")
            ? "Revision geändert. Eingaben bleiben erhalten; aktuelle Revision ausdrücklich übernehmen."
            : "Anfrage nicht bestätigt. Eingaben bleiben erhalten; ursprüngliche Anfrage wiederholen oder aktuelle Revision übernehmen.",
        );
      }
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  function command(action: Action) {
    if (!writable || !reason.trim() || !row) return;
    const commandArgs = {
      ...args,
      expectedRevision: revision ?? row.control?.revision ?? 0,
      commandKey: crypto.randomUUID(),
      action,
    };
    void run(() => change(commandArgs));
  }
  function load(v: Doc<"styleProfileVersions">) {
    if (!writable || !v.payload || v.sourceUnavailable) return;
    setInput(structuredClone(v.payload));
    setBase(v._id);
    setAttest(false);
    setOwnExamples(false);
    setMessage(
      "Explizite Kopie geladen. Quellenabhängigkeiten bleiben erhalten; Autor und Erfahrungen bleiben unverändert.",
    );
  }
  if (!row)
    return (
      <Section title="Account-Stilprofil">
        <p>Stilprofil wird geladen …</p>
      </Section>
    );
  const stale = (until: number | null) => until !== null && until <= now;
  return (
    <div className="stack min-w-0 break-words">
      <Section
        title="Deklariertes Account-Stilprofil"
        description="Gemeinsame Account-Angaben. Persönliche Präferenzen bleiben getrennt; keine automatische Auswahl oder Modellverarbeitung."
      >
        <p className="break-all">
          Revision {row.control?.revision ?? 0} · Auswahl:{" "}
          {row.control?.selectedVersionId ?? "keine"} ·{" "}
          {row.usable
            ? "aktuell nutzbar"
            : "nicht nutzbar oder nicht ausgewählt"}
        </p>
        {!admin && <p>Owner/Admin-Rechte für Stiländerungen erforderlich.</p>}
        {error && <p role="alert">{error}</p>}
        {message && <p role="status">{message}</p>}
        {failed && admin && (
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => void run(failed, true)}>
              Ursprüngliche Anfrage wiederholen
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                setFailed(null);
                setError("");
                setRevision(row.control?.revision ?? 0);
                setMessage(
                  "Aktuelle Revision übernommen. Eingaben prüfen und neue Anfrage ausdrücklich auslösen.",
                );
              }}
            >
              Aktuelle Revision übernehmen
            </Button>
          </div>
        )}
        <fieldset disabled={!writable} className="stack min-w-0">
          <label>
            Entscheidungsgrund
            <Input
              value={reason}
              maxLength={1000}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <p>
            {baseId
              ? "Bearbeitete Kopie mit ursprünglicher Quellenbindung."
              : "Neue vollständige menschliche Eingabe; noch keine Autor-Angabe gespeichert."}
          </p>
          <label>
            Deklarierter Autor (unverifizierte Anzeige)
            <Input
              value={input.author}
              maxLength={100}
              disabled={!!baseId}
              onChange={(e) => setInput({ ...input, author: e.target.value })}
            />
          </label>
          <p className="text-sm muted">
            Erfahrungen sind eigene Behauptungen. Ton und Textbeispiele belegen
            keine Biografie.
          </p>
          <fieldset disabled={!!baseId} className="stack">
            <legend>Erfahrungsbehauptungen</legend>
            {input.experiences.map((s, i) => (
              <label key={i}>
                Eigene Erfahrungsbehauptung {i + 1}
                <Textarea
                  maxLength={500}
                  value={s}
                  onChange={(e) =>
                    setInput({
                      ...input,
                      experiences: input.experiences.map((x, n) =>
                        n === i ? e.target.value : x,
                      ),
                    })
                  }
                />
                <Button
                  variant="ghost"
                  onClick={() =>
                    setInput({
                      ...input,
                      experiences: input.experiences.filter((_, n) => n !== i),
                    })
                  }
                >
                  Behauptung {i + 1} entfernen
                </Button>
              </label>
            ))}
            <Button
              variant="outline"
              disabled={input.experiences.length >= 10}
              onClick={() =>
                setInput({ ...input, experiences: [...input.experiences, ""] })
              }
            >
              Erfahrungsbehauptung hinzufügen
            </Button>
          </fieldset>
          <label>
            Gewünschter Ton
            <Textarea
              value={input.tone}
              maxLength={1000}
              onChange={(e) => setInput({ ...input, tone: e.target.value })}
            />
          </label>
          <label>
            Positionierung
            <Textarea
              value={input.positioning}
              maxLength={2000}
              onChange={(e) =>
                setInput({ ...input, positioning: e.target.value })
              }
            />
          </label>
          <p>
            Säulen-Gewichte: {input.pillars.reduce((n, p) => n + p.weight, 0)} /
            100 %
          </p>
          {input.pillars.map((p, i) => (
            <div key={i} className="flex flex-wrap items-end gap-2">
              <label className="flex-1 min-w-0">
                Säule {i + 1}
                <Input
                  maxLength={100}
                  value={p.name}
                  onChange={(e) =>
                    setInput({
                      ...input,
                      pillars: input.pillars.map((x, n) =>
                        n === i ? { ...x, name: e.target.value } : x,
                      ),
                    })
                  }
                />
              </label>
              <label>
                Gewicht {i + 1}
                <Input
                  className="w-20"
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={p.weight}
                  onChange={(e) =>
                    setInput({
                      ...input,
                      pillars: input.pillars.map((x, n) =>
                        n === i ? { ...x, weight: Number(e.target.value) } : x,
                      ),
                    })
                  }
                />
              </label>
              <Button
                variant="outline"
                disabled={input.pillars.length === 1}
                onClick={() =>
                  setInput({
                    ...input,
                    pillars: input.pillars.filter((_, n) => n !== i),
                  })
                }
              >
                Säule {i + 1} entfernen
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            disabled={input.pillars.length >= 12}
            onClick={() =>
              setInput({
                ...input,
                pillars: [...input.pillars, { name: "", weight: 0 }],
              })
            }
          >
            Säule hinzufügen
          </Button>
          {input.examples.map((s, i) => (
            <label key={i}>
              Textbeispiel {i + 1} (keine Erfahrung)
              <Textarea
                value={s}
                maxLength={4000}
                onChange={(e) =>
                  setInput({
                    ...input,
                    examples: input.examples.map((x, n) =>
                      n === i ? e.target.value : x,
                    ),
                  })
                }
              />
              <Button
                variant="ghost"
                onClick={() =>
                  setInput({
                    ...input,
                    examples: input.examples.filter((_, n) => n !== i),
                  })
                }
              >
                Beispiel {i + 1} entfernen
              </Button>
            </label>
          ))}
          <Button
            variant="outline"
            disabled={input.examples.length >= 5}
            onClick={() =>
              setInput({ ...input, examples: [...input.examples, ""] })
            }
          >
            Textbeispiel hinzufügen
          </Button>
          <label>
            Verbotene Formulierungen (eine je Zeile)
            <Textarea
              value={input.forbidden.join("\n")}
              onChange={(e) =>
                setInput({
                  ...input,
                  forbidden: e.target.value ? e.target.value.split("\n") : [],
                })
              }
            />
          </label>
          {!baseId && (
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={attest}
                onChange={(e) => setAttest(e.target.checked)}
              />
              Ich erkläre diese Angaben als eigene autorisierte Eingabe für
              diesen Account.
            </label>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={!reason.trim() || (!baseId && !attest)}
              onClick={() =>
                command({
                  kind: "save",
                  payload: input,
                  freshDeclaration: !baseId,
                  baseVersionId: baseId,
                  reason,
                })
              }
            >
              Neue Version speichern
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setInput(empty());
                setBase(null);
                setAttest(false);
                setOwnExamples(false);
                setMessage(
                  "Kopierte Eingaben gelöscht. Neue eigene Angaben ausdrücklich erklären.",
                );
              }}
            >
              Eingaben löschen und neu erklären
            </Button>
            <Button
              variant="outline"
              disabled={!reason.trim()}
              onClick={() => command({ kind: "reset", reason })}
            >
              Auswahl zurücksetzen
            </Button>
          </div>
        </fieldset>
      </Section>
      <Section
        title="Gespeicherte Versionen"
        description="Neueste 25 Versionen und aktuelle Auswahl; ältere Entscheidungen bleiben in der Historie."
      >
        {row.versions.length === 0 && (
          <p>Noch keine Stilversion gespeichert.</p>
        )}
        {row.versions.map((v) => (
          <SavedVersion
            key={v._id}
            versionId={v._id}
            args={args}
            selectedVersionId={row.control?.selectedVersionId ?? null}
            writable={writable}
            reason={reason}
            now={now}
            command={command}
            load={load}
          />
        ))}
      </Section>
      <Section
        title="Menschliche Korrektur"
        description="Exaktes redaktionelles Ereignis und ausdrücklich eingegebene Stiländerung. Kein Lernen von Identität oder Erfahrungen."
      >
        <fieldset disabled={!writable} className="stack">
          <label>
            Feedback-Ereignis
            <select
              className="native-select"
              value={feedbackId}
              onChange={(e) => setFeedback(e.target.value)}
            >
              <option value="">Ereignis ausdrücklich wählen</option>
              {feedback
                ?.filter((f) => !f.sourceUnavailable && !stale(f.sourceUntil))
                .map((f) => (
                  <option key={f._id} value={f._id}>
                    {f.kind} · {f._id}
                  </option>
                ))}
            </select>
          </label>
          <p>
            Die eingegebenen Ton-, Positionierungs-, Säulen-, Beispiel- und
            Vermeidungswünsche oben bilden den Vorschlag. Die aktive Version
            liefert Autor und Erfahrungen. Wiederholte Ereignisse sind keine
            unabhängigen Beobachtungen.
          </p>
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={ownExamples}
              onChange={(e) => setOwnExamples(e.target.checked)}
            />
            Ich autorisiere diese Textbeispiele ausdrücklich als eigene
            Account-Beispiele.
          </label>
          <Button
            className="h-auto whitespace-normal"
            disabled={
              !reason.trim() ||
              !feedbackId ||
              !row.usable ||
              !row.control?.selectedVersionId ||
              (input.examples.length > 0 && !ownExamples)
            }
            onClick={() => {
              const { author, experiences, ...preferences } = input;
              command({
                kind: "propose",
                baseVersionId: row.control!.selectedVersionId!,
                feedbackId: feedbackId as Id<"contentFeedback">,
                preferences,
                ownExamples,
                reason,
              });
            }}
          >
            Korrekturvorschlag speichern
          </Button>
        </fieldset>
        <label>
          Gespeicherter Korrekturvorschlag
          <select
            className="native-select"
            value={proposalId ?? ""}
            onChange={(e) =>
              setProposal(
                e.target.value
                  ? (e.target.value as Id<"learningProposals">)
                  : null,
              )
            }
          >
            <option value="">Vorschlag ausdrücklich wählen</option>
            {row.proposals.map((p) => (
              <option key={p._id} value={p._id}>
                {p.state} · {p._id}
              </option>
            ))}
          </select>
        </label>
        {inspection && (
          <div className="stack min-w-0">
            <p className="break-all">
              Ereignis {inspection.proposal.feedbackId} · vorher{" "}
              {inspection.proposal.beforeVersionId} · Ergebnis{" "}
              {inspection.proposal.resultingVersionId ?? "keines"}
            </p>
            {!inspection.proposal.sourceUnavailable &&
            !stale(inspection.proposal.sourceUntil) ? (
              <>
                <p>Grund: {inspection.proposal.reason}</p>
                <p>
                  Entscheidung: {inspection.proposal.state} ·{" "}
                  {inspection.proposal.decisionReason}
                </p>
                <p className="break-words">
                  Vorheriger Ton: {inspection.base.payload?.tone || "leer"}
                </p>
                <p className="break-words">
                  Vorgeschlagener Ton:{" "}
                  {inspection.proposal.preferences?.tone || "leer"}
                </p>
                <p className="break-words">
                  Vorherige Positionierung:{" "}
                  {inspection.base.payload?.positioning || "leer"}
                </p>
                <p className="break-words">
                  Vorgeschlagene Positionierung:{" "}
                  {inspection.proposal.preferences?.positioning || "leer"}
                </p>
                <p className="break-words">
                  Vorherige Säulen (Gewichte):{" "}
                  {inspection.base.payload?.pillars
                    .map((p) => `${p.name} (${p.weight} %)`)
                    .join("; ") || "keine"}
                </p>
                <p className="break-words">
                  Vorgeschlagene Säulen (Gewichte):{" "}
                  {inspection.proposal.preferences?.pillars
                    .map((p) => `${p.name} (${p.weight} %)`)
                    .join("; ") || "keine"}
                </p>
                <p className="break-words">
                  Vorherige Textbeispiele (keine Erfahrungsbehauptungen):{" "}
                  {inspection.base.payload?.examples.join("; ") || "keine"}
                </p>
                <p className="break-words">
                  Vorgeschlagene Textbeispiele (keine Erfahrungsbehauptungen):{" "}
                  {inspection.proposal.preferences?.examples.join("; ") ||
                    "keine"}
                </p>
                <p className="break-words">
                  Vorherige verbotene Formulierungen:{" "}
                  {inspection.base.payload?.forbidden.join("; ") || "keine"}
                </p>
                <p className="break-words">
                  Vorgeschlagene verbotene Formulierungen:{" "}
                  {inspection.proposal.preferences?.forbidden.join("; ") ||
                    "keine"}
                </p>
                <details>
                  <summary>
                    Exakte vorherige und resultierende Textversion (Ausschnitt
                    bis 4000 Zeichen)
                  </summary>
                  <pre className="whitespace-pre-wrap break-words">
                    {inspection.before}
                  </pre>
                  <pre className="whitespace-pre-wrap break-words">
                    {inspection.after ?? "Kein Edit-Ergebnis"}
                  </pre>
                </details>
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={
                      !writable ||
                      !reason.trim() ||
                      inspection.proposal.state !== "pending"
                    }
                    onClick={() =>
                      command({
                        kind: "accept",
                        proposalId: inspection.proposal._id,
                        reason,
                      })
                    }
                  >
                    Annehmen und neue Version erzeugen
                  </Button>
                  <Button
                    variant="outline"
                    disabled={
                      !writable ||
                      !reason.trim() ||
                      inspection.proposal.state !== "pending"
                    }
                    onClick={() =>
                      command({
                        kind: "reject",
                        proposalId: inspection.proposal._id,
                        reason,
                      })
                    }
                  >
                    Vorschlag ablehnen
                  </Button>
                </div>
              </>
            ) : (
              <p>
                Korrekturquelle nicht verfügbar. Kein Wiederherstellen
                geschützter Inhalte.
              </p>
            )}
          </div>
        )}
      </Section>
      <Section title="Stil-Entscheidungshistorie">
        {history?.page.map((h) => (
          <SavedReceipt
            key={h._id}
            receiptId={h._id}
            args={args}
            writable={writable}
            reason={reason}
            command={command}
          />
        ))}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={!cursor}
            onClick={() => setCursor(null)}
          >
            Neueste Entscheidungen
          </Button>
          <Button
            variant="outline"
            disabled={!history || history.isDone}
            onClick={() => setCursor(history!.continueCursor)}
          >
            Ältere Entscheidungen
          </Button>
        </div>
      </Section>
    </div>
  );
}

type Scope = { workspaceId: Id<"workspaces">; accountId: Id<"socialAccounts"> };
function SavedVersion({
  versionId,
  args,
  selectedVersionId,
  writable,
  reason,
  now,
  command,
  load,
}: {
  versionId: Id<"styleProfileVersions">;
  args: Scope;
  selectedVersionId: Id<"styleProfileVersions"> | null;
  writable: boolean;
  reason: string;
  now: number;
  command: (action: Action) => void;
  load: (v: Doc<"styleProfileVersions">) => void;
}) {
  const v = useQuery(api.ai.styleProfiles.version, { ...args, versionId });
  if (!v) return <p>Stilversion wird geladen …</p>;
  const stale = (until: number | null) => until !== null && until <= now;
  return (
    <div className="stack border-b py-3 min-w-0">
      <p className="break-all">
        {v._id} · {v.status} {selectedVersionId === v._id ? "· ausgewählt" : ""}
      </p>
      <p className="break-all">
        Deklariert durch {v.declaredBy} am{" "}
        {new Date(v.declaredAt).toISOString()}; erstellt durch {v.createdBy}.
      </p>
      {v.payload && !stale(v.sourceUntil) ? (
        <>
          <p>
            Autor-Angabe: {v.payload.author || "leer"} · Erfahrungsbehauptungen:{" "}
            {v.payload.experiences.join("; ") || "keine"}
          </p>
          <p>Gewünschter Ton: {v.payload.tone || "leer"}</p>
          <p>Positionierung: {v.payload.positioning || "leer"}</p>
          <p className="break-words">
            Säulen (Gewichte):{" "}
            {v.payload.pillars
              .map((p) => `${p.name} (${p.weight} %)`)
              .join("; ") || "keine"}
          </p>
          <p className="break-words">
            Verbotene Formulierungen:{" "}
            {v.payload.forbidden.join("; ") || "keine"}
          </p>
          <p>
            Textbeispiele (keine Erfahrungsbehauptungen):{" "}
            {v.payload.examples.join("; ") || "keine"}
          </p>
          <p>Grund: {v.reason}</p>
        </>
      ) : (
        <p>Geschützter Profilinhalt nicht verfügbar.</p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={
            !writable ||
            !v.payload ||
            v.sourceUnavailable ||
            stale(v.sourceUntil) ||
            v.status !== "active" ||
            !reason.trim()
          }
          onClick={() => command({ kind: "select", versionId: v._id, reason })}
        >
          Diese Version auswählen
        </Button>
        <Button
          variant="outline"
          disabled={
            !writable ||
            !v.payload ||
            v.sourceUnavailable ||
            stale(v.sourceUntil) ||
            v.status !== "active"
          }
          onClick={() => load(v)}
        >
          Kopie in Eingaben übernehmen
        </Button>
        <Button
          variant="outline"
          disabled={!writable || v.status !== "active" || !reason.trim()}
          onClick={() => command({ kind: "retire", versionId: v._id, reason })}
        >
          Version stilllegen
        </Button>
      </div>
    </div>
  );
}
function SavedReceipt({
  receiptId,
  args,
  writable,
  reason,
  command,
}: {
  receiptId: Id<"styleProfileCommands">;
  args: Scope;
  writable: boolean;
  reason: string;
  command: (action: Action) => void;
}) {
  const h = useQuery(api.ai.styleProfiles.receipt, { ...args, receiptId });
  if (!h) return <p>Entscheidung wird geladen …</p>;
  return (
    <div className="border-b py-2 min-w-0">
      <p>
        Revision {h.revision} · {h.action} ·{" "}
        {h.reason || "Grund nicht verfügbar"}
      </p>
      <p className="break-all">
        {h.versionId ?? h.proposalId ?? "Keine Auswahl"}
      </p>
      {["select", "rollback"].includes(h.action) && h.versionId && (
        <Button
          variant="outline"
          disabled={!writable || !reason.trim() || h.sourceUnavailable}
          onClick={() =>
            command({ kind: "rollback", receiptId: h._id, reason })
          }
        >
          Auf diese Auswahl zurückrollen
        </Button>
      )}
    </div>
  );
}
