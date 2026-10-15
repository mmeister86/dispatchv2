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
