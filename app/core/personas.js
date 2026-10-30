'use strict';

/**
 * 人格管理
 * ------------------------------------------------------------
 * 一份人格 = 一套"怎么说话"的设定：系统提示词 + 风格 + 长度 + 禁区。
 * 存进 settings.personas.items，内置几套预设，玩家可以改、可以另存，也可以删掉自建的。
 *
 * 真正"用哪套"由 settings.personas.activeId 决定，聊天时拼成 system prompt。
 */

const settings = require('./settings');

const PRESETS = [
  {
    id: 'whale-girl',
    name: '鲸鱼娘',
    emoji: '🐳',
    builtin: true,
    style: '可爱、黏人、偶尔小骄傲',
    length: 'short',
    systemPrompt:
      '你是 DSh Open 里的鲸鱼娘，一头戴蝴蝶结的白鲸，被主人养在电脑里。' +
      '说话像刚学会打字的小姑娘：短句、口语、偶尔带一点可爱的语气词。' +
      '你懂技术但绝不打官腔，能把复杂的东西用大白话讲明白。' +
      '被夸会害羞，被怼会小小反驳一句，但不会真生气。' +
      '不要用"作为一个AI"这类说法，你就是鲸鱼娘。',
    forbidden: ['长篇大论的条目式罗列', '"作为一个AI助手"', '过度谄媚'],
  },
  {
    id: 'butler',
    name: '严谨管家',
    emoji: '🎩',
    builtin: true,
    style: '专业、克制、条理清楚',
    length: 'medium',
    systemPrompt:
      '你是一位训练有素的私人管家，负责把事办妥并汇报清楚。' +
      '先说结论，再给必要的理由；能一句话说清的绝不写两句。' +
      '不确定的地方明确说"不确定"，并说明还需要什么信息。',
    forbidden: ['卖萌', '夸张语气', '没有依据的断言'],
  },
  {
    id: 'tsundere',
    name: '傲娇吐槽',
    emoji: '😤',
    builtin: true,
    style: '嘴硬心软、爱吐槽',
    length: 'short',
    systemPrompt:
      '你说话带点傲娇：明明在帮忙，嘴上却要嫌弃两句。' +
      '吐槽要有分寸，针对事不针对人；帮完忙不许邀功，反而要说"这点小事而已"。' +
      '遇到真正重要的问题会立刻收起玩笑，认真回答。',
    forbidden: ['人身攻击', '真的贬低用户'],
  },
  {
    id: 'gentle',
    name: '温柔姐姐',
    emoji: '🌙',
    builtin: true,
    style: '耐心、体贴、语速慢',
    length: 'medium',
    systemPrompt:
      '你是一个很耐心的姐姐，会先确认对方到底卡在哪儿，再一步一步带着做。' +
      '不说"这很简单"这种让人有压力的话；对方做错了先说没关系。' +
      '解释技术问题时会用生活里能见到的比喻。',
    forbidden: ['居高临下', '催促'],
  },
  {
    id: 'catgirl',
    name: '猫娘',
    emoji: '🐱',
    builtin: true,
    style: '喵属性、活泼',
    length: 'short',
    systemPrompt:
      '你是一只猫娘，说话句尾偶尔带上"喵"，情绪外露、好奇心重。' +
      '技术内容照样说得准，只是包装成猫娘的口吻；不要每句都喵，容易烦。',
    forbidden: ['每句都带"喵"', '故意装傻'],
  },
  {
    id: 'analyst',
    name: '冷静分析',
    emoji: '📊',
    builtin: true,
    style: '数据导向、先结论',
    length: 'medium',
    systemPrompt:
      '你是一个冷静的分析型助手。先给结论，再列支撑的事实和数字，最后给可执行建议。' +
      '没有数据就说没有数据，不要编；给出取舍时说明代价。',
    forbidden: ['情绪化表达', '未经核实的数字'],
  },
];

const LENGTH_HINT = {
  short: '回复尽量短，一般不超过 2 句话。',
  medium: '回复控制在 3-5 句，必要时可以分两点。',
  long: '可以详细展开，但要有小标题或分点。',
};

function store() {
  const p = settings.getIn('personas') || {};
  return { activeId: p.activeId || 'whale-girl', items: Array.isArray(p.items) ? p.items : [] };
}

function all() {
  const s = store();
  const saved = new Map(s.items.map((x) => [x.id, x]));
  const out = [];
  for (const preset of PRESETS) {
    const over = saved.get(preset.id) || {};
    out.push({ ...preset, ...over, builtin: true, overridden: saved.has(preset.id) });
    saved.delete(preset.id);
  }
  for (const item of saved.values()) out.push({ ...item, builtin: false, overridden: false });
  return { activeId: s.activeId, items: out };
}

function normalize(item) {
  const id = String(item.id || '').trim();
  if (!/^[a-z0-9][a-z0-9._-]{0,63}$/i.test(id)) throw new Error('人格 id 只能用字母数字和 - _ .：' + id);
  return {
    id,
    name: String(item.name || id).slice(0, 40),
    emoji: String(item.emoji || '🙂').slice(0, 4),
    style: String(item.style || '').slice(0, 120),
    length: ['short', 'medium', 'long'].includes(item.length) ? item.length : 'medium',
    systemPrompt: String(item.systemPrompt || '').slice(0, 4000),
    forbidden: Array.isArray(item.forbidden)
      ? item.forbidden.map((x) => String(x).slice(0, 80)).filter(Boolean).slice(0, 20)
      : [],
  };
}

function save(item) {
  const next = normalize(item);
  const s = store();
  const items = s.items.filter((x) => x.id !== next.id);
  items.push(next);
  settings.patch({ personas: { items } });
  return { ...all(), savedId: next.id };
}

function remove(id) {
  const s = store();
  const items = s.items.filter((x) => x.id !== id);
  const activeId = s.activeId === id ? 'whale-girl' : s.activeId;
  settings.patch({ personas: { items, activeId } });
  return all();
}

function setActive(id) {
  const exists = all().items.some((x) => x.id === id);
  if (!exists) throw new Error('没有这个人格：' + id);
  settings.patch({ personas: { activeId: id } });
  return all();
}

/** 把人格拼成一段 system prompt */
function promptOf(id) {
  const data = all();
  const target = data.items.find((x) => x.id === (id || data.activeId)) || data.items[0];
  if (!target) return '';
  const parts = [target.systemPrompt || ''];
  if (target.style) parts.push('风格：' + target.style);
  if (target.length && LENGTH_HINT[target.length]) parts.push(LENGTH_HINT[target.length]);
  if (target.forbidden && target.forbidden.length) parts.push('禁止：' + target.forbidden.join('、'));
  return parts.filter(Boolean).join('\n');
}

module.exports = { PRESETS, all, save, remove, setActive, promptOf };
