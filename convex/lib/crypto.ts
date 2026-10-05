import { ConvexError } from "convex/values";

export type Envelope = {
  version: 1;
  keyId: string;
  iv: string;
  ciphertext: string;
};
export function base64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes));
}
function bytes(value: string) {
  try {
    const result = Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
    if (base64(result) !== value) throw new Error();
    return result;
  } catch {
    throw new ConvexError("X_ENCRYPTION_CONFIGURATION_REQUIRED");
  }
}
export function keyring() {
  const keyId = process.env.INTEGRATION_ENCRYPTION_KEY_ID;
  const current = process.env.INTEGRATION_ENCRYPTION_KEY;
  const previousId = process.env.INTEGRATION_ENCRYPTION_PREVIOUS_KEY_ID;
  const previous = process.env.INTEGRATION_ENCRYPTION_PREVIOUS_KEY;
  if (
    !keyId ||
    !/^[a-zA-Z0-9_-]{1,40}$/.test(keyId) ||
    !current ||
    bytes(current).length !== 32 ||
    Boolean(previousId) !== Boolean(previous) ||
    (previous &&
      (bytes(previous).length !== 32 ||
        !/^[a-zA-Z0-9_-]{1,40}$/.test(previousId!) ||
        previousId === keyId))
  )
    throw new ConvexError("X_ENCRYPTION_CONFIGURATION_REQUIRED");
  return {
    keyId,
    keys: {
      [keyId]: current,
      ...(previousId && previous ? { [previousId]: previous } : {}),
    },
  };
}
async function key(material: string) {
  return crypto.subtle.importKey("raw", bytes(material), "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}
export async function seal(
  value: unknown,
  association: string,
): Promise<Envelope> {
  const ring = keyring(),
    iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: new TextEncoder().encode(association),
    },
    await key(ring.keys[ring.keyId]),
    new TextEncoder().encode(JSON.stringify(value)),
  );
  return {
    version: 1,
    keyId: ring.keyId,
    iv: base64(iv),
    ciphertext: base64(new Uint8Array(ciphertext)),
  };
}
export async function open<T>(
  envelope: Envelope,
  association: string,
): Promise<T> {
  const ring = keyring();
  const material = Object.hasOwn(ring.keys, envelope.keyId)
    ? ring.keys[envelope.keyId]
    : undefined;
  if (!material) throw new ConvexError("X_ENCRYPTION_KEY_UNAVAILABLE");
  try {
    if (envelope.version !== 1 || bytes(envelope.iv).length !== 12)
      throw new Error();
    const plaintext = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: bytes(envelope.iv),
        additionalData: new TextEncoder().encode(association),
      },
      await key(material),
      bytes(envelope.ciphertext),
    );
    return JSON.parse(new TextDecoder().decode(plaintext)) as T;
  } catch {
    throw new ConvexError("X_CREDENTIAL_UNREADABLE");
  }
}
export function randomSecret() {
  return base64(crypto.getRandomValues(new Uint8Array(32)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
export async function sha256(value: string) {
  return base64(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
  )
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
