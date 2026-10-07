import { vi } from "vitest";
import { convexTest } from "convex-test";
import betterAuthComponent from "@convex-dev/better-auth/test";
import schema from "../convex/schema";
import { api, internal, components } from "../convex/_generated/api";
const modules = import.meta.glob("../convex/**/*.ts");
export async function mediaFixture() {
  vi.stubEnv(
    "CLOUDFLARE_ACCOUNT_ID",
    process.env.CLOUDFLARE_ACCOUNT_ID ?? "0".repeat(32),
  );
  const t = convexTest(schema, modules);
  betterAuthComponent.register(t);
  const identity = await t.run(async (ctx) => {
    const u = await ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: "user",
        data: {
          name: "Media Owner",
          email: "media@example.test",
          emailVerified: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      },
    });
    const session = await ctx.runMutation(
      components.betterAuth.adapter.create,
      {
        input: {
          model: "session",
          data: {
            userId: u._id,
            token: crypto.randomUUID(),
            createdAt: Date.now(),
            updatedAt: Date.now(),
            expiresAt: Date.now() + 86400000,
          },
        },
      },
    );
    return { subject: u._id, sessionId: session._id };
  });
  const signed = t.withIdentity(identity);
  const userId = await signed.mutation(api.users.bootstrap, {});
  const workspaceSnapshot = await signed.query(api.users.current, {});
  if (workspaceSnapshot.state !== "ready")
    throw new Error("Fixture workspace must be ready");
  const { activeWorkspaceId: workspaceId } = workspaceSnapshot;
  const reserve = () =>
    signed.mutation(internal.media.uploads.reserve, {
      workspaceId,
      requestId: crypto.randomUUID(),
      name: "Synthetic.png",
      size: 70,
      mime: "image/png",
      alt: "A synthetic fixture",
    });
  const ready = async () => {
    const s = await reserve();
    const claimed = await signed.mutation(internal.media.uploads.claim, {
      workspaceId,
      sessionId: s._id,
    });
    await t.mutation(internal.media.uploads.complete, {
      sessionId: s._id,
      generation: claimed.generation,
      metadata: {
        mime: "image/png",
        type: "image",
        size: 70,
        width: 1,
        height: 1,
        checksum: "synthetic-server-validated",
      },
    });
    return s;
  };
  return { t, signed, userId, workspaceId, reserve, ready };
}
