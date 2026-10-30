'use strict';
/* 作息行为表：几点她「该干什么」，比只有语气更进一步。 */
const TABLE = [
  { from: 0,  to: 5,  key: 'sleep',  activity: '已经睡了',     canProactive: false, style: '别说话，除非非常急' },
  { from: 5,  to: 8,  key: 'wake',   activity: '刚醒，还赖着', canProactive: true,  style: '话少、迷迷糊糊' },
  { from: 8,  to: 11, key: 'work',   activity: '在忙自己的事', canProactive: true,  style: '正经一点，别太长' },
  { from: 11, to: 14, key: 'noon',   activity: '吃饭、刷会儿手机', canProactive: true, style: '轻松，会聊吃的' },
  { from: 14, to: 18, key: 'after',  activity: '下午，容易摸鱼', canProactive: true, style: '分神、会突然想分享点东西' },
  { from: 18, to: 22, key: 'even',   activity: '晚上，闲下来了', canProactive: true, style: '话变多，会撒娇' },
  { from: 22, to: 24, key: 'night',  activity: '准备睡了',       canProactive: true, style: '语气软，会催你也睡' },
];
function now(d = new Date()) {
  const h = d.getHours();
  const slot = TABLE.find((r) => h >= r.from && h < r.to) || TABLE[0];
  return { hour: h, key: slot.key, activity: slot.activity, canProactive: slot.canProactive, style: slot.style };
}
function hint() {
  const a = now();
  return '现在这个点，你的状态是：' + a.activity + '；说话方式：' + a.style + '。别提到「时段/状态」这些词。';
}
module.exports = { TABLE, now, hint };