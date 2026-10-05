export type Channel = "X" | "LinkedIn" | "Bluesky" | "Mastodon";
export type Role = "Owner" | "Admin" | "Editor" | "Viewer";
export type PublishStatus =
  | "scheduled"
  | "publishing"
  | "published"
  | "failed"
  | "partial"
  | "uncertain"
  | "cancelled";
export interface Account {
  id: string;
  workspaceId: string;
  name: string;
  handle: string;
  channel: Channel;
  connected: boolean;
  color: string;
  capability?: {
    maxText: number;
    maxThread: number;
    maxMedia: number;
    mediaTypes: ("image" | "video")[];
    publish: boolean;
  };
}
export interface Version {
  id?: string;
  media?: { assetId: string; alt: string }[];
  number: number;
  text: string[];
  mediaIds: string[];
  createdAt: string;
  reason: string;
}
export interface Approval {
  id?: string;
  versionId?: string;
  version: number;
  accountId: string;
  at: string;
  by: string;
  revokedAt?: string;
}
export interface Comment {
  id: string;
  version: number;
  author: string;
  text: string;
  resolved: boolean;
}
export interface Draft {
  revision?: number;
  historyLimited?: boolean;
  commentsLimited?: boolean;
  id: string;
  workspaceId: string;
  title: string;
  accountId: string;
  pillar: string;
  versions: Version[];
  approval?: Approval;
  approvals?: Approval[];
  source?: string;
  assignee?: string;
  comments: Comment[];
  strategy: string;
  packageId?: string;
  reviewPolicy?: { editorial: boolean; brand: boolean };
  reviews?: {
    version: number;
    accountId: string;
    stage: "editorial" | "brand";
    by: string;
    at: string;
  }[];
}
export interface Schedule {
  generation?: number;
  versionId?: string;
  timezone?: string;
  localTime?: string;
  draftTitle?: string;
  durableState?: string;
  id: string;
  draftId: string;
  workspaceId: string;
  accountId: string;
  version: number;
  text: string[];
  mediaIds: string[];
  at: string;
  status: PublishStatus;
  publishedCount: number;
  error?: string;
  authorization?: Approval;
}
export interface Idea {
  id: string;
  workspaceId: string;
  title: string;
  description: string;
  source: string;
  pillar: string;
  status: "new" | "accepted" | "archived";
  draftId?: string;
}
export interface MediaAsset {
  id: string;
  workspaceId: string;
  name: string;
  type: "image" | "video";
  url: string;
  alt: string;
  size: number;
  status: "ready" | "failed";
  origin: string;
}
export interface Workspace {
  id: string;
  name: string;
  description: string;
}
export interface Preferences {
  timezone: string;
  language: string;
  audience: string;
  tone: string;
  topics: string;
  onboardingDone: boolean;
  name: string;
}
export interface AppState {
  schemaVersion: 1;
  workspaces: Workspace[];
  activeWorkspaceId: string;
  activeAccountId: string;
  role: Role;
  accounts: Account[];
  drafts: Draft[];
  schedules: Schedule[];
  ideas: Idea[];
  media: MediaAsset[];
  preferences: Preferences;
  reviewPolicies?: Record<string, { editorial: boolean; brand: boolean }>;
}
export const now = () => new Date().toISOString();
export const uid = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
export const currentVersion = (draft: Draft) =>
  draft.versions[draft.versions.length - 1];
export const limits: Record<Channel, number> = {
  X: 280,
  LinkedIn: 3000,
  Bluesky: 300,
  Mastodon: 500,
};
export function canEdit(role: Role) {
  return role !== "Viewer";
}
export function canApprove(role: Role) {
  return role === "Owner" || role === "Admin";
}
export function draftValid(
  draft: Draft,
  accounts: Account[],
  media: MediaAsset[],
) {
  const account = accounts.find((a) => a.id === draft.accountId);
  const v = currentVersion(draft);
  return (
    !!account?.connected &&
    account.workspaceId === draft.workspaceId &&
    v.text.length > 0 &&
    (account.capability
      ? v.text.length <= account.capability.maxThread
      : account.channel !== "LinkedIn" || v.text.length === 1) &&
    v.mediaIds.length <= (account.capability?.maxMedia ?? 4) &&
    (!v.mediaIds.some(
      (id) => media.find((m) => m.id === id)?.type === "video",
    ) ||
      v.mediaIds.length === 1) &&
    v.text.every(
      (t) =>
        t.trim().length > 0 &&
        t.length <= (account.capability?.maxText ?? limits[account.channel]),
    ) &&
    v.mediaIds.every((id) =>
      media.some(
        (m) =>
          m.id === id &&
          m.workspaceId === draft.workspaceId &&
          m.status === "ready" &&
          (v.media?.find((ref) => ref.assetId === id)?.alt ?? m.alt).trim()
            .length > 0 &&
          (!account.capability ||
            account.capability.mediaTypes.includes(m.type)),
      ),
    )
  );
}
export function approved(draft: Draft) {
  return (
    draft.approval?.version === currentVersion(draft).number &&
    draft.approval?.accountId === draft.accountId &&
    !draft.approval?.revokedAt &&
    reviewComplete(draft)
  );
}
export function reviewComplete(draft: Draft) {
  return (["editorial", "brand"] as const).every(
    (stage) =>
      !draft.reviewPolicy?.[stage] ||
      draft.reviews?.some(
        (r) =>
          r.stage === stage &&
          r.version === currentVersion(draft).number &&
          r.accountId === draft.accountId,
      ),
  );
}
export function editDraft(
  state: AppState,
  id: string,
  patch: Partial<
    Pick<Draft, "title" | "accountId" | "pillar" | "strategy" | "assignee">
  >,
  text?: string[],
  mediaIds?: string[],
  reason = "Bearbeitung",
): AppState {
  if (!canEdit(state.role))
    throw new Error("Deine Rolle darf Inhalte nur ansehen.");
  if (
    !state.drafts.some(
      (d) => d.id === id && d.workspaceId === state.activeWorkspaceId,
    )
  )
    throw new Error("Entwurf gehört nicht zum aktiven Workspace.");
  if (
    patch.accountId &&
    !state.accounts.some(
      (a) =>
        a.id === patch.accountId && a.workspaceId === state.activeWorkspaceId,
    )
  )
    throw new Error("Account gehört nicht zum aktiven Workspace.");
  return {
    ...state,
    drafts: state.drafts.map((d) => {
      if (d.id !== id) return d;
      const v = currentVersion(d);
      const changed =
        JSON.stringify(text ?? v.text) !== JSON.stringify(v.text) ||
        JSON.stringify(mediaIds ?? v.mediaIds) !== JSON.stringify(v.mediaIds) ||
        (patch.accountId !== undefined && patch.accountId !== d.accountId);
      return {
        ...d,
        ...patch,
        ...(changed
          ? {
              versions: [
                ...d.versions,
                {
                  number: v.number + 1,
                  text: text ?? v.text,
                  mediaIds: mediaIds ?? v.mediaIds,
                  createdAt: now(),
                  reason,
                },
              ],
            }
          : {}),
      };
    }),
  };
}
export function approveDraft(state: AppState, id: string): AppState {
  if (!canApprove(state.role))
    throw new Error("Freigaben benötigen Owner- oder Admin-Rechte.");
  const original = state.drafts.find((d) => d.id === id);
  const d = original
    ? {
        ...original,
        reviewPolicy:
          original.reviewPolicy ?? state.reviewPolicies?.[original.workspaceId],
      }
    : undefined;
  if (
    !d ||
    d.workspaceId !== state.activeWorkspaceId ||
    !draftValid(d, state.accounts, state.media)
  )
    throw new Error(
      "Text, Zeichenlimit, Account-Verbindung und Medien-Alttexte prüfen.",
    );
  if (!reviewComplete(d))
    throw new Error(
      "Erforderliche redaktionelle und Marken-Reviews fehlen für diese Version.",
    );
  const authorization: Approval = {
    version: currentVersion(d).number,
    accountId: d.accountId,
    at: now(),
    by: state.preferences.name,
  };
  return {
    ...state,
    drafts: state.drafts.map((d) =>
      d.id === id
        ? {
            ...d,
            reviewPolicy:
              d.reviewPolicy ?? state.reviewPolicies?.[d.workspaceId],
            approval: authorization,
            approvals: [
              ...(d.approvals ?? []),
              ...(d.approval &&
              !d.approvals?.some((a) => a.at === d.approval?.at)
                ? [d.approval]
                : []),
              authorization,
            ],
          }
        : d,
    ),
  };
}
export function scheduleDraft(
  state: AppState,
  id: string,
  at: string,
): AppState {
  if (!canApprove(state.role))
    throw new Error("Terminierung benötigt Owner- oder Admin-Rechte.");
  const d = state.drafts.find((d) => d.id === id);
  if (
    !d ||
    d.workspaceId !== state.activeWorkspaceId ||
    !approved(d) ||
    !draftValid(d, state.accounts, state.media)
  )
    throw new Error(
      "Die aktuelle Version muss für diesen verbundenen Account gültig freigegeben sein.",
    );
  const date = new Date(at);
  if (!Number.isFinite(date.getTime()) || date.getTime() <= Date.now())
    throw new Error("Bitte einen gültigen Zeitpunkt in der Zukunft wählen.");
  if (
    state.schedules.some(
      (s) =>
        s.draftId === id &&
        s.version === currentVersion(d).number &&
        s.status === "scheduled",
    )
  )
    return state;
  if (
    state.schedules.some(
      (s) =>
        s.accountId === d.accountId &&
        s.at === date.toISOString() &&
        s.status === "scheduled",
    )
  )
    throw new Error("Dieser Slot ist für den Account bereits belegt.");
  const v = currentVersion(d);
  return {
    ...state,
    schedules: [
      ...state.schedules,
      {
        id: uid("slot"),
        draftId: id,
        workspaceId: d.workspaceId,
        accountId: d.accountId,
        version: v.number,
        text: [...v.text],
        mediaIds: [...v.mediaIds],
        at: date.toISOString(),
        status: "scheduled",
        publishedCount: 0,
        authorization: { ...d.approval! },
      },
    ],
  };
}
export function replaceScheduledVersion(
  state: AppState,
  slotId: string,
): AppState {
  if (!canApprove(state.role))
    throw new Error("Snapshot-Wechsel benötigt Owner- oder Admin-Rechte.");
  const slot = state.schedules.find(
    (s) => s.id === slotId && s.workspaceId === state.activeWorkspaceId,
  );
  const draft = state.drafts.find(
    (d) => d.id === slot?.draftId && d.workspaceId === state.activeWorkspaceId,
  );
  if (!slot || slot.status !== "scheduled" || Date.parse(slot.at) <= Date.now())
    throw new Error("Nur zukünftige geplante Slots können ersetzt werden.");
  if (!draft || draft.accountId !== slot.accountId)
    throw new Error(
      "Account geändert: Alten Slot stornieren und die Kanalvariante separat planen.",
    );
  if (!approved(draft) || !draftValid(draft, state.accounts, state.media))
    throw new Error("Aktuelle Version erst gültig freigeben.");
  if (
    state.schedules.some(
      (s) =>
        s.id !== slot.id &&
        s.status === "scheduled" &&
        s.accountId === slot.accountId &&
        s.at === slot.at,
    )
  )
    throw new Error("Dieser Slot ist für den Account bereits belegt.");
  const v = currentVersion(draft);
  return {
    ...state,
    schedules: state.schedules.map((s) =>
      s.id === slotId
        ? {
            ...s,
            version: v.number,
            text: [...v.text],
            mediaIds: [...v.mediaIds],
            authorization: { ...draft.approval! },
          }
        : s,
    ),
  };
}
export function disconnectAccount(state: AppState, id: string): AppState {
  if (!canApprove(state.role))
    throw new Error("Verbindungen benötigen Owner- oder Admin-Rechte.");
  const account = state.accounts.find(
    (a) => a.id === id && a.workspaceId === state.activeWorkspaceId,
  );
  if (!account) throw new Error("Account gehört nicht zum aktiven Workspace.");
  return {
    ...state,
    accounts: state.accounts.map((a) =>
      a.id === id ? { ...a, connected: false } : a,
    ),
    schedules: state.schedules.map((s) =>
      s.accountId === id && s.status === "scheduled"
        ? {
            ...s,
            status: "failed",
            error:
              "Account-Verbindung getrennt. Nach erneuter Verbindung die konkrete Snapshot-Version prüfen und ausdrücklich fortsetzen.",
          }
        : s,
    ),
  };
}
export function revokeDraftApproval(state: AppState, id: string): AppState {
  if (!canApprove(state.role))
    throw new Error("Freigaben benötigen Owner- oder Admin-Rechte.");
  const draft = state.drafts.find(
    (d) => d.id === id && d.workspaceId === state.activeWorkspaceId,
  );
  if (!draft?.approval) return state;
  const revoked = { ...draft.approval, revokedAt: now() };
  return {
    ...state,
    drafts: state.drafts.map((d) =>
      d.id === id
        ? {
            ...d,
            approval: undefined,
            approvals: [
              ...(d.approvals ?? []).filter(
                (a) =>
                  !(
                    a.version === revoked.version &&
                    a.accountId === revoked.accountId
                  ),
              ),
              revoked,
            ],
          }
        : d,
    ),
    schedules: state.schedules.map((s) =>
      s.draftId === id &&
      s.version === revoked.version &&
      s.accountId === revoked.accountId &&
      s.status === "scheduled"
        ? { ...s, status: "cancelled" }
        : s,
    ),
  };
}
export function snapshotDraft(
  state: AppState,
  schedule: Schedule,
): Draft | undefined {
  const draft = state.drafts.find(
    (d) =>
      d.id === schedule.draftId && d.workspaceId === state.activeWorkspaceId,
  );
  if (!draft || schedule.workspaceId !== state.activeWorkspaceId) return;
  const latest =
    draft.approvals
      ?.filter(
        (a) =>
          a.version === schedule.version && a.accountId === schedule.accountId,
      )
      .at(-1) ??
    (draft.approval?.version === schedule.version &&
    draft.approval?.accountId === schedule.accountId
      ? draft.approval
      : schedule.authorization);
  return {
    ...draft,
    accountId: schedule.accountId,
    versions: [
      {
        number: schedule.version,
        text: schedule.text,
        mediaIds: schedule.mediaIds,
        createdAt: schedule.at,
        reason: "Geplanter Snapshot",
      },
    ],
    approval: latest,
    reviewPolicy:
      state.reviewPolicies?.[draft.workspaceId] ?? draft.reviewPolicy,
  };
}
export function canResumeSnapshot(state: AppState, schedule: Schedule) {
  const draft = snapshotDraft(state, schedule);
  return (
    canApprove(state.role) &&
    !!draft &&
    approved(draft) &&
    draftValid(draft, state.accounts, state.media) &&
    ["partial", "failed"].includes(schedule.status)
  );
}
export function approveSnapshot(state: AppState, id: string): AppState {
  if (!canApprove(state.role))
    throw new Error("Snapshot-Freigaben benötigen Owner- oder Admin-Rechte.");
  const slot = state.schedules.find((s) => s.id === id);
  const draft = slot ? snapshotDraft(state, slot) : undefined;
  if (
    !slot ||
    !draft ||
    !draftValid(draft, state.accounts, state.media) ||
    !reviewComplete(draft)
  )
    throw new Error(
      "Snapshot-Account, Medien und erforderliche Review-Stufen prüfen.",
    );
  const authorization: Approval = {
    version: slot.version,
    accountId: slot.accountId,
    at: now(),
    by: state.preferences.name,
  };
  return {
    ...state,
    schedules: state.schedules.map((s) =>
      s.id === id ? { ...s, authorization } : s,
    ),
    drafts: state.drafts.map((d) =>
      d.id === slot.draftId
        ? {
            ...d,
            approvals: [...(d.approvals ?? []), authorization],
            ...(currentVersion(d).number === slot.version &&
            d.accountId === slot.accountId
              ? { approval: authorization }
              : {}),
          }
        : d,
    ),
  };
}
export function resumeSnapshot(state: AppState, id: string): AppState {
  const slot = state.schedules.find((s) => s.id === id);
  if (!slot || !canResumeSnapshot(state, slot))
    throw new Error(
      "Die konkrete Snapshot-Version muss gültig freigegeben sein. Unklare Ausgänge zuerst abgleichen.",
    );
  return {
    ...state,
    schedules: state.schedules.map((s) =>
      s.id === id
        ? {
            ...s,
            status: "published",
            publishedCount: s.text.length,
            error: undefined,
          }
        : s,
    ),
  };
}
function atDay(offset: number, hour = 10) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}
const illustration = (color: string, label: string) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500"><rect width="800" height="500" fill="${color}"/><circle cx="600" cy="100" r="160" fill="#ffffff" opacity=".1"/><path d="M50 380L200 180l150 130 170-210 230 280" fill="none" stroke="#fff8ee" stroke-width="4"/><text x="48" y="65" fill="#fff8ee" font-family="sans-serif" font-size="26">${label}</text><text x="48" y="440" fill="#fff8ee" font-family="sans-serif" font-size="16">DISPATCH / BUILD IN PUBLIC</text></svg>`)}`;
export function createSeed(): AppState {
  const accounts: Account[] = [
    {
      id: "acc-x",
      workspaceId: "ws-studio",
      name: "Matthias",
      handle: "@matthiasbuilds",
      channel: "X",
      connected: true,
      color: "#2d332e",
    },
    {
      id: "acc-linkedin",
      workspaceId: "ws-studio",
      name: "Matthias",
      handle: "Matthias · Founder",
      channel: "LinkedIn",
      connected: true,
      color: "#32679b",
    },
    {
      id: "acc-bluesky",
      workspaceId: "ws-studio",
      name: "Studio Dispatch",
      handle: "@dispatch.bsky.social",
      channel: "Bluesky",
      connected: false,
      color: "#467da5",
    },
    {
      id: "acc-client",
      workspaceId: "ws-client",
      name: "Lemonspace",
      handle: "@lemonspace",
      channel: "X",
      connected: true,
      color: "#627743",
    },
  ];
  const items = [
    [
      "draft-1",
      "Die kleinen Dinge machen das Produkt",
      "Heute einen ganzen Tag an Details gearbeitet, die niemand bemerken wird.\n\nEin schnellerer Dialog. Eine klarere Fehlermeldung. Ein Klick weniger.\n\nGenau die Dinge, die ein Produkt jeden Tag ein bisschen besser machen.",
      "Building in public",
      "acc-x",
    ],
    [
      "draft-2",
      "Was wir aus 100 Gesprächen gelernt haben",
      "100 Gespräche, eine überraschende Erkenntnis: Menschen wünschen sich selten mehr Features. Sie wünschen sich weniger Arbeit.\n\nDas verändert, wie wir Dispatch bauen.",
      "Learnings",
      "acc-x",
    ],
    [
      "draft-3",
      "Unser neuer Release ist da",
      "Kleiner Release, großer Unterschied: Der neue Kalender ist da.\n\nWeniger Kontextwechsel. Mehr Raum für die eigentliche Arbeit.",
      "Produktupdates",
      "acc-x",
    ],
    [
      "draft-4",
      "Ein ehrlicher Blick hinter die Kulissen",
      "Software zu bauen heißt, Entscheidungen zu treffen. Oft mit unvollständigen Informationen.\n\nDiese Woche haben wir drei Features gestrichen und einen Ablauf vereinfacht. Das Ergebnis fühlt sich besser an.",
      "Building in public",
      "acc-linkedin",
    ],
    [
      "draft-5",
      "Drei Gedanken zu gutem Produktdesign",
      "Gute Produkte respektieren deine Zeit. Hier sind drei Dinge, die wir beim Bauen gelernt haben.",
      "Learnings",
      "acc-x",
    ],
    [
      "draft-client",
      "Lemonspace: neuer Workspace",
      "Ein neuer Ort für gute Zusammenarbeit. Willkommen bei Lemonspace.",
      "Produktupdates",
      "acc-client",
    ],
  ];
  const drafts: Draft[] = items.map(
    ([id, title, text, pillar, accountId], i) => ({
      id,
      workspaceId: accountId === "acc-client" ? "ws-client" : "ws-studio",
      title,
      accountId,
      pillar,
      versions: [
        {
          number: 1,
          text:
            id === "draft-5"
              ? [
                  text,
                  "1. Ein klarer nächster Schritt ist mehr wert als zehn Optionen.",
                  "2. Ein guter Leerzustand hilft dir, anzufangen.",
                  "3. Fehler sollten erklären, wie es weitergeht.",
                ]
              : [text],
          mediaIds: [],
          createdAt: atDay(-i - 1),
          reason: "Erster Entwurf",
        },
      ],
      comments: [],
      strategy: "educational",
      source: i % 2 === 0 ? "GitHub · dispatch/calendar" : "Manuelle Notiz",
      assignee: i % 2 === 0 ? "Matthias" : "Lea",
      ...(i === 1 || i === 2 || i === 4
        ? { approval: { version: 1, accountId, at: atDay(-1), by: "Matthias" } }
        : {}),
    }),
  );
  const schedules: Schedule[] = [
    {
      id: "slot-1",
      draftId: "draft-2",
      workspaceId: "ws-studio",
      accountId: "acc-x",
      version: 1,
      text: currentVersion(drafts[1]).text,
      mediaIds: [],
      at: atDay(1),
      status: "scheduled",
      publishedCount: 0,
    },
    {
      id: "slot-2",
      draftId: "draft-3",
      workspaceId: "ws-studio",
      accountId: "acc-x",
      version: 1,
      text: currentVersion(drafts[2]).text,
      mediaIds: [],
      at: atDay(3, 15),
      status: "scheduled",
      publishedCount: 0,
    },
    {
      id: "slot-3",
      draftId: "draft-5",
      workspaceId: "ws-studio",
      accountId: "acc-x",
      version: 1,
      text: currentVersion(drafts[4]).text,
      mediaIds: [],
      at: atDay(-1),
      status: "partial",
      publishedCount: 1,
      error:
        "Der zweite Beitrag wurde nicht gesendet. Nur offene Beiträge fortsetzen.",
    },
    {
      id: "slot-4",
      draftId: "draft-1",
      workspaceId: "ws-studio",
      accountId: "acc-x",
      version: 1,
      text: currentVersion(drafts[0]).text,
      mediaIds: [],
      at: atDay(-3),
      status: "published",
      publishedCount: 1,
    },
    {
      id: "slot-5",
      draftId: "draft-4",
      workspaceId: "ws-studio",
      accountId: "acc-linkedin",
      version: 1,
      text: currentVersion(drafts[3]).text,
      mediaIds: [],
      at: atDay(-2),
      status: "uncertain",
      publishedCount: 0,
      error: "Timeout: Der Ausgang ist unklar. Vor Wiederholung abgleichen.",
    },
  ];
  return {
    schemaVersion: 1,
    workspaces: [
      {
        id: "ws-studio",
        name: "Matthias Studio",
        description: "Build in public, mit Substanz.",
      },
      {
        id: "ws-client",
        name: "Lemonspace",
        description: "Kunden-Workspace · getrennte Inhalte",
      },
    ],
    activeWorkspaceId: "ws-studio",
    activeAccountId: "acc-x",
    role: "Owner",
    accounts,
    drafts,
    schedules,
    ideas: [
      {
        id: "idea-1",
        workspaceId: "ws-studio",
        title: "Warum weniger Features manchmal mehr sind",
        description:
          "Drei gestrichene Features und die Erkenntnis dahinter. Ein ehrlicher Blick auf unsere Produktentscheidungen.",
        source: "GitHub · 3 Pull Requests",
        pillar: "Building in public",
        status: "new",
      },
      {
        id: "idea-2",
        workspaceId: "ws-studio",
        title: "Dein erster Nutzer ist kein Datenpunkt",
        description:
          "Ein Learning aus den ersten Kundengesprächen: zuhören, bevor wir messen.",
        source: "Research · Produktentwicklung",
        pillar: "Learnings",
        status: "new",
      },
      {
        id: "idea-3",
        workspaceId: "ws-studio",
        title: "Die unsichtbare Arbeit vor dem Release",
        description:
          "Tests, Fehlerfälle und all die kleinen Verbesserungen, die nie im Changelog stehen.",
        source: "GitHub · Release v0.8",
        pillar: "Produktupdates",
        status: "accepted",
        draftId: "draft-3",
      },
    ],
    media: [
      {
        id: "media-1",
        workspaceId: "ws-studio",
        name: "release-cover.svg",
        type: "image",
        url: illustration("#5a6955", "A little less friction."),
        alt: "Abstrakte Linie als Cover für unseren neuen Release.",
        size: 2600,
        status: "ready",
        origin: "Demo-Illustration",
      },
      {
        id: "media-2",
        workspaceId: "ws-studio",
        name: "build-in-public.svg",
        type: "image",
        url: illustration("#b26545", "Small details. Big difference."),
        alt: "Illustration mit dem Schriftzug Small details. Big difference.",
        size: 2800,
        status: "ready",
        origin: "Demo-Illustration",
      },
    ],
    preferences: {
      timezone: "Europe/Berlin",
      language: "Deutsch",
      audience: "Entwickler, Gründer und Menschen, die gute Produkte bauen.",
      tone: "Klar, persönlich und ehrlich",
      topics: "Build in public, Produktentwicklung, Learnings",
      onboardingDone: false,
      name: "Matthias",
    },
  };
}
