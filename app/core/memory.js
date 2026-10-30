'use strict';

/**
 * 记忆（v2）
 * ------------------------------------------------------------
 * 目标：聊得越久，她越像记得你，而不是几天就失忆。
 *
 * 三层结构：
 *   1) 原始对话（messages 表）—— 永远留着，能追能溯；
 *   2) 记忆条目（memories 表）—— 从对话里提炼出来的事实/偏好/事件/约定，
 *      每条带「重要度、来源、被用次数、强度」；
 *   3) 召回 = 语义相似度 + 重要度 + 时间衰减 + 使用次数，
 *      再加一个「长期画像」小块（置顶/高重要度的条目）永远带上。
 *
 * 遗忘不是删除：按艾宾浩斯曲线算「还能记住多少」，
 * 低于阈值且太久没被想起 → archived=1（归档），界面上还能翻出来。
 *
 * 存法：
 *   local       —— 只存本地 SQLite，关键词检索，不联网
 *   ollama      —— 存本地，向本机 Ollama 要向量，按语义检索
 *   siliconflow —— 存本地，向硅基流动要向量，按语义检索
 * 导出/导入是本机 JSON；想备份到云端就给个 WebDAV/HTTP 地址（PUT 一份 JSON）。
 */

const fs = require('node:fs');
const path = require('node:path');
const db = require('./db');
const ai = require('./ai');
const settings = require('./settings');
const log = require('./logger');
const P = require('./paths');

const KINDS = ['fact', 'pref', 'event', 'bond', 'plan', 'other'];

const SCHEMA = `
CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  tags TEXT,
  vector TEXT,
  created_at INTEGER NOT NULL,
  kind TEXT DEFAULT 'fact',
  importance INTEGER DEFAULT 5,
  source TEXT DEFAULT 'manual',
  conversation_id TEXT DEFAULT '',
  last_used_at INTEGER DEFAULT 0,
  used_count INTEGER DEFAULT 0,
  strength REAL DEFAULT 1,
  pinned INTEGER DEFAULT 0,
  archived INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_memories_created ON memories(created_at);
`;

/** 老库升级：缺哪列补哪列 */
const MIGRATE = [
  ['kind', "TEXT DEFAULT 'fact'"],
  ['importance', 'INTEGER DEFAULT 5'],
  ['source', "TEXT DEFAULT 'manual'"],
  ['conversation_id', "TEXT DEFAULT ''"],
  ['last_used_at', 'INTEGER DEFAULT 0'],
  ['used_count', 'INTEGER DEFAULT 0'],
  ['strength', 'REAL DEFAULT 1'],
  ['pinned', 'INTEGER DEFAULT 0'],
  ['archived', 'INTEGER DEFAULT 0'],
];

let ready = false;

function ensure() {
  if (ready) return;
  try {
    db.exec(SCHEMA);
    const cols = db.all('PRAGMA table_info(memories)').map((c) => c.name);
    for (const [name, type] of MIGRATE) {
      if (!cols.includes(name)) {
        db.exec(`ALTER TABLE memories ADD COLUMN ${name} ${type}`);
        log.info('memory: 表结构升级，补列 ' + name);
      }
    }
  } catch (err) {
    log.ex('memory: 建表/升级失败', err);
  }
  ready = true;
}

const isSqlite = () => db.backend === 'sqlite';

// ---------------------------------------------------------------------------
// 配置
// ---------------------------------------------------------------------------

function cfg() {
  const m = settings.getIn('model.memory') || {};
  return {
    backend: ['local', 'ollama', 'siliconflow'].includes(m.backend) ? m.backend : 'local',
    topK: Math.max(1, Math.min(20, Number(m.topK) || 5)),
  };
}

function recallCfg() {
  const r = settings.getIn('memory.recall') || {};
  return {
    k: Math.max(1, Math.min(12, Number(r.k) || 5)),
    budget: Math.max(200, Math.min(2400, Number(r.budget) || 700)),
    profileBudget: Math.max(0, Math.min(600, Number(r.profileBudget) || 220)),
  };
}

function decayCfg() {
  const d = settings.getIn('memory.decay') || {};
  return {
    enabled: d.enabled !== false,
    halfLifeDays: Math.max(3, Math.min(365, Number(d.halfLifeDays) || 30)),
    archiveBelow: Math.max(0.05, Math.min(0.8, Number(d.archiveBelow) || 0.28)),
    minAgeDays: Math.max(1, Math.min(365, Number(d.minAgeDays) || 21)),
  };
}

function saveDecayCfg(patch) {
  const cur = { ...decayCfg(), ...(settings.getIn('memory.decay') || {}) };
  const p = patch || {};
  if ('enabled' in p) cur.enabled = !!p.enabled;
  if ('halfLifeDays' in p) cur.halfLifeDays = Math.max(3, Math.min(365, Number(p.halfLifeDays) || 30));
  if ('archiveBelow' in p) cur.archiveBelow = Math.max(0.05, Math.min(0.8, Number(p.archiveBelow) || 0.28));
  if ('minAgeDays' in p) cur.minAgeDays = Math.max(1, Math.min(365, Number(p.minAgeDays) || 21));
  settings.patch({ memory: { decay: cur } });
  return decayCfg();
}

function backupCfg() {
  const b = settings.getIn('memory.backup') || {};
  return {
    url: String(b.url || ''),
    lastAt: Number(b.lastAt) || 0,
    lastOk: !!b.lastOk,
    lastError: String(b.lastError || ''),
  };
}

function saveBackupCfg(patch) {
  const cur = { ...backupCfg(), ...(settings.getIn('memory.backup') || {}) };
  const p = patch || {};
  if ('url' in p) cur.url = String(p.url || '').trim();
  settings.patch({ memory: { backup: cur } });
  return backupCfg();
}

// ---------------------------------------------------------------------------
// JSON 兜底（只有 node:sqlite 不可用时才会走到）
// ---------------------------------------------------------------------------

function jitems() {
  return Array.isArray(settings.getIn('memoryFallback.items')) ? settings.getIn('memoryFallback.items') : [];
}
function jsave(items) {
  settings.patch({ memoryFallback: { items: items.slice(0, 800) } });
}

// ---------------------------------------------------------------------------
// 基础工具
// ---------------------------------------------------------------------------

function newId() {
  return 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function cosine(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || !a.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/** 关键词打分：整句命中最高；否则按「词块」命中比例，再加一点字面重合 */
function keywordScore(text, q) {
  const t = String(text || '').toLowerCase();
  const query = String(q || '').toLowerCase().trim();
  if (!t || !query) return 0;
  if (t.includes(query.replace(/\s+/g, ''))) return 1;

  const tokens = query.split(/[\s,，、;；/|]+/).filter((x) => x.length >= 2);
  if (tokens.length) {
    const hit = tokens.filter((tok) => t.includes(tok)).length;
    const chars = [...new Set(query.replace(/[\s,，、;；/|]/g, ''))].filter((c) => c.trim());
    const chr = chars.length ? chars.filter((c) => t.includes(c)).length / chars.length : 0;
    return Math.min(1, (hit / tokens.length) * 0.9 + chr * 0.12);
  }

  const chars = [...new Set(query.split(''))].filter((c) => c.trim());
  if (!chars.length) return 0;
  const hit = chars.filter((c) => t.includes(c)).length;
  return (hit / chars.length) * 0.55;
}

function withPrefix(text, kind) {
  const { backend } = cfg();
  if (backend !== 'ollama') return text;
  const model = ((ai.get(backend) || {}).embeddingModel || '').toLowerCase();
  if (!model.includes('nomic')) return text;
  return (kind === 'query' ? 'search_query: ' : 'search_document: ') + text;
}

async function embedOne(text) {
  const { backend } = cfg();
  if (backend === 'local') return null;
  try {
    const vectors = await ai.embed(backend, [withPrefix(text, 'doc')]);
    return vectors && vectors[0] && vectors[0].length ? vectors[0] : null;
  } catch (err) {
    log.warn('memory: 拿向量失败，这条按纯文本存 —', err && err.message);
    return null;
  }
}

function asInt(v, d) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : d;
}

function rowToItem(r) {
  let vec = null;
  if (r.vector) {
    try {
      vec = JSON.parse(r.vector);
    } catch (_) {
      vec = null;
    }
  }
  return {
    id: r.id,
    text: r.text,
    tags: r.tags ? String(r.tags).split(',').filter(Boolean) : [],
    vector: vec,
    createdAt: Number(r.created_at) || 0,
    kind: KINDS.includes(r.kind) ? r.kind : 'fact',
    importance: Math.max(1, Math.min(10, asInt(r.importance, 5))),
    source: String(r.source || 'manual'),
    conversationId: String(r.conversation_id || ''),
    lastUsedAt: Number(r.last_used_at) || 0,
    usedCount: Number(r.used_count) || 0,
    strength: Math.max(0.2, Number(r.strength) || 1),
    pinned: !!r.pinned,
    archived: !!r.archived,
  };
}

/**
 * 艾宾浩斯：还能记住多少（0~1）。
 * 半衰期 = 基础天数 × 强度；强度随「被想起」变大（越常用越难忘）。
 */
function retention(item, now) {
  if (item.pinned) return 1;
  const last = Math.max(item.lastUsedAt || 0, item.createdAt || 0);
  const ageDays = Math.max(0, ((now || Date.now()) - last) / 86400000);
  const half = decayCfg().halfLifeDays * Math.max(0.4, item.strength || 1);
  return Math.exp((-ageDays / half) * Math.LN2);
}

function touch(id) {
  try {
    if (isSqlite()) {
      db.run(
        'UPDATE memories SET last_used_at = ?, used_count = used_count + 1, strength = MIN(2.5, strength + 0.12) WHERE id = ?',
        Date.now(),
        String(id),
      );
    } else {
      const items = jitems();
      const hit = items.find((x) => x.id === id);
      if (hit) {
        hit.lastUsedAt = Date.now();
        hit.usedCount = Number(hit.usedCount) + 1;
        hit.strength = Math.min(2.5, Number(hit.strength || 1) + 0.12);
        jsave(items);
      }
    }
  } catch (_) {
    /* 记一次使用失败不影响回话 */
  }
}

const TRIVIAL = /^(在吗|在不在|在么|你好|您好|hi|hello|嗯+|哦+|噢+|好的?|好吧|ok|行|可以|睡了|晚安|早安|早|哈哈+|呵呵+|收到|知道|没事|没事了|谢谢|多谢|在干嘛|在干嘛呢)[。！？.!?~～\s]*$/i;

// ---------------------------------------------------------------------------
// 对外
// ---------------------------------------------------------------------------

const memory = {
  cfg,
  retention,
  recallCfg,
  decayCfg,
  saveDecay: (patch) => saveDecayCfg(patch),
  backupCfg,
  saveBackupCfg: (patch) => saveBackupCfg(patch),

  stats() {
    ensure();
    const { backend, topK } = cfg();
    const d = decayCfg();
    let count = 0;
    let archived = 0;
    let vectorized = 0;
    let dim = 0;
    let pinned = 0;
    let avgImportance = 0;
    const kinds = {};

    if (isSqlite()) {
      const row = db.get('SELECT COUNT(*) AS n FROM memories');
      count = (row && row.n) || 0;
      archived = (db.get('SELECT COUNT(*) AS n FROM memories WHERE archived = 1') || {}).n || 0;
      vectorized = ((db.get("SELECT COUNT(*) AS n FROM memories WHERE vector IS NOT NULL AND vector != ''") || {}).n) || 0;
      pinned = (db.get('SELECT COUNT(*) AS n FROM memories WHERE pinned = 1') || {}).n || 0;
      avgImportance = ((db.get('SELECT AVG(importance) AS a FROM memories') || {}).a) || 0;
      for (const k of db.all('SELECT kind, COUNT(*) AS n FROM memories GROUP BY kind')) kinds[k.kind || 'fact'] = k.n;
      const sample = db.get("SELECT vector FROM memories WHERE vector IS NOT NULL AND vector != '' LIMIT 1");
      if (sample && sample.vector) {
        try {
          dim = JSON.parse(sample.vector).length;
        } catch (_) {
          dim = 0;
        }
      }
    } else {
      const items = jitems();
      count = items.length;
      archived = items.filter((x) => x.archived).length;
      vectorized = items.filter((x) => x.vector).length;
      pinned = items.filter((x) => x.pinned).length;
      avgImportance = items.length ? items.reduce((s, x) => s + (Number(x.importance) || 5), 0) / items.length : 0;
      const one = items.find((x) => x.vector);
      if (one) {
        try {
          dim = JSON.parse(x.vector).length;
        } catch (_) {
          dim = 0;
        }
      }
    }

    return {
      backend,
      topK,
      count,
      archived,
      active: count - archived,
      pinned,
      avgImportance: Number(avgImportance.toFixed(1)),
      kinds,
      vectorized,
      dim,
      storage: isSqlite() ? 'sqlite' : 'json',
      embedModel: backend === 'local' ? '' : (ai.get(backend) || {}).embeddingModel || '',
      decay: d,
      recall: recallCfg(),
      backup: backupCfg(),
    };
  },

  async probe() {
    const { backend } = cfg();
    if (backend === 'local') {
      return { ok: true, backend, mode: 'keyword', detail: '现在是本地关键词检索，不需要向量模型' };
    }
    const p = ai.get(backend) || {};
    try {
      const v = await ai.embed(backend, ['测试一下']);
      const dim = v && v[0] ? v[0].length : 0;
      return {
        ok: !!dim,
        backend,
        model: p.embeddingModel,
        dim,
        detail: dim ? `向量可用（${p.embeddingModel}\u00A0\u00A0${dim} 维）` : '接口回了但是没拿到向量',
      };
    } catch (err) {
      return { ok: false, backend, model: p.embeddingModel, detail: String((err && err.message) || err) };
    }
  },

  async backfill(limit) {
    ensure();
    const { backend } = cfg();
    if (backend === 'local') return { ok: false, done: 0, left: 0, detail: '现在是本地关键词检索，不需要补向量' };
    const batch = Math.max(1, Math.min(50, Number(limit) || 8));
    const rows = isSqlite()
      ? db.all("SELECT id, text FROM memories WHERE vector IS NULL OR vector = '' ORDER BY created_at DESC LIMIT ?", batch)
      : jitems().filter((x) => !x.vector).slice(0, batch);
    let done = 0;
    for (const r of rows) {
      const v = await embedOne(r.text);
      if (!v) break;
      if (isSqlite()) db.run('UPDATE memories SET vector = ? WHERE id = ?', JSON.stringify(v), r.id);
      else {
        const items = jitems();
        const hit = items.find((x) => x.id === r.id);
        if (hit) hit.vector = JSON.stringify(v);
        jsave(items);
      }
      done += 1;
    }
    const left = isSqlite()
      ? (db.get("SELECT COUNT(*) AS n FROM memories WHERE vector IS NULL OR vector = ''") || {}).n || 0
      : jitems().filter((x) => !x.vector).length;
    return { ok: done > 0, done, left };
  },

  /**
   * 记一条
   * @param {string} text
   * @param {string[]|string} tags
   * @param {{kind?:string, importance?:number, source?:string, conversationId?:string, pinned?:boolean}} extra
   */
  async add(text, tags, extra) {
    ensure();
    // 防呆：传对象（{text:…}）时别把 [object Object] 攒成记忆
    const raw = text && typeof text === 'object' ? (text.text || text.content || '') : text;
    if (text && typeof text === 'object' && text.tags && !tags) tags = text.tags;
    if (text && typeof text === 'object' && (text.kind || text.importance) && !extra) {
      extra = { kind: text.kind, importance: text.importance, source: text.source || 'manual' };
    }
    const content = String(raw || '').trim();
    if (!content) throw new Error('内容不能为空');
    if (/^\[object .+\]$/.test(content)) throw new Error('内容不能是对象，请传字符串');
    const e = extra || {};
    const id = newId();
    let vector = await embedOne(content);
    const item = {
      id,
      text: content.slice(0, 4000),
      tags: Array.isArray(tags) ? tags.filter(Boolean).join(',') : String(tags || ''),
      vector: vector ? JSON.stringify(vector) : null,
      created_at: Date.now(),
      kind: KINDS.includes(e.kind) ? e.kind : 'fact',
      importance: Math.max(1, Math.min(10, asInt(e.importance, 5))),
      source: String(e.source || 'manual'),
      conversation_id: String(e.conversationId || ''),
      last_used_at: 0,
      used_count: 0,
      strength: 1,
      pinned: e.pinned ? 1 : 0,
      archived: 0,
    };

    if (isSqlite()) {
      db.run(
        `INSERT INTO memories
          (id, text, tags, vector, created_at, kind, importance, source, conversation_id, last_used_at, used_count, strength, pinned, archived)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 1, ?, 0)`,
        item.id,
        item.text,
        item.tags,
        item.vector,
        item.created_at,
        item.kind,
        item.importance,
        item.source,
        item.conversation_id,
        item.pinned,
      );
    } else {
      const items = jitems();
      items.unshift({
        id: item.id,
        text: item.text,
        tags: item.tags,
        vector: item.vector,
        created_at: item.created_at,
        kind: item.kind,
        importance: item.importance,
        source: item.source,
        conversationId: item.conversation_id,
        lastUsedAt: 0,
        usedCount: 0,
        strength: 1,
        pinned: !!item.pinned,
        archived: false,
      });
      jsave(items);
    }
    return item;
  },

  list(limit, opts) {
    ensure();
    const o = opts || {};
    const n = Math.max(1, Math.min(500, Number(limit) || 100));
    const where = o.includeArchived ? '' : 'WHERE archived = 0';
    if (isSqlite()) {
      return db
        .all(`SELECT * FROM memories ${where} ORDER BY pinned DESC, created_at DESC LIMIT ?`, n)
        .map(rowToItem);
    }
    return jitems()
      .filter((x) => (o.includeArchived ? true : !x.archived))
      .slice(0, n)
      .map((x) => ({
        id: x.id,
        text: x.text,
        tags: String(x.tags || '').split(',').filter(Boolean),
        createdAt: Number(x.created_at) || 0,
        kind: x.kind || 'fact',
        importance: Number(x.importance) || 5,
        source: x.source || 'manual',
        conversationId: x.conversationId || '',
        lastUsedAt: Number(x.lastUsedAt) || 0,
        usedCount: Number(x.usedCount) || 0,
        strength: Number(x.strength) || 1,
        pinned: !!x.pinned,
        archived: !!x.archived,
      }));
  },

  /** 语义优先，向量拿不到就退化成关键词 */
  async search(query, k, opts) {
    ensure();
    const q = String(query || '').trim();
    if (!q) return [];
    const o = opts || {};
    const topK = Math.max(1, Math.min(20, Number(k) || cfg().topK));
    const where = o.includeArchived ? '' : 'WHERE archived = 0';

    const rows = isSqlite()
      ? db.all(`SELECT * FROM memories ${where} ORDER BY created_at DESC LIMIT 800`).map(rowToItem)
      : memory.list(800, { includeArchived: !!o.includeArchived });

    const vectors = await (async () => {
      const { backend } = cfg();
      if (backend === 'local') return null;
      try {
        const v = await ai.embed(backend, [withPrefix(q, 'query')]);
        return v && v[0] ? v[0] : null;
      } catch (_) {
        return null;
      }
    })();

    const scored = rows.map((r) => {
      const kw = keywordScore(r.text, q);
      // 语义相似度做个校准：nomic 对无关中文也常给 0.5 上下，直接当分数会把噪声召回来
      const SEM_FLOOR = 0.5;
      const SEM_SPAN = 0.35;
      let sem = 0;
      if (vectors && r.vector) {
        try {
          sem = Math.max(0, cosine(vectors, r.vector));
          sem = Math.min(1, Math.max(0, (sem - SEM_FLOOR) / SEM_SPAN));
        } catch (_) {
          sem = 0;
        }
      }
      const sim = vectors && r.vector ? sem * 0.75 + kw * 0.25 : kw * 0.9;
      return { ...r, sim, sem, kw };
    });

    return scored
      .filter((r) => r.sim > 0.05)
      .sort((a, b) => b.sim - a.sim)
      .slice(0, topK)
      .map((r) => ({
        id: r.id,
        text: r.text,
        tags: r.tags,
        kind: r.kind,
        importance: r.importance,
        createdAt: r.createdAt,
        score: Number(r.sim.toFixed(3)),
        semantic: Number(r.sem.toFixed(3)),
        keyword: Number(r.kw.toFixed(3)),
      }));
  },

  /** 长期画像：置顶 + 高重要度，永远带进上下文（很短） */
  profile(limit) {
    ensure();
    const n = Math.max(1, Math.min(10, Number(limit) || 4));
    if (isSqlite()) {
      const rows = db.all(
        'SELECT * FROM memories WHERE archived = 0 AND (pinned = 1 OR importance >= 8) ORDER BY pinned DESC, importance DESC, last_used_at DESC LIMIT ?',
        n,
      );
      return rows.map(rowToItem);
    }
    return memory
      .list(200)
      .filter((x) => x.pinned || x.importance >= 8)
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.importance - a.importance)
      .slice(0, n);
  },

  /**
   * 线索召回：混合打分 = 相似度 52% + 重要度 18% + 新鲜度 16% + 使用次数 8% + 留存 6%
   * 顺带把被用到的那几条记一次「想起」，强度会涨，避免被遗忘。
   */
  async recall(text, opts) {
    const o = opts || {};
    const rc = recallCfg();
    const budget = Math.max(120, Number(o.budget) || rc.budget);
    const k = Math.max(1, Math.min(12, Number(o.k) || rc.k));
    const q = String(text || '').trim();
    if (!q || q.length < 2) return [];
    if (TRIVIAL.test(q)) return [];

    const now = Date.now();
    let pool = [];
    try {
      pool = await memory.search(q, Math.max(k * 3, 12));
    } catch (err) {
      log.debug('memory: 检索失败 — ' + (err && err.message));
      pool = [];
    }
    if (o.conversationId) {
      pool.sort((a, b) => (b.kind === 'bond' ? 1 : 0) - (a.kind === 'bond' ? 1 : 0));
    }

    const all = isSqlite()
      ? db.all('SELECT * FROM memories WHERE archived = 0').map(rowToItem)
      : memory.list(800);
    const byId = new Map(all.map((x) => [x.id, x]));

    const scored = pool.map((r) => {
      const full = byId.get(r.id) || { ...r, usedCount: 0, strength: 1, lastUsedAt: 0 };
      const ageDays = Math.max(0, (now - (full.createdAt || now)) / 86400000);
      const fresh = Math.exp(-ageDays / 45);
      const imp = (full.importance || 5) / 10;
      const use = Math.min(1, Math.log(1 + (full.usedCount || 0)) / 3);
      const keep = retention(full, now);
      // 相关性做「总闸」：不相关的东西，再重要、再新鲜也不该被塞进上下文
      const gate = 0.55 + 0.2 * imp + 0.15 * fresh + 0.1 * use + 0.1 * keep;
      const final = (r.score || 0) * gate;
      return { ...full, score: r.score || 0, semantic: r.semantic || 0, keywordScore: r.keyword || 0, final, retention: keep };
    });

    scored.sort((a, b) => b.final - a.final);
    const picked = [];
    let used = 0;
    for (const r of scored) {
      if (picked.length >= k) break;
      if (r.final < 0.22) break;
      // 纯语义擦边的（关键词一个都没命中）不塞进来，除非被置顶
      if ((r.keywordScore || 0) < 0.12 && !r.pinned) continue;
      const txt = String(r.text || '').trim();
      if (!txt) continue;
      if (picked.some((p) => p.text.includes(txt) || txt.includes(p.text))) continue;
      const cost = txt.length + 2;
      if (used + cost > budget) continue;
      used += cost;
      picked.push(r);
    }
    for (const r of picked) touch(r.id);
    // 向量不入 IPC：又大又没用，渲染层只需要文本和分数
    return picked.map(({ vector, ...rest }) => rest);
  },

  /** 拼成可直接塞 prompt 的文本（含画像） */
  async snapshot(text, opts) {
    const rc = recallCfg();
    const items = await memory.recall(text, opts);
    const prof = memory.profile(3).filter((p) => !items.some((i) => i.id === p.id));
    const lines = [];
    let budget = Number((opts && opts.budget) || rc.budget) + rc.profileBudget;
    for (const p of prof) {
      const line = '· ' + p.text;
      if (budget - line.length < 0) break;
      budget -= line.length;
      lines.push(line);
    }
    for (const r of items) lines.push('- ' + r.text);
    return lines.join('\n');
  },

  /** 改一条：重要度 / 置顶 / 归档 / 文本 */
  update(id, patch) {
    ensure();
    const p = patch || {};
    const sets = [];
    const vals = [];
    if ('importance' in p) {
      sets.push('importance = ?');
      vals.push(Math.max(1, Math.min(10, asInt(p.importance, 5))));
    }
    if ('pinned' in p) {
      sets.push('pinned = ?');
      vals.push(p.pinned ? 1 : 0);
    }
    if ('archived' in p) {
      sets.push('archived = ?');
      vals.push(p.archived ? 1 : 0);
    }
    if ('text' in p) {
      sets.push('text = ?');
      vals.push(String(p.text || '').slice(0, 4000));
    }
    if (!sets.length) return { ok: false, message: '没有要改的字段' };

    if (isSqlite()) {
      db.run(`UPDATE memories SET ${sets.join(', ')} WHERE id = ?`, ...vals, String(id));
    } else {
      const items = jitems();
      const hit = items.find((x) => x.id === id);
      if (hit) {
        if ('importance' in p) hit.importance = Math.max(1, Math.min(10, asInt(p.importance, 5)));
        if ('pinned' in p) hit.pinned = !!p.pinned;
        if ('archived' in p) hit.archived = !!p.archived;
        if ('text' in p) hit.text = String(p.text || '').slice(0, 4000);
        jsave(items);
      }
    }
    return { ok: true };
  },

  /** 遗忘曲线：按留存率归档（不删） */
  async decay() {
    ensure();
    const d = decayCfg();
    if (!d.enabled) return { ok: false, message: '遗忘曲线关着', archived: 0 };
    const now = Date.now();
    let archived = 0;
    const rows = isSqlite()
      ? db.all('SELECT * FROM memories WHERE archived = 0 AND pinned = 0').map(rowToItem)
      : memory.list(800).filter((x) => !x.pinned);
    for (const r of rows) {
      if (r.importance >= 8) continue; // 很重要的事不归档
      const keep = retention(r, now);
      const ageDays = (now - Math.max(r.lastUsedAt || 0, r.createdAt || 0)) / 86400000;
      if (keep < d.archiveBelow && ageDays >= d.minAgeDays) {
        if (isSqlite()) db.run('UPDATE memories SET archived = 1 WHERE id = ?', r.id);
        else {
          const items = jitems();
          const hit = items.find((x) => x.id === r.id);
          if (hit) hit.archived = true;
          jsave(items);
        }
        archived += 1;
      }
    }
    if (archived) log.info('memory: 遗忘曲线归档了 ' + archived + ' 条（没删，界面能翻出来）');
    return { ok: true, archived, config: d };
  },

  /** 导出：本机文件 + （配了地址时）PUT 到云端 */
  async backup() {
    ensure();
    const items = memory.list(5000, { includeArchived: true });
    const payload = { version: 2, exportedAt: Date.now(), count: items.length, items };
    const dir = path.join(P.data, 'memory-backup');
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (_) {
      /* 目录已存在 */
    }
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-');
    const file = path.join(dir, 'memories-' + stamp + '.json');
    let fileOk = false;
    try {
      fs.writeFileSync(file, JSON.stringify(payload, null, 2), 'utf8');
      fileOk = true;
    } catch (err) {
      log.ex('memory: 备份写文件失败', err);
    }

    const b = backupCfg();
    let uploaded = false;
    let error = '';
    if (b.url) {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 20000);
        const res = await fetch(b.url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: ctrl.signal,
        });
        clearTimeout(timer);
        uploaded = res.ok;
        if (!res.ok) error = 'HTTP ' + res.status;
      } catch (err) {
        error = String((err && err.message) || err);
      }
    }

    const patch = { lastAt: Date.now(), lastOk: fileOk && (!b.url || uploaded), lastError: error };
    const cur = { ...(settings.getIn('memory.backup') || {}), ...patch };
    settings.patch({ memory: { backup: cur } });
    return { ok: fileOk, file, count: items.length, uploaded, error };
  },

  /** 从导出的 JSON（字符串或文件路径）恢复；按 id 覆盖，其余新增 */
  restore(source) {
    ensure();
    let raw = String(source || '').trim();
    if (!raw) throw new Error('没有内容');
    if (raw.length < 500 && fs.existsSync(raw)) raw = fs.readFileSync(raw, 'utf8');
    let payload = JSON.parse(raw);
    const items = Array.isArray(payload) ? payload : payload.items || [];
    if (!Array.isArray(items)) throw new Error('格式不对：需要 items 数组或数组');
    let added = 0;
    let updated = 0;
    for (const it of items) {
      const text = String((it && it.text) || '').trim();
      if (!text) continue;
      const id = String(it.id || newId());
      const exists = isSqlite()
        ? !!db.get('SELECT id FROM memories WHERE id = ?', id)
        : jitems().some((x) => x.id === id);
      if (exists) {
        memory.update(id, {
          text,
          importance: it.importance,
          pinned: !!it.pinned,
          archived: !!it.archived,
        });
        updated += 1;
      } else {
        memory.add(text, it.tags || [], {
          kind: it.kind,
          importance: it.importance,
          source: it.source || 'import',
          conversationId: it.conversationId,
          pinned: !!it.pinned,
        });
        added += 1;
      }
    }
    return { ok: true, added, updated, count: items.length };
  },

  /** 最近的备份文件名（新→旧） */
  listBackups() {
    const dir = path.join(P.data, 'memory-backup');
    try {
      return fs
        .readdirSync(dir)
        .filter((f) => /^memories-.*\.json$/.test(f))
        .sort()
        .reverse()
        .slice(0, 12);
    } catch (_) {
      return [];
    }
  },

  /** 从最近一份备份恢复 */
  restoreLatest() {
    const list = memory.listBackups();
    if (!list.length) throw new Error('还没有备份，先点「立即备份」');
    const file = path.join(P.data, 'memory-backup', list[0]);
    return { file, ...memory.restore(file) };
  },

  remove(id) {
    ensure();
    if (isSqlite()) {
      db.run('DELETE FROM memories WHERE id = ?', String(id));
      return memory.stats();
    }
    jsave(jitems().filter((x) => x.id !== id));
    return memory.stats();
  },

  clear() {
    ensure();
    if (isSqlite()) db.run('DELETE FROM memories');
    else jsave([]);
    return memory.stats();
  },

  /** 每 6 小时扫一次遗忘曲线（失败不影响） */
  start() {
    ensure();
    const run = () =>
      memory
        .decay()
        .catch((err) => log.debug('memory: 遗忘曲线跑失败 — ' + (err && err.message)));
    setTimeout(run, 30000);
    const t = setInterval(run, 6 * 3600 * 1000);
    if (t.unref) t.unref();
  },
};

module.exports = memory;
