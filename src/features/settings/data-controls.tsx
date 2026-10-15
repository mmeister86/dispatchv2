import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Section } from "@/components/shared";

export function DeletionProgress() {
  const jobs = useQuery(api.operations.deletion.mine, {});
  const resume = useMutation(api.operations.deletion.resume);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const active = jobs?.find((j) => j.state !== "complete");
  if (!active) return null;
  return (
    <Section
      title="Löschung läuft"
      description="Die betroffenen Daten sind gesperrt. Der Fortschritt bleibt nach einem Neuladen erhalten."
    >
      <p role="status">
        {active.scope === "account" ? "Konto" : "Workspace"}: {active.phase} ·{" "}
        {active.processed} Einträge verarbeitet
      </p>
      {active.reason && (
        <p>
          {
            {
              "in-flight": "Laufende Arbeit wird beendet.",
              "external-outcome":
                "Ein externer Vorgang muss zuerst abgeglichen werden.",
              "object-cleanup": "Gespeicherte Dateien werden entfernt.",
              "component-proof":
                "Die Bereinigung gespeicherter Agent- oder Workflow-Daten benötigt einen sicheren Nachweis.",
              "scope-discovery": "Der Datenumfang wird geprüft.",
              "retry-required": "Die Bereinigung muss erneut gestartet werden.",
            }[active.reason]
          }
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      {active.canResume && (
        <Button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await resume({ jobId: active.id });
            } catch {
              setError(
                "Löschung konnte nicht fortgesetzt werden. Bitte erneut versuchen.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          Löschung fortsetzen
        </Button>
      )}
      <Button variant="outline" onClick={() => void authClient.signOut()}>
        Abmelden
      </Button>
    </Section>
  );
}

export function NativeDataControls({
  workspaceId,
  name,
  owner,
}: {
  workspaceId: string;
  name: string;
  owner: boolean;
}) {
  const preview = useQuery(api.operations.deletion.accountPreview, {});
  const workspace = useQuery(
    api.operations.deletion.workspacePreview,
    owner ? { workspaceId: workspaceId as Id<"workspaces"> } : "skip",
  );
  const beginAccount = useMutation(api.operations.deletion.beginAccount);
  const beginWorkspace = useMutation(api.operations.deletion.beginWorkspace);
  const [scope, setScope] = useState<"account" | "workspace">("account");
  const [typed, setTyped] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const token = scope === "account" ? "KONTO LÖSCHEN" : name;
  const sole = preview?.workspaces.filter((w) => w.soleOwner) ?? [];
  const deleteData = async () => {
    if (
      busy ||
      typed !== token ||
      !preview ||
      (scope === "workspace" && !workspace)
    )
      return;
    setBusy(true);
    setError("");
    try {
      const commandKey = crypto.randomUUID();
      if (scope === "workspace")
        await beginWorkspace({
          workspaceId: workspaceId as Id<"workspaces">,
          expectedTeamRevision: workspace!.teamRevision,
          confirmation: "delete-workspace",
          commandKey,
        });
      else
        await beginAccount({
          confirmation: "delete-account",
          commandKey,
          deleteWorkspaces: sole
            .filter((w) => selected.includes(w.workspaceId))
            .map((w) => ({
              workspaceId: w.workspaceId,
              expectedTeamRevision: w.teamRevision,
            })),
        });
    } catch {
      if (alive.current)
        setError(
          "Löschung konnte nicht gestartet werden. Prüfe die Workspace-Auswahl und versuche es erneut.",
        );
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  return (
    <Section
      title="Daten löschen"
      description="Eine bestätigte Löschung sperrt den gewählten Umfang sofort und kann danach nicht rückgängig gemacht werden."
    >
      <p>
        Betriebliche Diagnose- und Ausführungskopien werden höchstens 30 Tage
        aufbewahrt. Gespeicherte Inhalte und Kalibrierungsnachweise behalten
        ihre zweckgebundenen Fristen; entfernte oder abgelaufene Quellen werden
        früher gesperrt. Notwendige inhaltsfreie Sperren bleiben für offene
        Veröffentlichungen, Abrechnungen oder Uploads bis zum sicheren Abgleich
        erhalten.
      </p>
      <p>
        Provider-Kopien und Backups werden getrennt aufbewahrt. Das Entfernen
        einer Integration löscht keine bereits öffentlichen Posts. Ein Backup
        darf entfernte Inhalte nicht wieder aktivieren.
      </p>
      <div className="flex gap-2">
        <Button
          variant={scope === "account" ? "default" : "outline"}
          onClick={() => {
            setScope("account");
            setTyped("");
          }}
        >
          Eigenes Konto
        </Button>
        {owner && (
          <Button
            variant={scope === "workspace" ? "default" : "outline"}
            onClick={() => {
              setScope("workspace");
              setTyped("");
            }}
          >
            Workspace
          </Button>
        )}
      </div>
      {scope === "account" && sole.length > 0 && (
        <div className="stack">
          <p>
            Du bist alleiniger Owner dieser Workspaces. Übergib die Owner-Rolle
            zuvor in den Teameinstellungen oder wähle ihre vollständige
            Löschung:
          </p>
          {sole.map((w) => (
            <label key={w.workspaceId} className="flex gap-2">
              <input
                type="checkbox"
                checked={selected.includes(w.workspaceId)}
                onChange={(e) =>
                  setSelected((old) =>
                    e.target.checked
                      ? [...old, w.workspaceId]
                      : old.filter((id) => id !== w.workspaceId),
                  )
                }
              />
              {w.name} vollständig löschen
            </label>
          ))}
        </div>
      )}
      {scope === "account" && (
        <p>
          Andere gemeinsame Workspaces bleiben erhalten; deine Mitgliedschaften
          werden entfernt.
        </p>
      )}
      <label className="stack">
        Zur Bestätigung „{token}“ eingeben
        <Input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
        />
      </label>
      {error && <p role="alert">{error}</p>}
      <Button
        variant="destructive"
        disabled={
          busy ||
          typed !== token ||
          !preview ||
          (scope === "account" &&
            sole.some((w) => !selected.includes(w.workspaceId))) ||
          (scope === "workspace" && !workspace)
        }
        onClick={() => void deleteData()}
      >
        {busy ? "Löschung wird gestartet …" : "Dauerhaft löschen"}
      </Button>
    </Section>
  );
}
