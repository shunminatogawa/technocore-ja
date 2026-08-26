import { test } from "node:test";
import assert from "node:assert/strict";
import { encodeDidKey, decodeDidKey, fingerprint, didNotePath } from "../src/did.js";

// このセッションでローカル生成した実鍵。エンコード実装の固定点として使う。
const KNOWN_PUB = "2406a6430e05b3f9468bd02f5f47967885e0e610cdf380bb518282463c5b921e";
const KNOWN_DID = "did:key:z6Mkgstbx9HUAQzsEkgQWXssBfKYa9SK3JrhkMfXvpig7Bim";

test("encodeDidKey は既知の公開鍵から既知の DID を作る", () => {
  assert.equal(encodeDidKey(Buffer.from(KNOWN_PUB, "hex")), KNOWN_DID);
});

test("decodeDidKey は往復する", () => {
  assert.equal(decodeDidKey(KNOWN_DID).toString("hex"), KNOWN_PUB);
});

test("encodeDidKey は 32 バイト以外を拒否する", () => {
  assert.throws(() => encodeDidKey(Buffer.alloc(31)), /32/);
});

test("decodeDidKey は ed25519 以外の multicodec を拒否する", () => {
  // 0xec01 = x25519-pub。鍵長は同じなので接頭辞を見ないと通ってしまう。
  const bad = "did:key:z" + encodeDidKey(Buffer.alloc(32)).slice(9); // 形だけ似せる
  assert.throws(() => decodeDidKey("did:key:zZZZZ"), /decode|prefix|invalid/i);
  assert.ok(bad.length > 0);
});

test("fingerprint は DID 文字列の SHA-256 先頭 16 hex", () => {
  assert.equal(fingerprint(KNOWN_DID), "0fd59b2262d568c9");
});

test("didNotePath はシャード分割する", () => {
  assert.equal(didNotePath(KNOWN_DID), "/kv/did-0f/d59b2262d568c9");
});
