import { readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
const serverNames = [
  "BETTER_AUTH_SECRET",
  "RESEND_API_KEY",
  "INTEGRATION_ENCRYPTION_KEY",
  "INTEGRATION_ENCRYPTION_PREVIOUS_KEY",
  "X_CLIENT_SECRET",
  "GITHUB_CLIENT_SECRET",
  "GITHUB_APP_CLIENT_SECRET",
  "GITHUB_APP_PRIVATE_KEY",
  "GITHUB_WEBHOOK_SECRET",
  "REQUESTY_API_KEY",
  "TYPESAFE_API_KEY",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
];
// Settings names required setup keys as prose, without reading their values.
const guidanceNames = new Set([
  "REQUESTY_API_KEY",
  "GITHUB_CLIENT_SECRET",
  "GITHUB_APP_CLIENT_SECRET",
  "GITHUB_APP_PRIVATE_KEY",
  "GITHUB_WEBHOOK_SECRET",
  "INTEGRATION_ENCRYPTION_PREVIOUS_KEY",
  "RESEND_API_KEY",
  "INTEGRATION_ENCRYPTION_KEY",
  "X_CLIENT_SECRET",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
]);
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
  assert(
    !/S3Client|SignatureV4|cloudflarestorage\.com|jpeg-js|mp4box|AES-GCM|api\.x\.com\/2\/oauth2\/token|createPrivateKey|RSA-SHA256|github\.com\/login\/oauth\/access_token|router\.eu\.requesty\.ai|wrapLanguageModel|rawRequestResponseHandler/.test(
      source,
    ),
    `${name} imports server media SDK/validation`,
  );
  // Better Auth includes an inert env name. Settings may show setup key names;
  // actual server configuration and injected values must still stay out.
  for (const secret of serverNames.filter(
    (name) => name !== "BETTER_AUTH_SECRET",
  ))
    assert(
      !source.includes(secret) ||
        (/^(Settings|Media|Drafts|Agent|models|shared|social-accounts|github)-/.test(
          name,
        ) &&
          guidanceNames.has(secret)),
      `${name} imports server-only configuration ${secret}`,
    );
}
console.log(
  "Client bundle excludes injected server secret values and project server configuration.",
);
