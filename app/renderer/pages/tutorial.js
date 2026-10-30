'use strict';

/**
 * 教程页
 * ------------------------------------------------------------
 * 从「刚下载完」到「QQ 里能聊天」的完整流程，按模块拆开：
 *   顶部 4 步快速上手（每步能跳到对应页面，并显示真实状态）
 *   下面 14 个模块，可折叠，每个模块都是「要做什么 → 怎么验证 → 常见坑」
 * 文案全部照着现在这版实际界面写：按钮名、分区名、路径都对得上。
 */

(function () {
  const PAGES = (window.DSHPages = window.DSHPages || {});

  // ---------------------------------------------------------------------
  // 状态：进页面时并发读一遍，用来给每一步打「已完成 / 待设置」的标
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

  // 每个模块的「当前状态」：done / 等，参考类返回 null
  function statusOf(id, s) {
    switch (id) {
      case 'admin':
        if (!ownerQq(s)) return { done: false, text: '还没认主人' };
        if (s.key && s.key.hasKey === false) return { done: false, text: '还差进入密钥' };
        return { done: true, text: '已认主人' };
      case 'qq':
        return qqOnline(s) ? { done: true, text: 'QQ 在线' } : { done: false, text: 'QQ 没连上' };
      case 'bili':
        return biliUid(s) ? { done: true, text: 'B 站已登录' } : { done: false, text: 'B 站没登录' };
      case 'model': {
        const ov = s.model || {};
        const active = String(ov.active || '');
        const p = (ov.providers && ov.providers[active]) || {};
        if (!active) return { done: false, text: '还没选模型' };
        if (active === 'ollama') return { done: true, text: '用本机 Ollama' };
        return p.hasKey || p.apiKey || p.configured
          ? { done: true, text: '用云端模型' }
          : { done: false, text: '云端还差 Key' };
      }
      case 'reply':
        return s.auto && s.auto.enabled ? { done: true, text: '自动回复已开' } : { done: false, text: '自动回复关着' };
      case 'memory': {
        const n = (s.mem && s.mem.count) || 0;
        return n > 0 ? { done: true, text: '已有 ' + n + ' 条记忆' } : { done: false, text: '还没有记忆' };
      }
      case 'stickers': {
        const n = (s.stk && s.stk.total) || 0;
        return n > 0 ? { done: true, text: n + ' 张表情' } : { done: false, text: '还没放表情' };
      }
      case 'voice':
        return s.voice && s.voice.enabled ? { done: true, text: '语音开着' } : { done: false, text: '语音关着' };
      case 'remote':
        return s.remote && s.remote.enabled ? { done: true, text: '遥控已开' } : { done: false, text: '遥控关着' };
      case 'proactive':
        return s.pro && s.pro.enabled ? { done: true, text: '主动聊天已开' } : { done: false, text: '主动聊天关着' };
      case 'guard':
        return s.guard && s.guard.enabled ? { done: true, text: '护栏已生效' } : { done: false, text: '护栏关着' };
      default:
        return null;
    }
  }

  // ---------------------------------------------------------------------
  // 4 步快速上手
  // ---------------------------------------------------------------------
  const QUICK = [
    {
      n: '1',
      title: '认主人',
      desc: '告诉软件你是谁：管理员 QQ、B 站 UID、进入密钥。不填这个，谁跟她说话都当外人。',
      page: 'admin',
      btn: '去「管理员」',
      done: (s) => !!ownerQq(s),
    },
    {
      n: '2',
      title: '接一个通道',
      desc: 'QQ 走 NapCat（OneBot 反向 WS），B 站扫码登录。接上以后「消息」页才会开始有东西。',
      page: 'channels',
      btn: '去「通道」',
      done: (s) => qqOnline(s) || !!biliUid(s),
    },
    {
      n: '3',
      title: '选脑子',
      desc: 'Ollama 本地免费，DeepSeek 云端更聪明。挑一个填好，点「测试」通了再「设为当前」。',
      page: 'model',
      btn: '去「模型」',
      done: (s) => {
        const st = statusOf('model', s);
        return !!(st && st.done);
      },
    },
    {
      n: '4',
      title: '让她回话',
      desc: '打开「自动回复」，定好范围和白名单。做完这一步，QQ 里发一句就能收到回复了。',
      page: 'channels',
      btn: '去「自动回复」',
      done: (s) => !!(s.auto && s.auto.enabled),
    },
  ];

  // ---------------------------------------------------------------------
  // 模块内容
  // ---------------------------------------------------------------------
  const MODULES = [
    {
      id: 'map',
      title: '先认一下路：左边栏都是干什么的',
      sub: '一分钟看完，后面就知道该点哪儿',
      steps: [
        '左栏上半块是「工作台」：总览（状态 + 一键启动）、消息（QQ / B 站收到的）、对话（你跟她在本机聊）、通道（连接 / 自动回复 / 语音 / 主动聊天都在这里）、模型（用哪个脑子想事情）、表情包、能力说明、插件中心、教程（就是这一页）。',
        '左栏中间是「她在这里」：养成（成长值、关系度）、记忆（她记住的事）、桌宠（桌面那只小女仆）。',
        '左栏最下面是「系统」：管理员（要密钥才进得去，管身份和白名单）。右下角齿轮进「设置」（数据位置、开机自启、恢复默认）。',
        '任何一页右上角都有标题和副标题，说明这页管什么；绝大多数设置改完立刻生效，不用重启。',
      ],
      pits: [
        '第一次用先别急着填一堆：按上面 4 步走完，剩下的慢慢调。',
        '软件所有数据都在一个文件夹里（默认 `D:\\DSh Open`），「设置 → 数据位置」能看到实际路径。',
      ],
    },
    {
      id: 'admin',
      title: '认主人：管理员 QQ + 进入密钥',
      sub: '谁是主人，决定她能对谁不设防',
      page: 'admin',
      btn: '去「管理员」页',
      steps: [
        '点左栏最下面金色那格「管理员」。第一次进来会直接弹窗让你设一把密钥：可以「生成一把」（15 位，含大小写字母、数字，最多一个下划线），也可以自己设（6–15 位，必须同时有大小写字母和数字）。',
        '把密钥抄到别处（记事本、密码管理器）。它是唯一能进这一页的东西，忘了只能删 `data\\admin-key.json` 重新设。',
        '进来以后填「管理员 QQ」（你自己的 QQ 号）和「B 站 UID」（你的 B 站号，私信只发给你），用户名可填可不填，点「保存」。',
        '每次离开这一页就自动上锁，下次进来还要输一遍密钥——这是故意的，防止别人趁你不在打开看。',
      ],
      verify: '总览顶部那张金色卡片「先把主人认一下」消失，就说明填上了。',
      pits: [
        '管理员 QQ 也是「聊天白名单」里的第一个，她永远会回你。',
        '想换密钥：「管理员」页最下面「进入密钥」里填旧密钥 + 新密钥两遍。',
        '密钥输错 5 次会锁 30 秒，等一下再来。',
      ],
    },
    {
      id: 'qq',
      title: '接通 QQ：NapCat（OneBot）',
      sub: '这一步通了，QQ 里才能跟她说话',
      page: 'channels',
      btn: '去「通道」页',
      steps: [
        '先装 NapCatQQ（第三方 QQ 协议端，跟这个软件是两回事）。装好后在 NapCat 里开「OneBot v11 → WebSocket 服务端」，端口填 `3001`，允许本机连接。',
        '回到软件「通道」页的「QQ」分区：填「NapCat 启动程序」的路径（那个 exe）——填了以后这里就能「一键启动」；下面「自己的 QQ」等她登录后会自动显示。',
        '点「连接」（或者让「开机自动连」开着）。连上后这一行会显示「已连上 ws://127.0.0.1:3001」，「消息」页开始有会话。',
        '用另一个 QQ 给这个号发一句「在吗」试一下：如果第 4 步的自动回复已经开了，她就会回。',
      ],
      code: 'NapCat 里要开的两项：\n  OneBot 实现      v11\n  WebSocket 服务端 端口 3001（本机）\n软件的连接地址：ws://127.0.0.1:3001（NapCat 主动连软件）',
      verify: '「通道 → QQ」显示「已连上」，并且「消息」页能看到会话。',
      pits: [
        '连不上先看端口：`Get-NetTCPConnection -LocalPort 3001` 有没有在听——没有就是 NapCat 没起来。',
        'QQ 版本太新可能让 NapCat 上不去，换 NapCat 新版或降 QQ 版本。',
        '别把 NapCat 的端口暴露到公网，它没有密码防护。',
      ],
    },
    {
      id: 'bili',
      title: '接通 B 站：扫码登录 + 私信',
      sub: '她用你的小号刷视频、给管理员发私信',
      page: 'channels',
      btn: '去「通道 → B 站」',
      steps: [
        '「通道」页拉到最下面「B 站 · 账号」，点「扫码登录」，用手机 B 站扫一下（建议用小号，别用主号）。',
        '登录成功后这里会显示昵称和 UID；管理员 UID 在「管理员」页里填（私信发给他）。',
        '想要她主动给你推视频：打开「B 站 · 养成 → 自动私信推荐」。标签可以留空（命中标签的优先推，没命中从热门里挑）。',
        '「B 站 · 收到的私信」能看别人发来的私信；她回 B 站私信的规则跟 QQ 共用「对外规矩」。',
      ],
      verify: '「通道 → B 站 · 账号」显示已登录；「养成」页能看到她最近的推荐记录。',
      pits: [
        'cookie 过期会掉登录，重新扫一次就行。',
        '同一个视频 7 天内不会重复推（防刷屏）。',
        'B 站私信有频率限制，别设太密。',
      ],
    },
    {
      id: 'model',
      title: '选脑子：Ollama / DeepSeek / 硅基流动 / 自定义',
      sub: '先用本地免费的跑通，再决定要不要花钱',
      page: 'model',
      btn: '去「模型」页',
      steps: [
        '「模型 → 接入」里四选一：Ollama（本机）不要钱、断网也能用（先装 Ollama 并 `ollama pull qwen2.5:7b`）；DeepSeek 官方要 API Key；硅基流动要 Key；自定义填任何 OpenAI 兼容地址。',
        '点「配置」填地址 / Key / 模型名，点「测试」——通了会显示它那边有几个模型、多少毫秒。',
        '点「设为当前」，右上角「当前」会变成这套。换模型不用重启。',
        '想省钱：日常用 Ollama 7B，遇到复杂问题再切 DeepSeek。',
      ],
      code: 'Ollama 装好后自己会跑在：http://127.0.0.1:11434/v1\nDeepSeek 官方：https://api.deepseek.com/v1  模型 deepseek-chat',
      verify: '「模型 → 接入」右上角显示「当前：xxx」，并且「测试」返回 ok。',
      pits: [
        '测试报 401 就是 Key 不对或没填；报 404 多半是地址少了 `/v1`。',
        'Ollama 没启动时地址连不上，报「连不上这个地址」。',
        '用云端模型时聊天内容会发到对方服务器；用 Ollama 则完全在本机。',
      ],
    },
    {
      id: 'reply',
      title: '让她回话：范围、白名单、群聊 @',
      sub: '不设这一条，她收到消息也不会回',
      page: 'channels',
      btn: '去「通道 → 自动回复」',
      steps: [
        '「通道 → 自动回复」打开开关。',
        '「范围」选：只回私聊 / 只在群里回 / 都回。群里默认要 @ 她才理。',
        '「只和谁互动」里填白名单 QQ（逗号隔开）；管理员永远在白名单里。留空 = 只回管理员。',
        '群里还要在「群聊分寸感」里把群号加进允许名单，再设冷却秒数和每分钟上限，免得刷屏。',
      ],
      verify: '你在 QQ 里发一句，她几秒内回你；日志里没有报错。',
      pits: [
        '群消息不回：先看范围是不是「只回私聊」，再看群号在不在允许名单、有没有 @ 她。',
        '她回得慢：模型慢（本地 7B 在弱机器上要几秒）或网络慢，不是卡死。',
        '想让她只回你：白名单留空就行。',
      ],
    },
    {
      id: 'memory',
      title: '记忆与养成：她怎么记住你',
      sub: '记忆存在本机数据库，不上传',
      page: 'model',
      btn: '去「模型 → 记忆」',
      steps: [
        '「模型 → 记忆」里选记忆方式：只用关键词（最省）/ 本地 + Ollama 向量（按意思找，推荐）。',
        '点「补算向量」把已有记忆都算一遍，之后新记忆会自动补。',
        '手动加一条试试：「记一条：比如 主人喜欢早上听歌」，再用带意思的话问她，看能不能翻出来。',
        '「遗忘曲线」决定旧记忆多久变淡、低于多少归档；归档不是删除，还能翻出来。',
        '「养成」页是成长值和关系度，聊天多、聊得久会涨。',
      ],
      verify: '「模型 → 记忆」右上角「共 N 条」，且「按意思找」显示「已向量 N/N」。',
      pits: [
        '向量模型要 Ollama 在线（nomic-embed-text，768 维）。',
        '换电脑只拷 data 文件夹，记忆和关系就都带走了。',
        '「恢复默认设置」不会动记忆和养成。',
      ],
    },
    {
      id: 'stickers',
      title: '表情包：把图库接进来',
      sub: '文件名能看出情绪，就自动分组',
      page: 'stickers',
      btn: '去「表情包」页',
      steps: [
        '「表情包」页选一个目录（留空就是先不用表情包），点「使用这个目录」。',
        '文件名里带「笑/哭/生气/摸头」这类词会自动分到对应分组；看不出来的进「其它」，可以在「管理」里改。',
        '「重新扫描」会重新读目录；图多的话第一次会慢几秒。',
        '「收到表情就存进来」会把管理员发来的表情自动收进目录（同一张只存一次）。',
      ],
      verify: '页面顶部「共 N 张 · M 个分组」，下面能挑出图。',
      pits: [
        '目录里的子文件夹也会扫。',
        '清空目录后再扫描不会报错（已修）。',
        '一张图都挑不出来，先看是不是没选目录。',
      ],
    },
    {
      id: 'voice',
      title: '语音：让她真的说话',
      sub: '两种引擎二选一，先选引擎再填字段',
      page: 'channels',
      btn: '去「通道 → 说话」',
      steps: [
        '「通道 → 说话（语音 API）」最上面选引擎：OpenAI 兼容（任何能吃 `/audio/speech` 的服务）或豆包（火山引擎）。',
        'OpenAI 兼容：填接口地址（填到 `/v1` 就行）、模型名、音色、Key。豆包：填 APPID、Access Token、Cluster（一般 volcano_tts）、voice_type。',
        '打开「允许发语音」，点「试听一句」——通了会自动播放，下面状态行变成「已配置」。',
        '什么时候发语音：你在 QQ 里说「发条语音」这类，必发；平时按「回语音的概率」随机发。',
      ],
      verify: '「试听一句」能听到声音；日志里有 `voice_usage` 记录。',
      pits: [
        '豆包只认 mp3 / wav / ogg / pcm，别的格式会自动改 mp3。',
        '报「连不上这个地址」= 端口没开或域名写错；报 401 = Key 错。',
        '语音失败会退回发文字，并在文字后面说明原因。',
      ],
    },
    {
      id: 'remote',
      title: '遥控电脑：普通操作直接做，危险操作要按格式',
      sub: '关机、重启、卸载这类，必须你亲手发确认行',
      page: 'model',
      btn: '去「模型 → 遥控电脑」',
      steps: [
        '「模型 → 遥控电脑」打开「允许 QQ 指挥电脑」。白名单在「管理员」页里改；管理员自己永远可以。',
        '普通操作直接用话指挥：「截个屏」「打开 bilibili」「内存还剩多少」。',
        '危险操作（关机 / 重启 / 注销 / 睡眠 / 锁屏 / 卸载）她不会直接做：她会回你一行格式，比如 `!Control computer：确认关机`。',
        '你把这一行原样单独发给她（行首就是它、前面不能有别的字），她才会真的执行。',
        '关机默认有 60 秒缓冲，反悔就发「取消关机」。',
      ],
      code: '格式（大小写、中英文冒号都行）：\n!Control computer：确认关机\n!Control computer：确认重启\n!Control computer：确认取消关机',
      verify: '发完确认行后 1 秒内，她会回「60 秒后关机。反悔的话发「取消关机」。」',
      pits: [
        '别人照抄这一行也没用——每次执行前都会再查一次权限。',
        '她自己的回复里就算带了这行也不会执行，只认你亲手发的那条消息。',
        '「跑命令」开关能执行任意 PowerShell，最危险，平时别开。',
      ],
    },
    {
      id: 'proactive',
      title: '主动聊天：她什么时候自己来找你',
      sub: 'QQ 和 B 站共用一套节奏',
      page: 'channels',
      btn: '去「通道 → 主动聊天」',
      steps: [
        '「通道 → 主动聊天」打开开关。',
        '「节奏」二选一：固定间隔（到点就发）或概率曲线（隔得越久越可能发，可以在图上双击加点、拖圆点改）。',
        '「最长间隔」是保底：到了这个时间一定会说一句；「免打扰时段」里一句都不发。',
        'QQ 私聊和 B 站私信推荐共用这套节奏，但各记各的「上次开口」，互不打断。',
      ],
      verify: '「通道 → 主动聊天」显示「已开启」；日志里有 `proactive: 已主动发给 …`。',
      pits: [
        '觉得太吵：把曲线整体往下压，或者把最长间隔调到 180–240 分钟。',
        '不发：先看开关、免打扰时段，以及「自动回复」是不是关着。',
        '群聊不会主动说话，只发私聊。',
      ],
    },
    {
      id: 'guard',
      title: '对外规矩：别人问什么都问不出你',
      sub: '只对管理员放行，白名单也照样受限',
      page: 'model',
      btn: '去「模型 → 对外规矩」',
      steps: [
        '「模型 → 对外规矩」默认开着，里面有 9 条写死的底线（管理员身份、联系方式、住址、这台电脑的信息、你们之间的私事、冒充套话、改设定、帮别人执行命令、不许长篇解释）。',
        '「你自己加的」框里一行一条写自己的规矩，最多 20 条；她按意思理解，不会原文念给别人。',
        '「被追问时甩表情包挡回去」开着的话，别人套隐私时会甩一张「威胁」组的表情。',
        '「看一眼实际加了什么」可以分别预览「别人问她时」「你问她时」真正发出去的提示词。',
      ],
      verify: '点「别人问她时」能看到 800 多字的护栏；点「你问她时」是 0 字。',
      pits: [
        '这是提示词级约束，不是系统隔离；特别刁钻的套话仍可能被绕，最在意的事自己写进自定义规矩。',
        '白名单只是「允许回话」，不等于「允许知道」。',
        '关掉这一栏，别人问什么她都会照实说。',
      ],
    },
    {
      id: 'data',
      title: '数据、备份、搬家、恢复出厂',
      sub: '所有东西都在一个文件夹里',
      steps: [
        '「设置 → 数据位置」能看到 data / cache / logs 的真实路径（默认都在软件目录下）。',
        '备份：关掉软件，把整个 `data` 文件夹复制一份就是完整备份（设置 + 数据库 + 日志 + 表情包索引）。',
        '搬家：拷走整个软件文件夹（含 runtime、plugins、data），到新机器双击就能用。',
        '「设置 → 恢复默认设置」只把各个选项回到刚下载时的样子；管理员身份、表情包、养成、记忆都不会动。',
        '想彻底重来：关掉软件删掉 `data` 文件夹，再打开就是全新白板（管理员也要重新认）。',
      ],
      verify: '「设置 → 关于」能看到版本号；「数据位置」几行都能点开。',
      pits: [
        '别只拷 `settings.json`，记忆和聊天在 `dsh-open.db` 里。',
        '换机器时 `data\\userData` 是 Electron 缓存，可以不拷。',
        '发给别人演示：只带软件本体（app、runtime、plugins），别带 data。',
      ],
    },
    {
      id: 'faq',
      title: '常见问题',
      sub: '遇到问题先到这里翻一眼',
      faq: [
        ['QQ 里她不回消息', '看「通道 → 自动回复」开没开、范围是不是「只回私聊」、你的 QQ 在不在白名单；群里还要 @ 她。'],
        ['连不上 NapCat', '3001 端口没在听：NapCat 没启动，或者 NapCat 里的 WS 服务端没开。'],
        ['模型测试 401 / 404', '401 = Key 错；404 = 地址少了 `/v1`；连不上 = 地址或端口不对。'],
        ['她说自己是文字 AI、发不了语音', '「通道 → 说话」里引擎和字段没填全，或者「允许发语音」关着。'],
        ['桌面没有桌宠', '「桌宠」页打开开关；尺寸默认 220，按住左键 0.28 秒才能拖动。'],
        ['图标还是旧的', '按 F5 刷资源管理器；还不行就重启一次资源管理器（图标缓存）。'],
        ['忘记进入密钥', '关掉软件，删掉 `data\\admin-key.json`，再进「管理员」页会重新让你设一把。'],
        ['想让别人也能跟她聊', '把对方 QQ 加进「通道 → 只和谁互动」的白名单；对方仍受「对外规矩」限制。'],
        ['日志在哪', '「设置 → 数据位置 → 日志目录」，一天一个文件；出问题先看最后几行。'],
        ['想彻底清空', '关掉软件删 `data` 文件夹；不想全删就用「设置 → 恢复默认设置」只回选项。'],
      ],
    },
  ];

  // ---------------------------------------------------------------------
  // 渲染
  // ---------------------------------------------------------------------
  PAGES.tutorial = {
    async render(root, ctx) {
      const { h } = ctx;

      const state = await readState(ctx);
      if (!ctx.alive()) return;

      // ---- 顶部：四步上手 ----
      const hero = h(
        'section',
        { class: 'section tut-hero' },
        h(
          'div',
          { class: 'tut-hero-head' },
          h('div', null,
            h('div', { class: 'tut-hero-title', text: '从零到能聊：四步' }),
            h('div', {
              class: 'tut-hero-desc',
              text: '跟着这四步走完，QQ 里就能跟她说话了。标签读的是你当前真实配置，不是示例。',
            }),
          ),
          h('div', { class: 'tut-hero-tools' },
            h('button', {
              class: 'chip-btn',
              text: '全部展开',
              onClick: () => root.querySelectorAll('.tut-mod').forEach((m) => m.classList.add('is-open')),
            }),
            h('button', {
              class: 'chip-btn',
              text: '全部收起',
              onClick: () => root.querySelectorAll('.tut-mod').forEach((m) => m.classList.remove('is-open')),
            }),
          ),
        ),
        h(
          'div',
          { class: 'tut-steps' },
          QUICK.map((q) => {
            const done = q.done(state);
            return h(
              'div',
              { class: 'tut-step' + (done ? ' is-done' : '') },
              h('div', { class: 'tut-step-top' },
                h('span', { class: 'tut-step-no', text: q.n }),
                h('span', { class: 'badge ' + (done ? 'badge-ok' : 'badge-warn'), text: done ? '已完成' : '待设置' }),
              ),
              h('div', { class: 'tut-step-title', text: q.title }),
              h('div', { class: 'tut-step-desc', text: q.desc }),
              h('button', {
                class: 'chip-btn tut-step-btn',
                text: q.btn,
                onClick: () => ctx.navigate(q.page),
              }),
            );
          }),
        ),
      );
      root.appendChild(hero);

      // ---- 模块列表 ----
      const list = h('div', { class: 'tut-list' });
      let openedDefault = false;

      MODULES.forEach((m, i) => {
        const no = 'M' + (i + 1);
        const st = statusOf(m.id, state);
        const headKids = [
          h('span', { class: 'tut-mod-no', text: no }),
          h('div', { class: 'tut-mod-main' },
            h('div', { class: 'tut-mod-title', text: m.title }),
            h('div', { class: 'tut-mod-sub', text: m.sub }),
          ),
        ];
        if (st) headKids.push(h('span', { class: 'badge ' + (st.done ? 'badge-ok' : 'badge-warn'), text: st.text }));
        if (m.page) {
          headKids.push(h('button', {
            class: 'chip-btn tut-mod-go',
            text: m.btn || '去这一页',
            onClick: (e) => {
              e.stopPropagation();
              ctx.navigate(m.page);
            },
          }));
        }
        headKids.push(h('span', { class: 'tut-arrow', text: '▸' }));

        const bodyKids = [];
        if (m.steps) {
          bodyKids.push(h('div', { class: 'tut-sec-title', text: '要做的事' }));
          bodyKids.push(h('ol', { class: 'tut-ol' }, m.steps.map((s) => h('li', null, s))));
        }
        if (m.code) bodyKids.push(h('pre', { class: 'tut-code', text: m.code }));
        if (m.faq) {
          bodyKids.push(h('div', { class: 'tut-faq' }, m.faq.map(([q, a]) =>
            h('div', { class: 'tut-faq-row' },
              h('div', { class: 'tut-faq-q', text: 'Q：' + q }),
              h('div', { class: 'tut-faq-a', text: 'A：' + a }),
            ),
          )));
        }
        if (m.verify) {
          bodyKids.push(h('div', { class: 'tut-verify' },
            h('span', { class: 'tut-verify-label', text: '怎么算成功' }),
            h('span', { text: m.verify }),
          ));
        }
        if (m.pits) {
          bodyKids.push(h('div', { class: 'tut-sec-title tut-sec-title-gap', text: '常见坑' }));
          bodyKids.push(h('ul', { class: 'tut-pits' }, m.pits.map((p) => h('li', null, p))));
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
              h('div', { class: 'section-title', text: '具体怎么做：按模块来' }),
              h('div', { class: 'section-desc', text: '每一块都能折叠。带状态标签的，是根据你当前配置实时判断的；标着「待设置」的那块，往往就是还没弄的一步。' }),
            ),
          ),
          list,
          h('div', { class: 'section-note', text: '教程写的是当前版本（' + version + '）的真实界面。要是哪天发现按钮名对不上，说明我改了字没同步——直接说一声。' }),
        ),
      );
    },
  };
})();
