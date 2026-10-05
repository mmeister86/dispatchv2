import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { expect, test, vi } from "vitest";
const readiness = vi.hoisted(() => ({
  emailDelivery: true,
  restrictedSender: true,
  githubLogin: false,
}));
vi.mock("../src/lib/auth-client", () => ({ demoMode: false }));
vi.mock("convex/react", () => ({ useQuery: () => readiness }));
vi.mock("../src/lib/store", () => ({
  useStore: () => ({
    state: { role: "Owner", activeWorkspaceId: "workspace", accounts: [] },
  }),
}));
import { SettingsPage } from "../src/pages/Settings";

test("real integration destination gives actionable provider/email guidance without simulated enrollment", () => {
  const html = renderToStaticMarkup(
    createElement(
      MemoryRouter,
      { initialEntries: ["/settings/integrations"] },
      createElement(
        Routes,
        null,
        createElement(Route, {
          path: "/settings/:tab",
          element: createElement(SettingsPage),
        }),
      ),
    ),
  );
  for (const text of [
    "Publishing noch nicht aktiviert",
    "Kein bestätigter X-Account",
    "X_CLIENT_ID",
    "X_CLIENT_SECRET",
    "INTEGRATION_ENCRYPTION_KEY",
    "AUTH_EMAIL_FROM fehlt",
    "RESEND_API_KEY",
    "SITE_URL",
    "Medien &amp; weitere Provider",
  ])
    expect(html).toContain(text);
  expect(html).not.toContain("Dieser Bereich wird noch angebunden");
  expect(html).not.toContain("Demo-Account hinzufügen");
  expect(html).not.toContain('type="password"');
});
