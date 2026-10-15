import { httpAction } from "../../_generated/server";
import { internal } from "../../_generated/api";
import type { Infer } from "convex/values";
import { facts } from "./signalFields";
export const MAX_BODY = 256 * 1024;
function invalid(): never {
  throw Error("GITHUB_PAYLOAD_INVALID");
}
function object(x: unknown): Record<string, unknown> {
  if (!x || typeof x !== "object" || Array.isArray(x)) invalid();
  return x as Record<string, unknown>;
}
function id(x: unknown) {
  if (typeof x !== "number" || !Number.isSafeInteger(x) || x <= 0) invalid();
  return String(x);
}
function text(x: unknown, max = 200) {
  if (
    typeof x !== "string" ||
    !x.length ||
    x.length > max ||
    /[\u0000-\u001f]/.test(x)
  )
    invalid();
  return x;
}
function bool(x: unknown) {
  if (typeof x !== "boolean") invalid();
  return x;
}
function sha(x: unknown) {
  const s = text(x, 64);
  if (!/^[a-f0-9]{40}$/.test(s)) invalid();
  return s;
}
function date(x: unknown) {
  if (typeof x !== "string" || x.length > 40) invalid();
  const n = Date.parse(x);
  if (!Number.isFinite(n)) invalid();
  return n;
}
function repository(x: unknown) {
  const r = object(x),
    fullName = text(r.full_name);
  if (!/^[A-Za-z0-9-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/.test(fullName)) invalid();
  return { providerId: id(r.id), fullName, private: bool(r.private) };
}
export function parseEvent(
  event: string,
  payload: unknown,
): Infer<typeof facts> | null {
  const p = object(payload);
  const f: Infer<typeof facts> = {
    kind: "push",
    installationId: "",
    providerId: "",
    fullName: "",
    private: false,
    identity: "",
    ref: "",
    before: "",
    after: "",
    created: false,
    deleted: false,
    forced: false,
    commitCount: 0,
    releaseId: "",
    tag: "",
    prerelease: false,
    providerAt: null,
    removed: [],
    allRemoved: false,
  };
  if (event === "push") {
    if (
      p.action !== undefined ||
      p.release !== undefined ||
      !Array.isArray(p.commits) ||
      p.commits.length > 2048 ||
      !(
        p.head_commit === null ||
        (p.head_commit &&
          typeof p.head_commit === "object" &&
          !Array.isArray(p.head_commit))
      )
    )
      invalid();
    const ref = text(p.ref);
    if (!ref.startsWith("refs/")) invalid();
    return {
      ...f,
      ...repository(p.repository),
      installationId: id(object(p.installation).id),
      ref,
      before: sha(p.before),
      after: sha(p.after),
      created: bool(p.created),
      deleted: bool(p.deleted),
      forced: bool(p.forced),
      commitCount: p.commits.length,
    };
  }
  if (event === "release") {
    if (p.commits !== undefined || p.ref !== undefined) invalid();
    const r = object(p.release),
      repo = repository(p.repository),
      installationId = id(object(p.installation).id);
    if (typeof p.action !== "string") invalid();
    if (p.action !== "published") return null;
    if (r.draft !== false) invalid();
    return {
      ...f,
      ...repo,
      installationId,
      kind: "release",
      releaseId: id(r.id),
      tag: text(r.tag_name),
      prerelease: bool(r.prerelease),
      providerAt: date(r.published_at),
    };
  }
  if (event === "github_app_authorization") {
    // HMAC covers the body, never headers. The revoked body has no installation/repository/action-specific alternative payload.
    if (
      Object.keys(p).some((k) => !["action", "sender"].includes(k)) ||
      p.action !== "revoked"
    )
      invalid();
    const sender = object(p.sender);
    if (!["User", "Bot"].includes(String(sender.type))) invalid();
    return { ...f, kind: "revoke_user", identity: id(sender.id) };
  }
  if (event === "installation" || event === "installation_repositories") {
    if (
      p.repository !== undefined ||
      p.release !== undefined ||
      p.commits !== undefined
    )
      invalid();
    const i = object(p.installation);
    if (
      id(i.app_id) !== process.env.GITHUB_APP_ID ||
      !["all", "selected"].includes(String(i.repository_selection))
    )
      invalid();
    id(object(i.account).id);
    id(i.target_id);
    if (!["User", "Organization"].includes(String(i.target_type))) invalid();
    object(i.permissions);
    f.installationId = id(i.id);
    if (event === "installation") {
      if (
        ![
          "created",
          "deleted",
          "suspend",
          "unsuspend",
          "new_permissions_accepted",
        ].includes(String(p.action))
      )
        invalid();
      if (!["deleted", "suspend"].includes(String(p.action))) return null;
      return { ...f, kind: "revoke_install" };
    }
    if (
      !["added", "removed"].includes(String(p.action)) ||
      !["all", "selected"].includes(String(p.repository_selection)) ||
      !Array.isArray(p.repositories_added) ||
      !Array.isArray(p.repositories_removed) ||
      p.repositories_removed.length > 1000 ||
      p.repositories_added.length > 1000
    )
      invalid();
    if (p.action === "added") return null;
    const removed = p.repositories_removed.map((x) => id(object(x).id));
    return {
      ...f,
      kind: "revoke_repositories",
      removed: [...new Set(removed)],
      allRemoved: removed.length === 0 && p.repository_selection === "selected",
    };
  }
  invalid();
}
export async function readBody(
  request: Request,
  limit = MAX_BODY,
  milliseconds = 4000,
) {
  const reader = request.body?.getReader();
  if (!reader) invalid();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(Error("GITHUB_BODY_TIMEOUT"));
      void reader.cancel().catch(() => {});
    }, milliseconds);
  });
  try {
    const chunks: Uint8Array[] = [];
    let length = 0;
    for (;;) {
      const item = await Promise.race([reader.read(), timeout]);
      if (item.done) break;
      length += item.value.byteLength;
      if (length > limit) {
        void reader.cancel().catch(() => {});
        throw Error("GITHUB_BODY_TOO_LARGE");
      }
      chunks.push(item.value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const c of chunks) {
      bytes.set(c, offset);
      offset += c.length;
    }
    return bytes;
  } finally {
    clearTimeout(timer);
    reader.releaseLock();
  }
}
export async function verifySignature(
  bytes: Uint8Array,
  signature: string,
  secret: string,
) {
  if (!/^sha256=[a-f0-9]{64}$/.test(signature)) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const digest = Uint8Array.from(signature.slice(7).match(/../g)!, (x) =>
    parseInt(x, 16),
  );
  return crypto.subtle.verify(
    "HMAC",
    key,
    digest,
    bytes as Uint8Array<ArrayBuffer>,
  );
}
export const receive = httpAction(async (ctx, request) => {
  const startedAt = Date.now();
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret || secret.length < 16 || secret.length > 8192)
    return new Response("GITHUB_WEBHOOK_CONFIGURATION_REQUIRED", {
      status: 503,
    });
  if (
    request.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase() !==
    "application/json"
  )
    return new Response("GITHUB_CONTENT_TYPE_INVALID", { status: 415 });
  const signature = request.headers.get("X-Hub-Signature-256") ?? "";
  if (!/^sha256=[a-f0-9]{64}$/.test(signature))
    return new Response("GITHUB_SIGNATURE_INVALID", { status: 401 });
  const guid = request.headers.get("X-GitHub-Delivery") ?? "",
    event = request.headers.get("X-GitHub-Event") ?? "";
  if (
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
      guid,
    )
  )
    return new Response("GITHUB_DELIVERY_INVALID", { status: 400 });
  let bytes: Uint8Array, parsed: Infer<typeof facts> | null;
  try {
    bytes = await readBody(request);
    if (!(await verifySignature(bytes, signature, secret)))
      return new Response("GITHUB_SIGNATURE_INVALID", { status: 401 });
    parsed = parseEvent(
      event,
      JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)),
    );
  } catch (e) {
    const code = e instanceof Error ? e.message : "GITHUB_PAYLOAD_INVALID";
    return new Response(
      code === "GITHUB_BODY_TOO_LARGE" || code === "GITHUB_BODY_TIMEOUT"
        ? code
        : "GITHUB_PAYLOAD_INVALID",
      {
        status:
          code === "GITHUB_BODY_TOO_LARGE"
            ? 413
            : code === "GITHUB_BODY_TIMEOUT"
              ? 408
              : 400,
      },
    );
  }
  if (!parsed) return new Response(null, { status: 204 });
  const digest = [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>),
    ),
  ]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
  let receiptTimer: ReturnType<typeof setTimeout> | undefined;
  try {
    const remaining = 8500 - (Date.now() - startedAt);
    if (remaining <= 0)
      return new Response("GITHUB_RECEIPT_UNAVAILABLE", { status: 503 });
    await Promise.race([
      ctx.runMutation(internal.integrations.github.deliveries.record, {
        guid: guid.toLowerCase(),
        digest,
        facts: parsed,
      }),
      new Promise<never>((_, reject) => {
        receiptTimer = setTimeout(
          () => reject(Error("GITHUB_RECEIPT_DEADLINE")),
          remaining,
        );
      }),
    ]);
    return new Response("GITHUB_RECEIPT_STORED", { status: 202 });
  } catch (e) {
    return new Response(
      String(e).includes("GITHUB_DELIVERY_CONFLICT")
        ? "GITHUB_DELIVERY_CONFLICT"
        : "GITHUB_RECEIPT_UNAVAILABLE",
      { status: String(e).includes("GITHUB_DELIVERY_CONFLICT") ? 409 : 503 },
    );
  } finally {
    clearTimeout(receiptTimer);
  }
});
