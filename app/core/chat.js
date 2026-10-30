'use strict';

/**
 * 本地对话
 * ------------------------------------------------------------
 * 不经过 QQ / B 站，直接在客户端里跟她说话。
 * 作用有两个：
 *   1) 还没装 NapCat 的时候，也能验证「人设 + 记忆 + 关系 + 表情」这一整套是不是通的；
 *   2) 想私下跟她说两句，不用占一个 QQ 会话。
 *
 * 走的是和 QQ 自动回复完全相同的脑子（人格 / 记忆 / 关系 / 成长 / 自动记忆），
 * 区别只是「发出去」这一步换成本地落库。
 */

const db = require('./db');
const ai = require('./ai');
const memory = require('./memory')
const memcard = require('./memcard');
const archive = require('./archive');
const personas = require('./personas');
const bond = require('./bond');
const growth = require('./growth');
const distill = require('./distill');
const stickerRules = require('./stickerRules');
const qzoneIntent = require('./qzoneIntent');
const settings = require('./settings');
const log = require('./logger');

const CONV = 'local:main';
const WHO = '主人';

function ensureConv() {
  const now = Date.now();
  const row = db.get('SELECT id FROM conversations WHERE id = ?', CONV);
  if (!row) {
    db.run(
      'INSERT OR REPLACE INTO conversations (id, channel, account, title, kind, avatar, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      CONV,
      'local',
      '',
      '本机对话',
      'private',
      '',
      now,
    );
  }
}

function append(role, text) {
  ensureConv();
  const now = Date.now();
  db.run(
    'INSERT INTO messages (channel, account, conversation_id, sender_id, sender_name, content, raw, role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    'local',
    '',
    CONV,
    role === 'user' ? 'me' : 'her',
    role === 'user' ? '我' : '她',
    String(text || ''),
    '',
    role,
    now,
  );
  db.run('UPDATE conversations SET updated_at = ? WHERE id = ?', now, CONV);
}

function history(limit) {
  ensureConv();
  const n = Math.max(1, Math.min(200, Number(limit) || 60));
  const rows = db.all(
    'SELECT role, content, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC, rowid ASC LIMIT ?',
    CONV,
    n,
  );
  return rows.map((r) => ({ role: r.role, text: r.content, createdAt: r.created_at }));
}

function hourWord() {
  const h = new Date().getHours();
  if (h < 5) return '凌晨';
  if (h < 9) return '早上';
  if (h < 12) return '上午';
  if (h < 14) return '中午';
  if (h < 18) return '下午';
  if (h < 23) return '晚上';
  return '深夜';
}

function buildSystem(extra) {
  const pid = settings.getIn('personas.activeId') || 'whale-girl';
  const persona = personas.promptOf(pid) || '';
  const rel = bond.describe('local', WHO);
  const lines = [
    persona,
    rel,
    '现在是' + hourWord() + '。你现在是在客户端里跟' + WHO + '私聊，不是客服，不要列条目、不要解释你自己。',
    '回话短一点，一般一到三句。语气自然，可以用语气词。',
  ];
  if (extra) lines.push(extra);
  return lines.filter(Boolean).join('\n');
}

async function say(text) {
  const input = String(text || '').trim();
  if (!input) throw new Error('说点什么再发');
  ensureConv();

  const memLine = await memory.snapshot(input, { k: 5, budget: 700 }).catch(() => '');
  const memBlock = memLine ? '你记得这些事：\n' + memLine : '';

  append('user', input);

  // 「发说说」不是闲聊：认出来就直接去发。不然模型只会嘴上说「发不了」
  const zi = qzoneIntent.detect(input);
  if (zi) {
    let body = zi.body;
    let reply = '';
    try {
      if (!body) body = await qzoneIntent.compose();
      await qzoneIntent.publish(body);
      const preview = body.length > 40 ? body.slice(0, 40) + '…' : body;
      reply = '发好了：「' + preview + '」';
    } catch (err) {
      reply = '没发出去：' + ((err && err.message) || '空间接口没接上');
    }
    append('assistant', reply);
    const g0 = settings.getIn('growth') || {};
    try {
      growth.bump('local', Number(g0.perReply) || 1, WHO);
      bond.bump('local', Number(g0.perReply) || 1, WHO);
    } catch (_) {
      /* 涨经验失败不影响回话 */
    }
    return { reply, sticker: null, bond: bond.get('local'), growth: growth.get('local') };
  }

  const recent = history(9).slice(0, -1);
  const messages = [{ role: 'system', content: buildSystem(memBlock) }];
  for (const m of recent) messages.push({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text });
  messages.push({ role: 'user', content: input });

  const pid = settings.getIn('model.active') || 'ollama';
  let reply = '';
  try {
    reply = String(await ai.chat(pid, messages, { temperature: 0.85, maxTokens: 300, timeoutMs: 60000 })).trim();
  } catch (err) {
    log.warn('chat: 模型没回上来 — ' + (err && err.message));
    reply = '（模型没接上：' + ((err && err.message) || '未知原因') + '）';
  }
  if (!reply) reply = '……嗯？（模型这次什么都没说）';

  append('assistant', reply);

  const g = settings.getIn('growth') || {};
  try {
    growth.bump('local', Number(g.perReply) || 1, WHO);
    bond.bump('local', Number(g.perReply) || 1, WHO);
  } catch (err) {
    log.debug('chat: 成长/关系更新失败 — ' + (err && err.message));
  }

  // 自动记事（不拦着回话，失败了也不影响）
  distill.learn({ userText: input, answer: reply, name: WHO }).catch(() => {});

  let sticker = null;
  try {
    const pick = stickerRules.pickFor(reply);
    if (pick && pick.sticker) sticker = pick.sticker;
  } catch (_) {
    sticker = null;
  }

  return {
    reply,
    sticker,
    bond: bond.get('local'),
    growth: growth.get('local'),
  };
}

/** 让她主动说一句（本地对话用，不依赖 QQ） */
async function proactiveOnce(reason) {
  const memLine = await memory.snapshot('心情 喜欢 最近', { k: 3, budget: 420 }).catch(() => '');
  const sys = buildSystem(
    (memLine ? '你记得这些事：\n' + memLine + '\n' : '') +
      '你想主动找' + WHO + '说句话' + (reason ? '（' + reason + '）' : '') + '。只输出你要说的那一句，20~40 个字，别问「在吗」。',
  );
  const pid = settings.getIn('model.active') || 'ollama';
  let text = '';
  try {
    text = String(
      await ai.chat(pid, [{ role: 'system', content: sys }, { role: 'user', content: '说吧。' }], {
        temperature: 0.95,
        maxTokens: 160,
        timeoutMs: 45000,
      }),
    ).trim();
  } catch (err) {
    throw new Error('模型没回上来：' + ((err && err.message) || '未知原因'));
  }
  if (!text) throw new Error('这次没想出来说什么');
  append('assistant', text);
  const g = settings.getIn('growth') || {};
  try {
    growth.bump('local', Number(g.perProactive) || 2, WHO);
    bond.bump('local', Number(g.perProactive) || 2, WHO);
  } catch (_) {}
  return { reply: text };
}

function clear() {
  db.run('DELETE FROM messages WHERE conversation_id = ?', CONV);
  return { ok: true };
}

module.exports = { say, history, clear, proactiveOnce, CONV };
