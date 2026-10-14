import { NativeReview } from "./review";
import { authClient } from "@/lib/auth-client";
import { useGithubSourceProofClock } from "@/lib/github-source-proof";
import { useEffect, useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { Schedule } from "@/lib/model";
import { useStore } from "@/lib/store";
import { canApprove } from "@/lib/model";
import { editorialActionError, publishingError } from "@/lib/editorial-mapping";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

export function PublishingRecovery({ schedule }: { schedule: Schedule }) {
  const { state, nativeScope, cancelSchedule } = useStore();
  const scope = useRef(nativeScope),
    epoch = useRef(0);
  if (scope.current !== nativeScope) {
    scope.current = nativeScope;
    epoch.current++;
  }
  const args = {
    workspaceId: schedule.workspaceId as Id<"workspaces">,
    scheduleId: schedule.id as Id<"schedules">,
  };
  const inspection = useQuery(api.publishing.reconcile.inspect, args);
  const { data: session } = authClient.useSession();
  const response = useQuery(api.editorial.reviews.get, {
    workspaceId: args.workspaceId,
    versionId: schedule.versionId as Id<"draftVersions">,
  });
  const review =
    response?.authId === session?.user.id &&
    response?.sessionId === session?.session.id
      ? response
      : null;
  const until = Math.min(
      schedule.sourceProofUntil ?? Infinity,
      review?.sourceUntil ?? Infinity,
    ),
    proofClock = useGithubSourceProofClock(
      Number.isFinite(until)
        ? [{ authorized: true, proofExpiresAt: until }]
        : [],
    ),
    latestUntil = useRef(until);
  latestUntil.current = until;
  const reviewReady =
    !!review &&
    (!review.editorial || !!review.editorialDecisionId) &&
    (!review.brand || !!review.brandDecisionId) &&
    until > proofClock;
  const lookup = useAction(api.publishing.reconcile.lookup),
    continueThread = useMutation(api.publishing.reconcile.continueThread),
    finalizeAbort = useMutation(api.publishing.reconcile.finalizeAbort);
  const [candidates, setCandidates] = useState<Record<number, string>>({}),
    [pending, setPending] = useState(false),
    [ack, setAck] = useState(false),
    [feedback, setFeedback] = useState("");
  const mounted = useRef(true),
    generation = useRef(schedule.generation);
  generation.current = schedule.generation;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    setAck(false);
  }, [schedule.generation, state.activeWorkspaceId]);
  useEffect(() => {
    if (!reviewReady) setAck(false);
  }, [reviewReady]);
  const allowed =
    canApprove(state.role) && state.activeWorkspaceId === schedule.workspaceId;
  const unknown = inspection?.positions.some((p) => p.stage === "unknown");
  const permanent = inspection?.positions.some(
    (p) => p.errorCode === "X_POST_PERMANENT_REJECTION",
  );
  const [clock, setClock] = useState(Date.now());
  useEffect(() => {
    const next = Math.min(
      ...(inspection?.positions
        .map((p) => p.notBefore ?? 0)
        .filter((at) => at > clock) ?? []),
    );
    if (!Number.isFinite(next)) return;
    const timer = setTimeout(
      () => setClock(Date.now()),
      Math.min(Math.max(0, next - Date.now() + 1), 2147483647),
    );
    return () => clearTimeout(timer);
  }, [inspection, clock]);
  const execute = async (
    position?: number,
    abort: "request" | "finalize" | false = false,
    confirmedId?: string,
  ) => {
    if (pending) return;
    const expectedGeneration = schedule.generation!,
      originalScope = nativeScope,
      originalEpoch = epoch.current,
      originalUntil = until;
    const current = () =>
      mounted.current &&
      scope.current === originalScope &&
      epoch.current === originalEpoch &&
      generation.current === expectedGeneration &&
      Math.min(originalUntil, latestUntil.current) > Date.now();
    setPending(true);
    setFeedback("");
    setAck(false);
    try {
      const target = { ...args, expectedGeneration };
      if (abort === "request") {
        const ok = await cancelSchedule(schedule);
        if (current())
          setFeedback(
            ok
              ? "Abbruch angefordert. Ungeklärte Ergebnisse bleiben gesperrt und müssen lesend abgeglichen werden."
              : "Abbruch konnte nicht gespeichert werden. Das Ergebnis und deine Eingabe bleiben erhalten; Fehlermeldung prüfen.",
          );
      } else if (abort === "finalize") {
        await finalizeAbort(target);
        if (current())
          setFeedback(
            "Der gespeicherte Abbruch wurde anhand der bekannten Ergebnisse abgeschlossen.",
          );
      } else if (position !== undefined) {
        const result = await lookup({
          ...target,
          position,
          candidateId:
            confirmedId ??
            candidates[position] ??
            schedule.externalPosts?.find((p) => p.position === position)
              ?.externalId ??
            "",
        });
        if (current())
          setFeedback(
            result === "confirmed"
              ? "Dieser Beitrag wurde bestätigt. Eine Fortsetzung benötigt eine eigene sichtbare Bestätigung."
              : "Ausgang weiterhin ungeklärt. Nicht erneut senden. ID, Account und Originalbeitrag prüfen oder den Auftrag abbrechen; ein fehlender Treffer beweist keine Abwesenheit.",
          );
      } else {
        await continueThread(target);
        if (current())
          setFeedback(
            "Die unveränderte Snapshot-Version wurde neu freigegeben. Nur ausstehende Beiträge werden ausgeführt.",
          );
      }
    } catch (e) {
      if (current()) setFeedback(editorialActionError(e));
    } finally {
      // Re-enable controls while mounted even if the command bumped the schedule generation.
      if (mounted.current) setPending(false);
    }
  };
  return (
    <section
      className="mt-3 min-w-0 space-y-3 rounded-md border p-3 text-sm break-words"
      aria-label="Veröffentlichung abgleichen und fortsetzen"
    >
      <NativeReview
        versionId={schedule.versionId!}
        accountId={schedule.accountId}
        disabled={!!schedule.sourceUnavailable}
        sourceUntil={schedule.sourceProofUntil ?? null}
      />
      <p className="text-xs">
        Snapshot v{schedule.version} ·{" "}
        {state.accounts.find((a) => a.id === schedule.accountId)?.handle}.
        Medien und freigegebener Alt-Text bleiben am ersten Beitrag. Bestätigte
        Beiträge werden nicht wiederholt.
      </p>
      {inspection?.positions.map((p) => (
        <div key={p.position} className="space-y-2">
          <p className="text-xs">
            Beitrag {p.position + 1}:{" "}
            {p.stage === "confirmed"
              ? "Bestätigt veröffentlicht"
              : p.stage === "unknown"
                ? "Ausgang ungeklärt"
                : p.stage === "rejected"
                  ? "Definitiv abgelehnt"
                  : "Noch nicht gesendet"}
          </p>
          {p.notBefore && (
            <p className="text-xs">
              Frühestens erneut prüfen oder freigeben:{" "}
              {new Date(p.notBefore).toLocaleString()}.
            </p>
          )}
          {p.stage === "unknown" && (
            <>
              <label className="block text-xs">
                Kandidaten-ID oder X-Link für Beitrag {p.position + 1}
                <Input
                  value={candidates[p.position] ?? ""}
                  maxLength={200}
                  disabled={pending || !allowed}
                  onChange={(e) =>
                    setCandidates({
                      ...candidates,
                      [p.position]: e.target.value,
                    })
                  }
                />
              </label>
              <p className="text-xs muted">
                Originalbeitrag in X öffnen und seine ID oder den Link kopieren.
                Dispatch liest nur diesen Kandidaten und veröffentlicht beim
                Abgleich nichts.
              </p>
              <Button
                variant="outline"
                disabled={
                  pending ||
                  !allowed ||
                  !(candidates[p.position] ?? "") ||
                  Boolean(p.notBefore && p.notBefore > Date.now())
                }
                onClick={() => void execute(p.position)}
              >
                {pending
                  ? "Abgleich läuft …"
                  : `Beitrag ${p.position + 1} nur lesend abgleichen`}
              </Button>
            </>
          )}
        </div>
      ))}
      {!inspection && <p role="status">Ergebnis wird geladen …</p>}
      {unknown && (
        <p className="text-xs">
          Ungeklärte Positionen blockieren die Fortsetzung. 404, gelöschte
          Beiträge und Zeitüberschreitungen sind kein Beleg dafür, dass nichts
          veröffentlicht wurde.
        </p>
      )}
      {inspection &&
      !inspection.aborted &&
      !unknown &&
      schedule.status === "uncertain" &&
      schedule.externalPosts?.length ? (
        <Button
          variant="outline"
          disabled={pending || !allowed}
          onClick={() => {
            const post = schedule.externalPosts!.at(-1)!;
            void execute(post.position, false, post.externalId);
          }}
        >
          Gespeichertes Ergebnis bestätigen
        </Button>
      ) : null}
      {inspection?.aborted ? (
        <div className="space-y-2">
          <p className="text-xs">
            Der Abbruch bleibt gespeichert. Der Abgleich kann vorhandene
            Beiträge bestätigen; dieser Auftrag wird nicht fortgesetzt.
          </p>
          {!unknown && schedule.status !== "cancelled" ? (
            <Button
              variant="outline"
              disabled={pending || !allowed}
              onClick={() => void execute(undefined, "finalize")}
            >
              Abbruch abschließen
            </Button>
          ) : null}
        </div>
      ) : (
        <>
          <Button
            variant="outline"
            disabled={pending || !allowed || !inspection}
            onClick={() => void execute(undefined, "request")}
          >
            Auftrag abbrechen
          </Button>
          {!state.accounts.find((a) => a.id === schedule.accountId)?.capability
            ?.publish && (
            <p className="text-xs">
              Der aktuelle X-Schreibzugang ist unbelegt. Die sichtbare
              Fortsetzung ist eine erneute Erst-Schreibverifikation
              ausschließlich der offenen Beiträge.
            </p>
          )}
          <label className="flex items-center gap-2 text-xs">
            <Checkbox
              checked={ack}
              disabled={
                pending ||
                !allowed ||
                !inspection ||
                !reviewReady ||
                unknown ||
                permanent
              }
              onCheckedChange={(v) => setAck(v === true)}
              aria-label="Sichtbare Fortsetzung bestätigen"
            />
            Sichtbare Fortsetzung bestätigen: dieselbe Version neu freigeben und
            nur offene Beiträge jetzt auf X veröffentlichen.
          </label>
          <Button
            disabled={
              pending ||
              !allowed ||
              !inspection ||
              !reviewReady ||
              unknown ||
              permanent ||
              !ack ||
              inspection.positions.every((p) => p.stage === "confirmed") ||
              inspection.positions.some((p) =>
                Boolean(p.notBefore && p.notBefore > Date.now()),
              )
            }
            className="max-w-full h-auto whitespace-normal py-2"
            onClick={() => void execute()}
          >
            {pending
              ? "Befehl wird ausgeführt …"
              : "Unveränderten Thread ausdrücklich fortsetzen"}
          </Button>
        </>
      )}
      {feedback && (
        <p role="status" className="text-xs">
          {feedback}
        </p>
      )}
    </section>
  );
}
