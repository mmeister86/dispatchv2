import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex, crossDomain } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth/minimal";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import authConfig from "./auth.config";
import { query } from "./_generated/server";
import { v } from "convex/values";

export const authComponent = createClient<DataModel>(components.betterAuth);
export function authOrigins(siteUrl: string) {
  const url = new URL(siteUrl);
  const origins = [url.origin];
  if (["localhost", "127.0.0.1"].includes(url.hostname)) {
    url.hostname = url.hostname === "localhost" ? "127.0.0.1" : "localhost";
    origins.push(url.origin);
  }
  return origins;
}
async function sendEmail(to: string, subject: string, url: string) {
  if (!process.env.RESEND_API_KEY)
    throw new Error("Auth email delivery is not configured");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.AUTH_EMAIL_FROM ?? "Dispatch <onboarding@resend.dev>",
      to: [to],
      subject,
      text: `${subject}\n\n${url}\n\nFalls du dies nicht angefordert hast, ignoriere diese E-Mail.`,
    }),
  });
  if (!response.ok)
    throw new Error(`Auth email delivery failed (${response.status})`);
}
export const createAuth = (ctx: GenericCtx<DataModel>) => {
  const siteUrl = process.env.SITE_URL;
  if (!siteUrl || !process.env.BETTER_AUTH_SECRET)
    throw new Error(
      "SITE_URL and BETTER_AUTH_SECRET must be configured on the Convex deployment",
    );
  return betterAuth({
    baseURL: process.env.CONVEX_SITE_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    database: authComponent.adapter(ctx),
    trustedOrigins: authOrigins(siteUrl),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: 8,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await sendEmail(user.email, "Dispatch: Passwort zurücksetzen", url);
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        await sendEmail(user.email, "Dispatch: E-Mail bestätigen", url);
      },
    },
    socialProviders:
      process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
        ? {
            github: {
              clientId: process.env.GITHUB_CLIENT_ID,
              clientSecret: process.env.GITHUB_CLIENT_SECRET,
              scope: ["read:user", "user:email"],
            },
          }
        : {},
    plugins: [convex({ authConfig }), crossDomain({ siteUrl })],
  });
};
export const capabilities = query({
  args: {},
  returns: v.object({
    githubLogin: v.boolean(),
    emailDelivery: v.boolean(),
    restrictedSender: v.boolean(),
  }),
  handler: () => ({
    githubLogin: !!(
      process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
    ),
    emailDelivery: !!process.env.RESEND_API_KEY,
    restrictedSender: !process.env.AUTH_EMAIL_FROM,
  }),
});

export const session = query({
  args: {},
  returns: v.object({ id: v.string(), emailVerified: v.boolean() }),
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx);
    return { id: user._id, emailVerified: user.emailVerified };
  },
});
