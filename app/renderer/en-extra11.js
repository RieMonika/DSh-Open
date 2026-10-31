/* DSh Open · English extras 11
 * 记忆列表里的「数据相关」小标签（种类 / 重要度 / 使用次数 / 记忆强度 / 操作按钮）。
 * 这些字符串是拼出来的，不在 en-extra* 的整句表里，补在这里。
 */
(function () {
  if (!window.__EN_DICT) return;
  const dict = window.__EN_DICT;

  Object.assign(dict.MAP, {
    '事实': 'Fact',
    '喜好': 'Preference',
    '事件': 'Event',
    '关系': 'Bond',
    '约定': 'Plan',
    '其它': 'Other',
    '置顶': 'Pin',
    '取消置顶': 'Unpin',
    '归档': 'Archive',
    '取消归档': 'Unarchive',
    '归档区': 'Archive',
    '归档区是空的': 'The archive is empty',
    '归档区是空的。': 'The archive is empty.',
    '没用过': 'Never used',
    '今天用过': 'Used today',
    '昨天用过': 'Used yesterday',
    '重要度': 'Importance',
  });

  dict.RULES.push(
    [/^重要 (\d+)\/10$/, 'Importance $1/10'],
    [/^重要度 (\d+)$/, 'Importance $1'],
    [/^用过 (\d+) 次$/, 'Used $1 times'],
    [/^记得 (\d+)%$/, 'Retained $1%'],
    [/^(\d+) 天前用过$/, 'Used $1 days ago'],
    [/^记得(\d+)%$/, 'Retained $1%'],
    // 表情包分组 chip：未分类组是系统起的名字「其它 N」，翻掉；用户自己文件名派生的组名不动。
    [/^其它\s+(\d+)$/, 'Other $1']
  );

  if (window.EN && window.EN.refresh) window.EN.refresh();
})();
