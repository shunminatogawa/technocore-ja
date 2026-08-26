import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonical, signMessage } from "../src/sign.js";

// 自作コードで作った署名を自作コードで検証しても意味がないので、
// OpenSSL に独立検証させる。ここが通れば署名は本物のサーバでも通る。
function withTempDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), "technocore-ja-"));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function verifyWithOpenssl(dir, publicPem, message, signature) {
  writeFileSync(join(dir, "pub.pem"), publicPem);
  writeFileSync(join(dir, "msg.bin"), Buffer.from(message, "utf8"));
  writeFileSync(join(dir, "sig.bin"), Buffer.from(signature, "base64url"));
  try {
    execFileSync("openssl", [
      "pkeyutl", "-verify", "-pubin", "-inkey", join(dir, "pub.pem"),
      "-rawin", "-in", join(dir, "msg.bin"), "-sigfile", join(dir, "sig.bin"),
    ], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

test("Node で作った署名を OpenSSL が検証できる", () => {
  withTempDir((dir) => {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const pem = publicKey.export({ type: "spki", format: "pem" });
    const signature = signMessage(privateKey, "lobby", 42, "hello");
    assert.ok(verifyWithOpenssl(dir, pem, canonical("lobby", 42, "hello"), signature));
  });
});

test("日本語でも検証できる（UTF-8 バイト列として署名される）", () => {
  withTempDir((dir) => {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const pem = publicKey.export({ type: "spki", format: "pem" });
    const text = "こんにちは、Technocore";
    const signature = signMessage(privateKey, "lobby", 7, text);
    assert.ok(verifyWithOpenssl(dir, pem, canonical("lobby", 7, text), signature));
  });
});

test("1 文字でも改ざんすると検証に失敗する", () => {
  withTempDir((dir) => {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const pem = publicKey.export({ type: "spki", format: "pem" });
    const signature = signMessage(privateKey, "lobby", 42, "hello");
    assert.ok(!verifyWithOpenssl(dir, pem, canonical("lobby", 42, "hell0"), signature));
  });
});

test("署名は base64url パディング無しの 86 文字", () => {
  const { privateKey } = generateKeyPairSync("ed25519");
  const signature = signMessage(privateKey, "lobby", 1, "hello");
  assert.equal(signature.length, 86);
  assert.ok(!signature.includes("="));
  assert.ok(!/[+/]/.test(signature));
});

test("スイープ前のテキストで署名すると検証が通らない（最頻出の落とし穴）", () => {
  withTempDir((dir) => {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const pem = publicKey.export({ type: "spki", format: "pem" });
    const raw = "a\nb";
    const signature = signMessage(privateKey, "lobby", 3, raw);
    // 保存されるのは "a b"。生テキスト "a\nb" では検証できない。
    assert.ok(!verifyWithOpenssl(dir, pem, `lobby|3|${raw}`, signature));
    assert.ok(verifyWithOpenssl(dir, pem, "lobby|3|a b", signature));
  });
});
