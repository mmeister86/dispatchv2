import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
vi.mock("../src/lib/auth-client", () => ({
  demoMode: false,
  authClient: {
    useSession: () => ({
      data: { user: { id: "auth-owner" }, session: { id: "session-owner" } },
    }),
  },
}));
vi.mock("convex/react", () => ({
  useQuery: () => ({
    authId: "auth-owner",
    sessionId: "session-owner",
    revision: 0,
    policyId: null,
    editorial: false,
    brand: false,
    editorialDecisionId: null,
    brandDecisionId: null,
    sourceUntil: null,
    aborted: false,
    positions: [
      { position: 0, stage: "confirmed", errorCode: null, notBefore: null },
      { position: 1, stage: "unknown", errorCode: null, notBefore: null },
    ],
  }),
  useAction: () => vi.fn(),
  useMutation: () => vi.fn(),
}));
vi.mock("../src/lib/store", () => ({
  useStore: () => ({
    state: {
      role: "Owner",
      activeWorkspaceId: "w",
      accounts: [
        {
          id: "a",
          workspaceId: "w",
          name: "Fixture",
          handle: "@fixture",
          channel: "X",
          connected: true,
          color: "",
          capability: {
            maxText: 280,
            maxThread: 100,
            maxMedia: 4,
            mediaTypes: [],
            publish: false,
          },
          xEvidence: {
            liveWrite: "unverified",
            textScopeEligible: true,
            mediaScopeEligible: false,
          },
        },
      ],
      media: [],
      schedules: [],
    },
    approveFirstWrite: vi.fn(),
    confirmFirstWrite: vi.fn(),
  }),
}));
import {
  FirstWriteConfirmation,
  PublishingResults,
} from "../src/features/drafts/first-write-confirmation";
const draft = {
  id: "d",
  workspaceId: "w",
  accountId: "a",
  title: "Exact",
  pillar: "",
  strategy: "",
  comments: [],
  versions: [
    {
      id: "v",
      number: 2,
      text: ["Exact approved text"],
      mediaIds: [],
      createdAt: "",
      reason: "",
    },
  ],
};
test("real first-write entry states visible publishing and separate human approval", () => {
  const html = renderToStaticMarkup(
    createElement(FirstWriteConfirmation, { draft, disabled: false }),
  );
  expect(html).toContain("Ersten X-Beitrag veröffentlichen");
  expect(html).toContain("sichtbaren Beitrag");
  expect(html).toContain("Inhalt freigeben");
});
test("published result uses confirmed IDs and immutable snapshot; uncertainty exposes read-only lookup and blocks continuation", () => {
  const html = renderToStaticMarkup(
    createElement(PublishingResults, {
      schedules: [
        {
          id: "s",
          draftId: "d",
          workspaceId: "w",
          accountId: "a",
          version: 1,
          text: ["Old approved snapshot", "Missing second"],
          mediaIds: [],
          at: "2026-10-05",
          status: "uncertain",
          publishedCount: 1,
          externalPosts: [
            {
              position: 0,
              externalId: "123",
              url: "https://x.com/i/web/status/123",
              attemptId: "p",
              confirmedAt: 1,
            },
          ],
        },
      ],
    }),
  );
  expect(html).toContain("Old approved snapshot");
  expect(html).toContain("https://x.com/i/web/status/123");
  expect(html).toContain("Abgleich erforderlich");
  expect(html).toContain("Kandidaten-ID oder X-Link für Beitrag 2");
  expect(html).toContain("Sichtbare Fortsetzung bestätigen");
  expect(html).toContain("Ungeklärte Positionen blockieren");
  expect(html).toContain("Auftrag abbrechen");
  expect(html).not.toContain("erfolgreich fortgesetzt");
});
