import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { useMutation, useQuery, usePaginatedQuery } from "convex/react";
import { DeletionProgress } from "@/features/settings/data-controls";
import { useLocation } from "react-router-dom";
import {
  draftView,
  scheduleView,
  editorialActionError,
  editorialContent,
  type ContentInput,
} from "./editorial-mapping";
import {
  editDraft,
  approveDraft,
  revokeDraftApproval,
  replaceScheduledVersion,
  scheduleDraft,
} from "./model";
import { api } from "../../convex/_generated/api";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { useGithubSourceProofClock } from "./github-source-proof";
import type { Id } from "../../convex/_generated/dataModel";
import { authClient, demoMode } from "./auth-client";
import { toast } from "sonner";
import {
  createSeed,
  uid,
  now,
  type AppState,
  type Draft,
  type Idea,
  type Preferences,
  type Workspace,
} from "./model";
const KEY = "dispatch-demo-v1";
export function readState(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (
        s.schemaVersion === 1 &&
        [
          s.workspaces,
          s.accounts,
          s.drafts,
          s.schedules,
          s.ideas,
          s.media,
        ].every(Array.isArray) &&
        // preferences.name feeds .slice() in App.tsx and timezone feeds
        // Intl/formatDate call sites; fall back to seed unless both are strings.
        typeof s.preferences?.name === "string" &&
        typeof s.preferences?.timezone === "string" &&
        // currentVersion() throws on drafts without versions (Overview review
        // filter); Schedule.at is required for the upcoming sort comparator.
        s.drafts.every(
          (d: { versions?: unknown }) =>
            Array.isArray(d?.versions) && d.versions.length > 0,
        ) &&
        s.schedules.every((x: { at?: unknown }) => typeof x?.at === "string")
      )
        return s;
    }
  } catch {
    /* Invalid local demo data resets safely. */
  }
  return createSeed();
}
export type SaveDraftInput = ContentInput & {
  draftId: string;
  expectedRevision: number;
  reason?: string;
};
const Context = createContext<{
  members: { id: string; role: string; name: string }[];
  addComment: (draft: Draft, text: string) => Promise<boolean>;
  resolveComment: (id: string, expectedResolved: boolean) => Promise<boolean>;
  assignDraft: (
    draft: Draft,
    userId: string,
    commandKey?: string,
  ) => Promise<boolean>;
  nativeScope: string;
  draftCoverage: string;
  saveDraft: (input: SaveDraftInput) => Promise<boolean>;
  approveVersion: (draft: Draft) => Promise<boolean>;
  approveFirstWrite: (draft: Draft) => Promise<string | null>;
  confirmFirstWrite: (draft: Draft, approvalId: string) => Promise<boolean>;
  revokeApproval: (draft: Draft) => Promise<boolean>;
  replaceSchedule: (
    draft: Draft,
    schedule: import("./model").Schedule,
  ) => Promise<boolean>;
  planVersion: (
    draft: Draft,
    at: string,
    timezone: string,
    localTime: string,
    schedule?: import("./model").Schedule,
  ) => Promise<boolean>;
  cancelSchedule: (schedule: import("./model").Schedule) => Promise<boolean>;
  selectAccount: (id: string) => boolean;
  loadMoreVersions: () => void;
  hasMoreVersions: boolean;
  loadMoreMedia: () => void;
  hasMoreMedia: boolean;
  loadMoreDrafts: () => void;
  resourcesLimited: boolean;
  hasMoreDrafts: boolean;
  events: { id: string; code: string; at: string }[];
  notifications: { id: string; state: string; errorCode: string | null }[];
  state: AppState;
  setState: (update: React.SetStateAction<AppState>) => boolean;
  mutate: (fn: (s: AppState) => AppState, message?: string) => boolean;
  createDraft: (
    title: string,
    text?: string,
    source?: string,
    accountId?: string,
  ) => Promise<string>;
  ideaToDraft: (idea: Idea) => Promise<string>;
  reset: () => void;
  onboardingStep: number;
  saveProfile: (
    preferences: Preferences,
    project?: Pick<Workspace, "name" | "description">,
    step?: number,
  ) => Promise<boolean>;
  selectWorkspace: (id: string) => Promise<boolean>;
  createWorkspace: (name: string) => Promise<boolean>;
} | null>(null);
function DemoStoreProvider({ children }: { children: ReactNode }) {
  const [state, setMemoryState] = useState<AppState>(readState);
  const latest = useRef(state);
  const commit = useCallback((next: AppState) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
      latest.current = next;
      setMemoryState(next);
      return true;
    } catch {
      toast.error(
        "Lokaler Speicher ist voll. Änderung wurde nicht gespeichert. Große Medien entfernen oder Daten exportieren.",
      );
      return false;
    }
  }, []);
  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) commit(latest.current);
    } catch {
      /* Storage failures are reported when a user attempts to save. */
    }
  }, [commit]);
  const setState = useCallback<
    (update: React.SetStateAction<AppState>) => boolean
  >(
    (update) => {
      return commit(
        typeof update === "function" ? update(latest.current) : update,
      );
    },
    [commit],
  );
  const mutate = useCallback(
    (fn: (s: AppState) => AppState, message?: string) => {
      try {
        if (!commit(fn(latest.current))) return false;
        if (message) toast.success(message);
        return true;
      } catch (e) {
        toast.error(
          e instanceof Error
            ? e.message
            : "Aktion konnte nicht ausgeführt werden.",
        );
        return false;
      }
    },
    [commit],
  );
  const makeDraft = (
    title: string,
    text = "",
    source = "Manuelle Notiz",
    accountId = latest.current.activeAccountId,
  ) => {
    const state = latest.current;
    const id = uid("draft");
    if (state.role === "Viewer") {
      toast.error("Viewer können keine Entwürfe erstellen.");
      return "";
    }
    const draft: Draft = {
      id,
      title,
      workspaceId: state.activeWorkspaceId,
      accountId,
      pillar: "Building in public",
      versions: [
        {
          number: 1,
          text: [text],
          mediaIds: [],
          createdAt: now(),
          reason: "Erster Entwurf",
        },
      ],
      comments: [],
      strategy: "generic",
      source,
      reviewPolicy: state.reviewPolicies?.[state.activeWorkspaceId],
    };
    return draft;
  };
  const createDraft = async (
    title: string,
    text = "",
    source = "Manuelle Notiz",
    accountId?: string,
  ) => {
    const draft = makeDraft(title, text, source, accountId);
    return draft && mutate((s) => ({ ...s, drafts: [draft, ...s.drafts] }))
      ? draft.id
      : "";
  };
  const ideaToDraft = async (idea: Idea) => {
    const existing = latest.current.ideas.find(
      (i) => i.id === idea.id,
    )?.draftId;
    if (existing) return existing;
    const draft = makeDraft(idea.title, idea.description, idea.source);
    return draft &&
      mutate((s) => ({
        ...s,
        drafts: [draft, ...s.drafts],
        ideas: s.ideas.map((i) =>
          i.id === idea.id
            ? { ...i, status: "accepted", draftId: draft.id }
            : i,
        ),
      }))
      ? draft.id
      : "";
  };
  return (
    <Context.Provider
      value={{
        state,
        members: [],
        addComment: async (d, text) =>
          mutate((s) => ({
            ...s,
            drafts: s.drafts.map((x) =>
              x.id === d.id
                ? {
                    ...x,
                    comments: [
                      ...x.comments,
                      {
                        id: uid("comment"),
                        version: d.versions.at(-1)!.number,
                        text,
                        author: s.preferences.name,
                        resolved: false,
                      },
                    ],
                  }
                : x,
            ),
          })),
        resolveComment: async (id, _) =>
          mutate((s) => ({
            ...s,
            drafts: s.drafts.map((d) => ({
              ...d,
              comments: d.comments.map((c) =>
                c.id === id ? { ...c, resolved: !c.resolved } : c,
              ),
            })),
          })),
        assignDraft: async (d, userId) =>
          mutate((s) => editDraft(s, d.id, { assignee: userId })),
        saveDraft: async (a) =>
          mutate((s) =>
            editDraft(
              s,
              a.draftId,
              {
                title: a.title,
                accountId: a.accountId,
                pillar: a.pillar,
                strategy: a.strategy,
              },
              a.text,
              a.mediaIds,
              a.reason,
            ),
          ),
        approveVersion: async (d) => mutate((s) => approveDraft(s, d.id)),
        approveFirstWrite: async () => null,
        confirmFirstWrite: async () => false,
        revokeApproval: async (d) =>
          mutate((s) => revokeDraftApproval(s, d.id)),
        replaceSchedule: async (_, x) =>
          mutate((s) => replaceScheduledVersion(s, x.id)),
        planVersion: async (d, at, _, __, x) =>
          mutate((s) =>
            x
              ? {
                  ...s,
                  schedules: s.schedules.map((q) =>
                    q.id === x.id ? { ...q, at } : q,
                  ),
                }
              : scheduleDraft(s, d.id, at),
          ),
        cancelSchedule: async (x) =>
          mutate((s) => ({
            ...s,
            schedules: s.schedules.map((q) =>
              q.id === x.id ? { ...q, status: "cancelled" } : q,
            ),
          })),
        selectAccount: (id) => setState((s) => ({ ...s, activeAccountId: id })),
        loadMoreVersions: () => {},
        hasMoreVersions: false,
        loadMoreMedia: () => {},
        hasMoreMedia: false,
        loadMoreDrafts: () => {},
        hasMoreDrafts: false,
        resourcesLimited: false,
        events: [],
        nativeScope: "demo",
        draftCoverage: "Demo",
        notifications: [],
        setState,
        mutate,
        createDraft,
        ideaToDraft,
        onboardingStep: 0,
        saveProfile: async (preferences, project) =>
          setState((s) => ({
            ...s,
            preferences,
            workspaces: project
              ? s.workspaces.map((w) =>
                  w.id === s.activeWorkspaceId ? { ...w, ...project } : w,
                )
              : s.workspaces,
          })),
        selectWorkspace: async (id) =>
          setState((s) => ({
            ...s,
            activeWorkspaceId: id,
            activeAccountId:
              s.accounts.find((a) => a.workspaceId === id)?.id ?? "",
          })),
        createWorkspace: async (name) =>
          setState((s) => ({
            ...s,
            workspaces: [
              ...s.workspaces,
              { id: uid("ws"), name, description: "" },
            ],
          })),
        reset: () => {
          mutate(() => createSeed(), "Demo-Daten zurückgesetzt.");
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}

export const emptyState: AppState = {
  schemaVersion: 1,
  workspaces: [],
  activeWorkspaceId: "",
  activeAccountId: "",
  role: "Viewer",
  accounts: [],
  drafts: [],
  schedules: [],
  ideas: [],
  media: [],
  preferences: {
    name: "",
    timezone: "Europe/Berlin",
    language: "Deutsch",
    audience: "",
    tone: "",
    topics: "",
    onboardingDone: false,
  },
};
function unavailable() {
  toast.error(
    "Diese Funktion ist noch nicht mit dem Backend verbunden. Es wurde nichts gespeichert.",
  );
  return false;
}
const emptyContext = {
  state: emptyState,
  nativeScope: "unavailable",
  draftCoverage: "loading",
  setState: unavailable,
  mutate: unavailable,
  members: [],
  addComment: async () => unavailable(),
  resolveComment: async () => unavailable(),
  assignDraft: async () => unavailable(),
  saveDraft: async () => unavailable(),
  approveVersion: async () => unavailable(),
  approveFirstWrite: async () => null,
  confirmFirstWrite: async () => unavailable(),
  revokeApproval: async () => unavailable(),
  replaceSchedule: async () => unavailable(),
  planVersion: async () => unavailable(),
  cancelSchedule: async () => unavailable(),
  selectAccount: unavailable,
  loadMoreVersions: () => {},
  hasMoreVersions: false,
  loadMoreMedia: () => {},
  hasMoreMedia: false,
  loadMoreDrafts: () => {},
  hasMoreDrafts: false,
  resourcesLimited: false,
  events: [],
  notifications: [],
  createDraft: async () => {
    unavailable();
    return "";
  },
  ideaToDraft: async () => {
    unavailable();
    return "";
  },
  reset: unavailable,
  onboardingStep: 0,
  saveProfile: async () => unavailable(),
  selectWorkspace: async () => unavailable(),
  createWorkspace: async () => unavailable(),
};
export function StoreProvider({ children }: { children: ReactNode }) {
  return demoMode ? (
    <DemoStoreProvider>{children}</DemoStoreProvider>
  ) : (
    <Context.Provider value={emptyContext}>{children}</Context.Provider>
  );
}
// Mounted only inside the authenticated route boundary, so public routes never wait for workspace data.
export function WorkspaceStoreProvider({ children }: { children: ReactNode }) {
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const authId = session?.user.id;
  const sessionId = session?.session?.id;
  const bootstrap = useMutation(api.users.bootstrap);
  const deletionJobs = useQuery(
    api.operations.deletion.mine,
    authId && !sessionPending ? {} : "skip",
  );
  const deleting = deletionJobs?.some((job) => job.state !== "complete");
  const select = useMutation(api.workspaces.select);
  const create = useMutation(api.workspaces.create);
  const [readyActor, setReadyActor] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState(false);
  const recoveryOperation = useRef<object | null>(null);
  useEffect(() => {
    let active = true;
    recoveryOperation.current = null;
    setError("");
    setPending(false);
    setReadyActor(null);
    if (!authId || sessionPending || deletionJobs === undefined || deleting)
      return;
    bootstrap({})
      .then(() => {
        if (active) setReadyActor(authId);
      })
      .catch((e) => {
        if (active)
          setError(
            e instanceof Error
              ? e.message
              : "Workspace konnte nicht geladen werden.",
          );
      });
    return () => {
      active = false;
      recoveryOperation.current = null;
    };
  }, [
    bootstrap,
    attempt,
    authId,
    sessionId,
    sessionPending,
    deletionJobs === undefined,
    deleting,
  ]);
  const current = useQuery(
    api.users.current,
    authId && !sessionPending && !deleting && readyActor === authId
      ? {}
      : "skip",
  );
  const snapshot =
    !sessionPending && current?.authId === authId ? current : undefined;
  const recover = async (operation: () => Promise<unknown>) => {
    if (recoveryOperation.current) return;
    const owner = {};
    recoveryOperation.current = owner;
    setPending(true);
    setError("");
    try {
      await operation();
    } catch (e) {
      if (recoveryOperation.current === owner)
        setError(editorialActionError(e));
    } finally {
      if (recoveryOperation.current === owner) {
        recoveryOperation.current = null;
        setPending(false);
      }
    }
  };
  if (deleting)
    return (
      <div className="p-12">
        <DeletionProgress />
      </div>
    );
  if (!snapshot)
    return (
      <div className="p-12 stack" role={error ? "alert" : "status"}>
        <p>{error || "Workspace wird geladen …"}</p>
        {error && (
          <button onClick={() => setAttempt((a) => a + 1)}>
            Erneut versuchen
          </button>
        )}
      </div>
    );
  if (snapshot.state !== "ready")
    return (
      <div className="p-12 stack" role="status">
        <p>Workspace-Zugriff wiederherstellen</p>
        <p className="muted">
          Bitte einen verfügbaren Workspace auswählen oder einen neuen
          erstellen.
        </p>
        {error && <p role="alert">{error}</p>}
        {snapshot.workspaces.map((w) => (
          <button
            key={w.id}
            disabled={pending}
            onClick={() => void recover(() => select({ workspaceId: w.id }))}
          >
            {w.name}
          </button>
        ))}
        <button
          disabled={pending}
          onClick={() =>
            void recover(() =>
              create({ name: "Mein Workspace", description: "" }),
            )
          }
        >
          Neuen Workspace erstellen
        </button>
      </div>
    );
  const role = snapshot.workspaces.find(
    (w) => w.id === snapshot.activeWorkspaceId,
  )!.role;
  return (
    <WorkspaceDataStore
      key={`${authId}:${sessionId}:${snapshot.userId}:${snapshot.activeWorkspaceId}:${role}`}
      snapshot={snapshot}
      sessionScope={`${authId}:${sessionId}`}
    >
      {children}
    </WorkspaceDataStore>
  );
}
function WorkspaceDataStore({
  children,
  snapshot,
  sessionScope,
}: {
  children: ReactNode;
  sessionScope: string;
  snapshot: Extract<
    FunctionReturnType<typeof api.users.current>,
    { state: "ready" }
  >;
}) {
  const location = useLocation();
  const [selectedAccount, setSelectedAccount] = useState("");
  const commentContent = useMutation(api.editorial.addComment);
  const resolveContent = useMutation(api.editorial.resolveComment);
  const assignContent = useMutation(api.editorial.assign);
  const createContent = useMutation(api.editorial.create);
  const saveContent = useMutation(api.editorial.save);
  const approveContent = useMutation(api.editorial.approve);
  const approveProof = useMutation(api.editorial.approveFirstWrite);
  const confirmProof = useMutation(api.editorial.confirmFirstWrite);
  const revokeContent = useMutation(api.editorial.revoke);
  const scheduleContent = useMutation(api.editorial.schedule);
  const moveContent = useMutation(api.editorial.reschedule);
  const cancelContent = useMutation(api.editorial.cancel);
  const save = useMutation(api.preferences.save);
  const select = useMutation(api.workspaces.select);
  const create = useMutation(api.workspaces.create);
  const workspaceId = snapshot.activeWorkspaceId;
  const list = usePaginatedQuery(
    api.editorial.list,
    workspaceId ? { workspaceId } : "skip",
    { initialNumItems: 25 },
  );
  const resources = useQuery(
    api.editorial.resources,
    workspaceId ? { workspaceId } : "skip",
  );
  const routeId = /^\/drafts\/([^/]+)$/.exec(location.pathname)?.[1];
  const detail = useQuery(
    api.editorial.get,
    workspaceId && routeId
      ? { workspaceId, draftId: routeId as Id<"drafts"> }
      : "skip",
  );
  const history = usePaginatedQuery(
    api.editorial.history,
    workspaceId && routeId
      ? { workspaceId, draftId: routeId as Id<"drafts"> }
      : "skip",
    { initialNumItems: 20 },
  );
  const mediaInventory = usePaginatedQuery(
    api.media.assets.list,
    workspaceId && routeId ? { workspaceId } : "skip",
    { initialNumItems: 50 },
  );
  const proofVersions = [
    ...list.results.flatMap((b) => b.versions),
    ...(detail?.versions ?? []),
    ...history.results,
    ...list.results.flatMap((b) => b.comments),
    ...(detail?.comments ?? []),
  ];
  const contentClock = useGithubSourceProofClock(
    [
      ...[...list.results, ...(detail ? [detail] : [])].flatMap((b) =>
        [b.review?.sourceUntil, b.review?.stageSourceUntil]
          .filter((until): until is number => typeof until === "number")
          .map((sourceProofUntil) => ({
            sourceProofUntil,
            sourceUnavailable: false,
          })),
      ),
      ...proofVersions,
    ]
      .filter((v) => v.sourceProofUntil !== undefined)
      .map((v) => ({
        authorized: !v.sourceUnavailable,
        proofExpiresAt: v.sourceProofUntil!,
      })),
  );
  const projectBundle = <T extends NonNullable<typeof detail>>(b: T): T => {
    const review = b.review,
      stageUntil =
        review?.stageSourceUntil === undefined
          ? review?.sourceUntil
          : review.stageSourceUntil;
    return {
      ...b,
      review:
        review &&
        (stageUntil === null ||
          (stageUntil !== undefined && stageUntil > contentClock))
          ? {
              ...review,
              approvalId:
                review.sourceUntil === null || review.sourceUntil > contentClock
                  ? review.approvalId
                  : null,
            }
          : null,
      versions: b.versions.map((v) =>
        v.sourceUnavailable ||
        (v.sourceProofUntil !== undefined && v.sourceProofUntil <= contentClock)
          ? {
              ...v,
              sourceUnavailable: true,
              content: {
                ...v.content,
                title: "",
                text: v.content.text.map(() => ""),
                media: v.content.media.map((ref) => ({ ...ref, alt: "" })),
                pillar: "",
                strategy: "",
              },
              reason: "",
            }
          : v,
      ),
      comments: b.comments.map((c) => {
        const v = b.versions.find((v) => v._id === c.versionId);
        return c.sourceUnavailable ||
          (c.sourceProofUntil !== undefined &&
            c.sourceProofUntil <= contentClock) ||
          (v?.sourceProofUntil !== undefined &&
            v.sourceProofUntil <= contentClock)
          ? { ...c, text: "" }
          : c;
      }),
    };
  };
  const ownedBundle = (b: NonNullable<typeof detail>) =>
    `${b.authId}:${b.sessionId}` === sessionScope;
  const safeList = list.results.filter(ownedBundle).map(projectBundle);
  const fullDetail =
    detail && ownedBundle(detail)
      ? {
          ...detail,
          assets: [
            ...detail.assets,
            ...history.results.flatMap((v) => v.assets),
          ],
          versions: [
            ...new Map(
              [...detail.versions, ...history.results].map((v) => [v._id, v]),
            ).values(),
          ].sort((a, b) => a.number - b.number),
        }
      : null;
  const workspace = snapshot.workspaces.find(
    (w) => w.id === snapshot.activeWorkspaceId,
  );
  const { onboardingStep, ...preferences } = snapshot.preferences;
  const state: AppState = {
    ...emptyState,
    workspaces: snapshot.workspaces.map(({ role, ...w }) => w),
    activeWorkspaceId: snapshot.activeWorkspaceId,
    role: workspace?.role ?? "Viewer",
    preferences,
    activeAccountId: resources?.accounts.some((a) => a._id === selectedAccount)
      ? selectedAccount
      : "",
    accounts: (resources?.accounts ?? []).map((a) => ({
      id: a._id,
      workspaceId: a.workspaceId,
      name: a.name,
      handle: a.handle,
      channel: a.provider,
      connected: a.connection === "connected",
      connection: a.connection,
      xEvidence: a.xEvidence,
      color: "#6b7c5d",
      capability: a.capability,
    })),
    media: [
      ...new Map(
        [
          ...(resources?.assets ?? []),
          ...mediaInventory.results,
          ...list.results.flatMap((b) => b.assets),
          ...(fullDetail?.assets ?? []),
        ].map((a) => [a._id, a]),
      ).values(),
    ].map((a) => ({
      id: a._id,
      workspaceId: a.workspaceId,
      name: a.name,
      type: a.type,
      url: "",
      alt: a.defaultAlt ?? "",
      size: a.size,
      status: a.state,
      uploadSessionId: a.uploadSessionId,
      mime: a.mime,
      origin: "R2",
    })),
    drafts: [
      ...safeList.filter((b) => b.draft._id !== detail?.draft._id),
      ...(fullDetail ? [projectBundle(fullDetail)] : []),
    ].map(draftView),
    schedules: [
      ...safeList.filter((b) => b.draft._id !== detail?.draft._id),
      ...(fullDetail ? [projectBundle(fullDetail)] : []),
    ].flatMap((b) =>
      b.schedules.map((x) =>
        scheduleView(
          x,
          b.versions.find((v) => v._id === x.versionId) ?? {
            ...b.versions.at(-1)!,
            _id: x.versionId,
            number: 0,
            mediaChecksums: [],
            content: { ...b.versions.at(-1)!.content, text: [], media: [] },
          },
          b.frozenReviews?.find((p) => p.scheduleId === x._id),
        ),
      ),
    ),
  };
  const command = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      return true;
    } catch (e) {
      toast.error(editorialActionError(e));
      return false;
    }
  };
  const contentArgs = (a: ContentInput & { draftId?: string }) =>
    editorialContent(a, state);
  const target = (d: Draft) => ({
    versionId: d.versions.at(-1)!.id as Id<"draftVersions">,
    accountId: d.accountId as Id<"socialAccounts">,
  });
  const approvalId = (d: Draft) =>
    (d.nativeReview !== undefined
      ? d.nativeReview?.approvalId
      : d.approval?.id) as Id<"approvals">;
  return (
    <Context.Provider
      value={{
        ...emptyContext,
        state,
        nativeScope: `${sessionScope}:${workspaceId}:${state.activeAccountId}:${state.role}`,
        draftCoverage: list.status,
        onboardingStep,
        loadMoreVersions: () => history.loadMore(20),
        hasMoreVersions: history.status === "CanLoadMore",
        loadMoreMedia: () => mediaInventory.loadMore(50),
        hasMoreMedia: mediaInventory.status === "CanLoadMore",
        loadMoreDrafts: () => list.loadMore(25),
        hasMoreDrafts: list.status === "CanLoadMore",
        resourcesLimited: resources?.resourcesLimited ?? false,
        events: (resources?.events ?? []).map((e) => ({
          id: e._id,
          code: e.code,
          at: new Date(e.createdAt).toISOString(),
        })),
        notifications: (resources?.notifications ?? []).map((n) => ({
          id: n._id,
          state: n.state,
          errorCode: n.errorCode,
        })),
        selectAccount: (id) => {
          setSelectedAccount(id);
          return true;
        },
        createDraft: async (
          title,
          text = "",
          source = "Manuelle Notiz",
          accountId = state.activeAccountId,
        ) => {
          let id = "";
          await command(async () => {
            id = await createContent({
              workspaceId: snapshot.activeWorkspaceId,
              source,
              content: contentArgs({
                title,
                text: [text],
                mediaIds: [],
                accountId,
                pillar: "Building in public",
                strategy: "generic",
              }),
            });
          });
          return id;
        },
        members: resources?.members ?? [],
        addComment: (d, text) =>
          command(() =>
            commentContent({
              workspaceId: snapshot.activeWorkspaceId,
              versionId: target(d).versionId,
              text,
            }),
          ),
        resolveComment: (id, expectedResolved) =>
          command(() =>
            resolveContent({
              workspaceId: snapshot.activeWorkspaceId,
              commentId: id as Id<"editorialComments">,
              expectedResolved,
            }),
          ),
        assignDraft: async (d, userId, commandKey = crypto.randomUUID()) => {
          await assignContent({
            workspaceId: snapshot.activeWorkspaceId,
            draftId: d.id as Id<"drafts">,
            versionId: d.currentVersionId as Id<"draftVersions">,
            assigneeId: userId ? (userId as Id<"users">) : null,
            expectedAssignmentRevision: d.assignmentRevision ?? 0,
            commandKey,
          });
          return true;
        },
        saveDraft: (a) =>
          command(() =>
            saveContent({
              workspaceId: snapshot.activeWorkspaceId,
              draftId: a.draftId as Id<"drafts">,
              expectedRevision: a.expectedRevision,
              content: contentArgs(a),
              reason: a.reason ?? "Bearbeitung",
            }),
          ),
        approveVersion: (d) =>
          command(() =>
            approveContent({
              workspaceId: snapshot.activeWorkspaceId,
              ...target(d),
            }),
          ),
        approveFirstWrite: async (d) => {
          try {
            return await approveProof({
              workspaceId: snapshot.activeWorkspaceId,
              ...target(d),
            });
          } catch (e) {
            toast.error(editorialActionError(e));
            return null;
          }
        },
        confirmFirstWrite: (d, id) =>
          command(() =>
            confirmProof({
              workspaceId: snapshot.activeWorkspaceId,
              ...target(d),
              approvalId: id as Id<"approvals">,
            }),
          ),
        revokeApproval: (d) =>
          command(() =>
            revokeContent({
              workspaceId: snapshot.activeWorkspaceId,
              approvalId: d.approval?.id as Id<"approvals">,
            }),
          ),
        replaceSchedule: (d, s) =>
          command(() =>
            moveContent({
              workspaceId: snapshot.activeWorkspaceId,
              scheduleId: s.id as Id<"schedules">,
              expectedGeneration: s.generation!,
              versionId: target(d).versionId,
              approvalId: approvalId(d),
              at: Date.parse(s.at),
              timezone: s.timezone!,
              localTime: s.localTime!,
            }),
          ),
        planVersion: (d, at, timezone, localTime, s) =>
          command(() =>
            s
              ? moveContent({
                  workspaceId: snapshot.activeWorkspaceId,
                  scheduleId: s.id as Id<"schedules">,
                  expectedGeneration: s.generation!,
                  at: Date.parse(at),
                  timezone,
                  localTime,
                })
              : scheduleContent({
                  workspaceId: snapshot.activeWorkspaceId,
                  ...target(d),
                  approvalId: approvalId(d),
                  at: Date.parse(at),
                  timezone,
                  localTime,
                }),
          ),
        cancelSchedule: (s) =>
          command(() =>
            cancelContent({
              workspaceId: snapshot.activeWorkspaceId,
              scheduleId: s.id as Id<"schedules">,
              expectedGeneration: s.generation!,
            }),
          ),
        saveProfile: (profile, project, step = onboardingStep) =>
          command(() =>
            save({
              workspaceId: snapshot.activeWorkspaceId,
              profile: {
                ...profile,
                language: profile.language as "Deutsch" | "English",
                onboardingStep: step,
              },
              ...(project ? { project } : {}),
            }),
          ),
        selectWorkspace: (id) =>
          command(() => select({ workspaceId: id as Id<"workspaces"> })),
        createWorkspace: (name) =>
          command(() => create({ name, description: "" })),
      }}
    >
      {children}
    </Context.Provider>
  );
}

export function useStore() {
  const s = useContext(Context);
  if (!s) throw new Error("StoreProvider fehlt");
  return s;
}
// Harmless per-device UI prefs stay in localStorage even in cloud mode;
// everything else remains backend-owned. Keys arrive workspace-scoped
// (`<workspaceId>-notification-read`), hence the suffix match.
export function isLocalUiPrefKey(key: string) {
  return key === "theme" || key.endsWith("-notification-read");
}
export function useLocalState<T>(
  key: string,
  initial: T,
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw =
        demoMode || isLocalUiPrefKey(key)
          ? localStorage.getItem(`dispatch-${key}`)
          : null;
      return raw ? JSON.parse(raw) : initial;
    } catch {
      return initial;
    }
  });
  const latest = useRef(value);
  const loadedKey = useRef(key);
  useEffect(() => {
    if (loadedKey.current === key) return;
    loadedKey.current = key;
    let next = initial;
    try {
      const raw =
        demoMode || isLocalUiPrefKey(key)
          ? localStorage.getItem(`dispatch-${key}`)
          : null;
      if (raw) next = JSON.parse(raw);
    } catch {
      /* Invalid module settings use their local defaults. */
    }
    latest.current = next;
    setValue(next);
  }, [key]);
  const persist = useCallback<React.Dispatch<React.SetStateAction<T>>>(
    (update) => {
      if (!demoMode && !isLocalUiPrefKey(key)) {
        unavailable();
        return;
      }
      const next =
        typeof update === "function"
          ? (update as (prev: T) => T)(latest.current)
          : update;
      try {
        localStorage.setItem(`dispatch-${key}`, JSON.stringify(next));
      } catch {
        toast.error(
          "Demo-Einstellungen konnten nicht gespeichert werden. Die Änderung wurde verworfen.",
        );
        return;
      }
      latest.current = next;
      setValue(next);
    },
    [key],
  );
  return [value, persist];
}
export function useWorkspaceLocalState<T>(key: string, initial: T) {
  const { state } = useStore();
  return useLocalState(`${state.activeWorkspaceId}-${key}`, initial);
}
