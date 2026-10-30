'use strict';

/**
 * 大模型接入层
 * ------------------------------------------------------------
 * 只认「OpenAI 兼容」这一种形状：
 *   GET  {baseUrl}/models
 *   POST {baseUrl}/chat/completions
 *   POST {baseUrl}/embeddings
 * Ollama、硅基流动、vLLM、LM Studio、one-api 全都符合，所以一套代码够用。
 *
 * 配置存在 settings.model 里；这里只管"怎么连、怎么调"，不存业务数据。
 */

const settings = require('./settings');
const log = require('./logger');
const usage = require('./usage');

/** 预置的三套接入方式（玩家从里面挑一个，或者填自定义） */
const PRESETS = [
  {
    id: 'ollama',
    name: 'Ollama',
    subtitle: '本机跑，数据不出门',
    baseUrl: 'http://127.0.0.1:11434/v1',
    model: 'qwen2.5:7b',
    embeddingModel: 'nomic-embed-text',
    needsKey: false,
    hint: '先装 Ollama，然后 ollama pull qwen2.5:7b。默认端口 11434，不用填 Key。',
  },
  {
    id: 'siliconflow',
    name: '硅基流动 SiliconFlow',
    subtitle: '云端 API，要填 Key',
    baseUrl: 'https://api.siliconflow.cn/v1',
    model: 'deepseek-ai/DeepSeek-V3',
    embeddingModel: 'BAAI/bge-m3',
    needsKey: true,
    hint: '到 cloud.siliconflow.cn 注册，建一个 API Key 粘进来。模型名直接抄它模型列表里的。',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek 官方',
    subtitle: '云端 API，要填 Key',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    embeddingModel: '',
    needsKey: true,
    hint: '到 platform.deepseek.com 建 Key。模型名填 deepseek-chat（对话）或 deepseek-reasoner（推理）。',
  },
  {
    id: 'custom',
    name: '自定义',
    subtitle: '任何 OpenAI 兼容接口',
    baseUrl: 'http://127.0.0.1:8000/v1',
    model: 'your-model',
    embeddingModel: '',
    needsKey: false,
    hint: 'vLLM / LM Studio / one-api 之类，只要兼容 /v1/chat/completions 就能接。连上后用「列模型」挑一个。',
  },
];

const TIMEOUT_MS = 12000;

/**
 * 几家云端「档位」的预设名（只是方便点选，真实能不能用点「试一下」就知道）。
 * 拉真实列表还是走 test() 的 models 字段。
 */
const CATALOG = {
  deepseek: [
    { id: 'deepseek-flash', label: 'Flash', note: '快、便宜，日常聊天够用（官方现有 2 个模型之一）' },
    { id: 'deepseek-v4-pro', label: 'Pro', note: '更强更稳，也贵一些（官方现有 2 个模型之一）' },
    { id: 'deepseek-chat', label: 'Chat 标准', note: '老名字，可能还能用；用不了就点「列出可用模型」' },
    { id: 'deepseek-reasoner', label: 'Reasoner 推理', note: '老名字，先想再说；用不了就点「列出可用模型」' },
  ],
  // 硅基流动的可用模型各家不同，直接用手填或「列出可用模型」拉真实的
  siliconflow: [],
};

/** 某个接入方式的预设档位 */
function catalog(id) {
  return CATALOG[id] || [];
}

/** 把模型名翻成好看的档位名（找不到就返回原名） */
function labelOf(id, model) {
  const hit = catalog(id).find((x) => x.id === model);
  return hit ? hit.label : model;
}

function providerDefaults(id) {
  const p = PRESETS.find((x) => x.id === id);
  return p
    ? { baseUrl: p.baseUrl, apiKey: '', model: p.model }
    : { baseUrl: '', apiKey: '', model: '' };
}

function currentConfig() {
  const model = settings.getIn('model') || {};
  return model;
}

/** 把 HTTP 错误码翻成人话，别让用户对着 401 发呆 */
function friendlyHttpError(status, text) {
  const raw = String(text || '').slice(0, 200);
  if (status === 401 || status === 403) return 'Key 不对或者没填（HTTP 401）—— 去模型页「配置」里粘一条完整的 API Key 再试';
  if (status === 402) return '余额不足（HTTP 402）—— 去服务商后台充值';
  if (status === 404) return '模型名不对（HTTP 404）—— 点「列出可用模型」挑一个真实存在的名字';
  if (status === 400 && /supported api model|model.*not found|invalid model/i.test(raw)) {
    return '这个模型名官方不认（HTTP 400）—— 点「列出可用模型」挑一个，比如 deepseek-flash';
  }
  if (status === 429) return '请求太频繁或超出额度（HTTP 429）—— 等一会儿再试，或换个模型';
  if (status >= 500) return '服务商那边出错了（HTTP ' + status + '），过一会儿再试';
  return '模型接口返回 ' + status + '：' + raw;
}

function trimUrl(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}

/** 合并预置信息 + 玩家填的配置，给界面用 */
function describe(id, raw) {
  const preset = PRESETS.find((x) => x.id === id);
  const cfg = raw || {};
  return {
    id,
    name: (preset && preset.name) || id,
    subtitle: (preset && preset.subtitle) || '',
    hint: (preset && preset.hint) || '',
    needsKey: !!(preset && preset.needsKey),
    embeddingModel: cfg.embeddingModel || (preset && preset.embeddingModel) || '',
    baseUrl: cfg.baseUrl || (preset && preset.baseUrl) || '',
    model: cfg.model || (preset && preset.model) || '',
    modelLabel: labelOf(id, cfg.model || (preset && preset.model) || ''),
    hasKey: !!(cfg.apiKey && String(cfg.apiKey).trim()),
    apiKeyMasked: cfg.apiKey ? '••••••' + String(cfg.apiKey).slice(-4) : '',
  };
}

async function fetchJson(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs || TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch (_) {
      json = null;
    }
    return { ok: res.ok, status: res.status, json, text };
  } finally {
    clearTimeout(timer);
  }
}

function authHeaders(cfg, extra) {
  const headers = { 'Content-Type': 'application/json', ...(extra || {}) };
  if (cfg.apiKey && String(cfg.apiKey).trim()) {
    headers.Authorization = 'Bearer ' + String(cfg.apiKey).trim();
  }
  return headers;
}

const ai = {
  PRESETS,

  /** 三套接入 + 当前用哪套 */
  overview() {
    const cfg = currentConfig();
    const providers = cfg.providers || {};
    return {
      active: cfg.active || 'ollama',
      providers: PRESETS.map((p) => describe(p.id, providers[p.id])),
      chat: cfg.chat || {},
      memory: cfg.memory || {},
      persona: cfg.persona || {},
    };
  },

  get(id) {
    const cfg = currentConfig();
    return describe(id, (cfg.providers || {})[id]);
  },

  /** 真正的 Key，只在主进程内部用，不给界面 */
  keyOf(id) {
    const cfg = currentConfig();
    return ((cfg.providers || {})[id] || {}).apiKey || '';
  },

  /** 只改传入的字段；apiKey 传空字符串表示"不改"，传 null 表示清空 */
  save(id, patch) {
    const cfg = currentConfig();
    const providers = { ...(cfg.providers || {}) };
    const old = { ...providerDefaults(id), ...(providers[id] || {}) };
    const next = { ...old };

    if (patch && typeof patch === 'object') {
      for (const key of ['baseUrl', 'model', 'apiKey', 'embeddingModel']) {
        if (!(key in patch)) continue;
        const value = patch[key];
        if (key === 'apiKey' && value === '') continue; // 空 = 不改
        next[key] = value === null ? '' : String(value);
      }
    }
    providers[id] = next;
    settings.patch({ model: { providers } });
    return describe(id, next);
  },

  setActive(id) {
    if (!PRESETS.some((p) => p.id === id)) throw new Error('不认识的接入方式：' + id);
    settings.patch({ model: { active: id } });
    return ai.overview();
  },

  /** 试连：拉一下 /models，顺便把可用模型名带回来。override 用于「还没保存时先试一下」 */
  async test(id, override) {
    const o = override || {};
    const saved = ai.get(id);
    const p = { ...saved };
    if (o.baseUrl) p.baseUrl = String(o.baseUrl).trim();
    const key = o.apiKey ? String(o.apiKey).trim() : ai.keyOf(id);
    const base = trimUrl(p.baseUrl);
    if (!base) return { ok: false, detail: '还没填接口地址' };

    const started = Date.now();
    try {
      const res = await fetchJson(base + '/models', { method: 'GET', headers: authHeaders({ apiKey: key }, {}) });
      const ms = Date.now() - started;
      if (!res.ok) {
        return { ok: false, detail: `接口返回 ${res.status}`, ms, raw: (res.text || '').slice(0, 300) };
      }
      const list = (res.json && (res.json.data || res.json.models)) || [];
      const names = list
        .map((m) => (typeof m === 'string' ? m : m.id || m.name || m.model))
        .filter(Boolean)
        .slice(0, 200);
      return { ok: true, detail: `连上了，${names.length} 个模型可用`, ms, models: names };
    } catch (err) {
      const ms = Date.now() - started;
      const msg = err && err.name === 'AbortError' ? '超时没响应' : String((err && err.message) || err);
      return { ok: false, detail: msg, ms };
    }
  },

  /** 试连用的是真 Key（test 里单独处理） */
  async chat(id, messages, options) {
    const p = ai.get(id);
    const base = trimUrl(p.baseUrl);
    if (!base) throw new Error('还没配置接口地址');
    const cfg = currentConfig();
    const opts = options || {};
    const model = opts.model || p.model;
    const body = {
      model,
      messages,
      stream: false,
      max_tokens: opts.maxTokens || (cfg.chat && cfg.chat.maxTokens) || 1024,
    };
    // reasoner 这类推理模型不接受 temperature，带上会报 400
    if (!/reasoner|thinking|r1/i.test(String(model || ''))) {
      body.temperature = typeof opts.temperature === 'number'
        ? opts.temperature
        : (cfg.chat && cfg.chat.temperature) || 0.7;
    }
    const started = Date.now();
    const sysChars = (messages || [])
      .filter((m) => m && m.role === 'system')
      .reduce((n, m) => n + String(m.content || '').length, 0);
    let res;
    try {
      res = await fetchJson(base + '/chat/completions', {
        method: 'POST',
        headers: authHeaders({ apiKey: ai.keyOf(id) }),
        body: JSON.stringify(body),
      }, opts.timeoutMs || 60000);
    } catch (err) {
      usage.record({
        kind: 'chat',
        provider: id,
        model: body.model,
        ms: Date.now() - started,
        ok: false,
        msgs: (messages || []).length,
        sysChars,
      });
      throw err;
    }
    if (!res.ok) {
      usage.record({
        kind: 'chat',
        provider: id,
        model: body.model,
        ms: Date.now() - started,
        ok: false,
        msgs: (messages || []).length,
        sysChars,
      });
      throw new Error(friendlyHttpError(res.status, res.text));
    }
    const text = res.json && res.json.choices && res.json.choices[0] && res.json.choices[0].message
      ? res.json.choices[0].message.content
      : '';
    const u = (res.json && res.json.usage) || {};
    usage.record({
      kind: 'chat',
      provider: id,
      model: body.model,
      promptTokens: u.prompt_tokens || 0,
      completionTokens: u.completion_tokens || 0,
      totalTokens: u.total_tokens || 0,
      ms: Date.now() - started,
      ok: true,
      msgs: (messages || []).length,
      sysChars,
    });
    return String(text || '');
  },

  /** 拿向量（记忆用）。返回 number[][]，长度和入参一一对应 */
  async embed(id, inputs) {
    const p = ai.get(id);
    const base = trimUrl(p.baseUrl);
    if (!base) throw new Error('还没配置接口地址');
    const list = Array.isArray(inputs) ? inputs : [inputs];
    const model = p.embeddingModel || p.model;
    if (!model) throw new Error('还没填向量模型名');
    const res = await fetchJson(base + '/embeddings', {
      method: 'POST',
      headers: authHeaders({ apiKey: ai.keyOf(id) }),
      body: JSON.stringify({ model, input: list }),
    }, 30000);
    if (!res.ok) throw new Error(`向量接口返回 ${res.status}：${(res.text || '').slice(0, 200)}`);
    const data = (res.json && res.json.data) || [];
    return data.map((d) => d.embedding || []);
  },
};

ai.catalog = catalog;
ai.labelOf = labelOf;

module.exports = ai;
