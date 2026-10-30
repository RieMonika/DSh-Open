'use strict';

/**
 * 「发说说」意图识别 + 直接发 QQ 空间
 * ------------------------------------------------------------
 * 为什么单独抽一个模块：同一个需求有三条入口 ——
 *   1) 「通道」页的「发这条说说」按钮（plugins 的 action）
 *   2) QQ 私聊里跟她说「发个说说 xxx」（qq-identity 插件）
 *   3) 客户端里的「对话」页跟她说同样的话（core/chat.js）
 * 三条路都要能认出来、都能真发出去，所以判断和发送放在这里，谁都能用。
 */

const ai = require('./ai');
const personas = require('./personas');
const settings = require('./settings');
const qqzone = require('./qqzone');
const qq = require('./qq');

// 认这些说法：发说说 / 发个空间 / 发一下 QQ空间 / 帮我发条动态 / 随便发个说说 ……
// 后面带不带内容都行；不带内容就让她自己写一句。
const RE = new RegExp(
  '^(?:帮我|帮忙|给我|麻烦|顺便|随便|随手)?\\s*' +
    '(?:发|发个|发条|发一条|发一下|发一条|发一篇|发点点)\\s*' +
    '(?:个|条|一下|一个)?\\s*' +
    '(?:qq空间|qq空间说说|空间说说|空间|说说|动态)\\s*' +
    '(?:吧|呗|呀|啊|哦)?\\s*[:：,，、]?\\s*([\\s\\S]*)$',
  'i',
);

/** 识别是不是「发说说」，是的话返回 { body }（body 可能为空串） */
function detect(text) {
  const raw = String(text || '').trim();
  if (!raw || raw.length > 1200) return null;
  const m = raw.match(RE);
  if (!m) return null;
  let body = String(m[1] || '').trim();
  // 有人会说「内容是：……」「文案：……」
  body = body.replace(/^(?:内容|文案|正文)\s*[:：]\s*/, '').trim();
  return { body, raw };
}

/** 没给内容的时候，让她按自己的口吻现写一句 */
async function compose(hint) {
  const pid = settings.getIn('personas.activeId') || 'whale-girl';
  const persona = personas.promptOf(pid) || '';
  const lines = [
    persona,
    '现在要在你自己的 QQ 空间发一条说说。',
    '用你平时说话的口吻写，20~50 个字，像真人随手发的：有点情绪、有点小细节，不要标签、不要一堆 emoji、不要引号、不要解释。',
  ];
  if (hint) lines.push('可以带一点这个意思：' + String(hint).slice(0, 80));
  const providerId = settings.getIn('model.active') || 'ollama';
  const out = await ai.chat(
    providerId,
    [
      { role: 'system', content: lines.filter(Boolean).join('\n') },
      { role: 'user', content: '写吧。' },
    ],
    { temperature: 0.95, maxTokens: 160, timeoutMs: 45000 },
  );
  const text = String(out || '')
    .trim()
    .replace(/^["'“‘]+|["'”’]+$/g, '')
    .trim();
  if (!text) throw new Error('这次没想出来发什么');
  return text.slice(0, 1000);
}

/**
 * 发出去。先走「拿 NapCat 登录态直接调空间接口」，不行再让 NapCat 自己发。
 * 返回 { ok, message, tid }
 */
async function publish(text) {
  const content = String(text || '').trim();
  if (!content) throw new Error('内容是空的');

  try {
    const r = await qqzone.publish(content);
    return { ok: true, message: r.message || '发出去了', tid: r.tid || '' };
  } catch (first) {
    // 直连失败：再试 NapCat 自带的空间动作（参数名它认 content）
    try {
      const res = await qq.call('send_qzone_msg', { content });
      const tid = (res && (res.tid || (res.data && res.data.tid))) || '';
      return { ok: true, message: '发出去了', tid: String(tid) };
    } catch (second) {
      const why = (first && first.message) || String(first);
      throw new Error(why);
    }
  }
}

module.exports = { detect, compose, publish, RE };
