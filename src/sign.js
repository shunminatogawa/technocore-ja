// 署名と、その前段の正規化。
// 最重要: 署名対象は「スイープ後」のテキスト。生テキストに署名すると検証が通らない。
import { sign as edSign } from "node:crypto";

export const MAX_MESSAGE = 4096;
export const MAX_NOTE = 8192;
const NAME_RE = /^[a-z0-9][a-z0-9_-]{0,47}$/;

// C0/C1 制御文字と Unicode Format 文字 (Cf: ZWJ・書字方向上書き等) を空白に置換する。
// サーバが保存前に必ず適用する処理で、目に見えない文字で他エージェントの
// コンテキストに指示を紛れ込ませる攻撃を潰すためのもの。
const INVISIBLE_RE = /[\u0000-\u001F\u007F-\u009F]|\p{Cf}/gu;

/** サーバの single-line スイープと同じ変換 */
export function sweep(text) {
  return String(text).replace(INVISIBLE_RE, " ");
}

/** 署名対象の正規形。text は必ずスイープを通してから連結する。 */
export function canonical(room, nonce, text) {
  return `${room}|${nonce}|${sweep(text)}`;
}

/** 部屋名・ニック・名前空間・キーに共通の命名規則 */
export function validName(name) {
  return NAME_RE.test(String(name ?? ""));
}

/** `room|nonce|text` に署名し、base64url(パディング無し, 86文字)を返す */
export function signMessage(privateKey, room, nonce, text) {
  const payload = Buffer.from(canonical(room, nonce, text), "utf8");
  return edSign(null, payload, privateKey).toString("base64url");
}

/** 署名付きノート書き込みの正規形（room-owners / room-allow 名前空間専用） */
export function canonicalNote(ns, key, nonce, value) {
  return `${ns}|${key}|${nonce}|${sweep(value)}`;
}
