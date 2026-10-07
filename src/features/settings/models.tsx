import { useQuery, useMutation } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useStore } from "@/lib/store";
import { useNativeCommand } from "@/features/drafts/review";
import { Section } from "@/components/shared";

export function ModelConfiguration() {
  const { state } = useStore();
  const availability = useQuery(api.ai.runs.availability, {
    workspaceId: state.activeWorkspaceId as Id<"workspaces">,
  });
  return (
    <>
      <Section
        title="Modellzugang"
        description="Generation, Embeddings und semantische Bewertung werden getrennt freigegeben."
      >
        {!availability ? (
          <p role="status">Modellkonfiguration wird geladen …</p>
        ) : (
          <div className="stack text-sm" role="status">
            <p>
              Generation ist noch nicht freigegeben. Es wird kein Modell
              aufgerufen.
            </p>
            <p>
              Provider-Zugang:{" "}
              {availability.providerConfigured
                ? "hinterlegt"
                : "REQUESTY_API_KEY fehlt"}
              .
            </p>
            <p>
              Verarbeitungszwecke und vollständiger EU-Datenpfad:{" "}
              {availability.processingApproved
                ? "Nachweis hinterlegt"
                : "Bestätigung erforderlich"}
              .
            </p>
            <p>
              Versioniertes Kostenmodell und getrennte Provider-, Workspace- und
              Account-Budgets:{" "}
              {availability.pricingApproved
                ? "Preisnachweis hinterlegt; Budgetfreigabe separat prüfen"
                : "Freigabe erforderlich"}
              .
            </p>
            <p className="muted">
              Embeddings und Jev-Bewertung sind deaktiviert. Kundendaten werden
              durch diese Ansicht nicht übertragen.
            </p>
          </div>
        )}
      </Section>
      <JevConfiguration
        key={`${state.activeWorkspaceId}:${state.activeAccountId}`}
      />
      <RoutingConfiguration
        key={`routing:${state.activeWorkspaceId}:${state.activeAccountId}`}
      />
      <ModelRuns key={state.activeWorkspaceId} />
    </>
  );
}

function JevConfiguration() {
  const { state } = useStore();
  const account = state.accounts.find(
    (a) =>
      a.id === state.activeAccountId &&
      a.workspaceId === state.activeWorkspaceId,
  );
  const availability = useQuery(
    api.ai.jev.access.availability,
    account
      ? {
          workspaceId: state.activeWorkspaceId as Id<"workspaces">,
          accountId: account.id as Id<"socialAccounts">,
        }
      : "skip",
  );
  const disable = useMutation(api.ai.jev.access.disable);
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  return (
    <Section
      title="Jev-Bewertung"
      description="Analyse wird für jeden Account separat freigegeben."
    >
      {!account ? (
        <p>Account auswählen, um den Analysezugang zu prüfen.</p>
      ) : !availability ? (
        <p role="status">Analysekonfiguration wird geladen …</p>
      ) : (
        <div className="stack text-sm" role="status">
          <p>
            {availability.status === "disabled"
              ? "Jev-Bewertung ist deaktiviert."
              : availability.status === "unavailable"
                ? "Jev-Bewertung ist vorübergehend nicht verfügbar."
                : "Jev-Bewertung benötigt Konfiguration."}
          </p>
          <p>{availability.guidance}</p>
          {availability.status !== "disabled" &&
            ["Owner", "Admin"].includes(state.role) && (
              <Button
                variant="outline"
                disabled={pending}
                onClick={async () => {
                  setPending(true);
                  setError("");
                  try {
                    await disable({
                      workspaceId: state.activeWorkspaceId as Id<"workspaces">,
                      accountId: account.id as Id<"socialAccounts">,
                    });
                  } catch {
                    setError(
                      "Analysezugang konnte nicht deaktiviert werden. Erneut versuchen.",
                    );
                  } finally {
                    setPending(false);
                  }
                }}
              >
                {pending ? "Wird deaktiviert …" : "Jev-Bewertung deaktivieren"}
              </Button>
            )}
        </div>
      )}
      {error && <p role="alert">{error}</p>}
    </Section>
  );
}

function ModelRuns() {
  const { state } = useStore();
  const workspaceId = state.activeWorkspaceId as Id<"workspaces">;
  const runs = useQuery(api.ai.runs.recent, { workspaceId });
  const stop = useMutation(api.ai.runs.stop);
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const labels = {
    ready: "bereit",
    running: "gestartet",
    completed: "abgeschlossen",
    failed: "fehlgeschlagen",
    stopped: "abgebrochen",
  };
  return (
    <Section
      title="Modellläufe"
      description="Letzte zehn gespeicherte Läufe dieses Workspace. Usage-Schätzungen sind keine Anbieterrechnung."
    >
      {!runs ? (
        <p role="status">Läufe werden geladen …</p>
      ) : !runs.length ? (
        <p className="muted">Noch keine Modellläufe registriert.</p>
      ) : (
        runs.map((run) => (
          <div
            className="flex items-center justify-between gap-4 border-b py-4 text-sm"
            key={run.runId}
          >
            <div>
              <p>
                {run.purpose} · Gespeicherter Status: {labels[run.state]}
              </p>
              <p className="muted">
                {run.attempts} Anbieter-Versuche ·{" "}
                {run.estimatedMicros === null
                  ? "Kosten noch nicht verfügbar"
                  : `${(run.estimatedMicros / 1e6).toFixed(6)} ${run.currency} geschätzt`}
                {run.usagePending
                  ? " · Offener Kostenbeleg bleibt reserviert"
                  : ""}
              </p>
            </div>
            {(run.state === "ready" || run.state === "running") &&
              ["Owner", "Admin", "Editor"].includes(state.role) && (
                <Button
                  variant="outline"
                  disabled={!!pending}
                  onClick={async () => {
                    setPending(run.runId);
                    setError("");
                    try {
                      await stop({ workspaceId, runId: run.runId });
                    } catch {
                      if (mounted.current)
                        setError(
                          "Abbruch konnte nicht gespeichert werden. Erneut versuchen.",
                        );
                    } finally {
                      if (mounted.current) setPending("");
                    }
                  }}
                >
                  {pending === run.runId
                    ? "Abbruch wird gespeichert …"
                    : "Lauf abbrechen"}
                </Button>
              )}
          </div>
        ))
      )}
      {error && <p role="alert">{error}</p>}
    </Section>
  );
}

function RoutingConfiguration() {
  const { state, nativeScope } = useStore();
  const account = state.accounts.find(
    (a) =>
      a.id === state.activeAccountId &&
      a.workspaceId === state.activeWorkspaceId,
  );
  const availability = useQuery(
    api.ai.jev.routing.availability,
    account
      ? {
          workspaceId: state.activeWorkspaceId as Id<"workspaces">,
          accountId: account.id as Id<"socialAccounts">,
        }
      : "skip",
  );
  const disable = useMutation(api.ai.jev.routing.disable);
  const command = useNativeCommand(`${nativeScope}:${account?.id}`);
  const admin = ["Owner", "Admin"].includes(state.role);
  const [message, setMessage] = useState("");
  useEffect(() => setMessage(""), [nativeScope, account?.id]);
  async function withdraw(call?: () => Promise<unknown>) {
    if (!account || !admin) return;
    const args = {
      workspaceId: state.activeWorkspaceId as Id<"workspaces">,
      accountId: account.id as Id<"socialAccounts">,
    };
    if (await command.execute(call ?? (() => disable(args))))
      setMessage("Routing-Zugang für diesen Account ausdrücklich entzogen.");
  }
  return (
    <Section
      title="Intent-Routing"
      description="Strategiezuordnung und Generation benötigen getrennte Freigaben."
    >
      {!account ? (
        <p>Account auswählen, um Intent-Routing zu prüfen.</p>
      ) : !availability ? (
        <p role="status">Routing-Konfiguration wird geladen …</p>
      ) : (
        <div className="stack text-sm">
          <p role="status">
            {availability.status === "ready"
              ? "Intent-Routing ist konfiguriert. Jede Anfrage prüft ihre aktuellen Freigaben."
              : "Intent-Routing benötigt Konfiguration."}
          </p>
          <p className="muted">
            Der neue Verarbeitungszweck ist standardmäßig aus. Fehlende oder
            unvollständige Freigaben erlauben keinen Klassifikationsaufruf. Eine
            ausdrückliche menschliche Auswahl bleibt möglich; alle neun
            Strategien verwenden den vorhandenen generischen
            Perspektivengenerator.
          </p>
          {admin && (
            <Button
              variant="outline"
              disabled={command.locked}
              onClick={() => void withdraw()}
            >
              {command.busy
                ? "Routing-Zugang wird entzogen …"
                : "Routing-Zugang für Account entziehen"}
            </Button>
          )}
        </div>
      )}
      {command.error && <p role="alert">{command.error}</p>}
      {command.retry && admin && (
        <Button
          variant="outline"
          disabled={command.busy}
          onClick={() => void withdraw(command.retry!)}
        >
          Denselben Routing-Entzug wiederholen
        </Button>
      )}
      {command.conflict && (
        <Button variant="outline" onClick={command.reviewCurrent}>
          Aktuellen Routing-Zugang prüfen
        </Button>
      )}
      {message && <p role="status">{message}</p>}
    </Section>
  );
}
