'use strict';

/**
 * 记忆自动提炼（v2）
 * ------------------------------------------------------------
 * 老版每说一句就让 0.5b 判一次，信息碎、还费 token。
 * 现在改成「攒一小段再整理」：
 *   - 每聊 6 轮（或隔 4 分钟）拿这几轮对话整段提炼一次；
 *   - 每条记忆带 类型（fact/pref/event/bond/plan）和 重要度（1-10）；
 *   - 跟已有记忆太像的，不重复存，而是把重要度往上提一点（等于「又提了一次」）。
 *
 * 用本地小模型就行：判断「这句话以后还用不用得上」不需要多聪明；
 * 提炼失败最多少记一条，不耽误回话。
 */

const ai = require('./ai');
const memory = require('./memory');
const settings = require('./settings');
const db = require('./db');
const log = require('./logger');

const DEFAULTS = {
  enabled: true,
  // 默认跟 settings.js 的默认值对齐：本机 Ollama 的小模型，免费、断网也能记。
  // 以前这里是 deepseek-chat + provider deepseek，跟 settings 里的 qwen2.5:0.5b
  // 对不上，重置设置后就变成「拿本地模型名去请求 DeepSeek」，必然 400。
  model: 'qwen2.5:0.5b',
  provider: 'ollama',
  maxItems: 3,
  minIntervalMs: 20000,
  windowTurns: 6,
  windowMinutes: 4,
};

/** 提炼能用的引擎：本机 Ollama / DeepSeek / 硅基流动 / 自定义 */
const PROVIDERS = ['ollama', 'deepseek', 'siliconflow', 'custom'];

const KIND_IMPORTANCE = { fact: 6, pref: 7, event: 4, bond: 8, plan: 5, other: 4 };

const SYSTEM = [
  '你是记忆整理器。读下面一小段聊天，挑出「以后还用得上」的东西。',
  '可以记：对方的稳定偏好（喜欢/讨厌什么）、身份与称呼、重要的人和事、约定与计划、',
  '经历过的情绪事件（例如"他那天很累"）、以及你们关系里的变化。',
  '不要记：寒暄、一次性的操作、你自己说的话、明显的玩笑话。',
  '写成陈述句（第三人称），像"主人喜欢…"、"主人今天加班到很晚，情绪低落"，',
  '不要抄对话原句，不要带「他：」「我：」这种前缀，不要写问句。',
  '每条输出一个对象：{"text":"不超过 30 字","kind":"fact|pref|event|bond|plan","importance":1-10}。',
  '重要度参考：随口一说的偏好 5-6；反复强调的 7-8；身份/约定/关系变化 8-9；琐事 3-4。',
  '只输出 JSON 数组，没有值得记的就输出 []。不要解释，不要代码块。',
].join('\n');

let buffer = [];
let bufferStartAt = 0;
let running = false;
let lastRunAt = 0;

function cfg() {
  const m = settings.getIn('model.memory.distill') || {};
  const pick = (k, d) => (m[k] === undefined || m[k] === null || m[k] === '' ? d : m[k]);
  let provider = String(pick('provider', DEFAULTS.provider));
  const model = String(pick('model', DEFAULTS.model));
  if (!PROVIDERS.includes(provider)) provider = 'ollama';
  // 模型名带冒号是 Ollama 的写法（qwen2.5:0.5b），云端模型名都不带冒号。
  // 万一配置里 provider 停在云端、模型名却换成本地的，就拐回 Ollama：
  // 否则等于拿本地模型名去请求云端接口，必然 400，而且只在 debug 日志里留一行。
  if (provider !== 'ollama' && model.includes(':')) provider = 'ollama';
  return {
    enabled: pick('enabled', DEFAULTS.enabled) !== false,
    model,
    provider,
    maxItems: Math.max(1, Math.min(5, Number(pick('maxItems', DEFAULTS.maxItems)) || 3)),
    minIntervalMs: Math.max(3000, Number(pick('minIntervalMs', DEFAULTS.minIntervalMs)) || 20000),
    windowTurns: Math.max(2, Math.min(20, Number(pick('windowTurns', DEFAULTS.windowTurns)) || 6)),
    windowMinutes: Math.max(1, Math.min(60, Number(pick('windowMinutes', DEFAULTS.windowMinutes)) || 4)),
  };
}

/** 每个引擎的默认模型（改引擎没给模型时用它兜底） */
function defaultModelOf(provider) {
  if (provider === 'ollama') return 'qwen2.5:0.5b';
  if (provider === 'deepseek') return 'deepseek-chat';
  if (provider === 'siliconflow') return 'deepseek-ai/DeepSeek-V3';
  return DEFAULTS.model;
}

function saveConfig(patch) {
  const cur = { ...DEFAULTS, ...(settings.getIn('model.memory.distill') || {}) };
  const p = patch || {};
  if ('enabled' in p) cur.enabled = !!p.enabled;
  if ('provider' in p) {
    const want = String(p.provider || '');
    cur.provider = PROVIDERS.includes(want) ? want : DEFAULTS.provider;
    if (!('model' in p)) {
      const model = String(cur.model || '');
      const mismatch = cur.provider !== 'ollama' && model.includes(':');
      if (!model || mismatch) cur.model = defaultModelOf(cur.provider);
    }
  }
  if ('model' in p) cur.model = String(p.model || '') || defaultModelOf(cur.provider);
  if ('maxItems' in p) cur.maxItems = Math.max(1, Math.min(5, Number(p.maxItems) || 3));
  if ('windowTurns' in p) cur.windowTurns = Math.max(2, Math.min(20, Number(p.windowTurns) || 6));
  if ('windowMinutes' in p) cur.windowMinutes = Math.max(1, Math.min(60, Number(p.windowMinutes) || 4));
  settings.patch({ model: { memory: { distill: cur } } });
  return cfg();
}

/** 小模型经常不写标准 JSON：先找数组，再逐行兜底 */
function parseItems(raw) {
  const text = String(raw || '').trim().replace(/^```[a-z]*\s*/i, '').replace(/```$/, '');

  /**
   * 把一条原始对象/字符串整理成记忆条目；口吻不对的（直接抄对话）丢掉
   * 判断「像不像对话抄写」：以「他：」「她：」「助手：」或者任意短称呼加冒号开头的，
   * 基本是模型把原文复读了一遍，不要存成记忆（不绑定某个具体的名字）。
   */
  const ECHO = /^(他|她|你|我|用户|助手|主人|user|assistant|system)\s*[：:]|^[A-Z][A-Za-z]{1,10}\s*[：:]/i;
  const pick = (x) => {
    if (typeof x === 'string') {
      const s = x.trim();
      if (ECHO.test(s)) return null;
      return s.length >= 3 ? { text: s, kind: 'fact', importance: 5 } : null;
    }
    if (!x || typeof x !== 'object') return null;
    const s = String(x.text || x.content || '').trim();
    if (s.length < 3) return null;
    if (ECHO.test(s)) return null;
    return {
      text: s,
      kind: ['fact', 'pref', 'event', 'bond', 'plan', 'other'].includes(x.kind) ? x.kind : 'fact',
      importance: Number(x.importance) || 5,
    };
  };

  const asArr = (arr) =>
    (Array.isArray(arr) ? arr : [arr]).map(pick).filter((x) => x && x.text.length >= 3);

  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start >= 0 && end > start) {
    try {
      const arr = JSON.parse(text.slice(start, end + 1));
      if (Array.isArray(arr)) return asArr(arr).slice(0, 4);
    } catch (_) {
      /* 落到下面 */
    }
  }

  // 小模型常常直接吐一个对象：{"text":...}
  const s2 = text.indexOf('{');
  const e2 = text.lastIndexOf('}');
  if (s2 >= 0 && e2 > s2) {
    try {
      const obj = JSON.parse(text.slice(s2, e2 + 1));
      const got = asArr(obj);
      if (got.length) return got.slice(0, 4);
    } catch (_) {
      /* 继续兜底 */
    }
  }

  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => !line.startsWith('{') && !line.startsWith('['))
    .map((line) => line.replace(/^[-*·•\d.、)）\s]+/, '').replace(/^["'“”「」]+|["'“”「」]+$/g, '').trim())
    .filter((line) => line.length >= 4 && line.length <= 60)
    .filter((line) => !/^(没有|无|none|nothing|\[\]|---)/i.test(line))
    .filter((line) => !/^[他她]：/.test(line))
    .slice(0, 3)
    .map((line) => ({ text: line, kind: 'fact', importance: 5 }));
}

function norm(s) {
  return String(s || '')
    .replace(/\s+/g, '')
    .replace(/[，。！？、,.!?;；:：'"“”]/g, '')
    .toLowerCase();
}

/** 找一条「差不多」的旧记忆 */
function findSimilar(fact, existing) {
  const a = norm(fact);
  if (a.length < 4) return null;
  for (const item of existing) {
    const b = norm(item.text);
    if (!b) continue;
    if (b === a) return item;
    if (b.includes(a) || a.includes(b)) return item;
  }
  return null;
}

async function extract(turns, opts) {
  const c = cfg();
  if (!c.enabled) return [];
  if (!turns || !turns.length) return [];
  const transcript = turns
    .map((t) => (t.userText ? '他：' + t.userText : '') + (t.answer ? '\n你：' + t.answer : ''))
    .filter(Boolean)
    .join('\n');

  let raw = '';
  try {
    raw = await ai.chat(
      c.provider,
      [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: transcript.slice(-4000) },
      ],
      { model: c.model, temperature: 0.2, maxTokens: 1200, timeoutMs: 45000 },
    );
  } catch (err) {
    log.debug('distill: 模型没回 — ' + (err && err.message));
    return [];
  }

  const items = parseItems(raw).slice(0, c.maxItems);
  if (!items.length) {
    log.debug('distill: 没提炼出东西 — ' + String(raw || '').slice(0, 120));
    return [];
  }

  const existing = memory.list(400);
  const saved = [];
  for (const it of items) {
    const importance = Math.max(1, Math.min(10, Math.round(it.importance || KIND_IMPORTANCE[it.kind] || 5)));
    const hit = findSimilar(it.text, existing);
    if (hit) {
      // 旧记忆：重要度往上抬一点，等于「又提到了一次」
      const nextImportance = Math.max(hit.importance || 5, Math.min(10, importance));
      try {
        memory.update(hit.id, { importance: nextImportance });
      } catch (_) {
        /* ignore */
      }
      continue;
    }
    try {
      const savedItem = await memory.add(it.text.slice(0, 120), ['auto', it.kind], {
        kind: it.kind,
        importance,
        source: opts && opts.source ? opts.source : 'distill',
        conversationId: (opts && opts.conversationId) || '',
      });
      existing.push(savedItem);
      saved.push(it.text);
    } catch (err) {
      log.debug('distill: 存记忆失败 — ' + (err && err.message));
    }
  }
  if (saved.length) log.info('distill: 记住了 ' + saved.length + ' 条 — ' + saved.join(' / '));
  return saved;
}

/**
 * 每轮聊完调用（不等待，失败就算了）
 * @param {{userText:string, answer:string, name?:string, conversationId?:string}} turn
 */
async function learn(turn) {
  const c = cfg();
  if (!c.enabled) return [];
  const userText = String((turn && turn.userText) || '').trim();
  if (userText.length < 2) return [];
  if (running) return [];

  if (!buffer.length) bufferStartAt = Date.now();
  buffer.push({ userText: userText.slice(0, 600), answer: String((turn.answer || '')).slice(0, 600) });

  const minutes = (Date.now() - bufferStartAt) / 60000;
  const enough = buffer.length >= c.windowTurns || (buffer.length >= 2 && minutes >= c.windowMinutes);
  if (!enough) return [];
  if (Date.now() - lastRunAt < c.minIntervalMs && buffer.length < c.windowTurns) return [];

  const turns = buffer.splice(0, buffer.length);
  bufferStartAt = 0;
  running = true;
  lastRunAt = Date.now();
  try {
    return await extract(turns, {
      source: 'distill',
      conversationId: (turn && turn.conversationId) || '',
    });
  } catch (err) {
    log.debug('distill: 跳过 — ' + (err && err.message));
    return [];
  } finally {
    running = false;
  }
}

/** 手动触发：把缓冲里的、以及最近 N 条消息一起整理一遍 */
async function runRecent(limit) {
  const n = Math.max(4, Math.min(120, Number(limit) || 40));
  const rows = db.all('SELECT role, content, conversation_id FROM messages ORDER BY created_at DESC, rowid DESC LIMIT ?', n).reverse();
  const turns = [];
  let pending = null;
  for (const r of rows) {
    const text = String(r.content || '').trim();
    if (!text) continue;
    if (r.role === 'user') {
      pending = { userText: text, answer: '', conversationId: r.conversation_id || '' };
    } else {
      if (pending) {
        pending.answer = text;
        turns.push(pending);
        pending = null;
      } else {
        turns.push({ userText: '', answer: text, conversationId: r.conversation_id || '' });
      }
    }
  }
  if (pending) turns.push(pending);
  const buffered = buffer.splice(0, buffer.length);
  bufferStartAt = 0;
  const saved = await extract(turns.concat(buffered), { source: 'manual' });
  return { ok: true, scanned: rows.length, turns: turns.length, saved };
}

/** 强制把缓冲吐出来（退出前/手动「立即整理」用） */
async function flush() {
  if (!buffer.length) return [];
  const turns = buffer.splice(0, buffer.length);
  bufferStartAt = 0;
  return extract(turns, { source: 'manual' });
}

/** 手动「自动记试试」：只拿这一句当输入跑一次 */
async function tryText(text) {
  const t = String(text || '').trim();
  if (t.length < 2) return [];
  return extract([{ userText: t, answer: '' }], { source: 'manual' });
}

module.exports = { cfg, saveConfig, learn, runRecent, flush, tryText, parseItems };
