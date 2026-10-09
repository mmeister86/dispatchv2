import { useEffect, useRef, useState } from "react";
import { useConvex } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Download } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { SharedFamily } from "../../../convex/operations/exportShared";
import { authClient } from "@/lib/auth-client";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/shared";

type Archive = FunctionReturnType<typeof api.operations.exportShared.shared>;
const families: Record<SharedFamily, string> = {
  drafts: "Entwürfe",
  ideas: "Ideen",
  ideaVersions: "Ideenversionen",
  ideaFeedback: "Ideenfeedback",
  contentFeedback: "Inhaltsfeedback",
  contentPlans: "Inhaltspläne",
  contentPlanItems: "Planeinträge",
  planningSeries: "Planungsserien",
  planningSeriesVersions: "Serienversionen",
  planningSeriesCommands: "Serienänderungen",
  semanticPlanBindings: "Planquellen-Verknüpfungen",
  editorialComments: "Redaktionskommentare",
  approvals: "Freigaben",
  schedules: "Veröffentlichungsplanung",
  editorialEvents: "Redaktionsereignisse",
  editorialReviewPolicies: "Prüfrichtlinien",
  editorialReviewControls: "Prüfeinstellungen",
  editorialReviewDecisions: "Prüfentscheidungen",
  editorialReviewCommands: "Prüfänderungen",
};
const rowFields: Record<SharedFamily, readonly string[]> = {
  drafts:
    "id createdInDatabaseAt revision currentVersionId authorId source assigneeId updatedAt".split(
      " ",
    ),
  ideas:
    "id createdInDatabaseAt actorId revision currentVersionId status updatedAt".split(
      " ",
    ),
  ideaVersions:
    "id createdInDatabaseAt ideaId number actorId createdAt title perspective note priority originals rationale questions inputVersionId".split(
      " ",
    ),
  ideaFeedback:
    "id createdInDatabaseAt ideaId versionId actorId kind text createdAt resultingVersionId".split(
      " ",
    ),
  contentFeedback:
    "id createdInDatabaseAt accountId versionId resultingVersionId actorId kind createdAt editExtent definition".split(
      " ",
    ),
  contentPlans:
    "id createdInDatabaseAt accountId actorId createdAt desiredCount start end timezone clock mode topics preferences".split(
      " ",
    ),
  contentPlanItems:
    "id createdInDatabaseAt planId accountId draftId versionId versionNumber draftRevision ideaVersionId at timezone localTime reason status acceptedApprovalId acceptedScheduleId acceptedActorId acceptedMode".split(
      " ",
    ),
  planningSeries:
    "id createdInDatabaseAt accountId actorId revision generation enabled versionId nextAt nextIndex remaining createdAt updatedAt".split(
      " ",
    ),
  planningSeriesVersions:
    "id createdInDatabaseAt accountId seriesId revision actorId sequence createdAt".split(
      " ",
    ),
  planningSeriesCommands:
    "id createdInDatabaseAt accountId seriesId actorId expectedRevision revision versionId generation createdAt".split(
      " ",
    ),
  semanticPlanBindings:
    "id createdInDatabaseAt accountId planId vectorId attemptId".split(" "),
  editorialComments:
    "id createdInDatabaseAt draftId versionId authorId versionNumber text resolved createdAt".split(
      " ",
    ),
  approvals:
    "id createdInDatabaseAt draftId versionId accountId actorId createdAt revokedAt revokedBy purpose expiresAt".split(
      " ",
    ),
  schedules:
    "id createdInDatabaseAt draftId versionId accountId approvalId actorId generation at timezone localTime state confirmedAt abortRequestedAt abortRequestedBy purpose".split(
      " ",
    ),
  editorialEvents:
    "id createdInDatabaseAt draftId scheduleId actorId code createdAt".split(
      " ",
    ),
  editorialReviewPolicies:
    "id createdInDatabaseAt accountId editorial brand actorId revision createdAt".split(
      " ",
    ),
  editorialReviewControls:
    "id createdInDatabaseAt accountId policyId revision".split(" "),
  editorialReviewDecisions:
    "id createdInDatabaseAt draftId versionId accountId policyId stage reviewerId priorDecisionId createdAt withdrawnAt withdrawnBy active".split(
      " ",
    ),
  editorialReviewCommands:
    "id createdInDatabaseAt accountId actorId kind draftId assigneeId requestStage assignmentResult versionId result".split(
      " ",
    ),
};
function pick(
  value: unknown,
  keys: readonly string[],
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("EXPORT_DATA_UNAVAILABLE");
  return Object.fromEntries(
    keys.filter((k) => k in value).map((k) => [k, Reflect.get(value, k)]),
  );
}
function content(value: unknown) {
  const result = pick(value, [
    "title",
    "text",
    "media",
    "accountId",
    "pillar",
    "strategy",
  ]);
  if (!Array.isArray(result.media)) throw Error("EXPORT_DATA_UNAVAILABLE");
  result.media = result.media.map((m) => pick(m, ["assetId", "alt"]));
  return result;
}
function numeric(value: unknown): boolean {
  if (typeof value === "number")
    return Number.isFinite(value) && !Object.is(value, -0);
  return (
    !value || typeof value !== "object" || Object.values(value).every(numeric)
  );
}
function downloadData(data: Archive["data"]) {
  const selection = data.selection;
  const rows = selection.rows.map((row) => {
    const r = pick(row, rowFields[selection.family]);
    if ("content" in row) r.content = content(row.content);
    if ("candidate" in row)
      r.candidate = row.candidate === null ? null : content(row.candidate);
    if ("sources" in row)
      r.sources = row.sources.map((s) =>
        pick(
          s,
          s.kind === "research"
            ? [
                "kind",
                "evidenceId",
                "accountId",
                "orderId",
                "sourceId",
                "sourceGeneration",
              ]
            : [
                "kind",
                "repositoryId",
                "generation",
                "contextId",
                "signalId",
                "ideaVersionId",
              ],
        ),
      );
    if ("preferences" in row)
      r.preferences = pick(row.preferences, [
        "timezone",
        "language",
        "audience",
        "tone",
        "topics",
      ]);
    if ("seriesId" in row) r.seriesId = row.seriesId;
    if ("seriesVersionId" in row) r.seriesVersionId = row.seriesVersionId;
    if ("config" in row) {
      r.config = {
        ...pick(row.config, [
          "styleVersionId",
          "theme",
          "candidateVersionIds",
          "desiredFormat",
          "threshold",
          "timezone",
          "frequency",
          "weekday",
          "callbackClock",
          "publishingClocks",
          "start",
          "end",
          "occurrences",
          "itemsPerBatch",
        ]),
        pillars: row.config.pillars.map((p) => pick(p, ["name", "weight"])),
      };
    }
    if ("assignmentResult" in row && row.assignmentResult)
      r.assignmentResult = pick(row.assignmentResult, [
        "revision",
        "assigneeId",
        "versionId",
      ]);
    if ("result" in row && row.result)
      r.result = pick(row.result, ["revision", "policyId", "decisionId"]);
    return r;
  });
  return {
    format: data.format,
    version: data.version,
    workspaceId: data.workspaceId,
    selection: { family: selection.family, rows },
  };
}
export function NativeArchiveExport() {
  const { state, nativeScope } = useStore();
  const [family, setFamily] = useState<SharedFamily>("drafts");
  const { data: session } = authClient.useSession();
  const convex = useConvex();
  const authId = session?.user.id,
    sessionId = session?.session.id;
  const workspaceId = state.activeWorkspaceId,
    accountId = state.activeAccountId,
    role = state.role;
  const scope = `${nativeScope}:${authId}:${sessionId}:${workspaceId}:${accountId}:${role}:${family}`;
  const current = useRef({ scope, epoch: 0 });
  if (current.current.scope !== scope)
    current.current = { scope, epoch: current.current.epoch + 1 };
  const alive = useRef(true),
    nonce = useRef(0),
    inFlight = useRef(false);
  const position = useRef<{
    cursor: string | null;
    creationUpperBound: number | null;
    epoch: number;
  }>({ cursor: null, creationUpperBound: null, epoch: current.current.epoch });
  if (position.current.epoch !== current.current.epoch)
    position.current = {
      cursor: null,
      creationUpperBound: null,
      epoch: current.current.epoch,
    };
  const objectURL = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [status, setStatus] = useState("");
  const [done, setDone] = useState(false);
  const revoke = () => {
    if (timer.current) clearTimeout(timer.current);
    if (objectURL.current) URL.revokeObjectURL(objectURL.current);
    objectURL.current = null;
    timer.current = null;
  };
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      nonce.current++;
      revoke();
    };
  }, []);
  useEffect(() => {
    nonce.current++;
    inFlight.current = false;
    setBusy(false);
    setDone(false);
    setError("");
    setStatus("");
    revoke();
  }, [scope]);
  const download = async () => {
    if (
      inFlight.current ||
      !authId ||
      !sessionId ||
      !["Owner", "Admin"].includes(role)
    )
      return;
    inFlight.current = true;
    if (done) {
      position.current = {
        cursor: null,
        creationUpperBound: null,
        epoch: current.current.epoch,
      };
      setDone(false);
    }
    const ticket = ++nonce.current,
      epoch = current.current.epoch;
    const stillCurrent = () =>
      alive.current &&
      nonce.current === ticket &&
      current.current.epoch === epoch &&
      current.current.scope === scope;
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const requestKey = crypto.randomUUID();
      const sent = position.current;
      const result = await convex.query(api.operations.exportShared.shared, {
        workspaceId: workspaceId as Id<"workspaces">,
        expectedAuthId: authId,
        expectedSessionId: sessionId,
        family,
        requestKey,
        cursor: sent.cursor,
        creationUpperBound: sent.creationUpperBound,
      });
      if (!stillCurrent()) return;
      const now = Date.now();
      if (
        !Number.isFinite(now) ||
        Object.is(now, -0) ||
        result.requestKey !== requestKey ||
        result.authId !== authId ||
        result.sessionId !== sessionId ||
        result.workspaceId !== workspaceId ||
        result.data.workspaceId !== workspaceId ||
        result.role !== role ||
        result.data.format !== "dispatch-workspace-shared" ||
        result.data.version !== 1 ||
        result.data.selection.family !== family ||
        result.data.selection.rows.length > 1 ||
        typeof result.cursor !== "string" ||
        (!result.isDone && (!result.cursor || result.cursor === sent.cursor)) ||
        typeof result.isDone !== "boolean" ||
        ![
          result.creationUpperBound,
          result.observedAt,
          result.proofValidUntil,
        ].every((n) => Number.isFinite(n) && !Object.is(n, -0)) ||
        !numeric(result) ||
        result.creationUpperBound < 0 ||
        result.creationUpperBound > result.observedAt ||
        result.observedAt > now ||
        result.proofValidUntil <= now ||
        result.proofValidUntil > result.observedAt + 30_000 ||
        (sent.creationUpperBound !== null &&
          result.creationUpperBound !== sent.creationUpperBound) ||
        new TextEncoder().encode(JSON.stringify(result)).length > 64 * 1024
      )
        throw new Error("EXPORT_SCOPE_CHANGED");
      revoke();
      if (result.data.selection.rows.length) {
        const payload = downloadData(result.data);
        const serialized = JSON.stringify(payload);
        if (new TextEncoder().encode(serialized).length > 64 * 1024)
          throw Error("EXPORT_DATA_UNAVAILABLE");
        const url = URL.createObjectURL(
          new Blob([serialized], { type: "application/json" }),
        );
        objectURL.current = url;
        const link = document.createElement("a");
        link.href = url;
        link.download = `dispatch-workspace-${family}.json`;
        const handoffAt = Date.now();
        if (
          !stillCurrent() ||
          !Number.isFinite(handoffAt) ||
          Object.is(handoffAt, -0) ||
          handoffAt >= result.proofValidUntil
        )
          throw new Error("EXPORT_SOURCE_EXPIRED");
        link.click();
        timer.current = setTimeout(revoke, 1000);
        setStatus("Archivseite wurde zum Download übergeben.");
      } else
        setStatus("Diese Seite enthält keine freigegebenen Archivinhalte.");
      const advanceAt = Date.now();
      if (
        !stillCurrent() ||
        !Number.isFinite(advanceAt) ||
        Object.is(advanceAt, -0) ||
        advanceAt >= result.proofValidUntil
      )
        throw new Error("EXPORT_SOURCE_EXPIRED");
      position.current = {
        cursor: result.cursor,
        creationUpperBound: result.creationUpperBound,
        epoch,
      };
      setDone(result.isDone);
    } catch {
      if (stillCurrent()) {
        revoke();
        setError(
          "Archiv-Export konnte nicht erstellt werden. Bitte erneut versuchen.",
        );
      }
    } finally {
      if (stillCurrent()) {
        inFlight.current = false;
        setBusy(false);
      }
    }
  };
  if (!["Owner", "Admin"].includes(role)) return null;
  return (
    <Section
      title="Geteilte Inhalte und Planung exportieren"
      description="Lade die erhaltenen Inhalte eines Archivbereichs seitenweise herunter. Quellen und Berechtigungen werden bei jeder Seite erneut geprüft. Diese Auswahl ist kein Snapshot. Draft-Versionshistorie und eigene Einstellungen haben separate Exporte; private Archive und Medienbytes sind nicht enthalten."
    >
      <label htmlFor="archive-family" className="block text-sm mb-2">
        Archivbereich
      </label>
      <select
        id="archive-family"
        className="native-select mb-3"
        value={family}
        onChange={(e) => setFamily(e.target.value as SharedFamily)}
      >
        {Object.entries(families).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <Button
        variant="outline"
        disabled={busy || !authId || !sessionId}
        onClick={download}
      >
        <Download size={15} />
        {done
          ? "Neue Archivauswahl beginnen"
          : position.current.cursor === null
            ? "Erste Archivseite herunterladen"
            : "Nächste Archivseite herunterladen"}
      </Button>
      {busy && (
        <p role="status" className="muted text-sm mt-3">
          Archivseite wird geprüft …
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm mt-3">
          {error}
        </p>
      )}
      {status && (
        <p role="status" className="muted text-sm mt-3">
          {status}
          {done
            ? " Das Ende dieser Auswahl wurde erreicht."
            : " Die nächste Seite kann geladen werden."}
        </p>
      )}
    </Section>
  );
}
