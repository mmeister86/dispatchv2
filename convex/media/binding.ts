import { ConvexError } from "convex/values";

// Namespace identity excludes credentials: rotating keys must keep existing media usable.
export function configuredR2Binding() {
  const r2AccountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim().toLowerCase();
  const bucket = process.env.R2_MEDIA_BUCKET;
  if (!r2AccountId || !/^[a-f0-9]{32}$/.test(r2AccountId) || !bucket)
    throw new ConvexError("MEDIA_CONFIGURATION_REQUIRED");
  return { r2AccountId, bucket };
}
export function requireR2Binding(
  saved: { r2AccountId?: string; bucket?: string },
  current = configuredR2Binding(),
) {
  if (!saved.r2AccountId || !saved.bucket)
    throw new ConvexError("MEDIA_BINDING_RECONCILIATION_REQUIRED");
  if (
    saved.r2AccountId !== current.r2AccountId ||
    saved.bucket !== current.bucket
  )
    throw new ConvexError("MEDIA_CONFIGURATION_REQUIRED");
}
