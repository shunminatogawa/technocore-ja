// ローカル鍵の生成・読み込み。
// 設計方針: 秘密鍵はこのマシンから出ない。クラウド上で生成しない。
// パスフレーズは平文ファイル(.env)ではなく OS のキーチェーンに置く。
import { execFileSync } from "node:child_process";
import { createPrivateKey, createPublicKey, generateKeyPairSync, randomBytes } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { encodeDidKey, didNotePath, fingerprint } from "./did.js";

export const HOME_DIR = process.env.TECHNOCORE_HOME || join(homedir(), ".technocore");
const KEY_PATH = join(HOME_DIR, "identity.pem");
const KEYCHAIN_SERVICE = "technocore-identity";

function keychainGet() {
  try {
    return execFileSync("security",
      ["find-generic-password", "-a", process.env.USER, "-s", KEYCHAIN_SERVICE, "-w"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

function keychainSet(passphrase) {
  execFileSync("security",
    ["add-generic-password", "-a", process.env.USER, "-s", KEYCHAIN_SERVICE, "-w", passphrase, "-U"],
    { stdio: "ignore" });
}

/**
 * パスフレーズの取得順: macOS キーチェーン -> 環境変数。
 * 他 OS ではキーチェーンが無いので TECHNOCORE_PASSPHRASE を使う。
 */
function loadPassphrase() {
  const fromKeychain = process.platform === "darwin" ? keychainGet() : null;
  const passphrase = fromKeychain || process.env.TECHNOCORE_PASSPHRASE;
  if (!passphrase) {
    throw new Error(
      "パスフレーズが見つかりません。macOS ならキーチェーンの " +
      `"${KEYCHAIN_SERVICE}" を、他 OS なら環境変数 TECHNOCORE_PASSPHRASE を設定してください。`
    );
  }
  return passphrase;
}

function rawPublicKey(privateKey) {
  // SubjectPublicKeyInfo(DER) の末尾 32 バイトが生の Ed25519 公開鍵
  return createPublicKey(privateKey).export({ type: "spki", format: "der" }).subarray(-32);
}

/**
 * DID だけを取り出す。パスフレーズを必要としない。
 * ノートの延命更新は署名が要らない（署名必須なのは room-owners と room-allow のみ）ので、
 * 自動実行からキーチェーンを触らずに済ませるためのもの。
 */
export function loadDid() {
  const cached = join(HOME_DIR, "did.txt");
  if (existsSync(cached)) {
    const did = readFileSync(cached, "utf8").trim();
    if (did.startsWith("did:key:z")) return did;
  }
  return loadIdentity().did;
}

/** 既存の鍵を読む。無ければ例外。 */
export function loadIdentity() {
  if (!existsSync(KEY_PATH)) {
    throw new Error(`鍵がありません: ${KEY_PATH}\n先に \`technocore-ja init\` を実行してください。`);
  }
  const privateKey = createPrivateKey({
    key: readFileSync(KEY_PATH),
    format: "pem",
    passphrase: loadPassphrase(),
  });
  const did = encodeDidKey(rawPublicKey(privateKey));
  return { privateKey, did, fingerprint: fingerprint(did), notePath: didNotePath(did) };
}

/**
 * 鍵を作る。既にあれば **上書きせず** 既存を返す（冪等）。
 * 鍵の作り直しは DID が変わることを意味するので、事故で起きてはならない。
 */
export function initIdentity() {
  if (existsSync(KEY_PATH)) return { created: false, ...loadIdentity() };

  // macOS 以外はキーチェーンに保存できない。ランダム生成すると保存先が無く、
  // 二度と開けない鍵ができてしまうので、明示的に要求する。
  if (process.platform !== "darwin" && !process.env.TECHNOCORE_PASSPHRASE) {
    throw new Error(
      "この OS ではキーチェーンを使えません。環境変数 TECHNOCORE_PASSPHRASE に\n" +
      "パスフレーズを設定してから init してください（鍵の暗号化に使います）。"
    );
  }

  mkdirSync(HOME_DIR, { recursive: true, mode: 0o700 });
  const passphrase = process.env.TECHNOCORE_PASSPHRASE || randomBytes(32).toString("base64");

  const { privateKey } = generateKeyPairSync("ed25519");
  const pem = privateKey.export({
    type: "pkcs8", format: "pem", cipher: "aes-256-cbc", passphrase,
  });
  writeFileSync(KEY_PATH, pem, { mode: 0o600 });
  chmodSync(KEY_PATH, 0o600);
  if (process.platform === "darwin") keychainSet(passphrase);

  return { created: true, ...loadIdentity() };
}
