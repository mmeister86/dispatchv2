import { readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
const serverNames = [
  "BETTER_AUTH_SECRET",
  "RESEND_API_KEY",
  "INTEGRATION_ENCRYPTION_KEY",
  "X_CLIENT_SECRET",
  "GITHUB_CLIENT_SECRET",
  "REQUESTY_API_KEY",
  "TYPESAFE_API_KEY",
];
const marker = `server-secret-must-stay-private-${crypto.randomUUID()}`;
const built = spawnSync("pnpm", ["exec", "vite", "build"], {
  env: {
    ...process.env,
    ...Object.fromEntries(serverNames.map((name) => [name, marker])),
  },
  encoding: "utf8",
});
assert.equal(built.status, 0, built.stderr);
const assets = readdirSync("dist/assets").filter((name) =>
  name.endsWith(".js"),
);
assert(assets.length > 0);
for (const name of assets) {
  const source = readFileSync(`dist/assets/${name}`, "utf8");
  assert(!source.includes(marker), `${name} leaks a server secret value`);
  // Better Auth's shared browser utility includes the inert env variable name;
  // the injected value must never appear. Project-specific server config stays out.
  for (const secret of serverNames.filter(
    (name) => name !== "BETTER_AUTH_SECRET",
  ))
    assert(
      !source.includes(secret),
      `${name} imports server-only configuration ${secret}`,
    );
}
console.log(
  "Client bundle excludes injected server secret values and project server configuration.",
);
