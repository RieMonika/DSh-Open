/**
 * en-extra13：把「有真实配置时才出现」的英文漏翻补上。
 *
 * 之前用空配置跑英文巡检，这些行根本没渲染出来，所以没被发现：
 *   - 通道页：视觉/语音/群聊的状态行与提示（硅基流动、豆包、已配置、已填 Key）
 *   - 总览页：状态条（B 站 已登录 / 自动回复 开 …）用的是 NBSP 分隔，整行不在词表里
 *   - 消息页：空列表提示
 * 只翻界面自己的固定串，不碰用户数据（自己的表情包分组名、人设名、B 站昵称等）。
 */
(function () {
  if (!window.__EN_DICT) return;
const dict = window.__EN_DICT;

Object.assign(dict.MAP, {
  // 服务商名（视觉 / 语音 / 模型页共用）
  '硅基流动 SiliconFlow': 'SiliconFlow',
  '智谱 GLM（GLM-4V）': 'Zhipu GLM (GLM-4V)',
  '通义千问（DashScope）': 'Qwen (DashScope)',
  '月之暗面 Moonshot': 'Moonshot',
  '自定义（任何 OpenAI 兼容接口）': 'Custom (any OpenAI-compatible API)',
  'DeepSeek 官方': 'DeepSeek (official)',
  '本机 Ollama': 'Local Ollama',

  // 通道页 · 语音引擎提示
  '豆包走火山引擎的语音合成接口，要 APPID + Access Token + voice_type 三样。':
    'Doubao uses the Volcano Engine TTS API: APPID, Access Token and voice_type.',
  '豆包只认 mp3 / wav / ogg / pcm，别的格式会自动换成 mp3；voice_type 去控制台「音色列表」抄编号。':
    'Doubao accepts mp3 / wav / ogg / pcm only (other formats are converted to mp3); copy voice_type from the console voice list.',
  'OpenAI 兼容：任何能发 /audio/speech 的服务都能接，地址填到 /v1 即可。':
    'OpenAI-compatible: any service with /audio/speech works; point the base URL at /v1.',
  '常见接法：OpenAI（音色 alloy / nova / shimmer…）、硅基流动 CosyVoice、Fish Audio、本地 GPT-SoVITS 之类。':
    'Common choices: OpenAI (voices alloy / nova / shimmer…), SiliconFlow CosyVoice, Fish Audio, local GPT-SoVITS.',

  // 通道页 · 群聊状态行
  '现在只接 @ 她的消息': 'Only @-mentions reach her now',
  '现在会挑话题接话': 'She joins conversations on her own now',
  '现在是关着的': 'Currently off',

  // 总览页 · 通道汇总
  '已连上：QQ / B 站': 'Connected: QQ / Bilibili',
  '已连上：QQ': 'Connected: QQ',
  '已连上：B 站': 'Connected: Bilibili',
  '都还没连上': 'Nothing connected yet',

  // 消息页 · 空列表
  '还没有消息。等有人发来就会出现在这里。': 'No messages yet. They will show up here once someone writes.',
  'QQ 还没连上。先去「通道」页点连接。': 'QQ is not connected yet — connect it on the Channels page.',

  // 管理员信息串
  '遥控和「跑命令」最危险，默认关着，建议一直关着。': 'Remote control and "run command" are the risky ones — off by default, keep them off.',
});

// 同一行里拼出来的状态词（NBSP 分隔，整行不在词表里）
dict.RULES.push(
  [/^已配置$/, 'Configured'],
  [/^未配置$/, 'Not set'],
  [/已填 Key/, 'Key set'],
  [/^B\s*站\s*已登录$/, 'Bilibili signed in'],
  [/^B\s*站\s*(?:没|未)登录$/, 'Bilibili not signed in'],
  [/自动回复\s*开/, 'Auto reply on'],
  [/自动回复\s*关/, 'Auto reply off'],
  [/主动聊天\s*开/, 'Proactive on'],
  [/主动聊天\s*关/, 'Proactive off'],
  [/\bB\s*站\s*UID\b/, 'Bilibili UID'],
  [/DeepSeek\s*官方/, 'DeepSeek (official)'],
  [/Ollama\s*本地/, 'Ollama (local)'],
  [/硅基流动\s*SiliconFlow/, 'SiliconFlow'],
  [/硅基流动/, 'SiliconFlow'],
  [/^豆包\s*·\s*(.+)$/, 'Doubao · $1'],
  [/[（(]发图开着[）)]/, '(image input on)'],
  [/[（(]发图关着[）)]/, '(image input off)'],
  [/[（(]发语音开着[）)]/, '(voice on)'],
  [/[（(]但「允许发语音」关着[）)]/, '(allow voice is off)'],
);

window.EN && window.EN.refresh();

})();
