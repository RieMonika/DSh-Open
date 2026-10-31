'use strict';

/**
 * 教程页
 * ------------------------------------------------------------
 * 写给「第一次下载、什么都不装、电脑不太熟」的人：
 *   先给结论（不装 NapCat / 不用 QQ 也能先聊）
 *   再给三条路（本机最快 / QQ / 全套）
 *   然后把「最坏情况」摊开：双击没反应、被杀软拦、装不上 NapCat……
 *   最后才是按模块的详细步骤 + 常见问题
 * 本页文案自带中英两套（不用 en-extra 的整句映射），
 * 语言在「设置 → 界面语言」切换后 app.js 会整页重绘，这里跟着重算。
 */

(function () {
  const PAGES = (window.DSHPages = window.DSHPages || {});

  // 文案对：[中文, English]
  const S = (zh, en) => [zh, en];

  function langIsEn() {
    const l = String((window.I18N && window.I18N.get && window.I18N.get()) || 'zh-CN');
    return l.toLowerCase().indexOf('en') === 0;
  }

  // ---------------------------------------------------------------------
  // 真实状态：进页面时并发读一遍，给每一步/每条路打「已完成 / 待设置」
  // ---------------------------------------------------------------------
  async function readState(ctx) {
    const d = ctx.dsh;
    const pick = (fn, fallback) =>
      Promise.resolve()
        .then(fn)
        .then((v) => (v === undefined ? fallback : v))
        .catch(() => fallback);

    const [admin, key, qq, bili, model, auto, guard, voice, remote, pro, mem, stk, info] = await Promise.all([
      pick(() => d.admin.info(), null),
      pick(() => d.admin.keyStatus(), null),
      pick(() => d.qq.status(), null),
      pick(() => d.bili.status(), null),
      pick(() => d.model.overview(), null),
      pick(() => d.autoreply.config(), null),
      pick(() => d.guard.config(), null),
      pick(() => d.voice.config(), null),
      pick(() => d.remote.config(), null),
      pick(() => d.proactive.config(), null),
      pick(() => d.memory.stats(), null),
      pick(() => d.stickers.stats(), null),
      pick(() => d.info(), null),
    ]);

    return { admin, key, qq, bili, model, auto, guard, voice, remote, pro, mem, stk, info };
  }

  const qqOnline = (s) => !!(s.qq && s.qq.status === 'online');
  const ownerQq = (s) => String((s.admin && s.admin.qq) || '');
  const biliUid = (s) => String((s.admin && s.admin.biliUid) || (s.bili && s.bili.uid) || '');

  function modelReady(s) {
    const ov = s.model || {};
    const active = String(ov.active || '');
    if (!active) return false;
    if (active === 'ollama') return true;
    const p = (ov.providers && ov.providers[active]) || {};
    return !!(p.hasKey || p.apiKey || p.configured);
  }

  // 每个模块的状态：{ text: S(), done: bool } 或 null（参考类模块不显示）
  function statusOf(id, s) {
    switch (id) {
      case 'admin':
        if (!ownerQq(s)) return { text: S('还没认主人', 'Owner not set'), done: false };
        if (s.key && s.key.hasKey === false) return { text: S('还差进入密钥', 'Key not set'), done: false };
        return { text: S('已认主人', 'Owner set'), done: true };
      case 'qq':
        return qqOnline(s)
          ? { text: S('QQ 在线', 'QQ online'), done: true }
          : { text: S('QQ 没连上', 'QQ offline'), done: false };
      case 'bili':
        return biliUid(s)
          ? { text: S('B 站已登录', 'Bilibili signed in'), done: true }
          : { text: S('B 站没登录', 'Bilibili not signed in'), done: false };
      case 'model': {
        const ov = s.model || {};
        const active = String(ov.active || '');
        if (!active) return { text: S('还没选模型', 'No model yet'), done: false };
        if (active === 'ollama') return { text: S('用本机 Ollama', 'Using local Ollama'), done: true };
        if (modelReady(s)) return { text: S('用云端模型', 'Using cloud model'), done: true };
        return { text: S('云端还差 Key', 'Cloud key missing'), done: false };
      }
      case 'reply':
        return s.auto && s.auto.enabled
          ? { text: S('自动回复已开', 'Auto reply on'), done: true }
          : { text: S('自动回复关着', 'Auto reply off'), done: false };
      case 'memory': {
        const n = (s.mem && s.mem.count) || 0;
        return n > 0
          ? { text: S('已有 ' + n + ' 条记忆', n + ' memories stored'), done: true }
          : { text: S('还没有记忆', 'No memories yet'), done: false };
      }
      case 'stickers': {
        const n = (s.stk && s.stk.total) || 0;
        return n > 0
          ? { text: S(n + ' 张表情', n + ' stickers'), done: true }
          : { text: S('还没放表情', 'No stickers yet'), done: false };
      }
      case 'voice':
        return s.voice && s.voice.enabled
          ? { text: S('语音开着', 'Voice on'), done: true }
          : { text: S('语音关着', 'Voice off'), done: false };
      case 'remote':
        return s.remote && s.remote.enabled
          ? { text: S('遥控已开', 'Remote on'), done: true }
          : { text: S('遥控关着', 'Remote off'), done: false };
      case 'proactive':
        return s.pro && s.pro.enabled
          ? { text: S('主动聊天已开', 'Proactive on'), done: true }
          : { text: S('主动聊天关着', 'Proactive off'), done: false };
      case 'guard':
        return s.guard && s.guard.enabled
          ? { text: S('护栏已生效', 'Guard on'), done: true }
          : { text: S('护栏关着', 'Guard off'), done: false };
      default:
        return null;
    }
  }

  // ---------------------------------------------------------------------
  // 三条路：第一次用的人先选一条
  // ---------------------------------------------------------------------
  const PATHS = [
    {
      key: 'A',
      title: S('A · 先在本机聊起来（最快）', 'A · Chat on this PC first (fastest)'),
      desc: S(
        '只需要一个模型。不需要 QQ、不需要 NapCat、不用扫码、不用填 QQ 号。',
        'All you need is one model. No QQ, no NapCat, no QR code, no QQ number.'
      ),
      note: S(
        '装不了 Ollama 就填云端 Key；两样都没有，软件也能打开，只是聊天时会提示你去配。',
        'No Ollama? Use a cloud key. Neither? The app still opens — chat just asks you to set one up.'
      ),
      status: (s) => statusOf('model', s),
      btn: S('去「模型」', 'Open Model'),
      page: 'model',
      btn2: S('去「对话」', 'Open Chat'),
      page2: 'chat',
    },
    {
      key: 'B',
      title: S('B · 在 QQ 里聊', 'B · Chat inside QQ'),
      desc: S(
        '需要两个东西：一个能登录的 QQ（建议小号）+ NapCat（第三方协议端，跟本软件是两回事）。',
        'Two things needed: a QQ account you can log in with (a spare one is safer) + NapCat (a third-party protocol bridge, not part of this app).'
      ),
      note: S(
        '装不上不会拖累 A 条：QQ 只是多一个入口。',
        'If it fails, path A still works — QQ is just one more doorway.'
      ),
      status: (s) => statusOf('qq', s),
      btn: S('去「通道 → QQ」', 'Open Channels → QQ'),
      page: 'channels',
    },
    {
      key: 'C',
      title: S('C · 全套：B 站 / 桌宠 / 语音 / 遥控', 'C · Everything: Bilibili / pet / voice / remote'),
      desc: S(
        '这些都可以以后再开，一个都不影响前面两条。想先玩哪个就开哪个。',
        'Open these whenever you like. None of them is required for chat.'
      ),
      note: S(
        '遥控和「跑命令」最危险，默认关着，建议一直关着。',
        'Remote control and "run commands" are the riskiest switches. They are off by default — keep them that way.'
      ),
      status: (s) => statusOf('bili', s),
      btn: S('去「通道」', 'Open Channels'),
      page: 'channels',
    },
  ];

  // ---------------------------------------------------------------------
  // 四步上手（顺序按「最快能聊上」排）
  // ---------------------------------------------------------------------
  const QUICK = [
    {
      n: '1',
      title: S('选一个「脑子」', 'Pick a brain'),
      desc: S(
        '装过 Ollama 就直接用（免费、断网也能聊）；没有就填一个云端 Key。这一步跟 QQ 无关。',
        'Already have Ollama? Use it — free and works offline. Otherwise paste a cloud key. This step has nothing to do with QQ.'
      ),
      page: 'model',
      btn: S('去「模型」', 'Open Model'),
      done: (s) => modelReady(s),
    },
    {
      n: '2',
      title: S('说第一句', 'Say the first line'),
      desc: S(
        '打开「对话」直接打字，不经过任何平台。她回了，说明软件本体是好的。',
        'Open Chat and type. Nothing goes through QQ or Bilibili. If she answers, the app itself works.'
      ),
      page: 'chat',
      btn: S('去「对话」', 'Open Chat'),
      done: () => false,
      noDone: true,
    },
    {
      n: '3',
      title: S('认主人', 'Introduce the owner'),
      desc: S(
        '填你的 QQ 号和一把进入密钥。没填之前，谁跟她说话都当外人。',
        'Enter your QQ number and an admin key. Until then everyone is treated as a stranger.'
      ),
      page: 'admin',
      btn: S('去「管理员」', 'Open Admin'),
      done: (s) => !!ownerQq(s),
    },
    {
      n: '4',
      title: S('接通道', 'Connect a channel'),
      desc: S(
        'QQ 走 NapCat、B 站扫码。接哪个都行，接不上就继续用「对话」。',
        'QQ goes through NapCat; Bilibili is a QR scan. Either one is enough — if both fail, keep using Chat.'
      ),
      page: 'channels',
      btn: S('去「通道」', 'Open Channels'),
      done: (s) => qqOnline(s) || !!biliUid(s),
    },
  ];

  // ---------------------------------------------------------------------
  // 最坏情况：现象 → 这么办 → 都不行时还能用什么
  // ---------------------------------------------------------------------
  const WORST = [
    {
      what: S('双击没反应，或者黑框一闪就没了', 'Double-click does nothing, or a black window flashes and disappears'),
      fix: S(
        '双击文件夹里的「启动.bat」，不要直接双击 exe；整个文件夹放在 D 盘的普通位置（别放 Program Files、别在压缩包里直接运行、路径别太长）。',
        'Double-click 启动.bat (the launcher), not the exe; keep the folder somewhere plain on the D drive — not Program Files, not inside a zip, and keep the path short.'
      ),
      keep: S(
        '还是没窗口：看「设置 → 数据位置 → 日志目录」里最新的日志，最后几行会写原因。',
        'Still no window: open Settings → Data location → Logs and read the last lines of the newest log.'
      ),
    },
    {
      what: S('Windows 弹「已保护你的电脑」/ 杀毒软件报警', 'Windows SmartScreen or antivirus warns about the app'),
      fix: S(
        '这是未签名程序的常规提示，不是中毒。点「更多信息」→「仍要运行」；或者把文件夹加进杀毒软件白名单。',
        'That is the normal warning for unsigned software, not a virus. Click "More info" → "Run anyway", or whitelist the folder in your antivirus.'
      ),
      keep: S(
        '只从 GitHub Releases 下载，别用第三方网站二次打包的版本。',
        'Only download from GitHub Releases — never a third-party repack.'
      ),
    },
    {
      what: S('电脑里没装 Ollama', 'Ollama is not installed'),
      fix: S(
        '两条路：装 Ollama（官网下 Windows 安装包，命令行执行 ollama pull qwen2.5:7b，约 5 GB 磁盘）；或者用云端 Key（DeepSeek / 硅基流动，注册后到「模型 → 配置」里填）。',
        'Two options: install Ollama (Windows installer, then run ollama pull qwen2.5:7b — about 5 GB of disk), or use a cloud key (DeepSeek / SiliconFLOW — sign up, then Model → Configure).'
      ),
      keep: S(
        '两个都不想弄：界面、桌宠、表情包、B 站照样能玩，只是聊不了天。',
        'Neither? The UI, pet, stickers and Bilibili still work — only chatting is unavailable.'
      ),
    },
    {
      what: S('没有 API Key，也不想注册', 'No API key and no wish to sign up'),
      fix: S(
        '云端模型都要 Key。可以先只把软件当「桌面小女仆」玩：桌宠、表情包、界面都能用，聊天等以后再说。',
        'All cloud models need a key. You can still enjoy the app as a desktop companion: pet, stickers and the UI all work; chat can wait.'
      ),
      keep: S('以后想聊了，随时回来配模型，不用重装。', 'When you want to chat later, just configure a model — no reinstall needed.'),
    },
    {
      what: S('装不上 NapCat，或者 QQ 版本太新', 'NapCat will not install, or QQ is too new'),
      fix: S(
        'NapCat 只支持部分 QQ（NT 版）版本：先确认 QQ 版本，对不上就换 NapCat 新版或降 QQ。然后在 NapCat 里开「正向 WebSocket」端口 3001，回软件「通道 → QQ」点「连接」。',
        'NapCat only supports certain QQ (NT) builds. Check your QQ version; if it does not match, update NapCat or downgrade QQ. Then enable "forward WebSocket" on port 3001 in NapCat and click Connect in Channels → QQ.'
      ),
      keep: S(
        '实在装不上就整块跳过 QQ：用「对话」页，或 B 站私信，其它功能一点不受影响。',
        'If it truly will not work, skip QQ entirely: use Chat or Bilibili DMs. Nothing else breaks.'
      ),
    },
    {
      what: S('没有 QQ 小号，或者不想用主号', 'No spare QQ account, or you do not want to risk your main one'),
      fix: S(
        'QQ 通道需要一个能登录的号。主号也能连，但 NapCat 是第三方协议端，有封号风险，建议用小号。',
        'The QQ channel needs an account it can log in with. Your main account works, but NapCat is a third-party bridge with a ban risk — a spare account is safer.'
      ),
      keep: S('不想冒风险就跳过 QQ，不影响其它功能。', 'Do not want that risk? Skip QQ; everything else still works.'),
    },
    {
      what: S('连不上，或者 3001 端口被占用', 'Cannot connect, or port 3001 is taken'),
      fix: S(
        '先确认 NapCat 的「正向 WebSocket」开着、端口是 3001。被占用就在 NapCat 里换端口，软件「通道 → QQ」的地址改成同一个端口再连。',
        'Confirm NapCat has "forward WebSocket" enabled on port 3001. If it is taken, change the port in NapCat and use the same port in the app address field.'
      ),
      keep: S('软件连的是 NapCat，不是反过来——地址填错方向也会一直连不上。', 'The app connects to NapCat (not the other way round) — a wrong direction also causes endless retries.'),
    },
    {
      what: S('不会扫码，或 B 站二维码扫不动', 'You cannot scan the QR code, or Bilibili rejects it'),
      fix: S(
        '「通道 → B 站 · 账号」点「扫码登录」，用手机 B 站 App 扫（建议小号）。二维码过期就点一下刷新再扫。',
        'Channels → Bilibili account → "Sign in with QR", scan with the Bilibili mobile app (a spare account is safer). If it expires, refresh and scan again.'
      ),
      keep: S('不用 B 站就整块跳过，不影响 QQ 和对话。', 'No Bilibili? Skip it — QQ and Chat are unaffected.'),
    },
    {
      what: S('忘了进入密钥，管理员页进不去', 'You forgot the admin key and cannot open Admin'),
      fix: S(
        '关掉软件，删掉 data\\admin-key.json，重开软件进「管理员」页会重新让你设一把。',
        'Close the app, delete data\\admin-key.json, reopen it, and the Admin page will ask you to set a new key.'
      ),
      keep: S('记忆、养成、设置都不会丢。', 'Memories, bond and settings are not lost.'),
    },
    {
      what: S('模型「测试」报错（400 / 401 / 404 / 连不上）', 'Model "Test" fails (400 / 401 / 404 / cannot connect)'),
      fix: S(
        '401 = Key 错或没填；404 = 地址少了 /v1；连不上 = 地址端口不对，或本机 Ollama 没启动。',
        '401 = wrong or missing key; 404 = the URL is missing /v1; cannot connect = wrong host/port, or local Ollama is not running.'
      ),
      keep: S('换回默认 Ollama，或换一家服务商再试。', 'Fall back to the default Ollama, or try another provider.'),
    },
    {
      what: S('语音发不出来 / 没有声音', 'Voice never plays'),
      fix: S(
        '语音要第三方 TTS 服务（OpenAI 兼容接口或豆包）。「通道 → 说话」选引擎、填字段，点「试听一句」通了再打开「允许发语音」。',
        'Voice needs a third-party TTS service (an OpenAI-compatible endpoint or Doubao). Pick an engine in Channels → Voice, fill the fields, and only enable "allow voice" after the preview works.'
      ),
      keep: S('没有 TTS 就关掉「允许发语音」，文字照发。', 'No TTS? Disable "allow voice" — text still works.'),
    },
    {
      what: S('电脑卡、内存小，本地模型很慢', 'The PC is slow or low on memory'),
      fix: S(
        '本地 7B 大约吃 8 GB 内存。换小模型（qwen2.5:0.5b / 1.5b），或者直接用云端模型。',
        'A local 7B model needs roughly 8 GB of RAM. Switch to a smaller model (qwen2.5:0.5b / 1.5b) or use a cloud model.'
      ),
      keep: S('回得慢不等于卡死，先等 10 秒再判断。', 'Slow is not frozen — give it 10 seconds before judging.'),
    },
    {
      what: S('目录不让写文件（只读 / 权限不够）', 'The folder is read-only or lacks write permission'),
      fix: S(
        '放到「文档」或 D 盘的普通文件夹：软件要在自己旁边建 data、cache、logs。',
        'Move it to Documents or a plain folder on the D drive — the app creates data, cache and logs next to itself.'
      ),
      keep: S('别放在压缩包里直接运行，也别放 Program Files。', 'Never run it from inside a zip, and never from Program Files.'),
    },
    {
      what: S('想卸载，或者想送给别人', 'You want to uninstall it, or hand it to someone'),
      fix: S(
        '软件不写注册表、不装服务：关掉软件，删掉整个文件夹就是卸载。送人只给软件本体，别带 data。',
        'No registry writes, no services: close the app and delete the folder to uninstall. When gifting it, copy the program only — never the data folder.'
      ),
      keep: S('想干净点：先「设置 → 恢复默认设置」，再删 data\\admin-key.json。', 'For a clean handoff: Settings → Restore defaults, then delete data\\admin-key.json.'),
    },
  ];

  // ---------------------------------------------------------------------
  // 分模块详细教程
  // ---------------------------------------------------------------------
  const MODULES = [
    {
      id: 'map',
      title: S('先认路：左边栏都是干什么的', 'First, the map: what the sidebar does'),
      sub: S('一分钟看完，后面就知道该点哪儿', 'One minute here saves ten minutes later'),
      steps: [
        S(
          '左栏上半块是「工作台」：总览（状态 + 一键启动）、消息（QQ / B 站收到的）、对话（不经过任何平台，直接在本机聊）、通道（连接 / 自动回复 / 语音 / 主动聊天）、模型（用哪个脑子）、表情包、能力说明、插件中心、教程（就是这一页）。',
          'Top group, "Workspace": Overview (status + start-all), Inbox (messages from QQ / Bilibili), Chat (talk to her locally, no platform involved), Channels (connections, auto reply, voice, proactive), Model (which brain to use), Stickers, Capabilities, Plugins, and Tutorial (this page).'
        ),
        S(
          '中间「她在这里」：养成（成长值、关系度）、记忆（她记住的事）、桌宠（桌面那只小女仆）。',
          'Middle group, "She lives here": Nurture (growth and bond), Memory (what she remembers), Pet (the little maid on your desktop).'
        ),
        S(
          '最下面「系统」只有「管理员」，要密钥才进得去。右下角齿轮是「设置」（数据位置、开机自启、恢复默认）。',
          'Bottom group, "System", holds just Admin — it needs a key. The gear at the bottom right opens Settings (data locations, start on boot, restore defaults).'
        ),
        S(
          '任何一页右上角都有标题和副标题；绝大多数设置改完立刻生效，不用重启。',
          'Every page has a title and subtitle at the top. Most settings apply instantly — no restart needed.'
        ),
      ],
      pits: [
        S('第一次别急着填满：走完 A 条（模型 + 对话）就已经能用了。', 'Do not try to fill everything at once: finishing path A (model + chat) already gives you a working app.'),
        S('不知道点哪就回这一页，每条都写了「去某页」。', 'Unsure where to click? Come back here — every card says which page to open.'),
      ],
    },
    {
      id: 'model',
      title: S('选脑子：Ollama / DeepSeek / 硅基流动 / 自定义', 'Pick a brain: Ollama / DeepSeek / SiliconFlow / custom'),
      sub: S('先用免费的本机模型跑通，再决定要不要花钱', 'Get the free local model working first, then decide about paying'),
      page: 'model',
      btn: S('去「模型」页', 'Open Model'),
      steps: [
        S(
          '「模型 → 接入」四选一：Ollama（本机，免费、断网可用）；DeepSeek 官方和硅基流动要 API Key（按量收费）；自定义填任何 OpenAI 兼容地址。',
          'Model → Providers offers four choices: Ollama (local, free, works offline); DeepSeek and SiliconFlow need an API key (billed per use); Custom accepts any OpenAI-compatible endpoint.'
        ),
        S(
          '没用过 Ollama 也没关系：去官网下 Windows 安装包，装完打开命令行执行 ollama pull qwen2.5:7b（约 5 GB；没有显卡也能跑，只是慢）。',
          'Never used Ollama? Download the Windows installer from the official site, then run ollama pull qwen2.5:7b in a terminal (about 5 GB; it runs without a GPU, just slower).'
        ),
        S(
          '点「配置」填地址 / Key / 模型名，点「测试」——通了会显示模型数量和耗时。',
          'Click Configure, fill in the address / key / model name, then Test — a success shows the model count and latency.'
        ),
        S(
          '点「设为当前」，右上角「当前」会变成这套。换模型不用重启。',
          'Click Set as current and the "Current" badge switches. Changing models needs no restart.'
        ),
        S(
          '电脑内存小、嫌慢：换 qwen2.5:0.5b 或 1.5b，或者直接用云端模型。',
          'Low RAM or too slow? Switch to qwen2.5:0.5b or 1.5b, or use a cloud model.'
        ),
      ],
      code: S(
        'Ollama 装好后自己跑在：http://127.0.0.1:11434/v1\nDeepSeek 官方：https://api.deepseek.com/v1 ，模型 deepseek-chat\n7B 模型大约需要 8 GB 内存；不够就换小的。',
        'Ollama listens on http://127.0.0.1:11434/v1 by default\nDeepSeek: https://api.deepseek.com/v1 , model deepseek-chat\nA 7B model needs roughly 8 GB of RAM; use a smaller one if you have less.'
      ),
      verify: S(
        '「模型 → 接入」右上角显示「当前：xxx」，并且「测试」返回 ok。',
        'The Model page shows "Current: xxx" and Test reports ok.'
      ),
      pits: [
        S('401 = Key 错或没填；404 = 地址少了 /v1；连不上 = 地址端口不对，或 Ollama 没启动。', '401 = wrong or missing key; 404 = URL missing /v1; cannot connect = wrong host/port or Ollama not running.'),
        S('用云端模型时聊天内容会发到对方服务器；用 Ollama 则完全在本机。', 'Cloud models receive your chat text; Ollama keeps everything on this PC.'),
        S('装不上 Ollama 就先只玩界面和其它功能，等有 Key 了再回来。', 'No Ollama yet? Use the rest of the app and come back when you have a key.'),
      ],
    },
    {
      id: 'chat',
      title: S('先在本机聊一句（不用 QQ）', 'Say one line locally (no QQ)'),
      sub: S('验证软件本体是好的，最快的一步', 'The fastest way to prove the app itself works'),
      page: 'chat',
      btn: S('去「对话」页', 'Open Chat'),
      steps: [
        S('点左栏「对话」，在输入框直接打字，回车发送。', 'Open Chat in the sidebar, type in the box and press Enter.'),
        S('第一次会等几秒（模型要加载）；回得慢是模型慢，不是卡死。', 'The first reply takes a few seconds while the model loads; slow is not frozen.'),
        S('想清空记录点「清空记录」；想让她先开口点「让她主动说一句」。', 'Use Clear history to wipe the log, or "Let her speak first" to get an opening line.'),
      ],
      verify: S('你能收到一条像样的回复，且没有红色错误提示。', 'You get a sensible reply and no red error banner.'),
      pits: [
        S('提示去配置模型 = 上一个模块还没做完。', 'If it asks you to configure a model, the previous module is not finished.'),
        S('「对话」不经过 QQ / B 站，也不受「对外规矩」限制。', 'Chat bypasses QQ and Bilibili, and is exempt from the stranger rules.'),
      ],
    },
    {
      id: 'admin',
      title: S('认主人：管理员 QQ + 进入密钥', 'Introduce the owner: admin QQ + entry key'),
      sub: S('谁是主人，决定她能对谁不设防', 'The owner is the one person she never guards against'),
      page: 'admin',
      btn: S('去「管理员」页', 'Open Admin'),
      steps: [
        S(
          '点左栏最下面金色那格「管理员」。第一次进来会弹窗让你设密钥：可以「生成一把」（15 位，含大小写字母、数字，最多一个下划线），也可以自己设（6–15 位，必须同时有大小写字母和数字）。',
          'Click the gold Admin entry at the bottom of the sidebar. On first visit a dialog asks for a key: Generate one (15 characters, letters, digits, at most one underscore) or write your own (6–15 characters with upper case, lower case and digits).'
        ),
        S(
          '把密钥抄到别处（记事本、手机备忘录都行）。忘了只能删 data\\admin-key.json 重设。',
          'Write the key down somewhere else (a notes app, your phone). If you lose it, delete data\\admin-key.json and set a new one.'
        ),
        S(
          '进来以后填「管理员 QQ」（你自己的 QQ 号）和「B 站 UID」（你的 B 站号，私信只发给你），用户名可填可不填，点「保存」。',
          'Then fill in Owner QQ (your own QQ number) and Bilibili UID (DMs go only to you). The name is optional. Click Save.'
        ),
        S(
          '每次离开这一页就自动上锁，下次进来还要输一遍——这是故意的，防止别人趁你不在打开看。',
          'Leaving the page locks it again; the next visit asks for the key. That is deliberate, so nobody can peek while you are away.'
        ),
      ],
      verify: S(
        '总览顶部那张金色卡片「先把主人认一下」消失，就说明填上了。',
        'The gold "Set up the owner first" card on Overview disappears once it is filled.'
      ),
      pits: [
        S('没填管理员 QQ 也能用（先在对话页聊），只是谁跟她说话都当外人。', 'You can use the app without an owner — but then everyone counts as a stranger.'),
        S('管理员 QQ 永远在白名单里，她一定回你。', 'The owner is always whitelisted; she always answers you.'),
        S('想换密钥：「管理员」页最下面「进入密钥」里填旧密钥 + 新密钥两遍。', 'To change the key: Admin → Entry key, enter the old one plus the new one twice.'),
        S('密钥输错 5 次会锁 30 秒，等一下再来。', 'Five wrong tries lock it for 30 seconds; wait and retry.'),
      ],
    },
    {
      id: 'qq',
      title: S('接通 QQ：NapCat（OneBot 正向 WebSocket）', 'Connect QQ: NapCat (OneBot forward WebSocket)'),
      sub: S('这一步通了，QQ 里才能跟她说话；通不了不影响别的', 'Works → you can chat inside QQ. Fails → everything else still works'),
      page: 'channels',
      btn: S('去「通道 → QQ」', 'Open Channels → QQ'),
      steps: [
        S(
          '先装 NapCatQQ（第三方 QQ 协议端，跟这个软件是两回事）。它要求电脑上装好 QQ（NT 版）并登录。',
          'Install NapCat (a third-party QQ bridge, unrelated to this app). It requires QQ (NT build) installed and logged in on this PC.'
        ),
        S(
          '在 NapCat 里开「正向 WebSocket」（WebSocket 服务端），端口填 3001，只允许本机连接。',
          'In NapCat enable "forward WebSocket" (WebSocket server) on port 3001, local connections only.'
        ),
        S(
          '回软件「通道 → QQ」：地址默认 ws://127.0.0.1:3001，有 Token 就填上，点「连接」（或打开「启动软件时自动连」）。注意方向：是软件连 NapCat，不是 NapCat 连软件。',
          'In the app open Channels → QQ: the address defaults to ws://127.0.0.1:3001. Add the token if you set one and click Connect (or enable "auto connect on start"). Direction matters: the app connects to NapCat, not the other way round.'
        ),
        S(
          '想把 NapCat 也交给这里管：「NapCat 启动程序」里选 NapCatWinBootMain.exe 或 napcat.bat，以后就能用「启动 NapCat」一键拉起。',
          'Optional: point "NapCat launcher" at NapCatWinBootMain.exe or napcat.bat and the Start NapCat button will bring it up for you.'
        ),
        S(
          '用另一个 QQ 给这个号发一句「在吗」：自动回复开了（下一个模块），她就会回。',
          'From a second QQ account, send "you there?" to this account. With auto reply on (next module) she answers.'
        ),
      ],
      code: S(
        'NapCat 里要开的：\n  OneBot 实现       v11\n  正向 WebSocket    端口 3001（只开本机，别映射到公网）\n软件里填：ws://127.0.0.1:3001',
        'Enable in NapCat:\n  OneBot implementation  v11\n  Forward WebSocket      port 3001 (localhost only — never expose it)\nApp address: ws://127.0.0.1:3001'
      ),
      verify: S(
        '「通道 → QQ」显示「已连上」，并且「消息」页开始有会话。',
        'Channels → QQ shows "connected" and the Inbox page starts filling up.'
      ),
      pits: [
        S(
          '装不上 / 连不上：先确认端口有没有在听（日志里会写原因）；QQ 版本太新可能让 NapCat 上不去，换 NapCat 新版或降 QQ 版本。',
          'Will not install or connect? Confirm the port is listening (the log says why). A too-new QQ can block NapCat — update NapCat or downgrade QQ.'
        ),
        S('3001 被占用：在 NapCat 里换端口，软件地址改成同一个。', 'Port 3001 taken? Change it in NapCat and use the same port in the app.'),
        S('实在搞不定就跳过 QQ —— 「对话」页和 B 站私信照样能用，功能不受影响。', 'Stuck? Skip QQ — Chat and Bilibili DMs still work, nothing else is affected.'),
        S('NapCat 没有密码防护，千万别把 3001 端口映射到公网。', 'NapCat has no password protection — never port-forward 3001 to the internet.'),
      ],
    },
    {
      id: 'bili',
      title: S('接通 B 站：扫码登录 + 私信', 'Connect Bilibili: QR sign-in + DMs'),
      sub: S('她用你的小号刷视频、给管理员发私信', 'She browses with your spare account and DMs the owner'),
      page: 'channels',
      btn: S('去「通道 → B 站」', 'Open Channels → Bilibili'),
      steps: [
        S('「通道」页拉到最下面「B 站 · 账号」，点「扫码登录」，用手机 B 站扫一下（建议用小号，别用主号）。', 'Scroll to the bottom of Channels to "Bilibili account", click "Sign in with QR" and scan with the Bilibili mobile app (a spare account is safer than your main one).'),
        S('登录成功后这里会显示昵称和 UID；管理员 UID 在「管理员」页里填（私信只发给他）。', 'After signing in you see the nickname and UID. Fill the owner UID on the Admin page so DMs only reach you.'),
        S('想让她主动给你推视频：打开「B 站 · 养成 → 自动私信推荐」。标签可以留空（命中标签的优先推，没命中从热门里挑）。', 'Want recommended videos? Enable "auto DM recommendations" under Bilibili in Channels. Tags are optional (tagged videos first, then trending).'),
        S('「B 站 · 收到的私信」能看别人发来的私信；她回 B 站私信的规则跟 QQ 共用「对外规矩」。', '"Bilibili DMs received" shows what strangers send; replies follow the same stranger rules as QQ.'),
      ],
      verify: S(
        '「通道 → B 站 · 账号」显示已登录；「养成」页能看到她最近的推荐记录。',
        'Channels → Bilibili shows signed in, and the Nurture page lists her recent recommendations.'
      ),
      pits: [
        S('cookie 过期会掉登录，重新扫一次就行。', 'Expired cookies drop the login — just scan again.'),
        S('同一个视频 7 天内不会重复推（防刷屏）。', 'The same video is never recommended twice within 7 days.'),
        S('不用 B 站就整块跳过，不影响 QQ 和对话。', 'No Bilibili? Skip it — QQ and Chat are unaffected.'),
      ],
    },
    {
      id: 'reply',
      title: S('让她回话：范围、白名单、群聊 @', 'Make her answer: scope, allow-list, group @'),
      sub: S('不设这一条，她收到消息也不会回', 'Without this she receives messages and stays silent'),
      page: 'channels',
      btn: S('去「通道 → 自动回复」', 'Open Channels → Auto reply'),
      steps: [
        S('「通道 → 自动回复」打开开关。', 'Open Channels → Auto reply and switch it on.'),
        S('「范围」选：只回私聊 / 只在群里回 / 都回。群里默认要 @ 她才理。', 'Pick a scope: DMs only / groups only / both. In groups she only reacts when @-mentioned by default.'),
        S('「只和谁互动」里填白名单 QQ（逗号隔开）；管理员永远在白名单里。留空 = 只回管理员。', 'Fill the allow-list in "Who she talks to" (comma separated). The owner is always included; empty means owner only.'),
        S('群里还要在「群聊分寸感」里把群号加进允许名单，再设冷却秒数和每分钟上限，免得刷屏。', 'For groups, add the group number under "group manners" and set a cooldown and per-minute cap.'),
      ],
      verify: S('你在 QQ 里发一句，她几秒内回你；日志里没有报错。', 'Send a message in QQ and get a reply within seconds; the log shows no errors.'),
      pits: [
        S('群消息不回：先看范围是不是「只回私聊」，再看群号在不在允许名单、有没有 @ 她。', 'Group silence? Check the scope, the group allow-list, and whether she was @-mentioned.'),
        S('她回得慢：模型慢（本地 7B 在弱机器上要几秒）或网络慢，不是卡死。', 'Slow replies come from a slow model (a local 7B on a weak PC takes seconds) or network — not a freeze.'),
        S('想让她只回你：白名单留空就行。', 'Owner-only replies: leave the allow-list empty.'),
      ],
    },
    {
      id: 'memory',
      title: S('记忆与养成：她怎么记住你', 'Memory and nurture: how she remembers you'),
      sub: S('记忆存在本机数据库，不上传', 'Memories live in the local database, never uploaded'),
      page: 'model',
      btn: S('去「模型 → 记忆」', 'Open Model → Memory'),
      steps: [
        S('「模型 → 记忆」里选记忆方式：只用关键词（最省）/ 本地 + Ollama 向量（按意思找，推荐）。', 'On Model → Memory pick a mode: keywords only (cheapest) or local + Ollama vectors (semantic search, recommended).'),
        S('点「补算向量」把已有记忆都算一遍，之后新记忆会自动补。', 'Click Backfill vectors to process existing memories; new ones are handled automatically.'),
        S('手动加一条试试，再用带意思的话问她，看能不能翻出来。', 'Add one by hand, then ask something semantically related and see whether she recalls it.'),
        S('「遗忘曲线」决定旧记忆多久变淡、低于多少归档；归档不是删除，还能翻出来。', 'The forgetting curve decides how fast old memories fade and when they are archived — archived is not deleted.'),
        S('「养成」页是成长值和关系度，聊天多、聊得久会涨。', 'The Nurture page tracks growth and bond; chatting more (and longer) raises them.'),
      ],
      verify: S(
        '「模型 → 记忆」右上角「共 N 条」，且「按意思找」显示「已向量 N/N」。',
        'Model → Memory shows "N memories" and the semantic line shows "vectored N/N".'
      ),
      pits: [
        S('向量模型要 Ollama 在线（nomic-embed-text）。', 'Vector search needs Ollama online (nomic-embed-text).'),
        S('换电脑只拷 data 文件夹，记忆和关系就都带走了。', 'Copy the data folder to take memories and bond to another PC.'),
        S('「恢复默认设置」不会动记忆和养成。', 'Restore defaults never touches memories or nurture.'),
      ],
    },
    {
      id: 'stickers',
      title: S('表情包：把图库接进来', 'Stickers: hook up your image folder'),
      sub: S('文件名能看出情绪，就自动分组', 'File names hint at emotions, so groups are automatic'),
      page: 'stickers',
      btn: S('去「表情包」页', 'Open Stickers'),
      steps: [
        S('「表情包」页选一个目录（留空就是先不用表情包），点「使用这个目录」。', 'On the Stickers page pick a folder (leave empty to skip), then click Use this folder.'),
        S('文件名里带「笑/哭/生气/摸头」这类词会自动分到对应分组；看不出来的进「其它」，可以在「管理」里改。', 'Names containing words like laugh / cry / angry / headpat land in the matching group; the rest go to "Other" and can be re-grouped later.'),
        S('「重新扫描」会重新读目录；图多的话第一次会慢几秒。', 'Rescan re-reads the folder; the first scan of a big library takes a few seconds.'),
        S('「收到表情就存进来」会把管理员发来的表情自动收进目录（同一张只存一次）。', '"Save received stickers" collects images the owner sends (each saved once).'),
      ],
      verify: S('页面顶部「共 N 张 · M 个分组」，下面能挑出图。', 'The header shows "N stickers · M groups" and picking works.'),
      pits: [
        S('目录里的子文件夹也会扫。', 'Sub-folders are scanned too.'),
        S('清空目录后再扫描不会报错。', 'Rescanning an emptied folder no longer errors.'),
        S('一张图都挑不出来，先看是不是没选目录。', 'Nothing to pick? Check that a folder is actually selected.'),
      ],
    },
    {
      id: 'voice',
      title: S('语音：让她真的说话', 'Voice: let her actually speak'),
      sub: S('两种引擎二选一，先选引擎再填字段', 'Two engines — pick one, then fill its fields'),
      page: 'channels',
      btn: S('去「通道 → 说话」', 'Open Channels → Voice'),
      steps: [
        S('「通道 → 说话（语音 API）」最上面选引擎：OpenAI 兼容（任何能吃 /audio/speech 的服务）或豆包（火山引擎）。', 'In Channels → Voice pick an engine at the top: OpenAI-compatible (any service with /audio/speech) or Doubao (Volcengine).'),
        S('OpenAI 兼容：填接口地址（填到 /v1）、模型名、音色、Key。豆包：填 APPID、Access Token、Cluster、voice_type。', 'OpenAI-compatible: address (up to /v1), model, voice, key. Doubao: APPID, access token, cluster, voice_type.'),
        S('打开「允许发语音」，点「试听一句」——通了会自动播放，下面状态行变成「已配置」。', 'Enable "allow voice" and click Preview — it plays and the status line turns to "configured".'),
        S('什么时候发语音：你在 QQ 里说「发条语音」，必发；平时按「回语音的概率」随机发。', 'When does she send voice? Always when you ask for one in QQ; otherwise at random, per the probability setting.'),
      ],
      verify: S('「试听一句」能听到声音；日志里有 voice_usage 记录。', 'Preview produces sound and the log records voice_usage.'),
      pits: [
        S('豆包只认 mp3 / wav / ogg / pcm，别的格式会自动改 mp3。', 'Doubao accepts mp3 / wav / ogg / pcm only; other formats are converted automatically.'),
        S('报「连不上这个地址」= 端口没开或域名写错；报 401 = Key 错。', '"Cannot connect" = port closed or wrong host; 401 = wrong key.'),
        S('语音失败会退回发文字，并在文字后面说明原因。', 'Failed voice falls back to text with the reason appended.'),
      ],
    },
    {
      id: 'remote',
      title: S('遥控电脑：普通操作直接做，危险操作要按格式', 'Remote control: normal actions run, dangerous ones need an exact line'),
      sub: S('关机、重启、卸载这类，必须你亲手发确认行', 'Shutdown, restart, uninstall — only your own confirmation line can trigger them'),
      page: 'model',
      btn: S('去「模型 → 遥控电脑」', 'Open Model → Remote'),
      steps: [
        S('「模型 → 遥控电脑」打开「允许 QQ 指挥电脑」。白名单在「管理员」页里改；管理员自己永远可以。', 'On Model → Remote enable "allow QQ to control this PC". The allow-list lives on the Admin page; the owner is always allowed.'),
        S('普通操作直接用话指挥：「截个屏」「打开 bilibili」「内存还剩多少」。', 'Normal actions are plain language: "screenshot", "open bilibili", "how much memory is left".'),
        S('危险操作（关机 / 重启 / 注销 / 睡眠 / 锁屏 / 卸载）她不会直接做：她会回你一行格式，比如 !Control computer：确认关机。', 'Dangerous actions (shutdown / restart / sign out / sleep / lock / uninstall) are never executed directly: she replies with a line such as !Control computer：确认关机.'),
        S('你把这一行原样单独发给她（行首就是它、前面不能有别的字），她才会真的执行。', 'Send that exact line back on its own (nothing before it) and only then does it run.'),
        S('关机默认有 60 秒缓冲，反悔就发「取消关机」。', 'Shutdown waits 60 seconds by default; send 取消关机 to cancel.'),
      ],
      code: S(
        '格式（大小写、中英文冒号都行）：\n!Control computer：确认关机\n!Control computer：确认重启\n!Control computer：确认取消关机',
        'Format (case and full-width colon both fine):\n!Control computer：确认关机   (shutdown)\n!Control computer：确认重启   (restart)\n!Control computer：确认取消关机 (cancel shutdown)'
      ),
      verify: S(
        '发完确认行后 1 秒内，她会回「60 秒后关机。反悔的话发取消关机」。',
        'Within a second of the confirmation line she replies that shutdown starts in 60 seconds.'
      ),
      pits: [
        S('别人照抄这一行也没用——每次执行前都会再查一次权限。', 'Copying the line is useless for strangers — permissions are re-checked before every run.'),
        S('她自己的回复里就算带了这行也不会执行，只认你亲手发的那条消息。', 'Even if her own reply contains the line it is ignored; only your message counts.'),
        S('「跑命令」开关能执行任意 PowerShell，最危险，平时别开。', '"Run commands" can execute arbitrary PowerShell — the riskiest switch, keep it off.'),
      ],
    },
    {
      id: 'proactive',
      title: S('主动聊天：她什么时候自己来找你', 'Proactive chat: when she comes to you first'),
      sub: S('QQ 和 B 站共用一套节奏', 'QQ and Bilibili share one rhythm'),
      page: 'channels',
      btn: S('去「通道 → 主动聊天」', 'Open Channels → Proactive'),
      steps: [
        S('「通道 → 主动聊天」打开开关。', 'Open Channels → Proactive and switch it on.'),
        S('「节奏」二选一：固定间隔（到点就发）或概率曲线（隔得越久越可能发，可以在图上双击加点、拖圆点改）。', 'Rhythm: fixed interval, or a probability curve (the longer the silence, the likelier she speaks — double-click to add points, drag to adjust).'),
        S('「最长间隔」是保底：到了这个时间一定会说一句；「免打扰时段」里一句都不发。', '"Max interval" is the guarantee: she will speak by then. During "quiet hours" she stays silent.'),
        S('QQ 私聊和 B 站私信推荐共用这套节奏，但各记各的「上次开口」，互不打断。', 'QQ DMs and Bilibili recommendations share the rhythm but track their own last-spoke time.'),
      ],
      verify: S('「通道 → 主动聊天」显示「已开启」；日志里有 proactive 记录。', 'Channels → Proactive shows "on" and the log records proactive sends.'),
      pits: [
        S('觉得太吵：把曲线整体往下压，或者把最长间隔调到 180–240 分钟。', 'Too chatty? Flatten the curve or raise the max interval to 180–240 minutes.'),
        S('不发：先看开关、免打扰时段，以及「自动回复」是不是关着。', 'Nothing arrives? Check the switch, quiet hours, and whether auto reply is off.'),
        S('群聊不会主动说话，只发私聊。', 'Groups never get proactive messages — DMs only.'),
      ],
    },
    {
      id: 'guard',
      title: S('对外规矩：别人问什么都问不出你', 'Stranger rules: nobody can interrogate you out of her'),
      sub: S('只对管理员放行，白名单也照样受限', 'Only the owner is exempt; the allow-list is still restricted'),
      page: 'model',
      btn: S('去「模型 → 对外规矩」', 'Open Model → Stranger rules'),
      steps: [
        S('「模型 → 对外规矩」默认开着，里面有 9 条写死的底线（管理员身份、联系方式、住址、这台电脑的信息、你们之间的私事、冒充套话、改设定、帮别人执行命令、不许长篇解释）。', 'Model → Stranger rules is on by default with nine hard limits: owner identity, contact details, address, this PC, private matters, impersonation, changing settings, acting for others, and no long explanations.'),
        S('「你自己加的」框里一行一条写自己的规矩，最多 20 条；她按意思理解，不会原文念给别人。', 'Add your own rules one per line (up to 20); she follows the meaning and never reads them aloud.'),
        S('「被追问时甩表情包挡回去」开着的话，别人套隐私时会甩一张「威胁」组的表情。', 'With "deflect with a sticker" on, prying strangers get a sticker from the "threat" group.'),
        S('「看一眼实际加了什么」可以分别预览「别人问她时」「你问她时」真正发出去的提示词。', '"See what is actually injected" previews the real prompt for strangers and for you.'),
      ],
      verify: S(
        '点「别人问她时」能看到 800 多字的护栏；点「你问她时」是 0 字。',
        'The stranger preview shows 800+ characters of guard text; the owner preview shows 0.'
      ),
      pits: [
        S('这是提示词级约束，不是系统隔离；特别刁钻的套话仍可能被绕，最在意的事自己写进自定义规矩。', 'This is prompt-level, not a sandbox; very clever probing may still slip through — put what matters most into your own rules.'),
        S('白名单只是「允许回话」，不等于「允许知道」。', 'The allow-list grants replies, not knowledge.'),
        S('关掉这一栏，别人问什么她都会照实说。', 'Turning it off makes her answer strangers honestly.'),
      ],
    },
    {
      id: 'data',
      title: S('数据、备份、搬家、恢复出厂', 'Data, backup, moving, factory reset'),
      sub: S('所有东西都在一个文件夹里', 'Everything lives in one folder'),
      page: 'settings',
      btn: S('去「设置」', 'Open Settings'),
      steps: [
        S('「设置 → 数据位置」能看到 data / cache / logs 的真实路径（默认都在软件目录下）。', 'Settings → Data location shows the real data / cache / logs paths (next to the app by default).'),
        S('备份：关掉软件，把整个 data 文件夹复制一份就是完整备份。', 'Backup: close the app and copy the whole data folder.'),
        S('搬家：拷走整个软件文件夹（含 runtime、plugins、data），到新机器双击「启动.bat」就能用。', 'Moving: copy the whole app folder (runtime, plugins, data) and run the launcher on the new PC.'),
        S('「设置 → 恢复默认设置」只把选项回到刚下载时的样子；管理员身份、表情包、养成、记忆都不会动。', 'Settings → Restore defaults only resets options; owner, stickers, nurture and memories stay.'),
        S('想彻底重来：关掉软件删掉 data 文件夹，再打开就是全新白板。', 'Total reset: close the app and delete the data folder.'),
      ],
      verify: S('「设置 → 关于」能看到版本号；「数据位置」几行都能点开。', 'Settings → About shows the version and the data rows open in Explorer.'),
      pits: [
        S('别只拷 settings.json，记忆和聊天在 dsh-open.db 里。', 'Copying settings.json alone is not enough — memories and chats live in dsh-open.db.'),
        S('换机器时 data\\userData 是 Electron 缓存，可以不拷。', 'data\\userData is an Electron cache and can be skipped.'),
        S('发给别人演示：只带软件本体，别带 data。', 'Sharing a demo: program files only, never data.'),
      ],
    },
    {
      id: 'safety',
      title: S('安全与隐私（最后看也不迟）', 'Safety and privacy (fine to read last)'),
      sub: S('六条，能少掉大部分麻烦', 'Six lines that prevent most trouble'),
      bullets: [
        S('软件不注册账号、不上传数据：设置、记忆、聊天记录全在 data 文件夹里。', 'No sign-up, no uploads: settings, memories and chats all live in the data folder.'),
        S('云端模型的 API Key 明文存在 data\\settings.json —— 别把这个文件夹发给别人，也别传网盘。', 'Cloud API keys are stored in plain text in data\\settings.json — never share or upload that folder.'),
        S('送人或换电脑：只拷软件本体；想彻底干净，先「恢复默认设置」再删 data\\admin-key.json。', 'Gifting or moving: copy the program only; for a clean state, restore defaults and delete data\\admin-key.json.'),
        S('NapCat 的 3001 端口只给本机，路由器别做端口映射。', 'Keep NapCat on port 3001 locally — no router port forwarding.'),
        S('「跑命令」能执行任意 PowerShell，最危险；遥控也只给管理员和白名单用。', '"Run commands" executes arbitrary PowerShell — the riskiest feature; remote control is owner/allow-list only.'),
        S('软件是未签名程序，Windows 会提醒；只从 GitHub Releases 下载，别用第三方二次打包。', 'The app is unsigned, so Windows warns; download only from GitHub Releases, never a third-party repack.'),
      ],
    },
  ];

  // 常见问题（单独一块，便于以后继续加）
  const FAQ = [
    [
      S('双击没有反应', 'Double-click does nothing'),
      S('双击「启动.bat」，别双击 exe；看文件夹里有没有生成 data 目录；再看日志最后几行。', 'Double-click 启动.bat (not the exe), check that a data folder appeared, then read the last log lines.'),
    ],
    [
      S('QQ 里她不回消息', 'She stays silent in QQ'),
      S('看「通道 → 自动回复」开没开、范围是不是「只回私聊」、你的 QQ 在不在白名单；群里还要 @ 她。', 'Check auto reply is on, the scope, your QQ in the allow-list; in groups she needs an @.'),
    ],
    [
      S('连不上 NapCat', 'Cannot connect to NapCat'),
      S('3001 端口没在听：NapCat 没启动，或没开「正向 WebSocket」；也可能是端口被别的程序占了。', 'Port 3001 is not listening: NapCat is down, "forward WebSocket" is off, or another program owns the port.'),
    ],
    [
      S('模型测试 401 / 404 / 连不上', 'Model test fails: 401 / 404 / cannot connect'),
      S('401 = Key 错；404 = 地址少了 /v1；连不上 = 地址端口不对或 Ollama 没启动。', '401 = wrong key; 404 = missing /v1; cannot connect = wrong host/port or Ollama not running.'),
    ],
    [
      S('她说自己是文字 AI、发不了语音', 'She says she is text-only and cannot speak'),
      S('「通道 → 说话」里引擎和字段没填全，或者「允许发语音」关着。', 'Channels → Voice is missing fields, or "allow voice" is off.'),
    ],
    [
      S('桌面没有桌宠', 'No pet on the desktop'),
      S('「桌宠」页打开开关；尺寸默认 220，按住左键 0.28 秒才能拖动。', 'Enable it on the Pet page; default size 220, hold the left button 0.28 s to drag.'),
    ],
    [
      S('忘记进入密钥', 'Forgot the admin key'),
      S('关掉软件，删 data\\admin-key.json，再进「管理员」页会重新让你设一把。', 'Close the app, delete data\\admin-key.json, and Admin will ask for a new key.'),
    ],
    [
      S('想让别人也能跟她聊', 'Letting someone else talk to her'),
      S('把对方 QQ 加进「通道 → 只和谁互动」；对方仍受「对外规矩」限制。', 'Add their QQ to Channels → who she talks to; they still hit the stranger rules.'),
    ],
    [
      S('日志在哪', 'Where are the logs'),
      S('「设置 → 数据位置 → 日志目录」，一天一个文件；出问题先看最后几行。', 'Settings → Data location → Logs, one file per day; read the last lines first.'),
    ],
    [
      S('想彻底清空', 'Full wipe'),
      S('关掉软件删 data 文件夹；不想全删就用「设置 → 恢复默认设置」。', 'Close the app and delete data; or use Settings → Restore defaults.'),
    ],
    [
      S('软件打开是英文，怎么换中文', 'The app opened in English'),
      S('右下角齿轮 → 设置 → 界面语言 → 简体中文，立即生效。', 'Gear at bottom right → Settings → Language → 简体中文; it applies instantly.'),
    ],
    [
      S('换了显卡/换了电脑，模型很慢', 'Model got slow after a hardware change'),
      S('「模型 → 配置」里点一次「测试」重新探测；还把模型换成更小的（0.5b/1.5b）。', 'Click Test once in Model → Configure to re-detect; also try a smaller model (0.5b/1.5b).'),
    ],
  ];

  // ---------------------------------------------------------------------
  // 渲染
  // ---------------------------------------------------------------------
  PAGES.tutorial = {
    async render(root, ctx) {
      const { h } = ctx;
      const en = langIsEn();
      const T = (p) => (p && p.length ? (en ? p[1] : p[0]) : p);

      const state = await readState(ctx);
      if (!ctx.alive()) return;

      // ---- 顶部：先给结论 + 三条路 ----
      const pathCards = PATHS.map((p) => {
        const st = p.status ? p.status(state) : null;
        const kids = [
          h('div', { class: 'tut-path-head' },
            h('span', { class: 'tut-path-key', text: p.key }),
            h('div', { class: 'tut-path-main' },
              h('div', { class: 'tut-path-title', text: T(p.title) }),
              h('div', { class: 'tut-path-desc', text: T(p.desc) }),
            ),
          ),
          h('div', { class: 'tut-path-note', text: T(p.note) }),
          h('div', { class: 'tut-path-actions' },
            h('button', {
              class: 'chip-btn',
              text: T(p.btn),
              onClick: () => ctx.navigate(p.page),
            }),
            p.btn2
              ? h('button', {
                  class: 'chip-btn tut-path-alt',
                  text: T(p.btn2),
                  onClick: () => ctx.navigate(p.page2),
                })
              : null,
            st ? h('span', { class: 'badge ' + (st.done ? 'badge-ok' : 'badge-warn'), text: T(st.text) }) : null,
          ),
        ];
        return h('div', { class: 'tut-path' + (st && st.done ? ' is-done' : '') }, kids.filter(Boolean));
      });

      const hero = h(
        'section',
        { class: 'section tut-hero' },
        h(
          'div',
          { class: 'tut-hero-head' },
          h('div', null,
            h('div', { class: 'tut-hero-title', text: T(S('第一次打开？照这三条路走，十分钟内能跟她聊上', 'First time? Pick one of three paths and be chatting within ten minutes')) }),
            h('div', {
              class: 'tut-hero-desc',
              text: T(S(
                '这一页是写给「电脑不太熟、什么都还没装」的人。先说结论：不用先装 NapCat、不用 QQ、不用注册 —— 只要配好一个「脑子」，就能先在「对话」页聊起来。三条路任选一条，走不通就退回上一条，其它功能不受影响。',
                'This page is written for someone whose PC is a bit unfamiliar and who has installed nothing yet. The short version: no NapCat, no QQ and no sign-up needed — one model is enough to start chatting on the Chat page. Pick a path; if it fails, fall back to the one above it. Nothing else breaks.'
              )),
            }),
          ),
          h('div', { class: 'tut-hero-tools' },
            h('button', {
              class: 'chip-btn',
              text: T(S('全部展开', 'Expand all')),
              onClick: () => root.querySelectorAll('.tut-mod').forEach((m) => m.classList.add('is-open')),
            }),
            h('button', {
              class: 'chip-btn',
              text: T(S('全部收起', 'Collapse all')),
              onClick: () => root.querySelectorAll('.tut-mod').forEach((m) => m.classList.remove('is-open')),
            }),
          ),
        ),
        h('div', { class: 'tut-paths' }, pathCards),
      );
      root.appendChild(hero);

      // ---- 四步上手 ----
      const quickSteps = QUICK.map((q) => {
        const done = q.done(state);
        return h(
          'div',
          { class: 'tut-step' + (done ? ' is-done' : '') },
          h('div', { class: 'tut-step-top' },
            h('span', { class: 'tut-step-no', text: q.n }),
            q.noDone
              ? h('span', { class: 'badge badge-accent', text: T(S('随时可做', 'Any time')) })
              : h('span', { class: 'badge ' + (done ? 'badge-ok' : 'badge-warn'), text: done ? T(S('已完成', 'Done')) : T(S('待设置', 'To do')) }),
          ),
          h('div', { class: 'tut-step-title', text: T(q.title) }),
          h('div', { class: 'tut-step-desc', text: T(q.desc) }),
          h('button', {
            class: 'chip-btn tut-step-btn',
            text: T(q.btn),
            onClick: () => ctx.navigate(q.page),
          }),
        );
      });

      root.appendChild(
        h('section', { class: 'section' },
          h('div', { class: 'section-head' },
            h('div', null,
              h('div', { class: 'section-title', text: T(S('四步跑通（按「最快能聊上」排的）', 'Four steps to a working chat')) }),
              h('div', { class: 'section-desc', text: T(S('标签读的是你当前真实配置，不是示例。前两步做完就能说话了。', 'The badges read your real configuration, not a demo. After the first two steps you can already chat.')) }),
            ),
          ),
          h('div', { class: 'tut-steps' }, quickSteps),
        ),
      );

      // ---- 最坏情况 ----
      root.appendChild(
        h('section', { class: 'section' },
          h('div', { class: 'section-head' },
            h('div', null,
              h('div', { class: 'section-title', text: T(S('先说最坏的情况：卡住了怎么办', 'Worst cases first: what to do when it breaks')) }),
              h('div', { class: 'section-desc', text: T(S('左边是现象——不是你的错，也不是软件坏了；中间是可以直接照做的处理；右边是「都不行时还能用什么」。', 'Left: what you see — not your fault and not a crash. Middle: what to do. Right: what still works if none of that helps.')) }),
            ),
          ),
          h('div', { class: 'tut-worst' }, WORST.map((w) =>
            h('div', { class: 'tut-worst-row' },
              h('div', { class: 'tut-worst-what', text: T(w.what) }),
              h('div', { class: 'tut-worst-fix', text: T(w.fix) }),
              h('div', { class: 'tut-worst-keep' }, h('span', { class: 'tut-worst-keep-label', text: T(S('都不行时', 'If all else fails')) }), h('span', { text: T(w.keep) })),
            ),
          )),
        ),
      );

      // ---- 分模块 ----
      const list = h('div', { class: 'tut-list' });
      let openedDefault = false;

      MODULES.forEach((m, i) => {
        const no = 'M' + (i + 1);
        const st = statusOf(m.id, state);
        const headKids = [
          h('span', { class: 'tut-mod-no', text: no }),
          h('div', { class: 'tut-mod-main' },
            h('div', { class: 'tut-mod-title', text: T(m.title) }),
            h('div', { class: 'tut-mod-sub', text: T(m.sub) }),
          ),
        ];
        if (st) headKids.push(h('span', { class: 'badge ' + (st.done ? 'badge-ok' : 'badge-warn'), text: T(st.text) }));
        if (m.page) {
          headKids.push(h('button', {
            class: 'chip-btn tut-mod-go',
            text: T(m.btn || S('去这一页', 'Open')),
            onClick: (e) => {
              e.stopPropagation();
              ctx.navigate(m.page);
            },
          }));
        }
        headKids.push(h('span', { class: 'tut-arrow', text: '▸' }));

        const bodyKids = [];
        if (m.steps) {
          bodyKids.push(h('div', { class: 'tut-sec-title', text: T(S('要做的事', 'What to do')) }));
          bodyKids.push(h('ol', { class: 'tut-ol' }, m.steps.map((s) => h('li', null, T(s)))));
        }
        if (m.bullets) {
          bodyKids.push(h('ul', { class: 'tut-pits tut-bullets' }, m.bullets.map((b) => h('li', null, T(b)))));
        }
        if (m.code) bodyKids.push(h('pre', { class: 'tut-code', text: T(m.code) }));
        if (m.verify) {
          bodyKids.push(h('div', { class: 'tut-verify' },
            h('span', { class: 'tut-verify-label', text: T(S('怎么算成功', 'How to know it worked')) }),
            h('span', { text: T(m.verify) }),
          ));
        }
        if (m.pits) {
          bodyKids.push(h('div', { class: 'tut-sec-title tut-sec-title-gap', text: T(S('出问题了这么办', 'If something goes wrong')) }));
          bodyKids.push(h('ul', { class: 'tut-pits' }, m.pits.map((p) => h('li', null, T(p)))));
        }

        const openDefault = !openedDefault && st && !st.done;
        if (openDefault) openedDefault = true;
        const mod = h('div', { class: 'tut-mod' + (openDefault ? ' is-open' : '') },
          h('div', {
            class: 'tut-mod-head',
            onClick: () => mod.classList.toggle('is-open'),
          }, headKids),
          h('div', { class: 'tut-mod-body' }, bodyKids),
        );
        list.appendChild(mod);
      });

      const version = (state.info && state.info.app && state.info.app.version) || '';
      root.appendChild(
        h('section', { class: 'section' },
          h('div', { class: 'section-head' },
            h('div', null,
              h('div', { class: 'section-title', text: T(S('具体怎么做：按模块来', 'Step by step, module by module')) }),
              h('div', { class: 'section-desc', text: T(S('每一块都能折叠。带状态标签的，是根据你当前配置实时判断的；标着「待设置」的那块，往往就是还没弄的一步。', 'Every block collapses. Badges come from your live configuration — the block marked "to do" is usually the missing step.')) }),
            ),
          ),
          list,
        ),
      );

      // ---- FAQ ----
      root.appendChild(
        h('section', { class: 'section' },
          h('div', { class: 'section-head' },
            h('div', null,
              h('div', { class: 'section-title', text: T(S('常见问题', 'FAQ')) }),
              h('div', { class: 'section-desc', text: T(S('遇到问题先到这里翻一眼，大多数都有现成答案。', 'Most problems have an answer here already.')) }),
            ),
          ),
          h('div', { class: 'tut-faq' }, FAQ.map(([q, a]) =>
            h('div', { class: 'tut-faq-row' },
              h('div', { class: 'tut-faq-q', text: (en ? 'Q: ' : 'Q：') + T(q) }),
              h('div', { class: 'tut-faq-a', text: (en ? 'A: ' : 'A：') + T(a) }),
            ),
          )),
          h('div', { class: 'section-note', text: T(S(
            '教程写的是当前版本（' + version + '）的真实界面。要是哪天发现按钮名对不上，说明改了字没同步——直接说一声。',
            'This tutorial matches the real UI of version ' + version + '. If a button name ever drifts, the text was updated without the tutorial — just tell me.'
          )) }),
        ),
      );
    },
  };
})();
