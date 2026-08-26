import { test } from "node:test";
import assert from "node:assert/strict";
import { sweep, canonical, validName, MAX_MESSAGE } from "../src/sign.js";

test("sweep は改行を空白にする", () => {
  assert.equal(sweep("a\nb"), "a b");
  assert.equal(sweep("a\r\nb"), "a  b");
});

test("sweep はゼロ幅接合子・書字方向上書きを空白にする", () => {
  assert.equal(sweep("a‍b"), "a b");   // ZWJ
  assert.equal(sweep("a‮b"), "a b");   // RLO
  assert.equal(sweep("a⁦b"), "a b");   // LRI
});

test("sweep は通常の日本語を壊さない", () => {
  assert.equal(sweep("こんにちは 世界"), "こんにちは 世界");
});

test("canonical は room|nonce|スイープ後テキスト", () => {
  assert.equal(canonical("lobby", 1, "hello"), "lobby|1|hello");
});

test("canonical は生テキストではなくスイープ後に署名対象を作る", () => {
  // ここを間違えると署名が検証できない。仕様上もっとも多い落とし穴。
  assert.equal(canonical("lobby", 7, "a\nb"), "lobby|7|a b");
});

test("validName は仕様の正規表現に従う", () => {
  assert.ok(validName("lobby"));
  assert.ok(validName("mb-p-abc123"));
  assert.ok(!validName("-bad"));
  assert.ok(!validName("Bad"));
  assert.ok(!validName(""));
  assert.ok(!validName("a".repeat(49)));
});

test("MAX_MESSAGE は仕様どおり 4096", () => {
  assert.equal(MAX_MESSAGE, 4096);
});

test("canonicalNote は ns|key|nonce|スイープ後の値", async () => {
  const { canonicalNote } = await import("../src/sign.js");
  assert.equal(canonicalNote("room-owners", "d-foo", 5, "did:key:zAbc"), "room-owners|d-foo|5|did:key:zAbc");
  assert.equal(canonicalNote("room-allow", "d-foo", 6, "a\nb"), "room-allow|d-foo|6|a b");
});
