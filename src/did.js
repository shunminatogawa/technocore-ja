// did:key (Ed25519) のエンコード・デコード。
// did:key は「公開鍵を人間が貼り付けられる形に書き写したもの」でしかない。
// 登録先も発行者も存在しないため、この変換がアイデンティティのすべてになる。
import { createHash } from "node:crypto";

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const ED25519_PUB_MULTICODEC = Buffer.from([0xed, 0x01]);
const RAW_KEY_BYTES = 32;

function base58Encode(bytes) {
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  let out = "";
  while (n > 0n) {
    out = B58[Number(n % 58n)] + out;
    n /= 58n;
  }
  // 先頭のゼロバイトは桁として消えるので '1' で補う（base58btc の規定）
  for (const b of bytes) {
    if (b !== 0) break;
    out = "1" + out;
  }
  return out;
}

function base58Decode(str) {
  let n = 0n;
  for (const ch of str) {
    const idx = B58.indexOf(ch);
    if (idx < 0) throw new Error(`invalid base58 character: ${ch}`);
    n = n * 58n + BigInt(idx);
  }
  const bytes = [];
  while (n > 0n) {
    bytes.unshift(Number(n & 0xffn));
    n >>= 8n;
  }
  for (const ch of str) {
    if (ch !== "1") break;
    bytes.unshift(0);
  }
  return Buffer.from(bytes);
}

/** 生の Ed25519 公開鍵 32 バイト -> did:key 文字列 */
export function encodeDidKey(rawPublicKey) {
  if (rawPublicKey.length !== RAW_KEY_BYTES) {
    throw new Error(`public key must be ${RAW_KEY_BYTES} bytes, got ${rawPublicKey.length}`);
  }
  const payload = Buffer.concat([ED25519_PUB_MULTICODEC, rawPublicKey]);
  return `did:key:z${base58Encode(payload)}`;
}

/** did:key 文字列 -> 生の Ed25519 公開鍵 32 バイト */
export function decodeDidKey(did) {
  if (typeof did !== "string" || !did.startsWith("did:key:z")) {
    throw new Error("invalid did:key: must start with did:key:z");
  }
  const payload = base58Decode(did.slice("did:key:z".length));
  if (payload.length !== ED25519_PUB_MULTICODEC.length + RAW_KEY_BYTES) {
    throw new Error(`invalid did:key: expected 34 bytes, got ${payload.length}`);
  }
  if (!payload.subarray(0, 2).equals(ED25519_PUB_MULTICODEC)) {
    // x25519-pub (0xec01) も鍵長が同じなので、接頭辞を見ないと取り違える
    throw new Error("invalid did:key: not an ed25519-pub multicodec prefix");
  }
  return payload.subarray(2);
}

/** DID 文字列の SHA-256 先頭 16 hex。ノートのキー名に使う規約。 */
export function fingerprint(did) {
  return createHash("sha256").update(did, "utf8").digest("hex").slice(0, 16);
}

/** DID プロフィールノートのパス。名前空間の上限を守るためシャード分割する。 */
export function didNotePath(did) {
  const fp = fingerprint(did);
  return `/kv/did-${fp.slice(0, 2)}/${fp.slice(2)}`;
}
