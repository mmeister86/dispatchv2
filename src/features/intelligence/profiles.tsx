import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionArgs } from "convex/server";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Section } from "@/components/shared";
type Action = FunctionArgs<typeof api.intelligence.profiles.change>["action"];
type Attempt = { execute: () => Promise<unknown>; success: () => void };
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
      await attempt.execute();
      if (mounted.current && context.current.epoch === epoch) {
        setFailed(null);
        attempt.success();
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
    <div className="stack">
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
              ? "Profilkontext geprüft. Analyse weiterhin nicht verfügbar."
              : "Profilkontext unvollständig oder erneute Prüfung erforderlich."}
        </p>
        <p className="text-sm text-muted-foreground">
          Fehlend: {row.capture.missing.join(", ")}. Kein Gesamtscore; Audience
          Fit und Embeddings nicht verfügbar. Historie 0,5 ist eine
          Cold-Start-Annahme, keine Messung. Fragen/Normalisierung nicht
          implementiert; Routing und Verifikation ausgeschaltet.
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
              <div className="flex gap-2">
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
                <Button
                  onClick={() => {
                    const input = {
                      ...args,
                      expectedRevision: row.capture.revision,
                      commandKey: crypto.randomUUID(),
                    };
                    void run({
                      execute: () => createAlgorithm(input),
                      success: () => setCursor(null),
                    });
                  }}
                >
                  Öffentlichen Snapshot als Kandidat anlegen
                </Button>
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
                      Quellenprofil stilllegen
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
                <div className="flex gap-2">
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
