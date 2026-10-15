import { Evidence } from "./evidence";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Section } from "@/components/shared";
import { useGithubSourceProofClock } from "@/lib/github-source-proof";
type Operation = Doc<"researchSourcePolicies">["operation"];
type Command = (
  fn: (key: string) => Promise<unknown>,
  success: () => void,
) => Promise<void>;
const names: Record<Operation, string> = {
  "x-recent": "X Recent Search",
  "x-trends": "X WOEID-Snapshot",
  "web-search": "Websuche",
};
export function SourceSearch({
  workspaceId,
  accountId,
  profileId,
  revision,
  config,
  disabled,
  command,
  selectedId,
  onSelect,
  canInvalidate,
}: {
  workspaceId: Id<"workspaces">;
  accountId: Id<"socialAccounts">;
  profileId: Id<"researchProfiles">;
  revision: number;
  config: Doc<"researchProfileVersions">["config"];
  disabled: boolean;
  command: Command;
  selectedId: Id<"researchOrders"> | null;
  onSelect: (id: Id<"researchOrders">) => void;
  canInvalidate: boolean;
}) {
  const availability = useQuery(api.research.native.availability, {
      workspaceId,
      accountId,
    }),
    start = useMutation(api.research.native.start),
    invalidate = useMutation(api.research.cache.invalidate);
  const results = useQuery(
    api.research.native.results,
    selectedId ? { workspaceId, orderId: selectedId } : "skip",
  );
  const [query, setQuery] = useState(""),
    [language, setLanguage] = useState(config.languages[0]),
    [operations, setOperations] = useState<Operation[]>(["web-search"]);
  const effectiveLanguage = config.languages.includes(language)
    ? language
    : config.languages[0];
  const clock = useGithubSourceProofClock(
    (results ?? []).flatMap((r) =>
      r.sources.map((s) => ({
        authorized: true,
        proofExpiresAt: s.usableUntil,
      })),
    ),
  );
  const priorMaterial = useRef({
    orderId: selectedId,
    hashes: new Map<string, string>(),
  });
  const [changedMaterial, setChangedMaterial] = useState<string[]>([]);
  const materialSnapshot = JSON.stringify(
    (results ?? []).flatMap((r) =>
      r.sources.map((s) => [s.sourceId, s.materialHash]),
    ),
  );
  useEffect(() => {
    const pairs: [string, string][] = JSON.parse(materialSnapshot);
    if (priorMaterial.current.orderId !== selectedId) {
      setChangedMaterial([]);
    } else {
      const changed = pairs
        .filter(
          ([id, hash]) =>
            priorMaterial.current.hashes.has(id) &&
            priorMaterial.current.hashes.get(id) !== hash,
        )
        .map(([id]) => id);
      if (changed.length)
        setChangedMaterial((previous) => [
          ...new Set([...previous, ...changed]),
        ]);
    }
    priorMaterial.current = { orderId: selectedId, hashes: new Map(pairs) };
  }, [selectedId, materialSnapshot]);
  return (
    <Section title="Quellensuche">
      <p>
        Neue ausdrückliche Quellensuche mit gespeichertem Profil und
        Auftragslimit. Evidenz kann manuell erfasst und menschlich geprüft
        werden; Modellauswertung startet nur über den ausdrücklichen
        Research-Workflow.
      </p>
      {availability?.map((a) => (
        <p className="mt-2 text-sm" key={a.operation}>
          {names[a.operation]} ·{" "}
          {a.state === "available"
            ? "aktuell freigegeben"
            : "Konfiguration erforderlich"}{" "}
          · {a.reason}
        </p>
      ))}
      <fieldset disabled={disabled} className="space-y-3 mt-4">
        <label>
          Suchanfrage
          <Input
            maxLength={450}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label>
          Suchsprache
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
        <div className="flex flex-wrap gap-4">
          {(["x-recent", "x-trends", "web-search"] as const).map((op) => (
            <label key={op}>
              <input
                type="checkbox"
                checked={operations.includes(op)}
                onChange={(e) =>
                  setOperations(
                    e.target.checked
                      ? [...operations, op]
                      : operations.filter((s) => s !== op),
                  )
                }
              />{" "}
              {names[op]}
            </label>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">
          {config.cap
            ? `Auftragslimit ${config.cap.limitMicros / 1e6} ${config.cap.currency}; Quellen brauchen dieselbe aktuelle Währung und eigene Freigaben.`
            : "Setze zuerst ein endliches Auftragslimit in einer aktuell freigegebenen Währung."}{" "}
          Fehlende Berechtigungen werden als Quellenstatus gespeichert; ein
          X-Ausfall ändert keine Publishing-Freigabe.
        </p>
        <Button
          disabled={!config.cap || !query.trim() || !operations.length}
          onClick={() => {
            const intent = {
              workspaceId,
              profileId,
              expectedRevision: revision,
              query,
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
          Quellensuche ausdrücklich starten
        </Button>
      </fieldset>
      {selectedId && (
        <div className="space-y-4 mt-4">
          {results === undefined ? (
            <p>Quellenbelege werden geladen …</p>
          ) : !results.length ? (
            <p>Dieser Beleg enthält keine native Quellensuche.</p>
          ) : (
            results.map((r) => (
              <div key={r.operation} className="border-t pt-3">
                <p>
                  {names[r.operation]} · {r.state}{" "}
                  {r.cacheHit ? "· autorisierter Cache-Treffer" : ""}
                </p>
                <p className="text-sm">
                  Suchanfrage {r.query} · {r.language} · {r.provider} ·{" "}
                  {r.protocol ?? "Protokoll nicht aktuell freigegeben"} ·{" "}
                  {r.policyVersion ?? "—"}
                  {r.model ? ` · ${r.model}` : ""}
                </p>
                <p className="text-sm">
                  {r.truncated
                    ? "Weitere Ergebnisse vorhanden; diese Abfrage lädt höchstens eine Seite."
                    : "Höchstens eine Seite pro Quellensuche."}
                </p>
                <p className="text-sm">
                  {r.reason} · Suchfenster{" "}
                  {new Date(r.windowStart).toISOString()} bis{" "}
                  {new Date(r.windowEnd).toISOString()}
                </p>
                <p className="text-sm">
                  {r.estimatedMicros === null
                    ? "Verbrauch nicht bestätigt"
                    : `Vorläufige Schätzung ${r.estimatedMicros / 1e6} ${r.currency}`}
                  {r.usagePending ? " · finanzielle Haftung ungeklärt" : ""} ·
                  abgerechneter Betrag nicht bestätigt.
                </p>
                {!r.sources.length && (
                  <p>Keine aktuell nutzbaren Quellen geliefert.</p>
                )}
                {r.sources.map((s) =>
                  s.usableUntil <= clock ? (
                    <p key={s.sourceId}>
                      Quelle abgelaufen; Inhalt ausgeblendet. Ungespeicherte
                      Evidenztexte wurden verworfen.
                    </p>
                  ) : (
                    <div key={s.sourceId} className="my-3">
                      {s.url ? (
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noreferrer"
                          className="underline"
                        >
                          {s.title}
                        </a>
                      ) : (
                        <p>{s.title}</p>
                      )}
                      {s.text && <p>{s.text}</p>}
                      {changedMaterial.includes(s.sourceId) && (
                        <p role="status">
                          Quellenstand aktualisiert. Ungespeicherte Evidenztexte
                          wurden verworfen; fehlgeschlagene Anfragen behalten
                          ihren ursprünglichen Quellenstand.
                        </p>
                      )}
                      <p className="text-sm">
                        Beobachtet {new Date(s.observedAt).toISOString()};{" "}
                        {s.publishedAt === null
                          ? "Publikationszeit unbekannt"
                          : `Publiziert ${new Date(s.publishedAt).toISOString()}`}
                        .{" "}
                        {s.count === null
                          ? "Reaktionszählung unbekannt"
                          : `Snapshotzählung ${s.count}; kein Wachstumsnachweis`}
                        . Quellenmetadaten bestätigen keine Aussage.
                      </p>
                      <Evidence
                        key={`${selectedId}:${s.sourceId}:${s.materialHash}`}
                        workspaceId={workspaceId}
                        orderId={selectedId}
                        sourceId={s.sourceId}
                        materialHash={s.materialHash}
                        disabled={disabled}
                        canReview={canInvalidate}
                        command={command}
                      />
                      {canInvalidate && (
                        <Button
                          variant="outline"
                          disabled={disabled}
                          onClick={() =>
                            command(
                              () =>
                                invalidate({
                                  workspaceId,
                                  sourceId: s.sourceId,
                                  reason: "blocked",
                                }),
                              () => {},
                            )
                          }
                        >
                          Quelle sperren
                        </Button>
                      )}
                    </div>
                  ),
                )}
              </div>
            ))
          )}
        </div>
      )}
    </Section>
  );
}
