'use strict';

/**
 * 收件箱
 * ------------------------------------------------------------
 * 数据在 conversations / messages 两张表里，这里只负责"读出来、写进去"，
 * 不做任何平台相关的事（平台相关都在 qq.js）。
 */

const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const db = require('./db');
const paths = require('./paths');

/** QQ 发来的图片/表情包单独落在缓存里：CDN 链接会过期，缓存下来才留得住 */
const MEDIA_DIR = path.join(paths.cache, 'qqmedia');

function convIdOf(event) {
  if (!event) return '';
  return event.message_type === 'group' ? 'group:' + event.group_id : 'user:' + event.user_id;
}

/** 从消息的原始事件里挑出图片/表情片段 */
function mediaOf(raw) {
  try {
    const ev = JSON.parse(raw || '{}');
    const segs = Array.isArray(ev.message) ? ev.message : [];
    const out = [];
    for (const seg of segs) {
      if (!seg || (seg.type !== 'image' && seg.type !== 'mface')) continue;
      const d = seg.data || {};
      out.push({
        kind: seg.type === 'mface' ? 'sticker' : 'image',
        url: String(d.url || d.file_url || ''),
        file: String(d.file || ''),
        summary: String(d.summary || ''),
      });
    }
    return out;
  } catch (_) {
    return [];
  }
}

/** 文字里去掉 [CQ:image,...] 这类占位符，真正看图在气泡里显示 */
function stripMediaCodes(text) {
  return String(text || '')
    .replace(/\[CQ:(?:image|mface)[^\]]*\]/g, '')
    .trim();
}

const downloading = new Map();

/** QQ 的图片链接经常没有后缀，下载下来按文件头认一下真身（动图是 GIF、APNG 是 PNG） */
function sniffExt(buf) {
  if (!buf || buf.length < 12) return '';
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return '.gif'; // GIF8
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return '.png';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return '.jpg';
  if (buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return '.webp';
  if (buf[0] === 0x42 && buf[1] === 0x4d) return '.bmp';
  return '';
}

/** 缓存里已有的文件也认一下头，别把以前存坏的文件端出来 */
function isImageFile(file) {
  try {
    const fd = fs.openSync(file, 'r');
    const head = Buffer.alloc(16);
    const n = fs.readSync(fd, head, 0, 16, 0);
    fs.closeSync(fd);
    return n >= 12 && !!sniffExt(head.subarray(0, n));
  } catch (_) {
    return false;
  }
}

async function cacheMedia(item) {
  const remote = item.url;
  // 自己发出去的表情包：本地就有文件，直接用
  if (item.file) {
    try {
      if (fs.existsSync(item.file)) return item.file;
    } catch (_) {
      /* 不是本地路径就往下走 */
    }
  }
  if (!/^https?:\/\//i.test(remote)) return '';
  let ext = (remote.match(/\.(png|jpe?g|gif|webp|bmp)(?:\?|$)/i) || [])[1] || '';
  ext = ext ? '.' + ext.toLowerCase().replace('jpeg', 'jpg') : item.kind === 'sticker' ? '.gif' : '.jpg';
  const key = crypto.createHash('sha1').update(remote).digest('hex');
  // 之前存过的话，后缀可能是任意一种（按内容嗅探过），挨个看一眼
  for (const guess of [ext, '.gif', '.png', '.jpg', '.webp']) {
    const hit = path.join(MEDIA_DIR, key + guess);
    try {
      if (fs.existsSync(hit) && isImageFile(hit)) return hit;
    } catch (_) {
      /* 继续找 */
    }
  }
  if (downloading.has(key)) {
    try {
      return await downloading.get(key);
    } catch (_) {
      return '';
    }
  }
  const job = (async () => {
    paths.ensureDir(MEDIA_DIR);
    const res = await fetch(remote, { headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://qzone.qq.com/' } });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length) throw new Error('空文件');
    // 链接过期时服务器会回一段 JSON，别把它当图片存下来
    const real = sniffExt(buf);
    if (!real) throw new Error('不是图片（' + String(res.headers.get('content-type') || '未知类型') + '）');
    const file = path.join(MEDIA_DIR, key + real);
    fs.writeFileSync(file, buf);
    return file;
  })();
  downloading.set(key, job);
  try {
    return await job;
  } catch (_) {
    return '';
  } finally {
    downloading.delete(key);
  }
}

function fileUrl(file) {
  return 'file:///' + String(file).replace(/\\/g, '/');
}

const inbox = {
  /** 会话列表（最近有动静的在前） */
  conversations(limit) {
    const n = Math.min(200, Math.max(1, Number(limit) || 50));
    const rows = db.all(
      "SELECT id, title, kind, updated_at FROM conversations WHERE channel = 'qq' ORDER BY updated_at DESC LIMIT ?",
      n,
    );
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      kind: r.kind,
      updatedAt: r.updated_at,
    }));
  },

  /** 某个会话里的消息（按时间正序）。图片/表情包顺手取到缓存里，给前端 file:// 地址 */
  async messages(conversationId, limit) {
    const n = Math.min(500, Math.max(1, Number(limit) || 200));
    // 取最近 n 条再翻回正序；否则条数一多返回的就是最早那几条
    const rows = db
      .all(
        'SELECT id, sender_id, sender_name, content, raw, role, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?',
        String(conversationId),
        n,
      )
      .reverse();
    return Promise.all(
      rows.map(async (r) => {
        const media = mediaOf(r.raw);
        const images = [];
        for (const item of media) {
          const file = await cacheMedia(item);
          if (file) images.push({ src: fileUrl(file), kind: item.kind, summary: item.summary });
        }
        const text = stripMediaCodes(r.content) || (media.length && !images.length ? (media.some((m) => m.kind === 'sticker') ? '[表情]' : '[图片]') : '');
        return {
          id: r.id,
          senderId: r.sender_id,
          senderName: r.sender_name,
          text,
          images,
          role: r.role,
          createdAt: r.created_at,
        };
      }),
    );
  },

  /** 往会话里补一条（自己发出去的，或者模型回的） */
  append(conversationId, { senderId, senderName, text, role, raw }) {
    const now = Date.now();
    db.run(
      'INSERT INTO messages (channel, account, conversation_id, sender_id, sender_name, content, raw, role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      'qq',
      '',
      String(conversationId),
      String(senderId || ''),
      String(senderName || '我'),
      String(text || ''),
      String(raw || ''),
      role || 'assistant',
      now,
    );
    db.run('UPDATE conversations SET updated_at = ? WHERE id = ?', now, String(conversationId));
    return { ok: true };
  },

  /** 收到新消息时立刻把图片/表情拉到缓存（QQ 的图片链接里有会过期的 rkey） */
  prefetch(event) {
    try {
      const media = mediaOf(JSON.stringify({ message: (event && event.message) || [] }));
      return Promise.all(media.map((item) => cacheMedia(item).catch(() => ''))).then((files) => files.filter(Boolean));
    } catch (_) {
      /* 取不到就算了，等打开消息页再试 */
      return Promise.resolve([]);
    }
  },

  /** 总览用：未读不管，先看总条数 */
  stats() {
    const c = db.get("SELECT COUNT(*) AS n FROM conversations WHERE channel = 'qq'");
    const m = db.get("SELECT COUNT(*) AS n FROM messages WHERE channel = 'qq'");
    return { conversations: (c && c.n) || 0, messages: (m && m.n) || 0 };
  },

  convIdOf,
};

module.exports = inbox;
