'use strict';

/**
 * 主动聊天
 * ------------------------------------------------------------
 * 只在「只和谁互动」名单里的人之间发生。到点之后，从名单里挑一个人，
 * 让模型用当前人格主动说一句，发过去，记进收件箱，顺便涨经验。
 *
 * 默认关闭。开关、间隔、免打扰时段都能在「通道」页改。
 */

const settings = require('./settings');
const ai = require('./ai');
const personas = require('./personas');
const memory = require('./memory')
const memcard = require('./memcard');
const motive = require('./motive');
const stickers = require('./stickers');
const stickerRules = require('./stickerRules');
const inbox = require('./inbox');
const qq = require('./qq');
const growth = require('./growth');
const bond = require('./bond');
const log = require('./logger');

const DEFAULTS = {
  enabled: false,
  // 节奏：fixed = 固定间隔；curve = 概率曲线（距上次越久，越可能开口）
  mode: 'fixed',
  everyMinutes: 90,
  curveMaxMinutes: 720,
  curvePoints: null,
  quietFrom: '23:00',
  quietTo: '08:00',
  useSticker: true,
};

/**
 * 默认概率曲线（每 10 分钟掷一次骰子）
 * x = 距上次主动开口的分钟数，y = 这一次开口的概率（%）。
 * 形状按「人回消息」的感觉来：刚说完基本不追，一两个小时后开始惦记，
 * 到晚上最想说话，到上限就一定会说。
 */
const DEFAULT_CURVE = [
  [0, 0],
  [15, 1],
  [30, 3],
  [45, 6],
  [60, 9],
  [90, 16],
  [120, 24],
  [180, 40],
  [240, 54],
  [300, 64],
  [360, 72],
  [480, 83],
  [600, 89],
  [720, 93],
];

// 掷骰子的间隔（分钟）：曲线模式下每 10 分钟看一次
const ROLL_STEP_MINUTES = 10;

let timer = null;
// 上次主动说话的毫秒时间戳：存进设置，重启后不会一开软件就冒一句
let lastAt = Number(settings.getIn('channels.qq.proactive.lastAtMs')) || 0;
// 每个通道各自「上次掷骰子」的时间：qq 发消息、bili 私信推荐，节奏共用一套曲线
const rollAt = new Map();
let running = false;

/** 把外部给的曲线点洗成 [t, p] 的有序数组 */
function normalizeCurve(raw, maxMinutes) {
  const max = Math.max(15, Math.min(1439, Number(maxMinutes) || DEFAULTS.curveMaxMinutes));
  const pts = [];
  for (const p of Array.isArray(raw) ? raw : []) {
    if (!Array.isArray(p) || p.length < 2) continue;
    const t = Number(p[0]);
    const v = Number(p[1]);
    if (!Number.isFinite(t) || !Number.isFinite(v)) continue;
    pts.push([Math.max(0, Math.min(max, Math.round(t))), Math.max(0, Math.min(100, Math.round(v * 10) / 10))]);
  }
  pts.sort((a, b) => a[0] - b[0]);
  const out = [];
  for (const p of pts) {
    if (out.length && out[out.length - 1][0] === p[0]) out[out.length - 1] = p;
    else out.push(p);
  }
  if (!out.length) return DEFAULT_CURVE.map(([t, v]) => [Math.round(Math.min(max, t)), v]);
  if (out[0][0] > 0) out.unshift([0, 0]);
  if (out[out.length - 1][0] < max) out.push([max, 100]);
  // 概率不允许往回掉，不然「越久越可能」就不成立了
  for (let i = 1; i < out.length; i += 1) {
    if (out[i][1] < out[i - 1][1]) out[i][1] = out[i - 1][1];
  }
  return out;
}

function cfg() {
  const base = (settings.getIn('channels.qq.proactive') || {});
  const curveMaxMinutes = Math.max(15, Math.min(1439, Number(base.curveMaxMinutes) || DEFAULTS.curveMaxMinutes));
  return {
    enabled: !!base.enabled,
    mode: base.mode === 'curve' ? 'curve' : 'fixed',
    everyMinutes: Math.max(15, Math.min(720, Number(base.everyMinutes) || 90)),
    curveMaxMinutes,
    curvePoints: normalizeCurve(base.curvePoints || DEFAULT_CURVE, curveMaxMinutes),
    quietFrom: /^\d{2}:\d{2}$/.test(base.quietFrom) ? base.quietFrom : DEFAULTS.quietFrom,
    quietTo: /^\d{2}:\d{2}$/.test(base.quietTo) ? base.quietTo : DEFAULTS.quietTo,
    useSticker: base.useSticker !== false,
  };
}

function saveConfig(patch) {
  const cur = { ...DEFAULTS, ...(settings.getIn('channels.qq.proactive') || {}) };
  const p = patch || {};
  if ('enabled' in p) cur.enabled = !!p.enabled;
  if ('mode' in p) cur.mode = p.mode === 'curve' ? 'curve' : 'fixed';
  if ('everyMinutes' in p) cur.everyMinutes = Math.max(15, Math.min(720, Number(p.everyMinutes) || 90));
  if ('curveMaxMinutes' in p) cur.curveMaxMinutes = Math.max(15, Math.min(1439, Number(p.curveMaxMinutes) || DEFAULTS.curveMaxMinutes));
  if ('curvePoints' in p) cur.curvePoints = p.curvePoints;
  if ('quietFrom' in p) cur.quietFrom = String(p.quietFrom || DEFAULTS.quietFrom);
  if ('quietTo' in p) cur.quietTo = String(p.quietTo || DEFAULTS.quietTo);
  if ('useSticker' in p) cur.useSticker = !!p.useSticker;
  settings.patch({ channels: { qq: { proactive: cur } } });
  return cfg();
}

/** 距上次开口 minutes 分钟时，这一次（10 分钟一掷）开口的概率 % */
function probabilityAt(minutes, config) {
  const c = config || cfg();
  const pts = c.curvePoints;
  const t = Math.max(0, Number(minutes) || 0);
  if (!pts.length) return 0;
  if (t <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i += 1) {
    const [x1, y1] = pts[i];
    if (t <= x1) {
      const [x0, y0] = pts[i - 1];
      if (x1 === x0) return y1;
      return y0 + ((y1 - y0) * (t - x0)) / (x1 - x0);
    }
  }
  return pts[pts.length - 1][1];
}

function minutesOf(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ''));
  if (!m) return 0;
  return (Number(m[1]) % 24) * 60 + (Number(m[2]) % 60);
}

/** 现在是不是免打扰时间 */
function inQuietHours(now) {
  const c = cfg();
  const cur = now.getHours() * 60 + now.getMinutes();
  const from = minutesOf(c.quietFrom);
  const to = minutesOf(c.quietTo);
  if (from === to) return false;
  if (from < to) return cur >= from && cur < to;
  return cur >= from || cur < to; // 跨零点
}

function allowedUsers() {
  const list = settings.getIn('channels.qq.allowedUsers') || [];
  return (Array.isArray(list) ? list : []).map(String).filter(Boolean);
}

function pickUser() {
  const list = allowedUsers();
  if (!list.length) return '';
  // 优先挑最久没聊过的
  const scored = list.map((id) => {
    const g = growth.get(id);
    return { id, last: (g && g.lastAt) || 0 };
  });
  scored.sort((a, b) => a.last - b.last);
  return scored[0].id;
}

function dayPart(now) {
  const h = now.getHours();
  if (h < 6) return '凌晨';
  if (h < 11) return '早上';
  if (h < 14) return '中午';
  if (h < 18) return '下午';
  if (h < 22) return '晚上';
  return '深夜';
}

async function compose(userId) {
  const messages = [];
  const prompt = personas.promptOf() || '你是一只可爱的鲸鱼娘，说话自然、口语化。';
  const bondNote = bond.describe(userId, '');
  const mo = motive.hint();
  const sysBody = (bondNote ? prompt + '\n\n' + bondNote : prompt) + (mo ? '\n\n' + mo + '这次找主人，就从这件事上开口。' : '');
  messages.push({ role: 'system', content: sysBody });
  messages.push({
    role: 'system',
    content:
      '现在是' + dayPart(new Date()) + '。你要主动找对方说一句话，' +
      '不要问"在吗"、不要客套、不要一次说很多。' +
      '就像朋友随手发来一条消息：关心一句、说件小事、或者分享一点心情。' +
      '只输出你要说的那一条，20~40 个字，不要引号，不要解释。',
  });

  try {
    const hits = await memory.recall('最近 心情 想做的事', { k: 3, budget: 420 });
    if (hits.length) {
      messages.push({ role: 'system', content: '你记得这些事（别提「你上次说过」这种话）：\n' + hits.map((h) => '- ' + h.text).join('\n') });
    }
  } catch (_) { /* 没记忆也能聊 */ }

  const history = await inbox.messages(inbox.convIdOf({ message_type: 'private', user_id: userId }), 6);
  for (const h of history) {
    if (!h.text) continue;
    messages.push({ role: h.role === 'user' ? 'user' : 'assistant', content: h.text });
  }
  if (history.length) messages.push({ role: 'user', content: '（对方没说话，是你想主动找他说点什么）' });

  const provider = settings.getIn('model.active') || 'ollama';
  const text = (await ai.chat(provider, messages, { temperature: 0.9, maxTokens: 120 })).trim();
  return text;
}

async function sendTo(userId, opts) {
  const o = opts || {};
  const id = String(userId || '');
  if (!id) return { ok: false, error: '没填要发给谁' };
  if (!qq.status().online && !o.force) return { ok: false, error: 'QQ 还没连上' };
  try {
    let text = await compose(id);
    if (!text) return { ok: false, error: '模型没返回内容' };

    let payload = text;
    if (cfg().useSticker && Math.random() < Math.max(0.35, stickerRules.cfg().chance)) {
      try {
        const picked = stickerRules.pickFor(text);
        const st = picked && picked.sticker;
        if (st) payload += '\n' + stickers.cqOf(st.file);
      } catch (_) { /* 表情失败不影响文字 */ }
    }

    if (!o.dryRun) await qq.sendPrivate(id, payload);
    inbox.append(inbox.convIdOf({ message_type: 'private', user_id: id }), {
      senderId: qq.status().selfId,
      senderName: qq.status().selfName || '我',
      text,
      role: 'assistant',
    });
    const g = growth.bump(id, settings.getIn('growth.perProactive') || 2, '');
    try {
      if (settings.getIn('bond.enabled') !== false) {
        bond.bump(id, settings.getIn('bond.perProactive') || 2, '');
      }
    } catch (_) {
      /* 关系失败不影响发送 */
    }
    log.info('proactive: 已主动发给 ' + id + '（等级 ' + (g && g.level) + '）');
    return { ok: true, text, growth: g };
  } catch (err) {
    log.warn('proactive: 发送失败 —', err && err.message);
    return { ok: false, error: (err && err.message) || '发送失败' };
  }
}

/**
 * 这一次该不该开口（QQ 主动消息和 B 站私信推荐共用一套节奏）
 * @param {string} channel 'qq' | 'bili'（各自记掷骰子时间，互不打断）
 * @param {number} lastAtMs 这个通道上次主动开口的时间
 * @param {number} [nowMs] 便于测试传时间
 * @param {() => number} [rng] 便于测试注入随机数
 */
function decide(channel, lastAtMs, nowMs, rng) {
  const c = cfg();
  const now = Number(nowMs) || Date.now();
  const random = typeof rng === 'function' ? rng : Math.random;
  const key = String(channel || 'qq');
  if (!c.enabled) return { send: false, why: 'off', chance: 0, elapsedMin: 0 };
  if (inQuietHours(new Date(now))) return { send: false, why: 'quiet', chance: 0, elapsedMin: 0 };

  const last = Number(lastAtMs) || 0;
  const elapsedMin = last ? (now - last) / 60000 : c.curveMaxMinutes;

  if (c.mode === 'curve') {
    // 每 10 分钟只掷一次骰子，1 分钟一跳的定时器不会把概率放大 10 倍
    const prev = rollAt.get(key) || 0;
    if (prev && now - prev < ROLL_STEP_MINUTES * 60 * 1000) {
      return { send: false, why: 'waiting', chance: 0, elapsedMin };
    }
    rollAt.set(key, now);
    const chance = elapsedMin >= c.curveMaxMinutes ? 100 : probabilityAt(elapsedMin, c);
    return { send: random() * 100 < chance, why: 'curve', chance, elapsedMin };
  }

  if (elapsedMin < c.everyMinutes) return { send: false, why: 'fixed-wait', chance: 100, elapsedMin };
  return { send: true, why: 'fixed', chance: 100, elapsedMin };
}

function tick() {
  if (running) return;
  const c = cfg();
  if (!c.enabled) return;
  if (!decide('qq', lastAt).send) return;

  const user = pickUser();
  if (!user) return;
  running = true;
  lastAt = Date.now();
  try {
    // 记下来，重启软件后不会一开就冒一句
    settings.patch({ channels: { qq: { proactive: { lastAtMs: lastAt } } } });
  } catch (_) {}
  sendTo(user, {})
    .then((r) => {
      if (r && !r.ok) log.warn('proactive: 这一条没发出去 — ' + (r.error || '未知原因'));
    })
    .catch((err) => log.warn('proactive: 发送出错 — ' + (err && err.message)))
    .finally(() => { running = false; });
}

function start() {
  stop();
  // 这个模块在 settings.load() 之前就被 require 了，模块顶层读到的设置是空的；
  // 启动时再读一次，不然每次重启都把「上次开口时间」重置成现在，曲线永远从 0 开始。
  const saved = Number(settings.getIn('channels.qq.proactive.lastAtMs')) || 0;
  if (saved) lastAt = saved;
  // 从没主动说过话时，从「现在」开始算，不然刚开软件（尤其早上过 8 点）会立刻冒一句
  if (!lastAt) {
    lastAt = Date.now();
    try {
      settings.patch({ channels: { qq: { proactive: { lastAtMs: lastAt } } } });
    } catch (_) {}
  }
  timer = setInterval(tick, 60 * 1000);
  if (timer.unref) timer.unref();
  const c = cfg();
  log.info(
    'proactive: 已启动（' +
      (c.mode === 'curve'
        ? '概率曲线，每 ' + ROLL_STEP_MINUTES + ' 分钟掷一次骰子，上限 ' + c.curveMaxMinutes + ' 分钟'
        : '固定间隔，每 ' + c.everyMinutes + ' 分钟检查一次') +
      '）',
  );
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
  rollAt.clear();
}

module.exports = {
  cfg,
  saveConfig,
  start,
  stop,
  sendTo,
  decide,
  inQuietHours,
  allowedUsers,
  pickUser,
  probabilityAt,
  DEFAULT_CURVE,
  ROLL_STEP_MINUTES,
};
