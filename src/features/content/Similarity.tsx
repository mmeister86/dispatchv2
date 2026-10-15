import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useStore } from "@/lib/store";
import { Section, Status } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { canEdit } from "@/lib/model";
type Source =
  | { kind: "history"; historyPostId: Id<"historyPosts"> }
  | { kind: "draft"; draftVersionId: Id<"draftVersions"> };
export function Similarity({
  accountId,
  versionId,
  blocked = false,
}: {
  accountId: string;
  versionId?: string;
  blocked?: boolean;
}) {
  const { state } = useStore();
  if (!accountId)
    return (
      <Section title="Semantische Ähnlichkeiten">
        <p className="text-sm muted">Account auswählen.</p>
      </Section>
    );
  return (
    <SimilarityScope
      key={`${state.activeWorkspaceId}:${accountId}:${versionId ?? "history"}:${state.role}`}
      accountId={accountId as Id<"socialAccounts">}
      versionId={versionId as Id<"draftVersions"> | undefined}
      blocked={blocked}
    />
  );
}
function SimilarityScope({
  accountId,
  versionId,
  blocked,
}: {
  accountId: Id<"socialAccounts">;
  versionId?: Id<"draftVersions">;
  blocked: boolean;
}) {
  const { state } = useStore(),
    workspaceId = state.activeWorkspaceId as Id<"workspaces">,
    args = { workspaceId, accountId };
  const availability = useQuery(api.content.similarity.availability, args),
    history = useQuery(api.performance.history.overview, args);
  const consent = useMutation(api.content.similarity.consent),
    prepare = useMutation(api.content.similarity.prepare),
    execute = useAction(api.ai.embeddings.execute);
  const [selected, setSelected] = useState(
      versionId ? `draft:${versionId}` : "",
    ),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [historyConsent, setHistoryConsent] = useState(false),
    [draftConsent, setDraftConsent] = useState(false),
    [evidence, setEvidence] = useState(""),
    [expiry, setExpiry] = useState(""),
    [clock, setClock] = useState(Date.now());
  const active = useRef(true),
    pending = useRef(false),
    epoch = useRef(0),
    command = useRef<{ key: string; attemptId?: Id<"aiAttempts"> } | null>(
      null,
    );
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      epoch.current++;
    };
  }, []);
  useEffect(() => {
    epoch.current++;
    command.current = null;
    setError("");
    setMessage("");
  }, [selected, blocked, availability?.generation]);
  const drafts = state.drafts
    .filter((d) => d.workspaceId === workspaceId && d.accountId === accountId)
    .flatMap((d) => {
      const v = d.versions.at(-1);
      return v?.id && !v.sourceUnavailable
        ? [{ id: v.id as Id<"draftVersions">, title: d.title }]
        : [];
    });
  const chosen: Source | null = selected.startsWith("draft:")
    ? {
        kind: "draft",
        draftVersionId: selected.slice(6) as Id<"draftVersions">,
      }
    : selected.startsWith("history:")
      ? {
          kind: "history",
          historyPostId: selected.slice(8) as Id<"historyPosts">,
        }
      : null;
  const dateValid = !!from && !!to && Date.parse(from) <= Date.parse(to),
    candidateVersionIds = [
      ...new Set([
        ...(versionId ? [versionId] : []),
        ...(chosen?.kind === "draft" ? [chosen.draftVersionId] : []),
      ]),
    ];
  const frame = useQuery(
    api.content.similarity.frame,
    chosen && dateValid && !blocked
      ? {
          ...args,
          source: chosen,
          from: Date.parse(`${from}T00:00:00Z`),
          to: Date.parse(`${to}T23:59:59.999Z`),
          candidateVersionIds,
          topK: 5,
        }
      : "skip",
  );
  const until = Math.min(
      availability?.expiresAt ?? Infinity,
      frame?.sourceUntil ?? Infinity,
    ),
    expired = until <= clock;
  useEffect(() => {
    if (!Number.isFinite(until) || until <= clock) return;
    const timer = setTimeout(
      () => setClock(Date.now()),
      Math.min(2147483647, until - Date.now() + 1),
    );
    return () => clearTimeout(timer);
  }, [until, clock]);
  const writable = canEdit(state.role) && !blocked && !expired,
    admin = ["Owner", "Admin"].includes(state.role);
  async function run(fn: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    const revision = epoch.current;
    try {
      await fn();
    } catch (e) {
      if (active.current && revision === epoch.current)
        setError(
          e instanceof Error
            ? e.message
            : "Semantischer Kontext nicht verfügbar.",
        );
    } finally {
      pending.current = false;
      if (active.current) setBusy(false);
    }
  }
  async function index() {
    if (!chosen || !availability?.enabled || !writable) return;
    const revision = epoch.current;
    await run(async () => {
      command.current ??= { key: crypto.randomUUID() };
      const receipt = command.current;
      receipt.attemptId ??= await prepare({
        ...args,
        source: chosen,
        commandKey: receipt.key,
      });
      if (!active.current || revision !== epoch.current) return;
      const result = await execute({ attemptId: receipt.attemptId });
      if (active.current && revision === epoch.current)
        setMessage(
          result.outcome === "prepared"
            ? "Vektor vorbereitet. Kosten bleiben eine Tokenpreis-Schätzung."
            : result.outcome === "replay"
              ? "Dieser Auftrag wird nicht erneut gesendet. Status und Finanzbeleg bleiben erhalten."
              : "Nicht verfügbar. Unbekannte Kosten bleiben reserviert; Wiederholen verwendet denselben Auftrag.",
        );
    });
  }
  const currentPrepared = frame?.items.some(
    (item) =>
      item.vectorId &&
      (item.source.kind === "draft"
        ? `draft:${item.source.draftVersionId}`
        : `history:${item.source.historyPostId}`) === selected,
  );
  return (
    <Section
      title="Semantische Ähnlichkeiten"
      description="Eigene importierte Historie und exakt gespeicherte Entwürfe. Kosinusähnlichkeit ist ein modellabhängiger Hinweis."
    >
      <Status>
        {availability === undefined
          ? "Status wird geladen"
          : availability.enabled && !expired
            ? "Zweck freigegeben"
            : "Nicht verfügbar"}
      </Status>
      {availability && !availability.sendConfigured && (
        <p className="text-xs muted mt-3">
          Sendekonfiguration fehlt. Neue Indexierungen sind gesperrt.
        </p>
      )}
      {!availability?.enabled && (
        <p className="text-xs muted mt-3">
          {availability?.policyId
            ? "Eigene Freigabe oder Budget fehlt."
            : "Konfiguration erforderlich: tatsächliches Modell, Dimension, EU-Verarbeitung, Speicherung, Rechte und Tokenpreis sind separat freizugeben."}
        </p>
      )}
      {admin && availability?.policyId && !availability.enabled && (
        <div className="space-y-3 mt-4">
          <p className="text-xs">
            Explizite Weitergabe an das freigegebene Embedding-Modell:
          </p>
          {availability.identity && (
            <p className="text-xs break-all">
              Modell: {availability.identity.resolvedModel} ·{" "}
              {availability.identity.dimension} Dimensionen
              {availability.expiresAt !== null && (
                <span className="block muted">
                  Policy bis {new Date(availability.expiresAt).toISOString()}{" "}
                  (UTC)
                </span>
              )}
            </p>
          )}
          <label className="flex gap-2 text-xs">
            <input
              type="checkbox"
              checked={historyConsent}
              onChange={(e) => setHistoryConsent(e.target.checked)}
            />
            Eigene importierte Beitragstexte
          </label>
          <label className="flex gap-2 text-xs">
            <input
              type="checkbox"
              checked={draftConsent}
              onChange={(e) => setDraftConsent(e.target.checked)}
            />
            Exakte zulässige Entwurfstexte
          </label>
          <label className="block">
            <span className="field-label">Freigabegrund</span>
            <input
              aria-label="Embedding-Freigabegrund"
              className="native-input w-full"
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
              maxLength={2000}
            />
          </label>
          <label className="block">
            <span className="field-label">Freigabe bis (UTC)</span>
            <input
              type="datetime-local"
              aria-label="Embedding-Freigabe bis UTC"
              className="native-input max-w-full"
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
            />
          </label>
          <Button
            size="sm"
            disabled={
              busy ||
              !writable ||
              (!historyConsent && !draftConsent) ||
              !evidence.trim() ||
              !expiry
            }
            onClick={() =>
              void run(async () => {
                await consent({
                  ...args,
                  policyId: availability.policyId!,
                  expectedGeneration: availability.generation,
                  enabled: true,
                  ownHistory: historyConsent,
                  draftVersions: draftConsent,
                  consentEvidence: evidence,
                  expiresAt: Date.parse(`${expiry}:00Z`),
                });
              })
            }
          >
            Weitergabe freigeben
          </Button>
        </div>
      )}
      {admin && availability?.storedEnabled && (
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              await consent({
                ...args,
                policyId: availability.controlPolicyId!,
                expectedGeneration: availability.generation,
                enabled: false,
                ownHistory: false,
                draftVersions: false,
                consentEvidence: "",
                expiresAt: Date.now(),
              });
            })
          }
        >
          Zweck widerrufen
        </Button>
      )}
      <div className="grid gap-3 mt-4 sm:grid-cols-2">
        <label>
          <span className="field-label">Historie von (UTC)</span>
          <input
            aria-label="Semantische Historie von"
            type="date"
            className="native-input w-full"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          <span className="field-label">Historie bis (UTC)</span>
          <input
            aria-label="Semantische Historie bis"
            type="date"
            className="native-input w-full"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
      </div>
      <label className="block mt-3">
        <span className="field-label">
          Exakte Quelle für Vergleich / Indexierung
        </span>
        <select
          aria-label="Semantische Quelle"
          className="native-select w-full max-w-full"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          <option value="">Quelle auswählen</option>
          {versionId && !drafts.some((d) => d.id === versionId) && (
            <option value={`draft:${versionId}`}>
              Gespeicherte Entwurfsversion
            </option>
          )}
          {drafts.map((d) => (
            <option value={`draft:${d.id}`} key={d.id}>
              {d.title}
            </option>
          ))}
          {history?.posts
            .filter((p) => p.text && p.sourceUntil > clock)
            .map((p) => (
              <option value={`history:${p._id}`} key={p._id}>
                Historie {p.externalId} · {p.text?.slice(0, 50)}
              </option>
            ))}
        </select>
      </label>
      <Button
        size="sm"
        className="mt-3"
        disabled={
          busy ||
          !writable ||
          !availability?.enabled ||
          !availability?.sendConfigured ||
          !chosen ||
          currentPrepared
        }
        onClick={() => void index()}
      >
        {busy
          ? "Wird vorbereitet…"
          : command.current
            ? "Exakten Auftrag erneut prüfen"
            : "Ausgewählte Quelle indexieren"}
      </Button>
      {blocked && (
        <p className="text-xs muted mt-2">
          Zuerst die exakte Arbeitsversion speichern.
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs text-destructive mt-3">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-xs mt-3">
          {message}
        </p>
      )}
      {dateValid && chosen && !blocked && frame === undefined && (
        <p role="status" className="text-xs mt-3">
          Vergleich wird geladen…
        </p>
      )}
      {frame && !expired && !blocked && (
        <div className="mt-4 space-y-3">
          <p className="text-xs muted">
            Rahmen: {frame.scanned} geprüft · {frame.eligible} zulässig ·{" "}
            {frame.prepared} vorbereitet · {frame.missing} ohne passenden Vektor
            · {frame.unavailable} nicht verfügbar. Maximal 100 importierte
            historische Beiträge; weitere native Veröffentlichungen sind nicht
            enthalten.
          </p>
          {frame.overflow && (
            <p role="alert" className="text-xs">
              Rahmen zu groß. Datumsbereich enger wählen; es wird keine
              Stichprobe als vollständige Historie ausgegeben.
            </p>
          )}
          {frame.reason && (
            <p className="text-xs muted">
              {frame.reason === "EMBEDDING_FRAME_RESOURCE_CEILING"
                ? "Quellenketten überschreiten die begrenzte Vergleichsarbeit. Einen kleineren Rahmen wählen."
                : frame.reason === "EMBEDDING_QUERY_UNAVAILABLE"
                  ? "Vergleichsvektor fehlt oder ist nicht mehr zulässig."
                  : "Teilweise oder nicht verfügbar. Fehlende Vektoren sind keine Neuartigkeitsgarantie."}
            </p>
          )}
          {frame.identity && (
            <p className="text-[10px] muted break-all">
              Modell: {frame.identity.resolvedModel} ·{" "}
              {frame.identity.dimension} Dimensionen · {frame.identity.assembly}{" "}
              / {frame.identity.normalization}
            </p>
          )}
          {frame.matches.map((m) => (
            <div key={m.vectorId} className="border-t pt-3">
              <p className="text-sm mb-1">{m.text}</p>
              <p className="text-[10px] muted">
                {m.source.kind === "history"
                  ? `Import ${m.pin.kind === "history" ? m.pin.externalId : m.source.historyPostId}`
                  : `Entwurf ${m.source.draftVersionId}`}{" "}
                · Kosinus {m.score?.toFixed(3)} · Quelle gültig bis{" "}
                {new Date(m.sourceUntil).toISOString()}
              </p>
            </div>
          ))}
          <p className="text-[10px] muted">
            Keine Aussage über Erfolg, Plagiat oder garantierte
            Paraphrasenerkennung. Nur übereinstimmende Modell- und
            Verarbeitungsidentitäten werden verglichen.
          </p>
        </div>
      )}
    </Section>
  );
}
