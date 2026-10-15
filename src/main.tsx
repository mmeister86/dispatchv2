import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  authClient,
  convexClientInstance,
  ConvexBetterAuthProvider,
} from "@/lib/auth-client";
import { StoreProvider } from "@/lib/store";
import { App } from "./App";
import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-500.css";
import "@fontsource/dm-sans/latin-600.css";
import "@fontsource/manrope/latin-500.css";
import "@fontsource/manrope/latin-600.css";
import "@fontsource/manrope/latin-700.css";
import "./index.css";
const router = createBrowserRouter([{ path: "*", element: <App /> }]);
function Providers({ children }: { children: React.ReactNode }) {
  const contents = <StoreProvider>{children}</StoreProvider>;
  return convexClientInstance ? (
    <ConvexBetterAuthProvider
      client={convexClientInstance}
      authClient={authClient}
    >
      {contents}
    </ConvexBetterAuthProvider>
  ) : (
    contents
  );
}
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Providers>
      <TooltipProvider>
        <RouterProvider router={router} />
        <Toaster richColors position="bottom-right" closeButton />
      </TooltipProvider>
    </Providers>
  </React.StrictMode>,
);
