'use strict';

/**
 * 用量统计：每次模型调用记一笔，给总览页画图用。
 *
 * 只记"本地能看到的"东西：谁调的、用了哪个模型、多少 token、花了多久、成没成功。
 * 不记聊天内容（隐私），要看重量的自己去看日志/收件箱。
 */

const db = require('./db');
const log = require('./logger');

const TABLE = `
  CREATE TABLE IF NOT EXISTS usage_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL DEFAULT 'chat',
    provider TEXT,
    model TEXT,
    prompt_tokens INTEGER DEFAULT 0,
    completion_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    ms INTEGER DEFAULT 0,
    ok INTEGER DEFAULT 1,
    msgs INTEGER DEFAULT 0,
    sys_chars INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL
  )
`;

let ready = false;

function ensure() {
  if (ready) return;
  try {
    db.exec(TABLE);
    db.exec('CREATE INDEX IF NOT EXISTS idx_usage_time ON usage_log(created_at)');
    // 只留最近 120 天，别让表无限长
    db.run('DELETE FROM usage_log WHERE created_at < ?', Date.now() - 120 * 24 * 3600 * 1000);
    ready = true;
  } catch (err) {
    log.ex('usage: 建表失败', err);
  }
}

function dayKey(ts) {
  const d = new Date(ts);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return d.getFullYear() + '-' + m + '-' + day;
}

/** 记一笔（ai.chat / ai.embed 里调） */
function record(entry) {
  ensure();
  const e = entry || {};
  const now = Date.now();
  const prompt = Math.max(0, Number(e.promptTokens) || 0);
  const completion = Math.max(0, Number(e.completionTokens) || 0);
  const total = Math.max(prompt + completion, Number(e.totalTokens) || 0);
  try {
    db.run(
      `INSERT INTO usage_log
        (kind, provider, model, prompt_tokens, completion_tokens, total_tokens, ms, ok, msgs, sys_chars, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      String(e.kind || 'chat'),
      String(e.provider || ''),
      String(e.model || ''),
      prompt,
      completion,
      total,
      Math.max(0, Number(e.ms) || 0),
      e.ok === false ? 0 : 1,
      Math.max(0, Number(e.msgs) || 0),
      Math.max(0, Number(e.sysChars) || 0),
      now,
    );
  } catch (err) {
    log.ex('usage: 记录失败', err);
    return null;
  }

  // 最近一次请求的"上下文长什么样"，给总览页展示
  if (e.kind !== 'embed') {
    try {
      db.kvSet(
        'usage.lastCtx',
        JSON.stringify({
          provider: String(e.provider || ''),
          model: String(e.model || ''),
          msgs: Math.max(0, Number(e.msgs) || 0),
          sysChars: Math.max(0, Number(e.sysChars) || 0),
          promptTokens: prompt,
          completionTokens: completion,
          ms: Math.max(0, Number(e.ms) || 0),
          at: now,
        }),
      );
    } catch (_) {
      /* ignore */
    }
  }
  return true;
}

/** 概览：今天 + 最近 N 天 + 按模型分组 */
function stats(days) {
  ensure();
  const span = Math.min(60, Math.max(1, Number(days) || 7));
  const now = Date.now();
  const dayMs = 24 * 3600 * 1000;

  const buckets = [];
  for (let i = span - 1; i >= 0; i--) {
    const ts = now - i * dayMs;
    buckets.push({ date: dayKey(ts), label: dayKey(ts).slice(5), total: 0, req: 0, fail: 0 });
  }
  const index = new Map(buckets.map((b, i) => [b.date, i]));

  let rows = [];
  try {
    rows = db.all(
      'SELECT * FROM usage_log WHERE created_at >= ? ORDER BY created_at DESC LIMIT 5000',
      now - span * dayMs,
    );
  } catch (err) {
    log.ex('usage: 统计失败', err);
  }

  const todayKey = dayKey(now);
  const today = { req: 0, prompt: 0, completion: 0, total: 0, fail: 0, msSum: 0, msCount: 0 };
  const byModel = new Map();

  for (const r of rows || []) {
    const key = dayKey(r.created_at);
    const i = index.get(key);
    if (i != null) {
      buckets[i].total += Number(r.total_tokens) || 0;
      buckets[i].req += 1;
      if (!r.ok) buckets[i].fail += 1;
    }
    if (key === todayKey) {
      today.req += 1;
      today.prompt += Number(r.prompt_tokens) || 0;
      today.completion += Number(r.completion_tokens) || 0;
      today.total += Number(r.total_tokens) || 0;
      if (!r.ok) today.fail += 1;
      if (r.ok && r.ms) {
        today.msSum += Number(r.ms);
        today.msCount += 1;
      }
    }
    const mk = (r.provider || '?') + ' / ' + (r.model || '?');
    const cur = byModel.get(mk) || { name: mk, req: 0, total: 0 };
    cur.req += 1;
    cur.total += Number(r.total_tokens) || 0;
    byModel.set(mk, cur);
  }

  let lastCtx = null;
  try {
    const raw = db.kvGet('usage.lastCtx');
    lastCtx = raw ? JSON.parse(raw) : null;
  } catch (_) {
    lastCtx = null;
  }

  return {
    today: {
      ...today,
      avgMs: today.msCount ? Math.round(today.msSum / today.msCount) : 0,
    },
    days: buckets,
    byModel: [...byModel.values()].sort((a, b) => b.req - a.req).slice(0, 5),
    lastCtx,
    sample: (rows || []).slice(0, 8).map((r) => ({
      at: r.created_at,
      provider: r.provider,
      model: r.model,
      prompt: Number(r.prompt_tokens) || 0,
      completion: Number(r.completion_tokens) || 0,
      total: Number(r.total_tokens) || 0,
      ms: Number(r.ms) || 0,
      ok: !!r.ok,
    })),
    hasData: (rows || []).length > 0,
  };
}

module.exports = { ensure, record, stats };
