import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useGithubSourceProofClock } from "@/lib/github-source-proof";
type Command = (
  fn: (key: string) => Promise<unknown>,
  success: () => void,
) => Promise<void>;
export function Evidence({
  workspaceId,
  orderId,
  sourceId,
  materialHash,
  disabled,
  canReview,
  command,
}: {
  workspaceId: Id<"workspaces">;
  orderId: Id<"researchOrders">;
  sourceId: Id<"researchSources">;
  materialHash: string;
  disabled: boolean;
  canReview: boolean;
  command: Command;
}) {
  const create = useMutation(api.research.evidence.create),
    review = useMutation(api.research.evidence.review);
  const rows = useQuery(api.research.evidence.list, { workspaceId, orderId });
  const clock = useGithubSourceProofClock(
    (rows ?? []).map((r) => ({
      authorized: r.payload !== null,
      proofExpiresAt: Math.min(r.proofUntil, r.validityUntil ?? Infinity),
    })),
  );
  const [note, setNote] = useState({
    claim: "",
    quote: "",
    interpretation: "",
    gaps: "",
    relevance: "",
    novelty: "",
    uncertainty: "",
    validityReason: "",
    freshness: "unknown" as
      "unknown" | "time-sensitive" | "context-dependent" | "time-independent",
    consequentialOrContested: false,
    eventBased: false,
  });
  const [eventDate, setEventDate] = useState(""),
    [eventQuote, setEventQuote] = useState("");
  const [ageDays, setAgeDays] = useState("1"),
    [until, setUntil] = useState(""),
    [reason, setReason] = useState(""),
    [attested, setAttested] = useState(false);
  return (
    <details className="border rounded p-3 mt-2">
      <summary>Evidenz und menschliche Prüfung</summary>
      <p className="text-sm">
        Aussagen sind menschliche Einordnungen. Ein Textzitat belegt
        Textprovenienz, keine Wahrheit. Webmetadaten und Snapshotzahlen bleiben
        Review; kontroverse oder folgenreiche Aussagen brauchen unabhängige
        Bestätigung.
      </p>
      <fieldset disabled={disabled} className="space-y-2 mt-3">
        {(
          [
            "claim",
            "quote",
            "interpretation",
            "gaps",
            "relevance",
            "novelty",
            "uncertainty",
            "validityReason",
          ] as const
        ).map((key) => (
          <label className="block" key={key}>
            {
              {
                claim: "Quellenaussage (ungeprüft)",
                quote: "Exaktes Zitat aus geliefertem Text (optional)",
                interpretation: "Eigene Interpretation",
                gaps: "Datenlücken (eine pro Zeile)",
                relevance: "Begründete Accountrelevanz",
                novelty: "Begründete Neuheit",
                uncertainty: "Unsicherheit",
                validityReason: "Begründung der zeitlichen Gültigkeit",
              }[key]
            }
            <Textarea
              maxLength={2000}
              value={note[key]}
              onChange={(e) => setNote({ ...note, [key]: e.target.value })}
            />
          </label>
        ))}
        <label className="block">
          Aktualitätsklasse
          <select
            value={note.freshness}
            onChange={(e) =>
              setNote({
                ...note,
                freshness: e.target.value as typeof note.freshness,
              })
            }
          >
            <option value="unknown">Unbekannt</option>
            <option value="time-sensitive">Zeitabhängig</option>
            <option value="context-dependent">Kontextabhängig</option>
            <option value="time-independent">Zeitunabhängig</option>
          </select>
        </label>
        <label className="block">
          <input
            type="checkbox"
            checked={note.consequentialOrContested}
            onChange={(e) =>
              setNote({ ...note, consequentialOrContested: e.target.checked })
            }
          />{" "}
          Folgenreich oder kontrovers
        </label>
        <label className="block">
          <input
            type="checkbox"
            checked={note.eventBased}
            onChange={(e) => setNote({ ...note, eventBased: e.target.checked })}
          />{" "}
          Aussage über ein Ereignis (Ereigniszeit zusätzlich bestätigen; sonst
          Review)
        </label>
        <Button
          onClick={() => {
            const annotation = {
              ...note,
              quote: note.quote || null,
              gaps: note.gaps.split("\n").filter(Boolean),
            };
            void command(
              (key) =>
                create({
                  workspaceId,
                  orderId,
                  sourceId,
                  expectedMaterialHash: materialHash,
                  commandKey: key,
                  annotation,
                }),
              () => {},
            );
          }}
        >
          Als Review speichern
        </Button>
      </fieldset>
      {(rows ?? [])
        .filter((r) => r.source?.sourceId === sourceId)
        .map((r) =>
          r.payload && r.proofUntil > clock ? (
            <div key={r.evidenceId} className="border-t mt-3 pt-3">
              <p>
                {r.automaticEligible &&
                r.validityUntil !== null &&
                r.validityUntil > clock
                  ? "Menschlich geprüft · für Research-Kontext gültig"
                  : "Review · keine aktuelle automatische Eignung"}
              </p>
              <p>
                Accountperspektive: {r.payload.perspective.audience} ·{" "}
                {r.payload.perspective.topics} · {r.payload.perspective.project}
              </p>
              <p>
                Quellenaussage (menschlich erfasst):{" "}
                {r.payload.annotation.claim}
              </p>
              <p>
                Zitat:{" "}
                {r.payload.annotation.quote ?? "Kein geliefertes Textzitat"}
              </p>
              <p>Interpretation: {r.payload.annotation.interpretation}</p>
              <p>
                Datenlücken:{" "}
                {r.payload.annotation.gaps.join("; ") || "Keine benannt"}
              </p>
              <p>Relevanz: {r.payload.annotation.relevance}</p>
              <p>Neuheit: {r.payload.annotation.novelty}</p>
              <p>Unsicherheit: {r.payload.annotation.uncertainty}</p>
              <p>
                Gültigkeitsbegründung: {r.payload.annotation.validityReason} ·{" "}
                {r.payload.annotation.freshness}
              </p>
              <p>
                Quellenbeleg bis {new Date(r.proofUntil).toISOString()}; Aussage
                gültig bis{" "}
                {r.validityUntil
                  ? new Date(r.validityUntil).toISOString()
                  : "nicht bestätigt"}
                . {r.reason}
              </p>
              {r.assessment && (
                <p>
                  Menschliche Regel {r.assessment.ruleVersion} ·{" "}
                  {r.assessment.reason}; keine automatisch festgestellte
                  Wahrheit.
                </p>
              )}
              {canReview && (
                <fieldset disabled={disabled} className="space-y-2">
                  <label className="block">
                    Maximales Publikationsalter (Tage, 1–90)
                    <Input
                      type="number"
                      min="1"
                      max="90"
                      value={ageDays}
                      onChange={(e) => setAgeDays(e.target.value)}
                    />
                  </label>
                  <label className="block">
                    Gültig bis (lokale Zeit)
                    <Input
                      type="datetime-local"
                      value={until}
                      onChange={(e) => setUntil(e.target.value)}
                    />
                  </label>
                  <label className="block">
                    Ereignisdatum (UTC, optional)
                    <Input
                      type="date"
                      value={eventDate}
                      onChange={(e) => setEventDate(e.target.value)}
                    />
                  </label>
                  <label className="block">
                    Exaktes Ereigniszitat mit ISO-Datum (optional)
                    <Textarea
                      maxLength={2000}
                      value={eventQuote}
                      onChange={(e) => setEventQuote(e.target.value)}
                    />
                  </label>
                  <label className="block">
                    Regelbegründung
                    <Textarea
                      maxLength={2000}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </label>
                  <label className="block">
                    <input
                      type="checkbox"
                      checked={attested}
                      onChange={(e) => setAttested(e.target.checked)}
                    />{" "}
                    Ich habe die tatsächliche inhaltliche Unterstützung der
                    Aussage geprüft.
                  </label>
                  <Button
                    disabled={!until || !reason.trim()}
                    onClick={() => {
                      const intent = {
                        workspaceId,
                        evidenceId: r.evidenceId,
                        maxAgeMs: Number(ageDays) * 86400000,
                        validUntil: new Date(until).getTime(),
                        reason,
                        substantiveSupportAttested: attested,
                        eventAt: eventDate ? Date.parse(eventDate) : null,
                        eventQuote: eventQuote || null,
                      };
                      void command(
                        (key) => review({ ...intent, commandKey: key }),
                        () => {},
                      );
                    }}
                  >
                    Neue menschliche Prüfung speichern
                  </Button>
                </fieldset>
              )}
            </div>
          ) : null,
        )}
    </details>
  );
}
