'use strict';

/**
 * 表情包配图规则
 * ------------------------------------------------------------
 * 解决的问题：以前自动回复只会挑「开心」那一组，所以她无论说什么你都只收到同一类表情。
 *
 * 现在的做法（不改模型、不花钱）：
 *   1. 先看**她自己回的那句话**里有啥词，猜她当前是什么情绪（detect）
 *   2. 再按情绪查「用哪个分组」（map，玩家可以在「模型 → 表情包」里改）
 *   3. 从那个分组里随机挑一张；那组空了就顺位找下一组，最后兜底到「其它」
 *
 * 规则是纯本地的关键词，快、免费、可预测；玩家看得懂也改得动。
 */

const settings = require('./settings');
const stickers = require('./stickers');
const log = require('./logger');

/**
 * 情绪表。
 * id    内部用
 * zh    界面上显示的名字
 * emo   图标（只是好看）
 * keys  从回复文本里判断情绪的关键词（越小众的越往后放，避免误判）
 * pools 默认优先用哪些分组（第一个是默认）
 */
const MOODS = [
  { id: 'happy', zh: '开心', emo: '😄', pools: ['开心', '庆祝'], keys: ['哈哈', '嘿嘿', '开心', '高兴', '太好了', '好耶', '笑死', '嘻嘻'] },
  { id: 'love', zh: '喜欢', emo: '💗', pools: ['喜欢', '害羞'], keys: ['喜欢你', '想你', '爱你', '抱抱', '亲亲', '心动', '害羞'] },
  { id: 'comfort', zh: '安慰', emo: '🤗', pools: ['摸头', '喜欢'], keys: ['抱抱你', '摸摸头', '没事的', '别难过', '有我在', '顺毛'] },
  { id: 'sad', zh: '难过', emo: '🥺', pools: ['难过'], keys: ['难过', '委屈', '呜呜', '想哭', '不开心', '对不起'] },
  { id: 'surprise', zh: '震惊', emo: '😱', pools: ['震惊', '疑惑'], keys: ['居然', '竟然', '真的假的', '不会吧', '天啊', '啊？'] },
  { id: 'awkward', zh: '无语', emo: '😅', pools: ['无语'], keys: ['无语', '尴尬', '汗', '离谱', '离谱了'] },
  { id: 'tired', zh: '困', emo: '😴', pools: ['困'], keys: ['困了', '好困', '睡了', '晚安', '累了'] },
  { id: 'angry', zh: '生气', emo: '😤', pools: ['生气', '威胁'], keys: ['生气', '气死', '哼', '不理你'] },
  { id: 'eat', zh: '吃', emo: '🍚', pools: ['吃'], keys: ['好吃', '饿了', '吃饭', '干饭', '馋'] },
  { id: 'ok', zh: '认同', emo: '👌', pools: ['认同', '点赞'], keys: ['好的', '可以', '没问题', '嗯嗯', '收到', '厉害', '牛'] },
];

const DEFAULTS = {
  enabled: true,
  chance: 0.2,
  map: {}, // moodId -> 分组名
};

function cfg() {
  const s = settings.getIn('stickers.auto') || {};
  return {
    enabled: s.enabled !== false,
    chance: Number.isFinite(Number(s.chance)) ? Math.min(1, Math.max(0, Number(s.chance))) : DEFAULTS.chance,
    map: s && typeof s.map === 'object' && s.map ? { ...s.map } : {},
  };
}

/** 这个情绪现在该用哪个分组（玩家改过就用改过的） */
function groupOf(moodId) {
  const c = cfg();
  const mood = MOODS.find((m) => m.id === moodId);
  if (!mood) return null;
  return c.map[moodId] || mood.pools[0];
}

/** 从一段话里猜情绪；猜不出来返回 null */
function detect(text) {
  const s = String(text || '');
  if (!s) return null;
  for (const mood of MOODS) {
    for (const key of mood.keys) {
      if (s.includes(key)) return mood.id;
    }
  }
  return null;
}

/** 看看某个分组里到底有没有图（避免配了个空分组，一张都发不出去） */
function groupHasItems(group) {
  try {
    return stickers.list({ emotion: group, limit: 1 }).total > 0;
  } catch (_) {
    return false;
  }
}

/**
 * 给一句话挑一张表情。
 * 返回 { mood, moodZh, group, sticker, reason }，挑不到 sticker 时是 null。
 */
function pickFor(text) {
  const c = cfg();
  if (!c.enabled) return { mood: null, group: null, sticker: null, reason: '自动配图关着' };

  const moodId = detect(text);
  const mood = MOODS.find((m) => m.id === moodId) || null;

  // 候选顺序：该情绪配的分组 → 这个情绪其余推荐分组 → 「其它」→ 全库
  const candidates = [];
  if (mood) {
    candidates.push(groupOf(mood.id));
    for (const g of mood.pools) candidates.push(g);
  }
  candidates.push('其它');

  for (const group of candidates) {
    if (!group) continue;
    if (!groupHasItems(group)) continue;
    const sticker = stickers.pick(group);
    if (sticker) {
      return { mood: moodId, moodZh: mood ? mood.zh : '其它', group, sticker, reason: mood ? '按情绪挑的' : '没看出情绪，从兜底分组挑的' };
    }
  }

  // 还挑不到就直接从全库随手来一张
  const any = stickers.pick();
  return any
    ? { mood: moodId, moodZh: mood ? mood.zh : '其它', group: any.emotion, sticker: any, reason: '兜底：全库随便一张' }
    : { mood: moodId, group: null, sticker: null, reason: '表情包里一张图都没有' };
}

/** 界面要的完整配置：概率 + 每个情绪当前用哪组 + 有哪些组可选 */
function overview() {
  let stats = { groups: [], emotions: [], total: 0 };
  try {
    stats = stickers.stats();
  } catch (err) {
    log.warn('stickerRules: 读不到表情包 —', err && err.message);
  }
  const c = cfg();
  return {
    enabled: c.enabled,
    chance: c.chance,
    total: stats.total || 0,
    groups: (stats.groups || []).map((g) => g.name),
    emotions: stats.emotions || [],
    rules: MOODS.map((m) => ({
      id: m.id,
      zh: m.zh,
      emo: m.emo,
      keys: m.keys.slice(0, 3),
      group: groupOf(m.id),
      pools: m.pools,
      has: groupHasItems(groupOf(m.id)),
    })),
  };
}

function save(patch) {
  const p = patch || {};
  const next = {};
  if (p.enabled !== undefined) next.enabled = !!p.enabled;
  if (p.chance !== undefined) next.chance = Math.min(1, Math.max(0, Number(p.chance) || 0));
  if (p.map && typeof p.map === 'object') {
    const cur = cfg().map;
    next.map = { ...cur, ...p.map };
    // 值为空 = 恢复默认
    for (const [k, v] of Object.entries(next.map)) {
      if (!v) delete next.map[k];
    }
  }
  settings.patch({ stickers: { auto: next } });
  // map 是「整体替换」：深合并删不掉旧键，改回默认（空值）时必须整块重写
  if (next.map) settings.replaceIn('stickers.auto.map', next.map);
  // 概率是同一个数，同步给老字段，免得「通道」页显示的还是旧值
  if (next.chance !== undefined) settings.patch({ autoreply: { stickerChance: next.chance } });
  return overview();
}

/** 界面上的「试试这句话」：告诉我它会挑哪张 */
function test(text) {
  const res = pickFor(String(text || ''));
  return {
    mood: res.mood,
    moodZh: res.moodZh,
    group: res.group,
    reason: res.reason,
    sticker: res.sticker
      ? { name: res.sticker.name, file: res.sticker.file, url: res.sticker.url, emotion: res.sticker.emotion }
      : null,
  };
}

module.exports = {
  moods: MOODS,
  cfg,
  overview,
  save,
  detect,
  pickFor,
  test,
  groupOf,
};
