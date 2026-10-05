import { useQuery, useMutation } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useStore } from "@/lib/store";
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
      <ModelRuns key={state.activeWorkspaceId} />
    </>
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
