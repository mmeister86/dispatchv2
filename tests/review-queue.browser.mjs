import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";
import { mkdtempSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
const artifactDir = mkdtempSync(join(tmpdir(), "dispatch-tests-"));
const evidence =
  process.env.DISPATCH_CANDIDATE_COMPOSER_EVIDENCE_DIR ??
  `${artifactDir}/dispatch-68.1-browser-composer`;
const root = fileURLToPath(new URL("..", import.meta.url)).replace(/\/$/, "");
const mocks = {
  "convex/react": `import React from 'react';import {ConvexError} from 'convex/values';import {getFunctionName} from '/node_modules/convex/dist/esm/server/index.js';window.NativeConvexError=ConvexError;
const tick=()=>React.useSyncExternalStore(cb=>{window.listeners.add(cb);return()=>window.listeners.delete(cb)},()=>window.tick);
const funcs=new Map();const invoke=ref=>{const name=getFunctionName(ref);if(!funcs.has(name))funcs.set(name,async args=>{window.commands.push({name,args});if(name==='users:bootstrap')return 'user-owner';return new Promise((resolve,reject)=>window.pending.push({name,args,resolve,reject}));});return funcs.get(name)};
export const useMutation=invoke;export const useAction=invoke;export const useConvex=()=>({query:async(ref,args)=>{const n=getFunctionName(ref);if(n==='content/ideas:candidate')return window.candidateViews?.[args.versionId]??null;if(n==='ai/jev/verify:get')return window.verificationViews?.[args.reference.contentRequestId];throw new Error('Unconfigured direct fixture query '+n);}});export const useConvexAuth=()=>{tick();return {isAuthenticated:true,isLoading:false}};
export const useQuery=(ref,args)=>{tick();if(args==='skip')return undefined;const n=getFunctionName(ref);if(n==='content/ideas:list')return window.candidateList;if(n==='content/ideas:candidate')return window.candidateViews?.[args.versionId]??null;if(n==='ai/jev/verify:get')return window.verificationViews?.[args.reference.contentRequestId];if(n==='ai/jev/verify:availability')return window.verificationAvailability??{status:'configuration_required'};if(n==='ai/jev/routing:availability')return {status:'configuration_required'};if(n==='ai/jev/access:availability')return {status:'disabled',guidance:'Native fixture default OFF'};if(n==='ai/runs:availability')return {providerConfigured:false,processingApproved:false,pricingApproved:false};if(n==='operations/deletion:mine')return window.deletionJobs??[];if(n==='users:current')return window.snapshot;if(n==='team:list')return window.roster;if(n==='editorial:resources')return window.resources;if(n==='editorial:get')return window.bundles.find(b=>b.draft._id===args.draftId)??null;if(n==='editorial/reviews:get')return {...window.review,authId:window.session.user.id,sessionId:window.session.session.id};if(n==='editorial/reviews:policy')return window.policy;if(n==='editorial:calendar')return {rows:[window.calendar],tooDense:false};if(n==='publishing/reconcile:inspect')return {aborted:false,positions:[{position:0,stage:'unsent',errorCode:null,notBefore:null}]};if(n==='planning/plans:context')return {preferenceId:'preference',timezone:'Europe/Berlin'};if(n==='planning/plans:list')return [];if(n==='planning/strategy:get')return {control:null,version:null,styleUntil:null,pillars:[],candidates:[],reason:null,selectedStyleVersionId:null};if(n==='team:preview')return window.invitation;return undefined;};
export const usePaginatedQuery=(ref,args,opts)=>{tick();const n=getFunctionName(ref);if(args==='skip')return {results:[],status:'Exhausted',loadMore:()=>{}};if(n==='editorial:list')return {results:window.bundles.slice(0,window.loaded),status:window.loaded<window.bundles.length?'CanLoadMore':'Exhausted',loadMore:()=>window.update({loaded:window.bundles.length})};if(n==='editorial/notices:list')return {results:window.notices,status:'CanLoadMore',loadMore:()=>{}};return {results:[],status:'Exhausted',loadMore:()=>{}};};`,
  "@/lib/auth-client": `import React from 'react';export const demoMode=window.demo;export const backendConfigured=true;export const convexClientInstance=null;export const ConvexBetterAuthProvider=({children})=>children;export const AuthBoundary=({children})=>children;export {authPath,returnPath} from '/src/lib/navigation.ts';export const authClient={useSession:()=>{React.useSyncExternalStore(cb=>{window.listeners.add(cb);return()=>window.listeners.delete(cb)},()=>window.tick);return {data:window.session,isPending:false}},signOut:async()=>{},signIn:{email:async()=>({})},signUp:{email:async()=>({})},sendVerificationEmail:async()=>({})};`,
};
const server = await createServer({
  root,
  cacheDir: `${evidence}/vite-cache`,
  configFile: `${root}/vite.config.ts`,
  server: { host: "127.0.0.1", port: 5184, strictPort: true },
  plugins: [
    {
      name: "native-review-full-app-intercepts",
      enforce: "pre",
      resolveId(id) {
        if (
          id === "./auth-client" ||
          id === "@/lib/auth-client" ||
          id.startsWith(`${root}/src/lib/auth-client`)
        )
          return "\0fixture:@/lib/auth-client";
        if (id in mocks) return "\0fixture:" + id;
      },
      load(id) {
        if (id.startsWith("\0fixture:")) return mocks[id.slice(9)];
      },
    },
  ],
});
await server.listen();
let browser;
try {
  const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ??
      (existsSync(chrome) ? chrome : undefined),
  });
  const page = await browser.newPage({
      viewport: { width: 1280, height: 900 },
    }),
    errors = [],
    provider = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route(
    /https:\/\/(api\.resend\.com|api\.x\.com|api\.twitter\.com)\//,
    (route) => {
      provider.push(route.request().url());
      throw new Error("No provider request permitted");
    },
  );
  await page.addInitScript(() => {
    window.tick = 0;
    window.listeners = new Set();
    window.commands = [];
    window.pending = [];
    window.demo = false;
    window.loaded = 25;
    window.update = (patch) => {
      Object.assign(window, patch);
      window.tick++;
      window.listeners.forEach((fn) => fn());
    };
    window.session = {
      user: {
        id: "auth-owner",
        email: "owner@example.test",
        emailVerified: true,
      },
      session: { id: "session-owner" },
    };
    const profile = {
      name: "Native Owner",
      timezone: "Europe/Berlin",
      language: "Deutsch",
      audience: "",
      tone: "",
      topics: "",
      onboardingDone: true,
      onboardingStep: 3,
    };
    window.snapshot = {
      state: "ready",
      authId: "auth-owner",
      userId: "user-owner",
      activeWorkspaceId: "workspace-native",
      workspaces: [
        {
          id: "workspace-native",
          name: "Native workspace",
          description: "",
          role: "Owner",
        },
      ],
      preferences: profile,
    };
    window.roster = {
      revision: 0,
      authId: "auth-owner",
      sessionId: "session-owner",
      workspaceId: "workspace-native",
      actorRole: "Owner",
      members: [
        {
          membershipId: "member-owner",
          userId: "user-owner",
          name: "Native Owner",
          role: "Owner",
        },
        {
          membershipId: "member-editor",
          userId: "user-editor",
          name: "Native Editor",
          role: "Editor",
        },
      ],
      invitations: [],
      invitationsLimited: false,
    };
    window.policy = {
      revision: 1,
      policyId: "policy-P2",
      editorial: true,
      brand: true,
    };
    window.review = {
      revision: 0,
      policyId: "policy-P2",
      editorial: true,
      brand: true,
      editorialDecisionId: null,
      brandDecisionId: null,
      sourceUntil: null,
    };
    const account = {
      _id: "account-native",
      _creationTime: 1,
      workspaceId: "workspace-native",
      provider: "X",
      providerIdentity: "native",
      name: "Native X",
      handle: "@native",
      connection: "connected",
      capability: {
        maxText: 280,
        maxThread: 10,
        maxMedia: 4,
        mediaTypes: [],
        publish: true,
      },
    };
    window.resources = {
      accounts: [account],
      assets: [],
      members: window.roster.members.map((m) => ({
        id: m.userId,
        role: m.role,
        name: m.name,
      })),
      events: [],
      notifications: [],
      resourcesLimited: false,
    };
    window.bundles = Array.from({ length: 30 }, (_, i) => ({
      authId: "auth-owner",
      sessionId: "session-owner",
      draft: {
        _id: "draft-" + i,
        _creationTime: 1,
        workspaceId: "workspace-native",
        revision: 1,
        assignmentRevision: 0,
        currentVersionId: "version-" + i,
        authorId: "user-owner",
        source: "Manual",
        updatedAt: 1,
        assigneeId: "user-editor",
      },
      versions: [
        {
          _id: "version-" + i,
          _creationTime: 1,
          workspaceId: "workspace-native",
          draftId: "draft-" + i,
          number: 1,
          authorId: "user-owner",
          createdAt: 1,
          reason: "Manual",
          sourceUnavailable: i === 2,
          content: {
            title: i === 2 ? "" : "Native draft " + i,
            text: [i === 2 ? "" : "Native exact content " + i],
            accountId: "account-native",
            pillar: "Product",
            strategy: "manual",
            media: [],
          },
        },
      ],
      review:
        i === 2
          ? null
          : { ...window.review, approvalId: null, approvalsLimited: false },
      frozenReviews: [],
      assets: [],
      approvals: [],
      schedules: [],
      comments:
        i === 0
          ? [
              {
                _id: "comment-0",
                draftId: "draft-0",
                versionId: "version-0",
                versionNumber: 1,
                authorId: "user-editor",
                text: "Exact native comment",
                resolved: false,
                createdAt: 1,
              },
            ]
          : [],
      historyLimited: false,
      commentsLimited: false,
      schedulesLimited: false,
    }));
    const schedule = {
      _id: "schedule-frozen",
      _creationTime: 1,
      workspaceId: "workspace-native",
      draftId: "draft-0",
      versionId: "version-0",
      versionNumber: 1,
      accountId: "account-native",
      approvalId: "approval-P1",
      actorId: "user-owner",
      reviewPin: {
        policyId: "policy-P1",
        decisionIds: ["decision-P1"],
        sourceUntil: null,
      },
      generation: 1,
      at: Date.now() + 3600000,
      timezone: "Europe/Berlin",
      localTime: "2026-10-07T12:00",
      state: "scheduled",
      publishedCount: 0,
      errorCode: null,
      jobId: null,
    };
    window.calendar = {
      schedule,
      version: window.bundles[0].versions[0],
      frozenReview: { usable: true, sourceUntil: null },
    };
    window.notices = [
      {
        authId: "auth-owner",
        sessionId: "session-owner",
        id: "notice-owner",
        draftId: "draft-0",
        versionId: "version-0",
        accountId: "account-native",
        parent: { kind: "assignment", commandId: "assignment-1" },
        createdAt: 1,
        sourceUntil: null,
        readAt: null,
        dismissedAt: null,
      },
    ];
    window.invitation = {
      invitationId: "invitation-native",
      authId: "auth-owner",
      sessionId: "session-owner",
      workspaceId: "workspace-native",
      workspaceName: "Native workspace",
      email: "owner@example.test",
      role: "Editor",
      status: "pending",
      expiresAt: Date.now() + 3600000,
      revision: 0,
    };
  });
  const settle = async (name, kind = "resolve", value = null, patch = {}) =>
    page.evaluate(
      ({ name, kind, value, patch }) => {
        const i = window.pending.findIndex((p) => p.name === name);
        if (i < 0) throw new Error("Missing pending " + name);
        const [p] = window.pending.splice(i, 1);
        p[kind](kind === "reject" ? new Error(value) : value);
        window.update(patch);
      },
      { name, kind, value, patch },
    );
  const captures = [];
  const picture = async (label) => {
    const markers = {
      "team-desktop": [
        "Workspace-Team",
        "Review-Queue",
        "25 geladene Entwürfe",
        "Quelle nicht verfügbar",
      ],
      "team-390": ["Workspace-Team", "Review-Queue", "25 geladene Entwürfe"],
      "drawer-desktop": ["0 ungelesene Hinweise", "Entwurf zugewiesen"],
      "composer-desktop": [
        "Native draft 0",
        "Zuständig · Revision 7",
        "Exact native comment",
      ],
      "composer-390": [
        "Native draft 0",
        "Zuständig · Revision 7",
        "Exact native comment",
      ],
      "first-write-390": [
        "Erstveröffentlichung auf X",
        "Native draft 0",
        "Ich bestätige die sichtbare Veröffentlichung",
      ],
      "calendar-frozen-390": [
        "Native draft 0",
        "policy-P1",
        "eingefrorener Nachweis aktuell verfügbar",
      ],
      "calendar-recovery-390": [
        "Native draft 0",
        "policy-P2",
        "Sichtbare Fortsetzung bestätigen",
      ],
      "calendar-390": ["Platz für gute Geschichten", "Native draft 0"],
      "draft-list-unavailable-390": ["Alle Entwürfe", "Quelle nicht verfügbar"],
      "ordinary-approval-expired-390": ["Native draft 0", "Version freigeben"],
      "current-stages-expired-390": ["Version freigeben"],
      "first-write-source-expired-390": [
        "Erstveröffentlichung auf X",
        "Diesen Inhalt für Erstveröffentlichung freigeben",
      ],
      "plans-390": ["Aus deinen geprüften Entwürfen"],
      "public-invitation-390": [
        "Deine Einladung",
        "Native workspace",
        "Einladung annehmen",
      ],
    }[label];
    for (const text of markers)
      await expect(
        page.getByText(text, { exact: false }).first(),
      ).toBeVisible();
    if (label === "calendar-390")
      await expect(
        page.getByRole("button", {
          name: /Native draft 0.*Teilweise veröffentlicht/,
        }),
      ).toBeVisible();
    const dialogOpen = [
      "first-write-390",
      "calendar-frozen-390",
      "calendar-recovery-390",
      "first-write-source-expired-390",
    ].includes(label);
    await expect(page.locator('[data-slot="dialog-content"]')).toHaveCount(
      dialogOpen ? 1 : 0,
    );
    await expect(page.locator('[data-slot="dialog-overlay"]')).toHaveCount(
      dialogOpen ? 1 : 0,
    );
    await expect(page.locator('[data-slot="sheet-content"]')).toHaveCount(
      label === "drawer-desktop" ? 1 : 0,
    );
    await page.evaluate(async () => {
      await document.fonts.ready;
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      );
    });
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document
              .getAnimations()
              .filter(
                (a) =>
                  (a.pending || a.playState === "running") &&
                  Number.isFinite(a.effect?.getComputedTiming().endTime),
              ).length,
        ),
      )
      .toBe(0);
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    const opacity = await page.evaluate(() =>
      [
        ...document.querySelectorAll(
          'main, .fade-in, [data-slot="dialog-content"], [data-slot="sheet-content"]',
        ),
      ]
        .filter(
          (el) =>
            el.getBoundingClientRect().width > 0 &&
            el.getBoundingClientRect().height > 0,
        )
        .map((el) => ({
          slot:
            el.tagName === "MAIN"
              ? "main"
              : (el.getAttribute("data-slot") ?? "route"),
          opacity: getComputedStyle(el).opacity,
          background: getComputedStyle(el).backgroundColor,
        })),
    );
    expect(opacity.every((el) => el.opacity === "1")).toBe(true);
    if (dialogOpen)
      expect(
        opacity.find((el) => el.slot === "dialog-content")?.background,
      ).toMatch(/^rgb\(/);
    const fonts = await page.evaluate(() => document.fonts.status);
    expect(fonts).toBe("loaded");
    captures.push({
      label,
      markers,
      dialogOpen,
      fonts,
      runningFiniteAnimations: 0,
      opacity,
    });
    mkdirSync(evidence, {
      recursive: true,
    });
    await page.screenshot({
      path: `${evidence}/${label}.png`,
      fullPage: true,
      animations: "disabled",
    });
  };
  await page.goto("http://127.0.0.1:5184/team");
  await expect(
    page.getByRole("heading", { name: "Workspace-Team" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Review-Queue" }),
  ).toBeVisible();
  await expect(
    page.getByText("25 geladene Entwürfe", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("Quelle nicht verfügbar", { exact: true }),
  ).toBeVisible();
  await picture("team-desktop");
  await page.getByRole("button", { name: "Weitere Entwürfe laden" }).click();
  await expect(
    page.getByText("30 geladene Entwürfe", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Benachrichtigungen öffnen" }).click();
  await expect(
    page.getByRole("region", { name: "Persönliche native Hinweise" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Als gelesen markieren", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Als gelesen markieren", exact: true }),
  ).toBeDisabled();
  await settle("editorial/notices:read");
  await page.evaluate(() =>
    window.update({
      notices: window.notices.map((n) => ({ ...n, readAt: Date.now() })),
    }),
  );
  await expect(
    page.getByText("0 ungelesene Hinweise", { exact: false }),
  ).toBeVisible();
  await picture("drawer-desktop");
  await page.keyboard.press("Escape");
  await page.goto("http://127.0.0.1:5184/drafts/draft-0");
  await expect(
    page.getByRole("heading", { name: "Native draft 0", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Native Reviews" }),
  ).toBeVisible();
  const resolveComment = page.getByRole("button", {
    name: "Als erledigt markieren",
    exact: true,
  });
  await resolveComment.click();
  await expect(resolveComment).toBeDisabled();
  expect(
    await page.evaluate(
      () =>
        window.commands.find((c) => c.name === "editorial:resolveComment").args,
    ),
  ).toEqual({
    workspaceId: "workspace-native",
    commentId: "comment-0",
    expectedResolved: false,
  });
  await settle("editorial:resolveComment");
  await page.evaluate(() => {
    window.bundles[0].comments[0].resolved = true;
    window.update({ bundles: [...window.bundles] });
  });
  await expect(
    page.getByRole("button", { name: "Wieder öffnen", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", {
      name: "Redaktionelles Review bestätigen",
      exact: true,
    })
    .click();
  await settle("editorial/reviews:decide", "resolve", {
    revision: 1,
    policyId: "policy-P2",
    decisionId: "decision-editorial",
  });
  await page.evaluate(() =>
    window.update({
      review: {
        ...window.review,
        revision: 1,
        editorialDecisionId: "decision-editorial",
      },
      bundles: window.bundles.map((b) =>
        b.draft._id === "draft-0"
          ? {
              ...b,
              review: {
                ...b.review,
                revision: 1,
                editorialDecisionId: "decision-editorial",
              },
            }
          : b,
      ),
    }),
  );
  await expect(
    page.getByRole("button", {
      name: "Marken- Review bestätigen",
      exact: true,
    }),
  ).toBeEnabled();
  // Original assignment intent survives both dirty recipient selection and reactive revision updates after lost response.
  await page.getByRole("button", { name: "Zuständigkeit speichern" }).click();
  await settle("editorial:assign", "reject", "lost response");
  const original = await page.evaluate(
    () =>
      window.commands.filter((c) => c.name === "editorial:assign").at(-1).args,
  );
  const assignment = page
    .getByRole("combobox")
    .filter({ has: page.locator('option[value="user-owner"]') });
  await assignment.selectOption("user-owner");
  await page.evaluate(() =>
    window.update({
      bundles: window.bundles.map((b) =>
        b.draft._id === "draft-0"
          ? { ...b, draft: { ...b.draft, assignmentRevision: 7 } }
          : b,
      ),
    }),
  );
  await page
    .getByRole("button", { name: "Denselben Auftrag wiederholen", exact: true })
    .click();
  const replay = await page.evaluate(
    () =>
      window.commands.filter((c) => c.name === "editorial:assign").at(-1).args,
  );
  expect(replay).toEqual(original);
  await settle("editorial:assign", "resolve", {
    revision: 1,
    versionId: "version-0",
    assigneeId: "user-editor",
  });
  await picture("composer-desktop");
  // Scope ABA fences a late response even if the original account/scope is restored.
  await page.getByRole("button", { name: "Zuständigkeit speichern" }).click();
  await page.evaluate(() => {
    window.update({
      snapshot: {
        ...window.snapshot,
        workspaces: window.snapshot.workspaces.map((w) => ({
          ...w,
          role: "Viewer",
        })),
      },
      roster: { ...window.roster, actorRole: "Viewer" },
    });
  });
  await expect(
    page.getByRole("button", { name: "Zuständigkeit speichern" }),
  ).toBeDisabled();
  await page.evaluate(() =>
    window.update({
      snapshot: {
        ...window.snapshot,
        workspaces: window.snapshot.workspaces.map((w) => ({
          ...w,
          role: "Owner",
        })),
      },
      roster: { ...window.roster, actorRole: "Owner" },
    }),
  );
  await settle("editorial:assign");
  await page.setViewportSize({ width: 390, height: 844 });
  await picture("composer-390");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toBeVisible();
  await page.goto("http://127.0.0.1:5184/team");
  await expect(
    page.getByRole("heading", { name: "Review-Queue" }),
  ).toBeVisible();
  await picture("team-390");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.goto("http://127.0.0.1:5184/drafts/draft-0");
  await page.evaluate(() => {
    window.resources.accounts[0].capability.publish = false;
    const review = {
      ...window.review,
      editorialDecisionId: "decision-editorial",
      brandDecisionId: "decision-brand",
    };
    window.bundles[0].review = {
      ...review,
      approvalId: null,
      approvalsLimited: false,
    };
    window.update({
      resources: { ...window.resources },
      bundles: [...window.bundles],
      review,
    });
  });
  await page
    .getByRole("button", {
      name: "Ersten X-Beitrag veröffentlichen",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", {
      name: "Diesen Inhalt für Erstveröffentlichung freigeben",
      exact: true,
    })
    .click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.commands.filter(
            (c) => c.name === "editorial:approveFirstWrite",
          ).length,
      ),
    )
    .toBe(1);
  const expiry = Date.now() + 360000;
  await page.evaluate((expiresAt) => {
    window.bundles[0].approvals = [
      {
        _id: "approval-first",
        workspaceId: "workspace-native",
        draftId: "draft-0",
        versionId: "version-0",
        versionNumber: 1,
        accountId: "account-native",
        actorId: "user-owner",
        createdAt: 1,
        revokedAt: null,
        revokedBy: null,
        purpose: "first_write_verification",
        expiresAt,
        reviewPin: {
          policyId: "policy-P2",
          decisionIds: ["decision-editorial", "decision-brand"],
          sourceUntil: null,
        },
      },
    ];
    window.update({ bundles: [...window.bundles] });
  }, expiry);
  await settle("editorial:approveFirstWrite", "resolve", "approval-first");
  const send = page.getByRole("button", {
    name: "Jetzt sichtbar veröffentlichen und Zugang belegen",
    exact: true,
  });
  await expect(send).toBeDisabled();
  await page
    .getByRole("checkbox", { name: "Sichtbare Veröffentlichung bestätigen" })
    .click();
  await expect(send).toBeEnabled();
  expect(
    await page
      .getByRole("dialog")
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
  await picture("first-write-390");
  await send.click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.commands.filter(
            (c) => c.name === "editorial:confirmFirstWrite",
          ).length,
      ),
    )
    .toBe(1);
  expect(
    await page.evaluate(
      () =>
        window.commands.find((c) => c.name === "editorial:confirmFirstWrite")
          .args,
    ),
  ).toMatchObject({
    versionId: "version-0",
    approvalId: "approval-first",
    accountId: "account-native",
  });
  await settle("editorial:confirmFirstWrite", "resolve", "schedule-first");
  await page.goto("http://127.0.0.1:5184/calendar?view=agenda");
  await expect(
    page.getByRole("heading", { name: "Platz für gute Geschichten" }),
  ).toBeVisible();
  await page.getByText("Native draft 0", { exact: true }).first().click();
  await expect(
    page.getByText("Gespeicherte Review-Regel:", { exact: false }),
  ).toContainText("policy-P1");
  await expect(
    page.getByText("eingefrorener Nachweis aktuell verfügbar", {
      exact: false,
    }),
  ).toBeVisible();
  await picture("calendar-frozen-390");
  await page.evaluate(() => {
    window.calendar.schedule.state = "partially_published";
    window.calendar.schedule.externalPosts = [
      {
        position: 0,
        externalId: "receipt-1",
        url: "https://x.com/native/status/1",
        attemptId: "attempt-1",
        confirmedAt: 1,
      },
    ];
    window.update({
      calendar: { ...window.calendar },
      review: {
        ...window.review,
        editorialDecisionId: null,
        brandDecisionId: null,
      },
    });
  });
  const resume = page.getByRole("button", {
    name: "Unveränderten Thread ausdrücklich fortsetzen",
    exact: true,
  });
  await expect(resume).toBeDisabled();
  await page.evaluate(() =>
    window.update({
      review: {
        ...window.review,
        editorialDecisionId: "decision-P2-editorial",
        brandDecisionId: "decision-P2-brand",
      },
    }),
  );
  await page
    .getByRole("checkbox", { name: "Sichtbare Fortsetzung bestätigen" })
    .click();
  await expect(resume).toBeEnabled();
  expect(
    await page
      .getByRole("dialog")
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
  await picture("calendar-recovery-390");
  await resume.click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.commands.filter(
            (c) => c.name === "publishing/reconcile:continueThread",
          ).length,
      ),
    )
    .toBe(1);
  expect(
    await page.evaluate(
      () =>
        window.commands.find(
          (c) => c.name === "publishing/reconcile:continueThread",
        ).args,
    ),
  ).toMatchObject({ scheduleId: "schedule-frozen", expectedGeneration: 1 });
  await settle("publishing/reconcile:continueThread", "resolve", 2);

  await page.keyboard.press("Escape");
  await expect(page.locator('[data-slot="dialog-content"]')).toHaveCount(0);
  await expect(page.locator('[data-slot="dialog-overlay"]')).toHaveCount(0);
  const unavailableLink = page.getByRole("link", {
    name: "Quelle nicht verfügbar",
    exact: true,
  });
  await expect(unavailableLink).toHaveAttribute("href", "/drafts/draft-2");
  await expect(page.getByText("Native draft 2", { exact: true })).toHaveCount(
    0,
  );
  await picture("calendar-390");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.goto("http://127.0.0.1:5184/drafts");
  const unavailableRow = page
    .getByRole("row")
    .filter({ has: page.locator('a[href="/drafts/draft-2"]') });
  await expect(
    unavailableRow.getByRole("link", { name: /Quelle nicht verfügbar/ }),
  ).toBeVisible();
  await expect(
    unavailableRow.getByText("Quelle nicht verfügbar", { exact: true }),
  ).toHaveCount(2);
  await expect(
    unavailableRow
      .getByRole("cell")
      .nth(2)
      .getByText("Quelle nicht verfügbar", { exact: true }),
  ).toBeVisible();
  await expect(
    unavailableRow.getByText("Noch kein Text", { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText("Native draft 2", { exact: true })).toHaveCount(
    0,
  );
  await picture("draft-list-unavailable-390");
  await page.goto("http://127.0.0.1:5184/plans");
  await page
    .getByRole("combobox", { name: "Aktiver Account" })
    .selectOption("account-native");
  await expect(
    page.getByRole("heading", { name: "Aus deinen geprüften Entwürfen" }),
  ).toBeVisible();
  await picture("plans-390");
  await page.goto("http://127.0.0.1:5184/team/invitations/invitation-native");
  await expect(
    page.getByRole("button", { name: "Einladung annehmen", exact: true }),
  ).toBeVisible();
  await picture("public-invitation-390");
  await page
    .getByRole("button", { name: "Einladung annehmen", exact: true })
    .click();
  await settle("team:accept");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.commands.filter((c) => c.name === "workspaces:select").length,
      ),
    )
    .toBe(1);
  expect(
    await page.evaluate(
      () => window.commands.find((c) => c.name === "workspaces:select").args,
    ),
  ).toEqual({ workspaceId: "workspace-native" });
  await settle("workspaces:select");
  // Original selected source deadline must expire without a transport update.
  await page.goto("http://127.0.0.1:5184/drafts/draft-0");
  await page.clock.install({ time: new Date() });
  const sourceDeadlines = await page.evaluate(() => {
    const short = Date.now() + 60000,
      long = Date.now() + 900000;
    window.resources.accounts[0].capability.publish = false;
    window.review = {
      ...window.review,
      editorialDecisionId: "decision-editorial",
      brandDecisionId: "decision-brand",
      sourceUntil: long,
    };
    window.bundles[0].review = {
      ...window.review,
      approvalId: null,
      approvalsLimited: false,
    };
    window.bundles[0].versions[0].sourceProofUntil = long;
    window.update({
      resources: { ...window.resources },
      bundles: [...window.bundles],
      review: { ...window.review },
    });
    return { short, long };
  });
  await page
    .getByRole("button", {
      name: "Ersten X-Beitrag veröffentlichen",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", {
      name: "Diesen Inhalt für Erstveröffentlichung freigeben",
      exact: true,
    })
    .click();
  await page.evaluate(({ short, long }) => {
    window.bundles[0].approvals = [
      {
        _id: "approval-source-short",
        workspaceId: "workspace-native",
        draftId: "draft-0",
        versionId: "version-0",
        versionNumber: 1,
        accountId: "account-native",
        actorId: "user-owner",
        createdAt: Date.now(),
        revokedAt: null,
        revokedBy: null,
        purpose: "first_write_verification",
        expiresAt: long + 1800000,
        reviewPin: {
          policyId: "policy-P2",
          decisionIds: ["decision-editorial", "decision-brand"],
          sourceUntil: short,
        },
      },
    ];
    window.update({ bundles: [...window.bundles] });
  }, sourceDeadlines);
  await settle(
    "editorial:approveFirstWrite",
    "resolve",
    "approval-source-short",
  );
  const sourceSend = page.getByRole("button", {
    name: "Jetzt sichtbar veröffentlichen und Zugang belegen",
    exact: true,
  });
  const sourceAck = page.getByRole("checkbox", {
    name: "Sichtbare Veröffentlichung bestätigen",
  });
  await sourceAck.click();
  await expect(sourceSend).toBeEnabled();
  await page.clock.fastForward(60001);
  await expect(sourceSend).toHaveCount(0);
  await expect(sourceAck).toHaveCount(0);
  const freshApproval = page.getByRole("button", {
    name: "Diesen Inhalt für Erstveröffentlichung freigeben",
    exact: true,
  });
  await expect(freshApproval).toBeEnabled();
  expect(
    await page.evaluate(
      () =>
        window.commands.filter((c) => c.name === "editorial:confirmFirstWrite")
          .length,
    ),
  ).toBe(0);
  await picture("first-write-source-expired-390");
  await freshApproval.click();
  await page.evaluate(({ long }) => {
    window.bundles[0].approvals.push({
      ...window.bundles[0].approvals[0],
      _id: "approval-source-fresh",
      reviewPin: {
        ...window.bundles[0].approvals[0].reviewPin,
        sourceUntil: long,
      },
    });
    window.update({ bundles: [...window.bundles] });
  }, sourceDeadlines);
  await settle(
    "editorial:approveFirstWrite",
    "resolve",
    "approval-source-fresh",
  );
  await expect(sourceAck).not.toBeChecked();
  await expect(sourceSend).toBeDisabled();
  expect(
    await page.evaluate(
      () =>
        window.commands.filter((c) => c.name === "editorial:confirmFirstWrite")
          .length,
    ),
  ).toBe(0);
  const ordinaryExpiryCases = [];
  for (const enabled of [false, true]) {
    for (const unbounded of [false, true]) {
      await page.goto("http://127.0.0.1:5184/drafts/draft-0");
      const deadlines = await page.evaluate(
        ({ enabled, unbounded }) => {
          const short = Date.now() + 60000,
            stage = unbounded ? null : Date.now() + 900000;
          window.resources.accounts[0].capability.publish = true;
          window.review = {
            ...window.review,
            editorial: enabled,
            brand: enabled,
            editorialDecisionId: enabled ? "decision-editorial" : null,
            brandDecisionId: enabled ? "decision-brand" : null,
            sourceUntil: stage,
          };
          window.bundles[0].review = {
            ...window.review,
            sourceUntil: short,
            stageSourceUntil: stage,
            approvalId: "ordinary-short",
            approvalsLimited: false,
          };
          window.bundles[0].approvals = [
            {
              _id: "ordinary-short",
              workspaceId: "workspace-native",
              draftId: "draft-0",
              versionId: "version-0",
              versionNumber: 1,
              accountId: "account-native",
              actorId: "user-owner",
              createdAt: Date.now(),
              revokedAt: null,
              revokedBy: null,
              purpose: "publishing",
              reviewPin: {
                policyId: "policy-P2",
                decisionIds: enabled
                  ? ["decision-editorial", "decision-brand"]
                  : [],
                sourceUntil: short,
              },
            },
          ];
          if (stage === null)
            delete window.bundles[0].versions[0].sourceProofUntil;
          else window.bundles[0].versions[0].sourceProofUntil = stage;
          window.update({
            resources: { ...window.resources },
            bundles: [...window.bundles],
            review: { ...window.review },
          });
          return { short, stage };
        },
        { enabled, unbounded },
      );
      await expect(
        page.getByRole("button", { name: "v1 freigegeben", exact: true }),
      ).toBeDisabled();
      await page.clock.fastForward(60001);
      const fresh = page.getByRole("button", {
        name: "Version freigeben",
        exact: true,
      });
      await expect(fresh).toBeEnabled();
      await expect(
        page.getByRole("button", { name: "v1 freigegeben", exact: true }),
      ).toHaveCount(0);
      if (enabled)
        await expect(
          page.getByText(/^(Redaktion|Marke): Bestätigt$/),
        ).toHaveCount(2);
      expect(
        await page.evaluate(
          () =>
            window.commands.filter((c) => c.name.startsWith("editorial:"))
              .length,
        ),
      ).toBe(0);
      ordinaryExpiryCases.push({
        enabled,
        unbounded,
        observedCommandNames: await page.evaluate(() =>
          window.commands.map((c) => c.name),
        ),
        oldApprovalCleared: true,
        freshApprovalEnabled: true,
        noAutomaticMutation: true,
        ...deadlines,
      });
      if (enabled && unbounded) await picture("ordinary-approval-expired-390");
    }
    await page.goto("http://127.0.0.1:5184/drafts/draft-0");
    await page.evaluate((enabled) => {
      const short = Date.now() + 60000;
      window.review = {
        ...window.review,
        editorial: enabled,
        brand: enabled,
        editorialDecisionId: enabled ? "decision-editorial" : null,
        brandDecisionId: enabled ? "decision-brand" : null,
        sourceUntil: short,
      };
      window.bundles[0].review = {
        ...window.review,
        stageSourceUntil: short,
        approvalId: null,
        approvalsLimited: false,
      };
      window.bundles[0].versions[0].sourceProofUntil = enabled
        ? Date.now() + 900000
        : short;
      window.update({
        bundles: [...window.bundles],
        review: { ...window.review },
      });
    }, enabled);
    await expect(
      page.getByRole("button", { name: "Version freigeben", exact: true }),
    ).toBeEnabled();
    await page.clock.fastForward(60001);
    await expect(
      page.getByRole("button", { name: "Version freigeben", exact: true }),
    ).toBeDisabled();
    expect(
      await page.evaluate(
        () =>
          window.commands.filter((c) => c.name.startsWith("editorial:")).length,
      ),
    ).toBe(0);
    ordinaryExpiryCases.push({
      enabled,
      observedCommandNames: await page.evaluate(() =>
        window.commands.map((c) => c.name),
      ),
      currentStageExpired: true,
      freshApprovalDisabled: true,
      noAutomaticMutation: true,
    });
    if (enabled) await picture("current-stages-expired-390");
  }
  // TASK68.1 appended controls: native Store + real Composer, exact current target and dirty buffer.
  await page.goto("http://127.0.0.1:5184/drafts/draft-0");
  await page.evaluate(() => {
    const candidate = {
      content: {
        title: "Native candidate",
        text: ["  Candidate original first  ", "Candidate second"],
        media: [],
        accountId: "account-native",
        pillar: "Building in public",
        strategy: "generic",
      },
      contentHash: "native-candidate-hash",
      provenanceHash: "native-provenance",
      routingOperationId: "native-operation",
      commandFingerprint: "native-command",
    };
    window.candidateViews = {
      "native-candidate": {
        versionId: "native-candidate",
        ideaId: "native-idea",
        runId: "native-run",
        applicability: "current",
        sourceUntil: null,
        candidate,
        intent: null,
      },
    };
    window.candidateList = {
      page: [
        {
          idea: {
            _id: "native-idea",
            status: "new",
            currentVersionId: "native-candidate",
          },
          version: { _id: "native-candidate", candidate },
        },
      ],
      isDone: true,
      continueCursor: "",
    };
    window.update({});
  });
  const candidateApply = page.getByRole("button", {
    name: "Kandidat geprüft · neue Arbeitsversion",
  });
  const candidateAck = page.getByRole("checkbox", {
    name: "Angaben, Posts und Medien geprüft · ungeprüfte Arbeitsversion übernehmen.",
  });
  const candidateIntent = page.getByLabel("Absicht der Kandidatenübernahme");
  await expect(candidateApply).toBeDisabled();
  await candidateIntent.fill("Reviewed current opened target only");
  await candidateAck.check();
  await page
    .getByLabel("Text Beitrag 1", { exact: true })
    .fill("Dirty human buffer preserved");
  await expect(candidateApply).toBeDisabled();
  await expect(candidateAck).not.toBeChecked();
  await expect(candidateIntent).toHaveValue("");
  expect(
    await page.evaluate(
      () =>
        window.commands.filter((c) => c.name === "content/ideas:applyCandidate")
          .length,
    ),
  ).toBe(0);
  await page
    .getByLabel("Text Beitrag 1", { exact: true })
    .fill("Native exact content 0");
  await candidateIntent.fill("Reconfirmed clean exact target");
  await candidateAck.check();
  await candidateApply.click();
  const applyCommand = await page.evaluate(
    () =>
      window.pending.find((c) => c.name === "content/ideas:applyCandidate")
        .args,
  );
  expect(applyCommand).toMatchObject({
    versionId: "native-candidate",
    contentHash: "native-candidate-hash",
    target: { draftId: "draft-0", versionId: "version-0", revision: 1 },
    claimsReviewed: true,
  });
  await page.evaluate(() =>
    window.pending
      .find((c) => c.name === "content/ideas:applyCandidate")
      .reject(new Error("lost native application ACK")),
  );
  await page
    .getByRole("button", { name: "Denselben Übernahmeauftrag wiederholen" })
    .click();
  expect(
    await page.evaluate(
      () =>
        window.pending.filter(
          (c) => c.name === "content/ideas:applyCandidate",
        )[1].args,
    ),
  ).toEqual(applyCommand);
  await page.evaluate(() => {
    const b = window.bundles[0],
      old = b.versions[0],
      content = window.candidateViews["native-candidate"].candidate.content;
    const next = {
      ...old,
      _id: "candidate-draft-version",
      number: 2,
      content,
      candidateVersionId: "native-candidate",
    };
    b.draft = { ...b.draft, revision: 2, currentVersionId: next._id };
    b.versions = [next, old];
    b.review = {
      ...window.review,
      approvalId: null,
      editorialDecisionId: null,
      brandDecisionId: null,
    };
    b.approvals = [];
    window.update({ bundles: [...window.bundles] });
    window.pending
      .filter((c) => c.name === "content/ideas:applyCandidate")[1]
      .resolve({
        draftId: "draft-0",
        versionId: next._id,
        ideaVersionId: "native-candidate",
      });
  });
  await expect(page.getByLabel("Text Beitrag 1", { exact: true })).toHaveValue(
    "  Candidate original first  ",
  );
  await expect(page.getByLabel("Text Beitrag 2", { exact: true })).toHaveValue(
    "Candidate second",
  );
  await expect(candidateAck).not.toBeChecked();
  const candidateCaptures = [];
  async function candidatePicture(label) {
    await expect(
      page.getByText("Social-Post-Kandidat · ungeprüft", { exact: true }),
    ).toBeVisible();
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.allSettled(
        document
          .getAnimations()
          .filter(
            (a) =>
              Number.isFinite(a.effect?.getComputedTiming().iterations) &&
              a.playState === "running",
          )
          .map((a) => a.finished),
      );
      await new Promise((r) =>
        requestAnimationFrame(() => requestAnimationFrame(r)),
      );
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const opacity = await page
      .locator("main")
      .evaluate((el) => getComputedStyle(el).opacity);
    expect(opacity).toBe("1");
    const path = `${evidence}/${label}.png`;
    await page.screenshot({ path, fullPage: true, animations: "disabled" });
    candidateCaptures.push({ label, path, opacity, orderedPosts: true });
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await candidatePicture("candidate-composer-1280");
  await page.setViewportSize({ width: 390, height: 844 });
  await candidatePicture("candidate-composer-390");
  await candidateIntent.fill("Pending exact original scope");
  await candidateAck.check();
  await candidateApply.click();
  await page.evaluate(() =>
    window.update({
      session: { ...window.session, session: { id: "session-other" } },
    }),
  );
  await expect(candidateIntent).toHaveCount(0);
  await expect(candidateAck).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Entwurf nicht gefunden", exact: true }),
  ).toBeVisible();
  await page.evaluate(() =>
    window.update({
      session: { ...window.session, session: { id: "session-owner" } },
    }),
  );
  await expect(candidateAck).not.toBeChecked();
  await page.evaluate(() =>
    window.pending
      .filter((c) => c.name === "content/ideas:applyCandidate")[2]
      .resolve({
        draftId: "stale-other",
        versionId: "stale-version",
        ideaVersionId: "native-candidate",
      }),
  );
  await page.evaluate(
    () =>
      new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  await expect(page.getByLabel("Text Beitrag 1", { exact: true })).toHaveValue(
    "  Candidate original first  ",
  );
  await page.evaluate(() => {
    window.candidateViews["native-candidate"].sourceUntil = Date.now() + 1000;
    window.update({});
  });
  await candidateIntent.fill("Source expires without transport refresh");
  await candidateAck.check();
  await page.clock.fastForward(1100);
  await expect(candidateApply).toHaveCount(0);
  await expect(
    page.getByText("Social-Post-Kandidat nicht verfügbar", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        window.commands.filter((c) => c.name === "content/ideas:applyCandidate")
          .length,
    ),
  ).toBe(3);
  // Actual shared Composer consumer, retained original target/buffer/CAS assertions above.
  await page.evaluate(() => {
    window.candidateViews["native-candidate"].sourceUntil = null;
    const reference = {
      contentRequestId: "composer-verification-request",
      candidateVersionId: "native-candidate",
      contentHash: "native-candidate-hash",
      commandFingerprint: "composer-verification-command",
    };
    window.verificationViews = {
      [reference.contentRequestId]: {
        reference,
        applicability: "current",
        sourceUntil: null,
        deadline: Date.now() + 5000,
        state: "finished",
        stickyRisk: null,
        usage: {
          attemptId: "composer-verification-attempt",
          state: "settled",
          heldMicros: 0,
          estimatedMicros: 110,
          currency: "EUR",
        },
        result: {
          candidateVersionId: "native-candidate",
          contentHash: "native-candidate-hash",
          provenanceHash: "native-provenance",
          questionVersion: "jev-output-verification-v1",
          normalizationVersion: "jev-verification-normalization-v1",
          thresholdVersion: "jev-verification-hypotheses-v1",
          model: "synthetic-verifier-1",
          decision: "accept_with_warning",
          reasonKeys: [],
          resultFingerprint: "composer-checked-original",
          criteria: Object.fromEntries(
            [
              "meaningPreserved",
              "intentPreserved",
              "newStrongClaim",
              "unwantedPromotion",
              "toneFits",
              "ctaFits",
              "networkFits",
            ].map((k) => [
              k,
              {
                probability:
                  k === "newStrongClaim" || k === "unwantedPromotion"
                    ? 0.05
                    : 0.95,
                applicability:
                  k === "toneFits" || k === "ctaFits"
                    ? "unspecified"
                    : "specified",
              },
            ]),
          ),
        },
      },
    };
    window.candidateViews["native-candidate"].verification =
      window.verificationViews[reference.contentRequestId];
    window.update({});
  });
  const verifiedAck = page.getByRole("checkbox", {
    name: "Exaktes Prüfergebnis bei der Übernahme vermerken · weiterhin unfreigegeben.",
  });
  await expect(verifiedAck).toBeVisible();
  await verifiedAck.check();
  await expect(candidateAck).not.toBeChecked();
  await candidateIntent.fill(
    "Human confirms exact selected optional result for opened target",
  );
  await candidateAck.check();
  await page
    .getByLabel("Text Beitrag 1", { exact: true })
    .fill("Dirty checked working buffer");
  await expect(verifiedAck).not.toBeChecked();
  await expect(candidateApply).toBeDisabled();
  await page
    .getByLabel("Text Beitrag 1", { exact: true })
    .fill("  Candidate original first  ");
  await verifiedAck.check();
  await candidateIntent.fill("Clean opened target with exact checked receipt");
  await candidateAck.check();
  await candidateApply.click();
  const checkedWhole = await page.evaluate(
    () =>
      window.pending.filter((c) => c.name === "content/ideas:applyCandidate")[3]
        .args,
  );
  expect(checkedWhole).toMatchObject({
    target: {
      draftId: "draft-0",
      versionId: "candidate-draft-version",
      revision: 2,
    },
    verification: {
      reference: {
        contentRequestId: "composer-verification-request",
        candidateVersionId: "native-candidate",
        contentHash: "native-candidate-hash",
        commandFingerprint: "composer-verification-command",
      },
      resultFingerprint: "composer-checked-original",
    },
  });
  await page.evaluate(() =>
    window.pending
      .filter((c) => c.name === "content/ideas:applyCandidate")[3]
      .reject(new Error("checked Composer ACK lost")),
  );
  await page
    .getByRole("button", { name: "Denselben Übernahmeauftrag wiederholen" })
    .click();
  expect(
    await page.evaluate(
      () =>
        window.pending.filter(
          (c) => c.name === "content/ideas:applyCandidate",
        )[4].args,
    ),
  ).toEqual(checkedWhole);
  await page.evaluate(() =>
    window.pending
      .filter((c) => c.name === "content/ideas:applyCandidate")[4]
      .resolve({
        draftId: "draft-0",
        versionId: "candidate-draft-version",
        ideaVersionId: "native-candidate",
      }),
  );
  async function verifierPicture(name, marker) {
    await expect(marker).toBeVisible();
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.allSettled(
        document
          .getAnimations()
          .filter(
            (a) =>
              Number.isFinite(a.effect?.getComputedTiming().iterations) &&
              a.playState === "running",
          )
          .map((a) => a.finished),
      );
      await new Promise((r) =>
        requestAnimationFrame(() => requestAnimationFrame(r)),
      );
    });
    expect(
      await page.locator("main").evaluate((el) => getComputedStyle(el).opacity),
    ).toBe("1");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `${evidence}/${name}.png`,
      fullPage: true,
      animations: "disabled",
    });
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await verifierPicture(
    "verification-composer-1280",
    page.getByText("Prüfung mit Hinweis", { exact: false }),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await verifierPicture(
    "verification-composer-390",
    page.getByText("Prüfung mit Hinweis", { exact: false }),
  );
  await verifiedAck.check();
  await candidateIntent.fill("Original own horizon expires");
  await candidateAck.check();
  await page.evaluate(() => {
    window.verificationViews["composer-verification-request"].sourceUntil =
      Date.now() + 1000;
    window.update({});
  });
  await page.clock.fastForward(1100);
  await expect(verifiedAck).toHaveCount(0);
  await expect(candidateAck).not.toBeChecked();
  await expect(candidateApply).toBeDisabled();
  await expect(
    page.getByText("Social-Post-Kandidat · ungeprüft", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Text Beitrag 1", { exact: true })).toHaveValue(
    "  Candidate original first  ",
  );
  expect(
    await page.evaluate(
      () =>
        window.commands.filter((c) => c.name === "ai/jev/verify:check").length,
    ),
  ).toBe(0);
  // Full App Settings uses truthful availability, unconditional own-purpose withdrawal, exact retry and unmount fences.
  await page.goto("http://127.0.0.1:5184/settings/integrations");
  await page
    .getByLabel("Aktiver Account", { exact: true })
    .selectOption("account-native");
  await expect(
    page.getByText("Kandidatenprüfung benötigt Konfiguration.", {
      exact: true,
    }),
  ).toBeVisible();
  const withdraw = page.getByRole("button", {
    name: "Prüf-Zugang für Account entziehen",
    exact: true,
  });
  await withdraw.click();
  const withdrawArgs = await page.evaluate(
    () => window.pending.find((c) => c.name === "ai/jev/verify:disable").args,
  );
  expect(withdrawArgs).toEqual({
    workspaceId: "workspace-native",
    accountId: "account-native",
  });
  await page.evaluate(() =>
    window.pending
      .find((c) => c.name === "ai/jev/verify:disable")
      .reject(new Error("withdraw ACK uncertain")),
  );
  await page
    .getByRole("button", {
      name: "Denselben Prüf-Entzug wiederholen",
      exact: true,
    })
    .click();
  expect(
    await page.evaluate(
      () =>
        window.pending.filter((c) => c.name === "ai/jev/verify:disable")[1]
          .args,
    ),
  ).toEqual(withdrawArgs);
  await page.evaluate(() =>
    window.pending
      .filter((c) => c.name === "ai/jev/verify:disable")[1]
      .resolve(null),
  );
  await expect(
    page.getByText("Prüf-Zugang für diesen Account ausdrücklich entzogen.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 900 });
  await verifierPicture(
    "verification-settings-1280",
    page.getByText("Kandidatenprüfung benötigt Konfiguration.", {
      exact: true,
    }),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await verifierPicture(
    "verification-settings-390",
    page.getByText("Kandidatenprüfung benötigt Konfiguration.", {
      exact: true,
    }),
  );
  await page.evaluate(() => {
    window.verificationAvailability = { status: "ready" };
    window.update({});
  });
  await expect(
    page.getByText(
      "Kandidatenprüfung ist konfiguriert. Jede Anfrage prüft ihre aktuellen Freigaben.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.evaluate(() => {
    window.snapshot.workspaces[0].role = "Editor";
    window.update({});
  });
  await expect(withdraw).toHaveCount(0);
  await page.evaluate(() => {
    window.snapshot.workspaces[0].role = "Owner";
    window.update({});
  });
  await page
    .getByLabel("Aktiver Account", { exact: true })
    .selectOption("account-native");
  await expect(withdraw).toBeEnabled();
  await withdraw.click();
  await page.getByRole("link", { name: "Mein Profil", exact: true }).click();
  await expect(withdraw).toHaveCount(0);
  await page.evaluate(() =>
    window.pending
      .filter((c) => c.name === "ai/jev/verify:disable")[2]
      .resolve(null),
  );
  await expect(
    page.getByText("Prüf-Zugang für diesen Account ausdrücklich entzogen.", {
      exact: true,
    }),
  ).toHaveCount(0);
  console.log(
    JSON.stringify({
      standaloneVerificationComposerAndSettings: "PASS",
      exactOptionalReferenceAndTargetCAS: true,
      dirtyClearsSelection: true,
      immutableCheckedRetry: true,
      clockOnlyOwnExpiryKeepsGeneration: true,
      defaultOFF: true,
      exactWithdrawRetry: true,
      unmountLateACK: true,
      providerCalls: 0,
    }),
  );
  await page.addInitScript(() => {
    window.demo = new URLSearchParams(location.search).get("demo") === "1";
  });
  await page.goto("http://127.0.0.1:5184/drafts/draft-1?demo=1");
  await expect(
    page.getByLabel("Text Beitrag 1", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Social-Post-Kandidat für diesen Entwurf", { exact: true }),
  ).toHaveCount(0);
  const demoText = "Demo candidate isolation · local human save";
  await page.getByLabel("Text Beitrag 1", { exact: true }).fill(demoText);
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(
    page.getByText("Lokal gespeichert · Version 2", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Text Beitrag 1", { exact: true })).toHaveValue(
    demoText,
  );
  expect(
    await page.evaluate(
      () =>
        window.commands.filter((c) => c.name === "content/ideas:applyCandidate")
          .length,
    ),
  ).toBe(0);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.allSettled(
      document
        .getAnimations()
        .filter(
          (a) =>
            Number.isFinite(a.effect?.getComputedTiming().iterations) &&
            a.playState === "running",
        )
        .map((a) => a.finished),
    );
    await new Promise((r) =>
      requestAnimationFrame(() => requestAnimationFrame(r)),
    );
  });
  await page.screenshot({
    path: `${evidence}/candidate-demo-composer-1280.png`,
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `${evidence}/candidate-demo-composer-390.png`,
    fullPage: true,
    animations: "disabled",
  });
  await expect(page.getByLabel("Text Beitrag 1", { exact: true })).toHaveCount(
    1,
  );
  await expect(page.getByLabel("Text Beitrag 1", { exact: true })).toHaveValue(
    demoText,
  );
  await page
    .getByLabel("Text Beitrag 1", { exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: `${evidence}/verification-demo-composer-390-viewport.png`,
    fullPage: false,
    animations: "disabled",
  });
  expect(
    await page.evaluate(
      () =>
        window.commands.filter(
          (c) =>
            c.name.startsWith("ai/jev/verify:") ||
            c.name === "content/ideas:applyCandidate",
        ).length,
    ),
  ).toBe(0);
  console.log(
    JSON.stringify({
      candidateConsumer: "PASS",
      candidateCaptures,
      dirtyBufferPreserved: true,
      wholeArgsRetry: true,
      currentTargetCAS: true,
      sessionABA: true,
      clockOnlyExpiry: true,
      automaticApprovalOrPublish: false,
    }),
  );
  expect(provider).toEqual([]);
  expect(errors).toEqual([]);
  console.log(
    JSON.stringify({
      result: "PASS",
      routes: [
        "/team",
        "/drafts/draft-0",
        "/drafts",
        "AppShell drawer",
        "/calendar",
        "/plans",
        "/team/invitations/:id",
      ],
      viewportWidths: [1280, 390],
      screenshots: evidence,
      stableCaptures: captures,
      ordinaryExpiryCases,
      selectedSourceExpiryAssertions: {
        originalClockOnlyExpiry: true,
        confirmAndAcknowledgementRemoved: true,
        noConfirmMutation: true,
        freshApprovalNeedsNewAcknowledgement: true,
      },
      sourceHoleAssertions: {
        calendarLink: {
          name: "Quelle nicht verfügbar",
          href: "/drafts/draft-2",
        },
        draftListStatus: "Quelle nicht verfügbar",
        blankDraftPlaceholderAbsentForUnavailable: true,
        protectedTitleAbsentOnCalendarAndDraftList: true,
      },
      providerCalls: provider.length,
      consoleErrors: errors.length,
      limits:
        "Synthetic auth/transport mechanics; public J10 native semantics are separately registered, actual screenreader/manual onboarding unproved.",
    }),
  );
} finally {
  await browser?.close();
  await server.close();
}
