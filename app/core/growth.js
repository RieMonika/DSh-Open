'use strict';

/**
 * 成长系统
 * ------------------------------------------------------------
 * 每和指定用户互动一次就涨经验：聊得越多，等级越高。
 * 数据存本地 SQLite（表 growth），没有网络也能算。
 *
 * 经验值 → 等级：等级 n 需要的总经验是 20 * (n-1)^2。
 * 所以 0 级起：20→2 级 … 等到 20 级要 7220 经验。
 */

const db = require('./db');
const log = require('./logger');

const TABLE = `
  CREATE TABLE IF NOT EXISTS growth (
    user_id    TEXT PRIMARY KEY,
    name       TEXT,
    points     INTEGER NOT NULL DEFAULT 0,
    level      INTEGER NOT NULL DEFAULT 1,
    last_at    INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT 0
  );
`;

let ready = false;

function ensure() {
  if (ready) return;
  try {
    db.exec(TABLE);
    ready = true;
  } catch (err) {
    log.warn('growth: 建表失败 —', err && err.message);
  }
}

function threshold(level) {
  const lv = Math.max(1, Number(level) || 1);
  return 20 * (lv - 1) * (lv - 1);
}

function levelOf(points) {
  const p = Math.max(0, Number(points) || 0);
  return Math.max(1, Math.floor(Math.sqrt(p / 20)) + 1);
}

function nextNeed(points) {
  const lv = levelOf(points);
  return Math.max(1, threshold(lv + 1) - Math.max(0, Number(points) || 0));
}

function get(userId) {
  ensure();
  const id = String(userId || '');
  if (!id) return null;
  let row;
  try {
    row = db.get('SELECT * FROM growth WHERE user_id = ?', id);
  } catch (_) {
    return null;
  }
  if (!row) return { userId: id, points: 0, level: 1, progress: 0, next: 20, lastAt: 0 };
  const cur = {};
  for (const k of ['user_id', 'name', 'points', 'level', 'last_at', 'updated_at']) cur[k] = row[k];
  const base = threshold(cur.level);
  const top = threshold(cur.level + 1);
  const span = Math.max(1, top - base);
  return {
    userId: id,
    name: cur.name || '',
    points: cur.points,
    level: cur.level,
    progress: Math.min(1, Math.max(0, (cur.points - base) / span)),
    next: Math.max(0, top - cur.points),
    lastAt: cur.last_at || 0,
  };
}

/** 涨经验；返回涨完的状态 + 有没有升级 */
function bump(userId, delta, name) {
  ensure();
  const id = String(userId || '');
  if (!id) return null;
  const d = Math.max(0, Math.min(100, Number(delta) || 0));
  const before = get(id) || { points: 0, level: 1 };
  const points = before.points + d;
  const level = levelOf(points);
  const now = Date.now();
  try {
    db.run(
      `INSERT INTO growth (user_id, name, points, level, last_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         points = excluded.points,
         level  = excluded.level,
         last_at = excluded.last_at,
         updated_at = excluded.updated_at,
         name = COALESCE(NULLIF(excluded.name, ''), growth.name)`,
      id, String(name || ''), points, level, now, now
    );
  } catch (err) {
    log.warn('growth: 写入失败 —', err && err.message);
  }
  const after = get(id);
  return { ...after, gained: d, leveledUp: level > before.level };
}

function list(limit) {
  ensure();
  const n = Math.max(1, Math.min(200, Number(limit) || 50));
  let rows = [];
  try {
    rows = db.all('SELECT * FROM growth ORDER BY points DESC LIMIT ' + n);
  } catch (_) {
    rows = [];
  }
  return rows.map((r) => ({
    userId: r.user_id,
    name: r.name || '',
    points: r.points,
    level: r.level,
    lastAt: r.last_at || 0,
  }));
}

function reset(userId) {
  ensure();
  try {
    if (userId) db.run('DELETE FROM growth WHERE user_id = ?', String(userId));
    else db.run('DELETE FROM growth');
  } catch (err) {
    log.warn('growth: 重置失败 —', err && err.message);
  }
  return true;
}

module.exports = { ensure, get, bump, list, reset, levelOf, threshold, nextNeed };
