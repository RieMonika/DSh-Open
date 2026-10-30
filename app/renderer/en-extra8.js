(function () {
  const dict = window.__EN_DICT;
  if (!dict || !dict.MAP) return;

  Object.assign(dict.MAP, {
    // 记忆页第一块的标题（页面标题已经叫 Memory 了，这里换个说法避免重复）
    记忆是怎么回事: 'How memory works',

    // 区块标题（和页面标题重复的那几块，换了个说法）
    '所有会话': 'All conversations',
    '目录与自动收藏': 'Folder & auto-collect',
    '已装插件': 'Installed plugins',
    '窗口设置': 'Window',
    // 总览顶部那行实时状态：分段翻译用
    'QQ 已连接': 'QQ connected',
    'QQ 没连': 'QQ offline',
    'B 站 已登录': 'Bilibili signed in',
    'B 站 没登录': 'Bilibili not signed in',
    '自动回复 开': 'Auto reply on',
    '自动回复 关': 'Auto reply off',
    '主动聊天 开': 'Proactive on',
    '主动聊天 关': 'Proactive off',
    '都还没连上': 'nothing connected yet',
    '已连上：QQ / B 站': 'connected: QQ / Bilibili',
    '已连上：QQ': 'connected: QQ',
    '已连上：B 站': 'connected: Bilibili',
  });

  // 教程页脚那句（带版本号）
  dict.RULES.push([
    /^教程写的是当前版本（(.+?)）的真实界面。要是哪天发现按钮名对不上，说明我改了字没同步——直接说一声。$/,
    'This page describes the real UI of v$1. If a label ever stops matching, the text and the app drifted apart — just tell me.',
  ]);
  if (window.EN && window.EN.refresh) window.EN.refresh();
})();
