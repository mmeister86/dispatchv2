import { useEffect, useRef, useState } from "react";
import { useConvex } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import { authClient } from "@/lib/auth-client";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/shared";

export function NativeMediaExport() {
  const { state, nativeScope, hasMoreMedia, loadMoreMedia } = useStore();
  const { data: session } = authClient.useSession();
  const convex = useConvex();
  const scope = `${nativeScope}:${session?.user.id}:${session?.session.id}:${state.activeWorkspaceId}:${state.activeAccountId}:${state.role}`;
  const current = useRef({ scope, epoch: 0 });
  if (current.current.scope !== scope)
    current.current = { scope, epoch: current.current.epoch + 1 };
  const inFlight = useRef(false);
  const alive = useRef(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    inFlight.current = false;
    setBusy("");
    setError("");
    setStatus("");
  }, [scope]);
  const download = async (assetId: string) => {
    if (
      inFlight.current ||
      !session ||
      !["Owner", "Admin"].includes(state.role)
    )
      return;
    inFlight.current = true;
    const owner = current.current.epoch,
      deadline = Date.now() + 120000;
    const valid = () =>
      alive.current && current.current.epoch === owner && Date.now() < deadline;
    setBusy(assetId);
    setError("");
    setStatus("");
    try {
      const args = {
        workspaceId: state.activeWorkspaceId as Id<"workspaces">,
        expectedAuthId: session.user.id,
        expectedSessionId: session.session.id,
        requestKey: crypto.randomUUID(),
        selection: {
          kind: "asset" as const,
          assetId: assetId as Id<"mediaAssets">,
        },
      };
      let checksum: string | null = null,
        offset = 0,
        size = 0,
        mime = "",
        name = "";
      const chunks: ArrayBuffer[] = [];
      while (valid() && chunks.length < 64) {
        const r: FunctionReturnType<
          typeof api.operations.exportMedia.readOriginal
        > = await convex.action(api.operations.exportMedia.readOriginal, {
          ...args,
          expectedChecksum: checksum,
          offset,
        });
        if (!valid()) return;
        if (
          r.authId !== args.expectedAuthId ||
          r.sessionId !== args.expectedSessionId ||
          r.requestKey !== args.requestKey ||
          r.workspaceId !== args.workspaceId ||
          r.assetId !== args.selection.assetId ||
          r.role !== state.role ||
          r.offset !== offset ||
          !(r.bytes instanceof ArrayBuffer) ||
          r.bytes.byteLength < 1 ||
          r.bytes.byteLength > 512 * 1024 ||
          !Number.isSafeInteger(r.size) ||
          r.size < 1 ||
          r.size > 32 * 1024 * 1024 ||
          r.proofValidUntil <= Date.now() ||
          r.nextOffset !== offset + r.bytes.byteLength ||
          r.nextOffset > r.size ||
          r.done !== (r.nextOffset === r.size) ||
          (checksum !== null &&
            (checksum !== r.checksum ||
              size !== r.size ||
              mime !== r.mime ||
              name !== r.name))
        )
          throw Error("invalid media response");
        checksum = r.checksum;
        size = r.size;
        mime = r.mime;
        name = r.name;
        chunks.push(r.bytes);
        offset = r.nextOffset;
        if (r.done) break;
      }
      if (!valid()) return;
      if (offset !== size || !checksum) throw Error("incomplete media");
      const blob = new Blob(chunks, { type: mime });
      const digest = Array.from(
        new Uint8Array(
          await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()),
        ),
        (b) => b.toString(16).padStart(2, "0"),
      ).join("");
      if (!valid()) return;
      if (digest !== checksum) throw Error("checksum mismatch");
      const final = await convex.query(
        api.operations.exportMediaSource.verify,
        { ...args, expectedChecksum: checksum },
      );
      if (!valid()) return;
      if (
        final.size !== size ||
        final.role !== state.role ||
        final.checksum !== checksum ||
        final.requestKey !== args.requestKey ||
        final.authId !== args.expectedAuthId ||
        final.sessionId !== args.expectedSessionId ||
        final.proofValidUntil <= Date.now()
      )
        throw Error("scope changed");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download =
        name.replace(/[\x00-\x1f/\\]/g, "_").slice(0, 180) || "original";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus("Originaldatei mit geprüfter Prüfsumme heruntergeladen.");
    } catch {
      if (valid())
        setError(
          "Originaldatei konnte nicht sicher heruntergeladen werden. Bitte erneut versuchen.",
        );
    } finally {
      if (alive.current && current.current.epoch === owner) {
        inFlight.current = false;
        setBusy("");
      }
    }
  };
  return (
    <Section
      title="Originalmedien"
      description="Jeweils eine Originaldatei, bis 32 MiB. Rechte und Prüfsumme werden vor dem Download geprüft."
    >
      <p>
        Der vollständige paginierte Metadatenexport steht unter den Archiven
        bereit. Lade bei Bedarf weitere Dateien in diese Übersicht.
      </p>
      {state.media
        .filter((m) => m.status === "ready")
        .map((m) => (
          <div key={m.id} className="flex items-center justify-between gap-3">
            <span>{m.name}</span>
            <Button
              variant="outline"
              disabled={!!busy}
              onClick={() => void download(m.id)}
            >
              {busy === m.id ? "Download läuft …" : "Original herunterladen"}
            </Button>
          </div>
        ))}
      {hasMoreMedia && (
        <Button variant="outline" disabled={!!busy} onClick={loadMoreMedia}>
          Weitere Dateien laden
        </Button>
      )}
      {status && <p role="status">{status}</p>}
      {error && <p role="alert">{error}</p>}
    </Section>
  );
}
