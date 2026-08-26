// nonce の永続カウンタ。
// メモリやタイムスタンプで持つとプロセス再起動で巻き戻り、署名が 403 になる。
// 実運用で報告されている失敗なので、最初からファイルに置く。
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { HOME_DIR } from "./keystore.js";

const NONCE_PATH = join(HOME_DIR, "nonce.json");

function readAll() {
  if (!existsSync(NONCE_PATH)) return {};
  try {
    return JSON.parse(readFileSync(NONCE_PATH, "utf8"));
  } catch {
    return {};
  }
}

/** scope(部屋名など)ごとに単調増加する次の nonce を返し、即座に永続化する。 */
export function nextNonce(scope) {
  const all = readAll();
  // 壁時計と比較して大きい方を採る。手動編集や別クライアントとの併用で
  // 巻き戻っていても、時刻側が救ってくれる。
  const next = Math.max((all[scope] ?? 0) + 1, Date.now());
  mkdirSync(HOME_DIR, { recursive: true, mode: 0o700 });
  writeFileSync(NONCE_PATH, JSON.stringify({ ...all, [scope]: next }, null, 2), { mode: 0o600 });
  return next;
}

export { NONCE_PATH };
