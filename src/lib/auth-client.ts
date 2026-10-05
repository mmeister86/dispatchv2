import { createAuthClient } from "better-auth/react";
import {
  convexClient,
  crossDomainClient,
} from "@convex-dev/better-auth/client/plugins";
import {
  ConvexBetterAuthProvider as BetterAuthProvider,
  AuthBoundary as BetterAuthBoundary,
} from "@convex-dev/better-auth/react";
import { ConvexReactClient } from "convex/react";
export const demoMode = import.meta.env.VITE_DEMO_MODE === "true";
export const backendConfigured = !!(
  import.meta.env.VITE_CONVEX_URL &&
  import.meta.env.VITE_CONVEX_SITE_URL &&
  import.meta.env.VITE_SITE_URL
);
export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_CONVEX_SITE_URL,
  plugins: [convexClient(), crossDomainClient()],
});
export const convexClientInstance =
  !demoMode && backendConfigured
    ? new ConvexReactClient(import.meta.env.VITE_CONVEX_URL)
    : null;
export function returnPath(value: string | null) {
  return value?.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\") &&
    !/^\/(login|signup|verify|reset-password)([/?#]|$)/.test(value)
    ? value
    : "/overview";
}

// Component 0.12.5's generic plugin union erases getSession under Better Auth 1.6.33.
// Keep the concrete client methods; remove these boundary casts when upstream fixes the declaration.
type ProviderClient = Pick<
  typeof authClient,
  "useSession" | "getSession" | "convex" | "crossDomain" | "updateSession"
>;
type ProviderProps = Omit<
  Parameters<typeof BetterAuthProvider>[0],
  "authClient"
> & { authClient: ProviderClient };
export const ConvexBetterAuthProvider = BetterAuthProvider as unknown as (
  props: ProviderProps,
) => ReturnType<typeof BetterAuthProvider>;
type BoundaryProps = Omit<
  Parameters<typeof BetterAuthBoundary>[0],
  "authClient"
> & { authClient: ProviderClient };
export const AuthBoundary = BetterAuthBoundary as unknown as (
  props: BoundaryProps,
) => ReturnType<typeof BetterAuthBoundary>;
