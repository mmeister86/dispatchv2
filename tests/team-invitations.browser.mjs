import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";
import { existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url)).replace(/\/$/, "");
const mocks = {
  "convex/react": `import React from 'react';import {ConvexError} from 'convex/values';window.TeamConvexError=ConvexError;import {getFunctionName} from '/node_modules/convex/dist/esm/server/index.js';
const tick=()=>React.useSyncExternalStore(cb=>{window.listeners.add(cb);return()=>window.listeners.delete(cb)},()=>window.tick);
const commands=new Map();const invoke=ref=>{const name=getFunctionName(ref);if(!commands.has(name))commands.set(name,async args=>{window.commands.push({name,args});if(name==='users:bootstrap')return 'user';return new Promise((resolve,reject)=>window.pending.push({name,args,resolve,reject}));});return commands.get(name)};
export const useMutation=invoke;export const useAction=invoke;
export const useConvexAuth=()=>{tick();return {isAuthenticated:window.authenticated,isLoading:false}};
export const useQuery=(ref,args)=>{tick();const name=getFunctionName(ref);if(args==='skip')return undefined;window.reads.push({name,args});if(name==='users:current')return window.snapshot;if(name==='team:list')return window.roster;if(name==='team:preview')return window.preview;if(name==='auth:capabilities')return {emailDelivery:true,githubLogin:false,restrictedSender:false};if(name==='editorial:resources')return {accounts:[],assets:[],events:[],members:[],notifications:[],resourcesLimited:false};return undefined;};
export const usePaginatedQuery=()=>({results:[],status:'Exhausted',loadMore:()=>{}});`,
  "@/lib/auth-client": `import React from 'react';export const demoMode=window.demo;export const backendConfigured=true;export const convexClientInstance=null;export const ConvexBetterAuthProvider=({children})=>children;export const AuthBoundary=({children})=>children;
export {authPath,returnPath} from '/src/lib/navigation.ts';const submit=async(kind,args)=>{window.authRequests.push({kind,args});return await fetch('/__auth/'+kind,{method:'POST',body:JSON.stringify(args)}).then(r=>r.json())};
export const authClient={useSession:()=>{React.useSyncExternalStore(cb=>{window.listeners.add(cb);return()=>window.listeners.delete(cb)},()=>window.tick);return {data:window.session,isPending:false}},signIn:{email:args=>submit('login',args)},signUp:{email:args=>submit('signup',args)},sendVerificationEmail:args=>submit('verify',args),requestPasswordReset:args=>submit('reset',args),resetPassword:args=>submit('reset-password',args),signOut:async()=>{}};`,
};
const server = await createServer({
  root,
  cacheDir: "/tmp/dispatch-49.2-team-vite",
  configFile: `${root}/vite.config.ts`,
  define: {
    "import.meta.env.VITE_SITE_URL": JSON.stringify("http://127.0.0.1:5183"),
  },
  server: { host: "127.0.0.1", port: 5183, strictPort: true },
  plugins: [
    {
      name: "team-full-app-intercepts",
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
  });
  const errors = [],
    http = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/__auth/**", async (route) => {
    http.push(route.request().url());
    await route.fulfill({ json: { data: {}, error: null } });
  });
  await page.route("https://api.resend.com/**", (route) => {
    throw new Error("Browser must never send provider mail");
  });
  await page.addInitScript(() => {
    window.tick = 0;
    window.listeners = new Set();
    window.commands = [];
    window.pending = [];
    window.reads = [];
    window.authRequests = [];
    window.demo = false;
    window.authenticated = true;
    window.session = {
      user: {
        id: "auth-owner",
        email: "owner@example.test",
        emailVerified: true,
      },
      session: { id: "session-owner" },
    };
    window.update = (patch) => {
      Object.assign(window, patch);
      window.tick++;
      window.listeners.forEach((fn) => fn());
    };
    window.profile = {
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
      preferences: window.profile,
      repairWorkspaceId: null,
    };
    window.roster = {
      authId: "auth-owner",
      sessionId: "session-owner",
      workspaceId: "workspace-native",
      actorRole: "Owner",
      revision: 4,
      members: [
        {
          membershipId: "member-owner",
          userId: "user-owner",
          name: "Native Owner",
          role: "Owner",
        },
        {
          membershipId: "member-viewer",
          userId: "user-viewer",
          name: "Native Viewer",
          role: "Viewer",
        },
      ],
      invitations: [
        {
          id: "invitation-native",
          email: "recipient@example.test",
          role: "Viewer",
          status: "pending",
          expiresAt: Date.now() + 60000,
          delivery: { status: "notRequested", providerId: null },
          canSend: true,
          deliveryCommandKey: null,
          deliveryRetryUntil: null,
          deliveryPendingUntil: null,
        },
      ],
      invitationsLimited: false,
    };
    const retainedMail = localStorage.getItem("fixture-mail");
    if (retainedMail) window.roster.invitations = [JSON.parse(retainedMail)];
    window.preview = {
      authId: "auth-owner",
      sessionId: "session-owner",
      invitationId: "invitation-native",
      workspaceId: "workspace-native",
      workspaceName: "Native workspace",
      role: "Viewer",
      expiresAt: Date.now() + 60000,
      revision: 4,
      status: "pending",
    };
  });
  const only = process.env.TEST_TEAM_CASE;
  if (!only || only === "team") {
    await page.goto("http://127.0.0.1:5183/team");
    await expect(
      page.getByRole("heading", { name: "Workspace-Team", exact: true }),
    ).toBeVisible();
    await expect(
      page.locator("strong").filter({ hasText: "Native Viewer" }),
    ).toBeVisible();
    expect(
      await page.evaluate(() =>
        localStorage.getItem("dispatch-local-team-members"),
      ),
    ).toBeNull();
  }
  if (!only || only === "invitation") {
    await page.goto("http://127.0.0.1:5183/team/invitations/invitation-native");
    await expect(
      page.getByRole("heading", { name: "Deine Einladung", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Native workspace", { exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(() =>
        window.commands.some((c) => c.name === "users:bootstrap"),
      ),
    ).toBe(false);
    expect(
      await page.evaluate(() =>
        window.reads.some((c) => c.name === "users:current"),
      ),
    ).toBe(false);
  }

  if (!only || only === "unverified-return") {
    const destination = "/team/invitations/invitation-native?from=email#join";
    await page.goto("http://127.0.0.1:5183" + destination);
    await page.evaluate(() =>
      window.update({
        session: {
          ...window.session,
          user: { ...window.session.user, emailVerified: false },
        },
      }),
    );
    const href = await page
      .getByRole("link", { name: "E-Mail-Adresse bestätigen" })
      .getAttribute("href");
    expect(
      new URL(href, "http://127.0.0.1:5183").searchParams.get("returnTo"),
    ).toBe(destination);
  }
  if (!only || only === "mail-deadline") {
    await page.goto("http://127.0.0.1:5183/team");
    await page.evaluate(() =>
      window.update({
        roster: {
          ...window.roster,
          invitations: [
            {
              ...window.roster.invitations[0],
              delivery: { status: "unknown", providerId: null },
              deliveryCommandKey: "original-native-mail-key",
              deliveryRetryUntil: Date.now() + 60000,
            },
          ],
        },
      }),
    );
    await page.getByRole("button", { name: "Mail anfordern" }).click();
    await page.evaluate(() =>
      window.pending[0].resolve({ status: "unknown", providerId: null }),
    );
    await page.evaluate(() =>
      window.update({
        roster: {
          ...window.roster,
          invitations: [
            {
              ...window.roster.invitations[0],
              deliveryRetryUntil: Date.now() + 120,
            },
          ],
        },
      }),
    );
    await expect(
      page.getByRole("button", { name: "Mail anfordern" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Denselben Auftrag wiederholen" }),
    ).toBeDisabled();
  }
  if (!only || only === "proof-loss") {
    await page.goto("http://127.0.0.1:5183/team/invitations/invitation-native");
    await page.getByRole("button", { name: "Einladung annehmen" }).click();
    await page.evaluate(() => {
      window.savedPreview = window.preview;
      window.update({ preview: null });
    });
    await expect(
      page.getByRole("heading", { name: "Einladung nicht verfügbar" }),
    ).toBeVisible();
    await page.evaluate(() => window.update({ preview: window.savedPreview }));
    await expect(
      page.getByRole("button", { name: "Einladung annehmen" }),
    ).toBeEnabled();
    await page.getByRole("button", { name: "Einladung annehmen" }).click();
    await page.evaluate(() =>
      window.pending[0].resolve({ disposition: "joined" }),
    );
    await expect(
      page.getByRole("button", { name: "Wird angenommen …" }),
    ).toBeDisabled();
    expect(
      await page.evaluate(() =>
        window.commands.filter((c) => c.name === "workspaces:select"),
      ),
    ).toEqual([]);
  }
  if (!only || only === "cas-scope") {
    await page.goto("http://127.0.0.1:5183/team");
    await page
      .getByLabel("E-Mail-Adresse", { exact: true })
      .fill("cas@example.test");
    await page
      .getByRole("button", { name: "Einladung erstellen", exact: true })
      .click();
    const original = await page.evaluate(() => window.pending[0].args);
    await page.evaluate(() => {
      window.update({ roster: { ...window.roster, revision: 10 } });
      window.pending[0].reject(
        new window.TeamConvexError("TEAM_REVISION_CONFLICT"),
      );
    });
    await expect(page.getByRole("alert")).toContainText(
      "Das Team wurde geändert",
    );
    await expect(
      page.getByRole("button", { name: "Denselben Auftrag wiederholen" }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Aktuellen Stand prüfen" }).click();
    await page
      .getByRole("button", { name: "Einladung erstellen", exact: true })
      .click();
    const reviewed = await page.evaluate(() => window.pending[1].args);
    expect(reviewed.commandKey).not.toBe(original.commandKey);
    expect(reviewed.expectedRevision).toBe(10);
    await page.goto("http://127.0.0.1:5183/team");
    await page
      .getByLabel("E-Mail-Adresse", { exact: true })
      .fill("old-workspace@example.test");
    await page
      .getByRole("button", { name: "Einladung erstellen", exact: true })
      .click();
    await page.evaluate(() =>
      window.update({
        snapshot: {
          ...window.snapshot,
          activeWorkspaceId: "workspace-beta",
          workspaces: [
            {
              id: "workspace-beta",
              name: "Beta",
              description: "",
              role: "Owner",
            },
          ],
        },
      }),
    );
    await expect(
      page.getByText("recipient@example.test", { exact: true }),
    ).toHaveCount(0);
    await page.evaluate(() =>
      window.update({
        roster: {
          ...window.roster,
          workspaceId: "workspace-beta",
          invitations: [],
        },
      }),
    );
    await expect(
      page.getByRole("heading", { name: "Workspace-Team", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByLabel("E-Mail-Adresse", { exact: true }),
    ).toHaveValue("");
    await page
      .getByLabel("E-Mail-Adresse", { exact: true })
      .fill("current-workspace@example.test");
    await page
      .getByRole("button", { name: "Einladung erstellen", exact: true })
      .click();
    await page.evaluate(() =>
      window.pending[0].resolve({ disposition: "issued" }),
    );
    await expect(
      page.getByRole("button", { name: "Einladung erstellen", exact: true }),
    ).toBeDisabled();
    expect(await page.evaluate(() => window.pending[1].args.workspaceId)).toBe(
      "workspace-beta",
    );
    await page.goto("http://127.0.0.1:5183/team");
    await page.evaluate(() =>
      window.update({
        snapshot: {
          ...window.snapshot,
          workspaces: [{ ...window.snapshot.workspaces[0], role: "Admin" }],
        },
        roster: {
          ...window.roster,
          actorRole: "Admin",
          members: [
            { ...window.roster.members[0], role: "Admin" },
            window.roster.members[1],
            {
              membershipId: "other-owner",
              userId: "other-user",
              role: "Owner",
              name: "Other Owner",
            },
          ],
        },
      }),
    );
    await expect(
      page.getByRole("heading", { name: "Workspace-Team", exact: true }),
    ).toBeVisible();
    expect(
      await page
        .getByLabel("Rolle für Native Viewer")
        .locator("option")
        .allTextContents(),
    ).not.toContain("Owner");
    await expect(page.getByLabel("Rolle für Other Owner")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /Owner übertragen/ }),
    ).toHaveCount(0);
  }
  if (!only) {
    const screenshots =
      process.env.TEAM_SCREENSHOT_DIR ?? "/tmp/dispatch-49.2-team-pixels";
    mkdirSync(screenshots, { recursive: true });
    await page.goto("http://127.0.0.1:5183/team");
    await expect(
      page.getByRole("heading", { name: "Workspace-Team", exact: true }),
    ).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.locator("h1").evaluate((h) => getComputedStyle(h).fontFamily),
    ).toContain("Manrope");
    await page.screenshot({
      path: screenshots + "/team-desktop.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: screenshots + "/team-390.png",
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page
      .getByLabel("E-Mail-Adresse", { exact: true })
      .fill("first@example.test");
    await page
      .getByRole("button", { name: "Einladung erstellen", exact: true })
      .focus();
    await page.keyboard.press("Enter");
    await expect.poll(() => page.evaluate(() => window.pending.length)).toBe(1);
    const original = await page.evaluate(() => window.pending[0].args);
    await page
      .getByLabel("E-Mail-Adresse", { exact: true })
      .fill("dirty@example.test");
    await page.evaluate(() => {
      window.update({ roster: { ...window.roster, revision: 9 } });
      window.pending[0].reject(new Error("lost response"));
    });
    await page
      .getByRole("button", { name: "Denselben Auftrag wiederholen" })
      .click();
    expect(await page.evaluate(() => window.pending[1].args)).toEqual(original);
    await page.evaluate(() =>
      window.pending[1].resolve({
        disposition: "issued",
        invitationId: "new-invite",
        revision: 5,
      }),
    );
    await expect(page.getByRole("status")).toContainText("Einladung erstellt");
    // Session/role/workspace/unmount invalidate old operations; their completions never release a new one.
    await page
      .getByRole("button", { name: "Einladung erstellen", exact: true })
      .click();
    await page.evaluate(() => {
      window.update({
        snapshot: {
          ...window.snapshot,
          workspaces: [{ ...window.snapshot.workspaces[0], role: "Viewer" }],
        },
      });
    });
    await expect(
      page.getByRole("button", { name: "Einladung erstellen", exact: true }),
    ).toHaveCount(0);
    await page.evaluate(() =>
      window.pending[2].resolve({ disposition: "issued", revision: 10 }),
    );
    await expect(
      page.getByText("Einladung erstellt.", { exact: false }),
    ).toHaveCount(0);

    await page.evaluate(() =>
      window.update({ roster: { ...window.roster, actorRole: "Viewer" } }),
    );
    await expect(
      page.getByRole("heading", { name: "Workspace-Team", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Einladungen verwalten Owner und Admins."),
    ).toBeVisible();
    await page.goto("http://127.0.0.1:5183/team");
    await expect(
      page.getByRole("heading", { name: "Workspace-Team", exact: true }),
    ).toBeVisible();
    await page.evaluate(() =>
      window.update({
        session: { ...window.session, session: { id: "session-replaced" } },
      }),
    );
    await expect(
      page.getByText("recipient@example.test", { exact: true }),
    ).toHaveCount(0);
    await page.evaluate(() =>
      window.update({
        roster: { ...window.roster, sessionId: "session-replaced" },
      }),
    );
    await expect(
      page.getByText("recipient@example.test", { exact: true }),
    ).toBeVisible();
    // A remounted current creator uses the server's original mail key; elapsed deadlines disable passive retries.
    await page.evaluate(() =>
      window.update({
        roster: {
          ...window.roster,
          invitations: [
            {
              ...window.roster.invitations[0],
              delivery: { status: "unknown", providerId: null },
              deliveryCommandKey: "original-native-mail-key",
              deliveryRetryUntil: Date.now() + 60000,
            },
          ],
        },
      }),
    );
    await page.getByRole("button", { name: "Mail anfordern" }).click();
    expect(await page.evaluate(() => window.pending[0].args)).toEqual({
      invitationId: "invitation-native",
      commandKey: "original-native-mail-key",
    });
    await page.evaluate(() =>
      window.pending[0].resolve({ status: "unknown", providerId: null }),
    );
    await page.evaluate(() =>
      localStorage.setItem(
        "fixture-mail",
        JSON.stringify(window.roster.invitations[0]),
      ),
    );
    // Reload really unmounts the route. The SDK fixture replays the unchanged durable native response.
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Workspace-Team", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Mail anfordern" }).click();
    expect(await page.evaluate(() => window.pending[0].args)).toEqual({
      invitationId: "invitation-native",
      commandKey: "original-native-mail-key",
    });
    await page.evaluate(() => {
      window.pending[0].resolve({ status: "unknown", providerId: null });
      localStorage.removeItem("fixture-mail");
    });
    await page.evaluate(() =>
      window.update({
        roster: {
          ...window.roster,
          invitations: [
            {
              ...window.roster.invitations[0],
              deliveryRetryUntil: Date.now() + 120,
            },
          ],
        },
      }),
    );
    await expect(
      page.getByRole("button", { name: "Mail anfordern" }),
    ).toHaveCount(0);
    await page.evaluate(() =>
      window.update({
        roster: {
          ...window.roster,
          invitations: [
            { ...window.roster.invitations[0], expiresAt: Date.now() + 120 },
          ],
        },
      }),
    );
    await expect(
      page.getByText("recipient@example.test", { exact: true }),
    ).toHaveCount(0);
    // Auth-only invitation does not bootstrap or read a recovery workspace.
    await page.goto("http://127.0.0.1:5183/team/invitations/invitation-native");
    await page.evaluate(() =>
      window.update({
        snapshot: {
          state: "recovery",
          authId: "auth-owner",
          activeWorkspaceId: null,
          preferences: null,
          workspaces: [],
          repairWorkspaceId: null,
        },
      }),
    );
    await expect(
      page.getByRole("heading", { name: "Deine Einladung", exact: true }),
    ).toBeVisible();
    expect(await page.evaluate(() => window.commands)).toEqual([]);
    expect(
      await page.evaluate(() =>
        window.reads.some((x) => x.name === "users:current"),
      ),
    ).toBe(false);
    await page.screenshot({
      path: screenshots + "/invitation-390.png",
      fullPage: true,
    });
    // A cached preview from another actor OR the same actor's former session is hidden before projection.
    await page.evaluate(() =>
      window.update({
        session: {
          user: {
            id: "auth-beta",
            email: "beta@example.test",
            emailVerified: true,
          },
          session: { id: "session-beta" },
        },
      }),
    );
    await expect(
      page.getByText("Native workspace", { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Einladung annehmen" }),
    ).toHaveCount(0);
    await page.evaluate(() =>
      window.update({
        preview: {
          ...window.preview,
          authId: "auth-beta",
          sessionId: "session-beta",
        },
      }),
    );
    await expect(
      page.getByRole("button", { name: "Einladung annehmen" }),
    ).toBeVisible();
    await page.evaluate(() =>
      window.update({
        session: { ...window.session, session: { id: "session-beta-new" } },
      }),
    );
    await expect(
      page.getByText("Native workspace", { exact: true }),
    ).toHaveCount(0);
    await page.evaluate(() =>
      window.update({
        preview: { ...window.preview, sessionId: "session-beta-new" },
      }),
    );
    await page.getByRole("button", { name: "Einladung annehmen" }).click();
    // A→B→A: the obsolete original completion cannot select or unlock the new accept.
    await page.evaluate(() =>
      window.update({
        session: {
          user: {
            id: "auth-other",
            email: "other@example.test",
            emailVerified: true,
          },
          session: { id: "session-other" },
        },
        preview: null,
      }),
    );
    await expect(
      page.getByRole("heading", { name: "Einladung nicht verfügbar" }),
    ).toBeVisible();
    await page.evaluate(() =>
      window.update({
        session: {
          user: {
            id: "auth-beta",
            email: "beta@example.test",
            emailVerified: true,
          },
          session: { id: "session-beta-new" },
        },
        preview: {
          authId: "auth-beta",
          sessionId: "session-beta-new",
          invitationId: "invitation-native",
          workspaceId: "workspace-native",
          workspaceName: "Native workspace",
          role: "Viewer",
          revision: 4,
          status: "pending",
          expiresAt: Date.now() + 60000,
        },
      }),
    );
    await page.getByRole("button", { name: "Einladung annehmen" }).click();
    await page.evaluate(() =>
      window.pending[0].resolve({ disposition: "joined" }),
    );
    await expect(
      page.getByRole("button", { name: "Wird angenommen …" }),
    ).toBeDisabled();
    expect(
      await page.evaluate(() =>
        window.commands.filter((x) => x.name === "workspaces:select"),
      ),
    ).toEqual([]);
    await page.evaluate(() =>
      window.pending[1].resolve({ disposition: "joined" }),
    );
    await expect.poll(() => page.evaluate(() => window.pending.length)).toBe(3);
    expect(await page.evaluate(() => window.pending[2].args)).toEqual({
      workspaceId: "workspace-native",
    });
    await page.evaluate(() =>
      window.pending[2].reject(new Error("selection unavailable")),
    );
    await expect(page.getByRole("status")).toContainText("Du bist Mitglied");
    await expect(page.getByRole("alert")).toContainText(
      "Workspace-Auswahl ist fehlgeschlagen",
    );
    await page.getByRole("button", { name: "Workspace öffnen" }).click();
    expect(
      await page.evaluate(
        () => window.commands.filter((c) => c.name === "team:accept").length,
      ),
    ).toBe(2);
    expect(await page.evaluate(() => window.pending[3].name)).toBe(
      "workspaces:select",
    );
    // Late selection from an obsolete same-user session cannot navigate or unlock the new operation.
    await page.evaluate(() =>
      window.update({
        session: { ...window.session, session: { id: "session-beta-newer" } },
        preview: {
          ...window.preview,
          sessionId: "session-beta-newer",
          status: "accepted",
          role: null,
        },
      }),
    );
    await page.getByRole("button", { name: "Workspace öffnen" }).click();
    await page.evaluate(() => window.pending[3].resolve(null));
    await expect(page).toHaveURL(/\/team\/invitations\//);
    await expect(
      page.getByRole("button", { name: "Workspace öffnen" }),
    ).toBeDisabled();
    await page.evaluate(() => {
      window.update({
        snapshot: {
          state: "ready",
          authId: window.session.user.id,
          userId: "user-viewer",
          activeWorkspaceId: "workspace-native",
          workspaces: [
            {
              id: "workspace-native",
              name: "Native workspace",
              description: "",
              role: "Viewer",
            },
          ],
          preferences: window.profile,
          repairWorkspaceId: null,
        },
      });
      window.pending[4].resolve(null);
    });
    await expect(page).toHaveURL(/\/overview$/);
    expect(
      await page.evaluate(() =>
        window.commands.filter((c) => c.name === "preferences:save"),
      ),
    ).toEqual([]);
    await page.evaluate(() =>
      window.history.pushState(null, "", "/onboarding"),
    );
    // Reload restores the fixture's ready state; set Viewer after the real route has mounted.
    await page.goto("http://127.0.0.1:5183/onboarding");
    await page.evaluate(() =>
      window.update({
        snapshot: {
          ...window.snapshot,
          workspaces: [{ ...window.snapshot.workspaces[0], role: "Viewer" }],
        },
      }),
    );
    await expect(
      page.getByRole("heading", { name: "Dein Workspace ist bereit" }),
    ).toBeVisible();
    await page.screenshot({
      path: screenshots + "/viewer-entry-390.png",
      fullPage: true,
    });
    await page
      .getByRole("link", { name: "Zum Workspace", exact: true })
      .click();
    await expect(page).toHaveURL(/\/overview$/);
    expect(
      await page.evaluate(() =>
        window.commands.filter((c) => c.name === "preferences:save"),
      ),
    ).toEqual([]);
    // Unknown accept preserves its full original args across a reactive revision change.
    await page.goto("http://127.0.0.1:5183/team/invitations/invitation-native");
    await page.getByRole("button", { name: "Einladung annehmen" }).click();
    const acceptOriginal = await page.evaluate(() => window.pending[0].args);
    await page.evaluate(() => {
      window.update({ preview: { ...window.preview, revision: 18 } });
      window.pending[0].reject(new Error("network unknown"));
    });
    await page
      .getByRole("button", { name: "Denselben Auftrag wiederholen" })
      .click();
    expect(await page.evaluate(() => window.pending[1].args)).toEqual(
      acceptOriginal,
    );

    // Old error after an actor change does not overwrite or release the new pending accept.
    await page.goto("http://127.0.0.1:5183/team/invitations/invitation-native");
    await page.getByRole("button", { name: "Einladung annehmen" }).click();
    await page.evaluate(() =>
      window.update({
        session: {
          user: {
            id: "auth-new",
            email: "new@example.test",
            emailVerified: true,
          },
          session: { id: "session-new" },
        },
        preview: {
          ...window.preview,
          authId: "auth-new",
          sessionId: "session-new",
        },
      }),
    );
    await page.getByRole("button", { name: "Einladung annehmen" }).click();
    await page.evaluate(() =>
      window.pending[0].reject(new Error("obsolete error")),
    );
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Wird angenommen …" }),
    ).toBeDisabled();
    // Proof expiry masks cached metadata/actions without query updates.
    await page.evaluate(() =>
      window.update({
        preview: { ...window.preview, expiresAt: Date.now() + 120 },
      }),
    );
    await expect(
      page.getByRole("heading", { name: "Einladung nicht verfügbar" }),
    ).toBeVisible();
    await expect(
      page.getByText("Native workspace", { exact: true }),
    ).toHaveCount(0);
    await page.evaluate(() =>
      window.pending[1].resolve({ disposition: "joined" }),
    );
    expect(
      await page.evaluate(() =>
        window.commands.filter((c) => c.name === "workspaces:select"),
      ),
    ).toEqual([]);
    // Unverified and unknown responses remain generic, and preview is never requested by an unverified session.
    await page.goto("http://127.0.0.1:5183/team/invitations/invitation-native");
    await page.evaluate(() => {
      window.reads = [];
      window.update({
        session: {
          ...window.session,
          user: { ...window.session.user, emailVerified: false },
        },
      });
    });
    await expect(
      page.getByRole("link", { name: "E-Mail-Adresse bestätigen" }),
    ).toBeVisible();
    await expect(
      page.getByText("Native workspace", { exact: true }),
    ).toHaveCount(0);
    expect(
      await page.evaluate(() =>
        window.reads.filter((c) => c.name === "team:preview"),
      ),
    ).toEqual([]);
    // Real login/signup/verify routes retain the safe exact invitation destination; all auth HTTP is intercepted.
    const destination = "/team/invitations/invitation-native?from=email#join";
    await page.goto(
      "http://127.0.0.1:5183/team/invitations/invitation-native?from=email#join",
    );
    await page.evaluate(() => window.update({ authenticated: false }));
    await expect(page).toHaveURL(/\/login\?returnTo=/);
    expect(new URL(page.url()).searchParams.get("returnTo")).toBe(destination);
    await page.goto(
      "http://127.0.0.1:5183/signup?returnTo=" +
        encodeURIComponent(destination),
    );
    await expect(
      page.getByLabel("E-Mail", { exact: false }).first(),
    ).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: screenshots + "/auth-390.png",
      fullPage: true,
    });
    await page
      .getByLabel("E-Mail", { exact: false })
      .first()
      .fill("signup@example.test");
    await page
      .getByLabel("Passwort", { exact: false })
      .first()
      .fill("fixture-password-123");
    await page.getByRole("checkbox").check();
    await page
      .locator("form")
      .getByRole("button", { name: /Konto anlegen/ })
      .click();
    await expect(page).toHaveURL(/\/verify\?returnTo=/);
    expect(new URL(page.url()).searchParams.get("returnTo")).toBe(destination);
    const signup = await page.evaluate(() => window.authRequests[0]);
    expect(signup.args.callbackURL).toBe("http://127.0.0.1:5183" + destination);
    await page
      .getByLabel("E-Mail", { exact: false })
      .first()
      .fill("signup@example.test");
    await page
      .locator("form")
      .getByRole("button", { name: /Bestätigungslink|Bestätigung|E-Mail/ })
      .click();
    await expect.poll(() => http.length).toBeGreaterThanOrEqual(2);
    expect(
      await page.evaluate(() => window.authRequests.at(-1).args.callbackURL),
    ).toBe("http://127.0.0.1:5183" + destination);
    await page.goto(
      "http://127.0.0.1:5183/login?returnTo=" + encodeURIComponent(destination),
    );
    await page
      .getByLabel("E-Mail", { exact: false })
      .first()
      .fill("signup@example.test");
    await page
      .getByLabel("Passwort", { exact: false })
      .first()
      .fill("fixture-password-123");
    await page
      .locator("form")
      .getByRole("button", { name: /Anmelden/ })
      .click();
    await expect(page).toHaveURL("http://127.0.0.1:5183" + destination);
    await page.goto(
      "http://127.0.0.1:5183/signup?returnTo=" +
        encodeURIComponent("//evil.example/path"),
    );
    expect(
      await page
        .locator('a[href*="returnTo"]')
        .evaluateAll((links) =>
          links.every((link) => !link.getAttribute("href").includes("evil")),
        ),
    ).toBe(true);
    // Fresh Demo page mounts the original local Team and never executes native team functions.
    const demo = await browser.newPage({
      viewport: { width: 390, height: 844 },
    });
    await demo.addInitScript(() => {
      window.demo = true;
      window.listeners = new Set();
      window.tick = 0;
      window.commands = [];
      window.pending = [];
      window.reads = [];
    });
    await demo.goto("http://127.0.0.1:5183/team");
    await expect(
      demo.getByText("lea@example.com", { exact: true }),
    ).toBeVisible();
    await demo.screenshot({
      path: screenshots + "/team-demo-390.png",
      fullPage: true,
    });
    expect(
      await demo.evaluate(() =>
        window.commands.filter((c) => c.name.startsWith("team:")),
      ),
    ).toEqual([]);
    expect(
      await demo.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await demo.close();
  }
  expect(errors).toEqual([]);
  console.log(
    "PASS actual full App routes, SDK/auth HTTP intercepted; production CSS/fonts.",
  );
} finally {
  await browser?.close();
  await server.close();
}
