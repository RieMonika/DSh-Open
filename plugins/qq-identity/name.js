'use strict';

/**
 * 从一句话里认出「想把名字改成什么」。
 * ------------------------------------------------------------
 * 说法五花八门：
 *   改个名字，叫 123456
 *   帮我把名字改成鲸鱼娘
 *   改名 鲸鱼娘
 *   昵称换成「小黑」
 *
 * 做法不是一条大正则，而是：先剥客套/代词，再找动词，再剥动词后面的壳
 * （个 / 名字 / 改成 / 叫 / 冒号逗号），剩下的才算名字。
 * 认不出来就返回空字符串 —— 交给本体正常聊天，别乱改名。
 */

const BEFORE = /^(?:帮我|帮忙|给我|请你|请|麻烦你|麻烦|把|将|我的|你的|我|你|那个|这个|一个|一下|个|名字|昵称|群名片|名片|称呼)\s*/;
const VERB = /^(?:改掉|改了|改一下|改|换掉|换了|换成|换|设置为|设置成|设成|设为|设置|设)\s*/;
const AFTER = /^(?:一下|下|一个|个|名字|昵称|群名片|名片|称呼|名|成|为|叫作成|叫作|叫做|叫|是|就|到|[:：,，、])\s*/;
const TRAIL = /[。！!？?~～\s]+$/;

function parseNickname(raw) {
  const body = String(raw == null ? '' : raw).trim();
  if (!body) return '';
  if (body.length > 60) return '';
  // 头像 / 签名 / 说说这些有各自的关键字，别抢
  if (/(头像|签名|简介|个签|说说|空间|资料)/.test(body)) return '';

  let s = body.replace(TRAIL, '');
  for (let i = 0; i < 8; i++) {
    const m = s.match(BEFORE);
    if (!m || !m[0]) break;
    s = s.slice(m[0].length);
  }
  const v = s.match(VERB);
  if (!v || !v[0]) return '';
  s = s.slice(v[0].length);
  for (let i = 0; i < 8; i++) {
    const m = s.match(AFTER);
    if (!m || !m[0]) break;
    s = s.slice(m[0].length);
  }
  let name = s.trim().replace(/^["'“”「」『』]+/, '').replace(/["'“”「」『』]+$/, '').replace(TRAIL, '').trim();
  if (!name) return '';
  if (name.length > 24) return '';
  if (/[\r\n]/.test(name)) return '';
  const mentionsName = /名|昵称|称呼/.test(body);
  // 「我今天改主意了」这种：没提名字、又短又带语气词，不当成改名
  if (!mentionsName && /[了啦吧呢哦呀]$/.test(name)) return '';
  if (!mentionsName && name.length > 10) return '';
  return name;
}

module.exports = { parseNickname };
