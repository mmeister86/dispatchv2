import {
  NativeReviewPolicies,
  NativeReviewQueue,
} from "@/features/drafts/review";
import {
  Component,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useAction, useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import type { FunctionArgs } from "convex/server";
import type { Id } from "../../../convex/_generated/dataModel";
import { api } from "../../../convex/_generated/api";
import { authClient, demoMode, authPath } from "@/lib/auth-client";
import { useStore } from "@/lib/store";
import { useGithubSourceProofClock } from "@/lib/github-source-proof";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, Section, EmptyState, Status } from "@/components/shared";
type Change = FunctionArgs<typeof api.team.change>;
type Send = FunctionArgs<typeof api.team.sendInvitation>;
const roles = ["Owner", "Admin", "Editor", "Viewer"] as const;
const deliveryLabels = {
  notRequested: "Noch nicht angefordert",
  configurationRequired: "Mailversand benötigt Konfiguration",
  sending: "Versand wird angefordert",
  providerAccepted: "Vom Mailanbieter angenommen",
  failed: "Mailanfrage abgelehnt",
  unknown: "Mailstatus ungewiss",
};
function failure(error: unknown) {
  if (!(error instanceof ConvexError))
    return "Antwort ungewiss. Wiederhole denselben Auftrag, um sein Ergebnis zu prüfen.";
  const code = String(error.data);
  if (code.includes("REVISION_CONFLICT"))
    return "Das Team wurde geändert. Prüfe den aktuellen Stand vor einem neuen Auftrag.";
  if (code.includes("LAST_OWNER"))
    return "Der Workspace benötigt mindestens einen Owner.";
  if (code.includes("MAIL_RETRY_EXPIRED"))
    return "Das ursprüngliche Versandfenster ist abgelaufen. Es wird keine neue Mail angefordert.";
  if (code.includes("MAIL_CONFIGURATION_CHANGED"))
    return "Die Mailkonfiguration wurde geändert. Dieser Auftrag kann nicht wiederholt werden.";
  return "Dieser Auftrag ist derzeit nicht erlaubt. Prüfe den aktuellen Stand.";
}
// Each mounted actor/session/workspace scope owns exactly one pending operation.
function useTeamOperation() {
  const operation = useRef<object | null>(null),
    mounted = useRef(false);
  const [busy, setBusy] = useState(false);
  const invalidate = useCallback(() => {
    operation.current = null;
    setBusy(false);
  }, []);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      operation.current = null;
    };
  }, []);
  return {
    busy,
    invalidate,
    begin: () => {
      if (operation.current || !mounted.current) return null;
      const owner = {};
      operation.current = owner;
      setBusy(true);
      return owner;
    },
    current: (owner: object) => mounted.current && operation.current === owner,
    finish: (owner: object) => {
      if (mounted.current && operation.current === owner) {
        operation.current = null;
        setBusy(false);
      }
    },
  };
}
export function NativeTeam() {
  const { state } = useStore(),
    { data: session, isPending } = authClient.useSession();
  const current = useQuery(
    api.users.current,
    session && !isPending ? {} : "skip",
  );
  if (
    isPending ||
    !session ||
    current?.state !== "ready" ||
    current.authId !== session.user.id
  )
    return <p role="status">Sitzung wird geprüft …</p>;
  return (
    <TeamWorkspace
      key={`${session.user.id}:${session.session.id}:${state.activeWorkspaceId}:${state.role}`}
      workspaceId={state.activeWorkspaceId as Id<"workspaces">}
      userId={current.userId}
      authId={session.user.id}
      sessionId={session.session.id}
    />
  );
}
function TeamWorkspace({
  workspaceId,
  userId,
  authId,
  sessionId,
}: {
  workspaceId: Id<"workspaces">;
  userId: Id<"users">;
  authId: string;
  sessionId: string;
}) {
  const { state } = useStore(),
    owner = state.role === "Owner",
    admin = owner || state.role === "Admin";
  const response = useQuery(api.team.list, { workspaceId });
  const roster =
    response?.authId === authId &&
    response.sessionId === sessionId &&
    response.workspaceId === workspaceId &&
    response.actorRole === state.role
      ? response
      : undefined;
  const change = useMutation(api.team.change),
    send = useAction(api.team.sendInvitation);
  const operation = useTeamOperation();
  const [email, setEmail] = useState(""),
    [role, setRole] = useState<(typeof roles)[number]>("Viewer"),
    [days, setDays] = useState("7");
  const [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [retry, setRetry] = useState<
      { kind: "change"; args: Change } | { kind: "send"; args: Send } | null
    >(null),
    [conflict, setConflict] = useState(false);
  const mailKeys = useRef(new Map<string, string>());
  const now = useGithubSourceProofClock(
    (roster?.invitations ?? []).flatMap((i) => [
      { authorized: i.status === "pending", proofExpiresAt: i.expiresAt },
      ...(i.deliveryRetryUntil !== null
        ? [
            {
              authorized: i.status === "pending",
              proofExpiresAt: i.deliveryRetryUntil,
            },
          ]
        : []),
      ...(i.deliveryPendingUntil !== null
        ? [
            {
              authorized: i.status === "pending",
              proofExpiresAt: i.deliveryPendingUntil,
            },
          ]
        : []),
    ]),
  );
  const execute = async (command: NonNullable<typeof retry>) => {
    const ticket = operation.begin();
    if (!ticket) return;
    setError("");
    setNotice("");
    try {
      if (command.kind === "change") {
        const result = await change(command.args);
        if (!operation.current(ticket)) return;
        setNotice(
          result.disposition === "issued"
            ? "Einladung erstellt. Du kannst den Link teilen oder den Mailversand ausdrücklich anfordern."
            : result.disposition === "left"
              ? "Workspace verlassen. Wähle einen verfügbaren Workspace."
              : "Teamänderung gespeichert.",
        );
        setRetry(null);
        setConflict(false);
      } else {
        const result = await send(command.args);
        if (!operation.current(ticket)) return;
        setNotice(
          deliveryLabels[result.status] +
            (result.status === "providerAccepted"
              ? ". Dies bestätigt keine Zustellung."
              : "."),
        );
        setRetry(result.status === "unknown" ? command : null);
        setConflict(false);
      }
    } catch (e) {
      if (operation.current(ticket)) {
        setError(failure(e));
        setRetry(e instanceof ConvexError ? null : command);
        setConflict(e instanceof ConvexError);
      }
    } finally {
      operation.finish(ticket);
    }
  };
  const submit = (action: Change["action"]) => {
    if (!roster || retry || conflict) return;
    void execute({
      kind: "change",
      args: {
        workspaceId,
        expectedRevision: roster.revision,
        commandKey: crypto.randomUUID(),
        action,
      },
    });
  };
  if (!roster) return <p role="status">Team wird geladen …</p>;
  const retryInvitation =
    retry?.kind === "send"
      ? roster.invitations.find((i) => i.id === retry.args.invitationId)
      : null;
  const retryAllowed =
    retry?.kind !== "send" ||
    !!(
      (retryInvitation?.canSend ||
        (retryInvitation?.delivery.status === "sending" &&
          retryInvitation.deliveryPendingUntil !== null &&
          retryInvitation.deliveryPendingUntil <= now &&
          retryInvitation.deliveryCommandKey !== null)) &&
      retryInvitation.status === "pending" &&
      retryInvitation.expiresAt > now &&
      retryInvitation.deliveryRetryUntil !== null &&
      retryInvitation.deliveryRetryUntil > now &&
      retryInvitation.deliveryCommandKey === retry.args.commandKey
    );
  return (
    <div className="stack">
      <PageHeader
        eyebrow="Zusammen arbeiten"
        title="Workspace-Team"
        description="Mitglieder und Einladungen für deinen aktuellen Workspace."
      />
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {retry && (
        <div className="stack">
          <p>
            Der ursprüngliche Auftrag bleibt unverändert; Eingaben und neue
            Teamrevisionen ändern ihn nicht.
          </p>
          <Button
            disabled={operation.busy || !retryAllowed}
            onClick={() => void execute(retry)}
          >
            Denselben Auftrag wiederholen
          </Button>
        </div>
      )}
      {conflict && (
        <Button
          disabled={operation.busy}
          variant="outline"
          onClick={() => {
            setConflict(false);
            setError("");
          }}
        >
          Aktuellen Stand prüfen
        </Button>
      )}
      <NativeReviewPolicies />
      <NativeReviewQueue />
      <Section
        title="Mitglieder"
        description={`${roster.members.length} Mitglieder · Deine Rolle: ${state.role}`}
      >
        <ul className="divide-y">
          {roster.members.map((m) => (
            <li
              key={m.membershipId}
              className="flex flex-wrap items-center justify-between gap-3 py-4"
            >
              <div className="min-w-0">
                <strong className="break-words">{m.name}</strong>
                <p className="text-xs muted break-all">{m.userId}</p>
                <Status>{m.role}</Status>
              </div>
              {admin && (owner || m.role !== "Owner") && (
                <div className="flex flex-wrap gap-2">
                  <select
                    className="native-select max-w-32"
                    aria-label={`Rolle für ${m.name}`}
                    value={m.role}
                    disabled={operation.busy || !!retry || conflict}
                    onChange={(e) =>
                      submit({
                        kind: "role",
                        membershipId: m.membershipId,
                        role: e.target.value as (typeof roles)[number],
                      })
                    }
                  >
                    {roles
                      .filter((r) => owner || r !== "Owner")
                      .map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                  </select>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={operation.busy || !!retry || conflict}
                    onClick={() => {
                      if (
                        window.confirm(
                          `${m.name} aus diesem Workspace entfernen?`,
                        )
                      )
                        submit({
                          kind: "remove",
                          membershipId: m.membershipId,
                        });
                    }}
                  >
                    Entfernen <span className="sr-only">{m.name}</span>
                  </Button>
                  {owner && m.userId !== userId && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={operation.busy || !!retry || conflict}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Owner-Rolle an ${m.name} übertragen? Du wirst Admin.`,
                          )
                        )
                          submit({
                            kind: "transfer",
                            membershipId: m.membershipId,
                          });
                      }}
                    >
                      Owner übertragen <span className="sr-only">{m.name}</span>
                    </Button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
        <Button
          variant="outline"
          disabled={operation.busy || !!retry || conflict}
          onClick={() => {
            if (window.confirm("Diesen Workspace verlassen?"))
              submit({ kind: "leave" });
          }}
        >
          Workspace verlassen
        </Button>
      </Section>
      {admin && (
        <Section
          title="Einladungen"
          description="Die Einladung funktioniert auch ohne E-Mail-Versand. Nur die bestätigte Empfängeradresse kann sie annehmen."
        >
          <form
            className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_110px_110px_auto] items-end"
            onSubmit={(e) => {
              e.preventDefault();
              submit({
                kind: "invite",
                email,
                role,
                lifetimeDays: Number(days),
              });
            }}
          >
            <label className="stack text-sm">
              E-Mail-Adresse
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="stack text-sm">
              Rolle
              <select
                className="native-select"
                value={role}
                onChange={(e) =>
                  setRole(e.target.value as (typeof roles)[number])
                }
              >
                {roles
                  .filter((r) => owner || r !== "Owner")
                  .map((r) => (
                    <option key={r}>{r}</option>
                  ))}
              </select>
            </label>
            <label className="stack text-sm">
              Gültig (Tage)
              <Input
                type="number"
                min={1}
                max={30}
                required
                value={days}
                onChange={(e) => setDays(e.target.value)}
              />
            </label>
            <Button
              disabled={
                operation.busy ||
                !!retry ||
                conflict ||
                roster.invitationsLimited
              }
            >
              Einladung erstellen
            </Button>
          </form>
          {roster.invitationsLimited && (
            <p role="status">
              Es werden die neuesten 100 Einladungen angezeigt.
            </p>
          )}
          {!roster.invitations.length && (
            <p className="muted">Noch keine Einladungen.</p>
          )}
          <ul className="divide-y">
            {roster.invitations.map((i) => {
              const available = i.status === "pending" && i.expiresAt > now,
                deliveryStatus =
                  i.delivery.status === "sending" &&
                  (i.deliveryPendingUntil ?? 0) <= now
                    ? "unknown"
                    : i.delivery.status,
                status =
                  i.status === "pending" && !available ? "expired" : i.status;
              return (
                <li
                  key={i.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-4"
                >
                  <div className="min-w-0">
                    <strong className="break-all">
                      {available ? i.email : "Einladung"}
                    </strong>
                    <p className="text-xs muted">
                      {available
                        ? `${i.role} · bis ${new Date(i.expiresAt).toLocaleString()}`
                        : ({
                            pending: "Offen",
                            accepted: "Angenommen",
                            revoked: "Widerrufen",
                            expired: "Abgelaufen",
                            unavailable: "Nicht verfügbar",
                          }[status] ?? status)}
                    </p>
                    {available && (
                      <p className="text-xs muted">
                        {deliveryLabels[deliveryStatus]}
                      </p>
                    )}
                  </div>
                  {available && (
                    <div className="flex flex-wrap gap-2">
                      <Button asChild variant="outline" size="sm">
                        <Link to={`/team/invitations/${i.id}`}>
                          Einladungslink
                        </Link>
                      </Button>
                      {(i.canSend ||
                        (i.delivery.status === "sending" &&
                          i.deliveryPendingUntil !== null &&
                          i.deliveryPendingUntil <= now &&
                          i.deliveryCommandKey !== null)) &&
                        (i.deliveryRetryUntil === null ||
                          i.deliveryRetryUntil > now) && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={
                              operation.busy ||
                              !!retry ||
                              conflict ||
                              [
                                "sending",
                                "providerAccepted",
                                "failed",
                              ].includes(deliveryStatus)
                            }
                            onClick={() => {
                              let key =
                                i.deliveryCommandKey ??
                                mailKeys.current.get(i.id);
                              if (!key) {
                                key = crypto.randomUUID();
                                mailKeys.current.set(i.id, key);
                              }
                              void execute({
                                kind: "send",
                                args: { invitationId: i.id, commandKey: key },
                              });
                            }}
                          >
                            Mail anfordern
                          </Button>
                        )}
                      {(owner || i.role !== "Owner") && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={operation.busy || !!retry || conflict}
                          onClick={() =>
                            submit({ kind: "revoke", invitationId: i.id })
                          }
                        >
                          Widerrufen
                        </Button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Section>
      )}
      {!admin && (
        <p className="muted">Einladungen verwalten Owner und Admins.</p>
      )}
    </div>
  );
}
class InvitationBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <UnavailableInvitation /> : this.props.children;
  }
}
function UnavailableInvitation() {
  return (
    <EmptyState
      title="Einladung nicht verfügbar"
      description="Prüfe den Link und melde dich mit der bestätigten Empfängeradresse an."
      action={
        <Button asChild variant="outline">
          <Link to="/overview">Zum Workspace</Link>
        </Button>
      }
    />
  );
}
export function InvitationPage() {
  const { id } = useParams(),
    { data: session, isPending } = authClient.useSession();
  const location = useLocation();
  if (demoMode) return <UnavailableInvitation />;
  if (isPending || !session) return <p role="status">Sitzung wird geprüft …</p>;
  const path = location.pathname + location.search + location.hash;
  if (!session.user.emailVerified)
    return (
      <main className="mx-auto max-w-xl p-6 sm:p-12">
        <UnavailableInvitation />
        <Button asChild>
          <Link to={authPath("/verify", path)}>E-Mail-Adresse bestätigen</Link>
        </Button>
      </main>
    );
  return (
    <main className="mx-auto max-w-xl p-6 sm:p-12">
      <Link className="text-lg font-semibold" to="/welcome">
        dispatch.
      </Link>
      <InvitationBoundary
        key={`${session.user.id}:${session.session.id}:${id}`}
      >
        <VerifiedInvitation
          invitationId={id as Id<"teamInvitations">}
          authId={session.user.id}
          sessionId={session.session.id}
        />
      </InvitationBoundary>
    </main>
  );
}
function VerifiedInvitation({
  invitationId,
  authId,
  sessionId,
}: {
  invitationId: Id<"teamInvitations">;
  authId: string;
  sessionId: string;
}) {
  const response = useQuery(api.team.preview, { invitationId });
  const preview =
    response === null
      ? null
      : response?.authId === authId &&
          response.sessionId === sessionId &&
          response.invitationId === invitationId
        ? response
        : undefined;
  const accept = useMutation(api.team.accept),
    select = useMutation(api.workspaces.select),
    nav = useNavigate();
  const operation = useTeamOperation();
  const [error, setError] = useState(""),
    [retry, setRetry] = useState<{
      args: FunctionArgs<typeof api.team.accept>;
      workspaceId: Id<"workspaces">;
    } | null>(null),
    [joined, setJoined] = useState<Id<"workspaces"> | null>(null),
    [conflict, setConflict] = useState(false);
  const now = useGithubSourceProofClock(
    preview ? [{ authorized: true, proofExpiresAt: preview.expiresAt }] : [],
  );
  const currentPreview = useRef(preview);
  currentPreview.current = preview;
  const unavailable = preview === null;
  useEffect(() => {
    if (unavailable) {
      operation.invalidate();
      setRetry(null);
      setJoined(null);
      setError("");
      setConflict(false);
    }
  }, [unavailable, operation.invalidate]);
  const choose = async (workspaceId: Id<"workspaces">, ticket: object) => {
    await select({ workspaceId });
    if (operation.current(ticket)) nav("/overview");
  };
  const execute = async (
    command: NonNullable<typeof retry>,
    selectionOnly = false,
  ) => {
    const ticket = operation.begin();
    if (!ticket) return;
    setError("");
    let membershipConfirmed = selectionOnly || !!joined;
    try {
      if (!selectionOnly) {
        await accept(command.args);
        if (!operation.current(ticket)) return;
        if (
          !currentPreview.current ||
          currentPreview.current.workspaceId !== command.workspaceId ||
          currentPreview.current.expiresAt <= Date.now()
        ) {
          setError("Einladung nicht verfügbar");
          return;
        }
        membershipConfirmed = true;
        setJoined(command.workspaceId);
        setRetry(null);
      }
      if (!operation.current(ticket)) return;
      await choose(command.workspaceId, ticket);
    } catch (e) {
      if (operation.current(ticket)) {
        setError(
          membershipConfirmed
            ? "Du bist Mitglied. Die Workspace-Auswahl ist fehlgeschlagen; versuche die Auswahl erneut."
            : failure(e),
        );
        if (!membershipConfirmed) {
          setRetry(e instanceof ConvexError ? null : command);
          setConflict(e instanceof ConvexError);
        }
      }
    } finally {
      operation.finish(ticket);
    }
  };
  if (preview === undefined)
    return <p role="status">Einladung wird geprüft …</p>;
  if (!preview || preview.expiresAt <= now) return <UnavailableInvitation />;
  return (
    <div className="stack mt-10">
      <PageHeader
        eyebrow="Zusammen arbeiten"
        title="Deine Einladung"
        description="Die Berechtigung wird beim Annehmen erneut geprüft."
      />
      <Section title={preview.workspaceName}>
        <p>
          {preview.status === "pending"
            ? `Du wurdest als ${preview.role} eingeladen.`
            : "Die Einladung wurde angenommen."}
        </p>
        <p className="text-xs muted">
          Gültig bis {new Date(preview.expiresAt).toLocaleString()}
        </p>
        {error && <p role="alert">{error}</p>}
        {joined || preview.status === "accepted" ? (
          <>
            <p role="status">
              Du bist Mitglied. Wähle jetzt den Workspace aus.
            </p>
            <Button
              disabled={operation.busy}
              onClick={() =>
                void execute(
                  {
                    workspaceId: joined ?? preview.workspaceId,
                    args: {
                      invitationId,
                      commandKey: crypto.randomUUID(),
                      expectedRevision: preview.revision,
                    },
                  },
                  true,
                )
              }
            >
              Workspace öffnen
            </Button>
          </>
        ) : (
          <>
            {conflict ? (
              <Button
                disabled={operation.busy}
                onClick={() => {
                  setConflict(false);
                  setError("");
                }}
              >
                Aktuellen Stand prüfen
              </Button>
            ) : (
              <Button
                disabled={operation.busy}
                onClick={() =>
                  void execute(
                    retry ?? {
                      workspaceId: preview.workspaceId,
                      args: {
                        invitationId,
                        commandKey: crypto.randomUUID(),
                        expectedRevision: preview.revision,
                      },
                    },
                  )
                }
              >
                {operation.busy
                  ? "Wird angenommen …"
                  : retry
                    ? "Denselben Auftrag wiederholen"
                    : "Einladung annehmen"}
              </Button>
            )}
          </>
        )}
      </Section>
    </div>
  );
}
