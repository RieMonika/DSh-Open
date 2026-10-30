/*
 * 英文翻译层（第六批：教程页下半 —— M9…M14 + FAQ）
 */
(function () {
  'use strict';
  const dict = window.__EN_DICT;
  if (!dict) return;
  const MAP = dict.MAP;
  const RULES = dict.RULES;

  Object.assign(MAP, {
    '「表情包」页选一个目录（留空就是先不用表情包），点「使用这个目录」。':
      'On the Stickers page pick a folder (leave it empty to skip stickers for now) and click Use this folder.',
    '文件名里带「笑/哭/生气/摸头」这类词会自动分到对应分组；看不出来的进「其它」，可以在「管理」里改。':
      'Filenames containing words like laugh / cry / angry / headpat are filed into the matching group automatically; the rest go to “Other” and can be re-filed via Manage.',
    '「重新扫描」会重新读目录；图多的话第一次会慢几秒。':
      'Rescan re-reads the folder; the first pass takes a few seconds for a large gallery.',
    '「收到表情就存进来」会把管理员发来的表情自动收进目录（同一张只存一次）。':
      '“Save stickers I receive” copies stickers from the owner into the folder (each one once).',
    '页面顶部「共 N 张 · M 个分组」，下面能挑出图。': 'The header shows “N stickers · M groups” and you can pick one below.',
    '目录里的子文件夹也会扫。': 'Subfolders are scanned too.',
    '清空目录后再扫描不会报错（已修）。': 'Rescanning an empty folder no longer errors (fixed).',
    '一张图都挑不出来，先看是不是没选目录。': 'Nothing to pick? Check whether a folder is set.',
    '语音：让她真的说话': 'Voice: let her actually speak',
    '两种引擎二选一，先选引擎再填字段': 'Two engines — pick one first, then fill its fields',
    语音关着: 'Voice off',
    '去「通道 → 说话」': 'Open Channels → Voice',
    '「通道 → 说话（语音 API）」最上面选引擎：OpenAI 兼容（任何能吃 `/audio/speech` 的服务）或豆包（火山引擎）。':
      'At the top of Channels → Voice pick the engine: OpenAI-compatible (anything serving `/audio/speech`) or Doubao (Volcano Engine).',
    'OpenAI 兼容：填接口地址（填到 `/v1` 就行）、模型名、音色、Key。豆包：填 APPID、Access Token、Cluster（一般 volcano_tts）、voice_type。':
      'OpenAI-compatible: base URL (up to `/v1` is enough), model, voice, key. Doubao: APPID, Access Token, Cluster (usually volcano_tts) and voice_type.',
    '打开「允许发语音」，点「试听一句」——通了会自动播放，下面状态行变成「已配置」。':
      'Turn on Allow voice messages and hit Preview — it plays on success and the status line becomes “configured”.',
    '什么时候发语音：你在 QQ 里说「发条语音」这类，必发；平时按「回语音的概率」随机发。':
      'When she talks: asking for a voice message always triggers one; otherwise the reply probability decides.',
    '「试听一句」能听到声音；日志里有 `voice_usage` 记录。': 'Preview plays audio and `voice_usage` logs each call.',
    '豆包只认 mp3 / wav / ogg / pcm，别的格式会自动改 mp3。':
      'Doubao accepts mp3 / wav / ogg / pcm only; other formats fall back to mp3.',
    '报「连不上这个地址」= 端口没开或域名写错；报 401 = Key 错。':
      '“Cannot reach this address” means a closed port or wrong host; 401 means a bad key.',
    '语音失败会退回发文字，并在文字后面说明原因。': 'If synthesis fails she falls back to text and appends the reason.',
    '遥控电脑：普通操作直接做，危险操作要按格式': 'Remote control: normal commands just run, dangerous ones need the format',
    '关机、重启、卸载这类，必须你亲手发确认行':
      'Shutdown, restart and uninstall need you to send the confirmation line yourself',
    遥控关着: 'Remote control off',
    '去「模型 → 遥控电脑」': 'Open Model → Remote control',
    '「模型 → 遥控电脑」打开「允许 QQ 指挥电脑」。白名单在「管理员」页里改；管理员自己永远可以。':
      'In Model → Remote control turn on Allow QQ to drive this PC. The allowlist lives on the Admin page; the owner always can.',
    '普通操作直接用话指挥：「截个屏」「打开 bilibili」「内存还剩多少」。':
      'Normal commands work in plain words: “take a screenshot”, “open bilibili”, “how much RAM is left”.',
    '危险操作（关机 / 重启 / 注销 / 睡眠 / 锁屏 / 卸载）她不会直接做：她会回你一行格式，比如 `!Control computer：确认关机`。':
      'Dangerous ones (shutdown / restart / sign out / sleep / lock / uninstall) are never run directly: she replies with one line, e.g. `!Control computer：确认关机`.',
    '你把这一行原样单独发给她（行首就是它、前面不能有别的字），她才会真的执行。':
      'Send that line back verbatim as its own message (it must start the line, nothing before it) and only then does it run.',
    '关机默认有 60 秒缓冲，反悔就发「取消关机」。': 'Shutdown waits 60 seconds by default; send “取消关机” to abort.',
    '发完确认行后 1 秒内，她会回「60 秒后关机。反悔的话发「取消关机」。」':
      'About a second after the confirmation she replies “Shutting down in 60 seconds. Send 取消关机 to abort.”',
    '别人照抄这一行也没用——每次执行前都会再查一次权限。':
      'Copying the line is useless for anyone else — permission is rechecked before every run.',
    '她自己的回复里就算带了这行也不会执行，只认你亲手发的那条消息。':
      'Even if her own reply contains the line it will not run; only the message you sent counts.',
    '「跑命令」开关能执行任意 PowerShell，最危险，平时别开。':
      'The Run commands switch executes arbitrary PowerShell — the riskiest option; keep it off.',
    '主动聊天：她什么时候自己来找你': 'Proactive chat: when she reaches out first',
    'QQ 和 B 站共用一套节奏': 'QQ and Bilibili share one rhythm',
    主动聊天关着: 'Proactive chat off',
    '去「通道 → 主动聊天」': 'Open Channels → Proactive chat',
    '「通道 → 主动聊天」打开开关。': 'Turn it on in Channels → Proactive chat.',
    '「节奏」二选一：固定间隔（到点就发）或概率曲线（隔得越久越可能发，可以在图上双击加点、拖圆点改）。':
      'Rhythm: a fixed interval (send on schedule) or a probability curve (longer gaps, higher odds; double-click to add points, drag dots to shape it).',
    '「最长间隔」是保底：到了这个时间一定会说一句；「免打扰时段」里一句都不发。':
      'Max gap is the backstop — at that point she always speaks; inside quiet hours she never does.',
    'QQ 私聊和 B 站私信推荐共用这套节奏，但各记各的「上次开口」，互不打断。':
      'QQ DMs and Bilibili recommendations share this rhythm but track their own “last spoke”, so neither throttles the other.',
    '「通道 → 主动聊天」显示「已开启」；日志里有 `proactive: 已主动发给 …`。':
      'Channels → Proactive chat shows enabled; the log carries `proactive: 已主动发给 …`.',
    '觉得太吵：把曲线整体往下压，或者把最长间隔调到 180–240 分钟。':
      'Too chatty? Flatten the curve or set max gap to 180–240 minutes.',
    '不发：先看开关、免打扰时段，以及「自动回复」是不是关着。':
      'Nothing sent? Check the switch, quiet hours, and whether Auto reply is off.',
    '群聊不会主动说话，只发私聊。': 'She never starts group conversations; proactive messages are DMs only.',
    '对外规矩：别人问什么都问不出你': 'Public rules: nobody can pry you out of her',
    '只对管理员放行，白名单也照样受限': 'Only the owner is exempt; allowlisted people stay restricted',
    护栏已生效: 'Guard active',
    '去「模型 → 对外规矩」': 'Open Model → Public rules',
    '「模型 → 对外规矩」默认开着，里面有 9 条写死的底线（管理员身份、联系方式、住址、这台电脑的信息、你们之间的私事、冒充套话、改设定、帮别人执行命令、不许长篇解释）。':
      'Model → Public rules ships on with nine hard rules: owner identity, contacts, address, this PC’s info, private matters between you, impersonation tricks, prompt overrides, running commands for others, and no long explanations.',
    '「你自己加的」框里一行一条写自己的规矩，最多 20 条；她按意思理解，不会原文念给别人。':
      'Add your own rules one per line (up to 20); she follows the meaning and never reads them out.',
    '「被追问时甩表情包挡回去」开着的话，别人套隐私时会甩一张「威胁」组的表情。':
      'With “Answer with a sticker” on, probing questions get a sticker from the Threat group.',
    '「看一眼实际加了什么」可以分别预览「别人问她时」「你问她时」真正发出去的提示词。':
      'Preview shows the exact prompt for “when someone else asks” and “when you ask”.',
    '点「别人问她时」能看到 800 多字的护栏；点「你问她时」是 0 字。':
      '“Someone else” shows the ~800-character guard; “you” shows zero.',
    '这是提示词级约束，不是系统隔离；特别刁钻的套话仍可能被绕，最在意的事自己写进自定义规矩。':
      'This is prompt-level, not a sandbox; a determined jailbreak may still slip through — put what matters most in your own rules.',
    '白名单只是「允许回话」，不等于「允许知道」。': 'The allowlist means “may talk to her”, not “may know things”.',
    '关掉这一栏，别人问什么她都会照实说。': 'Turn this section off and she answers strangers honestly.',
    '数据、备份、搬家、恢复出厂': 'Data, backup, moving, factory reset',
    '所有东西都在一个文件夹里': 'Everything lives in one folder',
    '「设置 → 数据位置」能看到 data / cache / logs 的真实路径（默认都在软件目录下）。':
      'Settings → Storage shows the real paths for data / cache / logs (inside the app folder by default).',
    '备份：关掉软件，把整个 `data` 文件夹复制一份就是完整备份（设置 + 数据库 + 日志 + 表情包索引）。':
      'Backup: close the app and copy the whole `data` folder — settings, database, logs and sticker index.',
    '搬家：拷走整个软件文件夹（含 runtime、plugins、data），到新机器双击就能用。':
      'Moving: copy the whole app folder (runtime, plugins, data) and double-click it on the new machine.',
    '「设置 → 恢复默认设置」只把各个选项回到刚下载时的样子；管理员身份、表情包、养成、记忆都不会动。':
      'Settings → Restore defaults resets options only; owner identity, stickers, nurture and memories stay.',
    '想彻底重来：关掉软件删掉 `data` 文件夹，再打开就是全新白板（管理员也要重新认）。':
      'For a full reset close the app, delete the `data` folder and reopen — blank slate, owner included.',
    '「设置 → 关于」能看到版本号；「数据位置」几行都能点开。':
      'Settings → About shows the version; every Storage row opens in Explorer.',
    '别只拷 `settings.json`，记忆和聊天在 `dsh-open.db` 里。':
      'Do not copy only `settings.json`: memories and chats live in `dsh-open.db`.',
    '换机器时 `data\\userData` 是 Electron 缓存，可以不拷。': 'On a new machine you can skip `data\\userData` (Electron cache).',
    '发给别人演示：只带软件本体（app、runtime、plugins），别带 data。':
      'Sharing a demo? Ship app, runtime and plugins only — never data.',
    常见问题: 'FAQ',
    '遇到问题先到这里翻一眼': 'Check here first when something misbehaves',
    'Q：QQ 里她不回消息': 'Q: She ignores me in QQ',
    'A：看「通道 → 自动回复」开没开、范围是不是「只回私聊」、你的 QQ 在不在白名单；群里还要 @ 她。':
      'A: Check Channels → Auto reply is on, the scope is not DMs-only, your QQ is allowlisted; in groups you must @ her.',
    'Q：连不上 NapCat': 'Q: NapCat will not connect',
    'A：3001 端口没在听：NapCat 没启动，或者 NapCat 里的 WS 服务端没开。':
      'A: Nothing listens on 3001 — NapCat is not running, or its WS server is off.',
    'Q：模型测试 401 / 404': 'Q: Model test returns 401 / 404',
    'A：401 = Key 错；404 = 地址少了 `/v1`；连不上 = 地址或端口不对。':
      'A: 401 = wrong key; 404 = missing `/v1`; cannot connect = wrong host or port.',
    'Q：她说自己是文字 AI、发不了语音': 'Q: She says she is text-only and cannot send voice',
    'A：「通道 → 说话」里引擎和字段没填全，或者「允许发语音」关着。':
      'A: The engine or its fields are incomplete in Channels → Voice, or Allow voice messages is off.',
    'Q：桌面没有桌宠': 'Q: No desktop pet',
    'A：「桌宠」页打开开关；尺寸默认 220，按住左键 0.28 秒才能拖动。':
      'A: Enable it on the Pet page; default size 220, hold the left button for 0.28 s to drag.',
    'Q：图标还是旧的': 'Q: The icon is still the old one',
    'A：按 F5 刷资源管理器；还不行就重启一次资源管理器（图标缓存）。':
      'A: Press F5 in Explorer; if that fails restart Explorer (icon cache).',
    'Q：忘记进入密钥': 'Q: I forgot the admin key',
    'A：关掉软件，删掉 `data\\admin-key.json`，再进「管理员」页会重新让你设一把。':
      'A: Close the app, delete `data\\admin-key.json`; the Admin page will ask for a new key.',
    'Q：想让别人也能跟她聊': 'Q: I want others to talk to her',
    'A：把对方 QQ 加进「通道 → 只和谁互动」的白名单；对方仍受「对外规矩」限制。':
      'A: Add their QQ to Channels → Who may talk; they still fall under Public rules.',
    'Q：日志在哪': 'Q: Where are the logs',
    'A：「设置 → 数据位置 → 日志目录」，一天一个文件；出问题先看最后几行。':
      'A: Settings → Storage → Logs, one file per day; read the tail first.',
    'Q：想彻底清空': 'Q: Full wipe',
    'A：关掉软件删 `data` 文件夹；不想全删就用「设置 → 恢复默认设置」只回选项。':
      'A: Close the app and delete the `data` folder, or use Restore defaults to reset options only.',
    '教程写的是当前版本（0.29.17）的真实界面。要是哪天发现按钮名对不上，说明我改了字没同步——直接说一声。':
      'This tutorial matches version 0.29.17. If a button name ever drifts, the text fell out of sync — tell me and I will fix it.',
  });

  RULES.push([
    /^格式（大小写、中英文冒号都行）：[\s\S]*$/,
    'Format (case and colon width both fine):\n!Control computer：确认关机\n!Control computer：确认重启\n!Control computer：确认取消关机',
  ]);

  // 最后一遍：把译文里还残留的「非命令中文」换掉（命令原文必须保持中文，别动）
  dict.POST.push(
    [/（还没填管理员 QQ）/g, '(owner QQ not set yet)'],
    [/本机 Ollama（免费）/g, 'local Ollama (free)'],
    [/云端 DeepSeek（要花 token）/g, 'cloud DeepSeek (paid)'],
    [/云端 SiliconFlow（要花 token）/g, 'cloud SiliconFlow (paid)'],
    [/自定义 OpenAI 接口/g, 'custom OpenAI endpoint'],
    [/记一条：比如 主人喜欢早上听歌/g, 'Note one: e.g. Owner likes music in the morning'],
    [/已主动发给/g, 'proactive: sent to'],
    [/lives on D:\./g, 'lives next to the app.'],
  );

  if (window.EN && window.EN.refresh) window.EN.refresh();
})();
