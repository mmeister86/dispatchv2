import { useEffect, useRef, useState } from "react";
import { useConvex } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Download } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { IntelligenceFamily } from "../../../convex/operations/exportIntelligence";
import type { SharedFamily } from "../../../convex/operations/exportShared";
import { authClient } from "@/lib/auth-client";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/shared";

type Archive = FunctionReturnType<typeof api.operations.exportShared.shared>;
const intelligenceFamilies: Record<IntelligenceFamily, string> = {
  assessments: "Jev-Bewertungen",
  ownAssessmentRequests: "Eigene Bewertungsanfragen",
  ownRecommendationReceipts: "Eigene Übernahmebelege",
  ownRoutingOperations: "Eigene Routingvorgänge",
  ownContentRequests: "Eigene Inhaltsanfragen",
  ownStandaloneVerifications: "Eigene Inhaltsprüfungen",
  algorithmProfiles: "Algorithmusprofile",
  audienceProfiles: "Zielgruppenprofile",
  intelligenceSelections: "Intelligence-Auswahl",
  intelligenceProfileReceipts: "Intelligence-Änderungen",
  intelligenceSourceUpdates: "Öffentliche Quellprüfungen",
  styleVersions: "Stilversionen",
  styleControls: "Stilauswahl",
  learningProposals: "Stilvorschläge",
  styleCommands: "Stiländerungen",
};
type IntelligenceArchive = FunctionReturnType<
  typeof api.operations.exportIntelligence.page
>;
const intelligenceFields: Record<IntelligenceFamily, string> = {
  assessments:
    "id accountId draftId draftVersionId versionNumber algorithmId audienceId inputVersion createdAt sourceUntil attemptId provenance result",
  ownAssessmentRequests:
    "id actorId accountId draftId draftVersionId algorithmId audienceId selectionRevision mode deadline createdAt sourceUntil materialAvailability",
  ownRecommendationReceipts:
    "id accountId actorId baseVersionId versionId revision createdAt",
  ownRoutingOperations:
    "id accountId actorId ideaId inputVersionId inputRevision createdAt deadline questionVersion normalizationVersion sourceUntil sourceUnavailable status materialAvailability intent result style policyId attemptId provenance",
  ownContentRequests:
    "id accountId actorId ideaId inputVersionId inputRevision createdAt runId resultIdeaId outputKind routingOperationId compositeParentId compositeStage materialAvailability sourceUntil intent verification composite",
  ownStandaloneVerifications:
    "contentRequestId accountId kind actorId candidateVersionId producerRunId inputVersionId startedAt deadline sourceUntil state sourceUnavailable materialAvailability result stickyRisk",
  algorithmProfiles:
    "id accountId network surface createdBy createdAt status review retiredAt update payload",
  audienceProfiles:
    "id accountId network surface createdBy createdAt status review retiredAt payload",
  intelligenceSelections:
    "id accountId network surface revision algorithmId audienceId selectedBy updatedAt",
  intelligenceProfileReceipts:
    "id accountId network surface actorId revision action reason algorithmId audienceId createdAt",
  intelligenceSourceUpdates:
    "id accountId network surface kind actorId baseProfileId baseCommit headCommit createdAt expectedPaths full state deadline notBefore finishedAt requests bytes error errorRedacted proposalId observation checkId variant refs interpretation impact rationale fullSourceReview reference",
  styleVersions:
    "id accountId createdBy createdAt declaredBy declaredAt selfDeclaration baseVersionId proposalId sourceUntil sourceUnavailable status materialAvailability payload reason",
  styleControls:
    "id accountId revision selectedVersionId selectedBy selectionReceiptId updatedAt",
  learningProposals:
    "id accountId createdBy createdAt baseVersionId baseSelectionReceiptId feedbackId draftId beforeVersionId resultingVersionId beforeUntil resultUntil sourceUntil ownExamples state decidedBy decidedAt resultVersionId sourceUnavailable materialAvailability preferences reason decisionReason",
  styleCommands:
    "id accountId actorId revision action versionId proposalId createdAt sourceUnavailable materialAvailability reason",
};
const fields = (value: unknown, keys: string) => pick(value, keys.split(" "));
function items(value: unknown, project: (v: unknown) => unknown) {
  if (!Array.isArray(value)) throw Error("EXPORT_DATA_UNAVAILABLE");
  return value.map(project);
}
function verificationData(value: unknown) {
  const r = fields(value, intelligenceFields.ownStandaloneVerifications);
  if (r.result) {
    const result = fields(
      r.result,
      "candidateVersionId questionVersion normalizationVersion thresholdVersion model decision criteria reasonKeys",
    );
    const criteria = fields(
      result.criteria,
      "meaningPreserved intentPreserved newStrongClaim unwantedPromotion toneFits ctaFits networkFits",
    );
    result.criteria = Object.fromEntries(
      Object.entries(criteria).map(([k, v]) => [
        k,
        fields(v, "probability applicability"),
      ]),
    );
    r.result = result;
  }
  if (r.stickyRisk)
    r.stickyRisk = fields(r.stickyRisk, "candidateVersionId reasonKeys");
  return r;
}
function styleData(value: unknown) {
  const r = fields(
    value,
    "author experiences tone positioning pillars examples forbidden",
  );
  if (r.pillars) r.pillars = items(r.pillars, (p) => fields(p, "name weight"));
  return r;
}
function intelligenceData(data: IntelligenceArchive["data"]) {
  const family = data.selection.family;
  const rows = data.selection.rows.map((row) => {
    if (family === "ownStandaloneVerifications") return verificationData(row);
    const r = fields(row, intelligenceFields[family]);
    if (r.review) r.review = fields(r.review, "actorId at reason");
    if (r.update) r.update = fields(r.update, "proposalId evaluationId");
    if (r.provenance)
      r.provenance = fields(
        r.provenance,
        "policyId policyVersion requestedModel resolvedModel inputTokens outputTokens sentAt settledAt latencyMs selectionRevision",
      );
    if (family === "ownRoutingOperations") {
      if (r.intent) {
        r.intent = fields(
          r.intent,
          "intent outputKind strategy network objective tone cta media",
        );
        const i = r.intent as Record<string, unknown>;
        if (i.media) i.media = items(i.media, (m) => fields(m, "assetId alt"));
      }
      if (r.result)
        r.result = fields(
          r.result,
          "status category choiceConfidence suggestion effectiveStrategy generatorKind thresholdVersion",
        );
      if (r.style)
        r.style = fields(
          r.style,
          "versionId selectedBy selectionReceiptId sourceUntil",
        );
    }
    if (family === "ownContentRequests") {
      if (r.verification) r.verification = verificationData(r.verification);
      if (r.composite) {
        const c = fields(
          r.composite,
          "kind actorId startedAt deadline sourceUntil sourceUnavailable state currency maxCostMicros maxCalls maxToolSteps repairRequestId repairRunId repairedCandidateVersionId materialAvailability first final stickyRisk",
        );
        if (c.first) c.first = verificationData(c.first);
        if (c.final) c.final = verificationData(c.final);
        if (c.stickyRisk)
          c.stickyRisk = fields(c.stickyRisk, "candidateVersionId reasonKeys");
        r.composite = c;
      }
    }
    if (family === "styleVersions" && r.payload)
      r.payload = styleData(r.payload);
    if (r.preferences) r.preferences = styleData(r.preferences);
    if (family === "audienceProfiles" && r.payload)
      r.payload = fields(
        r.payload,
        "version description source measurement embedding",
      );
    if (family === "algorithmProfiles" && r.payload) {
      const p = fields(
        r.payload,
        "version repository commit commitAt observedAt reviewDueAt validityBasis sourceScope productionState scoringInfluence evidence report refs",
      );
      p.evidence = items(p.evidence, (e) => fields(e, "path url sha256"));
      p.refs = fields(
        p.refs,
        "formula routing verification questionSet normalization",
      );
      r.payload = p;
    }
    if (family === "intelligenceSourceUpdates") {
      if (r.refs)
        r.refs = fields(
          r.refs,
          "formula routing verification questionSet normalization",
        );
      if (r.reference) {
        const ref = fields(r.reference, "version passed outcomes");
        ref.outcomes = items(ref.outcomes, (o) =>
          fields(o, "case outcome aggregate"),
        );
        r.reference = ref;
      }
      if (r.observation) {
        const o = fields(
          r.observation,
          "commit commitAt observedAt reviewDueAt compareUrl complete issues evidence changes",
        );
        o.evidence = items(o.evidence, (e) => fields(e, "path url sha256"));
        o.changes = items(o.changes, (c) =>
          fields(c, "path status url patch patchState"),
        );
        r.observation = o;
      }
    }
    if (family === "assessments" && r.result) {
      const result = fields(
        r.result,
        "outcome answers score deterministic questionVersion normalizationVersion",
      );
      if (result.answers && typeof result.answers === "object")
        result.answers = Object.fromEntries(
          Object.entries(result.answers).map(([k, a]) => [
            k,
            fields(a, "type value confidence probability"),
          ]),
        );
      if (result.score) {
        const score = fields(
          result.score,
          "formulaVersion thresholdVersion thresholdBasis minimumConfidence weights aggregate missing lowConfidence history audienceFit",
        );
        score.weights = fields(
          score.weights,
          "hookStrength clarity discussionPotential originality naturalCta structure history",
        );
        score.history = fields(score.history, "value basis");
        result.score = score;
      }
      if (result.deterministic) {
        const d = fields(
          result.deterministic,
          "version segments media structure",
        );
        d.segments = items(d.segments, (s) =>
          fields(
            s,
            "position length lengthValid hashtags mentions links lines questionMarks explicitCtaSigns repeatedParagraphs structure",
          ),
        );
        d.media = fields(d.media, "present count images videos withAlt");
        result.deterministic = d;
      }
      r.result = result;
    }
    return r;
  });
  return {
    format: data.format,
    version: data.version,
    workspaceId: data.workspaceId,
    selection: { family, rows },
  };
}

const privateFamilies = {
  conversations: "Eigene Unterhaltungen",
  conversationMessages: "Eigene Chatnachrichten",
  conversationOperations: "Eigene Chatvorgänge",
  conversationRuns: "Eigene Chatläufe",
  targetedOrders: "Eigene gezielte Research-Aufträge",
  publicOrders: "Öffentliche Research-Aufträge",
  orderSources: "Erhaltene Research-Quellen",
  orderEvidence: "Erhaltene Research-Belege",
  researchMessages: "Erhaltene Research-Antworten",
  workflowSteps: "Research-Ablaufschritte",
};
type PrivateFamily = keyof typeof privateFamilies;
type Family = SharedFamily | PrivateFamily | IntelligenceFamily;
type PrivateArchive = FunctionReturnType<
  (typeof api.operations.exportPrivate)[PrivateFamily]
>;
const privateRowFields: Record<PrivateFamily, string> = {
  conversations:
    "conversationId accountId createdAt title revision updatedAt turns state",
  conversationMessages:
    "conversationId messageId _creationTime order stepOrder status role text",
  conversationOperations:
    "operationId conversationId createdAt allowIdeaCreation inputVersionId resultIdeaId",
  conversationRuns:
    "runId operationId purpose state createdAt deadline executionFinishedAt policyVersion promptVersion attempts toolSteps",
  targetedOrders:
    "orderId accountId profileId profileVersionId occasion state generation createdAt finishedAt windowStart windowEnd deadline occurrence query topic language operations",
  publicOrders:
    "orderId accountId profileId profileVersionId occasion state generation createdAt finishedAt windowStart windowEnd deadline occurrence query language operations",
  orderSources:
    "sourceId operation url title text publishedAt count observedAt minusableUntil",
  orderEvidence:
    "evidenceId actorId annotationActorId orderId sourceId observedAt sourceGeneration parentEvidenceId createdAt promptVersion policyVersion minretentionUntil inboxRevision inboxDisposition inboxActorId",
  researchMessages:
    "orderId messageId _creationTime order stepOrder status role text",
  workflowSteps:
    "orderId stepNumber stage kind startedAt completedAt resultKind",
};
function privateData(data: PrivateArchive["data"]) {
  return {
    format: data.format,
    version: data.version,
    workspaceId: data.workspaceId,
    selection: {
      family: data.selection.family,
      rows: data.selection.rows.map((row) => {
        const r = pick(row, privateRowFields[data.selection.family].split(" "));
        if ("occurrence" in row && row.occurrence)
          r.occurrence = pick(row.occurrence, ["generation", "at"]);
        if ("outcomes" in row && row.outcomes)
          r.outcomes = row.outcomes.map((o) =>
            pick(o, ["operation", "state", "cacheHit"]),
          );
        if ("reResearch" in row && row.reResearch)
          r.reResearch = pick(row.reResearch, [
            "topic",
            "parentEvidenceId",
            "parentOrderId",
            "parentSourceId",
          ]);
        if ("automaticHandoff" in row && row.automaticHandoff) {
          const a = row.automaticHandoff;
          r.automaticHandoff = {
            ...pick(a, [
              "activationGeneration",
              "profileVersionId",
              "state",
              "selection",
            ]),
            option: pick(a.option, ["kind", "count", "target", "intent"]),
            ...(a.results
              ? {
                  results: a.results.map((result) =>
                    pick(result, [
                      "ideaId",
                      "ideaVersionId",
                      "draftId",
                      "draftVersionId",
                    ]),
                  ),
                }
              : {}),
          };
        }
        if ("config" in row && row.config) {
          const config = pick(
            row.config,
            "topics project audience languages regions preferredSources exclusions freshnessDays topicCount frequency timeZone clock weekday".split(
              " ",
            ),
          );
          r.config = {
            ...config,
            cap: row.config.cap
              ? pick(row.config.cap, ["currency", "limitMicros"])
              : null,
            autoHandoff: row.config.autoHandoff
              ? pick(row.config.autoHandoff, [
                  "kind",
                  "count",
                  "target",
                  "intent",
                ])
              : false,
          };
        }
        if ("perspective" in row)
          r.perspective = pick(row.perspective, [
            "profileVersionId",
            "audience",
            "topics",
            "project",
          ]);
        if ("annotation" in row)
          r.annotation = pick(
            row.annotation,
            "claim consequentialOrContested eventBased quote interpretation gaps relevance novelty uncertainty freshness validityReason".split(
              " ",
            ),
          );
        if ("model" in row && row.model)
          r.model = pick(
            row.model,
            "eventAt eventQuote title perspective dynamics clusterId historyIds copySourceIds".split(
              " ",
            ),
          );
        if ("assessment" in row && row.assessment)
          r.assessment = pick(
            row.assessment,
            "reviewerId assessedAt purpose ruleVersion basis maxAgeMs requestedUntil validUntil reason substantiveSupportAttested eventAt eventQuote".split(
              " ",
            ),
          );
        return r;
      }),
    },
  };
}
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
  const [family, setFamily] = useState<Family>(
    ["Owner", "Admin"].includes(state.role) ? "drafts" : "conversations",
  );
  const [draftId, setDraftId] = useState("");
  const [updateKind, setUpdateKind] = useState<
    "check" | "proposal" | "evaluation"
  >("check");
  const [conversationId, setConversationId] = useState("");
  const [profileId, setProfileId] = useState("");
  const [orderId, setOrderId] = useState("");
  const [operationId, setOperationId] = useState("");
  const [operation, setOperation] = useState<
    "web-search" | "x-recent" | "x-trends"
  >("web-search");
  const privateFamily = family in privateFamilies;
  const intelligenceFamily = family in intelligenceFamilies;
  const ownIntelligence = intelligenceFamily && family.startsWith("own");
  const needsConversation = [
    "conversationMessages",
    "conversationOperations",
    "conversationRuns",
    "targetedOrders",
  ].includes(family);
  const needsOrder = [
    "orderSources",
    "orderEvidence",
    "researchMessages",
    "workflowSteps",
  ].includes(family);
  const allowed =
    ownIntelligence ||
    (privateFamily
      ? family !== "publicOrders" || ["Owner", "Admin"].includes(state.role)
      : ["Owner", "Admin"].includes(state.role));
  const ready =
    allowed &&
    (!(privateFamily || (intelligenceFamily && !ownIntelligence)) ||
      !!state.activeAccountId) &&
    (family !== "assessments" || !!draftId) &&
    (!needsConversation || !!conversationId) &&
    (!needsOrder || !!orderId) &&
    (family !== "publicOrders" || !!profileId) &&
    (family !== "conversationRuns" || !!operationId);
  const { data: session } = authClient.useSession();
  const convex = useConvex();
  const authId = session?.user.id,
    sessionId = session?.session.id;
  const workspaceId = state.activeWorkspaceId,
    accountId = state.activeAccountId,
    role = state.role;
  const scope = `${nativeScope}:${authId}:${sessionId}:${workspaceId}:${accountId}:${role}:${family}:${conversationId}:${profileId}:${orderId}:${operationId}:${operation}:${draftId}:${updateKind}`;
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
    if (inFlight.current || !authId || !sessionId || !ready) return;
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
      const common = {
        workspaceId: workspaceId as Id<"workspaces">,
        expectedAuthId: authId,
        expectedSessionId: sessionId,
        requestKey,
      };
      const parent = {
        accountId: accountId as Id<"socialAccounts">,
        conversationId: conversationId as Id<"conversations">,
      };
      const bounds = {
        cursor: sent.cursor,
        selectionUpperBound: sent.creationUpperBound,
      };
      const research = {
        orderId: orderId as Id<"researchOrders">,
        cursor: sent.cursor,
      };
      const offset = sent.cursor === null ? 0 : Number(sent.cursor);
      let raw: Archive | PrivateArchive | IntelligenceArchive;
      switch (family) {
        case "conversations":
          raw = await convex.query(api.operations.exportPrivate.conversations, {
            ...common,
            accountId: parent.accountId,
            ...bounds,
          });
          break;
        case "conversationMessages":
          raw = await convex.query(
            api.operations.exportPrivate.conversationMessages,
            { ...common, ...parent, cursor: sent.cursor },
          );
          break;
        case "conversationOperations":
          raw = await convex.query(
            api.operations.exportPrivate.conversationOperations,
            { ...common, ...parent, ...bounds },
          );
          break;
        case "conversationRuns":
          raw = await convex.query(
            api.operations.exportPrivate.conversationRuns,
            {
              ...common,
              ...parent,
              operationId: operationId as Id<"chatOperations">,
              offset,
            },
          );
          break;
        case "targetedOrders":
          raw = await convex.query(
            api.operations.exportPrivate.targetedOrders,
            { ...common, ...parent, ...bounds },
          );
          break;
        case "publicOrders":
          raw = await convex.query(api.operations.exportPrivate.publicOrders, {
            ...common,
            profileId: profileId as Id<"researchProfiles">,
            ...bounds,
          });
          break;
        case "orderSources":
          raw = await convex.query(api.operations.exportPrivate.orderSources, {
            ...common,
            orderId: research.orderId,
            operation,
            offset,
          });
          break;
        case "orderEvidence":
          raw = await convex.query(api.operations.exportPrivate.orderEvidence, {
            ...common,
            ...research,
          });
          break;
        case "researchMessages":
          raw = await convex.query(
            api.operations.exportPrivate.researchMessages,
            { ...common, ...research },
          );
          break;
        case "workflowSteps":
          raw = await convex.query(api.operations.exportPrivate.workflowSteps, {
            ...common,
            ...research,
          });
          break;
        default:
          raw = intelligenceFamily
            ? await convex.query(api.operations.exportIntelligence.page, {
                ...common,
                family: family as IntelligenceFamily,
                ...(ownIntelligence ? {} : { accountId: parent.accountId }),
                ...(family === "assessments"
                  ? { draftId: draftId as Id<"drafts"> }
                  : {}),
                ...(family === "intelligenceSourceUpdates"
                  ? { kind: updateKind }
                  : {}),
                cursor: sent.cursor,
                creationUpperBound: sent.creationUpperBound,
              })
            : await convex.query(api.operations.exportShared.shared, {
                ...common,
                family: family as SharedFamily,
                cursor: sent.cursor,
                creationUpperBound: sent.creationUpperBound,
              });
      }
      const result = {
        ...raw,
        creationUpperBound:
          "creationUpperBound" in raw
            ? raw.creationUpperBound
            : raw.selectionUpperBound,
      };
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
        result.data.format !==
          (intelligenceFamily
            ? "dispatch-workspace-intelligence"
            : privateFamily
              ? "dispatch-workspace-private"
              : "dispatch-workspace-shared") ||
        result.data.version !== 1 ||
        result.data.selection.family !== family ||
        result.data.selection.rows.length > 1 ||
        typeof result.cursor !== "string" ||
        (!result.isDone && (!result.cursor || result.cursor === sent.cursor)) ||
        typeof result.isDone !== "boolean" ||
        ![result.observedAt, result.proofValidUntil].every(
          (n) => Number.isFinite(n) && !Object.is(n, -0),
        ) ||
        !numeric(result) ||
        (result.creationUpperBound !== null &&
          (!Number.isFinite(result.creationUpperBound) ||
            Object.is(result.creationUpperBound, -0) ||
            result.creationUpperBound < 0 ||
            result.creationUpperBound > result.observedAt)) ||
        (intelligenceFamily &&
          (!("kind" in raw) ||
            raw.kind !==
              (family === "intelligenceSourceUpdates" ? updateKind : null) ||
            !("draftId" in raw) ||
            raw.draftId !== (family === "assessments" ? draftId : null) ||
            !("accountId" in raw) ||
            raw.accountId !== (ownIntelligence ? null : accountId) ||
            result.creationUpperBound === null)) ||
        (privateFamily &&
          ("accountId" in raw ? raw.accountId !== accountId : true)) ||
        (needsConversation &&
          (!("conversationId" in raw) ||
            raw.conversationId !== conversationId)) ||
        (needsOrder && (!("orderId" in raw) || raw.orderId !== orderId)) ||
        (family === "publicOrders" &&
          (!("profileId" in raw) || raw.profileId !== profileId)) ||
        (family === "conversationRuns" &&
          (!("operationId" in raw) || raw.operationId !== operationId)) ||
        (family === "orderSources" &&
          (!("operation" in raw) || raw.operation !== operation)) ||
        ([
          "conversations",
          "conversationOperations",
          "targetedOrders",
          "publicOrders",
        ].includes(family) &&
          result.creationUpperBound === null) ||
        (["conversationRuns", "orderSources"].includes(family) &&
          (!("nextOffset" in raw) ||
            raw.nextOffset !== offset + 1 ||
            raw.cursor !== String(offset + 1))) ||
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
        const payload = intelligenceFamily
          ? intelligenceData(result.data as IntelligenceArchive["data"])
          : privateFamily
            ? privateData(result.data as PrivateArchive["data"])
            : downloadData(result.data as Archive["data"]);
        const serialized = JSON.stringify(payload);
        if (new TextEncoder().encode(serialized).length > 64 * 1024)
          throw Error("EXPORT_DATA_UNAVAILABLE");
        const beforeURL = Date.now();
        if (
          !stillCurrent() ||
          !Number.isFinite(beforeURL) ||
          Object.is(beforeURL, -0) ||
          beforeURL < result.observedAt ||
          beforeURL >= result.proofValidUntil
        )
          throw Error("EXPORT_SOURCE_EXPIRED");
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
          handoffAt < result.observedAt ||
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

  return (
    <Section
      title="Inhalte und Verlauf exportieren"
      description="Lade die erhaltenen Inhalte eines Archivbereichs seitenweise herunter. Quellen und Berechtigungen werden bei jeder Seite erneut geprüft. Diese Auswahl ist kein Snapshot. Draft-Versionshistorie und eigene Einstellungen haben separate Exporte; Chatnachrichten und Ablaufschritte zeigen den erhaltenen Verlauf mit fortlaufender Seitenauswahl. Medienbytes sind nicht enthalten."
    >
      <label htmlFor="archive-family" className="block text-sm mb-2">
        Archivbereich
      </label>
      <select
        id="archive-family"
        className="native-select mb-3"
        value={family}
        onChange={(e) => setFamily(e.target.value as Family)}
      >
        {Object.entries({
          ...(["Owner", "Admin"].includes(role) ? families : {}),
          ...privateFamilies,
          ...Object.fromEntries(
            Object.entries(intelligenceFamilies).filter(
              ([key]) =>
                key.startsWith("own") || ["Owner", "Admin"].includes(role),
            ),
          ),
        })
          .filter(
            ([value]) =>
              value !== "publicOrders" || ["Owner", "Admin"].includes(role),
          )
          .map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
      </select>
      {privateFamily && (
        <p className="muted text-sm mb-3">
          Wähle einen aktiven Account. Verwende die nativen IDs aus den
          Unterhaltungs-, Vorgangs- oder Research-Archivseiten. Jeder
          übergeordnete Datensatz wird erneut geprüft.
        </p>
      )}
      {intelligenceFamily && (
        <p className="muted text-sm mb-3">
          Eigene Vorgänge umfassen den Workspace. Gemeinsame Profile und
          Bewertungen verwenden den aktiven Account. Nicht mehr freigegebene
          Inhalte sind ausdrücklich als nicht verfügbar gekennzeichnet.
        </p>
      )}
      {family === "assessments" && (
        <label className="block text-sm mb-3">
          Entwurf-ID
          <input
            className="native-input block"
            value={draftId}
            onChange={(e) => setDraftId(e.target.value.trim())}
          />
        </label>
      )}
      {family === "intelligenceSourceUpdates" && (
        <label className="block text-sm mb-3">
          Quellverlauf
          <select
            className="native-select block"
            value={updateKind}
            onChange={(e) => setUpdateKind(e.target.value as typeof updateKind)}
          >
            <option value="check">Prüfungen</option>
            <option value="proposal">Vorschläge</option>
            <option value="evaluation">Bewertungen</option>
          </select>
        </label>
      )}
      {needsConversation && (
        <label className="block text-sm mb-3">
          Unterhaltung-ID
          <input
            className="native-input block"
            value={conversationId}
            onChange={(e) => setConversationId(e.target.value.trim())}
          />
        </label>
      )}
      {family === "publicOrders" && (
        <label className="block text-sm mb-3">
          Research-Profil-ID
          <input
            className="native-input block"
            value={profileId}
            onChange={(e) => setProfileId(e.target.value.trim())}
          />
        </label>
      )}
      {needsOrder && (
        <label className="block text-sm mb-3">
          Research-Auftrag-ID
          <input
            className="native-input block"
            value={orderId}
            onChange={(e) => setOrderId(e.target.value.trim())}
          />
        </label>
      )}
      {family === "conversationRuns" && (
        <label className="block text-sm mb-3">
          Chatvorgang-ID
          <input
            className="native-input block"
            value={operationId}
            onChange={(e) => setOperationId(e.target.value.trim())}
          />
        </label>
      )}
      {family === "orderSources" && (
        <label className="block text-sm mb-3">
          Quellenart
          <select
            className="native-select block"
            value={operation}
            onChange={(e) => setOperation(e.target.value as typeof operation)}
          >
            <option value="web-search">Websuche</option>
            <option value="x-recent">X-Beiträge</option>
            <option value="x-trends">X-Trends</option>
          </select>
        </label>
      )}
      <Button
        variant="outline"
        disabled={busy || !authId || !sessionId || !ready}
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
