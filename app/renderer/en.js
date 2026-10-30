/*
 * 英文翻译层（渲染后处理）
 * ------------------------------------------------------------------
 * 界面里的字大部分是页面脚本直接写死的中文。为了不把几百处字符串全改成
 * t('xxx') 调用（改动面太大、容易引入 bug），这里在「渲染之后」遍历 DOM，
 * 只对「整段文本完全等于某个中文短语」的情况做替换。
 *
 * 之所以必须整段匹配：像「共 12 张」这种是拼出来的，子串替换会把
 * 「共」单独翻掉，句子就散架了；拼装串交给 RULES 用正则处理。
 *
 * 什么时候不翻译：语言不是 en-US 时直接跳过；切回中文会整页重绘，
 * 原来的中文自然回来。
 * ------------------------------------------------------------------
 */
(function () {
  'use strict';

  // ---------------- 整句/短语表 ----------------
  const MAP = {
    // 通用
    保存: 'Save',
    保存设置: 'Save',
    保存名单: 'Save list',
    保存分组: 'Save group',
    保存失败: 'Save failed',
    取消: 'Cancel',
    关闭: 'Close',
    删除: 'Delete',
    编辑: 'Edit',
    使用: 'Use',
    使用中: 'In use',
    刷新: 'Refresh',
    刷新状态: 'Refresh',
    打开: 'Open',
    打开目录: 'Open folder',
    打开插件目录: 'Open plugin folder',
    打开文件位置: 'Show in folder',
    重新扫描: 'Rescan',
    重新加载: 'Reload',
    重新生成: 'Regenerate',
    换个心情: 'New mood',
    恢复默认设置: 'Restore defaults',
    再点一次确认: 'Click again to confirm',
    取消收藏: 'Unstar',
    收藏: 'Star',
    移到回收站: 'Move to trash',
    确定移走: 'Move',
    清空选择: 'Clear selection',
    清空记录: 'Clear chat',
    清空登录: 'Sign out',
    退出管理: 'Done',
    管理: 'Manage',
    加一条: 'Add one',
    加一条能力: 'Add entry',
    改说明: 'Edit note',
    全部: 'All',
    其它: 'Others',
    无: 'None',
    是: 'Yes',
    否: 'No',
    状态: 'Status',
    说明: 'Notes',
    标题: 'Title',
    名称: 'Name',
    属于: 'Area',
    例子: 'Example',
    '比如：': 'e.g.',
    配置: 'Config',
    测试连接: 'Test',
    列出可用模型: 'List models',
    设为当前: 'Use this',
    当前使用: 'In use',
    内置: 'Built-in',
    自建: 'Custom',
    有图: 'Has',
    空的: 'Empty',
    未命名: '(untitled)',
    登录状态: 'Sign-in status',
    体检: 'Check',
    扫码登录: 'Scan to sign in',
    手动发一条: 'Send manually',
    现在发一条: 'Send one now',
    现在试一条: 'Try one now',
    看看今天的推荐: 'Preview picks',
    发给谁: 'Send to',
    文件名: 'File',
    分组: 'Group',
    档位: 'Tier',
    权限: 'Permission',
    归属: 'Belongs to',
    权重: 'Weight',

    // 导航 / 页面
    工作台: 'Workspace',
    系统: 'System',
    总览: 'Overview',
    通道: 'Channels',
    模型: 'Model',
    对话: 'Chat',
    表情包: 'Stickers',
    能力说明: 'Capabilities',
    插件中心: 'Plugins',
    设置: 'Settings',
    本地版: 'Local',
    骨架版: 'Local',
    多平台消息客户端: 'Multi-platform messaging client',
    内核就绪: 'Core ready',

    // 总览
    '本体骨架 · 一切功能的入口': 'Local skeleton · the entry to everything',
    一键启动: 'Start all',
    都起来了: 'All up',
    已接入通道: 'Channels connected',
    插件: 'Plugins',
    数据目录: 'Data folder',
    存储引擎: 'Storage',
    路线图: 'Roadmap',
    已完成: 'Done',
    进行中: 'In progress',
    待开始: 'Todo',
    规划中: 'Planned',
    处理: 'Handle',
    用量: 'Usage',
    今日请求: 'Requests today',
    平均延迟: 'Avg latency',
    上下文: 'Context',
    输入: 'In',
    '输入 + 输出': 'Input + output',
    本地模型会慢一些: 'Average latency of recent calls',
  最近请求的平均耗时: 'Average latency of recent calls',
    最近一次请求: 'Last request',
    最近: 'Recent',
    还没有调用记录: 'No calls yet — say something in Chat or on QQ.',
    次: 'times',

    // 通道
    通道是什么: 'What a channel is',
    通道列表: 'Channels',
    WebSocket地址: 'WebSocket URL',
    'WebSocket 地址': 'WebSocket URL',
    'Access Token': 'Access token',
    '管理员QQ（主人）': 'Owner QQ (you)',
    '管理员 QQ（主人）': 'Owner QQ (you)',
    启动软件时自动连: 'Reconnect on launch',
    启动Napcat: 'Launch NapCat',
    '启动 NapCat': 'Launch NapCat',
    'NapCat 启动程序': 'NapCat launcher',
    选择文件: 'Choose file',
    只和谁互动: 'Who she talks to',
    自动回复: 'Auto reply',
    开关: 'On/off',
    回哪些: 'Reply to',
    只回私聊: 'Private only',
    只回群聊: 'Groups only',
    '私聊 + 群聊都回': 'Private + groups',
    '群里只认 @': 'Only when @-mentioned in groups',
    '回复间隔（秒）': 'Reply gap (sec)',
    每分钟上限: 'Max per minute',
    打字停顿: 'Typing pause',
    带一张表情: 'Attach a sticker',
    带几轮上下文: 'Context messages',
    表情怎么发: 'Sticker mode',
    '文字 + 表情一起发': 'Text + sticker',
    '只发表情（不说话）': 'Sticker only',
    '随机：有时只发图': 'Random',
    主动聊天: 'Proactive chat',
    隔多久: 'Every',
    隔多久发一条: 'Interval (minutes)',
    节奏: 'Rhythm',
    固定间隔: 'Fixed interval',
    概率曲线: 'Probability curve',
    她在这里: 'She lives here',
    免打扰时段: 'Quiet hours',
    成长: 'Growth',
    关系: 'Relationship',
    '好感': 'Affinity',
    'B 站 · 账号': 'Bilibili · Account',
    'B 站 · 养成': 'Bilibili · Routine',
    登录状态: 'Sign-in status',
    '她（登录的小号）': 'Her (bot account)',
    管理员UID: 'Owner UID',
    '管理员 UID': 'Owner UID',
    管理员用户名: 'Owner name',
    自动私信推荐: 'Auto DM picks',
    最近发的: 'Recently sent',
    '还没发过。': 'Nothing sent yet.',
    还没连上: 'Not connected',
    已连接: 'Connected',
    已断开: 'Disconnected',
    未连接: 'Not connected',
    在线: 'Online',
    离线: 'Offline',
    未登录: 'Not signed in',
    已登录: 'Signed in',
    连接: 'Connect',
    断开: 'Disconnect',
    '连接中…': 'Connecting…',
    '等扫码…': 'Waiting for scan…',
    把手机对准二维码扫一下: 'Scan the QR code with your phone',
    '二维码过期了，点「重新生成」': 'QR expired, tap Regenerate',
    // 模型
    接入: 'Providers',
    接口地址: 'Base URL',
    模型名: 'Model',
    'API Key': 'API Key',
    记忆: 'Memory',
    记忆方式: 'Memory mode',
    人格: 'Persona',
    表情: 'Stickers',
    '当前使用：': 'In use: ',
    还没填Key: 'No key yet',
    '还没填 Key': 'No key yet',
    '不需要 Key': 'No key needed',
    记住: 'Remember',
    '按意思找（向量）': 'Semantic search (vectors)',
    测试向量: 'Test vectors',
    补算向量: 'Backfill vectors',
    '聊完自己记一笔': 'Learn after chat',
    试试一句话: 'Try a line',
    挑一张看看: 'Pick one',
    自动配图: 'Auto sticker',
    配图概率: 'Sticker chance',
    '全部 708': 'All',
    新建人格: 'New persona',
    '＋ 新建人格': '+ New persona',
    系统提示词: 'System prompt',
    回复长度: 'Length',
    禁区: 'Forbidden',
    风格一句话: 'Style',
    使用这个目录: 'Use this folder',
    '按文件名找（回车）': 'Find by name (Enter)',
    重新生成二维码: 'Regenerate QR',
    挑一张: 'Pick one',

    // 消息 / 对话
    统一收件箱: 'Inbox',
    '说点什么…（回车发送）': 'Type… (Enter to send)',
    发送: 'Send',
    这个会话还没有消息: 'No messages yet',
    还没有会话: 'No conversations yet',
    '还没有成长记录。等有人和你聊过，这里会出现等级。': 'No growth records yet. Once someone chats with her, levels show up here.',
    '还没有关系记录。等你和她聊过几句，这里会出现好感度和当天的心情。':
      'No relationship records yet. Chat a few lines and affinity plus today’s mood will appear here.',
    'QQ 还没连上。先去「通道」页点连接。': 'QQ is offline. Connect it on Channels first.',
    跟她说话: 'Talk to her',
    让她主动说一句: 'Let her start',
    还没聊过: 'No chat yet',
    '她在打字…': 'She is typing…',
    挑一张表情包: 'Pick a sticker',
    这张表情: 'Sticker',

    // 表情包页
    表情包管理: 'Sticker manager',
    '改成哪个分组…': 'Change group…',
    先选几张: 'Select some first',
    '删除「{name}」？': 'Delete “{name}”?',
    共: 'Total',

    // 能力说明
    这个软件现在能做什么: 'What this app can do',
    能做: 'Can',
    不能做: "Can't",
    还没做: 'Not yet',
    以后要做的: 'Planned',
    改这一条的说明: 'Edit this entry',

    // 插件
    插件目录: 'Plugin folder',
    插件文件夹: 'Plugin folder',
    插件数据目录: 'Plugin data',
    插件权限说明: 'Plugin permissions',
    权限说明: 'Permissions',
    删除插件: 'Delete plugin',
    '删除「': 'Delete “',
    已启用: 'Enabled',
    已停用: 'Disabled',
    插件中心页面: 'Plugins',
    '插件已经注册了这个页面': 'This plugin registered the page',
    还没安装插件: 'No plugins installed',

    // 设置
    通用: 'General',
    界面语言: 'Language',
    开机自启动: 'Launch at startup',
    数据位置: 'Storage',
    关于: 'About',
    缓存目录: 'Cache folder',
    日志目录: 'Log folder',
    软件版本: 'Version',
    运行时: 'Runtime',
    应用信息: 'App info',
    打开数据目录: 'Open data folder',

    // 状态 / 提示
    已保存: 'Saved',
    已清空: 'Cleared',
    已删除: 'Deleted',
    已收藏: 'Starred',
    已取消收藏: 'Unstarred',
    已记住: 'Noted',
    已发出: 'Sent',
    已发送: 'Sent',
    成功: 'OK',
    失败: 'Failed',
    出错: 'Error',
    '出错：': 'Error: ',
    '出错了：': 'Error: ',
    未知原因: 'Unknown error',
    加载失败: 'Load failed',
    '加载失败：': 'Load failed: ',
    '保存失败：': 'Save failed: ',
    '测试失败：': 'Test failed: ',
    '生成失败：': 'Failed: ',
    '拉取失败：': 'Fetch failed: ',
    '拉不到：': 'Cannot fetch: ',
    没拉到: 'Nothing fetched',
    没发出去: 'Not sent',
    '没发成：': 'Failed to send: ',
    '没发出去：': 'Failed to send: ',
    '没说出来：': 'No reply: ',
    没设就留空: 'Leave empty if none',
    没选模型: 'No model selected',
    未填: 'Not set',
    未配置: 'Not configured',
    未接入: 'Not connected',
    还没填: 'Not set',
    '正在测试…': 'Testing…',
    '正在加载…': 'Loading…',
    '正在读取…': 'Loading…',
    '正在读取状态…': 'Loading status…',
    '正在拉…': 'Fetching…',
    '正在拉模型列表…': 'Fetching models…',
    '正在启动…': 'Starting…',
    '正在生成二维码…': 'Generating QR…',
    '正在体检…': 'Checking…',
    '正在问模型要一条向量…': 'Asking the model for a vector…',
    '正在挑视频、正在写…': 'Picking a video and writing…',
    '正在想说什么…': 'Thinking of something to say…',
    目标: 'Goal',
    '切换后立即生效，不需要重启。': 'Applies immediately, no restart needed.',
    '通过注册表实现，不在 C 盘写文件。': 'Uses the registry, nothing written to C:.',
    '所有用户数据都在 D 盘': 'All user data lives next to the app.',
    '数据库、账号、日志': 'Database, accounts, logs',
    '随时可删，不影响数据': 'Safe to delete, data is kept',
    启动时: 'On launch',

    // 常见长句（页面副标题 / 说明）
    '所有扩展功能的统一入口': 'One place for every extension',
    '消息从哪里来、到哪里去': 'Where messages come from and go to',
    '这头鲸鱼用什么脑子说话': 'The brain behind this whale',
    '基础设置 · 数据位置 · 关于': 'Basics · storage · about',
    '三份配置': 'Three configs',
    '接入 B 站': 'Bilibili',
    '接入 QQ': 'QQ',
    '本体骨架 · 一切功能的入口': 'Local skeleton · the entry to everything',
    '放在 plugins 目录即可': 'Drop them in the plugins folder',
    '读写本地数据库，导入导出备份。': 'Reads and writes the local database, import/export.',
  };

  // ---------------- 拼装串规则 ----------------
  const RULES = [
    [/^共\s*(\d+)\s*条$/, '$1 in total'],
    [/^共\s*(\d+)\s*个$/, '$1'],
    [/^共\s*(\d+)\s*人$/, '$1'],
    [/^共\s*(\d+)\s*张\s*·\s*(\d+)\s*个分组$/, '$1 stickers · $2 groups'],
    [/^往下滑还有\s*(\d+)\s*张$/, '$1 more below'],
    [/^就这些了（共\s*(\d+)\s*张）$/, "That's all ($1)"],
    [/^已选\s*(\d+)\s*张$/, '$1 selected'],
    [/^已连上：(.+)$/, 'Connected: $1'],
    [/^已连上\s*(.+)$/, 'Connected: $1'],
    [/^当前：(.+)$/, 'Current: $1'],
    [/^模型：(.+)$/, 'Model: $1'],
    [/^作者:\s*(.+)$/, 'By $1'],
    [/^权限：?(.+)$/, 'Permission: $1'],
    [/^归属：?(.+)$/, 'Belongs to $1'],
    [/^登录的是她：(.+)$/, 'Signed in as her: $1'],
    [/^管理员（收信人）：(.+)$/, 'Owner (recipient): $1'],
    [/^今天：(.*)$/, 'Today: $1'],
    [/^今天\s*(\d+)\s*条$/, '$1 today'],
    [/^(\d+)\s*条$/, '$1'],
    [/^好感\s*(\d+)\/(\d+)$/, 'Affinity $1/$2'],
    [/^经验\s*(\d+)$/, 'XP $1'],
    [/^已选\s*(\d+)\s*张$/, '$1 selected'],
    [/^已发出：(.+)$/, 'Sent: $1'],
    [/^已发给\s*(.+)$/, 'Sent to $1'],
    [/^已改成「(.+)」$/, 'Changed to “$1”'],
    [/^已切换到\s*(.+)$/, 'Switched to $1'],
    [/^已切换到「(.+)」$/, 'Switched to “$1”'],
    [/^已重新扫描：(.+)$/, 'Rescanned: $1'],
    [/^名单已保存：(.+)$/, 'List saved: $1'],
    [/^向量补算完成，共\s*(.+)$/, 'Vectors backfilled: $1'],
    [/^自动记下了：(.+)$/, 'Learned: $1'],
    [/^概率改成\s*(.+)$/, 'Chance set to $1'],
    [/^(\d+)\s*人$/, '$1'],
    [/^(\d+)\s*个$/, '$1'],
  ];

  const ATTRS = ['placeholder', 'title', 'aria-label'];

  // ---------------- 第二批：页面里的说明文字 ----------------
  Object.assign(MAP, {
    消息: 'Inbox',
    'B 站': 'Bilibili',
    'Ollama 本地': 'Ollama (local)',
    已开启: 'On',
    已关闭: 'Off',
    还没说过话: 'No messages yet',
    '挑一套用。三套可以同时配好，随时切换 —— 换模型不用重启。':
      'Pick one to use. Configure all of them freely — switching needs no restart.',
    本机跑数据不出门: 'Runs locally, data never leaves',
    '本机跑，数据不出门': 'Runs locally, data never leaves',
    '云端 API，要填 Key': 'Cloud API, needs a key',
    '任何 OpenAI 兼容接口': 'Any OpenAI-compatible API',
    自动记试试: 'Try auto-note',
    '按情绪分组、什么时候配哪张图。': 'Grouped by mood — which group to use when.',
    什么情绪配哪一组: 'Which group per mood',
    '在下面随便说一句，她会用「模型」页里选的那个人格回你。':
      'Say anything below — she answers with the persona chosen on the Model page.',
    'NapCat 里设了 Token 才填。': 'Only if you set a token in NapCat.',
    '你本人的 QQ 号。它永远在白名单里，成长/关系也只算它。':
      'Your own QQ. Always allow-listed; growth and bond count for it.',
    '开着的话，开机后就自己去连 NapCat，不用手点。':
      'Reconnect to NapCat automatically on launch.',
    '有人发消息，就用「模型」页当前选的人格和接入去回。默认关着。':
      'Replies with the persona and provider from the Model page. Off by default.',
    '群里也回容易刷屏，建议先只回私聊。':
      'Group replies can flood the chat — start with private only.',
    '同一会话最快多久回一条。间隔里的几条消息会攒成一条一起回。':
      'Shortest gap per conversation; messages in between are merged into one reply.',
    '回之前先"打一会儿字"，1~7 秒不等。秒回一看就是机器人。':
      'Pause 1–7s before replying, like someone typing.',
    '打开后，按下面的概率随机从表情包里挑一张发出去。':
      'Attach a random sticker with the chance below.',
    '只发图 = 她回你一张图，不说话；一起发 = 先说话再配图。':
      'Sticker only = just the image; together = text plus sticker.',
    '给模型看最近多少条记录，越大越连贯、越费 token。':
      'How many recent messages the model sees — more is smoother and pricier.',
    '到点了就自己找你说句话。只在「只和谁互动」名单里挑人。':
      'Starts a chat on its own, only with people on the allow-list.',
    '打开后，大约每隔下面的时间，会主动发一句。':
      'When on, she starts a conversation every N minutes.',
    '单位是分钟。太短会烦人，建议 60 以上。': 'Minutes; 60 or more is safer.',
    '和名单里的人每聊一句都会涨经验，聊得越多等级越高。':
      'Every exchange with allow-listed people adds XP.',
    '就是上面登录进来的那个号，自动识别，不用填。':
      'Detected automatically after sign-in — nothing to fill in.',
    '你（主人）的 B 站 UID —— 私信只发给它。':
      'Your Bilibili UID — DMs only go here.',
    '你自己认得出的名字，只影响界面显示。': 'A display name, for you only.',
    '留空 = 不改，只更新前面几项。': 'Leave empty to keep the current cookie.',
    '发私信要它做 csrf 校验。': 'Required for the CSRF check when sending.',
    '可选。填了更像正常浏览器。': 'Optional; makes requests look like a normal browser.',
    '点「体检」看看现在能不能发。': 'Hit Check to see whether sending works.',
    '她会自己去刷视频，隔一段时间挑一个，用私信推给你。':
      'She browses videos and DMs you one now and then.',
    '只在 09:00–23:00 发，同一个视频 7 天不重复。':
      'Only between 09:00 and 23:00, no repeats within 7 days.',
    '单位分钟，最少 60。': 'Minutes, minimum 60.',
    '还没有发过。点「现在发一条」试试。': 'Nothing sent yet — try Send one now.',
    '不超过 300 字。只发给上面那个 UID。':
      'Up to 300 characters, only to the UID above.',
    主人: 'Owner',
    朋友: 'Friend',
    眼熟: 'Familiar',
    陌生: 'Stranger',
    要好: 'Close',
    亲密: 'Intimate',
    到: 'to',
  });

  Object.assign(MAP, {
    'B 站 已登录': 'Bilibili signed in',
    'B 站 未登录': 'Bilibili signed out',
    '自动回复 开': 'Auto reply on',
    '自动回复 关': 'Auto reply off',
    '主动聊天 开': 'Proactive on',
    '主动聊天 关': 'Proactive off',
    'QQ 没连': 'QQ offline',
    硅基流动: 'SiliconFlow',
    'DeepSeek 官方': 'DeepSeek (official)',
    自定义: 'Custom',
    '本地（只存本机，关键词检索）': 'Local only (keyword search)',
    '本地 + Ollama 向量（语义检索）': 'Local + Ollama vectors',
    '本地 + 硅基流动向量（语义检索）': 'Local + SiliconFlow vectors',
    '把「喝什么」和「热牛奶」连起来靠的就是它。算一次存本地，之后不用再算。':
      'This is what links “what does he drink” with “warm milk”. Computed once, stored locally.',
    '每回一句话，有多大概率顺手带一张表情。0.2 = 大约五分之一。':
      'Chance of attaching a sticker per reply. 0.2 ≈ one in five.',
    '名单外的人发消息只记下来，不回复、不主动搭话。名单是空的就谁都不理。':
      'Messages from others are logged only — no reply, no small talk. Empty list means nobody.',
    '打开后，QQ 收到私聊就自动回。模型没配好会回复失败，日志里能看到原因。':
      'Auto-reply to private messages. If the model is misconfigured, check the log.',
    '打开后，群里只有 @ 她才会接话，别人聊天不理。省得变成刷屏机器。':
      'In groups she only answers when @-mentioned.',
    '超过就直接不说，不排队、不补发 —— 攒着话回头复读比不说话更吓人。':
      'Over the limit she simply stays quiet — no queue, no catch-up.',
    '这段时间一句都不发。跨零点也认（比如 23:00 到 08:00）。':
      'No messages during this window, even across midnight.',
    '这里登录的是「她」的小号；下面填的是「你」的账号 —— 两个不是同一个号。':
      'The sign-in above is HER bot account; the fields below are YOUR account.',
    '比如：哈哈、嘿嘿、开心': 'e.g. haha, hehe, yay',
    '比如：喜欢你、想你、爱你': 'e.g. like you, miss you, love you',
    '比如：抱抱你、摸摸头、没事的': 'e.g. hug, pat pat, it is fine',
    '比如：难过、委屈、呜呜': 'e.g. sad, hurt, sob',
    '比如：居然、竟然、真的假的': 'e.g. really, no way',
    '比如：无语、尴尬、汗': 'e.g. speechless, awkward',
    '比如：困了、好困、睡了': 'e.g. sleepy, tired, going to bed',
    '比如：生气、气死、哼': 'e.g. angry, mad, hmph',
    '比如：好吃、饿了、吃饭': 'e.g. tasty, hungry, eating',
    '比如：好的、可以、没问题': 'e.g. ok, sure, no problem',
    '一个通道 = 一个平台。QQ 用 OneBot 协议接进来：NapCat 负责跟腾讯服务器讲话，DSh Open 负责跟 NapCat 讲话。':
      'One channel = one platform. QQ comes in over OneBot: NapCat talks to Tencent, DSh Open talks to NapCat.',
    '走 OneBot v11 正向 WebSocket。NapCat 登录好 QQ 之后，这里填地址点连接。':
      'Over OneBot v11 forward WebSocket. After NapCat signs in to QQ, fill in the address and connect.',
    'NapCat 里开「正向 WebSocket」，端口保持 3001 就用这个默认值。':
      'Enable “forward WebSocket” in NapCat; keep port 3001 to use this default.',
    '一般是 NapCat 目录下的 NapCatWinBootMain.exe（新版）或 napcat.bat。':
      'Usually NapCatWinBootMain.exe (newer) or napcat.bat inside the NapCat folder.',
    '去 napneko 的 GitHub 下载 Windows 包，解压到任意目录（建议 D 盘）。':
      'Get the Windows package from napneko on GitHub and unzip it anywhere (D: preferred).',
    '启动 NapCat，扫码登录 QQ；在网络配置里开「WebSocket 服务器」，端口 3001。':
      'Launch NapCat and scan to sign in; enable the “WebSocket server” on port 3001.',
    '地址保持 ws://127.0.0.1:3001，点连接。连上以后右上角会变成「在线」。':
      'Keep ws://127.0.0.1:3001 and hit Connect; the badge turns Online once connected.',
    '好感度不是等级：它会改变她说话的温度。每天还会换一个心情，她不会每天醒来都是一张白纸。':
      'Affinity is not a level — it changes how warm she sounds. She also wakes up in a new mood each day.',
    '这里登录的是「她」的小号（她用这个号发信）；下面填的「管理员」是你自己（收信人）。两个不是同一个号。':
      'The sign-in above is HER bot account (she sends from it); the “owner” below is YOU. Two different accounts.',
    今天没状态: 'No mood today',
  });

  RULES.push(
    [/^今天：\s*(.*)$/, 'Today: $1'],
    [/^今天\s*(\d+)\s*条$/, '$1 today'],
    [/^系统提示\s*(\d+)\s*字$/, '$1 chars of system prompt'],
    [/^经验\s*(\d+)\s*·\s*(.+)$/, 'XP $1 · $2'],
    [/^好感\s*(\d+)\/(\d+)$/, 'Affinity $1/$2'],
    [/^已向量\s*(.+)$/, 'Vectors $1'],
    [/^能做\s*(\d+)$/, 'Can $1'],
    [/^还没做\s*(\d+)$/, 'Not yet $1'],
    [/^不能做\s*(\d+)$/, "Can't $1"],
    [/^(\d+)\s*套$/, '$1 sets'],
    [/^共\s*(\d+)\s*张\s*·\s*(\d+)\s*个分组\s*·\s*未分类\s*(\d+)$/,
      '$1 stickers · $2 groups · $3 unsorted'],
    [/^再看\s*(\d+)\s*张（还有\s*(\d+)\s*）$/, 'Load $1 more ($2 left)'],
    [/^(.*)\s*·\s*Ollama 本地$/, '$1 · Ollama local'],
    [/^Connected: QQ \/ B 站$/, 'Connected: QQ / Bilibili'],
  );

  // 后处理：翻完还残留的非命令中文片段（比如占位符），在这里做最后一遍替换
  const POST = [];

  function lookup(s) {
    // 新的排版用不换行空格代替「 · 」（形如 NBSP·NBSP）；规则还是照中点那套写，先还原回「 · 」
    const k = String(s).replace(/\u00A0/g, ' ').replace(/\s*·\s*/g, ' · ').trim();
    if (!k) return null;
    if (Object.prototype.hasOwnProperty.call(MAP, k)) return post(k, MAP[k]);
    for (let i = 0; i < RULES.length; i += 1) {
      if (RULES[i][0].test(k)) return post(k, k.replace(RULES[i][0], RULES[i][1]));
    }
    // 用「 · 」拼起来的状态行：分段翻，翻得动就拼回去
    if (k.indexOf(' · ') > 0) {
      const parts = k.split(' · ');
      let touched = false;
      const out = parts.map((p) => {
        const hit = lookup(p);
        if (hit != null && hit !== p) {
          touched = true;
          return hit;
        }
        return p;
      });
      if (touched) return post(k, out.join(' · '));
    }
    return null;
  }

  function post(src, out) {
    let r = String(out);
    for (let i = 0; i < POST.length; i += 1) {
      r = r.replace(POST[i][0], POST[i][1]);
    }
    return r;
  }

  function active() {
    return !!(window.I18N && window.I18N.get && window.I18N.get() === 'en-US');
  }

  function fixTextNode(node) {
    const raw = node.nodeValue;
    const hit = lookup(raw);
    if (hit == null) return false;
    const lead = (raw.match(/^\s+/) || [''])[0];
    const tail = (raw.match(/\s+$/) || [''])[0];
    const body = window.SP ? window.SP.fix(hit) : hit;
    const next = lead + body + tail;
    if (next === raw) return false;
    node.nodeValue = next;
    return true;
  }

  function fixAttrs(el) {
    let changed = false;
    for (let i = 0; i < ATTRS.length; i += 1) {
      const name = ATTRS[i];
      if (!el.hasAttribute || !el.hasAttribute(name)) continue;
      const val = el.getAttribute(name);
      const hit = lookup(val);
      if (hit != null && hit !== val) {
        el.setAttribute(name, window.SP ? window.SP.fix(hit) : hit);
        changed = true;
      }
    }
    return changed;
  }

  function walk(root) {
    if (!root || !active()) return false;
    let changed = false;
    if (root.nodeType === 3) return fixTextNode(root);
    const els = root.querySelectorAll ? root.querySelectorAll('*') : [];
    for (let i = -1; i < els.length; i += 1) {
      const el = i < 0 ? root : els[i];
      if (!el) continue;
      if (el.nodeType === 1) changed = fixAttrs(el) || changed;
      for (let n = el.firstChild; n; n = n.nextSibling) {
        if (n.nodeType === 3 && fixTextNode(n)) changed = true;
      }
    }
    return changed;
  }

  // ---------------- 挂在 DOM 上 ----------------
  let timer = 0;
  let observer = null;

  function flush() {
    timer = 0;
    if (!active()) return;
    walk(document.body);
  }

  function schedule() {
    if (timer) return;
    timer = setTimeout(flush, 30);
  }

  function start() {
    if (observer) observer.disconnect();
    observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ATTRS,
    });
    schedule();
  }

  // 给 en-extra.js 用：它在本文件之后加载，往同一张表里补词
  window.__EN_DICT = { MAP: MAP, RULES: RULES, POST: POST };

  window.EN = {
    translate: walk,
    start: start,
    refresh: schedule,
  };

  // 语言切换由 app.js 触发整页重绘，这里只要盯住 DOM 就行
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
