import { createContext, useContext, useState, type ReactNode } from "react";

type CallbackParameters = {
  state: string;
  code: string | undefined;
  denied: boolean;
};
type Exchange = (
  scope: string,
  complete: (parameters: CallbackParameters) => Promise<unknown>,
) => Promise<unknown>;
const Context = createContext<Exchange | null>(null);

export function OAuthCallbackProvider({ children }: { children: ReactNode }) {
  const [exchange] = useState<Exchange>(() => {
    const params = new URLSearchParams(window.location.search);
    const buffer = {
      state: params.get("state") ?? "",
      code: params.get("code") ?? undefined,
      denied: params.has("error"),
    };
    let pending: { scope: string; promise: Promise<unknown> } | undefined;
    const run: Exchange = (scope, complete) => {
      if (!pending) {
        window.history.replaceState(
          window.history.state,
          "",
          window.location.pathname,
        );
        // Route-owned state survives auth/workspace loading without replaying the code.
        pending = {
          scope,
          promise: Promise.resolve().then(() => complete(buffer)),
        };
      }
      return pending.scope === scope
        ? pending.promise
        : Promise.reject(new Error("OAUTH_SCOPE_CHANGED"));
    };
    return run;
  });
  return <Context.Provider value={exchange}>{children}</Context.Provider>;
}

export function useOAuthCallback() {
  const exchange = useContext(Context);
  if (!exchange) throw new Error("OAuthCallbackProvider fehlt");
  return exchange;
}
