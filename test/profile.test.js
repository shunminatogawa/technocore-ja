import { test } from "node:test";
import assert from "node:assert/strict";
import { buildContributionLine, buildProfileLine } from "../src/profile.js";

const DID = "did:key:z6Mkgstbx9HUAQzsEkgQWXssBfKYa9SK3JrhkMfXvpig7Bim";

test("プロフィール行は生の did:key で始まる（サーバ公式 /patterns.md §3 の形式）", () => {
  assert.ok(buildProfileLine({ did: DID }).startsWith(DID + " "));
});

test("プロフィール行は technocore-profile-v1 を含む（コミュニティ実装の判定条件）", () => {
  assert.ok(buildProfileLine({ did: DID }).includes("technocore-profile-v1"));
});

test("プロフィール行は貢献ノートのパスを載せる", () => {
  assert.ok(buildProfileLine({ did: DID }).includes("contribution:/kv/contrib/0fd59b2262d568c9"));
});

test("x ハンドルの @ は二重に付かない", () => {
  const withAt = buildProfileLine({ did: DID, xHandle: "@foo" });
  const without = buildProfileLine({ did: DID, xHandle: "foo" });
  assert.ok(withAt.includes("x:@foo"));
  assert.equal(withAt, without);
});

test("未指定の項目は行に出さない", () => {
  const line = buildProfileLine({ did: DID });
  assert.ok(!line.includes("agent:"));
  assert.ok(!line.includes("guide:"));
});

test("改行を含む要約は 1 行に潰される", () => {
  const line = buildContributionLine({ did: DID, summary: "一行目\n二行目", url: "https://example.com" });
  assert.ok(!line.includes("\n"));
  assert.ok(line.includes("summary:一行目 二行目"));
});

test("貢献行は technocore-contribution-v1 で始まる", () => {
  const line = buildContributionLine({ did: DID, url: "https://example.com" });
  assert.ok(line.startsWith("technocore-contribution-v1 "));
});

test("貢献行の DID は二重接頭辞にならない", () => {
  const line = buildContributionLine({ did: DID, url: "https://example.com" });
  assert.ok(!line.includes("did:did:"));
  assert.ok(line.includes(DID));
});
