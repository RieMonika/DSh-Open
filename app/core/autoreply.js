'use strict';

/**
 * 自动回复
 * ------------------------------------------------------------
 * 流程：QQ 收到消息 → 判断该不该回 → 节流排队 → 拟人停顿
 *       → 拼上下文（人格 + 好感状态 + 相关记忆 + 最近几句）
 *       → 问模型 → 发回 QQ → 存收件箱 → 涨经验/好感 → 偷偷记一条
 *
 * 默认关闭。所有开关都在「通道」页里改。
 *
 * 三道刹车（别拆，拆了她就成了刷屏机器）：
 *   1. 白名单   —— 名单外的人，一句都不回
 *   2. 节流     —— 同一会话最快 N 秒回一条，冷却期间的消息合并成一条回
 *   3. 频率上限 —— 每分钟最多 M 条，超了直接丢弃（不排队、不补发）
 */

const settings = require('./settings');
const ai = require('./ai');
const personas = require('./personas');
const memory = require('./memory')
const memcard = require('./memcard');
const context = require('./context');
const rhythm = require('./rhythm')
const agenda = require('./agenda');
const group = require('./group');
const archive = require('./archive');
const stickers = require('./stickers');
const stickerRules = require('./stickerRules');
const guard = require('./guard');
const remote = require('./remote');
const inbox = require('./inbox');
const qq = require('./qq');
const growth = require('./growth');
const bond = require('./bond');
const distill = require('./distill');
const vision = require('./vision');
const voice = require('./voice');
const log = require('./logger');

const DEFAULTS = {
  enabled: false,
  scope: 'private', // private | group | all
  groupAtOnly: true, // 群里只有 @ 她才回
  useSticker: true,
  stickerChance: 0.2,
  contextLines: 8,
  minGapSec: 20,
  maxPerMinute: 4,
  typingDelay: true,
};

const wait = (ms) => new Promise((r) => setTimeout(r, Math.max(0, ms)));

// 运行时状态
const queues = new Map(); // convId -> { items: [{event, text}], timer }
const lastAt = new Map(); // convId -> 上次回复时间
const windowHits = new Map(); // convId -> [timestamps]

function cfg() {
  const a = settings.getIn('autoreply') || {};
  const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
  return {
    enabled: !!a.enabled,
    scope: ['private', 'group', 'all'].includes(a.scope) ? a.scope : 'private',
    groupAtOnly: a.groupAtOnly !== false,
    useSticker: a.useSticker !== false,
    // both = 文字+图 / sticker = 只发图 / random = 随机
    stickerMode: ['both', 'sticker', 'random'].includes(a.stickerMode) ? a.stickerMode : 'both',
    // 概率以「模型 → 表情包」里的设置为准，这里只读出来给界面看
    stickerChance: stickerRules.cfg().chance,
    contextLines: Math.max(2, Math.min(30, num(a.contextLines, 8))),
    minGapSec: Math.max(0, Math.min(600, num(a.minGapSec, 20))),
    maxPerMinute: Math.max(1, Math.min(30, num(a.maxPerMinute, 4))),
    typingDelay: a.typingDelay !== false,
  };
}

function saveConfig(patch) {
  const cur = { ...DEFAULTS, ...(settings.getIn('autoreply') || {}) };
  const p = patch || {};
  for (const key of ['enabled', 'useSticker', 'typingDelay', 'groupAtOnly']) {
    if (key in p) cur[key] = !!p[key];
  }
  if ('scope' in p) cur.scope = ['private', 'group', 'all'].includes(p.scope) ? p.scope : 'private';
  if ('stickerMode' in p) {
    cur.stickerMode = ['both', 'sticker', 'random'].includes(p.stickerMode) ? p.stickerMode : 'both';
  }
  if ('stickerChance' in p) {
    // 老界面还是这个字段：写到新地方去，两边永远一个数
    stickerRules.save({ chance: p.stickerChance });
    cur.stickerChance = stickerRules.cfg().chance;
  }
  if ('contextLines' in p) cur.contextLines = Math.max(2, Math.min(30, Number(p.contextLines) || 8));
  if ('minGapSec' in p) cur.minGapSec = Math.max(0, Math.min(600, Number(p.minGapSec) || 0));
  if ('maxPerMinute' in p) cur.maxPerMinute = Math.max(1, Math.min(30, Number(p.maxPerMinute) || 4));
  settings.patch({ autoreply: cur });
  return cfg();
}

function plainText(raw) {
  // 去掉 CQ 码，只留文字，喂给模型
  return String(raw || '')
    .replace(/\[CQ:[^\]]+\]/g, '')
    .trim();
}

/** 他是不是明说要语音（跟表情包一样：点名了这次就必给，不掷骰子） */
function isVoiceRequest(text) {
  return /(发.{0,4}语音|来.{0,4}语音|语音条|语音消息|念一?[段下遍句]|读一?[段下遍]|用声音|出声|唱一?[段下句]|说一?[段下句]给我听)/.test(
    String(text || ''),
  );
}

/** 这条消息里有没有图片/表情包 */
function hasImage(event) {
  const segs = Array.isArray(event && event.message) ? event.message : [];
  if (segs.some((s) => s && (s.type === 'image' || s.type === 'mface'))) return true;
  return /\[CQ:(?:image|mface)[,\]]/.test(String((event && event.raw_message) || ''));
}

/** 喂给模型的文字：没字但有图就给个占位，别当成空气 */
function inputText(event) {
  const text = plainText(event && event.raw_message);
  if (text) return text;
  return hasImage(event) ? '[发来一张图片]' : '';
}

/** 消息里第一张图的地址（http）或本地文件路径 */
function firstImage(event) {
  const segs = Array.isArray(event && event.message) ? event.message : [];
  for (const s of segs) {
    if (!s || (s.type !== 'image' && s.type !== 'mface')) continue;
    const d = s.data || {};
    const url = String(d.url || '').trim();
    if (url) return { url, file: String(d.file || '') };
    const file = String(d.file || '').trim();
    if (file) return { url: '', file };
  }
  return null;
}

/** 能用视觉 API 就看一眼，看不到就返回空串（上层会走「看不到」的提示） */
async function lookAtImage(event) {
  const pic = firstImage(event);
  if (!pic) return '';
  let cfg;
  try {
    cfg = vision.cfg();
  } catch (err) {
    return '';
  }
  if (!cfg.enabled || !cfg.baseUrl || !cfg.model || !cfg.apiKey) return '';
  try {
    const r = pic.url ? await vision.describe({ url: pic.url }) : await vision.describe({ file: pic.file });
    if (r && r.ok && r.text) return String(r.text).trim();
    if (r && !r.ok) log.warn('autoreply: 看图失败 —', r.error || '');
  } catch (err) {
    log.warn('autoreply: 看图失败 —', err && err.message);
  }
  return '';
}

function atMe(event) {
  const selfId = String(qq.status().selfId || '');
  if (!selfId) return false;
  if (event.atme === true) return true;
  const raw = String(event.raw_message || '');
  return raw.includes('[CQ:at,qq=' + selfId + ']');
}

/** 白名单：空的 = 谁都不回（安全默认，避免机器人乱回陌生人） */
function allowed(userId) {
  const list = settings.getIn('channels.qq.allowedUsers') || [];
  const ids = (Array.isArray(list) ? list : []).map(String);
  const owner = String(settings.getIn('channels.qq.ownerQq') || '').trim();
  if (owner && String(userId || '') === owner) return true;
  if (!ids.length) return false;
  return ids.includes(String(userId || ''));
}

/** 判断这条要不要回 */
function shouldReply(event) {
  const c = cfg();
  if (!c.enabled) return false;
  if (!event || event.post_type !== 'message') return false;
  if (event.message_type === 'group') {
    if (c.scope === 'private') return false;
    // 分寸感：@ 她一定接；没 @ 时看群聊配置（话题/冷却/限速）
    const g = group.decide({
      groupId: event.group_id,
      text: inputText(event),
      isAt: atMe(event),
      selfId: (qq.status() || {}).selfId,
    });
    if (!g.jump) return false;
    event.__groupJump = true;
    group.mark(event.group_id);
  } else if (c.scope === 'group') {
    return false;
  }
  if (event.user_id && String(event.user_id) === String(qq.status().selfId)) return false;
  if (!allowed(event.user_id)) return false; // 只和名单里的人互动
  if (!inputText(event)) return false; // 没有字也没有图才不回
  return true;
}

function rateOk(convId) {
  const c = cfg();
  const now = Date.now();
  const hits = (windowHits.get(convId) || []).filter((t) => now - t < 60000);
  windowHits.set(convId, hits);
  if (hits.length >= c.maxPerMinute) return false;
  hits.push(now);
  return true;
}

function gapFor(convId) {
  const c = cfg();
  const last = lastAt.get(convId) || 0;
  return Math.max(0, last + c.minGapSec * 1000 - Date.now());
}

function enqueue(event, text) {
  const convId = inbox.convIdOf(event);
  let q = queues.get(convId);
  if (!q) {
    q = { items: [], timer: null };
    queues.set(convId, q);
  }
  q.items.push({ event, text });
  if (q.timer) return;
  q.timer = setTimeout(() => flush(convId), gapFor(convId));
  if (q.items.length > 1) log.info('autoreply: ' + convId + ' 冷却中，先攒着');
}

async function flush(convId) {
  const q = queues.get(convId);
  if (!q) return;
  q.timer = null;
  if (!q.items.length) {
    queues.delete(convId);
    return;
  }
  // 还在一分钟上限里就别说了，直接丢 —— 排队会让它十分钟后复读一遍，更糟
  if (!rateOk(convId)) {
    log.warn('autoreply: ' + convId + ' 超过每分钟上限，丢弃 ' + q.items.length + ' 条');
    q.items = [];
    queues.delete(convId);
    return;
  }

  const batch = q.items.splice(0);
  const last = batch[batch.length - 1];
  const merged = batch.map((b) => b.text).filter(Boolean).join('\n');
  try {
    await respond(last.event, merged);
    lastAt.set(convId, Date.now());
  } catch (err) {
    log.warn('autoreply: 处理失败 —', err && err.message);
  }
  if (q.items.length) q.timer = setTimeout(() => flush(convId), gapFor(convId));
  else queues.delete(convId);
}

async function buildMessages(event, text) {
  const c = cfg();
  const conversationId = inbox.convIdOf(event);
  const pack = await context.build(conversationId, c.contextLines * 2);
  const history = pack.recent;
  const messages = [];

  const base = personas.promptOf() || '你是一个说话自然的中文助手。';
  const name = (event.sender && (event.sender.card || event.sender.nickname)) || '';
  const bondNote = bond.describe(event.user_id, name);
  messages.push({ role: 'system', content: bondNote ? base + '\n\n' + bondNote : base });

  // 对面不是管理员：把「对外规矩」拼进去（管理员自己聊不加，想说什么说什么）
  const guardNote = guard.promptFor({ channel: 'qq', userId: event.user_id });
  if (guardNote) messages.push({ role: 'system', content: guardNote });

  const hh = new Date().getHours();
  const when = hh < 5 ? '凌晨' : hh < 9 ? '早上' : hh < 12 ? '上午' : hh < 14 ? '中午' : hh < 18 ? '下午' : hh < 23 ? '晚上' : '深夜';
    if (pack && pack.bridge) messages.push({ role: 'system', content: '上一次聊到这儿就断了，可以自然接上：\n' + pack.bridge });
  if (pack && pack.summary) messages.push({ role: 'system', content: '更早之前你们聊过（只剩印象）：' + pack.summary });
  messages.push({ role: 'system', content: `现在是${when}。像微信聊天那样回：口语、短句、可以有情绪，15 到 60 个字；别列条目、别用「首先其次」、别解释自己是 AI、别用敬语和客服腔、别每句都反问；可以撒娇、吐槽、接梗。` });

  // 他发的是图：能用视觉 API 就真看，看不到就别让它编
  if (hasImage(event)) {
    const desc = await lookAtImage(event);
    messages.push({
      role: 'system',
      content: desc
        ? '他刚发来一张图片（或表情包）。你看过了，图里大概是：' +
          desc +
          '\n别把这段描述原样念出来、别报流水账，像真看见了一样自然地接一句。'
        : '他刚发来一张图片（或表情包），你现在看不到图里的内容。别编造图里有什么；可以自然地接一句、撒个娇，或者直说「图看不到呀」，别装看懂了。',
    });
  }

  // 他让你发语音：这句话会被真念成一条语音发过去，别再推辞说「我发不了语音」
  if (isVoiceRequest(text)) {
    messages.push({
      role: 'system',
      content:
        '他让你发语音，这条回答会真的转成语音发过去。你就直接说这段要念的话：第一人称、口语、一句话说完；别加括号里的动作说明（比如「清嗓子」「笑」），别推辞说自己是文字发不了语音。',
    });
  }

  // 相关记忆（相似度+重要度+时间衰减+使用次数，由 memory 统一算）
  try {
    const hits = await memory.recall(text, { k: 5, budget: 700 });
    if (hits.length) {
      messages.push({
        role: 'system',
        content: '你记得这些事（别逐条复述，自然带到话里）：\n' + hits.map((h) => '- ' + h.text).join('\n'),
      });
    }
    const prof = memory.profile(3).filter((p) => !hits.some((h) => h.id === p.id));
    if (prof.length) {
      messages.push({ role: 'system', content: '关于他，你一直记着的：\n' + prof.map((p) => '· ' + p.text).join('\n') });
    }
  } catch (_) {
    /* 记忆不可用就不带 */
  }

  for (const item of history) {
    const role = item.role === 'user' ? 'user' : 'assistant';
    if (!item.text) continue;
    messages.push({ role, content: item.text });
  }
  if (!history.length || history[history.length - 1].text !== text) {
    messages.push({ role: 'user', content: text });
  }
  return messages;
}

/** 真人不会秒回：先"打一会儿字" */
async function humanDelay(text) {
  if (!cfg().typingDelay) return;
  const base = 1200 + Math.min(5000, String(text || '').length * 60);
  await wait(base + Math.random() * 2200);
}

async function respond(event, text) {
  const conversationId = inbox.convIdOf(event);
  try { archive.append({ who: String(event.user_id || event.group_id || ''), text: String(text || ''), kind: 'in' }); } catch (_) {}
  const providerId = settings.getIn('model.active') || 'ollama';
  const messages = await buildMessages(event, text);
  await humanDelay(text);

  let answer = (await ai.chat(providerId, messages)).trim();
  if (!answer) return;
  // 注意：这里不再解析「!Control computer：…」——危险动作只认「发消息的人自己发来的那一行」，
  // 由 remote.handle() 在执行前先查权限。她自己的回复里就算带了这行也不会被执行。
  try { archive.append({ who: 'her', text: answer, kind: 'out' }); } catch (_) {}

  const c = cfg();
  // 对方直接点名要表情包：这次必发一张，不再按概率
  const wantsSticker = /(表情包|表情|发个图|来个图|斗图|来张图)/.test(String(text || ''));
  // 让管理员也享受「被套话甩表情」就没意义了：只有非管理员才查
  const guardOn = guard.cfg().enabled && !guard.isAdmin('qq', event.user_id);
  const probing = guardOn && guard.isProbing(text);
  let sticker = null;
  if (probing && guard.cfg().stickerBlock && c.useSticker) {
    // 有人绕着问隐私：必甩一张「威胁」组的图，比讲道理管用
    try {
      sticker = stickers.pick('威胁') || null;
    } catch (_) {
      /* 没图就算了 */
    }
  } else if (c.useSticker && (wantsSticker || Math.random() < stickerRules.cfg().chance)) {
    try {
      // 按「她自己回的那句话」猜情绪，再挑对应分组 —— 不再是永远只挑「开心」
      const picked = stickerRules.pickFor(wantsSticker ? '哈哈好耶' : answer);
      sticker = (picked && picked.sticker) || null;
    } catch (_) {
      /* 表情发不出去就算了 */
    }
  }

  // 发法三选一：both 文字+图 / sticker 只发图 / random 随机
  let payload = answer;
  let onlySticker = false;
  if (sticker) {
    const mode = ['both', 'sticker', 'random'].includes(c.stickerMode) ? c.stickerMode : 'both';
    onlySticker = mode === 'sticker' || (mode === 'random' && Math.random() < 0.5);
    payload = onlySticker ? stickers.cqOf(sticker.file) : answer + '\n' + stickers.cqOf(sticker.file);
  }

  // 偶尔用语音回：开着语音 API 且这次掷骰子中了，就把这句念出来发过去
  // 他明说要语音的话，这次必念（不看概率、字数上限放宽），失败就把原因一并说出来
  const wantsVoice = isVoiceRequest(text);
  let voiceFile = '';
  let voiceWhy = '';
  if (!onlySticker) {
    const vc = voice.cfg();
    const limit = wantsVoice ? Math.max(vc.maxChars, 400) : vc.maxChars;
    // 两家引擎要的东西不一样（OpenAI 要地址+模型，豆包要 APPID+Token+voice_type），统一问 voice.ready
    if (wantsVoice && !voice.ready(vc)) {
      voiceWhy =
        vc.provider === 'doubao'
          ? '豆包那三样还没填全（APPID / Access Token / voice_type）'
          : '语音接口还没填（地址 / 模型名）';
    } else if (wantsVoice && String(answer).length > limit) {
      voiceWhy = '这句太长（' + String(answer).length + ' 字，上限 ' + vc.maxChars + '）';
    } else if (voice.ready(vc) && String(answer).length <= limit && (wantsVoice || Math.random() < vc.chance)) {
      try {
        const v = await voice.speak(answer, { maxChars: limit });
        if (v && v.ok && v.file) voiceFile = v.file;
        else voiceWhy = (v && v.error) || '合成没成功';
      } catch (err) {
        voiceWhy = (err && err.message) || '合成没成功';
      }
      if (!voiceFile && voiceWhy) log.warn('autoreply: 语音合成失败 —', voiceWhy);
    }
  }

  // 他点的是语音却没出来：别装没事，把原因附在文字后面，省得他再问一遍
  if (!voiceFile && wantsVoice && voiceWhy) payload = payload + '\n（语音没出来：' + voiceWhy + '）';

  if (voiceFile) {
    const b64 = voice.toBase64(voiceFile);
    if (event.message_type === 'group') await qq.sendGroupVoice(event.group_id, b64);
    else await qq.sendPrivateVoice(event.user_id, b64);
  } else if (event.message_type === 'group') await qq.sendGroup(event.group_id, payload);
  else await qq.sendPrivate(event.user_id, payload);

  inbox.append(conversationId, {
    senderId: qq.status().selfId,
    senderName: qq.status().selfName || '我',
    text: onlySticker ? '[表情]' : voiceFile ? answer + '〔语音〕' : answer,
    role: 'assistant',
  });

  const name = (event.sender && (event.sender.card || event.sender.nickname)) || '';

  // 互动涨经验（群聊不算）
  try {
    if (settings.getIn('growth.enabled') !== false && event.message_type !== 'group') {
      growth.bump(event.user_id, settings.getIn('growth.perMessage') || 0, name);
      const g = growth.bump(event.user_id, settings.getIn('growth.perReply') || 0, name);
      if (g && g.leveledUp) log.info('growth: ' + event.user_id + ' 升到 ' + g.level + ' 级');
    }
  } catch (_) {
    /* 成长失败不影响回复 */
  }

  // 关系升温（私聊才算）
  try {
    if (settings.getIn('bond.enabled') !== false && event.message_type !== 'group') {
      bond.bump(event.user_id, settings.getIn('bond.perMessage') || 0, name);
      bond.bump(event.user_id, settings.getIn('bond.perReply') || 0, name);
    }
  } catch (_) {
    /* 关系失败不影响回复 */
  }

  // 偷偷记一条（不等待，失败无感）
  distill
    .learn({ userText: text, answer, name })
    .catch(() => {});

  log.info('autoreply: 已回复 ' + conversationId);
}

/** 挂到 QQ 的事件上（main.js 启动时调一次） */
function attach() {
  qq.onEvent(async (payload) => {
    if (!payload || payload.event !== 'message') return;
    const message = payload.message;
    const text = inputText(message);

    // 先让插件看一眼（插件自己决定要不要抢这条消息）；插件只认文字
    try {
      const plugins = require('./plugins');
      const seen = plugins.dispatchMessage(message, plainText(message.raw_message));
      if (seen && typeof seen.then === 'function') seen.catch(() => {});
    } catch (_) {
      /* 插件出错不影响本体回复 */
    }

    // 插件已经处理过的（比如改了资料），本体就不再回了
    if (message.__handled) return;

    // 遥控电脑：开着就把这句话当指令试一次。
    // 危险动作 / 指令行 / 「为什么没权限」这几类由它一句话说清，直接回、不再让模型再接一遍，
    // 免得同一个意思回两条消息；普通聊天还是交给模型（遥控只在后台顺手试一下）。
    const sendRemote = async (res) => {
      const payload = typeof res === 'string' ? res : res.text;
      const file = typeof res === 'string' ? '' : res.file;
      if (!payload && !file) return;
      const body = file ? payload + '\n' + stickers.cqOf(file) : payload;
      const to = message.message_type === 'group' ? null : message.user_id;
      if (to) await qq.sendPrivate(to, body);
      else await qq.sendGroup(message.group_id, body);
      inbox.append(inbox.convIdOf(message), {
        senderId: qq.status().selfId,
        senderName: qq.status().selfName || '我',
        text: payload,
        role: 'assistant',
      });
    };

    try {
      if (remote.cfg().enabled) {
        const looksLikeControl = !!(
          remote.parseCommandLine(text) ||
          remote.dangerOf(text) ||
          /(没有权限|没权限|为什么.*权限|凭什么|怎么才.*权限)/.test(String(text || ''))
        );
        if (looksLikeControl) {
          const res = await remote.handle(message.user_id, text);
          if (res) {
            await sendRemote(res);
            return;
          }
        } else {
          remote
            .handle(message.user_id, text)
            .then((res) => (res ? sendRemote(res) : null))
            .catch(() => {});
        }
      }
    } catch (_) {
      /* 遥控模块出问题不影响普通聊天 */
    }

    if (!shouldReply(message)) return;
    enqueue(message, text);
  });
}

/** 立即回一条（调试/测试用，绕过节流） */
async function reply(event) {
  const text = inputText(event);
  if (!text) return;
  await respond(event, text);
  lastAt.set(inbox.convIdOf(event), Date.now());
}

module.exports = { cfg, saveConfig, attach, reply, shouldReply, inputText, hasImage, isVoiceRequest, buildMessages };
