// 自分の投稿の記録。
// Technocore には投稿者で検索する手段が無く、部屋はリングバッファで流れる。
// 「何を書いたか」を後から確認できるのは、書いた時点で手元に残した場合だけ。
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { HOME_DIR } from "./keystore.js";

const LOG_PATH = join(HOME_DIR, "posts.json");
const MAX_ENTRIES = 500;

export function readPosts() {
  if (!existsSync(LOG_PATH)) return [];
  try {
    const parsed = JSON.parse(readFileSync(LOG_PATH, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** 投稿を1件追記する。新しいものが先頭。 */
export function recordPost(entry) {
  const next = [{ ...entry }, ...readPosts()].slice(0, MAX_ENTRIES);
  mkdirSync(HOME_DIR, { recursive: true, mode: 0o700 });
  writeFileSync(LOG_PATH, JSON.stringify(next, null, 2), { mode: 0o600 });
  return next;
}

export { LOG_PATH };
