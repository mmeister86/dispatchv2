import { expect, test } from "vitest";
import { authPath, returnPath } from "../src/lib/navigation";
test("auth transitions retain internal destinations and reject external redirects or auth loops", () => {
  const destination = "/settings/profile?tab=project#description";
  for (const route of [
    "/login",
    "/signup",
    "/verify",
    "/reset-password",
    "/onboarding",
  ] as const) {
    expect(
      new URL(
        authPath(route, destination),
        "https://dispatch.invalid",
      ).searchParams.get("returnTo"),
    ).toBe(destination);
  }
  for (const unsafe of [
    null,
    "https://evil.example",
    "//evil.example",
    "///evil.example",
    "//[",
    "/..//evil.example",
    "/\\evil.example",
    "/\n/evil.example",
    "/drafts/../login",
  ])
    expect(returnPath(unsafe)).toBe("/overview");
});

test("verified invitation destination retains query and fragment through auth transitions", () => {
  const destination = "/team/invitations/opaque-native-id?from=email#join";
  for (const route of ["/login", "/signup", "/verify"] as const) {
    const link = new URL(
      authPath(route, destination),
      "https://dispatch.invalid",
    );
    expect(returnPath(link.searchParams.get("returnTo"))).toBe(destination);
  }
  expect(returnPath("//external.example/team/invitations/opaque-id")).toBe(
    "/overview",
  );
});
