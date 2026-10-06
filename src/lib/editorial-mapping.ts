import type { Id, Doc } from "../../convex/_generated/dataModel";
import type { AppState, Draft, Schedule, Version, Approval } from "./model";
export const versionView = (v: Doc<"draftVersions">): Version => ({
  researchProofUntil: v.researchProofUntil,
  sourceProofUntil: v.sourceProofUntil,
  sourceUnavailable: v.sourceUnavailable,
  id: v._id,
  number: v.number,
  text: v.content.text,
  mediaIds: v.content.media.map((m) => m.assetId),
  media: v.content.media,
  createdAt: new Date(v.createdAt).toISOString(),
  reason: v.reason,
});
export const approvalView = (
  a: Doc<"approvals">,
  versions: Doc<"draftVersions">[],
): Approval => ({
  id: a._id,
  purpose: a.purpose,
  expiresAt: a.expiresAt,
  versionId: a.versionId,
  version: versions.find((v) => v._id === a.versionId)?.number ?? 0,
  accountId: a.accountId,
  at: new Date(a.createdAt).toISOString(),
  by: a.actorId,
  ...(a.revokedAt !== null
    ? { revokedAt: new Date(a.revokedAt).toISOString() }
    : {}),
});
const recoveryErrors: Record<string, string> = {
  X_RECONCILIATION_BACKOFF:
    "X benötigt eine Wartezeit. Den angezeigten Zeitpunkt abwarten; diese Leseanfrage hat nichts veröffentlicht.",
  X_RECONCILIATION_BUDGET_EXHAUSTED:
    "Das Abgleichbudget erlaubt drei Leseanfragen pro 15 Minuten. Danach kannst du den Abgleich ausdrücklich erneut autorisieren. Der Ausgang bleibt ungeklärt; nichts erneut senden.",
  X_RECONCILIATION_IN_PROGRESS:
    "Für diesen Beitrag läuft bereits ein Abgleich. Ergebnis abwarten.",
  X_RECONCILIATION_REQUIRED:
    "Ungeklärte Beiträge müssen zuerst positiv abgeglichen werden. Die Fortsetzung wurde nicht gestartet.",
  X_CANDIDATE_ID_REQUIRED:
    "Eine numerische X-Beitrags-ID oder einen vollständigen https://x.com/.../status/... Link ohne Zusätze eingeben.",
  SCHEDULE_ABORT_REQUESTED:
    "Der Abbruch bleibt gespeichert. Vorhandene Beiträge können abgeglichen werden; dieser Auftrag kann nicht fortgesetzt werden.",
  X_POST_PERMANENT_REJECTION:
    "X hat diesen Inhalt dauerhaft abgelehnt. Bestehende Beiträge behalten; geänderte Inhalte benötigen einen neuen, separat freigegebenen Auftrag.",
};
export const publishingError = (code: string | null) =>
  ({
    PUBLISHER_NOT_CONFIGURED:
      "Publishing ist noch nicht aktiviert. Unter Einstellungen → Verbindungen findest du X-Zugang, Publisher-Aktivierung und E-Mail-Einrichtung. Dieser Termin wurde nicht gesendet.",
    APPROVAL_REQUIRED:
      "Freigabe wurde widerrufen oder passt nicht mehr. Konkrete Version erneut prüfen und freigeben.",
    ACCOUNT_REAUTH_OR_CAPABILITY_REQUIRED:
      "Accountzugang oder Publishing-Berechtigung fehlt. Account in Einstellungen neu verbinden.",
    MEDIA_SNAPSHOT_CHANGED:
      "Die referenzierten Medienbytes wurden verändert. Neue unveränderliche Medien und eine neue Freigabe erforderlich.",
    MEDIA_NOT_READY:
      "Ein Medium ist nicht mehr bereit. Medien prüfen und eine neue Version freigeben.",
    SCHEDULER_AUTHORITY_CHANGED:
      "Die planende Person hat keine Admin-Rechte mehr. Ein aktueller Admin muss neu planen.",
    APPROVER_AUTHORITY_CHANGED:
      "Die freigebende Person hat keine Admin-Rechte mehr. Neue Freigabe erforderlich.",
    X_POST_OUTCOME_UNKNOWN:
      "Der Ausgang einer X-Anfrage ist ungeklärt. Keine automatische Wiederholung. Account und bestätigte Links prüfen; externer Abgleich ist erforderlich.",
    X_REAUTH_REQUIRED:
      "X-Zugang fehlt oder ist abgelaufen. Unter Einstellungen → Verbindungen den Account autorisieren und anschließend den unveränderten Snapshot prüfen.",
    X_SCOPE_REQUIRED:
      "Die aktuellen X-Zugangsdaten enthalten nicht alle benötigten Schreib- und Lesescopes. Account erneut autorisieren; diese Anfrage wurde nicht gesendet.",
    FIRST_WRITE_INTENT_EXPIRED:
      "Die bestätigte Erstveröffentlichung ist nach 45 Minuten abgelaufen. Ergebnis und vorhandene Beiträge prüfen, bevor du eine neue Veröffentlichung freigibst.",
    X_POST_RATE_LIMITED:
      "X hat diese Anfrage wegen eines Limits abgelehnt. Der bestätigte Thread bleibt erhalten. Nach dem Limit kann der unveränderte Thread ausdrücklich fortgesetzt werden.",
    ...recoveryErrors,
    CANCEL_AFTER_CLAIM:
      "Storno nach Ausführungsbeginn. Bereits gesendete Anfragen müssen im Provider abgeglichen werden.",
  })[code ?? ""] ??
  (code
    ? "Ausführung angehalten. Freigabe, Account und Medien prüfen; bei unklarem Ergebnis zuerst extern abgleichen."
    : undefined);
export function scheduleView(
  s: Doc<"schedules">,
  v: Doc<"draftVersions">,
): Schedule {
  const unavailable =
    v.sourceUnavailable ||
    (v.sourceProofUntil !== undefined && v.sourceProofUntil <= Date.now());
  return {
    sourceProofUntil: v.sourceProofUntil,
    sourceUnavailable: unavailable,
    id: s._id,
    purpose: s.purpose,
    externalPosts: s.externalPosts,
    media: unavailable
      ? v.content.media.map((m) => ({ ...m, alt: "" }))
      : v.content.media,
    draftId: s.draftId,
    workspaceId: s.workspaceId,
    accountId: s.accountId,
    version: s.versionNumber ?? v.number,
    versionId: s.versionId,
    text: unavailable ? v.content.text.map(() => "") : v.content.text,
    mediaIds: v.content.media.map((m) => m.assetId),
    at: new Date(s.at).toISOString(),
    timezone: s.timezone,
    localTime: s.localTime,
    generation: s.generation,
    draftTitle: unavailable ? "" : v.content.title,
    durableState: s.state,
    status:
      s.state === "partially_published"
        ? "partial"
        : s.state === "reconciliation_required"
          ? "uncertain"
          : (s.state as Schedule["status"]),
    publishedCount: s.publishedCount,
    error: publishingError(s.errorCode),
  };
}
export function draftView(b: {
  draft: Doc<"drafts">;
  versions: Doc<"draftVersions">[];
  approvals: Doc<"approvals">[];
  historyLimited?: boolean;
  commentsLimited?: boolean;
  schedulesLimited?: boolean;
  comments?: Doc<"editorialComments">[];
}): Draft {
  const c = b.versions.at(-1)!.content;
  const approvals = b.approvals.map((a) => approvalView(a, b.versions));
  return {
    id: b.draft._id,
    revision: b.draft.revision,
    historyLimited: b.historyLimited,
    commentsLimited: b.commentsLimited,
    schedulesLimited: b.schedulesLimited,
    workspaceId: b.draft.workspaceId,
    title: c.title,
    accountId: c.accountId ?? "",
    pillar: c.pillar,
    strategy: c.strategy,
    source: b.draft.source,
    versions: b.versions.map(versionView),
    approvals,
    approval: approvals.find(
      (a) =>
        a.versionId === b.draft.currentVersionId &&
        !a.revokedAt &&
        a.purpose !== "first_write_verification",
    ),
    assignee: b.draft.assigneeId,
    comments: (b.comments ?? []).map((c) => ({
      id: c._id,
      version:
        c.versionNumber ??
        b.versions.find((v) => v._id === c.versionId)?.number ??
        0,
      author: c.authorId,
      text: c.text,
      resolved: c.resolved,
    })),
  };
}
export function editorialActionError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const messages: Record<string, string> = {
    ...recoveryErrors,
    FIRST_WRITE_ACTIVE_JOB:
      "Für diesen Account läuft bereits eine Veröffentlichung oder ein Ergebnis benötigt Abgleich. Vorhandenes Ergebnis im Kalender prüfen.",
    FIRST_WRITE_INTENT_EXPIRED:
      "Die Freigabe der Erstveröffentlichung ist abgelaufen. Konkrete Version erneut prüfen und freigeben.",
    APPROVAL_PURPOSE_MISMATCH:
      "Diese Freigabe ist nur für die ausdrücklich bestätigte Erstveröffentlichung gültig. Account, Version und Freigabe erneut prüfen.",
    X_FIRST_WRITE_ACCOUNT_REQUIRED:
      "Verbundenen X-Account und einen vollständigen Beitrag wählen. Die Erstveröffentlichung muss ausdrücklich freigegeben werden.",
    X_WRITE_ALREADY_VERIFIED:
      "Der X-Schreibzugang ist bereits belegt. Für neue Beiträge die normale Freigabe und Planung verwenden.",
    X_REAUTH_REQUIRED:
      "Der aktuelle X-Zugang ist abgelaufen oder unvollständig. Unter Einstellungen → Verbindungen neu autorisieren.",
    X_SCOPE_REQUIRED:
      "Für diesen Beitrag fehlen aktuelle X-Scopes: tweet.write, tweet.read, users.read und bei Medien media.write. Account neu autorisieren.",
    SAVE_CONFLICT:
      "Eine neuere Version wurde gespeichert. Deine lokalen Änderungen bleiben erhalten. Versionen vergleichen oder ausdrücklich neu laden.",
    SCHEDULE_CONFLICT:
      "Der Termin wurde inzwischen geändert. Aktuellen Termin laden und erneut entscheiden.",
    ROLE_ACCESS_DENIED:
      "Deine aktuelle Workspace-Rolle erlaubt diese Aktion nicht.",
    REFERENCE_ACCESS_DENIED:
      "Account, Medium oder Zuständigkeit gehört nicht zu diesem Workspace.",
    WORKSPACE_ACCESS_DENIED:
      "Du hast keinen Zugriff mehr auf diesen Workspace.",
    APPROVAL_REQUIRED:
      "Für genau diese Version und diesen Account fehlt eine gültige Freigabe.",
    APPROVAL_ACCOUNT_MISMATCH:
      "Die Freigabe muss denselben Account wie die Inhaltsversion verwenden.",
    ACCOUNT_REAUTH_OR_CAPABILITY_REQUIRED:
      "Verbundenen Account mit bestätigter Publishing-Berechtigung wählen oder neu verbinden.",
    CAPABILITY_VALIDATION_FAILED:
      "Text, Threadlänge oder Medienformat überschreitet die bestätigten Fähigkeiten dieses Accounts.",
    MEDIA_NOT_READY:
      "Nur vollständig geprüfte Medien mit Alt-Text können gespeichert und freigegeben werden.",
    MEDIA_SNAPSHOT_CHANGED:
      "Die Medienbytes haben sich verändert. Neue unveränderliche Medien und eine neue Freigabe sind erforderlich.",
    SLOT_OCCUPIED:
      "Dieser Account hat bereits einen aktiven Termin zu dieser Uhrzeit. Andere Uhrzeit wählen.",
    DRAFT_ACTIVE_SCHEDULE_LIMIT:
      "Dieser Entwurf hat bereits 100 aktive Termine. Einen bestehenden Termin stornieren, bevor du erneut planst.",
    SCHEDULE_IN_PAST: "Der neue Termin muss in der Zukunft liegen.",
    LOCAL_TIME_REQUIRES_EXPLICIT_INSTANT:
      "Diese lokale Uhrzeit existiert nicht oder wurde nicht eindeutig gewählt. Zeit und UTC-Instanz prüfen.",
    SCHEDULE_NOT_MOVABLE:
      "Nur noch nicht begonnene, geplante Termine können verschoben werden.",
    PUBLISHED_IMMUTABLE:
      "Bereits veröffentlichte Beiträge können nicht verschoben oder storniert werden.",
    CONTENT_SNAPSHOT_TOO_LARGE:
      "Dieser Entwurf überschreitet die Speichergrenze von 32 KiB. Text oder Alt-Texte kürzen.",
    COMMENT_CONFLICT:
      "Der Kommentar wurde inzwischen geändert. Aktuellen Status prüfen und erneut entscheiden.",
    INVALID_CONTENT:
      "Titel, Text, Thread oder Metadaten prüfen. Ein Titel und mindestens ein Textfeld sind erforderlich.",
  };
  return (
    Object.entries(messages).find(([code]) => message.includes(code))?.[1] ??
    "Änderung konnte nicht gespeichert werden. Deine Eingabe bleibt erhalten; bitte erneut prüfen."
  );
}

export type ContentInput = {
  title: string;
  text: string[];
  mediaIds: string[];
  media?: { assetId: string; alt: string }[];
  accountId: string;
  pillar: string;
  strategy: string;
};
export function editorialContent(
  a: ContentInput & { draftId?: string },
  state: Pick<AppState, "drafts" | "media">,
) {
  return {
    title: a.title,
    text: a.text,
    media: a.mediaIds.map((id) => ({
      assetId: id as Id<"mediaAssets">,
      alt:
        a.media?.find((m) => m.assetId === id)?.alt ??
        state.drafts
          .find((d) => d.id === a.draftId)
          ?.versions.at(-1)
          ?.media?.find((m) => m.assetId === id)?.alt ??
        state.media.find((m) => m.id === id)?.alt ??
        "",
    })),
    accountId: a.accountId ? (a.accountId as Id<"socialAccounts">) : null,
    pillar: a.pillar,
    strategy: a.strategy,
  };
}
