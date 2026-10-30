'use strict';

/**
 * 关系（好感度 + 今日状态）
 * ------------------------------------------------------------
 * 成长（growth）记的是"聊了多少、几级了"，是数值。
 * 关系（bond）记的是"现在什么感觉"，会改变她说话的温度。
 *
 * 好感分 0~100，默认 30 起步：
 *   0-19 陌生 · 20-39 眼熟 · 40-59 朋友 · 60-79 要好 · 80-100 亲密
 *
 * 每天第一次用到时，给她生成一份"今天的她"（心情 + 想干的事），
 * 当天一直沿用 —— 这样她每天醒来不是一张白纸。
 */

const db = require('./db');
const settings = require('./settings');
const log = require('./logger');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS bonds (
  user_id    TEXT PRIMARY KEY,
  name       TEXT,
  score      INTEGER NOT NULL DEFAULT 30,
  mood       TEXT,
  wish       TEXT,
  mood_date  TEXT,
  channel    TEXT DEFAULT 'qq',
  updated_at INTEGER NOT NULL
);
`;

const LEVELS = [
  { min: 0, zh: '陌生', en: 'stranger' },
  { min: 20, zh: '眼熟', en: 'familiar' },
  { min: 40, zh: '朋友', en: 'friend' },
  { min: 60, zh: '要好', en: 'close' },
  { min: 80, zh: '亲密', en: 'intimate' },
];

// 心情池：不想每次都喊模型，够用、稳、零成本
const MOODS = [
  { mood: '心情不错，尾巴一直摆', wish: '想找点好吃的' },
  { mood: '有点犯困，说话慢半拍', wish: '想趴着听人说话' },
  { mood: '精神很好，什么都想问一句', wish: '想听点新鲜事' },
  { mood: '有点小得意，刚做成了一件事', wish: '想被夸两句' },
  { mood: '懒洋洋的，不想动', wish: '想被人哄一哄' },
  { mood: '有点闹脾气，嘴上不服软', wish: '想被让一步' },
  { mood: '安静，想一个人待着', wish: '想听你说说今天' },
  { mood: '很亢奋，想出去玩', wish: '想去看看外面' },
  { mood: '有点饿，注意力不集中', wish: '想听你报菜名' },
  { mood: '心里软软的', wish: '想被陪着说会儿话' },
  { mood: '在琢磨事情，说话会比较直', wish: '想找人辩论一下' },
  { mood: '刚睡醒，还没缓过来', wish: '想被随口问一句' },
];

const DEFAULT_SCORE = 30;
let ready = false;

function ensure() {
  if (ready) return;
  try {
    db.exec(SCHEMA);
  } catch (err) {
    log.ex('bond: 建表失败', err);
  }
  ready = true;
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function clamp(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return DEFAULT_SCORE;
  return Math.max(0, Math.min(100, Math.round(v)));
}

function labelOf(score) {
  const s = clamp(score);
  let out = LEVELS[0];
  for (const lv of LEVELS) if (s >= lv.min) out = lv;
  return out;
}

function emptyRow(userId, name) {
  return {
    userId: String(userId || ''),
    name: name || '',
    score: DEFAULT_SCORE,
    mood: '',
    wish: '',
    moodDate: '',
    updatedAt: 0,
  };
}

function fromRow(row) {
  if (!row) return null;
  return {
    userId: row.user_id,
    channel: row.channel || 'qq',
    name: row.name || '',
    score: row.score,
    mood: row.mood || '',
    wish: row.wish || '',
    moodDate: row.mood_date || '',
    updatedAt: row.updated_at || 0,
  };
}

function persist(item) {
  if (!item || !item.userId) return;
  if (db.backend !== 'sqlite') return; // JSON 兜底模式下关系不落盘，不影响运行
  db.run(
    `INSERT INTO bonds (user_id, name, score, mood, wish, mood_date, channel, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       name = excluded.name, score = excluded.score,
       mood = excluded.mood, wish = excluded.wish,
       mood_date = excluded.mood_date, updated_at = excluded.updated_at`,
    item.userId,
    item.name || '',
    clamp(item.score),
    item.mood || '',
    item.wish || '',
    item.moodDate || '',
    item.channel || 'qq',
    Date.now(),
  );
}

function readRow(userId) {
  if (db.backend !== 'sqlite') return null;
  return db.get('SELECT * FROM bonds WHERE user_id = ?', String(userId || ''));
}

/** 当天的"她"：心情 + 想干的事，一天只生成一次 */
function ensureToday(item, force) {
  if (!item) return item;
  const day = today();
  if (!force && item.moodDate === day && item.mood) return item;
  const pick = MOODS[Math.floor(Math.random() * MOODS.length)];
  item.mood = pick.mood;
  item.wish = pick.wish;
  item.moodDate = day;
  if (settings.getIn('bond.enabled') === false) {
    item.mood = '';
    item.wish = '';
  }
  persist(item);
  return item;
}

const bond = {
  levels: LEVELS,

  ensure() {
    ensure();
  },

  stats() {
    ensure();
    const rows = db.backend === 'sqlite' ? db.all('SELECT * FROM bonds') : [];
    return { count: rows.length, day: today() };
  },

  get(userId) {
    ensure();
    const id = String(userId || '');
    if (!id) return null;
    let item = fromRow(readRow(id));
    if (!item) item = emptyRow(id, '');
    item = ensureToday(item, false);
    item.level = labelOf(item.score);
    return item;
  },

  list(limit) {
    ensure();
    const n = Math.max(1, Math.min(200, Number(limit) || 50));
    if (db.backend !== 'sqlite') return [];
    return db
      .all('SELECT * FROM bonds ORDER BY score DESC, updated_at DESC LIMIT ?', n)
      .map((r) => {
        const it = fromRow(r);
        it.level = labelOf(it.score);
        return it;
      });
  },

  /** 涨/跌好感，返回最新状态与变化量 */
  bump(userId, delta, name, channel) {
    ensure();
    const id = String(userId || '');
    if (!id) return null;
    const before = bond.get(id);
    const d = Math.max(-20, Math.min(20, Math.round(Number(delta) || 0)));
    const after = {
      ...before,
      name: name || before.name,
      score: clamp(before.score + d),
    };
    after.level = labelOf(after.score);
    persist(after);
    return { ...after, changed: after.score - before.score, leveledUp: after.level.zh !== before.level.zh };
  },

  /** 强制换一个今天的心情（调试/手动用） */
  rollMood(userId) {
    ensure();
    const id = String(userId || '');
    const item = bond.get(id) || emptyRow(id, '');
    return ensureToday(item, true);
  },

  reset(userId) {
    ensure();
    const id = String(userId || '');
    if (db.backend === 'sqlite') db.run('DELETE FROM bonds WHERE user_id = ?', id);
    return bond.get(id);
  },

  /** 拼一段给模型的状态说明 */
  describe(userId, name) {
    const it = bond.get(userId);
    if (!it) return '';
    const who = name || it.name || '对方';
    const lines = [`你和 ${who} 的关系：${it.level.zh}（好感 ${it.score}/100）。`];
    if (it.mood) lines.push(`你今天的状态：${it.mood}${it.wish ? '，' + it.wish : ''}。`);
    if (it.score >= 60) lines.push('你们很熟了，可以更随意、更亲近一点，偶尔开个玩笑。');
    else if (it.score <= 15) lines.push('你们还不太熟，别太热络，也别太冷淡。');
    return lines.join('\n');
  },
};

module.exports = bond;
