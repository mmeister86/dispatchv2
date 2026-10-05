import {
  githubSourceAuthorized,
  useGithubSourceProofClock,
} from "@/lib/github-source-proof";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAction, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Section, Status, EmptyState } from "@/components/shared";
export function githubError(error: unknown) {
  const code =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : "";
  if (code.includes("WORKSPACE_CHANGED"))
    return "Der Workspace hat sich geändert. Starte die Verbindung dort erneut.";
  if (code.includes("OAUTH_DENIED"))
    return "Die GitHub-App-Autorisierung wurde abgelehnt.";
  if (code.includes("OAUTH_STATE_INVALID"))
    return "Diese Autorisierung ist abgelaufen oder wurde bereits verwendet. Starte eine neue Verbindung.";
  if (code.includes("CONFIGURATION") || code.includes("ENCRYPTION"))
    return "GitHub-App-Konfiguration oder Integrationsverschlüsselung fehlt. Die Administration muss die Einrichtung prüfen.";
  if (
    code.includes("APP_ACCESS_REQUIRED") ||
    code.includes("INSTALLATION_DENIED")
  )
    return "Diese GitHub-App-Installation ist für deinen GitHub-Zugang nicht freigegeben. Prüfe die Installation und verbinde erneut.";
  if (code.includes("SOURCE_PROOF_EXPIRED"))
    return "Die Repository-Berechtigung muss erneut geprüft werden. Lade die Repository-Auswahl und gib die Quelle erneut frei.";
  if (code.includes("SOURCE_CHANGED") || code.includes("CONNECTION_CHANGED"))
    return "Die Quelle wurde zwischenzeitlich geändert. Lade die Auswahl erneut; Änderungen wurden nicht übernommen.";
  if (code.includes("REAUTH") || code.includes("REFRESH_OUTCOME_UNKNOWN"))
    return "Der GitHub-Zugang muss neu verbunden werden. Eine unklare Erneuerung wird nicht wiederholt.";
  if (code.includes("RATE_LIMITED"))
    return "GitHub begrenzt die Anfragen. Versuche es später erneut.";
  return "Die GitHub-Anfrage konnte nicht bestätigt werden. Es wurde kein Erfolg gespeichert. Prüfe Zugang und Auswahl und versuche es erneut.";
}

type Source = FunctionReturnType<
  typeof api.integrations.github.repositories.settings
>["repositories"][number];
type Discovery = FunctionReturnType<
  typeof api.integrations.github.app.discoverRepositories
>;
function RepositorySettings({
  source,
  workspaceId,
  busy,
  command,
}: {
  source: Source;
  workspaceId: Id<"workspaces">;
  busy: boolean;
  command: (fn: () => Promise<unknown>, message: string) => Promise<void>;
}) {
  const configure = useMutation(api.integrations.github.repositories.configure),
    remove = useMutation(api.integrations.github.repositories.remove);
  const [access, setAccess] = useState(source.access),
    [monitoring, setMonitoring] = useState(source.monitoring),
    [content, setContent] = useState(source.content),
    [context, setContext] = useState(source.communicableContext);
  return (
    <article className="border rounded-lg p-4 stack">
      <div className="flex flex-wrap justify-between gap-2">
        <h3>{source.fullName}</h3>
        <Status tone={source.authorized ? "green" : "orange"}>
          {source.private ? "Privat" : "Öffentlich"} ·{" "}
          {source.authorized
            ? "Zugriff geprüft"
            : "Zugriff gesperrt oder Prüfung abgelaufen"}
        </Status>
      </div>
      <p className="text-xs muted">
        Berechtigung zuletzt geprüft:{" "}
        {new Date(source.verifiedAt).toLocaleString()}. Prüfung gilt 15 Minuten;
        eine erneute Prüfung aktualisiert sie. Lade bei Ablauf die
        Repository-Auswahl erneut; deine Eingaben bleiben erhalten.
      </p>
      <label className="flex items-center gap-2">
        <Checkbox
          checked={access}
          disabled={busy || !source.authorized}
          onCheckedChange={(v) => {
            setAccess(Boolean(v));
            if (!v) {
              setMonitoring(false);
              setContent(false);
            }
          }}
        />
        Repository-Zugriff
      </label>
      <label className="flex items-center gap-2">
        <Checkbox
          checked={monitoring}
          disabled={busy || !access || !source.authorized}
          onCheckedChange={(v) => {
            setMonitoring(Boolean(v));
            if (!v) setContent(false);
          }}
        />
        Ereignismetadaten überwachen
      </label>
      <label className="flex items-center gap-2">
        <Checkbox
          checked={content}
          disabled={busy || !access || !monitoring || !source.authorized}
          onCheckedChange={(v) => setContent(Boolean(v))}
        />
        Redaktionelle Content-Aufträge erlauben
      </label>
      <label>
        <span className="field-label">
          Ausdrücklich kommunizierbarer Projektkontext
        </span>
        <Textarea
          maxLength={4000}
          disabled={busy}
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="Nur Informationen, die du für die Redaktion freigeben möchtest; keine Secrets oder privaten Datei-/Diff-Inhalte."
        />
      </label>
      <p className="text-xs muted">
        {source.private ? "Private Dateien und Diffs bleiben gesperrt. " : ""}
        Diese Freigabe betrifft nur Ereignismetadaten und deinen Projektkontext.
        Modellverarbeitung benötigt gesonderte Zustimmung und einen
        nachgewiesenen zulässigen Verarbeitungsweg. Signal-Ingestion und KI sind
        noch nicht aktiviert.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={
            busy || (!source.authorized && (access || monitoring || content))
          }
          onClick={() =>
            command(
              () =>
                configure({
                  workspaceId,
                  repositoryId: source._id,
                  expectedGeneration: source.generation,
                  access,
                  monitoring,
                  content,
                  communicableContext: context,
                }),
              "Quellen-Einstellungen gespeichert.",
            )
          }
        >
          Einstellungen speichern
        </Button>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() =>
            command(
              () =>
                remove({
                  workspaceId,
                  repositoryId: source._id,
                  expectedGeneration: source.generation,
                }),
              "Quelle entfernt. Neue und verspätete Aufträge sind gesperrt; bestehende redaktionelle Inhalte bleiben erhalten.",
            )
          }
        >
          Quelle entfernen
        </Button>
      </div>
    </article>
  );
}
export function GithubSources() {
  const { state } = useStore(),
    workspaceId = state.activeWorkspaceId as Id<"workspaces">,
    admin = ["Owner", "Admin"].includes(state.role);
  const sources = useQuery(
    admin
      ? api.integrations.github.repositories.settings
      : api.integrations.github.repositories.list,
    { workspaceId },
  );
  const proofClock = useGithubSourceProofClock(sources?.repositories);
  const currentSources = sources?.repositories.map((r) => ({
    ...r,
    authorized: githubSourceAuthorized(r, proofClock),
  }));
  const status = useAction(api.integrations.github.app.status),
    start = useAction(api.integrations.github.app.start),
    discover = useAction(api.integrations.github.app.discoverRepositories),
    select = useAction(api.integrations.github.app.select),
    refresh = useAction(api.integrations.github.app.refresh),
    disconnect = useMutation(api.integrations.github.repositories.disconnect);
  const [configuration, setConfiguration] =
      useState<FunctionReturnType<typeof api.integrations.github.app.status>>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [installationId, setInstallation] = useState(""),
    [inventory, setInventory] = useState<Discovery>(),
    [visible, setVisible] = useState(50);
  const mounted = useRef(false),
    workspace = useRef(workspaceId);
  useEffect(() => {
    mounted.current = true;
    workspace.current = workspaceId;
    setInventory(undefined);
    setError("");
    setMessage("");
    setConfiguration(undefined);
    if (admin)
      status({ workspaceId })
        .then((v) => {
          if (mounted.current && workspace.current === workspaceId)
            setConfiguration(v);
        })
        .catch((e) => {
          if (mounted.current && workspace.current === workspaceId)
            setError(githubError(e));
        });
    return () => {
      mounted.current = false;
    };
  }, [admin, status, workspaceId]);
  const command = async (fn: () => Promise<unknown>, success: string) => {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
      if (mounted.current && workspace.current === workspaceId)
        setMessage(success);
    } catch (e) {
      if (mounted.current && workspace.current === workspaceId)
        setError(githubError(e));
    } finally {
      if (mounted.current && workspace.current === workspaceId) setBusy(false);
    }
  };
  return (
    <Section
      title="GitHub-App & Repository-Quellen"
      description="GitHub-Anmeldung und Repository-Zugriff sind unabhängig. Die App nutzt einen eigenen, ausdrücklich autorisierten GitHub-Zugang."
    >
      {error && (
        <p role="alert" className="text-sm">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
      {!sources ? (
        <p role="status">Quellen werden geladen …</p>
      ) : (
        <>
          <Status
            tone={
              sources.connection?.status === "connected" ? "green" : "neutral"
            }
          >
            {sources.connection?.status === "connected"
              ? `App-Zugang verbunden: ${sources.connection.login}`
              : sources.connection?.status === "reauth_required"
                ? "App-Zugang muss neu verbunden werden"
                : "Keine GitHub-App verbunden"}
          </Status>
          {admin && (
            <>
              <div className="flex flex-wrap gap-2 mt-4">
                <Button
                  disabled={busy || !configuration?.configured}
                  onClick={() =>
                    command(async () => {
                      const url = await start({ workspaceId });
                      if (mounted.current && workspace.current === workspaceId)
                        window.location.assign(url);
                    }, "")
                  }
                >
                  GitHub-App verbinden
                </Button>
                {sources.connection?.status === "connected" && (
                  <Button
                    variant="outline"
                    disabled={busy || !configuration?.configured}
                    onClick={() =>
                      command(
                        () => refresh({ workspaceId }),
                        "GitHub-App-Zugang erneuert. Repository-Auswahl erneut prüfen.",
                      )
                    }
                  >
                    App-Zugang erneuern
                  </Button>
                )}
                {sources.connection &&
                  sources.connection.status !== "disconnected" && (
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        command(async () => {
                          await disconnect({ workspaceId });
                          if (
                            mounted.current &&
                            workspace.current === workspaceId
                          )
                            setInventory(undefined);
                        }, "App lokal getrennt. Entferne die Autorisierung oder Installation bei GitHub separat; ein Remote-Widerruf wurde nicht ausgeführt.")
                      }
                    >
                      GitHub-App trennen
                    </Button>
                  )}
              </div>
              {sources.connection?.status === "connected" && (
                <div className="stack mt-5">
                  <label>
                    <span className="field-label">
                      Freigegebene GitHub-App-Installation
                    </span>
                    <select
                      aria-label="GitHub-App-Installation"
                      className="native-select"
                      value={installationId}
                      disabled={busy}
                      onChange={(e) => {
                        setInstallation(e.target.value);
                        setInventory(undefined);
                        setVisible(50);
                      }}
                    >
                      <option value="">Installation auswählen</option>
                      {sources.connection.installations.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.owner} ·{" "}
                          {i.kind === "Organization"
                            ? "Organisation"
                            : "Persönlich"}
                        </option>
                      ))}
                    </select>
                  </label>
                  {sources.connection.inventoryLimited && (
                    <p className="text-xs muted">
                      Die ersten 100 zugänglichen Installationen werden
                      angezeigt. Nicht sichtbare Installationen erhalten keine
                      Berechtigung.
                    </p>
                  )}
                  <Button
                    variant="outline"
                    disabled={busy || !installationId}
                    onClick={() =>
                      command(async () => {
                        const result = await discover({
                          workspaceId,
                          installationId,
                        });
                        if (
                          mounted.current &&
                          workspace.current === workspaceId
                        ) {
                          setInventory(result);
                          setVisible(50);
                        }
                      }, "Aktuelle Repository-Berechtigungen geprüft.")
                    }
                  >
                    Repository-Auswahl laden
                  </Button>
                  {inventory && (
                    <>
                      <p className="text-xs muted">
                        {inventory.repositories.length} zugängliche Repositories
                        {!inventory.complete
                          ? " · Auswahl auf die ersten 1000 begrenzt; fehlende Quellen bleiben gesperrt"
                          : ""}
                        . Höchstens 100 Quellen pro Workspace. Zugriff startet
                        ohne Monitoring oder Content-Freigabe.
                      </p>
                      {inventory.repositories.slice(0, visible).map((r) => (
                        <div
                          key={r.providerId}
                          className="flex flex-wrap justify-between gap-3 border-b py-2"
                        >
                          <span>
                            {r.fullName} · {r.private ? "Privat" : "Öffentlich"}
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() =>
                              command(
                                () =>
                                  select({
                                    workspaceId,
                                    installationId: r.installationId,
                                    repositoryId: r.providerId,
                                  }),
                                "Quelle ausdrücklich ausgewählt. Monitoring und Content bleiben ausgeschaltet.",
                              )
                            }
                          >
                            Quelle freigeben
                          </Button>
                        </div>
                      ))}
                      {visible < inventory.repositories.length && (
                        <Button
                          variant="outline"
                          disabled={busy}
                          onClick={() => setVisible((v) => v + 50)}
                        >
                          Weitere Repositories anzeigen
                        </Button>
                      )}
                    </>
                  )}
                </div>
              )}
              {currentSources?.map((r) => (
                <RepositorySettings
                  key={`${r._id}:${r.generation}`}
                  source={r}
                  workspaceId={workspaceId}
                  busy={busy}
                  command={command}
                />
              ))}
            </>
          )}
          {!admin &&
            currentSources
              ?.filter((r) => r.authorized)
              .map((r) => (
                <p key={r._id}>
                  {r.fullName} · {r.private ? "Privat" : "Öffentlich"}
                </p>
              ))}
          {!(admin
            ? currentSources?.length
            : currentSources?.filter((r) => r.authorized).length) && (
            <p className="text-sm muted">
              Noch keine freigegebenen Repository-Quellen.
            </p>
          )}
        </>
      )}
      {admin && (
        <div className="mt-5 stack">
          <p className="text-sm muted">
            {!configuration
              ? "Konfiguration wird geprüft …"
              : !configuration.configured
                ? "GitHub-App-Quellen sind noch nicht konfiguriert. Verbinden bleibt gesperrt."
                : !configuration.installationConfigured
                  ? "GITHUB_APP_PRIVATE_KEY fehlt oder ist ungültig. Hintergrundzugriff über die Installation bleibt gesperrt."
                  : "App-OAuth und private Schlüsselkonfiguration vorhanden; echte Provider-Prüfung steht noch aus."}
          </p>
          <p className="text-xs muted">
            Die Administration hinterlegt GITHUB_APP_ID, GITHUB_APP_CLIENT_ID,
            GITHUB_APP_CLIENT_SECRET, GITHUB_APP_PRIVATE_KEY, SITE_URL und den
            bestehenden INTEGRATION_ENCRYPTION_KEY mit
            INTEGRATION_ENCRYPTION_KEY_ID serverseitig.
            GITHUB_APP_INSTALLATION_ID ersetzt keine Nutzerberechtigung.
            GITHUB_CLIENT_ID und GITHUB_CLIENT_SECRET dienen ausschließlich der
            Anmeldung.
          </p>
          {configuration?.redirectUri && (
            <p className="text-xs break-all">
              Registrierte App-OAuth-Rückkehradresse:{" "}
              {configuration.redirectUri}
            </p>
          )}
          <p className="text-xs muted">
            Eine Installation wird bei GitHub eingerichtet. Danach diesen
            App-Zugang autorisieren und erlaubte Repositories separat auswählen.
            Hier werden keine Secrets eingegeben. Trennen sperrt lokal sofort
            neue und verspätete Verarbeitung; bestehende Entwürfe werden nicht
            gelöscht.
          </p>
        </div>
      )}
    </Section>
  );
}

export function GithubOAuthCallback() {
  const { state } = useStore(),
    complete = useAction(api.integrations.github.app.callback);
  const [buffer] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    return {
      state: p.get("state") ?? "",
      code: p.get("code") ?? undefined,
      denied: p.has("error"),
    };
  });
  const initialWorkspace = useRef(state.activeWorkspaceId),
    pending = useRef<Promise<unknown> | null>(null),
    [result, setResult] = useState<"pending" | "success" | "failed">("pending"),
    [error, setError] = useState("");
  useEffect(() => {
    let mounted = true;
    window.history.replaceState(
      window.history.state,
      "",
      window.location.pathname,
    );
    if (state.activeWorkspaceId !== initialWorkspace.current) {
      setResult("failed");
      setError(githubError("GITHUB_WORKSPACE_CHANGED"));
      return;
    }
    pending.current ??= complete({
      workspaceId: initialWorkspace.current as Id<"workspaces">,
      ...buffer,
    });
    pending.current
      .then(() => {
        if (mounted) setResult("success");
      })
      .catch((e) => {
        if (mounted) {
          setResult("failed");
          setError(githubError(e));
        }
      });
    return () => {
      mounted = false;
    };
  }, [buffer, complete, state.activeWorkspaceId]);
  return (
    <div className="p-12 stack">
      <h1 className="text-2xl font-semibold">GitHub-App-Verbindung</h1>
      {result === "pending" ? (
        <p role="status">GitHub-App-Autorisierung wird geprüft …</p>
      ) : result === "success" ? (
        <p role="status">
          GitHub-App-Zugang geprüft. Repositories, Monitoring und Content
          separat freigeben.
        </p>
      ) : (
        <p role="alert">{error}</p>
      )}
      <Button variant="outline" asChild>
        <Link to="/settings/integrations">Zu den Repository-Quellen</Link>
      </Button>
      <Button variant="ghost" asChild>
        <Link to="/onboarding">Zur Einrichtung</Link>
      </Button>
    </div>
  );
}
