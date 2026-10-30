'use strict';

/**
 * 设置存储
 * ------------------------------------------------------------
 * 用一个 settings.json 存全部用户设置，结构固定、只增不改。
 * 读取时永远和 DEFAULTS 做深合并 —— 老版本文件缺的字段自动补上，
 * 所以以后加新设置项不用写迁移脚本。
 */

const fs = require('node:fs');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const P = require('./paths');
const log = require('./logger');

/** 支持的语言（以后加语言只改这里 + 渲染端字典） */
const LOCALES = ['zh-CN', 'en-US'];

const DEFAULTS = {
  schema: 1,
  general: {
    language: 'zh-CN',
    startOnBoot: false,
  },
  window: {
    width: 1200,
    height: 780,
    maximized: false,
  },
  ui: {
    stopped: false,
    // 下次启动直接回到上次看的页面
    lastPage: 'dashboard',
    // 插件卡片上显示「归属：人格管理 → …」而不是「权限：PC」（默认关）
    verbosePermission: false,
  },
  plugins: {
    // 用户手动启用的（针对"默认不启用"的插件）
    enabled: [],
    // 用户手动停用的（针对"默认启用"的插件）
    disabled: [],
  },
  // ---- 大模型接入（M4）----
  model: {
    // 当前用哪一套：ollama / siliconflow / deepseek / custom
    active: 'ollama',
    chat: { temperature: 0.7, maxTokens: 1024 },
    // 每套的地址、模型名、Key（Key 只存本机）
    providers: {
      ollama: { baseUrl: 'http://127.0.0.1:11434/v1', apiKey: '', model: 'qwen2.5:7b' },
      siliconflow: { baseUrl: 'https://api.siliconflow.cn/v1', apiKey: '', model: 'deepseek-ai/DeepSeek-V3' },
      deepseek: { baseUrl: 'https://api.deepseek.com/v1', apiKey: '', model: 'deepseek-chat' },
      custom: { baseUrl: 'http://127.0.0.1:8000/v1', apiKey: '', model: '' },
    },
    // 记忆：存在本地，向量可以向 ollama / siliconflow 借
    memory: {
      backend: 'local',
      topK: 5,
      // 自动提炼：聊完让本地小模型挑一句值得记的（provider 跟 model 必须配套，
      // 否则会拿本地模型名去请求云端接口，静默 400）
      distill: { enabled: true, provider: 'ollama', model: 'qwen2.5:0.5b', maxItems: 2 },
    },
    // 视觉：自己填任何 OpenAI 兼容的看图接口（baseUrl / key / 模型名）
    vision: {
      enabled: false,
      baseUrl: '',
      apiKey: '',
      model: '',
      maxTokens: 400,
      timeoutMs: 40000,
    },
    // 语音（TTS）：自己填任何 OpenAI 兼容的 /audio/speech 接口
    voice: {
      provider: 'openai',
      appid: '',
      accessToken: '',
      cluster: 'volcano_tts',
      voiceType: '',
      enabled: false,
      baseUrl: '',
      apiKey: '',
      model: '',
      voice: '',
      format: 'mp3',
      speed: 1,
      maxChars: 120,
      chance: 0.15,
      timeoutMs: 30000,
    },
  },
  // ---- 长期记忆（v2）：召回预算 / 遗忘曲线 / 备份 ----
  memory: {
    recall: { k: 5, budget: 700, profileBudget: 220 },
    // 艾宾浩斯：半衰期、归档阈值、最少放多少天才归档
    decay: { enabled: true, halfLifeDays: 30, archiveBelow: 0.28, minAgeDays: 21 },
    // 云端备份：填了 http(s) 地址就 PUT 一份 JSON 上去（WebDAV 之类）
    backup: { url: '', lastAt: 0, lastOk: false, lastError: '' },
  },
  // ---- 人格 ----
  personas: {
    activeId: 'whale-girl',
    // 只存"改过的"和"自建的"，内置预设永远在代码里
    items: [],
  },
  // ---- 表情包 ----
  stickers: {
    // 图在你自己的目录里，这里只记路径（空 = 还没选目录）
    source: '',
    // 管理员发来的表情包，收到就收进表情包库（默认开）
    saveFromOwner: true,
    // 自动配图：什么时候配哪张（"模型 → 表情包"里改）
    auto: {
      enabled: true,
      chance: 0.2,
      // 情绪 id -> 用哪个分组。空着就用内饰默认值
      map: {},
    },
  },
  // ---- 对外规矩（护栏）：只有管理员不受限 ----
  guard: {
    enabled: true,
    // 用户自己写的规矩，一行一条（系统那几条写死在 core/guard.js，不可改）
    rules: [],
    // 被追问隐私时允许甩表情包挡回去
    stickerBlock: true,
  },
  // ---- 自动回复 ----
  autoreply: {
    enabled: false,
    scope: 'private', // private = 只回私聊；group = 只回群；all = 都回
    groupAtOnly: true, // 群里只有 @ 她才回
    useSticker: true,
    stickerMode: 'both', // both = 文字+图；sticker = 只发图；random = 随机二选一
    stickerChance: 0.2,
    contextLines: 8,
    minGapSec: 20, // 同一会话最快多久回一条（冷却期间的消息合并）
    maxPerMinute: 4, // 每分钟上限，超了直接丢弃
    typingDelay: true, // 回之前先"打一会儿字"
  },
  // ---- 通道 ----
  channels: {
    qq: {
      // 主人（管理员）的 QQ 号：永远在白名单里，关系/成长也算他
      ownerQq: '',
      autoConnect: false,
      wsUrl: 'ws://127.0.0.1:3001',
      accessToken: '',
      napcatPath: '',
      // 只和这些人互动（空的 = 谁都不回，安全默认）
      allowedUsers: [],
      // 主动找人说话
      proactive: {
        enabled: false,
        everyMinutes: 90,
        quietFrom: '23:00',
        quietTo: '08:00',
        useSticker: true,
        lastAtMs: 0,
      },
    },
    bilibili: {
      // 主人（收信的人）
      ownerUid: '',
      ownerName: '',
      // 她自己（登录进来的那个小号，扫码成功后自动填）
      selfUid: '',
      selfName: '',
      // 兼容老字段：uid/name 就是主人
      uid: '',
      name: '',
      cookie: '',
      sessdata: '',
      biliJct: '',
      buvid3: '',
      autoRecommend: false,
      autoDaily: false,
      everyMinutes: 240,
      shareWithVideo: true,
    },
  },
  // ---- 成长 ----
  growth: {
    enabled: true,
    perMessage: 3, // 对方发来一句
    perReply: 2, // 我回一句
    perProactive: 2, // 我主动说一句
  },
  // ---- 关系（好感度 0~100，她会因此改变说话温度）----
  bond: {
    enabled: true,
    perMessage: 1,
    perReply: 1,
    perProactive: 2,
  },
  // ---- 能力清单（说明能做 / 不能做）----
  abilities: {
    notes: {},
    custom: [],
  },
  // ---- 桌宠 ----
  pet: {
    enabled: false,
    size: 220,
    opacity: 1,
    alwaysOnTop: true,
    corner: 'bottom-right',
  },
  group: {
    enabled: false,
    allowedGroups: [],
    atOnly: true,
    cooldownSec: 90,
    maxPerMinute: 3,
    jumpChance: 0.35,
    joinQuiet: true,
  },
  remote: {
    enabled: false,
    allowed: [],
    allowRunCmd: false,
    maxPerMinute: 8,
  },
};

const bus = new EventEmitter();
let current = clone(DEFAULTS);

// ---------------------------------------------------------------------------

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function deepMerge(base, patch) {
  const out = clone(base);
  if (!isPlainObject(patch)) return out;
  for (const [key, value] of Object.entries(patch)) {
    if (isPlainObject(value) && isPlainObject(out[key])) {
      out[key] = deepMerge(out[key], value);
    } else if (value !== undefined) {
      out[key] = clone(value);
    }
  }
  return out;
}

function uniqStrings(list) {
  if (!Array.isArray(list)) return [];
  return [...new Set(list.filter((v) => typeof v === 'string' && v.length > 0))];
}

function clampInt(value, min, max, fallback) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** 把任意输入整理成合法设置（容错，不报错） */
function normalize(raw) {
  const s = deepMerge(DEFAULTS, isPlainObject(raw) ? raw : {});

  if (!LOCALES.includes(s.general.language)) s.general.language = DEFAULTS.general.language;
  s.general.startOnBoot = !!s.general.startOnBoot;

  s.window.width = clampInt(s.window.width, 960, 4000, DEFAULTS.window.width);
  s.window.height = clampInt(s.window.height, 640, 3000, DEFAULTS.window.height);
  s.window.maximized = !!s.window.maximized;

  s.ui.stopped = !!s.ui.stopped;
  if (typeof s.ui.lastPage !== 'string' || !s.ui.lastPage) s.ui.lastPage = DEFAULTS.ui.lastPage;
  s.ui.verbosePermission = !!s.ui.verbosePermission;

  s.plugins.enabled = uniqStrings(s.plugins.enabled);
  s.plugins.disabled = uniqStrings(s.plugins.disabled);

  // 大模型：只做范围收一下，字段写错不影响启动
  const m = s.model;
  // 允许的接入方式：以后加新接入（比如新服务商）记得把 id 补进来
  if (!['ollama', 'siliconflow', 'deepseek', 'custom'].includes(m.active)) m.active = 'ollama';
  if (!['local', 'ollama', 'siliconflow'].includes(m.memory.backend)) m.memory.backend = 'local';
  m.memory.topK = clampInt(m.memory.topK, 1, 20, 5);
  m.chat.temperature = Math.min(2, Math.max(0, Number(m.chat.temperature) || 0.7));
  m.chat.maxTokens = clampInt(m.chat.maxTokens, 64, 32000, 1024);
  for (const id of ['ollama', 'siliconflow', 'custom']) {
    if (!isPlainObject(m.providers[id])) m.providers[id] = clone(DEFAULTS.model.providers[id]);
    m.providers[id].baseUrl = String(m.providers[id].baseUrl || '');
    m.providers[id].apiKey = String(m.providers[id].apiKey || '');
    m.providers[id].model = String(m.providers[id].model || '');
  }

  // 人格
  if (typeof s.personas.activeId !== 'string' || !s.personas.activeId) {
    s.personas.activeId = DEFAULTS.personas.activeId;
  }
  if (!Array.isArray(s.personas.items)) s.personas.items = [];

  // 通道
  const qq = s.channels.qq;
  qq.autoConnect = !!qq.autoConnect;
  qq.wsUrl = String(qq.wsUrl || DEFAULTS.channels.qq.wsUrl);
  qq.accessToken = String(qq.accessToken || '');
  qq.napcatPath = String(qq.napcatPath || '');
  qq.allowedUsers = uniqStrings(qq.allowedUsers).map((v) => v.replace(/\s+/g, '')).filter(Boolean);
  qq.ownerQq = String(qq.ownerQq || '').replace(/\D/g, '');

  if (!isPlainObject(qq.proactive)) qq.proactive = clone(DEFAULTS.channels.qq.proactive);
  qq.proactive.enabled = !!qq.proactive.enabled;
  qq.proactive.everyMinutes = clampInt(qq.proactive.everyMinutes, 15, 720, 90);
  qq.proactive.quietFrom = /^\d{1,2}:\d{2}$/.test(qq.proactive.quietFrom) ? qq.proactive.quietFrom : '23:00';
  qq.proactive.quietTo = /^\d{1,2}:\d{2}$/.test(qq.proactive.quietTo) ? qq.proactive.quietTo : '08:00';
  // 24:00 就是 00:00，统一一下省得界面看着怪
  if (qq.proactive.quietFrom === '24:00') qq.proactive.quietFrom = '00:00';
  if (qq.proactive.quietTo === '24:00') qq.proactive.quietTo = '00:00';
  qq.proactive.useSticker = qq.proactive.useSticker !== false;
  qq.proactive.lastAtMs = Math.max(0, Number(qq.proactive.lastAtMs) || 0);

  if (!isPlainObject(s.channels.bilibili)) s.channels.bilibili = clone(DEFAULTS.channels.bilibili);
  s.channels.bilibili.ownerUid = String(s.channels.bilibili.ownerUid || '').trim();
  s.channels.bilibili.ownerName = String(s.channels.bilibili.ownerName || '').trim();
  s.channels.bilibili.selfUid = String(s.channels.bilibili.selfUid || '').trim();
  s.channels.bilibili.selfName = String(s.channels.bilibili.selfName || '').trim();
  // 老数据迁移：uid/name 就是主人
  if (!s.channels.bilibili.ownerUid && s.channels.bilibili.uid) s.channels.bilibili.ownerUid = s.channels.bilibili.uid;
  if (!s.channels.bilibili.ownerName && s.channels.bilibili.name) s.channels.bilibili.ownerName = s.channels.bilibili.name;
  s.channels.bilibili.uid = String(s.channels.bilibili.uid || '').trim();
  s.channels.bilibili.name = String(s.channels.bilibili.name || '').trim();
  s.channels.bilibili.cookie = String(s.channels.bilibili.cookie || '').trim();
  s.channels.bilibili.sessdata = String(s.channels.bilibili.sessdata || '').trim();
  s.channels.bilibili.biliJct = String(s.channels.bilibili.biliJct || '').trim();
  s.channels.bilibili.buvid3 = String(s.channels.bilibili.buvid3 || '').trim();
  s.channels.bilibili.autoRecommend = !!s.channels.bilibili.autoRecommend;
  s.channels.bilibili.autoDaily = !!s.channels.bilibili.autoDaily;
  s.channels.bilibili.shareWithVideo = s.channels.bilibili.shareWithVideo !== false;
  s.channels.bilibili.everyMinutes = clampInt(s.channels.bilibili.everyMinutes, 30, 1440, 240);

  // 成长
  s.growth.enabled = s.growth.enabled !== false;
  s.growth.perMessage = clampInt(s.growth.perMessage, 0, 50, 3);
  s.growth.perReply = clampInt(s.growth.perReply, 0, 50, 2);
  s.pet.enabled = !!s.pet.enabled;
  s.pet.size = clampInt(s.pet.size, 120, 600, 260);
  s.pet.opacity = Math.max(0.2, Math.min(1, Number(s.pet.opacity) || 1));
  s.pet.alwaysOnTop = s.pet.alwaysOnTop !== false;
  s.pet.corner = ['bottom-right','bottom-left','top-right','top-left'].includes(s.pet.corner) ? s.pet.corner : 'bottom-right';
  s.group.enabled = !!s.group.enabled;
  s.group.allowedGroups = Array.isArray(s.group.allowedGroups) ? s.group.allowedGroups.map(String).filter(Boolean) : [];
  s.group.atOnly = s.group.atOnly !== false;
  s.group.cooldownSec = clampInt(s.group.cooldownSec, 20, 600, 90);
  s.group.maxPerMinute = clampInt(s.group.maxPerMinute, 1, 10, 3);
  s.group.jumpChance = Math.max(0, Math.min(1, Number(s.group.jumpChance) || 0.35));
  s.group.joinQuiet = s.group.joinQuiet !== false;
  s.growth.perProactive = clampInt(s.growth.perProactive, 0, 50, 2);

  // 关系（好感度）
  if (!isPlainObject(s.bond)) s.bond = clone(DEFAULTS.bond);
  s.bond.enabled = s.bond.enabled !== false;
  s.bond.perMessage = clampInt(s.bond.perMessage, 0, 10, 1);
  s.bond.perReply = clampInt(s.bond.perReply, 0, 10, 1);
  s.bond.perProactive = clampInt(s.bond.perProactive, 0, 10, 2);

  // 记忆自动提炼
  if (!isPlainObject(s.model.memory.distill)) s.model.memory.distill = clone(DEFAULTS.model.memory.distill);
  s.model.memory.distill.enabled = s.model.memory.distill.enabled !== false;
  s.model.memory.distill.provider = ['ollama', 'deepseek', 'siliconflow', 'custom'].includes(s.model.memory.distill.provider)
    ? s.model.memory.distill.provider
    : 'ollama';
  s.model.memory.distill.model = String(s.model.memory.distill.model || 'qwen2.5:0.5b');
  // provider 和 model 得配套：云端接口不认识带冒号的 Ollama 模型名
  if (s.model.memory.distill.provider !== 'ollama' && s.model.memory.distill.model.includes(':')) {
    s.model.memory.distill.provider = 'ollama';
  }
  s.model.memory.distill.maxItems = clampInt(s.model.memory.distill.maxItems, 1, 5, 2);

  // 视觉 API
  if (!isPlainObject(s.model.vision)) s.model.vision = clone(DEFAULTS.model.vision);
  s.model.vision.enabled = s.model.vision.enabled === true;
  s.model.vision.baseUrl = String(s.model.vision.baseUrl || '');
  s.model.vision.apiKey = String(s.model.vision.apiKey || '');
  s.model.vision.model = String(s.model.vision.model || '');
  s.model.vision.maxTokens = clampInt(s.model.vision.maxTokens, 64, 2000, 400);
  s.model.vision.timeoutMs = clampInt(s.model.vision.timeoutMs, 5000, 120000, 40000);

  // 语音（TTS）
  if (!isPlainObject(s.model.voice)) s.model.voice = clone(DEFAULTS.model.voice);
  s.model.voice.enabled = s.model.voice.enabled === true;
  s.model.voice.baseUrl = String(s.model.voice.baseUrl || '');
  s.model.voice.apiKey = String(s.model.voice.apiKey || '');
  s.model.voice.model = String(s.model.voice.model || '');
  s.model.voice.voice = String(s.model.voice.voice || '');
  s.model.voice.format = String(s.model.voice.format || 'mp3');
  s.model.voice.speed = Math.max(0.5, Math.min(2, Number(s.model.voice.speed) || 1));
  s.model.voice.maxChars = clampInt(s.model.voice.maxChars, 20, 600, 120);
  s.model.voice.chance = Math.max(0, Math.min(1, Number(s.model.voice.chance) || 0));
  s.model.voice.provider = s.model.voice.provider === 'doubao' ? 'doubao' : 'openai';
  s.model.voice.appid = String(s.model.voice.appid || '');
  s.model.voice.accessToken = String(s.model.voice.accessToken || '');
  s.model.voice.cluster = String(s.model.voice.cluster || 'volcano_tts');
  s.model.voice.voiceType = String(s.model.voice.voiceType || '');
  s.model.voice.timeoutMs = clampInt(s.model.voice.timeoutMs, 5000, 120000, 30000);

  // 长期记忆 v2：召回 / 遗忘 / 备份
  if (!isPlainObject(s.memory)) s.memory = clone(DEFAULTS.memory);
  if (!isPlainObject(s.memory.recall)) s.memory.recall = clone(DEFAULTS.memory.recall);
  s.memory.recall.k = clampInt(s.memory.recall.k, 1, 12, 5);
  s.memory.recall.budget = clampInt(s.memory.recall.budget, 200, 2400, 700);
  s.memory.recall.profileBudget = clampInt(s.memory.recall.profileBudget, 0, 600, 220);
  if (!isPlainObject(s.memory.decay)) s.memory.decay = clone(DEFAULTS.memory.decay);
  s.memory.decay.enabled = s.memory.decay.enabled !== false;
  s.memory.decay.halfLifeDays = clampInt(s.memory.decay.halfLifeDays, 3, 365, 30);
  s.memory.decay.minAgeDays = clampInt(s.memory.decay.minAgeDays, 1, 365, 21);
  const ab = Number(s.memory.decay.archiveBelow);
  s.memory.decay.archiveBelow = Number.isFinite(ab) ? Math.min(0.8, Math.max(0.05, ab)) : 0.28;
  if (!isPlainObject(s.memory.backup)) s.memory.backup = clone(DEFAULTS.memory.backup);
  s.memory.backup.url = String(s.memory.backup.url || '').trim();
  s.memory.backup.lastAt = Math.max(0, Number(s.memory.backup.lastAt) || 0);
  s.memory.backup.lastOk = !!s.memory.backup.lastOk;
  s.memory.backup.lastError = String(s.memory.backup.lastError || '');

  // 能力清单
  if (!isPlainObject(s.abilities)) s.abilities = clone(DEFAULTS.abilities);
  if (!isPlainObject(s.abilities.notes)) s.abilities.notes = {};
  if (!Array.isArray(s.abilities.custom)) s.abilities.custom = [];

  // ---- 遥控电脑 ----
  if (!isPlainObject(s.remote)) s.remote = clone(DEFAULTS.remote);
  s.remote.enabled = !!s.remote.enabled;
  s.remote.allowRunCmd = !!s.remote.allowRunCmd;
  s.remote.allowed = Array.isArray(s.remote.allowed)
    ? s.remote.allowed.map((v) => String(v).replace(/\D/g, '')).filter(Boolean)
    : [];
  s.remote.maxPerMinute = clampInt(s.remote.maxPerMinute, 1, 30, 8);

  // 表情包
  s.stickers.source = String((s.stickers && s.stickers.source) || '');
  s.stickers.saveFromOwner = s.stickers.saveFromOwner !== false;
  if (!isPlainObject(s.stickers.auto)) s.stickers.auto = clone(DEFAULTS.stickers.auto);
  const sa = s.stickers.auto;
  sa.enabled = sa.enabled !== false;
  sa.chance = Math.min(1, Math.max(0, Number(sa.chance)));
  if (!Number.isFinite(sa.chance)) sa.chance = DEFAULTS.stickers.auto.chance;
  if (!isPlainObject(sa.map)) sa.map = {};
  sa.map = Object.fromEntries(
    Object.entries(sa.map)
      .map(([k, v]) => [String(k || '').trim(), String(v || '').trim()])
      .filter(([k, v]) => k && v),
  );
  // 老版本只有 autoreply.stickerChance；现在概率以 stickers.auto.chance 为准
  if (typeof s.autoreply.stickerChance === 'number' && s.autoreply.stickerChance >= 0 && !Number.isFinite(Number(sa.chance))) {
    sa.chance = s.autoreply.stickerChance;
  }

  // 对外规矩（护栏）：系统那几条写死在 core/guard.js，这里只存用户自己写的
  if (!isPlainObject(s.guard)) s.guard = clone(DEFAULTS.guard);
  s.guard.enabled = s.guard.enabled !== false;
  s.guard.stickerBlock = s.guard.stickerBlock !== false;
  s.guard.rules = Array.isArray(s.guard.rules)
    ? s.guard.rules
        .map((v) => String(v || '').trim())
        .filter(Boolean)
        .slice(0, 20)
        .map((v) => v.slice(0, 300))
    : [];

  // 自动回复
  const ar = s.autoreply;
  ar.enabled = !!ar.enabled;
  ar.scope = ['private', 'group', 'all'].includes(ar.scope) ? ar.scope : 'private';
  ar.groupAtOnly = ar.groupAtOnly !== false;
  ar.useSticker = ar.useSticker !== false;
  ar.stickerMode = ['both', 'sticker', 'random'].includes(ar.stickerMode) ? ar.stickerMode : 'both';
  ar.stickerChance = Math.min(1, Math.max(0, Number(ar.stickerChance) || 0));
  ar.contextLines = clampInt(ar.contextLines, 2, 30, 8);
  ar.minGapSec = clampInt(ar.minGapSec, 0, 600, 20);
  ar.maxPerMinute = clampInt(ar.maxPerMinute, 1, 30, 4);
  ar.typingDelay = ar.typingDelay !== false;

  s.schema = DEFAULTS.schema;
  return s;
}

function load() {
  P.ensureDir(P.data);
  try {
    if (!fs.existsSync(P.settingsFile)) {
      current = clone(DEFAULTS);
      save();
      log.info('settings: 首次运行，已写入默认配置');
      return current;
    }
    // 记事本之类的编辑器保存时会带 BOM，JSON.parse 会直接报错，先剥掉
    const text = fs.readFileSync(P.settingsFile, 'utf8').replace(/^\uFEFF/, '');
    current = normalize(JSON.parse(text));
  } catch (err) {
    // 文件坏了不要直接崩：备份一份，然后用默认值继续
    log.ex('settings: 读取失败，回退默认值', err);
    try {
      fs.copyFileSync(P.settingsFile, P.settingsFile + '.broken-' + Date.now());
    } catch (_) {
      /* 备份失败就算了 */
    }
    current = clone(DEFAULTS);
  }
  return current;
}

function save() {
  try {
    P.ensureDir(P.data);
    const tmp = P.settingsFile + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(current, null, 2), 'utf8');
    fs.renameSync(tmp, P.settingsFile);
  } catch (err) {
    log.ex('settings: 保存失败', err);
  }
}

// ---------------------------------------------------------------------------
// 对外 API
// ---------------------------------------------------------------------------

const settings = {
  DEFAULTS,
  LOCALES,

  load,
  get: () => clone(current),
  /** 取某个字段，如 getIn('general.language') */
  getIn(key) {
    return key.split('.').reduce((acc, k) => (acc == null ? acc : acc[k]), current);
  },

  /** 局部更新：{ general: { language: 'en-US' } } */
  patch(partial) {
    const before = clone(current);
    current = normalize(deepMerge(current, partial));
    save();
    const changed = JSON.stringify(before) !== JSON.stringify(current);
    if (changed) bus.emit('change', clone(current));
    return clone(current);
  },

  /** 整体替换某个字段（深合并删不掉旧键时用它），如 replaceIn('stickers.auto.map', {}) */
  replaceIn(key, value) {
    const parts = String(key || '').split('.').filter(Boolean);
    if (!parts.length) return clone(current);
    const before = clone(current);
    const draft = clone(current);
    let cursor = draft;
    for (let i = 0; i < parts.length - 1; i += 1) {
      const k = parts[i];
      if (cursor[k] == null || typeof cursor[k] !== 'object') cursor[k] = {};
      cursor = cursor[k];
    }
    cursor[parts[parts.length - 1]] = value;
    current = normalize(draft);
    save();
    if (JSON.stringify(before) !== JSON.stringify(current)) bus.emit('change', clone(current));
    return clone(current);
  },

  /**
   * 恢复默认设置
   * ------------------------------------------------------------
   * 语义：回到「刚下载下来」的选项状态，但**不碰**这四样 ——
   *   1. 管理员身份（QQ 号 / 用户名 / B 站 UID 与用户名）
   *   2. 表情包（来源目录、自动发表情规则；索引在 data\stickers.json，本来就不归设置管）
   *   3. 养成（成长值/关系在数据库里，不跟着设置走）
   *   4. 记忆（同样在数据库里，不动）
   * 管理员页的密钥文件（data\admin-key.json）也单独存放，不在这里重置。
   */
  reset() {
    const kept = {
      ownerQq: current.channels.qq.ownerQq,
      ownerName: current.channels.qq.ownerName,
      biliOwnerUid: current.channels.bilibili.ownerUid,
      biliOwnerName: current.channels.bilibili.ownerName,
      stickers: clone(current.stickers),
    };
    current = clone(DEFAULTS);
    current.channels.qq.ownerQq = kept.ownerQq;
    current.channels.qq.ownerName = kept.ownerName;
    current.channels.bilibili.ownerUid = kept.biliOwnerUid;
    current.channels.bilibili.ownerName = kept.biliOwnerName;
    if (kept.stickers) current.stickers = kept.stickers;
    current = normalize(current);
    save();
    bus.emit('change', clone(current));
    return clone(current);
  },

  on: (event, handler) => bus.on(event, handler),
  off: (event, handler) => bus.off(event, handler),

  /** 插件开关状态查询（manifest 的 enabledByDefault 决定用哪个列表） */
  pluginEnabled(id, enabledByDefault) {
    if (enabledByDefault) return !current.plugins.disabled.includes(id);
    return current.plugins.enabled.includes(id);
  },

  setPluginEnabled(id, on, enabledByDefault) {
    const enabled = current.plugins.enabled.filter((x) => x !== id);
    const disabled = current.plugins.disabled.filter((x) => x !== id);
    if (on) {
      if (!enabledByDefault) enabled.push(id);
    } else if (enabledByDefault) {
      disabled.push(id);
    }
    return settings.patch({ plugins: { enabled, disabled } });
  },

  /** 插件被删掉之后，把它的启停记录也一起清掉 */
  forgetPlugin(id) {
    const enabled = current.plugins.enabled.filter((x) => x !== id);
    const disabled = current.plugins.disabled.filter((x) => x !== id);
    return settings.patch({ plugins: { enabled, disabled } });
  },
};

module.exports = settings;
