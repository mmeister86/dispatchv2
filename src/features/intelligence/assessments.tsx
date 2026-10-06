import { useAction, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Section, Status } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { canEdit, type Version } from "@/lib/model";
const labels: Record<string, string> = {
  contentType: "Inhaltstyp",
  hookStrength: "Hook",
  clarity: "Klarheit",
  originality: "Originalität",
  discussionPotential: "Diskussionsfähigkeit",
  naturalCta: "Natürliche CTA",
  promotionalTone: "Werblicher Ton",
  strongClaim: "Starke Behauptung",
  clickbait: "Clickbait",
  announcement: "Ankündigung",
  opinion: "Meinung",
  educational: "Erklärung",
  promotional: "Werbung",
  conversation: "Gespräch",
  story: "Erfahrung",
  update: "Statusmeldung",
  other: "Sonstiges",
};
type Assessment = NonNullable<
  FunctionReturnType<typeof api.intelligence.assessments.get>["assessment"]
>;
export function SavedAssessment({
  draftId,
  accountId,
  version,
  dirty,
  conflict,
  saving,
}: {
  draftId: string;
  accountId: string;
  version: Version;
  dirty: boolean;
  conflict: boolean;
  saving: boolean;
}) {
  const { state } = useStore();
  if (state.accounts.find((a) => a.id === accountId)?.channel !== "X")
    return (
      <Section title="Dispatch Score">
        <p>Für dieses Netzwerk ist noch kein Analysevertrag verfügbar.</p>
      </Section>
    );
  if (version.sourceUnavailable)
    return (
      <Section title="Dispatch Score">
        <p>
          Quelle nicht mehr verfügbar. Geschützte Bewertungen sind ausgeblendet.
        </p>
      </Section>
    );
  return (
    <AssessmentVersion
      key={`${state.activeWorkspaceId}:${accountId}:${draftId}:${version.id}:${state.role}`}
      workspaceId={state.activeWorkspaceId as Id<"workspaces">}
      accountId={accountId as Id<"socialAccounts">}
      draftId={draftId as Id<"drafts">}
      version={version}
      blocked={dirty || conflict || saving}
    />
  );
}
function AssessmentVersion({
  workspaceId,
  accountId,
  draftId,
  version,
  blocked,
}: {
  workspaceId: Id<"workspaces">;
  accountId: Id<"socialAccounts">;
  draftId: Id<"drafts">;
  version: Version;
  blocked: boolean;
}) {
  const { state } = useStore();
  const args = {
    workspaceId,
    accountId,
    draftId,
    draftVersionId: version.id as Id<"draftVersions">,
  };
  const row = useQuery(api.intelligence.assessments.get, args);
  const availability = useQuery(api.ai.jev.access.availability, {
    workspaceId,
    accountId,
  });
  const [cursor, setCursor] = useState<string | null>(null);
  const history = useQuery(api.intelligence.assessments.history, {
    workspaceId,
    accountId,
    draftId,
    paginationOpts: { numItems: 10, cursor },
  });
  const analyze = useAction(api.intelligence.assessments.analyze);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [clock, setClock] = useState(Date.now());
  const mounted = useRef(false),
    pending = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const until = Math.min(
    row?.sourceUntil ?? Infinity,
    version.sourceProofUntil ?? Infinity,
  );
  const nextWake = Math.min(
    ...[
      until,
      ...(history?.page.map((r) => r.sourceUntil ?? Infinity) ?? []),
    ].filter((horizon) => horizon > clock),
  );
  useEffect(() => {
    if (!Number.isFinite(nextWake)) return;
    const timer = setTimeout(
      () => setClock(Date.now()),
      Math.min(2147483647, Math.max(0, nextWake - Date.now()) + 1),
    );
    return () => clearTimeout(timer);
  }, [nextWake, clock]);
  const protectedUnavailable = until <= clock;
  const writable = canEdit(state.role) && !blocked && !protectedUnavailable;
  const execute = async () => {
    if (!writable || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await analyze({
        ...args,
        operationKey: crypto.randomUUID(),
      });
      if (!mounted.current) return;
      if (result.outcome === "success" || result.outcome === "low_confidence")
        setMessage(
          result.cached
            ? "Gespeicherte Bewertung wiederverwendet."
            : "Bewertung gespeichert.",
        );
      else
        setError(
          "Bewertung nicht verfügbar. Erneut versuchen; manuelles Veröffentlichen bleibt möglich.",
        );
    } catch {
      if (mounted.current)
        setError(
          "Bewertung nicht verfügbar. Prüfe aktuelle Version, Profile und Analysekonfiguration; manuelles Veröffentlichen bleibt möglich.",
        );
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const assessment = protectedUnavailable ? null : row?.assessment;
  return (
    <Section
      title="Dispatch Score"
      actions={<Status>Gespeicherte Version {version.number}</Status>}
    >
      <p className="text-xs muted">
        Freiwillige Inhaltsheuristik, keine Reichweitenprognose. Manuelles
        Freigeben und Veröffentlichen bleiben unabhängig.
      </p>
      {availability && availability.status !== "ready" && (
        <p role="status" className="text-xs">
          {availability.guidance}
        </p>
      )}
      {blocked && (
        <p role="status" className="text-xs">
          Änderungen zuerst speichern und den aktuellen Versionsstand abwarten.
        </p>
      )}
      {protectedUnavailable && (
        <p role="status" className="text-xs">
          Quellenfreigabe abgelaufen. Geschützte Bewertungen sind ausgeblendet.
        </p>
      )}
      <Button
        size="sm"
        disabled={!writable || busy || !row || availability?.status !== "ready"}
        onClick={() => void execute()}
      >
        {busy
          ? "Bewertung läuft …"
          : error
            ? "Bewertung erneut versuchen"
            : "Gespeicherte Version analysieren"}
      </Button>
      {error && (
        <p role="alert" className="mt-3 text-xs">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="mt-3 text-xs">
          {message}
        </p>
      )}
      {assessment ? (
        <>
          <p role="status" className="mt-4 text-xs">
            {row?.applicable && !blocked && !busy && !error
              ? "Aktuell anwendbare Bewertung"
              : "Veraltete / derzeit nicht anwendbare Bewertung"}
          </p>
          <AssessmentResult row={assessment} />
        </>
      ) : (
        <p className="mt-4 text-xs muted">
          {row
            ? "Keine Bewertung für diese gespeicherte Version."
            : "Bewertungen werden geladen …"}
        </p>
      )}
      {!protectedUnavailable && (
        <div className="mt-5 border-t pt-4">
          <h4 className="text-xs font-semibold">
            Gespeicherter Analyseverlauf
          </h4>
          <p className="text-[11px] muted">
            Historische Komponenten mit eigenen Versionen; veränderte
            Bedingungen erlauben keinen direkten Scorevergleich.
          </p>
          {history?.page
            .filter((r) => r.sourceUntil === null || r.sourceUntil > clock)
            .map((r) => (
              <details key={r._id} className="mt-2 text-xs">
                <summary>
                  Version {r.versionNumber} ·{" "}
                  {new Date(r.createdAt).toLocaleString("de-DE")} ·{" "}
                  {r.result.score?.aggregate === null
                    ? "unvollständig"
                    : Math.round(r.result.score?.aggregate ?? 0)}
                </summary>
                <AssessmentResult row={r} />
              </details>
            ))}
          {history && !history.isDone && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCursor(history.continueCursor)}
            >
              Weitere Bewertungen laden
            </Button>
          )}
        </div>
      )}
    </Section>
  );
}
function AssessmentResult({ row }: { row: Assessment }) {
  const { result, provenance } = row;
  return (
    <div className="mt-3">
      <p className="text-4xl font-semibold">
        {result.score?.aggregate == null
          ? "—"
          : Math.round(result.score.aggregate)}
        <span className="text-sm muted"> / 100</span>
      </p>
      {result.score?.aggregate === null && (
        <p className="text-xs">
          Unvollständige Bewertung:{" "}
          {result.score.missing
            .concat(result.score.lowConfidence)
            .map((key) => labels[key] ?? key)
            .join(", ")}
        </p>
      )}
      <dl className="space-y-2 text-xs">
        {Object.entries(result.answers ?? {}).map(([name, a]) => (
          <div key={name} className="flex justify-between gap-4">
            <dt>{labels[name] ?? name}</dt>
            <dd>
              {a.type === "noul"
                ? `${Math.round(a.probability * 100)} % Wahrscheinlichkeit`
                : `${a.type === "score" ? Math.round(a.value * 100) : (labels[a.value] ?? a.value)} · Sicherheit ${Math.round(a.confidence * 100)} %`}
            </dd>
          </div>
        ))}
        <div className="flex justify-between">
          <dt>Struktur</dt>
          <dd>{Math.round(result.deterministic.structure * 100)}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Historische Passung (angenommener Startwert)</dt>
          <dd>50</dd>
        </div>
      </dl>
      <p className="mt-3 text-[10px] muted">
        Audience Fit: nicht verfügbar. Fragen {result.questionVersion} ·
        Normalisierung {result.normalizationVersion} · Formel{" "}
        {result.score?.formulaVersion} · Schwelle{" "}
        {result.score?.thresholdVersion}
      </p>
      <details className="text-[10px] muted">
        <summary>Profil-, Eingabe- und Aufrufnachweis</summary>
        <p>
          Version {row.versionNumber} · {row.draftVersionId} · Algorithmus{" "}
          {row.algorithmId} · Audience {row.audienceId} · {row.inputVersion} ·{" "}
          {row.semanticKey}
        </p>
        <p>
          Policy {provenance.policyVersion} · Modell {provenance.requestedModel}{" "}
          / {provenance.resolvedModel ?? "unbekannt"} · Tokens{" "}
          {provenance.inputTokens ?? "unbekannt"} /{" "}
          {provenance.outputTokens ?? "unbekannt"} ·{" "}
          {provenance.latencyMs ?? "unbekannt"} ms · Beleg {row.attemptId}
        </p>
        <p>
          Gesendet {new Date(provenance.sentAt).toLocaleString("de-DE")} ·
          Nutzung verbucht{" "}
          {provenance.settledAt === null
            ? "noch offen"
            : new Date(provenance.settledAt).toLocaleString("de-DE")}
        </p>
      </details>
    </div>
  );
}
