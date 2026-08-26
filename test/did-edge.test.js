import { test } from "node:test";
import assert from "node:assert/strict";
import { encodeDidKey, decodeDidKey } from "../src/did.js";

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

// did.js の内部実装に依存せず、テスト側で独立に base58 を組む
function b58(bytes) {
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  let out = "";
  while (n > 0n) { out = B58[Number(n % 58n)] + out; n /= 58n; }
  for (const b of bytes) { if (b !== 0) break; out = "1" + out; }
  return out;
}

test("先頭がゼロバイトの鍵でも往復する（base58 の '1' パディング）", () => {
  const key = Buffer.alloc(32);
  key[31] = 1; // 先頭 31 バイトがゼロ
  assert.equal(decodeDidKey(encodeDidKey(key)).toString("hex"), key.toString("hex"));
});

test("全ゼロの鍵でも往復する", () => {
  const key = Buffer.alloc(32);
  assert.equal(decodeDidKey(encodeDidKey(key)).toString("hex"), key.toString("hex"));
});

test("x25519 の鍵を did:key として渡すと拒否する", () => {
  // 0xec01 = x25519-pub。鍵長が ed25519 と同じ 32 バイトなので、
  // 接頭辞を検査しないと暗号方式を取り違えたまま通ってしまう。
  const payload = Buffer.concat([Buffer.from([0xec, 0x01]), Buffer.alloc(32)]);
  assert.throws(() => decodeDidKey(`did:key:z${b58(payload)}`), /ed25519-pub/);
});

test("長さが 34 バイトでないものを拒否する", () => {
  const payload = Buffer.concat([Buffer.from([0xed, 0x01]), Buffer.alloc(31)]);
  assert.throws(() => decodeDidKey(`did:key:z${b58(payload)}`), /34 bytes/);
});

test("did:key: 接頭辞が無いものを拒否する", () => {
  assert.throws(() => decodeDidKey("z6Mkfoo"), /must start with/);
  assert.throws(() => decodeDidKey(null), /must start with/);
});

test("base58 に無い文字を拒否する（0 O I l は含まれない）", () => {
  for (const ch of ["0", "O", "I", "l"]) {
    assert.throws(() => decodeDidKey(`did:key:z6Mk${ch}`), /invalid base58/);
  }
});
