import { useStore } from "@/lib/store";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType, FunctionArgs } from "convex/server";
import { useEffect, useRef, useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
type Proposals = NonNullable<
  FunctionReturnType<typeof api.intelligence.assessments.get>["recommendations"]
>;
type Review = FunctionArgs<typeof api.intelligence.recommendations.compare>;
type Comparison = NonNullable<
  FunctionReturnType<typeof api.intelligence.recommendations.compare>
>;
export function Recommendations({
  proposals,
  workspaceId,
  accountId,
  draftId,
  draftVersionId,
  allowed,
  mediaIds,
}: {
  proposals: Proposals;
  workspaceId: Id<"workspaces">;
  accountId: Id<"socialAccounts">;
  draftId: Id<"drafts">;
  draftVersionId: Id<"draftVersions">;
  allowed: boolean;
  mediaIds: string[];
}) {
  const { state } = useStore();
  const mediaName = (id: string | undefined, position: number) => {
    const asset = state.media.find(
      (m) => m.id === id && m.workspaceId === workspaceId,
    );
    return `${asset?.type === "video" ? "Video" : "Bild / Medium"} ${position + 1}${asset?.name ? ` · ${asset.name}` : ""}`;
  };
  const [choice, setChoice] = useState<{
    candidateIndex: number;
    tokenIndices: number[];
    alt: string;
  } | null>(null);
  const [review, setReview] = useState<{
    args: Review;
    operationKey: string;
  } | null>(null);
  const [frozen, setFrozen] = useState<Comparison | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false),
    mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const compare = useQuery(
    api.intelligence.recommendations.compare,
    review && allowed ? review.args : "skip",
  );
  const adopt = useMutation(api.intelligence.recommendations.adopt);
  useEffect(() => {
    if (compare && !frozen) setFrozen(compare);
  }, [compare, frozen]);
  const currentReview =
    !!review &&
    review.args.proof === proposals.proof &&
    review.args.assessmentId === proposals.assessmentId &&
    review.args.revision === proposals.revision;
  const canAccept =
    allowed &&
    currentReview &&
    !!frozen &&
    !!compare &&
    JSON.stringify(compare) === JSON.stringify(frozen) &&
    !busy;
  const accept = async () => {
    if (!canAccept || !review || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      await adopt({ ...review.args, operationKey: review.operationKey });
      // The reactive saved version is applied by Composer only if its buffer is still clean.
      if (mounted.current) {
        setReview(null);
        setFrozen(null);
        setChoice(null);
      }
    } catch {
      if (mounted.current)
        setError(
          "Übernahme nicht bestätigt. Vergleich bleibt offen; erneut versuchen verwendet denselben Vorgang. Bei geändertem Stand zuerst die gespeicherte Version prüfen.",
        );
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const item = choice ? proposals.candidates[choice.candidateIndex] : null;
  return (
    <div className="mt-5 border-t pt-4">
      <h4 className="text-sm font-semibold">Redaktionelle Empfehlungen</h4>
      <p className="text-xs muted">
        Exakte Struktur- und Barrierefreiheitsbefunde · {proposals.ruleVersion}.
        Redaktionelle Reihenfolge, keine vorhergesagte Scoresteigerung. Keine
        semantische Umschreibung.
      </p>
      {!proposals.candidates.length && (
        <p className="text-xs">
          Keine unterstützte konkrete Änderung gefunden. Inhalt und Medien bei
          Bedarf manuell bearbeiten.
        </p>
      )}
      {proposals.candidates.map((c, i) => (
        <div
          key={`${proposals.proof}:${i}`}
          className="mt-3 rounded-lg border p-3 text-xs"
        >
          <p>
            {c.kind === "duplicate"
              ? `Segment ${c.segment + 1}: Ein nichtleerer Absatz ist direkt byte-identisch wiederholt. Nur die zweite Wiederholung entfernen; Wiederholung kann beabsichtigt sein.`
              : c.kind === "tokens"
                ? `Segment ${c.segment + 1}: Mehr als drei Hashtags oder Erwähnungen im eigenen abschließenden Tokenabsatz. Zu entfernende Verknüpfungen selbst auswählen; keine Bewertung ihrer Relevanz.`
                : `${mediaName(mediaIds[c.mediaIndex], c.mediaIndex)}: Alt-Text fehlt. Eine eigene Beschreibung eingeben; das Bild wird nicht interpretiert.`}
          </p>
          <Button
            size="sm"
            variant="outline"
            disabled={!allowed || busy}
            onClick={() => {
              setChoice({ candidateIndex: i, tokenIndices: [], alt: "" });
              setReview(null);
              setFrozen(null);
              setError("");
            }}
          >
            Änderung auswählen {i + 1}
          </Button>
        </div>
      ))}
      {choice && item && !review && (
        <div className="mt-3 rounded-lg border p-3 text-xs">
          {item.kind === "tokens" && (
            <>
              <p>
                Entfernte Hashtags verlieren ihre Verknüpfung; entfernte
                Erwähnungen verlieren Empfänger-/Zuordnungsbezug. Inhaltliche
                Bedeutung selbst prüfen.
              </p>
              {item.tokens.map((t, i) => (
                <label key={i} className="mr-3 inline-flex gap-1">
                  <input
                    type="checkbox"
                    checked={choice.tokenIndices.includes(i)}
                    onChange={(e) =>
                      setChoice({
                        ...choice,
                        tokenIndices: e.target.checked
                          ? [...choice.tokenIndices, i].sort((a, b) => a - b)
                          : choice.tokenIndices.filter((n) => n !== i),
                      })
                    }
                  />
                  {t.text}
                </label>
              ))}
            </>
          )}
          {item.kind === "alt" && (
            <label>
              Eigener Alt-Text für{" "}
              {mediaName(mediaIds[item.mediaIndex], item.mediaIndex)}
              <textarea
                className="native-input mt-2 w-full"
                maxLength={1000}
                value={choice.alt}
                onChange={(e) => setChoice({ ...choice, alt: e.target.value })}
              />
            </label>
          )}
          <Button
            className="mt-3"
            size="sm"
            disabled={
              !allowed ||
              (item.kind === "tokens" && !choice.tokenIndices.length) ||
              (item.kind === "alt" && !choice.alt.trim())
            }
            onClick={() => {
              setFrozen(null);
              setError("");
              setReview({
                args: {
                  workspaceId,
                  accountId,
                  draftId,
                  draftVersionId,
                  assessmentId: proposals.assessmentId,
                  revision: proposals.revision,
                  proof: proposals.proof,
                  ruleVersion: proposals.ruleVersion,
                  ...choice,
                },
                operationKey: crypto.randomUUID(),
              });
            }}
          >
            Vollständigen Vergleich öffnen
          </Button>
        </div>
      )}
      <Dialog
        modal={false}
        open={!!review}
        onOpenChange={(open) => {
          if (!open && !pending.current) {
            setReview(null);
            setFrozen(null);
          }
        }}
      >
        <DialogContent
          onInteractOutside={(event) => event.preventDefault()}
          className="max-h-[90vh] overflow-y-auto sm:max-w-4xl"
        >
          <DialogHeader>
            <DialogTitle>Redaktionelle Änderung vergleichen</DialogTitle>
            <DialogDescription>
              Vollständiger eingefrorener Thread und Medienstand. Eine Übernahme
              erstellt eine neue, nicht freigegebene Version. Geplante Inhalte
              bleiben bestehen. Weitere Empfehlungen benötigen eine neue Analyse
              und einen neuen Vergleich. Entfernte Hashtags verlieren ihre
              Verknüpfung; entfernte Erwähnungen verlieren
              Empfänger-/Zuordnungsbezug. Diese Bedeutung selbst prüfen.
            </DialogDescription>
          </DialogHeader>
          {frozen ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {(["before", "after"] as const).map((side) => (
                <div key={side}>
                  <h3>{side === "before" ? "Vorher" : "Nachher"}</h3>
                  <p className="text-xs">
                    {frozen[side].title} · {frozen[side].pillar} ·{" "}
                    {frozen[side].strategy}
                  </p>
                  {frozen[side].text.map((text, i) => (
                    <div key={i} className="mt-3 rounded border p-3">
                      <h4 className="text-xs muted">Segment {i + 1}</h4>
                      <p className="whitespace-pre-wrap break-words text-sm">
                        {text || "(leer)"}
                      </p>
                    </div>
                  ))}
                  <h4 className="mt-3 text-xs">
                    Medien ({frozen[side].media.length})
                  </h4>
                  {frozen[side].media.map((m, i) => (
                    <div
                      key={`${i}:${m.assetId}`}
                      className="mt-2 rounded border p-2 text-xs"
                    >
                      <p>{mediaName(m.assetId, i)}</p>
                      <details>
                        <summary>Mediennachweis</summary>
                        {m.assetId}
                      </details>
                      <p className="whitespace-pre-wrap break-words">
                        Alt: {m.alt || "(fehlt)"}
                      </p>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <p role="status">
              {compare === null
                ? "Vergleich nicht mehr anwendbar. Aktuelle Version erneut analysieren."
                : "Vergleich wird geprüft …"}
            </p>
          )}
          {(!allowed || !currentReview || compare === null) && (
            <p role="status" className="text-xs">
              Übernahme gesperrt: Änderungen, Rechte, Quelle oder
              Bewertungsstand zuerst prüfen.
            </p>
          )}
          {error && (
            <p role="alert" className="text-xs">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                setReview(null);
                setFrozen(null);
              }}
            >
              Vergleich schließen
            </Button>
            <Button disabled={!canAccept} onClick={() => void accept()}>
              {busy
                ? "Übernahme wird bestätigt …"
                : "Als neue Version übernehmen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
