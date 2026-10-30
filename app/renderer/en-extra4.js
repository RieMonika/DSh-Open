/*
 * 英文翻译层（第四批：能力说明页 + 各页零碎长尾巴）
 */
(function () {
  'use strict';
  const dict = window.__EN_DICT;
  if (!dict) return;
  const MAP = dict.MAP;
  const RULES = dict.RULES;

  Object.assign(MAP, {
    // ---------------- 零碎 ----------------
    '本机 Ollama（免费）': 'local Ollama (free)',
    游戏: 'Game',
    期待: 'Hoping',
    害怕: 'Scared',
    道别: 'Goodbye',
    礼物: 'Gift',
    '放松下来 —— 说话方式：说话随意，会撒娇': 'Relaxed — talks casually, a little clingy',
    '晚上（20 点）': 'Evening (8pm)',
    '（还没写说明）': '(no notes yet)',
    当前管理员: 'Current owner',
    '（还没填管理员 QQ）': '(owner QQ not set yet)',

    // ---------------- 能力说明 ----------------
    '老实写清楚，免得你以为它能做到其实做不到。每条说明都能自己改。':
      'Straight facts, so you never expect something it cannot do. Every note here is editable.',
    '连上 QQ（走 NapCat / OneBot）': 'Connect QQ (via NapCat / OneBot)',
    'NapCat 登录 QQ 后开正向 WebSocket（默认 3001），本软件连上去就能收发。':
      'After NapCat signs in, enable a forward WebSocket (default 3001) and this app connects to send and receive.',
    '只和你指定的 QQ 号互动': 'Only talk to QQ numbers you allow',
    '白名单之外的人发消息，只记录不回复。名单在「通道 → 只和谁互动」里填。':
      'Messages from outside the allowlist are logged but never answered. The list lives in Channels → Who may talk.',
    '自动回复（私聊 / 群）': 'Auto reply (DMs / groups)',
    '用当前人格 + 记忆 + 最近几句上下文来回复，可配一张表情。':
      'Replies with the current persona, memories and recent context, optionally with a sticker.',
    '主动找你说话': 'Starts conversations',
    '按设定间隔，挑最久没聊的人，主动发一句。有免打扰时段。':
      'On the configured rhythm she picks the person she last spoke to longest ago and says something. Quiet hours apply.',
    '互动会成长（等级 / 经验）': 'Interaction grows her (level / XP)',
    '每聊一句涨经验，等级越高需要的经验越多。数据存本机。':
      'Every message earns XP; higher levels need more. Stored locally.',
    发表情包: 'Send stickers',
    '从本机表情包目录按情绪挑一张，用 CQ 码发出去。':
      'Picks a sticker from the local folder by mood and sends it as a CQ code.',
    '表情包管理（分组 / 收藏 / 回收站）': 'Sticker manager (groups / favorites / trash)',
    '表情包页点「管理」进多选，可以批量改分组、收藏、移到回收站；单张点开也能改分组。手动改的标签单独存，重扫不丢。':
      'Hit Manage on the Stickers page for multi-select: re-file, favorite or trash in bulk; single stickers can be re-filed too. Manual tags are stored apart and survive rescans.',
    '不刷屏（节流 + 打字停顿）': 'No spam (throttle + typing pause)',
    '同一会话最快 20 秒回一条，冷却里的消息合并成一条；每分钟最多 4 条，超了直接不说。回之前先"打一会儿字"。':
      'At most one reply every 20 seconds per conversation (messages in cooldown are merged); max 4 per minute, after which she stays quiet. She “types” for a moment before replying.',
    '打开后群里只有 @ 她才会接话，别人聊天不理。在「通道 → 自动回复」里改。':
      'When on, she only replies in groups to @mentions and ignores the rest. Change it in Channels → Auto reply.',
    '关系和好感度（会变语气）': 'Bond and affinity (changes her tone)',
    '好感 0~100，分陌生/眼熟/朋友/要好/亲密五档，直接影响她说话的温度；每天还有一个心情。':
      'Affinity 0–100 in five bands (stranger / familiar / friend / close / intimate) directly colors her tone; she also has a mood each day.',
    '每轮聊完让本地小模型（qwen2.5:0.5b）挑一句值得长期记住的事，写进记忆。不联网、不额外花钱。':
      'After each chat a small local model (qwen2.5:0.5b) picks one thing worth keeping and writes it to memory — offline and free.',
    '不连 QQ 也能和模型聊': 'Chat without QQ',
    '左侧「对话」页：不经过 QQ，直接跟她说。人设、记忆、关系、成长、表情全走同一套，用来验证「脑子」是活的。':
      'The Chat page talks to her without QQ. Persona, memory, bond, growth and stickers all use the same path — handy for checking the brain works.',
    '直接发 QQ 空间': 'Post to QQ Zone',
    '读 B 站数据（热门 / UP 投稿）': 'Read Bilibili data (popular / uploads)',
    '公开接口，不需要登录，就能拉到视频标题、BV 号、UP 名字。':
      'Public API: no sign-in needed to fetch titles, BV ids and uploader names.',
    '给你推荐视频（含 BV 号）': 'Recommend videos (with BV ids)',
    '拉热门视频拼成人话，可以一键发到 QQ。': 'Turns popular videos into a plain-language message, sendable to QQ in one click.',
    '只和你指定的 B 站账号互动': 'Only interact with your Bilibili account',
    '填了你的 uid / 昵称，推荐和消息只认这个号。': 'With your uid / nickname set, recommendations and messages only go to that account.',
    '往 B 站私信发消息': 'Send Bilibili DMs',
    '小号登录后能发；前提是互相关注，正文 ≤300 字，一天只锁一个收信人。':
      'Works once the bot account is signed in; the two accounts must follow each other, body ≤300 chars, one recipient per day.',
    '自己刷视频、隔一会儿私信推荐给你': 'She browses and DMs you picks',
    '开了以后她按间隔挑一个没推过的视频，用人设写一句再发；只在 09:00–23:00 发。':
      'When on she picks an unshared video on schedule, writes one line in character and sends it — only between 09:00 and 23:00.',
    '登录 B 站小号（填 Cookie）': 'Sign in her Bilibili account (cookies)',
    '在「通道 → B 站账号」里填 SESSDATA + bili_jct，点「体检」能看到登录号、互关状态。扫码登录还没做。':
      'Fill SESSDATA + bili_jct in Channels → Bilibili account and hit Check to see the signed-in account and mutual-follow state. QR sign-in is not built yet.',
    '模型 / 人格': 'Model / persona',
    '用本机 Ollama 跑模型': 'Run models locally with Ollama',
    '默认 qwen2.5:7b，不走云端、不要 Key。': 'Defaults to qwen2.5:7b — no cloud, no key.',
    '用云 API（硅基流动等）': 'Use a cloud API (SiliconFlow etc.)',
    '填 Key 就能用，任何 OpenAI 兼容接口都行。': 'Add a key and any OpenAI-compatible endpoint works.',
    '作息（有自己的时间感）': 'Daily rhythm (she knows the time)',
    '人格管理（可改可建）': 'Persona manager (edit or create)',
    '内置几套人格，也能自己写系统提示词、说话风格、禁止行为。':
      'Several built-in personas; you can also write your own system prompt, style and taboos.',
    '长期记忆（存在本机）': 'Long-term memory (local)',
    '记下来的事存本地数据库，永远不会上传。': 'Remembered facts live in the local database and are never uploaded.',
    '按意思找记忆（向量检索）': 'Search memories by meaning (vectors)',
    '「模型 → 记忆 → 记忆方式」选 Ollama（nomic-embed-text）或硅基流动；老记忆点「补算向量」。之后问「他爱喝什么」也能找到「喜欢热牛奶」。':
      'Pick Ollama (nomic-embed-text) or SiliconFlow under Model → Memory → Memory mode, and backfill vectors for old entries. Then “what does he like to drink” finds “likes warm milk”.',
    '线索召回（省 token）': 'Clue-based recall (saves tokens)',
  });

  RULES.push(
    [/^Bilibili\s*·\s*收到的私信$/, 'Bilibili · Incoming DMs'],
    [/^B 站\s*·\s*账号$/, 'Bilibili · Account'],
    [/^B 站\s*·\s*养成$/, 'Bilibili · Nurture'],
    [/^能做的事：[\s\S]*$/, ''],
    [/^Months: 还没有\s*·\s*约\s*(\d+)\s*条\s*·\s*(\d+) MB$/, 'Months: none yet · about $1 entries · $2 MB'],
    [/^Her state\s*·\s*晚上（20 点）$/, 'Her state · Evening (8pm)'],
    [/^QQ 未连接\s*·\s*(\d+) 个会话 \/ (\d+) 条消息$/, 'QQ offline · $1 conversations / $2 messages'],
  );

  if (window.EN && window.EN.refresh) window.EN.refresh();
})();
