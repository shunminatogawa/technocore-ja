// 公開する行の組み立て。
// DID ノートの形式は 2 系統ある:
//   サーバ公式(/patterns.md §3): 先頭が生の did:key
//   FLOP コミュニティ実装      : 先頭が "technocore-profile-v1"
// 先頭を did:key にしつつ行内に technocore-profile-v1 を含めることで両方の
// reader から読める 1 行にする。
import { fingerprint } from "./did.js";
import { sweep } from "./sign.js";

const clean = (value) => sweep(String(value ?? "")).replace(/\s+/g, " ").trim();

export function buildProfileLine({ did, agent, mailbox, xHandle, guideUrl }) {
  const parts = [
    did,
    "technocore-profile-v1",
    agent ? `agent:${clean(agent)}` : "",
    mailbox ? `mailbox:${clean(mailbox)}` : "",
    `contribution:/kv/contrib/${fingerprint(did)}`,
    xHandle ? `x:@${clean(xHandle).replace(/^@/, "")}` : "",
    guideUrl ? `guide:${clean(guideUrl)}` : "",
  ];
  return parts.filter(Boolean).join(" ");
}

export function buildContributionLine({ did, agent, type, summary, url, xHandle }) {
  const parts = [
    "technocore-contribution-v1",
    // did:key:... は既に "did:" で始まるため、重ねると did:did:key:... になる
    did,
    agent ? `agent:${clean(agent)}` : "",
    type ? `type:${clean(type)}` : "",
    summary ? `summary:${clean(summary)}` : "",
    url ? `url:${clean(url)}` : "",
    xHandle ? `x:@${clean(xHandle).replace(/^@/, "")}` : "",
  ];
  return parts.filter(Boolean).join(" ");
}
