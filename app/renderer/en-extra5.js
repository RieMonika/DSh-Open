/*
 * 英文翻译层（第五批：教程页上半 —— 四步卡 + M1…M8）
 */
(function () {
  'use strict';
  const dict = window.__EN_DICT;
  if (!dict) return;
  const MAP = dict.MAP;
  const RULES = dict.RULES;

  Object.assign(MAP, {
    '从零到能聊：四步': 'From zero to talking: four steps',
    '跟着这四步走完，QQ 里就能跟她说话了。标签读的是你当前真实配置，不是示例。':
      'Finish these four steps and she can talk in QQ. The tags read your real configuration, not samples.',
    全部展开: 'Expand all',
    全部收起: 'Collapse all',
    待设置: 'Not set',
    认主人: 'Name the owner',
    '告诉软件你是谁：管理员 QQ、B 站 UID、进入密钥。不填这个，谁跟她说话都当外人。':
      'Tell the app who you are: owner QQ, Bilibili UID, the admin key. Without this, everyone who talks to her is a stranger.',
    '去「管理员」': 'Open Admin',
    接一个通道: 'Connect a channel',
    'QQ 走 NapCat（OneBot 反向 WS），B 站扫码登录。接上以后「消息」页才会开始有东西。':
      'QQ goes through NapCat (OneBot reverse WS); Bilibili signs in by QR. Only then does the Inbox fill up.',
    '去「通道」': 'Open Channels',
    选脑子: 'Pick a brain',
    'Ollama 本地免费，DeepSeek 云端更聪明。挑一个填好，点「测试」通了再「设为当前」。':
      'Ollama is local and free; DeepSeek is smarter but cloud. Fill one in, hit Test, then Set as current.',
    '去「模型」': 'Open Model',
    让她回话: 'Let her reply',
    '打开「自动回复」，定好范围和白名单。做完这一步，QQ 里发一句就能收到回复了。':
      'Turn on Auto reply and set the scope and allowlist. After this, a message in QQ gets an answer.',
    '去「自动回复」': 'Open Auto reply',
    '具体怎么做：按模块来': 'Step by step, module by module',
    '每一块都能折叠。带状态标签的，是根据你当前配置实时判断的；标着「待设置」的那块，往往就是还没弄的一步。':
      'Every block folds. Status tags are computed from your live config; the one marked “Not set” is usually the missing step.',
    '先认一下路：左边栏都是干什么的': 'Start with the map: what each sidebar item does',
    '一分钟看完，后面就知道该点哪儿': 'One minute now saves a lot of hunting later',
    要做的事: 'What to do',
    '左栏上半块是「工作台」：总览（状态 + 一键启动）、消息（QQ / B 站收到的）、对话（你跟她在本机聊）、通道（连接 / 自动回复 / 语音 / 主动聊天都在这里）、模型（用哪个脑子想事情）、表情包、能力说明、插件中心、教程（就是这一页）。':
      'The upper half is Workspace: Overview (status + one-click start), Inbox (what arrives from QQ / Bilibili), Chat (talk to her locally), Channels (connections, auto reply, voice, proactive chat), Model (which brain thinks), Stickers, Capabilities, Plugins, Tutorial (this page).',
    '左栏中间是「她在这里」：养成（成长值、关系度）、记忆（她记住的事）、桌宠（桌面那只小女仆）。':
      'The middle is “She lives here”: Nurture (growth and bond), Memory (what she remembers), Pet (the little maid on your desktop).',
    '左栏最下面是「系统」：管理员（要密钥才进得去，管身份和白名单）。右下角齿轮进「设置」（数据位置、开机自启、恢复默认）。':
      'The bottom is System: Admin (key-protected; identity and allowlists). The gear in the corner opens Settings (data location, launch at startup, reset).',
    '任何一页右上角都有标题和副标题，说明这页管什么；绝大多数设置改完立刻生效，不用重启。':
      'Every page carries a title and subtitle explaining what it governs; most settings take effect as soon as you save, no restart.',
    常见坑: 'Common pitfalls',
    '第一次用先别急着填一堆：按上面 4 步走完，剩下的慢慢调。':
      'Do not configure everything at once: finish the four steps above, then tune the rest.',
    '软件所有数据都在一个文件夹里（默认 `D:\\DSh Open`），「设置 → 数据位置」能看到实际路径。':
      'All data lives in one folder (default `D:\\DSh Open`); Settings → Storage shows the real path.',
    '认主人：管理员 QQ + 进入密钥': 'Name the owner: owner QQ + admin key',
    '谁是主人，决定她能对谁不设防': 'Who the owner is decides who she lets her guard down for',
    还没认主人: 'Owner not set',
    '去「管理员」页': 'Open the Admin page',
    '点左栏最下面金色那格「管理员」。第一次进来会直接弹窗让你设一把密钥：可以「生成一把」（15 位，含大小写字母、数字，最多一个下划线），也可以自己设（6–15 位，必须同时有大小写字母和数字）。':
      'Click the gold “Admin” item at the bottom left. The first visit pops a dialog to set a key: Generate one (15 chars, upper/lower/digit, at most one underscore) or set your own (6–15 chars with upper, lower and a digit).',
    '把密钥抄到别处（记事本、密码管理器）。它是唯一能进这一页的东西，忘了只能删 `data\\admin-key.json` 重新设。':
      'Write the key down somewhere else (notes, password manager). It is the only way in; if you forget it, delete `data\\admin-key.json` and set a new one.',
    '进来以后填「管理员 QQ」（你自己的 QQ 号）和「B 站 UID」（你的 B 站号，私信只发给你），用户名可填可不填，点「保存」。':
      'Then fill Owner QQ (yours) and Bilibili UID (yours; DMs go there). Nickname is optional. Save.',
    '每次离开这一页就自动上锁，下次进来还要输一遍密钥——这是故意的，防止别人趁你不在打开看。':
      'Leaving the page locks it again and asks for the key next time — on purpose, so nobody opens it while you are away.',
    怎么算成功: 'How to verify',
    '总览顶部那张金色卡片「先把主人认一下」消失，就说明填上了。':
      'The gold “Name the owner” card on Overview disappears once it is saved.',
    '管理员 QQ 也是「聊天白名单」里的第一个，她永远会回你。':
      'The owner QQ is always first in the chat allowlist; she always answers you.',
    '想换密钥：「管理员」页最下面「进入密钥」里填旧密钥 + 新密钥两遍。':
      'To rotate the key: Admin page → bottom section → old key plus the new one twice.',
    '密钥输错 5 次会锁 30 秒，等一下再来。': 'Five wrong keys lock the page for 30 seconds; wait and retry.',
    '接通 QQ：NapCat（OneBot）': 'Connect QQ: NapCat (OneBot)',
    '这一步通了，QQ 里才能跟她说话': 'Once this works, QQ messages can reach her',
    'QQ 没连上': 'QQ offline',
    '去「通道」页': 'Open the Channels page',
    '先装 NapCatQQ（第三方 QQ 协议端，跟这个软件是两回事）。装好后在 NapCat 里开「OneBot v11 → WebSocket 服务端」，端口填 `3001`，允许本机连接。':
      'Install NapCatQQ first (a third-party QQ protocol bridge, separate from this app). In NapCat enable “OneBot v11 → WebSocket server”, port `3001`, allow local connections.',
    '回到软件「通道」页的「QQ」分区：填「NapCat 启动程序」的路径（那个 exe）——填了以后这里就能「一键启动」；下面「自己的 QQ」等她登录后会自动显示。':
      'Back in Channels → QQ, set the path to NapCat’s exe; with that filled in you get one-click launch. The “your QQ” row appears after sign-in.',
    '点「连接」（或者让「开机自动连」开着）。连上后这一行会显示「已连上 ws://127.0.0.1:3001」，「消息」页开始有会话。':
      'Click Connect (or leave auto-connect on). When it works the row reads “connected ws://127.0.0.1:3001” and Inbox starts listing conversations.',
    '用另一个 QQ 给这个号发一句「在吗」试一下：如果第 4 步的自动回复已经开了，她就会回。':
      'Send “you there?” from another QQ: if auto reply from step 4 is on, she answers.',
    '「通道 → QQ」显示「已连上」，并且「消息」页能看到会话。':
      'Channels → QQ says connected and Inbox shows conversations.',
    '连不上先看端口：`Get-NetTCPConnection -LocalPort 3001` 有没有在听——没有就是 NapCat 没起来。':
      'If it will not connect, check the port: `Get-NetTCPConnection -LocalPort 3001`. Nothing listening means NapCat is not running.',
    'QQ 版本太新可能让 NapCat 上不去，换 NapCat 新版或降 QQ 版本。':
      'A very new QQ build can break NapCat; update NapCat or downgrade QQ.',
    '别把 NapCat 的端口暴露到公网，它没有密码防护。': 'Never expose NapCat’s port to the internet; it has no password.',
    '接通 B 站：扫码登录 + 私信': 'Connect Bilibili: QR sign-in + DMs',
    '她用你的小号刷视频、给管理员发私信': 'She browses with your alt account and DMs the owner',
    'B 站没登录': 'Bilibili not signed in',
    '去「通道 → B 站」': 'Open Channels → Bilibili',
    '「通道」页拉到最下面「B 站 · 账号」，点「扫码登录」，用手机 B 站扫一下（建议用小号，别用主号）。':
      'Scroll to Channels → Bilibili account and click QR sign-in; scan with the Bilibili app (use an alt account, not your main).',
    '登录成功后这里会显示昵称和 UID；管理员 UID 在「管理员」页里填（私信发给他）。':
      'After sign-in you see nickname and UID here; the owner UID goes in the Admin page (DMs go there).',
    '想要她主动给你推视频：打开「B 站 · 养成 → 自动私信推荐」。标签可以留空（命中标签的优先推，没命中从热门里挑）。':
      'Want her to send picks? Turn on Bilibili → Nurture → auto DM. Tags may stay empty (matching titles win, otherwise popular).',
    '「B 站 · 收到的私信」能看别人发来的私信；她回 B 站私信的规则跟 QQ 共用「对外规矩」。':
      'Bilibili · Incoming DMs shows what others send; her replies follow the same Guard rules as QQ.',
    '「通道 → B 站 · 账号」显示已登录；「养成」页能看到她最近的推荐记录。':
      'Channels → Bilibili account shows signed in; Nurture lists recent picks.',
    'cookie 过期会掉登录，重新扫一次就行。': 'Expired cookies drop the session; just scan again.',
    '同一个视频 7 天内不会重复推（防刷屏）。': 'A video is never recommended twice within 7 days.',
    'B 站私信有频率限制，别设太密。': 'Bilibili rate-limits DMs; do not set the pace too tight.',
    '选脑子：Ollama / DeepSeek / 硅基流动 / 自定义': 'Pick a brain: Ollama / DeepSeek / SiliconFlow / Custom',
    '先用本地免费的跑通，再决定要不要花钱': 'Get the free local one working first, then decide about paying',
    '用本机 Ollama': 'Using local Ollama',
    '去「模型」页': 'Open the Model page',
    '「模型 → 接入」里四选一：Ollama（本机）不要钱、断网也能用（先装 Ollama 并 `ollama pull qwen2.5:7b`）；DeepSeek 官方要 API Key；硅基流动要 Key；自定义填任何 OpenAI 兼容地址。':
      'Model → Providers: choose one of four. Ollama (local) is free and offline (install Ollama and `ollama pull qwen2.5:7b`); DeepSeek official needs a key; SiliconFlow needs a key; Custom takes any OpenAI-compatible URL.',
    '点「配置」填地址 / Key / 模型名，点「测试」——通了会显示它那边有几个模型、多少毫秒。':
      'Open Configure, fill URL / key / model and click Test: on success it reports how many models the endpoint serves and the latency.',
    '点「设为当前」，右上角「当前」会变成这套。换模型不用重启。':
      'Click Set as current; the badge at the top right follows. Switching models needs no restart.',
    '想省钱：日常用 Ollama 7B，遇到复杂问题再切 DeepSeek。':
      'To save money: use Ollama 7B day to day and switch to DeepSeek for hard questions.',
    '「模型 → 接入」右上角显示「当前：xxx」，并且「测试」返回 ok。':
      'Model → Providers shows “current: xxx” and Test returns ok.',
    '测试报 401 就是 Key 不对或没填；报 404 多半是地址少了 `/v1`。':
      '401 means the key is wrong or missing; 404 usually means the URL lacks `/v1`.',
    'Ollama 没启动时地址连不上，报「连不上这个地址」。':
      'If Ollama is not running the URL refuses the connection (“cannot reach this address”).',
    '用云端模型时聊天内容会发到对方服务器；用 Ollama 则完全在本机。':
      'Cloud models send chat content to their server; Ollama stays on your machine.',
    '让她回话：范围、白名单、群聊 @': 'Let her reply: scope, allowlist, group @',
    '不设这一条，她收到消息也不会回': 'Without this she receives messages but answers nothing',
    '自动回复关着': 'Auto reply off',
    '去「通道 → 自动回复」': 'Open Channels → Auto reply',
    '「通道 → 自动回复」打开开关。': 'Turn the switch on in Channels → Auto reply.',
    '「范围」选：只回私聊 / 只在群里回 / 都回。群里默认要 @ 她才理。':
      'Scope: DMs only / groups only / both. In groups she only reacts to @ by default.',
    '「只和谁互动」里填白名单 QQ（逗号隔开）；管理员永远在白名单里。留空 = 只回管理员。':
      'Put allowlisted QQ numbers in Who may talk (comma separated); the owner is always allowed. Empty means owner only.',
    '群里还要在「群聊分寸感」里把群号加进允许名单，再设冷却秒数和每分钟上限，免得刷屏。':
      'For groups also add the group id to the allowed list, then set cooldown and per-minute cap so she does not spam.',
    '你在 QQ 里发一句，她几秒内回你；日志里没有报错。':
      'Send a message in QQ: she answers within seconds and the log shows no errors.',
    '群消息不回：先看范围是不是「只回私聊」，再看群号在不在允许名单、有没有 @ 她。':
      'No group reply? Check the scope (maybe DMs only), whether the group id is allowed, and whether you @mentioned her.',
    '她回得慢：模型慢（本地 7B 在弱机器上要几秒）或网络慢，不是卡死。':
      'Slow replies mean a slow model (local 7B on a weak CPU takes seconds) or the network — not a hang.',
    '想让她只回你：白名单留空就行。': 'To have her answer only you, leave the allowlist empty.',
    '记忆与养成：她怎么记住你': 'Memory and nurture: how she remembers you',
    '记忆存在本机数据库，不上传': 'Memories live in the local database and are never uploaded',
    '还没有记忆': 'No memories yet',
    '去「模型 → 记忆」': 'Open Model → Memory',
    '「模型 → 记忆」里选记忆方式：只用关键词（最省）/ 本地 + Ollama 向量（按意思找，推荐）。':
      'Choose memory mode under Model → Memory: keywords only (cheapest) or local + Ollama vectors (search by meaning; recommended).',
    '点「补算向量」把已有记忆都算一遍，之后新记忆会自动补。':
      'Click Backfill vectors to embed existing memories; new ones are added automatically.',
    '手动加一条试试：「记一条：比如 主人喜欢早上听歌」，再用带意思的话问她，看能不能翻出来。':
      'Try one by hand (“记一条：比如 主人喜欢早上听歌”), then ask indirectly and see if it surfaces.',
    '「遗忘曲线」决定旧记忆多久变淡、低于多少归档；归档不是删除，还能翻出来。':
      'The forgetting curve decides how fast old memories fade and when they archive; archived is not deleted and can be restored.',
    '「养成」页是成长值和关系度，聊天多、聊得久会涨。': 'Nurture shows growth and bond; chatting more and longer raises them.',
    '「模型 → 记忆」右上角「共 N 条」，且「按意思找」显示「已向量 N/N」。':
      'Model → Memory reads “N entries” and vector search shows “N/N embedded”.',
    '向量模型要 Ollama 在线（nomic-embed-text，768 维）。': 'Vectors need Ollama running (nomic-embed-text, 768 dims).',
    '换电脑只拷 data 文件夹，记忆和关系就都带走了。':
      'Moving machines? Copy the data folder and memories plus bond come along.',
    '「恢复默认设置」不会动记忆和养成。': 'Restore defaults never touches memories or nurture.',
    '表情包：把图库接进来': 'Stickers: point it at your gallery',
    '文件名能看出情绪，就自动分组': 'Filenames hint at mood, so groups fill themselves',
    '还没放表情': 'No stickers yet',
    '去「表情包」页': 'Open the Stickers page',
  });

  RULES.push(
    [/^NapCat 里要开的两项：[\s\S]*$/, 'In NapCat enable two things:\n  OneBot implementation   v11\n  WebSocket server        port 3001 (local)\nConnection URL: ws://127.0.0.1:3001 (NapCat dials the app)'],
    [/^Ollama 装好后自己会跑在：[\s\S]*$/, 'Ollama listens on: http://127.0.0.1:11434/v1\nDeepSeek official: https://api.deepseek.com/v1, model deepseek-chat'],
  );

  if (window.EN && window.EN.refresh) window.EN.refresh();
})();
