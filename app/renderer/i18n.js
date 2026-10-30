'use strict';

/**
 * 界面文案（i18n）
 * ------------------------------------------------------------
 * 加语言的步骤：在 DICT 里加一套完整的 key，然后把 id 加进 LIST，
 * 设置页的下拉框会自动多出一项（选项来自 LOCALES）。
 *
 * 代码里不要写死中文，一律 t('key')。
 */

(function () {
  const LIST = [
    { id: 'zh-CN', name: '简体中文' },
    { id: 'en-US', name: 'English' },
  ];

  const DICT = {
    'zh-CN': {
      'app.subtitle': '多平台消息客户端',
      'brand.version': '本地版',

      'nav.group.work': '工作台',
      'nav.group.system': '系统',
      'nav.dashboard': '总览',
      'nav.pet': '桌宠',
    'pet.title': '桌宠',
    'page.pet.sub': '窗口大小、透明度、贴哪个角',
  'nav.pet.en': 'Pet',
  'nav.memory': '记忆',
  'nav.channels': '通道',
      'nav.growth': '养成',
      'nav.model': '模型',
      'nav.chat': '对话',
  'nav.stickers': '表情包',
      'nav.abilities': '能力说明',
      'nav.plugins': '插件中心',
      'nav.tutorial': '教程',
      'nav.settings': '设置',
      'side.ready': '内核就绪',

      'state.done': '已完成',
      'state.now': '进行中',
      'state.todo': '待开始',
      'state.planned': '规划中',

      // ---------------- 总览 ----------------
      'page.dashboard.title': '总览',
      'page.dashboard.sub': '本体骨架 · 一切功能的入口',
      'usage.title': '用量',
  'usage.loading': '正在读取…',
  'usage.empty': '还没有调用记录。去「对话」页随便说一句，这里就会出数据。',
  'usage.fail': '读不到用量：',
  'usage.tokens': '今日 Tokens',
  'usage.tokensNote': '输入 + 输出',
  'usage.req': '今日请求',
  'usage.reqNote': '次',
  'usage.latency': '平均延迟',
  'usage.latencyNote': '最近请求的平均耗时',
  'usage.ctx': '上下文',
  'usage.ctxNote': '最近一次请求',  'dash.boot': '一键启动',
  'dash.booting': '正在启动…',
  'dash.bootOk': '都起来了',
  'dash.bootPartial': '有一部分没起来，看下面的说明',
  'dash.bootFail': '启动出错：',
  'dash.bootToastOk': '启动完成',
  'dash.bootToastPartial': '有的没起来，看下面的说明',
  'dash.hero.title': '骨架已经换好了',
      'dash.hero.desc':
        '现在打开的是第二层：设置、数据库、插件机制、页面路由都通了。接下来的通道（QQ / B 站）、模型、记忆、人格、表情包，都是往这套骨架上挂零件，不需要再推倒重来。',
      'dash.tag.window': '窗口 ✓',
      'dash.tag.settings': '设置 ✓',
      'dash.tag.plugins': '插件机制 ✓',
      'dash.tag.channel': '通道接入 · 待做',

      'dash.stat.channels': '已接入通道',
      'dash.stat.channelsNote': 'QQ / B 站还没接',
      'dash.stat.plugins': '插件',
      'dash.stat.pluginsNote': '放在 plugins 目录即可',
      'dash.stat.data': '数据目录',
      'dash.stat.dataNote': '设置、数据库、日志',
      'dash.stat.db': '存储引擎',
      'dash.stat.dbNote': 'SQLite 优先，自动兜底',

      'dash.roadmap': '路线图',
      'step.m1': '本体骨架（设置 / 存储 / 插件 / 路由）',
      'step.m2': '插件中心 + 示例插件',
      'step.m3': '接入 QQ（复用 onebot 通道）',
      'step.m4': '模型层：记忆 / 人格 / 表情包',
      'step.m5': '接入 B 站',
      'step.m6': 'OPEN 控制台 + 统计可视化',

      // ---------------- 通道 ----------------
      'page.channels.title': '通道',
      'page.channels.sub': '消息从哪里来、到哪里去',
      'ch.intro.title': '通道是什么',
      'ch.intro.desc':
        '一个通道 = 一个平台。QQ 和 B 站都会以插件的形式接进来，本体不认任何平台特有的东西。接入之后这里会列出每个通道的连接状态、账号和最近活动。',
      'ch.empty.title': '还没有接入任何通道',
      'ch.empty.desc': '当前是纯骨架状态。通道接入从 M3（QQ）开始。',
      'ch.qq.name': 'QQ',
      'ch.qq.desc': '复用本机 onebot 通道，收发群聊/私聊消息',
      'ch.bili.name': 'B 站',
      'ch.bili.desc': '私信、动态、评论通知',
      'ch.status.plan': '未接入',
      'ch.list.title': '通道列表',
      'ch.list.badge': 'M3 / M5',

      // ---------------- 模型 ----------------
      'page.model.title': '模型',
      'page.model.sub': '这头鲸鱼用什么脑子说话',
      'model.intro':
        '模型层分四块：接入（用哪个 DeepSeek）、记忆（记得住谁说过什么）、人格（说话方式和规则）、表情包（什么时候配哪张图）。四个都是独立模块，以后加别的模型也走同一套接口。',
      'model.memory.name': '记忆管理',
      'model.memory.desc': '长期记忆、对话摘要、用户画像；可查看、可删除、可导出。',
      'model.persona.name': '人格管理',
      'model.persona.desc': '系统提示词、说话风格、回复长度、禁止行为，一份人格对应一个配置。',
      'model.sticker.name': '表情包管理',
      'model.sticker.desc': '按情绪分组的图库，配图规则与自动挑图；可以直接用本机已有的表情包目录。',
      'model.status.plan': 'M4 开始',
      'model.modules': '三份配置',

      // ---------------- 插件 ----------------
      'page.plugins.title': '插件中心',
      'page.plugins.sub': '所有扩展功能的统一入口',

      'page.growth.title': '养成',
      'page.growth.sub': '聊得越多，她越像她自己',

      // ---------------- 教程 ----------------
      'page.tutorial.title': '教程',
      'page.tutorial.sub': '从下载到能用，一步一步来',
      'tutorial.title': '教程',
      'tutorial.desc': '这里会写从「软件刚下载完」开始，一步步设置到能用的流程。',
      'tutorial.empty.title': '还没开始写',
      'tutorial.empty.desc': '等软件的默认状态定下来，我再照着流程一步一步补：先点哪里、要填什么、怎么确认通了。现在先把入口放在这儿。',
      'plugins.dir.title': '插件目录',
      'plugins.dir.desc': '每个插件一个文件夹，里面放 plugin.json 和入口文件。放进去后点「重新扫描」即可。',
      'plugins.dir.note': '现在插件只在后台做事，还不会往侧栏加界面 —— 插件自己带界面的机制放在 M2 做，免得侧栏多出点进去是空白的入口。',
      'plugins.open': '打开目录',
      'plugins.rescan': '重新扫描',
      'plugins.empty.title': '还没有安装插件',
      'plugins.empty.desc': '把插件文件夹放进上面的目录，或者点「打开目录」把现成的插件拷进去。',
      'plugins.status.active': '已启用',
      'plugins.status.disabled': '已停用',
      'plugins.status.error': '加载失败',
      'plugins.author': '作者',
      'plugins.perms': '权限',
      'plugins.none': '无',
      'plugins.rescanned': '插件列表已刷新',
      'plugins.toggled': '插件状态已更新',
      'plugins.count': '共 {n} 个',
      'plugins.permission': '权限',
      'plugins.attribution': '归属',
      'plugins.manage': '管理这个插件',
      'plugins.menu.openDir': '打开插件目录',
      'plugins.menu.reload': '重新加载',
      'plugins.menu.delete': '删除插件',
      'plugins.delete.title': '删除「{name}」？',
      'plugins.delete.desc': '会把插件自己的文件整个删掉，删掉以后找不回来。',
      'plugins.delete.folder': '插件文件夹',
      'plugins.delete.data': '插件数据目录',
      'plugins.delete.confirm': '删除',
      'plugins.deleted': '插件已删除',
      'common.cancel': '取消',
      'common.delete': '删除',

      // ---------------- 插件权限（PC / Cli / Def …） ----------------
      'perm.open': '权限说明',
      'perm.title': '插件权限说明',
      'perm.desc': '每个插件只属于一种权限。权限不是安全开关，它决定这个插件「默认挂到哪个模块上」—— 选错了只影响它归到哪一类，不会弄坏软件。',
      'perm.col.name': '名称',
      'perm.col.target': '默认挂到',
      'perm.col.desc': '管什么',
      'perm.col.example': '例子',
      'perm.target.none': '不挂载',
      'perm.target.personality': '人格管理',
      'perm.target.client': '客户端本身',
      'perm.target.memory': '记忆管理',
      'perm.target.sticker': '表情包管理',
      'perm.target.channel': '通道',
      'perm.target.tool': '模型工具',
      'perm.target.data': '本地数据',
      'perm.personality.name': '人格修正',
      'perm.personality.desc': '改模型怎么说话：说话方式、语气、回复长度、系统提示词、禁止行为。',
      'perm.personality.example': '让回复更短更冷淡、加一句口头禅、把某类话题挡掉。',
      'perm.client.name': '客户端',
      'perm.client.desc': '改软件本身：界面外观、布局、快捷键、启动行为。',
      'perm.client.example': '换主题、给侧栏加一个入口、开机直接打开某一页。',
      'perm.default.name': '默认',
      'perm.default.desc': '不强调归属的通用功能，插件自己做自己的，不挂到任何模块。',
      'perm.default.example': '待办清单、便签、计算器这类独立小功能。',
      'perm.memory.name': '记忆',
      'perm.memory.desc': '读写长期记忆、对话摘要、用户画像。',
      'perm.memory.example': '记住用户偏好，在合适的时候自己想起来。',
      'perm.sticker.name': '表情包',
      'perm.sticker.desc': '提供图源、情绪标签和配图规则。',
      'perm.sticker.example': '导入一个图包，按情绪自动挑图。',
      'perm.channel.name': '通道',
      'perm.channel.desc': '接入外部平台，负责收发消息。',
      'perm.channel.example': 'QQ、B 站。',
      'perm.tool.name': '工具',
      'perm.tool.desc': '给模型提供可以调用的函数（工具），模型需要时自己叫。',
      'perm.tool.example': '联网查资料、算数、读本地文件。',
      'perm.data.name': '数据',
      'perm.data.desc': '读写本地数据库，导入导出备份。',
      'perm.data.example': '把聊天记录导出成 Markdown。',
      // 中文界面里括号里补的英文名
      'perm.personality.en': 'Personality correction',
      'perm.client.en': 'Client',
      'perm.default.en': 'Default',
      'perm.memory.en': 'Memory',
      'perm.sticker.en': 'Stickers',
      'perm.channel.en': 'Channel',
      'perm.tool.en': 'Tool',
      'perm.data.en': 'Data',
      'perm.verbose': '显示更清晰的归属',
      'perm.verboseHint': '关着的时候插件卡片只写「权限：PC」；打开后会写「归属：人格管理 → …」。',

      // ---------------- 设置 ----------------
      'page.admin.title': '管理员',
      'page.admin.sub': '谁是主人 · 进这一页要输密钥',
      'page.settings.title': '设置',
      'page.settings.sub': '基础设置 · 数据位置 · 关于',
      'settings.general': '通用',
      'settings.language': '界面语言',
      'settings.languageHint': '切换后立即生效，不需要重启。',
      'settings.startOnBoot': '开机自启动',
      'settings.startOnBootHint': '通过注册表实现，不往 C 盘写文件。',
      'settings.storage': '数据位置',
      'settings.storageHint': '所有用户数据都在 D 盘，删掉缓存不影响数据。',
      'settings.dataDir': '数据目录',
      'settings.cacheDir': '缓存目录',
      'settings.logsDir': '日志目录',
      'settings.pluginsDir': '插件目录',
      'settings.open': '打开',
      'settings.about': '关于',
      'settings.version': '软件版本',
      'settings.runtime': '运行时',
      'settings.db': '存储引擎',
      'settings.dbSqlite': 'SQLite（内置）',
      'settings.dbJson': 'JSON 兜底（受限）',
      'settings.reset': '恢复默认设置',
      'settings.resetConfirm': '再点一次确认',
      'settings.resetDone': '已恢复默认设置',
  'settings.resetScope': '只恢复各个选项，回到刚下载时的样子；管理员身份、表情包、养成、记忆都不会动。',
      'settings.saved': '已保存',
      'settings.saveFailed': '保存失败',
      'settings.restartForWindow': '窗口尺寸等设置会在下次启动生效。',
    },

    'en-US': {
      'app.subtitle': 'Multi-platform messaging client',
      'brand.version': 'Local',

      'nav.group.work': 'Workspace',
      'nav.group.system': 'System',
      'nav.dashboard': 'Overview',
      'nav.pet': 'Pet',
    'pet.title': 'Pet',
    'page.pet.sub': 'Size, opacity, and which corner she sits in',
      'nav.memory': 'Memory',
      'nav.admin': 'Admin',
      'nav.channels': 'Channels',
      'nav.growth': 'Nurture',
      'nav.model': 'Model',
      'nav.chat': 'Chat',
  'nav.stickers': 'Stickers',
      'nav.abilities': 'Capabilities',
      'nav.plugins': 'Plugins',
      'nav.tutorial': 'Tutorial',
      'nav.settings': 'Settings',
      'side.ready': 'Core ready',

      'state.done': 'Done',
      'state.now': 'In progress',
      'state.todo': 'Not started',
      'state.planned': 'Planned',

      'page.dashboard.title': 'Overview',
      'page.dashboard.sub': 'Core skeleton · the entry point for everything',
      'usage.title': 'Usage',
  'usage.loading': 'Loading…',
  'usage.empty': 'No calls yet. Say something on the Chat page and it will show up here.',
  'usage.fail': 'Cannot read usage: ',
  'usage.tokens': 'Tokens today',
  'usage.tokensNote': 'in + out',
  'usage.req': 'Requests',
  'usage.reqNote': 'today',
  'usage.latency': 'Avg latency',
  'usage.latencyNote': 'local models are slower',
  'usage.ctx': 'Context',
  'usage.ctxNote': 'last request',  'dash.boot': 'Start all',
  'dash.booting': 'Starting…',
  'dash.bootOk': 'Everything is up',
  'dash.bootPartial': 'Some parts did not start — see below',
  'dash.bootFail': 'Start failed: ',
  'dash.bootToastOk': 'Started',
  'dash.bootToastPartial': 'Some parts failed, see below',
  'dash.hero.title': 'The skeleton is in place',
      'dash.hero.desc':
        'This is layer two: settings, storage, plugin loading and page routing all work. Channels (QQ / Bilibili), the model layer, memory, persona and stickers will plug into this skeleton — no rebuilds.',
      'dash.tag.window': 'Window ✓',
      'dash.tag.settings': 'Settings ✓',
      'dash.tag.plugins': 'Plugins ✓',
      'dash.tag.channel': 'Channels · pending',

      'dash.stat.channels': 'Channels',
      'dash.stat.channelsNote': 'QQ / Bilibili pending',
      'dash.stat.plugins': 'Plugins',
      'dash.stat.pluginsNote': 'Drop folders into plugins/',
      'dash.stat.data': 'Data folder',
      'dash.stat.dataNote': 'Settings, database, logs',
      'dash.stat.db': 'Storage engine',
      'dash.stat.dbNote': 'SQLite preferred, auto fallback',

      'dash.roadmap': 'Roadmap',
      'step.m1': 'Core skeleton (settings / storage / plugins / routing)',
      'step.m2': 'Plugin center + sample plugin',
      'step.m3': 'Connect QQ (via existing onebot bridge)',
      'step.m4': 'Model layer: memory / persona / stickers',
      'step.m5': 'Connect Bilibili',
      'step.m6': 'OPEN console + charts',

      'page.channels.title': 'Channels',
      'page.channels.sub': 'Where messages come from and go to',
      'ch.intro.title': 'What is a channel',
      'ch.intro.desc':
        'A channel is a platform. QQ and Bilibili will arrive as plugins; the core knows nothing platform-specific. Once connected, each channel lists its status, account and recent activity here.',
      'ch.empty.title': 'No channel connected yet',
      'ch.empty.desc': 'Pure skeleton for now. Channels start at M3 (QQ).',
      'ch.qq.name': 'QQ',
      'ch.qq.desc': 'Reuse the local onebot bridge for group and private messages',
      'ch.bili.name': 'Bilibili',
      'ch.bili.desc': 'Direct messages, dynamics and comment notifications',
      'ch.status.plan': 'Not connected',
      'ch.list.title': 'Channels',
      'ch.list.badge': 'M3 / M5',

      'page.model.title': 'Model',
      'page.model.sub': 'The brain behind this whale',
      'model.intro':
        'The model layer has four parts: provider (which DeepSeek), memory (who said what), persona (tone and rules) and stickers (when to send which image). Each is a separate module, and other providers later use the same interface.',
      'model.memory.name': 'Memory',
      'model.memory.desc': 'Long-term memory, conversation summaries and user profile. Viewable, deletable, exportable.',
      'model.persona.name': 'Persona',
      'model.persona.desc': 'System prompt, tone, reply length and forbidden behaviours. One persona, one config.',
      'model.sticker.name': 'Stickers',
      'model.sticker.desc': 'Emotion-tagged image library, matching rules and auto-pick. Can reuse the existing sticker folder.',
      'model.status.plan': 'Starts at M4',
      'model.modules': 'Three configs',

      'page.plugins.title': 'Plugins',
      'page.plugins.sub': 'One place to manage every extension',

      'page.growth.title': 'Nurture',
      'page.growth.sub': 'How she grows on you, one conversation at a time',

      'page.tutorial.title': 'Tutorial',
      'page.tutorial.sub': 'From a fresh download to fully set up',
      'tutorial.title': 'Tutorial',
      'tutorial.desc': 'A step-by-step guide, starting from a freshly downloaded app.',
      'tutorial.empty.title': 'Not written yet',
      'tutorial.empty.desc': 'Once the default state is settled, I will fill this in step by step: where to click, what to fill, how to tell it works. The entry point is here for now.',
      'plugins.dir.title': 'Plugin folder',
      'plugins.dir.desc': 'One folder per plugin with plugin.json and an entry file. Then press "Rescan".',
      'plugins.dir.note': 'Plugins work in the background for now and do not add sidebar entries yet — plugin-provided UI lands in M2, so the sidebar never gets empty entries.',
      'plugins.open': 'Open folder',
      'plugins.rescan': 'Rescan',
      'plugins.empty.title': 'No plugin installed',
      'plugins.empty.desc': 'Drop a plugin folder into the directory above, or press "Open folder" and copy one in.',
      'plugins.status.active': 'Enabled',
      'plugins.status.disabled': 'Disabled',
      'plugins.status.error': 'Failed to load',
      'plugins.author': 'By',
      'plugins.perms': 'Permissions',
      'plugins.none': 'none',
      'plugins.rescanned': 'Plugin list refreshed',
      'plugins.toggled': 'Plugin state updated',
      'plugins.count': '{n} total',
      'plugins.permission': 'Permission',
      'plugins.attribution': 'Attached to',
      'plugins.manage': 'Manage this plugin',
      'plugins.menu.openDir': 'Open plugin folder',
      'plugins.menu.reload': 'Reload',
      'plugins.menu.delete': 'Delete plugin',
      'plugins.delete.title': 'Delete "{name}"?',
      'plugins.delete.desc': 'This removes the plugin files for good and cannot be undone.',
      'plugins.delete.folder': 'Plugin folder',
      'plugins.delete.data': 'Plugin data folder',
      'plugins.delete.confirm': 'Delete',
      'plugins.deleted': 'Plugin deleted',
      'common.cancel': 'Cancel',
      'common.delete': 'Delete',

      'perm.open': 'Permissions',
      'perm.title': 'Plugin permissions',
      'perm.desc': 'Each plugin has exactly one permission. It is not a security switch — it decides which module the plugin attaches to by default. Picking the wrong one only changes where it shows up, it never breaks the app.',
      'perm.col.name': 'Name',
      'perm.col.target': 'Attaches to',
      'perm.col.desc': 'What it does',
      'perm.col.example': 'Examples',
      'perm.target.none': 'nothing',
      'perm.target.personality': 'Persona',
      'perm.target.client': 'the client itself',
      'perm.target.memory': 'Memory',
      'perm.target.sticker': 'Stickers',
      'perm.target.channel': 'Channels',
      'perm.target.tool': 'Model tools',
      'perm.target.data': 'Local data',
      'perm.personality.name': 'Personality correction',
      'perm.personality.desc': 'Changes how the model speaks: tone, reply length, system prompt, forbidden topics.',
      'perm.personality.example': 'Shorter, cooler replies; a catchphrase; blocking a topic.',
      'perm.client.name': 'Client',
      'perm.client.desc': 'Changes the app itself: look, layout, shortcuts, startup behaviour.',
      'perm.client.example': 'A theme, a sidebar entry, opening a page on launch.',
      'perm.default.name': 'Default',
      'perm.default.desc': 'General-purpose plugin with no emphasis on a module; it stands on its own.',
      'perm.default.example': 'A to-do list, a notepad, a calculator.',
      'perm.memory.name': 'Memory',
      'perm.memory.desc': 'Reads and writes long-term memory, conversation summaries, user profile.',
      'perm.memory.example': 'Remember preferences and bring them up later.',
      'perm.sticker.name': 'Stickers',
      'perm.sticker.desc': 'Provides image sources, emotion tags and picking rules.',
      'perm.sticker.example': 'Import a sticker pack and pick by mood.',
      'perm.channel.name': 'Channel',
      'perm.channel.desc': 'Connects an external platform and moves messages in and out.',
      'perm.channel.example': 'QQ, Bilibili.',
      'perm.tool.name': 'Tool',
      'perm.tool.desc': 'Gives the model callable functions it can invoke on its own.',
      'perm.tool.example': 'Web lookup, arithmetic, reading a local file.',
      'perm.data.name': 'Data',
      'perm.data.desc': 'Reads and writes the local database, imports and exports backups.',
      'perm.data.example': 'Export chat history as Markdown.',
      'perm.personality.en': 'Personality correction',
      'perm.client.en': 'Client',
      'perm.default.en': 'Default',
      'perm.memory.en': 'Memory',
      'perm.sticker.en': 'Stickers',
      'perm.channel.en': 'Channel',
      'perm.tool.en': 'Tool',
      'perm.data.en': 'Data',
      'perm.verbose': 'Show the full attachment',
      'perm.verboseHint': 'Off: plugin cards read "Permission: PC". On: they read "Attached to: Persona → …".',

      'page.admin.title': 'Admin',
      'page.admin.sub': 'Owner settings · key required',
      'page.settings.title': 'Settings',
      'page.settings.sub': 'Basics · storage locations · about',
      'settings.general': 'General',
      'settings.language': 'Language',
      'settings.languageHint': 'Applies immediately, no restart needed.',
      'settings.startOnBoot': 'Launch at startup',
      'settings.startOnBootHint': 'Implemented via registry, no files written to C:.',
      'settings.storage': 'Storage',
      'settings.storageHint': 'All user data lives on D:. Clearing the cache never touches data.',
      'settings.dataDir': 'Data folder',
      'settings.cacheDir': 'Cache folder',
      'settings.logsDir': 'Log folder',
      'settings.pluginsDir': 'Plugin folder',
      'settings.open': 'Open',
      'settings.about': 'About',
      'settings.version': 'Version',
      'settings.runtime': 'Runtime',
      'settings.db': 'Storage engine',
      'settings.dbSqlite': 'SQLite (built-in)',
      'settings.dbJson': 'JSON fallback (limited)',
      'settings.reset': 'Reset to defaults',
      'settings.resetConfirm': 'Click again to confirm',
      'settings.resetDone': 'Defaults restored',
  'settings.resetScope': 'Only the options go back to defaults. Admin identity, stickers, growth and memories are untouched.',
      'settings.saved': 'Saved',
      'settings.saveFailed': 'Save failed',
      'settings.restartForWindow': 'Window size changes apply on next launch.',
    },
  };

  /**
   * 排版用的空白。
   * 以前很多地方用「A · B · C」中点分隔，读起来碎；改成不同宽度的空白来表示层级：
   *   g2（两个不换行空格）：同一块里的几个字段，贴得近一点
   *   g3（三个）：不同块之间，稍微多留一点
   * 用不换行空格（NBSP），因为 HTML 会把连续普通空格压成一个。
   */
  const NB = '\u00A0';
  const SP = {
    g2: NB + '·' + NB,
    g3: NB + '·' + NB,
    join(parts, gap) {
      return (Array.isArray(parts) ? parts : []).filter((x) => x !== '' && x != null).join(gap || SP.g2);
    },
    /** 把老的「 · 」写法就地换成空白：两段当标题+副标题，多段当并列字段 */
    fix(text) {
      const s = String(text == null ? '' : text);
      if (s.indexOf(' · ') < 0) return s;
      const parts = s.split(/\s*·\s*/);
      return parts.join(parts.length === 2 ? SP.g3 : SP.g2);
    },
  };
  window.SP = SP;

  let locale = 'zh-CN';

  const I18N = {
    LIST,

    set(id) {
      if (DICT[id]) locale = id;
      document.documentElement.lang = locale;
      // 语言变了要通知外面：页面正文会整页重绘，但标题栏、侧栏底部这些
      // 「外壳」是 index.html 里写死的，不会跟着重绘 —— 让 app.js 自己补一遍。
      try {
        document.dispatchEvent(new CustomEvent('i18n:change', { detail: { locale } }));
      } catch (_) {}
      return locale;
    },

    get() {
      return locale;
    },

    t(key, vars) {
      const dict = DICT[locale] || DICT['zh-CN'];
      let text = dict[key];
      if (text === undefined) text = DICT['zh-CN'][key];
      if (text === undefined) text = key;
      if (vars) {
        text = text.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m));
      }
      return SP.fix(text);
    },
  };

  window.I18N = I18N;
})();
