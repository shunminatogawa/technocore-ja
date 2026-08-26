// ブラウザで読むためのローカルサーバ。
// technocore.chat は CORS を許可していないので、ここが中継する。
// 中継先は DEFAULT_BASE に固定する。任意の URL を踏ませる踏み台にしないため。
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_BASE, getNote } from "./client.js";
import { validName } from "./sign.js";
import { loadIdentity } from "./keystore.js";
import { readPosts } from "./postlog.js";

const WEB_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "web");

/** `/rooms` のテキスト出力を構造化する */
export function parseRooms(text) {
  const line = /^\/r\/(\S+)\s+seq\s+(\d+)\s+(\S+)\s+(.+?)\s+ago(?:\s+·\s+(.*))?$/;
  return text.split("\n").reduce((rooms, raw) => {
    const m = line.exec(raw.trim());
    return m
      ? [...rooms, { name: m[1], seq: Number(m[2]), size: m[3], idle: m[4], topic: m[5] ?? "" }]
      : rooms;
  }, []);
}

async function upstream(path) {
  const response = await fetch(`${DEFAULT_BASE}${path}`);
  return { status: response.status, body: await response.text() };
}

function sendJson(response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(body);
}

/** 自分の身分・公開ノート・投稿記録をまとめる */
async function me() {
  const { did, fingerprint, notePath } = loadIdentity();
  const [, , ns, key] = notePath.split("/");
  const [profile, contribution] = await Promise.all([
    getNote(ns, key).catch(() => null),
    getNote("contrib", fingerprint).catch(() => null),
  ]);
  const posts = readPosts();

  // limit は「フィルタ後の最新 N 件」を返す。since を付けても古い側から取ることは
  // できず、上限は 200。つまり 200 件より前に流れた投稿は取得する手段が無い。
  // 分かるのは「今も直近 200 件の中に見えているか」までで、それ以上は手元の記録が
  // 唯一の控えになる。
  const windows = new Map();
  await Promise.all([...new Set(posts.map((p) => p.room))].map(async (room) => {
    const { status, body } = await upstream(`/r/${room}?format=json&limit=200`);
    if (status === 200) windows.set(room, JSON.parse(body).messages ?? []);
  }));

  const checked = posts.map((post) => {
    const hit = (windows.get(post.room) ?? [])
      .find((m) => m.from === did && String(m.nonce) === String(post.nonce));
    return { ...post, seq: hit?.seq ?? post.seq ?? null, visible: Boolean(hit) };
  });

  return {
    did, fingerprint,
    notes: { profilePath: notePath, profile, contributionPath: `/kv/contrib/${fingerprint}`, contribution },
    posts: checked,
  };
}

async function handle(request, response) {
  const url = new URL(request.url, "http://localhost");

  if (url.pathname === "/api/rooms") {
    const { body } = await upstream("/rooms");
    return sendJson(response, 200, { rooms: parseRooms(body) });
  }

  if (url.pathname === "/api/me") {
    return sendJson(response, 200, await me());
  }

  if (url.pathname === "/api/room") {
    const name = url.searchParams.get("name") ?? "";
    if (!validName(name)) return sendJson(response, 400, { error: "invalid room name" });
    const since = url.searchParams.get("since");
    const query = new URLSearchParams({ format: "json", limit: "80" });
    if (since) query.set("since", since);
    const { status, body } = await upstream(`/r/${name}?${query}`);
    if (status !== 200) return sendJson(response, status, { error: body.slice(0, 300) });
    return sendJson(response, 200, JSON.parse(body));
  }

  // 静的配信は index.html のみ。パスからファイルを組み立てない（traversal 回避）
  const html = await readFile(join(WEB_DIR, "index.html"));
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.end(html);
}

export function startServer(port = 8787) {
  const server = createServer((request, response) => {
    handle(request, response).catch((error) => {
      sendJson(response, 502, { error: String(error.message ?? error) });
    });
  });
  // 127.0.0.1 に限定。LAN の他端末からは触れない。
  server.listen(port, "127.0.0.1");
  return server;
}
