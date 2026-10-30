'use strict';

/**
 * QQ 通道（OneBot v11）
 * ------------------------------------------------------------
 * 教程里让大家装 NapCat，然后开一个正向 WebSocket（默认 ws://127.0.0.1:3001），
 * 再拿别的东西去连。这里把"别的东西"做进客户端：
 *
 *   NapCat（提供协议） ── ws://127.0.0.1:3001 ──> DSh Open
 *
 * 所以玩家只要：装 NapCat → 登录 QQ → 在 NapCat 里开正向 WS → 回这里点连接。
 * 端口、Token 都在界面上填；连上之后收发消息都走这一个连接。
 */

const settings = require('./settings');
const log = require('./logger');
const db = require('./db');
const inbox = require('./inbox');
const stickers = require('./stickers');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const DEFAULT = {
  autoConnect: false,
  wsUrl: 'ws://127.0.0.1:3001',
  accessToken: '',
  napcatPath: '',
};

let ws = null;
let status = 'idle';
let lastError = '';
let selfId = '';
let selfName = '';
let onlineSince = 0;
let retryTimer = null;
let retryDelay = 3000;
let echoSeq = 1;
const pending = new Map(); // echo -> {resolve, reject, timer}
const listeners = new Set();

function cfg() {
  const c = settings.getIn('channels.qq') || {};
  return {
    autoConnect: !!c.autoConnect,
    wsUrl: String(c.wsUrl || DEFAULT.wsUrl).trim(),
    accessToken: String(c.accessToken || ''),
    napcatPath: String(c.napcatPath || ''),
  };
}

function setStatus(next, error) {
  status = next;
  lastError = error || '';
  if (next === 'online') onlineSince = Date.now();
  emit();
}

function emit(payload) {
  const snapshot = api.status();
  for (const fn of listeners) {
    try {
      const out = fn(payload ? { ...payload, status: snapshot } : { status: snapshot });
      // 监听器可能是 async：别让它的 rejection 变成未捕获异常
      if (out && typeof out.catch === 'function') out.catch(() => {});
    } catch (_) {
      /* 单个监听器出错不影响别人 */
    }
  }
}

function onEvent(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function saveConversation(channel, account, info) {
  try {
    db.run(
      'INSERT OR REPLACE INTO conversations (id, channel, account, title, kind, avatar, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      String(info.conversationId),
      'qq',
      account,
      String(info.title || info.conversationId),
      info.kind || 'friend',
      String(info.avatar || ''),
      Date.now(),
    );
  } catch (err) {
    log.ex('qq: 存会话失败', err);
  }
}

function saveMessage(event) {
  try {
    const isGroup = event.message_type === 'group';
    const sender = event.sender || {};
    const convId = isGroup ? 'group:' + event.group_id : 'user:' + event.user_id;
    const segs = Array.isArray(event.message) ? event.message : [];
    const textSeg = segs.filter((s) => s && s.type === 'text').map((s) => (s.data && s.data.text) || '').join('').trim();
    const preview =
      textSeg ||
      (segs.some((s) => s && s.type === 'image') ? '[图片]' : '') ||
      (segs.some((s) => s && (s.type === 'mface' || s.type === 'face')) ? '[表情]' : '');
    saveConversation('qq', selfId, {
      conversationId: convId,
      title: isGroup ? event.group_name || convId : sender.card || sender.nickname || String(event.user_id),
      kind: isGroup ? 'group' : 'friend',
      avatar: '',
    });
    db.run(
      'INSERT INTO messages (channel, account, conversation_id, sender_id, sender_name, content, raw, role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      'qq',
      selfId,
      convId,
      String(event.user_id || ''),
      String(sender.card || sender.nickname || event.user_id || ''),
      String(event.raw_message || '').trim() || preview,
      JSON.stringify(event).slice(0, 20000),
      'user',
      Number(event.time || Math.floor(Date.now() / 1000)) * 1000,
    );
  } catch (err) {
    log.ex('qq: 存消息失败', err);
  }
}

function handlePacket(packet) {
  if (!packet || typeof packet !== 'object') return;

  // 动作的回执
  if (packet.echo && pending.has(packet.echo)) {
    const job = pending.get(packet.echo);
    pending.delete(packet.echo);
    clearTimeout(job.timer);
    if (packet.status === 'ok' || packet.retcode === 0) job.resolve(packet.data);
    else job.reject(new Error(packet.wording || packet.message || '调用失败'));
    return;
  }

  if (packet.post_type === 'meta_event') {
    if (packet.meta_event_type === 'lifecycle' && packet.sub_type === 'enable') {
      log.info('qq: 连接就绪');
    }
    return;
  }

  if (packet.post_type === 'message') {
    saveMessage(packet);
    // 图片链接里的 rkey 会过期，收到就下载；管理员发来的表情顺手收进表情包库
    inbox.prefetch(packet).then((files) => {
      try {
        if (!files || !files.length) return;
        if (!settings.getIn('stickers.saveFromOwner')) return;
        const owner = String(settings.getIn('channels.qq.ownerQq') || '');
        if (!owner || String(packet.user_id) !== owner) return;
        for (const file of files) {
          try {
            stickers.importFile(file);
          } catch (err) {
            log.warn('stickers: 自动收图失败 ' + (err && err.message));
          }
        }
      } catch (_) {
        /* 收图失败不影响消息 */
      }
    });
    emit({ event: 'message', message: packet });
    return;
  }

  if (packet.post_type === 'notice') {
    emit({ event: 'notice', notice: packet });
  }
}

function connect() {
  const c = cfg();
  if (ws) return api.status();
  if (typeof WebSocket !== 'function') {
    setStatus('error', '这个运行时不支持 WebSocket，连不了');
    return api.status();
  }
  if (!c.wsUrl) {
    setStatus('error', '还没填 WebSocket 地址');
    return api.status();
  }

  setStatus('connecting');
  // Node 自带的 WebSocket 不吃 headers 参数，Token 走 OneBot 的 access_token 查询参数
  const url = c.accessToken
    ? c.wsUrl + (c.wsUrl.includes('?') ? '&' : '?') + 'access_token=' + encodeURIComponent(c.accessToken)
    : c.wsUrl;
  let socket;
  try {
    socket = new WebSocket(url);
  } catch (err) {
    setStatus('error', String((err && err.message) || err));
    return api.status();
  }
  ws = socket;

  socket.addEventListener('open', () => {
    log.info('qq: 已连上 ' + c.wsUrl);
    retryDelay = 3000;
    setStatus('online');
    api.call('get_login_info')
      .then((info) => {
        if (info) {
          selfId = String(info.user_id || '');
          selfName = String(info.nickname || '');
          emit();
        }
      })
      .catch(() => {});
  });

  socket.addEventListener('message', (event) => {
    try {
      handlePacket(JSON.parse(typeof event.data === 'string' ? event.data : String(event.data)));
    } catch (err) {
      log.warn('qq: 收到看不懂的数据 —', err && err.message);
    }
  });

  socket.addEventListener('close', () => {
    ws = null;
    if (status !== 'idle') {
      setStatus('offline', lastError || '连接断开了');
      if (cfg().autoConnect) scheduleRetry();
    }
  });

  socket.addEventListener('error', (event) => {
    const msg = (event && event.message) || '连接失败';
    log.warn('qq: websocket 错误 —', msg);
    setStatus('error', msg);
  });

  return api.status();
}

function scheduleRetry() {
  if (retryTimer) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    if (cfg().autoConnect && !ws) {
      retryDelay = Math.min(retryDelay * 1.5, 30000);
      connect();
    }
  }, retryDelay);
  if (retryTimer.unref) retryTimer.unref();
}

function disconnect() {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  setStatus('idle');
  if (ws) {
    const socket = ws;
    ws = null;
    try {
      socket.close();
    } catch (_) {
      /* ignore */
    }
  }
  return api.status();
}

/** 把 CQ 码字符串转成 OneBot 数组消息（NapCat 配的是 messagePostFormat: 'array'，纯字符串里的 [CQ:image] 不会被解析） */
function toMessage(text) {
  const s = String(text || '');
  const segs = [];
  const re = /\[CQ:([a-zA-Z_]+)((?:,[^\]]*)?)\]/g;
  let last = 0;
  let m;
  const unescape = (v) =>
    String(v)
      .replace(/&#44;/g, ',')
      .replace(/&#91;/g, '[')
      .replace(/&#93;/g, ']')
      .replace(/&amp;/g, '&');
  while ((m = re.exec(s))) {
    if (m.index > last) {
      const t = s.slice(last, m.index).replace(/^\n+|\n+$/g, '');
      if (t) segs.push({ type: 'text', data: { text: t } });
    }
    const data = {};
    for (const kv of String(m[2] || '').split(/,(?=[a-zA-Z_]+=)/)) {
      const i = kv.indexOf('=');
      if (i > 0) data[kv.slice(0, i)] = unescape(kv.slice(i + 1));
    }
    segs.push({ type: m[1], data });
    last = re.lastIndex;
  }
  if (last < s.length) {
    const t = s.slice(last).replace(/^\n+|\n+$/g, '');
    if (t) segs.push({ type: 'text', data: { text: t } });
  }
  if (!segs.length) return [{ type: 'text', data: { text: s } }];
  return segs;
}

/** 调 OneBot 动作，返回 Promise */
function call(action, params) {
  return new Promise((resolve, reject) => {
    if (!ws || ws.readyState !== 1) {
      reject(new Error('QQ 还没连上'));
      return;
    }
    const echo = 'e' + echoSeq++;
    const timer = setTimeout(() => {
      pending.delete(echo);
      reject(new Error('等回执超时（' + action + '）'));
    }, 15000);
    if (timer.unref) timer.unref();
    pending.set(echo, { resolve, reject, timer });
    try {
      ws.send(JSON.stringify({ action, params: params || {}, echo }));
    } catch (err) {
      pending.delete(echo);
      clearTimeout(timer);
      reject(err);
    }
  });
}

const api = {
  status() {
    const c = cfg();
    return {
      status,
      // 顺手给个布尔值：调用方容易写成 status().online，别让它们踩空
      online: status === 'online',
      error: lastError,
      selfId,
      selfName,
      onlineSince,
      wsUrl: c.wsUrl,
      autoConnect: c.autoConnect,
      hasToken: !!c.accessToken,
      napcatPath: c.napcatPath,
      ownerQq: String(settings.getIn('channels.qq.ownerQq') || ''),
    };
  },

  config() {
    const c = cfg();
    return {
      autoConnect: c.autoConnect,
      wsUrl: c.wsUrl,
      hasToken: !!c.accessToken,
      tokenMasked: c.accessToken ? '••••' + c.accessToken.slice(-4) : '',
      napcatPath: c.napcatPath,
      ownerQq: String(settings.getIn('channels.qq.ownerQq') || ''),
    };
  },

  saveConfig(patch) {
    const cur = settings.getIn('channels.qq') || {};
    const next = { ...DEFAULT, ...cur };
    const p = patch || {};
    if ('autoConnect' in p) next.autoConnect = !!p.autoConnect;
    if ('wsUrl' in p) next.wsUrl = String(p.wsUrl || '').trim();
    if ('napcatPath' in p) next.napcatPath = String(p.napcatPath || '').trim();
    if ('accessToken' in p && p.accessToken !== '') next.accessToken = String(p.accessToken);
    if ('ownerQq' in p) next.ownerQq = String(p.ownerQq || '').replace(/\D/g, '');
    settings.patch({ channels: { qq: next } });
    return api.status();
  },

  connect,
  disconnect,
  call,

  async sendPrivate(userId, text) {
    return call('send_private_msg', { user_id: Number(userId), message: toMessage(text) });
  },

  async sendGroup(groupId, text) {
    return call('send_group_msg', { group_id: Number(groupId), message: toMessage(text) });
  },

  /** 发一条语音（file 支持 base64:// 或 file:/// 绝对路径） */
  async sendPrivateVoice(userId, file) {
    return call('send_private_msg', {
      user_id: Number(userId),
      message: [{ type: 'record', data: { file: String(file || '') } }],
    });
  },

  async sendGroupVoice(groupId, file) {
    return call('send_group_msg', {
      group_id: Number(groupId),
      message: [{ type: 'record', data: { file: String(file || '') } }],
    });
  },

  async friends() {
    const list = await call('get_friend_list');
    return (list || []).map((f) => ({ userId: f.user_id, name: f.remark || f.nickname }));
  },

  async groups() {
    const list = await call('get_group_list');
    return (list || []).map((g) => ({ groupId: g.group_id, name: g.group_name }));
  },

  onEvent,

  /** 从客户端里把 NapCat 拉起来（不弹黑窗口，直接后台起） */
  launchNapCat() {
    const c = cfg();
    if (!c.napcatPath) throw new Error('先填 NapCat 的启动程序路径');
    if (!fs.existsSync(c.napcatPath)) throw new Error('找不到文件：' + c.napcatPath);
    const child = spawn('"' + c.napcatPath + '"', [], {
      cwd: path.dirname(c.napcatPath),
      detached: true,
      stdio: 'ignore',
      shell: true,
    });
    child.unref();
    log.info('qq: 已尝试启动 NapCat ->', c.napcatPath);
    return { ok: true, path: c.napcatPath };
  },
};

module.exports = api;
