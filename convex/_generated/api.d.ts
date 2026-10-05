/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ai_fields from "../ai/fields.js";
import type * as ai_provider from "../ai/provider.js";
import type * as ai_runs from "../ai/runs.js";
import type * as auth from "../auth.js";
import type * as content_ideaFields from "../content/ideaFields.js";
import type * as content_ideas from "../content/ideas.js";
import type * as content_signals from "../content/signals.js";
import type * as crons from "../crons.js";
import type * as editorial from "../editorial.js";
import type * as http from "../http.js";
import type * as integrations_github_app from "../integrations/github/app.js";
import type * as integrations_github_barriers from "../integrations/github/barriers.js";
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
import type * as lib_authorization from "../lib/authorization.js";
import type * as lib_crypto from "../lib/crypto.js";
import type * as lib_editorialFields from "../lib/editorialFields.js";
import type * as media_assets from "../media/assets.js";
import type * as media_binding from "../media/binding.js";
import type * as media_cleanup from "../media/cleanup.js";
import type * as media_cleanupR2 from "../media/cleanupR2.js";
import type * as media_limits from "../media/limits.js";
import type * as media_r2 from "../media/r2.js";
import type * as media_uploads from "../media/uploads.js";
import type * as media_validation from "../media/validation.js";
import type * as preferences from "../preferences.js";
import type * as publishing from "../publishing.js";
import type * as publishing_attempts from "../publishing/attempts.js";
import type * as publishing_media from "../publishing/media.js";
import type * as publishing_mediaFields from "../publishing/mediaFields.js";
import type * as publishing_postFields from "../publishing/postFields.js";
import type * as publishing_reconcile from "../publishing/reconcile.js";
import type * as publishing_workflows from "../publishing/workflows.js";
import type * as users from "../users.js";
import type * as workspaces from "../workspaces.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "ai/fields": typeof ai_fields;
  "ai/provider": typeof ai_provider;
  "ai/runs": typeof ai_runs;
  auth: typeof auth;
  "content/ideaFields": typeof content_ideaFields;
  "content/ideas": typeof content_ideas;
  "content/signals": typeof content_signals;
  crons: typeof crons;
  editorial: typeof editorial;
  http: typeof http;
  "integrations/github/app": typeof integrations_github_app;
  "integrations/github/barriers": typeof integrations_github_barriers;
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
  "lib/authorization": typeof lib_authorization;
  "lib/crypto": typeof lib_crypto;
  "lib/editorialFields": typeof lib_editorialFields;
  "media/assets": typeof media_assets;
  "media/binding": typeof media_binding;
  "media/cleanup": typeof media_cleanup;
  "media/cleanupR2": typeof media_cleanupR2;
  "media/limits": typeof media_limits;
  "media/r2": typeof media_r2;
  "media/uploads": typeof media_uploads;
  "media/validation": typeof media_validation;
  preferences: typeof preferences;
  publishing: typeof publishing;
  "publishing/attempts": typeof publishing_attempts;
  "publishing/media": typeof publishing_media;
  "publishing/mediaFields": typeof publishing_mediaFields;
  "publishing/postFields": typeof publishing_postFields;
  "publishing/reconcile": typeof publishing_reconcile;
  "publishing/workflows": typeof publishing_workflows;
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
};
