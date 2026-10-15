import { useEffect, useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import type { FunctionArgs } from "convex/server";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Section } from "@/components/shared";
type Action = FunctionArgs<typeof api.intelligence.profiles.change>["action"];
type Attempt = {
  execute: () => Promise<unknown>;
  success: (result: unknown) => void;
};
export function IntelligenceProfiles({
  readOnly = false,
  audienceOnly = false,
  accountId,
}: {
  readOnly?: boolean;
  audienceOnly?: boolean;
  accountId?: string | null;
}) {
  const { state } = useStore();
  const id = accountId === undefined ? state.activeAccountId : accountId;
  const account = state.accounts.find((a) => a.id === id);
  if (!id)
    return (
      <Section title="Intelligence-Profile">
        <p>
          Account auswählen. Analyse, Audience Fit und Embeddings sind nicht
          verfügbar.
        </p>
      </Section>
    );
  if (account?.channel !== "X")
    return (
      <Section title="Intelligence-Profile">
        <p>Für dieses Netzwerk ist noch kein Profilvertrag verfügbar.</p>
      </Section>
    );
  return (
    <ProfileAccount
      key={`${state.activeWorkspaceId}:${id}`}
      workspaceId={state.activeWorkspaceId as Id<"workspaces">}
      accountId={id as Id<"socialAccounts">}
      readOnly={readOnly}
      audienceOnly={audienceOnly}
    />
  );
}
function ProfileAccount({
  workspaceId,
  accountId,
  readOnly,
  audienceOnly,
}: {
  workspaceId: Id<"workspaces">;
  accountId: Id<"socialAccounts">;
  readOnly: boolean;
  audienceOnly: boolean;
}) {
  const { state } = useStore();
  const args = { workspaceId, accountId };
  const row = useQuery(api.intelligence.profiles.get, args);
  const [cursor, setCursor] = useState<string | null>(null);
  const history = useQuery(
    api.intelligence.profiles.history,
    readOnly ? "skip" : { ...args, paginationOpts: { numItems: 10, cursor } },
  );
  const createAlgorithm = useMutation(
      api.intelligence.algorithmProfiles.create,
    ),
    createAudience = useMutation(api.intelligence.audienceProfiles.create),
    change = useMutation(api.intelligence.profiles.change);
  const [description, setDescription] = useState(""),
    [reason, setReason] = useState(""),
    [algorithm, setAlgorithm] = useState(""),
    [variant, setVariant] = useState<"public-context" | "post-analysis">(
      "public-context",
    ),
    [audience, setAudience] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [failed, setFailed] = useState<Attempt | null>(null),
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
  const admin = state.role === "Owner" || state.role === "Admin";
  const writable = admin && !readOnly && !busy && !failed && !!row;
  async function run(attempt: Attempt, retry = false) {
    if (pending.current || !admin || readOnly) return;
    const epoch = context.current.epoch;
    pending.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await attempt.execute();
      if (mounted.current && context.current.epoch === epoch) {
        setFailed(null);
        attempt.success(result);
        setMessage(
          retry
            ? "Ursprüngliche Anfrage bestätigt. Aktuelle Auswahl prüfen."
            : "Aktion bestätigt.",
        );
      }
    } catch (e) {
      if (mounted.current && context.current.epoch === epoch) {
        setFailed(attempt);
        const value = e instanceof Error ? e.message : String(e);
        setError(
          value.includes("REVISION_CONFLICT")
            ? "Die Revision hat sich geändert. Eingaben bleiben erhalten. Aktuelle Revision ausdrücklich übernehmen."
            : value.includes("REVIEW")
              ? "Aktuelle Prüfung, Quellenfrische und Owner/Admin-Berechtigung erforderlich. Eingaben bleiben erhalten."
              : "Aktion nicht bestätigt. Eingaben bleiben erhalten; ursprüngliche Anfrage wiederholen oder neue Anfrage beginnen.",
        );
      }
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  function command(action: Action) {
    if (!row || !writable || !reason.trim()) return;
    const input = {
      ...args,
      expectedRevision: row.capture.revision,
      commandKey: crypto.randomUUID(),
      action,
    };
    void run({ execute: () => change(input), success: () => setCursor(null) });
  }
  if (!row)
    return (
      <Section title="Intelligence-Profile">
        <p>Intelligence-Profile werden geladen …</p>
      </Section>
    );
  const selected = row.algorithms.find(
    (p) => p._id === row.capture.algorithmId,
  );
  const expired = !!selected && selected.payload.reviewDueAt <= now;
  return (
    <div className="stack break-words min-w-0">
      <Section
        title={
          audienceOnly
            ? "Versionierte Account-Zielgruppe"
            : "Intelligence-Profile"
        }
        description="X · For You · explizite Account-Auswahl. Keine automatische Aktivierung."
      >
        <p>
          Revision {row.capture.revision} · Algorithmus:{" "}
          {row.capture.algorithmId ?? "nicht ausgewählt"} · Zielgruppe:{" "}
          {row.capture.audienceId ?? "nicht ausgewählt"}
        </p>
        <p role="status">
          {expired
            ? "Quellenprüfung fällig. Profilkontext nicht aktuell nutzbar."
            : row.capture.usable
              ? "Profilkontext geprüft. Gespeicherte Post-Analyse benötigt getrennte Providerfreigabe."
              : "Profilkontext unvollständig oder erneute Prüfung erforderlich."}
        </p>
        <p className="text-sm text-muted-foreground">
          Fehlend: {row.capture.missing.join(", ")}. Kein Gesamtscore; Audience
          Fit und Embeddings nicht verfügbar. Historie 0,5 ist eine
          Cold-Start-Annahme, keine Messung.{" "}
          {selected?.payload.version === "x-post-analysis-v1"
            ? "Post-Analyse-Rubrik v1 ausgewählt; Ausführung benötigt getrennte Providerfreigabe."
            : "Ausgewählter Kontext enthält keine ausführbaren Analysefragen."}{" "}
          Routing und Verifikation ausgeschaltet.
        </p>
        {selected && (
          <p className="text-sm">
            {selected.payload.version} · öffentliche Codequelle ·
            Produktionsstand unbekannt · kein Einfluss auf Score. Quellenprüfung
            bis{" "}
            {new Date(selected.payload.reviewDueAt).toISOString().slice(0, 10)}{" "}
            als betriebliche Annahme.
          </p>
        )}
        {!readOnly && (
          <>
            {!admin && (
              <p>Owner/Admin-Rechte für Profiländerungen erforderlich.</p>
            )}
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
                    setMessage(
                      "Aktuelle Revision übernommen. Eingaben prüfen und neue Anfrage ausdrücklich auslösen.",
                    );
                  }}
                >
                  Aktuelle Revision übernehmen
                </Button>
              </div>
            )}
            {!audienceOnly && (
              <SourceUpdates
                workspaceId={workspaceId}
                accountId={accountId}
                profiles={row.algorithms}
                revision={row.capture.revision}
                writable={writable}
                admin={admin}
                now={now}
                run={run}
              />
            )}
            <fieldset disabled={!writable} className="stack">
              <label>
                Entscheidungsgrund
                <Input
                  value={reason}
                  maxLength={1000}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              {!audienceOnly && (
                <>
                  <label>
                    Profil-Kandidat
                    <select
                      value={variant}
                      onChange={(e) =>
                        setVariant(
                          e.target.value as "public-context" | "post-analysis",
                        )
                      }
                      className="w-full rounded border p-2"
                    >
                      <option value="public-context">
                        Öffentlicher Snapshot (ohne Analysefragen)
                      </option>
                      <option value="post-analysis">
                        Post-Analyse v1 (Dispatch-Rubrik)
                      </option>
                    </select>
                  </label>
                  <Button
                    onClick={() => {
                      const input = {
                        ...args,
                        expectedRevision: row.capture.revision,
                        commandKey: crypto.randomUUID(),
                        variant,
                      };
                      void run({
                        execute: () => createAlgorithm(input),
                        success: () => setCursor(null),
                      });
                    }}
                  >
                    {variant === "post-analysis"
                      ? "Post-Analyse als Kandidat anlegen"
                      : "Öffentlichen Snapshot als Kandidat anlegen"}
                  </Button>
                </>
              )}
              <label>
                Deklarierte Account-Zielgruppe
                <Textarea
                  value={description}
                  maxLength={4000}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </label>
              <p className="text-sm text-muted-foreground">
                Die persönliche Zielgruppen-Präferenz wird nicht automatisch als
                Account-Profil oder Messwert übernommen.
              </p>
              <Button
                disabled={!description.trim()}
                onClick={() => {
                  const input = {
                    ...args,
                    expectedRevision: row.capture.revision,
                    commandKey: crypto.randomUUID(),
                    description,
                  };
                  void run({
                    execute: () => createAudience(input),
                    success: () => {
                      setDescription("");
                      setCursor(null);
                    },
                  });
                }}
              >
                Neue Zielgruppen-Version speichern
              </Button>
              {!audienceOnly &&
                row.algorithms.map((p) => (
                  <div className="border-b py-3 space-y-2" key={p._id}>
                    <p>
                      {p.payload.version} · {p._id} · {p.status}
                      {row.capture.algorithmId === p._id ? " · ausgewählt" : ""}
                    </p>
                    {p.update && (
                      <p className="text-sm">
                        Update aus {p.update.proposalId}; Evaluation{" "}
                        {p.update.evaluationId}. Quellenprüfung benötigt einen
                        anderen aktuellen Owner/Admin als den Evaluator.
                      </p>
                    )}
                    <p>
                      Prüfung:{" "}
                      {p.review
                        ? `${new Date(p.review.at).toISOString()} · ${p.review.reason}`
                        : "ausstehend"}
                    </p>
                    <details>
                      <summary>Unveränderliche Quellenbelege</summary>
                      <ul>
                        {p.payload.evidence.map((e) => (
                          <li key={e.path}>
                            <a href={e.url} target="_blank" rel="noreferrer">
                              {e.path}
                            </a>{" "}
                            · SHA-256 {e.sha256}
                          </li>
                        ))}
                      </ul>
                    </details>
                    <Button
                      disabled={!reason.trim() || p.status === "retired"}
                      onClick={() =>
                        command({
                          kind: "review-algorithm",
                          algorithmId: p._id,
                          reason,
                        })
                      }
                    >
                      Quellenprofil prüfen
                    </Button>{" "}
                    <Button
                      variant="outline"
                      disabled={!reason.trim() || p.status === "retired"}
                      onClick={() =>
                        command({
                          kind: "retire-algorithm",
                          algorithmId: p._id,
                          reason,
                        })
                      }
                    >
                      {p.update
                        ? "Update-Draft mit Entscheidungsgrund verwerfen"
                        : "Quellenprofil stilllegen"}
                    </Button>
                  </div>
                ))}
              {row.audiences.map((p) => (
                <div className="border-b py-3 space-y-2" key={p._id}>
                  <p>
                    {p.payload.version} · {p._id} · {p.status}
                    {row.capture.audienceId === p._id ? " · ausgewählt" : ""}
                  </p>
                  <p>{p.payload.description}</p>
                  <p>
                    Prüfung: {p.review ? p.review.reason : "ausstehend"}.
                    Deklarierter Kontext; keine gemessene Passung.
                  </p>
                  <Button
                    disabled={!reason.trim() || p.status === "retired"}
                    onClick={() =>
                      command({
                        kind: "review-audience",
                        audienceId: p._id,
                        reason,
                      })
                    }
                  >
                    Zielgruppenprofil prüfen
                  </Button>{" "}
                  <Button
                    variant="outline"
                    disabled={!reason.trim() || p.status === "retired"}
                    onClick={() =>
                      command({
                        kind: "retire-audience",
                        audienceId: p._id,
                        reason,
                      })
                    }
                  >
                    Zielgruppenprofil stilllegen
                  </Button>
                </div>
              ))}
              <p>
                Neueste 50 Versionen; ältere Auswahl bleibt über unveränderliche
                IDs und Entscheidungshistorie erhalten.
              </p>
              <label>
                Algorithmus-Version
                <select
                  value={algorithm}
                  onChange={(e) => setAlgorithm(e.target.value)}
                  className="w-full rounded border p-2"
                >
                  <option value="">Keine</option>
                  {row.algorithms
                    .filter((p) => p.status !== "retired")
                    .map((p) => (
                      <option value={p._id} key={p._id}>
                        {p.payload.version} · {p._id}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Zielgruppen-Version
                <select
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  className="w-full rounded border p-2"
                >
                  <option value="">Keine</option>
                  {row.audiences
                    .filter((p) => p.status !== "retired")
                    .map((p) => (
                      <option value={p._id} key={p._id}>
                        {p.payload.description} · {p._id}
                      </option>
                    ))}
                </select>
              </label>
              <Button
                disabled={!reason.trim()}
                onClick={() =>
                  command({
                    kind: "select",
                    algorithmId: algorithm
                      ? (algorithm as Id<"algorithmProfiles">)
                      : null,
                    audienceId: audience
                      ? (audience as Id<"audienceProfiles">)
                      : null,
                    reason,
                  })
                }
              >
                Auswahl ausdrücklich aktivieren
              </Button>
            </fieldset>
            <Section title="Entscheidungshistorie">
              <p>
                Unveränderliche Anfragebelege. Rollback benötigt eine neue
                aktuelle Berechtigungs- und Quellenprüfung.
              </p>
              {history?.page.map((h) => (
                <div key={h._id} className="border-b py-2">
                  <p>
                    {new Date(h.createdAt).toISOString()} · Revision{" "}
                    {h.revision} · {h.action} · {h.reason}
                  </p>
                  <p>
                    {h.algorithmId ?? "kein Algorithmus"} ·{" "}
                    {h.audienceId ?? "keine Zielgruppe"}
                  </p>
                  {(h.action === "select" || h.action === "rollback") && (
                    <Button
                      variant="outline"
                      disabled={!writable || !reason.trim()}
                      onClick={() =>
                        command({
                          kind: "rollback",
                          algorithmId: h.algorithmId,
                          audienceId: h.audienceId,
                          reason,
                        })
                      }
                    >
                      Auf diese Auswahl zurückrollen
                    </Button>
                  )}
                </div>
              ))}
              {!history ? (
                <p>Historie wird geladen …</p>
              ) : (
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
                    disabled={history.isDone}
                    onClick={() => setCursor(history.continueCursor)}
                  >
                    Ältere Entscheidungen
                  </Button>
                </div>
              )}
            </Section>
          </>
        )}
      </Section>
    </div>
  );
}

function SourceUpdates({
  workspaceId,
  accountId,
  profiles,
  revision,
  writable,
  admin,
  now,
  run,
}: {
  workspaceId: Id<"workspaces">;
  accountId: Id<"socialAccounts">;
  profiles: Doc<"algorithmProfiles">[];
  revision: number;
  writable: boolean;
  admin: boolean;
  now: number;
  run: (attempt: Attempt, retry?: boolean) => Promise<void>;
}) {
  const args = { workspaceId, accountId };
  const records = useQuery(
    api.intelligence.profileUpdates.list,
    admin ? args : "skip",
  );
  const check = useAction(api.intelligence.profileUpdates.check),
    evaluate = useMutation(api.intelligence.profileUpdates.evaluate),
    inspect = useMutation(api.intelligence.profileUpdates.inspect),
    create = useMutation(api.intelligence.algorithmProfiles.create);
  const [base, setBase] = useState(""),
    [proposalId, setProposal] = useState(""),
    [variant, setVariant] = useState<"public-context" | "post-analysis">(
      "public-context",
    ),
    [interpretation, setInterpretation] = useState(""),
    [impact, setImpact] = useState(""),
    [rationale, setRationale] = useState(""),
    [reviewed, setReviewed] = useState(false);
  const checks = records?.filter((r) => r.kind === "check") ?? [],
    proposals = records?.filter((r) => r.kind === "proposal") ?? [];
  const proposal = proposals.find((r) => r._id === proposalId);
  const evaluations =
    records
      ?.filter((r) => r.kind === "evaluation")
      .filter((r) => r.proposalId === proposalId) ?? [];
  const latest = checks[0],
    cooldown = latest && latest.notBefore > now;
  const original = profiles.find((p) => p._id === proposal?.baseProfileId);
  function observe(full: boolean) {
    if (!writable || !base) return;
    const input = {
      ...args,
      baseProfileId: base as Id<"algorithmProfiles">,
      commandKey: crypto.randomUUID(),
      full,
    };
    void run({ execute: () => check(input), success: () => {} });
  }
  return (
    <Section
      title="Öffentliche Quellen kontrolliert aktualisieren"
      description="xai-org/x-algorithm · main · manueller Owner/Admin-Check · kein Einfluss auf Auswahl oder Bewertung."
    >
      <p className="text-sm">
        Öffentlicher Code belegt keinen aktuellen X-Produktionsstand. Ein Check
        beobachtet Quellen; Interpretation, Referenzprüfung, neues Draft-Profil,
        menschliches Review und Auswahl bleiben getrennte Schritte.
      </p>
      <fieldset disabled={!writable} className="stack">
        <label>
          Basisprofil für Quellencheck
          <select
            value={base}
            onChange={(e) => setBase(e.target.value)}
            className="w-full rounded border p-2"
          >
            <option value="">Basis ausdrücklich wählen</option>
            {profiles
              .filter((p) => p.status !== "retired")
              .map((p) => (
                <option key={p._id} value={p._id}>
                  {p.payload.commit} · {p._id}
                </option>
              ))}
          </select>
        </label>
        <div className="flex flex-wrap gap-2">
          <Button
            className="h-auto min-h-9 max-w-full whitespace-normal py-2"
            disabled={!base || !!cooldown}
            onClick={() => observe(false)}
          >
            Quelle jetzt prüfen
          </Button>
          <Button
            className="h-auto min-h-9 max-w-full whitespace-normal py-2"
            variant="outline"
            disabled={!base || !!cooldown}
            onClick={() => observe(true)}
          >
            Vollständige Neubeobachtung
          </Button>
        </div>
      </fieldset>
      {cooldown && (
        <p role="status">
          Nächster neuer Check frühestens{" "}
          {new Date(latest.notBefore).toISOString()}. Mindestens zehn Minuten
          Account-Cooldown; das öffentliche GitHub-IP-Limit ist geteilt.
        </p>
      )}
      {checks.map((c) => (
        <details key={c._id} open={c === latest} className="min-w-0">
          <summary>
            Quellencheck ·{" "}
            {c.state === "pending" && c.deadline <= now ? "unknown" : c.state} ·{" "}
            {new Date(c.createdAt).toISOString()}
          </summary>
          <p>
            {c.state === "pending" || c.state === "unknown" ? (
              <>
                Transportzahlen unbekannt: HTTP-Versuche und empfangene Bytes
                sind nicht abschließend quittiert
              </>
            ) : (
              <>
                {c.requests} HTTP-Versuche · {c.bytes} tatsächlich empfangene
                Bytes
              </>
            )}
            {c.error && <> · {c.error}</>}. Auswahlrevision bleibt unverändert.
          </p>
          {c.state === "pending" && c.deadline <= now && (
            <Button
              className="h-auto min-h-9 max-w-full whitespace-normal py-2"
              disabled={!writable}
              onClick={() =>
                void run({
                  execute: () => inspect({ ...args, checkId: c._id }),
                  success: () => {},
                })
              }
            >
              Abgelaufenen Versuch klären
            </Button>
          )}
          <p className="break-all">
            Basisprofil {c.baseProfileId} · ursprünglicher Commit {c.baseCommit}
            .
          </p>
          {c.observation ? (
            <div className="stack min-w-0">
              <p className="break-all">
                Beobachteter Commit {c.observation.commit} · Commitzeit{" "}
                {new Date(c.observation.commitAt).toISOString()} · beobachtet{" "}
                {new Date(c.observation.observedAt).toISOString()}.{" "}
                {c.observation.complete
                  ? "strukturell vollständiger Vergleich und Manifest"
                  : c.state === "up_to_date"
                    ? "SHA unverändert; keine vollständige Neubeobachtung"
                    : "strukturell unvollständig; kein Kandidat"}
                . {c.observation.issues.join(", ")}
              </p>
              <p>
                Beobachtungsrahmen bis{" "}
                {new Date(c.observation.reviewDueAt).toISOString()} als
                Sieben-Tage-Annahme. Ein unvollständiger Check verleiht keine
                nutzbare Profilfrist.
              </p>
              <a
                href={c.observation.compareUrl}
                target="_blank"
                rel="noreferrer"
              >
                Unveränderlichen Vergleich dieses Checks öffnen
              </a>
              <details>
                <summary>
                  Erfasste Rohdateien dieses Checks (
                  {c.observation.evidence.length}/13)
                </summary>
                <ul>
                  {c.observation.evidence.map((e) => (
                    <li className="break-all" key={e.path}>
                      <a href={e.url} target="_blank" rel="noreferrer">
                        {e.path}
                      </a>{" "}
                      · SHA-256 {e.sha256}
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          ) : (
            <p>
              Neuer Commit und Beobachtungszeit nicht verifiziert; kein
              aktueller Quellenstand bestätigt.
            </p>
          )}
          <details>
            <summary>Nicht neu erfasste feste Quellenpfade</summary>
            <p className="text-sm">
              Ein leichter Check bei unverändertem SHA liest die Rohdateien
              bewusst nicht neu. Fehler oder strukturelle Lücken erlauben keinen
              Kandidaten.
            </p>
            <ul>
              {c.expectedPaths
                .filter(
                  (path) =>
                    !c.observation?.evidence.some((e) => e.path === path),
                )
                .map((path) => (
                  <li key={path} className="break-all">
                    {path}
                  </li>
                ))}
            </ul>
          </details>
        </details>
      ))}
      {!records && admin && <p>Quellenbelege werden geladen …</p>}
      <label>
        Quellenvorschlag
        <select
          value={proposalId}
          onChange={(e) => {
            setProposal(e.target.value);
            setReviewed(false);
          }}
          className="w-full rounded border p-2"
        >
          <option value="">Vorschlag ausdrücklich wählen</option>
          {proposals.map((p) => (
            <option key={p._id} value={p._id}>
              {p.observation.commit} · {p._id}
            </option>
          ))}
        </select>
      </label>
      {proposal && (
        <div className="stack min-w-0">
          <p className="break-all">
            Quellenfakten: {proposal.baseCommit} → {proposal.observation.commit}
            . {proposal.observation.changes.length} geänderte Pfade;{" "}
            {proposal.observation.evidence.length} feste Rohdateien mit SHA-256.
            Beobachtet {new Date(proposal.observation.observedAt).toISOString()}
            ; Prüffrist{" "}
            {new Date(proposal.observation.reviewDueAt).toISOString()} als
            unveränderliche betriebliche Sieben-Tage-Annahme.
          </p>
          <a
            href={proposal.observation.compareUrl}
            target="_blank"
            rel="noreferrer"
          >
            Vollständigen unveränderlichen Quellenvergleich öffnen
          </a>
          <details>
            <summary>13 Quellenbelege und vorherige Prüfsummen</summary>
            <ul>
              {proposal.observation.evidence.map((e) => (
                <li className="break-all" key={e.path}>
                  <a href={e.url} target="_blank" rel="noreferrer">
                    {e.path}
                  </a>{" "}
                  · SHA-256 {e.sha256} · vorher{" "}
                  {original?.payload.evidence.find((b) => b.path === e.path)
                    ?.sha256 ?? "Basis nicht in jüngsten 50 Profilen"}
                </li>
              ))}
            </ul>
          </details>
          <details>
            <summary>Alle geänderten Pfade und begrenzte Ausschnitte</summary>
            {proposal.observation.changes.map((c) => (
              <div key={c.path} className="border-b py-2">
                <a href={c.url} target="_blank" rel="noreferrer">
                  {c.path}
                </a>{" "}
                · {c.status} · Ausschnitt{" "}
                {c.patchState === "clipped"
                  ? "gekürzt"
                  : c.patchState === "missing"
                    ? "fehlt"
                    : "vollständig"}
                <pre className="whitespace-pre-wrap break-all text-xs">
                  {c.patch}
                </pre>
              </div>
            ))}
          </details>
          <fieldset
            disabled={!writable || proposal.observation.reviewDueAt <= now}
            className="stack"
          >
            <label>
              Variante der Referenzprüfung
              <select
                value={variant}
                onChange={(e) => setVariant(e.target.value as typeof variant)}
                className="w-full rounded border p-2"
              >
                <option value="public-context">
                  Informationskontext · nicht ausführbar
                </option>
                <option value="post-analysis">
                  Post-Analyse v1 · unveränderte Dispatch-Rubrik
                </option>
              </select>
            </label>
            <label>
              Menschliche Quelleninterpretation
              <Textarea
                value={interpretation}
                maxLength={4000}
                onChange={(e) => setInterpretation(e.target.value)}
              />
            </label>
            <label>
              Quellenbezogene Auswirkung auf Dispatch
              <Textarea
                value={impact}
                maxLength={2000}
                onChange={(e) => setImpact(e.target.value)}
              />
            </label>
            <p className="text-sm">
              Die Formel und bestehenden Analyse-Referenzen bleiben unverändert.
              Keine Reichweitenprognose, empirische Modellvalidierung oder
              Live-Jev-Bewertung.
            </p>
            <label>
              Begründung der vollständigen Quellenprüfung
              <Textarea
                value={rationale}
                maxLength={2000}
                onChange={(e) => setRationale(e.target.value)}
              />
            </label>
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={reviewed}
                onChange={(e) => setReviewed(e.target.checked)}
              />
              Ich habe den vollständigen verlinkten Vergleich und alle 13
              Quellenbelege geprüft. Begrenzte oder fehlende Ausschnitte
              ersetzen diese Prüfung nicht.
            </label>
            <Button
              className="h-auto min-h-9 max-w-full whitespace-normal py-2"
              disabled={
                !reviewed ||
                !interpretation.trim() ||
                !impact.trim() ||
                !rationale.trim()
              }
              onClick={() => {
                const input = {
                  ...args,
                  proposalId: proposal._id,
                  commandKey: crypto.randomUUID(),
                  variant,
                  interpretation,
                  impact,
                  rationale,
                  fullSourceReview: reviewed,
                };
                void run({ execute: () => evaluate(input), success: () => {} });
              }}
            >
              Quelleninterpretation und Referenzprüfung festhalten
            </Button>
          </fieldset>
          {evaluations.map((e) => (
            <div key={e._id} className="border-b py-2 stack">
              <p>Gespeicherte Interpretation: {e.interpretation}</p>
              <p>Dispatch-Auswirkung: {e.impact}</p>
              <p>Begründung: {e.rationale}</p>
              <p className="break-all">
                Evaluator {e.actorId} · {e.variant} · {e.reference.version} ·{" "}
                {e.reference.passed
                  ? "lokale Kompatibilitätsprüfung bestanden"
                  : "lokale Kompatibilitätsprüfung fehlgeschlagen"}
                .{" "}
                {e.reference.outcomes
                  .map(
                    (o) =>
                      `${o.case}: ${o.outcome}${o.aggregate === null ? "" : ` (${o.aggregate})`}`,
                  )
                  .join("; ")}
              </p>
              <Button
                className="h-auto min-h-9 max-w-full whitespace-normal py-2"
                disabled={
                  !writable ||
                  !e.reference.passed ||
                  proposal.observation.reviewDueAt <= now
                }
                onClick={() => {
                  const input = {
                    ...args,
                    expectedRevision: revision,
                    commandKey: crypto.randomUUID(),
                    variant: e.variant,
                    proposalId: proposal._id,
                    evaluationId: e._id,
                  };
                  void run({ execute: () => create(input), success: () => {} });
                }}
              >
                Frisches Quellenprofil als Draft anlegen
              </Button>
            </div>
          ))}
          {proposal.observation.reviewDueAt <= now && (
            <p role="status">
              Beobachtung abgelaufen. Vollständige Neubeobachtung erforderlich;
              alte Frist wird nicht verlängert.
            </p>
          )}
        </div>
      )}
    </Section>
  );
}
