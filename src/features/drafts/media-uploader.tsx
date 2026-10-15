import { useEffect, useRef, useState } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { mimeLimit } from "../../../convex/media/limits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { mediaError } from "./media-preview";
export function transferFile(
  url: string,
  file: File,
  onProgress: (progress: number) => void,
  signal: AbortSignal,
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const abort = () => xhr.abort();
    const finish = (error?: Error) => {
      signal.removeEventListener("abort", abort);
      error ? reject(error) : resolve();
    };
    xhr.open("PUT", url);
    xhr.timeout = 10 * 60 * 1000;
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable)
        onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () =>
      finish(
        xhr.status >= 200 && xhr.status < 300
          ? undefined
          : new Error("MEDIA_TRANSFER_FAILED"),
      );
    xhr.onerror = () => finish(new Error("MEDIA_TRANSFER_FAILED"));
    xhr.ontimeout = () => finish(new Error("MEDIA_TRANSFER_FAILED"));
    xhr.onabort = () => finish(new Error("MEDIA_UPLOAD_CANCELLED"));
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) {
      finish(new Error("MEDIA_UPLOAD_CANCELLED"));
      return;
    }
    xhr.send(file);
  });
}
export function MediaUploader({
  workspaceId,
  disabled,
}: {
  workspaceId: string;
  disabled: boolean;
}) {
  const prepare = useAction(api.media.r2.prepare),
    finish = useAction(api.media.r2.finish),
    remove = useMutation(api.media.uploads.remove);
  const [file, setFile] = useState<File | null>(null),
    [alt, setAlt] = useState(""),
    [progress, setProgress] = useState(0),
    [phase, setPhase] = useState(""),
    [error, setError] = useState("");
  const active = useRef<
    { controller: AbortController; assetId?: Id<"mediaAssets"> } | undefined
  >(undefined);
  const input = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      active.current?.controller.abort();
    };
  }, []);
  async function cancel() {
    const job = active.current;
    job?.controller.abort();
    if (job?.assetId)
      try {
        await remove({
          workspaceId: workspaceId as Id<"workspaces">,
          assetId: job.assetId,
        });
      } catch (e) {
        if (mounted.current) setError(mediaError(e));
      }
  }
  async function upload() {
    if (!file || !alt.trim()) return;
    const job = {
      controller: new AbortController(),
      assetId: undefined as Id<"mediaAssets"> | undefined,
    };
    active.current = job;
    setError("");
    setProgress(0);
    setPhase("Uploadberechtigung wird geprüft …");
    try {
      const s = await prepare({
        workspaceId: workspaceId as Id<"workspaces">,
        requestId: crypto.randomUUID(),
        name: file.name,
        size: file.size,
        mime: file.type,
        alt,
      });
      job.assetId = s.assetId;
      if (job.controller.signal.aborted) {
        await remove({
          workspaceId: workspaceId as Id<"workspaces">,
          assetId: s.assetId,
        });
        return;
      }
      setPhase("Datei wird direkt übertragen …");
      await transferFile(
        s.uploadUrl,
        file,
        (p) => {
          if (mounted.current) setProgress(p);
        },
        job.controller.signal,
      );
      if (job.controller.signal.aborted) return;
      setPhase("Gespeicherte Bytes werden geprüft …");
      await finish({
        workspaceId: workspaceId as Id<"workspaces">,
        sessionId: s.sessionId,
      });
      if (mounted.current && !job.controller.signal.aborted) {
        if (input.current?.files?.[0] === file) {
          input.current.value = "";
          setFile(null);
          setAlt("");
        }
        setPhase("Datei geprüft und gespeichert.");
      }
    } catch (e) {
      if (job.controller.signal.aborted && job.assetId) {
        try {
          await remove({
            workspaceId: workspaceId as Id<"workspaces">,
            assetId: job.assetId,
          });
        } catch {
          /* Cleanup of abandoned sessions is durable. */
        }
      }
      if (mounted.current) setError(mediaError(e));
    } finally {
      if (active.current === job) active.current = undefined;
      if (mounted.current)
        setPhase((p) => (p === "Datei geprüft und gespeichert." ? p : ""));
    }
  }
  const busy = !!active.current;
  const valid = file && file.size > 0 && file.size <= mimeLimit(file.type);
  return (
    <div className="space-y-3">
      <label className="block">
        <span className="field-label">Datei auswählen</span>
        <Input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/gif,video/mp4"
          disabled={disabled || busy}
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setError("");
          }}
        />
      </label>
      <label className="block">
        <span className="field-label">Alternativtext für die Mediathek</span>
        <Textarea
          value={alt}
          maxLength={1000}
          disabled={disabled || busy}
          onChange={(e) => setAlt(e.target.value)}
          placeholder="Beschreibe den relevanten Bildinhalt."
        />
      </label>
      <p className="muted text-xs">
        JPEG/PNG (ohne Interlacing) bis 5 MiB · GIF bis 15 MiB · MP4 (H.264/AAC)
        bis 32 MiB. Dispatch begrenzt Videos auf 140 Sekunden und 1080p. Keine
        Clip-Erstellung oder Transkription.
      </p>
      {file && !valid && (
        <p role="alert" className="text-destructive text-sm">
          Dateiformat oder Größe wird nicht unterstützt.
        </p>
      )}
      {busy && <Progress value={progress} aria-label="Uploadfortschritt" />}
      {phase && (
        <p role="status" className="text-sm">
          {phase}
        </p>
      )}
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button
          disabled={disabled || busy || !valid || !alt.trim()}
          onClick={() => void upload()}
        >
          Datei hochladen
        </Button>
        {busy && (
          <Button variant="outline" onClick={() => void cancel()}>
            Abbrechen
          </Button>
        )}
      </div>
    </div>
  );
}
