import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";
import {
  mkdtempSync,
  existsSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
const artifactDir = mkdtempSync(join(tmpdir(), "dispatch-tests-"));
const evidence =
  process.env.DISPATCH_HEALTH_EVIDENCE_DIR ??
  `${artifactDir}/dispatch-31.1-browser-operations`;
mkdirSync(evidence, { recursive: true });
const root = fileURLToPath(new URL("..", import.meta.url)).replace(/\/$/, "");
const mocks = {
  "convex/react": `import React from 'react';import {getFunctionName} from '/node_modules/convex/dist/esm/server/index.js';
const tick=()=>React.useSyncExternalStore(cb=>{window.listeners.add(cb);return()=>window.listeners.delete(cb)},()=>window.tick);
const funcs=new Map();const invoke=ref=>{const name=getFunctionName(ref);if(!funcs.has(name))funcs.set(name,async args=>{window.commands.push({name,args});if(name==='users:bootstrap')return 'user-owner';if(name==='preferences:dismissResearchSummaries')return new Promise((resolve,reject)=>window.summaryCommands.push({args,resolve,reject}));if(name==='publishing/notices:read'||name==='publishing/notices:dismiss')return new Promise((resolve,reject)=>window.publishingCommands.push({name,args,sessionId:window.session.session.id,resolve,reject}));if(name==='preferences:saveNotifications')return new Promise((resolve,reject)=>window.preferenceSaves.push({args,sessionId:window.session.session.id,resolve,reject}));throw new Error('No domain writes in health fixture');});return funcs.get(name)};
export const useMutation=invoke;export const useAction=invoke;export const useConvex=()=>({query:(ref,args)=>{const name=getFunctionName(ref);window.queries.push({name,args});if(!name.startsWith('operations/exportPrivate:')&&!['operations/exportIntelligence:page','operations/export:self','operations/export:versions','operations/export:preferences','operations/exportShared:shared'].includes(name))throw new Error('Unexpected direct read');return new Promise((resolve,reject)=>name==='operations/exportIntelligence:page'?window.intelligenceArchiveRequests.push({args,resolve,reject}):name.startsWith('operations/exportPrivate:')?window.privateArchiveRequests.push({name,args,resolve,reject}):name==='operations/exportShared:shared'?window.archiveRequests.push({args,resolve,reject}):name==='operations/export:versions'?window.versionRequests.push({args,resolve,reject}):name==='operations/export:preferences'?window.preferencesExportRequests.push({args,resolve,reject}):window.exportRequests.push({args,resolve,reject}));}});export const useConvexAuth=()=>{tick();return {isAuthenticated:true,isLoading:false}};
export const useQuery=(ref,args)=>{tick();if(args==='skip')return undefined;const name=getFunctionName(ref);window.queries.push({name,args});if(name==='operations/deletion:mine')return window.deletionJobs??[];if(name==='users:current')return window.snapshot;if(name==='team:list')return window.roster;if(name==='editorial:resources')return window.resources;if(name==='preferences:researchSummaries'){if(window.summaryError)throw Error('PRIVATE_PROVIDER_ERROR');return window.summaryByKey[args.requestKey];}if(name==='preferences:notifications'){if(window.preferenceError)throw Error('PRIVATE_PROVIDER_ERROR');return window.preferenceByKey[args.requestKey];}if(name==='operations/githubAlerts:get'){if(window.githubError)throw Error('PRIVATE_PROVIDER_ERROR');return window.githubByKey[args.refreshKey];}if(name==='operations/pilot:get'){if(window.pilotError)throw Error('PRIVATE_PROVIDER_ERROR');return window.pilotByKey[args.refreshKey];}if(name==='operations/health:get'){if(window.healthError)throw Error('PRIVATE_PROVIDER_ERROR');return window.healthByKey[args.refreshKey];}return undefined;};
export const usePaginatedQuery=(ref,args)=>{tick();const name=getFunctionName(ref);window.queries.push({name,args});if(name==='publishing/notices:list'){if(window.publishingError)throw Error('PRIVATE_PROVIDER_ERROR');return {results:window.publishingNotices.map(n=>({...n,requestKey:n.requestKey??args.requestKey})),status:window.publishingStatus,loadMore(){window.publishingLoads++}}}return {results:name==='editorial/notices:list'?window.notices:[],status:'Exhausted',loadMore(){}}};`,
  "@/lib/auth-client": `import React from 'react';export const demoMode=window.demo;export const backendConfigured=true;export const convexClientInstance=null;export const ConvexBetterAuthProvider=({children})=>children;export const AuthBoundary=({children})=>children;export {authPath,returnPath} from '/src/lib/navigation.ts';export const authClient={useSession:()=>{React.useSyncExternalStore(cb=>{window.listeners.add(cb);return()=>window.listeners.delete(cb)},()=>window.tick);return {data:window.session,isPending:false}},signOut:async()=>{},signIn:{email:async()=>({})},signUp:{email:async()=>({})},sendVerificationEmail:async()=>({})};`,
};
async function intelligenceArchiveBrowser(page, evidence) {
  await page.goto("http://127.0.0.1:5189/settings/data");
  const downloads = [];
  page.on("download", (d) => downloads.push(d));
  const selector = page.getByRole("combobox", { name: "Archivbereich" });
  const button = page.getByRole("button", {
    name: /Archivseite herunterladen|Archivauswahl beginnen/,
  });
  const resolve = (patch = {}, index = -1) =>
    page.evaluate(
      ({ patch, index }) => {
        const r = window.intelligenceArchiveRequests.at(index),
          a = r.args,
          now = Date.now();
        const normalizedAnswers = {
          contentType: {
            type: "choice",
            value: "educational",
            confidence: 0.9,
          },
          hookStrength: { type: "score", value: 0, confidence: 0.9 },
          clarity: { type: "score", value: 0.625, confidence: 0.9 },
          originality: { type: "score", value: 0.5, confidence: 0.9 },
          discussionPotential: { type: "score", value: 1, confidence: 0.9 },
          naturalCta: { type: "score", value: 0.25, confidence: 0 },
          promotionalTone: { type: "noul", probability: 0 },
          strongClaim: { type: "noul", probability: 0.2 },
          clickbait: { type: "noul", probability: 1 },
        };
        window.nativeAssessmentAnswers = normalizedAnswers;
        const row =
          a.family === "assessments"
            ? {
                id: "assessment-native",
                accountId: a.accountId,
                draftId: a.draftId,
                draftVersionId: "draft-version-native",
                versionNumber: 1,
                algorithmId: "algorithm-native",
                audienceId: "audience-native",
                inputVersion: "dispatch-assessment-input-v1",
                createdAt: 1,
                sourceUntil: now + 30000,
                attemptId: "analyzer-attempt-native",
                provenance: {
                  policyId: "analyzer-policy-original",
                  policyVersion: "original-v1",
                  requestedModel: "jev-1.13.0",
                  resolvedModel: null,
                  inputTokens: null,
                  outputTokens: null,
                  sentAt: 1,
                  settledAt: null,
                  latencyMs: null,
                  selectionRevision: 1,
                },
                result: {
                  outcome: "success",
                  answers: window.assessmentAnswersNull
                    ? null
                    : normalizedAnswers,
                  score: null,
                  deterministic: {
                    version: "structure-v1",
                    segments: [],
                    media: {
                      present: false,
                      count: 0,
                      images: 0,
                      videos: 0,
                      withAlt: 0,
                    },
                    structure: 0,
                  },
                  questionVersion: "jev-post-analysis-v1",
                  normalizationVersion: "jev-normalization-v1",
                },
              }
            : a.family === "ownStandaloneVerifications"
              ? {
                  contentRequestId: "request-own",
                  accountId: "account-native",
                  actorId: "user-owner",
                  kind: "standalone",
                  candidateVersionId: "candidate-own",
                  producerRunId: "run-own",
                  inputVersionId: "input-own",
                  startedAt: 1,
                  deadline: 2,
                  sourceUntil: now + 30000,
                  state: "finished",
                  sourceUnavailable: false,
                  materialAvailability: "retained",
                  result: {
                    candidateVersionId: "candidate-own",
                    questionVersion: "jev-output-verification-v1",
                    normalizationVersion: "jev-verification-normalization-v1",
                    thresholdVersion: "jev-verification-hypotheses-v1",
                    model: "original-model",
                    decision: "accept",
                    criteria: {
                      meaningPreserved: {
                        probability: 0.95,
                        applicability: "specified",
                        secret: "SECRET_CRITERIA",
                      },
                    },
                    reasonKeys: [],
                    contentHash: "SECRET_HASH",
                  },
                  stickyRisk: null,
                  operationKey: "SECRET_OPERATION",
                }
              : {
                  id: "routing-own",
                  policyId: window.routingNoAttempt
                    ? null
                    : "routing-policy-original",
                  attemptId: window.routingNoAttempt
                    ? null
                    : "routing-attempt-original",
                  provenance: window.routingNoAttempt
                    ? null
                    : {
                        policyVersion: "original-routing-v1",
                        requestedModel: "original-routing-model",
                        resolvedModel: "original-resolved-model",
                        policyFingerprint: "SECRET_POLICY",
                      },
                  accountId: "account-native",
                  actorId: "user-owner",
                  ideaId: "idea-own",
                  inputVersionId: "input-own",
                  inputRevision: 1,
                  createdAt: 1,
                  deadline: 2,
                  sourceUntil: now + 30000,
                  materialAvailability: "retained",
                  intent: {
                    intent: "Original owned instruction",
                    outputKind: "perspective",
                    strategy: null,
                    network: "x",
                    objective: null,
                    tone: null,
                    cta: null,
                    secret: "SECRET_INTENT",
                  },
                  result: {
                    status: window.routingNoAttempt
                      ? "configuration_required"
                      : "routed",
                    category: null,
                    choiceConfidence: null,
                    suggestion: null,
                    effectiveStrategy: "generic",
                    generatorKind: "generic",
                    thresholdVersion: "jev-routing-hypotheses-v1",
                    secret: "SECRET_RESULT",
                  },
                  style: null,
                  operationKey: "SECRET_OPERATION",
                };
        r.resolve({
          authId: a.expectedAuthId,
          sessionId: a.expectedSessionId,
          requestKey: a.requestKey,
          workspaceId: a.workspaceId,
          role: window.snapshot.workspaces[0].role,
          observedAt: now,
          proofValidUntil: now + 30000,
          creationUpperBound: a.creationUpperBound ?? now,
          cursor: `${a.cursor ?? "intelligence"}-next`,
          isDone: false,
          accountId: a.accountId ?? null,
          draftId: a.draftId ?? null,
          kind: a.kind ?? null,
          data: {
            format: "dispatch-workspace-intelligence",
            version: 1,
            workspaceId: a.workspaceId,
            selection: { family: a.family, rows: [row] },
          },
          ...patch,
        });
      },
      { patch, index },
    );
  await page
    .getByRole("combobox", { name: "Aktiver Account", exact: true })
    .selectOption("account-native");
  const nativeRows = {
    historyPosts: {
      id: "history-post",
      createdInDatabaseAt: 1,
      accountId: "account-native",
      jobId: "history-job",
      generation: 1,
      externalId: "101",
      network: "x",
      origin: "own-history-import",
      providerCreatedAt: 1,
      observedAt: 2,
      sourceUntil: 3000000000000,
      text: "Original imported text",
      contentType: "original",
      mediaType: "unknown",
      replyTo: null,
      accountSize: null,
      postAttemptId: null,
      versionId: null,
      thenKnowledgeId: null,
      historicalAnalysisId: null,
      metricsStatus: "not-observed",
      removed: false,
      materialAvailability: "retained",
    },
    historyJobs: {
      id: "history-job",
      createdInDatabaseAt: 1,
      accountId: "account-native",
      actorId: "user-owner",
      generation: 1,
      policyId: "history-policy",
      sourceUntil: 3000000000000,
      state: "paused",
      pages: 3,
      imported: 75,
      rejected: 0,
      createdAt: 1,
      updatedAt: 2,
      reason: null,
      checkpointUntil: 3000000000000,
      attemptId: null,
    },
    historyPolicies: {
      id: "history-policy",
      createdInDatabaseAt: 1,
      accountId: "account-native",
      version: "history-v1",
      approvedBy: "user-owner",
      expiresAt: 1,
      purpose: "own-history-analytics-context-v1",
      dialect: "post-fields-repost-v2",
      accessEvidence: "Original access",
      rightsEvidence: "Original rights",
      pricingEvidence: "Original price",
      protocolEvidence: "Original protocol",
      allocationEvidence: "Original allocation",
      unit: "returned-post-resource",
      unitMicros: 10,
      currency: "USD",
      allocatedProviderLimitMicros: 1000,
      retentionMs: 86400000,
      maxResults: 100,
    },
    historyControls: {
      id: "history-control",
      createdInDatabaseAt: 1,
      accountId: "account-native",
      generation: 3,
      deletedThroughGeneration: 2,
      updatedAt: 2,
    },
    performanceSnapshots: {
      id: "snapshot",
      createdInDatabaseAt: 1,
      accountId: "account-native",
      postAttemptId: "first-send",
      scheduleId: "schedule",
      versionId: "version-original",
      externalId: "101",
      position: 0,
      confirmedAt: 1,
      windowHours: 0.25,
      dueAt: 900001,
      generation: 1,
      state: "observed",
      attemptId: "metric-receipt",
      requestedAt: 900001,
      observedAt: 900002,
      providerCreatedAt: 1,
      definitionVersion: "metrics-v1",
      dialect: "post-fields-repost-v2",
      reason: null,
      expiresAt: 3000000000000,
      materialAvailability: "retained",
      fields: [
        {
          name: "impressions",
          rawField: "public_metrics.impression_count",
          definition: "Observed cumulative impressions",
          status: "measured",
          value: 0,
        },
        {
          name: "url_clicks",
          rawField: "non_public_metrics.url_link_clicks",
          definition: "Observed cumulative clicks",
          status: "missing",
          value: null,
        },
      ],
    },
    performancePolicies: {
      id: "metric-policy",
      createdInDatabaseAt: 1,
      accountId: "account-native",
      windows: [0.25, 1, 6, 24, 48],
      windowsEvidence: "Explicit five windows",
      version: "metrics-v1",
      approvedBy: "user-owner",
      expiresAt: 1,
      purpose: "own-post-descriptive-editorial-v1",
      dialect: "post-fields-repost-v2",
      accessEvidence: "Original access",
      rightsEvidence: "Original rights",
      pricingEvidence: "Original price",
      protocolEvidence: "Original protocol",
      allocationEvidence: "Original allocation",
      fields: ["impressions", "url_clicks"],
      unit: "single-post-request",
      unitMicros: 10,
      currency: "USD",
      allocatedProviderLimitMicros: 1000,
      retentionMs: 86400000,
    },
    performanceControls: {
      id: "metric-control",
      createdInDatabaseAt: 1,
      accountId: "account-native",
      enabled: false,
      deleted: true,
      generation: 2,
      actorId: "user-owner",
      updatedAt: 2,
      deletedThroughGeneration: 1,
    },
    publicationKnowledge: {
      id: "knowledge-first-send",
      createdInDatabaseAt: 1,
      accountId: "account-native",
      postAttemptId: "first-send",
      generation: 1,
      scheduleId: "schedule",
      versionId: "version-original",
      network: "x",
      capturedAt: 1,
      assessmentId: "assessment-original",
      applicable: true,
      reason: null,
      materialAvailability: "retained",
      projection: {
        version: "prospective-calibration-v1",
        state: "static",
        score: null,
        reason: "CALIBRATION_NO_ACTIVE_CANDIDATE",
        formulaVersion: "dispatch-score-v1",
        thresholdVersion: "jev-confidence-startup-v1",
        proofUntil: null,
        operatingUntil: null,
        pin: null,
      },
    },
  };
  for (const [family, nativeRow] of Object.entries(nativeRows)) {
    await selector.selectOption(family);
    await button.click();
    const request = await page.evaluate(
      () => window.intelligenceArchiveRequests.at(-1).args,
    );
    expect(request).toMatchObject({ family, accountId: "account-native" });
    expect(request).not.toHaveProperty("kind");
    expect(request).not.toHaveProperty("draftId");
    const downloaded = page.waitForEvent("download");
    await resolve({
      isDone: true,
      data: {
        format: "dispatch-workspace-intelligence",
        version: 1,
        workspaceId: request.workspaceId,
        selection: {
          family,
          rows: [
            {
              ...nativeRow,
              providerIdentity: "SECRET_PROVIDER",
              policyFingerprint: "SECRET_HASH",
              jobSchedulerId: "SECRET_SCHEDULER",
            },
          ],
        },
      },
    });
    const json = JSON.parse(
      readFileSync(await (await downloaded).path(), "utf8"),
    );
    expect(json.selection.rows[0]).toEqual(nativeRow);
    // Chromium throttles more than ten downloads per second, even from separate explicit clicks.
    await page.waitForTimeout(150);
    expect(JSON.stringify(json)).not.toMatch(
      /SECRET_|providerIdentity|policyFingerprint|jobSchedulerId/,
    );
  }
  await selector.selectOption("historyPosts");
  await selector.selectOption("publicationKnowledge");
  await button.click();
  const candidateRequest = await page.evaluate(
    () => window.intelligenceArchiveRequests.at(-1).args,
  );
  const candidate = {
    ...nativeRows.publicationKnowledge,
    projection: {
      ...nativeRows.publicationKnowledge.projection,
      state: "candidate",
      score: 0,
      proofUntil: 3000000000000,
      operatingUntil: 1,
      pin: {
        assessmentId: "assessment-original",
        purposeId: "purpose-original",
        generation: 1,
        decisionId: "decision-original",
        candidateId: "candidate-original",
        evaluationId: "evaluation-original",
        declarationId: "declaration-original",
        checkId: "check-original",
        capturedAt: 1,
      },
    },
  };
  const candidateDownload = page.waitForEvent("download");
  await resolve({
    isDone: true,
    data: {
      format: "dispatch-workspace-intelligence",
      version: 1,
      workspaceId: candidateRequest.workspaceId,
      selection: {
        family: "publicationKnowledge",
        rows: [
          {
            ...candidate,
            projection: {
              ...candidate.projection,
              pin: {
                ...candidate.projection.pin,
                semanticKey: "SECRET_SEMANTIC",
                assessmentFingerprint: "SECRET_ASSESSMENT",
              },
            },
          },
        ],
      },
    },
  });
  expect(
    JSON.parse(readFileSync(await (await candidateDownload).path(), "utf8"))
      .selection.rows[0],
  ).toEqual(candidate);

  await page.waitForTimeout(1100);
  for (const family of ["ownRoutingOperations", "ownStandaloneVerifications"]) {
    await selector.selectOption(family, { timeout: 1000 });
    await button.click();
    const downloaded = page.waitForEvent("download");
    await resolve();
    const json = JSON.parse(
      readFileSync(await (await downloaded).path(), "utf8"),
    );
    expect(json.selection.family).toBe(family);
    expect(JSON.stringify(json)).not.toMatch(
      /SECRET_|requestKey|sessionId|contentHash|operationKey/,
    );
    if (family === "ownRoutingOperations") {
      expect(json.selection.rows[0].intent.intent).toBe(
        "Original owned instruction",
      );
      expect(json.selection.rows[0]).toMatchObject({
        policyId: "routing-policy-original",
        attemptId: "routing-attempt-original",
        provenance: {
          policyVersion: "original-routing-v1",
          requestedModel: "original-routing-model",
          resolvedModel: "original-resolved-model",
        },
      });
    } else
      expect(
        json.selection.rows[0].result.criteria.meaningPreserved.probability,
      ).toBe(0.95);
  }
  await selector.selectOption("ownRoutingOperations");
  await page.evaluate(() => {
    window.routingNoAttempt = true;
  });
  await button.click();
  const noAttemptDownload = page.waitForEvent("download");
  await resolve();
  const noAttemptJSON = JSON.parse(
    readFileSync(await (await noAttemptDownload).path(), "utf8"),
  );
  expect(noAttemptJSON.selection.rows[0]).toMatchObject({
    policyId: null,
    attemptId: null,
    provenance: null,
  });
  await page.evaluate(() => {
    window.routingNoAttempt = false;
  });
  let before = downloads.length;
  for (const patch of [
    { sessionId: "other" },
    { accountId: "other" },
    { draftId: "foreign" },
    { kind: "evaluation" },
    { proofValidUntil: 1 },
    { creationUpperBound: -0 },
  ]) {
    await button.click();
    await resolve(patch);
    await expect(page.getByRole("alert")).toContainText(
      "Archiv-Export konnte nicht erstellt werden",
    );
    expect(downloads.length).toBe(before);
  }
  await page
    .getByRole("combobox", { name: "Aktiver Account", exact: true })
    .selectOption("account-native");
  await selector.selectOption("assessments");
  await expect(button).toBeDisabled();
  await page
    .getByRole("textbox", { name: "Entwurf-ID" })
    .fill("draft-original");
  await button.click();
  expect(
    await page.evaluate(() => window.intelligenceArchiveRequests.at(-1).args),
  ).toMatchObject({
    family: "assessments",
    accountId: "account-native",
    draftId: "draft-original",
  });
  await resolve({ draftId: "draft-foreign" });
  await expect(page.getByRole("alert")).toContainText(
    "Archiv-Export konnte nicht erstellt werden",
  );
  expect(downloads.length).toBe(before);
  for (const nullAnswers of [false, true]) {
    await page.evaluate((value) => {
      window.assessmentAnswersNull = value;
    }, nullAnswers);
    await button.click();
    const assessmentDownload = page.waitForEvent("download");
    await resolve();
    const assessmentJSON = JSON.parse(
      readFileSync(await (await assessmentDownload).path(), "utf8"),
    );
    const result = assessmentJSON.selection.rows[0].result;
    if (nullAnswers) expect(result.answers).toBeNull();
    else {
      expect(result.answers).toEqual(
        await page.evaluate(() => window.nativeAssessmentAnswers),
      );
      expect(Object.keys(result.answers)).toHaveLength(9);
      expect(result.answers.hookStrength.value).toBe(0);
      expect(result.answers.promotionalTone.probability).toBe(0);
    }
    expect(result.score).toBeNull();
    expect(
      assessmentJSON.selection.rows[0].provenance.resolvedModel,
    ).toBeNull();
  }
  before = downloads.length;
  await selector.selectOption("intelligenceSourceUpdates");
  await page
    .getByRole("combobox", { name: "Quellverlauf" })
    .selectOption("evaluation");
  await button.click();
  expect(
    await page.evaluate(() => window.intelligenceArchiveRequests.at(-1).args),
  ).toMatchObject({
    family: "intelligenceSourceUpdates",
    accountId: "account-native",
    kind: "evaluation",
  });
  await resolve({ kind: "check" });
  await expect(page.getByRole("alert")).toContainText(
    "Archiv-Export konnte nicht erstellt werden",
  );
  await selector.selectOption("ownRoutingOperations");
  await page.evaluate(() =>
    window.update({
      resources: {
        ...window.resources,
        accounts: [
          ...window.resources.accounts,
          {
            ...window.resources.accounts[0],
            _id: "account-other",
            name: "Other X",
          },
        ],
      },
    }),
  );
  await page.evaluate(() =>
    window.update({
      snapshot: {
        ...window.snapshot,
        workspaces: [
          ...window.snapshot.workspaces,
          {
            ...window.snapshot.workspaces[0],
            id: "workspace-other",
            name: "Other workspace",
          },
        ],
      },
    }),
  );
  for (const boundary of ["account", "session", "workspace", "role"]) {
    await button.click();
    const pending = await page.evaluate(
      () => window.intelligenceArchiveRequests.length - 1,
    );
    if (boundary === "account") {
      const account = page.getByRole("combobox", {
        name: "Aktiver Account",
        exact: true,
      });
      await account.selectOption("account-other");
      await account.selectOption("account-native");
    } else if (boundary === "session") {
      await page.evaluate(() =>
        window.update({
          session: { ...window.session, session: { id: "session-other" } },
        }),
      );
      await page.evaluate(() =>
        window.update({
          session: { ...window.session, session: { id: "session-owner" } },
        }),
      );
    } else if (boundary === "role") {
      await page.evaluate(() =>
        window.update({
          snapshot: {
            ...window.snapshot,
            workspaces: window.snapshot.workspaces.map((w) => ({
              ...w,
              role: "Admin",
            })),
          },
        }),
      );
      await page.evaluate(() =>
        window.update({
          snapshot: {
            ...window.snapshot,
            workspaces: window.snapshot.workspaces.map((w) => ({
              ...w,
              role: "Owner",
            })),
          },
        }),
      );
    } else {
      await page.evaluate(() =>
        window.update({
          snapshot: {
            ...window.snapshot,
            activeWorkspaceId: "workspace-other",
          },
        }),
      );
      await page.evaluate(() =>
        window.update({
          snapshot: {
            ...window.snapshot,
            activeWorkspaceId: "workspace-native",
          },
        }),
      );
    }
    await resolve({}, pending);
    expect(downloads.length).toBe(before);
    await selector.selectOption("ownRoutingOperations");
  }
  for (const role of ["Editor", "Viewer"]) {
    await page.evaluate(
      (role) =>
        window.update({
          snapshot: {
            ...window.snapshot,
            workspaces: window.snapshot.workspaces.map((w) => ({ ...w, role })),
          },
        }),
      role,
    );
    await selector.selectOption("ownRoutingOperations");
    await expect(
      page.locator('#archive-family option[value="algorithmProfiles"]'),
    ).toHaveCount(0);
    for (const family of Object.keys(nativeRows))
      await expect(
        page.locator(`#archive-family option[value="${family}"]`),
      ).toHaveCount(0);
    await button.click();
    const d = page.waitForEvent("download");
    await resolve();
    await d;
  }
  await button.click();
  const old = await page.evaluate(
      () => window.intelligenceArchiveRequests.length - 1,
    ),
    oldCount = downloads.length;
  await selector.selectOption("ownStandaloneVerifications");
  await selector.selectOption("ownRoutingOperations");
  await resolve({}, old);
  expect(downloads.length).toBe(oldCount);
  await button.click();
  const late = await page.evaluate(
    () => window.intelligenceArchiveRequests.length - 1,
  );
  await page.getByRole("link", { name: "Mein Profil", exact: true }).click();
  await resolve({}, late);
  expect(downloads.length).toBe(oldCount);
  writeFileSync(
    `${evidence}/intelligence-archive.json`,
    JSON.stringify(
      {
        transport: "MOCKED; native backend proofs tested separately",
        actualRoutingAndVerificationJSON: true,
        allEightMeasurementFamiliesNativeShapedDTOs: true,
        originalStaticNullAndCandidatePinPreserved: true,
        normalizedAssessmentNineAnswersZeroAndNull: true,
        originalRoutingModelPolicyAndNoAttemptProvenance: true,
        secretFieldsStripped: true,
        scopeAndExpiryGuards: true,
        familyABAAndUnmount: true,
        accountSessionWorkspaceRoleABA: true,
        exactDraftAndSourceKindSelectors: true,
        ownEditorViewer: true,
      },
      null,
      2,
    ),
  );
}

const server = await createServer({
  root,
  configFile: `${root}/vite.config.ts`,
  cacheDir: `${evidence}/vite-cache`,
  server: { host: "127.0.0.1", port: 5189, strictPort: true },
  plugins: [
    {
      name: "operations-native-transport",
      enforce: "pre",
      resolveId(id) {
        if (
          id === "./auth-client" ||
          id === "@/lib/auth-client" ||
          id.startsWith(`${root}/src/lib/auth-client`)
        )
          return "\0fixture:@/lib/auth-client";
        if (id in mocks) return "\0fixture:" + id;
      },
      load(id) {
        if (id.startsWith("\0fixture:")) return mocks[id.slice(9)];
      },
    },
  ],
});
await server.listen();
let browser;
try {
  const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ??
      (existsSync(chrome) ? chrome : undefined),
  });
  const page = await browser.newPage({
      viewport: { width: 1280, height: 900 },
    }),
    provider = [],
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route(
    /router\.eu\.requesty\.ai|api\.x\.com|api\.github\.com|api\.resend\.com|cloudflare/,
    (route) => {
      provider.push(route.request().url());
      return route.abort();
    },
  );
  await page.addInitScript(() => {
    window.demo = new URLSearchParams(location.search).has("demo");
    window.tick = 0;
    window.listeners = new Set();
    window.update = (patch) => {
      Object.assign(window, patch);
      window.tick++;
      for (const fn of window.listeners) fn();
    };
    window.commands = [];
    window.exportRequests = [];
    window.preferencesExportRequests = [];
    window.versionRequests = [];
    window.archiveRequests = [];
    window.privateArchiveRequests = [];
    window.intelligenceArchiveRequests = [];
    window.preferenceSaves = [];
    window.summaryCommands = [];
    window.summaryByKey = {};
    window.preferenceStored = {
      revision: 0,
      email: false,
      inAppSummaries: false,
      weekly: false,
      research: false,
      timezone: "UTC",
      quiet: null,
    };
    window.preferenceByKey = {};
    window.publishPreferences = (patch = {}) => {
      const a = window.queries
        .filter((q) => q.name === "preferences:notifications")
        .at(-1)?.args;
      if (!a) throw Error("No mounted preference query");
      window.preferenceByKey[a.requestKey] = {
        authId: window.session.user.id,
        sessionId: window.session.session.id,
        workspaceId: a.workspaceId,
        requestKey: a.requestKey,
        settings: structuredClone(window.preferenceStored),
        ...patch,
      };
      window.update({});
    };
    window.urlRevocations = [];
    const revoke = URL.revokeObjectURL.bind(URL);
    URL.revokeObjectURL = (url) => {
      window.urlRevocations.push(url);
      revoke(url);
    };
    window.storageWrites = [];
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      window.storageWrites.push(key);
      return setItem.call(this, key, value);
    };
    window.notices = [];
    window.githubByKey = {};
    window.publishGithub = (patch = {}) => {
      for (const q of window.queries.filter(
        (q) => q.name === "operations/githubAlerts:get",
      )) {
        window.githubByKey[q.args.refreshKey] = {
          authId: window.session.user.id,
          sessionId: window.session.session.id,
          workspaceId: q.args.workspaceId,
          refreshKey: q.args.refreshKey,
          data: {
            observedAt: Date.now(),
            validUntil: Date.now() + 30000,
            coverage: { partial: true, parentLimit: 6, remainder: "unknown" },
            rows: [{ id: "private-recovery-id" }],
          },
          ...patch,
        };
      }
      window.update({});
    };
    window.publishingNotices = [];
    window.publishingCommands = [];
    window.publishingStatus = "Exhausted";
    window.publishingLoads = 0;
    window.queries = [];
    window.session = {
      user: {
        id: "auth-owner",
        email: "owner@example.test",
        emailVerified: true,
      },
      session: { id: "session-owner" },
    };
    window.snapshot = {
      state: "ready",
      authId: "auth-owner",
      userId: "user-owner",
      activeWorkspaceId: "workspace-native",
      workspaces: [
        {
          id: "workspace-native",
          name: "Native workspace",
          description: "",
          role: "Owner",
        },
      ],
      preferences: {
        name: "Native Owner",
        timezone: "Europe/Berlin",
        language: "Deutsch",
        audience: "",
        tone: "",
        topics: "",
        onboardingDone: true,
        onboardingStep: 3,
      },
    };
    window.roster = {
      revision: 0,
      authId: "auth-owner",
      sessionId: "session-owner",
      workspaceId: "workspace-native",
      actorRole: "Owner",
      members: [
        {
          membershipId: "member-owner",
          userId: "user-owner",
          name: "Native Owner",
          role: "Owner",
        },
      ],
      invitations: [],
      invitationsLimited: false,
    };
    window.resources = {
      accounts: [
        {
          _id: "account-native",
          _creationTime: 1,
          workspaceId: "workspace-native",
          provider: "X",
          providerIdentity: "native",
          name: "Native X",
          handle: "@native",
          connection: "connected",
          capability: {
            maxText: 280,
            maxThread: 10,
            maxMedia: 4,
            mediaTypes: [],
            publish: false,
          },
        },
      ],
      assets: [],
      members: [{ id: "user-owner", role: "Owner", name: "Native Owner" }],
      events: [],
      notifications: [],
      resourcesLimited: false,
    };
    window.pilotByKey = {};
    window.publishPilot = (patch = {}) => {
      const a = window.queries
        .filter((q) => q.name === "operations/pilot:get")
        .at(-1)?.args;
      if (!a) throw Error("No mounted pilot query");
      const until = Date.now() + 10000;
      window.pilotByKey[a.refreshKey] = {
        authId: window.session.user.id,
        sessionId: window.session.session.id,
        refreshKey: a.refreshKey,
        data: {
          accountId: a.accountId,
          observedAt: Date.now(),
          windowHours: 24,
          until,
          coverage: {
            partial: true,
            candidateLimit: 5,
            subset: "original_single_text_post",
            remainder: "unknown",
          },
          cohorts: [
            {
              key: "opaque-synthetic",
              dialect: "post-fields-repost-v2",
              unit: "post",
              media: "none",
              windowHours: 24,
              until,
              impressions: { n: 1, sum: 0, mean: 0 },
            },
          ],
        },
        ...patch,
      };
      window.update({});
    };
    window.healthByKey = {};
    window.publishHealth = (health) => {
      const current = window.queries
        .filter((q) => q.name === "operations/health:get")
        .at(-1);
      if (!current) throw Error("No mounted health query");
      window.healthByKey[current.args.refreshKey] = health;
      window.update({});
    };
  });
  if (process.env.DISPATCH_INTELLIGENCE_ARCHIVE_ONLY) {
    await intelligenceArchiveBrowser(page, evidence);
  } else {
    await page.goto("http://127.0.0.1:5189/operations");
    await page.getByRole("tab", { name: "Systemzustand", exact: true }).click();
    await expect(
      page.getByText("Betriebsbelege werden geladen …", { exact: true }),
    ).toBeVisible();

    await page.clock.install({ time: new Date("2026-10-07T22:00:00Z") });
    const health = await page.evaluate(() => {
      const now = Date.now();
      const names = [
        "publishing",
        "github",
        "media",
        "research",
        "generation",
        "own_metrics",
        "own_history",
        "jev_analyzer",
        "intent_routing",
        "embedding",
        "output_verification",
      ];
      const base = (kind, id, state, accountId = null) => ({
        parent: { kind, id },
        state,
        accountId,
        code: null,
        recordedAt: now,
        deadline: null,
        leaseUntil: null,
        notBefore: null,
        proofUntil: null,
        overdue: false,
        localReceipt: null,
        outcomes: [],
        recovery: null,
        receiptCoverage: "not_evaluated",
        moreReceipts: null,
        receipts: [],
      });
      const publishing = {
        ...base(
          "publishing",
          "schedule-health",
          "publishing",
          "account-native",
        ),
        deadline: now - 1,
        overdue: true,
        recovery: { kind: "draft", id: "draft-health" },
      };
      const github = {
        ...base("github", "github-health", "unknown"),
        leaseUntil: now - 1,
        notBefore: now + 15000,
        localReceipt: true,
        recovery: { kind: "signals" },
      };
      const media = {
        ...base("media", "media-health", "deleting"),
        notBefore: now + 20000,
        recovery: { kind: "media" },
      };
      const research = {
        ...base("research", "research-health", "completed", "account-native"),
        outcomes: ["empty", "partial", "unknown"],
        recovery: { kind: "research", id: "profile-health" },
      };
      const generation = {
        ...base("generation", "generation-health", "stopped", "account-native"),
        receiptCoverage: "bounded",
        moreReceipts: true,
        receipts: [
          {
            attemptId: "unknown-health",
            owner: "generation",
            state: "unknown",
            currency: "USD",
            heldMicros: 8100,
            estimatedMicros: null,
            settledAt: null,
          },
          {
            attemptId: "zero-health",
            owner: "generation",
            state: "settled",
            currency: "EUR",
            heldMicros: 0,
            estimatedMicros: 0,
            settledAt: now,
          },
        ],
      };
      const rows = [publishing, github, media, research, generation];
      return {
        workspaceId: "workspace-native",
        accountId: null,
        authId: "auth-owner",
        sessionId: "session-owner",
        observedAt: now,
        validUntil: now + 30000,
        coverage: {
          kind: "bounded_receipt_sample",
          accountsLoaded: 3,
          moreEligibleAccounts: true,
          total: null,
          reasons: ["parent_cap", "child_cap", "family_not_implemented"],
        },
        families: names.map((family, i) => ({
          family,
          coverage: i < 5 ? "bounded" : "not_evaluated",
          sampledRows: i === 0 ? 2 : i < 5 ? 1 : 0,
          moreEligibleRows: i === 0 ? null : i < 5 ? false : null,
          total: null,
          configuration: "not_evaluated",
          remoteCheck: "not_performed",
          reason:
            i === 0
              ? "parent_cap"
              : i === 4
                ? "child_cap"
                : i < 5
                  ? null
                  : "family_not_implemented",
          rows:
            i === 0
              ? [
                  publishing,
                  {
                    ...base(
                      "publishing",
                      "stopped-send",
                      "cancelled",
                      "account-native",
                    ),
                    code: "attention",
                  },
                ]
              : i < 5
                ? [rows[i]]
                : [],
        })),
      };
    });
    await page.evaluate((value) => window.publishHealth(value), health);
    await expect(page.getByTestId("native-health")).toBeVisible();
    await expect(
      page.getByText("2 erfasste Vorgänge · Umfang offen.", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Offener Vorgang · Abgleich nötig", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Keine Ergebnisse · Teilweise beendet · Ergebnis ungeklärt",
        { exact: false },
      ),
    ).toBeVisible();
    await expect(
      page.getByText("Gebunden: 0,0081 USD", { exact: false }),
    ).toBeVisible();
    await expect(
      page.getByText("Verbucht: 0 EUR", { exact: false }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Weitere Finanzbelege nicht angezeigt; kein Gesamtbetrag.",
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Vorhandenen Vorgang öffnen" }).first(),
    ).toHaveAttribute("href", "/drafts/draft-health");
    await expect(
      page.getByRole("button", {
        name: /Wiederholen|Demo-Wiederholung|Erneut senden/,
      }),
    ).toHaveCount(0);
    expect(
      await page.evaluate(() =>
        window.commands.filter((c) => c.name !== "users:bootstrap"),
      ),
    ).toEqual([]);
    await page.screenshot({
      path: `${evidence}/cloud-1280.png`,
      fullPage: false,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId("native-health")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `${evidence}/cloud-390.png`,
      fullPage: false,
    });
    await page
      .getByRole("region", { name: "Öffentliche Generierung", exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `${evidence}/cloud-receipts-390.png`,
      fullPage: false,
    });
    const key = await page.evaluate(
      () =>
        window.queries.filter((q) => q.name === "operations/health:get").at(-1)
          .args.refreshKey,
    );
    await page.clock.runFor(30001);
    await expect(
      page.getByText("Nachweis abgelaufen. Bitte aktualisieren."),
    ).toBeVisible();
    await expect(page.getByTestId("native-health")).toHaveCount(0);
    await page
      .getByRole("button", { name: "Nachweis aktualisieren", exact: true })
      .click();
    await expect(
      page.getByText("Betriebsbelege werden geladen …"),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () =>
          window.queries
            .filter((q) => q.name === "operations/health:get")
            .at(-1).args.refreshKey,
      ),
    ).not.toBe(key);
    const fresh = {
      ...health,
      observedAt: health.observedAt + 30001,
      validUntil: health.validUntil + 30001,
    };
    await page.evaluate((value) => window.publishHealth(value), fresh);
    await expect(page.getByTestId("native-health")).toBeVisible();
    await page
      .getByRole("combobox", { name: /^Bereich/ })
      .selectOption("account-native");
    await expect(page.getByTestId("native-health")).toHaveCount(0);
    expect(
      await page.evaluate(
        () =>
          window.queries
            .filter((q) => q.name === "operations/health:get")
            .at(-1).args.accountId,
      ),
    ).toBe("account-native");
    await page.evaluate((value) => window.publishHealth(value), fresh);
    await expect(
      page.getByText(
        "Der Nachweis gehört nicht mehr zur aktuellen Auswahl. Bitte aktualisieren.",
      ),
    ).toBeVisible();
    await page.evaluate((value) => window.publishHealth(value), {
      ...fresh,
      accountId: "account-native",
    });
    await expect(page.getByTestId("native-health")).toBeVisible();
    // Authenticated Store remounts and unique read keys prevent observed session A→B→A reuse.
    await page.evaluate(() =>
      window.update({
        session: { ...window.session, session: { id: "session-other" } },
      }),
    );
    await page.getByRole("tab", { name: "Systemzustand", exact: true }).click();
    await expect(page.getByTestId("native-health")).toHaveCount(0);
    await page.evaluate(() =>
      window.update({
        session: { ...window.session, session: { id: "session-owner" } },
      }),
    );
    await page.getByRole("tab", { name: "Systemzustand", exact: true }).click();
    await expect(
      page.getByText("Betriebsbelege werden geladen …"),
    ).toBeVisible();
    await expect(page.getByTestId("native-health")).toHaveCount(0);
    await page.evaluate((value) => window.publishHealth(value), fresh);
    await expect(page.getByTestId("native-health")).toBeVisible();
    await page.evaluate(() =>
      window.update({
        snapshot: {
          ...window.snapshot,
          workspaces: [{ ...window.snapshot.workspaces[0], role: "Viewer" }],
        },
      }),
    );
    await page.getByRole("tab", { name: "Systemzustand", exact: true }).click();
    await expect(
      page.getByText(
        "Diese Übersicht steht nur Ownern und Admins zur Verfügung.",
      ),
    ).toBeVisible();
    const viewerQueries = await page.evaluate(
      () =>
        window.queries.filter((q) => q.name === "operations/health:get").length,
    );
    await page.clock.runFor(1000);
    expect(
      await page.evaluate(
        () =>
          window.queries.filter((q) => q.name === "operations/health:get")
            .length,
      ),
    ).toBe(viewerQueries);
    await page.evaluate(() =>
      window.update({
        snapshot: {
          ...window.snapshot,
          workspaces: [{ ...window.snapshot.workspaces[0], role: "Owner" }],
        },
      }),
    );
    await page.getByRole("tab", { name: "Systemzustand", exact: true }).click();
    await page.evaluate(() => window.update({ healthError: true }));
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "Betriebsbelege konnten nicht geladen werden" }),
    ).toBeVisible();
    await expect(page.getByTestId("native-health")).toHaveCount(0);
    expect(await page.locator("main").innerText()).not.toContain(
      "PRIVATE_PROVIDER_ERROR",
    );
    await page.evaluate(() => window.update({ healthError: false }));
    await page
      .getByRole("button", { name: "Nachweis aktualisieren", exact: true })
      .click();
    await page.evaluate((value) => window.publishHealth(value), {
      ...fresh,
      coverage: {
        ...fresh.coverage,
        reasons: ["read_budget", "family_not_implemented"],
      },
      families: fresh.families.map((f) =>
        f.family === "generation"
          ? {
              ...f,
              coverage: "not_evaluated",
              rows: [],
              sampledRows: 0,
              moreEligibleRows: null,
              reason: "read_budget",
            }
          : f,
      ),
    });
    await expect(
      page.getByText(
        "Leserahmen erreicht. Weitere Bereiche wurden nicht ausgewertet.",
      ),
    ).toBeVisible();
    await page
      .getByRole("tab", { name: "Kalibrierungsreferenzen", exact: true })
      .click();
    await expect(
      page.getByRole("combobox", { name: "Referenz-Account", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("tab", { name: "Algorithmusprofile", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Intelligence-Profile", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Account auswählen. Analyse, Audience Fit und Embeddings sind nicht verfügbar.",
      ),
    ).toBeVisible();
    await page.getByRole("tab", { name: "Systemzustand", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Nachweis aktualisieren", exact: true }),
    ).toBeVisible();
    // TASK-33.1.1: actual mounted Cloud self-profile consumer.
    await page.goto("http://127.0.0.1:5189/settings/data");
    await expect(
      page.getByRole("button", {
        name: "Eigenes Profil als JSON herunterladen",
        exact: true,
      }),
    ).toBeVisible();
    const exportButton = page.getByRole("button", {
      name: "Eigenes Profil als JSON herunterladen",
      exact: true,
    });
    const resolveExport = (patch = {}, index = -1) =>
      page.evaluate(
        ({ patch, index }) => {
          const r = window.exportRequests.at(index);
          const data = {
            format: "dispatch-self-profile",
            version: 1,
            observedAt: 1800000000000,
            user: { id: "user-owner", createdAt: 1 },
            workspace: { id: r.args.workspaceId, name: "Native workspace" },
            membership: { role: window.snapshot.workspaces[0].role },
            profile: {
              ...window.snapshot.preferences,
              audience: "Eigenes Publikum 🧭",
            },
            coverage: {
              kind: "selected_workspace_self_profile",
              complete: true,
              included: [
                "app_user_context",
                "selected_workspace_context",
                "own_membership",
                "own_profile",
              ],
              unsupported: ["private_content_and_components"],
            },
          };
          r.resolve({
            requestKey: r.args.requestKey,
            authId: r.args.expectedAuthId,
            sessionId: window.session.session.id,
            data,
            ...patch,
          });
        },
        { patch, index },
      );
    expect(await page.evaluate(() => window.exportRequests.length)).toBe(0);
    await expect(
      page.getByText(/Dies ist ein Teil-Export/).first(),
    ).toBeVisible();
    const beforeEntropy = await page.evaluate(
      () => window.exportRequests.length,
    );
    await page.evaluate(() => {
      window.realUUID = crypto.randomUUID.bind(crypto);
      crypto.randomUUID = () => {
        throw Error("PRIVATE_ENTROPY_ERROR");
      };
    });
    await exportButton.click();
    await expect(page.getByRole("alert")).toContainText(
      "Profil-Export konnte nicht erstellt werden",
    );
    await expect(exportButton).toBeEnabled();
    expect(await page.evaluate(() => window.exportRequests.length)).toBe(
      beforeEntropy,
    );
    await page.evaluate(() => {
      crypto.randomUUID = window.realUUID;
    });
    const exportedFiles = [];
    for (const role of ["Owner", "Admin", "Editor", "Viewer"]) {
      await page.evaluate(
        (role) =>
          window.update({
            snapshot: {
              ...window.snapshot,
              workspaces: [{ ...window.snapshot.workspaces[0], role }],
            },
          }),
        role,
      );
      await exportButton.click();
      await expect(exportButton).toBeDisabled();
      const delivered = page.waitForEvent("download");
      await resolveExport();
      const download = await delivered;
      expect(download.suggestedFilename()).toBe("dispatch-self-profile.json");
      const data = JSON.parse(readFileSync(await download.path(), "utf8"));
      exportedFiles.push(data);
      expect(data.membership.role).toBe(role);
      expect(data.profile.audience).toBe("Eigenes Publikum 🧭");
      expect(Object.keys(data.workspace).sort()).toEqual(["id", "name"]);
      expect(JSON.stringify(data)).not.toMatch(
        /authId|sessionId|requestKey|token|ownerId|localStorage/,
      );
      expect(data.coverage.kind).toBe("selected_workspace_self_profile");
      await expect(exportButton).toBeEnabled();
      await page.clock.runFor(1001);
    }
    const keys = await page.evaluate(() =>
      window.exportRequests.map((r) => r.args.requestKey),
    );
    expect(new Set(keys).size).toBe(4);
    expect(keys.every((key) => key.length > 0 && key.length <= 64)).toBe(true);
    expect(await page.evaluate(() => window.urlRevocations.length)).toBe(4);
    expect(await page.evaluate(() => window.storageWrites)).toEqual([]);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.screenshot({
      path: `${evidence}/profile-export-1280.png`,
      fullPage: false,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: `${evidence}/profile-export-390.png`,
      fullPage: false,
    });
    const downloadEvents = [];
    page.on("download", (d) => downloadEvents.push(d.suggestedFilename()));
    for (const mismatch of [
      { sessionId: "foreign-native-session" },
      { authId: "foreign-native-user" },
      { requestKey: "wrong-response-key" },
    ]) {
      await exportButton.click();
      await resolveExport(mismatch);
      await expect(page.getByRole("alert")).toContainText(
        "Anmeldung oder Auswahl hat sich geändert",
      );
    }
    const revocationsBeforeFailure = await page.evaluate(
      () => window.urlRevocations.length,
    );
    await page.evaluate(() => {
      window.realAnchorClick = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = () => {
        throw Error("PRIVATE_HANDOFF_FAILURE");
      };
    });
    await exportButton.click();
    await resolveExport();
    await expect(page.getByRole("alert")).toContainText(
      "Profil-Export konnte nicht erstellt werden",
    );
    expect(await page.evaluate(() => window.urlRevocations.length)).toBe(
      revocationsBeforeFailure + 1,
    );
    await expect(exportButton).toBeEnabled();
    await page.evaluate(() => {
      HTMLAnchorElement.prototype.click = window.realAnchorClick;
    });
    await exportButton.click();
    await page.evaluate(() =>
      window.exportRequests.at(-1).reject(Error("PRIVATE_EXPORT_FAILURE")),
    );
    await expect(page.getByRole("alert")).toContainText(
      "Profil-Export konnte nicht erstellt werden",
    );
    expect(await page.locator("main").innerText()).not.toContain(
      "PRIVATE_EXPORT_FAILURE",
    );
    await exportButton.click();
    const oldRole = await page.evaluate(() => window.exportRequests.length - 1);
    await page.evaluate(() =>
      window.update({
        snapshot: {
          ...window.snapshot,
          workspaces: [{ ...window.snapshot.workspaces[0], role: "Admin" }],
        },
      }),
    );
    await expect(exportButton).toBeEnabled();
    await resolveExport({}, oldRole);
    // Actual observed session A→B→A and workspace A→B→A remounts reject outstanding old results/errors.
    await exportButton.click();
    const oldSession = await page.evaluate(
      () => window.exportRequests.length - 1,
    );
    await page.evaluate(() =>
      window.update({
        session: { ...window.session, session: { id: "session-other" } },
      }),
    );
    await expect(exportButton).toBeEnabled();
    await page.evaluate(() =>
      window.update({
        session: { ...window.session, session: { id: "session-owner" } },
      }),
    );
    await expect(exportButton).toBeEnabled();
    await resolveExport({}, oldSession);
    await exportButton.click();
    const oldWorkspace = await page.evaluate(
      () => window.exportRequests.length - 1,
    );
    await page.evaluate(() =>
      window.update({
        snapshot: {
          ...window.snapshot,
          activeWorkspaceId: "workspace-other",
          workspaces: [
            { ...window.snapshot.workspaces[0], id: "workspace-other" },
          ],
        },
        roster: { ...window.roster, workspaceId: "workspace-other" },
      }),
    );
    await expect(exportButton).toBeEnabled();
    await page.evaluate(() =>
      window.update({
        snapshot: {
          ...window.snapshot,
          activeWorkspaceId: "workspace-native",
          workspaces: [
            { ...window.snapshot.workspaces[0], id: "workspace-native" },
          ],
        },
        roster: { ...window.roster, workspaceId: "workspace-native" },
      }),
    );
    await expect(exportButton).toBeEnabled();
    await page.evaluate(
      (index) =>
        window.exportRequests[index].reject(
          Error("PRIVATE_LATE_EXPORT_FAILURE"),
        ),
      oldWorkspace,
    );
    await expect(page.getByRole("alert")).toHaveCount(0);
    await exportButton.click();
    const unmounted = await page.evaluate(
      () => window.exportRequests.length - 1,
    );
    await page.getByRole("link", { name: "Mein Profil", exact: true }).click();
    await resolveExport({}, unmounted);
    expect(downloadEvents).toEqual([]);
    const allExportKeys = await page.evaluate(() =>
      window.exportRequests.map((r) => r.args.requestKey),
    );
    expect(new Set(allExportKeys).size).toBe(allExportKeys.length);
    expect(
      await page.evaluate(() =>
        window.commands.filter((c) => c.name !== "users:bootstrap"),
      ),
    ).toEqual([]);
    expect(await page.evaluate(() => window.storageWrites)).toEqual([]);

    // TASK-33.1 unit 1: actual mounted native Settings preferences download with mocked transport.
    await page.goto("http://127.0.0.1:5189/settings/data");
    const preferencesExportButton = page.getByRole("button", {
      name: "Eigene Einstellungen als JSON herunterladen",
      exact: true,
    });
    const resolvePreferencesExport = (patch = {}, index = -1, dataPatch = {}) =>
      page.evaluate(
        ({ patch, index, dataPatch }) => {
          const request = window.preferencesExportRequests.at(index),
            observedAt = Date.now();
          request.resolve({
            authId: request.args.expectedAuthId,
            sessionId: request.args.expectedSessionId,
            requestKey: request.args.requestKey,
            workspaceId: request.args.workspaceId,
            observedAt,
            proofValidUntil: observedAt + 10000,
            data: {
              format: "dispatch-self-preferences",
              version: 1,
              observedAt,
              workspaceId: request.args.workspaceId,
              profile: structuredClone(window.snapshot.preferences),
              notifications: null,
              researchSummaries: [
                {
                  orderId: "own-original-order",
                  generation: 1,
                  accountId: "account-native",
                  profileId: "own-research-profile",
                  profileVersionId: "own-profile-version",
                  finishedAt: observedAt - 1000,
                  deadline: observedAt + 20000,
                  sourceUntil: observedAt + 20000,
                  availableAt: observedAt - 1000,
                  proofValidUntil: observedAt + 10000,
                },
              ],
              coverage: {
                kind: "selected_workspace_self_preferences",
                complete: false,
                included: [
                  "own_profile",
                  "stored_own_notification_settings",
                  "currently_authorized_own_research_summary_metadata",
                ],
                unsupported: [
                  "full_personal_or_workspace_archive",
                  "private_content_and_components",
                ],
              },
              ...dataPatch,
            },
            ...patch,
          });
        },
        { patch, index, dataPatch },
      );
    await expect(preferencesExportButton).toBeVisible();
    const preferencesExportFiles = [];
    for (const role of ["Owner", "Admin", "Editor", "Viewer"]) {
      await page.evaluate(
        (role) =>
          window.update({
            snapshot: {
              ...window.snapshot,
              workspaces: [{ ...window.snapshot.workspaces[0], role }],
            },
          }),
        role,
      );
      await expect(preferencesExportButton).toBeEnabled();
      await preferencesExportButton.click();
      await expect(preferencesExportButton).toBeDisabled();
      const delivered = page.waitForEvent("download");
      await resolvePreferencesExport(
        {},
        -1,
        role === "Viewer"
          ? {
              notifications: {
                revision: 3,
                email: false,
                weekly: false,
                research: false,
                inAppSummaries: false,
                timezone: "UTC",
                quiet: null,
              },
            }
          : {},
      );
      const download = await delivered;
      expect(download.suggestedFilename()).toBe(
        "dispatch-self-preferences.json",
      );
      const data = JSON.parse(readFileSync(await download.path(), "utf8"));
      preferencesExportFiles.push(data);
      expect(data.profile.name).toBe("Native Owner");
      expect(data.coverage.complete).toBe(false);
      expect(data.researchSummaries[0].orderId).toBe("own-original-order");
      expect(Object.keys(data.researchSummaries[0]).sort()).toEqual(
        [
          "accountId",
          "availableAt",
          "deadline",
          "finishedAt",
          "generation",
          "orderId",
          "profileId",
          "profileVersionId",
          "proofValidUntil",
          "sourceUntil",
        ].sort(),
      );
      expect(data.notifications).toEqual(
        role === "Viewer"
          ? {
              revision: 3,
              email: false,
              weekly: false,
              research: false,
              inAppSummaries: false,
              timezone: "UTC",
              quiet: null,
            }
          : null,
      );
      expect(JSON.stringify(data)).not.toMatch(
        /authId|sessionId|requestKey|token|summaryEpoch|activeSummary|expiryJob|"job"|localStorage/,
      );
      await expect(preferencesExportButton).toBeEnabled();
      await page.clock.runFor(1001);
    }
    const preferencesDownloads = downloadEvents.length;
    for (const mismatch of [
      { sessionId: "foreign" },
      { authId: "foreign" },
      { workspaceId: "foreign" },
      { requestKey: "foreign" },
      { proofValidUntil: 0 },
    ]) {
      await preferencesExportButton.click();
      await resolvePreferencesExport(mismatch);
      await expect(page.getByRole("alert")).toContainText(
        "Anmeldung oder Auswahl hat sich geändert",
      );
      await expect(preferencesExportButton).toBeEnabled();
    }
    await preferencesExportButton.click();
    const largeProfile = await page.evaluate(() => ({
      ...window.snapshot.preferences,
      topics: "🧭".repeat(20000),
    }));
    await resolvePreferencesExport({}, -1, { profile: largeProfile });
    await expect(page.getByRole("alert")).toContainText(
      "Anmeldung oder Auswahl hat sich geändert",
    );
    expect(downloadEvents.length).toBe(preferencesDownloads);
    for (const dimension of ["session", "workspace"]) {
      await preferencesExportButton.click();
      const old = await page.evaluate(
        () => window.preferencesExportRequests.length - 1,
      );
      await page.evaluate((dimension) => {
        window.preferencesOldSession = structuredClone(window.session);
        window.preferencesOldSnapshot = structuredClone(window.snapshot);
        window.preferencesOldRoster = structuredClone(window.roster);
        if (dimension === "session")
          window.update({
            session: { ...window.session, session: { id: "other-session" } },
          });
        else
          window.update({
            snapshot: {
              ...window.snapshot,
              activeWorkspaceId: "workspace-other",
              workspaces: [
                { ...window.snapshot.workspaces[0], id: "workspace-other" },
              ],
            },
            roster: { ...window.roster, workspaceId: "workspace-other" },
          });
      }, dimension);
      await expect(preferencesExportButton).toBeEnabled();
      await page.evaluate(() =>
        window.update({
          session: window.preferencesOldSession,
          snapshot: window.preferencesOldSnapshot,
          roster: window.preferencesOldRoster,
        }),
      );
      await expect(preferencesExportButton).toBeEnabled();
      await resolvePreferencesExport({}, old);
      await expect(page.getByRole("alert")).toHaveCount(0);
    }
    expect(downloadEvents.length).toBe(preferencesDownloads);
    const preferenceRevokeBefore = await page.evaluate(
      () => window.urlRevocations.length,
    );
    await page.evaluate(() => {
      window.preferencesAnchorClick = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = () => {
        throw Error("PRIVATE_PREFERENCES_HANDOFF_FAILURE");
      };
    });
    await preferencesExportButton.click();
    await resolvePreferencesExport();
    await expect(page.getByRole("alert")).toContainText(
      "Einstellungs-Export konnte nicht erstellt werden",
    );
    expect(await page.evaluate(() => window.urlRevocations.length)).toBe(
      preferenceRevokeBefore + 1,
    );
    await page.evaluate(() => {
      HTMLAnchorElement.prototype.click = window.preferencesAnchorClick;
    });
    await preferencesExportButton.click();
    await page.evaluate(() => {
      window.preferencesCreateURL = URL.createObjectURL;
      window.preferencesNow = Date.now;
      URL.createObjectURL = (blob) => {
        const url = window.preferencesCreateURL(blob);
        Date.now = () => window.preferencesNow() + 60000;
        return url;
      };
    });
    await resolvePreferencesExport();
    await expect(page.getByRole("alert")).toContainText(
      "Einstellungs-Export konnte nicht erstellt werden",
    );
    expect(await page.evaluate(() => window.urlRevocations.length)).toBe(
      preferenceRevokeBefore + 2,
    );
    await page.evaluate(() => {
      URL.createObjectURL = window.preferencesCreateURL;
      Date.now = window.preferencesNow;
    });
    expect(downloadEvents.length).toBe(preferencesDownloads);
    await preferencesExportButton.click();
    const unmountedPreferences = await page.evaluate(
      () => window.preferencesExportRequests.length - 1,
    );
    await page.getByRole("link", { name: "Mein Profil", exact: true }).click();
    await resolvePreferencesExport({}, unmountedPreferences);
    expect(downloadEvents.length).toBe(preferencesDownloads);
    expect(await page.evaluate(() => window.storageWrites)).toEqual([]);
    expect(
      await page.evaluate(() =>
        window.commands.filter((command) => command.name !== "users:bootstrap"),
      ),
    ).toEqual([]);
    expect(await page.locator("main").innerText()).not.toContain(
      "PRIVATE_PREFERENCES_HANDOFF_FAILURE",
    );

    // TASK-33.1: shared family archive uses the real Settings consumer and download.
    await page.goto("http://127.0.0.1:5189/settings/data");
    const archiveButton = page.getByRole("button", {
      name: /Archivseite herunterladen/,
    });
    const resolveArchive = (patch = {}, index = -1) =>
      page.evaluate(
        ({ patch, index }) => {
          const r = window.archiveRequests.at(index),
            observedAt = Date.now();
          r.resolve({
            authId: r.args.expectedAuthId,
            sessionId: r.args.expectedSessionId,
            requestKey: r.args.requestKey,
            workspaceId: r.args.workspaceId,
            role: window.snapshot.workspaces[0].role,
            observedAt,
            proofValidUntil: observedAt + 30000,
            creationUpperBound: r.args.creationUpperBound ?? observedAt,
            cursor: "archive-next",
            isDone: false,
            data: {
              format: "dispatch-workspace-shared",
              version: 1,
              workspaceId: r.args.workspaceId,
              selection: {
                family: r.args.family,
                rows: [
                  {
                    privateFingerprint: "PRIVATE_FINGERPRINT",
                    id: "draft-shared",
                    createdInDatabaseAt: 1,
                    revision: 1,
                    currentVersionId: "version-shared",
                    authorId: "user-owner",
                    source: "Manuell",
                    updatedAt: 1,
                    content: {
                      title: "Archivinhalt",
                      text: ["Original 🧭"],
                      media: [
                        {
                          assetId: "media-reference",
                          alt: "Alt",
                          objectKey: "PRIVATE_OBJECT_KEY",
                          checksum: "PRIVATE_CHECKSUM",
                        },
                      ],
                      accountId: null,
                      pillar: "Wissen",
                      strategy: "Teilen",
                    },
                  },
                ],
              },
            },
            ...patch,
          });
        },
        { patch, index },
      );
    await expect(archiveButton).toBeVisible();
    await expect(
      page.getByRole("combobox", { name: "Archivbereich" }),
    ).toBeVisible();
    await archiveButton.click();
    await expect(archiveButton).toBeDisabled();
    const archiveDownload = page.waitForEvent("download");
    await resolveArchive();
    const archiveFile = JSON.parse(
      readFileSync(await (await archiveDownload).path(), "utf8"),
    );
    expect(archiveFile.selection.rows[0].content.text).toEqual(["Original 🧭"]);
    expect(JSON.stringify(archiveFile)).not.toMatch(
      /authId|sessionId|requestKey|cursor|fingerprint|objectKey|checksum/,
    );
    await expect(archiveButton).toBeEnabled();
    await archiveButton.click();
    expect(
      await page.evaluate(() => window.archiveRequests.at(-1).args.cursor),
    ).toBe("archive-next");
    await resolveArchive({ proofValidUntil: 1 });
    await expect(page.getByRole("alert")).toContainText(
      "Archiv-Export konnte nicht erstellt werden",
    );
    for (const field of ["session", "role", "account", "family", "workspace"]) {
      await archiveButton.click();
      const old = await page.evaluate(() => window.archiveRequests.length - 1),
        before = downloadEvents.length;
      if (field === "family") {
        await page
          .getByRole("combobox", { name: "Archivbereich" })
          .selectOption("ideas");
        await page
          .getByRole("combobox", { name: "Archivbereich" })
          .selectOption("drafts");
      } else if (field === "account") {
        await page
          .getByRole("combobox", { name: "Aktiver Account", exact: true })
          .selectOption("account-native");
        await page
          .getByRole("combobox", { name: "Aktiver Account", exact: true })
          .selectOption("");
      } else if (field === "workspace") {
        for (const id of ["workspace-other", "workspace-native"]) {
          await page.evaluate(
            (id) =>
              window.update({
                snapshot: {
                  ...window.snapshot,
                  activeWorkspaceId: id,
                  workspaces: [{ ...window.snapshot.workspaces[0], id }],
                },
                roster: { ...window.roster, workspaceId: id },
              }),
            id,
          );
          await expect(archiveButton).toBeEnabled();
        }
      } else {
        const value = await page.evaluate(
          (field) =>
            field === "session"
              ? window.session.session.id
              : window.snapshot.workspaces[0].role,
          field,
        );
        for (const next of [
          field === "session" ? "other-session" : "Admin",
          value,
        ]) {
          await page.evaluate(
            ({ field, next }) => {
              if (field === "session")
                window.update({
                  session: {
                    ...window.session,
                    session: { ...window.session.session, id: next },
                  },
                });
              else
                window.update({
                  snapshot: {
                    ...window.snapshot,
                    workspaces: window.snapshot.workspaces.map((w) => ({
                      ...w,
                      role: next,
                    })),
                  },
                });
            },
            { field, next },
          );
          await expect(archiveButton).toBeEnabled();
        }
      }
      await resolveArchive({}, old);
      expect(downloadEvents.length).toBe(before);
      await expect(page.getByRole("alert")).toHaveCount(0);
    }
    const archiveRevokes = await page.evaluate(
      () => window.urlRevocations.length,
    );
    await page.evaluate(() => {
      HTMLAnchorElement.prototype.click = () => {
        throw Error("PRIVATE_ARCHIVE_HANDOFF_FAILURE");
      };
    });
    await archiveButton.click();
    await resolveArchive();
    await expect(page.getByRole("alert")).toContainText(
      "Archiv-Export konnte nicht erstellt werden",
    );
    expect(await page.evaluate(() => window.urlRevocations.length)).toBe(
      archiveRevokes + 1,
    );
    await page.evaluate(() => {
      HTMLAnchorElement.prototype.click = window.realAnchorClick;
      window.archiveCreateURL = URL.createObjectURL;
      window.archiveNow = Date.now;
      URL.createObjectURL = (blob) => {
        const url = window.archiveCreateURL(blob);
        Date.now = () => window.archiveNow() + 60000;
        return url;
      };
    });
    const archiveBeforeExpiry = downloadEvents.length;
    await archiveButton.click();
    await resolveArchive();
    await expect(page.getByRole("alert")).toContainText(
      "Archiv-Export konnte nicht erstellt werden",
    );
    expect(downloadEvents.length).toBe(archiveBeforeExpiry);
    await page.evaluate(() => {
      URL.createObjectURL = window.archiveCreateURL;
      Date.now = window.archiveNow;
    });
    await archiveButton.click();
    const archiveUnmounted = await page.evaluate(
      () => window.archiveRequests.length - 1,
    );
    await page.getByRole("link", { name: "Mein Profil", exact: true }).click();
    await resolveArchive({}, archiveUnmounted);
    expect(downloadEvents.length).toBe(archiveBeforeExpiry);

    // Private archives use the same native Settings download consumer. Transport is mocked; native proof tests are separate.
    await page.goto("http://127.0.0.1:5189/settings/data");
    await page
      .getByRole("combobox", { name: "Aktiver Account", exact: true })
      .selectOption("account-native");
    await page
      .getByRole("combobox", { name: "Archivbereich" })
      .selectOption("conversationMessages");
    await page
      .getByLabel("Unterhaltung-ID", { exact: true })
      .fill("conversation-own");
    const resolvePrivate = (patch = {}, index = -1) =>
      page.evaluate(
        ({ patch, index }) => {
          const r = window.privateArchiveRequests.at(index),
            now = Date.now(),
            family = r.name.split(":")[1];
          r.resolve({
            authId: r.args.expectedAuthId,
            sessionId: r.args.expectedSessionId,
            requestKey: r.args.requestKey,
            workspaceId: r.args.workspaceId,
            role: window.snapshot.workspaces[0].role,
            observedAt: now,
            proofValidUntil: now + 30000,
            selectionUpperBound: null,
            cursor: "private-next",
            isDone: false,
            accountId: r.args.accountId ?? "account-native",
            conversationId: r.args.conversationId,
            orderId: r.args.orderId,
            data: {
              format: "dispatch-workspace-private",
              version: 1,
              workspaceId: r.args.workspaceId,
              selection: {
                family,
                rows:
                  family === "workflowSteps"
                    ? [
                        {
                          orderId: r.args.orderId,
                          stepNumber: 1,
                          stage: "prepare",
                          kind: "function",
                          startedAt: now,
                          resultKind: "success",
                          args: "SECRET_ARGS",
                        },
                      ]
                    : family === "orderEvidence"
                      ? [
                          {
                            evidenceId: "evidence-own",
                            orderId: r.args.orderId,
                            actorId: "record-author",
                            annotationActorId: "annotation-author",
                            inboxActorId: "inbox-actor",
                            createdAt: now,
                            sourceId: "source-own",
                            observedAt: now,
                            sourceGeneration: 1,
                            minretentionUntil: now + 30000,
                            commandKey: "SECRET_COMMAND",
                          },
                        ]
                      : [
                          {
                            conversationId: r.args.conversationId,
                            messageId: "native-message",
                            _creationTime: now,
                            order: 0,
                            stepOrder: 0,
                            status: "failed",
                            role: "assistant",
                            text: "Own retained text",
                            threadId: "SECRET_THREAD",
                            provider: "SECRET_PROVIDER",
                          },
                        ],
              },
            },
            ...patch,
          });
        },
        { patch, index },
      );
    await archiveButton.click();
    const privateDownload = page.waitForEvent("download");
    await resolvePrivate();
    const privateFile = JSON.parse(
      readFileSync(await (await privateDownload).path(), "utf8"),
    );
    expect(privateFile.selection.rows[0].text).toBe("Own retained text");
    expect(JSON.stringify(privateFile)).not.toMatch(
      /SECRET_|sessionId|requestKey|threadId/,
    );
    const privateBefore = downloadEvents.length;
    await archiveButton.click();
    const privateOld = await page.evaluate(
      () => window.privateArchiveRequests.length - 1,
    );
    await page
      .getByLabel("Unterhaltung-ID", { exact: true })
      .fill("conversation-other");
    await page
      .getByLabel("Unterhaltung-ID", { exact: true })
      .fill("conversation-own");
    await resolvePrivate({}, privateOld);
    expect(downloadEvents.length).toBe(privateBefore);
    for (const patch of [
      { conversationId: "foreign" },
      { accountId: "foreign" },
      { proofValidUntil: 1 },
    ]) {
      await archiveButton.click();
      await resolvePrivate(patch);
      await expect(page.getByRole("alert")).toContainText(
        "Archiv-Export konnte nicht erstellt werden",
      );
      expect(downloadEvents.length).toBe(privateBefore);
    }
    await page
      .getByRole("combobox", { name: "Archivbereich" })
      .selectOption("workflowSteps");
    await page
      .getByLabel("Research-Auftrag-ID", { exact: true })
      .fill("order-own");
    await archiveButton.click();
    const journalDownload = page.waitForEvent("download");
    await resolvePrivate();
    const journalFile = JSON.parse(
      readFileSync(await (await journalDownload).path(), "utf8"),
    );
    expect(journalFile.selection.rows[0].stage).toBe("prepare");
    expect(JSON.stringify(journalFile)).not.toContain("SECRET_ARGS");
    await page
      .getByRole("combobox", { name: "Archivbereich" })
      .selectOption("orderEvidence");
    await archiveButton.click();
    const evidenceDownload = page.waitForEvent("download");
    await resolvePrivate();
    const evidenceFile = JSON.parse(
      readFileSync(await (await evidenceDownload).path(), "utf8"),
    );
    expect(evidenceFile.selection.rows[0]).toMatchObject({
      actorId: "record-author",
      annotationActorId: "annotation-author",
      inboxActorId: "inbox-actor",
    });
    expect(JSON.stringify(evidenceFile)).not.toContain("SECRET_COMMAND");
    for (const role of ["Editor", "Viewer"]) {
      await page.evaluate(
        (role) =>
          window.update({
            snapshot: {
              ...window.snapshot,
              workspaces: window.snapshot.workspaces.map((w) => ({
                ...w,
                role,
              })),
            },
          }),
        role,
      );
      await page
        .getByRole("combobox", { name: "Aktiver Account", exact: true })
        .selectOption("account-native");
      await page
        .getByRole("combobox", { name: "Archivbereich" })
        .selectOption("conversationMessages");
      await page
        .getByLabel("Unterhaltung-ID", { exact: true })
        .fill("conversation-own");
      await expect(
        page.locator('#archive-family option[value="drafts"]'),
      ).toHaveCount(0);
      await expect(
        page.locator('#archive-family option[value="publicOrders"]'),
      ).toHaveCount(0);
      await archiveButton.click();
      const ownRoleDownload = page.waitForEvent("download");
      await resolvePrivate();
      expect(
        JSON.parse(readFileSync(await (await ownRoleDownload).path(), "utf8"))
          .selection.rows[0].text,
      ).toBe("Own retained text");
    }
    await page.evaluate(() =>
      window.update({
        snapshot: {
          ...window.snapshot,
          workspaces: window.snapshot.workspaces.map((w) => ({
            ...w,
            role: "Owner",
          })),
        },
      }),
    );
    await page
      .getByRole("combobox", { name: "Aktiver Account", exact: true })
      .selectOption("account-native");
    await page
      .getByRole("combobox", { name: "Archivbereich" })
      .selectOption("conversationMessages");
    await page
      .getByLabel("Unterhaltung-ID", { exact: true })
      .fill("conversation-own");
    await archiveButton.click();
    const privateUnmount = await page.evaluate(
        () => window.privateArchiveRequests.length - 1,
      ),
      beforeUnmount = downloadEvents.length;
    await page.getByRole("link", { name: "Mein Profil", exact: true }).click();
    await resolvePrivate({}, privateUnmount);
    expect(downloadEvents.length).toBe(beforeUnmount);

    // TASK-33.1.3: additive shared-version consumer controls.
    await page.goto("http://127.0.0.1:5189/settings/data");
    const versionButton = page.getByRole("button", {
      name: /Versionsseite herunterladen/,
    });
    const resolveVersion = (patch = {}, index = -1) =>
      page.evaluate(
        ({ patch, index }) => {
          const r = window.versionRequests.at(index),
            observedAt = Date.now();
          r.resolve({
            requestKey: r.args.requestKey,
            authId: r.args.expectedAuthId,
            sessionId: window.session.session.id,
            workspaceId: r.args.workspaceId,
            role: window.snapshot.workspaces[0].role,
            creationUpperBound: r.args.creationUpperBound ?? observedAt,
            cursor: "native-next",
            isDone: false,
            observedAt,
            proofValidUntil: observedAt + 30000,
            data: {
              format: "dispatch-workspace-draft-versions",
              version: 1,
              workspaceId: r.args.workspaceId,
              versions: [
                {
                  versionId: "version-shared",
                  draftId: "draft-shared",
                  versionNumber: 1,
                  createdAt: 1,
                  title: "Shared",
                  text: ["First", "Second"],
                  accountId: null,
                  pillar: "Pillar",
                  strategy: "Strategy",
                  reason: "Saved",
                },
              ],
            },
            ...patch,
          });
        },
        { patch, index },
      );
    await expect(versionButton).toBeVisible();
    await expect(
      page.getByText(/Jede Seite prüft die aktuellen Quellen erneut/),
    ).toBeVisible();
    await versionButton.click();
    await expect(versionButton).toBeDisabled();
    const versionDownload = page.waitForEvent("download");
    await resolveVersion();
    const sharedDownload = await versionDownload;
    const sharedFile = JSON.parse(
      readFileSync(await sharedDownload.path(), "utf8"),
    );
    expect(sharedFile.versions[0].text).toEqual(["First", "Second"]);
    expect(JSON.stringify(sharedFile)).not.toMatch(
      /cursor|authId|sessionId|requestKey|media|author/,
    );
    await expect(versionButton).toBeEnabled();
    await versionButton.click();
    const continuation = await page.evaluate(
      () => window.versionRequests.at(-1).args,
    );
    expect(continuation.cursor).toBe("native-next");
    expect(Number.isFinite(continuation.creationUpperBound)).toBe(true);
    await resolveVersion({
      cursor: "native-empty",
      data: {
        format: "dispatch-workspace-draft-versions",
        version: 1,
        workspaceId: continuation.workspaceId,
        versions: [],
      },
    });
    await expect(
      page.getByText(/Diese Seite enthält keine freigegebenen Versionsinhalte/),
    ).toBeVisible();
    await versionButton.click();
    expect(
      await page.evaluate(() => window.versionRequests.at(-1).args.cursor),
    ).toBe("native-empty");
    await resolveVersion({ proofValidUntil: 1 });
    await expect(page.getByRole("alert")).toContainText(
      "Versions-Export konnte nicht erstellt werden",
    );
    await expect(versionButton).toBeEnabled();
    await versionButton.click();
    expect(
      await page.evaluate(() => window.versionRequests.at(-1).args.cursor),
    ).toBe("native-empty");
    await resolveVersion({ requestKey: "foreign" });
    await expect(versionButton).toBeEnabled();
    await versionButton.click();
    await resolveVersion({
      isDone: true,
      cursor: "native-end",
      data: {
        format: "dispatch-workspace-draft-versions",
        version: 1,
        workspaceId: continuation.workspaceId,
        versions: [],
      },
    });
    const restartVersion = page.getByRole("button", {
      name: "Neue Versionsauswahl beginnen",
      exact: true,
    });
    await expect(restartVersion).toBeEnabled();
    await restartVersion.click();
    expect(
      await page.evaluate(() => window.versionRequests.at(-1).args.cursor),
    ).toBeNull();
    expect(
      await page.evaluate(
        () => window.versionRequests.at(-1).args.creationUpperBound,
      ),
    ).toBeNull();
    await page.evaluate(() =>
      window.versionRequests
        .at(-1)
        .reject(Error("PRIVATE_NATIVE_RESOURCE_FAILURE")),
    );
    await expect(versionButton).toBeEnabled();
    for (const target of ["session", "workspace", "role"]) {
      await versionButton.click();
      const old = await page.evaluate(() => window.versionRequests.length - 1);
      const downloadsBefore = downloadEvents.length;
      await page.evaluate((target) => {
        if (target === "session")
          window.update({
            session: { ...window.session, session: { id: "session-other" } },
          });
        if (target === "workspace")
          window.update({
            snapshot: {
              ...window.snapshot,
              activeWorkspaceId: "workspace-other",
              workspaces: [
                { ...window.snapshot.workspaces[0], id: "workspace-other" },
              ],
            },
            roster: { ...window.roster, workspaceId: "workspace-other" },
          });
        if (target === "role")
          window.update({
            snapshot: {
              ...window.snapshot,
              workspaces: [
                { ...window.snapshot.workspaces[0], role: "Viewer" },
              ],
            },
          });
      }, target);
      if (target === "role") await expect(versionButton).toHaveCount(0);
      else await expect(versionButton).toBeEnabled();
      await page.evaluate((target) => {
        if (target === "session")
          window.update({
            session: { ...window.session, session: { id: "session-owner" } },
          });
        if (target === "workspace")
          window.update({
            snapshot: {
              ...window.snapshot,
              activeWorkspaceId: "workspace-native",
              workspaces: [
                { ...window.snapshot.workspaces[0], id: "workspace-native" },
              ],
            },
            roster: { ...window.roster, workspaceId: "workspace-native" },
          });
        if (target === "role")
          window.update({
            snapshot: {
              ...window.snapshot,
              workspaces: [{ ...window.snapshot.workspaces[0], role: "Admin" }],
            },
          });
      }, target);
      await expect(versionButton).toBeEnabled();
      await resolveVersion({}, old);
      expect(downloadEvents.length).toBe(downloadsBefore);
      await expect(page.getByRole("alert")).toHaveCount(0);
    }
    await versionButton.click();
    const accountABA = await page.evaluate(
      () => window.versionRequests.length - 1,
    );
    const accountDownloads = downloadEvents.length;
    await page
      .getByRole("combobox", { name: "Aktiver Account", exact: true })
      .selectOption("account-native");
    await expect(versionButton).toBeEnabled();
    await page
      .getByRole("combobox", { name: "Aktiver Account", exact: true })
      .selectOption("");
    await expect(versionButton).toBeEnabled();
    await resolveVersion({}, accountABA);
    expect(downloadEvents.length).toBe(accountDownloads);
    const revokeCount = await page.evaluate(() => window.urlRevocations.length);
    await page.evaluate(() => {
      HTMLAnchorElement.prototype.click = () => {
        throw Error("PRIVATE_HANDOFF_FAILURE");
      };
    });
    await versionButton.click();
    await resolveVersion();
    await expect(page.getByRole("alert")).toContainText(
      "Versions-Export konnte nicht erstellt werden",
    );
    await expect(versionButton).toBeEnabled();
    expect(await page.evaluate(() => window.urlRevocations.length)).toBe(
      revokeCount + 1,
    );
    await page.evaluate(() => {
      HTMLAnchorElement.prototype.click = window.realAnchorClick;
    });
    await versionButton.click();
    expect(
      await page.evaluate(() => window.versionRequests.at(-1).args.cursor),
    ).toBeNull();
    const expiryDownloads = downloadEvents.length;
    await page.evaluate(() => {
      window.realCreateURL = URL.createObjectURL.bind(URL);
      window.realNow = Date.now;
      URL.createObjectURL = (blob) => {
        const url = window.realCreateURL(blob);
        Date.now = () => window.realNow() + 60000;
        return url;
      };
    });
    await resolveVersion();
    await expect(page.getByRole("alert")).toContainText(
      "Versions-Export konnte nicht erstellt werden",
    );
    expect(downloadEvents.length).toBe(expiryDownloads);
    await page.evaluate(() => {
      URL.createObjectURL = window.realCreateURL;
      Date.now = window.realNow;
    });
    await expect(versionButton).toBeEnabled();
    expect(
      await page.evaluate(() => window.urlRevocations.length),
    ).toBeGreaterThan(0);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    await page.waitForTimeout(500);
    await page.screenshot({
      path: `${evidence}/workspace-versions-1280.png`,
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    await page.waitForTimeout(500);
    await page.screenshot({
      path: `${evidence}/workspace-versions-390.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.evaluate(() => {
      crypto.randomUUID = () => {
        throw Error("PRIVATE_ENTROPY");
      };
    });
    const versionCount = await page.evaluate(
      () => window.versionRequests.length,
    );
    await versionButton.click();
    await expect(versionButton).toBeEnabled();
    expect(await page.evaluate(() => window.versionRequests.length)).toBe(
      versionCount,
    );
    await page.evaluate(() => {
      crypto.randomUUID = window.realUUID;
    });
    await versionButton.click();
    const lateVersion = await page.evaluate(
      () => window.versionRequests.length - 1,
    );
    await page.getByRole("link", { name: "Mein Profil", exact: true }).click();
    await resolveVersion({}, lateVersion);
    await expect(page.getByRole("alert")).toHaveCount(0);

    // TASK-32.3 supersedes only Cloud-all-disabled/no-own-setter controls.
    await page.goto("http://127.0.0.1:5189/settings/notifications");
    const options = [
      "In-App-Zusammenfassungen",
      "E-Mail-Zusammenfassungen",
      "Wöchentlicher Überblick",
      "Research-Zusammenfassungen",
      "Ruhezeiten",
    ];
    const reloadPreferences = page.getByRole("button", {
      name: "Änderungen verwerfen und neu laden",
      exact: true,
    });
    const savePreferences = page.getByRole("button", {
      name: "Benachrichtigungswünsche speichern",
      exact: true,
    });
    const resolvePreference = (patch = {}, index = -1) =>
      page.evaluate(
        ({ patch, index }) => {
          const r = window.preferenceSaves.at(index);
          window.preferenceStored = {
            ...r.args.settings,
            revision: r.args.expectedRevision + 1,
          };
          r.resolve({
            authId: r.args.expectedAuthId,
            sessionId: r.sessionId,
            workspaceId: r.args.workspaceId,
            requestKey: r.args.requestKey,
            settings: structuredClone(window.preferenceStored),
            ...patch,
          });
        },
        { patch, index },
      );
    await expect(
      page.getByText("Benachrichtigungswünsche werden geladen …", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(savePreferences).toHaveCount(0);
    await page.evaluate(() => window.publishPreferences());
    for (const name of options) {
      await expect(
        page.getByRole("switch", { name, exact: true }),
      ).toHaveAttribute("aria-checked", "false");
      await expect(
        page.getByRole("switch", { name, exact: true }),
      ).toBeEnabled();
    }
    await expect(
      page.getByText(
        "Eigene Research-Abschlüsse erscheinen bei aktivierten In-App- und Research-Zusammenfassungen nach deinen Ruhezeiten. Die Auswahl ist auf fünf ursprüngliche Abschlüsse begrenzt; weitere Abdeckung bleibt unbekannt. E-Mail und Wochenüberblick sind noch nicht verfügbar.",
      ),
    ).toBeVisible();
    for (const role of ["Owner", "Admin", "Editor", "Viewer"]) {
      await page.evaluate(
        (role) =>
          window.update({
            snapshot: {
              ...window.snapshot,
              workspaces: [{ ...window.snapshot.workspaces[0], role }],
            },
          }),
        role,
      );
      await reloadPreferences.click();
      await expect(
        page.getByTestId("native-notification-preferences"),
      ).toHaveCount(0);
      await page.evaluate(() => window.publishPreferences());
      const email = page.getByRole("switch", {
        name: "E-Mail-Zusammenfassungen",
        exact: true,
      });
      const prior = await email.getAttribute("aria-checked");
      await email.click();
      await expect(savePreferences).toBeEnabled();
      await savePreferences.click();
      await expect(savePreferences).toBeDisabled();
      await resolvePreference();
      await expect(
        page.getByText(
          "Benachrichtigungswünsche gespeichert. Eigene Research-Abschlüsse richten sich nach deinen In-App- und Research-Wünschen.",
          { exact: true },
        ),
      ).toBeVisible();
      // An old subscription must not roll back the just-acknowledged local revision.
      await expect(email).toHaveAttribute(
        "aria-checked",
        prior === "true" ? "false" : "true",
      );
      await reloadPreferences.click();
      await expect(
        page.getByTestId("native-notification-preferences"),
      ).toHaveCount(0);
      await page.evaluate(() => window.publishPreferences());
      await expect(email).toHaveAttribute(
        "aria-checked",
        prior === "true" ? "false" : "true",
      );
    }
    await page.getByRole("switch", { name: "Ruhezeiten", exact: true }).click();
    await page
      .getByRole("textbox", {
        name: "Zeitzone für Benachrichtigungswünsche",
        exact: true,
      })
      .fill("Europe/Berlin");
    await page.getByLabel("Ruhezeit ab", { exact: true }).fill("21:00");
    await page.getByLabel("Ruhezeit bis", { exact: true }).fill("07:30");
    await page.evaluate(() => {
      window.preferenceStored = {
        ...window.preferenceStored,
        revision: window.preferenceStored.revision + 1,
        timezone: "UTC",
      };
      window.publishPreferences();
    });
    await expect(
      page.getByRole("textbox", {
        name: "Zeitzone für Benachrichtigungswünsche",
        exact: true,
      }),
    ).toHaveValue("Europe/Berlin");
    await expect(
      page.getByText(
        "Gespeicherter Stand wurde zwischenzeitlich geändert. Deine Eingaben bleiben erhalten.",
        { exact: true },
      ),
    ).toBeVisible();
    await savePreferences.click();
    await page.evaluate(() =>
      window.preferenceSaves.at(-1).reject(
        Object.assign(Error("PRIVATE_CONFLICT"), {
          data: "NOTIFICATION_REVISION_CONFLICT",
        }),
      ),
    );
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "Gespeicherter Stand wurde geändert" }),
    ).toBeVisible();
    await expect(
      page.getByRole("textbox", {
        name: "Zeitzone für Benachrichtigungswünsche",
        exact: true,
      }),
    ).toHaveValue("Europe/Berlin");
    await reloadPreferences.click();
    await page.evaluate(() => window.publishPreferences());
    await expect(
      page.getByRole("textbox", {
        name: "Zeitzone für Benachrichtigungswünsche",
        exact: true,
      }),
    ).toHaveValue("UTC");
    // Strict awaited native wire correlation for every field; no saved claim on mismatch.
    for (const patch of [
      { authId: "foreign" },
      { sessionId: "foreign" },
      { workspaceId: "foreign" },
      { requestKey: "foreign" },
    ]) {
      await page
        .getByRole("switch", { name: "E-Mail-Zusammenfassungen", exact: true })
        .click();
      await savePreferences.click();
      await resolvePreference(patch);
      await expect(
        page
          .getByRole("alert")
          .filter({ hasText: "Anmeldung oder Auswahl hat sich geändert" }),
      ).toBeVisible();
      await expect(
        page.getByText(
          "Benachrichtigungswünsche gespeichert. Eigene Research-Abschlüsse richten sich nach deinen In-App- und Research-Wünschen.",
          { exact: true },
        ),
      ).toHaveCount(0);
      await reloadPreferences.click();
      await page.evaluate(() => window.publishPreferences());
    }
    await page
      .getByRole("switch", { name: "E-Mail-Zusammenfassungen", exact: true })
      .click();
    const beforePreferenceEntropy = await page.evaluate(
      () => window.preferenceSaves.length,
    );
    await page.evaluate(() => {
      window.preferenceEntropy = crypto.randomUUID.bind(crypto);
      crypto.randomUUID = () => {
        throw Error("Synthetic entropy");
      };
    });
    await savePreferences.click();
    await expect(
      page.getByRole("alert").filter({
        hasText: "Benachrichtigungswünsche konnten nicht gespeichert werden",
      }),
    ).toBeVisible();
    expect(await page.evaluate(() => window.preferenceSaves.length)).toBe(
      beforePreferenceEntropy,
    );
    await page.evaluate(() => {
      crypto.randomUUID = window.preferenceEntropy;
    });
    await savePreferences.click();
    await resolvePreference();
    await expect(
      page.getByText(
        "Benachrichtigungswünsche gespeichert. Eigene Research-Abschlüsse richten sich nach deinen In-App- und Research-Wünschen.",
        { exact: true },
      ),
    ).toBeVisible();
    for (const patch of [
      { authId: "foreign" },
      { sessionId: "foreign" },
      { workspaceId: "foreign" },
      { requestKey: "foreign" },
    ]) {
      await page.evaluate((patch) => window.publishPreferences(patch), patch);
      await expect(
        page.getByText(
          "Die Einstellungen gehören nicht mehr zur aktuellen Anmeldung oder Auswahl. Bitte neu laden.",
          { exact: true },
        ),
      ).toBeVisible();
      await expect(
        page.getByTestId("native-notification-preferences"),
      ).toHaveCount(0);
      await page.evaluate(() => window.publishPreferences());
    }
    // Real Store observed scope changes discard old asynchronous completions.
    for (const field of ["session", "role", "account", "workspace"]) {
      await page
        .getByRole("switch", { name: "E-Mail-Zusammenfassungen", exact: true })
        .click();
      await savePreferences.click();
      const old = await page.evaluate(() => window.preferenceSaves.length - 1);
      await page.evaluate((field) => {
        if (field === "session")
          window.update({
            session: { ...window.session, session: { id: "session-other" } },
          });
        if (field === "role")
          window.update({
            snapshot: {
              ...window.snapshot,
              workspaces: [{ ...window.snapshot.workspaces[0], role: "Owner" }],
            },
          });
        if (field === "workspace")
          window.update({
            snapshot: {
              ...window.snapshot,
              activeWorkspaceId: "workspace-other",
              workspaces: [
                ...window.snapshot.workspaces,
                {
                  id: "workspace-other",
                  name: "Other",
                  description: "",
                  role: "Owner",
                },
              ],
            },
          });
      }, field);
      if (field === "account")
        await page
          .getByRole("combobox", { name: "Aktiver Account", exact: true })
          .selectOption("account-native");
      await expect(
        page.getByTestId("native-notification-preferences"),
      ).toHaveCount(0);
      await page.evaluate((field) => {
        if (field === "session")
          window.update({
            session: { ...window.session, session: { id: "session-owner" } },
          });
        if (field === "role")
          window.update({
            snapshot: {
              ...window.snapshot,
              workspaces: [
                { ...window.snapshot.workspaces[0], role: "Viewer" },
              ],
            },
          });
        if (field === "workspace")
          window.update({
            snapshot: {
              ...window.snapshot,
              activeWorkspaceId: "workspace-native",
              workspaces: window.snapshot.workspaces.filter(
                (w) => w.id === "workspace-native",
              ),
            },
          });
      }, field);
      if (field === "account")
        await page
          .getByRole("combobox", { name: "Aktiver Account", exact: true })
          .selectOption("");
      await expect(
        page.getByTestId("native-notification-preferences"),
      ).toHaveCount(0);
      await resolvePreference({}, old);
      await expect(
        page.getByText(
          "Benachrichtigungswünsche gespeichert. Eigene Research-Abschlüsse richten sich nach deinen In-App- und Research-Wünschen.",
          { exact: true },
        ),
      ).toHaveCount(0);
      await page.evaluate(() => window.publishPreferences());
    }
    await page
      .getByRole("switch", { name: "E-Mail-Zusammenfassungen", exact: true })
      .click();
    await savePreferences.click();
    const latePreference = await page.evaluate(
      () => window.preferenceSaves.length - 1,
    );
    await reloadPreferences.click();
    await page.evaluate(
      (latePreference) =>
        window.preferenceSaves[latePreference].reject(
          Error("PRIVATE_LATE_FAILURE"),
        ),
      latePreference,
    );
    await page.evaluate(() => window.publishPreferences());
    await expect(page.getByRole("alert")).toHaveCount(0);
    await page.evaluate(() => window.update({ preferenceError: true }));
    await expect(
      page.getByRole("alert").filter({
        hasText: "Benachrichtigungswünsche konnten nicht geladen werden",
      }),
    ).toBeVisible();
    expect(await page.locator("main").innerText()).not.toContain(
      "PRIVATE_PROVIDER_ERROR",
    );
    await page.evaluate(() => window.update({ preferenceError: false }));
    await reloadPreferences.click();
    await page.evaluate(() => window.publishPreferences());
    const saveKeys = await page.evaluate(() =>
      window.preferenceSaves.map((r) => r.args.requestKey),
    );
    expect(new Set(saveKeys).size).toBe(saveKeys.length);
    expect(
      await page.evaluate(() =>
        window.storageWrites.filter((key) => key.endsWith("-notifications")),
      ),
    ).toEqual([]);
    expect(
      await page.evaluate(() =>
        window.commands.filter(
          (c) =>
            c.name !== "users:bootstrap" &&
            c.name !== "preferences:saveNotifications",
        ),
      ),
    ).toEqual([]);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.screenshot({
      path: `${evidence}/notifications-cloud-1280.png`,
      fullPage: false,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: `${evidence}/notifications-cloud-390.png`,
      fullPage: false,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.goto("http://127.0.0.1:5189/overview");
    await page.evaluate(() =>
      window.update({
        resources: {
          ...window.resources,
          notifications: [
            {
              _id: "transport-blocked",
              state: "blocked",
              errorCode: "PRIVATE_TRANSPORT_ERROR",
            },
          ],
        },
        notices: [
          {
            authId: "auth-owner",
            sessionId: "session-owner",
            id: "notice-owner",
            draftId: "draft-notice",
            versionId: "version-notice",
            accountId: "account-native",
            parent: { kind: "assignment", commandId: "assignment-notice" },
            createdAt: 1,
            sourceUntil: null,
            readAt: null,
            dismissedAt: null,
          },
        ],
      }),
    );
    const transport = page
      .getByRole("alert")
      .filter({ hasText: "Publishing-Benachrichtigung" });
    await expect(transport).toContainText(
      "Ob die Nachricht zugestellt wurde, ist damit nicht geklärt.",
    );
    expect(await transport.innerText()).not.toMatch(
      /konnte nicht zugestellt|Zustellung ist fehlgeschlagen|PRIVATE_TRANSPORT_ERROR/,
    );
    await expect(transport.getByRole("link")).toHaveAttribute(
      "href",
      "/settings/integrations",
    );
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.screenshot({
      path: `${evidence}/transport-overview-1280.png`,
      fullPage: false,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: `${evidence}/transport-overview-390.png`,
      fullPage: false,
    });
    await page
      .getByRole("button", { name: "Benachrichtigungen öffnen", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Dein Posteingang", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Entwurf zugewiesen", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Entwurf prüfen", exact: true }),
    ).toHaveAttribute("href", "/drafts/draft-notice");
    await expect(
      page.getByRole("button", { name: "Als gelesen markieren", exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await page.evaluate(() =>
      window.update({
        resources: {
          ...window.resources,
          notifications: [
            { _id: "transport-sent", state: "sent", errorCode: null },
          ],
        },
      }),
    );
    await expect(transport).toHaveCount(0);
    expect(await page.locator("main").innerText()).not.toMatch(
      /Zustellung bestätigt|Nachricht zugestellt|E-Mail gelesen/,
    );
    expect(
      await page.evaluate(() =>
        window.commands.filter((c) => c.name !== "users:bootstrap"),
      ),
    ).toEqual([]);
    // TASK-35.1: actual Cloud Pilot mount, current Store selection and transport correlation.
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("http://127.0.0.1:5189/operations");
    await page
      .getByRole("tab", { name: "Pilot-Auswertung", exact: true })
      .click();
    await expect(
      page.getByText("Bitte einen Account auswählen.", { exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(() =>
        window.queries.filter((q) => q.name === "operations/pilot:get"),
      ),
    ).toEqual([]);
    await page
      .getByRole("combobox", { name: "Aktiver Account", exact: true })
      .selectOption("account-native");
    await expect(
      page.getByText("Messwerte werden geladen …", { exact: true }),
    ).toBeVisible();
    await page.evaluate(() => window.publishPilot());
    await expect(page.getByTestId("native-pilot")).toBeVisible();
    await expect(page.getByTestId("pilot-n")).toHaveText("1");
    await expect(page.getByTestId("pilot-sum")).toHaveText("0");
    await expect(page.getByTestId("pilot-mean")).toHaveText("0");
    expect(await page.locator("main").innerText()).toContain(
      "Der weitere Umfang ist unbekannt",
    );
    expect(await page.locator("main").innerText()).not.toMatch(
      /ROI|Stunden gespart|USD|EUR|opaque-synthetic|test-v1/,
    );
    await page.screenshot({
      path: `${evidence}/pilot-1280.png`,
      fullPage: false,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `${evidence}/pilot-390.png`,
      fullPage: false,
    });
    const oldPilotKey = await page.evaluate(
      () =>
        window.queries.filter((q) => q.name === "operations/pilot:get").at(-1)
          .args.refreshKey,
    );
    await page
      .getByRole("button", { name: "Messwerte aktualisieren", exact: true })
      .click();
    await expect(page.getByTestId("native-pilot")).toHaveCount(0);
    const newPilotKey = await page.evaluate(
      () =>
        window.queries.filter((q) => q.name === "operations/pilot:get").at(-1)
          .args.refreshKey,
    );
    expect(newPilotKey).not.toBe(oldPilotKey);
    await page.evaluate(
      (key) => window.publishPilot({ refreshKey: key }),
      oldPilotKey,
    );
    await expect(
      page.getByText(
        "Der Messnachweis gehört nicht mehr zur aktuellen Auswahl. Bitte aktualisieren.",
      ),
    ).toBeVisible();
    await page.evaluate(() => {
      const a = window.queries
        .filter((q) => q.name === "operations/pilot:get")
        .at(-1).args;
      window.publishPilot();
      const value = window.pilotByKey[a.refreshKey];
      window.publishPilot({
        data: {
          ...value.data,
          cohorts: value.data.cohorts.map((c) => ({
            ...c,
            impressions: { n: 0, sum: null, mean: null },
          })),
        },
      });
    });
    await expect(page.getByTestId("pilot-n")).toHaveText("0");
    await expect(page.getByTestId("pilot-sum")).toHaveText("Unbekannt");
    await expect(page.getByTestId("pilot-mean")).toHaveText("Unbekannt");
    await page.evaluate(() => window.publishPilot());
    const readCount = await page.evaluate(
      () =>
        window.queries.filter((q) => q.name === "operations/pilot:get").length,
    );
    await page.clock.runFor(10001);
    await expect(
      page.getByText("Messnachweis abgelaufen. Bitte aktualisieren."),
    ).toBeVisible();
    await expect(page.getByTestId("native-pilot")).toHaveCount(0);
    // Clock expiry renders locally and keeps the existing subscription key.
    expect(
      await page.evaluate(
        (readCount) => [
          ...new Set(
            window.queries
              .filter((q) => q.name === "operations/pilot:get")
              .slice(readCount)
              .map((q) => q.args.refreshKey),
          ),
        ],
        readCount,
      ),
    ).toEqual([newPilotKey]);
    await page.evaluate(() => {
      window.savedPilotEntropy = crypto.randomUUID.bind(crypto);
      crypto.randomUUID = () => {
        throw Error("Synthetic entropy failure");
      };
    });
    await page
      .getByRole("button", { name: "Messwerte aktualisieren", exact: true })
      .click();
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "Messwerte konnten nicht geladen werden" }),
    ).toBeVisible();
    await expect(page.getByTestId("native-pilot")).toHaveCount(0);
    await page.evaluate(() => {
      crypto.randomUUID = window.savedPilotEntropy;
    });
    await page
      .getByRole("button", { name: "Messwerte aktualisieren", exact: true })
      .click();
    await page.evaluate(() => window.publishPilot());
    await expect(page.getByTestId("native-pilot")).toBeVisible();
    await page.evaluate(() =>
      window.update({
        resources: {
          ...window.resources,
          accounts: [
            ...window.resources.accounts,
            {
              ...window.resources.accounts[0],
              _id: "account-other",
              name: "Other X",
              handle: "@other",
            },
          ],
        },
      }),
    );
    await page
      .getByRole("combobox", { name: "Aktiver Account", exact: true })
      .selectOption("account-other");
    await expect(page.getByTestId("native-pilot")).toHaveCount(0);
    await page.evaluate(() =>
      window.publishPilot({
        data: {
          ...window.pilotByKey[Object.keys(window.pilotByKey)[0]].data,
          accountId: "account-native",
        },
      }),
    );
    await expect(
      page.getByText(
        "Der Messnachweis gehört nicht mehr zur aktuellen Auswahl. Bitte aktualisieren.",
      ),
    ).toBeVisible();
    await page
      .getByRole("combobox", { name: "Aktiver Account", exact: true })
      .selectOption("account-native");
    await expect(page.getByTestId("native-pilot")).toHaveCount(0);
    for (const role of ["Editor", "Viewer", "Admin", "Owner"]) {
      await page.evaluate(
        (role) =>
          window.update({
            snapshot: {
              ...window.snapshot,
              workspaces: [{ ...window.snapshot.workspaces[0], role }],
            },
          }),
        role,
      );
      await page
        .getByRole("tab", { name: "Pilot-Auswertung", exact: true })
        .click();
      if (role === "Editor" || role === "Viewer") {
        await expect(
          page.getByText(
            "Diese Auswertung steht nur Ownern und Admins zur Verfügung.",
          ),
        ).toBeVisible();
        await expect(page.getByTestId("native-pilot")).toHaveCount(0);
      } else {
        await page
          .getByRole("combobox", { name: "Aktiver Account", exact: true })
          .selectOption("account-native");
        await expect(
          page.getByText("Messwerte werden geladen …", { exact: true }),
        ).toBeVisible();
        await expect(page.getByTestId("native-pilot")).toHaveCount(0);
        await page.evaluate(() => window.publishPilot());
        await expect(page.getByTestId("native-pilot")).toBeVisible();
      }
    }
    for (const id of ["session-other", "session-owner"]) {
      await page.evaluate(
        (id) =>
          window.update({ session: { ...window.session, session: { id } } }),
        id,
      );
      await page
        .getByRole("tab", { name: "Pilot-Auswertung", exact: true })
        .click();
      await page
        .getByRole("combobox", { name: "Aktiver Account", exact: true })
        .selectOption("account-native");
      await expect(page.getByTestId("native-pilot")).toHaveCount(0);
    }
    await page.evaluate(() => window.update({ pilotError: true }));
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "Messwerte konnten nicht geladen werden" }),
    ).toBeVisible();
    expect(await page.locator("main").innerText()).not.toContain(
      "PRIVATE_PROVIDER_ERROR",
    );
    await page.evaluate(() => window.update({ pilotError: false }));
    await page
      .getByRole("button", { name: "Messwerte aktualisieren", exact: true })
      .click();
    await page.evaluate(() => window.publishPilot());
    await expect(page.getByTestId("native-pilot")).toBeVisible();
    expect(
      await page.evaluate(() =>
        window.commands.filter((c) => c.name !== "users:bootstrap"),
      ),
    ).toEqual([]);
    expect(await page.evaluate(() => window.storageWrites)).toEqual([]);

    await page.goto("http://127.0.0.1:5189/operations?demo=1");
    await expect(page.getByText("Lokale Demo", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Demo-Wiederholung", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Demo-Wiederholung", exact: true })
      .click();
    await expect(
      page.getByText("Wiederholung läuft", { exact: true }).last(),
    ).toBeVisible();
    await page.clock.runFor(651);
    await expect(
      page.getByText(
        "Lokale Demo-Wiederholung abgeschlossen. Kein Remote-Ereignis oder Beitrag ausgeführt.",
      ),
    ).toBeVisible();
    expect(
      await page.evaluate(() =>
        window.queries.filter((q) => q.name === "operations/health:get"),
      ),
    ).toEqual([]);
    await page.goto("http://127.0.0.1:5189/settings/data?demo=1");
    await expect(
      page.getByRole("button", { name: "Export vorbereiten", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: "Eigenes Profil als JSON herunterladen",
        exact: true,
      }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "Export vorbereiten", exact: true })
      .click();
    await page.clock.runFor(501);
    const demoDownloadEvent = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "JSON herunterladen", exact: true })
      .click();
    const demoDownload = await demoDownloadEvent;
    expect(demoDownload.suggestedFilename()).toBe("dispatch-workspace.json");
    const demoData = JSON.parse(
      readFileSync(await demoDownload.path(), "utf8"),
    );
    expect(demoData).toHaveProperty("drafts");
    expect(demoData).toHaveProperty("settings");
    expect(await page.evaluate(() => window.exportRequests.length)).toBe(0);
    await page.goto("http://127.0.0.1:5189/settings/notifications?demo=1");
    for (const [name, checked] of [
      ["In-App-Zusammenfassungen", true],
      ["E-Mail-Zusammenfassungen", false],
      ["Wöchentlicher Überblick", true],
      ["Research-Zusammenfassungen", true],
      ["Ruhezeiten", true],
    ]) {
      await expect(
        page.getByRole("switch", { name, exact: true }),
      ).toHaveAttribute("aria-checked", String(checked));
      await expect(
        page.getByRole("switch", { name, exact: true }),
      ).toBeEnabled();
    }
    await page
      .getByRole("switch", { name: "E-Mail-Zusammenfassungen", exact: true })
      .click();
    await page.getByRole("switch", { name: "Ruhezeiten", exact: true }).click();
    const demoPrefs = await page.evaluate(() =>
      Object.keys(localStorage)
        .filter((k) => k.endsWith("-notifications"))
        .map((k) => JSON.parse(localStorage.getItem(k))),
    );
    expect(demoPrefs).toEqual([
      {
        inApp: true,
        email: true,
        summaries: true,
        research: true,
        quiet: false,
        start: "20:00",
        end: "08:00",
      },
    ]);
    await page.reload();
    await expect(
      page.getByRole("switch", {
        name: "E-Mail-Zusammenfassungen",
        exact: true,
      }),
    ).toHaveAttribute("aria-checked", "true");
    await expect(
      page.getByRole("switch", { name: "Ruhezeiten", exact: true }),
    ).toHaveAttribute("aria-checked", "false");
    await expect(page.getByLabel("Ab", { exact: true })).toHaveCount(0);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.screenshot({
      path: `${evidence}/notifications-demo-1280.png`,
      fullPage: false,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: `${evidence}/notifications-demo-390.png`,
      fullPage: false,
    });
    await page.evaluate(async () => {
      const { createSeed } = await import("/src/lib/model.ts");
      localStorage.setItem(
        "dispatch-demo-v1",
        JSON.stringify({ ...createSeed(), role: "Viewer" }),
      );
    });
    await page.reload();
    for (const name of options)
      await expect(
        page.getByRole("switch", { name, exact: true }),
      ).toBeDisabled();
    expect(await page.evaluate(() => window.commands)).toEqual([]);
    expect(provider).toEqual([]);
    expect(errors.filter((e) => !e.includes("PRIVATE_PROVIDER_ERROR"))).toEqual(
      [],
    );
    // TASK-32.4: the same mounted drawer, a separately bounded personal family.
    await page.goto("http://127.0.0.1:5189/overview");
    await page.setViewportSize({ width: 1280, height: 900 });
    await page
      .getByRole("button", { name: "Benachrichtigungen öffnen", exact: true })
      .click();
    const publishingInbox = page.getByTestId("publishing-inbox");
    await page.evaluate(() =>
      window.update({ publishingStatus: "LoadingFirstPage" }),
    );
    await expect(publishingInbox).toContainText(
      "Publishing-Hinweise werden geladen",
    );
    await page.evaluate(() =>
      window.update({
        publishingStatus: "CanLoadMore",
        publishingNotices: [
          {
            family: "publishing",
            id: "publishing-own",
            authId: "auth-owner",
            sessionId: "session-owner",
            workspaceId: "workspace-native",
            draftId: "draft-publishing",
            versionId: "version-publishing",
            accountId: "account-native",
            createdAt: Date.now(),
            sourceUntil: null,
            readAt: null,
            dismissedAt: null,
          },
        ],
      }),
    );
    await expect(publishingInbox).toContainText(
      "1 ungelesene Publishing-Hinweise in 1 geladenen Einträgen",
    );
    await expect(publishingInbox).toContainText("weitere Anzahl unbekannt");
    await expect(
      page.getByRole("button", {
        name: /^(Alle als gelesen markieren|Lokale Publishing-Ausgänge als gelesen markieren)$/,
      }),
    ).toHaveCount(0);
    await expect(publishingInbox.getByRole("link")).toHaveAttribute(
      "href",
      "/drafts/draft-publishing",
    );
    expect(await publishingInbox.innerText()).not.toMatch(
      /ungesendet|zugestellt|safe retry|PRIVATE/,
    );
    await publishingInbox
      .getByRole("button", { name: "Weitere Publishing-Seite laden" })
      .click();
    expect(await page.evaluate(() => window.publishingLoads)).toBe(1);
    await publishingInbox
      .getByRole("button", {
        name: "Publishing-Hinweis als gelesen markieren",
        exact: true,
      })
      .focus();
    await page.keyboard.press("Enter");
    await expect(
      publishingInbox.getByRole("button", {
        name: "Publishing-Hinweis als gelesen markieren",
        exact: true,
      }),
    ).toBeDisabled();
    await page.evaluate(() => {
      const r = window.publishingCommands.at(-1);
      r.resolve({
        authId: r.args.expectedAuthId,
        sessionId: r.sessionId,
        requestKey: r.args.requestKey,
      });
      window.update({
        publishingNotices: window.publishingNotices.map((n) => ({
          ...n,
          readAt: Date.now(),
        })),
      });
    });
    await expect(publishingInbox).toContainText(
      "0 ungelesene Publishing-Hinweise in 1 geladenen Einträgen",
    );
    await publishingInbox
      .getByRole("button", {
        name: "Publishing-Hinweis ausblenden",
        exact: true,
      })
      .click();
    await page.evaluate(() => {
      const r = window.publishingCommands.at(-1);
      r.resolve({
        authId: r.args.expectedAuthId,
        sessionId: r.sessionId,
        requestKey: r.args.requestKey,
      });
      window.update({ publishingNotices: [] });
    });
    await expect(publishingInbox).toContainText("Keine Publishing-Hinweise");
    await page.evaluate(() =>
      window.update({
        publishingStatus: "Exhausted",
        publishingNotices: [
          {
            family: "publishing",
            id: "publishing-own",
            authId: "auth-owner",
            sessionId: "session-owner",
            workspaceId: "workspace-native",
            draftId: "draft-publishing",
            versionId: "version-publishing",
            accountId: "account-native",
            createdAt: Date.now(),
            sourceUntil: null,
            readAt: null,
            dismissedAt: null,
          },
        ],
      }),
    );
    // Wrong correlation is an unconfirmed command, never a successful read claim.
    await publishingInbox
      .getByRole("button", {
        name: "Publishing-Hinweis als gelesen markieren",
        exact: true,
      })
      .click();
    await page.evaluate(() => {
      const r = window.publishingCommands.at(-1);
      r.resolve({
        authId: r.args.expectedAuthId,
        sessionId: r.sessionId,
        requestKey: "foreign-key",
      });
    });
    await expect(publishingInbox.getByRole("alert")).toBeVisible();
    expect(await publishingInbox.innerText()).not.toContain(
      "NOTICE_UNAVAILABLE",
    );
    await publishingInbox
      .getByRole("button", {
        name: "Denselben Auftrag wiederholen",
        exact: true,
      })
      .click();
    await page.evaluate(() => {
      const r = window.publishingCommands.at(-1);
      r.resolve({
        authId: r.args.expectedAuthId,
        sessionId: r.sessionId,
        requestKey: r.args.requestKey,
      });
    });
    await expect(publishingInbox.getByRole("alert")).toHaveCount(0);
    // Observed session and role ABA remount the family; old errors are discarded.
    for (const dimension of ["session", "role", "workspace", "account"]) {
      await publishingInbox
        .getByRole("button", {
          name: "Publishing-Hinweis als gelesen markieren",
          exact: true,
        })
        .click();
      const oldCommand = await page.evaluate(
        () => window.publishingCommands.length - 1,
      );
      if (dimension === "session") {
        await page.evaluate(() =>
          window.update({
            session: { ...window.session, session: { id: "session-other" } },
          }),
        );
        await expect(
          page.getByRole("heading", { name: "Dein Posteingang", exact: true }),
        ).toHaveCount(0);
        await page
          .getByRole("button", {
            name: "Benachrichtigungen öffnen",
            exact: true,
          })
          .click();
        await expect(publishingInbox.getByRole("link")).toHaveCount(0);
        await page.evaluate(() =>
          window.update({
            session: { ...window.session, session: { id: "session-owner" } },
          }),
        );
      } else if (dimension === "role") {
        await page.evaluate(() =>
          window.update({
            snapshot: {
              ...window.snapshot,
              workspaces: [{ ...window.snapshot.workspaces[0], role: "Admin" }],
            },
          }),
        );
        await expect(
          page.getByRole("heading", { name: "Dein Posteingang", exact: true }),
        ).toHaveCount(0);
        await page
          .getByRole("button", {
            name: "Benachrichtigungen öffnen",
            exact: true,
          })
          .click();
        await expect(
          publishingInbox.getByRole("button", {
            name: "Publishing-Hinweis als gelesen markieren",
            exact: true,
          }),
        ).toBeEnabled();
        await page.evaluate(() =>
          window.update({
            snapshot: {
              ...window.snapshot,
              workspaces: [{ ...window.snapshot.workspaces[0], role: "Owner" }],
            },
          }),
        );
      } else if (dimension === "workspace") {
        await page.evaluate(() =>
          window.update({
            snapshot: {
              ...window.snapshot,
              activeWorkspaceId: "workspace-other",
              workspaces: [
                { ...window.snapshot.workspaces[0], id: "workspace-other" },
              ],
            },
            roster: { ...window.roster, workspaceId: "workspace-other" },
          }),
        );
        await expect(
          page.getByRole("heading", { name: "Dein Posteingang", exact: true }),
        ).toHaveCount(0);
        await page
          .getByRole("button", {
            name: "Benachrichtigungen öffnen",
            exact: true,
          })
          .click();
        await expect(publishingInbox.getByRole("link")).toHaveCount(0);
        await page.evaluate(() =>
          window.update({
            snapshot: {
              ...window.snapshot,
              activeWorkspaceId: "workspace-native",
              workspaces: [
                { ...window.snapshot.workspaces[0], id: "workspace-native" },
              ],
            },
            roster: { ...window.roster, workspaceId: "workspace-native" },
          }),
        );
      } else {
        await page.evaluate(() =>
          window.update({
            resources: {
              ...window.resources,
              accounts: [
                window.resources.accounts[0],
                {
                  ...window.resources.accounts[0],
                  _id: "account-other",
                  name: "Other X",
                  handle: "@other",
                },
              ],
            },
          }),
        );
        await page
          .locator('select[aria-label="Aktiver Account"]')
          .selectOption("account-other", { force: true });
        await expect(
          publishingInbox.getByRole("button", {
            name: "Publishing-Hinweis als gelesen markieren",
            exact: true,
          }),
        ).toBeEnabled();
        await page
          .locator('select[aria-label="Aktiver Account"]')
          .selectOption("account-native", { force: true });
      }
      if (dimension !== "account") {
        await expect(
          page.getByRole("heading", { name: "Dein Posteingang", exact: true }),
        ).toHaveCount(0);
        await page
          .getByRole("button", {
            name: "Benachrichtigungen öffnen",
            exact: true,
          })
          .click();
      }
      await expect(
        publishingInbox.getByRole("button", {
          name: "Publishing-Hinweis als gelesen markieren",
          exact: true,
        }),
      ).toBeEnabled();
      await page.evaluate(
        (index) =>
          window.publishingCommands[index].reject(
            Error("PRIVATE_PUBLISHING_LATE_ERROR"),
          ),
        oldCommand,
      );
      await expect(publishingInbox.getByRole("alert")).toHaveCount(0);
    }
    await page.evaluate(() =>
      window.update({
        publishingNotices: window.publishingNotices.map((n) => ({
          ...n,
          sourceUntil: Date.now() + 500,
        })),
      }),
    );
    await expect(publishingInbox.getByRole("link")).toHaveCount(1);
    await publishingInbox
      .getByRole("button", {
        name: "Publishing-Hinweis als gelesen markieren",
        exact: true,
      })
      .click();
    const expiredPendingCommand = await page.evaluate(
      () => window.publishingCommands.length - 1,
    );
    await page.clock.runFor(501);
    await expect(publishingInbox.getByRole("link")).toHaveCount(0);
    await page.evaluate(() =>
      window.update({
        publishingNotices: window.publishingNotices.map((n) => ({
          ...n,
          id: "publishing-next-episode",
          versionId: "version-next-episode",
          sourceUntil: Date.now() + 60000,
        })),
      }),
    );
    await expect(
      publishingInbox.getByRole("button", {
        name: "Publishing-Hinweis als gelesen markieren",
        exact: true,
      }),
    ).toBeEnabled();
    await publishingInbox
      .getByRole("button", {
        name: "Publishing-Hinweis als gelesen markieren",
        exact: true,
      })
      .click();
    const replacementCommand = await page.evaluate(
      () => window.publishingCommands.length - 1,
    );
    await page.evaluate((index) => {
      const command = window.publishingCommands[index];
      command.resolve({
        authId: command.args.expectedAuthId,
        sessionId: command.sessionId,
        requestKey: command.args.requestKey,
      });
    }, expiredPendingCommand);
    await expect(
      publishingInbox.getByRole("button", {
        name: "Publishing-Hinweis als gelesen markieren",
        exact: true,
      }),
    ).toBeDisabled();
    await page.evaluate((index) => {
      const command = window.publishingCommands[index];
      command.resolve({
        authId: command.args.expectedAuthId,
        sessionId: command.sessionId,
        requestKey: command.args.requestKey,
      });
    }, replacementCommand);
    await expect(
      publishingInbox.getByRole("button", {
        name: "Publishing-Hinweis als gelesen markieren",
        exact: true,
      }),
    ).toBeEnabled();
    await expect(publishingInbox.getByRole("alert")).toHaveCount(0);
    const entropyBeforePublishing = await page.evaluate(
      () => window.publishingCommands.length,
    );
    await page.evaluate(() => {
      window.realPublishingUUID = crypto.randomUUID.bind(crypto);
      crypto.randomUUID = () => {
        throw Error("PRIVATE_ENTROPY");
      };
    });
    await publishingInbox
      .getByRole("button", {
        name: "Publishing-Hinweis als gelesen markieren",
        exact: true,
      })
      .click();
    await expect(publishingInbox.getByRole("alert")).toBeVisible();
    expect(await page.evaluate(() => window.publishingCommands.length)).toBe(
      entropyBeforePublishing,
    );
    await page.evaluate(() => {
      crypto.randomUUID = window.realPublishingUUID;
    });
    await publishingInbox
      .getByRole("button", {
        name: "Denselben Auftrag wiederholen",
        exact: true,
      })
      .click();
    await page.evaluate(() => {
      const r = window.publishingCommands.at(-1);
      r.resolve({
        authId: r.args.expectedAuthId,
        sessionId: r.sessionId,
        requestKey: r.args.requestKey,
      });
    });
    await expect(publishingInbox.getByRole("alert")).toHaveCount(0);
    await page.evaluate(() => window.update({ publishingError: true }));
    await expect(
      page.getByRole("alert").filter({
        hasText: "Publishing-Hinweise sind derzeit nicht verfügbar",
      }),
    ).toBeVisible();
    expect(await page.locator("main").innerText()).not.toContain(
      "PRIVATE_PROVIDER_ERROR",
    );
    await page.evaluate(() => window.update({ publishingError: false }));
    await page
      .getByRole("button", {
        name: "Publishing-Hinweise erneut laden",
        exact: true,
      })
      .click();
    await expect(publishingInbox.getByRole("link")).toHaveCount(1);
    await page.screenshot({
      path: `${evidence}/publishing-inbox-1280.png`,
      fullPage: false,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await publishingInbox.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        return [...element.querySelectorAll("button")].every((button) => {
          const rect = button.getBoundingClientRect();
          return (
            rect.left >= bounds.left - 1 &&
            rect.right <= bounds.right + 1 &&
            button.scrollWidth <= button.clientWidth + 1
          );
        });
      }),
    ).toBe(true);
    await page.screenshot({
      path: `${evidence}/publishing-inbox-390.png`,
      fullPage: false,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    expect(await page.evaluate(() => window.storageWrites)).toEqual([]);
    expect(provider).toEqual([]);
    expect(errors.filter((e) => !e.includes("PRIVATE_PROVIDER_ERROR"))).toEqual(
      [],
    );
    // TASK-31.3: independent attention projection in the existing styled Bell/Drawer.
    await page.evaluate(() =>
      window.update({ publishingNotices: [], notices: [] }),
    );
    await page.evaluate(() => window.publishGithub());
    const githubInbox = page.getByTestId("github-attention");
    await expect(githubInbox).toContainText(
      "1 geladene GitHub-Hinweise; weitere Anzahl unbekannt",
    );
    await expect(publishingInbox).toContainText(
      "0 ungelesene Publishing-Hinweise",
    );
    await expect(
      page.getByLabel("GitHub benötigt Aufmerksamkeit in geladenen Einträgen", {
        exact: true,
      }),
    ).toHaveCount(1);
    await expect(
      page.getByLabel("Ungelesene Hinweise in geladenen Einträgen", {
        exact: true,
      }),
    ).toHaveCount(0);
    expect(await githubInbox.innerText()).not.toMatch(
      /private-recovery-id|PRIVATE_PROVIDER_ERROR|gelesen|Ausblenden/,
    );
    await expect(githubInbox.getByRole("link")).toHaveAttribute(
      "href",
      "/signals",
    );
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await page.screenshot({
        path: `${evidence}/github-attention-${width}.png`,
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
    }
    await page.evaluate(() =>
      window.publishGithub({ sessionId: "old-session" }),
    );
    await expect(githubInbox.getByRole("link")).toHaveCount(0);
    await page.evaluate(() => window.publishGithub({ authId: "old-auth" }));
    await expect(githubInbox.getByRole("link")).toHaveCount(0);
    await page.evaluate(() =>
      window.publishGithub({ workspaceId: "old-workspace" }),
    );
    await expect(githubInbox.getByRole("link")).toHaveCount(0);
    await page.evaluate(() =>
      window.publishGithub({ refreshKey: "old-nonce" }),
    );
    await expect(githubInbox.getByRole("link")).toHaveCount(0);
    await page.evaluate(() =>
      window.publishGithub({
        data: {
          observedAt: Date.now(),
          validUntil: Date.now() + 500,
          coverage: { partial: true, parentLimit: 6, remainder: "unknown" },
          rows: [{ id: "expired" }],
        },
      }),
    );
    await expect(githubInbox.getByRole("link")).toHaveCount(1);
    await page.clock.runFor(500);
    await expect(githubInbox.getByRole("link")).toHaveCount(0);
    const githubKey = await page.evaluate(
      () =>
        window.queries
          .filter((q) => q.name === "operations/githubAlerts:get")
          .at(-1).args.refreshKey,
    );
    await page.clock.runFor(30000);
    expect(
      await page.evaluate(
        (key) =>
          window.queries
            .filter((q) => q.name === "operations/githubAlerts:get")
            .at(-1).args.refreshKey !== key,
        githubKey,
      ),
    ).toBe(true);
    await page.evaluate(() => window.publishGithub());
    await expect(githubInbox.getByRole("link")).toHaveCount(1);
    await page.evaluate(() => window.update({ githubError: true }));
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "GitHub-Hinweise sind derzeit nicht verfügbar" }),
    ).toBeVisible();
    await expect(publishingInbox).toContainText(
      "0 ungelesene Publishing-Hinweise",
    );
    await page.evaluate(() => window.update({ githubError: false }));
    await page
      .getByRole("button", {
        name: "GitHub-Hinweise erneut laden",
        exact: true,
      })
      .click();
    await page.evaluate(() => window.publishGithub());
    await expect(githubInbox.getByRole("link")).toHaveCount(1);
    await githubInbox.getByRole("link").click();
    await expect(
      page.getByRole("heading", { name: "Dein Posteingang", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", {
        name: "Benachrichtigungen schließen",
        exact: true,
      }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "Benachrichtigungen öffnen", exact: true })
      .click();
    await page.evaluate(() => window.publishGithub());
    await expect(githubInbox.getByRole("link")).toHaveCount(1);
    for (const role of ["Editor", "Viewer", "Admin", "Owner"]) {
      const before = await page.evaluate(
        () =>
          window.queries.filter((q) => q.name === "operations/githubAlerts:get")
            .length,
      );
      await page.evaluate(
        (role) =>
          window.update({
            snapshot: {
              ...window.snapshot,
              workspaces: [{ ...window.snapshot.workspaces[0], role }],
            },
          }),
        role,
      );
      await page
        .getByRole("button", { name: "Benachrichtigungen öffnen", exact: true })
        .click();
      if (["Editor", "Viewer"].includes(role)) {
        await expect(githubInbox).toHaveCount(0);
        expect(
          await page.evaluate(
            () =>
              window.queries.filter(
                (q) => q.name === "operations/githubAlerts:get",
              ).length,
          ),
        ).toBe(before);
        await expect(publishingInbox).toBeVisible();
      } else {
        await page.evaluate(() => window.publishGithub());
        await expect(githubInbox.getByRole("link")).toHaveCount(1);
      }
    }
    for (const dimension of ["session", "workspace", "account"]) {
      const old = await page.evaluate(() => {
        window.githubOldSnapshot = structuredClone(window.snapshot);
        window.githubOldSession = structuredClone(window.session);
        window.githubOldResources = structuredClone(window.resources);
        const q = window.queries
          .filter((q) => q.name === "operations/githubAlerts:get")
          .at(-1);
        return {
          key: q.args.refreshKey,
          value: window.githubByKey[q.args.refreshKey],
        };
      });
      await page.evaluate((dimension) => {
        if (dimension === "session")
          window.update({
            session: {
              ...window.session,
              session: { id: "github-session-other" },
            },
          });
        else if (dimension === "workspace")
          window.update({
            snapshot: {
              ...window.snapshot,
              activeWorkspaceId: "workspace-other",
              workspaces: [
                { ...window.snapshot.workspaces[0], id: "workspace-other" },
              ],
            },
            roster: { ...window.roster, workspaceId: "workspace-other" },
          });
        else
          window.update({
            resources: {
              ...window.resources,
              accounts: [
                window.resources.accounts[0],
                {
                  ...window.resources.accounts[0],
                  _id: "account-other",
                  name: "Other X",
                  handle: "@other",
                },
              ],
            },
          });
      }, dimension);
      if (dimension === "account")
        await page
          .locator('select[aria-label="Aktiver Account"]')
          .selectOption("account-other", { force: true });
      else
        await page
          .getByRole("button", {
            name: "Benachrichtigungen öffnen",
            exact: true,
          })
          .click();
      await expect(githubInbox.getByRole("link")).toHaveCount(0);
      await page.evaluate(() =>
        window.update({
          snapshot: window.githubOldSnapshot,
          session: window.githubOldSession,
          resources: window.githubOldResources,
          roster: { ...window.roster, workspaceId: "workspace-native" },
        }),
      );
      if (dimension === "account")
        await page
          .locator('select[aria-label="Aktiver Account"]')
          .selectOption("account-native", { force: true });
      else
        await page
          .getByRole("button", {
            name: "Benachrichtigungen öffnen",
            exact: true,
          })
          .click();
      await page.evaluate((old) => {
        window.githubByKey[old.key] = old.value;
        window.update({});
      }, old);
      await expect(githubInbox.getByRole("link")).toHaveCount(0);
      await page.evaluate(() => window.publishGithub());
      await expect(githubInbox.getByRole("link")).toHaveCount(1);
    }
    await page.evaluate(() => {
      window.githubUUID = crypto.randomUUID;
      crypto.randomUUID = () => {
        throw Error("ENTROPY_PRIVATE");
      };
    });
    await page.clock.runFor(30001);
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "GitHub-Hinweise sind derzeit nicht verfügbar" }),
    ).toBeVisible();
    await page.evaluate(() => {
      crypto.randomUUID = window.githubUUID;
    });
    await page
      .getByRole("button", {
        name: "GitHub-Hinweise erneut laden",
        exact: true,
      })
      .click();
    await page.evaluate(() => window.publishGithub());
    await expect(githubInbox.getByRole("link")).toHaveCount(1);
    expect(
      await page.evaluate(() =>
        window.commands
          .filter((c) => c.args.noticeIds)
          .every((c) => !c.args.noticeIds.includes("private-recovery-id")),
      ),
    ).toBe(true);
    // TASK-32.5: real styled Drawer family, exact correlation, finite clocks, observed dismissal.
    const summaryInbox = page.getByRole("region", {
      name: "Eigene Research-Abschlüsse",
      exact: true,
    });
    await page.evaluate(() => {
      const q = window.queries
        .filter((q) => q.name === "preferences:researchSummaries")
        .at(-1);
      if (!q) throw Error("Missing own summary query");
      window.summaryArgs = q.args;
      const result = {
        authId: q.args.expectedAuthId,
        sessionId: q.args.expectedSessionId,
        workspaceId: q.args.workspaceId,
        requestKey: q.args.requestKey,
        coverage: "bounded_unknown",
        rows: [
          {
            orderId: "own-completed",
            generation: 1,
            finishedAt: Date.now() - 1000,
            accountId: "account-native",
            outcome: "empty",
            proofUntil: Date.now() + 10000,
          },
        ],
      };
      window.summaryResult = result;
      window.update({ summaryByKey: { [q.args.requestKey]: result } });
    });
    await expect(summaryInbox).toContainText("Research ohne Material");
    await expect(summaryInbox).toContainText("Weitere Abdeckung unbekannt");
    await page.evaluate(() => {
      window.summaryResult = {
        ...window.summaryResult,
        rows: window.summaryResult.rows.map((r) => ({
          ...r,
          outcome: "partial",
        })),
      };
      window.update({
        summaryByKey: { [window.summaryArgs.requestKey]: window.summaryResult },
      });
    });
    await expect(summaryInbox).toContainText(
      "Research teilweise abgeschlossen",
    );
    await page.evaluate(() => {
      window.summaryResult = {
        ...window.summaryResult,
        rows: window.summaryResult.rows.map((r) => ({
          ...r,
          outcome: "completed",
        })),
      };
      window.update({
        summaryByKey: { [window.summaryArgs.requestKey]: window.summaryResult },
      });
    });
    await expect(summaryInbox).toContainText("Research abgeschlossen");
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.evaluate(async () => {
      await document.fonts.ready;
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      );
    });
    await expect(summaryInbox).toBeVisible();
    await page.screenshot({
      path: `${evidence}/research-summary-success-1280.png`,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(async () => {
      await document.fonts.ready;
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      );
    });
    await expect(
      summaryInbox.getByRole("button", {
        name: "Abschluss ausblenden",
        exact: true,
      }),
    ).toBeVisible();
    const summaryBounds = await summaryInbox.boundingBox();
    expect(summaryBounds.x + summaryBounds.width).toBeLessThanOrEqual(391);
    await page.screenshot({
      path: `${evidence}/research-summary-success-390.png`,
    });
    await page.evaluate(() => {
      window.summaryResult = {
        ...window.summaryResult,
        rows: window.summaryResult.rows.map((r) => ({
          ...r,
          outcome: "empty",
        })),
      };
      window.update({
        summaryByKey: { [window.summaryArgs.requestKey]: window.summaryResult },
      });
    });
    await expect(summaryInbox).toContainText("Research ohne Material");

    await summaryInbox
      .getByRole("button", { name: "Abschluss ausblenden", exact: true })
      .focus();
    await page.keyboard.press("Enter");
    await expect(
      summaryInbox.getByRole("button", {
        name: "Abschluss ausblenden",
        exact: true,
      }),
    ).toBeDisabled();
    expect(
      await page.evaluate(() => window.summaryCommands.at(-1).args.observed),
    ).toEqual([
      {
        orderId: "own-completed",
        generation: 1,
        finishedAt: await page.evaluate(
          () => window.summaryResult.rows[0].finishedAt,
        ),
      },
    ]);
    await page.evaluate(() => window.summaryCommands.at(-1).resolve(null));
    await expect(
      summaryInbox.getByRole("button", {
        name: "Abschluss ausblenden",
        exact: true,
      }),
    ).toBeEnabled();
    for (const field of ["authId", "sessionId", "workspaceId", "requestKey"]) {
      await page.evaluate(
        (field) =>
          window.update({
            summaryByKey: {
              [window.summaryArgs.requestKey]: {
                ...window.summaryResult,
                [field]: "wrong",
              },
            },
          }),
        field,
      );
      await expect(summaryInbox).not.toContainText("Research ohne Material");
    }
    await page.evaluate(() =>
      window.update({
        summaryByKey: { [window.summaryArgs.requestKey]: window.summaryResult },
      }),
    );
    // The native quiet-start mutation invalidates the projection; the quiet-end mutation
    // supplies fresh server proof for the same original, without browser renewal.
    await summaryInbox
      .getByRole("button", { name: "Abschluss ausblenden", exact: true })
      .click();
    const preQuietCommand = await page.evaluate(
      () => window.summaryCommands.length - 1,
    );
    await page.clock.runFor(10001);
    await expect(summaryInbox).not.toContainText("Research ohne Material");
    await page.evaluate(() =>
      window.update({
        summaryByKey: {
          [window.summaryArgs.requestKey]: {
            ...window.summaryResult,
            rows: [],
          },
        },
      }),
    );
    await expect(
      summaryInbox.getByRole("button", {
        name: "Abschluss ausblenden",
        exact: true,
      }),
    ).toHaveCount(0);
    await page.clock.runFor(1001);
    await page.evaluate(() => {
      window.summaryResult = {
        ...window.summaryResult,
        rows: window.summaryResult.rows.map((r) => ({
          ...r,
          proofUntil: Date.now() + 10000,
        })),
      };
      window.update({
        summaryByKey: { [window.summaryArgs.requestKey]: window.summaryResult },
      });
    });
    await expect(summaryInbox).toContainText("Research ohne Material");
    await expect(
      summaryInbox.getByRole("button", {
        name: "Abschluss ausblenden",
        exact: true,
      }),
    ).toBeEnabled();
    await summaryInbox
      .getByRole("button", { name: "Abschluss ausblenden", exact: true })
      .click();
    const afterQuietCommand = await page.evaluate(
      () => window.summaryCommands.length - 1,
    );
    expect(
      await page.evaluate(
        ([oldIndex, newIndex]) =>
          JSON.stringify(window.summaryCommands[oldIndex].args.observed) ===
          JSON.stringify(window.summaryCommands[newIndex].args.observed),
        [preQuietCommand, afterQuietCommand],
      ),
    ).toBe(true);
    await page.evaluate(
      (index) =>
        window.summaryCommands[index].reject(
          Error("PRIVATE_LATE_QUIET_COMMAND"),
        ),
      preQuietCommand,
    );
    await expect(
      summaryInbox.getByRole("button", {
        name: "Abschluss ausblenden",
        exact: true,
      }),
    ).toBeDisabled();
    await expect(summaryInbox.getByRole("alert")).toHaveCount(0);
    await page.evaluate(
      (index) => window.summaryCommands[index].resolve(null),
      afterQuietCommand,
    );
    await expect(
      summaryInbox.getByRole("button", {
        name: "Abschluss ausblenden",
        exact: true,
      }),
    ).toBeEnabled();
    await page.evaluate(() => window.update({ summaryError: true }));
    await expect(
      page.getByRole("alert").filter({
        hasText: "Research-Abschlüsse sind derzeit nicht verfügbar",
      }),
    ).toBeVisible();
    await expect(githubInbox).toBeVisible();
    expect(await page.locator("main").innerText()).not.toContain(
      "PRIVATE_PROVIDER_ERROR",
    );
    await page.screenshot({
      path: `${evidence}/research-summary-error.png`,
    });
    expect(provider).toEqual([]);
    expect(
      errors.filter((error) => !error.includes("PRIVATE_PROVIDER_ERROR")),
    ).toEqual([]);
    expect(await page.evaluate(() => window.storageWrites)).toEqual([]);
    writeFileSync(
      `${evidence}/receipt.json`,
      JSON.stringify(
        {
          researchCompletionSummary: {
            styledDrawer: true,
            successViewports: [1280, 390],
            successImages: [
              "research-summary-success-1280.png",
              "research-summary-success-390.png",
            ],
            errorImage: "research-summary-error.png",
            observedOnlyDismiss: true,
            exactScope: true,
            clockExpiry: true,
            nativeQuietTransitionRecovery: true,
            quietLateCommandTicketFence: true,
            privateIndependentError: true,
          },
          githubAttention: {
            sameDrawer: true,
            attentionOnly: true,
            personalUnreadUnchanged: true,
            exactExpiry: true,
            renewal: true,
            correlation: true,
            independentErrorRetry: true,
            safeLink: true,
            roles: ["Owner", "Admin", "Editor", "Viewer"],
            subscriptionSkip: true,
            nativeScopeSessionWorkspaceAccountABA: true,
            entropyFailureExplicitRetry: true,
            personalActionsExcludeRecoveryIds: true,
          },
          publishingInbox: {
            sameDrawer: true,
            ownCommands: true,
            loadedOnly: true,
            nativeExpiry: true,
            sessionRoleWorkspaceAccountABA: true,
            lateErrorsDiscarded: true,
            entropyAndRetry: true,
            safeError: true,
          },
          actualApp: true,
          actualStore: true,
          productionCss: true,
          viewports: [1280, 390],
          scopeSessionABA: true,
          accountFence: true,
          clockExpiry: true,
          explicitRefresh: true,
          errorPrivacy: true,
          partialCoverage: true,
          existingTabs: true,
          isolatedDemoTimer: true,
          cloudNotificationDefaultOff: true,
          cloudNativePreferencesPersisted: true,
          cloudNotificationDirtyCASCorrelationABA: true,
          cloudWeeklyEmailUnavailable: true,
          cloudNotificationRoles: ["Owner", "Admin", "Editor", "Viewer"],
          cloudNoAppLocalPreferenceStorage: true,
          cloudOnlyOwnPreferenceSetter: true,
          existingRecipientInbox: true,
          unresolvedTransportCopy: true,
          demoPreferencePersistenceAndViewer: true,
          nativePreferencesDownload: {
            mockedTransport: true,
            actualAppStoreCss: true,
            allFourRoles: true,
            nullableStoredNotifications: true,
            exactCorrelation: true,
            sessionWorkspaceABA: true,
            sourceHandoffExpiry: true,
            oversizedWire: true,
            failedHandoffRevokesURL: true,
            noPrivateDownloadFields: true,
            fileCount: preferencesExportFiles.length,
          },
          nativeSelfProfileDownload: true,
          privateArchive: {
            transport: "mocked; native authority tested separately",
            actualMessageAndWorkflowDownloads: true,
            parentABA: true,
            accountAndParentCorrelation: true,
            expiryAndUnmount: true,
            ownEditorAndViewerDownloads: true,
          },
          sharedArchive: {
            families: 19,
            actualDownloadedJSON: true,
            nextPage: true,
            sessionRoleAccountFamilyABA: true,
            workspaceABA: true,
            unmount: true,
            finiteHandoff: true,
            failureCleanup: true,
          },
          exportRoles: ["Owner", "Admin", "Editor", "Viewer"],
          exportFreshKeys: true,
          exportNativeCorrelationExcludedFromFiles: true,
          exportSessionWorkspaceABAAndLateUnmount: true,
          exportNoAppPersistence: true,
          exportEntropyFailureAndRetry: true,
          exportLocalHandoffFailureRevokesUrl: true,
          exportRoleLateResultRejected: true,
          exportFileCount: exportedFiles.length,
          nativePilot: {
            selectedAccountOnly: true,
            roles: ["Owner", "Admin"],
            zeroUnknown: true,
            refreshAndCorrelation: true,
            expiryWithoutNewKey: true,
            entropyFailureRetry: true,
            accountRoleSessionABA: true,
            safeError: true,
          },
          provider,
          errors,
          manualAccessibility: false,
        },
        null,
        2,
      ),
    );
  }
} finally {
  await browser?.close();
  await server.close();
}
