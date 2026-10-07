import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { authClient } from "@/lib/auth-client";
import { useStore } from "@/lib/store";
import { Section } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";

type Settings = FunctionReturnType<
  typeof api.preferences.notifications
>["settings"];
const choices = [
  ["inAppSummaries", "In-App-Zusammenfassungen"],
  ["email", "E-Mail-Zusammenfassungen"],
  ["weekly", "Wöchentlicher Überblick"],
  ["research", "Research-Zusammenfassungen"],
] as const;
class PreferenceBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <p role="alert">
        Benachrichtigungswünsche konnten nicht geladen werden. Bitte neu laden.
      </p>
    ) : (
      this.props.children
    );
  }
}
export function NativeNotificationSettings() {
  const { nativeScope } = useStore();
  return (
    <Section
      title="Benachrichtigungen"
      description="Deine eigenen gespeicherten Wünsche im ausgewählten Workspace."
    >
      <p className="muted text-sm">
        E-Mail und In-App-/Wochen-/Research-Zusammenfassungen sowie die
        Ausführung von Ruhezeiten sind noch nicht verfügbar. Speichern aktiviert
        keine Zustellung.
      </p>
      <p className="muted text-sm">
        Pflichtmeldungen bleiben im persönlichen App-Posteingang. Angeforderte
        Verifizierungs- und Reset-Mails sind unabhängig von diesen Wünschen.
      </p>
      <PreferenceScope key={nativeScope} />
    </Section>
  );
}
function PreferenceScope() {
  const [requestKey, setRequestKey] = useState<string | null>(() => {
    try {
      return crypto.randomUUID();
    } catch {
      return null;
    }
  });
  const refresh = () => {
    try {
      setRequestKey(crypto.randomUUID());
    } catch {
      setRequestKey(null);
    }
  };
  return (
    <div className="stack">
      <Button variant="outline" onClick={refresh}>
        Änderungen verwerfen und neu laden
      </Button>
      {requestKey ? (
        <PreferenceBoundary key={requestKey}>
          <PreferenceForm requestKey={requestKey} />
        </PreferenceBoundary>
      ) : (
        <p role="alert">
          Benachrichtigungswünsche konnten nicht geladen werden. Bitte neu
          laden.
        </p>
      )}
    </div>
  );
}
function PreferenceForm({ requestKey }: { requestKey: string }) {
  const { state, nativeScope } = useStore(),
    session = authClient.useSession(),
    authId = session.data?.user.id,
    sessionId = session.data?.session.id,
    workspaceId = state.activeWorkspaceId as Id<"workspaces">;
  const data = useQuery(
    api.preferences.notifications,
    !session.isPending && authId && sessionId
      ? { workspaceId, expectedAuthId: authId, requestKey }
      : "skip",
  );
  const save = useMutation(api.preferences.saveNotifications);
  const [draft, setDraft] = useState<Settings | null>(null),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false);
  const current = useRef({ nativeScope, authId, sessionId, workspaceId });
  current.current = { nativeScope, authId, sessionId, workspaceId };
  const alive = useRef(true),
    ticket = useRef(0),
    inFlight = useRef(false),
    adoptedRevision = useRef(-1);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      ticket.current++;
    };
  }, []);
  const valid =
    !!data &&
    data.authId === authId &&
    data.sessionId === sessionId &&
    data.workspaceId === workspaceId &&
    data.requestKey === requestKey &&
    nativeScope ===
      `${authId}:${sessionId}:${workspaceId}:${state.activeAccountId}:${state.role}`;
  useEffect(() => {
    if (
      valid &&
      data &&
      !dirty &&
      !busy &&
      data.settings.revision >= adoptedRevision.current
    ) {
      adoptedRevision.current = data.settings.revision;
      setDraft(data.settings);
    }
  }, [valid, data, dirty, busy]);
  const edit = (next: Settings) => {
    setDraft(next);
    setDirty(true);
    setSaved(false);
    setError("");
  };
  const persist = async () => {
    if (!draft || !dirty || !valid || inFlight.current || !authId || !sessionId)
      return;
    const scope = current.current,
      ownTicket = ++ticket.current;
    const stillCurrent = () =>
      alive.current &&
      ticket.current === ownTicket &&
      current.current.nativeScope === scope.nativeScope &&
      current.current.authId === scope.authId &&
      current.current.sessionId === scope.sessionId &&
      current.current.workspaceId === scope.workspaceId;
    inFlight.current = true;
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const saveKey = crypto.randomUUID(),
        { revision, ...settings } = draft;
      const result = await save({
        workspaceId,
        expectedAuthId: authId,
        requestKey: saveKey,
        expectedRevision: revision,
        settings,
      });
      if (!stillCurrent()) return;
      if (
        result.authId !== authId ||
        result.sessionId !== sessionId ||
        result.workspaceId !== workspaceId ||
        result.requestKey !== saveKey
      ) {
        setError("Anmeldung oder Auswahl hat sich geändert. Bitte neu laden.");
        return;
      }
      adoptedRevision.current = result.settings.revision;
      setDraft(result.settings);
      setDirty(false);
      setSaved(true);
    } catch (e) {
      if (stillCurrent())
        setError(
          typeof e === "object" &&
            e !== null &&
            "data" in e &&
            e.data === "NOTIFICATION_REVISION_CONFLICT"
            ? "Gespeicherter Stand wurde geändert. Deine Eingaben bleiben erhalten; bitte verwerfen und neu laden."
            : "Benachrichtigungswünsche konnten nicht gespeichert werden. Bitte erneut versuchen.",
        );
    } finally {
      if (stillCurrent()) {
        inFlight.current = false;
        setBusy(false);
      }
    }
  };
  if (!data)
    return <p role="status">Benachrichtigungswünsche werden geladen …</p>;
  if (!valid)
    return (
      <p role="status">
        Die Einstellungen gehören nicht mehr zur aktuellen Anmeldung oder
        Auswahl. Bitte neu laden.
      </p>
    );
  if (!draft)
    return <p role="status">Benachrichtigungswünsche werden geladen …</p>;
  return (
    <div className="stack" data-testid="native-notification-preferences">
      {choices.map(([field, label]) => (
        <div
          className="flex items-center justify-between gap-5 py-3"
          key={field}
        >
          <span className="font-medium">{label}</span>
          <Switch
            aria-label={label}
            checked={draft[field]}
            disabled={busy}
            onCheckedChange={(value) => edit({ ...draft, [field]: value })}
          />
        </div>
      ))}
      <label className="stack">
        Zeitzone für Benachrichtigungswünsche
        <Input
          value={draft.timezone}
          maxLength={100}
          disabled={busy}
          onChange={(e) => edit({ ...draft, timezone: e.target.value })}
        />
      </label>
      <div className="flex items-center justify-between gap-5 py-3">
        <span className="font-medium">Ruhezeiten</span>
        <Switch
          aria-label="Ruhezeiten"
          checked={draft.quiet !== null}
          disabled={busy}
          onCheckedChange={(value) =>
            edit({
              ...draft,
              quiet: value ? { start: "20:00", end: "08:00" } : null,
            })
          }
        />
      </div>
      {draft.quiet && (
        <div className="form-grid">
          <label className="stack">
            Ruhezeit ab
            <Input
              type="time"
              value={draft.quiet.start}
              disabled={busy}
              onChange={(e) =>
                edit({
                  ...draft,
                  quiet: { ...draft.quiet!, start: e.target.value },
                })
              }
            />
          </label>
          <label className="stack">
            Ruhezeit bis
            <Input
              type="time"
              value={draft.quiet.end}
              disabled={busy}
              onChange={(e) =>
                edit({
                  ...draft,
                  quiet: { ...draft.quiet!, end: e.target.value },
                })
              }
            />
          </label>
        </div>
      )}
      <p className="muted text-sm">
        Auch über Mitternacht möglich. Die gespeicherte Ruhezeit wird derzeit
        nicht ausgeführt; Pflichtmeldungen sind davon ausgenommen.
      </p>
      {dirty && <p role="status">Ungespeicherte Änderungen.</p>}
      {dirty && data.settings.revision !== draft.revision && (
        <p role="status">
          Gespeicherter Stand wurde zwischenzeitlich geändert. Deine Eingaben
          bleiben erhalten.
        </p>
      )}
      <Button disabled={!dirty || busy} onClick={persist}>
        Benachrichtigungswünsche speichern
      </Button>
      {busy && <p role="status">Wünsche werden gespeichert …</p>}
      {saved && (
        <p role="status">
          Benachrichtigungswünsche gespeichert. Keine Zustellung aktiviert.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
