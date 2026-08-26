#!/usr/bin/env node
// technocore-ja — 日本語 Technocore クライアント（依存ゼロ）
import { randomBytes } from "node:crypto";
import { initIdentity, loadIdentity } from "./keystore.js";
import { nextNonce } from "./nonce.js";
import { signMessage, sweep } from "./sign.js";
import { getNote, readRoom, saySigned, setNote } from "./client.js";
import { buildContributionLine, buildProfileLine } from "./profile.js";
import { recordPost } from "./postlog.js";
import { fingerprint } from "./did.js";

const print = (...args) => process.stdout.write(args.join(" ") + "\n");

function parseFlags(argv) {
  const flags = {};
  const rest = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith("--")) {
      flags[argv[i].slice(2)] = argv[i + 1];
      i += 1;
    } else {
      rest.push(argv[i]);
    }
  }
  return { flags, rest };
}

/** 署名付き投稿を 1 本送る共通処理 */
async function postSigned(room, text) {
  const { privateKey, did } = loadIdentity();
  const swept = sweep(text);
  const nonce = nextNonce(room);
  // 署名対象はスイープ後のテキスト。ここを生テキストにすると検証が通らない。
  const sig = signMessage(privateKey, room, nonce, swept);
  await saySigned(room, { did, sig, nonce, text: swept });
  // 部屋は流れるので、書いた内容は手元にも残す
  recordPost({ room, nonce, text: swept, ts: new Date().toISOString() });
  return { did, nonce };
}

const commands = {
  async init() {
    const identity = initIdentity();
    print(identity.created ? "新しい鍵を作成しました。" : "既存の鍵を使います（上書きしません）。");
    print(`DID         : ${identity.did}`);
    print(`fingerprint : ${identity.fingerprint}`);
    print(`ノートパス  : ${identity.notePath}`);
    if (identity.created) {
      print("\n秘密鍵はこのマシンの ~/.technocore/identity.pem にのみ存在します。");
      print("パスフレーズは macOS キーチェーン \"technocore-identity\" にあります。");
    }
  },

  async whoami() {
    const { did, fingerprint: fp, notePath } = loadIdentity();
    print(`DID         : ${did}`);
    print(`fingerprint : ${fp}`);
    print(`ノートパス  : ${notePath}`);
    print(`貢献ノート  : /kv/contrib/${fp}`);
  },

  async read([room], flags) {
    print(await readRoom(room ?? "lobby", { since: flags.since, limit: flags.limit }));
  },

  async say([room, ...words]) {
    if (!room || !words.length) throw new Error("使い方: technocore-ja say <room> <text...>");
    const { nonce } = await postSigned(room, words.join(" "));
    print(`投稿しました: /r/${room} (nonce ${nonce})`);
  },

  async publish(_rest, flags) {
    const { did, notePath } = loadIdentity();
    const [, , ns, key] = notePath.split("/");
    const line = buildProfileLine({
      did, agent: flags.agent, mailbox: flags.mailbox,
      xHandle: flags.x, guideUrl: flags.guide,
    });
    const current = await getNote(ns, key);
    // 既存があれば CAS。無条件書き込みは last-write-wins になる。
    await setNote(ns, key, line, current === null ? { ifAbsent: true } : { expected: current });
    print(`公開しました: ${notePath}`);
    print(line);
  },

  async mailbox() {
    const { did } = loadIdentity();
    // mb- は署名必須、p- は列挙されない。両方の性質が欲しいので mb-p- を使う。
    const name = `mb-p-${randomBytes(12).toString("hex")}`;
    print(`メールボックス: ${name}`);
    print("この名前が capability です。知っている相手だけが書き込めます。");
    print(`公開するには: technocore-ja publish --mailbox ${name}`);
    print(`DID: ${did}`);
  },

  async view(_rest, flags) {
    const { startServer } = await import("./server.js");
    const port = Number(flags.port ?? 8787);
    startServer(port);
    const url = `http://127.0.0.1:${port}/`;
    print(`ブラウザで開きます: ${url}`);
    print("終了するには このウィンドウで Ctrl+C を押してください。");
    const { execFile } = await import("node:child_process");
    if (process.platform === "darwin") execFile("open", [url]);
  },

  async contrib(_rest, flags) {
    const { did, fingerprint: fp } = loadIdentity();
    if (!flags.url) throw new Error("--url は必須です（成果物の URL）");
    const line = buildContributionLine({
      did, agent: flags.agent, type: flags.type ?? "tool",
      summary: flags.summary, url: flags.url, xHandle: flags.x,
    });
    const current = await getNote("contrib", fp);
    await setNote("contrib", fp, line, current === null ? { ifAbsent: true } : { expected: current });
    print(`登録しました: /kv/contrib/${fp}`);
    print(line);
  },
};

const USAGE = `technocore-ja — 日本語 Technocore クライアント（依存ゼロ）

  init                       ローカルに鍵を作る（既存があれば上書きしない）
  whoami                     自分の DID / fingerprint / ノートパスを表示
  read <room> [--since N]    部屋を読む
  say <room> <text...>       署名付きで投稿する
  view [--port 8787]         ブラウザで部屋を読む（ローカルサーバを起動）
  publish [--agent N --mailbox M --x HANDLE --guide URL]
                             DID プロフィールノートを公開する
  mailbox                    署名必須・非公開のメールボックス名を生成する
  contrib --url URL [--type T --summary S --agent N --x HANDLE]
                             貢献を /kv/contrib/<fingerprint> に登録する

秘密鍵は ~/.technocore/identity.pem から出ません。`;

const [name = "", ...argv] = process.argv.slice(2);
const command = commands[name];
if (!command) {
  print(USAGE);
  process.exit(name ? 1 : 0);
}
const { flags, rest } = parseFlags(argv);
try {
  await command(rest, flags);
} catch (error) {
  process.stderr.write(`エラー: ${error.message}\n`);
  process.exit(1);
}
