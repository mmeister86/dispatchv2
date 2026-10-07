import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { authClient, demoMode } from "@/lib/auth-client";
import { useStore } from "@/lib/store";
import { useGithubSourceProofClock } from "@/lib/github-source-proof";
import { editorialActionError } from "@/lib/editorial-mapping";
import { currentVersion, type Draft } from "@/lib/model";
import { Button } from "@/components/ui/button";
import { Section, Status } from "@/components/shared";

// A single mounted exact scope owns the original closure/args, including its immutable key.
export function useNativeCommand(scope: string, until: number | null = null) {
  const mounted = useRef(false),
    epoch = useRef(0),
    lastScope = useRef(scope),
    ticket = useRef<object | null>(null),
    latestUntil = useRef(until);
  if (lastScope.current !== scope) {
    lastScope.current = scope;
    epoch.current++;
    ticket.current = null;
  }
  latestUntil.current = until;
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [retry, setRetry] = useState<(() => Promise<unknown>) | null>(null),
    [conflict, setConflict] = useState(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      ticket.current = null;
      epoch.current++;
    };
  }, []);
  useEffect(() => {
    setBusy(false);
    setError("");
    setRetry(null);
    setConflict(false);
  }, [scope]);
  const expired = until !== null && until <= Date.now();
  useEffect(() => {
    if (expired) {
      epoch.current++;
      ticket.current = null;
      setBusy(false);
      setRetry(null);
      setError("");
    }
  }, [expired]);
  async function execute(call: () => Promise<unknown>) {
    if (ticket.current || !mounted.current || expired) return false;
    const owner = {},
      generation = epoch.current,
      originalUntil = until;
    const valid = () =>
      mounted.current &&
      ticket.current === owner &&
      epoch.current === generation &&
      (originalUntil === null || originalUntil > Date.now()) &&
      (latestUntil.current === null || latestUntil.current > Date.now());
    ticket.current = owner;
    setBusy(true);
    setError("");
    try {
      await call();
      if (!valid()) return false;
      setRetry(null);
      setConflict(false);
      return true;
    } catch (e) {
      if (valid()) {
        setError(
          e instanceof ConvexError
            ? editorialActionError(e)
            : "Antwort ungewiss. Der ursprüngliche Auftrag bleibt unverändert.",
        );
        setRetry(e instanceof ConvexError ? null : () => call);
        setConflict(e instanceof ConvexError);
      }
      return false;
    } finally {
      if (valid()) {
        ticket.current = null;
        setBusy(false);
      }
    }
  }
  return {
    busy,
    error,
    retry,
    conflict,
    execute,
    locked: busy || !!retry || conflict || expired,
    reviewCurrent: () => {
      setConflict(false);
      setError("");
    },
  };
}
function CommandFeedback({
  operation,
}: {
  operation: ReturnType<typeof useNativeCommand>;
}) {
  return (
    <>
      {operation.error && (
        <p role="alert" className="text-sm break-words">
          {operation.error}
        </p>
      )}
      {operation.retry && (
        <Button
          variant="outline"
          disabled={operation.busy}
          onClick={() => void operation.execute(operation.retry!)}
        >
          Denselben Auftrag wiederholen
        </Button>
      )}
      {operation.conflict && (
        <Button
          variant="outline"
          disabled={operation.busy}
          onClick={operation.reviewCurrent}
        >
          Aktuellen Stand prüfen
        </Button>
      )}
    </>
  );
}
export function NativeAssignment({
  draft,
  disabled,
}: {
  draft: Draft;
  disabled: boolean;
}) {
  const { state, members, assignDraft, nativeScope } = useStore();
  const v = currentVersion(draft),
    clock = useGithubSourceProofClock(
      v.sourceProofUntil !== undefined
        ? [
            {
              authorized: !v.sourceUnavailable,
              proofExpiresAt: v.sourceProofUntil,
            },
          ]
        : [],
    );
  const until = v.sourceProofUntil ?? null;
  const op = useNativeCommand(
    `${nativeScope}:${draft.id}:${draft.currentVersionId}:${!v.sourceUnavailable}`,
    until,
  );
  const [recipient, setRecipient] = useState(draft.assignee ?? ""),
    [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!dirty) setRecipient(draft.assignee ?? "");
  }, [draft.assignee, dirty]);
  return (
    <div className="stack text-sm">
      <label>
        <span className="field-label">
          Zuständig · Revision {draft.assignmentRevision ?? 0}
        </span>
        <select
          className="native-select"
          value={recipient}
          disabled={disabled || op.busy}
          onChange={(e) => {
            setRecipient(e.target.value);
            setDirty(true);
          }}
        >
          <option value="">Nicht zugewiesen</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} · {m.role}
            </option>
          ))}
        </select>
      </label>
      <Button
        variant="outline"
        disabled={
          disabled ||
          op.locked ||
          v.sourceUnavailable ||
          (v.sourceProofUntil !== undefined && v.sourceProofUntil <= clock) ||
          state.role === "Viewer"
        }
        onClick={() => {
          const original = structuredClone(draft),
            target = recipient,
            key = crypto.randomUUID();
          void op
            .execute(() => assignDraft(original, target, key))
            .then((ok) => {
              if (ok) setDirty(false);
            });
        }}
      >
        Zuständigkeit speichern
      </Button>
      <CommandFeedback operation={op} />
    </div>
  );
}
export function NativeReview({
  versionId,
  accountId,
  disabled = false,
  readOnly = false,
  sourceUntil = null,
}: {
  versionId: string;
  accountId: string;
  disabled?: boolean;
  readOnly?: boolean;
  sourceUntil?: number | null;
}) {
  const { state, nativeScope } = useStore(),
    { data: session } = authClient.useSession();
  const result = useQuery(
    api.editorial.reviews.get,
    !demoMode && !disabled && versionId
      ? {
          workspaceId: state.activeWorkspaceId as Id<"workspaces">,
          versionId: versionId as Id<"draftVersions">,
        }
      : "skip",
  );
  const review =
    result?.authId === session?.user.id &&
    result?.sessionId === session?.session.id
      ? result
      : undefined;
  const horizons = [sourceUntil, review?.sourceUntil].filter(
      (n): n is number => n !== null && n !== undefined,
    ),
    until = horizons.length ? Math.min(...horizons) : null;
  const clock = useGithubSourceProofClock(
    until !== null ? [{ authorized: !disabled, proofExpiresAt: until }] : [],
  );
  const op = useNativeCommand(
    `${nativeScope}:${versionId}:${accountId}:${disabled}`,
    until,
  );
  const decide = useMutation(api.editorial.reviews.decide),
    withdraw = useMutation(api.editorial.reviews.withdraw),
    request = useMutation(api.editorial.reviews.request);
  if (demoMode) return null;
  if (disabled || (until !== null && until <= clock))
    return (
      <p role="status" className="text-sm">
        Review für diese Quelle nicht verfügbar.
      </p>
    );
  if (!review)
    return (
      <p role="status" className="text-sm">
        Exakte Review-Regel wird geladen …
      </p>
    );
  return (
    <section className="stack mb-4 text-sm" aria-label="Native Reviews">
      <p className="text-xs muted break-all">
        Version {versionId} · Account {accountId || "nicht gewählt"} · Regel{" "}
        {review.policyId ?? "OFF"} · Revision {review.revision}
      </p>
      {!review.editorial && !review.brand && (
        <p>
          Optionale Reviews sind aus. Die abschließende Freigabe bleibt
          Owner/Admin vorbehalten.
        </p>
      )}
      {(["editorial", "brand"] as const)
        .filter((stage) => review[stage])
        .map((stage) => {
          const decisionId =
              stage === "editorial"
                ? review.editorialDecisionId
                : review.brandDecisionId,
            allowed =
              state.role === "Owner" ||
              state.role === "Admin" ||
              (stage === "editorial" && state.role === "Editor");
          return (
            <div key={stage} className="flex flex-wrap items-center gap-2">
              <Status>
                {stage === "editorial" ? "Redaktion" : "Marke"}:{" "}
                {decisionId ? "Bestätigt" : "Offen"}
              </Status>
              <Button
                size="sm"
                variant="outline"
                disabled={
                  readOnly ||
                  op.locked ||
                  !allowed ||
                  !!decisionId ||
                  (stage === "brand" &&
                    review.editorial &&
                    !review.editorialDecisionId)
                }
                onClick={() => {
                  const args = {
                    workspaceId: state.activeWorkspaceId as Id<"workspaces">,
                    versionId: versionId as Id<"draftVersions">,
                    stage,
                    policyId: review.policyId,
                    expectedRevision: review.revision,
                    commandKey: crypto.randomUUID(),
                  };
                  void op.execute(() => decide(args));
                }}
              >
                {stage === "editorial" ? "Redaktionelles" : "Marken-"} Review
                bestätigen
              </Button>
              {decisionId && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={readOnly || op.locked || !allowed}
                  onClick={() => {
                    const args = {
                      workspaceId: state.activeWorkspaceId as Id<"workspaces">,
                      decisionId,
                      expectedRevision: review.revision,
                      commandKey: crypto.randomUUID(),
                    };
                    void op.execute(() => withdraw(args));
                  }}
                >
                  Review zurückziehen
                </Button>
              )}
              {!decisionId && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={readOnly || op.locked || state.role === "Viewer"}
                  onClick={() => {
                    const args = {
                      workspaceId: state.activeWorkspaceId as Id<"workspaces">,
                      versionId: versionId as Id<"draftVersions">,
                      stage,
                      policyId: review.policyId,
                      expectedRevision: review.revision,
                      commandKey: crypto.randomUUID(),
                    };
                    void op.execute(() => request(args));
                  }}
                >
                  Zuständige Person um Review bitten
                </Button>
              )}
            </div>
          );
        })}
      <CommandFeedback operation={op} />
    </section>
  );
}
export function NativeReviewQueue() {
  const { state, members, hasMoreDrafts, loadMoreDrafts, draftCoverage } =
    useStore();
  const [recipient, setRecipient] = useState("all");
  const drafts = state.drafts.filter(
      (d) => d.workspaceId === state.activeWorkspaceId,
    ),
    rows = drafts.filter(
      (d) => recipient === "all" || d.assignee === recipient,
    );
  return (
    <Section
      title="Review-Queue"
      description={`${drafts.length} geladene Entwürfe · ${hasMoreDrafts ? "weitere Seiten verfügbar" : "Ende der geladenen Übersicht"}`}
    >
      <label className="mb-4 block">
        <span className="field-label">Zuständig in geladenen Einträgen</span>
        <select
          className="native-select"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
        >
          <option value="all">Alle geladenen Einträge</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </label>
      {draftCoverage === "LoadingFirstPage" && (
        <p role="status">Entwürfe werden geladen …</p>
      )}
      <ul className="divide-y">
        {rows.map((d) => {
          const v = currentVersion(d),
            r = d.nativeReview,
            unavailable = v.sourceUnavailable || !r;
          return (
            <li key={d.id} className="py-4 stack text-sm">
              <strong>
                {unavailable ? "Quelle nicht verfügbar" : d.title}
              </strong>
              <p className="text-xs muted break-all">
                v{v.number} · Account {d.accountId || "nicht gewählt"} ·{" "}
                {members.find((m) => m.id === d.assignee)?.name ??
                  "Nicht zugewiesen"}
              </p>
              <p>
                {unavailable
                  ? "Review nicht verfügbar"
                  : r.approvalId
                    ? "Aktuell zur Planung freigegeben"
                    : r.approvalsLimited
                      ? "Freigabe in begrenzter Historie nicht belegt"
                      : (r.editorial && !r.editorialDecisionId) ||
                          (r.brand && !r.brandDecisionId)
                        ? "Wartet auf aktiviertes Review"
                        : "Wartet auf abschließende Freigabe"}
              </p>
              <Button size="sm" variant="outline" asChild>
                <Link to={`/drafts/${d.id}`}>Exakte Version prüfen</Link>
              </Button>
            </li>
          );
        })}
      </ul>
      {!rows.length && draftCoverage !== "LoadingFirstPage" && (
        <p>
          Keine passenden Einträge auf den geladenen Seiten.
          {hasMoreDrafts
            ? " Weitere Seiten können passende Einträge enthalten."
            : ""}
        </p>
      )}
      {hasMoreDrafts && (
        <Button variant="outline" onClick={loadMoreDrafts}>
          Weitere Entwürfe laden
        </Button>
      )}
      {draftCoverage === "LoadingMore" && (
        <p role="status">Weitere Seite wird geladen …</p>
      )}
    </Section>
  );
}
export function NativeReviewPolicies() {
  const { state, nativeScope } = useStore(),
    [scope, setScope] = useState("workspace");
  return (
    <Section
      title="Review-Regeln"
      description="Optionale exakte Reviews vor der abschließenden Owner/Admin-Freigabe."
    >
      <label>
        <span className="field-label">Geltungsbereich</span>
        <select
          className="native-select"
          value={scope}
          onChange={(e) => setScope(e.target.value)}
        >
          <option value="workspace">Workspace-Standard</option>
          {state.accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.handle}
            </option>
          ))}
        </select>
      </label>
      <PolicyForm
        key={`${nativeScope}:${scope}`}
        accountId={scope === "workspace" ? null : scope}
      />
    </Section>
  );
}
function PolicyForm({ accountId }: { accountId: string | null }) {
  const { state, nativeScope } = useStore(),
    response = useQuery(api.editorial.reviews.policy, {
      workspaceId: state.activeWorkspaceId as Id<"workspaces">,
      accountId: accountId as Id<"socialAccounts"> | null,
    });
  const configure = useMutation(api.editorial.reviews.configure),
    op = useNativeCommand(`${nativeScope}:${accountId}`);
  const [editorial, setEditorial] = useState(false),
    [brand, setBrand] = useState(false),
    [inherit, setInherit] = useState(false),
    [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (response && !dirty) {
      setEditorial(response.editorial);
      setBrand(response.brand);
      setInherit(!!accountId && !response.policyId);
    }
  }, [response, dirty, accountId]);
  if (!response) return <p role="status">Review-Regel wird geladen …</p>;
  const allowed = state.role === "Owner" || state.role === "Admin";
  return (
    <form
      className="stack mt-4 text-sm"
      onSubmit={(e) => {
        e.preventDefault();
        const args = {
          workspaceId: state.activeWorkspaceId as Id<"workspaces">,
          accountId: accountId as Id<"socialAccounts"> | null,
          expectedRevision: response.revision,
          commandKey: crypto.randomUUID(),
          policy: inherit ? null : { editorial, brand },
        };
        void op
          .execute(() => configure(args))
          .then((ok) => {
            if (ok) setDirty(false);
          });
      }}
    >
      {accountId && (
        <label className="flex gap-2">
          <input
            type="checkbox"
            checked={inherit}
            disabled={!allowed || op.busy}
            onChange={(e) => {
              setInherit(e.target.checked);
              setDirty(true);
            }}
          />
          Workspace-Standard erben
        </label>
      )}
      <label className="flex gap-2">
        <input
          type="checkbox"
          checked={editorial}
          disabled={!allowed || inherit || op.busy}
          onChange={(e) => {
            setEditorial(e.target.checked);
            setDirty(true);
          }}
        />
        Redaktionelles Review
      </label>
      <label className="flex gap-2">
        <input
          type="checkbox"
          checked={brand}
          disabled={!allowed || inherit || op.busy}
          onChange={(e) => {
            setBrand(e.target.checked);
            setDirty(true);
          }}
        />
        Marken-Review
      </label>
      <p className="text-xs muted">
        {inherit
          ? "Der aktuelle Workspace-Standard gilt."
          : !editorial && !brand
            ? "Explizit OFF: keine optionalen Stufen."
            : "Redaktion → Marke → abschließende Freigabe. Dieselbe berechtigte Person darf mehrere Stufen erfüllen."}
      </p>
      <Button variant="outline" disabled={!allowed || op.locked}>
        Review-Regel speichern
      </Button>
      <CommandFeedback operation={op} />
    </form>
  );
}
export function NativeNoticeInbox({
  onOpen,
  indicator = false,
}: {
  onOpen?: () => void;
  indicator?: boolean;
}) {
  const { state, nativeScope } = useStore(),
    { data: session } = authClient.useSession();
  const list = usePaginatedQuery(
    api.editorial.notices.list,
    { workspaceId: state.activeWorkspaceId as Id<"workspaces"> },
    { initialNumItems: 25 },
  );
  const read = useMutation(api.editorial.notices.read),
    dismiss = useMutation(api.editorial.notices.dismiss);
  const clock = useGithubSourceProofClock(
    list.results.flatMap((n) =>
      n.sourceUntil === null
        ? []
        : [{ authorized: true, proofExpiresAt: n.sourceUntil }],
    ),
  );
  const rows = list.results.filter(
      (n) =>
        n.authId === session?.user.id &&
        n.sessionId === session?.session.id &&
        (n.sourceUntil === null || n.sourceUntil > clock),
    ),
    op = useNativeCommand(
      nativeScope,
      Math.min(...rows.map((n) => n.sourceUntil ?? Infinity)) === Infinity
        ? null
        : Math.min(...rows.map((n) => n.sourceUntil ?? Infinity)),
    );
  const unread = rows.filter((n) => n.readAt === null);
  if (indicator)
    return unread.length ? (
      <span
        className="absolute right-2 top-2 size-1.5 rounded-full bg-primary"
        aria-label="Ungelesene Hinweise in geladenen Einträgen"
      />
    ) : null;
  return (
    <section className="stack" aria-label="Persönliche native Hinweise">
      <p className="text-xs muted">
        {unread.length} ungelesene Hinweise in {rows.length} geladenen Einträgen
        ·{" "}
        {list.status === "Exhausted" ? "geladenes Ende" : "begrenzte Übersicht"}
      </p>
      {list.status === "LoadingFirstPage" && (
        <p role="status">Persönliche Hinweise werden geladen …</p>
      )}
      {rows.map((n) => (
        <div className="border-b pb-4 stack text-sm" key={n.id}>
          <strong>
            {n.parent.kind === "assignment"
              ? "Entwurf zugewiesen"
              : n.parent.kind === "request"
                ? "Review angefordert"
                : n.parent.kind === "decision"
                  ? n.parent.withdrawn
                    ? "Review zurückgezogen"
                    : "Review bestätigt"
                  : n.parent.revoked
                    ? "Freigabe widerrufen"
                    : "Version freigegeben"}
          </strong>
          <p className="text-xs muted break-all">
            Exakte Version {n.versionId} · Account{" "}
            {n.accountId ?? "nicht gewählt"} ·{" "}
            {n.readAt === null ? "Neu" : "Gelesen"}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link to={`/drafts/${n.draftId}`} onClick={onOpen}>
                Entwurf prüfen
              </Link>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={op.locked || n.readAt !== null}
              onClick={() => {
                const args = {
                  workspaceId: state.activeWorkspaceId as Id<"workspaces">,
                  noticeIds: [n.id],
                };
                void op.execute(() => read(args));
              }}
            >
              Als gelesen markieren
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={op.locked}
              onClick={() => {
                const args = {
                  workspaceId: state.activeWorkspaceId as Id<"workspaces">,
                  noticeIds: [n.id],
                };
                void op.execute(() => dismiss(args));
              }}
            >
              Ausblenden
            </Button>
          </div>
        </div>
      ))}
      {!rows.length && list.status !== "LoadingFirstPage" && (
        <p>Keine persönlichen Hinweise auf den geladenen Seiten.</p>
      )}
      {!!unread.length && (
        <Button
          variant="ghost"
          disabled={op.locked}
          onClick={() => {
            const args = {
              workspaceId: state.activeWorkspaceId as Id<"workspaces">,
              noticeIds: unread.slice(0, 25).map((n) => n.id),
            };
            void op.execute(() => read(args));
          }}
        >
          Geladene Hinweise als gelesen markieren (max. 25)
        </Button>
      )}
      {list.status === "CanLoadMore" && (
        <Button variant="outline" onClick={() => list.loadMore(25)}>
          Weitere Hinweise laden
        </Button>
      )}
      <CommandFeedback operation={op} />
    </section>
  );
}

export function NativeCommentResolution({
  draft,
  commentId,
  versionNumber,
  resolved,
  unavailable,
}: {
  draft: Draft;
  commentId: string;
  versionNumber: number;
  resolved: boolean;
  unavailable: boolean;
}) {
  const { state, nativeScope } = useStore();
  const version = draft.versions.find((v) => v.number === versionNumber),
    until = version?.sourceProofUntil ?? null,
    clock = useGithubSourceProofClock(
      until === null ? [] : [{ authorized: true, proofExpiresAt: until }],
    ),
    op = useNativeCommand(
      `${nativeScope}:${draft.id}:${version?.id}:${commentId}:${unavailable}`,
      until,
    ),
    resolve = useMutation(api.editorial.resolveComment);
  return (
    <div className="stack text-sm">
      <Button
        variant="ghost"
        size="sm"
        disabled={
          unavailable ||
          !version ||
          version.sourceUnavailable ||
          state.role === "Viewer" ||
          op.locked ||
          (until !== null && until <= clock)
        }
        onClick={() => {
          const args = {
            workspaceId: state.activeWorkspaceId as Id<"workspaces">,
            commentId: commentId as Id<"editorialComments">,
            expectedResolved: resolved,
          };
          void op.execute(() => resolve(args));
        }}
      >
        {resolved ? "Wieder öffnen" : "Als erledigt markieren"}
      </Button>
      <CommandFeedback operation={op} />
    </div>
  );
}
