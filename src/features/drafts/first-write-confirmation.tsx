import { NativeReview } from "./review";
import { useGithubSourceProofClock } from "@/lib/github-source-proof";
import { useEffect, useRef, useState } from "react";
import { PublishingRecovery } from "./publishing-recovery";
import { Link } from "react-router-dom";
import { useStore } from "@/lib/store";
import { demoMode } from "@/lib/auth-client";
import {
  canApprove,
  currentVersion,
  draftValid,
  reviewComplete,
  reviewStageSourceUntil,
} from "@/lib/model";
import type { Draft, Schedule } from "@/lib/model";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export function FirstWriteConfirmation({
  draft,
  disabled,
}: {
  draft: Draft;
  disabled: boolean;
}) {
  const { state, nativeScope, approveFirstWrite, confirmFirstWrite } =
    useStore();
  const scope = useRef(nativeScope);
  const epoch = useRef(0);
  if (scope.current !== nativeScope) {
    scope.current = nativeScope;
    epoch.current++;
  }
  const [open, setOpen] = useState(false),
    [pending, setPending] = useState(false),
    [approvalId, setApprovalId] = useState<string | null>(null),
    [ack, setAck] = useState(false),
    [error, setError] = useState("");
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const version = currentVersion(draft),
    account = state.accounts.find((a) => a.id === draft.accountId);
  const proofUntil = reviewStageSourceUntil(draft),
    approval = draft.approvals?.find((a) => a.id === approvalId),
    until = Math.min(
      proofUntil ?? Infinity,
      approval?.expiresAt ?? Infinity,
      approval?.reviewPin?.sourceUntil ?? Infinity,
    ),
    approvalUsable =
      !!approval &&
      !approval.revokedAt &&
      approval.purpose === "first_write_verification" &&
      approval.versionId === version.id &&
      approval.accountId === draft.accountId &&
      (approval.reviewPin?.sourceUntil ?? Infinity) > Date.now() &&
      (approval.expiresAt ?? 0) > Date.now(),
    clock = useGithubSourceProofClock(
      Number.isFinite(until)
        ? [{ authorized: true, proofExpiresAt: until }]
        : [],
    ),
    currentUntil = useRef(until);
  currentUntil.current = until;
  useEffect(() => {
    if (until <= clock) {
      setAck(false);
      setApprovalId(null);
    }
  }, [until, clock]);
  if (
    demoMode ||
    !account ||
    account.channel !== "X" ||
    account.capability?.publish ||
    !account.connected
  )
    return null;
  const active = state.schedules.find(
    (s) =>
      s.accountId === account.id &&
      ["scheduled", "publishing", "uncertain", "partial"].includes(s.status),
  );
  const eligible =
    canApprove(state.role) &&
    draft.workspaceId === state.activeWorkspaceId &&
    draftValid(draft, state.accounts, state.media) &&
    !disabled &&
    until > clock &&
    reviewComplete(draft) &&
    !active;
  return (
    <section className="mb-4 rounded-md border p-4 text-sm">
      <NativeReview
        versionId={version.id!}
        accountId={draft.accountId}
        sourceUntil={reviewStageSourceUntil(draft)}
        disabled={!!version.sourceUnavailable}
      />

      <p>
        Der X-Schreibzugang ist noch nicht belegt. Die Erstveröffentlichung
        erstellt einen sichtbaren Beitrag: Inhalt freigeben und anschließend
        separat bestätigen.
      </p>
      {active && (
        <p role="status">
          Für diesen Account läuft bereits eine Veröffentlichung oder ein
          Abgleich ist erforderlich.{" "}
          <Link to="/calendar?view=agenda" className="underline">
            Ergebnis im Kalender prüfen
          </Link>
          .
        </p>
      )}
      <Button
        variant="outline"
        disabled={!eligible}
        onClick={() => {
          setOpen(true);
          setError("");
        }}
      >
        Ersten X-Beitrag veröffentlichen
      </Button>
      {open && (
        <Dialog
          open={open}
          onOpenChange={(o) => {
            if (!pending) {
              setOpen(o);
              setAck(false);
            }
          }}
        >
          <DialogContent className="sm:max-w-xl [&>*]:min-w-0 max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Erstveröffentlichung auf X</DialogTitle>
              <DialogDescription>
                Dies veröffentlicht jetzt sichtbare Inhalte auf {account.handle}
                . Version {version.number} wird unverändert gesendet. Alle
                Medien gehören zum ersten Beitrag; spätere Antworten enthalten
                nur Text.
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-72 space-y-3 overflow-auto rounded-md border p-3">
              <strong>
                {draft.title} · v{version.number} · {account.handle}
              </strong>
              {version.text.map((text, i) => (
                <p key={i} className="whitespace-pre-wrap text-sm">
                  <span className="block text-xs muted">Beitrag {i + 1}</span>
                  {text}
                </p>
              ))}
              {(version.media ?? []).map((m) => (
                <p key={m.assetId} className="text-xs">
                  {state.media.find((a) => a.id === m.assetId)?.name ??
                    m.assetId}{" "}
                  · Alt-Text: {m.alt}
                </p>
              ))}
            </div>
            <p className="text-xs muted">
              Ein bestätigter API-Beitrag belegt den normalen Schreibzugang. Bei
              unklarem Ausgang wird angehalten und kein Beitrag automatisch
              wiederholt.
            </p>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            {approvalId && (
              <label className="flex items-start gap-2 text-sm">
                <Checkbox
                  checked={ack}
                  disabled={pending || !eligible}
                  onCheckedChange={(checked) => setAck(checked === true)}
                  aria-label="Sichtbare Veröffentlichung bestätigen"
                />
                <span>
                  Ich bestätige die sichtbare Veröffentlichung genau dieser
                  Version auf {account.handle}.
                </span>
              </label>
            )}
            <DialogFooter>
              {!approvalId ? (
                <Button
                  className="h-auto whitespace-normal py-2"
                  disabled={pending || !eligible}
                  onClick={async () => {
                    const originalScope = nativeScope,
                      originalEpoch = epoch.current,
                      originalUntil = until;
                    setPending(true);
                    setError("");
                    const id = await approveFirstWrite(draft);
                    if (
                      !mounted.current ||
                      scope.current !== originalScope ||
                      epoch.current !== originalEpoch ||
                      Math.min(originalUntil, currentUntil.current) <=
                        Date.now()
                    )
                      return;
                    setPending(false);
                    if (id) setApprovalId(id);
                    else
                      setError(
                        "Freigabe konnte nicht gespeichert werden. Die angezeigte Version bleibt erhalten; Details der Fehlermeldung prüfen.",
                      );
                  }}
                >
                  {pending
                    ? "Freigabe wird gespeichert …"
                    : "Diesen Inhalt für Erstveröffentlichung freigeben"}
                </Button>
              ) : (
                <Button
                  className="h-auto whitespace-normal py-2"
                  disabled={pending || !eligible || !approvalUsable || !ack}
                  onClick={async () => {
                    const originalScope = nativeScope,
                      originalEpoch = epoch.current,
                      originalUntil = until;
                    setPending(true);
                    setError("");
                    const ok = await confirmFirstWrite(draft, approvalId);
                    if (
                      !mounted.current ||
                      scope.current !== originalScope ||
                      epoch.current !== originalEpoch ||
                      Math.min(originalUntil, currentUntil.current) <=
                        Date.now()
                    )
                      return;
                    setPending(false);
                    if (ok) {
                      setOpen(false);
                      setAck(false);
                    } else
                      setError(
                        "Veröffentlichung konnte nicht gestartet werden. Eingabe bleibt erhalten; vorhandenes Ergebnis und Fehlermeldung prüfen.",
                      );
                  }}
                >
                  {pending
                    ? "Start wird bestätigt …"
                    : "Jetzt sichtbar veröffentlichen und Zugang belegen"}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </section>
  );
}
export function PublishingResults({ schedules }: { schedules: Schedule[] }) {
  return (
    <div className="mb-4 space-y-3">
      {schedules
        .filter((s) => s.status !== "scheduled")
        .slice(-3)
        .reverse()
        .map((s) => (
          <details
            key={s.id}
            className="rounded-md border p-3"
            open={s.status !== "published" && s.status !== "cancelled"}
          >
            <summary className="cursor-pointer text-sm">
              Snapshot v{s.version} · {s.publishedCount}/{s.text.length}{" "}
              bestätigt ·{" "}
              {s.status === "uncertain"
                ? "Abgleich erforderlich"
                : s.status === "published"
                  ? "Veröffentlicht"
                  : s.status === "publishing"
                    ? "Veröffentlichung läuft"
                    : s.status === "partial"
                      ? "Teilweise veröffentlicht"
                      : s.status === "cancelled"
                        ? "Storniert"
                        : "Angehalten"}
            </summary>
            {s.error && (
              <p role="status" className="mt-2 text-sm">
                {s.error}
              </p>
            )}
            {s.text.map((text, position) => {
              const post = s.externalPosts?.find(
                (p) => p.position === position,
              );
              return (
                <div key={position} className="mt-3">
                  <p className="mb-1 whitespace-pre-wrap text-sm">
                    {position + 1}. {text}
                  </p>
                  {post && (
                    <a
                      href={post.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs underline"
                    >
                      Bestätigter X-Beitrag {post.externalId}
                    </a>
                  )}
                </div>
              );
            })}
            {s.media?.map((m) => (
              <p key={m.assetId} className="mt-2 text-xs">
                Medium am ersten Beitrag · Alt-Text: {m.alt}
              </p>
            ))}
            {["uncertain", "partial", "failed"].includes(s.status) && (
              <PublishingRecovery
                key={`${s.id}:${s.workspaceId}`}
                schedule={s}
              />
            )}
          </details>
        ))}
    </div>
  );
}
