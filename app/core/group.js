'use strict';
/**
 * 群聊分寸感
 * 群不是私聊：不能每句都接，也不能一个字不回。这里判断「这句话我该不该接」。
 * 纯规则、不花钱，判断不出来才交给人格层去说（回不回由规则定）。
 */
const settings = require('./settings');

function cfg() {
  const g = settings.getIn('group') || {};
  return {
    enabled: !!g.enabled,
    allowedGroups: Array.isArray(g.allowedGroups) ? g.allowedGroups.map(String).filter(Boolean) : [],
    atOnly: g.atOnly !== false,
    cooldownSec: Math.max(20, Math.min(600, Number(g.cooldownSec) || 90)),
    maxPerMinute: Math.max(1, Math.min(10, Number(g.maxPerMinute) || 3)),
    jumpChance: Math.max(0, Math.min(1, Number(g.jumpChance ?? 0.35) || 0)),
    joinQuiet: g.joinQuiet !== false,
  };
}

const lastSelf = new Map(); // groupId -> ts
const hits = new Map(); // groupId -> [ts]

/** 是不是在跟她说话 */
function looksDirected(text) {
  const s = String(text || '');
  if (!s) return false;
  if (/(她说|鲸鱼娘|小鲸鱼|她在吗|她呢|她怎么)/.test(s)) return true;
  if (/^(她|你)(在|干嘛|干嘛呢|睡了|醒了吗)/.test(s)) return true;
  return false;
}

/**
 * 决定这句接不接
 * @returns {{jump:boolean, reason:string}}
 */
function decide({ groupId, text, isAt, selfId }) {
  const c = cfg();
  if (!c.enabled) return { jump: false, reason: 'off' };
  const gid = String(groupId || '');
  if (c.allowedGroups.length && !c.allowedGroups.includes(gid)) return { jump: false, reason: 'group-not-allowed' };

  // 有人明确点她 —— 一定接
  if (isAt || looksDirected(text)) return { jump: true, reason: 'called' };
  // 只接 @ 的保守模式
  if (c.atOnly) return { jump: false, reason: 'at-only' };

  const now = Date.now();
  const last = lastSelf.get(gid) || 0;
  if (now - last < c.cooldownSec * 1000) return { jump: false, reason: 'cooling' };

  const arr = (hits.get(gid) || []).filter((t) => now - t < 60000);
  if (arr.length >= c.maxPerMinute) return { jump: false, reason: 'rate-limited' };

  // 问句、感叹、@别人聊到她——更容易被搭话
  const s = String(text || '');
  const wonder = /[?？]|吗$|呢$|谁知道|有没有人|怎么办|求推荐/.test(s);
  const base = wonder ? Math.min(1, c.jumpChance * 1.6) : c.jumpChance;
  if (Math.random() < base) return { jump: true, reason: wonder ? 'question' : 'chance' };
  return { jump: false, reason: 'passed' };
}

/** 真接了之后记账（冷却 + 限速） */
function mark(groupId) {
  const gid = String(groupId || '');
  const now = Date.now();
  lastSelf.set(gid, now);
  const arr = (hits.get(gid) || []).filter((t) => now - t < 60000);
  arr.push(now);
  hits.set(gid, arr);
}

module.exports = { cfg, decide, mark, looksDirected };
