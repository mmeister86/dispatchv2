/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as crons from "../crons.js";
import type * as editorial from "../editorial.js";
import type * as http from "../http.js";
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
import type * as publishing_media from "../publishing/media.js";
import type * as publishing_mediaFields from "../publishing/mediaFields.js";
import type * as users from "../users.js";
import type * as workspaces from "../workspaces.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  crons: typeof crons;
  editorial: typeof editorial;
  http: typeof http;
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
  "publishing/media": typeof publishing_media;
  "publishing/mediaFields": typeof publishing_mediaFields;
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
};
