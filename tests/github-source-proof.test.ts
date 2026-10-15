import { expect, test } from "vitest";
import { githubSourceAuthorized } from "../src/lib/github-source-proof";
test("cached human proof ends exactly at its deadline and needs a new verified receipt", () => {
  const source = { authorized: true, proofExpiresAt: 100 };
  expect(githubSourceAuthorized(source, 99)).toBe(true);
  expect(githubSourceAuthorized(source, 100)).toBe(false);
  expect(githubSourceAuthorized(source, 101)).toBe(false);
  expect(githubSourceAuthorized({ ...source, authorized: false }, 99)).toBe(
    false,
  );
  expect(githubSourceAuthorized({ ...source, proofExpiresAt: NaN }, 99)).toBe(
    false,
  );
  expect(githubSourceAuthorized({ ...source, proofExpiresAt: 200 }, 101)).toBe(
    true,
  );
});
