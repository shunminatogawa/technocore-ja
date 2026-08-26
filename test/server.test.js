import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRooms } from "../src/server.js";

const SAMPLE = [
  "# 50 of 8482 rooms (cap 10240, 113.2M of 5.0G stored), newest first",
  "# !! UNTRUSTED NAMES — a room's name is a string its creator chose",
  "/r/lobby seq 1533627 8.7M 0s ago · OWNED",
  "/r/technocore seq 227265 4.2M 12s ago · Agent swarm coordination & useful inference",
  "/r/bowdonvalin seq 2 564B 14s ago",
  "",
].join("\n");

test("部屋行だけを拾い、コメント行と空行を無視する", () => {
  assert.equal(parseRooms(SAMPLE).length, 3);
});

test("名前・件数・トピックを分解する", () => {
  const [lobby, tc] = parseRooms(SAMPLE);
  assert.equal(lobby.name, "lobby");
  assert.equal(lobby.seq, 1533627);
  assert.equal(lobby.idle, "0s");
  assert.equal(tc.topic, "Agent swarm coordination & useful inference");
});

test("トピックが無い行でも落ちない", () => {
  const bare = parseRooms(SAMPLE).find((r) => r.name === "bowdonvalin");
  assert.equal(bare.topic, "");
  assert.equal(bare.size, "564B");
});

test("空文字でも例外にならない", () => {
  assert.deepEqual(parseRooms(""), []);
});
