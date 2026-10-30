'use strict';
// 上下文层（A 跨会话衔接 / B 滚动摘要 / C 记忆卡跟着聊）
const inbox = require('./inbox');
const ai = require('./ai');
const db = require('./db');
const settings = require('./settings');
const logger = require('./logger');
const memcard = require('./memcard');

const GAP_MS = 45 * 60 * 1000; // 超过 45 分钟算"新的一次谈话"
const cache = new Map();
let turns = 0;

function txt(it) { return String((it && (it.text || it.content)) || ''); }
function role(it) { return (it && it.role) || 'user'; }
function at(it) { const t = it && (it.createdAt || it.created_at); const n = t ? Date.parse(t) : NaN; return Number.isFinite(n) ? n : 0; }

// B：把更早的一批压成一句话（本地小模型，失败就退化成"聊过 N 句"）
async function summarize(items) {
  const body = items.slice(-30).map((x) => (role(x) === 'user' ? '他：' : '你：') + txt(x)).join('\n');
  try {
    const provider = settings.getIn('model.active') === 'ollama' ? 'ollama' : 'ollama';
    const out = await ai.chat(provider, [
      { role: 'system', content: '你是聊天记录压缩器。把下面这段聊天压成 1~2 句中文，30 字以内，只写事实（聊了什么、他的近况、约定），不要评价。' },
      { role: 'user', content: body },
    ], { temperature: 0.2, maxTokens: 80, timeoutMs: 20000 });
    const s = String(out || '').replace(/\s+/g, ' ').trim();
    if (s && s.length <= 120) return s;
  } catch (e) { logger.debug('context: 摘要失败 ' + e.message); }
  return '前面你们还聊了 ' + items.length + ' 句，具体内容已经记不清了';
}

async function build(conversationId, limit) {
  const want = Math.max(4, limit || 8);
  let rows = [];
  try { rows = await inbox.messages(conversationId, want + 40); } catch (e) { logger.debug('context: 读历史失败 ' + e.message); }
  rows = Array.isArray(rows) ? rows : [];
  const asc = rows.slice().sort((a, b) => at(a) - at(b));
  const recent = asc.slice(-want);
  const older = asc.slice(0, Math.max(0, asc.length - want));

  // B：滚动摘要（按条数缓存，条数不变就不重算）
  let summary = '';
  if (older.length >= 6) {
    const key = conversationId + ':' + older.length;
    if (cache.has(key)) summary = cache.get(key);
    else {
      summary = await summarize(older);
      cache.set(key, summary);
      try { db.kvSet('ctx.sum.' + conversationId, JSON.stringify({ n: older.length, s: summary })); } catch (e) {}
    }
  } else {
    try {
      const raw = db.kvGet('ctx.sum.' + conversationId);
      if (raw) { const o = JSON.parse(raw); if (o && o.n < 6 && o.s) summary = ''; }
    } catch (e) {}
  }

  // A：跨会话衔接——找历史里最后一次"隔了很久"之前的 3 条
  let bridge = '';
  if (asc.length >= 2) {
    let cut = -1;
    for (let i = asc.length - 1; i >= 1; i--) {
      const gap = at(asc[i]) - at(asc[i - 1]);
      if (gap > GAP_MS) { cut = i; break; }
    }
    if (cut > 0) {
      const prev = asc.slice(Math.max(0, cut - 3), cut);
      if (prev.length) bridge = prev.map((x) => (role(x) === 'user' ? '他' : '你') + '：' + txt(x)).join('\n');
    }
  }

  // C：每 3 轮刷新一次记忆卡
  turns += 1;
  if (turns % 3 === 0) { try { await memcard.rebuild(); } catch (e) { logger.debug('context: 重建记忆卡失败 ' + e.message); } }

  return { recent, summary, bridge };
}

module.exports = { build };