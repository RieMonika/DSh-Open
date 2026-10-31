// en-extra12.js —— 记忆页「全量存档 / 她现在琢磨的是 / 她现在的状态」这几行是运行时拼出来的，
// 整句不在词表里；这里按行用规则翻，月份、情绪、说话方式这些片段还能复用前面的 MAP。
(function () {
  if (!window.__EN_DICT) return;
  const dict = window.__EN_DICT;
  const M = (k) => dict.MAP[k] || k;

  Object.assign(dict.MAP, {
    '还没有，点右边让她想一想': 'nothing yet — let her think with the button on the right',
    '还没有，点右边让她想一想。': 'nothing yet — let her think with the button on the right',
    '全量存档': 'Full archive',
    '月份：': 'Months: ',
  });

  dict.RULES.push(
    [/^月份：(.+?) · 约 (\d+) 条 · ([\d.]+) MB$/, (m, months, n, mb) => 'Months: ' + (months === '还没有' ? 'none yet' : months) + ' · about ' + n + ' entries · ' + mb + ' MB'],
    [/^她现在的状态 · (.+?)（(\d+) 点）$/, (m, phase, hour) => 'Her state · ' + M(phase) + ' (' + hour + ':00)'],
    [/^(.+?) —— 说话方式：(.+)$/, (m, mood, style) => M(mood) + ' — speaking style: ' + M(style)],
    [/^她现在琢磨的是：(.+)$/, (m, what) => 'What she is chewing on: ' + M(what)],
    [/^精力 (\d+)%$/, 'Energy $1%'],
    [/^正在想 · (.+)$/, 'Thinking · $1'],
  );

  if (window.EN && window.EN.refresh) window.EN.refresh();
})();
