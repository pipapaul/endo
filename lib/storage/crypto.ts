const encoder = new TextEncoder();
const decoder = new TextDecoder();

const subtle = () => {
  if (typeof globalThis.crypto?.subtle === "undefined") {
    throw new Error("WebCrypto nicht verfügbar");
  }
  return globalThis.crypto.subtle;
};

export async function deriveKey(passphrase: string, saltBase64?: string) {
  const salt = saltBase64 ? Uint8Array.from(atob(saltBase64), (c) => c.charCodeAt(0)) : globalThis.crypto.getRandomValues(new Uint8Array(16));
  const material = await subtle().importKey("raw", encoder.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  const key = await subtle().deriveKey(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt,
      iterations: 150000,
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
  return {
    key,
    salt: btoa(String.fromCharCode(...salt)),
  };
}

export async function encryptPayload(key: CryptoKey, data: Record<string, unknown>) {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const encoded = encoder.encode(JSON.stringify(data));
  const ciphertext = await subtle().encrypt({ name: "AES-GCM", iv }, key, encoded);
  return {
    iv: btoa(String.fromCharCode(...iv)),
    payload: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
  };
}

export async function decryptPayload<T>(key: CryptoKey, payload: { iv: string; payload: string }): Promise<T> {
  const iv = Uint8Array.from(atob(payload.iv), (c) => c.charCodeAt(0));
  const data = Uint8Array.from(atob(payload.payload), (c) => c.charCodeAt(0));
  const buffer = await subtle().decrypt({ name: "AES-GCM", iv }, key, data);
  return JSON.parse(decoder.decode(buffer)) as T;
}
