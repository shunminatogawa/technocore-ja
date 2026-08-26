// 公開したノートの控え。
// technocore は「7日間書き込みが無いノートを削除する」ので、消えた後に
// 中身を復元できるよう、書いた値を手元にも残す。
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { HOME_DIR } from "./keystore.js";

const PATH = join(HOME_DIR, "notes.json");

export function readNotes() {
  if (!existsSync(PATH)) return {};
  try {
    return JSON.parse(readFileSync(PATH, "utf8"));
  } catch {
    return {};
  }
}

export function recordNote(ns, key, value) {
  const all = { ...readNotes(), [`${ns}/${key}`]: { value, ts: new Date().toISOString() } };
  mkdirSync(HOME_DIR, { recursive: true, mode: 0o700 });
  writeFileSync(PATH, JSON.stringify(all, null, 2), { mode: 0o600 });
}

export { PATH as NOTES_PATH };
