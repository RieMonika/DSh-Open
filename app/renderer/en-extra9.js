/* 英文补充 9：视觉 API 改成「先选服务商」以后新增的文案
 * ------------------------------------------------------------
 * en.js 负责整页翻译，这里只把这一批新出现的句子按原文对上英文。
 * 键必须和代码里的中文一字不差（en.js 是整段匹配，不做模糊）。
 */
(function () {
  if (!window.__EN_DICT) return;
  const dict = window.__EN_DICT;

  Object.assign(dict.MAP, {
    '视觉服务商': 'Vision provider',
    '换一家只改这一组，别家的值各存各的。': 'Switching only touches this group; other providers keep their own values.',
    '一般按预设填好，换自建服务时才改；填到 /v1 就行。': 'Pre-filled from the preset. Only edit it for self-hosted endpoints; /v1 is enough.',
    '必须支持图片输入；文字模型塞图进去会报 400。': 'It must accept images; a text-only model returns 400.',
    '模型名，例如 Qwen/Qwen2.5-VL-72B-Instruct': 'Model name, e.g. Qwen/Qwen2.5-VL-72B-Instruct',

    '硅基流动 SiliconFlow': 'SiliconFlow',
    '智谱 GLM（GLM-4V）': 'Zhipu GLM (GLM-4V)',
    '通义千问（DashScope）': 'Qwen (DashScope)',
    '月之暗面 Moonshot': 'Moonshot',
    '自定义（任何 OpenAI 兼容接口）': 'Custom (any OpenAI-compatible endpoint)',
    '其他（自己填模型名）': 'Other (type the model name)',

    '去哪拿：控制台 → API 密钥，形如 sk-…': 'Where: console → API Keys, looks like sk-…',
    '去哪拿：API Keys 页面，形如 xxxx.yyyy': 'Where: the API Keys page, looks like xxxx.yyyy',
    '去哪拿：百炼控制台 → API-KEY，形如 sk-…': 'Where: Bailian console → API-KEY, looks like sk-…',
    '去哪拿：控制台 → API Key，形如 sk-…': 'Where: console → API Key, looks like sk-…',
    '去哪拿：platform.openai.com → API keys': 'Where: platform.openai.com → API keys',
    '去哪拿：按你自己服务的要求填': 'Where: whatever your own endpoint requires',

    '还没试过。选好服务商、填上密钥，点「测一发」看看通不通。': 'Not tested yet. Pick a provider, paste the key, then hit Test.',
    '已保存，但还差一点东西（看下面那行状态）': 'Saved, but something is still missing (see the status line).',
    '还没配置：选一家、填上密钥就行。': 'Not configured yet: pick a provider and paste its key.',
    '内置服务商只是现成预设；本地 LM Studio / Ollama、公司内网等其他兼容端点选「自定义」填地址即可。':
      'Built-in providers are just presets. For local LM Studio / Ollama or an intranet endpoint, choose Custom and fill in the address.',
    '视觉 API 设置已保存': 'Vision API settings saved',
    '她收到图片时用它「看」图。先选一家，只填这一家要填的；任何 OpenAI 兼容的看图接口都能接。':
      'Used to look at pictures she receives. Pick a provider first; only its fields show up. Any OpenAI-compatible vision endpoint works.',
  });

  // 状态行是拼出来的：「已配置：硅基流动 SiliconFlow · Qwen/… （发图开着）」
  dict.RULES.push([
    /^已配置：(.+?) · (.+?)（发图(开着|关着)）$/,
    (m) => `Configured: ${m[1]} · ${m[2]} (image input ${m[3] === '开着' ? 'on' : 'off'})`,
  ]);
  dict.RULES.push([/^去哪拿：(.+)$/, (m) => `Where: ${m[1]}`]);

  if (window.EN && window.EN.refresh) window.EN.refresh();
})();
