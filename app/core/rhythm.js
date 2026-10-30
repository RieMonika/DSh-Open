'use strict';
/**
 * 作息（生物钟）
 * 她不是一个 24 小时恒温的客服：凌晨犯困、早上清醒、下午活跃、深夜话少。
 * 这里只做一件事：由「现在几点」算出精神状态，供提示词和界面用。不联网、不花钱。
 */
const settings = require('./settings');

const PHASES = [
  { from: 0, to: 5, key: 'deepNight', zh: '后半夜', energy: 0.15, mood: '困到不行，脑子转得慢', style: '句子短，容易打错字，想睡觉' },
  { from: 5, to: 8, key: 'dawn', zh: '清晨', energy: 0.4, mood: '刚醒，还有点迷糊', style: '慢半拍，会赖床，说话软' },
  { from: 8, to: 11, key: 'morning', zh: '上午', energy: 0.8, mood: '精神不错', style: '愿意多聊两句' },
  { from: 11, to: 14, key: 'noon', zh: '中午', energy: 0.7, mood: '有点饿，想着吃什么', style: '容易把话题拐到吃的' },
  { from: 14, to: 18, key: 'afternoon', zh: '下午', energy: 0.9, mood: '一天里最活跃', style: '话最多，愿意主动找话题' },
  { from: 18, to: 22, key: 'evening', zh: '晚上', energy: 0.65, mood: '放松下来', style: '说话随意，会撒娇' },
  { from: 22, to: 24, key: 'night', zh: '深夜', energy: 0.3, mood: '有点困但舍不得睡', style: '话变少，句子变短' },
];

function phaseOf(hour) {
  const h = Number.isFinite(hour) ? hour : new Date().getHours();
  return PHASES.find((p) => h >= p.from && h < p.to) || PHASES[4];
}

/** 当前状态：给界面用 */
function now() {
  const p = phaseOf();
  return { key: p.key, label: p.zh, energy: p.energy, mood: p.mood, style: p.style, hour: new Date().getHours() };
}

/** 给提示词用的一句话 */
function describe() {
  if (settings.getIn('ui.rhythm') === false) return '';
  const p = phaseOf();
  return (
    '现在是' +
    p.zh +
    '，你的状态：' +
    p.mood +
    '（精力 ' +
    Math.round(p.energy * 100) +
    '%）。说话方式：' +
    p.style +
    '。别提到"状态/精力/百分比"这些词，自然表现出来就行。'
  );
}

module.exports = { now, describe, phaseOf, PHASES };
