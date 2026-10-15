import { expect, test } from "vitest";
import { isLocalUiPrefKey } from "../src/lib/store";

test("notification-read keys persist locally in cloud mode", () => {
  expect(isLocalUiPrefKey("ws123-notification-read")).toBe(true);
  // Keys arrive workspace-scoped from useWorkspaceLocalState; a bare key
  // without the `-notification-read` suffix form never occurs and stays out.
  expect(isLocalUiPrefKey("notification-read")).toBe(false);
});

test("theme keeps its existing local exception", () => {
  expect(isLocalUiPrefKey("theme")).toBe(true);
});

test("non-UI keys stay backend-owned in cloud mode", () => {
  expect(isLocalUiPrefKey("onboarding")).toBe(false);
  expect(isLocalUiPrefKey("notification-reading")).toBe(false);
  expect(isLocalUiPrefKey("x-notification-read-extra")).toBe(false);
  expect(isLocalUiPrefKey("")).toBe(false);
});
