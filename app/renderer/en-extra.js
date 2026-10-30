/*
 * 英文翻译层（第二批词条）
 * ------------------------------------------------------------------
 * en.js 里的 MAP 只覆盖到早期页面；后来新加的「设置 / 通道 / 模型 / 教程」
 * 等页面还有大量中文。这里在 en.js 之后加载，往同一张表里补词，避免把
 * 几百处写死的中文再改一遍 t('xxx')。
 *
 * 只放「整段完全相等」的词；带数字的拼装串交给 RULES。
 * ------------------------------------------------------------------
 */
(function () {
  'use strict';
  const dict = window.__EN_DICT;
  if (!dict) return;
  const MAP = dict.MAP;
  const RULES = dict.RULES;

  Object.assign(MAP, {
    // ---------------- 总览 ----------------
    先把主人认一下: 'Set up the owner first',
    还没设置: 'Not set',
    '刚从压缩包里解出来的软件不认任何人：没填管理员之前，QQ 里谁说话都当外人处理——有护栏、不能遥控电脑、也不会主动来找你。填一次就好，以后不会再问。':
      'A fresh install trusts nobody. Until you fill in the owner, everyone on QQ is treated as a stranger: guarded, no remote control, no proactive messages. Fill it in once and it will not ask again.',
    管理员是谁: "Who's the owner",
    '管理员 QQ（只对这个人放行）、B 站收信人、进入「管理员」页的密钥，都在这页填。':
      'Owner QQ (the only exempt account), the Bilibili recipient, and the Admin page key all live here.',
    去填: 'Fill in',
    用什么脑子说话: 'Which brain to use',
    去模型页: 'Go to Model',
    '所有信息都只写在这台电脑的 data\\settings.json 和 data\\dsh-open.db 里，不会上传；把整个文件夹发给别人时，记得别带 data 和 cache。':
      'Everything is stored only in data\\settings.json and data\\dsh-open.db on this machine; nothing is uploaded. When you hand the folder to someone, leave out data and cache.',
    视觉API: 'Vision API',
    看图那套接口的用量和聊天分开算: 'Image API usage (counted apart from chat)',
    '看图那套接口的用量（和聊天分开算）': 'Image API usage (counted apart from chat)',
    今日Tokens: 'Tokens today',
    累计Tokens: 'Total tokens',
    当前模型: 'Current model',
    没配: 'Not set',
    还没配置: 'Not configured',
    '还没有调用过。到「通道 → 看图（视觉 API）」配好，点「测一发」就会记在这里。':
      'No calls yet. Configure it under Channels → Vision API and hit “Send a test” — results show up here.',
    语音API: 'Voice API',
    '把回复念出来那套接口的用量（按字数算）': 'Text-to-speech usage (charged by characters)',
    今日字数: 'Characters today',
    还没合成: 'Not yet',
    累计字数: 'Total characters',
    当前音色: 'Current voice',
    '还没有合成过。到「通道 → 说话（语音 API）」配好，点「试听一句」就会记在这儿。':
      'Nothing synthesized yet. Configure it under Channels → Voice API and hit “Play a sample” — it will be logged here.',
    已接入通道: 'Channels connected',
    'QQ / B 站还没接': 'QQ / Bilibili not connected',
    插件: 'Plugins',
    数据目录: 'Data folder',
    存储引擎: 'Storage engine',
    设置数据库日志: 'Settings, database, logs',

    // ---------------- 收件箱 / 对话 ----------------
    'QQ 未连接 · 0 个会话 / 0 条消息': 'QQ offline · 0 conversations / 0 messages',
    '不经过 QQ。人设、记忆、关系、表情都走同一套 —— 没装 NapCat 也能先聊。':
      'No QQ needed. Persona, memory, bond and stickers all work the same here — you can chat before installing NapCat.',

    // ---------------- 表情包 ----------------
    '还没选目录：在下面填一个文件夹，再点「使用这个目录」（也可以点「重新扫描」选文件夹）':
      'No folder yet: type one below and hit “Use this folder” (or press Rescan to pick one).',
    '文件名能看出情绪（比如“笑”“哭”“摸头”），就自动分到对应分组；看不出来的先归到「其它」，可以用下面的「管理」自己改。':
      'If the file name hints at a mood (“laugh”, “cry”, “headpat”), it is filed into that group automatically; the rest go to “Others” and you can re-file them under Manage below.',
    收到表情就存进来: 'Save received stickers',
    '管理员 QQ 发来的表情包，收到后自动收进这个目录（同一张只存一次）；关掉就只在消息里双击手动存。':
      'Stickers sent by the owner are saved into this folder automatically (each file once). Turn it off to save them by hand from the message list.',
    这个分组里没有图: 'No stickers in this group',
    选几张然后批量改分组: 'Pick a few, then re-file them in bulk',

    // ---------------- 管理员 ----------------
    还差一把钥匙: 'One key to go',
    '这一页放的是「谁是管理员」。第一次进来先设一把密钥，以后每次进来都要输。':
      'This page holds “who the owner is”. Set a key on first visit; you will be asked for it every time after.',
    '设置过程中会弹一个窗口，可以随机生成，也可以自己写。':
      'A dialog will pop up: generate a random key or type your own.',
    去设密钥: 'Set a key',

    // ---------------- 桌宠 ----------------
    桌宠: 'Pet',
    '她用的是原版素材（100 个动作），在自己的透明窗口里跑，和主窗口分开。':
      'She runs in her own transparent window with the original 100-animation asset, separate from the main window.',
    显示桌宠: 'Show pet',
    关掉后窗口消失设置会记住: 'Turning it off hides the window; the setting is remembered.',
    '160 ~ 600 像素': '160 ~ 600 px',
    透明度: 'Opacity',
    总在最前: 'Always on top',
    关掉后会被别的窗口盖住: 'Otherwise other windows can cover her.',
    贴哪个角: 'Corner',
    换完立刻挪过去: 'Moves right away when changed.',
    右下: 'Bottom right',
    左下: 'Bottom left',
    右上: 'Top right',
    左上: 'Top left',
    形象: 'Pack',
    蓝毛小女仆原版: 'Blue-haired maid (original)',
    '蓝毛小女仆（原版）': 'Blue-haired maid (original)',
    当前形象共有100个动作拖动窗口可以搬走她: 'This pack has 100 animations. Drag the window to move her.',

    // ---------------- 记忆 ----------------
    '她记得的东西都存在本机数据库里。用得越多记得越牢，久不想起会慢慢变淡、最后收进归档区（不是删掉，随时能翻）。':
      'Everything she remembers lives in the local database. The more it is used the stronger it gets; things left alone fade and end up in the archive (never deleted).',
    全量存档: 'Full archive',
    '只追加、永不删、也不塞进提示词。记忆被遗忘后，原材料还在这里。':
      'Append-only, never deleted, never sent as a prompt. Even after a memory fades, the raw material stays here.',
    打开存档目录: 'Open archive folder',
    主动动机: 'Motivation',
    再想一次: 'Think again',
    还在记着: 'Remembered',
    已归档: 'Archived',
    有向量: 'Vector',
    向量维度: 'Dimensions',
    遗忘曲线: 'Forgetting curve',
    '半衰期 30 天，强度低于 0.25 就归档。': 'Half-life 30 days; below 0.25 strength it gets archived.',
    现在整理一次: 'Run cleanup now',
    归档区: 'Archive',
    展开看看: 'Expand',
    '已经淡忘的条目会收到这里。不影响使用，只是不再进提示词。':
      'Faded entries land here. They still work — they just stop being sent as prompts.',

    // ---------------- 插件 ----------------
    'B站 操作': 'Bilibili actions',
    '让她能关注/拉黑 UP 主、改自己的名字和简介、给视频点赞投币（举报视接口情况）。谁能指挥她，由这个插件里的白名单决定。':
      'Lets her follow/block creators, rename herself, like and coin videos (reporting depends on the API). Who may command her is decided by the allowlist inside this plugin.',
    'QQ 身份': 'QQ identity',
    '让她能改自己的 QQ 头像、昵称、签名，还能发 QQ 空间。谁能指挥她，由这个插件里的白名单决定。':
      'Lets her change her own QQ avatar, nickname and signature, and post to QQ Zone. Who may command her is decided by the allowlist inside this plugin.',
  });

  RULES.push(
    [/^现在选的是 (.+)。本机 Ollama 不要钱，云端准但按量收费，Key 只存这台电脑。$/,
      'Currently $1. Local Ollama is free; cloud is more accurate but billed by use — your key stays on this machine.'],
    [/^(\d+)\s*入\s*\/\s*(\d+)\s*出$/, '$1 in / $2 out'],
    [/^(\d+)\s*次请求$/, '$1 requests'],
    [/^(\d+)\s*次失败$/, '$1 failed'],
    [/^(\d+)\s*次合成$/, '$1 synthesized'],
    [/^(\d+)\s*KB 音频$/, '$1 KB audio'],
    [/^(\d+)\s*MB 音频$/, '$1 MB audio'],
    [/^活跃\s*(\d+)\s*条$/, '$1 active'],
    [/^归档\s*(\d+)\s*条$/, '$1 archived'],
    [/^置顶\s*(\d+)$/, '$1 pinned'],
    [/^平均重要度\s*(.+)$/, 'Avg. importance $1'],
    [/^月份：(.+)$/, 'Months: $1'],
    [/^她现在的状态\s*·\s*(.+)$/, 'Her state · $1'],
    [/^精力\s*(\d+)%$/, 'Energy $1%'],
    [/^正在记着（(\d+)）$/, 'Remembered ($1)'],
    [/^共\s*(\d+)\s*张\s*·\s*(\d+)\s*个分组$/, '$1 stickers · $2 groups'],
  );

  if (window.EN && window.EN.refresh) window.EN.refresh();
})();
