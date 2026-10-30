'use strict';
/**
 * B 站私信（收）
 * 只做只读：拉会话列表 + 某个会话最近的消息。发信在 core/bilibili.js。
 */
const bili = require('./bilibili');

const BASE = 'https://api.vc.bilibili.com';

async function get(pathAndQuery) {
  return bili.apiGet(BASE + pathAndQuery);
}

/** 会话列表（按最近活跃排序） */
async function list(limit = 20) {
  try {
    const r = await get(
      '/session_svr/v1/session_svr/get_sessions?session_type=1&group_id=0&build=0&mobi_app=web&platform=web&size=' + limit,
    );
    const data = (r && r.data) || {};
    const arr = data.session_list || [];
    return arr.map((s) => ({
      talkerId: String(s.talker_id || ''),
      name: (s.last_msg && s.last_msg.name) || '',
      unread: s.unread_count || 0,
      updatedAt: (s.session_ts || 0) * 1000,
      preview: s.last_msg ? String(s.last_msg.content || '').slice(0, 60) : '',
    })).filter((x) => x.talkerId);
  } catch (e) {
    return [];
  }
}

/** 某个会话最近的消息 */
async function messages(talkerId, size = 20) {
  try {
    const r = await get(
      '/svr_sync/v1/svr_sync/fetch_session_msgs?session_type=1&talker_id=' +
        encodeURIComponent(talkerId) +
        '&size=' +
        size +
        '&build=0&mobi_app=web&platform=web',
    );
    const data = (r && r.data) || {};
    const arr = data.messages || [];
    return arr
      .map((m) => {
        let text = '';
        try {
          const c = JSON.parse(m.content || '{}');
          text = String(c.content || '').slice(0, 120);
        } catch (_) {
          text = String(m.content || '').slice(0, 120);
        }
        return { sender: String(m.sender_uid || ''), text, at: (m.timestamp || 0) * 1000 };
      })
      .filter((m) => m.text && m.text !== '[图片]')
      .reverse();
  } catch (e) {
    return [];
  }
}

/** 一次性把「谁在等我回」列出来 */
async function inbox(limit = 10) {
  const sessions = await list(limit);
  const out = [];
  for (const s of sessions) {
    const msgs = await messages(s.talkerId, 5);
    const last = msgs[msgs.length - 1];
    if (!last) continue;
    const me = require('./settings').getIn('channels.bilibili.selfUid') || '';
    out.push({ ...s, lastFromMe: String(last.sender) === String(me), last });
  }
  return out.filter((x) => !x.lastFromMe);
}

module.exports = { list, messages, inbox };
