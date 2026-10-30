'use strict';

/**
 * B 站接入
 * ------------------------------------------------------------
 * 两件事：
 *   1) 读 —— 热门视频、指定 UP 的投稿（不需要登录）
 *   2) 发私信 —— 需要登录态（SESSDATA + bili_jct）
 *
 * 私信这块照着 DSH 的「养鱼」插件的做法搬过来的，
 * 它踩过的坑我原样保留：
 *   · 必须双方互关（relation.attribute === 6），否则 B 站直接拒
 *   · 不能给自己发（登录号 == 主人号 时直接报错，说清楚怎么办）
 *   · dev_id 必须固定：每条都随机会被风控当成"同一个人在到处切设备"
 *   · 正文 ≤ 300 字，超了就是刷屏
 *   · 一天只锁定一个收信人（条数不限），防止变成群发工具
 *
 * 接口：POST https://api.vc.bilibili.com/web_im/v1/web_im/send_msg
 *   form: msg[sender_uid] msg[receiver_id] msg[receiver_type]=1
 *         msg[msg_type]=1 msg[msg_status]=0 msg[timestamp]
 *         msg[dev_id] msg[content]={"content":"…"} csrf=<bili_jct>
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const settings = require('./settings');
const log = require('./logger');
const P = require('./paths');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36';
const BASE_HEADERS = {
  'User-Agent': UA,
  Referer: 'https://www.bilibili.com/',
  Accept: 'application/json, text/plain, */*',
};

const DEFAULTS = {
  uid: '', // 主人（你）的 B 站 mid：只对她发
  name: '',
  sessdata: '',
  biliJct: '',
  buvid3: '',
  autoDaily: false,
  everyMinutes: 240,
  shareWithVideo: true,
};

const DM_FILE = path.join(P.data, 'bilibili-dm.json');
const DEV_FILE = path.join(P.data, 'bilibili-dev-id');

const MAX_LEN = 300;

const today = () => new Date().toLocaleDateString('sv-SE');

// ---------------------------------------------------------------- 配置

function cfg() {
  const b = settings.getIn('channels.bilibili') || {};
  const raw = String(b.cookie || '');
  const parsed = parseCookie(raw);
  return {
    // 主人（收信的人）
    ownerUid: String(b.ownerUid || b.uid || '').trim(),
    ownerName: String(b.ownerName || b.name || '').trim(),
    // 她自己（登录的小号）
    selfUid: String(b.selfUid || '').trim(),
    selfName: String(b.selfName || '').trim(),
    uid: String(b.ownerUid || b.uid || '').trim(),
    name: String(b.ownerName || b.name || '').trim(),
    sessdata: String(b.sessdata || parsed.sessdata || '').trim(),
    biliJct: String(b.biliJct || parsed.bili_jct || '').trim(),
    buvid3: String(b.buvid3 || parsed.buvid3 || '').trim(),
    autoDaily: !!b.autoDaily,
    everyMinutes: Math.max(30, Math.min(1440, Number(b.everyMinutes) || 240)),
    shareWithVideo: b.shareWithVideo !== false,
    preferTags: tagList(b.preferTags),
    blockTags: tagList(b.blockTags),
  };
}

/** 标签列表：数组或「逗号/顿号/空格」分隔的字符串都收，去重、最多 30 个 */
function tagList(v) {
  const arr = Array.isArray(v) ? v : String(v == null ? '' : v).split(/[,，、\s]+/);
  const out = [];
  for (const item of arr) {
    const t = String(item || '').trim();
    if (!t || out.includes(t)) continue;
    out.push(t);
    if (out.length >= 30) break;
  }
  return out;
}

function saveConfig(patch) {
  const cur = { ...DEFAULTS, ...(settings.getIn('channels.bilibili') || {}) };
  const p = patch || {};
  if ('uid' in p) cur.uid = String(p.uid || '').trim();
  if ('ownerUid' in p) { cur.ownerUid = String(p.ownerUid || '').trim(); cur.uid = cur.ownerUid; }
  if ('name' in p) cur.name = String(p.name || '').trim();
  if ('ownerName' in p) { cur.ownerName = String(p.ownerName || '').trim(); cur.name = cur.ownerName; }
  if ('cookie' in p) {
    const parsed = parseCookie(String(p.cookie || ''));
    cur.sessdata = parsed.sessdata;
    cur.biliJct = parsed.bili_jct;
    cur.buvid3 = parsed.buvid3;
    cur.cookie = '';
  }
  if ('sessdata' in p) cur.sessdata = String(p.sessdata || '').trim();
  if ('biliJct' in p) cur.biliJct = String(p.biliJct || '').trim();
  if ('buvid3' in p) cur.buvid3 = String(p.buvid3 || '').trim();
  if ('autoDaily' in p) cur.autoDaily = !!p.autoDaily;
  if ('everyMinutes' in p) cur.everyMinutes = Math.max(30, Math.min(1440, Number(p.everyMinutes) || 240));
  if ('shareWithVideo' in p) cur.shareWithVideo = !!p.shareWithVideo;
  if ('preferTags' in p) cur.preferTags = tagList(p.preferTags);
  if ('blockTags' in p) cur.blockTags = tagList(p.blockTags);
  settings.patch({ channels: { bilibili: cur } });
  return status();
}

/** 从浏览器里整段复制过来的 Cookie 字符串里挑出要的三个 */
function parseCookie(text) {
  const out = { sessdata: '', bili_jct: '', buvid3: '' };
  String(text || '')
    .split(/;\s*/)
    .forEach((pair) => {
      const i = pair.indexOf('=');
      if (i <= 0) return;
      const k = pair.slice(0, i).trim();
      const v = pair.slice(i + 1).trim();
      if (k === 'SESSDATA') out.sessdata = v;
      else if (k === 'bili_jct') out.bili_jct = v;
      else if (k === 'buvid3') out.buvid3 = v;
    });
  return out;
}

function cookieHeader() {
  const c = cfg();
  const parts = [];
  if (c.sessdata) parts.push('SESSDATA=' + c.sessdata);
  if (c.biliJct) parts.push('bili_jct=' + c.biliJct);
  if (c.buvid3) parts.push('buvid3=' + c.buvid3);
  return parts.join('; ');
}

// ---------------------------------------------------------------- 小工具

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_) {
    return fallback;
  }
}

function writeJson(file, obj) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(obj, null, 2), 'utf8');
  } catch (err) {
    log.ex('bilibili: 写文件失败 ' + file, err);
  }
}

/** 固定的设备号：只生成一次，之后永远复用 */
function deviceId() {
  try {
    const v = fs.readFileSync(DEV_FILE, 'utf8').trim();
    if (/^WEB-[0-9A-F-]{20,}$/i.test(v)) return v;
  } catch (_) {
    /* 下面重建 */
  }
  const v = 'WEB-' + crypto.randomUUID().toUpperCase();
  try {
    fs.mkdirSync(path.dirname(DEV_FILE), { recursive: true });
    fs.writeFileSync(DEV_FILE, v + '\n', 'utf8');
  } catch (err) {
    log.ex('bilibili: 保存设备号失败', err);
  }
  return v;
}

function explainCode(code) {
  const map = {
    0: '成功',
    '-101': '账号未登录（Cookie 过期了，重新粘贴一次）',
    '-111': 'CSRF 校验失败（bili_jct 不对或已过期，SESSDATA 和 bili_jct 要一起重新粘）',
    '-412': '请求被风控拦了（太频繁，隔一会儿再试）',
    '-400': '请求参数不对',
    '-403': '没有权限（对方设置了不接受私信）',
    '-500': 'B 站服务器出错了',
    '-509': '请求太频繁，被限流了',
  };
  const k = String(code);
  return map[k] || 'B 站返回 ' + k;
}

async function getJson(url, withCookie) {
  const headers = { ...BASE_HEADERS };
  const cookie = withCookie === false ? '' : cookieHeader();
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

/**
 * 带登录态发一个 POST（表单）。B 站的写操作都要 csrf=bili_jct。
 * 返回 { ok, code, message, data }
 */
async function postForm(url, form) {
  const c = cfg();
  if (!c.sessdata || !c.biliJct) return { ok: false, code: -101, message: '还没登录：先在「通道」里扫码或粘 Cookie' };
  const body = new URLSearchParams();
  Object.keys(form || {}).forEach((k) => body.append(k, String(form[k])));
  if (!body.has('csrf')) body.append('csrf', c.biliJct);
  const headers = {
    ...BASE_HEADERS,
    'Content-Type': 'application/x-www-form-urlencoded',
    Origin: 'https://www.bilibili.com',
    Cookie: cookieHeader(),
  };
  let j = {};
  try {
    const res = await fetch(url, { method: 'POST', headers, body: body.toString(), signal: AbortSignal.timeout(15000) });
    j = await res.json();
  } catch (err) {
    return { ok: false, code: -1, message: '请求失败：' + String((err && err.message) || err) };
  }
  if (j.code === 0) return { ok: true, code: 0, message: '成功', data: j.data || null };
  return { ok: false, code: j.code, message: explainCode(j.code) + (j.message ? '（' + j.message + '）' : ''), data: j.data || null };
}

/** 给插件用的窄接口：只放行 B 站域名 */
async function apiGet(url) {
  if (!/^https:\/\/[a-z.]*bilibili\.com\//i.test(url)) throw new Error('只允许请求 bilibili.com');
  return getJson(url);
}

async function apiPost(url, form) {
  if (!/^https:\/\/[a-z.]*bilibili\.com\//i.test(url)) throw new Error('只允许请求 bilibili.com');
  return postForm(url, form);
}

// ---------------------------------------------------------------- 账号

/** 当前登录的是谁（顺便验证 Cookie 还有效） */
async function me() {
  const j = await getJson('https://api.bilibili.com/x/web-interface/nav');
  const d = (j && j.data) || {};
  if (j.code !== 0 || !d.isLogin) {
    return { ok: false, code: j.code, message: d.isLogin === false ? 'Cookie 已失效，请重新粘贴' : explainCode(j.code) };
  }
  return {
    ok: true,
    mid: String(d.mid || ''),
    uname: String(d.uname || ''),
    avatar: String(d.face || ''),
    level: d.level_info ? d.level_info.current_level : 0,
  };
}

/** 她对主人是什么关系：attribute 6 = 互相关注 */
async function relation(toMid) {
  const target = String(toMid || cfg().uid || '').trim();
  if (!target) return { ok: false, error: '还没填你的 UID' };
  const j = await getJson('https://api.bilibili.com/x/relation?fid=' + encodeURIComponent(target));
  if (j.code !== 0) return { ok: false, error: explainCode(j.code) };
  const attribute = Number((j.data && j.data.attribute) || 0);
  const beAttribute =
    j.data && j.data.be_relation && j.data.be_relation.attribute != null
      ? Number(j.data.be_relation.attribute)
      : null;
  return { ok: true, attribute, beAttribute, mutual: attribute === 6 };
}

function quota() {
  const q = readJson(DM_FILE, { date: '', count: 0, mid: '', recent: [] });
  const isToday = q.date === today();
  return {
    date: q.date,
    count: isToday ? Number(q.count) || 0 : 0,
    lockedMid: isToday ? String(q.mid || '') : '',
    recent: Array.isArray(q.recent) ? q.recent.slice(0, 20) : [],
  };
}

function remember(entry) {
  const q = readJson(DM_FILE, {});
  const isToday = q.date === today();
  const next = {
    date: today(),
    count: (isToday ? Number(q.count) || 0 : 0) + (entry.ok ? 1 : 0),
    mid: entry.ok ? String(entry.to || '') : isToday ? String(q.mid || '') : '',
    recent: [{ at: Date.now(), ...entry }, ...(Array.isArray(q.recent) ? q.recent : [])].slice(0, 30),
  };
  writeJson(DM_FILE, next);
}

// ---------------------------------------------------------------- 私信

/**
 * 发一条私信。
 * 返回 { ok, code, message, http } —— 失败时 message 是人话。
 */
async function sendDM(text, opts) {
  const c = cfg();
  const body0 = String(text || '').trim();
  if (!body0) return { ok: false, message: '内容不能是空的' };
  if (body0.length > MAX_LEN) return { ok: false, message: `太长了（${body0.length} 字 > ${MAX_LEN}），私信不是刷屏工具` };
  if (!c.sessdata || !c.biliJct) {
    return { ok: false, message: '还没登录：把浏览器里的 SESSDATA 和 bili_jct 两个都粘进来' };
  }
  const to = String((opts && opts.to) || c.uid || '').trim();
  if (!to) return { ok: false, message: '还没填你的 UID —— 私信只发给你，没填就不发' };

  const meInfo = await me();
  if (!meInfo.ok) return { ok: false, message: meInfo.message };
  if (meInfo.mid === to) {
    return {
      ok: false,
      message: '不能给自己发私信：现在登录的就是你这个号。私信要两个号 —— 小号登录，主人号接。',
    };
  }

  const q = quota();
  // ① 一天只锁定一个收信人（条数不限）
  if (q.lockedMid && q.lockedMid !== to) {
    return { ok: false, message: `今天已经锁定发给 mid ${q.lockedMid} 了，一天只能锁一个收信人` };
  }

  const rel = await relation(to);
  if (!rel.ok) return { ok: false, message: rel.error || '查不到互关状态' };
  if (!rel.mutual) {
    return {
      ok: false,
      message:
        '还没互关（B 站要求双方互相关注才能发私信）。去 https://space.bilibili.com/' +
        encodeURIComponent(meInfo.mid) +
        ' 关注她，再让她关注你。',
    };
  }

  const form = new URLSearchParams();
  form.set('msg[sender_uid]', meInfo.mid);
  form.set('msg[receiver_id]', to);
  form.set('msg[receiver_type]', '1');
  form.set('msg[msg_type]', '1');
  form.set('msg[msg_status]', '0');
  form.set('msg[timestamp]', String(Math.floor(Date.now() / 1000)));
  form.set('msg[dev_id]', deviceId());
  form.set('msg[content]', JSON.stringify({ content: body0 }));
  form.set('csrf', c.biliJct);

  let res;
  let j = {};
  try {
    res = await fetch('https://api.vc.bilibili.com/web_im/v1/web_im/send_msg', {
      method: 'POST',
      headers: {
        ...BASE_HEADERS,
        Cookie: cookieHeader(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
      signal: AbortSignal.timeout(30000),
    });
    j = await res.json().catch(() => ({}));
  } catch (err) {
    const msg = '发不出去：' + (err && err.message ? err.message : err);
    remember({ ok: false, to, text: body0.slice(0, 80), message: msg });
    return { ok: false, message: msg };
  }

  const ok = j.code === 0;
  const message = ok ? '已送达' : explainCode(j.code) + (j.message ? '（B 站原文：' + j.message + '）' : '');
  remember({ ok, to, text: body0.slice(0, 120), message, from: meInfo.uname });
  if (!ok) log.warn('bilibili: 私信失败 code=' + j.code + ' ' + message);
  return { ok, code: j.code, message, http: res ? res.status : 0, to, from: meInfo.uname };
}

// ---------------------------------------------------------------- 读

function toVideo(v) {
  const bvid = v.bvid || '';
  return {
    bvid,
    title: String(v.title || '').trim(),
    author: String(v.owner ? v.owner.name : v.author || '').trim(),
    play: v.stat ? v.stat.view : v.play || 0,
    cover: String(v.pic || '').replace(/^\/\//, 'https://'),
    url: bvid ? 'https://www.bilibili.com/video/' + bvid : '',
    pubdate: v.pubdate || 0,
    tname: String(v.tname || '').trim(),
    desc: String(v.desc || '').trim().slice(0, 200),
  };
}

/** 视频身上能用来对标签的文字（标题 + 分区 + 简介 + 作者） */
function haystack(v) {
  return [v.title, v.tname, v.desc, v.author].filter(Boolean).join(' ').toLowerCase();
}

// ------------------------------------------------ 搜索（wbi 签名）

const MIXIN_TAB = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38,
  41, 13, 37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36,
  20, 34, 44, 52,
];

let wbiCache = { key: '', at: 0 };

/** 拿 wbi 的 mixinKey（nav 接口里的 img_key/sub_key 拼起来重排） */
async function wbiKey() {
  if (wbiCache.key && Date.now() - wbiCache.at < 3600 * 1000) return wbiCache.key;
  const j = await getJson('https://api.bilibili.com/x/web-interface/nav');
  const d = (j && j.data && j.data.wbi_img) || {};
  const base = (u) => String(u || '').split('/').pop().split('.')[0];
  const img = base(d.img_url);
  const sub = base(d.sub_url);
  if (!img || !sub) return '';
  const orig = img + sub;
  const key = MIXIN_TAB.map((i) => orig[i] || '').join('').slice(0, 32);
  wbiCache = { key, at: Date.now() };
  return key;
}

/** 给带 wbi 的接口签名 */
async function signedUrl(baseUrl, params) {
  const key = await wbiKey();
  const all = { ...params, wts: Math.floor(Date.now() / 1000) };
  const query = Object.keys(all)
    .sort()
    .map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(String(all[k]).replace(/[!'()*]/g, '')))
    .join('&');
  if (!key) return baseUrl + '?' + query;
  const w = crypto.createHash('md5').update(query + key).digest('hex');
  return baseUrl + '?' + query + '&w_rid=' + w;
}

/** 按关键词搜视频（要签名；搜不到就返回空数组，不炸） */
async function searchVideos(keyword, limit) {
  const kw = String(keyword || '').trim();
  if (!kw) return [];
  const n = Math.max(1, Math.min(20, Number(limit) || 8));
  const url = await signedUrl('https://api.bilibili.com/x/web-interface/wbi/search/type', {
    search_type: 'video',
    keyword: kw,
    page: 1,
    page_size: n,
    order: 'pubdate',
  });
  const j = await getJson(url);
  const list = (j && j.data && j.data.result) || [];
  return list
    .map((v) =>
      toVideo({
        bvid: v.bvid,
        title: String(v.title || '').replace(/<[^>]+>/g, ''),
        owner: { name: v.author },
        stat: { view: v.play },
        pic: v.pic,
        pubdate: v.pubdate,
        tname: v.typename,
        desc: v.description,
      }),
    )
    .filter((v) => v.bvid);
}

/**
 * 按偏好挑视频：不看的词直接剔除；想看的词命中就优先（一个都不命中就退回全部，不至于挑不出东西）。
 * 返回 { list, matched }
 */
function filterVideos(videos, opts) {
  const o = opts || {};
  const block = (o.blockTags || []).map((t) => String(t).toLowerCase());
  const prefer = (o.preferTags || []).map((t) => String(t).toLowerCase());
  const kept = [];
  for (const v of videos || []) {
    const h = haystack(v);
    if (block.length && block.some((t) => h.includes(t))) continue;
    kept.push({ v, score: prefer.filter((t) => h.includes(t)).length });
  }
  if (!prefer.length) return { list: kept.map((x) => x.v), matched: 0 };
  const hit = kept.filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
  if (hit.length) return { list: hit.map((x) => x.v), matched: hit.length };
  return { list: kept.map((x) => x.v), matched: 0 };
}

async function popular(limit) {
  const n = Math.max(1, Math.min(30, Number(limit) || 10));
  const data = await getJson('https://api.bilibili.com/x/web-interface/popular?ps=' + n + '&pn=1', false);
  const list = (data.data && data.data.list) || [];
  return list.map(toVideo).filter((v) => v.bvid);
}

async function uploaderVideos(mid, limit) {
  const n = Math.max(1, Math.min(30, Number(limit) || 10));
  const url =
    'https://api.bilibili.com/x/space/arc/search?mid=' +
    encodeURIComponent(mid) +
    '&ps=' +
    n +
    '&pn=1&order=pubdate';
  const data = await getJson(url, false);
  const list = (data.data && data.data.list && data.data.list.vlist) || [];
  return list.map(toVideo).filter((v) => v.bvid);
}

function formatRecommend(videos, who) {
  const list = (videos || []).slice(0, 3);
  if (!list.length) return '';
  const head = who ? who + '，今天刷到几个，感觉你会想看：' : '今天刷到几个，感觉你会想看：';
  const body = list.map((v, i) => i + 1 + '. ' + v.title + '（' + v.author + '）\n' + v.url).join('\n');
  return head + '\n' + body;
}

// ---------------------------------------------------------------- 状态

function status() {
  const c = cfg();
  return {
    // 主人（你）
    uid: c.ownerUid,
    name: c.ownerName,
    ownerUid: c.ownerUid,
    ownerName: c.ownerName,
    // 她自己（登录的小号）
    selfUid: c.selfUid,
    selfName: c.selfName,
    configured: !!c.ownerUid,
    hasCookie: !!(c.sessdata && c.biliJct),
    autoDaily: c.autoDaily,
    everyMinutes: c.everyMinutes,
    shareWithVideo: c.shareWithVideo,
    canRead: true,
    canSendDM: !!(c.sessdata && c.biliJct && c.uid),
    dmNote: c.sessdata && c.biliJct ? '登录了就能发（前提是互关）' : '要先登录：粘贴 SESSDATA + bili_jct',
    quota: quota(),
  };
}

/** 一次性把「能不能发」全部体检一遍，给界面用 */
async function check() {
  const c = cfg();
  const out = { logged: false, me: null, owner: c.uid, mutual: false, error: '', canSend: false };
  if (!c.sessdata || !c.biliJct) {
    out.error = '还没登录（缺 SESSDATA / bili_jct）';
    return out;
  }
  const meInfo = await me();
  if (!meInfo.ok) {
    out.error = meInfo.message;
    return out;
  }
  out.logged = true;
  out.me = { mid: meInfo.mid, uname: meInfo.uname, avatar: meInfo.avatar, level: meInfo.level };
  out.self = { uid: String(meInfo.mid || ''), name: String(meInfo.uname || '') };
  // 记住「她自己是哪个号」，界面上和主人分开显示
  try {
    settings.patch({
      channels: {
        bilibili: { selfUid: String(meInfo.mid || ''), selfName: String(meInfo.uname || '') },
      },
    });
  } catch (_) {
    /* 记不住也不影响体检 */
  }
  if (!c.uid) {
    out.error = '还没填你的 UID';
    return out;
  }
  if (meInfo.mid === c.uid) {
    out.error = '登录的就是主人号本身 —— 私信要两个号（小号登录，主人号收）';
    return out;
  }
  const rel = await relation(c.uid);
  if (!rel.ok) {
    out.error = rel.error;
    return out;
  }
  out.mutual = rel.mutual;
  out.canSend = rel.mutual;
  if (!rel.mutual) out.error = '没互关，B 站不让发私信';
  return out;
}

module.exports = {
  apiGet,
  apiPost,
  postForm,
  cfg,
  saveConfig,
  status,
  check,
  me,
  relation,
  quota,
  sendDM,
  popular,
  searchVideos,
  uploaderVideos,
  formatRecommend,
  filterVideos,
  toVideo,
  parseCookie,
  MAX_LEN,
};
