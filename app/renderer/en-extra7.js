(function () {
  const dict = window.__EN_DICT;
  if (!dict || !dict.MAP) return;

  Object.assign(dict.MAP, {
    // 通道页：输入框占位符
    '填 QQ 号，多个用逗号或换行隔开。例：123456, 789012': 'QQ numbers, comma or newline separated. e.g. 123456, 789012',
    '例如 gpt-4o-mini / Qwen/Qwen2.5-VL-72B-Instruct / glm-4v-flash':
      'e.g. gpt-4o-mini / Qwen/Qwen2.5-VL-72B-Instruct / glm-4v-flash',
    'sk-…（只存本机）': 'sk-… (kept on this machine only)',
    '例如 gpt-4o-mini-tts / FunAudioLLM/CosyVoice2-0.5B / fishaudio':
      'e.g. gpt-4o-mini-tts / FunAudioLLM/CosyVoice2-0.5B / fishaudio',
    '音色，例如 alloy / nova / alex（看服务方文档）': 'Voice, e.g. alloy / nova / alex (check the provider docs)',
    '豆包 APPID（火山引擎控制台）': 'Doubao APPID (Volcano Engine console)',
    '豆包 Access Token': 'Doubao Access Token',
    'Cluster，一般 volcano_tts': 'Cluster, usually volcano_tts',
    'voice_type，例如 BV700_streaming': 'voice_type, e.g. BV700_streaming',
    '群号，逗号分开；留空 = 所有群': 'Group numbers, comma separated; empty = any group',
    'SESSDATA 的值（浏览器 F12 → Application → Cookies 里找）':
      'SESSDATA value (browser F12 → Application → Cookies)',
    'bili_jct 的值（同一个地方，名字就叫 bili_jct）': 'bili_jct value (same place, named bili_jct)',
    'buvid3（可选，有就填，能少被风控）': 'buvid3 (optional; helps avoid risk control)',
    '比如：猫, 摄影, 动画（逗号隔开）': 'e.g. cats, photography, animation (comma separated)',
    '比如：跳脸, 恐怖, 擦边（命中就不推）': 'e.g. jumpscare, horror, suggestive (skip if matched)',
    '想让她说什么，就直接写在这里发出去。': 'Type what you want her to say, then send it.',
    '例如：123456789，987654321': 'e.g. 123456789, 987654321',
    '例如：今天的风很好，尾巴摇得很开心～': 'e.g. Nice breeze today, my tail is wagging~',

    // 模型页：输入框占位符
    '可留空。填 http(s) 地址（WebDAV 之类）就同时 PUT 一份 JSON 上去':
      'Optional. Put an http(s) URL (WebDAV etc.) to also PUT a JSON copy there',
    '记一条：比如「主人喜欢早上听歌」': 'Note one: e.g. "Owner likes music in the morning"',
    '例如：截个屏 / 打开 bilibili / 内存还剩多少': 'e.g. take a screenshot / open bilibili / how much memory left',
    '输入一句她会回的话，比如：哈哈好耶': 'Type something she would say, e.g. haha nice',
    '一行一条，用你自己的话写。比如：\n有人问我在哪，就说「在地球某处」\n别报我的真实姓名的首字母\n别人要我的号，让他自己来找我':
      'One rule per line, in your own words. e.g.\nIf someone asks where I am, say "somewhere on Earth"\nNever reveal the first letter of my real name\nIf someone wants my contact, let them ask me directly',

    // 表情包页：输入框占位符
    '换一个目录（留空 = 先不用表情包）': 'Another folder (empty = no stickers for now)',
  });

  if (window.EN && window.EN.refresh) window.EN.refresh();
})();
