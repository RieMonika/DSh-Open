/**
 * 语音 API：两套引擎二选一 —— OpenAI 兼容的 /audio/speech，或者豆包（火山引擎）语音合成。
 * 用户自己选引擎、填那一家要的几样东西，随时换，不用改代码；两边填的各自存着，换回来不用重填。
 * 合成结果落在 cache\voice 下，QQ 发出去时转 base64 给 NapCat。
 */
const fs = require('node:fs');
const path = require('node:path');
const db = require('./db');
const settings = require('./settings');
const paths = require('./paths');
const log = require('./logger');

const DEFAULTS = {
  enabled: false,
  provider: 'openai',   // openai = 任何 OpenAI 兼容的 /audio/speech；doubao = 火山引擎语音合成
  appid: '',
  accessToken: '',
  cluster: 'volcano_tts',
  voiceType: '',
  baseUrl: '',
  apiKey: '',
  model: '',
  voice: '',
  format: 'mp3',
  speed: 1,
  maxChars: 120,
  chance: 0.15,
  timeoutMs: 30000,
};

const FORMATS = ['mp3', 'wav', 'opus', 'aac', 'flac', 'pcm'];
const MIME = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  opus: 'audio/ogg',
  aac: 'audio/aac',
  flac: 'audio/flac',
  pcm: 'audio/L16',
};

let readyFlag = false;

function ensure() {
  if (readyFlag) return;
  db.run(
    `CREATE TABLE IF NOT EXISTS voice_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      at INTEGER NOT NULL,
      base_url TEXT,
      model TEXT,
      chars INTEGER DEFAULT 0,
      bytes INTEGER DEFAULT 0,
      ms INTEGER DEFAULT 0,
      ok INTEGER DEFAULT 0,
      error TEXT DEFAULT ''
    )`,
  );
  readyFlag = true;
}

function voiceDir() {
  const dir = path.join(paths.cache, 'voice');
  paths.ensureDir(dir);
  return dir;
}

function cfg() {
  const v = settings.getIn('model.voice') || {};
  const pick = (k) => (v[k] === undefined || v[k] === null ? DEFAULTS[k] : v[k]);
  let baseUrl = String(pick('baseUrl') || '').trim().replace(/\/+$/, '');
  if (baseUrl && !/\/v\d+$/i.test(baseUrl) && !/\/audio\/speech$/i.test(baseUrl)) baseUrl += '/v1';
  const format = String(pick('format') || DEFAULTS.format).toLowerCase();
  return {
    enabled: pick('enabled') === true,
    provider: pick('provider') === 'doubao' ? 'doubao' : 'openai',
    appid: String(pick('appid') || '').trim(),
    accessToken: String(pick('accessToken') || '').trim(),
    cluster: String(pick('cluster') || '').trim() || 'volcano_tts',
    voiceType: String(pick('voiceType') || '').trim(),
    baseUrl,
    rawBaseUrl: String(pick('baseUrl') || '').trim(),
    apiKey: String(pick('apiKey') || '').trim(),
    model: String(pick('model') || '').trim(),
    voice: String(pick('voice') || '').trim(),
    format: FORMATS.includes(format) ? format : DEFAULTS.format,
    speed: Math.max(0.5, Math.min(2, Number(pick('speed')) || 1)),
    maxChars: Math.max(20, Math.min(600, Number(pick('maxChars')) || DEFAULTS.maxChars)),
    chance: Math.max(0, Math.min(1, Number(pick('chance')) || 0)),
    timeoutMs: Math.max(5000, Math.min(120000, Number(pick('timeoutMs')) || DEFAULTS.timeoutMs)),
  };
}

function save(patch) {
  const cur = { ...DEFAULTS, ...(settings.getIn('model.voice') || {}) };
  const p = patch || {};
  const str = ['baseUrl', 'apiKey', 'model', 'voice', 'format', 'appid', 'accessToken', 'cluster', 'voiceType'];
  for (const k of str) if (k in p) cur[k] = String(p[k] || '').trim();
  if (!String(cur.cluster || '').trim()) cur.cluster = 'volcano_tts';
  if ('provider' in p) cur.provider = p.provider === 'doubao' ? 'doubao' : 'openai';
  if ('enabled' in p) cur.enabled = !!p.enabled;
  if ('speed' in p) cur.speed = Math.max(0.5, Math.min(2, Number(p.speed) || 1));
  if ('maxChars' in p) cur.maxChars = Math.max(20, Math.min(600, Number(p.maxChars) || DEFAULTS.maxChars));
  if ('chance' in p) cur.chance = Math.max(0, Math.min(1, Number(p.chance) || 0));
  settings.patch({ model: { voice: cur } });
  return cfg();
}

/** 这一家要的东西填全了没有（不管开没开） */
function filled(c) {
  const v = c || cfg();
  if (v.provider === 'doubao') return !!(v.appid && v.accessToken && v.voiceType);
  return !!(v.baseUrl && v.model);
}

/** 填全了并且开着「允许发语音」，才真的会去调用 */
function readyToUse(c) {
  const v = c || cfg();
  return !!(v.enabled && filled(v));
}

function logUsage(row) {
  ensure();
  try {
    db.run(
      'INSERT INTO voice_usage (at, base_url, model, chars, bytes, ms, ok, error) VALUES (?,?,?,?,?,?,?,?)',
      Date.now(),
      row.baseUrl || '',
      row.model || '',
      row.chars || 0,
      row.bytes || 0,
      row.ms || 0,
      row.ok ? 1 : 0,
      String(row.error || '').slice(0, 300),
    );
  } catch (err) {
    log.debug('voice: 记用量失败 — ' + (err && err.message));
  }
}

/**
 * 合成一段语音，写进 cache\voice
 * @returns {Promise<{ok:boolean,file?:string,bytes?:number,chars?:number,ms?:number,format?:string,error?:string}>}
 */
async function speak(text, opts) {
  const c = cfg();
  const o = opts || {};
  const input = String(text || '').trim().slice(0, o.maxChars || c.maxChars);
  if (!input) return { ok: false, error: '没有要念的字' };
  if (!filled(c)) {
    return { ok: false, error: c.provider === 'doubao' ? '豆包还缺配置：APPID / Access Token / voice_type 要填全' : '语音 API 还没配置（接口地址 / 模型名）' };
  }
  // 试听（o.force）不受「允许发语音」开关影响：先配好试通了再开，省得来回切
  if (!c.enabled && !o.force) return { ok: false, error: '「允许发语音」还关着' };
  if (c.provider === 'doubao') return speakDoubao(input, c);

  const startedAt = Date.now();
  const url = /\/audio\/speech$/i.test(c.baseUrl) ? c.baseUrl : c.baseUrl + '/audio/speech';

  try {
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
          input,
          voice: o.voice || c.voice || 'alloy',
          response_format: o.format || c.format,
          speed: Number(o.speed || c.speed) || 1,
        }),
      });
    } finally {
      clearTimeout(timer);
    }

    const ms = Date.now() - startedAt;
    const type = String(res.headers.get('content-type') || '');
    if (!res.ok || /application\/json/i.test(type)) {
      const txt = await res.text();
      let msg = txt.slice(0, 200);
      try {
        const j = JSON.parse(txt);
        msg = (j.error && (j.error.message || j.error)) || msg;
      } catch (_) {
        /* 原样 */
      }
      logUsage({ baseUrl: c.baseUrl, model: c.model, chars: input.length, ms, ok: false, error: msg });
      return { ok: false, error: String(msg || 'HTTP ' + res.status) };
    }

    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length) {
      logUsage({ baseUrl: c.baseUrl, model: c.model, chars: input.length, ms, ok: false, error: '返回空音频' });
      return { ok: false, error: '返回空音频' };
    }
    const format = o.format || c.format;
    const name = 'v-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + format;
    const file = path.join(voiceDir(), name);
    fs.writeFileSync(file, buf);
    cleanup();
    logUsage({ baseUrl: c.baseUrl, model: c.model, chars: input.length, bytes: buf.length, ms, ok: true });
    return { ok: true, file, bytes: buf.length, chars: input.length, ms, format, mime: MIME[format] || 'audio/mpeg' };
  } catch (err) {
    const ms = Date.now() - startedAt;
    const msg = friendlyError(err);
    logUsage({ baseUrl: c.baseUrl, model: c.model, chars: input.length, ms, ok: false, error: msg });
    return { ok: false, error: msg };
  }
}

/**
 * 把底层网络错误翻成人话。
 * Node 的 fetch 失败只会给一句「fetch failed」，真正的原因在 err.cause.code 里，
 * 直接甩给用户等于没说，所以这里挑常见的几种解释清楚。
 */
function friendlyError(err) {
  if (err && err.name === 'AbortError') return '超时（接口半天没回）';
  const code = String((err && err.cause && err.cause.code) || '');
  const map = {
    ENOTFOUND: '域名解析不了（地址拼错了，或者这台机器上不了网）',
    EAI_AGAIN: '域名解析超时（DNS 没响应，检查网络）',
    ECONNREFUSED: '连不上这个地址（端口没开，或者服务没启动）',
    ECONNRESET: '连接被对方掐断了（可能是墙/代理/服务端重启）',
    ETIMEDOUT: '连接超时（网络不通）',
    CERT_HAS_EXPIRED: 'HTTPS 证书过期了',
    DEPTH_ZERO_SELF_SIGNED_CERT: 'HTTPS 证书是自签名的，被拒绝了',
    UNABLE_TO_VERIFY_LEAF_SIGNATURE: 'HTTPS 证书验不过（自签名/中间证书缺失）',
  };
  if (map[code]) return map[code] + '（' + code + '）';
  return String((err && err.message) || err);
}

/** 只留最近 100 条，避免缓存越攒越多 */
function cleanup() {
  try {
    const dir = voiceDir();
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.startsWith('v-'))
      .map((f) => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t);
    for (const x of files.slice(100)) fs.rmSync(path.join(dir, x.f), { force: true });
  } catch (err) {
    log.debug('voice: 清理失败 — ' + (err && err.message));
  }
}

/** base64 给 NapCat 用（file=base64://...） */
function toBase64(file) {
  const buf = fs.readFileSync(file);
  return 'base64://' + buf.toString('base64');
}

function stats() {
  ensure();
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const t0 = dayStart.getTime();
  const today =
    db.get(
      'SELECT COUNT(*) AS n, COALESCE(SUM(chars),0) AS c, COALESCE(SUM(bytes),0) AS b, COALESCE(SUM(ok=0),0) AS fail FROM voice_usage WHERE at >= ?',
      t0,
    ) || {};
  const total = db.get('SELECT COUNT(*) AS n, COALESCE(SUM(chars),0) AS c FROM voice_usage') || {};
  const last = db.get('SELECT * FROM voice_usage ORDER BY id DESC LIMIT 1') || null;
  const c = cfg();
  return {
    configured: readyToUse(c),
    enabled: c.enabled,
    provider: c.provider,
    baseUrl: c.baseUrl,
    model: c.model,
    voice: c.voice,
    voiceType: c.voiceType,
    appid: c.appid,
    cluster: c.cluster,
    today: { req: today.n || 0, chars: today.c || 0, bytes: today.b || 0, fail: today.fail || 0 },
    all: { req: total.n || 0, chars: total.c || 0 },
    last: last
      ? {
          at: last.at,
          ok: !!last.ok,
          model: last.model,
          chars: last.chars,
          bytes: last.bytes,
          ms: last.ms,
          error: last.error,
        }
      : null,
  };
}

async function test() {
  const c = cfg();
  if (c.provider === 'doubao') {
    if (!c.appid || !c.accessToken || !c.voiceType) return { ok: false, error: '豆包要填 APPID / Access Token / voice_type 三个' };
    return speak('你好呀，这是语音测试，能听到就说明配置对了。', { maxChars: 40, force: true });
  }
  if (!c.baseUrl || !c.model) return { ok: false, error: '先填接口地址和模型名' };
  return speak('你好呀，这是语音测试，能听到就说明配置对了。', { maxChars: 40, force: true });
}


/** 豆包（火山引擎）语音合成：POST /api/v1/tts，返回 base64 音频 */
async function speakDoubao(input, c) {
  const crypto = require('crypto');
  const fs = require('fs');
  const path = require('path');
  const P = require('./paths');
  if (!c.appid || !c.accessToken || !c.voiceType) {
    return { ok: false, error: '豆包要填 APPID / Access Token / voice_type 三个' };
  }
  // 豆包只认 mp3 / wav / ogg / pcm，别的格式退回 mp3（QQ 语音 mp3 最稳）
  const enc = ['mp3', 'wav', 'ogg', 'pcm'].includes(String(c.format || '').toLowerCase()) ? String(c.format).toLowerCase() : 'mp3';
  const startedAt = Date.now();
  const reqid = crypto.randomUUID();
  const dir = path.join(P.cache, 'voice');
  try { fs.mkdirSync(dir, { recursive: true }); } catch (_) {}
  const body = {
    app: { appid: c.appid, token: c.accessToken, cluster: c.cluster || 'volcano_tts' },
    user: { uid: 'dshopen' },
    audio: {
      voice_type: c.voiceType,
      encoding: enc,
      speed_ratio: Number(c.speed) || 1,
      volume_ratio: 1,
      pitch_ratio: 1,
    },
    request: { reqid, text: input, text_type: 'plain', operation: 'query', with_frontend: 1, frontend_type: 'unitTson' },
  };
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), c.timeoutMs || 30000);
    const res = await fetch('https://openspeech.bytedance.com/api/v1/tts', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer; ' + c.accessToken },
      body: JSON.stringify(body),
    });
    clearTimeout(timer);
    const json = await res.json().catch(() => ({}));
    if (json.code && json.code !== 3000) {
      return { ok: false, error: '豆包返回 ' + json.code + '：' + (json.message || '') };
    }
    const b64 = json.data || (json.audio && json.audio.data);
    if (!b64) return { ok: false, error: '豆包没返回音频：' + JSON.stringify(json).slice(0, 120) };
    const buf = Buffer.from(b64, 'base64');
    // 文件名也用 v- 开头：cleanup() 才会一起清，不然豆包的文件会越攒越多
    const file = path.join(dir, 'v-db-' + Date.now() + '.' + enc);
    fs.writeFileSync(file, buf);
    cleanup();
    logUsage({ baseUrl: 'doubao', model: 'doubao:' + c.voiceType, chars: input.length, bytes: buf.length, ms: Date.now() - startedAt, ok: true });
    return { ok: true, file, bytes: buf.length, chars: input.length, ms: Date.now() - startedAt, format: enc, mime: MIME[enc] || 'audio/mpeg' };
  } catch (e) {
    const msg = friendlyError(e);
    logUsage({ baseUrl: 'doubao', model: 'doubao:' + c.voiceType, chars: input.length, ms: Date.now() - startedAt, ok: false, error: msg });
    return { ok: false, error: '请求豆包失败：' + msg };
  }
}
module.exports = { cfg, save, speak, stats, test, toBase64, ready: readyToUse, filled, FORMATS };
