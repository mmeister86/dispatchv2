import { afterEach, expect, test, vi } from "vitest";
import { createSeed } from "../src/lib/model";
import { readState } from "../src/lib/store";

const KEY = "dispatch-demo-v1";

function stubStorage(raw: string | null) {
  const store = raw === null ? {} : { [KEY]: raw };
  vi.stubGlobal("localStorage", {
    getItem: (key: string) =>
      Object.hasOwn(store, key) ? store[key as keyof typeof store] : null,
    setItem: () => {},
    removeItem: () => {},
  });
}

afterEach(() => vi.unstubAllGlobals());

test("corrupt demo payload with empty preferences falls back to seed instead of crashing", () => {
  const seed = createSeed();
  const corrupt = { ...seed, preferences: {} };
  stubStorage(JSON.stringify(corrupt));
  const state = readState();
  expect(typeof state.preferences.name).toBe("string");
  expect(typeof state.preferences.timezone).toBe("string");
  // The App.tsx:512 crash surface: name.slice must not throw on load.
  expect(() => state.preferences.name.slice(0, 1)).not.toThrow();
});

test("valid demo payload still loads from storage", () => {
  const seed = createSeed();
  stubStorage(JSON.stringify(seed));
  expect(readState()).toEqual(seed);
});

test("draft without versions falls back to seed instead of bricking overview", () => {
  const seed = createSeed();
  stubStorage(
    JSON.stringify({
      ...seed,
      drafts: [{ workspaceId: seed.activeWorkspaceId, versions: [] }],
    }),
  );
  const state = readState();
  expect(state.drafts.length).toBeGreaterThan(0);
  expect(state.drafts.every((d) => d.versions.length > 0)).toBe(true);
});

test("schedule without at falls back to seed instead of breaking the sort", () => {
  const seed = createSeed();
  stubStorage(
    JSON.stringify({
      ...seed,
      schedules: [{ workspaceId: seed.activeWorkspaceId, status: "scheduled" }],
    }),
  );
  const state = readState();
  expect(state.schedules.every((s) => typeof s.at === "string")).toBe(true);
});

test("invalid timezone falls back to seed instead of crashing Intl call sites", () => {
  const seed = createSeed();
  stubStorage(
    JSON.stringify({
      ...seed,
      preferences: { ...seed.preferences, timezone: "Mars/Olympus" },
    }),
  );
  expect(readState()).toEqual(seed);
});

test("schedule with an unparseable at falls back to seed", () => {
  const seed = createSeed();
  stubStorage(
    JSON.stringify({
      ...seed,
      schedules: [{ ...seed.schedules[0], at: "kein Datum" }],
    }),
  );
  expect(readState()).toEqual(seed);
});

test.each([[null], [{}]])(
  "draft with malformed version %j falls back to seed",
  (version) => {
    const seed = createSeed();
    stubStorage(
      JSON.stringify({
        ...seed,
        drafts: [{ ...seed.drafts[0], versions: [version] }],
      }),
    );
    expect(readState()).toEqual(seed);
  },
);
