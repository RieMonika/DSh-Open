'use strict';
/**
 * QQ 空间说说（不用浏览器、不用扫码）
 *
 * 思路：NapCat 已经把 QQ 登录态握在手里，能直接给出 qzone 的 Cookie 和 csrf token（g_tk），
 * 我们自己带这两样去调空间发说说的接口就行。
 */
const qq = require('./qq');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

async function cookieOf() {
  const r = await qq.call('get_cookies', { domain: 'qzone.qq.com' });
  const s = (r && (r.cookies || r.cookie)) || '';
  if (!s) throw new Error('拿不到 QQ 空间的登录态（NapCat 可能刚启动，等几秒再试）');
  return s;
}

async function tokenOf() {
  const r = await qq.call('get_csrf_token', {});
  const n = Number(r && (r.token || r.bkn || r));
  if (!Number.isFinite(n)) throw new Error('拿不到空间的操作令牌');
  return n;
}

function selfUin() {
  const s = qq.status() || {};
  const id = String(s.selfId || '');
  return id.replace(/\D/g, '');
}

/** 发一条说说。返回 { ok, tid, message } */
async function publish(text) {
  const content = String(text || '').trim();
  if (!content) throw new Error('内容是空的');
  if (content.length > 1000) throw new Error('最多 1000 字');
  const uin = selfUin();
  if (!uin) throw new Error('QQ 还没连上');

  const [cookie, token] = [await cookieOf(), await tokenOf()];
  const base = {
    syn_tweet_verson: '1',
    paramstr: '1',
    who: '1',
    conformat: '1',
    feedversion: '1',
    ver: '1',
    ugc_right: '1',
    to_sign: '0',
    hostuin: uin,
    code_version: '1',
    format: 'json',
    qzreferrer: 'https://user.qzone.qq.com/' + uin,
  };

  const url =
    'https://user.qzone.qq.com/proxy/domain/taotao.qzone.qq.com/cgi-bin/emotion_cgi_publish_v6?g_tk=' + token;

  // 空间的接口在不同版本里认的字段名不一样：先试 content，被「未输入内容」挡回来再试 con
  let lastErr = null;
  for (const field of ['content', 'con']) {
    const body = new URLSearchParams({ ...base, [field]: content }).toString();
    let json = null;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: cookie,
          Referer: 'https://user.qzone.qq.com/' + uin,
          Origin: 'https://user.qzone.qq.com',
          'User-Agent': UA,
        },
        body,
        signal: AbortSignal.timeout(15000),
      });
      json = parseJson(await res.text());
    } catch (e) {
      lastErr = e;
      continue;
    }
    if (!json) {
      lastErr = new Error('空间返回看不懂');
      continue;
    }
    const code = Number(json.code);
    if (code === 0) {
      const tid = (json.data && (json.data.tid || json.data.feedid)) || '';
      return { ok: true, tid: String(tid), message: '发出去了' };
    }
    lastErr = new Error(friendly(code, json.message || json.msg || ('code ' + code)));
  }
  throw lastErr || new Error('空间没发出去');
}

function parseJson(raw) {
  try {
    return JSON.parse(raw);
  } catch (_) {
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]);
    } catch (_e) {
      return null;
    }
  }
}

function friendly(code, msg) {
  const map = {
    '-10000': '空间拒绝了：可能要你手动开通空间或者被限制发布',
    '-3000': '登录态过期了：重新点一次「一键启动」让它重新扫码',
    '-4001': '内容里有敏感词',
  };
  return map[String(code)] || '空间没发出去：' + msg + '（code ' + code + '）';
}

module.exports = { publish, selfUin };
