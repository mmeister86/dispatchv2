import { Component, type ReactNode, useEffect, useRef, useState } from "react";
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
    ticket = useRef<{ until: number | null } | null>(null),
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
  const pendingUntil = ticket.current?.until ?? null,
    clock = useGithubSourceProofClock(
      pendingUntil === null
        ? []
        : [{ authorized: true, proofExpiresAt: pendingUntil }],
    ),
    expired = until !== null && until <= clock,
    pendingExpired = pendingUntil !== null && pendingUntil <= clock;
  useEffect(() => {
    if (expired || pendingExpired) {
      epoch.current++;
      ticket.current = null;
      setBusy(false);
      setRetry(null);
      setError("");
      setConflict(false);
    }
  }, [expired, pendingExpired]);
  async function execute(call: () => Promise<unknown>) {
    if (ticket.current || !mounted.current || expired) return false;
    const owner = { until },
      generation = epoch.current,
      originalUntil = until;
    const owned = () =>
      mounted.current &&
      ticket.current === owner &&
      epoch.current === generation;
    const valid = () =>
      owned() &&
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
      if (owned()) {
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
    return (
      <>
        {unread.length ? (
          <span
            className="absolute right-2 top-2 size-1.5 rounded-full bg-primary"
            aria-label="Ungelesene Hinweise in geladenen Einträgen"
          />
        ) : null}
        <ResearchSummaryInbox key={`research:${nativeScope}`} indicator />
        <PublishingInbox key={nativeScope} indicator />
        <GithubAttention key={`github:${nativeScope}`} indicator />
      </>
    );
  return (
    <>
      <section className="stack" aria-label="Persönliche native Hinweise">
        <p className="text-xs muted">
          {unread.length} ungelesene Hinweise in {rows.length} geladenen
          Einträgen ·{" "}
          {list.status === "Exhausted"
            ? "geladenes Ende"
            : "begrenzte Übersicht"}
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
      <ResearchSummaryInbox key={`research:${nativeScope}`} />
      <PublishingInbox key={nativeScope} onOpen={onOpen} />
      <GithubAttention key={`github:${nativeScope}`} onOpen={onOpen} />
    </>
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

class PublishingInboxBoundary extends Component<
  { children: ReactNode; retry: () => void; indicator: boolean },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      this.props.indicator ? null : (
        <section aria-label="Publishing-Hinweise" className="stack">
          <p role="alert">Publishing-Hinweise sind derzeit nicht verfügbar.</p>
          <Button variant="outline" onClick={this.props.retry}>
            Publishing-Hinweise erneut laden
          </Button>
        </section>
      )
    ) : (
      this.props.children
    );
  }
}
function PublishingInbox({
  indicator = false,
  onOpen,
}: {
  indicator?: boolean;
  onOpen?: () => void;
}) {
  const fresh = () => {
    try {
      return crypto.randomUUID();
    } catch {
      return null;
    }
  };
  const [key, setKey] = useState<string | null>(fresh);
  if (!key)
    return indicator ? null : (
      <section aria-label="Publishing-Hinweise" className="stack">
        <p role="alert">Publishing-Hinweise sind derzeit nicht verfügbar.</p>
        <Button variant="outline" onClick={() => setKey(fresh())}>
          Publishing-Hinweise erneut laden
        </Button>
      </section>
    );
  return (
    <PublishingInboxBoundary
      key={key}
      retry={() => setKey(fresh())}
      indicator={indicator}
    >
      <PublishingInboxPage
        requestKey={key}
        indicator={indicator}
        onOpen={onOpen}
      />
    </PublishingInboxBoundary>
  );
}
function PublishingInboxPage({
  requestKey,
  indicator,
  onOpen,
}: {
  requestKey: string;
  indicator: boolean;
  onOpen?: () => void;
}) {
  const { state, nativeScope } = useStore(),
    { data: session } = authClient.useSession();
  const authId = session?.user.id ?? "",
    sessionId = session?.session.id ?? "";
  const list = usePaginatedQuery(
    api.publishing.notices.list,
    {
      workspaceId: state.activeWorkspaceId as Id<"workspaces">,
      expectedAuthId: authId,
      requestKey,
    },
    { initialNumItems: 25 },
  );
  const read = useMutation(api.publishing.notices.read),
    dismiss = useMutation(api.publishing.notices.dismiss);
  const clock = useGithubSourceProofClock(
    list.results.flatMap((n) =>
      n.sourceUntil === null
        ? []
        : [{ authorized: true, proofExpiresAt: n.sourceUntil }],
    ),
  );
  const rows = list.results.filter(
    (n) =>
      n.authId === authId &&
      n.sessionId === sessionId &&
      n.workspaceId === state.activeWorkspaceId &&
      n.requestKey === requestKey &&
      n.dismissedAt === null &&
      (n.sourceUntil === null || n.sourceUntil > clock),
  );
  const until = Math.min(...rows.map((n) => n.sourceUntil ?? Infinity));
  const op = useNativeCommand(
      nativeScope,
      Number.isFinite(until) ? until : null,
    ),
    unread = rows.filter((n) => n.readAt === null);
  function change(ids: Id<"publishingNotifications">[], hide: boolean) {
    void op.execute(async () => {
      const key = crypto.randomUUID();
      const args = {
        workspaceId: state.activeWorkspaceId as Id<"workspaces">,
        expectedAuthId: authId,
        requestKey: key,
        noticeIds: ids,
      };
      const result = await (hide ? dismiss(args) : read(args));
      if (
        result.authId !== authId ||
        result.sessionId !== sessionId ||
        result.requestKey !== key
      )
        throw Error("NOTICE_UNAVAILABLE");
    });
  }
  if (indicator)
    return unread.length ? (
      <span
        className="absolute right-2 top-2 size-1.5 rounded-full bg-primary"
        aria-label="Ungelesene Publishing-Hinweise in geladenen Einträgen"
      />
    ) : null;
  return (
    <section
      className="stack"
      aria-label="Publishing-Hinweise"
      data-testid="publishing-inbox"
    >
      <p className="text-xs muted">
        {unread.length} ungelesene Publishing-Hinweise in {rows.length}{" "}
        geladenen Einträgen. Nur geladene berechtigte Einträge; weitere Anzahl
        unbekannt.
      </p>
      {list.status === "LoadingFirstPage" && (
        <p role="status">Publishing-Hinweise werden geladen …</p>
      )}
      {rows.map((n) => (
        <div key={n.id} className="border-b pb-4 stack text-sm">
          <strong>Publishing-Hinweis: benötigt Aufmerksamkeit</strong>
          <p className="text-xs muted">
            {n.readAt === null ? "Neu" : "Gelesen"}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link to={`/drafts/${n.draftId}`} onClick={onOpen}>
                Publishing-Entwurf prüfen
              </Link>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={op.locked || n.readAt !== null}
              className="h-auto max-w-full whitespace-normal py-2"
              onClick={() => change([n.id], false)}
            >
              Publishing-Hinweis als gelesen markieren
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={op.locked}
              onClick={() => change([n.id], true)}
              className="h-auto max-w-full whitespace-normal py-2"
            >
              Publishing-Hinweis ausblenden
            </Button>
          </div>
        </div>
      ))}
      {!rows.length && list.status !== "LoadingFirstPage" && (
        <p>Keine Publishing-Hinweise auf den geladenen Seiten.</p>
      )}
      {!!unread.length && (
        <Button
          variant="ghost"
          disabled={op.locked}
          className="h-auto max-w-full whitespace-normal py-2"
          onClick={() =>
            change(
              unread.slice(0, 25).map((n) => n.id),
              false,
            )
          }
        >
          Geladene Publishing-Hinweise als gelesen markieren (max. 25)
        </Button>
      )}
      {list.status === "CanLoadMore" && (
        <Button variant="outline" onClick={() => list.loadMore(25)}>
          Weitere Publishing-Seite laden
        </Button>
      )}
      <CommandFeedback operation={op} />
    </section>
  );
}

class GithubAttentionBoundary extends Component<
  { children: ReactNode; retry: () => void; indicator: boolean },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <GithubAttentionUnavailable
        indicator={this.props.indicator}
        retry={this.props.retry}
      />
    ) : (
      this.props.children
    );
  }
}
function GithubAttentionUnavailable({
  indicator,
  retry,
}: {
  indicator: boolean;
  retry: () => void;
}) {
  return indicator ? null : (
    <section className="stack" aria-label="GitHub-Aufmerksamkeit">
      <p role="alert">GitHub-Hinweise sind derzeit nicht verfügbar.</p>
      <Button variant="outline" onClick={retry}>
        GitHub-Hinweise erneut laden
      </Button>
    </section>
  );
}
function GithubAttention({
  indicator = false,
  onOpen,
}: {
  indicator?: boolean;
  onOpen?: () => void;
}) {
  const { state, nativeScope } = useStore(),
    { data: session } = authClient.useSession();
  const scope = `${nativeScope}:${session?.user.id}:${session?.session.id}:${state.activeWorkspaceId}:${state.role}`;
  if (
    demoMode ||
    !nativeScope ||
    nativeScope === "unavailable" ||
    nativeScope === "demo" ||
    !session?.user.id ||
    !session?.session.id ||
    !["Owner", "Admin"].includes(state.role)
  )
    return null;
  return (
    <GithubAttentionRequest key={scope} indicator={indicator} onOpen={onOpen} />
  );
}
function GithubAttentionRequest({
  indicator,
  onOpen,
}: {
  indicator: boolean;
  onOpen?: () => void;
}) {
  const fresh = () => {
    try {
      return crypto.randomUUID();
    } catch {
      return null;
    }
  };
  const [key, setKey] = useState<string | null>(fresh);
  const retry = () => setKey(fresh());
  if (!key)
    return <GithubAttentionUnavailable indicator={indicator} retry={retry} />;
  return (
    <GithubAttentionBoundary key={key} retry={retry} indicator={indicator}>
      <GithubAttentionPage
        refreshKey={key}
        renew={retry}
        indicator={indicator}
        onOpen={onOpen}
      />
    </GithubAttentionBoundary>
  );
}
function GithubAttentionPage({
  refreshKey,
  renew,
  indicator,
  onOpen,
}: {
  refreshKey: string;
  renew: () => void;
  indicator: boolean;
  onOpen?: () => void;
}) {
  const { state } = useStore(),
    { data: session } = authClient.useSession();
  const response = useQuery(api.operations.githubAlerts.get, {
    workspaceId: state.activeWorkspaceId as Id<"workspaces">,
    expectedAuthId: session!.user.id,
    refreshKey,
  });
  const clock = useGithubSourceProofClock(
    response
      ? [{ authorized: true, proofExpiresAt: response.data.validUntil }]
      : [],
  );
  useEffect(() => {
    const deadline = response?.data.validUntil,
      now = Date.now();
    const timer = setTimeout(
      renew,
      typeof deadline === "number" &&
        Number.isFinite(deadline) &&
        deadline > now
        ? Math.min(30000, deadline - now)
        : 30000,
    );
    return () => clearTimeout(timer);
  }, [refreshKey, response?.data.validUntil]);
  const data =
    response &&
    response.authId === session?.user.id &&
    response.sessionId === session?.session.id &&
    response.workspaceId === state.activeWorkspaceId &&
    response.refreshKey === refreshKey &&
    Number.isFinite(response.data.observedAt) &&
    response.data.observedAt <= clock &&
    Number.isFinite(response.data.validUntil) &&
    response.data.validUntil > clock &&
    response.data.validUntil <= response.data.observedAt + 30000
      ? response.data
      : null;
  if (indicator)
    return data?.rows.length ? (
      <span
        className="absolute right-2 top-2 size-1.5 rounded-full bg-primary"
        aria-label="GitHub benötigt Aufmerksamkeit in geladenen Einträgen"
      />
    ) : null;
  return (
    <section
      className="stack"
      aria-label="GitHub-Aufmerksamkeit"
      data-testid="github-attention"
    >
      <p className="text-xs muted">
        {data?.rows.length ?? 0} geladene GitHub-Hinweise; weitere Anzahl
        unbekannt.
      </p>
      {!data && <p role="status">GitHub-Hinweise werden geladen …</p>}
      {data?.rows.map((row) => (
        <div key={row.id} className="border-b pb-4 stack text-sm">
          <strong>GitHub benötigt Aufmerksamkeit</strong>
          <p>
            Die lokale Verarbeitung einer GitHub-Lieferung ist nicht belegt.
          </p>
          <Button size="sm" variant="outline" asChild>
            <Link to="/signals" onClick={onOpen}>
              GitHub-Signale prüfen
            </Link>
          </Button>
        </div>
      ))}
    </section>
  );
}

class ResearchSummaryBoundary extends Component<
  { children: ReactNode; indicator: boolean },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      this.props.indicator ? null : (
        <p role="alert">Research-Abschlüsse sind derzeit nicht verfügbar.</p>
      )
    ) : (
      this.props.children
    );
  }
}
function ResearchSummaryInbox({ indicator = false }: { indicator?: boolean }) {
  const { nativeScope } = useStore();
  const [requestKey] = useState(() => {
    try {
      return crypto.randomUUID();
    } catch {
      return null;
    }
  });
  if (!requestKey)
    return indicator ? null : (
      <p role="alert">Research-Abschlüsse sind derzeit nicht verfügbar.</p>
    );
  return (
    <ResearchSummaryBoundary
      key={`${nativeScope}:${requestKey}`}
      indicator={indicator}
    >
      <ResearchSummaryRows requestKey={requestKey} indicator={indicator} />
    </ResearchSummaryBoundary>
  );
}
function ResearchSummaryRows({
  requestKey,
  indicator,
}: {
  requestKey: string;
  indicator: boolean;
}) {
  const { state, nativeScope } = useStore(),
    session = authClient.useSession(),
    authId = session.data?.user.id,
    sessionId = session.data?.session.id;
  const workspaceId = state.activeWorkspaceId as Id<"workspaces">;
  const data = useQuery(
    api.preferences.researchSummaries,
    !demoMode && !session.isPending && authId && sessionId
      ? {
          workspaceId,
          expectedAuthId: authId,
          expectedSessionId: sessionId,
          requestKey,
        }
      : "skip",
  );
  const dismiss = useMutation(api.preferences.dismissResearchSummaries);
  const valid =
    !!data &&
    data.authId === authId &&
    data.sessionId === sessionId &&
    data.workspaceId === workspaceId &&
    data.requestKey === requestKey &&
    nativeScope ===
      `${authId}:${sessionId}:${workspaceId}:${state.activeAccountId}:${state.role}`;
  const clock = useGithubSourceProofClock(
    valid
      ? data.rows.map((r) => ({
          authorized: true,
          proofExpiresAt: r.proofUntil,
        }))
      : [],
  );
  const rows = valid ? data.rows.filter((r) => r.proofUntil > clock) : [];
  const until = rows.length ? Math.min(...rows.map((r) => r.proofUntil)) : null;
  const op = useNativeCommand(`${nativeScope}:${requestKey}`, until);
  if (indicator)
    return rows.length ? (
      <span
        className="absolute right-2 top-2 size-1.5 rounded-full bg-primary"
        aria-label="Eigene Research-Abschlüsse in begrenzter Auswahl"
      />
    ) : null;
  return (
    <section
      className="stack mt-4 border-t pt-4"
      aria-label="Eigene Research-Abschlüsse"
    >
      <strong>Eigene Research-Abschlüsse</strong>
      <p className="text-xs muted">
        Höchstens fünf ursprüngliche Abschlüsse. Weitere Abdeckung unbekannt.
      </p>
      {rows.map((r) => (
        <div
          className="stack border-b pb-4 text-sm"
          key={`${r.orderId}:${r.generation}:${r.finishedAt}`}
        >
          <strong>
            {r.outcome === "completed"
              ? "Research abgeschlossen"
              : r.outcome === "partial"
                ? "Research teilweise abgeschlossen"
                : r.outcome === "empty"
                  ? "Research ohne Material"
                  : r.outcome === "configuration_required"
                    ? "Research benötigt Konfiguration"
                    : r.outcome === "budget_exhausted"
                      ? "Research-Budget ausgeschöpft"
                      : "Research ohne erfolgreichen Materialabschluss"}
          </strong>
          <p className="text-xs muted break-all">
            Account {r.accountId} ·{" "}
            {new Date(r.finishedAt).toLocaleString("de-DE")}
          </p>
          <Button
            size="sm"
            variant="ghost"
            disabled={op.locked}
            onClick={() => {
              if (!authId) return;
              const args = {
                workspaceId,
                expectedAuthId: authId,
                expectedSessionId: sessionId!,
                requestKey,
                observed: [
                  {
                    orderId: r.orderId,
                    generation: r.generation,
                    finishedAt: r.finishedAt,
                  },
                ],
              };
              void op.execute(() => dismiss(args));
            }}
          >
            Abschluss ausblenden
          </Button>
        </div>
      ))}
      {!rows.length && (
        <p role="status">
          {data
            ? "Keine eigenen Research-Abschlüsse in der aktuellen Auswahl."
            : "Eigene Research-Abschlüsse werden geladen …"}
        </p>
      )}
      <CommandFeedback operation={op} />
    </section>
  );
}
