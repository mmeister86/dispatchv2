import { useAction, useMutation } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useStore } from "@/lib/store";
import { useOAuthCallback } from "@/lib/oauth-callback";
import { Button } from "@/components/ui/button";
import { Section, Status } from "@/components/shared";

export function xError(error: unknown) {
  const value = String(error);
  const messages: Record<string, string> = {
    X_CONFIGURATION_REQUIRED:
      "X_CLIENT_ID, X_CLIENT_SECRET und SITE_URL müssen serverseitig eingerichtet werden.",
    X_ENCRYPTION_CONFIGURATION_REQUIRED:
      "Die Administration muss einen gültigen 32-Byte-Verschlüsselungsschlüssel und dessen Schlüssel-ID einrichten.",
    X_ENCRYPTION_KEY_UNAVAILABLE:
      "Der bisherige Schlüssel ist nicht mehr verfügbar. Bitte den Account mit gültiger Schlüsselkonfiguration neu verbinden.",
    X_CREDENTIAL_UNREADABLE:
      "Der gespeicherte Zugang kann nicht entschlüsselt werden. Bitte neu verbinden.",
    X_OAUTH_STATE_INVALID:
      "Diese Autorisierung ist abgelaufen, bereits verwendet oder gehört zu einer anderen Sitzung. Bitte neu starten.",
    X_OAUTH_DENIED:
      "Die X-Autorisierung wurde abgelehnt. Es wurde kein Account verbunden.",
    X_ACCOUNT_BINDING_CONFLICT:
      "Dieser X-Account ist bereits gebunden. Zuerst im bisherigen Workspace ausdrücklich trennen, danach hier neu autorisieren.",
    X_RECONNECT_IDENTITY_MISMATCH:
      "Ein anderer X-Account wurde autorisiert. Bitte über „X-Account verbinden“ einen separaten Account hinzufügen.",
    X_USE_RECONNECT:
      "Dieser Account ist bereits vorhanden. Bitte dessen „Neu verbinden“-Aktion verwenden.",
    X_WORKSPACE_CHANGED:
      "Der aktive Workspace hat sich geändert. Bitte die Autorisierung im gewünschten Workspace neu starten.",
    OAUTH_SCOPE_CHANGED:
      "Sitzung, Workspace oder Berechtigungen haben sich geändert. Bitte die Autorisierung neu starten.",
    ACCOUNT_CONNECTION_CHANGED:
      "Der Account wurde nach dieser Planung neu verbunden. Bitte die exakte freigegebene Version ausdrücklich neu planen.",
    X_CONNECTION_CHANGED:
      "Die Verbindung hat sich während der Aktion geändert. Bitte den aktuellen Account-Status prüfen.",
    X_ACCOUNT_CAPACITY_REACHED:
      "Die Grenze von 100 aufbewahrten Accounts ist erreicht. Es wurde keine Verbindung hinzugefügt.",
    X_REFRESH_IN_PROGRESS:
      "Ein Zugang wird bereits erneuert. Bitte den Account-Status abwarten.",
    X_REFRESH_OUTCOME_UNKNOWN:
      "Der Ausgang der Token-Erneuerung ist unklar. Bitte neu verbinden; der alte Refresh-Token wird nicht erneut verwendet.",
    X_SCOPE_REQUIRED:
      "Die erforderliche Schreibberechtigung fehlt. Bitte den Account mit den benötigten X-Scopes neu verbinden.",
    X_REAUTH_REQUIRED:
      "X hat den Zugang abgelehnt oder ein erneuerbarer Zugang fehlt. Bitte neu verbinden.",
    ROLE_ACCESS_DENIED:
      "Diese Aktion benötigt aktuelle Owner- oder Admin-Rechte.",
    WORKSPACE_ACCESS_DENIED:
      "Der Zugriff auf diesen Workspace ist nicht mehr verfügbar.",
    WORKSPACE_INACTIVE: "Dieser Workspace ist nicht mehr aktiv.",
  };
  return (
    Object.entries(messages).find(([code]) => value.includes(code))?.[1] ??
    "Die X-Verbindung konnte nicht bestätigt werden. Bitte neu starten und bei erneutem Fehler die Administration kontaktieren."
  );
}
export function SocialAccounts() {
  const { state } = useStore();
  const workspaceId = state.activeWorkspaceId as Id<"workspaces">;
  const admin = state.role === "Owner" || state.role === "Admin";
  const status = useAction(api.integrations.x.client.status);
  const start = useAction(api.integrations.x.client.start);
  const refresh = useAction(api.integrations.x.client.refresh);
  const disconnect = useMutation(api.integrations.x.oauth.disconnect);
  const [configuration, setConfiguration] = useState<{
    configured: boolean;
    redirectUri: string | null;
  } | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState("");
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    if (admin)
      status({ workspaceId })
        .then((result) => {
          if (mounted.current) setConfiguration(result);
        })
        .catch((e) => {
          if (mounted.current) setError(xError(e));
        });
    return () => {
      mounted.current = false;
    };
  }, [admin, status, workspaceId]);
  async function command(
    id: string,
    run: () => Promise<unknown>,
    message = "",
  ) {
    setBusy(id);
    setError("");
    setReceipt("");
    try {
      await run();
      if (mounted.current) setReceipt(message);
    } catch (e) {
      if (mounted.current) setError(xError(e));
    } finally {
      if (mounted.current) setBusy("");
    }
  }
  const accounts = state.accounts.filter(
    (a) => a.workspaceId === workspaceId && a.channel === "X",
  );
  return (
    <Section
      title="X & Publishing"
      description="X-Identität und erteilte OAuth-Berechtigungen werden serverseitig geprüft."
    >
      <Status tone="orange">Publishing noch nicht aktiviert</Status>
      <p className="mt-4 text-sm">
        {accounts.length
          ? `${accounts.length} aufbewahrte X-Accounts in diesem Workspace.`
          : "Kein bestätigter X-Account in diesem Workspace verfügbar."}{" "}
        Schreibberechtigungen sind noch kein Nachweis einer erfolgreichen
        Veröffentlichung. Bestehende Termine werden nach erneutem Verbinden
        nicht automatisch fortgesetzt.
      </p>
      {error && (
        <p role="alert" className="text-sm mt-4">
          {error}
        </p>
      )}
      {receipt && (
        <p role="status" className="text-sm mt-4">
          {receipt}
        </p>
      )}
      {admin && (
        <div className="mt-4">
          <Button
            disabled={Boolean(busy) || !configuration?.configured}
            onClick={() =>
              command("connect", async () => {
                const url = await start({ workspaceId });
                if (mounted.current) window.location.assign(url);
              })
            }
          >
            {busy === "connect"
              ? "Autorisierung wird vorbereitet …"
              : "X-Account verbinden"}
          </Button>
        </div>
      )}
      {accounts.map((a) => (
        <div key={a.id} className="mt-5 border-t pt-4">
          <p className="font-medium">
            {a.name} <span className="muted">{a.handle}</span>
          </p>
          <p className="text-sm" role="status">
            {a.connection === "connected"
              ? "Identität verbunden"
              : a.connection === "reauth_required"
                ? "Erneute Autorisierung erforderlich"
                : "Lokal getrennt"}
          </p>
          {a.xEvidence && (
            <p className="text-sm muted">
              Text-Schreibscope:{" "}
              {a.xEvidence.textScopeEligible ? "erteilt" : "fehlt"}.
              Medien-Schreibscope:{" "}
              {a.xEvidence.mediaScopeEligible ? "erteilt" : "fehlt"}.
              Live-Publishing:{" "}
              {a.xEvidence.liveWrite === "verified"
                ? "belegt"
                : a.xEvidence.liveWrite === "blocked"
                  ? "blockiert"
                  : "noch nicht belegt"}
              .
            </p>
          )}
          {a.xEvidence?.errorCode && (
            <p className="text-sm">{xError(a.xEvidence.errorCode)}</p>
          )}
          {a.connection === "disconnected" && (
            <p className="text-sm muted">
              Der lokale Zugang wurde entfernt. Eine Remote-Widerrufung wurde
              nicht versucht. Entferne Dispatch bei Bedarf auch unter den
              verbundenen Apps in X. Eine bereits gestartete Provider-Anfrage
              kann noch abgeschlossen werden.
            </p>
          )}
          {admin && (
            <div className="flex gap-2 flex-wrap mt-3">
              <Button
                variant="outline"
                disabled={Boolean(busy) || !configuration?.configured}
                onClick={() =>
                  command(a.id, async () => {
                    const url = await start({
                      workspaceId,
                      accountId: a.id as Id<"socialAccounts">,
                    });
                    if (mounted.current) window.location.assign(url);
                  })
                }
              >
                Neu verbinden
              </Button>
              {a.connection === "connected" && (
                <Button
                  variant="outline"
                  disabled={Boolean(busy) || !configuration?.configured}
                  onClick={() =>
                    command(
                      a.id,
                      () =>
                        refresh({
                          workspaceId,
                          accountId: a.id as Id<"socialAccounts">,
                        }),
                      "Zugang serverseitig erneuert.",
                    )
                  }
                >
                  Zugang erneuern
                </Button>
              )}
              {a.connection !== "disconnected" && (
                <Button
                  variant="outline"
                  disabled={Boolean(busy)}
                  onClick={() =>
                    command(
                      a.id,
                      () =>
                        disconnect({
                          workspaceId,
                          accountId: a.id as Id<"socialAccounts">,
                        }),
                      "Lokal getrennt. Der X-Zugang wurde nicht remote widerrufen.",
                    )
                  }
                >
                  Trennen
                </Button>
              )}
            </div>
          )}
        </div>
      ))}
      <ol className="mt-5 list-decimal space-y-2 pl-5 text-sm">
        <li>
          Die Administration hinterlegt X_CLIENT_ID und X_CLIENT_SECRET für eine
          vertrauliche OAuth2-Web-App sowie SITE_URL als feste App-Adresse.
          Consumer-Keys und X_APP_BEARER_TOKEN ersetzen diesen User-Zugang
          nicht.
        </li>
        <li>
          INTEGRATION_ENCRYPTION_KEY enthält exakt 32 zufällige Bytes als
          Base64; INTEGRATION_ENCRYPTION_KEY_ID benennt den Schlüssel. Bei
          Rotation den bisherigen Schlüssel als
          INTEGRATION_ENCRYPTION_PREVIOUS_KEY und dessen ID als
          INTEGRATION_ENCRYPTION_PREVIOUS_KEY_ID behalten, bis alle Zugänge
          erneuert oder neu verbunden wurden.
        </li>
        <li>
          Den festen Callback{" "}
          {configuration?.redirectUri ? (
            <code>{configuration.redirectUri}</code>
          ) : (
            <code>SITE_URL/integrations/x/callback</code>
          )}{" "}
          in der X-App registrieren; tweet.read, users.read, tweet.write,
          offline.access und media.write ausdrücklich erlauben.{" "}
          {!admin
            ? "Owner/Admin kann Konfiguration und Verbindung verwalten."
            : configuration === null
              ? "Konfiguration wird geprüft …"
              : configuration.configured
                ? "Konfiguration vorhanden; Provider-Zugang noch separat prüfen."
                : "X-Konfiguration fehlt oder ist ungültig. Verbinden ist deshalb gesperrt."}
        </li>
        <li>
          Ein X-Account kann einem aktiven Publishing-Workspace gehören. Für
          einen Wechsel zuerst im bisherigen Workspace trennen, danach im neuen
          Workspace frisch autorisieren.
        </li>
      </ol>
      <p className="mt-4 text-xs muted">
        Hier werden keine Secrets angezeigt oder eingegeben. Erfolgreiche
        Live-OAuth-, Refresh- und Publishing-Prüfungen bleiben separate
        Abnahmeschritte.
      </p>
    </Section>
  );
}
export function XOAuthCallback() {
  const { state, nativeScope } = useStore();
  const complete = useAction(api.integrations.x.client.callback);
  const exchange = useOAuthCallback();
  const initialWorkspace = useRef(state.activeWorkspaceId);
  const [result, setResult] = useState<"pending" | "success" | "failed">(
    "pending",
  );
  const [error, setError] = useState("");
  useEffect(() => {
    let mounted = true;
    if (state.activeWorkspaceId !== initialWorkspace.current) {
      setResult("failed");
      setError(xError("X_WORKSPACE_CHANGED"));
      return;
    }
    exchange(nativeScope, (buffer) =>
      complete({
        workspaceId: initialWorkspace.current as Id<"workspaces">,
        ...buffer,
      }),
    )
      .then(() => {
        if (mounted) setResult("success");
      })
      .catch((e) => {
        if (mounted) {
          setResult("failed");
          setError(xError(e));
        }
      });
    return () => {
      mounted = false;
    };
  }, [exchange, complete, nativeScope, state.activeWorkspaceId]);
  return (
    <div className="p-12 stack">
      <h1 className="text-2xl font-semibold">X-Verbindung</h1>
      {result === "pending" ? (
        <p role="status">X-Autorisierung wird geprüft …</p>
      ) : result === "success" ? (
        <p role="status">
          X-Identität verbunden. Live-Publishing wurde noch nicht geprüft.
        </p>
      ) : (
        <p role="alert">{error}</p>
      )}
      <Button variant="outline" asChild>
        <Link to="/settings/integrations">Zu den Verbindungen</Link>
      </Button>
    </div>
  );
}
