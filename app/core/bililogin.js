'use strict';

/**
 * B 站扫码登录
 * ------------------------------------------------------------
 * 抄的是 DSH「养鱼」插件的做法（lib/auth.js）：
 *   1) GET https://passport.bilibili.com/x/passport-login/web/qrcode/generate   → {url, qrcode_key}
 *   2) 把 url 画成二维码，让用户用手机 B 站扫
 *   3) GET .../qrcode/poll?qrcode_key=xxx 一直问
 *        code=86101 还没扫 · 86090 扫了没确认 · 86038 过期 · 0 成功
 *   4) 成功时 Cookie 在 Set-Cookie 里，抠出 SESSDATA / bili_jct / DedeUserID / buvid3 存进设置
 *
 * 二维码用本机自带的 qrcode@1.5.4 生成（app\node_modules 里），不联网装包。
 */

const QRCode = require('qrcode');
const settings = require('./settings');
const log = require('./logger');

const PASSPORT = 'https://passport.bilibili.com';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const TTL = 180 * 1000; // 二维码 3 分钟有效

const HEADERS = {
  'user-agent': UA,
  referer: PASSPORT + '/login',
  origin: PASSPORT,
};

let session = null; // { key, url, qr, createdAt, status }

function expired(s) {
  return !s || Date.now() - s.createdAt > TTL;
}

function setCookieMap(res) {
  const map = {};
  let list = [];
  try {
    list = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  } catch (_) {
    list = [];
  }
  if (!list.length) {
    const raw = res.headers.get('set-cookie');
    if (raw) list = raw.split(/,(?=\s*[A-Za-z0-9_]+=)/);
  }
  for (const line of list) {
    const first = String(line).split(';')[0];
    const idx = first.indexOf('=');
    if (idx > 0) map[first.slice(0, idx).trim()] = first.slice(idx + 1).trim();
  }
  return map;
}

async function generate() {
  const res = await fetch(PASSPORT + '/x/passport-login/web/qrcode/generate', { headers: HEADERS });
  const body = await res.json();
  const data = body && body.data;
  if (!data || !data.qrcode_key) {
    throw new Error('B 站没给二维码：' + ((body && body.message) || '未知原因'));
  }
  const qr = await QRCode.toDataURL(data.url, { width: 260, margin: 2, errorCorrectionLevel: 'M' });
  session = { key: data.qrcode_key, url: data.url, qr, createdAt: Date.now(), status: 'waiting' };
  log.info('bili: 二维码已生成，等扫码');
  return { ok: true, qr: session.qr, expiresIn: TTL };
}

async function poll() {
  if (!session) return { ok: false, status: 'idle', message: '还没生成二维码' };
  if (expired(session)) {
    session.status = 'expired';
    return { ok: false, status: 'expired', message: '二维码过期了，点「重新生成」' };
  }

  const url = new URL('/x/passport-login/web/qrcode/poll', PASSPORT);
  url.searchParams.set('qrcode_key', session.key);
  const res = await fetch(url.toString(), { headers: HEADERS });
  const body = await res.json();
  const data = (body && body.data) || {};
  const code = Number(data.code);

  // 0 = 登录成功
  if (code === 0) {
    const cookies = setCookieMap(res);
    const sessdata = cookies.SESSDATA || '';
    const biliJct = cookies.bili_jct || '';
    const uid = cookies.DedeUserID || '';
    const buvid3 = cookies.buvid3 || '';
    if (!sessdata || !biliJct) {
      return { ok: false, status: 'fail', message: '登录成功但没拿到 Cookie，重试一次' };
    }

    // 问一下是谁
    let me = null;
    try {
      const r = await fetch('https://api.bilibili.com/x/web-interface/nav', {
        headers: {
          'user-agent': UA,
          referer: 'https://www.bilibili.com/',
          cookie: `SESSDATA=${sessdata}; bili_jct=${biliJct}; buvid3=${buvid3}`,
        },
      });
      const j = await r.json();
      if (j && j.code === 0 && j.data && j.data.isLogin) me = { uid: String(j.data.mid), name: j.data.uname };
    } catch (_) {
      me = null;
    }

    settings.patch({
      channels: {
        bilibili: {
          sessdata,
          biliJct,
          buvid3,
          // 登录的是「她自己」的小号，不是主人号 —— 主人 UID 要用户自己填
          selfUid: (me && me.uid) || uid || '',
          selfName: (me && me.name) || '',
        },
      },
    });
    session.status = 'done';
    log.info('bili: 扫码登录成功 — ' + ((me && me.name) || uid || '未知账号'));
    return { ok: true, status: 'done', message: '登录成功', account: me || { uid, name: '' } };
  }

  const table = {
    86101: ['waiting', '等扫码'],
    86090: ['scanned', '扫到了，手机上点确认'],
    86038: ['expired', '二维码过期了'],
  };
  const hit = table[code] || ['waiting', data.message || '等扫码'];
  session.status = hit[0];
  return { ok: false, status: hit[0], message: hit[1] };
}

function cancel() {
  session = null;
  return { ok: true };
}

function status() {
  if (!session) return { status: 'idle' };
  return { status: expired(session) ? 'expired' : session.status, hasQr: !!session.qr };
}

module.exports = { generate, poll, cancel, status };
