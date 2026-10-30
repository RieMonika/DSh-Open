'use strict';

/**
 * 插件权限（归属类型）
 * ------------------------------------------------------------------
 * 一个插件只选一种权限。它决定的不是"能做什么"，而是"默认接到哪个模块上"：
 *
 *   PC   人格修正 → 自动接到「人格管理」（改说话方式、语气、系统提示词）
 *   Cli  客户端   → 自动接到「客户端本身」（改界面、布局、快捷键、启动行为）
 *   Def  默认     → 不接任何模块，插件自己独立
 *   Mem  记忆     → 自动接到「记忆管理」
 *   Stk  表情包   → 自动接到「表情包管理」
 *   Chn  通道     → 自动登记成「通道」
 *   Tool 工具     → 自动登记成「模型工具」
 *   Data 数据     → 自动接到「本地数据」
 *
 * 加新类型：这里加一条，然后去 renderer/i18n.js 补 perm.<id>.* 的文案。
 * 中文名、说明、例子都放在 i18n 里，本体代码只认 id / badge / target。
 */

const LIST = [
  { id: 'personality', badge: 'PC', target: 'personality', order: 10 },
  { id: 'client', badge: 'Cli', target: 'client', order: 20 },
  { id: 'default', badge: 'Def', target: null, order: 30 },
  { id: 'memory', badge: 'Mem', target: 'memory', order: 40 },
  { id: 'sticker', badge: 'Stk', target: 'sticker', order: 50 },
  { id: 'channel', badge: 'Chn', target: 'channel', order: 60 },
  { id: 'tool', badge: 'Tool', target: 'tool', order: 70 },
  { id: 'data', badge: 'Data', target: 'data', order: 80 },
];

const DEFAULT_ID = 'default';
const MAP = new Map(LIST.map((p) => [p.id, p]));

function list() {
  return LIST.map((p) => ({ ...p }));
}

function get(id) {
  return MAP.get(id) || null;
}

function isValid(id) {
  return MAP.has(id);
}

/** 未知/没写的权限一律当默认，绝不因为清单写错就打不开软件 */
function normalize(id) {
  return MAP.has(id) ? id : DEFAULT_ID;
}

/** 这个权限默认接到哪个模块上（没有就返回 null） */
function targetOf(id) {
  const p = MAP.get(normalize(id));
  return p ? p.target : null;
}

module.exports = { LIST, DEFAULT_ID, list, get, isValid, normalize, targetOf };
