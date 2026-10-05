import { useEffect, useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { MediaAsset } from "@/lib/model";
import { demoMode } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
export function mediaError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const messages: Record<string, string> = {
    MEDIA_CONFIGURATION_REQUIRED:
      "EU-R2 ist noch nicht konfiguriert. In der Medienbibliothek findest du die erforderliche EU-Bucket-Bindung und Browser-CORS-Einrichtung.",
    MEDIA_BINDING_RECONCILIATION_REQUIRED:
      "Für dieses ältere Medium fehlt die Account-/Bucket-Bindung. Vor Vorschau, Finalisierung oder Bereinigung muss die ursprüngliche EU-R2-Zuordnung manuell abgeglichen werden.",
    MEDIA_VALIDATION_FAILED:
      "Die gespeicherten Bytes sind ungültig oder überschreiten Format-, Größen- oder Dimensionsgrenzen. Datei prüfen und neu hochladen.",
    MEDIA_VALIDATION_IN_PROGRESS:
      "Die Finalisierung läuft oder wird wiederaufgenommen. Bei einer Unterbrechung nach elf Minuten erneut prüfen.",
    MEDIA_STORAGE_RETRY_REQUIRED:
      "R2-Abgleich wurde unterbrochen. Das finale Objekt bleibt geschützt. Nach elf Minuten mit „Finalisierung prüfen“ fortsetzen.",
    MEDIA_REFERENCED:
      "Dieses Medium wird von einer unveränderlichen Inhaltsversion verwendet und kann nicht gelöscht werden.",
    MEDIA_LEGACY_REFERENCE_REVIEW:
      "Dieses ältere Medium benötigt vor einer Löschung einen Referenzabgleich.",
    MEDIA_QUOTA_EXCEEDED:
      "Das Workspace-Kontingent von 512 MiB oder 500 Assets ist erreicht. Nicht referenzierte Medien löschen.",
    ROLE_ACCESS_DENIED: "Deine aktuelle Rolle erlaubt diese Aktion nicht.",
    REFERENCE_ACCESS_DENIED: "Das Medium gehört nicht zu diesem Workspace.",
    WORKSPACE_INACTIVE: "Dieser Workspace wird gelöscht oder ist gesperrt.",
    UPLOAD_SESSION_CLOSED: "Upload wurde abgebrochen, abgelehnt oder gelöscht.",
    UPLOAD_SESSION_EXPIRED:
      "Uploadberechtigung ist abgelaufen. Datei erneut hochladen.",
    MEDIA_UPLOAD_CANCELLED:
      "Upload abgebrochen. Temporäre Bytes werden nach Ablauf der Berechtigung bereinigt.",
    UPLOAD_BYTES_MISSING:
      "R2 enthält noch keine vollständig übertragenen Bytes. Upload prüfen.",
    INVALID_ALT:
      "Ein Alternativtext mit höchstens 1000 Zeichen ist erforderlich.",
    MEDIA_NOT_READY:
      "Dieses Medium ist noch nicht geprüft oder nicht mehr verfügbar.",
    MEDIA_TRANSFER_FAILED:
      "Übertragung fehlgeschlagen. Verbindung, EU-Bucket und Browser-CORS prüfen. Danach Datei erneut hochladen.",
  };
  return (
    Object.entries(messages).find(([code]) => message.includes(code))?.[1] ??
    "Medienaktion fehlgeschlagen. Zugriff und Verbindung prüfen; es wurde kein Erfolg bestätigt."
  );
}
function CloudPreview({
  asset,
  className,
}: {
  asset: MediaAsset;
  className?: string;
}) {
  const preview = useAction(api.media.r2.preview);
  const [url, setUrl] = useState(""),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true,
      timer: ReturnType<typeof setTimeout> | undefined;
    setUrl("");
    setError("");
    async function refresh() {
      try {
        const result = await preview({
          workspaceId: asset.workspaceId as Id<"workspaces">,
          assetId: asset.id as Id<"mediaAssets">,
        });
        if (active) {
          setUrl(result.url);
          setError("");
          timer = setTimeout(
            () => void refresh(),
            Math.max(1000, result.expiresAt - Date.now() - 10000),
          );
        }
      } catch (e) {
        if (active) {
          setUrl("");
          setError(mediaError(e));
        }
      }
    }
    if (asset.status === "ready") void refresh();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [asset.workspaceId, asset.id, asset.status, preview, retry]);
  if (error)
    return (
      <div className={className}>
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setRetry((x) => x + 1)}
        >
          Vorschau erneuern
        </Button>
      </div>
    );
  if (!url)
    return (
      <div className={className} role="status">
        {asset.status === "ready"
          ? "Vorschau wird geladen …"
          : "Medium noch nicht bereit"}
      </div>
    );
  return asset.type === "video" ? (
    <video
      src={url}
      controls
      preload="metadata"
      aria-label={asset.alt || asset.name}
      className={className}
      onError={() =>
        setError(
          "Die Vorschau konnte nicht geladen werden. Zugriff und Format prüfen.",
        )
      }
    />
  ) : (
    <img
      src={url}
      alt={asset.alt || asset.name}
      className={className}
      onError={() =>
        setError(
          "Die Vorschau konnte nicht geladen werden. Zugriff und Format prüfen.",
        )
      }
    />
  );
}
export function MediaPreview({
  asset,
  className,
}: {
  asset: MediaAsset;
  className?: string;
}) {
  if (!demoMode)
    return (
      <CloudPreview
        key={`${asset.workspaceId}:${asset.id}`}
        asset={asset}
        className={className}
      />
    );
  return asset.type === "video" ? (
    <video
      src={asset.url}
      controls
      preload="metadata"
      aria-label={asset.alt || asset.name}
      className={className}
    />
  ) : (
    <img src={asset.url} alt={asset.alt} className={className} />
  );
}
