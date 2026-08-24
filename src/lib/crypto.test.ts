import assert from "node:assert/strict";
import { test } from "node:test";
import {
  decryptJson,
  encryptJson,
  generateRawKey,
  importRawKey,
  isLegacyPinEnvelope,
  isVaultEnvelope,
  parseEnvelopeJson,
  PREVIOUS_VAULT_KEY,
} from "@/lib/crypto";

test("AES-GCM round-trip with a random device key", async () => {
  const key = await importRawKey(generateRawKey());
  const envelope = await encryptJson(key, JSON.stringify({ hello: "world" }));
  assert.equal(isVaultEnvelope(envelope), true);
  assert.equal(await decryptJson(key, envelope), JSON.stringify({ hello: "world" }));
});

test("each encryption uses a fresh IV", async () => {
  const key = await importRawKey(generateRawKey());
  const a = await encryptJson(key, "same");
  const b = await encryptJson(key, "same");
  assert.notEqual(a.iv, b.iv);
  assert.notEqual(a.ciphertext, b.ciphertext);
});

test("a different key cannot open the envelope", async () => {
  const envelope = await encryptJson(await importRawKey(generateRawKey()), "secret");
  await assert.rejects(decryptJson(await importRawKey(generateRawKey()), envelope));
});

test("tampered ciphertext fails authentication", async () => {
  const key = await importRawKey(generateRawKey());
  const envelope = await encryptJson(key, "secret");
  const bytes = Buffer.from(envelope.ciphertext, "base64");
  bytes[0] ^= 0xff;
  await assert.rejects(decryptJson(key, { ...envelope, ciphertext: bytes.toString("base64") }));
});

test("rejects keys that are not 32 bytes", async () => {
  await assert.rejects(importRawKey(new Uint8Array(16)));
});

test("decrypts envelopes sealed with the pre-rebrand AAD", async () => {
  const key = await importRawKey(generateRawKey());
  const envelope = await encryptJson(key, "migrated household", PREVIOUS_VAULT_KEY);
  assert.equal(await decryptJson(key, envelope), "migrated household");
});

test("legacy PIN envelopes are recognised and never treated as v2", () => {
  const legacy = { v: 1, alg: "A256GCM", kdf: "PBKDF2-SHA256", iterations: 310000, salt: "x", iv: "y", ciphertext: "z" };
  assert.equal(isLegacyPinEnvelope(legacy), true);
  assert.equal(isVaultEnvelope(legacy), false);
  assert.equal(parseEnvelopeJson(JSON.stringify(legacy)), null);
});
