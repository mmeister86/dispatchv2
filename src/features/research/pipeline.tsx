import { useState } from "react";
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
  workspaceId,
  orderId,
  disabled,
  command,
}: {
  workspaceId: Id<"workspaces">;
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
      {!orderId ? (
        <p>Wähle einen tatsächlichen Auftrag aus der Historie.</p>
      ) : row === undefined ? (
        <p>Workflow-Belege werden geladen …</p>
      ) : !row ? (
        <p>Dieser Auftrag enthält keinen Research-Workflow.</p>
      ) : (
        <div className="space-y-4">
          <p role="status">
            Schritt {row.step}/10 · {row.outcome} · automatische Übergabe
            deaktiviert.
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
