'use strict';

/**
 * B 站的「过日子」——
 * ------------------------------------------------------------
 * 她会自己刷视频，隔一段时间挑一个，用私信发给你。
 * 这是从 DSH 的「养鱼」插件搬过来的玩法：
 *   · 一天只锁定一个收信人，条数不限（B 站风控）
 *   · 同一个视频 7 天内不重复推
 *   · 只在 09:00–23:00 之间发，半夜不吵人
 *
 * 聊天文案走她的人设 + 记忆 + 关系，写不出来就退回固定模板，
 * 保证「一定能发出去」而不是因为模型没配好就整条流程哑掉。
 */

const fs = require('fs');
const path = require('path');
const P = require('./paths');
const log = require('./logger');
const settings = require('./settings');
const bilibili = require('./bilibili');
const personas = require('./personas');
const bond = require('./bond');
const ai = require('./ai');
const proactive = require('./proactive');

const STATE_FILE = path.join(P.data, 'bilibili-life.json');
const SEVEN_DAYS = 7 * 24 * 3600 * 1000;

let timer = null;

function state() {
  try {
    const s = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    return {
      lastAt: Number(s.lastAt) || 0,
      lastBv: String(s.lastBv || ''),
      history: Array.isArray(s.history) ? s.history : [],
    };
  } catch (_) {
    return { lastAt: 0, lastBv: '', history: [] };
  }
}

function saveState(next) {
  try {
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(next, null, 2), 'utf8');
  } catch (err) {
    log.ex('biliLife: 写状态失败', err);
  }
}

function cfg() {
  const c = settings.getIn('channels.bilibili') || {};
  const b = bilibili.cfg();
  return {
    enabled: !!c.autoDaily,
    everyMinutes: Math.max(60, Math.min(1440, Number(c.everyMinutes) || 240)),
    preferTags: b.preferTags || [],
    blockTags: b.blockTags || [],
  };
}

/** 最近 7 天推过的 BV 号 */
function recentBvs() {
  const now = Date.now();
  const s = state();
  return new Set(
    s.history.filter((h) => now - Number(h.at || 0) < SEVEN_DAYS).map((h) => String(h.bv || '')),
  );
}

function fallbackText(video, who) {
  const title = String(video.title || '').slice(0, 40);
  const head = who ? who + '，今天刷到个感觉你会喜欢：' : '今天刷到个感觉你会想看：';
  let text = head + title + '（' + (video.author || 'UP') + '）' + (video.url ? ' ' + video.url : '');
  if (text.length > bilibili.MAX_LEN) {
    text = head + title + ' ' + (video.url || '');
  }
  return text.slice(0, bilibili.MAX_LEN);
}

/** 让她用人设口吻写一句推荐；写不出来就用模板 */
async function compose(video, who) {
  const pid = settings.getIn('personas.activeId') || 'whale-girl';
  const persona = personas.promptOf(pid) || '';
  const uid = settings.getIn('channels.bilibili.uid') || '';
  const rel = uid ? bond.describe(uid, who) : '';
  const sys = [
    persona,
    rel,
    '你刚在 B 站刷到一个视频，要把它私信推荐给' + (who || '主人') + '。',
    '视频标题：「' + video.title + '」；UP 主：' + (video.author || '未知') + '。',
    '只写你要说的那一句话，20~45 个字，像平时发消息，不要列条目、不要解释你自己、不要加引号。',
    '最后可以把链接附上（我会自动补，不用你写）。',
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const reply = await ai.chat(settings.getIn('model.active') || 'ollama', [
      { role: 'system', content: sys },
      { role: 'user', content: '写一句推荐语。' },
    ], { temperature: 0.85, maxTokens: 120, timeoutMs: 30000 });
    let text = String(reply || '').trim().replace(/^["'「」]+|["'「」]+$/g, '');
    text = text.replace(/\s+/g, ' ');
    // 模型经常自己编一个链接/ BV 号，甚至编错 —— 全删掉，链接只由我们追加
    text = text
      .replace(/https?:\/\/\S+/gi, '')
      .replace(/BV[0-9A-Za-z]{10}/g, '')
      .replace(/[🗣👀👉🔗👉🏻👉🏼👉🏽👉🏼]+$/g, '')
      .replace(/[，,、\s]+$/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    if (!text) return fallbackText(video, who);
    const tail = video.url ? ' ' + video.url : '';
    if (!text.includes(video.url) && text.length + tail.length <= bilibili.MAX_LEN) text += tail;
    return text.slice(0, bilibili.MAX_LEN);
  } catch (err) {
    log.debug('biliLife: 模型没写出来，用模板 —— ' + (err && err.message));
    return fallbackText(video, who);
  }
}

/**
 * 候选池：热门 + （设了「想看的标签」时）按标签搜一批，去重后再筛
 */
async function candidates(prefs) {
  const tags = (prefs && prefs.preferTags) || [];
  let videos = await bilibili.popular(tags.length ? 30 : 12);
  if (tags.length) {
    const parts = await Promise.all(
      tags.slice(0, 3).map((t) => bilibili.searchVideos(t, 10).catch(() => [])),
    );
    const map = new Map();
    for (const v of videos.concat(...parts)) {
      if (v.bvid && !map.has(v.bvid)) map.set(v.bvid, v);
    }
    videos = [...map.values()];
  }
  return videos;
}

/**
 * 跑一次：挑一个没推过的视频，私信给主人。
 * manual=true 时忽略「间隔」限制（界面上「现在发一条」）。
 */
async function run(opts) {
  const manual = !!(opts && opts.manual);
  const c = bilibili.cfg();
  if (!c.uid) return { ok: false, message: '还没填你的 B 站 UID' };
  if (!manual && !cfg().enabled) return { ok: false, message: '自动私信没开' };

  const st = state();
  if (!manual) {
    // 节奏跟「通用 → 主动聊天」共用一套：固定间隔 / 概率曲线 / 免打扰时段都在那儿
    const d = proactive.decide('bili', st.lastAt);
    if (!d.send) {
      const why =
        d.why === 'off' ? '「主动聊天」总开关关着'
          : d.why === 'quiet' ? '现在是免打扰时段，不吵你'
            : d.why === 'waiting' ? '这一轮还没到掷骰子的十分钟'
              : d.why === 'fixed-wait' ? '还没到间隔时间'
                : '这次骰子没中（' + Math.round(d.chance) + '%）';
      return { ok: false, message: why, skipped: true };
    }
  }

  const prefs = cfg();
  let videos = [];
  try {
    videos = await candidates(prefs);
  } catch (err) {
    return { ok: false, message: '拉不到热门：' + (err && err.message ? err.message : err) };
  }
  const seen = recentBvs();
  const fresh = videos.filter((v) => !seen.has(v.bvid));
  const pool = fresh.length ? fresh : videos;
  if (!pool.length) return { ok: false, message: '一个视频都没拉到' };

  // 按「想看的标签 / 不看的标签」筛一遍
  const filtered = bilibili.filterVideos(pool, { preferTags: prefs.preferTags, blockTags: prefs.blockTags });
  const usable = filtered.list;
  if (!usable.length) {
    return { ok: false, message: '按你设的标签筛完一个都不剩了 —— 不看的词是不是太宽了？' };
  }
  const topN = filtered.matched > 0 ? Math.min(filtered.matched, 6) : Math.min(usable.length, 6);
  const video = usable[Math.floor(Math.random() * topN)];

  const text = await compose(video, c.name || '主人');
  const res = await bilibili.sendDM(text);
  const entry = {
    at: Date.now(),
    bv: video.bvid,
    title: video.title,
    author: video.author,
    url: video.url,
    text,
    ok: !!res.ok,
    message: res.message || '',
  };
  const next = state();
  next.lastAt = Date.now();
  if (res.ok) next.lastBv = video.bvid;
  next.history = [entry, ...(next.history || [])].slice(0, 50);
  saveState(next);

  if (res.ok) log.info('biliLife: 已私信推荐 ' + video.bvid + ' —— ' + video.title.slice(0, 20));
  else log.warn('biliLife: 私信没发出去 —— ' + res.message);
  return { ok: !!res.ok, message: res.message, video, text };
}

function tick() {
  const c = cfg();
  if (!c.enabled) return;
  run({ manual: false }).catch((err) => log.ex('biliLife: 定时任务出错', err));
}

function start() {
  if (timer) clearInterval(timer);
  timer = setInterval(tick, 60 * 1000);
  if (timer.unref) timer.unref();
  const c = cfg();
  log.info('biliLife: 已启动（' + (c.enabled ? '自动私信开着，节奏跟「主动聊天」共用' : '自动私信关着') + '）');
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
}

function overview() {
  const s = state();
  const c = cfg();
  return {
    enabled: c.enabled,
    everyMinutes: c.everyMinutes,
    preferTags: c.preferTags,
    blockTags: c.blockTags,
    // 节奏来自「通用 → 主动聊天」，让界面能说明清楚
    rhythm: proactive.cfg().mode,
    lastAt: s.lastAt,
    history: (s.history || []).slice(0, 12),
  };
}

module.exports = { start, stop, run, overview, state, candidates };
