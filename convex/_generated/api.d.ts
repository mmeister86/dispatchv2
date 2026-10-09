/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ai_accounting from "../ai/accounting.js";
import type * as ai_contentCopies from "../ai/contentCopies.js";
import type * as ai_conversationAccess from "../ai/conversationAccess.js";
import type * as ai_conversations from "../ai/conversations.js";
import type * as ai_embeddings from "../ai/embeddings.js";
import type * as ai_fields from "../ai/fields.js";
import type * as ai_jev_access from "../ai/jev/access.js";
import type * as ai_jev_analyzePost from "../ai/jev/analyzePost.js";
import type * as ai_jev_client from "../ai/jev/client.js";
import type * as ai_jev_composite from "../ai/jev/composite.js";
import type * as ai_jev_normalize from "../ai/jev/normalize.js";
import type * as ai_jev_questions from "../ai/jev/questions.js";
import type * as ai_jev_questions_intentRouting from "../ai/jev/questions/intentRouting.js";
import type * as ai_jev_questions_outputVerification from "../ai/jev/questions/outputVerification.js";
import type * as ai_jev_questions_postAnalysis from "../ai/jev/questions/postAnalysis.js";
import type * as ai_jev_resultFields from "../ai/jev/resultFields.js";
import type * as ai_jev_routing from "../ai/jev/routing.js";
import type * as ai_jev_thresholds from "../ai/jev/thresholds.js";
import type * as ai_jev_types from "../ai/jev/types.js";
import type * as ai_jev_verify from "../ai/jev/verify.js";
import type * as ai_provider from "../ai/provider.js";
import type * as ai_researchAgent from "../ai/researchAgent.js";
import type * as ai_researchTools from "../ai/researchTools.js";
import type * as ai_runs from "../ai/runs.js";
import type * as ai_scoring_dispatchScore from "../ai/scoring/dispatchScore.js";
import type * as ai_sourceAccess from "../ai/sourceAccess.js";
import type * as ai_styleFields from "../ai/styleFields.js";
import type * as ai_styleProfiles from "../ai/styleProfiles.js";
import type * as auth from "../auth.js";
import type * as content_feedback from "../content/feedback.js";
import type * as content_feedbackFields from "../content/feedbackFields.js";
import type * as content_ideaFields from "../content/ideaFields.js";
import type * as content_ideas from "../content/ideas.js";
import type * as content_performance from "../content/performance.js";
import type * as content_performanceFields from "../content/performanceFields.js";
import type * as content_signals from "../content/signals.js";
import type * as content_similarity from "../content/similarity.js";
import type * as content_similarityFields from "../content/similarityFields.js";
import type * as crons from "../crons.js";
import type * as editorial from "../editorial.js";
import type * as editorial_notices from "../editorial/notices.js";
import type * as editorial_reviewFields from "../editorial/reviewFields.js";
import type * as editorial_reviews from "../editorial/reviews.js";
import type * as http from "../http.js";
import type * as integrations_github_app from "../integrations/github/app.js";
import type * as integrations_github_barriers from "../integrations/github/barriers.js";
import type * as integrations_github_context from "../integrations/github/context.js";
import type * as integrations_github_contextAccess from "../integrations/github/contextAccess.js";
import type * as integrations_github_contextFields from "../integrations/github/contextFields.js";
import type * as integrations_github_contextRead from "../integrations/github/contextRead.js";
import type * as integrations_github_deliveries from "../integrations/github/deliveries.js";
import type * as integrations_github_fields from "../integrations/github/fields.js";
import type * as integrations_github_recovery from "../integrations/github/recovery.js";
import type * as integrations_github_recoveryState from "../integrations/github/recoveryState.js";
import type * as integrations_github_repositories from "../integrations/github/repositories.js";
import type * as integrations_github_signalFields from "../integrations/github/signalFields.js";
import type * as integrations_github_webhook from "../integrations/github/webhook.js";
import type * as integrations_x_client from "../integrations/x/client.js";
import type * as integrations_x_fields from "../integrations/x/fields.js";
import type * as integrations_x_oauth from "../integrations/x/oauth.js";
import type * as integrations_x_publish from "../integrations/x/publish.js";
import type * as integrations_x_research from "../integrations/x/research.js";
import type * as intelligence_algorithmProfiles from "../intelligence/algorithmProfiles.js";
import type * as intelligence_assessmentFields from "../intelligence/assessmentFields.js";
import type * as intelligence_assessments from "../intelligence/assessments.js";
import type * as intelligence_audienceProfiles from "../intelligence/audienceProfiles.js";
import type * as intelligence_profileUpdates from "../intelligence/profileUpdates.js";
import type * as intelligence_profiles from "../intelligence/profiles.js";
import type * as intelligence_recommendationEdits from "../intelligence/recommendationEdits.js";
import type * as intelligence_recommendations from "../intelligence/recommendations.js";
import type * as intelligence_sharedFields from "../intelligence/sharedFields.js";
import type * as lib_authorization from "../lib/authorization.js";
import type * as lib_crypto from "../lib/crypto.js";
import type * as lib_editorialFields from "../lib/editorialFields.js";
import type * as lib_sourceProof from "../lib/sourceProof.js";
import type * as media_assets from "../media/assets.js";
import type * as media_binding from "../media/binding.js";
import type * as media_cleanup from "../media/cleanup.js";
import type * as media_cleanupR2 from "../media/cleanupR2.js";
import type * as media_limits from "../media/limits.js";
import type * as media_r2 from "../media/r2.js";
import type * as media_uploads from "../media/uploads.js";
import type * as media_validation from "../media/validation.js";
import type * as operations_export from "../operations/export.js";
import type * as operations_exportShared from "../operations/exportShared.js";
import type * as operations_githubAlerts from "../operations/githubAlerts.js";
import type * as operations_health from "../operations/health.js";
import type * as operations_pilot from "../operations/pilot.js";
import type * as performance_backfill from "../performance/backfill.js";
import type * as performance_baselines from "../performance/baselines.js";
import type * as performance_calibration from "../performance/calibration.js";
import type * as performance_calibrationFields from "../performance/calibrationFields.js";
import type * as performance_capabilities from "../performance/capabilities.js";
import type * as performance_collect from "../performance/collect.js";
import type * as performance_experimentFields from "../performance/experimentFields.js";
import type * as performance_experiments from "../performance/experiments.js";
import type * as performance_fields from "../performance/fields.js";
import type * as performance_history from "../performance/history.js";
import type * as performance_historyFields from "../performance/historyFields.js";
import type * as performance_historyNormalize from "../performance/historyNormalize.js";
import type * as performance_knowledge from "../performance/knowledge.js";
import type * as performance_metricDefinitions from "../performance/metricDefinitions.js";
import type * as performance_modelFields from "../performance/modelFields.js";
import type * as performance_models from "../performance/models.js";
import type * as performance_normalize from "../performance/normalize.js";
import type * as performance_snapshots from "../performance/snapshots.js";
import type * as planning_accept from "../planning/accept.js";
import type * as planning_fields from "../planning/fields.js";
import type * as planning_plans from "../planning/plans.js";
import type * as planning_recurring from "../planning/recurring.js";
import type * as planning_strategy from "../planning/strategy.js";
import type * as planning_strategyFields from "../planning/strategyFields.js";
import type * as preferences from "../preferences.js";
import type * as publishing from "../publishing.js";
import type * as publishing_attempts from "../publishing/attempts.js";
import type * as publishing_media from "../publishing/media.js";
import type * as publishing_mediaFields from "../publishing/mediaFields.js";
import type * as publishing_notices from "../publishing/notices.js";
import type * as publishing_postFields from "../publishing/postFields.js";
import type * as publishing_reconcile from "../publishing/reconcile.js";
import type * as publishing_workflows from "../publishing/workflows.js";
import type * as research_access from "../research/access.js";
import type * as research_cache from "../research/cache.js";
import type * as research_clusters from "../research/clusters.js";
import type * as research_contentCleanup from "../research/contentCleanup.js";
import type * as research_contentFields from "../research/contentFields.js";
import type * as research_contentProof from "../research/contentProof.js";
import type * as research_evaluate from "../research/evaluate.js";
import type * as research_evidence from "../research/evidence.js";
import type * as research_evidenceFields from "../research/evidenceFields.js";
import type * as research_execute from "../research/execute.js";
import type * as research_fields from "../research/fields.js";
import type * as research_handoff from "../research/handoff.js";
import type * as research_native from "../research/native.js";
import type * as research_pipeline from "../research/pipeline.js";
import type * as research_pipelineAccess from "../research/pipelineAccess.js";
import type * as research_pipelineFields from "../research/pipelineFields.js";
import type * as research_profiles from "../research/profiles.js";
import type * as research_providerAccess from "../research/providerAccess.js";
import type * as research_providerFields from "../research/providerFields.js";
import type * as research_runs from "../research/runs.js";
import type * as research_schedules from "../research/schedules.js";
import type * as research_time from "../research/time.js";
import type * as research_transport from "../research/transport.js";
import type * as research_webSearch from "../research/webSearch.js";
import type * as team from "../team.js";
import type * as teamFields from "../teamFields.js";
import type * as users from "../users.js";
import type * as workspaces from "../workspaces.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "ai/accounting": typeof ai_accounting;
  "ai/contentCopies": typeof ai_contentCopies;
  "ai/conversationAccess": typeof ai_conversationAccess;
  "ai/conversations": typeof ai_conversations;
  "ai/embeddings": typeof ai_embeddings;
  "ai/fields": typeof ai_fields;
  "ai/jev/access": typeof ai_jev_access;
  "ai/jev/analyzePost": typeof ai_jev_analyzePost;
  "ai/jev/client": typeof ai_jev_client;
  "ai/jev/composite": typeof ai_jev_composite;
  "ai/jev/normalize": typeof ai_jev_normalize;
  "ai/jev/questions": typeof ai_jev_questions;
  "ai/jev/questions/intentRouting": typeof ai_jev_questions_intentRouting;
  "ai/jev/questions/outputVerification": typeof ai_jev_questions_outputVerification;
  "ai/jev/questions/postAnalysis": typeof ai_jev_questions_postAnalysis;
  "ai/jev/resultFields": typeof ai_jev_resultFields;
  "ai/jev/routing": typeof ai_jev_routing;
  "ai/jev/thresholds": typeof ai_jev_thresholds;
  "ai/jev/types": typeof ai_jev_types;
  "ai/jev/verify": typeof ai_jev_verify;
  "ai/provider": typeof ai_provider;
  "ai/researchAgent": typeof ai_researchAgent;
  "ai/researchTools": typeof ai_researchTools;
  "ai/runs": typeof ai_runs;
  "ai/scoring/dispatchScore": typeof ai_scoring_dispatchScore;
  "ai/sourceAccess": typeof ai_sourceAccess;
  "ai/styleFields": typeof ai_styleFields;
  "ai/styleProfiles": typeof ai_styleProfiles;
  auth: typeof auth;
  "content/feedback": typeof content_feedback;
  "content/feedbackFields": typeof content_feedbackFields;
  "content/ideaFields": typeof content_ideaFields;
  "content/ideas": typeof content_ideas;
  "content/performance": typeof content_performance;
  "content/performanceFields": typeof content_performanceFields;
  "content/signals": typeof content_signals;
  "content/similarity": typeof content_similarity;
  "content/similarityFields": typeof content_similarityFields;
  crons: typeof crons;
  editorial: typeof editorial;
  "editorial/notices": typeof editorial_notices;
  "editorial/reviewFields": typeof editorial_reviewFields;
  "editorial/reviews": typeof editorial_reviews;
  http: typeof http;
  "integrations/github/app": typeof integrations_github_app;
  "integrations/github/barriers": typeof integrations_github_barriers;
  "integrations/github/context": typeof integrations_github_context;
  "integrations/github/contextAccess": typeof integrations_github_contextAccess;
  "integrations/github/contextFields": typeof integrations_github_contextFields;
  "integrations/github/contextRead": typeof integrations_github_contextRead;
  "integrations/github/deliveries": typeof integrations_github_deliveries;
  "integrations/github/fields": typeof integrations_github_fields;
  "integrations/github/recovery": typeof integrations_github_recovery;
  "integrations/github/recoveryState": typeof integrations_github_recoveryState;
  "integrations/github/repositories": typeof integrations_github_repositories;
  "integrations/github/signalFields": typeof integrations_github_signalFields;
  "integrations/github/webhook": typeof integrations_github_webhook;
  "integrations/x/client": typeof integrations_x_client;
  "integrations/x/fields": typeof integrations_x_fields;
  "integrations/x/oauth": typeof integrations_x_oauth;
  "integrations/x/publish": typeof integrations_x_publish;
  "integrations/x/research": typeof integrations_x_research;
  "intelligence/algorithmProfiles": typeof intelligence_algorithmProfiles;
  "intelligence/assessmentFields": typeof intelligence_assessmentFields;
  "intelligence/assessments": typeof intelligence_assessments;
  "intelligence/audienceProfiles": typeof intelligence_audienceProfiles;
  "intelligence/profileUpdates": typeof intelligence_profileUpdates;
  "intelligence/profiles": typeof intelligence_profiles;
  "intelligence/recommendationEdits": typeof intelligence_recommendationEdits;
  "intelligence/recommendations": typeof intelligence_recommendations;
  "intelligence/sharedFields": typeof intelligence_sharedFields;
  "lib/authorization": typeof lib_authorization;
  "lib/crypto": typeof lib_crypto;
  "lib/editorialFields": typeof lib_editorialFields;
  "lib/sourceProof": typeof lib_sourceProof;
  "media/assets": typeof media_assets;
  "media/binding": typeof media_binding;
  "media/cleanup": typeof media_cleanup;
  "media/cleanupR2": typeof media_cleanupR2;
  "media/limits": typeof media_limits;
  "media/r2": typeof media_r2;
  "media/uploads": typeof media_uploads;
  "media/validation": typeof media_validation;
  "operations/export": typeof operations_export;
  "operations/exportShared": typeof operations_exportShared;
  "operations/githubAlerts": typeof operations_githubAlerts;
  "operations/health": typeof operations_health;
  "operations/pilot": typeof operations_pilot;
  "performance/backfill": typeof performance_backfill;
  "performance/baselines": typeof performance_baselines;
  "performance/calibration": typeof performance_calibration;
  "performance/calibrationFields": typeof performance_calibrationFields;
  "performance/capabilities": typeof performance_capabilities;
  "performance/collect": typeof performance_collect;
  "performance/experimentFields": typeof performance_experimentFields;
  "performance/experiments": typeof performance_experiments;
  "performance/fields": typeof performance_fields;
  "performance/history": typeof performance_history;
  "performance/historyFields": typeof performance_historyFields;
  "performance/historyNormalize": typeof performance_historyNormalize;
  "performance/knowledge": typeof performance_knowledge;
  "performance/metricDefinitions": typeof performance_metricDefinitions;
  "performance/modelFields": typeof performance_modelFields;
  "performance/models": typeof performance_models;
  "performance/normalize": typeof performance_normalize;
  "performance/snapshots": typeof performance_snapshots;
  "planning/accept": typeof planning_accept;
  "planning/fields": typeof planning_fields;
  "planning/plans": typeof planning_plans;
  "planning/recurring": typeof planning_recurring;
  "planning/strategy": typeof planning_strategy;
  "planning/strategyFields": typeof planning_strategyFields;
  preferences: typeof preferences;
  publishing: typeof publishing;
  "publishing/attempts": typeof publishing_attempts;
  "publishing/media": typeof publishing_media;
  "publishing/mediaFields": typeof publishing_mediaFields;
  "publishing/notices": typeof publishing_notices;
  "publishing/postFields": typeof publishing_postFields;
  "publishing/reconcile": typeof publishing_reconcile;
  "publishing/workflows": typeof publishing_workflows;
  "research/access": typeof research_access;
  "research/cache": typeof research_cache;
  "research/clusters": typeof research_clusters;
  "research/contentCleanup": typeof research_contentCleanup;
  "research/contentFields": typeof research_contentFields;
  "research/contentProof": typeof research_contentProof;
  "research/evaluate": typeof research_evaluate;
  "research/evidence": typeof research_evidence;
  "research/evidenceFields": typeof research_evidenceFields;
  "research/execute": typeof research_execute;
  "research/fields": typeof research_fields;
  "research/handoff": typeof research_handoff;
  "research/native": typeof research_native;
  "research/pipeline": typeof research_pipeline;
  "research/pipelineAccess": typeof research_pipelineAccess;
  "research/pipelineFields": typeof research_pipelineFields;
  "research/profiles": typeof research_profiles;
  "research/providerAccess": typeof research_providerAccess;
  "research/providerFields": typeof research_providerFields;
  "research/runs": typeof research_runs;
  "research/schedules": typeof research_schedules;
  "research/time": typeof research_time;
  "research/transport": typeof research_transport;
  "research/webSearch": typeof research_webSearch;
  team: typeof team;
  teamFields: typeof teamFields;
  users: typeof users;
  workspaces: typeof workspaces;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
  agent: import("@convex-dev/agent/_generated/component.js").ComponentApi<"agent">;
  workflow: import("@convex-dev/workflow/_generated/component.js").ComponentApi<"workflow">;
};
