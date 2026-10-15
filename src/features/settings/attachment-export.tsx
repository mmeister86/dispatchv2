import { useEffect, useRef, useState } from "react";
import { useConvex } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { authClient } from "@/lib/auth-client";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Section } from "@/components/shared";
type Attachment = { kind: "stored" | "inline"; index: number };
export function NativeAttachmentExport() {
  const { state, nativeScope } = useStore(),
    { data: session } = authClient.useSession(),
    convex = useConvex();
  const [kind, setKind] = useState<"conversation" | "research">("conversation"),
    [id, setId] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [status, setStatus] = useState("");
  const [rows, setRows] = useState<
    FunctionReturnType<typeof api.operations.exportAttachments.list>["rows"]
  >([]);
  const page = useRef({ cursor: null as string | null, done: false });
  const scope = `${nativeScope}:${session?.user.id}:${session?.session.id}:${state.activeWorkspaceId}:${state.activeAccountId}:${state.role}:${kind}:${id}`;
  const owner = useRef({ scope, epoch: 0 });
  if (owner.current.scope !== scope)
    owner.current = { scope, epoch: owner.current.epoch + 1 };
  const alive = useRef(false),
    inFlight = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    page.current = { cursor: null, done: false };
    inFlight.current = false;
    setBusy(false);
    setRows([]);
    setError("");
    setStatus("");
  }, [scope]);
  const base = () => ({
    workspaceId: state.activeWorkspaceId as Id<"workspaces">,
    expectedAuthId: session!.user.id,
    expectedSessionId: session!.session.id,
    requestKey: crypto.randomUUID(),
    parent:
      kind === "conversation"
        ? {
            kind,
            accountId: state.activeAccountId as Id<"socialAccounts">,
            conversationId: id as Id<"conversations">,
          }
        : { kind, orderId: id as Id<"researchOrders"> },
  });
  const execute = async (messageId?: string, attachment?: Attachment) => {
    if (!session || !id || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    setStatus("");
    const epoch = owner.current.epoch,
      deadline = Date.now() + 120000;
    const valid = () =>
      alive.current && owner.current.epoch === epoch && Date.now() < deadline;
    const a = base();
    const matches = (r: {
      authId: string;
      sessionId: string;
      requestKey: string;
      workspaceId: string;
      role: string;
      proofValidUntil: number;
    }) =>
      r.authId === a.expectedAuthId &&
      r.sessionId === a.expectedSessionId &&
      r.requestKey === a.requestKey &&
      r.workspaceId === a.workspaceId &&
      r.role === state.role &&
      r.proofValidUntil > Date.now();
    try {
      if (!messageId || !attachment) {
        const r = await convex.query(api.operations.exportAttachments.list, {
          ...a,
          cursor: page.current.cursor,
        });
        if (!valid()) return;
        if (!matches(r)) throw Error("scope changed");
        page.current = { cursor: r.cursor, done: r.isDone };
        setRows(r.rows);
        setStatus(
          r.isDone
            ? "Letzte Nachrichtenseite erreicht."
            : "Nachrichtenseite geladen. Weitere Seiten sind verfügbar.",
        );
        return;
      }
      let offset = 0,
        checksum: string | null = null,
        size = 0,
        name = "attachment",
        mime = "application/octet-stream";
      const chunks: ArrayBuffer[] = [];
      for (let i = 0; i < 16; i++) {
        const r: FunctionReturnType<
          typeof api.operations.exportAttachmentBytes.read
        > = await convex.action(api.operations.exportAttachmentBytes.read, {
          ...a,
          messageId,
          attachment,
          offset,
          expectedChecksum: checksum,
        });
        if (!valid()) return;
        if (
          !matches(r) ||
          r.messageId !== messageId ||
          r.attachment.kind !== attachment.kind ||
          r.attachment.index !== attachment.index ||
          r.offset !== offset ||
          !(r.bytes instanceof ArrayBuffer) ||
          r.bytes.byteLength > 512 * 1024 ||
          !Number.isSafeInteger(r.size) ||
          r.size < 0 ||
          r.size > 8 * 1024 * 1024 ||
          r.nextOffset !== offset + r.bytes.byteLength ||
          r.nextOffset > r.size ||
          r.done !== (r.nextOffset === r.size) ||
          (checksum !== null &&
            (r.checksum !== checksum ||
              r.size !== size ||
              r.name !== name ||
              r.mime !== mime))
        )
          throw Error("invalid bytes");
        checksum = r.checksum;
        size = r.size;
        name = r.name;
        mime = r.mime;
        offset = r.nextOffset;
        chunks.push(r.bytes);
        if (r.done) break;
      }
      if (!checksum || offset !== size) throw Error("incomplete file");
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
        api.operations.exportAttachments.verify,
        { ...a, messageId, attachment, expectedChecksum: checksum },
      );
      if (!valid()) return;
      if (
        !matches(final) ||
        final.checksum !== checksum ||
        final.size !== size ||
        final.name !== name ||
        final.mime !== mime
      )
        throw Error("scope changed");
      const url = URL.createObjectURL(blob),
        link = document.createElement("a");
      link.href = url;
      link.download =
        name.replace(/[\x00-\x1f/\\]/g, "_").slice(0, 180) || "attachment";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus("Originalanhang mit geprüfter Prüfsumme heruntergeladen.");
    } catch {
      if (alive.current && owner.current.epoch === epoch)
        setError(
          "Anhang konnte nicht sicher exportiert werden: Rechte, Quellenfrist, Originaldatei oder Größe prüfen.",
        );
    } finally {
      if (alive.current && owner.current.epoch === epoch) {
        inFlight.current = false;
        setBusy(false);
      }
    }
  };
  return (
    <Section
      title="Eigene Agent-Anhänge"
      description="Nachrichtenweise Übersicht eigener Chat- oder Research-Anhänge. Gespeicherte Originale bis 8 MiB, eingebettete Dateien bis 64 KiB; externe Referenzen werden angezeigt und nicht abgerufen."
    >
      <label htmlFor="attachment-kind">Quelle</label>
      <select
        id="attachment-kind"
        value={kind}
        onChange={(e) => setKind(e.target.value as typeof kind)}
      >
        <option value="conversation">Eigener Chat</option>
        <option value="research">Eigener Research-Auftrag</option>
      </select>
      <label htmlFor="attachment-id">
        {kind === "conversation" ? "Chat-ID" : "Auftrags-ID"} aus dem
        Metadatenarchiv
      </label>
      <Input
        id="attachment-id"
        value={id}
        onChange={(e) => setId(e.target.value.trim())}
      />
      <Button
        variant="outline"
        disabled={busy || !session || !id || page.current.done}
        onClick={() => void execute()}
      >
        Nächste Nachrichtenseite laden
      </Button>
      {rows.map((row) => (
        <div key={row.messageId}>
          <p>Nachricht {row.messageId}</p>
          {Array.from({ length: row.stored }, (_, index) => (
            <Button
              key={`stored-${index}`}
              variant="outline"
              disabled={busy}
              onClick={() =>
                void execute(row.messageId, { kind: "stored", index })
              }
            >
              Gespeicherten Anhang {index + 1} herunterladen
            </Button>
          ))}
          {row.inline.map((part) =>
            part.disposition === "inline" ? (
              <Button
                key={part.index}
                variant="outline"
                disabled={busy}
                onClick={() =>
                  void execute(row.messageId, {
                    kind: "inline",
                    index: part.index,
                  })
                }
              >
                Eingebetteten Anhang {part.index + 1} herunterladen
              </Button>
            ) : (
              <p key={part.index}>
                {part.disposition === "stored-reference"
                  ? "Referenz auf einen gespeicherten Anhang."
                  : "Externe oder nicht belegbare Referenz: kein Originalabruf verfügbar."}
              </p>
            ),
          )}
        </div>
      ))}
      {busy && <p role="status">Export läuft …</p>}
      {status && <p role="status">{status}</p>}
      {error && <p role="alert">{error}</p>}
    </Section>
  );
}
