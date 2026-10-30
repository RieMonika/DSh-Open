/**
 * 视觉 API：任何「OpenAI 兼容」的 /chat/completions 都能用。
 * 用户自己填 baseUrl / key / 模型名，随时换，不用改代码。
 */
const fs = require('node:fs');
const path = require('node:path');
const db = require('./db');
const settings = require('./settings');
const log = require('./logger');

const DEFAULTS = {
  enabled: false,
  baseUrl: '',
  apiKey: '',
  model: '',
  maxTokens: 400,
  timeoutMs: 40000,
};

let ready = false;

function ensure() {
  if (ready) return;
  db.run(
    `CREATE TABLE IF NOT EXISTS vision_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      at INTEGER NOT NULL,
      base_url TEXT,
      model TEXT,
      prompt INTEGER DEFAULT 0,
      completion INTEGER DEFAULT 0,
      ms INTEGER DEFAULT 0,
      ok INTEGER DEFAULT 0,
      error TEXT DEFAULT ''
    )`,
  );
  ready = true;
}

function cfg() {
  const v = settings.getIn('model.vision') || {};
  const pick = (k) => (v[k] === undefined || v[k] === null ? DEFAULTS[k] : v[k]);
  let baseUrl = String(pick('baseUrl') || '').trim().replace(/\/+$/, '');
  if (baseUrl && !/\/v1$/i.test(baseUrl) && !/\/chat\/completions$/i.test(baseUrl)) {
    // 大多数兼容接口都在 /v1 下面，用户懒得写就补上
    if (!/\/v\d+$/i.test(baseUrl)) baseUrl += '/v1';
  }
  return {
    enabled: pick('enabled') === true,
    baseUrl,
    rawBaseUrl: String(pick('baseUrl') || '').trim(),
    apiKey: String(pick('apiKey') || '').trim(),
    model: String(pick('model') || '').trim(),
    maxTokens: Math.max(64, Math.min(2000, Number(pick('maxTokens')) || DEFAULTS.maxTokens)),
    timeoutMs: Math.max(5000, Math.min(120000, Number(pick('timeoutMs')) || DEFAULTS.timeoutMs)),
  };
}

function save(patch) {
  const cur = { ...DEFAULTS, ...(settings.getIn('model.vision') || {}) };
  const p = patch || {};
  if ('enabled' in p) cur.enabled = !!p.enabled;
  if ('baseUrl' in p) cur.baseUrl = String(p.baseUrl || '').trim();
  if ('apiKey' in p) cur.apiKey = String(p.apiKey || '').trim();
  if ('model' in p) cur.model = String(p.model || '').trim();
  if ('maxTokens' in p) cur.maxTokens = Math.max(64, Math.min(2000, Number(p.maxTokens) || DEFAULTS.maxTokens));
  settings.patch({ model: { vision: cur } });
  return cfg();
}

function ready_to_use(c) {
  const v = c || cfg();
  return !!(v.enabled && v.baseUrl && v.model);
}

function mimeOf(file) {
  const ext = path.extname(String(file || '')).toLowerCase();
  return (
    { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.bmp': 'image/bmp' }[
      ext
    ] || 'image/png'
  );
}

function toDataUrl(file) {
  const buf = fs.readFileSync(file);
  return 'data:' + mimeOf(file) + ';base64,' + buf.toString('base64');
}

function logUsage(row) {
  ensure();
  try {
    db.run(
      'INSERT INTO vision_usage (at, base_url, model, prompt, completion, ms, ok, error) VALUES (?,?,?,?,?,?,?,?)',
      Date.now(),
      row.baseUrl || '',
      row.model || '',
      row.prompt || 0,
      row.completion || 0,
      row.ms || 0,
      row.ok ? 1 : 0,
      String(row.error || '').slice(0, 300),
    );
  } catch (err) {
    log.debug('vision: 记用量失败 — ' + (err && err.message));
  }
}

/**
 * 描述一张图（本地文件或 http url）
 * @returns {Promise<{ok:boolean,text:string,prompt:number,completion:number,error?:string}>}
 */
async function describe(input, opts) {
  const c = cfg();
  const o = opts || {};
  const prompt = o.prompt || '用一两句话客观描述这张图里有什么；如果有文字，把文字读出来。不要编造看不见的细节。';
  if (!ready_to_use(c)) {
    return { ok: false, text: '', prompt: 0, completion: 0, error: '视觉 API 还没配置（地址 / 模型）' };
  }

  const startedAt = Date.now();
  try {
    let imageUrl = '';
    if (input && input.file) {
      if (!fs.existsSync(input.file)) throw new Error('图片文件不存在');
      imageUrl = toDataUrl(input.file);
    } else if (input && input.url) {
      imageUrl = String(input.url);
    } else {
      throw new Error('没有给图片');
    }

    const url = /\/chat\/completions$/i.test(c.baseUrl) ? c.baseUrl : c.baseUrl + '/chat/completions';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), c.timeoutMs);
    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + c.apiKey,
        },
        body: JSON.stringify({
          model: c.model,
          max_tokens: c.maxTokens,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: imageUrl } },
              ],
            },
          ],
        }),
      });
    } finally {
      clearTimeout(timer);
    }

    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch (_) {
      /* 非 JSON：当作报错文本 */
    }
    const ms = Date.now() - startedAt;

    if (!res.ok || !json) {
      const msg = (json && (json.error && (json.error.message || json.error)) ) || text.slice(0, 200) || 'HTTP ' + res.status;
      logUsage({ baseUrl: c.baseUrl, model: c.model, ms, ok: false, error: msg });
      return { ok: false, text: '', prompt: 0, completion: 0, error: String(msg) };
    }

    const usage = json.usage || {};
    const choice = (json.choices || [])[0] || {};
    const msg = choice.message || {};
    let out = '';
    if (typeof msg.content === 'string') out = msg.content;
    else if (Array.isArray(msg.content)) out = msg.content.map((x) => (typeof x === 'string' ? x : x && x.text) || '').join('').trim();
    out = String(out || '').trim();

    logUsage({
      baseUrl: c.baseUrl,
      model: c.model,
      prompt: Number(usage.prompt_tokens) || 0,
      completion: Number(usage.completion_tokens) || 0,
      ms,
      ok: true,
    });

    return {
      ok: true,
      text: out,
      prompt: Number(usage.prompt_tokens) || 0,
      completion: Number(usage.completion_tokens) || 0,
    };
  } catch (err) {
    const ms = Date.now() - startedAt;
    const msg = err && err.name === 'AbortError' ? '超时' : String((err && err.message) || err);
    logUsage({ baseUrl: c.baseUrl, model: c.model, ms, ok: false, error: msg });
    return { ok: false, text: '', prompt: 0, completion: 0, error: msg };
  }
}

/** 今日/累计用量 + 最近几次调用 */
function stats() {
  ensure();
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const t0 = dayStart.getTime();
  const today =
    db.get(
      'SELECT COUNT(*) AS n, COALESCE(SUM(prompt),0) AS p, COALESCE(SUM(completion),0) AS c, COALESCE(SUM(ok=0),0) AS fail FROM vision_usage WHERE at >= ?',
      t0,
    ) || {};
  const total =
    db.get('SELECT COUNT(*) AS n, COALESCE(SUM(prompt),0) AS p, COALESCE(SUM(completion),0) AS c FROM vision_usage') || {};
  const last = db.get('SELECT * FROM vision_usage ORDER BY id DESC LIMIT 1') || null;
  const c = cfg();
  return {
    configured: ready_to_use(c),
    enabled: c.enabled,
    baseUrl: c.baseUrl,
    model: c.model,
    today: { req: today.n || 0, prompt: today.p || 0, completion: today.c || 0, total: (today.p || 0) + (today.c || 0), fail: today.fail || 0 },
    all: { req: total.n || 0, total: (total.p || 0) + (total.c || 0) },
    last: last
      ? {
          at: last.at,
          ok: !!last.ok,
          model: last.model,
          prompt: last.prompt,
          completion: last.completion,
          ms: last.ms,
          error: last.error,
        }
      : null,
  };
}

/** 1x1 红色 PNG，用来试连通性 */
const PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function test(prompt) {
  const c = cfg();
  if (!c.baseUrl || !c.model) return { ok: false, error: '先填接口地址和模型名' };
  return describe({ url: PIXEL }, { prompt: prompt || '这张图是什么颜色？只回答一个词。' });
}

module.exports = { cfg, save, describe, stats, test, ready: ready_to_use };
