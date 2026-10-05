export const MIME_LIMITS: Record<string, number> = {
  "image/jpeg": 5 * 1024 * 1024,
  "image/png": 5 * 1024 * 1024,
  "image/gif": 15 * 1024 * 1024,
  "video/mp4": 32 * 1024 * 1024,
};
export const QUOTA_BYTES = 512 * 1024 * 1024;
export const ASSET_LIMIT = 500;
export const GRANT_MS = 10 * 60 * 1000;
// Convex actions expire after ten minutes. Cleanup waits out the whole action, not just an HTTP timeout.
export const LEASE_MS = 11 * 60 * 1000;
export const PREVIEW_SECONDS = 120;
