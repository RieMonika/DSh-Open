'use strict';

/**
 * 能力清单
 * ------------------------------------------------------------
 * 一份「这个软件现在能做什么、不能做什么」的清单。
 * 每条都可以在界面上改说明文字，也可以自己加条目。
 *
 * 内置条目写在 CATALOG 里；用户改过的说明存 settings.abilities.notes，
 * 自己加的条目存 settings.abilities.custom。删除内置条目的说明 = 恢复默认。
 */

const settings = require('./settings');

const CATALOG = [
  // ---- QQ ----
  {
    id: 'qq.connect',
    area: 'qq',
    title: '连上 QQ（走 NapCat / OneBot）',
    status: 'done',
    note: 'NapCat 登录 QQ 后开正向 WebSocket（默认 3001），本软件连上去就能收发。',
  },
  {
    id: 'qq.onlyYou',
    area: 'qq',
    title: '只和你指定的 QQ 号互动',
    status: 'done',
    note: '白名单之外的人发消息，只记录不回复。名单在「通道 → 只和谁互动」里填。',
  },
  {
    id: 'qq.reply',
    area: 'qq',
    title: '自动回复（私聊 / 群）',
    status: 'done',
    note: '用当前人格 + 记忆 + 最近几句上下文来回复，可配一张表情。',
  },
  {
    id: 'qq.proactive',
    area: 'qq',
    title: '主动找你说话',
    status: 'done',
    note: '按设定间隔，挑最久没聊的人，主动发一句。有免打扰时段。',
  },
  {
    id: 'qq.growth',
    area: 'qq',
    title: '互动会成长（等级 / 经验）',
    status: 'done',
    note: '每聊一句涨经验，等级越高需要的经验越多。数据存本机。',
  },
  {
    id: 'qq.sticker',
    area: 'qq',
    title: '发表情包',
    status: 'done',
    note: '从本机表情包目录按情绪挑一张，用 CQ 码发出去。',
  },
  {
    id: 'stk.manage',
    area: 'qq',
    title: '表情包管理（分组 / 收藏 / 回收站）',
    status: 'done',
    note: '表情包页点「管理」进多选，可以批量改分组、收藏、移到回收站；单张点开也能改分组。手动改的标签单独存，重扫不丢。',
  },
  {
    id: 'qq.throttle',
    area: 'qq',
    title: '不刷屏（节流 + 打字停顿）',
    status: 'done',
    note: '同一会话最快 20 秒回一条，冷却里的消息合并成一条；每分钟最多 4 条，超了直接不说。回之前先"打一会儿字"。',
  },
  {
    id: 'qq.groupAt',
    area: 'qq',
    title: '群里只认 @',
    status: 'done',
    note: '打开后群里只有 @ 她才会接话，别人聊天不理。在「通道 → 自动回复」里改。',
  },
  {
    id: 'qq.bond',
    area: 'qq',
    title: '关系和好感度（会变语气）',
    status: 'done',
    note: '好感 0~100，分陌生/眼熟/朋友/要好/亲密五档，直接影响她说话的温度；每天还有一个心情。',
  },
  {
    id: 'qq.distill',
    area: 'qq',
    title: '聊完自己记一笔',
    status: 'done',
    note: '每轮聊完让本地小模型（qwen2.5:0.5b）挑一句值得长期记住的事，写进记忆。不联网、不额外花钱。',
  },
  {
    id: 'qq.aiChat',
    area: 'qq',
    title: '不连 QQ 也能和模型聊',
    status: 'done',
    note: '左侧「对话」页：不经过 QQ，直接跟她说。人设、记忆、关系、成长、表情全走同一套，用来验证「脑子」是活的。',
  },
  // ---- B 站 ----
  {
    id: 'bili.read',
    area: 'bilibili',
    title: '读 B 站数据（热门 / UP 投稿）',
    status: 'done',
    note: '公开接口，不需要登录，就能拉到视频标题、BV 号、UP 名字。',
  },
  {
    id: 'bili.recommend',
    area: 'bilibili',
    title: '给你推荐视频（含 BV 号）',
    status: 'done',
    note: '拉热门视频拼成人话，可以一键发到 QQ。',
  },
  {
    id: 'bili.onlyYou',
    area: 'bilibili',
    title: '只和你指定的 B 站账号互动',
    status: 'done',
    note: '填了你的 uid / 昵称，推荐和消息只认这个号。',
  },
  {
    id: 'bili.dm',
    area: 'bilibili',
    title: '往 B 站私信发消息',
    status: 'done',
    note: '小号登录后能发；前提是互相关注，正文 ≤300 字，一天只锁一个收信人。',
  },
  {
    id: 'bili.daily',
    area: 'bilibili',
    title: '自己刷视频、隔一会儿私信推荐给你',
    status: 'done',
    note: '开了以后她按间隔挑一个没推过的视频，用人设写一句再发；只在 09:00–23:00 发。',
  },
  {
    id: 'bili.login',
    area: 'bilibili',
    title: '登录 B 站小号（填 Cookie）',
    status: 'done',
    note: '在「通道 → B 站账号」里填 SESSDATA + bili_jct，点「体检」能看到登录号、互关状态。扫码登录还没做。',
  },
  // ---- 模型 / 记忆 / 人格 ----
  {
    id: 'model.ollama',
    area: 'model',
    title: '用本机 Ollama 跑模型',
    status: 'done',
    note: '默认 qwen2.5:7b，不走云端、不要 Key。',
  },
  {
    id: 'model.cloud',
    area: 'model',
    title: '用云 API（硅基流动等）',
    status: 'done',
    note: '填 Key 就能用，任何 OpenAI 兼容接口都行。',
  },
  {
    id: 'memory.local',
    area: 'memory',
    title: '长期记忆（存在本机）',
    status: 'done',
    note: '记下来的事存本地数据库，永远不会上传。',
  },
  {
    id: 'memory.vector',
    area: 'memory',
    title: '按意思找记忆（向量检索）',
    status: 'done',
    note: '「模型 → 记忆 → 记忆方式」选 Ollama（nomic-embed-text）或硅基流动；老记忆点「补算向量」。之后问「他爱喝什么」也能找到「喜欢热牛奶」。',
  },
  {
    id: 'life.rhythm',
    area: 'model',
    title: '作息（有自己的时间感）',
    status: 'done',
    desc: '按时段调整状态和说话方式；记忆页能看她这会儿什么状态。',
  },
  {
    id: 'life.recall',
    area: 'memory',
    title: '线索召回（省 token）',
    status: 'done',
    desc: '日常寒暄不查记忆；其余按相似度 + 新鲜度取，600 字封顶。',
  },
  {
    id: 'ch.qzone',
    area: 'qq',
    title: '直接发 QQ 空间',
    status: 'done',
    desc: '用 NapCat 的登录态调空间接口，不开浏览器、不弹同意框。',
  },  {
    id: 'persona.custom',
    area: 'model',
    title: '人格管理（可改可建）',
    status: 'done',
    note: '内置几套人格，也能自己写系统提示词、说话风格、禁止行为。',
  },
];

const DEFAULTS = { notes: {}, custom: [] };

function store() {
  const a = settings.getIn('abilities') || {};
  return {
    notes: a.notes && typeof a.notes === 'object' ? a.notes : {},
    custom: Array.isArray(a.custom) ? a.custom : [],
  };
}

function list() {
  const s = store();
  const builtin = CATALOG.map((c) => ({
    ...c,
    note: Object.prototype.hasOwnProperty.call(s.notes, c.id) ? String(s.notes[c.id]) : c.note,
    builtin: true,
  }));
  const custom = s.custom.map((c) => ({
    id: String(c.id || ''),
    area: String(c.area || 'other'),
    title: String(c.title || '未命名'),
    status: ['done', 'todo', 'no'].includes(c.status) ? c.status : 'todo',
    note: String(c.note || ''),
    builtin: false,
  }));
  return [...builtin, ...custom];
}

/** 改一条的说明（内置条目只存说明，自建条目整条替换） */
function saveItem(item) {
  const s = store();
  const it = item || {};
  const id = String(it.id || '');
  if (!id) return { ok: false, error: '缺少 id' };
  const isBuiltin = CATALOG.some((c) => c.id === id);
  if (isBuiltin) {
    s.notes[id] = String(it.note || '');
  } else {
    const idx = s.custom.findIndex((c) => c.id === id);
    const next = {
      id,
      area: String(it.area || 'other'),
      title: String(it.title || '未命名'),
      status: ['done', 'todo', 'no'].includes(it.status) ? it.status : 'todo',
      note: String(it.note || ''),
    };
    if (idx >= 0) s.custom[idx] = next;
    else s.custom.push(next);
  }
  settings.patch({ abilities: s });
  return { ok: true, item: list().find((c) => c.id === id) || null };
}

function addItem(item) {
  const s = store();
  const it = item || {};
  const id = 'custom.' + Date.now().toString(36);
  s.custom.push({
    id,
    area: String(it.area || 'other'),
    title: String(it.title || '新条目'),
    status: ['done', 'todo', 'no'].includes(it.status) ? it.status : 'todo',
    note: String(it.note || ''),
  });
  settings.patch({ abilities: s });
  return { ok: true, id };
}

function removeItem(id) {
  const key = String(id || '');
  const s = store();
  const idx = s.custom.findIndex((c) => c.id === key);
  if (idx >= 0) {
    s.custom.splice(idx, 1);
  } else if (Object.prototype.hasOwnProperty.call(s.notes, key)) {
    delete s.notes[key]; // 内置条目：删掉说明 = 恢复默认
  }
  settings.patch({ abilities: s });
  return { ok: true };
}

module.exports = { list, saveItem, addItem, removeItem, CATALOG };
