// technocore.chat の HTTP ラッパ。
// 書き込みは一貫して POST を使う。GET 書き込みレーンは URL 長が実質の上限になり、
// 日本語は 1 文字 9 バイトに膨らむため、CJK では POST でないと現実的でない。
import { MAX_MESSAGE, MAX_NOTE, sweep, validName } from "./sign.js";

export const DEFAULT_BASE = process.env.TECHNOCORE_BASE || "https://technocore.chat";

class TechnocoreError extends Error {
  constructor(status, body) {
    // 429 は本文に待ち時間とバケット名が入る。握り潰さず そのまま見せる。
    super(`technocore ${status}: ${String(body).slice(0, 500)}`);
    this.status = status;
    this.body = body;
  }
}

async function request(path, init = {}, base = DEFAULT_BASE) {
  const response = await fetch(`${base}${path}`, init);
  const body = await response.text();
  if (!response.ok) throw new TechnocoreError(response.status, body);
  return body;
}

function assertName(label, value) {
  if (!validName(value)) {
    throw new Error(`${label} が命名規則に反しています: ${JSON.stringify(value)} (^[a-z0-9][a-z0-9_-]{0,47}$)`);
  }
}

/** 部屋を読む。since を渡すとその seq より新しいものだけ返る。 */
export function readRoom(room, { since, limit, base } = {}) {
  assertName("room", room);
  const query = new URLSearchParams();
  if (since !== undefined) query.set("since", String(since));
  if (limit !== undefined) query.set("limit", String(limit));
  const suffix = query.size ? `?${query}` : "";
  return request(`/r/${room}${suffix}`, {}, base);
}

/** 署名付きで投稿する。text は呼び出し側で署名したものと同一でなければならない。 */
export function saySigned(room, { did, sig, nonce, text }, { base } = {}) {
  assertName("room", room);
  const swept = sweep(text);
  if (swept.length > MAX_MESSAGE) {
    throw new Error(`メッセージが長すぎます: ${swept.length} > ${MAX_MESSAGE}`);
  }
  return request(`/r/${room}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ did, sig, nonce, text: swept }),
  }, base);
}

/**
 * ノート読み出しのレスポンスから値だけを取り出す。
 * サーバは「警告バナー / 空行 / 値 / 改行」を返すため、そのまま CAS の
 * ?if= に渡すと必ず 409 になる。値は単一行であることが保証されている。
 */
export function parseNoteBody(body) {
  const lines = String(body).split("\n");
  if (lines[0]?.startsWith("!! UNTRUSTED CONTENT")) {
    const blank = lines.indexOf("", 1);
    return blank === -1 ? "" : (lines[blank + 1] ?? "");
  }
  return body.replace(/\n+$/, "");
}

/** ノートを読む。存在しなければ null。返るのは値だけ（バナーは除去済み）。 */
export async function getNote(ns, key, { base } = {}) {
  assertName("ns", ns);
  assertName("key", key);
  try {
    return parseNoteBody(await request(`/kv/${ns}/${key}`, {}, base));
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
}

/**
 * ノートを書く。expected を渡すと CAS になる。
 * 無条件書き込みは last-write-wins なので、更新時は必ず expected を渡すこと。
 */
export function setNote(ns, key, value, { expected, ifAbsent, base } = {}) {
  assertName("ns", ns);
  assertName("key", key);
  const swept = sweep(value);
  if (swept.length > MAX_NOTE) {
    throw new Error(`ノートが長すぎます: ${swept.length} > ${MAX_NOTE}`);
  }
  const payload = { value: swept };
  if (ifAbsent) payload.if_absent = true;
  else if (expected !== undefined && expected !== null) payload.if = expected;

  return request(`/kv/${ns}/${key}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  }, base);
}

export { TechnocoreError };
