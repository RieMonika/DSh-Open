/*
 * 英文翻译层（第二批：通道页 + 前面漏掉的短词）
 * ------------------------------------------------------------------
 * 和 en-extra.js 同样的玩法：往 window.__EN_DICT 里补词，不动画面上的 JS。
 * ------------------------------------------------------------------
 */
(function () {
  'use strict';
  const dict = window.__EN_DICT;
  if (!dict) return;
  const MAP = dict.MAP;
  const RULES = dict.RULES;

  Object.assign(MAP, {
    // ---------------- 总览补漏 ----------------
    '视觉 API': 'Vision API',
    '语音 API': 'Voice API',
    '今日 Tokens': 'Tokens today',
    '累计 Tokens': 'Total tokens',
    没有失败: 'No failures',
    当前音色: 'Current voice',
    还没配: 'Not set',
    '现在选的是 Ollama（本机）。本机 Ollama 不要钱，云端准但按量收费，Key 只存这台电脑。':
      'Currently Ollama (local). Local Ollama is free; cloud is more accurate but billed by use — your key stays on this machine.',
    '现在选的是 DeepSeek 云端。本机 Ollama 不要钱，云端准但按量收费，Key 只存这台电脑。':
      'Currently DeepSeek (cloud). Local Ollama is free; cloud is more accurate but billed by use — your key stays on this machine.',
    '现在选的是 硅基流动 云端。本机 Ollama 不要钱，云端准但按量收费，Key 只存这台电脑。':
      'Currently SiliconFlow (cloud). Local Ollama is free; cloud is more accurate but billed by use — your key stays on this machine.',
    '现在选的是 自定义接口。本机 Ollama 不要钱，云端准但按量收费，Key 只存这台电脑。':
      'Currently a custom endpoint. Local Ollama is free; cloud is more accurate but billed by use — your key stays on this machine.',

    // ---------------- 通道：顶部与视觉 ----------------
    'B站': 'Bilibili',
    '管理员的 QQ、B 站 UID 已经搬到侧栏底部的「管理员」页（那页要输密钥才进得去）。这里只留白名单和连接设置。':
      'The owner QQ and Bilibili UID moved to the Admin page at the bottom of the sidebar (it asks for a key). This page keeps allowlists and connection settings only.',
    '还没选。选一次以后就能在这里一键启动。': 'Not chosen yet. Pick it once and you can launch it from here with one click.',
    '看图（视觉 API）': 'Vision (image API)',
    '她收到图片时用它「看」图。任何 OpenAI 兼容的看图接口都行，随时换，不锁死一家。':
      'Used when she receives an image. Any OpenAI-compatible vision endpoint works — swap it anytime, no vendor lock-in.',
    允许发图给她看: 'Allow sending her images',
    '关掉就完全不调视觉接口，图片只当"[发来一张图片]"处理。':
      'When off, the vision API is never called and images are just treated as “[an image was sent]”.',
    '填到 /v1 就行，脚本自己补 /chat/completions。也可以直接填完整的 /chat/completions 地址。':
      'End it at /v1 and /chat/completions is appended automatically — a full /chat/completions URL also works.',
    '必须支持图片输入；文字模型塞图进去会报 400。':
      'Must support image input; text-only models return 400 when an image is attached.',
    '只存在本机设置里；换一家就把这三样一起换掉。': 'Stored only on this machine; switching providers means changing all three.',
    测一发: 'Send a test',
    '还没配置。填好地址、模型、Key，点「测一发」看看通不通。':
      'Not configured yet. Fill in URL, model and key, then hit “Send a test”.',
    '兼容示例：OpenAI、硅基流动、智谱 GLM-4V、通义千问 VL、Moonshot 视觉、本地 LM Studio / Ollama 的 OpenAI 兼容端点。':
      'Works with OpenAI, SiliconFlow, GLM-4V, Qwen-VL, Moonshot vision, and local LM Studio / Ollama OpenAI-compatible endpoints.',

    // ---------------- 通道：语音 ----------------
    '说话（语音 API）': 'Voice (speech API)',
    '偶尔把回复念出来、以语音发到 QQ。两种引擎二选一：OpenAI 兼容的 /audio/speech，或豆包（火山引擎）语音合成。':
      'Sometimes speaks a reply out and sends it to QQ. Pick one engine: OpenAI-compatible /audio/speech or Doubao (Volcano Engine) TTS.',
    说话引擎: 'Speech engine',
    '先选引擎，下面只显示这家要填的东西；两边的配置各存各的，换回来不用重填。':
      'Pick the engine first; only its fields show below. Both configs are kept separately, so switching back needs no re-typing.',
    'OpenAI 兼容：任何能发 /audio/speech 的服务都能接，地址填到 /v1 即可。':
      'OpenAI-compatible: any service with /audio/speech works; just point the URL at /v1.',
    'OpenAI 兼容': 'OpenAI-compatible',
    '豆包（火山引擎）': 'Doubao (Volcano Engine)',
    允许发语音: 'Allow voice replies',
    '关掉就只发文字，语音接口完全不会被调用。': 'When off, replies are text only and the speech API is never called.',
    '填到 /v1 就行，脚本自己补 /audio/speech。': 'End it at /v1 and /audio/speech is appended automatically.',
    'Text-to-Speech 模型，不是聊天模型。': 'A text-to-speech model, not a chat model.',
    音色: 'Voice',
    '服务方定义的音色名；留空就用服务方默认的。': 'Voice name defined by the provider; leave empty to use its default.',
    '只存在本机设置里，不外发。': 'Stored only on this machine; never sent anywhere else.',
    '豆包 APPID': 'Doubao APPID',
    '火山引擎控制台 → 语音合成 → 应用管理。': 'Volcano Engine console → Speech synthesis → App management.',
    '和 APPID 在同一页；只存在本机设置里。': "On the same page as the APPID; stored only on this machine.",
    '一般就是 volcano_tts，不用改。': 'Usually volcano_tts — no need to change.',
    '音色 voice_type': 'Voice (voice_type)',
    '例如 BV700_streaming，豆包音色列表里的编号。': 'e.g. BV700_streaming, the id from the Doubao voice list.',
    音频格式: 'Audio format',
    'QQ 语音用 mp3 最稳；合成失败会自动退回发文字。': 'mp3 is the safest for QQ voice; failed synthesis falls back to text.',
    回语音的概率: 'Chance of voice',
    '0 到 1。0.15 大约每六七句里有一次是语音；太长的句子自动改回文字。':
      '0 to 1. At 0.15 roughly one reply in six or seven is spoken; overly long replies fall back to text.',
    最多念几个字: 'Max characters spoken',
    '超过这个长度就不转语音了（省钱，也免得太长）。': 'Longer replies are not spoken (saves money, avoids rambling).',
    试听一句: 'Play a sample',
    '还没试过。填好后点「试听一句」，通了会直接播放。': 'Not tried yet. Fill it in and hit “Play a sample” — it plays if it works.',
    '还没配置：缺接口地址或模型名。': 'Not configured: the URL or model name is missing.',
    '常见接法：OpenAI（音色 alloy / nova / shimmer…）、硅基流动 CosyVoice、Fish Audio、本地 GPT-SoVITS 之类。':
      'Typical setups: OpenAI (alloy / nova / shimmer…), SiliconFlow CosyVoice, Fish Audio, local GPT-SoVITS, etc.',

    // ---------------- 通道：主动聊天 ----------------
    主动聊天: 'Proactive chat',
    '到点了就自己找你说句话。QQ 私聊和 B 站私信推荐共用这一套节奏和免打扰。':
      'She starts a conversation on her own schedule. QQ DMs and Bilibili DM picks share this rhythm and quiet hours.',
    '打开后，按下面的节奏主动发一句。': 'When on, she sends a line on the rhythm below.',
    '固定间隔 = 到点就发；概率曲线 = 隔得越久越可能发。QQ 和 B 站各按自己的「距上次开口」算。':
      'Fixed interval = send when due; probability curve = the longer the silence, the likelier she speaks. QQ and Bilibili each count from their own last message.',
    '横轴是「距上次开口多久」，纵轴是这一次开口的概率。越往右越可能开口，走到最右必说。':
      'X axis is time since she last spoke, Y axis is the chance of speaking now. Further right means likelier; at the far right she always does.',
    '最长间隔（分钟）': 'Max interval (minutes)',
    '（最多 23:59 = 1439）': '(max 23:59 = 1439)',
    恢复默认曲线: 'Reset curve',
    '每 10 分钟掷一次骰子。按现在这条曲线，一般 1 小时 30 分 前后会开口；到 12 小时 一定会说。双击空白加点，双击点删点，圆点可以直接拖。':
      'She rolls the dice every 10 minutes. On this curve she usually speaks around 1h30m, and always by 12h. Double-click empty space to add a point, double-click a point to delete it, drag dots to move them.',

    // ---------------- 通道：B 站 ----------------
    'Bilibili · 收到的私信': 'Bilibili · Incoming DMs',
    '读的是她这个小号的私信。别人回了她，她终于能看见了。': "Reads the DMs of her bot account, so she can finally see when someone replies.",
    未读会话: 'Unread conversations',
    '只列「最后一句是对方说的」，也就是真的在等回的人。': 'Only threads where the other side spoke last — the ones actually waiting for a reply.',
    收一下: 'Fetch',
    '点右边「收一下」拉取最近私信。': 'Hit “Fetch” on the right to pull recent DMs.',
    群聊分寸感: 'Group manners',
    '群里不是每句都该接。开着「只认 @」最安全；关掉之后她会看话题和冷场程度决定要不要插一句，也会自我限速。':
      'Not every group line deserves a reply. “Only when @-mentioned” is safest; with it off she judges topic and lull before chiming in, and rate-limits herself.',
    开启群聊: 'Enable in groups',
    '关着的话，群里 @ 她也不回。': 'When off, even an @mention gets no reply.',
    '只认 @': 'Only @mentions',
    '最保守：只有点名或 @ 才接。': 'Most conservative: reply only when named or @-mentioned.',
    只在这些群: 'Only these groups',
    '填群号，逗号分开；留空就不限制。': 'Group numbers, comma separated; empty means no limit.',
    '插话冷却（秒）': 'Cooldown (seconds)',
    '说完一句，至少隔多久才会再开口。': 'Minimum gap after she speaks before speaking again.',
    每分钟最多: 'Max per minute',
    '超过就闭嘴，不排队。': 'Beyond that she stays quiet; nothing is queued.',
    插话概率: 'Chime-in chance',
    '0~1。0.35 = 大概三成闲聊会接一句。': '0~1. At 0.35 she joins roughly a third of light chatter.',
    当前: 'Now',
    现在是关着的: 'Currently off',
    'Bilibili · 账号': 'Bilibili · Account',
    '这里登录的是「她」的小号（她用这个号发信）；收信的「你」在侧栏底部的「管理员」页里填。两个不是同一个号。':
      'The account signed in here is HER bot account (she sends from it); YOU, the recipient, are set on the Admin page at the bottom of the sidebar. They are different accounts.',
    '这里登录的是「她」的小号；收信的「你」在「管理员」页里填 —— 两个不是同一个号。':
      'The account signed in here is HER bot account; YOU, the recipient, are set on the Admin page — two different accounts.',
    还没登录: 'Not signed in',
    '还没登录（扫码或填 Cookie 后点「体检」）': 'Not signed in (scan the QR code or paste cookies, then hit Check)',
    '还没登录。点「扫码登录」最快，或者把 SESSDATA / bili_jct 粘进来。':
      'Not signed in. “Scan to sign in” is fastest, or paste SESSDATA / bili_jct.',
    'Bilibili · 养成': 'Bilibili · Nurture',
    '节奏和免打扰跟「通用 → 主动聊天」共用一套（总开关也在那儿）；同一个视频 7 天不重复。':
      'Rhythm and quiet hours are shared with General → Proactive chat (the master switch lives there); the same video never repeats within 7 days.',
    想看的标签: 'Tags to prefer',
    '命中这些词的优先推；一个都没命中就退回全部。逗号隔开。': 'Matches get pushed first; if nothing matches she falls back to everything. Comma separated.',
    不看的标签: 'Tags to avoid',
    '标题、分区、简介、作者里命中就不推。逗号隔开。': 'Skipped when the title, section, description or uploader matches. Comma separated.',
    '她自己的 QQ（插件）': 'Her own QQ (plugin)',
    '插件 qq-identity：让她能改自己的头像 / 昵称 / 签名、发 QQ 空间。下面填「谁能指挥她」。':
      'Plugin qq-identity lets her change her own avatar / nickname / signature and post to QQ Zone. Below: who may command her.',
    '白名单（谁可以让她改）': 'Allowlist (who may make her change it)',
    '填 QQ 号，用逗号或换行分开。管理员 QQ 永远可以用；这里留空 = 只有管理员能。':
      'QQ numbers, comma or newline separated. The owner QQ always works; empty means owner only.',
    现在发一条说说: 'Post something to QQ Zone',
    '写好点下面「发这条说说」。不用开浏览器、不用登录，用的是她自己的 QQ 登录态。':
      'Write it and hit “Post this” below. No browser and no login needed — it uses her own QQ session.',
    '最近一次：还没试过。': 'Last run: not tried yet.',
    发这条说说: 'Post this',
    试试能不能用: 'Check it works',
    看看她现在的资料: 'Show her current profile',
    '自检（改回原名）': 'Self-test (restore original name)',
    清空最近记录: 'Clear log',
    '她自己的 B 站（插件）': 'Her own Bilibili (plugin)',
    '插件 bili-actions：关注/拉黑 UP、改名字和简介、点赞投币。说人话也行，听不懂她会去问模型。':
      'Plugin bili-actions: follow/block creators, edit name and bio, like and coin. Plain language works — if she does not get it she asks the model.',
    '在这里试一句话': 'Try a sentence here',
    '说人话就行：把我关注一下那个 12345678 / 给 BV1chxT6xEyo 点个赞 / 名字改成鲸鱼娘':
      'Just say it: follow 12345678 / like BV1chxT6xEyo / change my name to Whale Girl',
    '白名单（谁可以让她动 B 站）': 'Allowlist (who may drive her Bilibili)',
    '还没动过手。': 'Nothing done yet.',
    '自检（写一次原名）': 'Self-test (write the original name once)',
    跑一下这条: 'Run this',
    她会哪些命令: 'What she can do',
  });

  RULES.push(
    [/^QQ 未连接 · (\d+) 个会话 \/ (\d+) 条消息$/, 'QQ offline · $1 conversations / $2 messages'],
    [/^QQ 在线 · (\d+) 个会话 \/ (\d+) 条消息$/, 'QQ online · $1 conversations / $2 messages'],
    [/^共 (\d+) 张 · (\d+) 个分组$/, '$1 stickers · $2 groups'],
  );

  if (window.EN && window.EN.refresh) window.EN.refresh();
})();
